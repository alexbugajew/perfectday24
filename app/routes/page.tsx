"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import { inferPublicRouteBadges } from "@/lib/routes/public-route-badges";
import { consumeRouteBuilderDraft } from "@/lib/routes/planner-route-bridge";

const PlanMap = dynamic(() => import("@/components/PlanMap"), { ssr: false });

type CityRow = {
  slug: string;
  name: string;
  population: number | null;
};

type LocationRow = {
  id: string;
  name: string;
  type: string;
  city_slug: string | null;
  lat: number | null;
  lng: number | null;
  category?: string | null;
  meal?: string | null;
  reservation_url?: string | null;
};

type RouteVisibility = "private" | "unlisted" | "public";

type CreatorType = "user" | "creator" | "influencer" | "brand";

type StartType = "address" | "hotel" | "station" | "airport" | "other";

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
  visibility: RouteVisibility;
  creator_type: CreatorType;
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

type UserRouteStopRow = {
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
  created_at: string;
};

type DraftStop = {
  localId: string;
  dbId?: string | null;
  location_id: string | null;
  title: string;
  subtitle: string;
  note: string;
  external_url: string;
  is_required: boolean;
  duration_min: string;
  lat: string;
  lng: string;
  photo_url: string;
  isLocked?: boolean;
  personalizationKind?: "fixed" | "food_swap" | "activity_swap" | "nightlife_swap" | "ambience_swap";
  originalTitle?: string | null;
  originalStop?: {
    location_id: string | null;
    title: string;
    subtitle: string;
    note?: string;
    external_url: string;
    lat: string;
    lng: string;
    photo_url?: string;
  };
  swapCandidates?: Array<{
    location_id: string | null;
    title: string;
    subtitle: string;
    note?: string;
    external_url: string;
    lat: string;
    lng: string;
    photo_url?: string;
  }>;
};

type BuilderTab = "builder" | "mine" | "public";
type RouteOccasion = "none" | "date" | "family" | "friends" | "tourism" | "party";
type RouteProfileMode = "none" | "foot" | "public_transit" | "car";
type RouteTheme = "none" | "food" | "culture" | "outdoor" | "nightlife" | "mixed";

type ToastKind = "success" | "error" | "info";

type ToastState = {
  message: string;
  kind: ToastKind;
} | null;

