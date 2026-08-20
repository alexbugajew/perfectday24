// components/cities/CityCarousel.tsx
//
// Waagerechte Städte-Auswahl, die auf /explore/<stadt> verlinkt.
//
// Bewusst eine Server-Komponente ohne Interaktivität: Der ganze Zweck ist, dass
// die Stadtseiten überhaupt verlinkt sind — auch im ausgelieferten HTML, damit
// Crawler sie nicht länger als verwaiste Seiten sehen. Gescrollt wird nativ
// über den Container, dafür braucht es kein JavaScript.

import Link from "next/link";
import { renderableImageUrl } from "@/lib/renderable-image-url";
import type { CityDirectoryEntry } from "@/lib/cities/city-directory";

type Props = {
  cities: CityDirectoryEntry[];
  /** Überschrift der Sektion. */
  title: string;
  /** Ein Satz darunter; entfällt, wenn nicht gesetzt. */
  subtitle?: string;
  /** Kicker über der Überschrift. */
  kicker?: string;
  /** Optionaler Link rechts oben ("Alle entdecken"). */
  moreHref?: string;
  moreLabel?: string;
  /** Begrenzt die Anzahl der Karten — die Übersicht auf /explore zeigt alle. */
  limit?: number;
};

export default function CityCarousel({
  cities,
  title,
  subtitle,
  kicker,
  moreHref,
  moreLabel = "Alle Städte",
  limit,
}: Props) {
  const shown = typeof limit === "number" ? cities.slice(0, limit) : cities;
  if (shown.length === 0) return null;

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          {kicker ? <div className="pd24-kicker-warm">{kicker}</div> : null}
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-3xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted-warm)]">{subtitle}</p>
          ) : null}
        </div>
        {moreHref ? (
          <Link
            href={moreHref}
            className="hidden min-h-11 items-center text-sm font-medium text-[var(--text-strong)] underline-offset-2 hover:underline sm:inline-flex"
          >
            {moreLabel} →
          </Link>
        ) : null}
      </div>

      {/* Der Streifen scrollt in seinem eigenen Container — die Seite selbst
          bekommt dadurch keine waagerechte Scrollleiste. */}
      <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2">
        {shown.map((city) => {
          const cover = renderableImageUrl(city.coverUrl);
          return (
            <Link
              key={city.slug}
              href={`/explore/${city.slug}`}
              className="group w-[220px] shrink-0 snap-start overflow-hidden rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-large)]"
            >
              <div className="relative h-[130px] w-full overflow-hidden bg-[var(--bg-canvas-warm)]">
                {cover ? (
                  // Bewusst ein einfaches <img>: Die Cover stammen aus wechselnden
                  // Quellen (Editorial-Uploads, Wikimedia, Unsplash), die nicht
                  // alle in der next/image-Hostliste stehen.
                  <img
                    src={cover}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                <div className="absolute bottom-2 left-3 right-3">
                  <div className="truncate text-base font-semibold text-white drop-shadow">
                    {city.label}
                  </div>
                </div>
              </div>
              <div className="px-3 py-2.5 text-xs text-[var(--text-muted)]">
                {city.routeCount} {city.routeCount === 1 ? "Route" : "Routen"}
              </div>
            </Link>
          );
        })}
      </div>

      {moreHref ? (
        <Link
          href={moreHref}
          className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--text-strong)] underline underline-offset-2 sm:hidden"
        >
          {moreLabel} →
        </Link>
      ) : null}
    </section>
  );
}
