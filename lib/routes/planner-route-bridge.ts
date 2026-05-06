export const PLANNER_ROUTE_TEMPLATE_STORAGE_KEY = "pd24_planner_route_template";
export const ROUTE_BUILDER_DRAFT_STORAGE_KEY = "pd24_route_builder_draft";

export type PlannerRouteTemplate = {
  title?: string | null;
  citySlug?: string | null;
  occasion?: "date" | "family" | "friends" | "tourism" | "party" | null;
  experienceMode?: "classic" | "show" | "event_visit" | "market_festival" | null;
  routeProfile?: "foot" | "public_transit" | "car" | null;
  interests?: string[];
  sourceRouteTitle?: string | null;
  startPoint?: {
    mode?: "current_location" | "custom";
    type?: "address" | "hotel" | "station" | "airport" | "other";
    label?: string;
    lat?: number | null;
    lng?: number | null;
  } | null;
  sourceRouteId?: string | null;
  sourceRouteSlug?: string | null;
};

export type RouteBuilderDraftStop = {
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

export type RouteBuilderDraft = {
  title?: string | null;
  description?: string | null;
  citySlug?: string | null;
  coverImageUrl?: string | null;
  routeOccasion?: "none" | "date" | "family" | "friends" | "tourism" | "party";
  routeProfileMode?: "none" | "foot" | "public_transit" | "car";
  routeTheme?: "none" | "food" | "culture" | "outdoor" | "nightlife" | "mixed";
  routeTags?: string[];
  startType?: "address" | "hotel" | "station" | "airport" | "other";
  startLabel?: string | null;
  startLat?: string | null;
  startLng?: string | null;
  draftStops?: RouteBuilderDraftStop[];
  sourcePlanTitle?: string | null;
  sourceKind?: "planner" | "personalized_route";
  sourceGroupLabel?: string | null;
  sourceRouteId?: string | null;
  sourceRouteSlug?: string | null;
  sourceRouteTitle?: string | null;
  sourceInterests?: string[];
  sourceMembers?: Array<{
    name: string;
    interests?: string[];
    isCurrentUser?: boolean;
  }>;
};

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function clearJson(key: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

export function writePlannerRouteTemplate(value: PlannerRouteTemplate) {
  writeJson(PLANNER_ROUTE_TEMPLATE_STORAGE_KEY, value);
}

export function consumePlannerRouteTemplate() {
  const value = readJson<PlannerRouteTemplate>(PLANNER_ROUTE_TEMPLATE_STORAGE_KEY);
  clearJson(PLANNER_ROUTE_TEMPLATE_STORAGE_KEY);
  return value;
}

export function writeRouteBuilderDraft(value: RouteBuilderDraft) {
  writeJson(ROUTE_BUILDER_DRAFT_STORAGE_KEY, value);
}

export function consumeRouteBuilderDraft() {
  const value = readJson<RouteBuilderDraft>(ROUTE_BUILDER_DRAFT_STORAGE_KEY);
  clearJson(ROUTE_BUILDER_DRAFT_STORAGE_KEY);
  return value;
}
