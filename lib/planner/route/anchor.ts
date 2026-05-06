import { buildLocationSearchText, bucketForCategory, classify, getSubtypes, hasSubtype } from "../features";
import { slotInterestBoost } from "../interest";
import {
  buildMarketFestivalIntentText,
  isEligibleMarketFestival,
  marketFestivalSpecificityScore as marketFestivalScoreFromText,
} from "../market-festival";
import { getOccasionModule } from "../occasions/registry";
import { estimateTravelMinFromKmForProfile, haversineKm } from "../travel";
import type {
  LocationCategory,
  OccasionPhase,
  PlanMode,
  PlanningContext,
  ScoredLocation,
  SlotDefinition,
  SlotKind,
} from "../types";
import { isMealKind, maxSegmentDistanceKm } from "./timing";

export type PeakAnchor = {
  slotIndex: number;
  candidate: ScoredLocation;
};

export type EventAnchor = {
  slotIndex: number;
  candidate: ScoredLocation;
};

export function occasionAnchorBonus(occasion: string, cand: ScoredLocation) {
  const category = classify(cand);

  if (occasion === "date") {
    if (category === "cafe") return 10;
    if (category === "culture") return 16;
    if (category === "nightlife") return 12;
    if (category === "activity") return 6;
    return 0;
  }

  if (occasion === "friends") {
    if (category === "activity") return 14;
    if (category === "nightlife") return 12;
    if (category === "restaurant") return 8;
    return 0;
  }

  if (occasion === "family") {
    if (category === "activity") return 12;
    if (category === "culture") return 10;
    if (category === "cafe") return 8;
    return 0;
  }

  if (occasion === "party") {
    if (category === "nightlife") return 20;
    if (category === "restaurant") return 8;
    return 0;
  }

  if (occasion === "tourism") {
    if (category === "culture") return 18;
    if (category === "activity") return 12;
    if (category === "cafe") return 6;
    return 0;
  }

  return 0;
}

export function sameBucketChainPenalty(
  usedCategories: LocationCategory[],
  candidate: ScoredLocation
) {
  if (usedCategories.length < 2) return 0;

  const candidateBucket = bucketForCategory(classify(candidate));
  const lastBucket = bucketForCategory(usedCategories[usedCategories.length - 1]);
  const previousBucket = bucketForCategory(usedCategories[usedCategories.length - 2]);

  if (candidateBucket === lastBucket && candidateBucket === previousBucket) {
    return 18;
  }

  return 0;
}

export function isPeakPhase(
  phase: OccasionPhase | null | undefined,
  occasion: PlanningContext["filters"]["occasion"]
) {
  if (!phase) return false;
  if (phase === "highlight") return true;
  if (occasion === "family" && phase === "main_activity") return true;
  if (occasion === "friends" && phase === "social_peak") return true;
  if (occasion === "tourism" && (phase === "tour_highlight" || phase === "tour_start")) return true;
  if (occasion === "party" && phase === "party_peak") return true;
  return false;
}

export function preferredPeakSlotIndex(context: PlanningContext) {
  const explicitPeak = context.slotTemplate.findIndex((slot) =>
    isPeakPhase(slot.phase, context.filters.occasion)
  );
  if (explicitPeak >= 0) return explicitPeak;

  const activityPeak = context.slotTemplate.findIndex(
    (slot) => slot.kind === "activity" || slot.kind === "sightseeing"
  );
  if (activityPeak >= 0) return activityPeak;

  return Math.max(0, Math.floor(context.slotTemplate.length / 2));
}

export function preferredEventSlotIndex(context: PlanningContext) {
  const preferredKinds =
    context.experienceMode === "show"
      ? (["activity", "tour", "nightlife", "sightseeing"] as const)
      : context.experienceMode === "market_festival"
        ? (["activity", "sightseeing", "walk", "tour"] as const)
        : (["activity", "sightseeing", "tour", "walk", "nightlife"] as const);

  for (const kind of preferredKinds) {
    const index = context.slotTemplate.findIndex((slot) => slot.kind === kind);
    if (index >= 0) return index;
  }

  return preferredPeakSlotIndex(context);
}

