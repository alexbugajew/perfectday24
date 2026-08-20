// lib/cities/occasions.ts
//
// Katalog der Anlässe für die Stadt×Anlass-Landing-Pages
// (/explore/<stadt>/<anlass>).
//
// Hintergrund: Die Anlass-Filterung lief bisher ausschließlich über
// Query-Parameter einer Client-Seite (/explore?citySlug=koeln&occasion=date).
// Für Suchmaschinen und die Crawler der KI-Antwortmaschinen existierte die
// Kombination "Köln + Date-Abend" damit gar nicht als adressierbare Seite —
// obwohl genau in dieser Form gefragt wird ("Was kann man in Köln an einem
// Date-Abend machen?").
//
// Die `tags` sind die Tags, die der Editorial-Ingest an die Routen schreibt.
// Sie sind die einzige verlässliche Anlass-Kennzeichnung: `meta.occasion` ist
// bei den Redaktionsrouten nicht gesetzt.

export type CityOccasion = {
  /** URL-Segment, bewusst deutsch — es ist Teil des Suchbegriffs. */
  slug: string;
  /** Anzeigename, z. B. für Überschriften und Chips. */
  label: string;
  /** Route-Tags, die diesen Anlass kennzeichnen (ODER-Verknüpfung). */
  tags: string[];
  /**
   * Die Frage, die diese Seite beantwortet. Steht sichtbar auf der Seite und
   * dient als Meta-Description-Grundlage — Antwortmaschinen greifen
   * bevorzugt auf Inhalte zu, die eine konkrete Frage direkt beantworten.
   */
  question: (city: string) => string;
  /** Ein Satz darüber, was diesen Anlass ausmacht. Stadtunabhängig. */
  lead: string;
};

export const CITY_OCCASIONS: CityOccasion[] = [
  {
    slug: "date-abend",
    label: "Date-Abend",
    tags: ["date"],
    question: (city) => `Was kann man in ${city} an einem Date-Abend machen?`,
    lead:
      "Ein Aperitif mit Aussicht, ein Essen, das den Abend trägt, und ein letzter Drink — " +
      "in der Reihenfolge, in der es funktioniert, und mit Wegen, die zu Fuß machbar sind.",
  },
  {
    slug: "kneipentour",
    label: "Kneipentour",
    tags: ["pub-crawl"],
    question: (city) => `Wo kann man in ${city} eine Kneipentour machen?`,
    lead:
      "Vier bis sechs Stationen im selben Viertel, sortiert vom ruhigen Einstieg bis zur " +
      "späten Bar — ohne Wege, die den Abend zerreißen.",
  },
  {
    slug: "food-tour",
    label: "Food-Tour",
    tags: ["food-tour"],
    question: (city) => `Wo isst man in ${city} am besten — als Tour über mehrere Stationen?`,
    lead:
      "Statt eines einzigen Restaurants mehrere Stationen: Markt, Klassiker, Süßes zum " +
      "Abschluss. Jede Station mit dem, wofür sie bekannt ist.",
  },
  {
    slug: "familientag",
    label: "Familientag",
    tags: ["family", "explore-family"],
    question: (city) => `Was kann man in ${city} mit Kindern unternehmen?`,
    lead:
      "Ein Tagesablauf mit realistischen Zeitfenstern, Pausen und Wegen, die auch mit " +
      "kurzen Beinen funktionieren.",
  },
  {
    slug: "jga",
    label: "JGA",
    tags: ["jga"],
    question: (city) => `Was macht man bei einem JGA in ${city}?`,
    lead:
      "Ein Ablauf für die Gruppe: gemeinsamer Start, ein Höhepunkt in der Mitte, ein " +
      "Ausklang, bei dem alle noch mitkommen.",
  },
];

export const CITY_OCCASION_MAP = new Map(CITY_OCCASIONS.map((occasion) => [occasion.slug, occasion]));

/** Prüft, ob eine Route über ihre Tags zu einem Anlass gehört. */
export function routeMatchesOccasion(tags: unknown, occasion: CityOccasion): boolean {
  if (!Array.isArray(tags)) return false;
  return tags.some((tag) => typeof tag === "string" && occasion.tags.includes(tag));
}

/**
 * Überschrift der Landing-Page. Bewusst knapp und exakt in der Form, in der
 * gesucht wird — "Date-Abend in Köln", nicht "Die schönsten Date-Ideen".
 */
export function occasionHeadline(occasion: CityOccasion, cityLabel: string): string {
  return `${occasion.label} in ${cityLabel}`;
}
