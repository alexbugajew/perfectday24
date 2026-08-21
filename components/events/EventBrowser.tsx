// components/events/EventBrowser.tsx
//
// Filterleiste und Veranstaltungsliste für die Event-Strecke.
//
// Bewusst Server-Komponenten ohne Interaktivität: Die Filter sind Links, keine
// Schaltflächen mit Zustand. Damit steht jede Auswahl in der URL, ist teilbar,
// über den Zurück-Knopf erreichbar — und im ausgelieferten HTML sichtbar. Eine
// Kategorieseite, die ihre Auswahl erst per JavaScript trifft, wäre für die
// Crawler der Antwortmaschinen leer.

import Link from "next/link";
import type { CityEventListItem } from "@/lib/events/around-event";
import {
  categoryAccent,
  EVENT_CATEGORY_FILTERS,
  EVENT_TIME_WINDOWS,
  type EventTimeWindowSlug,
} from "@/lib/events/categories";
import { plannerEventLabel } from "@/lib/planner";
import type { PlannerEventCategory } from "@/lib/planner/types";

type FilterBarProps = {
  citySlug: string;
  /** Slug der aktiven Kategorie, null auf der Stadtübersicht. */
  activeCategory: string | null;
  activeWindow: EventTimeWindowSlug;
  /** Anzahl je interner Kategorie im aktuellen Zeitfenster. */
  countsByCategory: Record<string, number>;
};

function chipClass(active: boolean) {
  return [
    "inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm transition",
    active
      ? "border-transparent bg-[var(--text-strong)] font-medium text-white"
      : "border-[var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-strong)]",
  ].join(" ");
}

export function EventFilterBar({
  citySlug,
  activeCategory,
  activeWindow,
  countsByCategory,
}: FilterBarProps) {
  const base = activeCategory
    ? `/events/${citySlug}/kategorie/${activeCategory}`
    : `/events/${citySlug}`;

  // Nur Kategorien anbieten, hinter denen im Zeitfenster auch etwas steht.
  // Ein Filter, der auf eine leere Seite führt, ist schlimmer als keiner.
  const available = EVENT_CATEGORY_FILTERS.map((filter) => ({
    filter,
    count: filter.categories.reduce((sum, key) => sum + (countsByCategory[key] ?? 0), 0),
  })).filter((entry) => entry.count > 0 || entry.filter.slug === activeCategory);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {EVENT_TIME_WINDOWS.map((window) => {
          const href = window.slug === "30-tage" ? base : `${base}?zeit=${window.slug}`;
          return (
            <Link key={window.slug} href={href} className={chipClass(window.slug === activeWindow)}>
              {window.label}
            </Link>
          );
        })}
      </div>

      {available.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Link
            href={activeWindow === "30-tage" ? `/events/${citySlug}` : `/events/${citySlug}?zeit=${activeWindow}`}
            className={chipClass(activeCategory === null)}
          >
            Alles
          </Link>
          {available.map(({ filter, count }) => {
            const target = `/events/${citySlug}/kategorie/${filter.slug}`;
            const href = activeWindow === "30-tage" ? target : `${target}?zeit=${activeWindow}`;
            return (
              <Link
                key={filter.slug}
                href={href}
                className={chipClass(filter.slug === activeCategory)}
              >
                {filter.label}
                <span className="ml-1.5 tabular-nums opacity-60">{count}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

type ListProps = {
  citySlug: string;
  events: CityEventListItem[];
  emptyHint: string;
};

export function EventDayList({ citySlug, events, emptyHint }: ListProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-6">
        <p className="text-sm text-[var(--text-muted)]">{emptyHint}</p>
        <Link href={`/planner?citySlug=${citySlug}`} className="pd24-btn pd24-btn-sm pd24-btn-primary mt-4">
          Trotzdem einen Tag planen
        </Link>
      </div>
    );
  }

  // Die Liste kommt bereits chronologisch; hier nur nach Tagen gruppiert.
  const byDate = new Map<string, CityEventListItem[]>();
  for (const item of events) {
    if (!byDate.has(item.dateLabel)) byDate.set(item.dateLabel, []);
    byDate.get(item.dateLabel)!.push(item);
  }

  return (
    <div className="flex flex-col gap-8">
      {[...byDate].map(([dateLabel, items]) => (
        <section key={dateLabel}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--text-soft)]">
            {dateLabel}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/events/${citySlug}/${item.id}`}
                  className="flex items-baseline gap-4 rounded-[var(--radius-card-sm)] border border-l-2 border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-large)]"
                  style={{ borderLeftColor: categoryAccent(item.category) }}
                >
                  <span className="w-12 shrink-0 text-sm tabular-nums text-[var(--text-muted)]">
                    {item.timeLabel}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--text-strong)]">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
                      {plannerEventLabel(item.category as PlannerEventCategory)}
                      {item.venueName ? ` · ${item.venueName}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
