import {
  classify,
  classifyActivitySubkind,
  getAudiences,
  getOccasions,
  getSubtypes,
  hasAudience,
  hasOccasionTag,
  hasSubtype,
  resolveMeal,
} from "../features";
import { buildInterestKeywords, preferenceBoost } from "../interest";
import { getOccasionModule } from "../occasions/registry";
import { familyAgeBandBoost } from "../occasions/family";
import type {
  CandidateBuckets,
  CandidateLocation,
  LocationRow,
  PlanningContext,
} from "../types";
import {
  isStrongOccasionCandidate,
} from "./strength";

export function buildRetrievalReasons(
  loc: LocationRow,
  distanceFromOriginKm: number | null,
  context: PlanningContext
) {
  const reasons: string[] = [];

  if (loc.city_slug) reasons.push("city match");
  if (typeof loc.lat === "number" && typeof loc.lng === "number") {
    reasons.push("coordinates available");
  }
  if (typeof distanceFromOriginKm === "number") reasons.push("within radius");

  if (loc.is_plannable === true) reasons.push("plannable");
  if (typeof loc.quality_score === "number" && loc.quality_score > 0) reasons.push("quality score");
  if (typeof loc.popularity_score === "number" && loc.popularity_score > 0) reasons.push("popularity score");
  if (typeof loc.importance_score === "number" && loc.importance_score > 0) reasons.push("importance score");
  if (typeof loc.rating === "number" && loc.rating >= 4) reasons.push("good rating");
  if (getSubtypes(loc).length > 0) reasons.push("taxonomy typed");
  if (hasOccasionTag(loc, context.filters.occasion)) reasons.push("occasion tagged");
  if (hasAudience(loc, context.filters.occasion)) reasons.push("audience tagged");
  if (typeof loc.data_confidence === "number" && loc.data_confidence >= 0.7) {
    reasons.push("high confidence");
  }
  if (isStrongOccasionCandidate(context.filters.occasion, loc)) {
    reasons.push(`${context.filters.occasion} fit`);
  }
  if (classify(loc) === "event" && context.experienceMode !== "classic") {
    reasons.push("event mode match");
  }
  if (context.explicitEventId && loc.id === context.explicitEventId) {
    reasons.push("explicitly selected event");
  }

  return reasons;
}

export function bucketCandidate(loc: CandidateLocation, buckets: CandidateBuckets) {
  const category = classify(loc);
  const meal = resolveMeal(loc);
  const subkind = classifyActivitySubkind(loc);

  if (meal === "breakfast" || category === "cafe") {
    buckets.breakfast.push(loc);
  }

  if (meal === "lunch" || category === "restaurant") {
    buckets.lunch.push(loc);
  }

  if (meal === "dinner" || category === "restaurant") {
    buckets.dinner.push(loc);
  }

  if (
    category === "activity" ||
    category === "culture" ||
    category === "event" ||
    subkind === "walk" ||
    subkind === "museum" ||
    subkind === "landmark" ||
    subkind === "park" ||
    subkind === "wellness" ||
    subkind === "sport" ||
    subkind === "family"
  ) {
    buckets.activity.push(loc);
  }

  if (category === "nightlife") {
    buckets.nightlife.push(loc);
  }

  buckets.fallback.push(loc);
}

