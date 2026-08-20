import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PLANNER_33_ROLLOUT } from "@/lib/cities/rollout";
import { listUpcomingCityEvents } from "@/lib/events/around-event";
import { plannerEventLabel } from "@/lib/planner";
import type { PlannerEventCategory } from "@/lib/planner/types";

/**
 * Kommende Veranstaltungen einer Stadt.
 *
 * Bewusst schlank: Diese Seite ist der Weg zur Detailseite, auf der der
 * eigentliche Wert entsteht (Hauptmoment plus Davor und Danach). Die
 * ausgebaute Fassung mit Zeit- und Kategoriefiltern ist Schritt 4 des
 * Konzepts in docs/event-discovery-concept.md.
 *
 * Zum Namenskonflikt: `/events` ist weiterhin der Event-Planer für eigene
 * Feiern. Statische Segmente gewinnen in Next gegen dynamische, `/events/
 * dashboard` und `/events/plan` funktionieren also unverändert. Aufgelöst wird
 * der Konflikt in Schritt 5, wenn der Planer umzieht.
 */
export const revalidate = 900;

const CITY_MAP = new Map(PLANNER_33_ROLLOUT.map((city) => [city.slug, city]));

type Params = { city: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { city } = await params;
  const config = CITY_MAP.get(city);
  if (!config) return { title: "Veranstaltungen | PerfectDay24" };

  const title = `Veranstaltungen in ${config.label} | PerfectDay24`;
  const description = `Was demnächst in ${config.label} läuft — Konzerte, Theater, Märkte und Ausstellungen, jeweils mit Vorschlägen für davor und danach.`;

  return {
    title,
    description,
    openGraph: { title, description, locale: "de_DE", type: "website" },
  };
}

export default async function CityEventsPage({ params }: { params: Promise<Params> }) {
  const { city } = await params;
  const config = CITY_MAP.get(city);
  if (!config) notFound();

  const events = await listUpcomingCityEvents(city, 60);

  // Nach Tag gruppieren — die Reihenfolge ist bereits chronologisch.
  const byDate = new Map<string, typeof events>();
  for (const item of events) {
    if (!byDate.has(item.dateLabel)) byDate.set(item.dateLabel, []);
    byDate.get(item.dateLabel)!.push(item);
  }

  return (
    <main className="pd24-page-standard px-4 pb-20 pt-6">
      <nav className="mb-5 flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href={`/explore/${city}`} className="hover:text-[var(--text-strong)]">
          {config.label}
        </Link>
        <span>/</span>
        <span className="text-[var(--text-strong)]">Veranstaltungen</span>
      </nav>

      <header className="mb-8 max-w-2xl">
        <div className="pd24-kicker-warm">Was demnächst läuft</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-4xl">
          Veranstaltungen in {config.label}
        </h1>
        <p className="mt-3 text-base leading-7 text-[var(--text-muted-warm)]">
          Wähle eine Veranstaltung — wir zeigen dir, was davor und danach in
          Laufnähe passt, und bauen daraus auf Wunsch einen kompletten Tag.
        </p>
      </header>

      {events.length === 0 ? (
        <div className="rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-6">
          <p className="text-sm text-[var(--text-muted)]">
            Für {config.label} liegen uns aktuell keine kommenden Veranstaltungen vor.
          </p>
          <Link href={`/planner?citySlug=${city}`} className="pd24-btn pd24-btn-sm pd24-btn-primary mt-4">
            Trotzdem einen Tag planen
          </Link>
        </div>
      ) : (
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
                      href={`/events/${city}/${item.id}`}
                      className="flex items-baseline gap-4 rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-large)]"
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
      )}
    </main>
  );
}