function isMatchingEventAnchorCandidate(context: PlanningContext, candidate: ScoredLocation) {
  if (classify(candidate) !== "event") return false;

  if (context.explicitEventId && candidate.id === context.explicitEventId) {
    return true;
  }

  if (hasSubtype(candidate, "editorial_summary_page")) {
    return false;
  }

  if (context.experienceMode === "show") {
    return isStageEventCandidate(candidate);
  }

  if (context.experienceMode === "market_festival") {
    const refs = eventSourceRefs(candidate);
    return isEligibleMarketFestival({
      text: buildMarketFestivalIntentText(candidate),
      subtypes: getSubtypes(candidate),
      category: typeof refs?.eventCategory === "string" ? refs.eventCategory : null,
    });
  }

  return true;
}

function eventSourceRefs(candidate: ScoredLocation) {
  return candidate.source_refs && typeof candidate.source_refs === "object"
    ? (candidate.source_refs as Record<string, unknown>)
    : null;
}

function hasEventCategory(candidate: ScoredLocation, ...values: string[]) {
  const refs = eventSourceRefs(candidate);
  const category = typeof refs?.eventCategory === "string" ? refs.eventCategory.toLowerCase() : "";
  return values.some((value) => category === value);
}

function hasStageEventIntent(candidate: ScoredLocation) {
  const text = buildLocationSearchText(candidate).toLowerCase();
  return /\b(?:konzert|concert|musik|band|orchester|chor|jazz|live|theater|oper|schauspiel|ballett|kabarett|comedy|show|lesung|slam|kino|film|screening|performance)\b/.test(
    text
  );
}

function hasExplicitMarketAnchorIntent(candidate: ScoredLocation) {
  const text = buildMarketFestivalIntentText(candidate).toLowerCase();
  return /\b(?:wochenmarkt|flohmarkt|bauernmarkt|kunstmarkt|designmarkt|weihnachtsmarkt|adventsmarkt|street food|food market|night market|volksfest|stadtfest|weinfest|kirmes|funfair|fairground|bazaar|expo|messe|trade fair)\b/.test(
    text
  );
}

function isStageEventCandidate(candidate: ScoredLocation) {
  return (
    hasSubtype(
      candidate,
      "concert",
      "theater",
      "show",
      "performing_arts",
      "live_music",
      "screening",
      "stage_program"
    ) || hasStageEventIntent(candidate)
  );
}

function isSoftCommunityEvent(candidate: ScoredLocation) {
  if (
    hasSubtype(
      candidate,
      "guided_tour",
      "lecture",
      "workshop",
      "civic_session",
      "committee_meeting"
    )
  ) {
    return true;
  }

  const text = buildLocationSearchText(candidate).toLowerCase();
  return /\b(?:sitzung|jugendparlament|ortsbeirat|ausschuss|stadtrat|parlament|ratssitzung|workshop|kurs|zeichnen|skizzieren|fuehrung|führung|rundgang|tour)\b/.test(
    text
  );
}

function isEventVisitPriorityCandidate(candidate: ScoredLocation) {
  if (isStageEventCandidate(candidate)) return true;
  if (isSoftCommunityEvent(candidate)) return false;

  return (
    hasSubtype(candidate, "festival", "festival_event", "market", "market_event", "food_event", "fairground") ||
    hasEventCategory(candidate, "festival", "market", "food_event", "fair")
  );
}

