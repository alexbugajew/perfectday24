import { classify, hasAudience, hasOccasionTag, hasSubtype } from "../features";
import {
  isFamilyAgeBandPoolCandidate,
  sortFamilyCandidatesForAgeBand,
} from "../occasions/family";
import {
  buildInterestKeywords,
  buildInterestKeywordsForGroups,
  preferenceBoost,
} from "../interest";
import { slotCategoryMatch } from "../slots";
import type {
  OccasionPhase,
  PlanMode,
  PlanningContext,
  ScoredLocation,
  SlotDefinition,
  SlotKind,
} from "../types";
import { isMealKind } from "./timing";

function isOfficialFlexEvent(candidate: ScoredLocation) {
  const refs =
    candidate.source_refs && typeof candidate.source_refs === "object"
      ? (candidate.source_refs as Record<string, unknown>)
      : null;
  return classify(candidate) === "event" && refs?.eventKind === "flex_event" && typeof refs?.source === "string";
}

function withInterestPreference(
  candidates: ScoredLocation[],
  context: PlanningContext,
  minBoost = 1
) {
  if (!context.mergedInterests.length) return candidates;
  const interestKeywords = buildInterestKeywords(context.mergedInterests);

  const matched = candidates.filter(
    (candidate) =>
      preferenceBoost(candidate, interestKeywords, context.interestWeights) >= minBoost
  );

  if (matched.length === 0) return candidates;

  if (matched.length >= 20) {
    const matchedIds = new Set(matched.map((candidate) => candidate.id));
    const remainder = candidates.filter((candidate) => !matchedIds.has(candidate.id));
    return [...matched, ...remainder].slice(0, Math.min(candidates.length, 40));
  }

  const matchedIds = new Set(matched.map((candidate) => candidate.id));
  const remainder = candidates.filter((candidate) => !matchedIds.has(candidate.id));

  return [...matched, ...remainder].slice(0, Math.min(candidates.length, 36));
}

function withEventExperiencePreference(
  candidates: ScoredLocation[],
  context: PlanningContext,
  kind: SlotKind
) {
  if (context.experienceMode === "classic") return candidates;

  const matching = candidates.filter((candidate) => {
    const category = classify(candidate);
    if (category !== "event") return false;

    if (context.experienceMode === "show") {
      return hasSubtype(candidate, "concert", "theater", "show", "performing_arts", "live_music");
    }

    if (context.experienceMode === "market_festival") {
      return hasSubtype(candidate, "market", "festival", "food_event", "seasonal_event", "fairground");
    }

    return kind === "activity" || kind === "sightseeing" || kind === "tour" || kind === "nightlife" || kind === "anything";
  });

  if (matching.length === 0) return candidates;

  const orderedMatching = [...matching].sort((a, b) => {
    const officialA = isOfficialFlexEvent(a) ? 1 : 0;
    const officialB = isOfficialFlexEvent(b) ? 1 : 0;
    if (officialB !== officialA) return officialB - officialA;
    return (b.totalScore ?? 0) - (a.totalScore ?? 0);
  });

  const matchingIds = new Set(orderedMatching.map((candidate) => candidate.id));
  const remainder = candidates.filter((candidate) => !matchingIds.has(candidate.id));
  const leadSize = context.eventStrictness === "required" ? Math.max(4, matching.length) : Math.max(3, Math.min(5, matching.length));
  return [...orderedMatching.slice(0, leadSize), ...remainder];
}

function foodPreferenceLockThreshold(kind: SlotKind) {
  if (kind === "breakfast") return 18;
  if (kind === "lunch" || kind === "dinner") return 14;
  return Number.POSITIVE_INFINITY;
}

