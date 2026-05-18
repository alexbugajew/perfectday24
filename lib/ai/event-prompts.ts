// lib/ai/event-prompts.ts

// ─── Types ────────────────────────────────────────────────────────────────────

export type NeedsPromptInput = {
  occasion: string;
  city: string;
  guests: number;
  budgetEur: number | null;
  interests?: string[];
};

export type BookingItem = {
  needSlug: string;
  needLabel: string;
  providerName: string;
  packageName: string;
  packageDescription: string | null;
  priceEur: number;
  priceUnit: "total" | "per_person";
};

export type AgendaPromptInput = {
  occasion: string;
  city: string;
  eventDate: string | null;
  guests: number;
  budgetEur: number | null;
  bookings: BookingItem[];
};

// ─── Label maps ───────────────────────────────────────────────────────────────

const OCCASION_LABEL: Record<string, string> = {
  geburtstag:       "Geburtstag",
  hochzeit:         "Hochzeit",
  teambuilding:     "Teambuilding",
  firmenfeier:      "Firmenfeier",
  kindergeburtstag: "Kindergeburtstag",
  konferenz:        "Konferenz",
  jubilaeum:        "Jubiläum",
  staedtereise:     "Städtereise",
};

const CITY_LABEL: Record<string, string> = {
  "berlin-berlin":     "Berlin",
  "hamburg":           "Hamburg",
  "muenchen":          "München",
  "wien":              "Wien",
  "zuerich":           "Zürich",
  "koeln":             "Köln",
  "frankfurt-am-main": "Frankfurt",
  "stuttgart":         "Stuttgart",
  "duesseldorf":       "Düsseldorf",
  "leipzig":           "Leipzig",
};

// ─── Prompt builders ──────────────────────────────────────────────────────────

export function buildNeedsPrompt(input: NeedsPromptInput): string {
  const occasionLabel = OCCASION_LABEL[input.occasion] ?? input.occasion;
  const cityLabel = CITY_LABEL[input.city] ?? input.city;
  const budgetText = input.budgetEur
    ? `ca. ${input.budgetEur.toLocaleString("de-DE")} €`
    : "kein festes Budget angegeben";
  const interestsText =
    input.interests && input.interests.length > 0
      ? input.interests.join(", ")
      : "keine speziellen Angaben";

  return `
Anlass: ${occasionLabel}
Stadt: ${cityLabel}
Gäste: ${input.guests} Personen
Budget: ${budgetText}
Besondere Interessen / Wünsche: ${interestsText}

Welche Dienstleistungs-Bausteine (Needs) empfiehlst du für diese Veranstaltung?
Antworte mit einem JSON-Objekt { "needs": [...], "reasoning": "..." }.
  `.trim();
}

export function buildAgendaPrompt(input: AgendaPromptInput): string {
  const occasionLabel = OCCASION_LABEL[input.occasion] ?? input.occasion;
  const cityLabel = CITY_LABEL[input.city] ?? input.city;
  const dateText = input.eventDate
    ? new Date(input.eventDate).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Datum noch offen";
  const budgetText = input.budgetEur
    ? `ca. ${input.budgetEur.toLocaleString("de-DE")} €`
    : "kein festes Budget";

  const bookingLines = input.bookings
    .map((b) => {
      const priceText =
        b.priceUnit === "per_person"
          ? `${b.priceEur.toLocaleString("de-DE")} €/Person`
          : `${b.priceEur.toLocaleString("de-DE")} € pauschal`;
      const descText = b.packageDescription ? ` – ${b.packageDescription}` : "";
      return `- ${b.needLabel}: ${b.providerName} · Paket "${b.packageName}"${descText} (${priceText})`;
    })
    .join("\n");

  return `
Anlass: ${occasionLabel}
Stadt: ${cityLabel}
Datum: ${dateText}
Gäste: ${input.guests} Personen
Budget: ${budgetText}

Gebuchte Leistungen:
${bookingLines || "— keine Buchungen hinterlegt —"}

Erstelle einen professionellen Ablaufplan für diese Veranstaltung.
Antworte mit einem JSON-Objekt { "agendaText": "...", "tipsText": "..." }.
  `.trim();
}