function isMarketFestivalPriorityCandidate(candidate: ScoredLocation) {
  const marketLike =
    hasSubtype(candidate, "market", "weekly_market", "market_event", "food_event", "fairground") ||
    hasEventCategory(candidate, "market", "food_event");
  const festivalLike =
    hasSubtype(candidate, "festival", "festival_event", "seasonal_event") ||
    hasEventCategory(candidate, "festival", "fair");
  const stageLike = hasSubtype(
    candidate,
    "concert",
    "theater",
    "show",
    "performing_arts",
    "live_music",
    "screening",
    "stage_program"
  );

  if (isSoftCommunityEvent(candidate)) return false;
  if (stageLike && !hasExplicitMarketAnchorIntent(candidate)) return false;

  return marketLike || festivalLike || marketFestivalSpecificityScore(candidate) >= 120;
}

function marketFestivalSpecificityScore(candidate: ScoredLocation) {
  const refs = eventSourceRefs(candidate);
  return marketFestivalScoreFromText({
    text: buildMarketFestivalIntentText(candidate),
    subtypes: getSubtypes(candidate),
    category: typeof refs?.eventCategory === "string" ? refs.eventCategory : null,
  });
}

function eventLocalHour(candidate: ScoredLocation) {
  const refs =
    candidate.source_refs && typeof candidate.source_refs === "object"
      ? (candidate.source_refs as Record<string, unknown>)
      : null;
  const startsAt =
    typeof refs?.startsAt === "string" && refs.startsAt.trim().length > 0
      ? refs.startsAt
      : null;
  if (!startsAt) return null;

  try {
    const formatted = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Berlin",
      hour: "2-digit",
      hour12: false,
    }).format(new Date(startsAt));
    const hour = Number(formatted);
    return Number.isFinite(hour) ? hour : null;
  } catch {
    const hour = Number(startsAt.slice(11, 13));
    return Number.isFinite(hour) ? hour : null;
  }
}

function matchesPreferredEventWindow(context: PlanningContext, candidate: ScoredLocation) {
  if (context.experienceMode === "classic") return true;

  const hour = eventLocalHour(candidate);
  const daytime = candidate.daytime ?? null;
  const isStageEvent = hasSubtype(
    candidate,
    "concert",
    "theater",
    "show",
    "performing_arts",
    "live_music"
  );
  const isFlexEvent = hasSubtype(
    candidate,
    "market",
    "festival",
    "food_event",
    "seasonal_event",
    "fairground"
  );

  if (context.preferredDaytimes.includes("evening")) {
    if (typeof hour === "number") {
      if (context.experienceMode === "show") {
        return hour >= 16 && hour < 23;
      }
      if (context.experienceMode === "event_visit" && isStageEvent) {
        return hour >= 14 && hour < 23;
      }
      if (context.experienceMode === "event_visit" && isFlexEvent) {
        return hour >= 15 && hour < 23;
      }
      return hour >= 14 && hour < 23;
    }
    return daytime === "evening" || daytime === "night";
  }

  if (context.preferredDaytimes.includes("midday")) {
    if (typeof hour === "number") return hour >= 11 && hour < 17;
    return daytime === "midday";
  }

  if (context.preferredDaytimes.includes("morning")) {
    if (typeof hour === "number") return hour >= 8 && hour < 12;
    return daytime === "morning";
  }

  return true;
}

