import type {
  LocationRow,
  OccasionKey,
  OccasionPhase,
  PlanMode,
  PlanVariantGoal,
  ScoredLocation,
  SlotDefinition,
} from "../types";

export type OccasionSignals = Record<string, number>;

export type OccasionVariantMeta = {
  label: string;
  reason: string;
};

export type OccasionExplainParams = {
  phase: OccasionPhase | null | undefined;
  candidate: ScoredLocation;
};

export interface OccasionModule<
  TSignals extends OccasionSignals = OccasionSignals
> {
  key: OccasionKey;
  inferSignals(candidate: LocationRow): TSignals;
  isStrongCandidate(candidate: LocationRow): boolean;
  retrievalBoost(candidate: LocationRow): number;
  buildSlotTemplate(planMode: PlanMode): SlotDefinition[];
  phaseFitBonus(
    phase: OccasionPhase | null | undefined,
    candidate: ScoredLocation
  ): number;
  phaseMismatchPenalty(
    phase: OccasionPhase | null | undefined,
    candidate: ScoredLocation
  ): number;
  goalBoost(
    goal: PlanVariantGoal,
    candidate: ScoredLocation
  ): number;
  variantMeta(goal: PlanVariantGoal): OccasionVariantMeta;
  explainPhaseFit(params: OccasionExplainParams): string[];
  explainPhaseMismatch(params: OccasionExplainParams): string[];
}

export function createOccasionModule<
  TSignals extends OccasionSignals = OccasionSignals
>(module: OccasionModule<TSignals>): OccasionModule<TSignals> {
  return module;
}