function withLockedFoodPreference(
  candidates: ScoredLocation[],
  context: PlanningContext,
  kind: SlotKind
) {
  if (!context.mergedInterests.length || !isMealKind(kind)) {
    return candidates;
  }

  const threshold = foodPreferenceLockThreshold(kind);
  const interestKeywords = buildInterestKeywords(context.mergedInterests);
  const matched = candidates.filter((candidate) => {
    const category = classify(candidate);
    if (category !== "restaurant" && category !== "cafe") return false;
    return (
      preferenceBoost(candidate, interestKeywords, context.interestWeights) >= threshold
    );
  });

  if (matched.length === 0) {
    return withInterestPreference(candidates, context, kind === "breakfast" ? 4 : 2);
  }

  const matchedIds = new Set(matched.map((candidate) => candidate.id));
  const remainder = candidates.filter((candidate) => !matchedIds.has(candidate.id));
  const fallbackTailSize = matched.length >= 6 ? 2 : matched.length >= 3 ? 3 : 4;
  const cappedSize =
    kind === "breakfast"
      ? Math.min(candidates.length, Math.max(8, matched.length + fallbackTailSize))
      : Math.min(candidates.length, Math.max(10, matched.length + fallbackTailSize));

  return [...matched, ...remainder.slice(0, fallbackTailSize)].slice(0, cappedSize);
}

function getStrongFoodPreferencePool(
  candidates: ScoredLocation[],
  context: PlanningContext,
  kind: SlotKind
) {
  if (!context.mergedInterests.length || !isMealKind(kind)) return null;

  const threshold = kind === "dinner" ? 18 : kind === "lunch" ? 16 : 20;
  const interestKeywords = buildInterestKeywordsForGroups(context.mergedInterests, ["food"]);
  if (interestKeywords.length === 0) return null;

  const matched = candidates.filter((candidate) => {
    const category = classify(candidate);
    if (category !== "restaurant" && category !== "cafe") return false;
    return preferenceBoost(candidate, interestKeywords, context.interestWeights) >= threshold;
  });

  if (matched.length === 0) return null;

  const matchedIds = new Set(matched.map((candidate) => candidate.id));
  const remainder = candidates.filter((candidate) => !matchedIds.has(candidate.id));
  return [...matched, ...remainder.slice(0, 3)];
}

function activityPreferenceLockThreshold(kind: SlotKind) {
  if (kind === "activity") return 26;
  if (kind === "sightseeing" || kind === "walk") return 18;
  if (kind === "nightlife") return 18;
  if (kind === "anything") return 16;
  return Number.POSITIVE_INFINITY;
}

function withLockedInterestPreference(
  candidates: ScoredLocation[],
  context: PlanningContext,
  kind: SlotKind
) {
  if (!context.mergedInterests.length) return candidates;

  const groups =
    kind === "activity"
      ? (["activity", "ambience"] as const)
      : kind === "sightseeing" || kind === "walk"
        ? (["sightseeing", "ambience", "activity"] as const)
        : kind === "nightlife" || kind === "anything"
          ? (["nightlife", "ambience"] as const)
          : [];

  if (groups.length === 0) return candidates;

  const interestKeywords = buildInterestKeywordsForGroups(context.mergedInterests, [...groups]);
  if (interestKeywords.length === 0) return candidates;

  const threshold = activityPreferenceLockThreshold(kind);
  const matched = candidates.filter((candidate) => {
    const category = classify(candidate);

    if (kind === "nightlife" || kind === "anything") {
      if (category !== "nightlife" && category !== "event") return false;
    } else if (
      category !== "activity" &&
      category !== "culture" &&
      category !== "event"
    ) {
      return false;
    }

    return (
      preferenceBoost(candidate, interestKeywords, context.interestWeights) >= threshold
    );
  });

  if (matched.length === 0) {
    return withInterestPreference(candidates, context, 2);
  }

  const matchedIds = new Set(matched.map((candidate) => candidate.id));
  const remainder = candidates.filter((candidate) => !matchedIds.has(candidate.id));
  const fallbackTailSize = matched.length >= 4 ? 2 : 3;
  const cappedSize = Math.min(candidates.length, Math.max(8, matched.length + fallbackTailSize));
  return [...matched, ...remainder.slice(0, fallbackTailSize)].slice(0, cappedSize);
}

