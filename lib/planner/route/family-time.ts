// Familien-Zeitgrenzen im deterministischen Planner
// ============================================================================
// Die Grenzen selbst stehen in ../family-age.ts. Hier wird nur angewendet:
// 1. Event-Kandidaten, die nicht ins Familienfenster passen, fliegen vor der
//    Routenbildung raus (Anker, Peak, Pools und Fallbacks sehen sie nie).
// 2. Nach der Terminierung wird hart gekappt, was nach der Altersgrenze endet.

import { berlinInstant, type BerlinYmd } from "../berlin-time";
import { classify } from "../features";
import {
  familyAgeBandShortLabel,
  familyEarliestEventStartMin,
  familyEventFitsTimeLimits,
  familyTimeLimitsFor,
  formatClockMinutes,
  type FamilyTimeLimits,
} from "../family-age";
import type { PlannedStop, PlanningContext, ScoredLocation } from "../types";

/** Wie estimateDurationMin für Events — timing.ts importiert dieses Modul. */
const DEFAULT_EVENT_DURATION_MIN = 90;

export function familyLimitsForContext(context: PlanningContext): FamilyTimeLimits | null {
  return familyTimeLimitsFor({
    occasion: context.filters.occasion,
    familyAgeBand: context.filters.familyAgeBand,
  });
}

function parseIso(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** true = Kandidat ist kein Event oder passt zeitlich in den Familienplan. */
export function familyEventTimingFits(
  context: PlanningContext,
  candidate: ScoredLocation
): boolean {
  const limits = familyLimitsForContext(context);
  if (!limits) return true;
  if (classify(candidate) !== "event") return true;

  const refs =
    candidate.source_refs && typeof candidate.source_refs === "object"
      ? (candidate.source_refs as Record<string, unknown>)
      : null;

  return familyEventFitsTimeLimits({
    limits,
    startAt: parseIso(refs?.startsAt),
    endAt: parseIso(refs?.endsAt),
    durationMin:
      typeof candidate.duration_min === "number" && candidate.duration_min > 0
        ? Math.round(candidate.duration_min)
        : DEFAULT_EVENT_DURATION_MIN,
    earliestStartMin: familyEarliestEventStartMin(limits, context.planMode),
  });
}

/**
 * Entfernt Event-Kandidaten außerhalb des Familienfensters. Ein ausdrücklich
 * gewähltes Event bleibt drin — das ist eine bewusste Entscheidung der Eltern;
 * capStopsAtFamilyLimit markiert es dann mit einem Hinweis.
 */
export function filterCandidatesForFamilyTime(
  context: PlanningContext,
  candidates: ScoredLocation[]
): ScoredLocation[] {
  if (!familyLimitsForContext(context)) return candidates;
  return candidates.filter(
    (candidate) =>
      candidate.id === context.explicitEventId || familyEventTimingFits(context, candidate)
  );
}

/**
 * Ein Stop, der vor der Grenze beginnt und danach endet, wird gekürzt statt
 * gestrichen — sofern danach noch ein sinnvoller Besuch übrig bleibt
 * (Ausklang 18:15–19:00 statt gar keiner). Ein Zoo-Besuch auf 40 Minuten
 * gestutzt wäre dagegen kein Plan mehr.
 */
const MIN_TRIMMED_STOP_MIN = 30;
const MIN_TRIMMED_STOP_SHARE = 0.5;

/**
 * Kappt Stops, die nach der Altersgrenze enden. Event-gelockte Stops bleiben
 * (sie kommen nach dem Filter oben nur noch als bewusste Nutzerwahl hierher)
 * und bekommen einen sichtbaren Hinweis.
 */
export function capStopsAtFamilyLimit(params: {
  stops: PlannedStop[];
  context: PlanningContext;
  planYmd: BerlinYmd;
}): PlannedStop[] {
  const { stops, context, planYmd } = params;
  const limits = familyLimitsForContext(context);
  if (!limits || stops.length === 0) return stops;

  const limitAt = berlinInstant(planYmd, limits.latestEndMin).getTime();
  const limitLabel = formatClockMinutes(limits.latestEndMin);
  const endsTooLate = (stop: PlannedStop) => {
    const end = parseIso(stop.scheduledEndAt);
    return end != null && end.getTime() > limitAt;
  };

  const trimToLimit = (stop: PlannedStop): PlannedStop | null => {
    const start = parseIso(stop.scheduledStartAt);
    const end = parseIso(stop.scheduledEndAt);
    if (!start || !end || start.getTime() >= limitAt) return null;
    const originalMin = Math.round((end.getTime() - start.getTime()) / 60000);
    const trimmedMin = Math.floor((limitAt - start.getTime()) / 60000);
    if (trimmedMin < MIN_TRIMMED_STOP_MIN) return null;
    if (trimmedMin < originalMin * MIN_TRIMMED_STOP_SHARE) return null;
    return {
      ...stop,
      durationMin: trimmedMin,
      scheduledEndAt: new Date(limitAt).toISOString(),
    };
  };

  const kept = stops
    .map((stop) =>
      stop.timingLock !== "event" && endsTooLate(stop) ? trimToLimit(stop) : stop
    )
    .filter((stop): stop is PlannedStop => stop !== null)
    .map((stop) =>
      stop.timingLock === "event" && endsTooLate(stop)
        ? {
            ...stop,
            timingWarnings: [
              ...(stop.timingWarnings ?? []),
              `Endet nach ${limitLabel} Uhr – für Kinder ${familyAgeBandShortLabel(
                context.filters.familyAgeBand
              )} eigentlich zu spät.`,
            ],
          }
        : stop
    );

  if (kept.length > 0) return kept;

  // Startet schon der erste Stop zu spät (z. B. per URL gesetzte Startzeit),
  // lieber einen markierten Stop zeigen als einen leeren Plan.
  const [first] = stops;
  return [
    {
      ...first,
      timingWarnings: [
        ...(first.timingWarnings ?? []),
        `Liegt nach ${limitLabel} Uhr – für einen Familientag zu spät.`,
      ],
    },
  ];
}
