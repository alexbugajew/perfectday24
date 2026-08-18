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
import { type FriendshipRow } from "@/lib/social/friends";
import { queuePlannerInviteDraft, type PlannerInviteMemberDraft } from "@/lib/social/planner-group";
import { shouldShowInternalMonetization } from "@/lib/monetization/debug";

type CreatorType = "user" | "creator" | "influencer" | "brand" | "editorial";
type UserRouteRow = {
  id: string;
  title: string | null;
  slug: string | null;
  description: string | null;
  city_slug: string | null;
  visibility: "private" | "unlisted" | "public";
  cover_image_url: string | null;
  stop_count?: number | null;
  photo_count?: number | null;
  avg_rating?: number | null;
  like_count?: number | null;
  bookmark_count?: number | null;
  start_label?: string | null;
  start_type?: string | null;
  start_lat?: number | null;
  start_lng?: number | null;
  updated_at?: string | null;
  tags?: unknown;
  meta?: unknown;
};

type CreatorProfileRow = {
  id?: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  creator_type: CreatorType | null;
  cover_image_url?: string | null;
  home_city_slug?: string | null;
  route_count?: number | null;
  follower_count?: number | null;
  total_likes_received?: number | null;
  total_bookmarks_received?: number | null;
  created_at?: string | null;
};

type ProfileRow = {
  user_id: string;
  interests: unknown;
};

type CityRow = CityLookupRow;

const RouteMiniMapClient = dynamic(() => import("@/components/RouteMiniMapClient"), {
  ssr: false,
});

function routeHref(route: UserRouteRow) {
  return route.slug ? `/routes/${route.slug}` : null;
}

function niceCreatorType(v: CreatorType | null | undefined) {
  if (v === "influencer") return "Influencer";
  if (v === "creator") return "Creator";
  if (v === "brand") return "Brand";
  if (v === "editorial") return "Editorial";
  return "User";
}

function compactNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("de-DE", { notation: "compact" }).format(value ?? 0);
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


