import type { FriendProfileRow } from "@/lib/social/friends";
import type {
  GroupMember,
  MatchLevel,
  PlannedStop,
  PlannerEventRow,
  PlanningContext,
  RouteSummaryLite,
  ScoredLocation,
  StartPointType,
} from "@/lib/planner";

export type StartPointMode = "current_location" | "custom";

export type StartPoint = {
  mode: StartPointMode;
  type: StartPointType;
  label: string;
  lat: number | null;
  lng: number | null;
};

export type StartPointSuggestion = {
  label: string;
  lat: number;
  lng: number;
  type: Exclude<StartPointType, "current_location">;
  source: "location" | "city" | "preset";
  citySlug: string | null;
  subtitle: string | null;
};

export type CityRow = {
  slug: string;
  name: string;
  country_code: string | null;
  center_lat: number | null;
  center_lng: number | null;
  population: number | null;
  is_active: boolean | null;
};

export type SavedPlanRow = {
  id: string;
  title: string | null;
  created_at: string;
  filters: any;
  radius_km: number;
  effective_radius_km: number | null;
  sort_mode: string;
  active_level: string | null;
  slots: any;
  share_token?: string | null;
  ai_description?: string | null;
};

export type SharedPlanChoiceReactionSummary = {
  count: number;
  voters: string[];
};

export type PlanEditSuggestionSummary = {
  id: string;
  author_label: string;
  message: string;
  created_at: string;
  resolved_at?: string | null;
};

export type PlannerSaveMode = "default" | "new_version" | "new_variant";

export type SavedPlanFamily = {
  key: string;
  rootId: string;
  rootTitle: string;
  plans: SavedPlanRow[];
};

export type ProfileInterestRow = {
  user_id: string;
  interests?: unknown;
  username?: string | null;
  display_name?: string | null;
};

export type CreatorProfileLookupRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url?: string | null;
};

export type GroupProfileSuggestion = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url?: string | null;
};

export type PlannerFriendSuggestion = FriendProfileRow & {
  interests: string[];
};

export type PlanVariant = {
  variantId: string;
  label: string;
  goal: "best_match" | "shortest_route" | "more_diverse" | "premium";
  plannedStops: PlannedStop[];
  fallbackSummary: RouteSummaryLite;
  reason: string;
  badges: string[];
  groupSummary?: {
    label: string;
    note: string;
    badges: string[];
    focusParticipant?: string | null;
  } | null;
  totalScore?: number;
};

export type LeadingVariantSummary = {
  variant: PlanVariant;
  votes: number;
};

export type PlannerVoteMoment = {
  label: string;
  note: string;
  tone: "emerald" | "amber" | "sky";
};

export type OccasionPhaseMeta = {
  label: string;
  short: string;
};

export type PlannerApiResponse = {
  context: PlanningContext;
  results: ScoredLocation[];
  activeLevel: MatchLevel;
  effectiveRadiusKm: number;
  eventCandidates: PlannerEventRow[];
  eventDebugRows: PlannerEventRow[];
  plannedStops: PlannedStop[];
  fallbackSummary: RouteSummaryLite;
  variants: PlanVariant[];
  recommendedVariantId?: string | null;
};

export type GroupPlanningSignals = {
  participantCount: number;
  activeParticipantCount: number;
  sharedAcrossAll: string[];
  overlapping: string[];
  uniqueSignals: Array<{ name: string; interests: string[] }>;
};

export type GroupPlanSummary = {
  sharedCount: number;
  balancedCount: number;
  singlePreferenceCount: number;
  matchedInterests: string[];
  reducedThemes: string[];
};
