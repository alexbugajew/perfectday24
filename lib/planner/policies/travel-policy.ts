import type { SlotCandidatePolicy } from "./types";
import { estimateTravelMinFromKmForProfile, haversineKm } from "../travel";

function maxSegmentDistanceKm(
  routeProfile: "foot" | "public_transit" | "car",
  occasion: string,
  slotKind: string,
  hasPreviousStop: boolean
) {
  if (routeProfile === "foot") {
    const firstLegLimit =
      occasion === "family" || occasion === "date" || occasion === "party" ? 3.0 : 3.8;
    const nextLegLimit =
      occasion === "family" || occasion === "date" || occasion === "party" ? 2.2 : 3.0;
    const mealTightening =
      slotKind === "breakfast" || slotKind === "lunch" || slotKind === "dinner" ? 0.4 : 0;

    return Math.max(
      1.4,
      (hasPreviousStop ? nextLegLimit : firstLegLimit) - mealTightening
    );
  }

  if (routeProfile === "public_transit") {
    const firstLegLimit =
      occasion === "family" || occasion === "date" || occasion === "party" ? 8.0 : 10.5;
    const nextLegLimit =
      occasion === "family" || occasion === "date" || occasion === "party" ? 5.5 : 7.5;
    const mealTightening =
      slotKind === "breakfast" || slotKind === "lunch" || slotKind === "dinner" ? 0.8 : 0;

    return Math.max(
      3.2,
      (hasPreviousStop ? nextLegLimit : firstLegLimit) - mealTightening
    );
  }

  if (occasion === "date" || occasion === "family") return 12;
  if (occasion === "party") return 10;
  if (occasion === "friends") return 16;
  return 18;
}

function maxSegmentTravelMin(
  routeProfile: "foot" | "public_transit" | "car",
  occasion: string,
  slotKind: string,
  hasPreviousStop: boolean
) {
  if (routeProfile === "foot") {
    const firstLegLimit =
      occasion === "family" || occasion === "date" || occasion === "party" ? 38 : 45;
    const nextLegLimit =
      occasion === "family" || occasion === "date" || occasion === "party" ? 30 : 38;
    const mealTightening =
      slotKind === "breakfast" || slotKind === "lunch" || slotKind === "dinner" ? 5 : 0;

    return Math.max(
      18,
      (hasPreviousStop ? nextLegLimit : firstLegLimit) - mealTightening
    );
  }

  if (routeProfile === "public_transit") {
    const firstLegLimit =
      occasion === "family" || occasion === "date" || occasion === "party" ? 52 : 62;
    const nextLegLimit =
      occasion === "family" || occasion === "date" || occasion === "party" ? 42 : 52;
    const mealTightening =
      slotKind === "breakfast" || slotKind === "lunch" || slotKind === "dinner" ? 6 : 0;

    return Math.max(
      28,
      (hasPreviousStop ? nextLegLimit : firstLegLimit) - mealTightening
    );
  }

  if (occasion === "date" || occasion === "family") return 35;
  if (occasion === "party") return 30;
  if (occasion === "friends") return 45;
  return 50;
}

function distanceSoftPenalty(travelMin: number | null, slotKind: string) {
  if (travelMin == null) return 0;

  if (slotKind === "breakfast" || slotKind === "lunch" || slotKind === "dinner") {
    if (travelMin > 35) return 18;
    if (travelMin > 25) return 10;
    if (travelMin > 15) return 4;
    return 0;
  }

  if (travelMin > 40) return 16;
  if (travelMin > 25) return 8;
  if (travelMin > 15) return 3;
  return 0;
}

export const travelPolicy: SlotCandidatePolicy = {
  key: "travel",
  evaluate(input) {
    const { context, candidate, previousStop, slot } = input;

    const anchorLat = previousStop?.lat ?? context.origin.lat;
    const anchorLng = previousStop?.lng ?? context.origin.lng;

    const travelKm =
      anchorLat != null &&
      anchorLng != null &&
      candidate.lat != null &&
      candidate.lng != null
        ? haversineKm(anchorLat, anchorLng, candidate.lat, candidate.lng)
        : null;

    const travelMin = estimateTravelMinFromKmForProfile(travelKm, context.filters.routeProfile);
    const hasPreviousStop = previousStop != null;

    const maxKm = maxSegmentDistanceKm(
      context.filters.routeProfile,
      context.filters.occasion,
      slot.kind,
      hasPreviousStop
    );

    const maxMin = maxSegmentTravelMin(
      context.filters.routeProfile,
      context.filters.occasion,
      slot.kind,
      hasPreviousStop
    );

    const hardFail =
      (travelKm != null && travelKm > maxKm) ||
      (travelMin != null && travelMin > maxMin);

    const travelPenalty =
      travelMin != null ? Math.min(42, Math.round(travelMin / 3)) : 0;

    const extraPenalty = distanceSoftPenalty(travelMin, slot.kind);

    return {
      key: "travel",
      scoreDelta: -(travelPenalty + extraPenalty),
      hardFail,
      meta: {
        travelKm,
        travelMin,
        maxKm,
        maxMin,
      },
    };
  },
};
