import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import {
  DISCOVERY_ROUTES,
  DISCOVERY_THEMES,
  type DiscoveryRoute,
} from "@/lib/discovery-routes";

// Browse- und SEO-Einstieg fuer die redaktionellen Entdeckungspfade. Die Seite
// verlinkt alle Routen an einem Ort (interne Verlinkung, Crawl-Pfad) und gibt
// Besuchern einen thematisch sortierten Ueberblick. Datenbasis ist das statisch
// gepflegte Manifest (lib/discovery-routes) — die Cover holen wir best-effort
// aus der DB, mit der gebrandeten OG-Karte als Fallback.

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.perfectday24.de";

export const metadata: Metadata = {
  title: "Entdeckungspfade – Themen-Stadtrundgänge | PerfectDay24",
  description:
    "Über 60 kuratierte Entdeckungspfade durch deutsche Städte: Märchen, Kunst, Industriekultur, Geschichte und mehr – selbst begehbar, mit echten Stationen, Adressen und Karte. Kostenlos und ohne Login.",
  alternates: { canonical: `${SITE_URL}/entdeckungsrouten` },
  openGraph: {
    title: "Entdeckungspfade durch Deutschlands Städte | PerfectDay24",
    description:
      "Über 60 kuratierte Themen-Stadtrundgänge – selbst begehbar, mit echten Stationen und Karte.",
    url: `${SITE_URL}/entdeckungsrouten`,
    type: "website",
    locale: "de_DE",
  },
};

/** Cover-Bilder der gelisteten Routen best-effort laden (Fallback: OG-Karte). */
async function loadCovers(slugs: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return map;
  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await supabase
      .from("user_routes")
      .select("slug, cover_image_url")
      .in("slug", slugs)
      .eq("visibility", "public");
    for (const row of data ?? []) {
      const cover = (row as { slug: string | null; cover_image_url: string | null });
      if (cover.slug && cover.cover_image_url && /^https?:\/\//i.test(cover.cover_image_url)) {
        map.set(cover.slug, cover.cover_image_url);
      }
    }
  } catch {
    // Sitemap-Prinzip: die Seite bleibt auch ohne DB nutzbar (OG-Karten).
  }
  return map;
}

function RouteCard({ route, cover }: { route: DiscoveryRoute; cover: string | null }) {
  const thumb = cover ?? `/routes/${route.slug}/og`;
  return (
    <Link
      href={`/routes/${route.slug}`}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] transition hover:border-[var(--line-strong)] hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
    >
      <div className="relative aspect-[1200/630] w-full overflow-hidden bg-[var(--bg-canvas-warm)]">
        {/*
          next/image statt <img>: die echten Cover kommen als Wikimedia-/Openverse-
          Originale (teils >2,5 MB) und wurden vorher ungenutzt in ~380px-Kacheln
          heruntergerechnet. next/image verkleinert auf die Anzeigegroesse, liefert
          WebP/AVIF, cached und lazy-loadet. `sizes` spiegelt das 1/2/3-Spalten-Raster.
        */}
        <Image
          src={thumb}
          alt={`${route.title} – ${route.city}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="pd24-kicker-warm">{route.city}</div>
        <h3 className="mt-1.5 text-base font-semibold leading-snug text-[var(--text-strong)]">
          {route.title}
        </h3>
        {route.teaser ? (
          <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-[var(--text-muted-warm)]">
            {route.teaser}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export default async function EntdeckungsroutenPage() {
  const covers = await loadCovers(DISCOVERY_ROUTES.map((r) => r.slug));
  const cityCount = new Set(DISCOVERY_ROUTES.map((r) => r.city)).size;

  return (
    <div className="pd24-page-standard min-h-screen bg-[var(--bg-canvas-warm)]">
      <div className="space-y-10">
        {/* ── Kopf ─────────────────────────────────────────────────────────── */}
        <header>
          <div className="pd24-kicker-warm">Entdeckungspfade</div>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--text-strong)] sm:text-3xl">
            Themen-Stadtrundgänge durch Deutschland
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted-warm)] sm:text-base">
            {DISCOVERY_ROUTES.length} kuratierte Entdeckungspfade in {cityCount} Städten – von
            Märchen und Kunst über Industriekultur bis Zeitgeschichte. Jede Route ist selbst
            begehbar, mit echten Stationen, Adressen und Karte. Kostenlos und ohne Login.
          </p>
        </header>

        {/* ── Themen-Sektionen ─────────────────────────────────────────────── */}
        {DISCOVERY_THEMES.map((theme) => {
          const routes = DISCOVERY_ROUTES.filter((r) => r.theme === theme);
          if (routes.length === 0) return null;
          return (
            <section key={theme} aria-label={theme}>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold text-[var(--text-strong)]">{theme}</h2>
                <span className="text-xs text-[var(--text-soft-warm)]">
                  {routes.length} {routes.length === 1 ? "Route" : "Routen"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {routes.map((route) => (
                  <RouteCard key={route.slug} route={route} cover={covers.get(route.slug) ?? null} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