function PublicRouteCard({
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
  const shortDesc = desc.length > 120 ? `${desc.slice(0, 117).trim()}...` : desc;
  const city = formatCityWithCountry(route.city_slug, cityMap);
  const durationLabel = estimateDurationLabel(route);
  const idealFor = idealForLabel(route);
  const badges = inferPublicRouteBadges(route);
  const variantRole = routeVariantRoleLabel(route);
  const [miniStops, setMiniStops] = useState<Array<{ label: string; name: string; lat: number; lng: number }>>([]);

  useEffect(() => {
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
        console.error("Public user mini map stops load error:", error);
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

  return (
    <div className="group overflow-hidden rounded-[28px] border border-black/10 bg-white/95 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-xl">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-neutral-100 via-white to-neutral-200">
        {route.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={route.cover_image_url}
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
            <span className="rounded-full border border-white/60 bg-white/85 px-3 py-1 text-[11px] text-gray-700 backdrop-blur">
              {city}
            </span>
            {variantRole ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] text-emerald-800">
                {variantRole}
              </span>
            ) : null}
            <span className="rounded-full border border-white/60 bg-white/85 px-3 py-1 text-[11px] text-gray-700 backdrop-blur">
              Öffentlich
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
            <div className="text-gray-400">Stopps</div>
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
              <span>{route.avg_rating?.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) ?? "0,0"} Bewertung</span>
              <span>{route.like_count ?? 0} Likes</span>
              <span>{route.bookmark_count ?? 0} Bookmarks</span>
              <span>Aktualisiert {formatDate(route.updated_at)}</span>
            </div>
          </div>
        </details>

        <div className="flex items-center justify-end">
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
    </div>
  );
}

function PublicUserProfilePageContent() {
  const params = useParams<{ username: string }>();
  const searchParams = useSearchParams();
  const username = typeof params?.username === "string" ? params.username : "";

  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [profile, setProfile] = useState<CreatorProfileRow | null>(null);
  const [routes, setRoutes] = useState<UserRouteRow[]>([]);
  const [myInterests, setMyInterests] = useState<string[]>([]);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [personalizedSort, setPersonalizedSort] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [friendBusy, setFriendBusy] = useState(false);
  const [variantFilter, setVariantFilter] = useState<VariantFilter>("all");
  const [variantSort, setVariantSort] = useState<VariantSort>("default");
  const sortedRoutes = useMemo(() => {
    const out = routes.filter((route) => matchesVariantFilter(route, variantFilter));
    out.sort((a, b) => {
      const variantDiff = compareVariantOrder(a, b, variantSort);
      if (variantDiff !== 0) return variantDiff;
      if (personalizedSort) {
        const personalDiff = scoreRouteAgainstInterests(b, myInterests) - scoreRouteAgainstInterests(a, myInterests);
        if (personalDiff !== 0) return personalDiff;
      }
      return new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime();
    });
    return out;
  }, [routes, variantFilter, variantSort, personalizedSort, myInterests]);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) console.error("Public user auth session error:", error);
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
        console.error("Public user profile interests load error:", error);
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
        console.error("Public user cities load error:", error);
        setCities([]);
        return;
      }

      setCities((data as CityRow[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!username) return;

    (async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const { data: profileData, error: profileError } = await supabase
          .from("creator_profiles")
          .select("id, user_id, username, display_name, avatar_url, bio, creator_type, cover_image_url, home_city_slug, route_count, follower_count, total_likes_received, total_bookmarks_received, created_at")
          .eq("username", username)
          .maybeSingle();

        if (profileError) {
          console.error("Public profile load error:", profileError);
          setNotFound(true);
          return;
        }

        const row = (profileData ?? null) as CreatorProfileRow | null;
        if (!row) {
          setNotFound(true);
          return;
        }

        setProfile(row);

        const { data: routeData, error: routeError } = await supabase
          .from("user_routes")
          .select("id, title, slug, description, city_slug, visibility, cover_image_url, stop_count, photo_count, avg_rating, like_count, bookmark_count, start_label, start_type, start_lat, start_lng, updated_at, tags, meta")
          .eq("user_id", row.user_id)
          .eq("visibility", "public")
          .limit(12);

        if (routeError) {
          console.error("Public profile routes load error:", routeError);
          setRoutes([]);
          return;
        }

        setRoutes((routeData ?? []) as UserRouteRow[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [username]);

  useEffect(() => {
    if (!authReady || !userId || !profile?.id || profile.user_id === userId) {
      setIsFollowing(false);
      return;
    }

    void (async () => {
      const { data, error } = await supabase
        .from("creator_follows")
        .select("id")
        .eq("creator_profile_id", profile.id)
        .eq("follower_user_id", userId)
        .limit(1);

      if (error) {
        console.error("Public user follow state load error:", error);
        setIsFollowing(false);
        return;
      }

      setIsFollowing(Array.isArray(data) && data.length > 0);
    })();
  }, [authReady, userId, profile?.id, profile?.user_id]);

  useEffect(() => {
    if (!authReady || !userId || !profile?.user_id || profile.user_id === userId) {
      setIsFriend(false);
      setFriendshipId(null);
      return;
    }

    void (async () => {
      const { data, error } = await supabase
        .from("user_friendships")
        .select("id, requester_user_id, addressee_user_id, created_at")
        .or(
          `and(requester_user_id.eq.${userId},addressee_user_id.eq.${profile.user_id}),and(requester_user_id.eq.${profile.user_id},addressee_user_id.eq.${userId})`
        )
        .limit(1);

      if (error) {
        console.error("Public user friendship state load error:", error);
        setIsFriend(false);
        setFriendshipId(null);
        return;
      }

      const row = Array.isArray(data) ? ((data[0] ?? null) as FriendshipRow | null) : null;
      setIsFriend(Boolean(row));
      setFriendshipId(row?.id ?? null);
    })();
  }, [authReady, userId, profile?.user_id]);

  async function toggleFollow() {
    if (!profile?.id || !userId || followBusy || profile.user_id === userId) return;
    setFollowBusy(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("creator_follows")
          .delete()
          .eq("creator_profile_id", profile.id)
          .eq("follower_user_id", userId);

        if (error) {
          console.error("Public user unfollow error:", error);
          return;
        }
        setIsFollowing(false);
      } else {
        const { error } = await supabase.from("creator_follows").insert({
          creator_profile_id: profile.id,
          follower_user_id: userId,
        });

        if (error) {
          console.error("Public user follow error:", error);
          return;
        }
        setIsFollowing(true);
      }
    } finally {
      setFollowBusy(false);
    }
  }

  async function toggleFriend() {
    if (!profile?.user_id || !userId || friendBusy || profile.user_id === userId) return;
    setFriendBusy(true);
    try {
      if (isFriend && friendshipId) {
        const { error } = await supabase.from("user_friendships").delete().eq("id", friendshipId);
        if (error) {
          console.error("Public user remove friend error:", error);
          return;
        }
        setIsFriend(false);
        setFriendshipId(null);
      } else {
        const ordered = [userId, profile.user_id].sort();
        const { data, error } = await supabase
          .from("user_friendships")
          .insert({
            requester_user_id: ordered[0],
            addressee_user_id: ordered[1],
          })
          .select("id, requester_user_id, addressee_user_id, created_at")
          .maybeSingle();

        if (error) {
          console.error("Public user add friend error:", error);
          return;
        }

        const row = (data ?? null) as FriendshipRow | null;
        setIsFriend(true);
        setFriendshipId(row?.id ?? null);
      }
    } finally {
      setFriendBusy(false);
    }
  }

  async function addProfileToPlanner() {
    if (!profile?.user_id) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, interests")
      .eq("user_id", profile.user_id)
      .maybeSingle();

    if (error) {
      console.error("Public user planner import error:", error);
      return;
    }

    const interests = normalizeStringList((data as ProfileRow | null)?.interests);
    if (interests.length === 0) return;

    const nextMember: PlannerInviteMemberDraft = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random()}`,
      name: profile.display_name || (profile.username ? `@${profile.username}` : "Profil"),
      interests: interests.slice(0, 12),
      profileUserId: profile.user_id,
      profileHandle: profile.username ?? null,
    };

    queuePlannerInviteDraft(nextMember);
  }

  const cityMap = useMemo(() => buildCityLookupMap(cities), [cities]);
  const monetizationDebug = useMemo(
    () => shouldShowInternalMonetization(searchParams.get("monetization")),
    [searchParams]
  );
  const profileMonetizationCitySlug = profile?.home_city_slug ?? routes[0]?.city_slug ?? null;

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <div className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm">
          Profil wird geladen...
        </div>
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main className="pd24-page-standard px-4 pb-16 pt-6">
        <div className="rounded-xl border border-[var(--line-subtle)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <div className="pd24-meta">Nicht gefunden</div>
          <h1 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">Profil nicht gefunden</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Für diesen Username gibt es aktuell kein öffentliches Profil.
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

  const displayName = profile.display_name || profile.username;
  const homeCityLabel = formatCityWithCountry(profile.home_city_slug, cityMap);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      {monetizationDebug ? (
        <div className="mb-6 space-y-4">
          <InternalMonetizationSlot
            enabled={monetizationDebug}
            slotKey="creator_profile_featured_routes"
            title="Öffentliches Profil: Featured Distribution"
            description="Interner Preview-Slot für spätere bevorzugte Route-Ausspielung oder Partner-Highlights auf öffentlichen Profilseiten."
            productKeys={["creator_brand_route_distribution", "partner_basic", "partner_pro"]}
            previewItems={["Partner-Highlight", "Creator-Serie", "Featured Route"]}
            citySlug={profileMonetizationCitySlug}
            creatorProfileId={profile.id ?? null}
            livePreview
            ctaSource="internal_creator_profile_distribution_pilot"
          />
          <MonetizationDebugPanel
            enabled={monetizationDebug}
            surface="creator_profile"
            creatorProfileId={profile.id ?? null}
            citySlug={profileMonetizationCitySlug}
            title="Profil Monetization Debug"
          />
        </div>
      ) : null}
      <div className="mb-6 flex flex-wrap gap-4 text-sm">
        <Link href="/explore" className="underline underline-offset-4">
          ← Zurück zu Explore
        </Link>
        <Link href="/" className="underline underline-offset-4">
          Zum Planner
        </Link>
      </div>

      <section className="overflow-hidden rounded-[var(--radius-hero)] border border-black/10 bg-white shadow-sm">
        <div className="relative min-h-[260px] overflow-hidden bg-gradient-to-br from-stone-100 via-white to-neutral-200">
          {profile.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.cover_image_url}
              alt={displayName}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />

          <div className="relative flex min-h-[260px] flex-col justify-between p-6 md:p-8">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs text-white backdrop-blur">
                {niceCreatorType(profile.creator_type)}
              </span>
              {profile.home_city_slug ? (
                <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs text-white backdrop-blur">
                  {homeCityLabel}
                </span>
              ) : null}
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
              <div className="flex items-end gap-5">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-3xl border border-white/30 bg-white/10 shadow-lg backdrop-blur sm:h-28 sm:w-28">
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt={displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-medium text-white/80">
                      {displayName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    {displayName}
                  </h1>
                  <div className="mt-2 text-sm text-white/85">@{profile.username}</div>
                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/90">
                    {profile.bio?.trim() || "Dieses Profil teilt öffentliche PerfectDay24-Routen und Ideen für gemeinsame Erlebnisse."}
                  </p>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/20 bg-white/12 p-5 text-white backdrop-blur">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-white/15 bg-black/10 p-3">
                    <div className="text-xs text-white/70">Routen</div>
                    <div className="mt-1 text-2xl font-semibold">{compactNumber(profile.route_count)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-black/10 p-3">
                    <div className="text-xs text-white/70">Follower</div>
                    <div className="mt-1 text-2xl font-semibold">{compactNumber(profile.follower_count)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-black/10 p-3">
                    <div className="text-xs text-white/70">Likes</div>
                    <div className="mt-1 text-2xl font-semibold">{compactNumber(profile.total_likes_received)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-black/10 p-3">
                    <div className="text-xs text-white/70">Bookmarks</div>
                    <div className="mt-1 text-2xl font-semibold">{compactNumber(profile.total_bookmarks_received)}</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleFollow()}
                    disabled={!authReady || !userId || followBusy || profile.user_id === userId}
                    className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {profile.user_id === userId
                      ? "Dein Profil"
                      : followBusy
                        ? "..."
                        : isFollowing
                          ? "Folge ich"
                          : "Folgen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleFriend()}
                    disabled={!authReady || !userId || friendBusy || profile.user_id === userId}
                    className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {profile.user_id === userId
                      ? "Dein Profil"
                      : friendBusy
                        ? "..."
                        : isFriend
                          ? "Freund entfernen"
                          : "Als Freund hinzufügen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void addProfileToPlanner()}
                    className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
                  >
                    In Planner übernehmen
                  </button>
                  {isFriend ? (
                    <Link
                      href={`/chat?user=${profile.user_id}`}
                      className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
                    >
                      Nachricht
                    </Link>
                  ) : null}
                  <Link
                    href="/invite"
                    className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
                  >
                    Zur Gruppensuche
                  </Link>
                  <Link
                    href="/"
                    className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
                  >
                    Planner öffnen
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_2.05fr]">
        <aside>
          <section className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-950">Profil</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-600">
              <div className="rounded-2xl border border-black/5 bg-gray-50 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-400">Typ</div>
                <div className="mt-1 font-medium text-gray-900">{niceCreatorType(profile.creator_type)}</div>
              </div>
              <div className="rounded-2xl border border-black/5 bg-gray-50 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-400">Mitglied seit</div>
                <div className="mt-1 font-medium text-gray-900">{formatDate(profile.created_at)}</div>
              </div>
            </div>
          </section>
        </aside>

        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <h2 className="text-2xl font-semibold text-gray-950">Öffentliche Routen</h2>
            <p className="mt-1 text-sm text-gray-600">
              Öffentliche Routen dieses Profils mit Bild, kurzer Zusammenfassung und Mini-Karte.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
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
          </div>

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

          <div
            className={`inline-flex w-fit rounded-full px-3 py-1 text-[11px] font-medium ${
              personalizedSort
                ? "bg-black text-white"
                : "border border-black/10 bg-white text-gray-700"
            }`}
          >
            {personalizedSort ? "Aktuell personalisiert" : "Aktuell allgemein sortiert"}
          </div>

          <div className="-mt-2 text-xs text-gray-500">
            {myInterests.length > 0
              ? "Persönliche Reihenfolge nutzt deine gespeicherten Interessen."
              : "Lege Interessen im Profil an, um persönliche Sortierung zu aktivieren."}
          </div>
          <div className="-mt-2 text-xs text-gray-500">
            {variantFilter === "all"
              ? "Zeigt Originale und Varianten gemeinsam."
              : variantFilter === "original"
                ? "Aktuell nur Basisrouten dieses Profils."
                : "Aktuell nur personalisierte oder abgeleitete Varianten."}
          </div>

          {sortedRoutes.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {sortedRoutes.map((route) => (
                <PublicRouteCard
                  key={route.id}
                  route={route}
                  cityMap={cityMap}
                  reason={explainInterestMatch(route, myInterests, { terse: true })}
                  reasonBadges={buildInterestReasonBadges(route, myInterests)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] border border-black/10 bg-white p-8 shadow-sm">
              <div className="inline-flex rounded-full border border-black/10 bg-gray-50 px-3 py-1 text-xs text-gray-600">
                Noch leer
              </div>
              <h3 className="mt-4 text-xl font-semibold text-gray-950">Noch keine öffentlichen Routen</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Dieses Profil hat aktuell keine öffentlichen Routen veröffentlicht.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function PublicUserProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-7xl px-1 py-4 sm:px-2 lg:px-4">
          <div className="pd24-shell p-6 text-sm text-[var(--text-muted)]">
            Profil wird geladen...
          </div>
        </main>
      }
    >
      <PublicUserProfilePageContent />
    </Suspense>
  );
}
