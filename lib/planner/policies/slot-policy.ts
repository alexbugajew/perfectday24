import { classify } from "../features";
import { slotCategoryMatch } from "../slots";
import type { SlotCandidatePolicy } from "./types";

export const slotPolicy: SlotCandidatePolicy = {
  key: "slot",
  evaluate(input) {
    const { candidate, slot, planMode } = input;

    const cat = classify(candidate);
    const strictMatch = slotCategoryMatch(slot.kind, candidate);
    let scoreDelta = 0;

    if (slot.kind === "breakfast") {
      scoreDelta = strictMatch ? 42 : cat === "cafe" ? 24 : cat === "restaurant" ? 8 : -12;
    } else if (slot.kind === "lunch") {
      scoreDelta = strictMatch ? 38 : cat === "restaurant" ? 24 : cat === "cafe" ? 10 : -10;
    } else if (slot.kind === "dinner") {
      scoreDelta = strictMatch ? 40 : cat === "restaurant" ? 26 : cat === "nightlife" ? 6 : -12;
    } else if (slot.kind === "activity") {
      scoreDelta =
        strictMatch
          ? 24
          : cat === "culture" || cat === "activity" || cat === "event"
          ? 14
          : cat === "nightlife" && planMode === "evening"
          ? 4
          : -8;
    } else if (slot.kind === "anything") {
      scoreDelta =
        planMode === "evening" && cat === "nightlife"
          ? 20
          : cat === "culture" || cat === "activity" || cat === "nightlife"
          ? 8
          : 0;
    }

    return {
      key: "slot",
      scoreDelta,
      meta: {
        strictMatch,
        candidateCategory: cat,
      },
    };
  },
};
