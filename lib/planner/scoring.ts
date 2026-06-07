import { isLikelyOpen } from "./opening-hours";
import {
  buildLocationSearchText,
  classify,
  getSubtypes,
  hasAudience,
  hasOccasionTag,
  hasSubtype,
  norm,
  normalizeDaytime,
} from "./features";
import { buildInterestKeywords, preferenceBoost } from "./interest";
import {
  buildMarketFestivalIntentText,
  isEligibleMarketFestival,
  marketFestivalSpecificityScore,
} from "./market-festival";
import { familyAgeBandBoost } from "./occasions/family";
import type {
  CandidateLocation,
  CandidateScore,
  LocationRow,
  MatchLevel,
  PlanningContext,
  ScoredLocation,
} from "./types";

function isOfficialFlexEvent(candidate: CandidateLocation) {
  if (classify(candidate) !== "event") return false;
  const refs =
    candidate.source_refs && typeof candidate.source_refs === "object"
      ? (candidate.source_refs as Record<string, unknown>)
      : null;
  return refs?.eventKind === "flex_event" && typeof refs?.source === "string";
}

function eventPlanabilityBoost(candidate: CandidateLocation) {
  if (classify(candidate) !== "event") return 0;
  const refs =
    candidate.source_refs && typeof candidate.source_refs === "object"
      ? (candidate.source_refs as Record<string, unknown>)
      : null;

  let score = 0;
  if (refs?.isConcreteEventPage === true) score += 28;
  if (refs?.isEditorialSummary === true) score -= 110;
  if (typeof refs?.venueName === "string" && refs.venueName.trim().length > 0) score += 8;
  if (typeof refs?.startsAt === "string" && refs.startsAt.trim().length > 0) score += 4;
  if (typeof refs?.endsAt === "string" && refs.endsAt.trim().length > 0) score += 4;
  if (typeof refs?.ticketUrl === "string" && refs.ticketUrl.trim().length > 0) score += 3;
  if (refs?.missingCoordinates === true) score -= 8;
  return score;
}

function berlinEditorialAdjustment(candidate: CandidateLocation) {
  if (classify(candidate) !== "event") return 0;
  const refs =
    candidate.source_refs && typeof candidate.source_refs === "object"
      ? (candidate.source_refs as Record<string, unknown>)
      : null;
  if (refs?.source !== "berlin_de") return 0;
  if (refs?.isConcreteEventPage === true) return 36;
  if (refs?.isEditorialSummary === true) return -120;
  return 0;
}

function scoreStrict(context: PlanningContext, candidate: CandidateLocation) {
  const locBudget = candidate.budget ?? "medium";
  const locOccasion = candidate.occasion ?? "date";
  const locDaytime = normalizeDaytime(candidate.daytime);

  let score = 0;
  if (locBudget === context.filters.budget) score += 2;
  if (
    locOccasion === context.filters.occasion ||
    hasOccasionTag(candidate, context.filters.occasion)
  ) {
    score += 3;
  }
  if (hasAudience(candidate, context.filters.occasion)) score += 2;
  if (locDaytime && context.preferredDaytimes.includes(locDaytime)) score += 2;
  return score;
}

function scoreRelaxDaytime(context: PlanningContext, candidate: CandidateLocation) {
  const locBudget = candidate.budget ?? "medium";
  const locOccasion = candidate.occasion ?? "date";

  let score = 0;
  if (locBudget === context.filters.budget) score += 2;
  if (
    locOccasion === context.filters.occasion ||
    hasOccasionTag(candidate, context.filters.occasion)
  ) {
    score += 3;
  }
  if (hasAudience(candidate, context.filters.occasion)) score += 2;
  return score;
}

function scoreRelaxBudget(context: PlanningContext, candidate: CandidateLocation) {
  const locOccasion = candidate.occasion ?? "date";

  let score = 0;
  if (
    locOccasion === context.filters.occasion ||
    hasOccasionTag(candidate, context.filters.occasion)
  ) {
    score += 3;
  }
  if (hasAudience(candidate, context.filters.occasion)) score += 2;
  return score;
}

function totalize(base: number, pb: number) {
  return base * 8 + pb;
}

