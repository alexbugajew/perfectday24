// lib/roadtrip/types.ts
// Typdefinitionen für Roadtrip-Routen (date-agnostische Mehrstadt-Routen)

export type RoadtripRouteVisibility = "public" | "link_only" | "private";
export type RoadtripRouteStatus = "draft" | "active" | "completed";

/**
 * Ein einzelner Aufenthalt innerhalb einer Roadtrip-Route.
 * Bewusst ohne Datum — das Datum wird beim Verwenden der Route
 * aus einem Startdatum + Nächte-Summe berechnet.
 */
/** Ein einzelner geplanter Tages-Stop (aus KI-Generierung) */
export type RoadtripPlannedStop = {
  label: string;
  hint: string;
  time: string | null;
  itemName: string | null;
};

export type RoadtripRouteStop = {
  citySlug: string;
  cityLabel: string;
  lat: number;
  lng: number;
  nights: number;
  // KI-generierter Tagesplan (individual mode)
  planSummary?: string | null;
  plannedStops?: RoadtripPlannedStop[] | null;
  // Ausgewählte Creator-Route (creator mode)
  creatorRouteId?: string | null;
  creatorRouteSlug?: string | null;
  creatorRouteTitle?: string | null;
};

/** Vollständiges Roadtrip-Route-Objekt (DB-Row) */
export type RoadtripRoute = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  author_user_id: string | null;
  author_name: string | null;
  visibility: RoadtripRouteVisibility;
  status: RoadtripRouteStatus;
  is_featured: boolean;
  share_token: string;
  tags: string[];
  total_nights: number;
  country_codes: string[];
  occasion: string;
  budget: string;
  stops: RoadtripRouteStop[];
  view_count: number;
  clone_count: number;
  created_at: string;
  updated_at: string;
};

/** Daten, die zum Erstellen einer neuen Route benötigt werden */
export type CreateRoadtripRouteInput = {
  title: string;
  description?: string | null;
  tags?: string[];
  occasion: string;
  budget: string;
  visibility: RoadtripRouteVisibility;
  status?: RoadtripRouteStatus; // Default 'draft' wenn nicht angegeben
  stops: RoadtripRouteStop[];
  authorUserId?: string | null;
  authorName?: string | null;
};

/** Hilfsfunktion: Gesamte Nächteanzahl aus Stops */
export function totalNights(stops: RoadtripRouteStop[]): number {
  return stops.reduce((sum, s) => sum + s.nights, 0);
}

/** Hilfsfunktion: Kurze Städteliste z.B. "Berlin → Hamburg → München" */
export function stopSequenceLabel(stops: RoadtripRouteStop[]): string {
  return stops.map((s) => s.cityLabel).join(" → ");
}

/** Hilfsfunktion: Einzigartiger Länder-Set */
export function countryCodes(stops: RoadtripRouteStop[]): string[] {
  return Array.from(new Set(stops.map((s) => s.citySlug.split("-").slice(-1)[0]?.toUpperCase() ?? "DE")));
}

/** Datum aus Startdatum + Offset berechnen */
export function stopArrivalDate(startDate: string, stops: RoadtripRouteStop[], index: number): string {
  let offset = 0;
  for (let i = 0; i < index; i++) {
    offset += stops[i]?.nights ?? 0;
  }
  const d = new Date(`${startDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Slugify: Deutschen Titel → URL-sicherer Slug */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Formatiert eine Occasion für die Anzeige */
export function occasionLabel(occasion: string): string {
  const MAP: Record<string, string> = {
    tourism: "Städtetour",
    friends: "Mit Freunden",
    date: "Zu zweit",
    family: "Familienurlaub",
    party: "Party & Nightlife",
  };
  return MAP[occasion] ?? occasion;
}

/** Formatiert ein Budget für die Anzeige */
export function budgetLabel(budget: string): string {
  const MAP: Record<string, string> = {
    low: "Günstig",
    medium: "Mittel",
    high: "Gehoben",
  };
  return MAP[budget] ?? budget;
}

/** Tagvariablen — für Tag-Chips in Formularen und Karten */
export const ROADTRIP_TAGS = [
  { value: "nature",    label: "Natur",       emoji: "🌿" },
  { value: "culture",   label: "Kultur",      emoji: "🏛️" },
  { value: "food",      label: "Kulinarik",   emoji: "🍽️" },
  { value: "budget",    label: "Budget",      emoji: "💰" },
  { value: "luxury",    label: "Luxus",       emoji: "✨" },
  { value: "adventure", label: "Abenteuer",   emoji: "🏔️" },
  { value: "nightlife", label: "Nightlife",   emoji: "🎉" },
  { value: "jga",       label: "JGA",         emoji: "🥂" },
  { value: "family",    label: "Familie",     emoji: "👨‍👩‍👧" },
  { value: "weekend",   label: "Wochenende",  emoji: "📅" },
  { value: "germany",   label: "Deutschland", emoji: "🇩🇪" },
  { value: "europe",    label: "Europa",      emoji: "🇪🇺" },
] as const;
