import type {
  LocationCategory,
  PlanMode,
  PlanningContext,
  ScoredLocation,
  SlotDefinition,
} from "../types";

export type CandidateEvaluationContext = {
  context: PlanningContext;
  candidate: ScoredLocation;
  previousStop: ScoredLocation | null;
  usedCategories: LocationCategory[];
  usedIds: Set<string>;
  slot: SlotDefinition;
  slotIndex: number;
  planMode: PlanMode;
  remainingSlots: number;
  peakSlotIndex: number;
  peakCandidate: ScoredLocation | null;
  allCandidates: ScoredLocation[];
};

export type PolicyResult = {
  key: string;
  scoreDelta: number;
  hardFail?: boolean;
  reasons?: string[];
  meta?: Record<string, unknown>;
};

export interface SlotCandidatePolicy {
  key: string;
  evaluate(input: CandidateEvaluationContext): PolicyResult;
}
