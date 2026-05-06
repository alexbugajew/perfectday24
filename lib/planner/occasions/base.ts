import { classify, hasAudience, hasOccasionTag, hasSubtype } from "../features";
import type { CandidateLocation, OccasionKey } from "../types";

export function occasionBaseBonus(
  occasion: OccasionKey,
  candidate: CandidateLocation
) {
  const category = classify(candidate);
  const taggedOccasion = hasOccasionTag(candidate, occasion);
  const taggedAudience = hasAudience(candidate, occasion);
  const typedBoost =
    occasion === "date" &&
    hasSubtype(
      candidate,
      "promenade",
      "viewpoint",
      "rooftop",
      "romantic_spot",
      "bowling",
      "minigolf",
      "climbing",
      "lasertag",
      "escape_room"
    )
      ? 10
      : occasion === "friends" &&
          hasSubtype(
            candidate,
            "workshop_pottery",
            "workshop_painting",
            "cocktail_workshop",
            "paintball",
            "gokart",
            "wakeboard",
            "climbing",
            "bowling",
            "minigolf",
            "lasertag",
            "nightclub",
            "disco"
          )
        ? 10
        : occasion === "family" &&
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
              "farm_experience"
            )
          ? 10
          : occasion === "party" &&
              hasSubtype(
                candidate,
                "cocktail_bar",
                "pub",
                "rooftop_bar",
                "nightclub",
                "disco",
                "live_music",
                "afterhour",
                "late_food"
              )
            ? 12
            : occasion === "tourism" &&
                hasSubtype(
                  candidate,
                  "landmark",
                  "historic_site",
                  "museum",
                  "gallery",
                  "viewpoint",
                  "old_town",
                  "monument",
                  "memorial",
                  "promenade"
                )
              ? 12
              : 0;

  const taxonomyBonus = (taggedOccasion ? 10 : 0) + (taggedAudience ? 6 : 0) + typedBoost;

  if (occasion === "date") {
    if (category === "cafe") return 10 + taxonomyBonus;
    if (category === "culture") return 14 + taxonomyBonus;
    if (category === "nightlife") return 12 + taxonomyBonus;
    if (category === "activity") return 6 + taxonomyBonus;
    return taxonomyBonus;
  }

  if (occasion === "friends") {
    if (category === "activity") return 14 + taxonomyBonus;
    if (category === "nightlife") return 12 + taxonomyBonus;
    if (category === "restaurant") return 8 + taxonomyBonus;
    return taxonomyBonus;
  }

  if (occasion === "family") {
    if (category === "activity") return 12 + taxonomyBonus;
    if (category === "culture") return 10 + taxonomyBonus;
    if (category === "cafe") return 8 + taxonomyBonus;
    return taxonomyBonus;
  }

  if (occasion === "party") {
    if (category === "nightlife") return 18 + taxonomyBonus;
    if (category === "restaurant") return 8 + taxonomyBonus;
    if (category === "event") return 10 + taxonomyBonus;
    return taxonomyBonus;
  }

  if (occasion === "tourism") {
    if (category === "culture") return 16 + taxonomyBonus;
    if (category === "activity") return 12 + taxonomyBonus;
    if (category === "cafe") return 6 + taxonomyBonus;
    if (category === "event") return 8 + taxonomyBonus;
    return taxonomyBonus;
  }

  return 0;
}