function sortScored(context: PlanningContext, a: ScoredLocation, b: ScoredLocation) {
  if (context.filters.sortMode === "distance") {
    const da = a.distanceFromOriginKm ?? Number.POSITIVE_INFINITY;
    const db = b.distanceFromOriginKm ?? Number.POSITIVE_INFINITY;

    if (da !== db) return da - db;
    return b.totalScore - a.totalScore;
  }

  if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;

  const da = a.distanceFromOriginKm ?? Number.POSITIVE_INFINITY;
  const db = b.distanceFromOriginKm ?? Number.POSITIVE_INFINITY;
  return da - db;
}

function popularityScore(loc: LocationRow) {
  const count = typeof loc.rating_count === "number" ? loc.rating_count : 0;

  if (count > 1000) return 15;
  if (count > 300) return 12;
  if (count > 100) return 8;
  if (count > 20) return 5;
  return 0;
}

function ratingScore(loc: LocationRow) {
  const rating = typeof loc.rating === "number" ? loc.rating : 0;

  if (rating >= 4.5) return 15;
  if (rating >= 4.0) return 10;
  if (rating >= 3.5) return 6;
  return 0;
}

function routeProfileDistanceBoost(
  routeProfile: "foot" | "public_transit" | "car",
  distanceKm: number | null
) {
  if (distanceKm == null) return 0;

  if (routeProfile === "foot") {
    if (distanceKm <= 0.5) return 14;
    if (distanceKm <= 1.0) return 10;
    if (distanceKm <= 2.0) return 6;
    if (distanceKm <= 3.0) return 2;
    return -4;
  }

  if (routeProfile === "public_transit") {
    if (distanceKm <= 1.0) return 12;
    if (distanceKm <= 3.0) return 9;
    if (distanceKm <= 6.0) return 6;
    if (distanceKm <= 12.0) return 2;
    if (distanceKm <= 20.0) return -1;
    return -4;
  }

  if (distanceKm <= 1.5) return 8;
  if (distanceKm <= 4.0) return 6;
  if (distanceKm <= 8.0) return 3;
  if (distanceKm <= 15.0) return 0;
  return -3;
}

function daytimeFitBoost(context: PlanningContext, candidate: CandidateLocation) {
  const preferredDaytimes = context.preferredDaytimes ?? [];
  if (!Array.isArray(candidate.daytime_fit) || candidate.daytime_fit.length === 0) return 0;

  return preferredDaytimes.some((daytime) => candidate.daytime_fit!.includes(daytime))
    ? 12
    : -8;
}

function mealFitBoost(context: PlanningContext, candidate: CandidateLocation) {
  const preferredDaytimes = context.preferredDaytimes ?? [];

  return (
    (preferredDaytimes.includes("morning") && candidate.breakfast_fit ? 6 : 0) +
    (preferredDaytimes.includes("midday") && candidate.lunch_fit ? 6 : 0) +
    (preferredDaytimes.includes("evening") && candidate.dinner_fit ? 6 : 0) +
    (preferredDaytimes.includes("night") && candidate.nightlife_fit ? 8 : 0)
  );
}

function qualityBoost(candidate: CandidateLocation) {
  return typeof candidate.quality_score === "number" &&
    Number.isFinite(candidate.quality_score)
    ? Math.round(candidate.quality_score * 1.0)
    : 0;
}

function popularityBoost(candidate: CandidateLocation) {
  return typeof candidate.popularity_score === "number" &&
    Number.isFinite(candidate.popularity_score)
    ? Math.round(candidate.popularity_score * 0.7)
    : 0;
}

function importanceBoost(candidate: CandidateLocation) {
  return typeof candidate.importance_score === "number" &&
    Number.isFinite(candidate.importance_score)
    ? Math.round(candidate.importance_score * 0.8)
    : 0;
}

function taxonomyBoost(context: PlanningContext, candidate: CandidateLocation) {
  const subtypeCount = getSubtypes(candidate).length;
  const confidenceBoost =
    typeof candidate.data_confidence === "number" && Number.isFinite(candidate.data_confidence)
      ? Math.round(candidate.data_confidence * 16)
      : 0;
  const occasionBoost = hasOccasionTag(candidate, context.filters.occasion) ? 12 : 0;
  const audienceBoost = hasAudience(candidate, context.filters.occasion) ? 8 : 0;

  return confidenceBoost + subtypeCount * 2 + occasionBoost + audienceBoost;
}

