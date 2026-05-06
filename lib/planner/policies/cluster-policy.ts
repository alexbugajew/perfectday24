import type { SlotCandidatePolicy } from "./types";
import { haversineKm } from "../travel";

function isMealKind(slotKind: string) {
  return slotKind === "breakfast" || slotKind === "lunch" || slotKind === "dinner";
}

function peakClusterLimitKm(
  routeProfile: "foot" | "public_transit" | "car",
  slotKind: string,
  slotIndex: number,
  peakSlotIndex: number
) {
  const distanceFromPeakSlots = Math.abs(slotIndex - peakSlotIndex);
  const meal = isMealKind(slotKind);

  if (routeProfile === "foot") {
    const base = meal ? 1.2 : 1.8;
    const stretch =
      distanceFromPeakSlots >= 2 ? 0.6 : distanceFromPeakSlots === 1 ? 0.25 : 0;
    return Math.min(2.6, base + stretch);
  }

  if (routeProfile === "public_transit") {
    const base = meal ? 2.4 : 3.4;
    const stretch =
      distanceFromPeakSlots >= 2 ? 1.2 : distanceFromPeakSlots === 1 ? 0.7 : 0;
    return Math.min(5.8, base + stretch);
  }

  const base = meal ? 3.0 : 4.5;
  const stretch =
    distanceFromPeakSlots >= 2 ? 2.0 : distanceFromPeakSlots === 1 ? 1.0 : 0;
  return Math.min(8, base + stretch);
}

export const clusterPolicy: SlotCandidatePolicy = {
  key: "cluster",
  evaluate(input) {
    const { context, candidate, peakCandidate, peakSlotIndex, slotIndex, slot } = input;

    if (!peakCandidate || peakCandidate.id === candidate.id || peakSlotIndex < 0) {
      return {
        key: "cluster",
        scoreDelta: 0,
      };
    }

    if (
      peakCandidate.lat == null ||
      peakCandidate.lng == null ||
      candidate.lat == null ||
      candidate.lng == null
    ) {
      return {
        key: "cluster",
        scoreDelta: 0,
      };
    }

    const distanceKm = haversineKm(
      peakCandidate.lat,
      peakCandidate.lng,
      candidate.lat,
      candidate.lng
    );

    const limitKm = peakClusterLimitKm(
      context.filters.routeProfile,
      slot.kind,
      slotIndex,
      peakSlotIndex
    );
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
      return {
        key: "cluster",
        scoreDelta: 0,
        hardFail,
        reasons: distanceKm <= limitKm ? ["liegt im lokalen Cluster"] : [],
        meta: {
          distanceKm,
          limitKm,
        },
      };
    }

    const overKm = distanceKm - limitKm;
    const multiplier = isMealKind(slot.kind) ? 22 : 16;
    const penalty = Math.round(overKm * multiplier);

    return {
      key: "cluster",
      scoreDelta: -penalty,
      hardFail,
      meta: {
        distanceKm,
        limitKm,
        overKm,
        multiplier,
      },
    };
  },
};
