export type LocationCategory =
  | "cafe"
  | "restaurant"
  | "activity"
  | "culture"
  | "nightlife"
  | "event"
  | "other"
  | null;

export type MealType = "breakfast" | "lunch" | "dinner" | null;

export type PlanMode = "morning" | "midday" | "evening" | "fullday";
export type EvaluationMode = "normal" | "trace";
export type ExperienceMode =
  | "classic"
  | "show"
  | "event_visit"
  | "market_festival";
export type FamilyAgeBand = "0_6" | "4_10" | "9_14" | "12_16";
export type EventStrictness = "off" | "hybrid" | "required";
export type EventPlanningMode = "auto" | "locked" | "disabled";
export type PlannerEventCategory =
  | "concert"
  | "theater"
  | "show"
  | "market"
  | "festival"
  | "fair"
  | "food_event"
  | "community"
  | "seasonal"
  | "other";
export type PlannerEventKind = "anchored_event" | "flex_event";

export type OccasionKey =
  | "date"
  | "family"
  | "friends"
  | "tourism"
  | "party";

export type MatchLevel =
  | "strict"
  | "relax_daytime"
  | "relax_budget"
  | "fallback";

export type SlotKind =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "activity"
  | "sightseeing"
  | "walk"
  | "tour"
  | "culture"
  | "nightlife"
  | "anything";

export type DatePhase =
  | "warmup"
  | "shared_experience"
  | "deepen"
  | "highlight"
  | "close";

export type OccasionPhase =
  | DatePhase
  | "arrival"
  | "main_activity"
  | "pause"
  | "light_activity"
  | "wind_down"
  | "social_warmup"
  | "social_activity"
  | "social_meal"
  | "social_flex"
  | "social_peak"
  | "tour_start"
  | "tour_highlight"
  | "tour_culture"
  | "tour_lunch"
  | "tour_relaxed"
  | "tour_optional"
  | "tour_dinner"
  | "party_warmup"
  | "party_social"
  | "party_peak"
  | "party_after"
  | "party_food";

export type StartPointType =
  | "current_location"
  | "address"
  | "hotel"
  | "station"
  | "airport"
  | "other";

export type RouteProfile = "foot" | "public_transit" | "car";

export type GroupMember = {
  id: string;
  name: string;
  interests: string[];
  profileUserId?: string | null;
  profileHandle?: string | null;
};

export type PlannerRequest = {
  citySlug: string | null;
  planDate?: string | null;
  dayStartMin?: number | null;
  selectedEventId?: string | null;
  eventPlanningMode?: EventPlanningMode;
  startPoint: {
    type: StartPointType;
    label: string | null;
    lat: number | null;
    lng: number | null;
  };
  planMode: PlanMode;
  radiusKm: number;
  budget: "low" | "medium" | "high" | "free";
  occasion: OccasionKey;
  familyAgeBand?: FamilyAgeBand | null;
  experienceMode?: ExperienceMode;
  eventStrictness?: EventStrictness;
  interests: string[];
  group: {
    enabled: boolean;
    members: GroupMember[];
  };
  fullDayActsAfterBreakfast?: number;
  fullDayActsAfterLunch?: number;
  stopsCount?: number;
  sortMode?: "match" | "distance";
  routeProfile?: RouteProfile;
  stopOffsets?: number[];
  variationSeed?: number;
  evaluationMode?: EvaluationMode;
};

export type LocationRow = {
  id: string;
  name: string;
  type: string;

  budget?: string | null;
  occasion?: string | null;
  daytime?: string | null;

  category?: LocationCategory;
  meal?: MealType;
  manual_category?: LocationCategory;
  manual_meal?: MealType;

  lat?: number | null;
  lng?: number | null;

  reservation_url?: string | null;
  duration_min?: number | null;
  tags?: unknown;
  subtypes?: unknown;
  audiences?: unknown;
  occasions?: unknown;
  city_slug?: string | null;
  source_primary?: string | null;
  source_refs?: unknown;

  is_plannable?: boolean | null;
  family_friendly?: boolean | null;

  quality_score?: number | null;
  importance_score?: number | null;
  popularity_score?: number | null;
  manual_boost?: number | null;
  data_confidence?: number | null;
  enrichment_version?: number | null;
  last_enriched_at?: string | null;

  quality_notes?: string | null;
  opening_hours_raw?: string | null;
  energy_level?: "low" | "medium" | "high" | "late" | null;
  indoor_outdoor?: "indoor" | "outdoor" | "mixed" | null;

  rating?: number | null;
  rating_count?: number | null;

  breakfast_fit?: boolean | null;
  lunch_fit?: boolean | null;
  dinner_fit?: boolean | null;
  nightlife_fit?: boolean | null;
  evening_only?: boolean | null;

  daytime_fit?: Array<"morning" | "midday" | "evening" | "night"> | null;
};