export function chooseEventAnchor(params: {
  context: PlanningContext;
  candidates: ScoredLocation[];
  variationSeed: number;
}) {
  const { context, candidates, variationSeed } = params;
  if (context.experienceMode === "classic" || context.eventPlanningMode === "disabled") return null;

  const slotIndex = preferredEventSlotIndex(context);
  const matchingCandidates = candidates.filter((candidate) =>
    isMatchingEventAnchorCandidate(context, candidate)
  );
  const preferredWindowCandidates = matchingCandidates.filter((candidate) =>
    matchesPreferredEventWindow(context, candidate)
  );

  let anchorPool = matchingCandidates;

  if (context.experienceMode === "show") {
    anchorPool = preferredWindowCandidates.length > 0 ? preferredWindowCandidates : matchingCandidates;
  } else if (context.experienceMode === "event_visit") {
    const priorityCandidates = matchingCandidates.filter((candidate) =>
      isEventVisitPriorityCandidate(candidate)
    );
    const priorityWindowCandidates = preferredWindowCandidates.filter((candidate) =>
      isEventVisitPriorityCandidate(candidate)
    );
    const stageCandidates = priorityCandidates.filter((candidate) => isStageEventCandidate(candidate));
    const stageWindowCandidates = priorityWindowCandidates.filter((candidate) =>
      isStageEventCandidate(candidate)
    );
    anchorPool =
      stageWindowCandidates.length > 0
        ? stageWindowCandidates
        : stageCandidates.length > 0
          ? stageCandidates
          : priorityWindowCandidates.length > 0
        ? priorityWindowCandidates
        : priorityCandidates.length > 0
          ? priorityCandidates
          : preferredWindowCandidates.length > 0
            ? preferredWindowCandidates
            : matchingCandidates;
  } else if (context.experienceMode === "market_festival") {
    const priorityCandidates = matchingCandidates.filter((candidate) =>
      isMarketFestivalPriorityCandidate(candidate)
    );
    const priorityWindowCandidates = preferredWindowCandidates.filter((candidate) =>
      isMarketFestivalPriorityCandidate(candidate)
    );
    anchorPool =
      priorityWindowCandidates.length > 0
        ? priorityWindowCandidates
        : priorityCandidates.length > 0
          ? priorityCandidates
          : preferredWindowCandidates.length > 0
            ? preferredWindowCandidates
            : matchingCandidates;
  }

  const hasStagePriorityCandidate =
    context.experienceMode === "event_visit" && anchorPool.some((candidate) => isStageEventCandidate(candidate));

  const filtered = anchorPool
    .sort((a, b) => {
      const eventTimeWindowBoost = (candidate: ScoredLocation) => {
        if (context.experienceMode !== "show" && context.experienceMode !== "event_visit") return 0;
        const refs =
          candidate.source_refs && typeof candidate.source_refs === "object"
            ? (candidate.source_refs as Record<string, unknown>)
            : null;
        const startsAt =
          typeof refs?.startsAt === "string" && refs.startsAt.trim().length > 0
            ? refs.startsAt
            : null;
        if (!startsAt) return 0;

        let hour = Number.NaN;
        try {
          const formatted = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/Berlin",
            hour: "2-digit",
            hour12: false,
          }).format(new Date(startsAt));
          hour = Number(formatted);
        } catch {
          hour = Number(startsAt.slice(11, 13));
        }

        if (!Number.isFinite(hour)) return 0;

        const isStageEvent = hasSubtype(
          candidate,
          "concert",
          "theater",
          "show",
          "performing_arts",
          "live_music"
        );
        const isFlexEvent = hasSubtype(
          candidate,
          "market",
          "festival",
          "food_event",
          "seasonal_event",
          "fairground"
        );

        if (context.preferredDaytimes.includes("evening")) {
          if (context.experienceMode === "show") {
            if (hour >= 17 && hour < 23) return 240;
            if (hour >= 14 && hour < 17) return 90;
            if (hour >= 11 && hour < 14) return -80;
            return -240;
          }

          if (isStageEvent) {
            if (hour >= 17 && hour < 23) return 210;
            if (hour >= 14 && hour < 17) return 70;
            if (hour >= 11 && hour < 14) return -70;
            return -200;
          }

          if (isFlexEvent) {
            if (hour >= 16 && hour < 23) return 80;
            if (hour >= 12 && hour < 16) return 20;
            return -150;
          }

          if (hour >= 16 && hour < 23) return 120;
          if (hour >= 12 && hour < 16) return 20;
          return -110;
        }

        if (context.preferredDaytimes.includes("midday")) {
          if (hour >= 11 && hour < 17) return 120;
          if (hour >= 9 && hour < 11) return 40;
          if (hour >= 17 && hour < 22) return -70;
          return -120;
        }

        if (context.preferredDaytimes.includes("morning")) {
          if (hour >= 8 && hour < 12) return 120;
          if (hour >= 12 && hour < 15) return 35;
          if (hour >= 17 && hour < 22) return -90;
          return -120;
        }

        return 0;
      };

      const preferredDaytimeBoost = (candidate: ScoredLocation) => {
        const rawDaytime = candidate.daytime ?? null;
        const daytime =
          rawDaytime === "morning" ||
          rawDaytime === "midday" ||
          rawDaytime === "evening" ||
          rawDaytime === "night"
            ? rawDaytime
            : null;
        if (!daytime) return 0;
        if (context.preferredDaytimes.includes(daytime)) {
          return context.experienceMode === "show" ? 80 : context.experienceMode === "event_visit" ? 54 : 36;
        }
        if (context.experienceMode === "show" || context.experienceMode === "event_visit") {
          if (daytime === "midday" && context.preferredDaytimes.includes("evening")) return -50;
          if (daytime === "morning" && context.preferredDaytimes.includes("evening")) return -90;
        }
        return -18;
      };

      const explicitA = context.explicitEventId && a.id === context.explicitEventId ? 1 : 0;
      const explicitB = context.explicitEventId && b.id === context.explicitEventId ? 1 : 0;
      if (explicitB !== explicitA) return explicitB - explicitA;

      const semanticEventBoost = (candidate: ScoredLocation) => {
        if (context.experienceMode === "event_visit") {
          if (isStageEventCandidate(candidate)) return 70;
          if (hasSubtype(candidate, "festival", "festival_event", "market", "market_event", "food_event")) {
            return 28;
          }
          if (hasSubtype(candidate, "exhibition") || hasEventCategory(candidate, "fair")) {
            return hasStagePriorityCandidate ? -90 : 12;
          }
          if (isSoftCommunityEvent(candidate)) return -140;
          return 0;
        }

        if (context.experienceMode === "market_festival") {
          let score = 0;
          const explicitMarketLike =
            hasSubtype(candidate, "market", "weekly_market", "market_event") ||
            hasEventCategory(candidate, "market");
          const marketAdjacencyLike = hasSubtype(candidate, "food_event", "fairground");
          const explicitFestivalLike =
            hasSubtype(candidate, "festival", "festival_event", "seasonal_event") ||
            hasEventCategory(candidate, "festival", "fair");

          if (isMarketFestivalPriorityCandidate(candidate)) score += 42;
          if (explicitMarketLike) {
            score += hasExplicitMarketAnchorIntent(candidate) ? 120 : 84;
          } else if (marketAdjacencyLike) {
            score += hasExplicitMarketAnchorIntent(candidate) ? 46 : 24;
          } else if (explicitFestivalLike && hasExplicitMarketAnchorIntent(candidate)) {
            score += 24;
          }
          if (hasSubtype(candidate, "weekly_market")) score += 60;
          if (hasSubtype(candidate, "guided_tour", "lecture", "workshop")) score -= 220;
          if (
            hasSubtype(candidate, "concert", "theater", "show", "performing_arts", "live_music", "screening", "stage_program") &&
            !hasSubtype(candidate, "market", "weekly_market", "market_event", "food_event", "fairground")
          ) {
            score -= 180;
          }
          if (
            hasSubtype(candidate, "exhibition") &&
            !hasSubtype(candidate, "market_event", "weekly_market", "fairground")
          ) {
            score -= 90;
          }
          return score;
        }

        return 0;
      };

      const scoreA =
        (a.totalScore ?? 0) +
        occasionAnchorBonus(context.filters.occasion, a) +
        eventTimeWindowBoost(a) +
        preferredDaytimeBoost(a) +
        semanticEventBoost(a) +
        (context.experienceMode === "market_festival" ? marketFestivalSpecificityScore(a) : 0);
      const scoreB =
        (b.totalScore ?? 0) +
        occasionAnchorBonus(context.filters.occasion, b) +
        eventTimeWindowBoost(b) +
        preferredDaytimeBoost(b) +
        semanticEventBoost(b) +
        (context.experienceMode === "market_festival" ? marketFestivalSpecificityScore(b) : 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      const da = a.distanceFromOriginKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanceFromOriginKm ?? Number.POSITIVE_INFINITY;
      return da - db;
    });

  if (filtered.length === 0) {
    if (context.experienceMode !== "market_festival") return null;

    const fallback = candidates
      .filter(
        (candidate) =>
          classify(candidate) === "event" &&
          !hasSubtype(candidate, "editorial_summary_page") &&
          isEligibleMarketFestival({
            text: buildMarketFestivalIntentText(candidate),
            subtypes: getSubtypes(candidate),
            category:
              candidate.source_refs && typeof candidate.source_refs === "object"
                ? typeof (candidate.source_refs as Record<string, unknown>).eventCategory === "string"
                  ? ((candidate.source_refs as Record<string, unknown>).eventCategory as string)
                  : null
                : null,
          })
      )
      .sort((a, b) => {
        const refsA =
          a.source_refs && typeof a.source_refs === "object"
            ? (a.source_refs as Record<string, unknown>)
            : null;
        const refsB =
          b.source_refs && typeof b.source_refs === "object"
            ? (b.source_refs as Record<string, unknown>)
            : null;

        const sourceScore = (refs: Record<string, unknown> | null) => {
          let score = 0;
          if (typeof refs?.source === "string") score += 12;
          if (refs?.eventKind === "flex_event") score += 18;
          if (refs?.isConcreteEventPage === true) score += 28;
          if (refs?.isEditorialSummary === true) score -= 120;
          if (typeof refs?.venueName === "string" && refs.venueName.trim().length > 0) score += 8;
          if (typeof refs?.startsAt === "string" && refs.startsAt.trim().length > 0) score += 6;
          return score;
        };

        const scoreA = (a.totalScore ?? 0) + sourceScore(refsA);
        const scoreB = (b.totalScore ?? 0) + sourceScore(refsB);
        const adjustedA = scoreA + marketFestivalSpecificityScore(a);
        const adjustedB = scoreB + marketFestivalSpecificityScore(b);
        if (adjustedB !== adjustedA) return adjustedB - adjustedA;

        const da = a.distanceFromOriginKm ?? Number.POSITIVE_INFINITY;
        const db = b.distanceFromOriginKm ?? Number.POSITIVE_INFINITY;
        return da - db;
      });

    const fallbackCandidate = chooseCandidateWithVariation(fallback, variationSeed, slotIndex, 4);
    if (!fallbackCandidate) return null;

    return {
      slotIndex,
      candidate: fallbackCandidate,
    } satisfies EventAnchor;
  }

  const candidate = chooseCandidateWithVariation(
    filtered,
    variationSeed,
    slotIndex,
    context.experienceMode === "show" ? 2 : context.experienceMode === "event_visit" ? 1 : 3
  );
  if (!candidate) return null;

  return {
    slotIndex,
    candidate,
  } satisfies EventAnchor;
}

