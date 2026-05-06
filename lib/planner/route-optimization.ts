import { classify } from "./features";
import { estimateTravelMinFromKm, haversineKm } from "./travel";
import type { PlannedStop, PlanMode } from "./types";

function getStopCoords(stop: PlannedStop) {
  if (stop.item?.lat == null || stop.item?.lng == null) return null;
  return { lat: stop.item.lat, lng: stop.item.lng };
}

function getTravelMinBetween(
  a: { lat: number; lng: number } | null,
  b: { lat: number; lng: number } | null
) {
  if (!a || !b) return 0;
  return estimateTravelMinFromKm(haversineKm(a.lat, a.lng, b.lat, b.lng)) ?? 0;
}

function isMealLabel(label: string) {
  const x = label.toLowerCase();
  return x.includes("frühstück") || x.includes("mittag") || x.includes("abendessen");
}

function canSwap(a: PlannedStop, b: PlannedStop, planMode: PlanMode) {
  if (!a.item || !b.item) return false;

  const aMeal = isMealLabel(a.label);
  const bMeal = isMealLabel(b.label);

  if (aMeal || bMeal) return false;

  if (planMode === "morning") return true;
  if (planMode === "midday") return true;
  if (planMode === "evening") return true;
  if (planMode === "fullday") return true;

  return false;
}

function categoryChainPenalty(stops: PlannedStop[]) {
  let penalty = 0;

  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1];
    const curr = stops[i];

    if (!prev.item || !curr.item) continue;

    const prevCat = classify(prev.item);
    const currCat = classify(curr.item);

    if (prevCat && currCat && prevCat === currCat) {
      penalty += 8;
    }
  }

  for (let i = 2; i < stops.length; i++) {
    const a = stops[i - 2];
    const b = stops[i - 1];
    const c = stops[i];

    if (!a.item || !b.item || !c.item) continue;

    const ca = classify(a.item);
    const cb = classify(b.item);
    const cc = classify(c.item);

    if (ca && cb && cc && ca === cb && cb === cc) {
      penalty += 14;
    }
  }

  return penalty;
}

function totalTravelMin(
  stops: PlannedStop[],
  origin: { lat: number | null; lng: number | null }
) {
  let total = 0;

  let prevPoint =
    origin.lat != null && origin.lng != null
      ? { lat: origin.lat, lng: origin.lng }
      : null;

  for (const stop of stops) {
    const curr = getStopCoords(stop);
    total += getTravelMinBetween(prevPoint, curr);
    if (curr) prevPoint = curr;
  }

  return total;
}

function routeObjective(params: {
  stops: PlannedStop[];
  origin: { lat: number | null; lng: number | null };
}) {
  const { stops, origin } = params;

  const travelPenalty = totalTravelMin(stops, origin);
  const diversityPenalty = categoryChainPenalty(stops);

  let utility = 0;
  for (const stop of stops) {
    if (!stop.item) continue;
    utility += stop.item.totalScore ?? 0;
  }

  return utility - travelPenalty - diversityPenalty;
}

function swap<T>(arr: T[], i: number, j: number) {
  const copy = [...arr];
  const tmp = copy[i];
  copy[i] = copy[j];
  copy[j] = tmp;
  return copy;
}

function rebuildTravelFromOrder(
  stops: PlannedStop[],
  origin: { lat: number | null; lng: number | null }
): PlannedStop[] {
  const out: PlannedStop[] = [];

  let prevPoint =
    origin.lat != null && origin.lng != null
      ? { lat: origin.lat, lng: origin.lng }
      : null;

  for (const stop of stops) {
    const curr = getStopCoords(stop);
    const travelMinFromPrev = getTravelMinBetween(prevPoint, curr);

    out.push({
      ...stop,
      travelMinFromPrev: curr ? travelMinFromPrev : null,
    });

    if (curr) prevPoint = curr;
  }

  return out;
}

export function optimizeRoute(params: {
  stops: PlannedStop[];
  origin: { lat: number | null; lng: number | null };
  planMode: PlanMode;
}): PlannedStop[] {
  const { stops, origin, planMode } = params;

  if (stops.length <= 2) {
    return rebuildTravelFromOrder(stops, origin);
  }

  let best = rebuildTravelFromOrder(stops, origin);
  let bestScore = routeObjective({ stops: best, origin });

  let improved = true;
  let iterations = 0;
  const maxIterations = 8;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations += 1;

    for (let i = 0; i < best.length - 1; i++) {
      const a = best[i];
      const b = best[i + 1];

      if (!canSwap(a, b, planMode)) continue;

      const candidate = rebuildTravelFromOrder(swap(best, i, i + 1), origin);
      const candidateScore = routeObjective({ stops: candidate, origin });

      if (candidateScore > bestScore) {
        best = candidate;
        bestScore = candidateScore;
        improved = true;
      }
    }
  }

  return best;
}
