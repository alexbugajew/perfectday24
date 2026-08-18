"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
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
import RecommendationReason from "@/components/RecommendationReason";
import {
  buildInterestReasonBadges,
  explainInterestMatch,
  normalizeStringList,
  scoreRouteAgainstInterests,
} from "@/lib/routes/recommendation-reasons";
import { shouldShowInternalMonetization } from "@/lib/monetization/debug";
import { safeExternalUrl } from "@/lib/security/safe-url";

type CreatorType = "user" | "creator" | "influencer" | "brand" | "editorial";
type RouteVisibility = "private" | "unlisted" | "public";

type CreatorProfileRow = {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
  home_city_slug: string | null;
  creator_type: CreatorType;
  is_verified: boolean;
  is_featured: boolean;
  route_count: number | null;
  follower_count: number | null;
  following_count: number | null;
  total_likes_received: number | null;
  total_bookmarks_received: number | null;
  tags?: unknown;
  meta?: unknown;
  created_at: string;
  updated_at: string;
};

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

type CreatorRankingRow = {
  creator_profile_id: string;
  content_score: number | null;
  engagement_score: number | null;
  follower_score: number | null;
  freshness_score: number | null;
  final_score: number | null;
  calculated_at: string;
};

type ProfileRow = {
  user_id: string;
  interests: unknown;
};

type CityRow = CityLookupRow;

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

const RouteMiniMapClient = dynamic(() => import("@/components/RouteMiniMapClient"), {
  ssr: false,
});

type RouteMiniStop = {
  label: string;
  name: string;
  lat: number;
  lng: number;
};

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