function manualBoostScore(candidate: CandidateLocation) {
  return typeof candidate.manual_boost === "number" && Number.isFinite(candidate.manual_boost)
    ? Math.round(candidate.manual_boost)
    : 0;
}

function openingPenalty(context: PlanningContext, candidate: CandidateLocation) {
  return !isLikelyOpen({
    openingHoursRaw: candidate.opening_hours_raw,
    preferredDaytimes: context.preferredDaytimes,
  })
    ? 25
    : 0;
}

function eveningPenalty(context: PlanningContext, candidate: CandidateLocation) {
  return candidate.evening_only && context.preferredDaytimes.includes("morning") ? 15 : 0;
}

function plannablePenalty(candidate: CandidateLocation) {
  return candidate.is_plannable === false ? 1000 : 0;
}

function eventExperienceBoost(context: PlanningContext, candidate: CandidateLocation) {
  if (classify(candidate) !== "event") return 0;

  const eveningPreferred = context.preferredDaytimes.includes("evening");
  const searchableText = buildLocationSearchText(candidate).toLowerCase();
  const marketFestivalText = buildMarketFestivalIntentText(candidate);
  const stageEvent = hasSubtype(
    candidate,
    "concert",
    "theater",
    "show",
    "performing_arts",
    "live_music"
  );
  const flexEvent = hasSubtype(
    candidate,
    "market",
    "festival",
    "food_event",
    "seasonal_event",
    "fairground"
  );
  const strongMarketFestivalEvent = hasSubtype(
    candidate,
    "market",
    "festival",
    "food_event",
    "weekly_market",
    "market_event",
    "festival_event"
  );
  const marketFestivalIntentSignal = /\b(?:wochenmarkt|flohmarkt|street food|food market|market|festival|japan day|fruehlingsfest|maifest|kirmes|funfair|fairground)\b/.test(
    searchableText
  );
  const exhibitionLikeSignal = /\b(?:museum|exhibition|ausstellung|gallery|kunst|sammlung|painting exhibition|art exhibition)\b/.test(
    searchableText
  );

  if (context.experienceMode === "show") {
    return hasSubtype(candidate, "concert", "theater", "show", "performing_arts", "live_music")
      ? context.eventStrictness === "required"
        ? 95
        : 70
      : -30;
  }

  if (context.experienceMode === "event_visit") {
    let score = context.eventStrictness === "required" ? 60 : 36;
    if (eveningPreferred) {
      if (stageEvent) score += 44;
      else if (flexEvent) score -= 18;
    } else if (flexEvent) {
      score += 16;
    }
    return score;
  }

  if (context.experienceMode === "market_festival") {
    const specificity = marketFestivalSpecificityScore({
      text: marketFestivalText,
      subtypes: getSubtypes(candidate),
    });
    const eligible = isEligibleMarketFestival({
      text: marketFestivalText,
      subtypes: getSubtypes(candidate),
    });

    if (strongMarketFestivalEvent && eligible) {
      return isOfficialFlexEvent(candidate) ? 148 : 96;
    }

    if (hasSubtype(candidate, "fairground") && eligible) {
      if (marketFestivalIntentSignal || specificity >= 80) {
        return isOfficialFlexEvent(candidate) ? 74 : 42;
      }

      return 10;
    }
    if (!eligible) {
      return exhibitionLikeSignal && !marketFestivalIntentSignal ? -90 : -48;
    }

    return specificity >= 80 ? 38 : 16;
  }

  return -10;
}

function isFreeBudgetCandidate(candidate: CandidateLocation) {
  const locBudget = norm(candidate.budget ?? null);
  if (locBudget === "free") return true;

  if (
    hasSubtype(
      candidate,
      "park",
      "promenade",
      "viewpoint",
      "landmark",
      "historic_site",
      "old_town",
      "monument",
      "memorial",
      "botanical_garden"
    )
  ) {
    return true;
  }

  const category = classify(candidate);
  if (category === "culture" && !candidate.reservation_url && !candidate.rating) {
    return true;
  }

  return false;
}

