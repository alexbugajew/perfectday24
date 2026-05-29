// lib/roadtrip/suggest-types.ts
// Typen und Konstanten für den "Route entdecken"-Feature (Roadtrippers-ähnlich)

export type RoutePreference =
  | "nature"
  | "lake"
  | "viewpoint"
  | "culture"
  | "castle"
  | "food"
  | "town"
  | "adventure"
  | "beach"
  | "market";

export type StopDetour = "none" | "slight" | "moderate" | "significant";

export type SuggestedStop = {
  /** Wird client-seitig generiert */
  id: string;
  name: string;
  category: string;
  emoji: string;
  /** 2-3 Sätze auf Deutsch */
  description: string;
  /** 1 Satz warum es sich lohnt */
  why_visit: string;
  /** Umweg von der Direktroute */
  detour: StopDetour;
  lat: number;
  lng: number;
  /** Geschätzte Verweildauer in Minuten */
  duration_min: number;
};

export type DiscoverRouteResult = {
  stops: SuggestedStop[];
  from: string;
  to: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
};

// ── UI-Konstanten ─────────────────────────────────────────────────────────────

export const ROUTE_PREFERENCES: Array<{
  value: RoutePreference;
  label: string;
  emoji: string;
}> = [
  { value: "nature",    label: "Natur",              emoji: "🌿" },
  { value: "lake",      label: "Seen & Wasser",      emoji: "🏞️" },
  { value: "viewpoint", label: "Aussichtspunkte",    emoji: "👁️" },
  { value: "culture",   label: "Kultur & Museen",    emoji: "🏛️" },
  { value: "castle",    label: "Burgen & Schlösser", emoji: "🏰" },
  { value: "food",      label: "Essen & Trinken",    emoji: "🍽️" },
  { value: "town",      label: "Malerische Städtchen", emoji: "🏘️" },
  { value: "adventure", label: "Abenteuer & Sport",  emoji: "🏔️" },
  { value: "beach",     label: "Strände",            emoji: "🏖️" },
  { value: "market",    label: "Märkte & Shopping",  emoji: "🛍️" },
];

export const DETOUR_LABELS: Record<StopDetour, string> = {
  none:        "Direkt am Weg",
  slight:      "Kleiner Umweg",
  moderate:    "~30 min Umweg",
  significant: "Großer Umweg",
};

export const DETOUR_COLORS: Record<StopDetour, string> = {
  none:        "border-emerald-200 bg-emerald-50 text-emerald-700",
  slight:      "border-sky-200 bg-sky-50 text-sky-700",
  moderate:    "border-amber-200 bg-amber-50 text-amber-700",
  significant: "border-red-200 bg-red-50 text-red-600",
};

export const DURATION_LABELS: Record<number, string> = {};
export function durationLabel(min: number): string {
  if (min < 60) return `${min} Min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} Std` : `${h} Std ${m} Min`;
}
