import { classify } from "../features";
import { occasionBaseBonus } from "../occasions/base";
import {
  familyAgeBandPhaseBonus,
  familyAgeBandPhaseMismatchPenalty,
} from "../occasions/family";
import { getOccasionModule } from "../occasions/registry";
import type { SlotCandidatePolicy } from "./types";

export const occasionPolicy: SlotCandidatePolicy = {
  key: "occasion",
  evaluate(input) {
    const { context, candidate, slot } = input;
    const occasionModule = getOccasionModule(context.filters.occasion);
    const candidateCategory = classify(candidate);
    const phaseBonus =
      occasionModule.phaseFitBonus(slot.phase, candidate) +
      (context.filters.occasion === "family"
        ? familyAgeBandPhaseBonus(context.filters.familyAgeBand, slot.phase, candidate)
        : 0);
    const phaseMismatchPenalty =
      occasionModule.phaseMismatchPenalty(slot.phase, candidate) +
      (context.filters.occasion === "family"
        ? familyAgeBandPhaseMismatchPenalty(context.filters.familyAgeBand, slot.phase, candidate)
        : 0);
    const baseBonus = occasionBaseBonus(context.filters.occasion, candidate);
    const fitReasons = occasionModule.explainPhaseFit({
      phase: slot.phase,
      candidate,
    });
    const mismatchReasons = occasionModule.explainPhaseMismatch({
      phase: slot.phase,
      candidate,
    });

    return {
      key: "occasion",
      scoreDelta: phaseBonus - phaseMismatchPenalty + baseBonus,
      reasons: [...fitReasons, ...mismatchReasons],
      meta: {
        candidateCategory,
        phaseBonus,
        phaseMismatchPenalty,
        occasionBaseBonus: baseBonus,
        fitReasons,
        mismatchReasons,
      },
    };
  },
};
