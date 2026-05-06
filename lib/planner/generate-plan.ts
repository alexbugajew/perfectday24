import { buildPlanningContext } from "./context";
import { MAX_RETRIEVAL_CANDIDATES_GENERATE_PLAN } from "./constants";
import { retrieveCandidates } from "./retrieval";
import { scoreCandidatesWithRelaxation } from "./scoring";
import { constructRoute } from "./route-construction";
import { summarizeRoute } from "./summary";
import type {
  LocationRow,
  PlannedStop,
  PlanningContext,
  PlannerRequest,
  RouteSummaryLite,
} from "./types";

export type GeneratePlanResult = {
  context: PlanningContext;
  results: ReturnType<typeof scoreCandidatesWithRelaxation>["results"];
  activeLevel: ReturnType<typeof scoreCandidatesWithRelaxation>["activeLevel"];
  effectiveRadiusKm: number;
  plannedStops: PlannedStop[];
  fallbackSummary: RouteSummaryLite;
};

export function generatePlan(params: {
  request: PlannerRequest;
  locations: LocationRow[];
  stopOffsets?: number[];
  variationSeed?: number;
}): GeneratePlanResult {
  const { request, locations, stopOffsets = [], variationSeed = 0 } = params;

  const context = buildPlanningContext(request);

  const retrieval = retrieveCandidates({
    locations,
    context,
    maxCandidates: MAX_RETRIEVAL_CANDIDATES_GENERATE_PLAN,
  });

  const scoring = scoreCandidatesWithRelaxation({
    context,
    candidates: retrieval.candidates,
  });

  const plannedStops = constructRoute({
    context,
    candidates: scoring.results,
    planMode: request.planMode,
    stopOffsets,
    variationSeed,
  });

  const fallbackSummary = summarizeRoute({
    stops: plannedStops,
    origin: {
      lat: context.origin.lat,
      lng: context.origin.lng,
    },
  });

  return {
    context,
    results: scoring.results,
    activeLevel: scoring.activeLevel,
    effectiveRadiusKm: retrieval.effectiveRadiusKm,
    plannedStops,
    fallbackSummary,
  };
}
