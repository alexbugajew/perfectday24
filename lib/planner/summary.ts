import { estimateTravelMinFromKm, haversineKm } from "./travel";
import type { PlannedStop, RouteSummaryLite } from "./types";

export function summarizeRoute(params: {
  stops: PlannedStop[];
  origin: { lat: number | null; lng: number | null };
}): RouteSummaryLite {
  const { stops, origin } = params;

  let distanceKm = 0;
  let travelMin = 0;
  let activityMin = 0;

  const points: Array<{ lat: number; lng: number }> = [];

  if (origin.lat != null && origin.lng != null) {
    points.push({ lat: origin.lat, lng: origin.lng });
  }

  for (const stop of stops) {
    activityMin += stop.durationMin ?? 0;
    if (stop.item?.lat != null && stop.item?.lng != null) {
      points.push({ lat: stop.item.lat, lng: stop.item.lng });
    }
  }

  for (let i = 1; i < points.length; i++) {
    const d = haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    distanceKm += d;
    travelMin += estimateTravelMinFromKm(d) ?? 0;
  }

  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    travelMin: Math.round(travelMin),
    activityMin: Math.round(activityMin),
    totalMin: Math.round(activityMin + travelMin),
  };
}