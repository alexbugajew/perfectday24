import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { listCitiesWithRoutes } from "@/lib/cities/city-directory";
import { renderableImageUrl } from "@/lib/renderable-image-url";

/**
 * Einstieg in die Event-Entdeckung.
 *
 * Bis 08/2026 lag hier der Event-Planer — die Strecke, mit der jemand eine
 * eigene Feier plant. Das Navigationslabel „Events" versprach damit etwas
 * anderes, als die Seite lieferte: Wer sehen wollte, was am Wochenende läuft,
 * landete in einem Planungsformular. Der Planer sitzt jetzt unter /feiern,
 * und dieser Pfad gehört der Entdeckung.
 */
export const revalidate = 3600;

const title = "Veranstaltungen entdecken | PerfectDay24";
const description =
  "Konzerte, Theater, Comedy, Märkte und Ausstellungen in deiner Stadt — jeweils mit Vorschlägen, was davor und danach passt.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, locale: "de_DE", type: "website" },
};

export default async function EventsDiscoveryPage() {
  const cities = await listCitiesWithRoutes();

  return (
    <main className="pd24-page-standard px-4 pb-20 pt-6">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Start", path: "/" },
          { name: "Veranstaltungen", path: "/events" },
        ])}
      />

      <header className="mb-8 max-w-2xl">
        <div className="pd24-kicker-warm">Was demnächst läuft</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-4xl">
          Veranstaltungen entdecken
        </h1>
        <p className="mt-3 text-base leading-7 text-[var(--text-muted-warm)]">
          Wähle deine Stadt. Zu jeder Veranstaltung zeigen wir dir, was in
          Laufnähe davor und danach passt — und bauen daraus auf Wunsch einen
          kompletten Tag.
        </p>
        <p className="mt-4 text-sm text-[var(--text-muted)]">
          Du willst stattdessen eine eigene Feier planen?{" "}
          <Link href="/feiern" className="font-medium text-[var(--text-strong)] underline underline-offset-2">
            Zum Event-Planer
          </Link>
        </p>
      </header>

      {cities.length === 0 ? (
        <p className="rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-muted)]">
          Aktuell liegen uns keine Städte mit Veranstaltungen vor.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((city) => {
            const cover = renderableImageUrl(city.coverUrl);
            return (
              <li key={city.slug}>
                <Link
                  href={`/events/${city.slug}`}
                  className="group block overflow-hidden rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-large)]"
                >
                  <div className="relative h-[132px] w-full overflow-hidden bg-[var(--bg-canvas-warm)]">
                    {cover ? (
                      // Wechselnde Bildquellen (Editorial, Wikimedia, Unsplash),
                      // die nicht alle in der next/image-Hostliste stehen.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 text-lg font-semibold text-white drop-shadow">
                      {city.label}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
