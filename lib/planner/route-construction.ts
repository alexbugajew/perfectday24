import { buildStopReasons } from "./explanations";
import { buildLocationSearchText, classify, getSubtypes, hasSubtype, norm } from "./features";
import { slotInterestBoost } from "./interest";
import {
  clusterPolicy,
  continuationPolicy,
  diversityPolicy,
  evaluateCandidateWithPolicies,
  interestPolicy,
  occasionPolicy,
  slotPolicy,
  travelPolicy,
} from "./policies";
import {
  chooseCandidateWithVariation,
  chooseEventAnchor,
  choosePeakAnchor,
  filterPoolAroundPeak,
  preferredEventSlotIndex,
  preferredPeakSlotIndex,
  sameBucketChainPenalty,
} from "./route/anchor";
import { getPoolForKind } from "./route/pools";
import {
  applyStopSchedule,
  estimateDurationMin,
  getRouteBufferMin,
  isMealKind,
  maxSegmentDistanceKm,
  maxSegmentTravelMin,
} from "./route/timing";
import { estimateTravelMinFromKmForProfile, haversineKm } from "./travel";
import { slotCategoryMatch } from "./slots";
import { familyAgeBandBoost, familySlotHardReject } from "./occasions/family";
import type {
  LocationCategory,
  PlannedStop,
  PlanningContext,
  ScoredLocation,
  SlotKind,
  PlanMode,
  SlotDefinition,
} from "./types";

const baseCandidatePolicies = [
  travelPolicy,
  diversityPolicy,
  occasionPolicy,
  interestPolicy,
  slotPolicy,
  continuationPolicy,
  clusterPolicy,
];

function clampDurationForSlot(slot: SlotDefinition, durationMin: number) {
  const minDuration =
    typeof slot.minDurationMin === "number" && Number.isFinite(slot.minDurationMin)
      ? slot.minDurationMin
      : null;
  const maxDuration =
    typeof slot.maxDurationMin === "number" && Number.isFinite(slot.maxDurationMin)
      ? slot.maxDurationMin
      : null;

  let clamped = durationMin;
  if (minDuration != null) clamped = Math.max(clamped, minDuration);
  if (maxDuration != null) clamped = Math.min(clamped, maxDuration);
  return clamped;
}

function buildGroupDecision(
  context: PlanningContext,
  candidate: ScoredLocation,
  slotKind?: SlotKind
) {
  if (!context.groupSignals.enabled || context.groupSignals.participantCount <= 1) {
    return null;
  }

  const searchableText = buildLocationSearchText(candidate);
  const subtypeSet = new Set(getSubtypes(candidate).map(norm));
  const matchedParticipants: string[] = [];
  const matchedInterests = new Set<string>();

  for (const participant of context.groupSignals.uniqueSignals) {
    const hit = participant.interests.filter((interest) => {
      const normalized = norm(interest);
      return subtypeSet.has(normalized) || searchableText.includes(normalized);
    });
    if (hit.length > 0) {
      matchedParticipants.push(participant.name);
      hit.forEach((interest) => matchedInterests.add(interest));
    }
  }

  const sharedHits = context.groupSignals.sharedAcrossAll.filter((interest) => {
    const normalized = norm(interest);
    return subtypeSet.has(normalized) || searchableText.includes(normalized);
  });
  const overlappingHits = context.groupSignals.overlapping.filter((interest) => {
    const normalized = norm(interest);
    return subtypeSet.has(normalized) || searchableText.includes(normalized);
  });

  sharedHits.forEach((interest) => matchedInterests.add(interest));
  overlappingHits.forEach((interest) => matchedInterests.add(interest));

  const matchCount = sharedHits.length > 0
    ? context.groupSignals.activeParticipantCount
    : Math.min(
        context.groupSignals.activeParticipantCount,
        Math.max(matchedParticipants.length, overlappingHits.length > 0 ? 2 : 0)
      );

  if (matchCount <= 0 && matchedInterests.size === 0) {
    return null;
  }

  const participantCount = Math.max(1, context.groupSignals.activeParticipantCount);
  const interestList = Array.from(matchedInterests).slice(0, 3);
  let explanation = `für ${matchCount} von ${participantCount} passend`;
  let balanceNote: string | null = null;
  let compromiseLevel: "shared" | "balanced" | "single_preference" | null = null;

  if (sharedHits.length > 0) {
    explanation = `${sharedHits.slice(0, 2).join(" + ")} gemeinsam berücksichtigt`;
    compromiseLevel = "shared";
    if (sharedHits.some((interest) => interest.includes("outdoor") || interest.includes("park"))) {
      balanceNote = "Outdoor blieb als gemeinsamer Nenner erhalten.";
    } else {
      balanceNote = "Hier konnte ein klarer gemeinsamer Nenner gehalten werden.";
    }
  } else if (interestList.length > 0) {
    explanation = `berücksichtigt ${interestList.slice(0, 2).join(" + ")}`;
    if (overlappingHits.length > 0 && matchedParticipants.length > 0) {
      compromiseLevel = "balanced";
      balanceNote = `Der Stop balanciert gemeinsame Signale mit Einzelwünschen wie ${interestList
        .slice(0, 2)
        .join(" + ")}.`;
    } else if (matchedParticipants.length === 1) {
      compromiseLevel = "single_preference";
      const leadInterest = interestList[0] ?? "einen Einzelwunsch";
      if (slotKind === "dinner" || slotKind === "lunch" || slotKind === "breakfast") {
        balanceNote = `${leadInterest} wurde bei diesem Essens-Stop priorisiert, andere Signale treten hier etwas zurück.`;
      } else if (classify(candidate) === "nightlife") {
        balanceNote = "Nightlife wurde für diesen Stop bewusst stärker gewichtet als ruhigere Wünsche.";
      } else {
        balanceNote = `${leadInterest} wurde hier bewusst priorisiert, damit nicht nur gemeinsame Nenner übrig bleiben.`;
      }
    }
  }

  return {
    matchCount,
    participantCount,
    matchedParticipants: matchedParticipants.slice(0, 3),
    matchedInterests: interestList,
    explanation,
    balanceNote,
    compromiseLevel,
  };
}

function slotPriorityBoost(slotKind: SlotKind, cand: ScoredLocation, planMode: PlanMode) {
  const category = classify(cand);
  const strict = slotCategoryMatch(slotKind, cand);

  if (slotKind === "breakfast") {
    if (strict) return 42;
    if (category === "cafe") return 24;
    if (category === "restaurant") return 8;
    return -12;
  }

  if (slotKind === "lunch") {
    if (strict) return 38;
    if (category === "restaurant") return 24;
    if (category === "cafe") return 10;
    return -10;
  }

  if (slotKind === "dinner") {
    if (strict) return 40;
    if (category === "restaurant") return 26;
    if (category === "nightlife") return 6;
    return -12;
  }

  if (slotKind === "activity") {
    if (strict) return 24;
    if (category === "culture" || category === "activity" || category === "event") {
      return 14;
    }
    if (category === "nightlife" && planMode === "evening") return 4;
    return -8;
  }

  if (slotKind === "sightseeing") {
    if (strict) return 30;
    if (category === "culture" || category === "activity" || category === "event") {
      return 18;
    }
    if (category === "nightlife") return -10;
    if (category === "restaurant" || category === "cafe") return -14;
    return -8;
  }

  if (slotKind === "anything") {
    if (planMode === "evening" && category === "nightlife") return 20;
    if (category === "culture" || category === "activity" || category === "nightlife") {
      return 8;
    }
    return 0;
  }

  return 0;
}

function targetedInterestBoostForSlot(params: {
  context: PlanningContext;
  candidate: ScoredLocation;
  slotKind: SlotKind;
}) {
  const { context, candidate, slotKind } = params;
  const raw = slotInterestBoost({
    loc: candidate,
    interests: context.mergedInterests,
    weightMap: context.interestWeights,
    slotKind,
  });

  const multiplier =
    slotKind === "activity"
      ? 0.65
      : slotKind === "sightseeing" || slotKind === "walk"
        ? 0.7
        : slotKind === "dinner" || slotKind === "lunch"
          ? 0.55
          : 0.4;

  const cap =
    slotKind === "activity"
      ? 110
      : slotKind === "sightseeing" || slotKind === "walk"
        ? 120
        : slotKind === "dinner" || slotKind === "lunch"
          ? 100
          : 80;

  return Math.min(cap, Math.round(raw * multiplier));
}

