import { classify } from "../features";
import { occasionBaseBonus } from "../occasions/base";
import {
  familyAgeBandHardReject,
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
    const familyAgeReject =
      context.filters.occasion === "family"
        ? familyAgeBandHardReject(context.filters.familyAgeBand, candidate, slot.phase)
        : { reject: false, reason: null as string | null };
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
      hardFail: familyAgeReject.reject,
      reasons: [...fitReasons, ...mismatchReasons, ...(familyAgeReject.reason ? [familyAgeReject.reason] : [])],
      meta: {
        candidateCategory,
        phaseBonus,
        phaseMismatchPenalty,
        familyAgeReject,
        occasionBaseBonus: baseBonus,
        fitReasons,
        mismatchReasons,
      },
    };
  },
};
