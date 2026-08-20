import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOccasionPageData } from "./data";
import { occasionHeadline } from "@/lib/cities/occasions";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, routeListJsonLd } from "@/lib/seo/json-ld";

export const revalidate = 3600;

function formatDuration(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} Std.` : `${hours} Std. ${rest} Min.`;
}

/**
 * Stadt×Anlass-Landing-Page.
 *
 * Beantwortet genau die Frage, in der Nutzer suchen ("Was kann man in Köln an
 * einem Date-Abend machen?") — mit den konkreten Stopps im Text, nicht nur mit
 * einer Kachel, die auf die Route verlinkt. Vollständig serverseitig
 * gerendert: Der Inhalt muss ohne JavaScript im HTML stehen, sonst sehen ihn
 * die Crawler nicht, für die die Seite gebaut ist.
 */
export default async function CityOccasionPage({
  params,
}: {
  params: Promise<{ city: string; occasion: string }>;
}) {
  const { city: citySlug, occasion: occasionSlug } = await params;
  const data = await loadOccasionPageData(citySlug, occasionSlug);
  if (!data) notFound();

  const { city, occasion, routes, siblings } = data;
  const headline = occasionHeadline(occasion, city.label);
  const stopCount = routes.reduce((sum, route) => sum + route.stops.length, 0);

  return (
    <main className="pd24-page-standard space-y-6 pb-20 pt-6">
      <JsonLd
        data={[
          routeListJsonLd({
            name: headline,
            pagePath: `/explore/${citySlug}/${occasionSlug}`,
            routes,
          }),
          breadcrumbJsonLd([
            { name: "Start", path: "/" },
            { name: "Entdecken", path: "/explore" },
            { name: city.label, path: `/explore/${citySlug}` },
            { name: occasion.label, path: `/explore/${citySlug}/${occasionSlug}` },
          ]),
        ]}
      />

      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href="/explore" className="hover:text-[var(--text-strong)]">
          Entdecken
        </Link>
        <span>/</span>
        <Link href={`/explore/${citySlug}`} className="hover:text-[var(--text-strong)]">
          {city.label}
        </Link>
        <span>/</span>
        <span className="text-[var(--text-strong)]">{occasion.label}</span>
      </nav>

      {/* Kopf: Die Frage steht sichtbar auf der Seite und wird direkt darunter
          beantwortet — das ist die Form, die Antwortmaschinen zitieren. */}
      <header className="rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
        <div className="pd24-meta">{occasion.label}</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-4xl">
          {headline}
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--text-muted)]">
          {occasion.question(city.label)} {occasion.lead}
        </p>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          {routes.length === 1 ? "1 durchgeplante Route" : `${routes.length} durchgeplante Routen`}
          {stopCount > 0 ? ` mit insgesamt ${stopCount} Stopps` : ""} — von der Redaktion
          zusammengestellt und in der Reihenfolge aufgebaut, in der sie funktionieren.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/planner?citySlug=${citySlug}`} className="pd24-btn pd24-btn-sm pd24-btn-primary">
            Eigenen Tag planen
          </Link>
          <Link href={`/explore/${citySlug}`} className="pd24-btn pd24-btn-sm pd24-btn-secondary">
            Alles in {city.label}
          </Link>
        </div>
      </header>

      {/* Routen mit vollständigem Ablauf */}
      {routes.map((route, index) => (
        <article
          key={route.id}
          className="overflow-hidden rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft)]"
        >
          {route.cover_image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={route.cover_image_url}
              alt={route.title ?? headline}
              className="h-52 w-full object-cover sm:h-64"
              loading={index === 0 ? "eager" : "lazy"}
            />
          ) : null}

          <div className="p-6">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-strong)]">
              {route.slug ? (
                <Link href={`/routes/${route.slug}`} className="hover:underline underline-offset-4">
                  {route.title}
                </Link>
              ) : (
                route.title
              )}
            </h2>

            {route.description ? (
              <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--text-muted)]">
                {route.description}
              </p>
            ) : null}

            {route.stops.length > 0 ? (
              <ol className="mt-5 space-y-4">
                {route.stops.map((stop, stopIndex) => {
                  const duration = formatDuration(stop.duration_min);
                  return (
                    <li key={`${route.id}-${stop.stop_order}`} className="flex gap-3">
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--line-subtle)] text-xs font-semibold text-[var(--text-muted)]"
                      >
                        {stopIndex + 1}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-[var(--text-strong)]">
                          {stop.title}
                          {duration ? (
                            <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
                              {duration}
                            </span>
                          ) : null}
                        </h3>
                        {stop.note ? (
                          <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{stop.note}</p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : null}

            {route.slug ? (
              <Link
                href={`/routes/${route.slug}`}
                className="pd24-btn pd24-btn-sm pd24-btn-secondary mt-6"
              >
                Route mit Karte öffnen
              </Link>
            ) : null}
          </div>
        </article>
      ))}

      {/* Querverweise: Ohne sie wären die Anlass-Seiten untereinander verwaist. */}
      {siblings.length > 0 ? (
        <section className="rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">
            Andere Anlässe in {city.label}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {siblings.map((sibling) => (
              <Link
                key={sibling.slug}
                href={`/explore/${citySlug}/${sibling.slug}`}
                className="rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1.5 text-sm text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)]"
              >
                {sibling.label} in {city.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
