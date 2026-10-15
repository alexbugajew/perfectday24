import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PLANNER_33_ROLLOUT } from "@/lib/cities/rollout";
import { listCityMapEvents } from "@/lib/events/around-event";
import EventMapExplorer from "@/components/events/EventMapExplorer";

/**
 * Event-Karte einer Stadt — „Was ist los in meiner Nähe?".
 *
 * Ergänzt die Listen um die Frage nach dem Wo: Welche Märkte, Feste und
 * Konzerte liegen in Laufnähe? Der Server liefert einmal die nächsten 14 Tage,
 * Zeitraum, Kategorien und Umkreis filtert der Browser.
 *
 * Bewusst `noindex`: Die Karte entsteht erst per JavaScript und zeigt dieselben
 * Veranstaltungen wie die Stadt- und Kategorieseiten — die sind die Flächen,
 * die in den Index gehören.
 *
 * Der Pfad `karte` kollidiert nicht mit /events/<stadt>/<eventId>: Statische
 * Segmente haben in Next.js Vorrang vor dynamischen, und Event-IDs sind UUIDs.
 */
export const revalidate = 900;

const CITY_MAP = new Map(PLANNER_33_ROLLOUT.map((city) => [city.slug, city]));

// Kompakte Stadtliste für den Hinweis „Näher an dir liegt …" — nur Städte mit Event-Seiten.
const CITY_POINTS = PLANNER_33_ROLLOUT.map(({ slug, label, lat, lng }) => ({ slug, label, lat, lng }));

type Params = { city: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { city } = await params;
  const config = CITY_MAP.get(city);
  if (!config) return { title: "Event-Karte | PerfectDay24", robots: { index: false, follow: true } };

  const title = `Event-Karte ${config.label}: Was ist los in deiner Nähe? | PerfectDay24`;
  const description = `Märkte, Feste, Konzerte und Shows in ${config.label} auf der Karte — nach Zeitraum, Kategorie und Umkreis gefiltert.`;

  return {
    title,
    description,
    robots: { index: false, follow: true },
    openGraph: { title, description, locale: "de_DE", type: "website" },
  };
}

export default async function CityEventMapPage({ params }: { params: Promise<Params> }) {
  const { city } = await params;
  const config = CITY_MAP.get(city);
  if (!config) notFound();

  const { items, truncated, queriedAtMs } = await listCityMapEvents(city);

  return (
    <main className="pd24-page-standard px-4 pb-20 pt-6">
      <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
          <Link href="/events" className="hover:text-[var(--text-strong)]">
            Veranstaltungen
          </Link>
          <span>/</span>
          <Link href={`/events/${city}`} className="hover:text-[var(--text-strong)]">
            {config.label}
          </Link>
          <span>/</span>
          <span className="text-[var(--text-strong)]">Karte</span>
        </nav>
        <Link
          href={`/events/${city}`}
          className="shrink-0 text-sm font-medium text-[var(--text-strong)] underline underline-offset-2"
        >
          Als Liste
        </Link>
      </div>

      {/* Kopf bewusst knapp: Auf dem Handy soll die Karte möglichst früh im Bild sein. */}
      <header className="mb-5 max-w-2xl sm:mb-6">
        <div className="pd24-kicker-warm">Event-Karte</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-4xl">
          Was ist los in {config.label}?
        </h1>
        <p className="mt-2 text-base leading-7 text-[var(--text-muted-warm)] sm:mt-3">
          Tippe auf einen Pin — von dort geht es zur Veranstaltung oder direkt in deinen Tagesplan.
        </p>
      </header>

      <EventMapExplorer
        citySlug={city}
        cityLabel={config.label}
        center={{ lat: config.lat, lng: config.lng }}
        cityRadiusKm={config.radiusM / 1000}
        items={items}
        truncated={truncated}
        renderedAtMs={queriedAtMs}
        cities={CITY_POINTS}
      />
    </main>
  );
}