function buildCandidateScore(
  context: PlanningContext,
  candidate: CandidateLocation,
  matchLevel: MatchLevel,
  interestKeywords: string[]
) {
  const base =
    matchLevel === "strict"
      ? scoreStrict(context, candidate)
      : matchLevel === "relax_daytime"
      ? scoreRelaxDaytime(context, candidate)
      : matchLevel === "relax_budget"
      ? scoreRelaxBudget(context, candidate)
      : 0;

  const preference = preferenceBoost(candidate, interestKeywords, context.interestWeights);
  const quality =
    qualityBoost(candidate) +
    popularityBoost(candidate) +
    importanceBoost(candidate) +
    manualBoostScore(candidate) +
    ratingScore(candidate) +
    popularityScore(candidate) +
    taxonomyBoost(context, candidate) +
    eventExperienceBoost(context, candidate) +
    eventPlanabilityBoost(candidate) +
    berlinEditorialAdjustment(candidate);

  const distance = routeProfileDistanceBoost(
    context.filters.routeProfile,
    candidate.distanceFromOriginKm
  );

  const slotFit = daytimeFitBoost(context, candidate) + mealFitBoost(context, candidate);
  const familyAgeScore =
    context.filters.occasion === "family"
      ? familyAgeBandBoost(context.filters.familyAgeBand, candidate)
      : 0;
  const diversityPenalty = 0;

  return {
    preference,
    occasion: base * 8,
    distance,
    quality: quality + familyAgeScore,
    slotFit,
    diversityPenalty,
    total: totalize(base, preference) + quality + familyAgeScore + distance + slotFit,
  } satisfies CandidateScore;
}

function scoreByLevel(
  context: PlanningContext,
  candidates: CandidateLocation[],
  matchLevel: MatchLevel
): ScoredLocation[] {
  const interestKeywords = buildInterestKeywords(context.mergedInterests);

  return candidates
    .map((candidate) => {
      if (context.filters.budget === "free" && !isFreeBudgetCandidate(candidate)) {
        return null;
      }

      const breakdown = buildCandidateScore(
        context,
        candidate,
        matchLevel,
        interestKeywords
      );

      const subtractivePenalties =
        eveningPenalty(context, candidate) +
        plannablePenalty(candidate) +
        openingPenalty(context, candidate);

      const totalScore =
        matchLevel === "fallback"
          ? breakdown.preference +
            breakdown.quality +
            breakdown.distance +
            breakdown.slotFit -
            subtractivePenalties
          : breakdown.total - subtractivePenalties;

      const baseScore = Math.round(breakdown.occasion / 8);

      return {
        ...candidate,
        score: baseScore,
        prefBoost: breakdown.preference,
        totalScore,
        matchLevel,
      };
    })
    .filter((candidate): candidate is ScoredLocation => candidate !== null)
    .filter(
      (candidate) =>
        matchLevel === "fallback" || candidate.score > 0 || candidate.prefBoost > 0
    )
    .sort((a, b) => sortScored(context, a, b));
}

export function scoreCandidatesWithRelaxation(params: {
  context: PlanningContext;
  candidates: CandidateLocation[];
}) {
  const { context, candidates } = params;

  const strict = scoreByLevel(context, candidates, "strict");
  if (strict.length > 0) {
    return {
      results: strict,
      activeLevel: "strict" as const,
    };
  }

  const relaxDaytime = scoreByLevel(context, candidates, "relax_daytime");
  if (relaxDaytime.length > 0) {
    return {
      results: relaxDaytime,
      activeLevel: "relax_daytime" as const,
    };
  }

  const relaxBudget = scoreByLevel(context, candidates, "relax_budget");
  if (relaxBudget.length > 0) {
    return {
      results: relaxBudget,
      activeLevel: "relax_budget" as const,
    };
  }

  const fallback = scoreByLevel(context, candidates, "fallback").slice(0, 120);
  return {
    results: fallback,
    activeLevel: "fallback" as const,
  };
}