function experienceSlotBoost(
  context: PlanningContext,
  slotKind: SlotKind,
  cand: ScoredLocation
) {
  if (classify(cand) !== "event" || context.experienceMode === "classic") return 0;

  const refs =
    cand.source_refs && typeof cand.source_refs === "object"
      ? (cand.source_refs as Record<string, unknown>)
      : null;
  const isOfficialFlexEvent =
    refs?.eventKind === "flex_event" && typeof refs?.source === "string";

  if (context.experienceMode === "show") {
    return hasSubtype(cand, "concert", "theater", "show", "performing_arts", "live_music")
      ? slotKind === "activity" || slotKind === "tour" || slotKind === "nightlife"
        ? 85
        : 45
      : -20;
  }

  if (context.experienceMode === "market_festival") {
    if (hasSubtype(cand, "market", "festival", "food_event", "seasonal_event", "fairground")) {
      if (slotKind === "activity" || slotKind === "sightseeing" || slotKind === "walk") {
        return isOfficialFlexEvent ? 118 : 70;
      }
      return isOfficialFlexEvent ? 54 : 30;
    }
    return -12;
  }

  return slotKind === "activity" || slotKind === "sightseeing" || slotKind === "tour"
    ? 42
    : 16;
}

function isConcreteOfficialFlexEvent(candidate: ScoredLocation) {
  if (classify(candidate) !== "event") return false;

  const refs =
    candidate.source_refs && typeof candidate.source_refs === "object"
      ? (candidate.source_refs as Record<string, unknown>)
      : null;

  return (
    refs?.eventKind === "flex_event" &&
    typeof refs?.source === "string" &&
    hasSubtype(candidate, "concrete_event_page")
  );
}

function isConcreteOfficialAnchoredEvent(candidate: ScoredLocation) {
  if (classify(candidate) !== "event") return false;

  const refs =
    candidate.source_refs && typeof candidate.source_refs === "object"
      ? (candidate.source_refs as Record<string, unknown>)
      : null;

  // DB-ingested planner_event rows are always concrete official events — trust them
  // unconditionally as long as they are anchored events with a source.
  if (candidate.source_primary === "planner_event") {
    return refs?.eventKind === "anchored_event" && typeof refs?.source === "string";
  }

  return (
    refs?.eventKind === "anchored_event" &&
    typeof refs?.source === "string" &&
    hasSubtype(candidate, "concrete_event_page")
  );
}

function partyPeakReservePenalty(params: {
  context: PlanningContext;
  slotPhase: string | null | undefined;
  candidate: ScoredLocation;
  usedIds: Set<string>;
  allCandidates: ScoredLocation[];
}) {
  const { context, slotPhase, candidate, usedIds, allCandidates } = params;

  if (
    context.filters.occasion !== "party" ||
    context.slotTemplate.every((slot) => slot.phase !== "party_peak")
  ) {
    return 0;
  }

  if (slotPhase !== "party_warmup" && slotPhase !== "party_social") {
    return 0;
  }

  const category = classify(candidate);
  if (category !== "nightlife" && category !== "event") {
    return 0;
  }

  const remainingNightlife = allCandidates.filter((other) => {
    if (other.id === candidate.id || usedIds.has(other.id)) return false;
    const otherCategory = classify(other);
    return otherCategory === "nightlife" || otherCategory === "event";
  }).length;

  if (remainingNightlife <= 0) {
    return slotPhase === "party_warmup" ? 120 : 80;
  }

  if (remainingNightlife === 1 && slotPhase === "party_warmup") {
    return 45;
  }

  return 0;
}

function eventAnchorFlowBoost(params: {
  context: PlanningContext;
  slotIndex: number;
  slotKind: SlotKind;
  candidate: ScoredLocation;
  eventAnchor: { slotIndex: number; candidate: ScoredLocation } | null;
}) {
  const { context, slotIndex, slotKind, candidate, eventAnchor } = params;
  if (!eventAnchor || candidate.id === eventAnchor.candidate.id) return 0;

  const relative = slotIndex - eventAnchor.slotIndex;
  const category = classify(candidate);

  if (context.experienceMode === "show") {
    if (relative === -1) {
      if (slotKind === "dinner") {
        if (category === "restaurant") return 68;
        if (category === "cafe") return 24;
        if (category === "event") return -260;
        if (category === "culture") return -120;
        if (category === "nightlife") return -95;
        if (category === "activity") return -70;
      }
      if (category === "event") return -140;
      if (slotKind === "dinner" && category === "restaurant") return 28;
      if (slotKind === "breakfast" && category === "cafe") return 10;
    }
    if (relative <= -2 && category === "event") return -90;
    if (relative === 1) {
      if (category === "event") return -420;
      if (category === "culture") return -80;
      if (category === "nightlife") return 42;
      if (category === "cafe" || category === "restaurant") return 16;
      if (slotKind === "walk" || slotKind === "anything") return 18;
    }
  }

  if (context.experienceMode === "market_festival") {
    if (relative === -1 && (category === "cafe" || category === "restaurant")) return 12;
    if (relative === 1 && (slotKind === "walk" || category === "nightlife")) return 8;
  }

  if (context.experienceMode === "event_visit") {
    if (relative === -1 && (category === "restaurant" || category === "cafe")) return 14;
    if (relative === 1) {
      if (category === "event") return -280;
      if (category === "nightlife") return 24;
      if (slotKind === "walk") return 14;
      if (category === "cafe" || category === "restaurant") return 10;
    }
  }

  return 0;
}

function buildCarryForwardPartyPeak(previousStop: ScoredLocation | null, slot: PlanningContext["slotTemplate"][number]) {
  if (slot.phase !== "party_peak" || !previousStop) return null;

  const category = classify(previousStop);
  if (category !== "nightlife" && category !== "event") {
    return null;
  }

  return {
    candidate: previousStop,
    finalScore: previousStop.totalScore + 20,
    travelMin: 0,
    durationMin: estimateDurationMin(previousStop),
    strictMatch: slotCategoryMatch(slot.kind, previousStop),
    travelFeasible: true,
    policyResults: [],
    policyReasons: ["setzt den Peak im bestehenden Nightlife-Cluster fort"],
    hardFail: false,
  };
}

function buildCarryForwardPartyAfter(
  previousStop: ScoredLocation | null,
  slot: PlanningContext["slotTemplate"][number]
) {
  if (slot.phase !== "party_after" || !previousStop) return null;

  const category = classify(previousStop);
  if (category !== "nightlife" && category !== "event") {
    return null;
  }

  return {
    candidate: previousStop,
    finalScore: previousStop.totalScore + 12,
    travelMin: 0,
    durationMin: Math.max(35, Math.min(60, estimateDurationMin(previousStop))),
    strictMatch: slotCategoryMatch(slot.kind, previousStop),
    travelFeasible: true,
    policyResults: [],
    policyReasons: ["haelt den After im bestehenden Nightlife-Cluster zusammen"],
    hardFail: false,
  };
}

function resolveCandidateReferenceCoords(
  candidate: ScoredLocation,
  candidates: ScoredLocation[]
) {
  if (candidate.lat != null && candidate.lng != null) {
    return candidate;
  }

  const refs =
    candidate.source_refs && typeof candidate.source_refs === "object"
      ? (candidate.source_refs as Record<string, unknown>)
      : null;
  const venueName =
    typeof refs?.venueName === "string" && refs.venueName.trim().length > 0
      ? norm(refs.venueName)
      : "";

  if (!venueName) return candidate;

  const match = candidates
    .filter(
      (row) =>
        row.id !== candidate.id &&
        row.lat != null &&
        row.lng != null &&
        classify(row) !== "event"
    )
    .map((row) => {
      const name = norm(row.name);
      const text = buildLocationSearchText(row);
      const exact = name === venueName ? 1 : 0;
      const contains =
        exact === 1 || name.includes(venueName) || venueName.includes(name) || text.includes(venueName)
          ? 1
          : 0;
      return {
        row,
        exact,
        contains,
      };
    })
    .filter((row) => row.contains === 1)
    .sort((a, b) => {
      if (b.exact !== a.exact) return b.exact - a.exact;
      return (b.row.totalScore ?? 0) - (a.row.totalScore ?? 0);
    })[0]?.row;

  if (!match || match.lat == null || match.lng == null) {
    return candidate;
  }

  return {
    ...candidate,
    lat: match.lat,
    lng: match.lng,
    source_refs: {
      ...(refs ?? {}),
      derivedVenueCoordinates: true,
      derivedVenueLocationId: match.id,
    },
  };
}