export function scoreRetrievalPriority(loc: LocationRow, context: PlanningContext) {
  let score = 0;
  const occasionModule = getOccasionModule(context.filters.occasion);
  const subtypes = getSubtypes(loc);
  const audiences = getAudiences(loc);
  const occasions = getOccasions(loc);
  const interestKeywords = buildInterestKeywords(context.mergedInterests);
  const interestWeights = context.interestWeights;

  if (loc.is_plannable === true) score += 30;
  score += subtypes.length * 3;
  score += audiences.length * 2;
  score += occasions.length * 2;
  if (typeof loc.quality_score === "number") score += loc.quality_score * 0.8;
  if (typeof loc.importance_score === "number") score += loc.importance_score * 0.6;
  if (typeof loc.popularity_score === "number") score += loc.popularity_score * 0.5;
  if (typeof loc.data_confidence === "number") score += loc.data_confidence * 20;
  if (typeof loc.rating === "number") score += loc.rating * 4;
  if (typeof loc.rating_count === "number") {
    if (loc.rating_count > 1000) score += 12;
    else if (loc.rating_count > 300) score += 8;
    else if (loc.rating_count > 50) score += 4;
  }

  if (loc.manual_category) score += 6;
  if (loc.manual_meal) score += 4;
  if (loc.family_friendly) score += 8;
  if (loc.reservation_url) score += 2;
  if (typeof loc.duration_min === "number" && loc.duration_min > 0) score += 2;
  if (hasOccasionTag(loc, context.filters.occasion)) score += 18;
  if (hasAudience(loc, context.filters.occasion)) score += 10;
  if (context.filters.occasion === "family") {
    score += Math.round(familyAgeBandBoost(context.filters.familyAgeBand, loc) * 0.18);
  }
  score += Math.min(
    90,
    Math.round(preferenceBoost(loc, interestKeywords, interestWeights) * 0.2)
  );

  if (context.explicitEventId && loc.id === context.explicitEventId) {
    score += 500;
  }

  if (classify(loc) === "event") {
    if (loc.source_primary === "planner_event") score += 20;

    if (context.experienceMode === "show") {
      if (hasSubtype(loc, "concert", "theater", "show", "performing_arts", "live_music")) {
        score += context.eventStrictness === "required" ? 120 : 80;
      } else {
        score -= 20;
      }
    } else if (context.experienceMode === "event_visit") {
      score += context.eventStrictness === "required" ? 85 : 55;
    } else if (context.experienceMode === "market_festival") {
      if (hasSubtype(loc, "market", "festival", "food_event", "seasonal_event", "fairground")) {
        score += 110;
      } else {
        score -= 15;
      }
    }

    const refs =
      loc.source_refs && typeof loc.source_refs === "object"
        ? (loc.source_refs as Record<string, unknown>)
        : null;
    const startsAt =
      typeof refs?.startsAt === "string" && refs.startsAt.trim().length > 0
        ? refs.startsAt
        : null;

    if (startsAt && (context.experienceMode === "show" || context.experienceMode === "event_visit")) {
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

      if (Number.isFinite(hour) && context.preferredDaytimes.includes("evening")) {
        const isStageEvent = hasSubtype(
          loc,
          "concert",
          "theater",
          "show",
          "performing_arts",
          "live_music"
        );
        const isFlexEvent = hasSubtype(
          loc,
          "market",
          "festival",
          "food_event",
          "seasonal_event",
          "fairground"
        );

        if (context.experienceMode === "show") {
          if (hour >= 17 && hour < 23) score += 140;
          else if (hour >= 14 && hour < 17) score += 36;
          else if (hour >= 11 && hour < 14) score -= 45;
          else score -= 140;
        } else if (isStageEvent) {
          if (hour >= 17 && hour < 23) score += 120;
          else if (hour >= 14 && hour < 17) score += 45;
          else if (hour >= 11 && hour < 14) score -= 70;
          else score -= 140;
        } else if (isFlexEvent) {
          if (hour >= 16 && hour < 23) score += 42;
          else if (hour >= 12 && hour < 16) score += 8;
          else score -= 110;
        } else {
          if (hour >= 16 && hour < 23) score += 54;
          else if (hour >= 12 && hour < 16) score += 12;
          else score -= 90;
        }
      }
    }
  }

  score += occasionModule.retrievalBoost(loc);

  return score;
}

export function sortForRetrieval(rows: CandidateLocation[], context: PlanningContext) {
  const scored = rows.map((candidate) => ({
    candidate,
    retrievalScore: scoreRetrievalPriority(candidate, context),
    distanceFromOriginKm: candidate.distanceFromOriginKm ?? Number.POSITIVE_INFINITY,
  }));

  scored.sort((left, right) => {
    if (right.retrievalScore !== left.retrievalScore) {
      return right.retrievalScore - left.retrievalScore;
    }
    return left.distanceFromOriginKm - right.distanceFromOriginKm;
  });

  return scored.map((entry) => entry.candidate);
}

export function sortBucketByDistance(bucket: CandidateLocation[]) {
  return [...bucket].sort((a, b) => {
    const distanceA = a.distanceFromOriginKm ?? Number.POSITIVE_INFINITY;
    const distanceB = b.distanceFromOriginKm ?? Number.POSITIVE_INFINITY;
    return distanceA - distanceB;
  });
}
