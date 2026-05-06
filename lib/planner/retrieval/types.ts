import type {
  CandidateBuckets,
  LocationRow,
  PlanningContext,
  RetrievalResult,
} from "../types";

export type RetrievalWithBuckets = RetrievalResult & {
  buckets: CandidateBuckets;
};

export type RetrieveCandidatesParams = {
  locations: LocationRow[];
  context: PlanningContext;
  maxCandidates?: number;
  radiusExpansionSteps?: number[];
};
