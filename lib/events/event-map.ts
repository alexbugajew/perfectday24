// lib/events/event-map.ts
//
// Gruppen, Zeitfenster und Umkreis-Logik der Event-Karte („Was ist los in
// meiner Nähe").
//
// Bewusst ohne Server-Abhängigkeiten: Die Karte filtert im Browser, weil
// Zeitraum, Kategorien und Umkreis sich mit jedem Antippen ändern und ein
// Server-Rundlauf pro Chip die Karte träge machen würde. Der Server liefert
// einmal die nächsten 14 Tage einer Stadt; alles Weitere passiert hier.

import { haversineKm } from "@/lib/planner/travel";
import type { PlannerEventCategory } from "@/lib/planner/types";

// ─── Kategorie-Gruppen ───────────────────────────────────────────────────────

export type EventMapGroupKey =
  | "maerkte"
  | "feste"
  | "konzerte"
  | "shows"
  | "ausstellungen"
  | "food"
  | "sonstiges";

export type EventMapGroup = {
  key: EventMapGroupKey;
  label: string;
  categories: PlannerEventCategory[];
  /** Pin- und Chipfarbe. */
  color: string;
};

/**
 * Die Gruppen sind gröber als die Kategorieseiten (lib/events/categories.ts):
 * Auf der Karte will man „Märkte" an- und ausschalten, nicht zwischen Markt und
 * Kirmes unterscheiden. Anders als dort bekommen hier auch `community` und
 * `other` einen Platz — auf der Karte fehlten sie sonst stillschweigend, und
 * `community` ist mit Abstand die größte Kategorie (Stadtteilfeste, Umzüge).
 *
 * Die Farben stammen aus der Palette in app/globals.css. Sieben Gruppen
 * brauchen sieben unterscheidbare Töne; deshalb steht Food auf dem roten
 * Zustandston, obwohl der sonst Fehler bedeutet — auf der Karte ist er nur
 * eine Farbe, die Bedeutung trägt das Symbol im Pin.
 */
export const EVENT_MAP_GROUPS: EventMapGroup[] = [
  { key: "maerkte", label: "Märkte", categories: ["market", "fair"], color: "var(--state-success)" },
  {
    key: "feste",
    label: "Feste & Straßenfeste",
    categories: ["festival", "community", "seasonal"],
    color: "var(--brand-warm)",
  },
  { key: "konzerte", label: "Konzerte", categories: ["concert"], color: "var(--brand-warm-deep)" },
  {
    key: "shows",
    label: "Shows & Theater",
    categories: ["show", "theater", "comedy"],
    color: "var(--brand-creative)",
  },
  { key: "ausstellungen", label: "Ausstellungen", categories: ["exhibition"], color: "var(--brand-accent)" },
  { key: "food", label: "Food", categories: ["food_event"], color: "var(--state-error)" },
  { key: "sonstiges", label: "Sonstiges", categories: ["other"], color: "var(--brand-accent-alt)" },
];

const GROUP_BY_CATEGORY = new Map<string, EventMapGroupKey>(
  EVENT_MAP_GROUPS.flatMap((group) => group.categories.map((category) => [category, group.key] as const))
);

/** Unbekannte Kategorien landen in „Sonstiges" statt zu verschwinden. */
export function eventMapGroupFor(category: string): EventMapGroupKey {
  return GROUP_BY_CATEGORY.get(category) ?? "sonstiges";
}

export function eventMapGroup(key: EventMapGroupKey): EventMapGroup {
  return EVENT_MAP_GROUPS.find((group) => group.key === key) ?? EVENT_MAP_GROUPS[EVENT_MAP_GROUPS.length - 1];
}

// ─── Datensatz der Karte ─────────────────────────────────────────────────────