type MapStop = {
  label: string;
  name: string;
  lat: number;
  lng: number;
};

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function numOrNull(v: string) {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function creatorLabel(v: string | null) {
  if (v === "influencer") return "Influencer";
  if (v === "creator") return "Creator";
  if (v === "brand") return "Brand";
  return "User";
}

function visibilityLabel(v: RouteVisibility) {
  if (v === "public") return "Öffentlich";
  if (v === "unlisted") return "Nicht gelistet";
  return "Privat";
}

function visibilityDescription(v: RouteVisibility) {
  if (v === "public") return "Die Route erscheint öffentlich in Explore und auf Profilseiten.";
  if (v === "unlisted") return "Die Route ist nur über den direkten Link erreichbar.";
  return "Nur du siehst die Route in deinem Profil und im Builder.";
}

function routeOccasionLabel(value: RouteOccasion) {
  if (value === "date") return "Date";
  if (value === "family") return "Family";
  if (value === "friends") return "Friends";
  if (value === "tourism") return "Tourism";
  if (value === "party") return "Party";
  return "Offen";
}

function routeProfileLabel(value: RouteProfileMode) {
  if (value === "foot") return "Zu Fuß";
  if (value === "public_transit") return "ÖPNV";
  if (value === "car") return "Mit Auto";
  return "Offen";
}

function routeThemeLabel(value: RouteTheme) {
  if (value === "food") return "Food";
  if (value === "culture") return "Kultur";
  if (value === "outdoor") return "Outdoor";
  if (value === "nightlife") return "Nightlife";
  if (value === "mixed") return "Mixed";
  return "Offen";
}

function normalizeRouteTags(input: string) {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function computeDurationBucket(stopCount: number) {
  if (stopCount <= 2) return "short";
  if (stopCount <= 4) return "halfday";
  if (stopCount <= 6) return "extended";
  return "fullday";
}

function durationBucketLabel(value: unknown) {
  if (value === "short") return "Kurz";
  if (value === "halfday") return "Halbtag";
  if (value === "extended") return "Extended";
  if (value === "fullday") return "Ganztägig";
  return null;
}

function stopTitle(stop: DraftStop, index: number) {
  return stop.title.trim() || `Stop ${index + 1}`;
}

function stopSummary(stop: DraftStop) {
  const parts = [
    stop.duration_min ? `${stop.duration_min} Min` : null,
    stop.personalizationKind && stop.personalizationKind !== "fixed" ? "anpassbar" : null,
    stop.isLocked ? "fixiert" : null,
    stop.external_url.trim() ? "Link" : null,
    stop.photo_url.trim() ? "Foto" : null,
    stop.lat.trim() && stop.lng.trim() ? "Karte" : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "Noch keine Details";
}

function personalizationKindLabel(kind?: DraftStop["personalizationKind"]) {
  if (kind === "food_swap") return "Food";
  if (kind === "activity_swap") return "Aktivität";
  if (kind === "nightlife_swap") return "Nightlife";
  if (kind === "ambience_swap") return "Ambiente";
  return "Stop";
}

function buildFallbackUsername(userId: string, preferred?: string | null) {
  const cleanPreferred = (preferred ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "");
  if (cleanPreferred.length >= 3) return cleanPreferred;
  return `user-${userId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase()}`;
}

function buildFallbackDisplayName(
  userId: string,
  preferred?: string | null,
  username?: string | null
) {
  const cleanPreferred = (preferred ?? "").trim();
  if (cleanPreferred) return cleanPreferred;
  const cleanUsername = (username ?? "").trim();
  if (cleanUsername) return cleanUsername;
  return `User ${userId.replace(/[^a-z0-9]/gi, "").slice(0, 6)}`;
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

  if (!("message" in serialized) && "message" in record) serialized.message = record.message;
  if (!("details" in serialized) && "details" in record) serialized.details = record.details;
  if (!("hint" in serialized) && "hint" in record) serialized.hint = record.hint;
  if (!("code" in serialized) && "code" in record) serialized.code = record.code;

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

  const formatted = formatSupabaseError(error)
    .replace(/\s+/g, " ")
    .trim();

  if (!formatted || formatted === "{}") return "unbekannter Fehler";
  return formatted.slice(0, 180);
}

async function ensureCreatorProfileId(userId: string) {
  const { data: existing, error: existingError } = await supabase
    .from("creator_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const existingId = (existing as { id?: string | null } | null)?.id ?? null;
  if (existingId) return existingId;

  const { data: userData } = await supabase.auth.getUser();
  const metadata = (userData.user?.user_metadata ?? {}) as Record<string, unknown>;

  const fallbackUsername = buildFallbackUsername(
    userId,
    typeof metadata.preferred_username === "string"
      ? metadata.preferred_username
      : typeof metadata.user_name === "string"
        ? metadata.user_name
        : typeof metadata.name === "string"
          ? metadata.name
          : typeof metadata.full_name === "string"
            ? metadata.full_name
            : null
  );

  const { data: created, error: createError } = await supabase
    .from("creator_profiles")
    .insert({
      user_id: userId,
      username: fallbackUsername,
      display_name: buildFallbackDisplayName(
        userId,
        typeof metadata.full_name === "string"
          ? metadata.full_name
          : typeof metadata.name === "string"
            ? metadata.name
            : null,
        fallbackUsername
      ),
      avatar_url: typeof metadata.avatar_url === "string" ? metadata.avatar_url : null,
      creator_type: "user",
    })
    .select("id")
    .single();

  if (createError) {
    throw createError;
  }

  return (created as { id: string }).id;
}

async function buildUniqueRouteSlug(baseTitle: string, currentRouteId?: string | null) {
  const base = slugify(baseTitle) || `route-${Date.now()}`;
  let candidate = base;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await supabase
      .from("user_routes")
      .select("id, slug")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const existingId = (data as { id?: string | null } | null)?.id ?? null;
    if (!existingId || existingId === currentRouteId) {
      return candidate;
    }

    candidate = `${base}-${attempt + 2}`;
  }

  return `${base}-${Date.now()}`;
}

function RoutesPageContent() {
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [cities, setCities] = useState<CityRow[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);

  const [myRoutes, setMyRoutes] = useState<UserRouteRow[]>([]);
  const [publicRoutes, setPublicRoutes] = useState<UserRouteRow[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);

  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<UserRouteRow | null>(null);
  const [routeStops, setRouteStops] = useState<UserRouteStopRow[]>([]);
  const [routeStopsLoading, setRouteStopsLoading] = useState(false);

  const [savingRoute, setSavingRoute] = useState(false);
  const [savingStops, setSavingStops] = useState(false);
  const [routeDescriptionLoading, setRouteDescriptionLoading] = useState(false);

  const [tab, setTab] = useState<BuilderTab>("builder");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCitySlug, setSelectedCitySlug] = useState<string>("");
  const [visibility, setVisibility] = useState<RouteVisibility>("private");
  const [creatorType, setCreatorType] = useState<CreatorType>("user");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [routeOccasion, setRouteOccasion] = useState<RouteOccasion>("none");
  const [routeProfileMode, setRouteProfileMode] = useState<RouteProfileMode>("none");
  const [routeTheme, setRouteTheme] = useState<RouteTheme>("none");
  const [routeTagsInput, setRouteTagsInput] = useState("");
  const [variantLabel, setVariantLabel] = useState("");

  const [startType, setStartType] = useState<StartType>("address");
  const [startLabel, setStartLabel] = useState("");
  const [startLat, setStartLat] = useState("");
  const [startLng, setStartLng] = useState("");

  const [locationSearch, setLocationSearch] = useState("");
  const [locationResults, setLocationResults] = useState<LocationRow[]>([]);
  const [searchingLocations, setSearchingLocations] = useState(false);

  const [draftStops, setDraftStops] = useState<DraftStop[]>([]);
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [plannerImportLabel, setPlannerImportLabel] = useState<string | null>(null);
  const [plannerImportAdjustedCount, setPlannerImportAdjustedCount] = useState(0);
  const [plannerImportAdjustableCount, setPlannerImportAdjustableCount] = useState(0);
  const [plannerImportKind, setPlannerImportKind] = useState<"planner" | "personalized_route" | null>(null);
  const [plannerImportGroupLabel, setPlannerImportGroupLabel] = useState<string | null>(null);
  const [plannerImportSourceRouteId, setPlannerImportSourceRouteId] = useState<string | null>(null);
  const [plannerImportSourceRouteSlug, setPlannerImportSourceRouteSlug] = useState<string | null>(null);
  const [plannerImportSourceRouteTitle, setPlannerImportSourceRouteTitle] = useState<string | null>(null);
  const [plannerImportInterests, setPlannerImportInterests] = useState<string[]>([]);
  const [plannerImportMembers, setPlannerImportMembers] = useState<
    Array<{ name: string; interests?: string[]; isCurrentUser?: boolean }>
  >([]);
  const [variantBaseRoute, setVariantBaseRoute] = useState<{ id: string | null; slug: string | null; title: string | null } | null>(null);

  const [toast, setToast] = useState<ToastState>(null);
  const deepLinkedRouteId = searchParams.get("routeId");

  function showToast(message: string, kind: ToastKind = "info") {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 2200);
  }

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;

    let active = true;

    (async () => {
      try {
        const { data: s, error } = await supabase.auth.getSession();
        if (error) console.error("getSession error:", error);
        if (!active) return;
        setUserId(s.session?.user?.id ?? null);
        setAuthReady(true);
      } catch (e) {
        console.error("Auth init failed:", e);
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
  }, [mounted]);

  async function continueAsGuest() {
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error("Anonymous auth error:", error);
        showToast(`Gastzugang fehlgeschlagen: ${error.message}`, "error");
        return;
      }

      setUserId(data.user?.id ?? null);
      setAuthReady(true);
      showToast("Gastzugang ist aktiv. Du kannst direkt weiterarbeiten.", "success");
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    if (!mounted) return;

    (async () => {
      setCitiesLoading(true);
      try {
        const { data, error } = await supabase
          .from("cities")
          .select("slug,name,population")
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
  }, [mounted]);

  async function loadRoutes() {
    setRoutesLoading(true);
    try {
      if (userId) {
        const { data: mine, error: mineError } = await supabase
          .from("user_routes")
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false });

        if (mineError) {
          console.error("My routes load error:", mineError);
          setMyRoutes([]);
        } else {
          setMyRoutes((mine as UserRouteRow[]) ?? []);
        }
      } else {
        setMyRoutes([]);
      }

      const { data: pub, error: pubError } = await supabase
        .from("user_routes")
        .select("*")
        .eq("visibility", "public")
        .order("like_count", { ascending: false })
        .limit(50);

      if (pubError) {
        console.error("Public routes load error:", pubError);
        setPublicRoutes([]);
      } else {
        setPublicRoutes((pub as UserRouteRow[]) ?? []);
      }
    } finally {
      setRoutesLoading(false);
    }
  }

  useEffect(() => {
    if (!authReady) return;
    void loadRoutes();
  }, [authReady, userId]);

  useEffect(() => {
    if (!deepLinkedRouteId || !myRoutes.length) return;

    const target = myRoutes.find((route) => route.id === deepLinkedRouteId);
    if (!target) return;

    hydrateEditorFromRoute(target);
  }, [deepLinkedRouteId, myRoutes]);

  useEffect(() => {
    if (!mounted) return;

    const draft = consumeRouteBuilderDraft();
    if (!draft) return;

    resetEditor();
    setTitle(draft.title ?? "");
    setDescription(draft.description ?? "");
    setSelectedCitySlug(draft.citySlug ?? "");
    setCoverImageUrl(draft.coverImageUrl ?? "");
    setRouteOccasion(draft.routeOccasion ?? "none");
    setRouteProfileMode(draft.routeProfileMode ?? "none");
    setRouteTheme(draft.routeTheme ?? "none");
    setRouteTagsInput(Array.isArray(draft.routeTags) ? draft.routeTags.join(", ") : "");
    setVariantLabel(draft.sourceKind === "personalized_route" ? "Persönliche Variante" : "");
    setStartType(draft.startType ?? "address");
    setStartLabel(draft.startLabel ?? "");
    setStartLat(draft.startLat ?? "");
    setStartLng(draft.startLng ?? "");

    const hydratedStops = Array.isArray(draft.draftStops)
      ? draft.draftStops.map((stop) => ({
          localId: uid(),
          dbId: null,
          location_id: stop.location_id,
          title: stop.title ?? "",
          subtitle: stop.subtitle ?? "Aus dem Planner",
          note: stop.note ?? "",
          external_url: stop.external_url ?? "",
          is_required: Boolean(stop.is_required),
          duration_min: stop.duration_min ?? "",
          lat: stop.lat ?? "",
          lng: stop.lng ?? "",
          photo_url: stop.photo_url ?? "",
          isLocked: Boolean(stop.isLocked),
          personalizationKind: stop.personalizationKind,
          originalTitle: stop.originalTitle ?? null,
          originalStop: stop.originalStop,
          swapCandidates: Array.isArray(stop.swapCandidates) ? stop.swapCandidates : [],
        }))
      : [];

      setDraftStops(hydratedStops);
      setActiveStopId(hydratedStops[0]?.localId ?? null);
      setPlannerImportLabel(draft.sourcePlanTitle?.trim() || draft.title?.trim() || "Planner-Entwurf");
      setPlannerImportKind(draft.sourceKind ?? "planner");
      setPlannerImportGroupLabel(draft.sourceGroupLabel ?? null);
      setPlannerImportSourceRouteId(draft.sourceRouteId ?? null);
      setPlannerImportSourceRouteSlug(draft.sourceRouteSlug ?? null);
      setPlannerImportSourceRouteTitle(draft.sourceRouteTitle ?? null);
      setVariantBaseRoute(
        draft.sourceRouteId || draft.sourceRouteSlug || draft.sourceRouteTitle
          ? {
              id: draft.sourceRouteId ?? null,
              slug: draft.sourceRouteSlug ?? null,
              title: draft.sourceRouteTitle ?? null,
            }
          : null
      );
      setPlannerImportInterests(Array.isArray(draft.sourceInterests) ? draft.sourceInterests.filter((value): value is string => typeof value === "string") : []);
      setPlannerImportMembers(Array.isArray(draft.sourceMembers) ? draft.sourceMembers.filter((value): value is { name: string; interests?: string[]; isCurrentUser?: boolean } => !!value && typeof value === "object" && typeof value.name === "string") : []);
      setPlannerImportAdjustableCount(
        hydratedStops.filter((stop) => stop.personalizationKind && stop.personalizationKind !== "fixed").length
      );
    setPlannerImportAdjustedCount(
      hydratedStops.filter(
        (stop) =>
          stop.personalizationKind &&
          stop.personalizationKind !== "fixed" &&
          typeof stop.originalTitle === "string" &&
          stop.originalTitle.trim().length > 0 &&
          stop.originalTitle.trim().toLowerCase() !== stop.title.trim().toLowerCase()
      ).length
    );
    setTab("builder");
    showToast("Der Plan liegt jetzt als Creator-Route im Builder bereit.", "success");
  }, [mounted]);

  async function loadRouteStops(routeId: string) {
    setRouteStopsLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_route_stops")
        .select("*")
        .eq("route_id", routeId)
        .order("stop_order", { ascending: true });

      if (error) {
        console.error("Route stops load error:", error);
        setRouteStops([]);
        return;
      }

      setRouteStops((data as UserRouteStopRow[]) ?? []);
    } finally {
      setRouteStopsLoading(false);
    }
  }

  function resetEditor() {
    setSelectedRouteId(null);
    setSelectedRoute(null);
    setPlannerImportLabel(null);
    setPlannerImportKind(null);
    setPlannerImportGroupLabel(null);
    setPlannerImportSourceRouteId(null);
    setPlannerImportSourceRouteSlug(null);
    setPlannerImportSourceRouteTitle(null);
    setPlannerImportInterests([]);
    setPlannerImportMembers([]);
    setVariantBaseRoute(null);
    setPlannerImportAdjustedCount(0);
    setPlannerImportAdjustableCount(0);
    setTitle("");
    setDescription("");
    setSelectedCitySlug("");
    setVisibility("private");
    setCreatorType("user");
    setCoverImageUrl("");
    setRouteOccasion("none");
    setRouteProfileMode("none");
    setRouteTheme("none");
    setRouteTagsInput("");
    setVariantLabel("");
    setStartType("address");
    setStartLabel("");
    setStartLat("");
    setStartLng("");
    setLocationSearch("");
    setLocationResults([]);
    setDraftStops([]);
    setRouteStops([]);
    setActiveStopId(null);
    setTab("builder");
  }

  function hydrateEditorFromRoute(route: UserRouteRow) {
    const meta = route.meta && typeof route.meta === "object" ? (route.meta as Record<string, unknown>) : {};
    const tags = Array.isArray(route.tags)
      ? route.tags.filter((value): value is string => typeof value === "string")
      : [];
    const personalizedVariantMeta =
      meta.personalizedVariant && typeof meta.personalizedVariant === "object"
        ? (meta.personalizedVariant as Record<string, unknown>)
        : null;

    setSelectedRouteId(route.id);
    setSelectedRoute(route);

    setTitle(route.title ?? "");
    setDescription(route.description ?? "");
    setSelectedCitySlug(route.city_slug ?? "");
    setVisibility(route.visibility);
    setCreatorType(route.creator_type);
    setCoverImageUrl(route.cover_image_url ?? "");
    setRouteOccasion(
      typeof meta.occasion === "string" &&
        ["date", "family", "friends", "tourism", "party"].includes(meta.occasion)
        ? (meta.occasion as RouteOccasion)
        : "none"
    );
    setRouteProfileMode(
      typeof meta.routeProfile === "string" && ["foot", "car"].includes(meta.routeProfile)
        ? (meta.routeProfile as RouteProfileMode)
        : "none"
    );
    setRouteTheme(
      typeof meta.primaryTheme === "string" &&
        ["food", "culture", "outdoor", "nightlife", "mixed"].includes(meta.primaryTheme)
        ? (meta.primaryTheme as RouteTheme)
        : "none"
    );
    setRouteTagsInput(tags.join(", "));
    setVariantLabel(
      typeof personalizedVariantMeta?.variantName === "string" ? personalizedVariantMeta.variantName : ""
    );
    setVariantBaseRoute(
      personalizedVariantMeta &&
        (typeof personalizedVariantMeta.baseRouteId === "string" ||
          typeof personalizedVariantMeta.baseRouteSlug === "string" ||
          typeof personalizedVariantMeta.baseRouteTitle === "string")
        ? {
            id: typeof personalizedVariantMeta.baseRouteId === "string" ? personalizedVariantMeta.baseRouteId : null,
            slug: typeof personalizedVariantMeta.baseRouteSlug === "string" ? personalizedVariantMeta.baseRouteSlug : null,
            title: typeof personalizedVariantMeta.baseRouteTitle === "string" ? personalizedVariantMeta.baseRouteTitle : null,
          }
        : null
    );

    setStartType((route.start_type as StartType) || "address");
    setStartLabel(route.start_label ?? "");
    setStartLat(route.start_lat != null ? String(route.start_lat) : "");
    setStartLng(route.start_lng != null ? String(route.start_lng) : "");
    setTab("builder");
  }

  async function generateRouteDescription() {
    if (!title.trim() && draftStops.length === 0) {
      showToast("Für KI-Text brauchst du mindestens einen Routentitel oder einen Stop.", "error");
      return;
    }

    setRouteDescriptionLoading(true);
    try {
      const interests = Array.from(
        new Set(
          [
            ...normalizeRouteTags(routeTagsInput),
            ...plannerImportInterests,
            routeTheme !== "none" ? routeThemeLabel(routeTheme) : null,
            routeOccasion !== "none" ? routeOccasionLabel(routeOccasion) : null,
          ]
            .filter(Boolean)
            .map((value) => String(value))
        )
      );

      const res = await fetch("/api/generate-plan-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "route_description",
          routeTitle: title.trim() || "Neue Route",
          cityLabel: cities.find((city) => city.slug === selectedCitySlug)?.name ?? selectedCitySlug,
          filters: {
            planMode: computeDurationBucket(draftStops.length),
            budget: "offen",
            occasion: routeOccasionLabel(routeOccasion),
            routeProfile: routeProfileLabel(routeProfileMode),
            theme: routeThemeLabel(routeTheme),
            groupEnabled: plannerImportMembers.length > 0,
          },
          interests,
          slots: draftStops.map((stop, index) => ({
            index: index + 1,
            label: stop.subtitle || stop.title || `Stop ${index + 1}`,
            hint: stop.note || stop.subtitle || "Teil der Route",
            durationMin: numOrNull(stop.duration_min),
            travelMinFromPrev: null,
            location: {
              id: stop.location_id ?? stop.localId,
              name: stop.title || `Stop ${index + 1}`,
              type: stop.subtitle || routeThemeLabel(routeTheme),
              reservation_url: stop.external_url.trim() || null,
            },
          })),
        }),
      });

      if (!res.ok) {
        showToast(`KI-Text konnte nicht erzeugt werden (${res.status})`, "error");
        return;
      }

      const json = (await res.json()) as { text?: unknown };
      const text = typeof json.text === "string" ? json.text.trim() : "";
      if (!text) {
        showToast("Die KI hat keinen Text zurückgegeben.", "error");
        return;
      }

      setDescription(text);
      showToast("Beschreibung wurde automatisch gefüllt.", "success");
    } catch (error) {
      console.error("Route description generation failed:", error);
      showToast("KI-Text konnte nicht erzeugt werden.", "error");
    } finally {
      setRouteDescriptionLoading(false);
    }
  }

  async function handleCreateOrUpdateRoute() {
    if (!userId) {
      showToast("Kein User verfuegbar", "error");
      return;
    }

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      showToast("Bitte einen Titel eingeben", "error");
      return;
    }

    if (!selectedCitySlug) {
      showToast("Bitte zuerst eine Stadt auswaehlen", "error");
      return;
    }

    if (visibility !== "private" && draftStops.length === 0) {
      showToast("Für veröffentlichte oder geteilte Routen brauchst du mindestens einen Stop.", "error");
      return;
    }

    setSavingRoute(true);
    try {
      const creatorProfileId = await ensureCreatorProfileId(userId);
      const routeSlug = await buildUniqueRouteSlug(cleanTitle, selectedRouteId);
      const normalizedTags = normalizeRouteTags(routeTagsInput);
      const mergedTags = Array.from(
        new Set(
          [
            ...normalizedTags,
            routeOccasion !== "none" ? routeOccasion : null,
            routeProfileMode !== "none" ? routeProfileMode : null,
            routeTheme !== "none" ? routeTheme : null,
            plannerImportKind === "personalized_route" ? "personalized-variant" : null,
          ].filter(Boolean) as string[]
        )
      );
      const meta = {
        occasion: routeOccasion !== "none" ? routeOccasion : null,
        routeProfile: routeProfileMode !== "none" ? routeProfileMode : null,
        primaryTheme: routeTheme !== "none" ? routeTheme : null,
        durationBucket: computeDurationBucket(draftStops.length),
        routeTags: mergedTags,
        personalizedVariant:
          plannerImportKind === "personalized_route"
            ? {
                variantName: variantLabel.trim() || null,
                baseRouteId: variantBaseRoute?.id ?? null,
                baseRouteSlug: variantBaseRoute?.slug ?? null,
                baseRouteTitle: variantBaseRoute?.title ?? null,
                sourceLabel: plannerImportLabel ?? null,
                groupLabel: plannerImportGroupLabel ?? null,
                interests: plannerImportInterests,
                members: plannerImportMembers,
                adjustableCount: plannerImportAdjustableCount,
                adjustedCount: plannerImportAdjustedCount,
                savedAt: new Date().toISOString(),
              }
            : null,
      };

      const payload = {
        user_id: userId,
        creator_profile_id: creatorProfileId,
        city_slug: selectedCitySlug,
        title: cleanTitle,
        slug: routeSlug,
        description: description.trim() || null,
        cover_image_url: coverImageUrl.trim() || null,
        start_label: startLabel.trim() || null,
        start_type: startType,
        start_lat: numOrNull(startLat),
        start_lng: numOrNull(startLng),
        visibility,
        creator_type: creatorType,
        tags: mergedTags,
        meta,
      };

      if (selectedRouteId) {
        const { error } = await supabase
          .from("user_routes")
          .update(payload)
          .eq("id", selectedRouteId)
          .eq("user_id", userId);

        if (error) {
          console.error(`Route update error: ${formatSupabaseError(error)}`);
          console.error("Route update payload:", payload);
          showToast(`Route konnte nicht gespeichert werden (${summarizeErrorForUi(error)})`, "error");
          return;
        }

        showToast("Route aktualisiert. Inhalt und Metadaten sind jetzt auf dem neuesten Stand.", "success");
      } else {
        const { error } = await supabase.from("user_routes").insert(payload);

        if (error) {
          console.error(`Route create error: ${formatSupabaseError(error)}`);
          console.error("Route create payload:", payload);
          showToast(`Route konnte nicht erstellt werden (${summarizeErrorForUi(error)})`, "error");
          return;
        }

        showToast("Route angelegt. Du kannst jetzt Stops und Veröffentlichungsdetails ausarbeiten.", "success");
      }

      await loadRoutes();

      if (!selectedRouteId) {
        const { data: fresh, error: freshError } = await supabase
          .from("user_routes")
          .select("*")
          .eq("user_id", userId)
          .eq("slug", routeSlug)
          .maybeSingle();

        if (freshError) {
          console.error("Route refetch error:", formatSupabaseError(freshError));
        } else if (fresh) {
          hydrateEditorFromRoute(fresh as UserRouteRow);
        }
      }
    } catch (error) {
      console.error(`Route save pipeline error: ${formatSupabaseError(error)}`);
      showToast(`Route konnte nicht gespeichert werden (${summarizeErrorForUi(error)})`, "error");
    } finally {
      setSavingRoute(false);
    }
  }
