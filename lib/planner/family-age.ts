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
