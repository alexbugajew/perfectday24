// Anlass-Farbwelten + Labels für die Event-Einladung. Wird von der
// Einladungsseite (/events/agenda/[token]) UND den OG-Preview-Bildern
// (opengraph-image.tsx) geteilt, damit WhatsApp-/Mail-Vorschau und Karte
// dieselbe Sprache sprechen.

export type InviteTheme = {
  accent: string;   // Text-Akzent (Kicker, Links) — AA-sicher auf hellen Flächen
  soft: string;     // Rahmen/Divider-Tönung
  heroFrom: string;
  heroMid: string;
  heroTo: string;
  glow: string;     // Medaillon-Schatten
};

export const OCCASION_LABEL: Record<string, string> = {
  geburtstag:       "Geburtstag",
  hochzeit:         "Hochzeit",
  teambuilding:     "Teambuilding",
  firmenfeier:      "Firmenfeier",
  kindergeburtstag: "Kindergeburtstag",
  konferenz:        "Konferenz",
  jubilaeum:        "Jubiläum",
  staedtereise:     "Städtereise",
};

export const OCCASION_EMOJI: Record<string, string> = {
  geburtstag:       "🎂",
  hochzeit:         "💍",
  teambuilding:     "🤝",
  firmenfeier:      "🥂",
  kindergeburtstag: "🎈",
  konferenz:        "🎤",
  jubilaeum:        "✨",
  staedtereise:     "✈️",
};

export const DEFAULT_INVITE_THEME: InviteTheme = {
  accent: "#9a5426",
  soft: "rgba(154, 84, 38, 0.18)",
  heroFrom: "#fdf6ee", heroMid: "#f5e7d2", heroTo: "#efdbc0",
  glow: "rgba(154, 84, 38, 0.18)",
};

export const OCCASION_THEME: Record<string, InviteTheme> = {
  geburtstag: DEFAULT_INVITE_THEME,
  hochzeit: {
    accent: "#96524a",
    soft: "rgba(150, 82, 74, 0.18)",
    heroFrom: "#fdf6f4", heroMid: "#f8e8e3", heroTo: "#f2dcd4",
    glow: "rgba(150, 82, 74, 0.18)",
  },
  kindergeburtstag: {
    accent: "#a3572a",
    soft: "rgba(163, 87, 42, 0.2)",
    heroFrom: "#fef8ee", heroMid: "#fdeed8", heroTo: "#f9e2c4",
    glow: "rgba(163, 87, 42, 0.2)",
  },
  teambuilding: {
    accent: "#47614f",
    soft: "rgba(71, 97, 79, 0.2)",
    heroFrom: "#f5f9f5", heroMid: "#e8f1e8", heroTo: "#dcebde",
    glow: "rgba(71, 97, 79, 0.18)",
  },
  firmenfeier: {
    accent: "#45607a",
    soft: "rgba(69, 96, 122, 0.2)",
    heroFrom: "#f6f9fb", heroMid: "#e9f0f6", heroTo: "#dde7f0",
    glow: "rgba(69, 96, 122, 0.18)",
  },
  konferenz: {
    accent: "#4a5568",
    soft: "rgba(74, 85, 104, 0.2)",
    heroFrom: "#f7f8fa", heroMid: "#edf0f4", heroTo: "#e2e7ed",
    glow: "rgba(74, 85, 104, 0.16)",
  },
  jubilaeum: {
    accent: "#85622a",
    soft: "rgba(133, 98, 42, 0.2)",
    heroFrom: "#fdf9ee", heroMid: "#f8eed7", heroTo: "#f1e3c4",
    glow: "rgba(133, 98, 42, 0.2)",
  },
  staedtereise: {
    accent: "#3d6a70",
    soft: "rgba(61, 106, 112, 0.2)",
    heroFrom: "#f3f9f9", heroMid: "#e4f1f1", heroTo: "#d8eaeb",
    glow: "rgba(61, 106, 112, 0.18)",
  },
};

export function getInviteTheme(occasionSlug: string | null | undefined): InviteTheme {
  return (occasionSlug && OCCASION_THEME[occasionSlug]) || DEFAULT_INVITE_THEME;
}