export function peakClusterLimitKm(
  context: PlanningContext,
  slotKind: SlotKind,
  slotIndex: number,
  peakSlotIndex: number
) {
  const routeProfile = context.filters.routeProfile;
  const distanceFromPeakSlots = Math.abs(slotIndex - peakSlotIndex);
  const meal = isMealKind(slotKind);

  if (routeProfile === "foot") {
    const base = meal ? 1.2 : 1.8;
    const stretch = distanceFromPeakSlots >= 2 ? 0.6 : distanceFromPeakSlots === 1 ? 0.25 : 0;
    return Math.min(2.6, base + stretch);
  }

  if (routeProfile === "public_transit") {
    const base = meal ? 2.4 : 3.4;
    const stretch = distanceFromPeakSlots >= 2 ? 1.2 : distanceFromPeakSlots === 1 ? 0.7 : 0;
    return Math.min(5.8, base + stretch);
  }

  const base = meal ? 3.0 : 4.5;
  const stretch = distanceFromPeakSlots >= 2 ? 2.0 : distanceFromPeakSlots === 1 ? 1.0 : 0;
  return Math.min(8, base + stretch);
}

export function peakClusterPenalty(params: {
  context: PlanningContext;
  slotKind: SlotKind;
  slotIndex: number;
  peakSlotIndex: number;
  peakCandidate: ScoredLocation | null;
  candidate: ScoredLocation;
}) {
  const { context, slotKind, slotIndex, peakSlotIndex, peakCandidate, candidate } = params;

  if (!peakCandidate || peakCandidate.id === candidate.id) {
    return { penalty: 0, hardFail: false, distanceKm: null as number | null };
  }

  if (
    peakCandidate.lat == null ||
    peakCandidate.lng == null ||
    candidate.lat == null ||
    candidate.lng == null
  ) {
    return { penalty: 0, hardFail: false, distanceKm: null as number | null };
  }

  const distanceKm = haversineKm(
    peakCandidate.lat,
    peakCandidate.lng,
    candidate.lat,
    candidate.lng
  );

  const limitKm = peakClusterLimitKm(context, slotKind, slotIndex, peakSlotIndex);
  const hardFail =
    Number.isFinite(distanceKm) &&
    distanceKm >
    limitKm +
      (context.filters.routeProfile === "foot"
        ? 0.9
        : context.filters.routeProfile === "public_transit"
          ? 1.8
          : 3.0);

  if (!Number.isFinite(distanceKm) || distanceKm <= limitKm) {
    return { penalty: 0, hardFail, distanceKm };
  }

  const overKm = distanceKm - limitKm;
  const multiplier = isMealKind(slotKind) ? 22 : 16;
  const penalty = Math.round(overKm * multiplier);

  return { penalty, hardFail, distanceKm };
}

