"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import InternalMonetizationSlot from "@/components/monetization/InternalMonetizationSlot";
import MonetizationDebugPanel from "@/components/monetization/MonetizationDebugPanel";
import { inferPublicRouteBadges } from "@/lib/routes/public-route-badges";
import {
  buildCityLookupMap,
  formatCityWithCountry,
  type CityLookupRow,
} from "@/lib/routes/public-location-label";
import {
  compareVariantOrder,
  matchesVariantFilter,
  routeVariantRoleLabel,
  type VariantFilter,
  type VariantSort,
} from "@/lib/routes/variant-family";
import {
  buildInterestReasonBadges,
  explainInterestMatch,
  normalizeStringList,
  scoreRouteAgainstInterests,
} from "@/lib/routes/recommendation-reasons";
import { shouldShowInternalMonetization } from "@/lib/monetization/debug";
import { renderableImageUrl } from "@/lib/renderable-image-url";
import ImageAttribution from "@/components/ImageAttribution";

type RouteVisibility = "private" | "unlisted" | "public";
type CreatorType = "user" | "creator" | "influencer" | "brand" | "editorial";

type UserRouteRow = {
  id: string;
  user_id: string;
  creator_profile_id: string | null;
  city_slug: string | null;
  title: string | null;
  slug: string | null;
  description: string | null;
  cover_image_url: string | null;
  start_label: string | null;
  start_type: string | null;
  visibility: RouteVisibility;
  creator_type: CreatorType;
  is_featured: boolean;
  avg_rating: number | null;
  rating_count: number | null;
  bookmark_count: number | null;
  like_count: number | null;
  stop_count: number | null;
  required_stop_count: number | null;
  photo_count: number | null;
  view_count: number | null;
  quality_score: number | null;
  trending_score: number | null;
  ranking_score: number | null;
  start_lat?: number | null;
  start_lng?: number | null;
  tags?: unknown;
  meta?: unknown;
  created_at: string;
  updated_at: string;
};

type CreatorProfileRow = {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  home_city_slug: string | null;
  creator_type: CreatorType;
  is_verified: boolean;
  is_featured: boolean;
  route_count: number | null;
  follower_count: number | null;
  following_count: number | null;
  total_likes_received: number | null;
  total_bookmarks_received: number | null;
  created_at: string;
  updated_at: string;
};

type CreatorRankingRow = {
  creator_profile_id: string;
  final_score: number | null;
};

type CityRow = CityLookupRow & {
  population: number | null;
};

type ProfileRow = {
  user_id: string;
  interests: unknown;
};

type SuggestedRoute = {
  route: UserRouteRow;
  reason?: string | null;
  reasonBadges?: string[];
};

type OccasionFilter = "all" | "date" | "friends" | "family" | "tourism" | "party";

const OCCASION_PILLS: { key: OccasionFilter; emoji: string; label: string }[] = [
  { key: "all", emoji: "", label: "Alle" },
  { key: "date", emoji: "🥂", label: "Date Night" },
  { key: "friends", emoji: "👫", label: "Mit Freunden" },
  { key: "family", emoji: "👨‍👩‍👧", label: "Familie" },
  { key: "tourism", emoji: "🗺️", label: "Als Tourist" },
  { key: "party", emoji: "🎉", label: "Feiern" },
];

function matchesOccasionFilter(route: UserRouteRow, occasion: OccasionFilter): boolean {
  if (occasion === "all") return true;
  const text = [route.title ?? "", route.description ?? "", route.start_label ?? ""]
    .join(" ")
    .toLowerCase();
  switch (occasion) {
    case "date":
      return /date|romantik|romantic|wine|wein|zu zweit|p[aä]rchen|candlelight/i.test(text);
    case "friends":
      return /freund|friend|gruppe|kollegen|team|gemeinsam|jungs|girls/i.test(text);
    case "family":
      return /famili|kinder|kind|zoo|spielplatz|kindgerecht|family/i.test(text);
    case "tourism":
      return /museum|altstadt|landmark|sightseeing|tour|historisch|denkmal|tourist/i.test(text);
    case "party":
      return /party|club|bar|nacht|nightlife|feiern|ausgehen/i.test(text);
    default:
      return true;
  }
}

const RouteMiniMapClient = dynamic(() => import("@/components/RouteMiniMapClient"), {
  ssr: false,
});

function safeSlugFromTitle(title: string | null | undefined) {
  if (!title) return null;
  const s = title
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || null;
}

function routeHref(route: Partial<UserRouteRow> | null | undefined) {
  if (!route) return null;
  const slug = route.slug ?? safeSlugFromTitle(route.title);
  return slug ? `/routes/${slug}` : null;
}

function creatorHref(creator: Partial<CreatorProfileRow> | null | undefined) {
  if (!creator?.username) return null;
  return `/creator/${creator.username}`;
}

function countryLabel(code: string | null | undefined) {
  if (!code) return "Unbekannt";
  const upper = code.toUpperCase();
  if (upper === "DE") return "Deutschland";
  if (upper === "AT") return "Österreich";
  if (upper === "CH") return "Schweiz";
  if (upper === "FR") return "Frankreich";
  if (upper === "IT") return "Italien";
  if (upper === "ES") return "Spanien";
  if (upper === "NL") return "Niederlande";
  if (upper === "BE") return "Belgien";
  if (upper === "GB" || upper === "UK") return "Vereinigtes Königreich";
  if (upper === "US") return "USA";
  return upper;
}

