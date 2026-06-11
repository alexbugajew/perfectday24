import { classify } from "../features";
import { occasionBaseBonus } from "../occasions/base";
import {
  familyAgeBandHardReject,
  familyAgeBandPhaseBonus,
  familyAgeBandPhaseMismatchPenalty,
  familySlotHardReject,
} from "../occasions/family";
import { getOccasionModule } from "../occasions/registry";
import type { SlotCandidatePolicy } from "./types";

export const occasionPolicy: SlotCandidatePolicy = {
  key: "occasion",
  evaluate(input) {
    const { context, candidate, slot, allCandidates } = input;
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
    const familySlotReject =
      context.filters.occasion === "family"
        ? familySlotHardReject({
            ageBand: context.filters.familyAgeBand,
            candidate,
            slotKind: slot.kind,
            phase: slot.phase,
            allCandidates,
          })
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
      hardFail: familyAgeReject.reject || familySlotReject.reject,
      reasons: [
        ...fitReasons,
        ...mismatchReasons,
        ...(familyAgeReject.reason ? [familyAgeReject.reason] : []),
        ...(familySlotReject.reason ? [familySlotReject.reason] : []),
      ],
      meta: {
        candidateCategory,
        phaseBonus,
        phaseMismatchPenalty,
        familyAgeReject,
        familySlotReject,
        occasionBaseBonus: baseBonus,
        fitReasons,
        mismatchReasons,
      },
    };
  },
};
