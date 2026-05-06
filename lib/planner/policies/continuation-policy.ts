import { bucketForCategory } from "../features";
import { classify } from "../features";
import type { SlotCandidatePolicy } from "./types";
import { haversineKm } from "../travel";

function maxSegmentDistanceKm(
  routeProfile: "foot" | "public_transit" | "car",
  occasion: string
) {
  if (routeProfile === "foot") {
    return (
      (occasion === "family" || occasion === "date" || occasion === "party" ? 2.2 : 3.0) +
      0.8
    );
  }

  if (routeProfile === "public_transit") {
    return (
      (occasion === "family" || occasion === "date" || occasion === "party" ? 5.2 : 6.8) +
      1.2
    );
  }

  if (occasion === "date" || occasion === "family") return 15.5;
  if (occasion === "party") return 13.5;
  if (occasion === "friends") return 19.5;
  return 21.5;
}

export const continuationPolicy: SlotCandidatePolicy = {
  key: "continuation",
  evaluate(input) {
    const { candidate, allCandidates, usedIds, context, remainingSlots } = input;

    if (remainingSlots <= 0 || candidate.lat == null || candidate.lng == null) {
      return {
        key: "continuation",
        scoreDelta: 0,
      };
    }

    const searchKm = maxSegmentDistanceKm(
      context.filters.routeProfile,
      context.filters.occasion
    );

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

      const dist = haversineKm(candidate.lat, candidate.lng, other.lat, other.lng);
      if (!Number.isFinite(dist) || dist > searchKm) continue;

      nearbyCount += 1;
      buckets.add(bucketForCategory(classify(other)));

      if (nearbyCount >= 24 && buckets.size >= 4) break;
    }

    if (nearbyCount === 0) {
      return {
        key: "continuation",
        scoreDelta: -80,
        meta: {
          nearbyCount,
          bucketCount: buckets.size,
          searchKm,
        },
      };
    }

    const densityBonus = Math.min(24, nearbyCount * 2);
    const diversityBonus = Math.min(20, buckets.size * 5);
    const stageWeight = remainingSlots >= 3 ? 1.2 : remainingSlots >= 2 ? 1.0 : 0.6;
    const scoreDelta = Math.round((densityBonus + diversityBonus) * stageWeight);
    const reasons: string[] = [];

    if (nearbyCount >= 8) reasons.push("gute Anschlussoptionen im Umfeld");
    if (buckets.size >= 3) reasons.push("lässt sich gut weiterbauen");

    return {
      key: "continuation",
      scoreDelta,
      reasons,
      meta: {
        nearbyCount,
        bucketCount: buckets.size,
        searchKm,
        densityBonus,
        diversityBonus,
        stageWeight,
      },
    };
  },
};
