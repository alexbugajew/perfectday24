import { classify } from "../features";
import { occasionBaseBonus } from "../occasions/base";
import { getOccasionModule } from "../occasions/registry";
import type { SlotCandidatePolicy } from "./types";

export const occasionPolicy: SlotCandidatePolicy = {
  key: "occasion",
  evaluate(input) {
    const { context, candidate, slot } = input;
    const module = getOccasionModule(context.filters.occasion);
    const candidateCategory = classify(candidate);
    const phaseBonus = module.phaseFitBonus(slot.phase, candidate);
    const phaseMismatchPenalty = module.phaseMismatchPenalty(slot.phase, candidate);
    const baseBonus = occasionBaseBonus(context.filters.occasion, candidate);
    const fitReasons = module.explainPhaseFit({
      phase: slot.phase,
      candidate,
    });
    const mismatchReasons = module.explainPhaseMismatch({
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