function isFamilyHeavyTourismCandidate(candidate: ScoredLocation) {
  return hasSubtype(
    candidate,
    "children_museum",
    "science_center",
    "playground",
    "farm_experience"
  );
}

function isTourismScenicCandidate(candidate: ScoredLocation) {
  return hasSubtype(
    candidate,
    "viewpoint",
    "promenade",
    "rooftop",
    "landmark",
    "historic_site",
    "old_town",
    "monument",
    "memorial"
  );
}

function isTourismEveningHighlightCandidate(candidate: ScoredLocation) {
  const category = classify(candidate);
  if (category === "nightlife" || category === "restaurant" || category === "cafe") {
    return false;
  }

  return (
    isTourismScenicCandidate(candidate) ||
    category === "activity" ||
    category === "culture" ||
    category === "event"
  );
}

function isTourismEveningOptionalCandidate(candidate: ScoredLocation) {
  const category = classify(candidate);
  if (category === "nightlife") return false;

  if (category === "activity" || category === "culture" || category === "event") {
    return true;
  }

  if ((category === "restaurant" || category === "cafe") && isTourismScenicCandidate(candidate)) {
    return true;
  }

  return false;
}

function isTourismRelaxedActivityCandidate(candidate: ScoredLocation) {
  const category = classify(candidate);
  if (isFamilyHeavyTourismCandidate(candidate)) return false;

  return (
    isTourismScenicCandidate(candidate) ||
    category === "culture" ||
    category === "activity" ||
    category === "event" ||
    hasSubtype(
      candidate,
      "promenade",
      "viewpoint",
      "park",
      "garden",
      "waterfront",
      "market",
      "festival",
      "historic_site",
      "memorial",
      "monument"
    )
  );
}

function isPartyWarmupCandidate(candidate: ScoredLocation) {
  return hasSubtype(candidate, "cocktail_bar", "pub", "rooftop_bar");
}

function isPartyPeakCandidate(candidate: ScoredLocation) {
  return (
    classify(candidate) === "event" ||
    hasSubtype(candidate, "nightclub", "disco", "live_music")
  );
}

function isPartyAfterCandidate(candidate: ScoredLocation) {
  return (
    hasSubtype(candidate, "afterhour", "late_food", "pub", "cocktail_bar") ||
    (classify(candidate) !== "nightlife" &&
      (classify(candidate) === "restaurant" || classify(candidate) === "cafe"))
  );
}

function isAfterShowNightlifeCandidate(candidate: ScoredLocation) {
  const category = classify(candidate);
  if (category === "event") return false;

  return (
    category === "nightlife" ||
    hasSubtype(candidate, "cocktail_bar", "pub", "rooftop_bar", "wine_bar", "late_food") ||
    ((category === "cafe" || category === "restaurant") &&
      hasSubtype(candidate, "cocktail_bar", "wine_bar", "rooftop", "terrace"))
  );
}

function isGentleAfterShowCandidate(candidate: ScoredLocation) {
  const category = classify(candidate);
  if (category === "event") return false;

  return (
    isAfterShowNightlifeCandidate(candidate) ||
    category === "cafe" ||
    category === "restaurant" ||
    category === "culture" ||
    category === "activity" ||
    hasSubtype(candidate, "promenade", "viewpoint", "park", "garden", "waterfront")
  );
}

