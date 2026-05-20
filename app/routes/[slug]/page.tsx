// app/routes/[slug]/page.tsx
"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import TrackOnMount from "@/components/monetization/TrackOnMount";
import MonetizedExternalLink from "@/components/monetization/MonetizedExternalLink";
import InternalMonetizationSlot from "@/components/monetization/InternalMonetizationSlot";
import MonetizationDebugPanel from "@/components/monetization/MonetizationDebugPanel";
import { trackMonetizationEvent } from "@/lib/monetization/client";
import { resolvePublicAffiliateLinksClient } from "@/lib/monetization/public-affiliate-client";
import {
  emptyPublicAffiliateResolution,
  type PublicAffiliateResolution,
} from "@/lib/monetization/affiliate-shared";
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
import { writePlannerRouteTemplate, writeRouteBuilderDraft } from "@/lib/routes/planner-route-bridge";
import { readRouteRunProgress } from "@/lib/routes/route-run-progress";
import {
  buildInterestReasonBadges,
  explainInterestMatch,
  normalizeStringList,
  scoreRouteAgainstInterests,
} from "@/lib/routes/recommendation-reasons";
import {
  buildSwapCandidates,
  inferPersonalizationKind,
  isFoodLikeStop,
  type PersonalizationKind,
  type PersonalizationLocation,
} from "@/lib/routes/personalize-creator-route";
import { shouldShowInternalMonetization } from "@/lib/monetization/debug";
import { renderableImageUrl } from "@/lib/renderable-image-url";
import ImageAttribution from "@/components/ImageAttribution";

import type { RouteSummary } from "@/components/PlanMap";
const PlanMap = dynamic(() => import("@/components/PlanMap").then((m) => m.default), {
  ssr: false,
});

function PlayPauseIcon({ isPaused = false }: { isPaused?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      {isPaused ? (
        <>
          <rect x="7" y="5" width="3.2" height="14" rx="1.2" fill="currentColor" />
          <rect x="13.8" y="5" width="3.2" height="14" rx="1.2" fill="currentColor" />
        </>
      ) : (
        <path d="M8 5.8c0-1.05 1.14-1.72 2.06-1.2l9.2 5.25c.92.52.92 1.85 0 2.37l-9.2 5.25C9.14 18 8 17.33 8 16.28V5.8Z" fill="currentColor" />
      )}
    </svg>
  );
}

function CopyRouteIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <rect x="7.5" y="4" width="11" height="11" rx="2.4" className="fill-current opacity-35" />
      <rect x="4.5" y="7.5" width="12" height="12" rx="2.6" fill="currentColor" />
    </svg>
  );
}

function SliderRouteIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M5 6h14" />
      <path d="M5 12h14" />
      <path d="M5 18h14" />
      <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

type UserRouteRow = {
  id: string;
  user_id: string;
  creator_profile_id?: string | null;
  city_slug: string | null;
  title: string;
  slug: string | null;
  description: string | null;
  cover_image_url: string | null;
  start_label: string | null;
  start_type: string | null;
  start_lat: number | null;
  start_lng: number | null;
  visibility: "private" | "unlisted" | "public";
  creator_type: "user" | "creator" | "influencer" | "brand";
  is_featured: boolean;
  avg_rating: number;
  rating_count: number;
  bookmark_count: number;
  like_count: number;
  tags?: unknown;
  meta?: unknown;
  created_at: string;
  updated_at: string;
};

type RouteStopRow = {
  id: string;
  route_id: string;
  stop_order: number;
  location_id: string | null;
  title: string | null;
  note: string | null;
  external_url: string | null;
  is_required: boolean;
  duration_min: number | null;
  lat: number | null;
  lng: number | null;
  photo_url: string | null;
  meta?: unknown;
  created_at: string;
};

type RouteBookmarkRow = {
  id: string;
  route_id: string;
  user_id: string;
};

type RouteRatingRow = {
  id: string;
  route_id: string;
  user_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  updated_at: string;
};

type CreatorProfileRow = {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  creator_type: "user" | "creator" | "influencer" | "brand" | "editorial" | null;
};

type ProfileRow = {
  user_id: string;
  interests: unknown;
};

type CityRow = CityLookupRow;

type GroupMember = {
  id: string;
  name: string;
  interests: string[];
  profileUserId?: string | null;
  profileHandle?: string | null;
};

type SuggestedRoute = {
  route: UserRouteRow;
  reason?: string | null;
  reasonBadges?: string[];
};

type RouteLocationRow = PersonalizationLocation;

type InlineSwapCandidate = {
  location_id: string | null;
  title: string;
  subtitle: string;
  note?: string;
  external_url: string;
  lat: string;
  lng: string;
  photo_url?: string;
};

const GROUP_INVITE_STORAGE_KEY = "pd24_group_invites";

function routeHref(route: Pick<UserRouteRow, "slug" | "title">) {
  if (route.slug) return `/routes/${route.slug}`;
  return null;
}

function inferTemplateInterests(route: UserRouteRow) {
  const tags = Array.isArray(route.tags)
    ? route.tags.filter((value): value is string => typeof value === "string")
    : [];
  const meta = route.meta && typeof route.meta === "object" ? (route.meta as Record<string, unknown>) : {};
  const routeTags = Array.isArray(meta.routeTags)
    ? meta.routeTags.filter((value): value is string => typeof value === "string")
    : [];

  return Array.from(
    new Set(
      [...tags, ...routeTags]
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value && !["date", "family", "friends", "tourism", "party", "foot", "car", "food", "culture", "outdoor", "nightlife", "mixed"].includes(value))
    )
  ).slice(0, 8);
}

