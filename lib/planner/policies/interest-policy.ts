import { buildInterestKeywords, preferenceBoost } from "../interest";
import type { SlotCandidatePolicy } from "./types";

export const interestPolicy: SlotCandidatePolicy = {
  key: "interest",
  evaluate(input) {
    const { context, candidate } = input;
    const interestKeywords = buildInterestKeywords(context.mergedInterests);

    const rawBoost = preferenceBoost(
      candidate,
      interestKeywords,
      context.interestWeights
    );

    const routedBoost = Math.min(90, Math.round(rawBoost * 0.6));

    return {
      key: "interest",
      scoreDelta: routedBoost,
      meta: {
        rawBoost,
        routedBoost,
      },
    };
  },
};