export function getPoolForKind(
  candidates: ScoredLocation[],
  slot: SlotDefinition,
  mode: PlanMode,
  context: PlanningContext
) {
  const kind = slot.kind;
  const phase = slot.phase ?? null;
  const strict = withEventExperiencePreference(
    candidates.filter((candidate) => slotCategoryMatch(kind, candidate)),
    context,
    kind
  );

  if (kind === "breakfast") {
    const strictCafes = strict.filter((candidate) => classify(candidate) === "cafe");
    if (strictCafes.length > 0) {
      return withLockedFoodPreference(strictCafes, context, kind);
    }
    if (strict.length > 0) return withLockedFoodPreference(strict, context, kind);

    const cafes = candidates.filter((candidate) => classify(candidate) === "cafe");
    if (cafes.length > 0) return withLockedFoodPreference(cafes, context, kind);

    const foodish = candidates.filter((candidate) => {
      const category = classify(candidate);
      return category === "restaurant" || category === "cafe";
    });
    if (foodish.length > 0) return withLockedFoodPreference(foodish, context, kind);

    return candidates;
  }

  if (kind === "lunch" || kind === "dinner") {
    const strongFoodPool = getStrongFoodPreferencePool(candidates, context, kind);
    if (strongFoodPool && strongFoodPool.length > 0) {
      return withLockedFoodPreference(strongFoodPool, context, kind);
    }

    const strictRestaurants = strict.filter(
      (candidate) => classify(candidate) === "restaurant"
    );
    if (strictRestaurants.length > 0) {
      return withLockedFoodPreference(strictRestaurants, context, kind);
    }

    const restaurants = candidates.filter(
      (candidate) => classify(candidate) === "restaurant"
    );
    if (restaurants.length > 0) {
      return withLockedFoodPreference(restaurants, context, kind);
    }

    if (strict.length > 0) return withLockedFoodPreference(strict, context, kind);

    const cafes = candidates.filter((candidate) => classify(candidate) === "cafe");
    if (cafes.length > 0) return withLockedFoodPreference(cafes, context, kind);

    const foodish = candidates.filter((candidate) => {
      const category = classify(candidate);
      return category === "restaurant" || category === "cafe";
    });
    if (foodish.length > 0) return withLockedFoodPreference(foodish, context, kind);

    return candidates;
  }

  if (kind === "activity") {
    const actishBroad = candidates.filter((candidate) => {
      const category = classify(candidate);
      return category === "culture" || category === "activity" || category === "event";
    });

    if (context.filters.occasion === "tourism") {
      const tourismRelaxed = actishBroad.filter(isTourismRelaxedActivityCandidate);
      if (tourismRelaxed.length > 0) {
        return withLockedInterestPreference(tourismRelaxed, context, kind);
      }
    }

    if (context.filters.occasion === "date") {
      const dateInteractive = actishBroad.filter(
        (candidate) =>
          hasOccasionTag(candidate, "date") ||
          hasAudience(candidate, "date") ||
          hasSubtype(
            candidate,
            "bowling",
            "minigolf",
            "climbing",
            "lasertag",
            "escape_room",
            "cinema",
            "cocktail_workshop",
            "workshop_pottery",
            "workshop_painting",
            "promenade",
            "viewpoint",
            "rooftop",
            "rooftop_bar",
            "cocktail_bar"
          )
      );
      if (dateInteractive.length > 0) {
        return withLockedInterestPreference(dateInteractive, context, kind);
      }
    }

    if (context.filters.occasion === "friends") {
      const friendsInteractive = actishBroad.filter(
        (candidate) =>
          hasOccasionTag(candidate, "friends") ||
          hasAudience(candidate, "friends") ||
          hasSubtype(
            candidate,
            "bowling",
            "minigolf",
            "climbing",
            "lasertag",
            "escape_room",
            "cinema",
            "paintball",
            "gokart",
            "wakeboard",
            "workshop_pottery",
            "workshop_painting",
            "cocktail_workshop"
          )
      );
      if (friendsInteractive.length > 0) {
        return withLockedInterestPreference(friendsInteractive, context, kind);
      }
    }

    if (context.filters.occasion === "family") {
      const familyActivityPool = sortFamilyCandidatesForAgeBand(
        actishBroad,
        context.filters.familyAgeBand,
        "activity"
      );
      const familyFocused = familyActivityPool.filter(
        (candidate) =>
          isFamilyAgeBandPoolCandidate(
            context.filters.familyAgeBand,
            candidate,
            "activity"
          ) &&
          (
            hasOccasionTag(candidate, "family") ||
            hasAudience(candidate, "family") ||
            hasSubtype(
              candidate,
              "zoo",
              "wildpark",
              "aquarium",
              "playground",
              "children_museum",
              "science_center",
              "swimming_pool",
              "thermal_bath",
              "theme_park",
              "water_park",
              "farm_experience",
              "climbing"
            )
          )
      );
      if (familyFocused.length > 0) {
        return withLockedInterestPreference(familyFocused, context, kind);
      }

      const familyAgeMatched = familyActivityPool.filter((candidate) =>
        isFamilyAgeBandPoolCandidate(
          context.filters.familyAgeBand,
          candidate,
          "activity"
        )
      );
      if (familyAgeMatched.length > 0) {
        return withLockedInterestPreference(familyAgeMatched, context, kind);
      }
    }

    if (strict.length > 0) return withLockedInterestPreference(strict, context, kind);
    if (actishBroad.length > 0) return withLockedInterestPreference(actishBroad, context, kind);

    const nonFood = candidates.filter((candidate) => {
      const category = classify(candidate);
      return category !== "cafe" && category !== "restaurant";
    });
    if (nonFood.length > 0) return nonFood;

    return candidates;
  }

  if (kind === "sightseeing" && context.filters.occasion === "tourism") {
    const tourismStrict = strict.filter(
      (candidate) => !isFamilyHeavyTourismCandidate(candidate)
    );

    if (
      mode === "evening" &&
      (phase === "tour_relaxed" || phase === "tour_highlight" || phase === "tour_optional")
    ) {
      const scenicStrict = tourismStrict.filter(isTourismEveningHighlightCandidate);
      if (scenicStrict.length > 0) {
        return withLockedInterestPreference(scenicStrict, context, kind);
      }

      const scenicBroad = candidates.filter(
        (candidate) =>
          !isFamilyHeavyTourismCandidate(candidate) &&
          isTourismEveningHighlightCandidate(candidate)
      );
      if (scenicBroad.length > 0) {
        return withLockedInterestPreference(scenicBroad, context, kind);
      }

      const activityishStrict = tourismStrict.filter(isTourismEveningHighlightCandidate);
      if (activityishStrict.length > 0) return activityishStrict;

      const activityishBroad = candidates.filter(
        (candidate) =>
          !isFamilyHeavyTourismCandidate(candidate) &&
          isTourismEveningHighlightCandidate(candidate)
      );
      if (activityishBroad.length > 0) return activityishBroad;

      const nonNightlifeTourism = tourismStrict.filter((candidate) => {
        const category = classify(candidate);
        return category !== "nightlife" && category !== "restaurant" && category !== "cafe";
      });
      if (nonNightlifeTourism.length > 0) {
        return withLockedInterestPreference(nonNightlifeTourism, context, kind);
      }
    }

    if (tourismStrict.length > 0) return withLockedInterestPreference(tourismStrict, context, kind);

    const tourismBroad = candidates.filter(
      (candidate) => !isFamilyHeavyTourismCandidate(candidate)
    );
    if (tourismBroad.length > 0) {
      return withLockedInterestPreference(tourismBroad, context, kind);
    }
  }

  if (kind === "nightlife" && context.filters.occasion === "party") {
    if (phase === "party_warmup" || phase === "party_social") {
      if (phase === "party_warmup") {
        const nightlifeCount = candidates.filter((candidate) => {
          const category = classify(candidate);
          return category === "nightlife" || category === "event";
        }).length;

        if (nightlifeCount <= 2) {
          const socialStart = candidates.filter((candidate) => {
            const category = classify(candidate);
            return category === "restaurant" || category === "cafe";
          });
          if (socialStart.length > 0) return socialStart;
        }
      }

      const warmupStrict = strict.filter(isPartyWarmupCandidate);
      if (warmupStrict.length > 0) {
        return withLockedInterestPreference(warmupStrict, context, kind);
      }

      const warmupBroad = candidates.filter(
        (candidate) =>
          classify(candidate) === "nightlife" && isPartyWarmupCandidate(candidate)
      );
      if (warmupBroad.length > 0) {
        return withLockedInterestPreference(warmupBroad, context, kind);
      }
    }

    if (phase === "party_peak") {
      const peakStrict = [...strict].filter(isPartyPeakCandidate);
      if (peakStrict.length > 0) {
        return withLockedInterestPreference(peakStrict, context, kind);
      }

      const peakBroad = candidates.filter(isPartyPeakCandidate);
      if (peakBroad.length > 0) return withLockedInterestPreference(peakBroad, context, kind);

      const nightlifeBroad = candidates.filter(
        (candidate) => classify(candidate) === "nightlife"
      );
      if (nightlifeBroad.length > 0) {
        return withLockedInterestPreference(nightlifeBroad, context, kind);
      }
    }
  }

  if (
    kind === "nightlife" &&
    (context.experienceMode === "show" || context.experienceMode === "event_visit") &&
    (phase === "close" || phase === "social_peak")
  ) {
    const afterShowStrict = strict.filter(isAfterShowNightlifeCandidate);
    if (afterShowStrict.length > 0) {
      return withInterestPreference(afterShowStrict, context, 2);
    }

    const afterShowBroad = candidates.filter(isAfterShowNightlifeCandidate);
    if (afterShowBroad.length > 0) {
      return withInterestPreference(afterShowBroad, context, 2);
    }

    const gentleBroad = candidates.filter(isGentleAfterShowCandidate);
    if (gentleBroad.length > 0) {
      return withInterestPreference(gentleBroad, context, 1);
    }
  }

  if (kind === "anything") {
    if (context.filters.occasion === "party") {
      if (phase === "party_after" || phase === "party_food") {
        const latePool = candidates.filter((candidate) => isPartyAfterCandidate(candidate));
        if (latePool.length > 0) return withLockedInterestPreference(latePool, context, kind);
      }
    }

    if (context.filters.occasion === "tourism" && mode === "evening") {
      const scenicOptional = candidates.filter(
        (candidate) =>
          !isFamilyHeavyTourismCandidate(candidate) &&
          isTourismEveningOptionalCandidate(candidate)
      );
      if (scenicOptional.length > 0) {
        return withLockedInterestPreference(scenicOptional, context, kind);
      }
    }

    if (
      (context.experienceMode === "show" || context.experienceMode === "event_visit") &&
      (phase === "close" || phase === "social_peak")
    ) {
      const afterShowPool = candidates.filter(isGentleAfterShowCandidate);
      if (afterShowPool.length > 0) {
        return withInterestPreference(afterShowPool, context, 1);
      }
    }

    if (mode === "evening") {
      const nightlife = strict.filter((candidate) => classify(candidate) === "nightlife");
      if (nightlife.length > 0) return withLockedInterestPreference(nightlife, context, kind);
    }
    if (strict.length > 0) return withLockedInterestPreference(strict, context, kind);
    return candidates;
  }

  if ((kind === "walk" || kind === "sightseeing") && context.filters.occasion === "date") {
    const dateSafe = strict.filter(
      (candidate) =>
        !hasSubtype(
          candidate,
          "playground",
          "children_museum",
          "science_center",
          "zoo",
          "wildpark",
          "aquarium",
          "farm_experience"
        )
    );
    if (dateSafe.length > 0) return dateSafe;
  }

  if (strict.length > 0) return withLockedInterestPreference(strict, context, kind);
  return candidates;
}
