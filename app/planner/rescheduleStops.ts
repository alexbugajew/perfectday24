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