export function filterPoolAroundPeak(params: {
  pool: ScoredLocation[];
  context: PlanningContext;
  slotKind: SlotKind;
  slotIndex: number;
  peakSlotIndex: number;
  peakCandidate: ScoredLocation | null;
}) {
  const { pool, context, slotKind, slotIndex, peakSlotIndex, peakCandidate } = params;
  if (!peakCandidate) return pool;

  const nearby = pool.filter((candidate) => {
    const cluster = peakClusterPenalty({
      context,
      slotKind,
      slotIndex,
      peakSlotIndex,
      peakCandidate,
      candidate,
    });
    return !cluster.hardFail && (cluster.distanceKm == null || cluster.penalty === 0);
  });

  return nearby.length > 0 ? nearby : pool;
}

export function continuationSupportBonus(params: {
  candidate: ScoredLocation;
  allCandidates: ScoredLocation[];
  usedIds: Set<string>;
  context: PlanningContext;
  remainingSlots: number;
}) {
  const { candidate, allCandidates, usedIds, context, remainingSlots } = params;

  if (remainingSlots <= 0 || candidate.lat == null || candidate.lng == null) {
    return 0;
  }

  const searchKm =
    maxSegmentDistanceKm(context, "activity", true) +
    (context.filters.routeProfile === "foot"
      ? 0.8
      : context.filters.routeProfile === "public_transit"
        ? 1.8
        : 3.5);

  let nearbyCount = 0;
  const buckets = new Set<string>();

  for (const other of allCandidates) {
    if (
      other.id === candidate.id ||
      usedIds.has(other.id) ||
      other.lat == null ||
      other.lng == null
    ) {
      continue;
    }

    const distanceKm = haversineKm(candidate.lat, candidate.lng, other.lat, other.lng);
    if (!Number.isFinite(distanceKm) || distanceKm > searchKm) continue;

    nearbyCount += 1;
    buckets.add(bucketForCategory(classify(other)));

    if (nearbyCount >= 24 && buckets.size >= 4) break;
  }

  if (nearbyCount === 0) return -80;

  const densityBonus = Math.min(24, nearbyCount * 2);
  const diversityBonus = Math.min(20, buckets.size * 5);
  const stageWeight = remainingSlots >= 3 ? 1.2 : remainingSlots >= 2 ? 1.0 : 0.6;

  return Math.round((densityBonus + diversityBonus) * stageWeight);
}

