import { berlinMinutesOfDay, berlinParts } from "./berlin-time";
import type { FamilyAgeBand } from "./types";

export const DEFAULT_FAMILY_AGE_BAND: FamilyAgeBand = "4_10";

export const FAMILY_AGE_BAND_OPTIONS: Array<{
  value: FamilyAgeBand;
  label: string;
  shortLabel: string;
  description: string;
  plannerHint: string;
  autoInterests: string[];
}> = [
  {
    value: "0_6",
    label: "Kinder 0-6 Jahre",
    shortLabel: "0-6 Jahre",
    description:
      "Kurze Wege, Tiere, Spielplatz, einfache kreative Mini-Erlebnisse und eine echte Ruhephase.",
    plannerHint:
      "Ideal fuer Kita- und Vorschulalter: ruhiger Start, Park oder Tiere, unkompliziertes Essen, Mittagsruhe und nur ein kleiner zweiter Programmpunkt.",
    autoInterests: [
      "spielplatz",
      "zoo",
      "aquarium",
      "bauernhof",
      "streichelzoo",
      "park",
      "wasser",
      "indoor spielplatz",
      "karussell",
      "toepfern",
      "kindermuseum",
      "eis",
      "cafe",
    ],
  },
  {
    value: "4_10",
    label: "Kinder 4-10 Jahre",
    shortLabel: "4-10 Jahre",
    description:
      "Mitmach-Museen, Abenteuer, Bewegung und kreative Erfolgserlebnisse zum Mitnehmen.",
    plannerHint:
      "Ideal fuer Grundschulkinder: morgens entdecken, nachmittags auspowern und spaeter noch ein kreativer oder spielerischer Abschluss.",
    autoInterests: [
      "zoo",
      "aquarium",
      "science",
      "spielplatz",
      "mitmach museum",
      "minigolf",
      "trampoline",
      "park",
      "playful",
      "schwimmbad",
      "toepfern",
      "basteln",
    ],
  },
  {
    value: "9_14",
    label: "Kinder 9-14 Jahre",
    shortLabel: "9-14 Jahre",
    description:
      "Challenge, Mitbestimmung, Special-Interest-Spots und kreative Formate ohne Kinderprogramm-Gefuehl.",
    plannerHint:
      "Ideal fuer Preteens: erst Challenge, dann Stadtentdeckung oder Special-Interest und spaeter etwas Kreatives oder ein Abendhighlight.",
    autoInterests: [
      "science",
      "klettern",
      "trampoline",
      "arcade",
      "bowling",
      "escape room",
      "kino",
      "sport",
      "streetfood",
      "aquarium",
      "vr",
      "planetarium",
      "robotik",
      "playful",
    ],
  },
  {
    value: "12_16",
    label: "Kinder 12-16 Jahre",
    shortLabel: "12-16 Jahre",
    description:
      "Mehr Autonomie, urbane Orte, Action, Style, Food-Spots und kontrollierte Freiheit.",
    plannerHint:
      "Ideal fuer Teenager: actionreicher Start, urbanes Essen, freie Stadtzeit, Skill- oder Design-Erlebnis und ein Abendhighlight ohne Kinderprogramm.",
    autoInterests: [
      "arcade",
      "klettern",
      "kino",
      "shopping",
      "streetfood",
      "bowling",
      "viewpoint",
      "view",
      "sport",
      "cafe",
      "science",
      "vr",
      "foodhall",
      "design",
    ],
  },
];

export function resolveFamilyAgeBand(value: unknown): FamilyAgeBand | null {
  if (value === "0_6" || value === "4_10" || value === "9_14" || value === "12_16") {
    return value;
  }
  return null;
}

export function familyAgeBandLabel(ageBand: FamilyAgeBand | null | undefined) {
  return (
    FAMILY_AGE_BAND_OPTIONS.find((option) => option.value === ageBand)?.label ??
    FAMILY_AGE_BAND_OPTIONS.find((option) => option.value === DEFAULT_FAMILY_AGE_BAND)?.label ??
    "Kinder 4-10 Jahre"
  );
}