function niceCreatorType(v: CreatorType | null | undefined) {
  if (v === "influencer") return "Influencer";
  if (v === "creator") return "Creator";
  if (v === "brand") return "Brand";
  if (v === "editorial") return "Editorial";
  return "User";
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("de-DE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function compactNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("de-DE", { notation: "compact" }).format(value ?? 0);
}

function estimateDurationLabel(route: UserRouteRow | null | undefined) {
  const stops = route?.stop_count ?? 0;
  if (stops <= 2) return "ca. 2 Std.";
  if (stops <= 4) return "ca. 3-4 Std.";
  if (stops <= 6) return "ca. 5-6 Std.";
  return "Ganztägig";
}

function idealForLabel(route: UserRouteRow | null | undefined) {
  const text = `${route?.title ?? ""} ${route?.description ?? ""} ${route?.start_type ?? ""}`.toLowerCase();
  if (text.includes("date") || text.includes("romantik") || text.includes("wine")) return "Dates";
  if (text.includes("family") || text.includes("kinder") || text.includes("zoo")) return "Familien";
  if (text.includes("party") || text.includes("club") || text.includes("bar")) return "Abende mit Freunden";
  if (text.includes("museum") || text.includes("altstadt") || text.includes("landmark")) return "Sightseeing";
  if (text.includes("park") || text.includes("walk") || text.includes("outdoor")) return "entspannte Spaziergänge";
  return "einen starken Perfect Day";
}



function SectionHeader({
  title,
  subtitle,
  actionHref,
  actionLabel,
}: {
  title: string;
  subtitle?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <div className="pd24-kicker mb-2">Entdecken</div>
        <h2 className="text-2xl font-semibold text-[var(--text-strong)]">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p> : null}
      </div>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="text-sm font-medium text-[var(--text-strong)] underline underline-offset-4">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function RouteCard({
  route,
  creator,
  cityMap,
  reason,
  reasonBadges,
}: {
  route: UserRouteRow | null | undefined;
  creator?: CreatorProfileRow | null;
  cityMap: Map<string, CityLookupRow>;
  reason?: string | null;
  reasonBadges?: string[];
}) {
  const badges = useMemo(() => {
    if (!route) return [];
    const seen = new Set<string>();
    return inferPublicRouteBadges(route).filter((badge) => {
      const key = `${badge.label}::${badge.tone}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [route]);
  const [miniStops, setMiniStops] = useState<Array<{ label: string; name: string; lat: number; lng: number }>>([]);

  useEffect(() => {
    if (!route) {
      return;
    }

    let active = true;

    (async () => {
      const points: Array<{ label: string; name: string; lat: number; lng: number }> = [];

      if (route.start_lat != null && route.start_lng != null) {
        points.push({
          label: "Start",
          name: route.start_label || "Startpunkt",
          lat: route.start_lat,
          lng: route.start_lng,
        });
      }

      const { data, error } = await supabase
        .from("user_route_stops")
        .select("stop_order,title,lat,lng")
        .eq("route_id", route.id)
        .order("stop_order", { ascending: true })
        .limit(12);

      if (!active) return;

      if (error) {
        console.error("Explore mini map stops load error:", error);
        setMiniStops(points);
        return;
      }

      for (const stop of (data ?? []) as Array<{ stop_order: number | null; title: string | null; lat: number | null; lng: number | null }>) {
        if (stop.lat != null && stop.lng != null) {
          points.push({
            label: `Stop ${stop.stop_order ?? points.length}`,
            name: stop.title || `Stop ${stop.stop_order ?? points.length}`,
            lat: stop.lat,
            lng: stop.lng,
          });
        }
      }

      setMiniStops(points);
    })();

    return () => {
      active = false;
    };
  }, [route]);

  if (!route) return null;

  const href = routeHref(route);
  const title = route.title?.trim() || "Unbenannte Route";
  const desc = route.description?.trim() || "Noch keine Beschreibung vorhanden.";
  const city = formatCityWithCountry(route.city_slug, cityMap);
  const creatorLabel = creator?.display_name || niceCreatorType(route.creator_type);
  const creatorLink = creatorHref(creator);
  const cover = renderableImageUrl(route.cover_image_url);
  const shortDesc = desc.length > 120 ? `${desc.slice(0, 117).trim()}...` : desc;
  const durationLabel = estimateDurationLabel(route);
  const idealFor = idealForLabel(route);
  const variantRole = routeVariantRoleLabel(route);

  const content = (
    <>
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-neutral-100 via-white to-neutral-200">
        {cover ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt={title}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
            <ImageAttribution
              meta={route.meta}
              compact
              tone="dark"
              className="absolute inset-x-3 bottom-3 truncate rounded-full bg-black/55 px-3 py-1 backdrop-blur"
            />
          </>
        ) : (
          <div className="flex h-full w-full items-end p-4">
            <div className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs text-gray-600 backdrop-blur">
              Kein Coverbild
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4">
          <div className="flex flex-wrap gap-2">
            {route.is_featured ? (
              <span className="rounded-full bg-black px-2.5 py-1 text-[10.5px] font-medium text-white">
                Featured
              </span>
            ) : null}

            <span className="rounded-full border border-white/60 bg-white/85 px-2.5 py-1 text-[10.5px] text-gray-700 backdrop-blur">
              {city}
            </span>

            <span className="rounded-full border border-white/60 bg-white/85 px-2.5 py-1 text-[10.5px] text-gray-700 backdrop-blur">
              {niceCreatorType(route.creator_type)}
            </span>
            {variantRole ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10.5px] text-emerald-800">
                {variantRole}
              </span>
            ) : null}
          </div>

          <div className="rounded-full border border-white/60 bg-white/88 px-3 py-1.5 text-[10.5px] font-medium text-gray-700 backdrop-blur">
            {route.stop_count ?? 0} Stops / {durationLabel}
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="space-y-1.5">
          <h3 className="text-[1.06rem] font-semibold leading-snug text-gray-950 line-clamp-2 sm:text-[1.12rem]">
            {title}
          </h3>
          <p className="line-clamp-2 text-[13px] leading-5 text-gray-600 sm:text-sm">{shortDesc}</p>
        </div>

        {reason || reasonBadges?.length ? (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {reason ? (
              <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-gray-600">
                {reason}
              </span>
            ) : null}
            {reasonBadges?.slice(0, 2).map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-900"
              >
                {badge}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5 text-[11px] text-gray-700">
          <span className="rounded-full border border-black/10 bg-gray-50 px-2.5 py-1">
            {durationLabel}
          </span>
          <span className="rounded-full border border-black/10 bg-gray-50 px-2.5 py-1">
            {route.stop_count ?? 0} Stopps
          </span>
          <span className="rounded-full border border-black/10 bg-gray-50 px-2.5 py-1">
            {route.photo_count ?? 0} Fotos
          </span>
          <span className="rounded-full border border-black/10 bg-gray-50 px-2.5 py-1">
            {idealFor}
          </span>
          {badges.slice(0, 2).map((badge, index) => (
            <span
              key={`${badge.label}-${badge.tone}-${index}`}
              className={`rounded-full px-2.5 py-1 font-medium ${
                badge.tone === "dark"
                  ? "bg-black text-white"
                  : badge.tone === "soft"
                    ? "border border-black/10 bg-stone-100 text-gray-700"
                    : "border border-black/10 bg-white text-gray-700"
              }`}
            >
              {badge.label}
            </span>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white">
          <div className="flex items-center justify-between gap-3 px-3 pt-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Route</div>
              <div className="mt-0.5 line-clamp-1 text-sm font-medium text-gray-900">
                {route.start_label ? `Start bei ${route.start_label}` : `Route in ${city}`}
              </div>
            </div>
          </div>
          <div className="mt-2 border-t border-black/5 p-2.5">
            <RouteMiniMapClient stops={miniStops} height={82} />
          </div>
        </div>

        <details className="rounded-[20px] border border-black/5 bg-gray-50 px-4 py-3 text-[13px] text-gray-600">
          <summary className="cursor-pointer list-none text-sm font-medium text-gray-900">
            Mehr zur Route
          </summary>
          <div className="mt-3 space-y-2 leading-6">
            <p>{desc}</p>
            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
              <span>{route.required_stop_count ?? 0} Pflicht-Stopps</span>
              <span>{route.avg_rating?.toFixed(1) ?? "0.0"} Bewertung</span>
              <span>{route.like_count ?? 0} Likes</span>
              <span>Aktualisiert {formatDate(route.updated_at)}</span>
            </div>
          </div>
        </details>

        <div className="flex items-center justify-between gap-3 border-t border-black/5 pt-2">
          <div className="min-w-0 space-y-1">
            <div className="truncate text-xs text-gray-500">{creatorLabel}</div>
            {creatorLink ? (
              <Link href={creatorLink} className="text-xs text-gray-700 underline underline-offset-4">
                Profil öffnen
              </Link>
            ) : null}
          </div>

          {href ? (
            <Link
              href={href}
              className="shrink-0 rounded-full border border-black bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-900"
            >
              Route öffnen
            </Link>
          ) : (
            <div className="text-xs text-red-600">Route aktuell nicht aufrufbar.</div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="group overflow-hidden rounded-[28px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-large)]">
      {content}
    </div>
  );
}

function CreatorCard({
  creator,
  cityMap,
  rankingScore,
}: {
  creator: CreatorProfileRow | null | undefined;
  cityMap: Map<string, CityLookupRow>;
  rankingScore?: number | null;
}) {
  if (!creator) return null;

  const href = creatorHref(creator);
  const displayName = creator.display_name || creator.username;
  const bio = creator.bio?.trim() || "Noch keine Bio vorhanden.";
  const homeCityLabel = formatCityWithCountry(creator.home_city_slug, cityMap);

  const content = (
    <div className="p-5">
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-gray-100">
          {creator.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={creator.avatar_url}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="truncate font-semibold">{displayName}</h3>
            {creator.is_verified ? (
              <span className="rounded-full bg-black px-2 py-1 text-[11px] text-white">Verified</span>
            ) : null}
            {creator.is_featured ? (
              <span className="rounded-full border px-2 py-1 text-[11px]">Featured</span>
            ) : null}
          </div>

          <div className="mt-1 text-xs text-gray-500">
            @{creator.username} • {niceCreatorType(creator.creator_type)}
          </div>

          <p className="mt-2 line-clamp-3 text-sm text-gray-600">{bio}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-500">
        <div className="rounded-2xl border border-black/5 bg-gray-50 px-3 py-2">
          <div className="font-medium text-gray-900">{compactNumber(creator.route_count)}</div>
          <div>Routen</div>
        </div>
        <div className="rounded-2xl border border-black/5 bg-gray-50 px-3 py-2">
          <div className="font-medium text-gray-900">{compactNumber(creator.follower_count)}</div>
          <div>Follower</div>
        </div>
        <div className="rounded-2xl border border-black/5 bg-gray-50 px-3 py-2">
          <div className="font-medium text-gray-900">{compactNumber(creator.total_likes_received)}</div>
          <div>Likes</div>
        </div>
        <div className="rounded-2xl border border-black/5 bg-gray-50 px-3 py-2">
          <div className="font-medium text-gray-900">{compactNumber(creator.total_bookmarks_received)}</div>
          <div>Bookmarks</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
        <span>{homeCityLabel}</span>
        <span>Score: {rankingScore ?? 0}</span>
      </div>
    </div>
  );

  if (!href) {
    return <div className="rounded-[28px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] opacity-70 shadow-[var(--shadow-soft)]">{content}</div>;
  }

  return (
    <Link href={href} className="block rounded-[28px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-large)]">
      {content}
    </Link>
  );
}

function ExplorePageContent() {
  const searchParams = useSearchParams();
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [routes, setRoutes] = useState<UserRouteRow[]>([]);
  const [creators, setCreators] = useState<CreatorProfileRow[]>([]);
  const [creatorRankingMap, setCreatorRankingMap] = useState<Record<string, number>>({});
  const [cities, setCities] = useState<CityRow[]>([]);
  const [myInterests, setMyInterests] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [selectedCitySlug, setSelectedCitySlug] = useState<string>(
    searchParams.get("citySlug") ?? "all"
  );
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>("all");
  const [creatorFilter, setCreatorFilter] = useState<CreatorType | "all">("all");
  const [occasionFilter, setOccasionFilter] = useState<OccasionFilter>(
    (searchParams.get("occasion") as OccasionFilter | null) ?? "all"
  );
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState<"trending" | "top" | "new" | "featured">("trending");
  const [personalizedSort, setPersonalizedSort] = useState(true);
  const [variantFilter, setVariantFilter] = useState<VariantFilter>("all");
  const [variantSort, setVariantSort] = useState<VariantSort>("default");

  useEffect(() => {
    let active = true;

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) console.error("Explore auth session error:", error);
      if (!active) return;
      setUserId(data.session?.user?.id ?? null);
      setAuthReady(true);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setAuthReady(true);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady || !userId) {
      setMyInterests([]);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id,interests")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Explore profile interests load error:", error);
        setMyInterests([]);
        return;
      }

      setMyInterests(normalizeStringList((data as ProfileRow | null)?.interests));
    })();
  }, [authReady, userId]);

  useEffect(() => {
    (async () => {
      setCitiesLoading(true);
      try {
        const { data, error } = await supabase
          .from("cities")
          .select("slug,name,country_code,population")
          .eq("is_active", true)
          .order("population", { ascending: false });

        if (error) {
          console.error("Cities load error:", error);
          setCities([]);
          return;
        }

        setCities((data as CityRow[]) ?? []);
      } finally {
        setCitiesLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrorText(null);

      try {
        const [routesRes, creatorsRes, creatorRankingsRes] = await Promise.all([
          supabase.from("user_routes").select("*").eq("visibility", "public").limit(300),
          supabase.from("creator_profiles").select("*").order("follower_count", { ascending: false }).limit(100),
          supabase.from("creator_rankings").select("creator_profile_id,final_score").limit(200),
        ]);

        if (routesRes.error) {
          console.error("Explore routes load error:", routesRes.error);
          setErrorText("Öffentliche Routen konnten nicht geladen werden.");
          setRoutes([]);
        } else {
          const rows = ((routesRes.data ?? []) as UserRouteRow[]).filter((r) => !!r && !!r.title);
          setRoutes(rows);
        }

        if (creatorsRes.error) {
          console.error("Creators load error:", creatorsRes.error);
          setCreators([]);
        } else {
          setCreators((creatorsRes.data ?? []) as CreatorProfileRow[]);
        }

        if (creatorRankingsRes.error) {
          console.error("Creator rankings load error:", creatorRankingsRes.error);
          setCreatorRankingMap({});
        } else {
          const map: Record<string, number> = {};
          ((creatorRankingsRes.data ?? []) as CreatorRankingRow[]).forEach((r) => {
            map[r.creator_profile_id] = r.final_score ?? 0;
          });
          setCreatorRankingMap(map);
        }
      } catch (e) {
        console.error("Explore page fatal load error:", e);
        setRoutes([]);
        setCreators([]);
        setCreatorRankingMap({});
        setErrorText("Beim Laden ist ein unerwarteter Fehler aufgetreten.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const creatorById = useMemo(() => {
    const map = new Map<string, CreatorProfileRow>();
    creators.forEach((c) => map.set(c.id, c));
    return map;
  }, [creators]);

  const cityMap = useMemo(() => buildCityLookupMap(cities), [cities]);

  const availableCountryCodes = useMemo(
    () =>
      Array.from(
        new Set(
          cities
            .map((city) => city.country_code?.toUpperCase() ?? null)
            .filter((code): code is string => Boolean(code))
        )
      ).sort((a, b) => countryLabel(a).localeCompare(countryLabel(b), "de-DE")),
    [cities]
  );

  // Build city dropdown options directly from route city_slugs so that
  // the option values always match route.city_slug exactly.  The cities
  // table contains duplicate entries for many cities (e.g. "bonn" AND
  // "bonn-nordrhein-westfalen" with the same population), and the old
  // dedupeCityOptions logic would arbitrarily pick whichever duplicate
  // came first — often the compound slug — causing the filter to return
  // 0 results even when routes exist.
  const cityDropdownOptions = useMemo(() => {
    const slugs = Array.from(
      new Set(routes.map((r) => r.city_slug).filter((s): s is string => Boolean(s)))
    );
    const options = slugs.map((slug) => {
      const cityEntry = cityMap.get(slug);
      return {
        slug,
        name: cityEntry?.name ?? slug,
        country_code: cityEntry?.country_code ?? null,
      };
    });
    const filtered =
      selectedCountryCode === "all"
        ? options
        : options.filter((o) => (o.country_code?.toUpperCase() ?? "") === selectedCountryCode);
    return filtered.sort((a, b) => a.name.localeCompare(b.name, "de-DE"));
  }, [routes, cityMap, selectedCountryCode]);

  useEffect(() => {
    // Don't reset while routes are still loading — cityDropdownOptions would be
    // empty and would clear a valid city slug that arrived from the URL.
    if (loading) return;
    if (selectedCitySlug === "all") return;
    if (!cityDropdownOptions.some((city) => city.slug === selectedCitySlug)) {
      setSelectedCitySlug("all");
    }
  }, [loading, selectedCitySlug, cityDropdownOptions]);

  const filteredRoutes = useMemo(() => {
    let out = [...routes];

    if (selectedCountryCode !== "all") {
      const countryCities = new Set(
        cities
          .filter((city) => (city.country_code?.toUpperCase() ?? "") === selectedCountryCode)
          .map((city) => city.slug)
      );
      out = out.filter((r) => r.city_slug != null && countryCities.has(r.city_slug));
    }

    if (selectedCitySlug !== "all") {
      out = out.filter((r) => r.city_slug === selectedCitySlug);
    }

    if (creatorFilter !== "all") {
      out = out.filter((r) => r.creator_type === creatorFilter);
    }

    if (occasionFilter !== "all") {
      out = out.filter((r) => matchesOccasionFilter(r, occasionFilter));
    }

    out = out.filter((r) => matchesVariantFilter(r, variantFilter));

    const q = searchText.trim().toLowerCase();
    if (q) {
      out = out.filter((r) => {
        const creator = r.creator_profile_id ? creatorById.get(r.creator_profile_id) : null;
        const hay = [
          r.title ?? "",
          r.description ?? "",
          r.city_slug ?? "",
          r.start_label ?? "",
          r.creator_type ?? "",
          creator?.username ?? "",
          creator?.display_name ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return hay.includes(q);
      });
    }

    out.sort((a, b) => {
      const variantDiff = compareVariantOrder(a, b, variantSort);
      if (variantDiff !== 0) return variantDiff;

      if (personalizedSort) {
        const personalDiff = scoreRouteAgainstInterests(b, myInterests) - scoreRouteAgainstInterests(a, myInterests);
        if (personalDiff !== 0) return personalDiff;
      }

      if (sortBy === "featured") {
        if ((b.is_featured ? 1 : 0) !== (a.is_featured ? 1 : 0)) {
          return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
        }
        return (b.ranking_score ?? 0) - (a.ranking_score ?? 0);
      }

      if (sortBy === "top") return (b.ranking_score ?? 0) - (a.ranking_score ?? 0);

      if (sortBy === "new") {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }

      return (b.trending_score ?? 0) - (a.trending_score ?? 0);
    });

    return out;
  }, [
    routes,
    selectedCountryCode,
    cities,
    selectedCitySlug,
    creatorFilter,
    occasionFilter,
    variantFilter,
    variantSort,
    searchText,
    sortBy,
    creatorById,
    myInterests,
    personalizedSort,
  ]);

  const editorialRoutes = useMemo(
    () =>
      filteredRoutes
        .filter((r) => r.creator_type === "editorial")
        .sort((a, b) => (b.ranking_score ?? 0) - (a.ranking_score ?? 0))
        .slice(0, 12),
    [filteredRoutes]
  );

  const trendingRoutes = useMemo(
    () => [...filteredRoutes].sort((a, b) => (b.trending_score ?? 0) - (a.trending_score ?? 0)).slice(0, 6),
    [filteredRoutes]
  );

  const topRatedRoutes = useMemo(
    () =>
      [...filteredRoutes]
        .sort((a, b) => {
          if ((b.avg_rating ?? 0) !== (a.avg_rating ?? 0)) return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
          return (b.rating_count ?? 0) - (a.rating_count ?? 0);
        })
        .slice(0, 6),
    [filteredRoutes]
  );

  const featuredRoutes = useMemo(() => filteredRoutes.filter((r) => r.is_featured).slice(0, 6), [filteredRoutes]);

  const newestRoutes = useMemo(
    () => [...filteredRoutes].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 6),
    [filteredRoutes]
  );

  const topCreators = useMemo(() => {
    const out = [...creators];
    out.sort((a, b) => (creatorRankingMap[b.id] ?? 0) - (creatorRankingMap[a.id] ?? 0));
    return out.slice(0, 6);
  }, [creators, creatorRankingMap]);

  const totalPublic = routes.length;
  const personalizedRoutes = useMemo(() => {
    if (myInterests.length === 0) return [] as SuggestedRoute[];

    return [...filteredRoutes]
      .map((route) => ({
        route,
        score: scoreRouteAgainstInterests(route, myInterests),
      }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((row) => ({
        route: row.route,
        reason: explainInterestMatch(row.route, myInterests),
        reasonBadges: buildInterestReasonBadges(row.route, myInterests),
      }));
  }, [filteredRoutes, myInterests]);
  const monetizationDebug = useMemo(
    () => shouldShowInternalMonetization(searchParams.get("monetization")),
    [searchParams]
  );
  const filterControlClass =
    "h-10 w-full min-w-0 rounded-xl border border-black/10 bg-white px-3 text-xs text-[var(--text-strong)] shadow-sm outline-none transition focus:border-[var(--text-strong)] sm:text-sm";

  return (
    <main className="pd24-page-wide px-1 py-4 sm:px-2 lg:px-4">
      <div className="mb-5 overflow-hidden rounded-3xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft)]">
        <div className="bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(229,234,238,0.92))] p-4 sm:p-5 lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-[var(--line-subtle)] bg-white px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
                Entdecken
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text-strong)] sm:text-4xl">Entdecke Routen in deiner Stadt</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                Stöbere durch kuratierte Routen und finde Inspiration für deinen nächsten Tag.
              </p>

              <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
                <span className="rounded-full border border-[var(--line-subtle)] bg-white px-2.5 py-1">{totalPublic} Routen</span>
                <span className="rounded-full border border-[var(--line-subtle)] bg-white px-2.5 py-1">{filteredRoutes.length} Treffer</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/planner" className="rounded-full border border-[var(--line-subtle)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] hover:bg-[var(--bg-panel)]">
                ← Planen
              </Link>
              <Link href="/saved" className="rounded-full border border-[var(--line-subtle)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] hover:bg-[var(--bg-panel)]">
                Meine Pläne
              </Link>
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1.6fr)_minmax(150px,0.8fr)_minmax(150px,0.75fr)_auto]">
            <input
              aria-label="Routen suchen"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Titel, Creator, Startpunkt oder Stadt..."
              className={filterControlClass}
            />

            <select
              aria-label="Stadt filtern"
              value={selectedCitySlug}
              onChange={(e) => setSelectedCitySlug(e.target.value)}
              className={filterControlClass}
              disabled={citiesLoading}
            >
              <option value="all">Alle Städte</option>
              {cityDropdownOptions.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Sortierung auswählen"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className={filterControlClass}
            >
              <option value="trending">Gerade beliebt</option>
              <option value="top">Bestbewertet</option>
              <option value="featured">Ausgewählt</option>
              <option value="new">Neueste</option>
            </select>

            {myInterests.length > 0 ? (
              <button
                type="button"
                onClick={() => setPersonalizedSort((value) => !value)}
                className={`h-10 rounded-xl border px-3 text-xs font-medium shadow-sm transition sm:text-sm ${
                  personalizedSort
                    ? "border-black bg-black text-white"
                    : "border-black/10 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {personalizedSort ? "Für mich: an" : "Für mich"}
              </button>
            ) : (
              <Link
                href="/profile#profile-interests"
                className="flex h-10 items-center justify-center rounded-xl border border-black/10 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 sm:text-sm"
              >
                Interessen setzen
              </Link>
            )}
          </div>

          {/* Occasion / Anlass filter pills */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {OCCASION_PILLS.map((pill) => (
              <button
                key={pill.key}
                type="button"
                onClick={() => setOccasionFilter(pill.key)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                  occasionFilter === pill.key
                    ? "border-black bg-black text-white"
                    : "border-black/10 bg-white text-gray-700 hover:border-black/25 hover:bg-gray-50"
                }`}
              >
                {pill.emoji ? `${pill.emoji} ` : ""}{pill.label}
              </button>
            ))}
          </div>

          <details className="mt-2 rounded-2xl border border-black/5 bg-white/50 px-3 py-2">
            <summary className="cursor-pointer list-none text-xs font-medium text-[var(--text-muted)]">
              Weitere Filter
              <span className="ml-2 text-[11px] text-gray-400">Land, Typ, Varianten</span>
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <select
                aria-label="Land filtern"
                value={selectedCountryCode}
                onChange={(e) => {
                  setSelectedCountryCode(e.target.value);
                  setSelectedCitySlug("all");
                }}
                className={filterControlClass}
                disabled={citiesLoading}
              >
                <option value="all">Alle Länder</option>
                {availableCountryCodes.map((countryCode) => (
                  <option key={countryCode} value={countryCode}>
                    {countryLabel(countryCode)}
                  </option>
                ))}
              </select>

              <select
                aria-label="Creator-Typ filtern"
                value={creatorFilter}
                onChange={(e) => setCreatorFilter(e.target.value as CreatorType | "all")}
                className={filterControlClass}
              >
                <option value="all">Alle Typen</option>
                <option value="user">User</option>
                <option value="creator">Creator</option>
                <option value="influencer">Influencer</option>
                <option value="brand">Brand</option>
                <option value="editorial">Editorial</option>
              </select>

              <select
                aria-label="Varianten filtern"
                value={variantFilter}
                onChange={(e) => setVariantFilter(e.target.value as VariantFilter)}
                className={filterControlClass}
              >
                <option value="all">Alle Varianten</option>
                <option value="original">Nur Originale</option>
                <option value="variant">Nur Varianten</option>
              </select>

              <select
                aria-label="Varianten-Sortierung auswählen"
                value={variantSort}
                onChange={(e) => setVariantSort(e.target.value as VariantSort)}
                className={filterControlClass}
              >
                <option value="default">Varianten: Standard</option>
                <option value="original-first">Originale zuerst</option>
                <option value="variant-first">Varianten zuerst</option>
              </select>
            </div>
          </details>

          <div className="mt-2 text-xs text-gray-500">
            {myInterests.length > 0
              ? "Deine gespeicherten Interessen können die Reihenfolge personalisieren."
              : "Lege Interessen im Profil an, um persönliche Sortierung zu aktivieren."}
          </div>
        </div>
      </div>

      {/* Events-Einstieg — größere Anlässe */}
      <div className="mb-3 flex items-center justify-between gap-4 rounded-xl border border-[var(--line-subtle)] bg-white px-4 py-3 shadow-[0_1px_4px_rgba(15,23,42,0.05)]">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Größeres Event geplant?</div>
          <div className="mt-0.5 text-sm font-medium text-[var(--text-strong)]">Hochzeiten, Geburtstage & Firmenfeiern — mit Dienstleister-Suche</div>
        </div>
        <Link
          href="/events"
          className="shrink-0 rounded-full bg-[var(--text-strong)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1f2937] active:scale-[0.98]"
        >
          Event planen →
        </Link>
      </div>

      {/* Roadtrip-Routen — Mehrtagsreisen entdecken */}
      <div className="mb-4 flex items-center justify-between gap-4 overflow-hidden rounded-xl border border-[rgba(183,106,67,0.2)] bg-[linear-gradient(135deg,rgba(183,106,67,0.07),rgba(90,118,136,0.06))] px-4 py-3 shadow-[0_1px_4px_rgba(15,23,42,0.05)]">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b76a43]">Mehrtagsreisen</div>
          <div className="mt-0.5 text-sm font-medium text-[var(--text-strong)]">Roadtrip-Routen — Mehrere Städte, ein Plan. Von echten Reisenden geteilt.</div>
          <div className="mt-0.5 text-xs text-[var(--text-muted)]">Route als Vorlage übernehmen · Eigene Route speichern & teilen</div>
        </div>
        <Link
          href="/roadtrip/routes"
          className="shrink-0 rounded-full border border-[rgba(183,106,67,0.3)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#b76a43] transition hover:bg-[rgba(183,106,67,0.08)] active:scale-[0.98]"
        >
          Routen entdecken →
        </Link>
      </div>

      {monetizationDebug ? (
        <div className="mb-8 space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <InternalMonetizationSlot
              enabled={monetizationDebug}
              slotKey="explore_featured_events_strip"
              title="Explore: Featured Event Strip"
              description="Erster echter interner Event-Visibility-Pilot auf Explore. Hier prüfen wir Featured Events mit realem Ticket-Partner, klarer Kennzeichnung und sauberer Attribution."
              productKeys={["featured_event", "sponsored_placement"]}
              previewItems={["Featured Event", "Partner-Event", "Saison-Highlight"]}
              citySlug={selectedCitySlug !== "all" ? selectedCitySlug : null}
              livePreview
              ctaSource="internal_featured_event_pilot"
            />
            <InternalMonetizationSlot
              enabled={monetizationDebug}
              slotKey="explore_featured_locations_strip"
              title="Explore: Featured Location Strip"
              description="Erster echter interner Visibility-Pilot auf Explore. Hier prüfen wir Featured Locations mit realem Partner, klarer Kennzeichnung und sauberer Attribution."
              productKeys={["featured_location", "partner_basic", "partner_pro"]}
              previewItems={["Restaurant-Highlight", "Venue-Partner", "Experience-Spot"]}
              citySlug={selectedCitySlug !== "all" ? selectedCitySlug : null}
              livePreview
              ctaSource="internal_featured_visibility_pilot"
            />
          </div>
          <MonetizationDebugPanel
            enabled={monetizationDebug}
            surface="explore"
            citySlug={selectedCitySlug !== "all" ? selectedCitySlug : null}
            title="Explore Monetization Debug"
          />
        </div>
      ) : null}

      {loading ? (
            <div className="rounded-[28px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-6 text-[var(--text-muted)] shadow-[var(--shadow-soft)]">Explore-Daten werden geladen...</div>
        ) : errorText ? (
        <div className="rounded-[28px] border border-[rgba(161,75,69,0.18)] bg-[rgba(161,75,69,0.08)] p-6 text-[var(--state-error)] shadow-[var(--shadow-soft)]">{errorText}</div>
      ) : (
        <div className="space-y-12">
          {editorialRoutes.length > 0 ? (
            <section>
              <SectionHeader
                title="Redaktionelle Routen"
                subtitle="Kuratierte Tagesrouten vom PD24-Redaktionsteam – für alle 33 deutschen Großstädte."
                actionHref="/creator/pd24-redaktion"
                actionLabel="Alle ansehen"
              />
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {editorialRoutes.map((route) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    creator={route.creator_profile_id ? creatorById.get(route.creator_profile_id) ?? null : null}
                    cityMap={cityMap}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <SectionHeader
              title="Passt zu deinen Interessen"
              subtitle={
                myInterests.length > 0
                  ? `Persönliche Vorschläge auf Basis deines Profils: ${myInterests.slice(0, 4).join(", ")}`
                  : "Melde dich an und hinterlege Interessen im Profil, um persönlichere Vorschläge zu sehen."
              }
              actionHref="/profile"
              actionLabel={myInterests.length > 0 ? "Interessen anpassen" : "Profil öffnen"}
            />
            {personalizedRoutes.length === 0 ? (
              <div className="rounded-[28px] border border-black/10 bg-white p-4 text-sm text-gray-600 shadow-sm">
                {myInterests.length > 0 ? (
                  "Noch keine personalisierten Vorschläge verfügbar."
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span>Speichere ein paar Vorlieben, dann sortiert Explore relevanter für dich.</span>
                    <Link
                      href="/profile#profile-interests"
                      className="inline-flex h-9 items-center justify-center rounded-xl bg-black px-3 text-xs font-medium text-white"
                    >
                      Vorlieben speichern
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {personalizedRoutes.map((item) => (
                  <RouteCard
                    key={`personal-${item.route.id}`}
                    route={item.route}
                    creator={item.route.creator_profile_id ? creatorById.get(item.route.creator_profile_id) ?? null : null}
                    cityMap={cityMap}
                    reason={item.reason}
                    reasonBadges={item.reasonBadges}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeader
              title="Gerade beliebt"
              subtitle="Routen mit der meisten Aktivität gerade."
            />
            {trendingRoutes.length === 0 ? (
              <div className="rounded-[28px] border border-black/10 bg-white p-6 text-gray-600 shadow-sm">Keine aktuell beliebten Routen gefunden.</div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {trendingRoutes.map((route) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    creator={route.creator_profile_id ? creatorById.get(route.creator_profile_id) ?? null : null}
                    cityMap={cityMap}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeader
              title="Starke Creator"
              subtitle="Kuratorinnen, Kuratoren und Creator mit den stärksten Routen."
            />
            {topCreators.length === 0 ? (
              <div className="rounded-[28px] border border-black/10 bg-white p-6 text-gray-600 shadow-sm">Keine Creator gefunden.</div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {topCreators.map((creator) => (
                  <CreatorCard
                    key={creator.id}
                    creator={creator}
                    cityMap={cityMap}
                    rankingScore={creatorRankingMap[creator.id] ?? 0}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeader
              title="Bestbewertet"
              subtitle="Die am höchsten bewerteten Routen."
            />
            {topRatedRoutes.length === 0 ? (
              <div className="rounded-[28px] border border-black/10 bg-white p-6 text-gray-600 shadow-sm">Keine bestbewerteten Routen gefunden.</div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {topRatedRoutes.map((route) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    creator={route.creator_profile_id ? creatorById.get(route.creator_profile_id) ?? null : null}
                    cityMap={cityMap}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeader
              title="Ausgewählte Routen"
              subtitle="Von uns handverlesene Highlights."
            />
            {featuredRoutes.length === 0 ? (
              <div className="rounded-[28px] border border-black/10 bg-white p-6 text-gray-600 shadow-sm">Keine ausgewählten Routen gefunden.</div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {featuredRoutes.map((route) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    creator={route.creator_profile_id ? creatorById.get(route.creator_profile_id) ?? null : null}
                    cityMap={cityMap}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeader
              title="Neu eingestellt"
              subtitle="Die zuletzt hinzugefügten Routen."
            />
            {newestRoutes.length === 0 ? (
              <div className="rounded-[28px] border border-black/10 bg-white p-6 text-gray-600 shadow-sm">Keine neuen Routen gefunden.</div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {newestRoutes.map((route) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    creator={route.creator_profile_id ? creatorById.get(route.creator_profile_id) ?? null : null}
                    cityMap={cityMap}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeader
              title="Alle Routen"
              subtitle="Alle Routen passend zu deiner Auswahl."
            />
            {filteredRoutes.length === 0 ? (
              <div className="rounded-[28px] border border-black/10 bg-white p-6 text-gray-600 shadow-sm">Keine Routen für diese Filter gefunden.</div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredRoutes.map((route) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    creator={route.creator_profile_id ? creatorById.get(route.creator_profile_id) ?? null : null}
                    cityMap={cityMap}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Eigene Route erstellen — nachgeordnet, kleiner Textlink */}
      <div className="mt-10 flex justify-center border-t border-[var(--line-subtle)] pt-8">
        <Link
          href="/routes"
          className="text-sm text-[var(--text-muted)] underline-offset-2 transition hover:text-[var(--text-strong)] hover:underline"
        >
          Eigene Route erstellen →
        </Link>
      </div>
    </main>
  );
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <main className="pd24-page-wide px-1 py-4 sm:px-2 lg:px-4">
          <div className="rounded-[28px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-6 text-[var(--text-muted)] shadow-[var(--shadow-soft)]">
            Explore wird geladen...
          </div>
        </main>
      }
    >
      <ExplorePageContent />
    </Suspense>
  );
}
