// OSM Opening-Hours-Parser
// ============================================================================
// Nimmt einen opening_hours_raw String (OSM-Format) und einen konkreten
// Zeitpunkt und antwortet ob die Location zu dem Zeitpunkt offen ist.
//
// Handhabt:
// - "24/7"
// - "Mo-Fr 09:00-18:00"
// - "Mo-Fr 09:00-18:00; Sa 10:00-16:00"
// - "Mo,We,Fr 08:00-12:00"
// - "Mo-Sa 11:30-14:30,17:30-23:00" (mehrere Zeitspannen)
// - "Mo-Su 20:00-02:00" (cross-midnight: 02:00 = 2 Uhr Folgetag)
// - "off" / "closed"
//
// Skippt (return open=true fuer Robustheit):
// - PH (public holidays), Ferien, Feiertags-Overrides
// - Sunset/Sunrise/Dawn/Dusk
// - Week-Numbers, Month-Ranges, Season-Overrides
//
// Default-Verhalten:
// - Leer/null Input → true (nicht ausschliessen bei fehlender Info)
// - Unparseable Segment → im Zweifel true fuer den Slot

import { berlinDayIndex, berlinInstant, berlinMinutesOfDay, berlinToday } from "./berlin-time";

export type OpenAtOptions = {
  /** Puffer in Minuten den die Location vor/nach dem Zeitpunkt geoeffnet sein muss. Default 0. */
  bufferMin?: number;
};

const DAY_INDEX: Record<string, number> = {
  su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6,
  // Manche OSM-Feeds nutzen Deutsch-Kurzformen. Toleranter Umgang.
  so: 0, mi: 3, do: 4,
};

const KEYWORDS_SKIP = new Set([
  "ph", "sh", "easter", "sunrise", "sunset", "dawn", "dusk", "weeks",
]);

type TimeSpan = { startMinutes: number; endMinutes: number };
type DayRule = { days: Set<number>; spans: TimeSpan[]; alwaysClosed: boolean };

/** Utility: Minuten seit Mitternacht. */
function timeToMinutes(hhmm: string): number | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hours = parseInt(m[1], 10);
  const mins = parseInt(m[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  if (hours < 0 || hours > 48 || mins < 0 || mins > 59) return null;
  return hours * 60 + mins;
}

/** Parst "Mo", "Mo-Fr", "Mo,Tu,Sa" zu Set von Day-Indices (0=Sun ... 6=Sat). */
function parseDays(part: string): Set<number> | null {
  const clean = part.trim();
  if (!clean) return null;

  const out = new Set<number>();
  const segments = clean.split(",").map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    if (seg.includes("-")) {
      const [rawStart, rawEnd] = seg.split("-").map((s) => s.trim().toLowerCase());
      const startIdx = DAY_INDEX[rawStart];
      const endIdx = DAY_INDEX[rawEnd];
      if (startIdx == null || endIdx == null) return null;
      let cur = startIdx;
      for (let steps = 0; steps < 8; steps += 1) {
        out.add(cur);
        if (cur === endIdx) break;
        cur = (cur + 1) % 7;
      }
    } else {
      const idx = DAY_INDEX[seg.toLowerCase()];
      if (idx == null) return null;
      out.add(idx);
    }
  }
  return out.size > 0 ? out : null;
}

/**
 * Parst "09:00-18:00" oder "09:00-18:00,20:00-02:00" zu TimeSpan[].
 * Cross-Midnight (end < start) wird als Spanne bis 24h+end kodiert.
 */
function parseTimeSpans(part: string): TimeSpan[] | null {
  const clean = part.trim();
  if (!clean) return null;
  const spans: TimeSpan[] = [];
  const segments = clean.split(",").map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    const parts = seg.split("-").map((s) => s.trim());
    if (parts.length !== 2) return null;
    const start = timeToMinutes(parts[0]);
    let end = timeToMinutes(parts[1]);
    if (start == null || end == null) return null;
    if (end === 0) end = 24 * 60;
    if (end <= start) {
      end += 24 * 60;
    }
    spans.push({ startMinutes: start, endMinutes: end });
  }
  return spans.length > 0 ? spans : null;
}

/**
 * Nimmt ein Segment wie "Mo-Fr 09:00-18:00" oder "24/7" und gibt eine DayRule zurueck.
 */
