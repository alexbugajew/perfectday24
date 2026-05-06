import type { LocationCategory } from "../types";
import { bucketForCategory } from "../features";
import { classify } from "../features";
import type { SlotCandidatePolicy } from "./types";

type ConcreteCategory = Exclude<LocationCategory, null>;

function isConcreteCategory(cat: LocationCategory): cat is ConcreteCategory {
  return cat !== null;
}

function diversityPenalty(
  prevCat: ConcreteCategory | null,
  candCat: ConcreteCategory | null,
  slotKind: string
) {
  if (!prevCat || !candCat) return 0;

  if (prevCat === candCat) {
    const isMeal =
      slotKind === "breakfast" || slotKind === "lunch" || slotKind === "dinner";
    return isMeal ? 12 : 28;
  }

  return bucketForCategory(prevCat) === bucketForCategory(candCat) ? 10 : 0;
}

function overusePenalty(usedCats: ConcreteCategory[], candCat: ConcreteCategory | null) {
  if (!candCat) return 0;

  const usedBuckets = usedCats.map((cat) => bucketForCategory(cat));
  const candBucket = bucketForCategory(candCat);
  const count = usedBuckets.filter((bucket) => bucket === candBucket).length;

  if (candBucket === "food") {
    if (count >= 2) return 24;
    if (count === 1) return 10;
  }

  if (candBucket === "culture" || candBucket === "activity") {
    if (count >= 2) return 16;
    if (count === 1) return 6;
  }

  if (candBucket === "nightlife") {
    if (count >= 1) return 12;
  }

  return 0;
}

function foodOverweightPenalty(usedCats: ConcreteCategory[], candCat: ConcreteCategory | null) {
  if (candCat !== "restaurant" && candCat !== "cafe") return 0;

  const foodCount = usedCats.filter((cat) => cat === "restaurant" || cat === "cafe").length;

  if (foodCount >= 3) return 30;
  if (foodCount >= 2) return 16;
  if (foodCount >= 1) return 8;
  return 0;
}

export const diversityPolicy: SlotCandidatePolicy = {
  key: "diversity",
  evaluate(input) {
    const { previousStop, candidate, usedCategories, slot } = input;

    const candCat = classify(candidate);
    const prevCat = previousStop ? classify(previousStop) : null;
    const usedCategoryStrings = usedCategories.filter(isConcreteCategory);

    const penalty =
      diversityPenalty(prevCat, candCat, slot.kind) +
      overusePenalty(usedCategoryStrings, candCat) +
      foodOverweightPenalty(usedCategoryStrings, candCat);

    return {
      key: "diversity",
      scoreDelta: -penalty,
      meta: {
        previousCategory: prevCat,
        candidateCategory: candCat,
      },
    };
  },
};