function buildTourismRelaxedFallback(params: {
  context: PlanningContext;
  slot: PlanningContext["slotTemplate"][number];
  previousStop: ScoredLocation | null;
  candidates: ScoredLocation[];
  usedIds: Set<string>;
}) {
  const { context, slot, previousStop, candidates, usedIds } = params;
  const anchorStop = previousStop ? resolveCandidateReferenceCoords(previousStop, candidates) : null;

  if (
    context.filters.occasion !== "tourism" ||
    slot.phase !== "tour_relaxed"
  ) {
    return null;
  }

  const anchorLat = anchorStop?.lat ?? context.origin.lat;
  const anchorLng = anchorStop?.lng ?? context.origin.lng;
  const maxTravelMin = context.filters.routeProfile === "foot" ? 28 : 34;

  const pool = candidates
    .filter((candidate) => {
      if (usedIds.has(candidate.id)) return false;

      const category = classify(candidate);
      if (category === "restaurant" || category === "cafe" || category === "nightlife") {
        return false;
      }

      const isScenic =
        hasSubtype(
          candidate,
          "promenade",
          "viewpoint",
          "park",
          "garden",
          "waterfront",
          "historic_site",
          "monument",
          "memorial",
          "old_town"
        ) || category === "culture" || category === "activity";

      if (!isScenic) return false;

      if (
        anchorLat != null &&
        anchorLng != null &&
        candidate.lat != null &&
        candidate.lng != null
      ) {
        const travelMin = estimateTravelMinFromKmForProfile(
          haversineKm(anchorLat, anchorLng, candidate.lat, candidate.lng),
          context.filters.routeProfile
        );
        return travelMin != null && travelMin <= maxTravelMin;
      }

      return false;
    })
    .map((candidate) => {
      const travelMin =
        anchorLat != null &&
        anchorLng != null &&
        candidate.lat != null &&
        candidate.lng != null
          ? estimateTravelMinFromKmForProfile(
              haversineKm(anchorLat, anchorLng, candidate.lat, candidate.lng),
              context.filters.routeProfile
            ) ?? 0
          : 0;

      const scenicBoost = hasSubtype(
        candidate,
        "promenade",
        "viewpoint",
        "park",
        "garden",
        "waterfront"
      )
        ? 28
        : classify(candidate) === "culture"
          ? 18
          : 12;
      const classicTourismBoost =
        context.experienceMode === "classic"
          ? hasSubtype(candidate, "viewpoint", "waterfront", "promenade", "historic_site")
            ? 14
            : classify(candidate) === "culture"
              ? 10
              : 6
          : 0;

      return {
        candidate,
        finalScore: (candidate.totalScore ?? 0) + scenicBoost + classicTourismBoost - travelMin,
        travelMin,
        durationMin: Math.min(60, estimateDurationMin(candidate)),
        strictMatch: slotCategoryMatch(slot.kind, candidate),
        travelFeasible: true,
        policyResults: [],
        policyReasons: [
          context.experienceMode === "market_festival"
            ? "haelt den Festival-Tag mit einem leichten, touristischen Abschluss rund"
            : "rundet den Tourism-Flow mit einem leichten Scenic- oder Kulturabschluss ab",
        ],
        hardFail: false,
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore);

  return pool[0] ?? null;
}

function buildFamilyMealFallback(params: {
  context: PlanningContext;
  slot: PlanningContext["slotTemplate"][number];
  previousStop: ScoredLocation | null;
  peakCandidate: ScoredLocation | null;
  candidates: ScoredLocation[];
  usedIds: Set<string>;
}) {
  const { context, slot, previousStop, peakCandidate, candidates, usedIds } = params;

  if (context.filters.occasion !== "family" || !isMealKind(slot.kind)) {
    return null;
  }

  const anchorStop =
    previousStop != null
      ? resolveCandidateReferenceCoords(previousStop, candidates)
      : peakCandidate != null
        ? resolveCandidateReferenceCoords(peakCandidate, candidates)
        : null;
  const anchorLat = anchorStop?.lat ?? context.origin.lat;
  const anchorLng = anchorStop?.lng ?? context.origin.lng;
  const hasPreviousStop = previousStop != null;
  const relaxedDistanceLimit =
    maxSegmentDistanceKm(context, slot.kind, hasPreviousStop) +
    (context.filters.routeProfile === "foot"
      ? 0.9
      : context.filters.routeProfile === "public_transit"
        ? 1.8
        : 4.0);
  const relaxedTravelLimit =
    maxSegmentTravelMin(context, slot.kind, hasPreviousStop) +
    (context.filters.routeProfile === "foot"
      ? 12
      : context.filters.routeProfile === "public_transit"
        ? 18
        : 22);

  const mealPool = candidates.filter((candidate) => {
    if (usedIds.has(candidate.id)) return false;

    const slotReject = familySlotHardReject({
      ageBand: context.filters.familyAgeBand,
      candidate,
      slotKind: slot.kind,
      phase: slot.phase,
      allCandidates: candidates,
    });
    if (slotReject.reject) return false;

    const category = classify(candidate);
    if (slot.kind === "breakfast") {
      return category === "cafe" || category === "restaurant";
    }
    return category === "restaurant";
  });

  if (mealPool.length === 0) return null;

  const withTravel = mealPool
    .map((candidate) => {
      const travelKm =
        anchorLat != null &&
        anchorLng != null &&
        candidate.lat != null &&
        candidate.lng != null
          ? haversineKm(anchorLat, anchorLng, candidate.lat, candidate.lng)
          : null;
      const travelMin = estimateTravelMinFromKmForProfile(
        travelKm,
        context.filters.routeProfile
      );
      const withinRelaxedWindow =
        travelKm != null &&
        Number.isFinite(travelKm) &&
        travelKm <= relaxedDistanceLimit &&
        travelMin != null &&
        travelMin <= relaxedTravelLimit;

      const breakfastBonus =
        slot.kind === "breakfast" && classify(candidate) === "cafe" ? 18 : 0;

      return {
        candidate,
        travelMin,
        withinRelaxedWindow,
        finalScore:
          candidate.totalScore +
          familyAgeBandBoost(context.filters.familyAgeBand, candidate) +
          breakfastBonus -
          (travelMin ?? 18),
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore);

  const chosen =
    withTravel.find((item) => item.withinRelaxedWindow) ??
    withTravel.find((item) => item.travelMin != null) ??
    withTravel[0] ??
    null;

  if (!chosen) return null;

  return {
    candidate: chosen.candidate,
    finalScore: chosen.finalScore,
    travelMin: chosen.travelMin,
    durationMin: clampDurationForSlot(slot, estimateDurationMin(chosen.candidate)),
    strictMatch: slotCategoryMatch(slot.kind, chosen.candidate),
    travelFeasible: true,
    policyResults: [],
    policyReasons: [
      slot.kind === "breakfast"
        ? "sichert den Family-Start mit einem belastbaren Cafe- oder Fruehstuecks-Fallback"
        : "sichert den Family-Essensslot mit einem belastbaren Restaurant-Fallback",
    ],
    hardFail: false,
  };
}

function buildPostShowFallback(params: {
  context: PlanningContext;
  slot: PlanningContext["slotTemplate"][number];
  slotIndex: number;
  eventAnchor: { slotIndex: number; candidate: ScoredLocation } | null;
  previousStop: ScoredLocation | null;
  candidates: ScoredLocation[];
  usedIds: Set<string>;
}) {
  const { context, slot, slotIndex, eventAnchor, previousStop, candidates, usedIds } = params;

  if (!eventAnchor || slotIndex <= eventAnchor.slotIndex) return null;
  if (
    context.experienceMode !== "show" &&
    context.experienceMode !== "event_visit"
  ) {
    return null;
  }
  if (slot.phase !== "close" && slot.phase !== "social_peak") return null;
  if (slot.kind !== "nightlife" && slot.kind !== "anything" && slot.kind !== "walk") {
    return null;
  }

  const anchorStop = resolveCandidateReferenceCoords(previousStop ?? eventAnchor.candidate, candidates);
  const anchorLat = anchorStop.lat ?? context.origin.lat;
  const anchorLng = anchorStop.lng ?? context.origin.lng;
  const maxTravelMin = context.filters.routeProfile === "foot" ? 30 : 42;

  const pool = candidates
    .filter((candidate) => {
      if (usedIds.has(candidate.id)) return false;
      if (candidate.id === eventAnchor.candidate.id) return false;

      const category = classify(candidate);
      if (category === "event") return false;

      const softAfterShow =
        category === "nightlife" ||
        category === "cafe" ||
        category === "restaurant" ||
        category === "culture" ||
        category === "activity" ||
        hasSubtype(
          candidate,
          "cocktail_bar",
          "pub",
          "rooftop_bar",
          "wine_bar",
          "promenade",
          "viewpoint",
          "park",
          "garden",
          "waterfront"
        );

      if (!softAfterShow) return false;

      if (candidate.lat != null && candidate.lng != null && anchorLat != null && anchorLng != null) {
        const travelMin = estimateTravelMinFromKmForProfile(
          haversineKm(anchorLat, anchorLng, candidate.lat, candidate.lng),
          context.filters.routeProfile
        );
        return travelMin != null && travelMin <= maxTravelMin;
      }

      return false;
    })
    .map((candidate) => {
      const travelMin =
        anchorLat != null && anchorLng != null && candidate.lat != null && candidate.lng != null
          ? estimateTravelMinFromKmForProfile(
              haversineKm(anchorLat, anchorLng, candidate.lat, candidate.lng),
              context.filters.routeProfile
            ) ?? 0
          : 0;
      const category = classify(candidate);

      let softBoost = 0;
      if (category === "nightlife") softBoost += 34;
      else if (category === "cafe") softBoost += 18;
      else if (category === "restaurant") softBoost += 12;
      else if (hasSubtype(candidate, "promenade", "viewpoint", "park", "garden", "waterfront")) {
        softBoost += 16;
      } else if (category === "culture" || category === "activity") {
        softBoost += 8;
      }

      if (context.filters.occasion === "date" && category === "nightlife") {
        softBoost += 10;
      }
      if (context.filters.occasion === "friends" && category === "nightlife") {
        softBoost += 8;
      }

      return {
        candidate,
        finalScore: (candidate.totalScore ?? 0) + softBoost - travelMin,
        travelMin,
        durationMin: Math.min(70, estimateDurationMin(candidate)),
        strictMatch: slotCategoryMatch(slot.kind, candidate),
        travelFeasible: true,
        policyResults: [],
        policyReasons: ["setzt nach dem Event bewusst auf einen ruhigeren, sozialen Ausklang"],
        hardFail: false,
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore);

  return pool[0] ?? null;
}

/**
 * Notnagel fuer den Stop VOR dem Event — Gegenstueck zu buildPostShowFallback.
 *
 * Liegt das Event am Stadtrand (Arena, Messegelaende, Freilichtbuehne), steht im
 * Cluster-Radius um den Anker haeufig nichts: Beim DBB Super Cup in der Hamburger
 * Arena lag genau ein Lokal innerhalb der 3,1 km, die die Cluster-Policy einem
 * Essens-Slot neben dem Anker zugesteht — waehrend die Stadt 210 im Pool hatte.
 * Alle Kandidaten fielen hart durch, und der Auftakt blieb leer.
 *
 * Hier zaehlt deshalb nicht der Abstand zum Event, sondern der Umweg. Wer vom
 * Startpunkt zur Arena faehrt, isst unterwegs; gesucht ist der Stop, der
 * `Start → X → Event` am wenigsten verlaengert. Der Fallback greift erst, wenn
 * alle regulaeren Stufen leer ausgegangen sind, und kann gute Plaene damit nicht
 * verschlechtern — er ersetzt nur den leeren Stop.
 */
function buildPreShowFallback(params: {
  context: PlanningContext;
  slot: PlanningContext["slotTemplate"][number];
  slotIndex: number;
  eventAnchor: { slotIndex: number; candidate: ScoredLocation } | null;
  previousStop: ScoredLocation | null;
  candidates: ScoredLocation[];
  usedIds: Set<string>;
}) {
  const { context, slot, slotIndex, eventAnchor, previousStop, candidates, usedIds } = params;

  if (!eventAnchor || slotIndex >= eventAnchor.slotIndex) return null;
  if (
    context.experienceMode !== "show" &&
    context.experienceMode !== "event_visit"
  ) {
    return null;
  }

  const anchor = resolveCandidateReferenceCoords(eventAnchor.candidate, candidates);
  const startStop = previousStop
    ? resolveCandidateReferenceCoords(previousStop, candidates)
    : null;
  const fromLat = startStop?.lat ?? context.origin.lat;
  const fromLng = startStop?.lng ?? context.origin.lng;
  if (anchor.lat == null || anchor.lng == null || fromLat == null || fromLng == null) {
    return null;
  }

  const directKm = haversineKm(fromLat, fromLng, anchor.lat, anchor.lng);
  if (!Number.isFinite(directKm)) return null;

  // Wieviel Umweg ein Zwischenstopp kosten darf. Zu Fuss ist die Schmerzgrenze
  // deutlich enger als mit Bahn oder Auto.
  const maxDetourKm =
    context.filters.routeProfile === "foot"
      ? 1.6
      : context.filters.routeProfile === "public_transit"
        ? 4.5
        : 6;

  const meal =
    slot.kind === "dinner" || slot.kind === "lunch" || slot.kind === "breakfast";

  const pool = candidates
    .filter((candidate) => {
      if (usedIds.has(candidate.id)) return false;
      if (candidate.id === eventAnchor.candidate.id) return false;
      if (candidate.lat == null || candidate.lng == null) return false;

      const category = classify(candidate);
      // Ein zweites Event vor dem Event waere kein Auftakt, sondern Konkurrenz.
      if (category === "event") return false;
      if (meal) return category === "restaurant" || category === "cafe";
      return (
        category === "restaurant" ||
        category === "cafe" ||
        category === "culture" ||
        category === "activity"
      );
    })
    .map((candidate) => {
      const toCandidateKm = haversineKm(fromLat, fromLng, candidate.lat!, candidate.lng!);
      const toAnchorKm = haversineKm(candidate.lat!, candidate.lng!, anchor.lat!, anchor.lng!);
      return {
        candidate,
        toCandidateKm,
        detourKm: toCandidateKm + toAnchorKm - directKm,
      };
    })
    .filter((entry) => Number.isFinite(entry.detourKm) && entry.detourKm <= maxDetourKm)
    .map((entry) => {
      const travelMin =
        estimateTravelMinFromKmForProfile(entry.toCandidateKm, context.filters.routeProfile) ?? 0;
      const category = classify(entry.candidate);

      let softBoost = 0;
      if (meal && category === "restaurant") softBoost += 30;
      else if (meal && category === "cafe") softBoost += 18;
      else if (category === "culture") softBoost += 12;
      else if (category === "activity") softBoost += 8;

      if (context.filters.occasion === "date" && category === "restaurant") softBoost += 8;

      return {
        candidate: entry.candidate,
        // Der Umweg wiegt schwer: Ein passables Lokal auf dem Weg schlaegt ein
        // besseres, das erst in die Gegenrichtung zwingt.
        finalScore:
          (entry.candidate.totalScore ?? 0) +
          softBoost -
          Math.round(entry.detourKm * 12) -
          travelMin,
        travelMin,
        // Vor einem festen Anker bleibt der Zwischenstopp bewusst knapp: Ein
        // ausgedehntes Essen wuerde den Tagesbeginn nur unplausibel nach vorn
        // druecken — dieselbe Obergrenze wie beim Ausklang danach.
        durationMin: Math.min(75, clampDurationForSlot(slot, estimateDurationMin(entry.candidate))),
        strictMatch: slotCategoryMatch(slot.kind, entry.candidate),
        travelFeasible: true,
        policyResults: [],
        policyReasons: ["liegt auf dem Weg zum Event und passt zeitlich davor"],
        hardFail: false,
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore);

  return pool[0] ?? null;
}

export function constructRoute(params: {
  context: PlanningContext;
  candidates: ScoredLocation[];
  planMode: PlanMode;
  stopOffsets?: number[];
  variationSeed?: number;
}): PlannedStop[] {
  const { context, candidates, planMode, stopOffsets = [], variationSeed = 0 } = params;

  const usedIds = new Set<string>();
  const usedCategories: LocationCategory[] = [];
  const output: PlannedStop[] = [];
  const eventAnchor = chooseEventAnchor({
    context,
    candidates,
    variationSeed,
  });
  const peakAnchor = choosePeakAnchor({
    context,
    candidates,
    planMode,
    usedIds,
    variationSeed,
    getPoolForKind,
    slotPriorityBoost,
  });
  const peakSlotIndex = peakAnchor?.slotIndex ?? preferredPeakSlotIndex(context);
  const effectivePeakCandidate =
    eventAnchor &&
    (context.experienceMode === "market_festival" || context.experienceMode === "show") &&
    eventAnchor.slotIndex === peakSlotIndex
      ? eventAnchor.candidate
      : peakAnchor?.candidate ?? null;

  let previousStop: ScoredLocation | null = null;
  let timeUsed = 0;

  const budgetMin = context.timeBudgetMin;
  const buffer = getRouteBufferMin(planMode);

  for (let i = 0; i < context.slotTemplate.length; i++) {
    const slot = context.slotTemplate[i];
    const offset = stopOffsets[i] ?? 0;
    const remainingSlots = context.slotTemplate.length - i - 1;

    const eventLockedCandidate =
      eventAnchor && i === eventAnchor.slotIndex ? eventAnchor.candidate : null;
    const peakLockedCandidate =
      peakAnchor && i === peakAnchor.slotIndex ? peakAnchor.candidate : null;

    const initialPoolRaw = getPoolForKind(candidates, slot, planMode, context).filter(
      (candidate) =>
        !usedIds.has(candidate.id) &&
        (eventAnchor == null ||
          i === eventAnchor.slotIndex ||
          candidate.id !== eventAnchor.candidate.id) &&
        (peakAnchor == null ||
          i === peakAnchor.slotIndex ||
          candidate.id !== peakAnchor.candidate.id)
    );
    const isPreShowMealSlot =
      context.experienceMode === "show" &&
      eventAnchor != null &&
      i < eventAnchor.slotIndex &&
      (slot.kind === "dinner" || slot.kind === "lunch" || slot.kind === "breakfast");
    const isPostShowCloseSlot =
      eventAnchor != null &&
      i > eventAnchor.slotIndex &&
      (context.experienceMode === "show" || context.experienceMode === "event_visit") &&
      (slot.phase === "close" || slot.phase === "social_peak") &&
      (slot.kind === "nightlife" || slot.kind === "anything" || slot.kind === "walk");
    const foodOnlyPool = isPreShowMealSlot
      ? initialPoolRaw.filter((candidate) => {
          const category = classify(candidate);
          return category === "restaurant" || category === "cafe";
        })
      : [];
    const postShowNonEventPool = isPostShowCloseSlot
      ? candidates.filter((candidate) => {
          const category = classify(candidate);
          return (
            category !== "event" &&
            (category === "nightlife" ||
              category === "cafe" ||
              category === "restaurant" ||
              category === "culture" ||
              category === "activity" ||
              hasSubtype(
                candidate,
                "cocktail_bar",
                "pub",
                "rooftop_bar",
                "wine_bar",
                "promenade",
                "viewpoint",
                "park",
                "garden",
                "waterfront"
              ))
          );
        })
      : [];
    const initialPool =
      isPreShowMealSlot && foodOnlyPool.length > 0 ? foodOnlyPool : initialPoolRaw;
    const eventTamedPool =
      isPostShowCloseSlot && postShowNonEventPool.length > 0 ? postShowNonEventPool : initialPool;
    const basePool = filterPoolAroundPeak({
      pool: eventTamedPool,
      context,
      slotKind: slot.kind,
      slotIndex: i,
      peakSlotIndex,
      peakCandidate: effectivePeakCandidate,
    });
    const poolWithLockedEvent =
      eventLockedCandidate &&
      !basePool.some((candidate) => candidate.id === eventLockedCandidate.id)
        ? [eventLockedCandidate, ...basePool]
        : basePool;

    if (poolWithLockedEvent.length === 0 || (isPreShowMealSlot && foodOnlyPool.length === 0)) {
      const carriedPeak = buildCarryForwardPartyPeak(previousStop, slot);
      if (carriedPeak) {
        timeUsed += carriedPeak.durationMin;
        usedCategories.push(classify(carriedPeak.candidate));
        previousStop = carriedPeak.candidate;

        output.push({
          index: slot.index + 1,
          label: slot.label,
          hint: slot.hint,
          item: carriedPeak.candidate,
          durationMin: carriedPeak.durationMin,
          travelMinFromPrev: 0,
          groupDecision: buildGroupDecision(context, carriedPeak.candidate, slot.kind),
          debug:
            context.evaluationMode === "trace"
              ? {
                  selectedFrom: "soft",
                  finalScore: Math.round(carriedPeak.finalScore),
                  candidateTotalScore: carriedPeak.candidate.totalScore ?? 0,
                  travelFeasible: true,
                  hardFail: false,
                  policyResults: [],
                }
              : null,
          reasons: buildStopReasons({
            candidate: carriedPeak.candidate,
            occasion: context.filters.occasion,
            strictMatch: carriedPeak.strictMatch,
            travelMin: 0,
            usedCategories: [...usedCategories],
            slotKind: slot.kind,
            phase: slot.phase,
            phaseGoal: slot.phaseGoal,
            occasionReasons: carriedPeak.policyReasons,
          }),
        });
        continue;
      }

      const carriedAfter = buildCarryForwardPartyAfter(previousStop, slot);
      if (carriedAfter) {
        timeUsed += carriedAfter.durationMin;
        usedCategories.push(classify(carriedAfter.candidate));
        previousStop = carriedAfter.candidate;

        output.push({
          index: slot.index + 1,
          label: slot.label,
          hint: slot.hint,
          item: carriedAfter.candidate,
          durationMin: carriedAfter.durationMin,
          travelMinFromPrev: 0,
          groupDecision: buildGroupDecision(context, carriedAfter.candidate, slot.kind),
          debug:
            context.evaluationMode === "trace"
              ? {
                  selectedFrom: "soft",
                  finalScore: Math.round(carriedAfter.finalScore),
                  candidateTotalScore: carriedAfter.candidate.totalScore ?? 0,
                  travelFeasible: true,
                  hardFail: false,
                  policyResults: [],
                }
              : null,
          reasons: buildStopReasons({
            candidate: carriedAfter.candidate,
            occasion: context.filters.occasion,
            strictMatch: carriedAfter.strictMatch,
            travelMin: 0,
            usedCategories: [...usedCategories],
            slotKind: slot.kind,
            phase: slot.phase,
            phaseGoal: slot.phaseGoal,
            occasionReasons: carriedAfter.policyReasons,
          }),
        });
        continue;
      }

      const tourismRelaxedFallback = buildTourismRelaxedFallback({
        context,
        slot,
        previousStop,
        candidates,
        usedIds,
      });
      if (tourismRelaxedFallback) {
        timeUsed +=
          (tourismRelaxedFallback.travelMin ?? 0) + tourismRelaxedFallback.durationMin;
        usedIds.add(tourismRelaxedFallback.candidate.id);
        usedCategories.push(classify(tourismRelaxedFallback.candidate));
        previousStop = tourismRelaxedFallback.candidate;

        output.push({
          index: slot.index + 1,
          label: slot.label,
          hint: slot.hint,
          item: tourismRelaxedFallback.candidate,
          durationMin: tourismRelaxedFallback.durationMin,
          travelMinFromPrev: tourismRelaxedFallback.travelMin,
          groupDecision: buildGroupDecision(
            context,
            tourismRelaxedFallback.candidate,
            slot.kind
          ),
          debug:
            context.evaluationMode === "trace"
              ? {
                  selectedFrom: "soft",
                  finalScore: Math.round(tourismRelaxedFallback.finalScore),
                  candidateTotalScore: tourismRelaxedFallback.candidate.totalScore ?? 0,
                  travelFeasible: true,
                  hardFail: false,
                  policyResults: [],
                }
              : null,
          reasons: buildStopReasons({
            candidate: tourismRelaxedFallback.candidate,
            occasion: context.filters.occasion,
            strictMatch: tourismRelaxedFallback.strictMatch,
            travelMin: tourismRelaxedFallback.travelMin,
            usedCategories: [...usedCategories],
            slotKind: slot.kind,
            phase: slot.phase,
            phaseGoal: slot.phaseGoal,
            occasionReasons: tourismRelaxedFallback.policyReasons,
          }),
        });
        continue;
      }

      if (
        eventLockedCandidate &&
        i === eventAnchor?.slotIndex &&
        !usedIds.has(eventLockedCandidate.id)
      ) {
        const forcedCandidate = resolveCandidateReferenceCoords(eventLockedCandidate, candidates);
        const anchorLat = previousStop?.lat ?? context.origin.lat;
        const anchorLng = previousStop?.lng ?? context.origin.lng;
        const travelKm =
          anchorLat != null &&
          anchorLng != null &&
          forcedCandidate.lat != null &&
          forcedCandidate.lng != null
            ? haversineKm(anchorLat, anchorLng, forcedCandidate.lat, forcedCandidate.lng)
            : null;
        const travelMin = estimateTravelMinFromKmForProfile(
          travelKm,
          context.filters.routeProfile
        );
        const durationMin = estimateDurationMin(eventLockedCandidate);

        timeUsed += (travelMin ?? 0) + durationMin;
        usedIds.add(eventLockedCandidate.id);
        usedCategories.push(classify(eventLockedCandidate));
        previousStop = forcedCandidate;

        output.push({
          index: slot.index + 1,
          label: slot.label,
          hint: slot.hint,
          item: forcedCandidate,
          durationMin,
          travelMinFromPrev: travelMin,
          groupDecision: buildGroupDecision(context, eventLockedCandidate, slot.kind),
          debug:
            context.evaluationMode === "trace"
              ? {
                  selectedFrom: "forced_event",
                  finalScore: Math.round(eventLockedCandidate.totalScore ?? 0),
                  candidateTotalScore: eventLockedCandidate.totalScore ?? 0,
                  travelFeasible: true,
                  hardFail: false,
                  policyResults: [],
                }
              : null,
          reasons: buildStopReasons({
            candidate: eventLockedCandidate,
            occasion: context.filters.occasion,
            strictMatch: true,
            travelMin,
            usedCategories: [...usedCategories],
            slotKind: slot.kind,
            phase: slot.phase,
            phaseGoal: slot.phaseGoal,
            occasionReasons: ["haelt den reservierten Event-Anchor im Zielslot fest"],
          }),
        });
        continue;
      }

      // Letzter Versuch vor dem leeren Stop: etwas auf dem Weg zum Event.
      const preShowFallback = buildPreShowFallback({
        context,
        slot,
        slotIndex: i,
        eventAnchor,
        previousStop,
        candidates,
        usedIds,
      });
      if (preShowFallback) {
        timeUsed += (preShowFallback.travelMin ?? 0) + preShowFallback.durationMin;
        usedIds.add(preShowFallback.candidate.id);
        usedCategories.push(classify(preShowFallback.candidate));
        previousStop = preShowFallback.candidate;

        output.push({
          index: slot.index + 1,
          label: slot.label,
          hint: slot.hint,
          item: preShowFallback.candidate,
          durationMin: preShowFallback.durationMin,
          travelMinFromPrev: preShowFallback.travelMin,
          groupDecision: buildGroupDecision(context, preShowFallback.candidate, slot.kind),
          debug:
            context.evaluationMode === "trace"
              ? {
                  selectedFrom: "soft",
                  finalScore: Math.round(preShowFallback.finalScore),
                  candidateTotalScore: preShowFallback.candidate.totalScore ?? 0,
                  travelFeasible: true,
                  hardFail: false,
                  policyResults: [],
                }
              : null,
          reasons: buildStopReasons({
            candidate: preShowFallback.candidate,
            occasion: context.filters.occasion,
            strictMatch: preShowFallback.strictMatch,
            travelMin: preShowFallback.travelMin,
            usedCategories: [...usedCategories],
            slotKind: slot.kind,
            phase: slot.phase,
            phaseGoal: slot.phaseGoal,
            occasionReasons: preShowFallback.policyReasons,
          }),
        });
        continue;
      }

      output.push({
        index: slot.index + 1,
        label: slot.label,
        hint: slot.hint,
        item: null,
        durationMin: null,
        travelMinFromPrev: null,
        reasons: [],
        groupDecision: null,
      });
      continue;
    }

    const usedCategoriesSnapshot = [...usedCategories];

    const scoredPool = poolWithLockedEvent
      .map((candidate) => {
        const anchorLat = previousStop?.lat ?? context.origin.lat;
        const anchorLng = previousStop?.lng ?? context.origin.lng;
        const hasPreviousStop = previousStop != null;

        const travelKm =
          anchorLat != null &&
          anchorLng != null &&
          candidate.lat != null &&
          candidate.lng != null
            ? haversineKm(anchorLat, anchorLng, candidate.lat, candidate.lng)
            : null;

        const travelMin = estimateTravelMinFromKmForProfile(
          travelKm,
          context.filters.routeProfile
        );
        const durationMin = clampDurationForSlot(
          slot,
          estimateDurationMin(candidate)
        );
        const hardDistanceLimitKm = maxSegmentDistanceKm(
          context,
          slot.kind,
          hasPreviousStop
        );
        const hardTravelLimitMin = maxSegmentTravelMin(
          context,
          slot.kind,
          hasPreviousStop
        );
        const exceedsHardDistance =
          travelKm != null && Number.isFinite(travelKm) && travelKm > hardDistanceLimitKm;
        const exceedsHardTravelTime =
          travelMin != null &&
          Number.isFinite(travelMin) &&
          travelMin > hardTravelLimitMin;
        const isLockedConcreteMarketFestivalAnchor =
          eventLockedCandidate?.id === candidate.id &&
          i === eventAnchor?.slotIndex &&
          context.experienceMode === "market_festival" &&
          isConcreteOfficialFlexEvent(candidate) &&
          previousStop == null;
        const isLockedConcreteShowAnchor =
          eventLockedCandidate?.id === candidate.id &&
          i === eventAnchor?.slotIndex &&
          (context.experienceMode === "show" ||
            context.experienceMode === "event_visit") &&
          isConcreteOfficialAnchoredEvent(candidate);
        const isLockedConcreteEventAnchor =
          isLockedConcreteMarketFestivalAnchor || isLockedConcreteShowAnchor;
        const anchorTravelOverride =
          isLockedConcreteEventAnchor &&
          travelMin != null &&
          Number.isFinite(travelMin) &&
          travelMin <= (isLockedConcreteShowAnchor ? 120 : 95);
        const travelFeasible =
          anchorTravelOverride || (!exceedsHardDistance && !exceedsHardTravelTime);

        const evaluation = evaluateCandidateWithPolicies(
          {
            context,
            candidate,
            previousStop,
            usedCategories: usedCategoriesSnapshot,
            usedIds,
            slot,
            slotIndex: i,
            planMode,
            remainingSlots,
            peakSlotIndex,
            peakCandidate: effectivePeakCandidate,
            allCandidates: candidates,
          },
          baseCandidatePolicies
        );

        const travelMeta = evaluation.results.find((result) => result.key === "travel")?.meta;
        const policyTravelMin =
          typeof travelMeta?.travelMin === "number"
            ? travelMeta.travelMin
            : travelMeta?.travelMin === null
            ? null
            : travelMin;
        const slotMeta = evaluation.results.find((result) => result.key === "slot")?.meta;
        const strictMatch =
          typeof slotMeta?.strictMatch === "boolean"
            ? slotMeta.strictMatch
            : slotCategoryMatch(slot.kind, candidate);
        const chainPenalty = sameBucketChainPenalty(usedCategoriesSnapshot, candidate);

        let afterBoost = 0;
        if (slot.kind === "anything" && planMode === "evening") {
          const category = classify(candidate);
          if (category === "nightlife") afterBoost = 18;
        }

        const targetedInterestBoost = targetedInterestBoostForSlot({
          context,
          candidate,
          slotKind: slot.kind,
        });

        const finalScore =
          candidate.totalScore +
          evaluation.scoreDelta +
          targetedInterestBoost +
          experienceSlotBoost(context, slot.kind, candidate) +
          eventAnchorFlowBoost({
            context,
            slotIndex: i,
            slotKind: slot.kind,
            candidate,
            eventAnchor,
          }) +
          afterBoost -
          partyPeakReservePenalty({
            context,
            slotPhase: slot.phase,
            candidate,
            usedIds,
            allCandidates: candidates,
          }) -
          chainPenalty;

        return {
          candidate,
          finalScore,
          travelMin: policyTravelMin,
          durationMin,
          strictMatch,
          travelFeasible:
            travelFeasible && (!evaluation.hardFail || anchorTravelOverride),
          policyResults: evaluation.results,
          policyReasons: evaluation.reasons,
          hardFail: anchorTravelOverride ? false : evaluation.hardFail,
        };
      })
      .sort((a, b) => b.finalScore - a.finalScore);

    const lockedConcreteMarketFestivalEvent =
      eventLockedCandidate &&
      i === eventAnchor?.slotIndex &&
      context.experienceMode === "market_festival" &&
      isConcreteOfficialFlexEvent(eventLockedCandidate)
        ? scoredPool.find((item) => item.candidate.id === eventLockedCandidate.id) ?? null
        : null;
    const lockedConcreteShowEvent =
      eventLockedCandidate &&
      i === eventAnchor?.slotIndex &&
      (context.experienceMode === "show" || context.experienceMode === "event_visit") &&
      isConcreteOfficialAnchoredEvent(eventLockedCandidate)
        ? scoredPool.find((item) => item.candidate.id === eventLockedCandidate.id) ?? null
        : null;

    const rotatedPool =
      scoredPool.length > 0
        ? Array.from(
            { length: scoredPool.length },
            (_, idx) => scoredPool[(idx + offset) % scoredPool.length]
          )
        : [];

    const feasible = rotatedPool.filter((item) => {
      if (item.hardFail) return false;
      if (!item.travelFeasible) return false;
      const additional = (item.travelMin ?? 0) + item.durationMin;
      return timeUsed + additional <= budgetMin + buffer;
    });

    const relaxedFeasible = rotatedPool.filter((item) => {
      if (item.hardFail) return false;
      const overrunAllowance =
        context.experienceMode === "market_festival" && planMode === "midday"
          ? 35
          : planMode === "fullday"
            ? 30
            : 15;
      const additional = (item.travelMin ?? 0) + item.durationMin;
      if (timeUsed + additional > budgetMin + buffer + overrunAllowance) {
        return false;
      }

      if ((item.travelMin ?? 0) <= 0) return true;

      if (context.filters.routeProfile === "foot") {
        return (item.travelMin ?? 0) <= 50;
      }

      if (context.filters.routeProfile === "public_transit") {
        return (item.travelMin ?? 0) <= 70;
      }

      return (item.travelMin ?? 0) <= 65;
    });

    const softFeasible = rotatedPool.filter((item) => {
      if (item.hardFail) return false;
      const overrunAllowance =
        context.experienceMode === "market_festival" && planMode === "midday"
          ? 55
          : planMode === "fullday"
            ? 60
            : 30;
      const additional = (item.travelMin ?? 0) + item.durationMin;
      if (timeUsed + additional > budgetMin + buffer + overrunAllowance) {
        return false;
      }

      if (context.filters.routeProfile === "foot") {
        return !item.travelFeasible ? (item.travelMin ?? 0) <= 60 : true;
      }

      if (context.filters.routeProfile === "public_transit") {
        return !item.travelFeasible ? (item.travelMin ?? 0) <= 80 : true;
      }

      return !item.travelFeasible ? (item.travelMin ?? 0) <= 80 : true;
    });

    let chosenSource:
      | "feasible"
      | "relaxed"
      | "soft"
      | "forced_peak"
      | "forced_event"
      | "family_meal_fallback"
      | null = null;
    let chosen =
      lockedConcreteMarketFestivalEvent ??
      lockedConcreteShowEvent ??
      chooseCandidateWithVariation(feasible, variationSeed, i, 10) ??
      null;

    if (lockedConcreteMarketFestivalEvent || lockedConcreteShowEvent) {
      chosenSource = "forced_event";
    } else if (chosen) {
      chosenSource = "feasible";
    } else {
      chosen = chooseCandidateWithVariation(relaxedFeasible, variationSeed, i, 14) ?? null;
      if (chosen) {
        chosenSource = "relaxed";
      } else {
        chosen = chooseCandidateWithVariation(softFeasible, variationSeed, i, 18) ?? null;
        if (chosen) {
          chosenSource = "soft";
        }
      }
    }

    if (eventLockedCandidate && !usedIds.has(eventLockedCandidate.id)) {
      const forced =
        feasible.find((item) => item.candidate.id === eventLockedCandidate.id) ??
        relaxedFeasible.find((item) => item.candidate.id === eventLockedCandidate.id) ??
        softFeasible.find((item) => item.candidate.id === eventLockedCandidate.id) ??
        null;
      if (forced) {
        chosen = forced;
        chosenSource = "forced_event";
      }
    }

    const eventSlotLocked = Boolean(
      eventLockedCandidate && i === eventAnchor?.slotIndex
    );

    if (
      (!chosen || chosenSource !== "forced_event") &&
      !eventSlotLocked &&
      peakLockedCandidate &&
      !usedIds.has(peakLockedCandidate.id)
    ) {
      const forced =
        feasible.find((item) => item.candidate.id === peakLockedCandidate.id) ??
        relaxedFeasible.find((item) => item.candidate.id === peakLockedCandidate.id) ??
        null;
      if (forced) {
        chosen = forced;
        chosenSource = "forced_peak";
      }
    }

    if (!chosen) {
      const familyMealFallback = buildFamilyMealFallback({
        context,
        slot,
        previousStop,
        peakCandidate: effectivePeakCandidate,
        candidates,
        usedIds,
      });
      if (familyMealFallback) {
        timeUsed += (familyMealFallback.travelMin ?? 0) + familyMealFallback.durationMin;
        usedIds.add(familyMealFallback.candidate.id);
        usedCategories.push(classify(familyMealFallback.candidate));
        previousStop = familyMealFallback.candidate;

        output.push({
          index: slot.index + 1,
          label: slot.label,
          hint: slot.hint,
          item: familyMealFallback.candidate,
          durationMin: familyMealFallback.durationMin,
          travelMinFromPrev: familyMealFallback.travelMin,
          groupDecision: buildGroupDecision(
            context,
            familyMealFallback.candidate,
            slot.kind
          ),
          debug:
            context.evaluationMode === "trace"
              ? {
                  selectedFrom: "family_meal_fallback",
                  finalScore: Math.round(familyMealFallback.finalScore),
                  candidateTotalScore: familyMealFallback.candidate.totalScore ?? 0,
                  travelFeasible: true,
                  hardFail: false,
                  policyResults: [],
                }
              : null,
          reasons: buildStopReasons({
            candidate: familyMealFallback.candidate,
            occasion: context.filters.occasion,
            strictMatch: familyMealFallback.strictMatch,
            travelMin: familyMealFallback.travelMin,
            usedCategories: usedCategoriesSnapshot,
            slotKind: slot.kind,
            phase: slot.phase,
            phaseGoal: slot.phaseGoal,
            occasionReasons: familyMealFallback.policyReasons,
          }),
        });
        continue;
      }

      const postShowFallback = buildPostShowFallback({
        context,
        slot,
        slotIndex: i,
        eventAnchor,
        previousStop,
        candidates,
        usedIds,
      });
      if (postShowFallback) {
        timeUsed += (postShowFallback.travelMin ?? 0) + postShowFallback.durationMin;
        usedIds.add(postShowFallback.candidate.id);
        usedCategories.push(classify(postShowFallback.candidate));
        previousStop = postShowFallback.candidate;

        output.push({
          index: slot.index + 1,
          label: slot.label,
          hint: slot.hint,
          item: postShowFallback.candidate,
          durationMin: postShowFallback.durationMin,
          travelMinFromPrev: postShowFallback.travelMin,
          groupDecision: buildGroupDecision(context, postShowFallback.candidate, slot.kind),
          debug:
            context.evaluationMode === "trace"
              ? {
                  selectedFrom: "soft",
                  finalScore: Math.round(postShowFallback.finalScore),
                  candidateTotalScore: postShowFallback.candidate.totalScore ?? 0,
                  travelFeasible: true,
                  hardFail: false,
                  policyResults: [],
                }
              : null,
          reasons: buildStopReasons({
            candidate: postShowFallback.candidate,
            occasion: context.filters.occasion,
            strictMatch: postShowFallback.strictMatch,
            travelMin: postShowFallback.travelMin,
            usedCategories: usedCategoriesSnapshot,
            slotKind: slot.kind,
            phase: slot.phase,
            phaseGoal: slot.phaseGoal,
            occasionReasons: postShowFallback.policyReasons,
          }),
        });
        continue;
      }

      const tourismRelaxedFallback = buildTourismRelaxedFallback({
        context,
        slot,
        previousStop,
        candidates,
        usedIds,
      });
      if (tourismRelaxedFallback) {
        timeUsed +=
          (tourismRelaxedFallback.travelMin ?? 0) + tourismRelaxedFallback.durationMin;
        usedIds.add(tourismRelaxedFallback.candidate.id);
        usedCategories.push(classify(tourismRelaxedFallback.candidate));
        previousStop = tourismRelaxedFallback.candidate;

        output.push({
          index: slot.index + 1,
          label: slot.label,
          hint: slot.hint,
          item: tourismRelaxedFallback.candidate,
          durationMin: tourismRelaxedFallback.durationMin,
          travelMinFromPrev: tourismRelaxedFallback.travelMin,
          groupDecision: buildGroupDecision(
            context,
            tourismRelaxedFallback.candidate,
            slot.kind
          ),
          debug:
            context.evaluationMode === "trace"
              ? {
                  selectedFrom: "soft",
                  finalScore: Math.round(tourismRelaxedFallback.finalScore),
                  candidateTotalScore: tourismRelaxedFallback.candidate.totalScore ?? 0,
                  travelFeasible: true,
                  hardFail: false,
                  policyResults: [],
                }
              : null,
          reasons: buildStopReasons({
            candidate: tourismRelaxedFallback.candidate,
            occasion: context.filters.occasion,
            strictMatch: tourismRelaxedFallback.strictMatch,
            travelMin: tourismRelaxedFallback.travelMin,
            usedCategories: usedCategoriesSnapshot,
            slotKind: slot.kind,
            phase: slot.phase,
            phaseGoal: slot.phaseGoal,
            occasionReasons: tourismRelaxedFallback.policyReasons,
          }),
        });
        continue;
      }

      const carriedAfter = buildCarryForwardPartyAfter(previousStop, slot);
      if (carriedAfter) {
        timeUsed += carriedAfter.durationMin;
        previousStop = carriedAfter.candidate;

        output.push({
          index: slot.index + 1,
          label: slot.label,
          hint: slot.hint,
          item: carriedAfter.candidate,
          durationMin: carriedAfter.durationMin,
          travelMinFromPrev: 0,
          groupDecision: buildGroupDecision(context, carriedAfter.candidate, slot.kind),
          debug:
            context.evaluationMode === "trace"
              ? {
                  selectedFrom: "soft",
                  finalScore: Math.round(carriedAfter.finalScore),
                  candidateTotalScore: carriedAfter.candidate.totalScore ?? 0,
                  travelFeasible: true,
                  hardFail: false,
                  policyResults: [],
                }
              : null,
          reasons: buildStopReasons({
            candidate: carriedAfter.candidate,
            occasion: context.filters.occasion,
            strictMatch: carriedAfter.strictMatch,
            travelMin: 0,
            usedCategories: usedCategoriesSnapshot,
            slotKind: slot.kind,
            phase: slot.phase,
            phaseGoal: slot.phaseGoal,
            occasionReasons: carriedAfter.policyReasons,
          }),
        });
        continue;
      }

      // Letzter Versuch vor dem leeren Stop: etwas auf dem Weg zum Event.
      const preShowFallback = buildPreShowFallback({
        context,
        slot,
        slotIndex: i,
        eventAnchor,
        previousStop,
        candidates,
        usedIds,
      });
      if (preShowFallback) {
        timeUsed += (preShowFallback.travelMin ?? 0) + preShowFallback.durationMin;
        usedIds.add(preShowFallback.candidate.id);
        usedCategories.push(classify(preShowFallback.candidate));
        previousStop = preShowFallback.candidate;

        output.push({
          index: slot.index + 1,
          label: slot.label,
          hint: slot.hint,
          item: preShowFallback.candidate,
          durationMin: preShowFallback.durationMin,
          travelMinFromPrev: preShowFallback.travelMin,
          groupDecision: buildGroupDecision(context, preShowFallback.candidate, slot.kind),
          debug:
            context.evaluationMode === "trace"
              ? {
                  selectedFrom: "soft",
                  finalScore: Math.round(preShowFallback.finalScore),
                  candidateTotalScore: preShowFallback.candidate.totalScore ?? 0,
                  travelFeasible: true,
                  hardFail: false,
                  policyResults: [],
                }
              : null,
          reasons: buildStopReasons({
            candidate: preShowFallback.candidate,
            occasion: context.filters.occasion,
            strictMatch: preShowFallback.strictMatch,
            travelMin: preShowFallback.travelMin,
            usedCategories: usedCategoriesSnapshot,
            slotKind: slot.kind,
            phase: slot.phase,
            phaseGoal: slot.phaseGoal,
            occasionReasons: preShowFallback.policyReasons,
          }),
        });
        continue;
      }

      output.push({
        index: slot.index + 1,
        label: slot.label,
        hint: slot.hint,
        item: null,
        durationMin: null,
        travelMinFromPrev: null,
        reasons: [],
        groupDecision: null,
      });
      continue;
    }

    timeUsed += (chosen.travelMin ?? 0) + chosen.durationMin;
    usedIds.add(chosen.candidate.id);
    usedCategories.push(classify(chosen.candidate));
    previousStop = resolveCandidateReferenceCoords(chosen.candidate, candidates);

    output.push({
      index: slot.index + 1,
      label: slot.label,
      hint: slot.hint,
      item: previousStop,
      durationMin: chosen.durationMin,
      travelMinFromPrev: chosen.travelMin,
      groupDecision: buildGroupDecision(context, chosen.candidate, slot.kind),
      debug:
        context.evaluationMode === "trace" && chosenSource
          ? {
              selectedFrom: chosenSource,
              finalScore: Math.round(chosen.finalScore),
              candidateTotalScore: chosen.candidate.totalScore ?? 0,
              travelFeasible: chosen.travelFeasible,
              hardFail: chosen.hardFail,
              policyResults: chosen.policyResults.map((result) => ({
                key: result.key,
                scoreDelta: result.scoreDelta,
                hardFail: result.hardFail,
                reasons: result.reasons,
                meta: result.meta,
              })),
            }
          : null,
      reasons: buildStopReasons({
        candidate: chosen.candidate,
        occasion: context.filters.occasion,
        strictMatch: chosen.strictMatch,
        travelMin: chosen.travelMin,
        usedCategories: usedCategoriesSnapshot,
        slotKind: slot.kind,
        phase: slot.phase,
        phaseGoal: slot.phaseGoal,
        occasionReasons: chosen.policyReasons,
      }).concat(
        chosenSource === "forced_event"
          ? ["als Event-Highlight bewusst im Ablauf verankert"]
          : []
      ),
    });
  }

  return applyStopSchedule({
    stops: output,
    context,
    eventAnchorId: eventAnchor?.candidate.id ?? null,
  });
}
