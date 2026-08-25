import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { PLANNER_33_ROLLOUT } from "@/lib/cities/rollout";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, routeListJsonLd } from "@/lib/seo/json-ld";
import { CITY_OCCASIONS, routeMatchesOccasion } from "@/lib/cities/occasions";

// ─── City map ────────────────────────────────────────────────────────────────

const CITY_MAP = new Map(PLANNER_33_ROLLOUT.map((c) => [c.slug, c]));

// ─── Types ───────────────────────────────────────────────────────────────────

type RouteRow = {
  id: string;
  slug: string | null;
  title: string | null;
  description: string | null;
  cover_image_url: string | null;
  creator_type: string | null;
  stop_count: number | null;
  like_count: number | null;
  bookmark_count: number | null;
  ranking_score: number | null;
  is_featured: boolean;
  start_label: string | null;
  tags: unknown;
};

type CreatorRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  creator_type: string;
  route_count: number | null;
  is_verified: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SAFE_HOSTS = new Set([
  "nxrkhlokadhwwtuoglxa.supabase.co",
  "images.unsplash.com", "plus.unsplash.com",
  "upload.wikimedia.org", "commons.wikimedia.org",
  "lh3.googleusercontent.com", "graph.microsoft.com",
  "res.cloudinary.com", "i.imgur.com", "cdn.pixabay.com", "images.pexels.com",
]);

function isSafeHost(url: string | null): boolean {
  if (!url) return false;
  try { return SAFE_HOSTS.has(new URL(url).hostname); } catch { return false; }
}

function creatorTypeLabel(t: string | null) {
  if (t === "influencer") return "Influencer";
  if (t === "creator") return "Creator";
  if (t === "brand") return "Brand";
  if (t === "editorial") return "Editorial";
  return "Community";
}

const OCCASION_LABELS: Record<string, { emoji: string; label: string }> = {
  date:    { emoji: "💑", label: "Date" },
  friends: { emoji: "👥", label: "Mit Freunden" },
  family:  { emoji: "👨‍👩‍👧", label: "Familie" },
  tourism: { emoji: "🏛️", label: "Sightseeing" },
  party:   { emoji: "🎉", label: "Party" },
  event:   { emoji: "🎫", label: "Events" },
};

// ─── Data fetching ────────────────────────────────────────────────────────────

type CityCover = {
  editorial_cover_url: string | null;
  editorial_cover_alt: string | null;
  editorial_cover_credit: string | null;
  editorial_cover_source: string | null;
};

