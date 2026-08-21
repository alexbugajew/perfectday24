import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, eventListJsonLd } from "@/lib/seo/json-ld";
import { PLANNER_33_ROLLOUT } from "@/lib/cities/rollout";
import { countCityEventsByCategory, listCityEvents } from "@/lib/events/around-event";
import { findTimeWindow, type EventTimeWindowSlug } from "@/lib/events/categories";
import { EventDayList, EventFilterBar } from "@/components/events/EventBrowser";

/**
 * Veranstaltungen einer Stadt, gefiltert nach Zeitfenster.
 *
 * Der Weg zur Detailseite, auf der der eigentliche Wert entsteht — Hauptmoment
 * plus Davor und Danach. Die Kategorien liegen auf eigenen Seiten unter
 * /kategorie/<slug>, weil "Konzerte in Köln" eine Suchanfrage ist und eine
 * bestaendige Flaeche verdient; das Zeitfenster bleibt ein Parameter, weil es
 * sich staendig verschiebt.
 */
export const revalidate = 900;

const CITY_MAP = new Map(PLANNER_33_ROLLOUT.map((city) => [city.slug, city]));

type Params = { city: string };
type Search = { zeit?: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { city } = await params;
  const config = CITY_MAP.get(city);
  if (!config) return { title: "Veranstaltungen | PerfectDay24" };

  const title = `Veranstaltungen in ${config.label} | PerfectDay24`;
  const description = `Was demnächst in ${config.label} läuft — Konzerte, Theater, Comedy, Märkte und Ausstellungen, jeweils mit Vorschlägen für davor und danach.`;

  // Leere Seiten gehoeren nicht in den Index — dasselbe Muster, das bei den
  // inhaltslosen Stadtseiten aufgefallen ist. `listCityEvents` steckt in
  // React-cache(), die Abfrage teilt sich also mit dem Seitenaufbau.
  const { from, to } = findTimeWindow(undefined).range(new Date());
  const events = await listCityEvents(city, { from, to });

  return {
    title,
    description,
    openGraph: { title, description, locale: "de_DE", type: "website" },
    alternates: { canonical: `/events/${city}` },
    ...(events.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function CityEventsPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { city } = await params;
  const { zeit } = await searchParams;
  const config = CITY_MAP.get(city);
  if (!config) notFound();

  const window = findTimeWindow(zeit);
  const { from, to } = window.range(new Date());

  const [events, counts] = await Promise.all([
    listCityEvents(city, { from, to }),
    countCityEventsByCategory(city, from, to),
  ]);

  return (
    <main className="pd24-page-standard px-4 pb-20 pt-6">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Start", path: "/" },
            { name: "Veranstaltungen", path: "/events" },
            { name: config.label, path: `/events/${city}` },
          ]),
          eventListJsonLd({
            name: `Veranstaltungen in ${config.label}`,
            pagePath: `/events/${city}`,
            cityLabel: config.label,
            events: events.map((item) => ({ ...item, citySlug: city })),
          }),
        ]}
      />

      <nav className="mb-5 flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href="/events" className="hover:text-[var(--text-strong)]">
          Veranstaltungen
        </Link>
        <span>/</span>
        <span className="text-[var(--text-strong)]">{config.label}</span>
      </nav>

      <header className="mb-6 max-w-2xl">
        <div className="pd24-kicker-warm">Was demnächst läuft</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-4xl">
          Veranstaltungen in {config.label}
        </h1>
        <p className="mt-3 text-base leading-7 text-[var(--text-muted-warm)]">
          Wähle eine Veranstaltung — wir zeigen dir, was davor und danach in
          Laufnähe passt, und bauen daraus auf Wunsch einen kompletten Tag.
        </p>
      </header>

      <div className="mb-8">
        <EventFilterBar
          citySlug={city}
          activeCategory={null}
          activeWindow={window.slug as EventTimeWindowSlug}
          countsByCategory={counts}
        />
      </div>

      <EventDayList
        citySlug={city}
        events={events}
        emptyHint={`Für ${config.label} liegen uns in diesem Zeitraum keine Veranstaltungen vor.`}
      />
    </main>
  );
}