function RouteCard({
  route,
  cityMap,
  reason,
  reasonBadges,
}: {
  route: UserRouteRow;
  cityMap: Map<string, CityLookupRow>;
  reason?: string | null;
  reasonBadges?: string[];
}) {
  const href = routeHref(route);
  const title = route.title?.trim() || "Unbenannte Route";
  const desc = route.description?.trim() || "Noch keine Beschreibung vorhanden.";
  const city = formatCityWithCountry(route.city_slug, cityMap);
  const cover = route.cover_image_url?.trim() || null;
  const shortDesc = desc.length > 120 ? `${desc.slice(0, 117).trim()}...` : desc;
  const durationLabel = estimateDurationLabel(route);
  const idealFor = idealForLabel(route);
  const badges = inferPublicRouteBadges(route);
  const variantRole = routeVariantRoleLabel(route);
  const [miniStops, setMiniStops] = useState<RouteMiniStop[]>([]);

  useEffect(() => {
    let active = true;

    (async () => {
      const points: RouteMiniStop[] = [];

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
        console.error("Mini map stops load error:", error);
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
  }, [route.id, route.start_label, route.start_lat, route.start_lng]);

  const content = (
    <>
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-neutral-100 via-white to-neutral-200">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-end p-4">
            <div className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs text-gray-600 backdrop-blur">
              Kein Coverbild
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-4">
          <div className="flex flex-wrap gap-2">
            {route.is_featured ? (
              <span className="rounded-full bg-black px-3 py-1 text-[11px] font-medium text-white">
                Featured
              </span>
            ) : null}
            {variantRole ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] text-emerald-800">
                {variantRole}
              </span>
            ) : null}
            <span className="rounded-full border border-white/60 bg-white/85 px-3 py-1 text-[11px] text-gray-700 backdrop-blur">
              {city}
            </span>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/85 px-3 py-2 text-right text-[11px] text-gray-700 backdrop-blur">
            <div>{route.stop_count ?? 0} Stops</div>
            <div>{durationLabel}</div>
          </div>
        </div>
      </div>

        <div className="space-y-4 p-5">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold leading-tight text-gray-950 line-clamp-2">{title}</h3>
          <p className="text-sm leading-relaxed text-gray-600">{shortDesc}</p>
        </div>

        <RecommendationReason reason={reason} reasonBadges={reasonBadges} compact />

        {badges.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span
                key={badge.label}
                className={`rounded-full px-3 py-1 text-[11px] font-medium ${
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
        ) : null}

        <div className="grid gap-2 text-xs sm:grid-cols-3">
          <div className="rounded-2xl border border-black/5 bg-gray-50 px-3 py-3">
            <div className="text-gray-400">Dauer</div>
            <div className="mt-1 font-medium text-gray-900">{durationLabel}</div>
          </div>
          <div className="rounded-2xl border border-black/5 bg-gray-50 px-3 py-3">
            <div className="text-gray-400">Stops</div>
            <div className="mt-1 font-medium text-gray-900">{route.stop_count ?? 0} Stationen</div>
          </div>
          <div className="rounded-2xl border border-black/5 bg-gray-50 px-3 py-3">
            <div className="text-gray-400">Perfekt für</div>
            <div className="mt-1 font-medium text-gray-900 line-clamp-2">{idealFor}</div>
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-black/5 bg-gradient-to-br from-stone-50 to-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-400">Kompaktansicht</div>
              <div className="mt-1 text-sm font-medium text-gray-900">
                {route.start_label ? `Start bei ${route.start_label}` : `Route in ${city}`}
              </div>
            </div>
            <div className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] text-gray-600">
              {route.photo_count ?? 0} Fotos
            </div>
          </div>
          <div className="mt-4">
            <RouteMiniMapClient stops={miniStops} height={120} />
          </div>
        </div>

        <details className="rounded-2xl border border-black/5 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          <summary className="cursor-pointer list-none font-medium text-gray-900">
            Mehr zur Route
          </summary>
          <div className="mt-3 space-y-2 leading-relaxed">
            <p>{desc}</p>
            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
              <span>{route.required_stop_count ?? 0} Pflicht-Stops</span>
              <span>{route.avg_rating?.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) ?? "0,0"} Bewertung</span>
              <span>{route.like_count ?? 0} Likes</span>
              <span>Aktualisiert {formatDate(route.updated_at)}</span>
            </div>
          </div>
        </details>

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span>{route.bookmark_count ?? 0} gespeichert</span>
            <span>{route.view_count ?? 0} Aufrufe</span>
          </div>
          {href ? (
            <Link
              href={href}
              className="rounded-full border border-black bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-900"
            >
              Route öffnen
            </Link>
          ) : (
            <div className="text-xs text-[var(--state-error)]">Route aktuell nicht aufrufbar.</div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="group overflow-hidden rounded-[28px] border border-black/10 bg-white/95 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-xl">
      {content}
    </div>
  );
}

function CreatorPageContent() {
  const params = useParams<{ username: string }>();
  const searchParams = useSearchParams();
  const username = typeof params?.username === "string" ? params.username : "";

  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [creator, setCreator] = useState<CreatorProfileRow | null>(null);
  const [routes, setRoutes] = useState<UserRouteRow[]>([]);
  const [ranking, setRanking] = useState<CreatorRankingRow | null>(null);
  const [myInterests, setMyInterests] = useState<string[]>([]);
  const [cities, setCities] = useState<CityRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const [sortBy, setSortBy] = useState<"ranking" | "trending" | "rating" | "new">("ranking");
  const [personalizedSort, setPersonalizedSort] = useState(true);
  const [variantFilter, setVariantFilter] = useState<VariantFilter>("all");
  const [variantSort, setVariantSort] = useState<VariantSort>("default");

  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const { data: s, error: sErr } = await supabase.auth.getSession();
        if (sErr) console.error("getSession error:", sErr);

        if (!s?.session) {
          const { data: a, error: aErr } = await supabase.auth.signInAnonymously();
          if (aErr) {
            console.error("Anonymous auth error:", aErr);
            if (!active) return;
            setUserId(null);
            setAuthReady(true);
            return;
          }
          if (!active) return;
          setUserId(a.user?.id ?? null);
          setAuthReady(true);
        } else {
          if (!active) return;
          setUserId(s.session.user.id);
          setAuthReady(true);
        }
      } catch (e) {
        console.error("Auth init error:", e);
        if (!active) return;
        setUserId(null);
        setAuthReady(true);
      }
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
        console.error("Creator profile interests load error:", error);
        setMyInterests([]);
        return;
      }

      setMyInterests(normalizeStringList((data as ProfileRow | null)?.interests));
    })();
  }, [authReady, userId]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("slug,name,country_code")
        .eq("is_active", true);

      if (error) {
        console.error("Creator cities load error:", error);
        setCities([]);
        return;
      }

      setCities((data as CityRow[]) ?? []);
    })();
  }, []);

  async function loadCreatorPage() {
    if (!username) return;

    setLoading(true);
    setRoutesLoading(true);
    setNotFound(false);

    try {
      const { data: creatorData, error: creatorError } = await supabase
        .from("creator_profiles")
        .select("*")
        .eq("username", username)
        .maybeSingle();

      if (creatorError) {
        console.error("Creator load error:", creatorError);
        setCreator(null);
        setNotFound(true);
        return;
      }

      if (!creatorData) {
        setCreator(null);
        setNotFound(true);
        return;
      }

      const c = creatorData as CreatorProfileRow;
      setCreator(c);

      const [{ data: routeRows, error: routesError }, { data: rankingRow, error: rankingError }] =
        await Promise.all([
          supabase
            .from("user_routes")
            .select("*")
            .eq("creator_profile_id", c.id)
            .eq("visibility", "public")
            .limit(200),
          supabase
            .from("creator_rankings")
            .select("*")
            .eq("creator_profile_id", c.id)
            .maybeSingle(),
        ]);

      if (routesError) {
        console.error("Creator routes load error:", routesError);
        setRoutes([]);
      } else {
        setRoutes(((routeRows ?? []) as UserRouteRow[]).filter((r) => !!r && !!r.title));
      }

      if (rankingError) {
        console.error("Creator ranking load error:", rankingError);
        setRanking(null);
      } else {
        setRanking((rankingRow as CreatorRankingRow | null) ?? null);
      }
    } finally {
      setLoading(false);
      setRoutesLoading(false);
    }
  }

  useEffect(() => {
    loadCreatorPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  useEffect(() => {
    if (!authReady || !creator?.id || !userId) return;

    (async () => {
      const { data, error } = await supabase
        .from("creator_follows")
        .select("id")
        .eq("creator_profile_id", creator.id)
        .eq("follower_user_id", userId)
        .limit(1);

      if (error) {
        console.error("Follow state load error:", error);
        setIsFollowing(false);
        return;
      }

      setIsFollowing(Array.isArray(data) && data.length > 0);
    })();
  }, [authReady, creator?.id, userId]);

  async function reloadCreatorHeader() {
    if (!creator?.username) return;

    const [{ data: creatorData }, { data: rankingData }] = await Promise.all([
      supabase.from("creator_profiles").select("*").eq("username", creator.username).maybeSingle(),
      supabase.from("creator_rankings").select("*").eq("creator_profile_id", creator.id).maybeSingle(),
    ]);

    if (creatorData) setCreator(creatorData as CreatorProfileRow);
    if (rankingData) setRanking(rankingData as CreatorRankingRow);
  }

  async function toggleFollow() {
    if (!creator?.id || !userId || followBusy) return;
    if (creator.user_id === userId) {
      showToast("Du kannst dir nicht selbst folgen.");
      return;
    }

    setFollowBusy(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("creator_follows")
          .delete()
          .eq("creator_profile_id", creator.id)
          .eq("follower_user_id", userId);

        if (error) {
          console.error("Unfollow error:", error);
          showToast("Entfolgen fehlgeschlagen.");
          return;
        }

        setIsFollowing(false);
        showToast("Entfolgt");
      } else {
        const { error } = await supabase.from("creator_follows").insert({
          creator_profile_id: creator.id,
          follower_user_id: userId,
        });

        if (error) {
          console.error("Follow error:", error);
          showToast("Folgen fehlgeschlagen.");
          return;
        }

        setIsFollowing(true);
        showToast("Du folgst diesem Profil jetzt.");
      }

      await reloadCreatorHeader();
    } finally {
      setFollowBusy(false);
    }
  }

  const sortedRoutes = useMemo(() => {
    const out = routes.filter((route) => matchesVariantFilter(route, variantFilter));

    out.sort((a, b) => {
      const variantDiff = compareVariantOrder(a, b, variantSort);
      if (variantDiff !== 0) return variantDiff;

      if (personalizedSort) {
        const personalDiff = scoreRouteAgainstInterests(b, myInterests) - scoreRouteAgainstInterests(a, myInterests);
        if (personalDiff !== 0) return personalDiff;
      }

      if (sortBy === "trending") return (b.trending_score ?? 0) - (a.trending_score ?? 0);

      if (sortBy === "rating") {
        if ((b.avg_rating ?? 0) !== (a.avg_rating ?? 0)) {
          return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
        }
        return (b.rating_count ?? 0) - (a.rating_count ?? 0);
      }

      if (sortBy === "new") {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }

      return (b.ranking_score ?? 0) - (a.ranking_score ?? 0);
    });

    return out;
  }, [routes, sortBy, myInterests, personalizedSort, variantFilter, variantSort]);

  const cityMap = useMemo(() => buildCityLookupMap(cities), [cities]);
  const homeCityLabel = formatCityWithCountry(creator?.home_city_slug, cityMap);

  const featuredRoutes = useMemo(() => sortedRoutes.filter((r) => r.is_featured).slice(0, 3), [sortedRoutes]);
  const monetizationDebug = useMemo(
    () => shouldShowInternalMonetization(searchParams.get("monetization")),
    [searchParams]
  );
  const creatorMonetizationCitySlug = creator?.home_city_slug ?? routes[0]?.city_slug ?? null;

  // Profil-URLs sind nutzergepflegt und werden als href gerendert — ohne
  // Protokollprüfung wäre `javascript:` hier Stored XSS. safeExternalUrl gibt
  // nur http(s) zurück, alles andere fällt aus der Liste.
  const socialLinks = [
    { raw: creator?.website_url, label: "Website" },
    { raw: creator?.instagram_url, label: "Instagram" },
    { raw: creator?.tiktok_url, label: "TikTok" },
    { raw: creator?.youtube_url, label: "YouTube" },
  ]
    .map(({ raw, label }) => {
      const href = safeExternalUrl(raw);
      return href ? { href, label } : null;
    })
    .filter(Boolean) as Array<{ href: string; label: string }>;

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <div className="rounded-[28px] border border-black/10 bg-white/90 p-6 shadow-sm">
          Creator-Profil wird geladen...
        </div>
      </main>
    );
  }

  if (notFound || !creator) {
    return (
      <main className="pd24-page-standard px-4 pb-16 pt-6">
        <div className="mb-6 flex flex-wrap gap-4 text-sm">
          <Link href="/explore" className="text-[var(--text-muted)] underline underline-offset-4">
            ← Zurück zu Explore
          </Link>
          <Link href="/saved" className="text-[var(--text-muted)] underline underline-offset-4">
            Meine Pläne
          </Link>
        </div>
        <div className="rounded-xl border border-[var(--line-subtle)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <div className="pd24-meta">Nicht gefunden</div>
          <h1 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">Creator nicht gefunden</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Dieses Profil existiert nicht oder ist aktuell nicht öffentlich verfügbar.
          </p>
          <Link
            href="/explore"
            className="pd24-btn pd24-btn-primary mt-4"
          >
            Routen entdecken
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      {monetizationDebug ? (
        <div className="mb-6 space-y-4">
          <InternalMonetizationSlot
            enabled={monetizationDebug}
            slotKey="creator_profile_featured_routes"
            title="Creator-Profil: Featured Distribution"
            description="Interner Slot für spätere bevorzugte Creator-, Brand- oder Partner-Routen auf Profilflächen."
            productKeys={["creator_brand_route_distribution", "partner_pro", "city_pro_plus"]}
            previewItems={["Featured Route", "Brand Collection", "Partner-Serie"]}
            citySlug={creatorMonetizationCitySlug}
            creatorProfileId={creator.id}
            livePreview
            ctaSource="internal_creator_profile_distribution_pilot"
          />
          <MonetizationDebugPanel
            enabled={monetizationDebug}
            surface="creator_profile"
            creatorProfileId={creator.id}
            citySlug={creatorMonetizationCitySlug}
            title="Creator-Profil Monetization Debug"
          />
        </div>
      ) : null}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap text-sm">
        <div className="flex flex-wrap gap-4">
          <Link href="/explore" className="text-[var(--text-muted)] underline underline-offset-4">
            ← Zurück zu Explore
          </Link>
          <Link href="/saved" className="text-[var(--text-muted)] underline underline-offset-4">
            Meine Pläne
          </Link>
        </div>
        <Link href="/planner" className="text-[var(--text-muted)] underline underline-offset-4">
          Planen →
        </Link>
      </div>

      <section className="overflow-hidden rounded-[var(--radius-hero)] border border-black/10 bg-white shadow-sm">
        <div className="relative min-h-[280px] overflow-hidden bg-gradient-to-br from-stone-100 via-white to-neutral-200">
          {creator.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={creator.cover_image_url}
              alt={creator.display_name}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />

          <div className="relative flex min-h-[280px] flex-col justify-between p-6 md:p-8">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs text-white backdrop-blur">
                {niceCreatorType(creator.creator_type)}
              </span>
              {creator.is_verified ? (
                <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs text-white backdrop-blur">
                  Verifiziert
                </span>
              ) : null}
              {creator.is_featured ? (
                <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs text-white backdrop-blur">
                  Featured
                </span>
              ) : null}
              {creator.home_city_slug ? (
                <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs text-white backdrop-blur">
                  {homeCityLabel}
                </span>
              ) : null}
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
              <div className="flex items-end gap-5">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-3xl border border-white/30 bg-white/10 shadow-lg backdrop-blur sm:h-28 sm:w-28">
                  {creator.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={creator.avatar_url}
                      alt={creator.display_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-medium text-white/80">
                      {creator.display_name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  {/* h1 steht serverseitig im Layout — siehe Kommentar dort. */}
                  <div className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    {creator.display_name}
                  </div>
                  <div className="mt-2 text-sm text-white/85">@{creator.username}</div>
                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/90">
                    {creator.bio?.trim() || "Dieses Profil teilt kuratierte PerfectDay24-Routen und Ideen für echte Tageserlebnisse."}
                  </p>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/20 bg-white/12 p-5 text-white backdrop-blur">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-white/15 bg-black/10 p-3">
                    <div className="text-xs text-white/70">Routen</div>
                    <div className="mt-1 text-2xl font-semibold">{compactNumber(creator.route_count)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-black/10 p-3">
                    <div className="text-xs text-white/70">Follower</div>
                    <div className="mt-1 text-2xl font-semibold">{compactNumber(creator.follower_count)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-black/10 p-3">
                    <div className="text-xs text-white/70">Likes</div>
                    <div className="mt-1 text-2xl font-semibold">{compactNumber(creator.total_likes_received)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-black/10 p-3">
                    <div className="text-xs text-white/70">Bookmarks</div>
                    <div className="mt-1 text-2xl font-semibold">{compactNumber(creator.total_bookmarks_received)}</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={toggleFollow}
                    disabled={!authReady || followBusy || creator.user_id === userId}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      isFollowing
                        ? "bg-white text-black"
                        : "border border-white/30 bg-white/10 text-white hover:bg-white/20"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {creator.user_id === userId
                      ? "Dein Profil"
                      : followBusy
                        ? "..."
                        : isFollowing
                          ? "Folge ich"
                          : "Folgen"}
                  </button>
                  <Link
                    href={`/u/${creator.username}`}
                    className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
                  >
                    Öffentliche Vorschau
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_2.05fr]">
        <aside className="space-y-6">
          <section className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-950">Profil</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-600">
              <div className="rounded-2xl border border-black/5 bg-gray-50 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-400">Mitglied seit</div>
                <div className="mt-1 font-medium text-gray-900">{formatDate(creator.created_at)}</div>
              </div>
              <div className="rounded-2xl border border-black/5 bg-gray-50 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-400">Zuletzt aktualisiert</div>
                <div className="mt-1 font-medium text-gray-900">{formatDate(creator.updated_at)}</div>
              </div>
              {ranking ? (
                <div className="rounded-2xl border border-black/5 bg-gray-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-400">Ranking Score</div>
                  <div className="mt-1 font-medium text-gray-900">{ranking.final_score ?? 0}</div>
                </div>
              ) : null}
            </div>
          </section>

          {socialLinks.length > 0 ? (
            <section className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-950">Links</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {socialLinks.map((link) => (
                  <a
                    key={`${link.label}-${link.href}`}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-black/10 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </section>
          ) : null}
        </aside>

        <div className="space-y-10">
          {featuredRoutes.length > 0 ? (
            <section>
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-950">Featured Routes</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Die stärksten oder aktuell besonders hervorgehobenen Routen dieses Profils.
                  </p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {featuredRoutes.map((route) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    cityMap={cityMap}
                    reason={explainInterestMatch(route, myInterests, { terse: true })}
                    reasonBadges={buildInterestReasonBadges(route, myInterests)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <div className="mb-5 flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-2xl font-semibold text-gray-950">Öffentliche Routen</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Alle veröffentlichten Routen dieses Creators, sortierbar nach Qualität, Trend oder Aktualität.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Sortierung</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-gray-900"
                  >
                    <option value="ranking">Ranking</option>
                    <option value="trending">Trending</option>
                    <option value="rating">Bewertung</option>
                    <option value="new">Neueste</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Familie</span>
                  <select
                    value={variantFilter}
                    onChange={(e) => setVariantFilter(e.target.value as VariantFilter)}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-gray-900"
                  >
                    <option value="all">Alle</option>
                    <option value="original">Nur Originale</option>
                    <option value="variant">Nur Varianten</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Reihenfolge</span>
                  <select
                    value={variantSort}
                    onChange={(e) => setVariantSort(e.target.value as VariantSort)}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-gray-900"
                  >
                    <option value="default">Standard</option>
                    <option value="original-first">Originale zuerst</option>
                    <option value="variant-first">Varianten zuerst</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setPersonalizedSort((value) => !value)}
                  disabled={myInterests.length === 0}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    personalizedSort
                      ? "border-black bg-black text-white"
                      : "border-black/10 bg-white text-gray-700 hover:bg-gray-50"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {personalizedSort ? "Für mich sortieren: an" : "Für mich sortieren: aus"}
                </button>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                    personalizedSort
                      ? "bg-black text-white"
                      : "border border-black/10 bg-white text-gray-700"
                  }`}
                >
                  {personalizedSort ? "Aktuell personalisiert" : "Aktuell allgemein sortiert"}
                </span>
              </div>
            </div>

            <div className="-mt-2 mb-5 text-xs text-gray-500">
              {myInterests.length > 0
                ? "Persönliche Reihenfolge nutzt deine gespeicherten Interessen."
                : "Lege Interessen im Profil an, um persönliche Sortierung zu aktivieren."}
            </div>
            <div className="-mt-3 mb-5 text-xs text-gray-500">
              {variantFilter === "all"
                ? "Zeigt Originale und Varianten gemeinsam."
                : variantFilter === "original"
                  ? "Aktuell nur Basisrouten dieses Creators."
                  : "Aktuell nur personalisierte oder abgeleitete Varianten."}
            </div>

            {routesLoading ? (
              <div className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm">
                Öffentliche Routen werden geladen...
              </div>
            ) : sortedRoutes.length === 0 ? (
              <div className="rounded-[28px] border border-black/10 bg-white p-8 shadow-sm">
                <div className="inline-flex rounded-full border border-black/10 bg-gray-50 px-3 py-1 text-xs text-gray-600">
                  Noch leer
                </div>
                <h3 className="mt-4 text-xl font-semibold text-gray-950">Noch keine öffentlichen Routen</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
                  Dieses Profil hat aktuell noch keine Route veröffentlicht. Schau später noch einmal vorbei.
                </p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {sortedRoutes.map((route) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    cityMap={cityMap}
                    reason={explainInterestMatch(route, myInterests, { terse: true })}
                    reasonBadges={buildInterestReasonBadges(route, myInterests)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {toast ? (
        <div className="fixed bottom-24 sm:bottom-4 left-1/2 z-[1400] -translate-x-1/2 rounded-full bg-black px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </main>
  );
}

export default function CreatorPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-7xl px-1 py-4 sm:px-2 lg:px-4">
          <div className="pd24-shell p-6 text-sm text-[var(--text-muted)]">
            Creator-Profil wird geladen...
          </div>
        </main>
      }
    >
      <CreatorPageContent />
    </Suspense>
  );
}