async function fetchCityData(citySlug: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date();
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);

  const [routesResult, creatorsResult, cityCoverResult, eventCountResult] = await Promise.all([
    supabase
      .from("user_routes")
      .select("id, slug, title, description, cover_image_url, creator_type, stop_count, like_count, bookmark_count, ranking_score, is_featured, start_label, tags")
      .eq("city_slug", citySlug)
      .eq("visibility", "public")
      .order("ranking_score", { ascending: false })
      .limit(24),
    supabase
      .from("creator_profiles")
      .select("id, username, display_name, avatar_url, creator_type, route_count, is_verified")
      .eq("home_city_slug", citySlug)
      .order("route_count", { ascending: false })
      .limit(6),
    supabase
      .from("cities")
      .select("editorial_cover_url, editorial_cover_alt, editorial_cover_credit, editorial_cover_source")
      .eq("slug", citySlug)
      .maybeSingle(),
    supabase
      .from("planner_events")
      .select("*", { count: "exact", head: true })
      .eq("city_slug", citySlug)
      .eq("status", "scheduled")
      // Die Spalte heißt start_at, nicht starts_at. Mit dem falschen Namen
      // antwortete PostgREST mit 42703, `count` war null und das `?? 0` unten
      // machte daraus eine glaubwürdige Null — auf allen 552 Stadtseiten,
      // obwohl knapp 9.500 künftige Events in der Datenbank stehen.
      .gte("start_at", now.toISOString())
      .lte("start_at", in30Days.toISOString()),
  ]);

  // Ein Abfragefehler darf nicht länger als "keine Events" durchgehen.
  if (eventCountResult.error) {
    console.error(
      `[explore/${citySlug}] Event-Zählung fehlgeschlagen:`,
      eventCountResult.error.message
    );
  }

  return {
    routes: (routesResult.data ?? []) as RouteRow[],
    creators: (creatorsResult.data ?? []) as CreatorRow[],
    cityCover: (cityCoverResult.data ?? null) as CityCover | null,
    upcomingEventCount: eventCountResult.count ?? 0,
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function CityExplorePage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;
  const cityConfig = CITY_MAP.get(city);
  if (!cityConfig) notFound();

  const data = await fetchCityData(city);
  const routes = data?.routes ?? [];
  const creators = data?.creators ?? [];
  const cityCover = data?.cityCover ?? null;
  const upcomingEvents = data?.upcomingEventCount ?? 0;

  const featuredRoutes = routes.filter((r) => r.is_featured);
  const allRoutes = featuredRoutes.length >= 6 ? routes : routes;
  const coverRoute = allRoutes.find((r) => r.cover_image_url) ?? null;

  // Anlass-Landing-Pages, die es fuer diese Stadt tatsaechlich gibt. Ohne
  // Verlinkung von hier blieben sie verwaist und wuerden schlecht gecrawlt.
  const occasionPages = CITY_OCCASIONS.filter((occasion) =>
    routes.some((route) => route.slug && routeMatchesOccasion(route.tags, occasion))
  );

  // Editorial-Cover hat Vorrang. Fallback: erstes Route-Cover, dann Gradient.
  const heroImage = cityCover?.editorial_cover_url ?? coverRoute?.cover_image_url ?? null;
  const heroAlt = cityCover?.editorial_cover_alt ?? cityConfig.label;
  const heroCredit = cityCover?.editorial_cover_credit ?? null;
  const heroCreditHref = cityCover?.editorial_cover_source ?? null;
  const isEditorialCover = Boolean(cityCover?.editorial_cover_url);

  return (
    <main className="pd24-page-standard space-y-6 pb-20 pt-6">

      {/* Die Liste zeichnet genau die Routen aus, die unten auch sichtbar
          stehen — strukturierte Daten duerfen nie ueber den Seiteninhalt
          hinausgehen. */}
      <JsonLd
        data={[
          routeListJsonLd({
            name: `Tagesrouten in ${cityConfig.label}`,
            pagePath: `/explore/${city}`,
            routes: allRoutes,
          }),
          breadcrumbJsonLd([
            { name: "Start", path: "/" },
            { name: "Entdecken", path: "/explore" },
            { name: cityConfig.label, path: `/explore/${city}` },
          ]),
        ]}
      />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href="/explore" className="hover:text-[var(--text-strong)]">Entdecken</Link>
        <span>/</span>
        <span className="text-[var(--text-strong)]">{cityConfig.label}</span>
      </div>

      {/* Hero */}
      <section className="overflow-hidden rounded-[var(--radius-hero)] border border-[var(--line-subtle)] shadow-[var(--shadow-large)]">
        <div className="relative">
          {heroImage ? (
            <div className="relative h-56 w-full sm:h-80">
              <Image
                src={heroImage}
                alt={heroAlt}
                fill
                unoptimized={!isSafeHost(heroImage)}
                className="object-cover"
                priority
                sizes="(max-width: 1024px) 100vw, 1200px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent" />
              {isEditorialCover ? (
                <span className="absolute right-4 top-4 rounded-full border border-white/22 bg-black/32 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/86 backdrop-blur">
                  Editorial
                </span>
              ) : null}
              {heroCredit ? (
                <span className="absolute bottom-2 right-3 text-[9px] text-white/60">
                  Foto:{" "}
                  {heroCreditHref ? (
                    <a
                      href={heroCreditHref}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="underline decoration-white/30 underline-offset-2 hover:text-white/80"
                    >
                      {heroCredit}
                    </a>
                  ) : (
                    heroCredit
                  )}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="h-40 bg-[linear-gradient(135deg,var(--bg-canvas-warm),#eef4f7)] sm:h-52" />
          )}

          <div className={`${heroImage ? "absolute bottom-0 left-0 right-0 p-6 text-white" : "bg-[var(--bg-surface)] p-6"}`}>
            <div className="pd24-kicker-warm" style={heroImage ? { color: "rgba(255,249,241,0.7)" } : {}}>
              Entdecken
            </div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
              {cityConfig.label}
            </h1>
            <div className={`mt-3 flex flex-wrap gap-2 text-sm ${heroImage ? "text-white/80" : "text-[var(--text-muted)]"}`}>
              <span>{routes.length} Routen</span>
              {creators.length > 0 && <><span>·</span><span>{creators.length} Creator</span></>}
              {featuredRoutes.length > 0 && <><span>·</span><span>{featuredRoutes.length} Featured</span></>}
              {upcomingEvents > 0 && (
                <>
                  <span>·</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    heroImage
                      ? "bg-white/20 text-white backdrop-blur"
                      : "bg-[rgba(196,137,79,0.14)] text-[var(--brand-warm-ink)]"
                  }`}>
                    <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${heroImage ? "bg-white/90" : "bg-[var(--brand-warm)]"}`} />
                    {upcomingEvents} Events · 30 Tage
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--line-subtle)] bg-[var(--bg-surface)] px-6 py-4">
          <Link
            href={`/planner?citySlug=${city}`}
            className="pd24-btn pd24-btn-sm pd24-btn-primary"
          >
            Tag in {cityConfig.label} planen
          </Link>
          <Link
            href={`/explore?citySlug=${city}`}
            className="pd24-btn pd24-btn-sm pd24-btn-secondary"
          >
            Alle Filter anzeigen
          </Link>
        </div>
      </section>

      {/* Anlass-Seiten: eigene, vollstaendig ausformulierte Seiten je Anlass —
          nicht zu verwechseln mit den Filter-Chips darunter, die nur die
          Explore-Liste vorfiltern. */}
      {occasionPages.length > 0 ? (
        <section className="rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">
            Fertige Pläne für {cityConfig.label}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Jeder Anlass mit komplettem Ablauf — Stopp für Stopp, in der richtigen Reihenfolge.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {occasionPages.map((occasion) => (
              <Link
                key={occasion.slug}
                href={`/explore/${city}/${occasion.slug}`}
                className="rounded-full border border-[var(--line-subtle)] bg-white px-3.5 py-2 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)]"
              >
                {occasion.label} in {cityConfig.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Occasion chips */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(OCCASION_LABELS).map(([slug, { emoji, label }]) => (
          <Link
            key={slug}
            href={`/explore?citySlug=${city}&occasion=${slug}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-subtle)] bg-white px-3.5 py-2 text-sm text-[var(--text-muted)] transition hover:border-[var(--text-strong)] hover:text-[var(--text-strong)]"
          >
            <span>{emoji}</span>
            <span>{label}</span>
          </Link>
        ))}
      </div>

      {/* Routes grid */}
      {routes.length > 0 ? (
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold text-[var(--text-strong)]">Routen in {cityConfig.label}</h2>
            <span className="text-sm text-[var(--text-muted)]">{routes.length} gesamt</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allRoutes.slice(0, 12).map((route) => (
              <Link
                key={route.id}
                href={`/routes/${route.slug ?? route.id}`}
                className="group block overflow-hidden rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-large)]"
              >
                <div className="relative aspect-[3/2] w-full overflow-hidden bg-[var(--bg-panel)]">
                  {route.cover_image_url ? (
                    <Image
                      src={route.cover_image_url}
                      alt={route.title ?? "Route"}
                      fill
                      unoptimized={!isSafeHost(route.cover_image_url)}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-end bg-[linear-gradient(135deg,#edf2f6_0%,#dbe7ef_48%,#eef3f7_100%)] p-4">
                      <span className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                        Route entdecken
                      </span>
                    </div>
                  )}
                  {route.is_featured && (
                    <div className="absolute left-3 top-3">
                      <span className="rounded-full border border-white/30 bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-strong)] backdrop-blur">
                        Featured
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
                      {creatorTypeLabel(route.creator_type)}
                    </span>
                    {route.start_label && (
                      <span className="truncate text-xs text-[var(--text-soft)]">{route.start_label}</span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold leading-snug text-[var(--text-strong)] group-hover:opacity-80">
                    {route.title ?? "Unbenannte Route"}
                  </h3>
                  {route.description && (
                    <p className="line-clamp-2 text-sm text-[var(--text-muted)]">{route.description}</p>
                  )}
                  <div className="flex items-center justify-between border-t border-[var(--line-subtle)] pt-2.5 text-xs text-[var(--text-soft)]">
                    <div className="flex gap-3">
                      {route.stop_count != null && <span>{route.stop_count} Stops</span>}
                      {route.like_count != null && route.like_count > 0 && <span>{route.like_count} Likes</span>}
                    </div>
                    <span className="font-medium text-[var(--text-strong)]">Ansehen →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {routes.length > 12 && (
            <div className="mt-6 text-center">
              <Link
                href={`/explore?citySlug=${city}`}
                className="pd24-btn pd24-btn-sm pd24-btn-secondary"
              >
                Alle {routes.length} Routen anzeigen
              </Link>
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-[var(--radius-shell)] border border-dashed border-[var(--line-subtle)] bg-[var(--bg-surface)] p-10 text-center">
          <div className="text-lg font-semibold text-[var(--text-strong)]">Noch keine Routen in {cityConfig.label}</div>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Sei der Erste und erstelle eine Route für diese Stadt.</p>
          <Link
            href={`/planner?citySlug=${city}`}
            className="mt-5 pd24-btn pd24-btn-sm pd24-btn-primary"
          >
            Tag planen
          </Link>
        </section>
      )}

      {/* Creators */}
      {creators.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl font-semibold text-[var(--text-strong)]">Creator in {cityConfig.label}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {creators.map((creator) => (
              <Link
                key={creator.id}
                href={`/creator/${creator.username}`}
                className="flex items-center gap-4 rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4 transition hover:bg-[var(--bg-panel)] hover:shadow-[var(--shadow-soft)]"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[var(--bg-panel)]">
                  {creator.avatar_url ? (
                    <Image
                      src={creator.avatar_url}
                      alt={creator.display_name}
                      fill
                      unoptimized={!isSafeHost(creator.avatar_url)}
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-[var(--text-muted)]">
                      {creator.display_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-semibold text-[var(--text-strong)]">{creator.display_name}</span>
                    {creator.is_verified && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-sky-500">
                        <path fillRule="evenodd" d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {creatorTypeLabel(creator.creator_type)} · {creator.route_count ?? 0} Routen
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="rounded-[var(--radius-hero)] bg-[var(--text-strong)] px-6 py-10 text-white shadow-[var(--shadow-large)] sm:px-8">
        <div className="pd24-kicker-warm" style={{ color: "rgba(255,249,241,0.6)" }}>Deinen perfekten Tag planen</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Was machst du heute in {cityConfig.label}?
        </h2>
        <p className="mt-3 text-base leading-7 text-white/70">
          Unser KI-Planner baut dir einen kompletten Tagesplan — abgestimmt auf deine Gruppe, Vorlieben und Stimmung.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/planner?citySlug=${city}`}
            className="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[var(--text-strong)] transition hover:bg-[var(--bg-canvas-warm)]"
          >
            Jetzt planen
          </Link>
          <Link
            href="/explore"
            className="inline-flex items-center rounded-full border border-white/20 bg-white/8 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/15"
          >
            Alle Städte entdecken
          </Link>
        </div>
      </section>
    </main>
  );
}