export function familyAgeBandShortLabel(ageBand: FamilyAgeBand | null | undefined) {
  return (
    FAMILY_AGE_BAND_OPTIONS.find((option) => option.value === ageBand)?.shortLabel ??
    FAMILY_AGE_BAND_OPTIONS.find((option) => option.value === DEFAULT_FAMILY_AGE_BAND)?.shortLabel ??
    "4-10 Jahre"
  );
}

export function familyAgeBandDescription(ageBand: FamilyAgeBand | null | undefined) {
  return (
    FAMILY_AGE_BAND_OPTIONS.find((option) => option.value === ageBand)?.description ??
    FAMILY_AGE_BAND_OPTIONS.find((option) => option.value === DEFAULT_FAMILY_AGE_BAND)?.description ??
    "Aktive, familienfreundliche Tagesplanung mit altersgerechten Highlights."
  );
}

export function familyAgeBandPlannerHint(ageBand: FamilyAgeBand | null | undefined) {
  return (
    FAMILY_AGE_BAND_OPTIONS.find((option) => option.value === ageBand)?.plannerHint ??
    FAMILY_AGE_BAND_OPTIONS.find((option) => option.value === DEFAULT_FAMILY_AGE_BAND)?.plannerHint ??
    "Familienfreundliche Planung mit altersgerechten Stops."
  );
}

export function familyAgeBandAutoInterests(ageBand: FamilyAgeBand | null | undefined) {
  return (
    FAMILY_AGE_BAND_OPTIONS.find((option) => option.value === ageBand)?.autoInterests ??
    FAMILY_AGE_BAND_OPTIONS.find((option) => option.value === DEFAULT_FAMILY_AGE_BAND)?.autoInterests ??
    []
  );
}

// ── Zeitgrenzen für Familienpläne ───────────────────────────────────────────
//
// Praxisfall 15.10.2026: Familientag Berlin, Kinder 4–10, Tagesfenster „Abend"
// → Planner plante 18:00–22:23 mit LEGOLAND ab 19:08, der KI-Pfad schlug
// Comedy- und Konzert-Events um 19 Uhr vor, Planende 00:30. Für Familien
// unbrauchbar. Die Grenzen hier sind die EINZIGE Quelle — deterministischer
// Planner (Startzeit, Event-Anker, Kappung), KI-Pfad (Prompt, Event-Tool,
// Nachprüfung) und der Regression-Guardrail lesen alle von hier.
//
// Alle Werte sind Berliner Wandzeit in Minuten seit Mitternacht.

export type FamilyTimeLimits = {
  /** Spätestes Ende des letzten Stops — danach wird gekappt. */
  latestEndMin: number;
  /** Spätester Beginn eines Events, das als Anker oder Stop in Frage kommt. */
  latestEventStartMin: number;
  /**
   * Beginn des Tagesfensters „Abend" für Familien. Kleine Kinder bekommen
   * einen späten Nachmittag mit frühem Abendessen statt 18–22:30 Uhr.
   */
  eveningStartMin: number;
};

const FAMILY_TIME_LIMITS: Record<FamilyAgeBand, FamilyTimeLimits> = {
  // Kita-Alter: Abendessen gegen 17:30, Schlafenszeit ab ~19 Uhr — der Plan
  // muss vorher enden, inklusive Heimweg.
  "0_6": { latestEndMin: 18 * 60 + 30, latestEventStartMin: 16 * 60 + 30, eveningStartMin: 14 * 60 + 30 },
  "4_10": { latestEndMin: 19 * 60, latestEventStartMin: 17 * 60, eveningStartMin: 15 * 60 },
  "9_14": { latestEndMin: 21 * 60, latestEventStartMin: 19 * 60, eveningStartMin: 17 * 60 },
  "12_16": { latestEndMin: 21 * 60, latestEventStartMin: 19 * 60, eveningStartMin: 17 * 60 },
};

/**
 * Im Familien-„Abend" darf ein Event höchstens eine Stunde vor Fensterbeginn
 * starten. Sonst zieht der Event-Anker den ganzen Plan in den Vormittag
 * (Praxisfall: 10-Uhr-Event im Abend-Modus → „Frühes Essen" um 08:32).
 */