export type PlannerEventRow = {
  id: string;
  source: string;
  external_id: string;
  source_url?: string | null;
  ticket_url?: string | null;
  title: string;
  summary?: string | null;
  category: PlannerEventCategory;
  kind: PlannerEventKind;
  status?: "scheduled" | "cancelled" | "postponed" | "draft" | null;
  venue_name?: string | null;
  venue_address?: string | null;
  city_slug?: string | null;
  country_code?: string | null;
  lat?: number | null;
  lng?: number | null;
  timezone?: string | null;
  start_at: string;
  end_at?: string | null;
  doors_at?: string | null;
  all_day?: boolean | null;
  is_ticketed?: boolean | null;
  price_min?: number | null;
  price_max?: number | null;
  currency?: string | null;
  family_friendly?: boolean | null;
  indoor_outdoor?: "indoor" | "outdoor" | "mixed" | null;
  local_rank?: number | null;
  importance_score?: number | null;
  popularity_score?: number | null;
  tags?: unknown;
  subtypes?: unknown;
  audiences?: unknown;
  occasions?: unknown;
  source_payload?: unknown;
  source_updated_at?: string | null;
  last_seen_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type SlotDefinition = {
  index: number;
  kind: SlotKind;
  label: string;
  hint: string;
  phase?: OccasionPhase | null;
  phaseGoal?: string | null;
  minDurationMin?: number;
  maxDurationMin?: number;
  preferredCategories?: string[];
  allowedCategories?: string[];
};

export type PlanningContext = {
  citySlug: string | null;
  planDate: string | null;
  dayStartMin: number | null;
  explicitEventId: string | null;
  eventPlanningMode: EventPlanningMode;
  occasion: OccasionKey;
  experienceMode: ExperienceMode;
  eventStrictness: EventStrictness;
  evaluationMode: EvaluationMode;
  origin: {
    label: string;
    lat: number | null;
    lng: number | null;
  };
  timeBudgetMin: number;
  preferredDaytimes: Array<"morning" | "midday" | "evening" | "night">;
  mergedInterests: string[];
  interestWeights: Map<string, number>;
  groupSignals: {
    enabled: boolean;
    participantCount: number;
    activeParticipantCount: number;
    participants: Array<{
      name: string;
      interests: string[];
      isCurrentUser?: boolean;
    }>;
    sharedAcrossAll: string[];
    overlapping: string[];
    uniqueSignals: Array<{
      name: string;
      interests: string[];
      isCurrentUser?: boolean;
    }>;
  };
  slotTemplate: SlotDefinition[];
  filters: {
    budget: string;
    occasion: OccasionKey;
    familyAgeBand: FamilyAgeBand | null;
    radiusKm: number;
    sortMode: "match" | "distance";
    routeProfile: RouteProfile;
  };
};

export type CandidateLocation = LocationRow & {
  distanceFromOriginKm: number | null;
  retrievalReasons: string[];
};

export type CandidateBuckets = {
  breakfast: CandidateLocation[];
  lunch: CandidateLocation[];
  dinner: CandidateLocation[];
  activity: CandidateLocation[];
  nightlife: CandidateLocation[];
  fallback: CandidateLocation[];
};

export type CandidateScore = {
  preference: number;
  occasion: number;
  distance: number;
  quality: number;
  slotFit: number;
  diversityPenalty: number;
  total: number;
};

export type ScoredLocation = CandidateLocation & {
  score: number;
  prefBoost: number;
  totalScore: number;
  matchLevel: MatchLevel;
};

export type PlannedStop = {
  index: number;
  label: string;
  hint: string;
  item: ScoredLocation | null;
  durationMin: number | null;
  travelMinFromPrev: number | null;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  timingLock?: "none" | "event" | null;
  timingWarnings?: string[];
  reasons: string[];
  groupDecision?: {
    matchCount: number;
    participantCount: number;
    matchedParticipants: string[];
    matchedInterests: string[];
    explanation: string;
    balanceNote?: string | null;
    compromiseLevel?: "shared" | "balanced" | "single_preference" | null;
  } | null;
  debug?: PlannedStopDebug | null;
};

export type PlannedStopPolicyTrace = {
  key: string;
  scoreDelta: number;
  hardFail?: boolean;
  reasons?: string[];
  meta?: Record<string, unknown>;
};

export type PlannedStopDebug = {
  selectedFrom:
    | "feasible"
    | "relaxed"
    | "soft"
    | "forced_peak"
    | "forced_event"
    | "family_meal_fallback";
  finalScore: number;
  candidateTotalScore: number;
  travelFeasible: boolean;
  hardFail: boolean;
  policyResults: PlannedStopPolicyTrace[];
};

export type StopExplanation = {
  stopIndex: number;
  locationId: string | null;
  reasons: string[];
};

export type RouteSummaryLite = {
  distanceKm: number;
  travelMin: number;
  activityMin: number;
  totalMin: number;
};

export type PlanVariantGoal =
  | "best_match"
  | "shortest_route"
  | "more_diverse"
  | "premium";

export type PlanVariant = {
  variantId: string;
  label: string;
  goal: PlanVariantGoal;
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

export type PlannerResponse = {
  context: PlanningContext;
  results: ScoredLocation[];
  activeLevel: MatchLevel;
  effectiveRadiusKm: number;
  plannedStops: PlannedStop[];
  fallbackSummary: RouteSummaryLite;
  variants?: PlanVariant[];
};

export type RetrievalResult = {
  candidates: CandidateLocation[];
  effectiveRadiusKm: number;
};

export type OptimizeRouteParams = {
  stops: PlannedStop[];
  origin: {
    lat: number | null;
    lng: number | null;
  };
  planMode: PlanMode;
};