export type EventMapItem = {
  id: string;
  title: string;
  category: string;
  /** Deutscher Kategoriename („Konzert") — serverseitig, damit der Planner-Code nicht ins Karten-Bundle wandert. */
  categoryLabel: string;
  group: EventMapGroupKey;
  /** Beginn und Ende als Epoch-Millisekunden; Ende nur, wenn die Quelle es nennt. */
  startMs: number;
  endMs: number | null;
  /** Kalendertage in Europe/Berlin ("2026-10-16"); bei eintägigen Events gleich. */
  startDay: string;
  endDay: string;
  /** Fertig formatierte Zeitangabe, serverseitig in Europe/Berlin gebaut. */
  whenLabel: string;
  venueName: string | null;
  venueAddress: string | null;
  lat: number | null;
  lng: number | null;
  /** Ticket-Ziel: Awin-Deeplink, wenn der Anbieter freigeschaltet ist, sonst roh. */
  ticketUrl: string | null;
  ticketLabel: string | null;
  ticketSponsored: boolean;
  sourceUrl: string | null;
};

export function hasCoordinates(item: EventMapItem): item is EventMapItem & { lat: number; lng: number } {
  return typeof item.lat === "number" && typeof item.lng === "number";
}

// ─── Zeitfenster ─────────────────────────────────────────────────────────────

export type EventMapWindowSlug = "heute" | "wochenende" | "14-tage";

export const EVENT_MAP_WINDOWS: Array<{ slug: EventMapWindowSlug; label: string }> = [
  { slug: "heute", label: "Heute" },
  { slug: "wochenende", label: "Dieses Wochenende" },
  { slug: "14-tage", label: "Nächste 14 Tage" },
];

export const EVENT_MAP_HORIZON_DAYS = 14;

const BERLIN_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Kalendertag in Europe/Berlin — unabhängig von der Zeitzone des Browsers. */
export function berlinDayKey(ms: number): string {
  return BERLIN_DAY.format(new Date(ms));
}

function shiftDay(key: string, days: number): string {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekday(key: string): number {
  return new Date(`${key}T12:00:00Z`).getUTCDay(); // 0 = Sonntag
}

/**
 * Kalendertage, die ein Zeitfenster abdeckt (beide Grenzen einschließlich).
 *
 * Wochenende wie auf den Listenseiten: Freitag bis Sonntag; wer am Samstag
 * fragt, meint das laufende Wochenende und nicht das nächste.
 */
export function eventMapWindowDays(slug: EventMapWindowSlug, nowMs: number): { from: string; to: string } {
  const today = berlinDayKey(nowMs);
  if (slug === "heute") return { from: today, to: today };
  if (slug === "wochenende") {
    const day = weekday(today);
    if (day === 5 || day === 6 || day === 0) {
      return { from: today, to: shiftDay(today, day === 0 ? 0 : 7 - day) };
    }
    const friday = shiftDay(today, 5 - day);
    return { from: friday, to: shiftDay(friday, 2) };
  }
  return { from: today, to: shiftDay(today, EVENT_MAP_HORIZON_DAYS - 1) };
}

/**
 * Liegt ein Event im Zeitfenster und ist es noch nicht vorbei?
 *
 * Mehrtägige Events (Ausstellungen, Kirmes) zählen, solange sie sich mit dem
 * Fenster überschneiden — eine laufende Ausstellung ist „heute los", auch wenn
 * sie vor drei Wochen eröffnet hat. Ohne Endzeit gilt der Beginn als Ende:
 * Was schon angefangen hat und kein Ende nennt, zeigen wir nicht mehr.
 */
export function isInEventMapWindow(
  item: EventMapItem,
  days: { from: string; to: string },
  nowMs: number
): boolean {
  if (item.startDay > days.to || item.endDay < days.from) return false;
  return (item.endMs ?? item.startMs) >= nowMs;
}

// ─── Umkreis ─────────────────────────────────────────────────────────────────

/** Stufen des Umkreis-Reglers in km; null = keine Begrenzung (ganze Stadt). */
export const EVENT_MAP_RADIUS_STEPS: Array<number | null> = [1, 2, 3, 5, 10, 20, null];

export function distanceKm(
  origin: { lat: number; lng: number },
  item: { lat: number; lng: number }
): number {
  return haversineKm(origin.lat, origin.lng, item.lat, item.lng);
}

/** Planner-Datum für ein laufendes Event: heute statt des längst vergangenen Starttags. */
export function eventMapPlanDate(item: EventMapItem, nowMs: number): string {
  const today = berlinDayKey(nowMs);
  return item.startDay < today ? today : item.startDay;
}