const FAMILY_EVENING_EVENT_LEAD_MIN = 60;

/** Frühester sinnvoller Event-Beginn im gewählten Tagesfenster, sonst null. */
export function familyEarliestEventStartMin(
  limits: FamilyTimeLimits,
  planMode: string | null | undefined
): number | null {
  return planMode === "evening" ? limits.eveningStartMin - FAMILY_EVENING_EVENT_LEAD_MIN : null;
}

/**
 * Events, die länger laufen, sind Zeitraum-Angebote (Markt, Ausstellung,
 * Festival-Tag) — man besucht sie für die Stop-Dauer, nicht bis zum Ende.
 */
const FAMILY_LONG_EVENT_MIN = 4 * 60;

export function familyTimeLimits(ageBand: FamilyAgeBand | null | undefined): FamilyTimeLimits {
  return FAMILY_TIME_LIMITS[resolveFamilyAgeBand(ageBand) ?? DEFAULT_FAMILY_AGE_BAND];
}

/** Grenzen nur für Familienpläne, sonst null. */
export function familyTimeLimitsFor(params: {
  occasion: string | null | undefined;
  familyAgeBand?: FamilyAgeBand | string | null;
}): FamilyTimeLimits | null {
  if (params.occasion !== "family") return null;
  return familyTimeLimits(resolveFamilyAgeBand(params.familyAgeBand));
}

/** 1110 → "18:30" */
export function formatClockMinutes(minutesOfDay: number): string {
  const h = Math.floor(minutesOfDay / 60);
  const m = minutesOfDay % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Wann ist ein Event-Besuch für die Familie vorbei? Bei Zeitraum-Events
 * (> 4 h, z. B. Markt 11–21 Uhr) zählt die Besuchsdauer ab Beginn, sonst das
 * echte Ende bzw. Beginn + Dauer.
 */
export function familyEventVisitEnd(
  startAt: Date,
  endAt: Date | null,
  durationMin: number
): Date {
  if (endAt && endAt.getTime() > startAt.getTime()) {
    const spanMin = (endAt.getTime() - startAt.getTime()) / 60000;
    if (spanMin <= FAMILY_LONG_EVENT_MIN) return endAt;
  }
  return new Date(startAt.getTime() + durationMin * 60000);
}

/**
 * Passt ein Event mit bekannter Startzeit in die Familiengrenzen?
 * Ohne Startzeit lässt sich nichts prüfen → true (die Kappung nach der
 * Terminierung bleibt als Netz).
 */
export function familyEventFitsTimeLimits(params: {
  limits: FamilyTimeLimits;
  startAt: Date | null;
  endAt: Date | null;
  durationMin: number;
  /** Frühester sinnvoller Beginn (z. B. im Abendfenster), optional. */
  earliestStartMin?: number | null;
}): boolean {
  const { limits, startAt, endAt, durationMin, earliestStartMin = null } = params;
  if (!startAt || !Number.isFinite(startAt.getTime())) return true;

  const startMin = berlinMinutesOfDay(startAt);
  if (startMin > limits.latestEventStartMin) return false;
  if (typeof earliestStartMin === "number" && startMin < earliestStartMin) return false;

  const visitEnd = familyEventVisitEnd(startAt, endAt, durationMin);
  // Endet der Besuch erst am Folgetag, ist er in jedem Fall zu spät.
  if (berlinParts(visitEnd).day !== berlinParts(startAt).day) return false;
  return berlinMinutesOfDay(visitEnd) <= limits.latestEndMin;
}

/** Kurzer Hinweistext für Prompt und Oberfläche. */
export function familyTimeRuleText(ageBand: FamilyAgeBand | null | undefined): string {
  const limits = familyTimeLimits(ageBand);
  return `Plan endet spätestens ${formatClockMinutes(limits.latestEndMin)} Uhr, Events beginnen spätestens ${formatClockMinutes(limits.latestEventStartMin)} Uhr`;
}
