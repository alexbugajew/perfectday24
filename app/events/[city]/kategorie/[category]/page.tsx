import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { PLANNER_33_ROLLOUT } from "@/lib/cities/rollout";
import { countCityEventsByCategory, listCityEvents } from "@/lib/events/around-event";
import { findCategoryFilter, findTimeWindow, type EventTimeWindowSlug } from "@/lib/events/categories";
import { EventDayList, EventFilterBar } from "@/components/events/EventBrowser";

/**
 * Veranstaltungen einer Stadt in einer Kategorie — „Konzerte in Köln".
 *
 * Diese Flächen sind die beständigen der Event-Strecke und deshalb die, die
 * indexiert werden sollen: Die Frage „Was läuft am Wochenende in Köln?" wird
 * jede Woche neu gestellt, die Seite dazu bleibt. Einzelne Veranstaltungen
 * verfallen und stehen auf `noindex`.
 *
 * Der Pfad enthaelt bewusst das Segment `kategorie`: Ohne es waere
 * /events/<stadt>/<kategorie> nicht von /events/<stadt>/<eventId> zu
 * unterscheiden — beides ist ein dynamisches Segment an derselben Stelle.
 */
export const revalidate = 900;

const CITY_MAP = new Map(PLANNER_33_ROLLOUT.map((city) => [city.slug, city]));

type Params = { city: string; category: string };
type Search = { zeit?: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { city, category } = await params;
  const config = CITY_MAP.get(city);
  const filter = findCategoryFilter(category);
  if (!config || !filter) return { title: "Veranstaltungen | PerfectDay24" };

  const headline = filter.headline(config.label);
  const title = `${headline} | PerfectDay24`;
  const description = `${headline} — mit Datum, Uhrzeit und Ort. Zu jeder Veranstaltung zeigen wir, was davor und danach in Laufnähe passt.`;

  return {
    title,
    description,
    openGraph: { title, description, locale: "de_DE", type: "website" },
    alternates: { canonical: `/events/${city}/kategorie/${category}` },
  };
}

export default async function CityCategoryEventsPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { city, category } = await params;
  const { zeit } = await searchParams;
  const config = CITY_MAP.get(city);
  const filter = findCategoryFilter(category);
  if (!config || !filter) notFound();

  const window = findTimeWindow(zeit);
  const { from, to } = window.range(new Date());

  const [events, counts] = await Promise.all([
    listCityEvents(city, { from, to, categories: filter.categories }),
    countCityEventsByCategory(city, from, to),
  ]);

  const headline = filter.headline(config.label);

  return (
    <main className="pd24-page-standard px-4 pb-20 pt-6">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Start", path: "/" },
          { name: "Veranstaltungen", path: "/events" },
          { name: config.label, path: `/events/${city}` },
          { name: filter.label, path: `/events/${city}/kategorie/${category}` },
        ])}
      />

      <nav className="mb-5 flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href="/events" className="hover:text-[var(--text-strong)]">
          Veranstaltungen
        </Link>
        <span>/</span>
        <Link href={`/events/${city}`} className="hover:text-[var(--text-strong)]">
          {config.label}
        </Link>
        <span>/</span>
        <span className="text-[var(--text-strong)]">{filter.label}</span>
      </nav>

      <header className="mb-6 max-w-2xl">
        <div className="pd24-kicker-warm">{filter.label}</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-4xl">
          {headline}
        </h1>
        <p className="mt-3 text-base leading-7 text-[var(--text-muted-warm)]">
          Zu jeder Veranstaltung zeigen wir dir, was in Laufnähe davor und danach
          passt — und bauen daraus auf Wunsch einen kompletten Tag.
        </p>
      </header>

      <div className="mb-8">
        <EventFilterBar
          citySlug={city}
          activeCategory={category}
          activeWindow={window.slug as EventTimeWindowSlug}
          countsByCategory={counts}
        />
      </div>

      <EventDayList
        citySlug={city}
        events={events}
        emptyHint={`Für ${headline} liegt uns in diesem Zeitraum nichts vor. Ein anderes Zeitfenster oder eine andere Kategorie hilft vielleicht.`}
      />
    </main>
  );
}