function inferTemplateExperienceMode(route: UserRouteRow) {
  const tags = Array.isArray(route.tags)
    ? route.tags.filter((value): value is string => typeof value === "string")
    : [];
  const meta = route.meta && typeof route.meta === "object" ? (route.meta as Record<string, unknown>) : {};
  const routeTags = Array.isArray(meta.routeTags)
    ? meta.routeTags.filter((value): value is string => typeof value === "string")
    : [];
  const text = [
    route.title,
    route.description,
    meta.occasion,
    meta.routeTheme,
    ...tags,
    ...routeTags,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (/(markt|market|festival|kirmes|volksfest|fruehlingsfest|frühlingsfest|street\s*food)/.test(text)) {
    return "market_festival" as const;
  }

  if (/(konzert|concert|theater|show|buehne|bühne|ticket|comedy|cabaret)/.test(text)) {
    return "show" as const;
  }

  if (/(jga|junggesell|bachelor|bachelorette|party|nightlife|bar|club|beer|bier)/.test(text)) {
    return "event_visit" as const;
  }

  return null;
}

function currentStopCandidate(stop: RouteStopRow): InlineSwapCandidate {
  return {
    location_id: stop.location_id,
    title: stop.title || `Stop ${stop.stop_order}`,
    subtitle: "Originaler Stop",
    note: stop.note ?? "",
    external_url: stop.external_url ?? "",
    lat: stop.lat != null ? String(stop.lat) : "",
    lng: stop.lng != null ? String(stop.lng) : "",
    photo_url: stop.photo_url ?? "",
  };
}

function reasonTextForKind(kind: PersonalizationKind) {
  if (kind === "food_swap") return "Dieser Stop kann bei der Personalisierung gegen passendere Restaurants oder Food-Optionen ausgetauscht werden.";
  if (kind === "activity_swap") return "Dieser Stop kann gegen passendere Aktivitäten oder kulturelle Highlights für eure Interessen ausgetauscht werden.";
  if (kind === "nightlife_swap") return "Dieser Stop kann gegen passendere Bars, Lounges oder Nightlife-Optionen ausgetauscht werden.";
  if (kind === "ambience_swap") return "Dieser Stop kann gegen passendere View-, Park- oder Scenic-Optionen ausgetauscht werden.";
  return "Dieser Stop bleibt als Kernbestandteil der Route erhalten, damit Highlights und Flow stabil bleiben.";
}

function kindLabel(kind: PersonalizationKind) {
  if (kind === "food_swap") return "Food";
  if (kind === "activity_swap") return "Aktivität";
  if (kind === "nightlife_swap") return "Nightlife";
  if (kind === "ambience_swap") return "Ambiente";
  return "Fixiert";
}

function kindTone(kind: PersonalizationKind) {
  if (kind === "food_swap") return "bg-amber-100 text-amber-800";
  if (kind === "activity_swap") return "bg-sky-100 text-sky-800";
  if (kind === "nightlife_swap") return "bg-fuchsia-100 text-fuchsia-800";
  if (kind === "ambience_swap") return "bg-teal-100 text-teal-800";
  return "bg-emerald-100 text-emerald-800";
}

function SuggestionCard({
  route,
  cityMap,
  eyebrow,
  reason,
  reasonBadges,
}: {
  route: UserRouteRow;
  cityMap: Map<string, CityLookupRow>;
  eyebrow: string;
  reason?: string | null;
  reasonBadges?: string[];
}) {
  const href = routeHref(route);
  const badges = inferPublicRouteBadges(route).slice(0, 3);
  const meta = route.meta && typeof route.meta === "object" ? (route.meta as Record<string, unknown>) : {};
  const durationBadge = durationBucketLabel(meta.durationBucket);

  const cityLabel = formatCityWithCountry(route.city_slug, cityMap);
  const coverImageUrl = renderableImageUrl(route.cover_image_url);

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="relative h-36 bg-gradient-to-br from-stone-100 via-white to-stone-200">
        {coverImageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverImageUrl} alt={route.title} className="h-full w-full object-cover" />
            <ImageAttribution
              meta={route.meta}
              compact
              tone="dark"
              className="absolute inset-x-3 bottom-3 truncate rounded-full bg-black/55 px-3 py-1 backdrop-blur"
            />
          </>
        ) : null}
      </div>
      <div className="space-y-3 p-4">
        <div className="text-[11px] uppercase tracking-wide text-gray-400">{eyebrow}</div>
        <div className="text-lg font-semibold text-gray-950 line-clamp-2">{route.title}</div>
        {route.description ? (
          <p className="text-sm text-gray-600 line-clamp-2">{route.description}</p>
        ) : null}
        <RecommendationReason reason={reason} reasonBadges={reasonBadges} />
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border px-2 py-1 text-[11px] text-gray-700">{cityLabel}</span>
          {durationBadge ? (
            <span className="rounded-full border px-2 py-1 text-[11px] text-gray-700">{durationBadge}</span>
          ) : null}
          {badges.map((badge, badgeIndex) => (
            <span
              key={`${route.id}-${badge.label}-${badgeIndex}`}
              className={`rounded-full px-2 py-1 text-[11px] ${
                badge.tone === "dark"
                  ? "bg-black text-white"
                  : badge.tone === "soft"
                    ? "border border-black/10 bg-stone-100 text-gray-700"
                    : "border bg-white text-gray-700"
              }`}
            >
              {badge.label}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
          <span>{route.avg_rating} / 5</span>
          <span>{route.like_count} Likes</span>
          <span>{route.bookmark_count} Saves</span>
        </div>
        {href ? (
          <Link href={href} className="inline-flex rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">
            Route öffnen
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function toRad(v: number) {
  return (v * Math.PI) / 180;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(aLat)) *
      Math.cos(toRad(bLat)) *
      (Math.sin(dLng / 2) * Math.sin(dLng / 2));
  const c = 2 * Math.atan2(Math.sqrt(s1), Math.sqrt(1 - s1));
  return R * c;
}

function estimateTravelMinForRouteProfile(distanceKm: number | null, profile: "foot" | "car") {
  if (distanceKm == null) return null;
  if (profile === "foot") {
    return Math.max(5, Math.round(distanceKm * 10));
  }
  return Math.max(6, Math.round(distanceKm * 2.6 + 4));
}

function routeSummaryLooksPlausible(summary: RouteSummary | null, profile: "foot" | "car") {
  if (!summary) return false;
  if (profile !== "foot") return true;
  if (summary.totalDistanceKm <= 0 || summary.totalDurationMin <= 0) return false;
  const speedKmh = summary.totalDistanceKm / (summary.totalDurationMin / 60);
  return speedKmh <= 7.5;
}

function formatSupabaseError(error: unknown) {
  if (error == null) return "null";
  if (typeof error === "string") return error;
  if (error instanceof Error) {
    return JSON.stringify(
      {
        name: error.name,
        message: error.message,
        stack: error.stack ?? null,
      },
      null,
      2
    );
  }
  if (typeof error !== "object") return String(error);

  const record = error as Record<string, unknown>;
  const ownKeys = Object.getOwnPropertyNames(error);
  const serialized: Record<string, unknown> = {};

  for (const key of ownKeys) {
    serialized[key] = record[key];
  }

  try {
    return JSON.stringify(serialized, null, 2);
  } catch {
    return `[unserializable error object: ${ownKeys.join(", ")}]`;
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "unbekannter Fehler";
}

function summarizeErrorForUi(error: unknown) {
  const message = getErrorMessage(error);
  if (message !== "unbekannter Fehler") return message;

  const formatted = formatSupabaseError(error).replace(/\s+/g, " ").trim();
  if (!formatted || formatted === "{}") return "unbekannter Fehler";
  return formatted.slice(0, 180);
}

function buildGoogleMapsDirUrl(points: Array<{ lat: number; lng: number }>, mode: "foot" | "car") {
  if (points.length < 2) return null;

  const origin = `${points[0].lat},${points[0].lng}`;
  const destination = `${points[points.length - 1].lat},${points[points.length - 1].lng}`;

  const waypoints =
    points.length > 2
      ? points
          .slice(1, -1)
          .map((p) => `${p.lat},${p.lng}`)
          .join("|")
      : "";

  const travelmode = mode === "foot" ? "walking" : "driving";

  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("travelmode", travelmode);
  if (waypoints) url.searchParams.set("waypoints", waypoints);

  return url.toString();
}

function niceCreatorType(v: UserRouteRow["creator_type"]) {
  if (v === "influencer") return "Influencer";
  if (v === "creator") return "Creator";
  if (v === "brand") return "Brand";
  return "User";
}

function creatorHref(creator: CreatorProfileRow | null | undefined) {
  if (!creator?.username) return null;
  return `/u/${creator.username}`;
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

function compactCount(value: number | null | undefined) {
  return new Intl.NumberFormat("de-DE", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value ?? 0);
}

function compactRating(value: number | null | undefined) {
  const rating = Number.isFinite(value ?? Number.NaN) ? value ?? 0 : 0;
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 1,
  }).format(rating);
}

function visibilityLabel(v: UserRouteRow["visibility"]) {
  if (v === "public") return "Öffentlich";
  if (v === "unlisted") return "Nicht gelistet";
  return "Privat";
}

function durationBucketLabel(value: unknown) {
  if (value === "short") return "Kurz";
  if (value === "halfday") return "Halbtag";
  if (value === "extended") return "Extended";
  if (value === "fullday") return "Ganztägig";
  return null;
}

function niceStartType(v: string | null) {
  if (v === "hotel") return "Hotel";
  if (v === "station") return "Bahnhof";
  if (v === "airport") return "Flughafen";
  if (v === "other") return "Sonstiges";
  return "Adresse";
}

function RouteDetailPageContent() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [route, setRoute] = useState<UserRouteRow | null>(null);
  const [stops, setStops] = useState<RouteStopRow[]>([]);
  const [creator, setCreator] = useState<CreatorProfileRow | null>(null);
  const [moreFromCreator, setMoreFromCreator] = useState<UserRouteRow[]>([]);
  const [similarRoutes, setSimilarRoutes] = useState<UserRouteRow[]>([]);
  const [variantBaseRoute, setVariantBaseRoute] = useState<UserRouteRow | null>(null);
  const [relatedVariants, setRelatedVariants] = useState<UserRouteRow[]>([]);
  const [familyVariantFilter, setFamilyVariantFilter] = useState<VariantFilter>("all");
  const [familyVariantSort, setFamilyVariantSort] = useState<VariantSort>("default");
  const [interestMatchedRoutes, setInterestMatchedRoutes] = useState<SuggestedRoute[]>([]);
  const [coSavedRoutes, setCoSavedRoutes] = useState<SuggestedRoute[]>([]);
  const [myInterests, setMyInterests] = useState<string[]>([]);
  const [groupInterests, setGroupInterests] = useState<string[]>([]);
  const [groupMemberCount, setGroupMemberCount] = useState(0);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [cities, setCities] = useState<CityRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [stopsLoading, setStopsLoading] = useState(true);
  const [slowLoad, setSlowLoad] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [routeProfile, setRouteProfile] = useState<"foot" | "car">("foot");
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);

  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [myRating, setMyRating] = useState<number>(0);
  const [myReview, setMyReview] = useState("");
  const [savingRating, setSavingRating] = useState(false);
  const [busyLike, setBusyLike] = useState(false);
  const [busyBookmark, setBusyBookmark] = useState(false);
  const [plannerTemplateQueued, setPlannerTemplateQueued] = useState(false);
  const [hasRouteRunProgress, setHasRouteRunProgress] = useState(false);
  const [routeInfoOpen, setRouteInfoOpen] = useState(false);
  const [inlineSwapCandidates, setInlineSwapCandidates] = useState<Record<string, InlineSwapCandidate[]>>({});
  const [inlineSwapIndex, setInlineSwapIndex] = useState<Record<string, number>>({});
  const [inlineSwapLoading, setInlineSwapLoading] = useState(false);
  const [affiliateResolution, setAffiliateResolution] = useState<PublicAffiliateResolution>(
    emptyPublicAffiliateResolution()
  );
  const effectivePersonalizationInterests = useMemo(
    () => Array.from(new Set([...myInterests, ...groupInterests])),
    [myInterests, groupInterests]
  );
  const monetizationDebug = useMemo(
    () => shouldShowInternalMonetization(searchParams.get("monetization")),
    [searchParams]
  );

  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  async function handoffRouteToPlanner() {
    if (!route) return;

    const meta = route.meta && typeof route.meta === "object" ? (route.meta as Record<string, unknown>) : {};
    const occasion =
      meta.occasion === "date" ||
      meta.occasion === "family" ||
      meta.occasion === "friends" ||
      meta.occasion === "tourism" ||
      meta.occasion === "party"
        ? meta.occasion
        : null;
    const profile = meta.routeProfile === "foot" || meta.routeProfile === "car" ? meta.routeProfile : null;

    writePlannerRouteTemplate({
      title: route.title,
      citySlug: route.city_slug,
      occasion,
      experienceMode: inferTemplateExperienceMode(route),
      routeProfile: profile,
      interests: inferTemplateInterests(route),
      sourceRouteTitle: route.title,
      startPoint:
        route.start_lat != null && route.start_lng != null
          ? {
              mode: "custom",
              type:
                route.start_type === "hotel" ||
                route.start_type === "station" ||
                route.start_type === "airport" ||
                route.start_type === "other"
                  ? route.start_type
                  : "address",
              label: route.start_label ?? route.title,
              lat: route.start_lat,
              lng: route.start_lng,
            }
          : null,
      sourceRouteId: route.id,
      sourceRouteSlug: route.slug,
    });

    await trackMonetizationEvent({
      eventType: "route_copy",
      userId,
      routeId: route.id,
      creatorProfileId: route.creator_profile_id ?? creator?.id ?? null,
      citySlug: route.city_slug ?? null,
      surface: "route_detail",
      metadata: {
        target: "planner_template",
        sourceRouteSlug: route.slug ?? null,
      },
    });
    setPlannerTemplateQueued(true);
    window.location.href = "/planner";
  }

  async function personalizeRouteForInterests() {
    if (!route) return;
    if (!route.city_slug) {
      showToast("Für diese Route fehlt die Stadtzuordnung.");
      return;
    }
    if (effectivePersonalizationInterests.length === 0) {
      showToast("Speichere zuerst Interessen in deinem Profil oder füge Gruppenmitglieder hinzu, damit wir Stops anpassen können.");
      return;
    }
    if (!stops.length) {
      showToast("Diese Route hat noch keine Stops.");
      return;
    }

    const linkedLocationIds = Array.from(new Set(stops.map((stop) => stop.location_id).filter(Boolean) as string[]));

    let linkedLocations = new Map<string, RouteLocationRow>();
    if (linkedLocationIds.length > 0) {
      const { data, error } = await supabase
        .from("locations")
        .select("id,name,type,category,meal,lat,lng,reservation_url,tags,subtypes,city_slug")
        .in("id", linkedLocationIds);

      if (error) {
        console.error("Linked route locations load error:", error);
      } else {
        linkedLocations = new Map(((data as RouteLocationRow[]) ?? []).map((loc) => [loc.id, loc]));
      }
    }

    const { data: candidateRows, error: candidateError } = await supabase
      .from("locations")
      .select("id,name,type,category,meal,lat,lng,reservation_url,tags,subtypes,city_slug")
      .eq("city_slug", route.city_slug)
      .limit(250);

    if (candidateError) {
      console.error("Food candidate locations load error:", candidateError);
      showToast("Passende Alternativen konnten gerade nicht geladen werden.");
      return;
    }

    const candidates = ((candidateRows as RouteLocationRow[]) ?? []).filter((candidate) =>
      isFoodLikeStop({ title: candidate.name, note: candidate.type, location: candidate })
    );

    const meta = route.meta && typeof route.meta === "object" ? (route.meta as Record<string, unknown>) : {};
    const occasion =
      meta.occasion === "date" ||
      meta.occasion === "family" ||
      meta.occasion === "friends" ||
      meta.occasion === "tourism" ||
      meta.occasion === "party"
        ? meta.occasion
        : "none";
    const routeProfileMode = meta.routeProfile === "foot" || meta.routeProfile === "car" ? meta.routeProfile : "none";
    const routeTheme =
      meta.primaryTheme === "food" ||
      meta.primaryTheme === "culture" ||
      meta.primaryTheme === "outdoor" ||
      meta.primaryTheme === "nightlife" ||
      meta.primaryTheme === "mixed"
        ? meta.primaryTheme
        : "mixed";
    const routeTags = Array.isArray(route.tags) ? route.tags.filter((value): value is string => typeof value === "string") : [];

    writeRouteBuilderDraft({
      title: `${route.title} – persönliche Variante`,
      description: route.description ?? null,
      citySlug: route.city_slug,
      coverImageUrl: route.cover_image_url ?? null,
      routeOccasion: occasion,
      routeProfileMode,
      routeTheme,
      routeTags,
      startType:
        route.start_type === "hotel" ||
        route.start_type === "station" ||
        route.start_type === "airport" ||
        route.start_type === "other"
          ? route.start_type
          : "address",
      startLabel: route.start_label ?? null,
      startLat: route.start_lat != null ? String(route.start_lat) : null,
      startLng: route.start_lng != null ? String(route.start_lng) : null,
      sourcePlanTitle: route.title,
      sourceKind: "personalized_route",
      sourceGroupLabel: groupMemberCount > 0 ? `${groupMemberCount + 1} Personen` : "Für dich",
      sourceRouteId: route.id,
      sourceRouteSlug: route.slug,
      sourceRouteTitle: route.title,
      sourceInterests: effectivePersonalizationInterests,
      sourceMembers: [
        ...(myInterests.length > 0 ? [{ name: "Du", interests: myInterests, isCurrentUser: true }] : []),
        ...groupMembers.map((member) => ({
          name: member.name,
          interests: member.interests,
          isCurrentUser: false,
        })),
      ],
      draftStops: stops.map((stop) => {
        const linkedLocation = stop.location_id ? linkedLocations.get(stop.location_id) ?? null : null;
        const kind = inferPersonalizationKind({
          title: stop.title,
          note: stop.note,
          location: linkedLocation,
        });
        const swappable = kind !== "fixed";
        const inlineCandidates = inlineSwapCandidates[stop.id] ?? [];
        const selectedIndex = inlineSwapIndex[stop.id] ?? 0;
        const selectedCandidate = inlineCandidates[selectedIndex] ?? inlineCandidates[0] ?? null;
        const computedSwapCandidates = swappable
          ? buildSwapCandidates({
              candidates,
              interests: effectivePersonalizationInterests,
              currentLocationId: stop.location_id,
              kind,
            }).map((candidate) => ({
              location_id: candidate.id,
              title: candidate.name,
              subtitle: [candidate.type, candidate.category, candidate.meal].filter(Boolean).join(" | ") || "Alternative",
              note: `Alternative passend zu ${groupMemberCount > 0 ? "euren" : "deinen"} Vorlieben: ${[candidate.type, candidate.category, candidate.meal].filter(Boolean).join(" · ") || candidate.name}`,
              external_url: candidate.reservation_url ?? "",
              lat: candidate.lat != null ? String(candidate.lat) : "",
              lng: candidate.lng != null ? String(candidate.lng) : "",
              photo_url: "",
            }))
          : [];
        const swapCandidates = inlineCandidates.length > 0 ? inlineCandidates.slice(1) : computedSwapCandidates;
        const chosenCandidate = swappable && selectedCandidate ? selectedCandidate : null;

        return {
          location_id: chosenCandidate ? chosenCandidate.location_id : stop.location_id,
          title: chosenCandidate ? chosenCandidate.title : stop.title || `Stop ${stop.stop_order}`,
          subtitle: swappable
            ? `${kindLabel(kind)}-Stop · personalisiert`
            : "Hotspot · aus der Originalroute fixiert",
          note: stop.note ?? "",
          external_url: chosenCandidate ? chosenCandidate.external_url : stop.external_url ?? "",
          is_required: stop.is_required,
          duration_min: stop.duration_min != null ? String(stop.duration_min) : "",
          lat:
            chosenCandidate
              ? chosenCandidate.lat
              : stop.lat != null
                ? String(stop.lat)
                : "",
          lng:
            chosenCandidate
              ? chosenCandidate.lng
              : stop.lng != null
                ? String(stop.lng)
                : "",
          photo_url: stop.photo_url ?? "",
          isLocked: !swappable,
          personalizationKind: swappable ? kind : ("fixed" as const),
          originalTitle: stop.title ?? null,
          originalStop: currentStopCandidate(stop),
          swapCandidates,
        };
      }),
    });

    await trackMonetizationEvent({
      eventType: "route_copy",
      userId,
      routeId: route.id,
      creatorProfileId: route.creator_profile_id ?? creator?.id ?? null,
      citySlug: route.city_slug ?? null,
      surface: "route_detail",
      metadata: {
        target: "personalized_route",
        sourceRouteSlug: route.slug ?? null,
        groupMemberCount,
        interests: effectivePersonalizationInterests,
      },
    });
    window.location.href = "/routes";
  }

  function cycleInlineCandidate(stopId: string, direction: "prev" | "next") {
    setInlineSwapIndex((prev) => {
      const candidates = inlineSwapCandidates[stopId] ?? [];
      if (candidates.length <= 1) return prev;
      const current = prev[stopId] ?? 0;
      const next =
        direction === "next"
          ? (current + 1) % candidates.length
          : (current - 1 + candidates.length) % candidates.length;
      return { ...prev, [stopId]: next };
    });
  }

  useEffect(() => {
    if (!route?.city_slug || effectivePersonalizationInterests.length === 0 || stops.length === 0) {
      setInlineSwapCandidates({});
      setInlineSwapIndex({});
      return;
    }

    let active = true;

    (async () => {
      setInlineSwapLoading(true);
      try {
        const linkedLocationIds = Array.from(new Set(stops.map((stop) => stop.location_id).filter(Boolean) as string[]));

        let linkedLocations = new Map<string, RouteLocationRow>();
        if (linkedLocationIds.length > 0) {
          const { data, error } = await supabase
            .from("locations")
            .select("id,name,type,category,meal,lat,lng,reservation_url,tags,subtypes,city_slug")
            .in("id", linkedLocationIds);

          if (!active) return;
          if (!error) {
            linkedLocations = new Map(((data as RouteLocationRow[]) ?? []).map((loc) => [loc.id, loc]));
          }
        }

        const { data: candidateRows, error: candidateError } = await supabase
          .from("locations")
          .select("id,name,type,category,meal,lat,lng,reservation_url,tags,subtypes,city_slug")
          .eq("city_slug", route.city_slug)
          .limit(250);

        if (!active) return;
        if (candidateError) {
          console.error("Inline food candidate locations load error:", candidateError);
          setInlineSwapCandidates({});
          setInlineSwapIndex({});
          return;
        }

        const candidates = ((candidateRows as RouteLocationRow[]) ?? []).filter((candidate) =>
          isFoodLikeStop({ title: candidate.name, note: candidate.type, location: candidate })
        );

        const nextCandidates: Record<string, InlineSwapCandidate[]> = {};
        const nextIndexes: Record<string, number> = {};

        for (const stop of stops) {
          const linkedLocation = stop.location_id ? linkedLocations.get(stop.location_id) ?? null : null;
          const kind = inferPersonalizationKind({
            title: stop.title,
            note: stop.note,
            location: linkedLocation,
          });
          if (kind === "fixed") continue;

          const alternatives = buildSwapCandidates({
            candidates,
            interests: effectivePersonalizationInterests,
            currentLocationId: stop.location_id,
            kind,
          }).map((candidate) => ({
            location_id: candidate.id,
            title: candidate.name,
            subtitle: [candidate.type, candidate.category, candidate.meal].filter(Boolean).join(" | ") || "Alternative",
            note: `Alternative passend zu ${groupMemberCount > 0 ? "euren" : "deinen"} Vorlieben: ${[candidate.type, candidate.category, candidate.meal].filter(Boolean).join(" · ") || candidate.name}`,
            external_url: candidate.reservation_url ?? "",
            lat: candidate.lat != null ? String(candidate.lat) : "",
            lng: candidate.lng != null ? String(candidate.lng) : "",
            photo_url: "",
          }));

          nextCandidates[stop.id] = [currentStopCandidate(stop), ...alternatives];
          nextIndexes[stop.id] = 0;
        }

        setInlineSwapCandidates(nextCandidates);
        setInlineSwapIndex(nextIndexes);
      } finally {
        if (active) setInlineSwapLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [route?.city_slug, stops, effectivePersonalizationInterests, groupMemberCount]);

  useEffect(() => {
    let active = true;

    const locationIds = Array.from(
      new Set(
        stops
          .map((stop) => stop.location_id)
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      )
    );
    const routeIds = route?.id ? [route.id] : [];

    if (locationIds.length === 0 && routeIds.length === 0) {
      setAffiliateResolution(emptyPublicAffiliateResolution());
      return () => {
        active = false;
      };
    }

    (async () => {
      try {
        const resolution = await resolvePublicAffiliateLinksClient({
          locationIds,
          routeIds,
        });
        if (!active) return;
        setAffiliateResolution(resolution);
      } catch (error) {
        console.error("Route affiliate resolution failed:", error);
        if (!active) return;
        setAffiliateResolution(emptyPublicAffiliateResolution());
      }
    })();

    return () => {
      active = false;
    };
  }, [route?.id, stops]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const { data: s, error: sErr } = await supabase.auth.getSession();
        if (sErr) console.error("getSession error:", sErr);
        if (!active) return;
        setUserId(s.session?.user?.id ?? null);
        setAuthReady(true);
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

  async function continueAsGuest() {
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error("Anonymous auth error:", error);
        showToast(`Gastzugang fehlgeschlagen: ${error.message}`);
        return;
      }

      setUserId(data.user?.id ?? null);
      setAuthReady(true);
      showToast("Gastzugang aktiviert.");
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    try {
      const v = localStorage.getItem("pd24_route_profile");
      if (v === "foot" || v === "car") setRouteProfile(v);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("pd24_route_profile", routeProfile);
    } catch {}
  }, [routeProfile]);

  useEffect(() => {
    if (!slug) return;

    (async () => {
      setLoading(true);
      setNotFound(false);

      try {
        const { data, error } = await supabase
          .from("user_routes")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();

        if (error) {
          console.error("Route load error:", error);
          setRoute(null);
          setNotFound(true);
          return;
        }

        if (!data) {
          setRoute(null);
          setNotFound(true);
          return;
        }

        setRoute(data as UserRouteRow);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  useEffect(() => {
    if (!loading) {
      setSlowLoad(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setSlowLoad(true);
    }, 2200);

    return () => window.clearTimeout(timeout);
  }, [loading]);

  useEffect(() => {
    const meta = route?.meta && typeof route.meta === "object" ? (route.meta as Record<string, unknown>) : {};
    if (meta.routeProfile === "foot" || meta.routeProfile === "car") {
      setRouteProfile(meta.routeProfile);
    }
  }, [route?.id, route?.meta]);

  useEffect(() => {
    if (!route?.id) return;

    (async () => {
      setStopsLoading(true);
      try {
        const { data, error } = await supabase
          .from("user_route_stops")
          .select("*")
          .eq("route_id", route.id)
          .order("stop_order", { ascending: true });

        if (error) {
          console.error("Stops load error:", error);
          setStops([]);
          return;
        }

        setStops((data as RouteStopRow[]) ?? []);
      } finally {
        setStopsLoading(false);
      }
    })();
  }, [route?.id]);

  useEffect(() => {
    if (!route?.id) {
      setHasRouteRunProgress(false);
      return;
    }
    const persisted = readRouteRunProgress(route.id, route.slug);
    const hasProgress =
      Boolean(persisted) &&
      Object.values(persisted?.stopStates ?? {}).some((state) => state === "done" || state === "skipped");
    setHasRouteRunProgress(hasProgress);
  }, [route?.id, route?.slug, stops.length]);

  useEffect(() => {
    if (!route?.user_id) return;

    (async () => {
      const { data, error } = await supabase
        .from("creator_profiles")
        .select("id, user_id, username, display_name, bio, avatar_url, creator_type")
        .eq("user_id", route.user_id)
        .maybeSingle();

      if (error) {
        console.error("Creator profile load error:", error);
        setCreator(null);
        return;
      }

      setCreator((data as CreatorProfileRow | null) ?? null);
    })();
  }, [route?.user_id]);

  useEffect(() => {
    if (!route?.id || !route?.user_id) return;

    (async () => {
      const { data, error } = await supabase
        .from("user_routes")
        .select("*")
        .eq("user_id", route.user_id)
        .eq("visibility", "public")
        .neq("id", route.id)
        .order("updated_at", { ascending: false })
        .limit(4);

      if (error) {
        console.error("More from creator load error:", error);
        setMoreFromCreator([]);
        return;
      }

      setMoreFromCreator((data as UserRouteRow[]) ?? []);
    })();
  }, [route?.id, route?.user_id]);

  useEffect(() => {
    if (!route?.id) return;

    (async () => {
      const { data, error } = await supabase
        .from("user_routes")
        .select("*")
        .eq("visibility", "public")
        .neq("id", route.id)
        .limit(30);

      if (error) {
        console.error("Similar routes load error:", error);
        setSimilarRoutes([]);
        return;
      }

      const currentBadges = new Set(inferPublicRouteBadges(route).map((badge) => badge.label));
      const rows = ((data as UserRouteRow[]) ?? []).map((candidate) => {
        const candidateBadges = inferPublicRouteBadges(candidate).map((badge) => badge.label);
        let score = 0;
        if (candidate.city_slug && candidate.city_slug === route.city_slug) score += 4;
        if (candidate.creator_type === route.creator_type) score += 2;
        for (const badge of candidateBadges) {
          if (currentBadges.has(badge)) score += 3;
        }
        score += Math.min(3, Math.round(candidate.avg_rating ?? 0));
        score += Math.min(2, Math.round((candidate.like_count ?? 0) / 10));
        return { candidate, score };
      });

      rows.sort((a, b) => b.score - a.score);
      setSimilarRoutes(rows.slice(0, 4).map((row) => row.candidate));
    })();
  }, [route]);

  useEffect(() => {
    if (!route?.id) return;

    (async () => {
      const meta = route.meta && typeof route.meta === "object" ? (route.meta as Record<string, unknown>) : {};
      const personalizedVariant =
        meta.personalizedVariant && typeof meta.personalizedVariant === "object"
          ? (meta.personalizedVariant as Record<string, unknown>)
          : null;
      const baseRouteId =
        typeof personalizedVariant?.baseRouteId === "string"
          ? personalizedVariant.baseRouteId
          : null;

      const { data, error } = await supabase
        .from("user_routes")
        .select("*")
        .eq("visibility", "public")
        .limit(80);

      if (error) {
        console.error("Related variants load error:", error);
        setVariantBaseRoute(null);
        setRelatedVariants([]);
        return;
      }

      const rows = (data as UserRouteRow[]) ?? [];

      if (baseRouteId) {
        setVariantBaseRoute(rows.find((candidate) => candidate.id === baseRouteId) ?? null);
        setRelatedVariants(
          rows.filter((candidate) => {
            if (candidate.id === route.id) return false;
            const candidateMeta =
              candidate.meta && typeof candidate.meta === "object"
                ? (candidate.meta as Record<string, unknown>)
                : {};
            const candidateVariant =
              candidateMeta.personalizedVariant && typeof candidateMeta.personalizedVariant === "object"
                ? (candidateMeta.personalizedVariant as Record<string, unknown>)
                : null;
            return candidateVariant?.baseRouteId === baseRouteId;
          }).slice(0, 4)
        );
        return;
      }

      setVariantBaseRoute(null);
      setRelatedVariants(
        rows.filter((candidate) => {
          if (candidate.id === route.id) return false;
          const candidateMeta =
            candidate.meta && typeof candidate.meta === "object"
              ? (candidate.meta as Record<string, unknown>)
              : {};
          const candidateVariant =
            candidateMeta.personalizedVariant && typeof candidateMeta.personalizedVariant === "object"
              ? (candidateMeta.personalizedVariant as Record<string, unknown>)
              : null;
          return candidateVariant?.baseRouteId === route.id;
        }).slice(0, 4)
      );
    })();
  }, [route?.id, route?.meta]);

  useEffect(() => {
    if (!authReady || !userId) {
      setMyInterests([]);
      setInterestMatchedRoutes([]);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id,interests")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Profile interests load error:", error);
        setMyInterests([]);
        setInterestMatchedRoutes([]);
        return;
      }

      const interests = normalizeStringList((data as ProfileRow | null)?.interests);
      setMyInterests(interests);
    })();
  }, [authReady, userId]);

  useEffect(() => {
      try {
        const raw = localStorage.getItem(GROUP_INVITE_STORAGE_KEY);
        if (!raw) {
          setGroupMembers([]);
          setGroupInterests([]);
          setGroupMemberCount(0);
          return;
        }
        const parsed = JSON.parse(raw) as GroupMember[];
        const members = Array.isArray(parsed) ? parsed : [];
        setGroupMembers(members);
        const merged = Array.from(
          new Set(
            members.flatMap((member) =>
            Array.isArray(member.interests)
              ? member.interests.map((interest) => normalizeStringList([interest])).flat()
              : []
          )
        )
      );
        setGroupInterests(merged);
        setGroupMemberCount(members.length);
      } catch {
        setGroupMembers([]);
        setGroupInterests([]);
        setGroupMemberCount(0);
      }
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("slug,name,country_code")
        .eq("is_active", true);

      if (error) {
        console.error("Route detail cities load error:", error);
        setCities([]);
        return;
      }

      setCities((data as CityRow[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!route?.id || myInterests.length === 0) {
      setInterestMatchedRoutes([]);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("user_routes")
        .select("*")
        .eq("visibility", "public")
        .neq("id", route.id)
        .limit(40);

      if (error) {
        console.error("Interest-matched routes load error:", error);
        setInterestMatchedRoutes([]);
        return;
      }

      const ranked = ((data as UserRouteRow[]) ?? [])
        .map((candidate) => ({ candidate, score: scoreRouteAgainstInterests(candidate, myInterests) }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map((row) => ({
          route: row.candidate,
          reason: explainInterestMatch(row.candidate, myInterests),
          reasonBadges: buildInterestReasonBadges(row.candidate, myInterests),
        }));

      setInterestMatchedRoutes(ranked);
    })();
  }, [route?.id, myInterests]);

  useEffect(() => {
    if (!route?.id) {
      setCoSavedRoutes([]);
      return;
    }

    (async () => {
      const { data: bookmarkRows, error: bookmarkError } = await supabase
        .from("user_route_bookmarks")
        .select("route_id,user_id")
        .eq("route_id", route.id)
        .limit(100);

      if (bookmarkError) {
        console.error("Co-saved bookmark seed load error:", bookmarkError);
        setCoSavedRoutes([]);
        return;
      }

      const saverIds = Array.from(
        new Set(((bookmarkRows as RouteBookmarkRow[]) ?? []).map((row) => row.user_id).filter(Boolean))
      );

      if (saverIds.length === 0) {
        setCoSavedRoutes([]);
        return;
      }

      const { data: relatedBookmarks, error: relatedError } = await supabase
        .from("user_route_bookmarks")
        .select("route_id,user_id")
        .in("user_id", saverIds)
        .neq("route_id", route.id)
        .limit(300);

      if (relatedError) {
        console.error("Co-saved bookmark candidates load error:", relatedError);
        setCoSavedRoutes([]);
        return;
      }

      const counts = new Map<string, number>();
      for (const row of (relatedBookmarks as RouteBookmarkRow[]) ?? []) {
        counts.set(row.route_id, (counts.get(row.route_id) ?? 0) + 1);
      }

      const topIds = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([routeId]) => routeId);

      if (topIds.length === 0) {
        setCoSavedRoutes([]);
        return;
      }

      const { data: routesData, error: routesError } = await supabase
        .from("user_routes")
        .select("*")
        .in("id", topIds)
        .eq("visibility", "public");

      if (routesError) {
        console.error("Co-saved routes load error:", routesError);
        setCoSavedRoutes([]);
        return;
      }

      const routeMap = new Map(((routesData as UserRouteRow[]) ?? []).map((candidate) => [candidate.id, candidate]));
      const ordered = topIds
        .map((routeId) => {
          const candidate = routeMap.get(routeId);
          if (!candidate) return null;
          const count = counts.get(routeId) ?? 0;
          return {
            route: candidate,
            reason:
              count > 1
                ? `${count} Nutzer haben diese Route zusammen mit der aktuellen gespeichert.`
                : "Wurde zusammen mit dieser Route gespeichert.",
            reasonBadges: [
              count > 1 ? `${count}x zusammen gespeichert` : "zusammen gespeichert",
              candidate.city_slug && candidate.city_slug === route.city_slug ? "gleiche Stadt" : "ähnlicher Flow",
            ],
          } satisfies SuggestedRoute;
        })
        .filter(Boolean) as SuggestedRoute[];

      setCoSavedRoutes(ordered.slice(0, 4));
    })();
  }, [route?.city_slug, route?.id]);

  useEffect(() => {
    if (!authReady || !route?.id || !userId) return;

    (async () => {
      const [{ data: likeRows }, { data: bookmarkRows }, { data: ratingRow }] = await Promise.all([
        supabase
          .from("user_route_likes")
          .select("id,route_id,user_id")
          .eq("route_id", route.id)
          .eq("user_id", userId)
          .limit(1),
        supabase
          .from("user_route_bookmarks")
          .select("id,route_id,user_id")
          .eq("route_id", route.id)
          .eq("user_id", userId)
          .limit(1),
        supabase
          .from("user_route_ratings")
          .select("*")
          .eq("route_id", route.id)
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      setLiked(Array.isArray(likeRows) && likeRows.length > 0);
      setBookmarked(Array.isArray(bookmarkRows) && bookmarkRows.length > 0);

      if (ratingRow) {
        const rr = ratingRow as RouteRatingRow;
        setMyRating(rr.rating ?? 0);
        setMyReview(rr.review_text ?? "");
      } else {
        setMyRating(0);
        setMyReview("");
      }
    })();
  }, [authReady, route?.id, userId]);

  const mapStops = useMemo(() => {
    const pts: Array<{ label: string; name: string; lat: number; lng: number }> = [];

    if (route?.start_lat != null && route?.start_lng != null) {
      pts.push({
        label: route.start_label || "Startpunkt",
        name: niceStartType(route.start_type),
        lat: route.start_lat,
        lng: route.start_lng,
      });
    }

    for (const s of stops) {
      if (s.lat != null && s.lng != null) {
        pts.push({
          label: s.title || `Stop ${s.stop_order}`,
          name: `Stop ${s.stop_order}${s.duration_min != null ? ` · ${s.duration_min} Min` : ""}`,
          lat: s.lat,
          lng: s.lng,
        });
      }
    }

    return pts;
  }, [route, stops]);

  const googleRouteUrl = useMemo(() => {
    return buildGoogleMapsDirUrl(
      mapStops.map((p) => ({ lat: p.lat, lng: p.lng })),
      routeProfile
    );
  }, [mapStops, routeProfile]);

  const fallbackSummary = useMemo(() => {
    let distKm = 0;
    let travelMin = 0;

    for (let i = 1; i < mapStops.length; i++) {
      const a = mapStops[i - 1];
      const b = mapStops[i];
      const d = haversineKm(a.lat, a.lng, b.lat, b.lng);
      distKm += d;
      travelMin += estimateTravelMinForRouteProfile(d, routeProfile) ?? 0;
    }

    const stayMin = stops.reduce((sum, s) => sum + (s.duration_min ?? 0), 0);

    return {
      distanceKm: Math.round(distKm * 10) / 10,
      travelMin: Math.round(travelMin),
      stayMin: Math.round(stayMin),
      totalMin: Math.round(stayMin + travelMin),
    };
  }, [mapStops, routeProfile, stops]);

  const travelSummary = useMemo(
    () => (routeSummaryLooksPlausible(routeSummary, routeProfile) ? routeSummary : null),
    [routeProfile, routeSummary]
  );

  const travelSummaryUsesFallback = mapStops.length >= 2 && travelSummary == null;

  async function reloadRouteCounters() {
    if (!route?.slug) return;

    const { data, error } = await supabase
      .from("user_routes")
      .select("*")
      .eq("slug", route.slug)
      .maybeSingle();

    if (!error && data) setRoute(data as UserRouteRow);
  }

  async function toggleLike() {
    if (!route?.id || busyLike) return;
    if (!userId) {
      showToast("Bitte anmelden oder als Gast fortfahren, um zu liken.");
      return;
    }

    setBusyLike(true);
    try {
      if (liked) {
        const { error } = await supabase
          .from("user_route_likes")
          .delete()
          .eq("route_id", route.id)
          .eq("user_id", userId);

        if (error) {
          console.error(`Unlike error: ${formatSupabaseError(error)}`);
          showToast(`Like konnte nicht entfernt werden (${summarizeErrorForUi(error)})`);
          return;
        }

        setLiked(false);
        showToast("Like entfernt");
      } else {
        const { error } = await supabase
          .from("user_route_likes")
          .insert({ route_id: route.id, user_id: userId });

        if (error) {
          console.error(`Like error: ${formatSupabaseError(error)}`);
          showToast(`Like konnte nicht gesetzt werden (${summarizeErrorForUi(error)})`);
          return;
        }

        setLiked(true);
        showToast("Route geliked");
      }

      await reloadRouteCounters();
    } finally {
      setBusyLike(false);
    }
  }

  async function toggleBookmark() {
    if (!route?.id || busyBookmark) return;
    if (!userId) {
      showToast("Bitte anmelden oder als Gast fortfahren, um zu speichern.");
      return;
    }

    setBusyBookmark(true);
    try {
      if (bookmarked) {
        const { error } = await supabase
          .from("user_route_bookmarks")
          .delete()
          .eq("route_id", route.id)
          .eq("user_id", userId);

        if (error) {
          console.error(`Bookmark delete error: ${formatSupabaseError(error)}`);
          showToast(`Bookmark konnte nicht entfernt werden (${summarizeErrorForUi(error)})`);
          return;
        }

        setBookmarked(false);
        showToast("Bookmark entfernt");
      } else {
        const { error } = await supabase
          .from("user_route_bookmarks")
          .insert({ route_id: route.id, user_id: userId });

        if (error) {
          console.error(`Bookmark insert error: ${formatSupabaseError(error)}`);
          showToast(`Bookmark konnte nicht gesetzt werden (${summarizeErrorForUi(error)})`);
          return;
        }

        setBookmarked(true);
        showToast("Route gespeichert");
      }

      await reloadRouteCounters();
    } finally {
      setBusyBookmark(false);
    }
  }

  async function saveRating(nextRating?: number) {
    if (!route?.id) return;
    if (!userId) {
      showToast("Bitte anmelden oder als Gast fortfahren, um zu bewerten.");
      return;
    }

    const finalRating = nextRating ?? myRating;
    if (!finalRating || finalRating < 1 || finalRating > 5) {
      showToast("Bitte 1 bis 5 Sterne wählen");
      return;
    }

    setSavingRating(true);
    try {
      const payload = {
        route_id: route.id,
        user_id: userId,
        rating: finalRating,
        review_text: myReview.trim() || null,
      };

      const { error } = await supabase
        .from("user_route_ratings")
        .upsert(payload, { onConflict: "route_id,user_id" });

      if (error) {
        console.error(`Save rating error: ${formatSupabaseError(error)}`);
        showToast(`Bewertung konnte nicht gespeichert werden (${summarizeErrorForUi(error)})`);
        return;
      }

      setMyRating(finalRating);
      await reloadRouteCounters();
      showToast("Bewertung gespeichert");
    } finally {
      setSavingRating(false);
    }
  }

  const creatorName =
    creator?.display_name || creator?.username || niceCreatorType(route?.creator_type ?? "user");
  const creatorProfileHref = creatorHref(creator);
  const cityMap = useMemo(() => buildCityLookupMap(cities), [cities]);
  const routeCityLabel = formatCityWithCountry(route?.city_slug ?? null, cityMap);
  const personalizationMembers = useMemo(
    () => [
      ...(myInterests.length > 0 ? [{ name: "Du", interests: myInterests, isCurrentUser: true }] : []),
      ...groupMembers.map((member) => ({
        name: member.name,
        interests: member.interests,
        isCurrentUser: false,
      })),
    ],
    [groupMembers, myInterests]
  );
  const personalizationKindsSummary = useMemo(() => {
    const counts: Record<PersonalizationKind, number> = {
      fixed: 0,
      food_swap: 0,
      activity_swap: 0,
      nightlife_swap: 0,
      ambience_swap: 0,
    };
    stops.forEach((stop) => {
      const kind = inferPersonalizationKind({ title: stop.title, note: stop.note, location: null });
      counts[kind] += 1;
    });
    return counts;
  }, [stops]);
  const firstStopWithPhoto = stops.find((stop) => stop.photo_url?.trim());
  const routeCoverImageUrl = renderableImageUrl(route?.cover_image_url);
  const stopCoverImageUrl = renderableImageUrl(firstStopWithPhoto?.photo_url);
  const heroCover = routeCoverImageUrl || stopCoverImageUrl || null;
  const heroAttributionMeta = routeCoverImageUrl ? route?.meta : stopCoverImageUrl ? firstStopWithPhoto?.meta : null;
  const routeBadges = inferPublicRouteBadges(route ?? {});
  const routeMeta =
    route?.meta && typeof route.meta === "object"
      ? (route.meta as Record<string, unknown>)
      : {};
  const personalizedVariantMeta =
    routeMeta.personalizedVariant && typeof routeMeta.personalizedVariant === "object"
      ? (routeMeta.personalizedVariant as Record<string, unknown>)
      : null;
  const currentBaseRouteId =
    typeof personalizedVariantMeta?.baseRouteId === "string" ? personalizedVariantMeta.baseRouteId : route?.id ?? null;
  const durationBadge = durationBucketLabel(routeMeta.durationBucket);
  const adjustableStopsCount = useMemo(
    () =>
      stops.filter(
        (stop) => inferPersonalizationKind({ title: stop.title, note: stop.note, location: null }) !== "fixed"
      ).length,
    [stops]
  );
  const adjustedStopsCount = useMemo(
    () =>
      stops.reduce((sum, stop) => {
        const candidates = inlineSwapCandidates[stop.id] ?? [];
        const index = inlineSwapIndex[stop.id] ?? 0;
        return sum + (candidates.length > 1 && index > 0 ? 1 : 0);
      }, 0),
    [stops, inlineSwapCandidates, inlineSwapIndex]
  );
  const adjustableKindsReport = useMemo(() => {
    const entries = (["food_swap", "activity_swap", "nightlife_swap", "ambience_swap"] as PersonalizationKind[])
      .map((kind) => ({ kind, count: personalizationKindsSummary[kind] }))
      .filter((entry) => entry.count > 0);
    return entries;
  }, [personalizationKindsSummary]);
  const adjustedKindsReport = useMemo(() => {
    const counts: Record<PersonalizationKind, number> = {
      fixed: 0,
      food_swap: 0,
      activity_swap: 0,
      nightlife_swap: 0,
      ambience_swap: 0,
    };
    stops.forEach((stop) => {
      const candidates = inlineSwapCandidates[stop.id] ?? [];
      const index = inlineSwapIndex[stop.id] ?? 0;
      if (candidates.length > 1 && index > 0) {
        const kind = inferPersonalizationKind({ title: stop.title, note: stop.note, location: null });
        counts[kind] += 1;
      }
    });
    return (["food_swap", "activity_swap", "nightlife_swap", "ambience_swap"] as PersonalizationKind[])
      .map((kind) => ({ kind, count: counts[kind] }))
      .filter((entry) => entry.count > 0);
  }, [stops, inlineSwapCandidates, inlineSwapIndex]);
  const sortedRelatedVariants = useMemo(
    () =>
      relatedVariants
        .filter((variant) => matchesVariantFilter(variant, familyVariantFilter))
        .sort((a, b) => {
          const variantOrder = compareVariantOrder(a, b, familyVariantSort);
          if (variantOrder !== 0) return variantOrder;
          const aScore = (a.like_count ?? 0) + (a.bookmark_count ?? 0) + (a.avg_rating ?? 0) * 2;
          const bScore = (b.like_count ?? 0) + (b.bookmark_count ?? 0) + (b.avg_rating ?? 0) * 2;
          if (bScore !== aScore) return bScore - aScore;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        }),
    [relatedVariants, familyVariantFilter, familyVariantSort]
  );
  const variantFamilyCounts = useMemo(
    () => ({
      originals: variantBaseRoute ? 1 : 0,
      variants: relatedVariants.length,
      visibleOriginals: variantBaseRoute && matchesVariantFilter(variantBaseRoute, familyVariantFilter) ? 1 : 0,
      visibleVariants: sortedRelatedVariants.length,
    }),
    [variantBaseRoute, relatedVariants.length, familyVariantFilter, sortedRelatedVariants.length]
  );
  const personalizationKindsInRoute = useMemo(
    () =>
      Array.from(
        new Set(
          stops
            .map((stop) => inferPersonalizationKind({ title: stop.title, note: stop.note, location: null }))
            .filter((kind): kind is PersonalizationKind => kind !== "fixed")
        )
      ),
    [stops]
  );
  const routeIntro =
    route?.description?.trim() ||
    `Eine öffentliche Route in ${routeCityLabel} mit ${stops.length} Stop${stops.length === 1 ? "" : "s"} und ${
      routeProfile === "foot" ? "kompaktem Fußprofil" : "offenerem Stadtprofil"
    }.`;
  const routeCityShortLabel = routeCityLabel.split(",")[0]?.trim() || routeCityLabel;
  const routeDurationLabel =
    durationBadge ||
    (fallbackSummary.totalMin > 0 ? `${Math.max(1, Math.round(fallbackSummary.totalMin / 60))} h+` : "Offen");
  const routeStartLabel = route?.start_label?.trim() || "Flexibler Einstieg";
  const routeQuickFacts = [
    { label: "Stadt", value: routeCityShortLabel, title: routeCityLabel },
    { label: "Dauer", value: routeDurationLabel },
    { label: "Start", value: routeStartLabel },
    {
      label: "Profil",
      value: routeProfile === "foot" ? "Zu Fuß" : "Auto",
    },
  ];

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl sm:p-6 md:p-8">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/saved" className="text-sm text-gray-600 underline underline-offset-4">
              Gespeichert
            </Link>
            <div className="text-sm text-gray-500">Route wird vorbereitet</div>
          </div>

          <section className="overflow-hidden rounded-[28px] border bg-white shadow-sm">
            <div className="h-[280px] animate-pulse bg-gradient-to-br from-stone-100 via-stone-50 to-stone-200 md:h-[360px]" />
            <div className="grid gap-6 p-6 md:grid-cols-[1.2fr_0.8fr] md:p-8">
              <div className="space-y-4">
                <div className="h-4 w-28 animate-pulse rounded-full bg-stone-100" />
                <div className="h-10 w-4/5 animate-pulse rounded-2xl bg-stone-100" />
                <div className="h-4 w-full animate-pulse rounded-full bg-stone-100" />
                <div className="h-4 w-3/4 animate-pulse rounded-full bg-stone-100" />
                <div className="grid grid-cols-4 gap-1.5">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="min-w-0 rounded-xl border bg-stone-50 px-1.5 py-2">
                      <div className="mx-auto h-2 w-8 animate-pulse rounded-full bg-stone-100" />
                      <div className="mx-auto mt-2 h-3 w-10 animate-pulse rounded-full bg-stone-100" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border bg-stone-50 p-5">
                  <div className="h-4 w-20 animate-pulse rounded-full bg-stone-100" />
                  <div className="mt-3 h-5 w-40 animate-pulse rounded-full bg-stone-100" />
                  <div className="mt-2 h-4 w-32 animate-pulse rounded-full bg-stone-100" />
                </div>
                <div className="rounded-2xl border bg-stone-50 p-5">
                  <div className="h-4 w-24 animate-pulse rounded-full bg-stone-100" />
                  <div className="mt-3 h-5 w-48 animate-pulse rounded-full bg-stone-100" />
                </div>
              </div>
            </div>
          </section>

          <div className="rounded-2xl border bg-white px-4 py-3 text-sm text-gray-600">
            {slowLoad
              ? "Die Route braucht gerade länger als üblich. Du kannst auf der Seite bleiben oder zurück zur Routenübersicht wechseln."
              : "Lade Route..."}
          </div>
        </div>
      </main>
    );
  }

  if (notFound || !route) {
    return (
      <main className="max-w-5xl mx-auto p-8">
        <div className="mb-4">
          <Link href="/saved" className="text-sm underline">
            Gespeichert
          </Link>
        </div>
        <div className="p-6 border rounded-xl">
          <h1 className="text-2xl font-bold mb-2">Route nicht gefunden</h1>
          <p className="text-gray-600">
            Die Route existiert nicht oder ist aktuell nicht öffentlich verfügbar.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 sm:p-6 md:p-8">
      <TrackOnMount
        eventType="route_view"
        routeId={route.id}
        creatorProfileId={route.creator_profile_id ?? creator?.id ?? null}
        citySlug={route.city_slug ?? null}
        surface="route_detail"
        onceKey={`route-view:${route.id}`}
        metadata={{ slug: route.slug ?? null }}
      />
      {monetizationDebug ? (
        <div className="space-y-4">
          <InternalMonetizationSlot
            enabled={monetizationDebug}
            slotKey="route_detail_brand_distribution"
            title="Route-Detail: Brand / Creator Distribution"
            description="Interner Pilot für spätere Brand- oder Creator-Distribution direkt auf der Routen-Detailseite, klar getrennt vom organischen Routeninhalt."
            productKeys={["creator_brand_route_distribution", "city_spotlight"]}
            previewItems={["Brand Route", "Partner Collection", "Kampagnen-Route"]}
            citySlug={route.city_slug ?? null}
            livePreview
            ctaSource="internal_route_distribution_pilot"
          />
          <MonetizationDebugPanel
            enabled={monetizationDebug}
            surface="route_detail"
            routeId={route.id}
            creatorProfileId={route.creator_profile_id ?? creator?.id ?? null}
            citySlug={route.city_slug ?? null}
            title="Route-Detail Monetization Debug"
          />
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/saved" className="text-sm text-gray-600 underline underline-offset-4">
          Gespeichert
        </Link>
        <Link href="/" className="text-sm text-gray-600 underline underline-offset-4">
          Zum Planner
        </Link>
      </div>

      <section className="overflow-hidden rounded-[28px] border bg-white shadow-sm">
        {heroCover ? (
          <div className="relative bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroCover} alt={route.title} className="h-[300px] w-full object-cover md:h-[380px]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
            <ImageAttribution
              meta={heroAttributionMeta}
              compact
              tone="dark"
              className="absolute right-4 top-4 z-10 max-w-[calc(100%-2rem)] truncate rounded-full bg-black/55 px-3 py-1.5 backdrop-blur"
            />
            <div className="absolute inset-x-0 bottom-0 p-6 md:p-8 text-white">
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs backdrop-blur">{niceCreatorType(route.creator_type)}</span>
                <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs backdrop-blur">{visibilityLabel(route.visibility)}</span>
                <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs backdrop-blur">{routeCityLabel}</span>
                {personalizedVariantMeta ? <span className="rounded-full border border-white/30 bg-emerald-500/20 px-3 py-1 text-xs backdrop-blur">Persönliche Variante</span> : null}
                {route.is_featured ? <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs backdrop-blur">Featured</span> : null}
                {durationBadge ? <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs backdrop-blur">{durationBadge}</span> : null}
                {routeBadges.map((badge, badgeIndex) => (
                  <span key={`${badge.label}-${badgeIndex}`} className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs backdrop-blur">
                    {badge.label}
                  </span>
                ))}
              </div>
              <h1 className="max-w-4xl text-3xl font-semibold tracking-tight md:text-5xl">{route.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/85">
                <span>Aktualisiert {formatDate(route.updated_at)}</span>
                <span>•</span>
                <span>{stops.length} Stop{stops.length === 1 ? "" : "s"}</span>
                <span>•</span>
                <span>{route.avg_rating} / 5 bei {route.rating_count} Bewertungen</span>
              </div>
            </div>
          </div>
        ) : (
            <div className="bg-gradient-to-br from-stone-100 via-white to-stone-200 p-8 md:p-10">
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="rounded-full border px-3 py-1 text-xs">{niceCreatorType(route.creator_type)}</span>
              <span className="rounded-full border px-3 py-1 text-xs">{visibilityLabel(route.visibility)}</span>
              <span className="rounded-full border px-3 py-1 text-xs">{routeCityLabel}</span>
              {personalizedVariantMeta ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800">Persönliche Variante</span> : null}
            </div>
              <h1 className="max-w-4xl text-3xl font-semibold tracking-tight md:text-5xl">{route.title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-gray-700">{routeIntro}</p>
            <div className="mt-3 text-sm text-gray-600">Aktualisiert {formatDate(route.updated_at)}</div>
          </div>
        )}

        <div className="grid gap-4 px-4 pt-4 lg:grid-cols-[minmax(0,1fr)_280px] md:px-8 md:pt-6">
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-1.5">
              {routeQuickFacts.map((fact) => (
                <div
                  key={fact.label}
                  title={fact.title ?? fact.value}
                  className="min-w-0 overflow-hidden rounded-xl border bg-gray-50 px-1.5 py-2 text-center"
                >
                  <div className="truncate text-[8.5px] font-medium uppercase tracking-[0.08em] text-gray-500 sm:text-[10px]">
                    {fact.label}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] font-semibold leading-tight text-gray-950 sm:text-sm">
                    {fact.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-gray-600">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-[12px] font-semibold text-gray-950"
                title={`${compactRating(route.avg_rating)} von 5`}
              >
                {compactRating(route.avg_rating)}/5
              </span>
              <a
                href="#route-rating"
                aria-label={`${route.rating_count} Bewertungen. Route bewerten`}
                title={`${route.rating_count} Bewertungen`}
                className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-lg text-gray-900 transition hover:bg-gray-50"
              >
                <span aria-hidden="true">☆</span>
                <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-gray-950 px-1 text-center text-[10px] font-semibold leading-5 text-white">
                  {compactCount(route.rating_count)}
                </span>
              </a>
              <button
                onClick={toggleLike}
                disabled={busyLike}
                aria-label={liked ? `${route.like_count} Likes. Like entfernen` : `${route.like_count} Likes. Route liken`}
                title={`${route.like_count} Likes`}
                className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-lg transition disabled:opacity-60 ${
                  liked ? "border-black bg-black text-white" : "border-black/10 bg-white text-gray-900 hover:bg-gray-50"
                }`}
              >
                <span aria-hidden="true">♥</span>
                <span className={`absolute -right-0.5 -top-0.5 min-w-5 rounded-full px-1 text-center text-[10px] font-semibold leading-5 ${
                  liked ? "bg-white text-gray-950" : "bg-gray-950 text-white"
                }`}>
                  {compactCount(route.like_count)}
                </span>
              </button>
              <button
                onClick={toggleBookmark}
                disabled={busyBookmark}
                aria-label={bookmarked ? `${route.bookmark_count} Saves. Gespeichert` : `${route.bookmark_count} Saves. Route speichern`}
                title={`${route.bookmark_count} Saves`}
                className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-base transition disabled:opacity-60 ${
                  bookmarked ? "border-black bg-black text-white" : "border-black/10 bg-white text-gray-900 hover:bg-gray-50"
                }`}
              >
                <span aria-hidden="true">🔖</span>
                <span className={`absolute -right-0.5 -top-0.5 min-w-5 rounded-full px-1 text-center text-[10px] font-semibold leading-5 ${
                  bookmarked ? "bg-white text-gray-950" : "bg-gray-950 text-white"
                }`}>
                  {compactCount(route.bookmark_count)}
                </span>
              </button>
            </div>

            {route.description ? (
              <details className="rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm text-gray-700">
                <summary className="cursor-pointer list-none font-medium text-gray-950">
                  Kurzbeschreibung
                </summary>
                <p className="mt-2 line-clamp-4 whitespace-pre-wrap leading-6">{route.description}</p>
              </details>
            ) : (
              <p className="rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm leading-6 text-gray-500">Diese Route hat noch keine längere Beschreibung. Die Stop-Reihenfolge und Hinweise unten geben dir trotzdem einen guten Überblick.</p>
            )}

            {personalizedVariantMeta ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                <div className="font-medium">Diese Route wurde als personalisierte Variante gespeichert</div>
                <div className="mt-1 text-emerald-900">
                  {typeof personalizedVariantMeta.variantName === "string" && personalizedVariantMeta.variantName.trim().length > 0 ? `Variante: ${personalizedVariantMeta.variantName}. ` : ""}
                  {routeVariantRoleLabel(route, currentBaseRouteId) ? `Rolle: ${routeVariantRoleLabel(route, currentBaseRouteId)}. ` : ""}
                  {typeof personalizedVariantMeta.sourceLabel === "string" && personalizedVariantMeta.sourceLabel.trim().length > 0 ? `Ursprung: ${personalizedVariantMeta.sourceLabel}. ` : ""}
                  {typeof personalizedVariantMeta.groupLabel === "string" && personalizedVariantMeta.groupLabel.trim().length > 0 ? `Kontext: ${personalizedVariantMeta.groupLabel}. ` : ""}
                  {typeof personalizedVariantMeta.adjustedCount === "number"
                    ? `${personalizedVariantMeta.adjustedCount} Stops wurden gegenüber der Ursprungsversion angepasst.`
                    : "Die Route wurde auf Basis persönlicher oder gruppierter Vorlieben angepasst."}
                </div>
                {typeof personalizedVariantMeta.baseRouteSlug === "string" && personalizedVariantMeta.baseRouteSlug.trim().length > 0 ? (
                  <div className="mt-3">
                    <Link href={`/routes/${personalizedVariantMeta.baseRouteSlug}`} className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs text-emerald-900">
                      Basisroute öffnen
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}

          </div>

          <aside className="space-y-3">
            <div className="rounded-2xl border bg-gray-50 p-3">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border bg-white">
                  {creator?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={creator.avatar_url} alt={creatorName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-gray-500">{creatorName.slice(0, 1).toUpperCase()}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{creatorName}</div>
                  <div className="text-xs text-gray-500">{niceCreatorType(route.creator_type)}</div>
                </div>
                {creatorProfileHref ? (
                  <Link href={creatorProfileHref} className="shrink-0 text-xs underline underline-offset-4">
                    Profil
                  </Link>
                ) : null}
              </div>
            </div>

            {personalizationMembers.length > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-950">
                <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap">
                  <span className="shrink-0 font-medium text-amber-950">Vorlieben</span>
                  {personalizationMembers.map((member) => (
                    <span key={member.name} className={`shrink-0 rounded-full px-2.5 py-1 ${member.isCurrentUser ? "bg-black text-white" : "border border-black/10 bg-white text-gray-700"}`}>
                      {member.name}
                    </span>
                  ))}
                  {effectivePersonalizationInterests.slice(0, 3).map((interest) => (
                    <span key={interest} className="shrink-0 rounded-full border border-black/10 bg-white px-2.5 py-1 text-gray-700">
                      {interest}
                    </span>
                  ))}
                  {effectivePersonalizationInterests.length > 3 ? (
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-amber-900">
                      +{effectivePersonalizationInterests.length - 3}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

          </aside>
        </div>

        <div className="mt-5 space-y-4 px-4 pb-5 md:px-8 md:pb-8">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Link
              href={`/routes/${route.slug ?? slug}/run`}
              aria-label={hasRouteRunProgress ? "Route fortsetzen" : "Route starten"}
              title={hasRouteRunProgress ? "Route fortsetzen" : "Route starten"}
              className={`flex min-h-12 items-center justify-center rounded-2xl px-3 py-3 text-center text-sm font-semibold shadow-sm transition ${
                hasRouteRunProgress
                  ? "border bg-white text-gray-950 hover:bg-gray-50"
                  : "bg-black text-white hover:opacity-95"
              }`}
            >
              <PlayPauseIcon isPaused={hasRouteRunProgress} />
              <span className="sr-only">{hasRouteRunProgress ? "Route fortsetzen" : "Route starten"}</span>
            </Link>
            <button
              onClick={handoffRouteToPlanner}
              aria-label={plannerTemplateQueued ? "Vorlage wird geladen" : "Als Vorlage planen"}
              title={plannerTemplateQueued ? "Vorlage wird geladen" : "Als Vorlage planen"}
              className="flex min-h-12 items-center justify-center rounded-2xl border bg-white px-3 py-3 text-center text-sm font-semibold text-gray-950 shadow-sm transition hover:bg-gray-50"
            >
              <CopyRouteIcon />
              <span className="sr-only">{plannerTemplateQueued ? "Vorlage wird geladen..." : "Als Vorlage planen"}</span>
            </button>
            <button
              onClick={() => void personalizeRouteForInterests()}
              aria-label={groupMemberCount > 0 ? "An unsere Vorlieben anpassen" : "An meine Vorlieben anpassen"}
              title={groupMemberCount > 0 ? "An unsere Vorlieben anpassen" : "An meine Vorlieben anpassen"}
              className="flex min-h-12 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-center text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100"
            >
              <SliderRouteIcon />
              <span className="sr-only">{groupMemberCount > 0 ? "An unsere Vorlieben anpassen" : "An meine Vorlieben anpassen"}</span>
            </button>
            <button
              type="button"
              aria-expanded={routeInfoOpen}
              aria-controls="route-personalization"
              onClick={() => setRouteInfoOpen((open) => !open)}
              className="flex min-h-12 items-center justify-center rounded-2xl border bg-white px-3 py-3 text-center text-sm font-semibold text-gray-950 shadow-sm transition hover:bg-gray-50"
            >
              Infos
            </button>
          </div>

          {routeInfoOpen ? (
            <div id="route-personalization" className="rounded-2xl border bg-white p-4">
              <div className="grid gap-3 lg:grid-cols-3">
                {(adjustableStopsCount > 0 || adjustedStopsCount > 0) ? (
                  <div className="rounded-2xl border bg-white px-4 py-3 text-xs text-gray-700">
                    <div className="text-sm font-medium text-gray-900">Personalisierung dieser Route</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {adjustableStopsCount > 0 ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">{adjustableStopsCount} anpassbar</span> : null}
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800">{adjustedStopsCount} angepasst</span>
                    </div>
                    {adjustableKindsReport.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {adjustableKindsReport.map(({ kind, count }) => (
                          <span key={`adjustable-${kind}`} className={`rounded-full px-3 py-1 text-xs ${kindTone(kind)}`}>
                            {count}x {kindLabel(kind)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {adjustedKindsReport.length > 0 ? (
                      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                        <span className="inline-flex flex-wrap gap-2">
                          {adjustedKindsReport.map(({ kind, count }) => (
                            <span key={`changed-${kind}`} className="rounded-full bg-white px-2 py-1">
                              {count}x {kindLabel(kind)}
                            </span>
                          ))}
                        </span>
                      </div>
                    ) : null}
                    <div className="mt-2 leading-5 text-gray-600">
                      Vorschläge lassen sich durchschalten und danach als {groupMemberCount > 0 ? "Gruppen-" : "persönlicher "}Entwurf übernehmen.
                    </div>
                  </div>
                ) : null}
                <div className="rounded-2xl border bg-gray-50 px-4 py-3 text-xs text-gray-700">
                  <div className="text-sm font-medium text-gray-900">Fixiert / Anpassbar</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800">Fixiert</span>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">Anpassbar</span>
                  </div>
                  <div className="mt-2 leading-5 text-gray-600">Fixierte Stops sind Kern-Highlights. Anpassbar sind meist Food-, Aktivitäts- oder Einkehr-Stationen.</div>
                </div>
                {personalizationKindsInRoute.length > 0 ? (
                  <div className="rounded-2xl border bg-white px-4 py-3 text-xs text-gray-700">
                    <div className="text-sm font-medium text-gray-900">Was in dieser Route anpassbar ist</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {personalizationKindsInRoute.map((kind) => (
                        <span key={kind} className={`rounded-full px-3 py-1 text-xs ${kindTone(kind)}`}>
                          {kindLabel(kind)}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 leading-5 text-gray-600">Diese Routentypen können angepasst werden, ohne die Kern-Highlights zu verlieren.</div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {!userId && authReady ? (
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <span>Ohne Konto testen?</span>
              <button
                onClick={() => void continueAsGuest()}
                disabled={authLoading}
                className="rounded-full border px-3 py-2 text-sm text-gray-900 hover:bg-gray-50 disabled:opacity-60"
              >
                {authLoading ? "Starte Gast..." : "Als Gast fortfahren"}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {plannerTemplateQueued ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Diese Vorlage wird gerade in den Planner übernommen.
        </div>
      ) : null}

      <section id="route-map" className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm md:p-8">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-semibold">Route & Karte</div>
              <div className="text-sm text-gray-600">Start, Stop-Namen und realistischer Wegverlauf im gewählten Profil.</div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                disabled={!googleRouteUrl}
                onClick={() => { if (googleRouteUrl) window.open(googleRouteUrl, "_blank", "noreferrer"); }}
                className="rounded-full border bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-60"
              >
                In Google Maps öffnen
              </button>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <span className="text-xs uppercase tracking-wide text-gray-500">Wegprofil</span>
                <select value={routeProfile} onChange={(e) => setRouteProfile(e.target.value as "foot" | "car")} className="rounded-full border px-4 py-2 text-sm text-gray-900">
                  <option value="foot">Zu Fuß</option>
                  <option value="car">Auto</option>
                </select>
              </label>
            </div>
          </div>

          <div className="-mx-4 overflow-hidden rounded-none border-y sm:mx-0 sm:rounded-2xl sm:border">
            <PlanMap stops={mapStops} profile={routeProfile} height={360} onSummary={(s) => setRouteSummary(s)} showHeader={false} />
          </div>

          <div className="rounded-2xl border bg-gray-50 p-4 text-sm text-gray-700">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-gray-900">Travel Summary</div>
                <div className="mt-1 text-xs text-gray-500">Zeigt echte Stop-Namen statt generischer Nummern.</div>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs text-gray-600">
                {travelSummary ? "OSRM" : "Fallback"}
              </div>
            </div>

            {mapStops.length < 2 ? (
              <div className="mt-3 text-sm text-gray-600">Für eine Route brauchen wir mindestens Start plus einen Stop mit Koordinaten.</div>
            ) : travelSummary ? (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-gray-700">
                    Gesamt: <span className="font-semibold">{travelSummary.totalDistanceKm} km</span>
                  </span>
                  <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-gray-700">
                    Wege: <span className="font-semibold">{travelSummary.totalDurationMin} Min</span>
                  </span>
                </div>
                <div className="mt-3 grid gap-2">
                  {travelSummary.legs.map((leg, i) => (
                    <div key={i} className="rounded-xl border border-black/10 bg-white px-3 py-2">
                      <div className="text-sm font-medium text-gray-900">{leg.fromLabel} → {leg.toLabel}</div>
                      <div className="mt-1 text-xs text-gray-600">{leg.distanceKm} km · {leg.durationMin} Min</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-gray-700">
                    Strecke: <span className="font-semibold">{fallbackSummary.distanceKm} km</span>
                  </span>
                  <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-gray-700">
                    Wege: <span className="font-semibold">{fallbackSummary.travelMin} Min</span>
                  </span>
                  <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-gray-700">
                    Aufenthalte: <span className="font-semibold">{fallbackSummary.stayMin} Min</span>
                  </span>
                  <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-gray-700">
                    Gesamt: <span className="font-semibold">{fallbackSummary.totalMin} Min</span>
                  </span>
                </div>
                {travelSummaryUsesFallback && routeProfile === "foot" ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Die Gehzeit wurde auf eine realistischere Schätzung zurückgesetzt, weil die Rohwerte für diese Route unplausibel waren.
                  </div>
                ) : null}
              </>
            )}
          </div>
      </section>

      <section id="route-stops">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="text-2xl font-semibold">Stops</h2><p className="text-sm text-gray-600">Die Route ist in Reihenfolge aufgebaut, damit du den Flow direkt nachvollziehen kannst.</p></div>
          <div className="text-sm text-gray-500">{stops.length} Stop{stops.length === 1 ? "" : "s"}</div>
        </div>
        {stopsLoading ? (
          <div className="rounded-2xl border bg-white p-4">Lade Stops...</div>
        ) : stops.length === 0 ? (
          <div className="rounded-2xl border bg-white p-4 text-sm text-gray-600">Diese Route hat noch keine Stops.</div>
        ) : (
          <div className="space-y-5">
            {stops.map((stop) => {
              const personalizationKind = inferPersonalizationKind({ title: stop.title, note: stop.note, location: null });
              const adjustable = personalizationKind !== "fixed";
              const swapOptions = inlineSwapCandidates[stop.id] ?? [];
              const swapIndex = inlineSwapIndex[stop.id] ?? 0;
              const displayCandidate = adjustable && swapOptions.length > 0 ? swapOptions[swapIndex] : currentStopCandidate(stop);
              const hasInlineSwitch = adjustable && swapOptions.length > 1;
              const resolvedLocationId = adjustable ? displayCandidate.location_id : stop.location_id;
              const affiliateMatch =
                (resolvedLocationId
                  ? affiliateResolution.byLocationId[resolvedLocationId] ?? null
                  : null) ??
                (route?.id ? affiliateResolution.byRouteId[route.id] ?? null : null);
              const externalTargetUrl =
                affiliateMatch?.targetUrl ??
                ((adjustable ? displayCandidate.external_url : stop.external_url) ?? null);
              const rawStopPhotoUrl = adjustable ? displayCandidate.photo_url : stop.photo_url;
              const stopPhotoUrl = renderableImageUrl(rawStopPhotoUrl);
              const stopPhotoAttributionMeta = rawStopPhotoUrl && rawStopPhotoUrl === stop.photo_url ? stop.meta : null;
              return (
              <div key={stop.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <div className="rounded-full border px-2.5 py-1 text-[11px]">Stop {stop.stop_order}</div>
                      {stop.is_required ? <div className="rounded-full bg-black px-2.5 py-1 text-[11px] text-white">Pflicht</div> : null}
                      {stop.duration_min != null ? <div className="rounded-full border px-2.5 py-1 text-[11px]">{stop.duration_min} Min</div> : null}
                      {adjustable ? (
                        <div className={`rounded-full px-2.5 py-1 text-[11px] ${kindTone(personalizationKind)}`}>↔ {kindLabel(personalizationKind)}</div>
                      ) : (
                        <div className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] text-emerald-800">● Fixiert</div>
                      )}
                    </div>
                    {externalTargetUrl ? (
                      <MonetizedExternalLink
                        href={externalTargetUrl}
                        targetUrl={externalTargetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                        routeId={route?.id ?? null}
                        locationId={resolvedLocationId}
                        partnerProfileId={affiliateMatch?.partnerProfileId ?? null}
                        affiliateLinkId={affiliateMatch?.id ?? null}
                        creatorProfileId={route?.creator_profile_id ?? creator?.id ?? null}
                        citySlug={route?.city_slug ?? null}
                        surface="route_detail_stop"
                        label={adjustable ? displayCandidate.title : stop.title ?? `Stop ${stop.stop_order}`}
                        source={affiliateMatch ? "route_detail_affiliate_cta" : "route_detail_stop_cta"}
                      >
                        {affiliateMatch ? `${affiliateMatch.providerName} öffnen` : "Link"}
                      </MonetizedExternalLink>
                    ) : null}
                  </div>

                  <div className="flex items-start gap-2">
                      {hasInlineSwitch ? (
                        <button
                          type="button"
                          onClick={() => cycleInlineCandidate(stop.id, "prev")}
                          className="mt-0.5 h-9 w-9 shrink-0 rounded-full border text-sm hover:bg-gray-50"
                          aria-label="Vorheriger Vorschlag"
                        >
                          ‹
                        </button>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="text-xl font-semibold leading-tight text-gray-950 sm:text-2xl">{displayCandidate.title || `Stop ${stop.stop_order}`}</div>
                        {adjustable ? (
                          <div className="mt-1 text-xs text-amber-700 line-clamp-1">
                            {inlineSwapLoading
                              ? "Passende Alternativen werden geladen..."
                              : hasInlineSwitch
                                ? `Vorschlag ${swapIndex + 1} von ${swapOptions.length}`
                                : "Aktuell kein weiterer Vorschlag verfügbar"}
                          </div>
                        ) : null}
                      </div>
                      {hasInlineSwitch ? (
                        <button
                          type="button"
                          onClick={() => cycleInlineCandidate(stop.id, "next")}
                          className="mt-0.5 h-9 w-9 shrink-0 rounded-full border text-sm hover:bg-gray-50"
                          aria-label="Nächster Vorschlag"
                        >
                          ›
                        </button>
                      ) : null}
                  </div>

                  <div className="grid gap-2 text-xs text-gray-500 sm:grid-cols-2">
                    <div className="rounded-xl bg-gray-50 px-3 py-2">
                      {displayCandidate.lat && displayCandidate.lng
                        ? `${Number(displayCandidate.lat).toFixed(4)}, ${Number(displayCandidate.lng).toFixed(4)}`
                        : stop.lat != null && stop.lng != null
                          ? `${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)}`
                          : "Ohne Kartenkoordinaten"}
                    </div>
                    {adjustable && displayCandidate.subtitle ? (
                      <div className="rounded-xl bg-amber-50 px-3 py-2 text-amber-800">{displayCandidate.subtitle}</div>
                    ) : null}
                  </div>

                  <div className="line-clamp-2 text-sm leading-6 text-gray-600">
                      {reasonTextForKind(personalizationKind)}
                  </div>
                </div>
                {stopPhotoUrl ? (
                  <div className="relative mt-3 overflow-hidden rounded-2xl border bg-gray-100">
                    <div className="absolute left-3 top-3 z-10">
                      {adjustable ? (
                        <div className="rounded-full border border-amber-200 bg-amber-100/95 px-2.5 py-1 text-[11px] font-medium text-amber-900 shadow-sm backdrop-blur">
                          ↔ Anpassbar
                        </div>
                      ) : (
                        <div className="rounded-full border border-emerald-200 bg-emerald-100/95 px-2.5 py-1 text-[11px] font-medium text-emerald-900 shadow-sm backdrop-blur">
                          ● Fixiert
                        </div>
                      )}
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={stopPhotoUrl}
                      alt={displayCandidate.title || stop.title || `Stop ${stop.stop_order}`}
                      className="h-[210px] w-full object-cover sm:h-[260px]"
                    />
                    <ImageAttribution
                      meta={stopPhotoAttributionMeta}
                      compact
                      tone="dark"
                      className="absolute inset-x-3 bottom-3 truncate rounded-full bg-black/55 px-3 py-1 backdrop-blur"
                    />
                  </div>
                ) : adjustable ? (
                  <div className="relative mt-3 overflow-hidden rounded-2xl border bg-gradient-to-br from-amber-50 via-white to-stone-100 p-4">
                    <div className="absolute left-3 top-3 z-10 rounded-full border border-amber-200 bg-amber-100/95 px-3 py-1 text-xs font-medium text-amber-900 shadow-sm backdrop-blur">
                      ↔ Anpassbar
                    </div>
                    <div className="mt-9">
                      <div className="text-xs uppercase tracking-wide text-amber-700">Aktueller Vorschlag</div>
                      <div className="mt-2 text-xl font-semibold text-gray-950">{displayCandidate.title}</div>
                      {displayCandidate.subtitle ? <div className="mt-2 text-sm text-gray-600">{displayCandidate.subtitle}</div> : null}
                    </div>
                  </div>
                ) : null}
                {(adjustable ? displayCandidate.note : stop.note) ? (
                  <div className="mt-3 line-clamp-3 rounded-xl bg-gray-50 px-3 py-2 text-sm leading-6 text-gray-700 whitespace-pre-wrap">
                    {adjustable ? displayCandidate.note : stop.note}
                  </div>
                ) : null}
              </div>
            )})}
          </div>
        )}
      </section>

      {moreFromCreator.length > 0 ? (
        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold">Mehr von diesem Creator</h2>
              <p className="text-sm text-gray-600">
                Weitere öffentliche Routen von {creatorName}.
              </p>
            </div>
            {creatorProfileHref ? (
              <Link href={creatorProfileHref} className="text-sm underline underline-offset-4">
                Profil öffnen
              </Link>
            ) : null}
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {moreFromCreator.map((suggestion) => (
              <SuggestionCard key={`creator-${suggestion.id}`} route={suggestion} cityMap={cityMap} eyebrow="Mehr vom Profil" />
            ))}
          </div>
        </section>
      ) : null}

      {(variantBaseRoute || relatedVariants.length > 0) ? (
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Variantenfamilie</h2>
              <p className="text-sm text-gray-600">
                Verknüpfte Originalroute und redaktionell eingeordnete Varianten dieser Route.
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                <span className="rounded-full border border-black/10 bg-white px-3 py-1">
                  {variantFamilyCounts.originals} Original
                  {variantFamilyCounts.originals === 1 ? "" : "e"}
                </span>
                <span className="rounded-full border border-black/10 bg-white px-3 py-1">
                  {variantFamilyCounts.variants} Variante
                  {variantFamilyCounts.variants === 1 ? "" : "n"}
                </span>
                <span className="rounded-full border border-black/10 bg-stone-50 px-3 py-1">
                  Sichtbar: {variantFamilyCounts.visibleOriginals + variantFamilyCounts.visibleVariants}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <label className="flex items-center gap-2">
                <span>Familie</span>
                <select
                  value={familyVariantFilter}
                  onChange={(e) => setFamilyVariantFilter(e.target.value as VariantFilter)}
                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-gray-900"
                >
                  <option value="all">Alle</option>
                  <option value="original">Nur Original</option>
                  <option value="variant">Nur Varianten</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span>Reihenfolge</span>
                <select
                  value={familyVariantSort}
                  onChange={(e) => setFamilyVariantSort(e.target.value as VariantSort)}
                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-gray-900"
                >
                  <option value="default">Relevanz + Aktualität</option>
                  <option value="original-first">Original zuerst</option>
                  <option value="variant-first">Varianten zuerst</option>
                </select>
              </label>
            </div>
          </div>
          <div className="-mt-2 mb-4 text-xs text-gray-500">
            {familyVariantFilter === "all"
              ? "Zeigt Basisroute und alle bekannten Varianten gemeinsam."
              : familyVariantFilter === "original"
                ? "Fokussiert auf die ursprüngliche Route als Referenz."
                : "Fokussiert auf abgeleitete, personalisierte oder redaktionelle Varianten."}
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {variantBaseRoute && matchesVariantFilter(variantBaseRoute, familyVariantFilter) ? (
              <SuggestionCard
                key={`base-${variantBaseRoute.id}`}
                route={variantBaseRoute}
                cityMap={cityMap}
                eyebrow="Original"
              />
            ) : null}
            {sortedRelatedVariants.map((suggestion) => (
              <SuggestionCard
                key={`variant-${suggestion.id}`}
                route={suggestion}
                cityMap={cityMap}
                eyebrow={routeVariantRoleLabel(suggestion, currentBaseRouteId) ?? "Weitere Variante"}
              />
            ))}
          </div>
        </section>
      ) : null}

      {similarRoutes.length > 0 ? (
        <section>
          <div className="mb-4">
            <h2 className="text-2xl font-semibold">Ähnliche Routen</h2>
            <p className="text-sm text-gray-600">
              Vorschläge mit ähnlicher Stadt, Stimmung oder öffentlicher Einordnung.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {similarRoutes.map((suggestion) => (
              <SuggestionCard key={`similar-${suggestion.id}`} route={suggestion} cityMap={cityMap} eyebrow="Ähnliche Route" />
            ))}
          </div>
        </section>
      ) : null}

      {interestMatchedRoutes.length > 0 ? (
        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold">Passt zu deinen Interessen</h2>
              <p className="text-sm text-gray-600">
                Vorschläge, die besonders gut zu deinem Profil passen{myInterests.length ? `: ${myInterests.slice(0, 4).join(", ")}` : ""}.
              </p>
            </div>
            <Link href="/profile" className="text-sm underline underline-offset-4">
              Interessen anpassen
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {interestMatchedRoutes.map((suggestion) => (
                <SuggestionCard
                  key={`interest-${suggestion.route.id}`}
                  route={suggestion.route}
                  cityMap={cityMap}
                  eyebrow="Für dein Profil"
                  reason={suggestion.reason}
                  reasonBadges={suggestion.reasonBadges}
              />
            ))}
          </div>
        </section>
      ) : null}

      {coSavedRoutes.length > 0 ? (
        <section>
          <div className="mb-4">
            <h2 className="text-2xl font-semibold">Oft gemeinsam gespeichert</h2>
            <p className="text-sm text-gray-600">
              Routen, die andere Nutzer häufig zusammen mit dieser Route gespeichert haben.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {coSavedRoutes.map((suggestion) => (
                <SuggestionCard
                  key={`cosaved-${suggestion.route.id}`}
                  route={suggestion.route}
                  cityMap={cityMap}
                  eyebrow="Gemeinsam gespeichert"
                  reason={suggestion.reason}
                  reasonBadges={suggestion.reasonBadges}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section id="route-rating" className="rounded-2xl border bg-white p-6 shadow-sm md:p-8">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-semibold">Deine Bewertung</div>
            <div className="mt-1 text-sm text-gray-600">Kurzes Feedback zu Flow, Stops und Gesamtgefühl.</div>
          </div>
          <div className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
            {route.avg_rating} / 5
          </div>
        </div>
        {!userId && authReady ? <div className="mt-3 text-sm text-gray-600">Für Likes, Bookmarks und Bewertungen bitte anmelden oder als Gast fortfahren.</div> : null}
        <div className="mt-4 mb-3 flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => { setMyRating(n); saveRating(n); }} className={`text-2xl ${n <= myRating ? "" : "opacity-30"}`} aria-label={`${n} Sterne`} type="button" disabled={!userId}>★</button>
          ))}
        </div>
        <textarea value={myReview} onChange={(e) => setMyReview(e.target.value)} placeholder="Optionales Review" className="min-h-[88px] w-full rounded-xl border p-3 text-sm" />
        <div className="mt-3">
          <button onClick={() => saveRating()} disabled={savingRating || !userId} className="rounded-xl border px-4 py-2.5 text-sm">
            {savingRating ? "Speichere..." : "Bewertung speichern"}
          </button>
        </div>
      </section>

      {toast ? (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </main>
  );
}

export default function RouteDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-7xl px-1 py-4 sm:px-2 lg:px-4">
          <div className="pd24-shell p-6 text-sm text-[var(--text-muted)]">
            Route wird geladen...
          </div>
        </main>
      }
    >
      <RouteDetailPageContent />
    </Suspense>
  );
}