function parseSegment(raw: string): DayRule | null {
  const seg = raw.trim();
  if (!seg) return null;
  const lower = seg.toLowerCase();

  if (lower === "24/7") {
    const days = new Set<number>([0, 1, 2, 3, 4, 5, 6]);
    return { days, spans: [{ startMinutes: 0, endMinutes: 24 * 60 }], alwaysClosed: false };
  }
  if (lower === "off" || lower === "closed") return null;

  const cleaned = seg.replace(/\([^)]*\)/g, "").trim();
  const parts = cleaned.split(/\s+/);
  let splitIdx = -1;
  for (let i = 0; i < parts.length; i += 1) {
    const t = parts[i].toLowerCase();
    if (t === "off" || t === "closed" || /^\d{1,2}:\d{2}/.test(parts[i])) {
      splitIdx = i;
      break;
    }
  }
  if (splitIdx === -1) return null;

  const dayPart = parts.slice(0, splitIdx).join(" ").trim();
  const timePart = parts.slice(splitIdx).join(" ").trim();

  const dayPartLower = dayPart.toLowerCase();
  for (const kw of KEYWORDS_SKIP) {
    if (dayPartLower.includes(kw)) return null;
  }

  const days = parseDays(dayPart);
  if (!days) return null;

  const timePartLower = timePart.toLowerCase();
  if (timePartLower === "off" || timePartLower === "closed") {
    return { days, spans: [], alwaysClosed: true };
  }
  if (timePartLower === "24/7" || timePartLower === "00:00-24:00") {
    return { days, spans: [{ startMinutes: 0, endMinutes: 24 * 60 }], alwaysClosed: false };
  }

  const spans = parseTimeSpans(timePart);
  if (!spans) return null;

  return { days, spans, alwaysClosed: false };
}

/** Parst kompletten opening_hours-String zu Liste von Regeln. */
export function parseOpeningHours(raw: string | null | undefined): DayRule[] | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "24/7") {
    return [{
      days: new Set([0, 1, 2, 3, 4, 5, 6]),
      spans: [{ startMinutes: 0, endMinutes: 24 * 60 }],
      alwaysClosed: false,
    }];
  }
  const segments = trimmed.split(";").map((s) => s.trim()).filter(Boolean);
  const rules: DayRule[] = [];
  for (const seg of segments) {
    const rule = parseSegment(seg);
    if (rule) rules.push(rule);
  }
  return rules.length > 0 ? rules : null;
}

/**
 * Prueft ob eine Location zum angegebenen Zeitpunkt offen ist.
 * Bei fehlender/unparseabler Info → true (nicht ausschliessen).
 */
export function isOpenAt(
  raw: string | null | undefined,
  at: Date,
  options: OpenAtOptions = {}
): boolean {
  const rules = parseOpeningHours(raw);
  if (!rules) return true;

  const bufferMin = options.bufferMin ?? 0;
  // Öffnungszeiten-Strings meinen lokale Zeit der (deutschen) Location —
  // den Instant deshalb als Berliner Wanduhr lesen, nicht in Server-Zeitzone.
  const dayIdx = berlinDayIndex(at);
  const minutesToday = berlinMinutesOfDay(at);
  const yesterdayIdx = (dayIdx + 6) % 7;
  const minutesYesterday = minutesToday + 24 * 60;

  // Strikte Buffer-Semantik: das Fenster [t, t+bufferMin] muss vollstaendig innerhalb
  // einer geoeffneten Spanne liegen. Damit ist die Location noch mind. bufferMin Min
  // nach der geplanten Ankunft offen.
  let openToday = false;
  for (const rule of rules) {
    if (rule.days.has(dayIdx)) {
      if (rule.alwaysClosed) continue;
      for (const span of rule.spans) {
        if (minutesToday >= span.startMinutes && minutesToday + bufferMin < span.endMinutes) {
          openToday = true;
        }
      }
    }
    if (rule.days.has(yesterdayIdx)) {
      if (rule.alwaysClosed) continue;
      for (const span of rule.spans) {
        if (span.endMinutes > 24 * 60) {
          if (minutesYesterday >= span.startMinutes && minutesYesterday + bufferMin < span.endMinutes) {
            openToday = true;
          }
        }
      }
    }
  }

  // OSM-Semantik: wenn wir Regeln erfolgreich parsen konnten und keine davon
  // dem gefragten Zeitpunkt eine offene Spanne zuweist, ist geschlossen.
  return openToday;
}

// ─── Legacy-Helper ──────────────────────────────────────────────────────────
// Behaelt die alte Signatur fuer Aufrufer in scoring.ts. Nutzt intern den
// neuen Parser wo moeglich.

export function isLikelyOpen(params: {
  openingHoursRaw?: string | null;
  preferredDaytimes: string[];
}) {
  const { openingHoursRaw, preferredDaytimes } = params;

  if (!openingHoursRaw) return true;

  const oh = openingHoursRaw.toLowerCase();
  if (oh.includes("24/7")) return true;

  // Heuristik ohne konkreten Zielzeitpunkt: pruefen ob die Location zu einem
  // typischen Zeitpunkt der bevorzugten Tageszeit geoeffnet waere. Nutzt den
  // vollen Parser mit einem plausiblen Uhrzeit-Proxy.
  const targetHour =
    preferredDaytimes.includes("morning") ? 10 :
    preferredDaytimes.includes("midday") ? 13 :
    preferredDaytimes.includes("afternoon") ? 16 :
    preferredDaytimes.includes("evening") ? 20 :
    preferredDaytimes.includes("night") ? 23 : 18;
  const proxy = berlinInstant(berlinToday(), targetHour * 60);

  return isOpenAt(openingHoursRaw, proxy, { bufferMin: 30 });
}