async function handleDeleteRoute(routeId: string) {
    if (!userId) return;

    const ok = window.confirm("Route wirklich löschen?");
    if (!ok) return;

    const { error } = await supabase
      .from("user_routes")
      .delete()
      .eq("id", routeId)
      .eq("user_id", userId);

    if (error) {
      console.error("Route delete error:", error);
      showToast("Route konnte nicht gelöscht werden", "error");
      return;
    }

    if (selectedRouteId === routeId) resetEditor();
    await loadRoutes();
      showToast("Route entfernt.", "success");
  }

  useEffect(() => {
    if (!selectedRouteId) return;
    void loadRouteStops(selectedRouteId);
  }, [selectedRouteId]);

  useEffect(() => {
    if (!selectedRouteId) return;
    if (!routeStops.length) {
      setDraftStops([]);
      setActiveStopId(null);
      return;
    }

    const hydrated = routeStops.map((s) => ({
      localId: s.id,
      dbId: s.id,
      location_id: s.location_id,
      title: s.title ?? "",
      subtitle: s.location_id ? "Verknuepfte Location" : "Freier Stop",
      note: s.note ?? "",
      external_url: s.external_url ?? "",
      is_required: s.is_required,
      duration_min: s.duration_min != null ? String(s.duration_min) : "",
      lat: s.lat != null ? String(s.lat) : "",
      lng: s.lng != null ? String(s.lng) : "",
      photo_url: s.photo_url ?? "",
    }));

    setDraftStops(hydrated);
    setActiveStopId(hydrated[0]?.localId ?? null);
  }, [routeStops, selectedRouteId]);

  async function searchLocations() {
    if (!selectedCitySlug) {
      showToast("Wähle zuerst eine Stadt, damit die Suche passende Orte findet.", "error");
      return;
    }

    const q = locationSearch.trim();
    if (!q) {
      setLocationResults([]);
      return;
    }

    setSearchingLocations(true);
    try {
      const { data, error } = await supabase
        .from("locations")
        .select("id,name,type,city_slug,lat,lng,category,meal,reservation_url")
        .eq("city_slug", selectedCitySlug)
        .or(`name.ilike.%${q}%,type.ilike.%${q}%`)
        .limit(20);

      if (error) {
        console.error("Location search error:", error);
        setLocationResults([]);
        return;
      }

      setLocationResults((data as LocationRow[]) ?? []);
    } finally {
      setSearchingLocations(false);
    }
  }

  function addLocationStop(loc: LocationRow) {
    const next: DraftStop = {
      localId: uid(),
      location_id: loc.id,
      title: loc.name,
      subtitle: [loc.type, loc.category].filter(Boolean).join(" | "),
      note: "",
      external_url: loc.reservation_url ?? "",
      is_required: false,
      duration_min: "",
      lat: loc.lat != null ? String(loc.lat) : "",
      lng: loc.lng != null ? String(loc.lng) : "",
      photo_url: "",
    };

    setDraftStops((prev) => [...prev, next]);
    setActiveStopId(next.localId);
    showToast("Stop hinzugefügt. Du kannst ihn rechts direkt weiter ausarbeiten.", "success");
  }

  function addManualStop() {
    const next: DraftStop = {
      localId: uid(),
      location_id: null,
      title: "",
      subtitle: "Freier Stop",
      note: "",
      external_url: "",
      is_required: false,
      duration_min: "",
      lat: "",
      lng: "",
      photo_url: "",
    };

    setDraftStops((prev) => [...prev, next]);
    setActiveStopId(next.localId);
  }

  function updateDraftStop(localId: string, patch: Partial<DraftStop>) {
    setDraftStops((prev) => prev.map((s) => (s.localId === localId ? { ...s, ...patch } : s)));
  }

  function applySwapCandidate(localId: string, candidate: NonNullable<DraftStop["swapCandidates"]>[number]) {
    setDraftStops((prev) =>
      prev.map((stop) =>
        stop.localId === localId
          ? {
              ...stop,
              location_id: candidate.location_id,
              title: candidate.title,
              subtitle: candidate.subtitle,
              note: candidate.note ?? stop.note,
              external_url: candidate.external_url,
              lat: candidate.lat,
              lng: candidate.lng,
              photo_url: candidate.photo_url ?? "",
            }
          : stop
      )
    );
    showToast("Alternative übernommen. Der Stop ist jetzt auf die neue Variante umgestellt.", "success");
  }

  function restoreOriginalStop(localId: string) {
    setDraftStops((prev) =>
      prev.map((stop) =>
        stop.localId === localId && stop.originalStop
          ? {
              ...stop,
              location_id: stop.originalStop.location_id,
              title: stop.originalStop.title,
              subtitle: stop.originalStop.subtitle,
              note: stop.originalStop.note ?? "",
              external_url: stop.originalStop.external_url,
              lat: stop.originalStop.lat,
              lng: stop.originalStop.lng,
              photo_url: stop.originalStop.photo_url ?? "",
            }
          : stop
      )
    );
    showToast("Originaler Stop wiederhergestellt.", "success");
  }

  function applyNextSwapCandidate(localId: string) {
    const stop = draftStops.find((entry) => entry.localId === localId);
    const candidates = stop?.swapCandidates ?? [];
    if (!stop || candidates.length === 0) return;

    const currentIndex = candidates.findIndex(
      (candidate) =>
        candidate.location_id === stop.location_id ||
        (candidate.title.trim().toLowerCase() === stop.title.trim().toLowerCase() &&
          candidate.external_url.trim() === stop.external_url.trim())
    );
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % candidates.length : 0;
    applySwapCandidate(localId, candidates[nextIndex]);
  }

  function removeDraftStop(localId: string) {
    setDraftStops((prev) => prev.filter((s) => s.localId !== localId));
    if (activeStopId === localId) {
      const remaining = draftStops.filter((s) => s.localId !== localId);
      setActiveStopId(remaining[0]?.localId ?? null);
    }
  }

  function moveDraftStop(localId: string, dir: "up" | "down") {
    setDraftStops((prev) => {
      const idx = prev.findIndex((x) => x.localId === localId);
      if (idx < 0) return prev;

      const next = [...prev];
      const swapIdx = dir === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;

      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  }

  function duplicateAsVariant() {
    const cleanVariantLabel = variantLabel.trim();
    const baseTitle =
      plannerImportLabel?.trim() ||
      selectedRoute?.title?.trim() ||
      title.trim() ||
      "Persönliche Route";

    const nextTitle =
      cleanVariantLabel.length > 0 && !baseTitle.toLowerCase().includes(cleanVariantLabel.toLowerCase())
        ? `${baseTitle} – ${cleanVariantLabel}`
        : baseTitle;

    setSelectedRouteId(null);
    setSelectedRoute(null);
    setVisibility("private");
    setTitle(nextTitle);
    setVariantBaseRoute((prev) => {
      if (prev) return prev;
      if (selectedRoute) {
        return {
          id: selectedRoute.id,
          slug: selectedRoute.slug,
          title: selectedRoute.title,
        };
      }
      if (plannerImportSourceRouteId || plannerImportSourceRouteSlug || plannerImportSourceRouteTitle) {
        return {
          id: plannerImportSourceRouteId,
          slug: plannerImportSourceRouteSlug,
          title: plannerImportSourceRouteTitle,
        };
      }
      return null;
    });
    showToast("Neue Variante vorbereitet. Beim nächsten Speichern entsteht ein eigener Routenstand.", "success");
  }

  async function saveStops() {
    if (!userId || !selectedRouteId) {
      showToast("Speichere zuerst die Route, bevor du die Stops dauerhaft ablegst.", "error");
      return;
    }

    setSavingStops(true);
    try {
      const { error: delError } = await supabase
        .from("user_route_stops")
        .delete()
        .eq("route_id", selectedRouteId);

      if (delError) {
        console.error(`Delete old stops error: ${formatSupabaseError(delError)}`);
        showToast(`Stops konnten nicht aktualisiert werden (${summarizeErrorForUi(delError)})`, "error");
        return;
      }

      if (!draftStops.length) {
        await loadRouteStops(selectedRouteId);
        showToast("Leere Route gespeichert. Du kannst jetzt schrittweise Stops ergänzen.", "success");
        return;
      }

      const payload = draftStops.map((s, index) => ({
        route_id: selectedRouteId,
        stop_order: index + 1,
        location_id: s.location_id,
        title: s.title.trim() || null,
        note: s.note.trim() || null,
        external_url: s.external_url.trim() || null,
        is_required: s.is_required,
        duration_min: numOrNull(s.duration_min),
        lat: numOrNull(s.lat),
        lng: numOrNull(s.lng),
        photo_url: s.photo_url.trim() || null,
      }));

      const { error: insError } = await supabase.from("user_route_stops").insert(payload);

      if (insError) {
        console.error(`Insert stops error: ${formatSupabaseError(insError)}`);
        console.error("Insert stops payload:", payload);
        showToast(`Stops konnten nicht gespeichert werden (${summarizeErrorForUi(insError)})`, "error");
        return;
      }

      await loadRouteStops(selectedRouteId);
      showToast("Stops gespeichert. Reihenfolge und Inhalte sind jetzt gesichert.", "success");
    } catch (error) {
      console.error(`Save stops pipeline error: ${formatSupabaseError(error)}`);
      showToast(`Stops konnten nicht gespeichert werden (${summarizeErrorForUi(error)})`, "error");
    } finally {
      setSavingStops(false);
    }
  }

  const selectedCityName = useMemo(
    () => cities.find((c) => c.slug === selectedCitySlug)?.name ?? "-",
    [cities, selectedCitySlug]
  );

  const activeStop = useMemo(
    () => draftStops.find((s) => s.localId === activeStopId) ?? null,
    [draftStops, activeStopId]
  );
  const plannerImportKindSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const stop of draftStops) {
      const kind = stop.personalizationKind;
      if (!kind || kind === "fixed") continue;
      counts[kind] = (counts[kind] ?? 0) + 1;
    }
    return Object.entries(counts);
  }, [draftStops]);

  const publishChecks = useMemo(
    () => [
      { label: "Titel gesetzt", ok: title.trim().length > 0 },
      { label: "Stadt gewählt", ok: selectedCitySlug.trim().length > 0 },
      { label: "Mindestens ein Stop", ok: draftStops.length > 0 },
      { label: "Route gespeichert", ok: Boolean(selectedRouteId) },
    ],
    [title, selectedCitySlug, draftStops.length, selectedRouteId]
  );

  const canShareRoute = useMemo(
    () => title.trim().length > 0 && selectedCitySlug.trim().length > 0 && draftStops.length > 0,
    [title, selectedCitySlug, draftStops.length]
  );

  const publishReadyCount = useMemo(
    () => publishChecks.filter((item) => item.ok).length,
    [publishChecks]
  );

  const builderMapStops = useMemo(() => {
    const pts: MapStop[] = [];

    const sLat = numOrNull(startLat);
    const sLng = numOrNull(startLng);
    if (sLat != null && sLng != null) {
      pts.push({
        label: "Start",
        name: startLabel.trim() || "Startpunkt",
        lat: sLat,
        lng: sLng,
      });
    }

    draftStops.forEach((stop, idx) => {
      const lat = numOrNull(stop.lat);
      const lng = numOrNull(stop.lng);
      if (lat != null && lng != null) {
        pts.push({
          label: `Stop ${idx + 1}`,
          name: stopTitle(stop, idx),
          lat,
          lng,
        });
      }
    });

    return pts;
  }, [draftStops, startLat, startLng, startLabel]);

  const firstStopPhotoUrl = useMemo(
    () => draftStops.find((stop) => stop.photo_url.trim())?.photo_url.trim() ?? "",
    [draftStops]
  );

  const coverPreviewUrl = useMemo(
    () => coverImageUrl.trim() || firstStopPhotoUrl,
    [coverImageUrl, firstStopPhotoUrl]
  );

  if (!mounted) return null;

  return (
    <main className="mx-auto max-w-7xl px-1 py-4 sm:px-2 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Link href="/planner" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-strong)]">
              Zurück zum Planner
            </Link>
            <Link href="/explore" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-strong)]">
              Explore
            </Link>
          </div>
          <div className="pd24-kicker mb-2">Routes</div>
          <h1 className="text-4xl font-bold tracking-tight text-[var(--text-strong)]">Route Builder</h1>
          <p className="mt-2 max-w-3xl text-[var(--text-muted)]">
            Baue hier ruhig strukturierte Creator-Routen mit klarer Stop-Reihenfolge, sauberem Startpunkt,
            Cover und öffentlicher Vorschau statt alles gleichzeitig im Kopf halten zu müssen.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab("builder")}
            className={`px-3 py-2 rounded-xl border border-[var(--line-subtle)] text-sm ${tab === "builder" ? "bg-[var(--text-strong)] text-white" : "bg-white text-[var(--text-strong)]"}`}
          >
            Builder
          </button>
          <button
            onClick={() => setTab("mine")}
            className={`px-3 py-2 rounded-xl border border-[var(--line-subtle)] text-sm ${tab === "mine" ? "bg-[var(--text-strong)] text-white" : "bg-white text-[var(--text-strong)]"}`}
          >
            Meine Routen
          </button>
          <button
            onClick={() => setTab("public")}
            className={`px-3 py-2 rounded-xl border border-[var(--line-subtle)] text-sm ${tab === "public" ? "bg-[var(--text-strong)] text-white" : "bg-white text-[var(--text-strong)]"}`}
          >
            Public
          </button>
        </div>
      </div>

      {(tab === "mine" || tab === "public") && (
        <div className="grid lg:grid-cols-2 gap-4">
          {(tab === "mine" ? myRoutes : publicRoutes).map((route) => (
                    <div key={route.id} className="pd24-card p-4">
              {(() => {
                const badges = inferPublicRouteBadges(route);
                const meta = route.meta && typeof route.meta === "object" ? (route.meta as Record<string, unknown>) : {};
                const durationBadge = durationBucketLabel(meta.durationBucket);
                const isPersonalizedVariant =
                  Boolean(meta.personalizedVariant) ||
                  (Array.isArray(route.tags) &&
                    route.tags.some((value) => typeof value === "string" && value === "personalized-variant"));
                const personalizedVariantMeta =
                  meta.personalizedVariant && typeof meta.personalizedVariant === "object"
                    ? (meta.personalizedVariant as Record<string, unknown>)
                    : null;
                const personalizedVariantName =
                  typeof personalizedVariantMeta?.variantName === "string"
                    ? personalizedVariantMeta.variantName
                    : null;

                return (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          <span className="text-[11px] px-2 py-1 rounded-full border bg-[var(--bg-panel)] text-[var(--text-muted)]">
                            {creatorLabel(route.creator_type)}
                          </span>
                          <span className="text-[11px] px-2 py-1 rounded-full border bg-[var(--bg-panel)] text-[var(--text-muted)]">
                            {visibilityLabel(route.visibility)}
                          </span>
                          {isPersonalizedVariant ? (
                            <span className="text-[11px] px-2 py-1 rounded-full bg-[var(--brand-accent-cloud)] text-[var(--state-success)]">
                              Persönliche Variante
                            </span>
                          ) : null}
                          {personalizedVariantName ? (
                            <span className="text-[11px] px-2 py-1 rounded-full border bg-white text-[var(--text-muted)]">
                              {personalizedVariantName}
                            </span>
                          ) : null}
                          {route.city_slug ? (
                            <span className="text-[11px] px-2 py-1 rounded-full border bg-[var(--bg-panel)] text-[var(--text-muted)]">
                              {route.city_slug}
                            </span>
                          ) : null}
                          {durationBadge ? (
                            <span className="text-[11px] px-2 py-1 rounded-full border bg-[var(--bg-panel)] text-[var(--text-muted)]">
                              {durationBadge}
                            </span>
                          ) : null}
                          {badges.map((badge) => (
                            <span
                              key={`${route.id}-${badge.label}`}
                              className={`text-[11px] px-2 py-1 rounded-full ${
                                badge.tone === "dark"
                                  ? "bg-[var(--text-strong)] text-white"
                                  : badge.tone === "soft"
                                    ? "border border-[var(--text-strong)]/10 bg-[var(--bg-panel)] text-[var(--text-muted)]"
                                    : "border bg-white text-[var(--text-muted)]"
                              }`}
                            >
                              {badge.label}
                            </span>
                          ))}
                        </div>

                        <div className="font-semibold text-lg">{route.title}</div>
                        {route.description ? (
                          <div className="text-sm text-[var(--text-muted)] mt-1 line-clamp-2">{route.description}</div>
                        ) : null}
                        {route.start_label ? (
                          <div className="text-xs text-[var(--text-muted)] mt-2">Start: {route.start_label}</div>
                        ) : null}
                      </div>

                      <div className="text-right text-sm text-[var(--text-muted)]">
                        <div>Likes {route.like_count}</div>
                        <div>Gespeichert {route.bookmark_count}</div>
                        <div>Rating {route.avg_rating}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {tab === "mine" ? (
                        <>
                          <button
                            onClick={() => hydrateEditorFromRoute(route)}
                            className="rounded-xl border border-[var(--line-subtle)] px-3 py-2 text-sm text-[var(--text-strong)] transition hover:bg-white"
                          >
                            Bearbeiten
                          </button>
                          <button
                            onClick={() => void handleDeleteRoute(route.id)}
                            className="rounded-xl border border-[var(--line-subtle)] px-3 py-2 text-sm text-[var(--text-strong)] transition hover:bg-white"
                          >
                            Löschen
                          </button>
                        </>
                      ) : null}

                      {route.slug ? (
                        <Link
                          href={`/routes/${route.slug}`}
                          className="rounded-xl bg-[var(--text-strong)] px-3 py-2 text-sm text-white transition hover:opacity-95"
                        >
                          Öffnen
                        </Link>
                      ) : null}
                    </div>

                    {!userId && authReady ? (
                      <div className="mt-3 space-y-2 rounded-xl border border-dashed border-[var(--line-subtle)] p-3 text-sm text-[var(--text-muted)]">
                        <div>
                          Du bist noch nicht angemeldet. Für eigene Routen kannst du dich
                          einloggen oder direkt als Gast fortfahren.
                        </div>
                        <button
                          onClick={() => void continueAsGuest()}
                          disabled={authLoading}
                          className="rounded-xl border border-[var(--line-subtle)] px-4 py-2 text-sm text-[var(--text-strong)] transition hover:bg-white disabled:opacity-60"
                        >
                          {authLoading ? "Starte Gast..." : "Als Gast fortfahren"}
                        </button>
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </div>
          ))}

                {routesLoading && <div className="text-sm text-[var(--text-muted)]">Routen werden vorbereitet...</div>}
          {!routesLoading && (tab === "mine" ? myRoutes : publicRoutes).length === 0 && (
            <div className="pd24-card p-4 text-sm text-[var(--text-muted)]">
              Noch keine Routen vorhanden. Lege im Builder deinen ersten strukturierten Ablauf an.
            </div>
          )}
        </div>
      )}

      {tab === "builder" && (
        <>
          <div className="grid gap-3 lg:grid-cols-4">
            <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Bearbeitungsstand</div>
              <div className="mt-1 text-lg font-semibold text-[var(--text-strong)]">
                {selectedRouteId ? "Route in Bearbeitung" : "Neuer Entwurf"}
              </div>
              <div className="mt-2 text-xs text-[var(--text-muted)]">
                {plannerImportLabel ? `Basierend auf ${plannerImportLabel}` : "Direkt im Builder gestartet"}
              </div>
            </div>
            <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Stadt & Start</div>
              <div className="mt-1 text-lg font-semibold text-[var(--text-strong)]">
                {selectedCityName !== "-" ? selectedCityName : "Noch offen"}
              </div>
              <div className="mt-2 text-xs text-[var(--text-muted)]">
                {startLabel.trim() ? startLabel.trim() : "Noch kein Startpunkt gesetzt"}
              </div>
            </div>
            <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Route Flow</div>
              <div className="mt-1 text-lg font-semibold text-[var(--text-strong)]">
                {draftStops.length} Stop{draftStops.length === 1 ? "" : "s"}
              </div>
              <div className="mt-2 text-xs text-[var(--text-muted)]">
                {builderMapStops.length} Marker in der Karten-Vorschau
              </div>
            </div>
            <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Freigabe</div>
              <div className="mt-1 text-lg font-semibold text-[var(--text-strong)]">
                {publishReadyCount}/{publishChecks.length} Checks
              </div>
              <div className="mt-2 text-xs text-[var(--text-muted)]">
                {canShareRoute ? "Teilbar oder öffentlich möglich" : "Noch nicht vollständig teilbar"}
              </div>
            </div>
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-[330px_minmax(0,1fr)_350px]">
          <aside className="space-y-4">
              {plannerImportLabel ? (
                <div className="rounded-[24px] border border-[var(--brand-accent)]/25 bg-[var(--brand-accent-soft)] p-4 text-sm text-[var(--text-strong)] shadow-sm">
                <div className="font-medium">
                  {plannerImportKind === "personalized_route" ? "Personalisierte Variante übernommen" : "Aus Planner übernommen"}
                </div>
                <div className="mt-1 text-[var(--text-muted)]">
                  Dieser Entwurf wurde aus <span className="font-semibold">{plannerImportLabel}</span> übernommen. Du kannst ihn jetzt
                  im Builder verfeinern und später als öffentliche Creator-Route veröffentlichen.
                </div>
                {plannerImportKind === "personalized_route" ? (
                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Variantenname</span>
                      <input
                        value={variantLabel}
                        onChange={(e) => setVariantLabel(e.target.value)}
                        placeholder="z. B. Vegan, Für unsere Gruppe, Sunset Edition"
                        className="rounded-xl border border-[var(--line-subtle)] bg-white px-3 py-2 text-[var(--text-strong)] outline-none transition focus:border-[var(--line-strong)]"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={duplicateAsVariant}
                        className="rounded-xl border border-[var(--brand-accent)]/30 bg-white px-3 py-2 text-xs font-medium text-[var(--brand-accent)] transition hover:bg-[var(--bg-surface)]"
                      >
                        Als neue Variante duplizieren
                      </button>
                      {variantBaseRoute?.slug ? (
                        <Link
                          href={`/routes/${variantBaseRoute.slug}`}
                          className="rounded-xl border border-[var(--brand-accent)]/30 bg-white px-3 py-2 text-xs font-medium text-[var(--brand-accent)] transition hover:bg-[var(--bg-surface)]"
                        >
                          Basisroute öffnen
                        </Link>
                      ) : null}
                    </div>
                    {variantBaseRoute?.title ? (
                      <div className="text-xs text-[var(--text-muted)]">
                        Verknüpft mit: <span className="font-medium">{variantBaseRoute.title}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {(plannerImportAdjustableCount > 0 || plannerImportAdjustedCount > 0) ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                    {plannerImportGroupLabel ? (
                      <span className="rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1 text-xs text-[var(--text-strong)]">
                        {plannerImportGroupLabel}
                      </span>
                    ) : null}
                    {plannerImportAdjustableCount > 0 ? (
                      <span className="rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1 text-xs text-[var(--text-strong)]">
                        {plannerImportAdjustableCount} anpassbar{plannerImportAdjustableCount === 1 ? "er Stop" : "e Stops"}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1 text-xs text-[var(--text-strong)]">
                      {plannerImportAdjustedCount} angepasst
                    </span>
                      <span className="rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1 text-xs text-[var(--text-strong)]">
                        persönlicher Entwurf
                      </span>
                    </div>
                  ) : null}
                  {plannerImportMembers.length > 0 ? (
                    <div className="mt-3 rounded-xl border border-[var(--line-subtle)] bg-white/80 p-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                        Berücksichtigte Personen
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {plannerImportMembers.map((member) => (
                          <span
                            key={member.name}
                            className={`rounded-full px-3 py-1 text-xs ${
                              member.isCurrentUser
                                ? "bg-[var(--text-strong)] text-white"
                                : "border border-[var(--line-subtle)] bg-white text-[var(--text-muted)]"
                            }`}
                          >
                            {member.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {plannerImportInterests.length > 0 ? (
                    <div className="mt-3 rounded-xl border border-[var(--line-subtle)] bg-white/80 p-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                        Eingeflossene Vorlieben
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {plannerImportInterests.slice(0, 12).map((interest) => (
                          <span key={interest} className="rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1 text-xs text-[var(--text-muted)]">
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {plannerImportKindSummary.length > 0 ? (
                    <div className="mt-3 rounded-xl border border-[var(--line-subtle)] bg-white/80 p-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                        Was angepasst werden kann
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {plannerImportKindSummary.map(([kind, count]) => (
                          <span key={kind} className="rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1 text-xs text-[var(--text-muted)]">
                            {count}x {personalizationKindLabel(kind as DraftStop["personalizationKind"])}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            <div className="sticky top-4 max-h-[calc(100vh-2rem)] space-y-5 overflow-y-auto rounded-[28px] border border-[var(--line-subtle)] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">
                    {selectedRouteId ? "Route bearbeiten" : "Neue Route"}
                  </h2>
                  <div className="mt-1 text-sm text-[var(--text-muted)]">
                    Links definierst du die Route ruhig in Blöcken statt in einem langen Formular.
                  </div>
                </div>
                <button onClick={resetEditor} className="px-3 py-2 rounded-xl border border-[var(--line-subtle)] text-sm hover:bg-white">
                  Neu
                </button>
              </div>

              <div className="space-y-3 rounded-[24px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4">
                <div>
                  <div className="font-medium text-[var(--text-strong)]">Grunddaten</div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    Titel, kurzer Hook und Stadt bilden den roten Faden für die gesamte Route.
                  </div>
                </div>

                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titel der Route"
                  className="w-full rounded-xl border border-[var(--line-subtle)] bg-white p-3"
                />

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Beschreibung / Story / Hook"
                  className="min-h-[120px] w-full rounded-xl border border-[var(--line-subtle)] bg-white p-3"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void generateRouteDescription()}
                    disabled={routeDescriptionLoading || (!title.trim() && draftStops.length === 0)}
                    className="rounded-xl border border-[var(--line-subtle)] bg-white px-3 py-2 text-xs font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {routeDescriptionLoading ? "KI generiert..." : "KI-Text erzeugen"}
                  </button>
                  <span className="text-xs text-[var(--text-muted)]">
                    Füllt die Beschreibung aus Titel, Anlass, Tags und Stops.
                  </span>
                </div>

                <select
                  value={selectedCitySlug}
                  onChange={(e) => setSelectedCitySlug(e.target.value)}
                  className="w-full rounded-xl border border-[var(--line-subtle)] bg-white p-3"
                  disabled={citiesLoading}
                >
                  <option value="">Stadt wählen</option>
                  {cities.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}{typeof c.population === "number" ? ` | ${c.population.toLocaleString("de-DE")}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 rounded-[24px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4">
                <div>
                  <div className="mb-2 text-sm font-medium">Sichtbarkeit & Sharing</div>
                  <div className="grid gap-2">
                    {(["private", "unlisted", "public"] as RouteVisibility[]).map((option) => {
                      const active = visibility === option;
                      const disabled = (option === "unlisted" || option === "public") && !canShareRoute;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setVisibility(option)}
                          disabled={disabled}
                          className={`rounded-xl border border-[var(--line-subtle)] p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${active ? "border-[var(--text-strong)] bg-[var(--bg-panel)]" : "bg-white hover:bg-[var(--bg-panel)]"}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium">{visibilityLabel(option)}</div>
                            {active ? <span className="text-xs rounded-full bg-[var(--text-strong)] px-2 py-1 text-white">Aktiv</span> : null}
                          </div>
                          <div className="mt-1 text-xs text-[var(--text-muted)]">{visibilityDescription(option)}</div>
                        </button>
                      );
                    })}
                  </div>
                  {!canShareRoute ? (
                    <div className="mt-2 text-xs text-[var(--state-warning)]">
                      Für geteilte oder öffentliche Routen brauchst du Titel, Stadt und mindestens einen Stop.
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVisibility("unlisted")}
                    disabled={!canShareRoute}
                    className="rounded-xl border border-[var(--line-subtle)] px-3 py-3 text-sm text-[var(--text-strong)] transition hover:bg-white disabled:opacity-60"
                  >
                    Link teilen
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibility("public")}
                    disabled={!canShareRoute}
                    className="rounded-xl border border-[var(--line-subtle)] px-3 py-3 text-sm text-[var(--text-strong)] transition hover:bg-white disabled:opacity-60"
                  >
                    Öffentlich machen
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <select value={creatorType} onChange={(e) => setCreatorType(e.target.value as CreatorType)} className="border p-3 rounded-xl">
                  <option value="user">User</option>
                  <option value="creator">Creator</option>
                  <option value="influencer">Influencer</option>
                  <option value="brand">Brand</option>
                </select>
              </div>

              <div className="rounded-[24px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4 space-y-3">
                <div>
                  <div className="font-medium">Route-Metadaten</div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    Diese Angaben helfen Explore, Profilseiten und öffentliche Karten, deine Route sauber einzuordnen.
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Occasion</span>
                    <select value={routeOccasion} onChange={(e) => setRouteOccasion(e.target.value as RouteOccasion)} className="border bg-white p-3 rounded-xl">
                      <option value="none">{routeOccasionLabel("none")}</option>
                      <option value="date">{routeOccasionLabel("date")}</option>
                      <option value="family">{routeOccasionLabel("family")}</option>
                      <option value="friends">{routeOccasionLabel("friends")}</option>
                      <option value="tourism">{routeOccasionLabel("tourism")}</option>
                      <option value="party">{routeOccasionLabel("party")}</option>
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Route-Profil</span>
                    <select value={routeProfileMode} onChange={(e) => setRouteProfileMode(e.target.value as RouteProfileMode)} className="border bg-white p-3 rounded-xl">
                      <option value="none">{routeProfileLabel("none")}</option>
                      <option value="foot">{routeProfileLabel("foot")}</option>
                      <option value="public_transit">{routeProfileLabel("public_transit")}</option>
                      <option value="car">{routeProfileLabel("car")}</option>
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Hauptthema</span>
                    <select value={routeTheme} onChange={(e) => setRouteTheme(e.target.value as RouteTheme)} className="border bg-white p-3 rounded-xl">
                      <option value="none">{routeThemeLabel("none")}</option>
                      <option value="food">{routeThemeLabel("food")}</option>
                      <option value="culture">{routeThemeLabel("culture")}</option>
                      <option value="outdoor">{routeThemeLabel("outdoor")}</option>
                      <option value="nightlife">{routeThemeLabel("nightlife")}</option>
                      <option value="mixed">{routeThemeLabel("mixed")}</option>
                    </select>
                  </label>
                </div>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Zusätzliche Tags</span>
                  <input
                    value={routeTagsInput}
                    onChange={(e) => setRouteTagsInput(e.target.value)}
                    placeholder="z. B. rooftop, vegan, museum, sunset"
                    className="w-full border bg-white p-3 rounded-xl"
                  />
                </label>
              </div>

              <div className="rounded-xl border bg-[var(--bg-panel)] p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">Cover & Medien</div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">Nutze ein eigenes Cover oder übernimm ein vorhandenes Stop-Foto als Einstieg für die öffentliche Route.</div>
                  </div>
                  {coverImageUrl.trim() ? (
                    <button
                      type="button"
                      onClick={() => setCoverImageUrl("")}
                      className="rounded-lg border px-3 py-2 text-xs hover:bg-white"
                    >
                      Cover entfernen
                    </button>
                  ) : null}
                </div>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Coverbild-URL</span>
                  <input
                    value={coverImageUrl}
                    onChange={(e) => setCoverImageUrl(e.target.value)}
                    placeholder="https://.../cover.jpg"
                    className="w-full border bg-white p-3 rounded-xl"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setCoverImageUrl("")}
                    className="rounded-lg border px-3 py-2 text-sm hover:bg-white"
                  >
                    Kein Cover
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (firstStopPhotoUrl) setCoverImageUrl(firstStopPhotoUrl);
                    }}
                    disabled={!firstStopPhotoUrl}
                    className="rounded-lg border px-3 py-2 text-sm hover:bg-white disabled:opacity-60"
                  >
                    Erstes Stop-Foto übernehmen
                  </button>
                  {activeStop?.photo_url.trim() ? (
                    <button
                      type="button"
                      onClick={() => setCoverImageUrl(activeStop.photo_url.trim())}
                      className="rounded-lg border px-3 py-2 text-sm hover:bg-white"
                    >
                      Aktiven Stop als Cover
                    </button>
                  ) : null}
                </div>

                <div className="rounded-2xl overflow-hidden border bg-white">
                  {coverPreviewUrl ? (
                    <div className="relative h-40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={coverPreviewUrl} alt="Cover-Vorschau" className="h-full w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-white">
                        <div className="text-sm font-medium">{title.trim() || "Route ohne Titel"}</div>
                        <div className="text-xs opacity-90">{selectedCityName !== "-" ? selectedCityName : "Noch keine Stadt gewählt"}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-[var(--text-muted)]">
                      Noch kein Cover gewählt. Die Route nutzt aktuell nur Text, bis du ein Cover setzt oder ein Stop-Foto übernimmst.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-[24px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4">
                <div className="font-medium">Startpunkt</div>
                <select value={startType} onChange={(e) => setStartType(e.target.value as StartType)} className="w-full rounded-xl border border-[var(--line-subtle)] bg-white p-3">
                  <option value="address">Straße / Adresse</option>
                  <option value="hotel">Hotel</option>
                  <option value="station">Bahnhof</option>
                  <option value="airport">Flughafen</option>
                  <option value="other">Sonstiges</option>
                </select>
                <input value={startLabel} onChange={(e) => setStartLabel(e.target.value)} placeholder="z.B. Hauptbahnhof Berlin" className="w-full rounded-xl border border-[var(--line-subtle)] bg-white p-3" />
                <div className="grid grid-cols-2 gap-3">
                  <input value={startLat} onChange={(e) => setStartLat(e.target.value)} placeholder="Latitude" className="rounded-xl border border-[var(--line-subtle)] bg-white p-3" />
                  <input value={startLng} onChange={(e) => setStartLng(e.target.value)} placeholder="Longitude" className="rounded-xl border border-[var(--line-subtle)] bg-white p-3" />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  onClick={() => void handleCreateOrUpdateRoute()}
                  disabled={savingRoute || !userId}
                  className="flex-1 px-4 py-3 rounded-xl bg-[var(--text-strong)] text-white text-sm disabled:opacity-60"
                >
                  {savingRoute
                    ? "Route speichern..."
                    : plannerImportLabel && !selectedRouteId
                      ? "Persönlichen Entwurf speichern"
                      : selectedRouteId
                        ? "Route aktualisieren"
                        : "Route erstellen"}
                </button>
                <button
                  onClick={() => void saveStops()}
                  disabled={!userId || !selectedRouteId || savingStops}
                  className="flex-1 px-4 py-3 rounded-xl border text-sm disabled:opacity-60"
                >
                  {savingStops ? "Stops speichern..." : "Stops speichern"}
                </button>
              </div>

              <div className="rounded-[24px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">Veröffentlichungs-Check</div>
                  <div className="text-xs text-[var(--text-muted)]">{publishReadyCount}/{publishChecks.length}</div>
                </div>
                <div className="mt-3 grid gap-2">
                  {publishChecks.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                      <span>{item.label}</span>
                      <span className={`rounded-full px-2 py-1 text-xs ${item.ok ? "bg-[var(--brand-accent-cloud)] text-[var(--state-success)]" : "bg-[var(--bg-panel)] text-[var(--text-muted)]"}`}>
                        {item.ok ? "OK" : "Offen"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-[var(--text-muted)]">
                  Reihenfolge: Erst Route speichern, dann Stops speichern, danach bei Bedarf teilen oder veröffentlichen.
                  {plannerImportLabel ? " Dieser personalisierte Entwurf startet bewusst privat, bis du ihn selbst veröffentlichst." : ""}
                </div>
              </div>

              {!userId && authReady ? (
                <div className="mt-3 rounded-xl border border-dashed p-3 text-sm text-[var(--text-muted)] space-y-2">
                  <div>
                    Du bist noch nicht angemeldet. Für eigene Routen kannst du dich
                    einloggen oder direkt als Gast fortfahren.
                  </div>
                  <button
                    onClick={() => void continueAsGuest()}
                    disabled={authLoading}
                    className="px-4 py-2 rounded-xl border text-sm disabled:opacity-60"
                  >
                    {authLoading ? "Starte Gast..." : "Als Gast fortfahren"}
                  </button>
                </div>
              ) : null}
            </div>
          </aside>

          <section className="space-y-4">
            <div className="rounded-[28px] border border-[var(--line-subtle)] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <div className="text-lg font-semibold text-[var(--text-strong)]">Stop-Suche</div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">Suche bestehende Locations oder ergänze freie Platzhalter für den Flow.</p>
                </div>
                <button onClick={addManualStop} className="px-3 py-2 rounded-xl border text-sm">
                  + Freier Stop
                </button>
              </div>

              <div className="flex gap-2 flex-wrap">
                <input
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  placeholder="Locations suchen (z.B. Sushi, Museum, Bar, Bahnhof)"
                  className="border p-3 rounded-xl flex-1 min-w-[260px]"
                />
                <button onClick={() => void searchLocations()} disabled={searchingLocations} className="px-4 py-3 rounded-xl border text-sm">
                  {searchingLocations ? "Suche..." : "Suchen"}
                </button>
              </div>

              <div className="mt-2 text-xs text-[var(--text-muted)]">Stadt: {selectedCityName}</div>

              {locationResults.length > 0 ? (
                <div className="mt-4 grid max-h-[20rem] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
                  {locationResults.map((loc) => (
                    <div key={loc.id} className="border rounded-xl p-3 flex flex-col gap-3">
                      <div>
                        <div className="font-medium">{loc.name}</div>
                        <div className="text-xs text-[var(--text-muted)]">
                            {[loc.type, loc.category, loc.meal].filter(Boolean).join(" | ")}
                        </div>
                      </div>
                      <button onClick={() => addLocationStop(loc)} className="px-3 py-2 rounded-xl bg-[var(--text-strong)] text-white text-sm">
                        In Route übernehmen
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-[28px] border border-[var(--line-subtle)] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Route Flow</h2>
                  <p className="text-sm text-[var(--text-muted)]">Ordne hier die Route, wähle den aktiven Stop und arbeite Details rechts aus.</p>
                </div>
                <div className="text-sm text-[var(--text-muted)]">{draftStops.length} Stop(s)</div>
              </div>

              {routeStopsLoading ? (
                  <div className="text-sm text-[var(--text-muted)]">Stops werden geladen...</div>
              ) : draftStops.length === 0 ? (
                  <div className="text-sm text-[var(--text-muted)]">Noch keine Stops. Suche zuerst einen Ort oder beginne mit einem freien Stop als strukturellem Platzhalter.</div>
              ) : (
                <div className="max-h-[46rem] space-y-3 overflow-y-auto pr-1">
                  {draftStops.map((stop, index) => {
                    const active = activeStopId === stop.localId;
                    return (
                      <div
                        key={stop.localId}
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveStopId(stop.localId)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setActiveStopId(stop.localId);
                          }
                        }}
                        className={`w-full text-left border rounded-2xl p-4 transition cursor-pointer ${active ? "border-[var(--text-strong)] bg-[var(--bg-panel)]" : "bg-white hover:bg-[var(--bg-panel)]"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs text-[var(--text-muted)] mb-1">Stop {index + 1}</div>
                            <div className="font-semibold">{stopTitle(stop, index)}</div>
                            {stop.subtitle ? <div className="text-xs text-[var(--text-muted)] mt-1">{stop.subtitle}</div> : null}
                            <div className="mt-2 flex flex-wrap gap-2">
                              {stop.is_required ? <span className="text-[11px] px-2 py-1 rounded-full bg-[var(--bg-panel)] text-[var(--text-muted)]">Pflicht</span> : null}
                              {stop.duration_min ? <span className="text-[11px] px-2 py-1 rounded-full bg-[var(--bg-panel)] text-[var(--text-muted)]">{stop.duration_min} Min</span> : null}
                              {stop.isLocked ? <span className="text-[11px] px-2 py-1 rounded-full bg-[var(--brand-accent-cloud)] text-[var(--state-success)]">Fixiert</span> : null}
                              {stop.personalizationKind && stop.personalizationKind !== "fixed" ? (
                                <span className="text-[11px] px-2 py-1 rounded-full bg-[var(--brand-accent-cloud)] text-[var(--state-warning)]">
                                  {personalizationKindLabel(stop.personalizationKind)} anpassbar
                                </span>
                              ) : null}
                              {stop.location_id ? <span className="text-[11px] px-2 py-1 rounded-full bg-[var(--bg-panel)] text-[var(--text-muted)]">DB-Location</span> : <span className="text-[11px] px-2 py-1 rounded-full bg-[var(--bg-panel)] text-[var(--text-muted)]">Freier Stop</span>}
                            </div>
                            <div className="mt-2 text-xs text-[var(--text-muted)]">{stopSummary(stop)}</div>
                          </div>

                          <div className="flex gap-2">
                            <button type="button" onClick={(e) => { e.stopPropagation(); moveDraftStop(stop.localId, "up"); }} className="px-2 py-1 rounded-lg border text-xs">Hoch</button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); moveDraftStop(stop.localId, "down"); }} className="px-2 py-1 rounded-lg border text-xs">Runter</button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); removeDraftStop(stop.localId); }} className="px-2 py-1 rounded-lg border text-xs text-red-600">Entfernen</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="sticky top-4 max-h-[calc(100vh-2rem)] space-y-4 overflow-y-auto rounded-[28px] border border-[var(--line-subtle)] bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-xl font-semibold">Live Preview</h2>
                <p className="text-sm text-[var(--text-muted)]">Karte, Stop-Editor und die spätere öffentliche Kartenansicht in einer ruhigeren Spalte.</p>
              </div>

              <div className="overflow-hidden rounded-[24px] border border-[var(--line-subtle)]">
                <PlanMap stops={builderMapStops} profile="foot" height={260} />
              </div>

              <div className="text-xs text-[var(--text-muted)]">
                    {builderMapStops.length >= 2 ? `${builderMapStops.length} Marker in der Vorschau` : "Mindestens Start + 1 Stop mit Koordinaten für sinnvolle Kartenvorschau"}
              </div>

              {activeStop ? (
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">Aktiver Stop</div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">Bearbeite Inhalt, Dauer, Bild und optionale Route-Infos für diesen Stop.</div>
                    </div>
                    <div className="rounded-full bg-[var(--bg-panel)] px-3 py-1 text-xs text-[var(--text-muted)]">
                      {activeStop.location_id ? "Verknüpfte Location" : "Freier Stop"}
                    </div>
                  </div>

                  {activeStop.personalizationKind && activeStop.personalizationKind !== "fixed" ? (
                    <div className="rounded-2xl border border-[var(--state-warning)]/25 bg-[var(--brand-accent-cloud)] p-4 text-sm text-[var(--state-warning)]">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <div className="font-medium">Dieser {personalizationKindLabel(activeStop.personalizationKind)}-Stop ist anpassbar</div>
                          <div className="mt-1 text-[var(--state-warning)]">
                            Die Hotspots der Originalroute bleiben fest. Für diesen Stop kannst du unten direkt passende Alternativen aus den gespeicherten Vorlieben übernehmen.
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {activeStop.originalStop ? (
                            <button
                              type="button"
                              onClick={() => restoreOriginalStop(activeStop.localId)}
                              className="rounded-xl border border-[var(--state-warning)]/35 bg-white px-3 py-2 text-xs font-medium text-[var(--state-warning)] hover:bg-[var(--brand-accent-cloud)]"
                            >
                              Original
                            </button>
                          ) : null}
                          {activeStop.swapCandidates && activeStop.swapCandidates.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => applySwapCandidate(activeStop.localId, activeStop.swapCandidates![0])}
                              className="rounded-xl border border-[var(--state-warning)]/35 bg-white px-3 py-2 text-xs font-medium text-[var(--state-warning)] hover:bg-[var(--brand-accent-cloud)]"
                            >
                              Beste Wahl
                            </button>
                          ) : null}
                          {activeStop.swapCandidates && activeStop.swapCandidates.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => applyNextSwapCandidate(activeStop.localId)}
                              className="rounded-xl border border-[var(--state-warning)]/35 bg-white px-3 py-2 text-xs font-medium text-[var(--state-warning)] hover:bg-[var(--brand-accent-cloud)]"
                            >
                              Nächster Vorschlag
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : activeStop.isLocked ? (
                    <div className="rounded-2xl border border-[var(--state-success)]/25 bg-[var(--brand-accent-cloud)] p-4 text-sm text-[var(--state-success)]">
                      <div className="font-medium">Dieser Stop bleibt als Hotspot fixiert</div>
                      <div className="mt-1 text-[var(--state-success)]">
                        Dieser Teil der Creator-Route wurde bewusst beibehalten, damit Sightseeing, Flow und Kern-Highlights nicht verändert werden.
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-3">
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Titel</span>
                      <input value={activeStop.title} onChange={(e) => updateDraftStop(activeStop.localId, { title: e.target.value })} placeholder="z. B. Sunset Dinner am Wasser" className="w-full rounded-xl border border-[var(--line-subtle)] p-3" />
                    </label>

                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Empfehlung / Notiz</span>
                      <textarea value={activeStop.note} onChange={(e) => updateDraftStop(activeStop.localId, { note: e.target.value })} placeholder="Warum lohnt sich dieser Stop? Gibt es einen besonderen Tipp oder eine Reihenfolge?" className="min-h-[140px] w-full rounded-xl border border-[var(--line-subtle)] p-3" />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">Aufenthalt</span>
                        <input value={activeStop.duration_min} onChange={(e) => updateDraftStop(activeStop.localId, { duration_min: e.target.value })} placeholder="z. B. 60" className="rounded-xl border border-[var(--line-subtle)] p-3" />
                      </label>
                      <label className="flex items-center gap-2 text-sm border rounded-xl px-3 py-3 mt-7">
                        <input type="checkbox" checked={activeStop.is_required} onChange={(e) => updateDraftStop(activeStop.localId, { is_required: e.target.checked })} />
                        Pflicht-Stop
                      </label>
                    </div>

                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Externer Link</span>
                      <input value={activeStop.external_url} onChange={(e) => updateDraftStop(activeStop.localId, { external_url: e.target.value })} placeholder="Reservierung, Website oder Affiliate-Link" className="w-full rounded-xl border border-[var(--line-subtle)] p-3" />
                    </label>

                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Foto</span>
                      <input value={activeStop.photo_url} onChange={(e) => updateDraftStop(activeStop.localId, { photo_url: e.target.value })} placeholder="https://.../bild.jpg" className="w-full rounded-xl border border-[var(--line-subtle)] p-3" />
                    </label>

                    <div className="rounded-xl border bg-[var(--bg-panel)] p-3">
                      <div className="font-medium text-sm">Kartenposition</div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">Nur nötig, wenn der Stop nicht schon über eine verknüpfte Location kommt.</div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <input value={activeStop.lat} onChange={(e) => updateDraftStop(activeStop.localId, { lat: e.target.value })} placeholder="Latitude" className="rounded-xl border border-[var(--line-subtle)] bg-white p-3" />
                        <input value={activeStop.lng} onChange={(e) => updateDraftStop(activeStop.localId, { lng: e.target.value })} placeholder="Longitude" className="rounded-xl border border-[var(--line-subtle)] bg-white p-3" />
                      </div>
                    </div>

                    {activeStop.personalizationKind && activeStop.personalizationKind !== "fixed" && activeStop.swapCandidates && activeStop.swapCandidates.length > 0 ? (
                      <div className="grid gap-3 text-sm">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="font-medium">Alternative Vorschläge</div>
                          <div className="flex flex-wrap gap-2">
                            {activeStop.originalStop ? (
                              <button
                                type="button"
                                onClick={() => restoreOriginalStop(activeStop.localId)}
                                className="rounded-xl border px-3 py-2 text-xs"
                              >
                                Original
                              </button>
                            ) : null}
                            {activeStop.swapCandidates.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => applySwapCandidate(activeStop.localId, activeStop.swapCandidates![0])}
                                className="rounded-xl border px-3 py-2 text-xs"
                              >
                                Beste Wahl
                              </button>
                            ) : null}
                            {activeStop.swapCandidates.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => applyNextSwapCandidate(activeStop.localId)}
                                className="rounded-xl border px-3 py-2 text-xs"
                              >
                                Nächster Vorschlag
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-1">
                          {activeStop.swapCandidates.map((candidate, index) => (
                            <div
                              key={`${candidate.location_id ?? candidate.title}-${index}`}
                              className={`min-w-[240px] rounded-2xl border p-3 ${
                                candidate.location_id === activeStop.location_id
                                  ? "border-[var(--text-strong)] bg-white shadow-sm"
                                  : "bg-[var(--bg-panel)]"
                              }`}
                            >
                              {index === 0 ? (
                                <div className="mb-2 inline-flex rounded-full bg-[var(--brand-accent-cloud)] px-2 py-1 text-[11px] text-[var(--state-success)]">
                                  Top-Match
                                </div>
                              ) : null}
                              <div className="font-medium">{candidate.title}</div>
                              <div className="mt-1 text-xs text-[var(--text-muted)]">{candidate.subtitle}</div>
                              {candidate.note ? <div className="mt-2 text-xs text-[var(--text-muted)] line-clamp-3">{candidate.note}</div> : null}
                              <button
                                type="button"
                                onClick={() => applySwapCandidate(activeStop.localId, candidate)}
                                className="mt-3 rounded-xl bg-[var(--text-strong)] px-3 py-2 text-xs text-white transition hover:opacity-95"
                              >
                                Diesen Stop übernehmen
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          Auf mobilen Geräten kannst du horizontal durch die Vorschläge swipen und den passenden Stop direkt übernehmen.
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[var(--text-muted)] border-t pt-4">Wähle links einen Stop aus, um Details zu bearbeiten.</div>
              )}

              <div className="border-t pt-4 space-y-2 text-sm">
                <div className="font-medium">Public Preview</div>
                <div className="rounded-[24px] border border-[var(--line-subtle)] bg-[var(--bg-panel)] p-4">
                  {coverPreviewUrl ? (
                    <div className="mb-3 overflow-hidden rounded-xl border bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={coverPreviewUrl} alt="Cover der Route" className="h-36 w-full object-cover" />
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="text-[11px] px-2 py-1 rounded-full border bg-white text-[var(--text-muted)]">{creatorLabel(creatorType)}</span>
                    <span className="text-[11px] px-2 py-1 rounded-full border bg-white text-[var(--text-muted)]">{visibilityLabel(visibility)}</span>
                    {selectedCitySlug ? <span className="text-[11px] px-2 py-1 rounded-full border bg-white text-[var(--text-muted)]">{selectedCitySlug}</span> : null}
                  </div>
                  <div className="font-semibold text-lg">{title.trim() || "Route ohne Titel"}</div>
                  {description.trim() ? <div className="text-sm text-[var(--text-muted)] mt-1 line-clamp-3">{description}</div> : null}
                  {startLabel.trim() ? <div className="text-xs text-[var(--text-muted)] mt-2">Start: {startLabel}</div> : null}
                  <div className="text-xs text-[var(--text-muted)] mt-3">Stops: {draftStops.length}</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
        </>
      )}

      {toast ? (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl shadow-lg text-sm z-50 ${toast.kind === "success" ? "bg-[var(--text-strong)] text-white" : toast.kind === "error" ? "bg-red-600 text-white" : "bg-[var(--text-strong)] text-white"}`}>
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}

export default function RoutesPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-7xl px-1 py-4 sm:px-2 lg:px-4">
          <div className="pd24-shell p-6 text-sm text-[var(--text-muted)]">
            Routen werden geladen...
          </div>
        </main>
      }
    >
      <RoutesPageContent />
    </Suspense>
  );
}




