import { buildLocationSearchText, classify, getSubtypes } from "../features";
import type { CandidateBuckets, CandidateLocation, PlanningContext } from "../types";
import { bucketCandidate, sortForRetrieval } from "./priority";

export function emptyBuckets(): CandidateBuckets {
  return {
    breakfast: [],
    lunch: [],
    dinner: [],
    activity: [],
    nightlife: [],
    fallback: [],
  };
}

export function dedupeCandidates(rows: CandidateLocation[]) {
  const seen = new Set<string>();
  const out: CandidateLocation[] = [];

  for (const row of rows) {
    if (!row.id) continue;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }

  return out;
}

export function buildBalancedCandidateList(
  rows: CandidateLocation[],
  context: PlanningContext,
  maxCandidates: number
) {
  const sorted = sortForRetrieval(dedupeCandidates(rows), context);
  const buckets = emptyBuckets();

  for (const candidate of sorted) {
    bucketCandidate(candidate, buckets);
  }

  const interestMatched =
    context.mergedInterests.length > 0
      ? sorted.filter((candidate) => {
          const text = buildLocationSearchText(candidate);
          const subtypes = getSubtypes(candidate);

          return context.mergedInterests.some(
            (keyword) => subtypes.includes(keyword) || text.includes(keyword)
          );
        })
      : [];

  const overallQuota = Math.min(
    Math.max(180, Math.floor(maxCandidates * 0.42)),
    maxCandidates
  );
  const perBucketQuota = Math.max(80, Math.floor((maxCandidates - overallQuota) / 5));
  const interestQuota = Math.min(180, Math.max(40, Math.floor(maxCandidates * 0.18)));
  const generalFoodQuota = Math.max(120, Math.floor(maxCandidates * 0.12));
  const generalActivityQuota = Math.max(120, Math.floor(maxCandidates * 0.12));

  const generalFood = sorted.filter((candidate) => {
    const category = classify(candidate);
    return category === "restaurant" || category === "cafe";
  });

  const generalActivity = sorted.filter((candidate) => {
    const category = classify(candidate);
    return category === "activity" || category === "culture" || category === "event";
  });

  const prioritizedEvents =
    context.experienceMode !== "classic"
      ? sorted.filter((candidate) => classify(candidate) === "event")
      : [];

  const eventQuota =
    context.experienceMode === "show"
      ? Math.min(140, Math.max(60, Math.floor(maxCandidates * 0.28)))
      : context.experienceMode === "event_visit"
        ? Math.min(100, Math.max(36, Math.floor(maxCandidates * 0.2)))
        : context.experienceMode === "market_festival"
          ? Math.min(120, Math.max(40, Math.floor(maxCandidates * 0.22)))
          : 0;

  const merged = dedupeCandidates([
    ...sorted.slice(0, overallQuota),
    ...prioritizedEvents.slice(0, eventQuota),
    ...interestMatched.slice(0, interestQuota),
    ...generalFood.slice(0, generalFoodQuota),
    ...generalActivity.slice(0, generalActivityQuota),
    ...buckets.breakfast.slice(0, perBucketQuota),
    ...buckets.lunch.slice(0, perBucketQuota),
    ...buckets.dinner.slice(0, perBucketQuota),
    ...buckets.activity.slice(0, perBucketQuota),
    ...buckets.nightlife.slice(0, perBucketQuota),
  ]).slice(0, maxCandidates);

  const mergedBuckets = emptyBuckets();
  for (const candidate of merged) {
    bucketCandidate(candidate, mergedBuckets);
  }

  return {
    candidates: merged,
    buckets: mergedBuckets,
  };
}
