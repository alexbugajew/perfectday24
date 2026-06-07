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
      "Kurze Wege, viel freies Spiel, Tiere, Wasser, sichere Bewegung und planbare Pausen.",
    plannerHint:
      "Ideal fuer Kita- und Vorschulalter: wenig Orga, viele Pausen, sichere Spiel- und Tiermomente statt langer Programmbloecke.",
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
      "eis",
      "cafe",
    ],
  },
  {
    value: "4_10",
    label: "Kinder 4-10 Jahre",
    shortLabel: "4-10 Jahre",
    description:
      "Viel Bewegung, Tiere, Mitmach-Museen, leichte Abenteuer und genug Raum zum Auspowern.",
    plannerHint:
      "Ideal fuer Grundschulkinder: aktiv, neugierig, spielerisch und mit klaren Highlights zum Mitmachen und Entdecken.",
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
    ],
  },
  {
    value: "9_14",
    label: "Kinder 9-14 Jahre",
    shortLabel: "9-14 Jahre",
    description:
      "Mehr Herausforderung, mehr Eigenstaendigkeit, interaktive Erlebnisse und sozialere Aktivitaeten.",
    plannerHint:
      "Ideal fuer Preteens: deutlich weniger Kleinkind-Programm, dafuer mehr Challenge, Action, Mitmachen und gemeinsame Erfolgsmomente.",
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
      "playful",
    ],
  },
  {
    value: "12_16",
    label: "Kinder 12-16 Jahre",
    shortLabel: "12-16 Jahre",
    description:
      "Mehr Autonomie, Peers, urbane Orte, trendige Food-Spots, Challenge und eigene Interessen.",
    plannerHint:
      "Ideal fuer Teenager: klar weg vom Spielplatz, hin zu Eigenstaendigkeit, Social Spots, urbanen Orten und staerkeren Highlights.",
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
