import { ROUTE_BUFFER_FULLDAY_MIN, ROUTE_BUFFER_PARTIALDAY_MIN } from "../constants";
import { classify } from "../features";
import type {
  PlanMode,
  PlannedStop,
  PlanningContext,
  ScoredLocation,
  SlotKind,
} from "../types";

export function estimateDurationMin(loc: ScoredLocation) {
  if (typeof loc.duration_min === "number" && loc.duration_min > 0) {
    return Math.round(loc.duration_min);
  }

  const category = classify(loc);
  if (category === "cafe") return 40;
  if (category === "restaurant") return 75;
  if (category === "culture") return 90;
  if (category === "activity") return 75;
  if (category === "nightlife") return 75;
  if (category === "event") return 90;
  return 60;
}

export function isMealKind(slotKind: SlotKind) {
  return slotKind === "breakfast" || slotKind === "lunch" || slotKind === "dinner";
}

export function getRouteBufferMin(planMode: PlanMode) {
  return planMode === "fullday"
    ? ROUTE_BUFFER_FULLDAY_MIN
    : ROUTE_BUFFER_PARTIALDAY_MIN;
}

export function maxSegmentDistanceKm(
  context: PlanningContext,
  slotKind: SlotKind,
  hasPreviousStop: boolean
) {
  const routeProfile = context.filters.routeProfile;
  const occasion = context.filters.occasion;

  if (routeProfile === "foot") {
    const firstLegLimit =
      occasion === "family" || occasion === "date" || occasion === "party" ? 3.0 : 3.8;
    const nextLegLimit =
      occasion === "family" || occasion === "date" || occasion === "party" ? 2.2 : 3.0;
    const mealTightening = isMealKind(slotKind) ? 0.4 : 0;

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
    const mealTightening = isMealKind(slotKind) ? 0.8 : 0;

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

export function maxSegmentTravelMin(
  context: PlanningContext,
  slotKind: SlotKind,
  hasPreviousStop: boolean
) {
  const routeProfile = context.filters.routeProfile;
  const occasion = context.filters.occasion;

  if (routeProfile === "foot") {
    const firstLegLimit =
      occasion === "family" || occasion === "date" || occasion === "party" ? 38 : 45;
    const nextLegLimit =
      occasion === "family" || occasion === "date" || occasion === "party" ? 30 : 38;
    const mealTightening = isMealKind(slotKind) ? 5 : 0;

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
    const mealTightening = isMealKind(slotKind) ? 6 : 0;

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

function planStartMinutes(planMode: PlanMode, occasion?: string) {
  if (planMode === "morning") return 9 * 60;
  if (planMode === "midday") return 11 * 60;   // 11:00 — komfortabler Mittagsstart
  if (planMode === "evening") return 18 * 60;
  // fullday – occasion-aware default as a secondary safeguard
  if (occasion === "date" || occasion === "friends") return 17 * 60 + 30; // 17:30
  if (occasion === "family") return 11 * 60;                               // 11:00
  if (occasion === "party") return 20 * 60;                                // 20:00
  return 9 * 60 + 30; // tourism / default → 9:30
}

function parseIsoDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function withMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

function diffMinutes(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

function extractEventTiming(stop: PlannedStop) {
  const refs = stop.item?.source_refs as
    | {
        startsAt?: string | null;
        endsAt?: string | null;
        doorsAt?: string | null;
      }
    | undefined;

  return {
    startAt: parseIsoDate(refs?.startsAt),
    endAt: parseIsoDate(refs?.endsAt),
    doorsAt: parseIsoDate(refs?.doorsAt),
  };
}

function pushTimingWarning(stop: PlannedStop, warning: string) {
  stop.timingWarnings = [...(stop.timingWarnings ?? []), warning];
}

function annotateTimingWarnings(params: {
  stops: PlannedStop[];
  context: PlanningContext;
  planStart: Date;
}) {
  const { stops, context, planStart } = params;

  const lateCutoff =
    context.filters.occasion === "party"
      ? withMinutes(planStart, context.planDate ? 16 * 60 : 16 * 60)
      : context.filters.occasion === "tourism" || context.filters.occasion === "friends"
        ? withMinutes(planStart, 14 * 60)
        : withMinutes(planStart, 13 * 60);

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const start = parseIsoDate(stop.scheduledStartAt);
    const end = parseIsoDate(stop.scheduledEndAt);
    if (!start || !end) continue;

    if (start.getTime() < planStart.getTime() - 15 * 60000) {
      pushTimingWarning(stop, "Dieser Stop startet sehr früh und drückt den Tagesbeginn unplausibel nach vorn.");
    }

    if (end.getTime() > lateCutoff.getTime()) {
      pushTimingWarning(stop, "Dieser Stop endet relativ spät für den gewählten Modus.");
    }

    if (stop.timingLock === "event") {
      const previous = i > 0 ? stops[i - 1] : null;
      const previousEnd = previous ? parseIsoDate(previous.scheduledEndAt) : null;
      const travelMin = stop.travelMinFromPrev ?? 0;

      if (previousEnd) {
        const availableLead = diffMinutes(previousEnd, start) - travelMin;

        if (availableLead < 0) {
          pushTimingWarning(
            stop,
            "Der Vorlauf vor diesem Event kollidiert mit der Anfahrt. Der Ablauf ist zeitlich zu knapp."
          );
        } else if (availableLead < 15) {
          pushTimingWarning(
            stop,
            "Vor diesem Event bleibt nur ein sehr knapper Puffer fuer Weg, Einlass oder Verspätung."
          );
        } else if (availableLead < 30) {
          pushTimingWarning(
            stop,
            "Vor diesem Event ist nur wenig Puffer vorhanden."
          );
        }
      }
    }
  }

  return stops;
}

export function applyStopSchedule(params: {
  stops: PlannedStop[];
  context: PlanningContext;
  eventAnchorId?: string | null;
}) {
  const { stops, context, eventAnchorId = null } = params;
  if (stops.length === 0) return stops;

  const cloned = stops.map((stop) => ({ ...stop }));
  const dateSeed = context.planDate
    ? parseIsoDate(`${context.planDate}T00:00:00`)
    : new Date();
  if (!dateSeed) return cloned;

  const derivedPlanMode: PlanMode =
    context.preferredDaytimes.includes("night") && !context.preferredDaytimes.includes("morning")
      ? "evening"
      : context.preferredDaytimes.length === 1 && context.preferredDaytimes[0] === "midday"
        ? "midday"
        : context.preferredDaytimes.length === 1 && context.preferredDaytimes[0] === "morning"
          ? "morning"
          : context.preferredDaytimes.includes("morning")
            ? "fullday"
            : "evening";

  const dayBase = new Date(dateSeed.getFullYear(), dateSeed.getMonth(), dateSeed.getDate(), 0, 0, 0, 0);
  const requestedStartMin =
    typeof context.dayStartMin === "number" && Number.isFinite(context.dayStartMin)
      ? Math.max(0, Math.min(23 * 60 + 59, Math.round(context.dayStartMin)))
      : null;
  const planStart = withMinutes(
    dayBase,
    requestedStartMin ?? planStartMinutes(derivedPlanMode, context.occasion)
  );
  // Minimum sensible start — never earlier than 07:00 for non-event-anchored runs.
  const earliestStartMin = 7 * 60;
  const flooredPlanStart = new Date(
    Math.max(planStart.getTime(), dayBase.getTime() + earliestStartMin * 60000)
  );

  const anchorIndex =
    eventAnchorId != null
      ? cloned.findIndex((stop) => stop.item?.id === eventAnchorId)
      : -1;

  if (anchorIndex >= 0) {
    const anchor = cloned[anchorIndex];
    const timing = extractEventTiming(anchor);
    const duration = anchor.durationMin ?? anchor.item?.duration_min ?? 90;
    const eventStart = timing.startAt;
    const eventEnd = timing.endAt ?? (eventStart ? withMinutes(eventStart, duration) : null);
    const entryAt =
      timing.doorsAt ??
      (eventStart ? withMinutes(eventStart, context.experienceMode === "show" ? -20 : -10) : null);

    if (entryAt && eventEnd) {
      anchor.scheduledStartAt = entryAt.toISOString();
      anchor.scheduledEndAt = eventEnd.toISOString();
      anchor.timingLock = "event";

      // Backward pass — each pre-anchor stop is scheduled before the event.
      // Floor to 07:00 so we never produce impossible pre-dawn times.
      const dayFloor = new Date(dayBase.getTime() + earliestStartMin * 60000);
      let cursor = entryAt;
      for (let i = anchorIndex - 1; i >= 0; i--) {
        const stop = cloned[i];
        const durationMin = stop.durationMin ?? stop.item?.duration_min ?? 60;
        const travelMin = cloned[i + 1].travelMinFromPrev ?? 0;
        const endAt = withMinutes(cursor, -travelMin);
        // Apply floor: don't go earlier than 07:00
        const startAtRaw = withMinutes(endAt, -durationMin);
        const startAt = startAtRaw.getTime() < dayFloor.getTime() ? dayFloor : startAtRaw;
        const endAtFloored = startAt.getTime() < endAt.getTime() ? endAt : withMinutes(startAt, durationMin);
        stop.scheduledStartAt = startAt.toISOString();
        stop.scheduledEndAt = endAtFloored.toISOString();
        stop.timingLock = "none";
        stop.timingWarnings = [];
        cursor = startAt;
      }

      cursor = eventEnd;
      for (let i = anchorIndex + 1; i < cloned.length; i++) {
        const stop = cloned[i];
        const durationMin = stop.durationMin ?? stop.item?.duration_min ?? 60;
        const travelMin = stop.travelMinFromPrev ?? 0;
        const startAt = withMinutes(cursor, travelMin);
        const endAt = withMinutes(startAt, durationMin);
        stop.scheduledStartAt = startAt.toISOString();
        stop.scheduledEndAt = endAt.toISOString();
        stop.timingLock = "none";
        stop.timingWarnings = [];
        cursor = endAt;
      }

      anchor.timingWarnings = [];
      return annotateTimingWarnings({
        stops: cloned,
        context,
        planStart: flooredPlanStart,
      });
    }
  }

  let cursor = flooredPlanStart;
  for (let i = 0; i < cloned.length; i++) {
    const stop = cloned[i];
    const durationMin = stop.durationMin ?? stop.item?.duration_min ?? 60;
    const travelMin = stop.travelMinFromPrev ?? 0;
    const startAt = i === 0 ? cursor : withMinutes(cursor, travelMin);
    const endAt = withMinutes(startAt, durationMin);
    stop.scheduledStartAt = startAt.toISOString();
    stop.scheduledEndAt = endAt.toISOString();
    stop.timingLock = "none";
    stop.timingWarnings = [];
    cursor = endAt;
  }

  return annotateTimingWarnings({
    stops: cloned,
    context,
    planStart: flooredPlanStart,
  });
}
