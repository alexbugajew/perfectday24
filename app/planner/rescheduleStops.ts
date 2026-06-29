import type { PlannedStop } from "@/lib/planner";

function parseIso(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function earliestParseable(stops: PlannedStop[]): Date | null {
  let earliest: Date | null = null;
  for (const stop of stops) {
    const start = parseIso(stop.scheduledStartAt);
    if (!start) continue;
    if (!earliest || start.getTime() < earliest.getTime()) earliest = start;
  }
  return earliest;
}

/**
 * Reschedules stops in their current array order, preserving event-locked
 * stops' absolute times. Used after a manual reorder so the UI shows
 * times that are consistent with the visible sequence.
 *
 * Pure: returns new stop objects with updated scheduledStartAt/EndAt and
 * a "Reihenfolge neu berechnet" timing warning when reorder forced changes.
 */
export function rescheduleStops(stops: PlannedStop[]): PlannedStop[] {
  if (stops.length === 0) return stops;

  const anchor = earliestParseable(stops);
  if (!anchor) return stops;

  const result: PlannedStop[] = [];
  let cursor: Date | null = null;

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const duration = stop.durationMin ?? stop.item?.duration_min ?? 60;
    const travelMin = i === 0 ? 0 : stop.travelMinFromPrev ?? 0;

    if (stop.timingLock === "event") {
      const lockedStart = parseIso(stop.scheduledStartAt);
      const lockedEnd = parseIso(stop.scheduledEndAt);
      if (lockedStart && lockedEnd) {
        const warnings = [...(stop.timingWarnings ?? [])];
        if (cursor) {
          const arrival = addMinutes(cursor, travelMin);
          if (arrival.getTime() > lockedStart.getTime()) {
            const overshootMin = Math.round(
              (arrival.getTime() - lockedStart.getTime()) / 60_000
            );
            warnings.push(
              `Der davor liegende Stop überzieht den Event-Start um ca. ${overshootMin} Min.`
            );
          }
        }
        result.push({ ...stop, timingWarnings: warnings });
        cursor = lockedEnd;
        continue;
      }
    }

    const start = cursor ? addMinutes(cursor, travelMin) : anchor;
    const end = addMinutes(start, duration);

    result.push({
      ...stop,
      scheduledStartAt: start.toISOString(),
      scheduledEndAt: end.toISOString(),
      timingLock: stop.timingLock === "event" ? "none" : stop.timingLock,
    });
    cursor = end;
  }

  return result;
}

export function sortStopsChronologically(stops: PlannedStop[]): PlannedStop[] {
  return [...stops].sort((left, right) => {
    const leftMs = parseIso(left.scheduledStartAt)?.getTime() ?? Number.POSITIVE_INFINITY;
    const rightMs = parseIso(right.scheduledStartAt)?.getTime() ?? Number.POSITIVE_INFINITY;
    return leftMs - rightMs;
  });
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Re-orders stops by geographic nearest-neighbor from the first stop.
 * - Event-locked stops keep their original position (we can't move them).
 * - Stops without coordinates fall to the end in their original relative order.
 * - The first stop stays where it is (it's the anchor — Hotel/Start/etc).
 *
 * Returns a new array; does not mutate input.
 */
export function optimizeStopOrderByGeo(stops: PlannedStop[]): PlannedStop[] {
  if (stops.length < 3) return [...stops];

  // Split into fixed (event-locked or no coords) vs movable
  type Pos = { lat: number; lng: number };
  const getCoords = (s: PlannedStop): Pos | null => {
    const lat = s.item?.lat;
    const lng = s.item?.lng;
    return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;
  };

  // Determine which original indices are locked in place: event-locked, or
  // the very first stop (anchor).
  const lockedSet = new Set<number>();
  lockedSet.add(0);
  stops.forEach((s, i) => {
    if (s.timingLock === "event") lockedSet.add(i);
  });

  // Build a list of movable stops with their coordinates
  const movable: Array<{ stop: PlannedStop; coords: Pos; originalIndex: number }> = [];
  const noCoords: Array<{ stop: PlannedStop; originalIndex: number }> = [];

  stops.forEach((stop, i) => {
    if (lockedSet.has(i)) return;
    const c = getCoords(stop);
    if (c) movable.push({ stop, coords: c, originalIndex: i });
    else noCoords.push({ stop, originalIndex: i });
  });

  // Nearest-neighbor greedy from the last fixed position before each
  // free slot. Simple but effective for short routes (≤10 stops).
  const result: (PlannedStop | null)[] = new Array(stops.length).fill(null);
  for (const idx of lockedSet) {
    result[idx] = stops[idx];
  }

  // Walk forward; for each empty slot, pick the closest movable to the
  // last filled slot's coordinates.
  let lastCoords: Pos | null = null;
  for (let i = 0; i < stops.length; i++) {
    if (result[i]) {
      const c = getCoords(result[i]!);
      if (c) lastCoords = c;
      continue;
    }
    if (movable.length === 0) {
      // Fall back to remaining no-coord stops
      const next = noCoords.shift();
      if (next) result[i] = next.stop;
      continue;
    }
    if (!lastCoords) {
      // No anchor yet — pick first movable
      result[i] = movable.shift()!.stop;
      continue;
    }
    // Find closest movable to lastCoords
    let bestIdx = 0;
    let bestDist = haversineKm(lastCoords, movable[0].coords);
    for (let k = 1; k < movable.length; k++) {
      const d = haversineKm(lastCoords, movable[k].coords);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = k;
      }
    }
    const picked = movable.splice(bestIdx, 1)[0];
    result[i] = picked.stop;
    lastCoords = picked.coords;
  }

  // Sanity: fill any remaining slots
  let remaining = [...movable.map((m) => m.stop), ...noCoords.map((n) => n.stop)];
  for (let i = 0; i < stops.length; i++) {
    if (!result[i] && remaining.length > 0) result[i] = remaining.shift()!;
  }

  return result.filter((s): s is PlannedStop => s !== null);
}
