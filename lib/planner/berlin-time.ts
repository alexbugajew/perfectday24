// Wandzeit-Helfer für den Planner
// ============================================================================
// Alle Planner-Städte liegen in Deutschland — geplante Uhrzeiten meinen
// deshalb Europe/Berlin, unabhängig davon, in welcher Zeitzone der Server
// läuft. Vercel-Functions laufen auf UTC: naive Date-Konstruktion über
// lokale Komponenten verschob dort jeden Plan um +1/+2 Stunden (Abendpläne
// starteten in der Anzeige um 20:00 statt 18:00, der Ausklang endete 00:40).

const BERLIN_TZ = "Europe/Berlin";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BERLIN_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export type BerlinYmd = { year: number; month: number; day: number };
export type BerlinParts = BerlinYmd & { hour: number; minute: number };

/** Berliner Wanduhr-Komponenten eines Instants. */
export function berlinParts(at: Date): BerlinParts {
  const map: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(at)) {
    map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    // Intl liefert für Mitternacht je nach Runtime "24" — auf 0 normalisieren.
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
  };
}

/** Wanduhr-Minuten seit Mitternacht (Berlin). */
export function berlinMinutesOfDay(at: Date): number {
  const parts = berlinParts(at);
  return parts.hour * 60 + parts.minute;
}

/** Wochentag in Berlin (0 = Sonntag, kompatibel zu Date#getDay). */
export function berlinDayIndex(at: Date): number {
  const parts = berlinParts(at);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

function berlinOffsetMs(at: Date): number {
  // Auf volle Minuten kappen — der Formatter kennt keine Sekunden.
  const floored = new Date(Math.floor(at.getTime() / 60000) * 60000);
  const parts = berlinParts(floored);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - floored.getTime();
}

/** Instant für "dieses Datum um minutesOfDay Berliner Wandzeit". */
export function berlinInstant(ymd: BerlinYmd, minutesOfDay: number): Date {
  const naive = Date.UTC(ymd.year, ymd.month - 1, ymd.day, 0, minutesOfDay);
  const candidate = new Date(naive - berlinOffsetMs(new Date(naive)));
  // Zweiter Durchlauf stabilisiert die Sommerzeit-Kanten.
  return new Date(naive - berlinOffsetMs(candidate));
}

/** "YYYY-MM-DD"(-Präfix) → Datumsteile; ungültig → null. */
export function parseYmd(value: string | null | undefined): BerlinYmd | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Heutiges Datum aus Berliner Sicht. */
export function berlinToday(): BerlinYmd {
  const parts = berlinParts(new Date());
  return { year: parts.year, month: parts.month, day: parts.day };
}
