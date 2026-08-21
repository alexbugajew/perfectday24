// lib/events/categories.ts
//
// Öffentliche Kategorie- und Zeitfilter der Event-Strecke.
//
// Die Slugs sind bewusst deutsch und lesbar: Sie werden Teil der URL
// (/events/<stadt>/kategorie/<slug>) und damit Teil dessen, wonach Menschen
// suchen — „Konzerte in Köln" ist eine Suchanfrage, „concert" nicht.
//
// Mehrere interne Kategorien können in einen Filter fallen. Nicht jede interne
// Kategorie bekommt einen Filter: `other` und `community` sind Sammelbecken
// ohne klare Erwartung und würden als Navigationspunkt nur enttäuschen.

import type { PlannerEventCategory } from "@/lib/planner/types";

export type EventCategoryFilter = {
  slug: string;
  label: string;
  /** Überschrift der Kategorieseite, in der Form, in der Menschen fragen. */
  headline: (cityLabel: string) => string;
  categories: PlannerEventCategory[];
};

export const EVENT_CATEGORY_FILTERS: EventCategoryFilter[] = [
  {
    slug: "konzerte",
    label: "Konzerte",
    headline: (city) => `Konzerte in ${city}`,
    categories: ["concert"],
  },
  {
    slug: "theater",
    label: "Theater & Show",
    headline: (city) => `Theater und Shows in ${city}`,
    categories: ["theater", "show"],
  },
  {
    slug: "comedy",
    label: "Comedy",
    headline: (city) => `Comedy in ${city}`,
    categories: ["comedy"],
  },
  {
    slug: "ausstellungen",
    label: "Ausstellungen",
    headline: (city) => `Ausstellungen in ${city}`,
    categories: ["exhibition"],
  },
  {
    slug: "maerkte",
    label: "Märkte",
    headline: (city) => `Märkte in ${city}`,
    categories: ["market"],
  },
  {
    slug: "festivals",
    label: "Festivals",
    headline: (city) => `Festivals in ${city}`,
    categories: ["festival"],
  },
  {
    slug: "essen-trinken",
    label: "Essen & Trinken",
    headline: (city) => `Food-Events in ${city}`,
    categories: ["food_event"],
  },
  {
    slug: "kirmes",
    label: "Kirmes & Jahrmarkt",
    headline: (city) => `Kirmes und Jahrmärkte in ${city}`,
    categories: ["fair"],
  },
  {
    slug: "saisonal",
    label: "Saisonales",
    headline: (city) => `Saisonale Veranstaltungen in ${city}`,
    categories: ["seasonal"],
  },
];

export function findCategoryFilter(slug: string): EventCategoryFilter | null {
  return EVENT_CATEGORY_FILTERS.find((entry) => entry.slug === slug) ?? null;
}

// ─── Zeitfenster ─────────────────────────────────────────────────────────────

export type EventTimeWindowSlug = "heute" | "wochenende" | "30-tage";

export type EventTimeWindow = {
  slug: EventTimeWindowSlug;
  label: string;
  /** Zeitraum ab jetzt, in der Zeitzone der Nutzung (Europe/Berlin). */
  range: (now: Date) => { from: Date; to: Date };
};

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

/**
 * Das kommende Wochenende — ab Freitag 00:00 bis Sonntag 23:59.
 *
 * Fällt die Anfrage selbst auf Freitag bis Sonntag, ist das laufende Wochenende
 * gemeint: Wer am Samstag fragt, will nicht auf den naechsten Freitag vertroestet
 * werden.
 */
function weekendRange(now: Date): { from: Date; to: Date } {
  const day = now.getDay(); // 0 = Sonntag
  const isWeekend = day === 5 || day === 6 || day === 0;

  const from = new Date(now);
  if (!isWeekend) {
    const daysUntilFriday = (5 - day + 7) % 7;
    from.setDate(from.getDate() + daysUntilFriday);
    from.setHours(0, 0, 0, 0);
  }

  const to = new Date(from);
  // Von Freitag aus sind es zwei Tage bis Sonntag; am Sonntag selbst keiner.
  const daysUntilSunday = from.getDay() === 0 ? 0 : 7 - from.getDay();
  to.setDate(to.getDate() + daysUntilSunday);
  return { from, to: endOfDay(to) };
}

export const EVENT_TIME_WINDOWS: EventTimeWindow[] = [
  {
    slug: "heute",
    label: "Heute",
    range: (now) => ({ from: now, to: endOfDay(now) }),
  },
  {
    slug: "wochenende",
    label: "Wochenende",
    range: weekendRange,
  },
  {
    slug: "30-tage",
    label: "Nächste 30 Tage",
    range: (now) => ({ from: now, to: new Date(now.getTime() + 30 * 86_400_000) }),
  },
];

export const DEFAULT_TIME_WINDOW: EventTimeWindowSlug = "30-tage";

export function findTimeWindow(slug: string | undefined): EventTimeWindow {
  return (
    EVENT_TIME_WINDOWS.find((entry) => entry.slug === slug) ??
    EVENT_TIME_WINDOWS.find((entry) => entry.slug === DEFAULT_TIME_WINDOW)!
  );
}

// ─── Farbliche Identität ─────────────────────────────────────────────────────

/**
 * Eine Farbe je Kategorie, damit sich Konzert, Ausstellung und Markt auf einen
 * Blick unterscheiden — in der Liste wie im Kopf der Detailseite.
 *
 * Die Werte stammen aus der bestehenden Palette (app/globals.css) statt aus
 * einem neuen Farbkreis: Die Strecke soll wie PerfectDay24 aussehen und nicht
 * wie ein zweites Produkt. Kategorien ohne Eintrag fallen auf den ruhigen
 * Schieferton zurück.
 */
const CATEGORY_ACCENTS: Record<string, string> = {
  concert: "var(--brand-warm-deep)",
  comedy: "var(--brand-warm)",
  theater: "var(--brand-creative)",
  show: "var(--brand-creative)",
  exhibition: "var(--brand-accent)",
  market: "var(--state-success)",
  festival: "var(--brand-warm-deep)",
  food_event: "var(--state-warning)",
  fair: "var(--brand-accent-alt)",
  seasonal: "var(--state-info)",
};

export function categoryAccent(category: string): string {
  return CATEGORY_ACCENTS[category] ?? "var(--brand-accent)";
}