export function chooseCandidateWithVariation<T>(
  items: T[],
  variationSeed: number,
  slotIndex: number,
  topBand = 5
): T | null {
  if (items.length === 0) return null;

  const band = Math.min(Math.max(topBand, 1), items.length);
  const shift = variationSeed * 7 + slotIndex * 3;
  return items[shift % band] ?? items[0] ?? null;
}

export function choosePeakAnchor(params: {
  context: PlanningContext;
  candidates: ScoredLocation[];
  planMode: PlanMode;
  usedIds: Set<string>;
  variationSeed: number;
  getPoolForKind: (
    candidates: ScoredLocation[],
    slot: SlotDefinition,
    mode: PlanMode,
    context: PlanningContext
  ) => ScoredLocation[];
  slotPriorityBoost: (slotKind: SlotKind, cand: ScoredLocation, planMode: PlanMode) => number;
}) {
  const { context, candidates, planMode, usedIds, variationSeed, getPoolForKind, slotPriorityBoost } =
    params;
  const peakSlotIndex = preferredPeakSlotIndex(context);
  const peakSlot = context.slotTemplate[peakSlotIndex];
  if (!peakSlot) return null;

  const basePool = getPoolForKind(candidates, peakSlot, planMode, context).filter(
    (candidate) => !usedIds.has(candidate.id)
  );
  if (basePool.length === 0) return null;

  const scored = basePool
    .map((candidate) => {
      const originTravelKm =
        context.origin.lat != null &&
        context.origin.lng != null &&
        candidate.lat != null &&
        candidate.lng != null
          ? haversineKm(context.origin.lat, context.origin.lng, candidate.lat, candidate.lng)
          : null;
      const originTravelMin = estimateTravelMinFromKmForProfile(
        originTravelKm,
        context.filters.routeProfile
      );
      const continuationBonus = continuationSupportBonus({
        candidate,
        allCandidates: candidates,
        usedIds,
        context,
        remainingSlots: context.slotTemplate.length - 1,
      });
      const phaseBonus = getOccasionModule(context.filters.occasion).phaseFitBonus(
        peakSlot.phase,
        candidate
      );
      const slotInterestAnchorBoost = Math.min(
        peakSlot.kind === "activity"
          ? 120
          : peakSlot.kind === "sightseeing" || peakSlot.kind === "walk"
            ? 130
            : 100,
        Math.round(
          slotInterestBoost({
            loc: candidate,
            interests: context.mergedInterests,
            weightMap: context.interestWeights,
            slotKind: peakSlot.kind,
          }) *
            (peakSlot.kind === "activity" ||
            peakSlot.kind === "sightseeing" ||
            peakSlot.kind === "walk"
              ? 0.7
              : 0.45)
        )
      );
      const score =
        candidate.totalScore +
        slotPriorityBoost(peakSlot.kind, candidate, planMode) +
        slotInterestAnchorBoost +
        occasionAnchorBonus(context.filters.occasion, candidate) +
        phaseBonus +
        continuationBonus -
        (originTravelMin != null ? Math.min(32, Math.round(originTravelMin / 3)) : 0);

      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score);

  const chosen = chooseCandidateWithVariation(scored, variationSeed, peakSlotIndex, 6);
  if (!chosen) return null;

  return {
    slotIndex: peakSlotIndex,
    candidate: chosen.candidate,
  } satisfies PeakAnchor;
}
