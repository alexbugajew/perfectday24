import { buildLocationSearchText, classify, getSubtypes, norm } from "./features";
import type { LocationRow, SlotKind } from "./types";

export type InterestGroup =
  | "food"
  | "activity"
  | "sightseeing"
  | "nightlife"
  | "ambience";

type InterestSpec = {
  group: InterestGroup;
  keywords: string[];
};

const INTEREST_CATALOG: Record<string, InterestSpec> = {
  italien: {
    group: "food",
    keywords: ["italien", "italian", "pizza", "pasta", "trattoria", "pizzeria", "ristorante"],
  },
  sushi: {
    group: "food",
    keywords: ["sushi", "japan", "japanese", "ramen", "izakaya"],
  },
  vegan: {
    group: "food",
    keywords: ["vegan", "veganuary", "plant", "plant based", "vegetar", "bio"],
  },
  steak: {
    group: "food",
    keywords: ["steak", "bbq", "barbecue", "grill"],
  },
  burger: {
    group: "food",
    keywords: ["burger", "smash burger", "cheeseburger"],
  },
  streetfood: {
    group: "food",
    keywords: ["streetfood", "street food", "food market", "food truck"],
  },
  "local food": {
    group: "food",
    keywords: ["local food", "regional", "berliner", "hausmannskost", "kiez", "market"],
  },
  dinner: {
    group: "food",
    keywords: ["dinner", "abendessen", "restaurant", "fine dining"],
  },
  coffee: {
    group: "food",
    keywords: ["coffee", "kaffee", "cafe", "cafeteria", "espresso", "specialty coffee"],
  },
  cafe: {
    group: "food",
    keywords: ["cafe", "coffee", "kaffee", "espresso", "brunch"],
  },
  wine: {
    group: "nightlife",
    keywords: ["wine", "wein", "wine bar", "vinothek"],
  },
  cocktails: {
    group: "nightlife",
    keywords: ["cocktails", "cocktail", "mixology", "cocktail bar"],
  },
  beer: {
    group: "nightlife",
    keywords: ["beer", "bier", "craft beer", "brewpub", "biergarten"],
  },
  bar: {
    group: "nightlife",
    keywords: ["bar", "pub", "cocktail", "lounge"],
  },
  techno: {
    group: "nightlife",
    keywords: ["techno", "dj", "rave", "club", "nightclub"],
  },
  club: {
    group: "nightlife",
    keywords: ["club", "nightclub", "disco", "dancefloor"],
  },
  jazz: {
    group: "nightlife",
    keywords: ["jazz", "live music", "music bar", "gig"],
  },
  "late food": {
    group: "nightlife",
    keywords: ["late food", "late-night food", "spati", "spati food", "doener", "pizza slice", "night snack"],
  },
  museum: {
    group: "sightseeing",
    keywords: ["museum", "galerie", "gallery", "ausstellung", "exhibition"],
  },
  landmark: {
    group: "sightseeing",
    keywords: ["landmark", "monument", "memorial", "historic site", "must see"],
  },
  viewpoint: {
    group: "sightseeing",
    keywords: ["viewpoint", "lookout", "panorama", "aussicht", "view"],
  },
  "old town": {
    group: "sightseeing",
    keywords: [
      "old town",
      "altstadt",
      "historic center",
      "historic centre",
      "historic",
      "history",
      "monument",
      "landmark",
      "museum",
    ],
  },
  river: {
    group: "sightseeing",
    keywords: [
      "river",
      "ufer",
      "riverside",
      "canal",
      "waterfront",
      "promenade",
      "boardwalk",
      "park",
      "viewpoint",
    ],
  },
  park: {
    group: "ambience",
    keywords: ["park", "garden", "botanical garden", "green space"],
  },
  walk: {
    group: "ambience",
    keywords: ["walk", "promenade", "river walk", "boardwalk", "stroll", "park"],
  },
  view: {
    group: "ambience",
    keywords: ["view", "viewpoint", "panorama", "aussicht", "rooftop"],
  },
  rooftop: {
    group: "ambience",
    keywords: ["rooftop", "sky bar", "dachterrasse", "rooftop bar"],
  },
  bowling: {
    group: "activity",
    keywords: ["bowling", "bowling alley"],
  },
  klettern: {
    group: "activity",
    keywords: ["klettern", "climbing", "boulder", "bouldering"],
  },
  arcade: {
    group: "activity",
    keywords: [
      "arcade",
      "games",
      "gaming",
      "retro games",
      "bowling",
      "lasertag",
      "laser tag",
      "billiard",
      "shuffleboard",
      "darts",
      "cinema",
    ],
  },
  "escape room": {
    group: "activity",
    keywords: ["escape room", "escape"],
  },
  lasertag: {
    group: "activity",
    keywords: ["lasertag", "laser tag"],
  },
  aquarium: {
    group: "activity",
    keywords: ["aquarium"],
  },
  science: {
    group: "activity",
    keywords: ["science", "science center", "science centre", "technikmuseum"],
  },
  zoo: {
    group: "activity",
    keywords: ["zoo", "tierpark", "wildpark"],
  },
  activity: {
    group: "activity",
    keywords: [
      "activity",
      "fun",
      "experience",
      "workshop",
      "bowling",
      "climbing",
      "escape",
      "lasertag",
    ],
  },
  theater: {
    group: "sightseeing",
    keywords: ["theater", "theatre", "buhne", "buehne", "stage"],
  },
  konzerte: {
    group: "nightlife",
    keywords: ["konzert", "concert", "live", "gig", "live music"],
  },
  sport: {
    group: "activity",
    keywords: ["sport", "klettern", "bowling", "fitness", "gym"],
  },
  natur: {
    group: "ambience",
    keywords: ["park", "see", "lake", "wander", "hike", "aussicht"],
  },
  stadt: {
    group: "sightseeing",
    keywords: ["city", "altstadt", "downtown", "shopping", "walk"],
  },
  playful: {
    group: "activity",
    keywords: [
      "playful",
      "spielerisch",
      "fun",
      "escape room",
      "escape",
      "lasertag",
      "laser tag",
      "bowling",
      "minigolf",
      "klettern",
      "climbing",
      "kino",
      "cinema",
      "kanu",
      "canoe",
      "kajak",
      "kayak",
    ],
  },
};

const STRICT_NIGHTLIFE_KEYWORDS = new Set([
  "club",
  "nightclub",
  "techno",
  "dj",
  "rave",
  "cocktail",
  "cocktails",
  "cocktail bar",
  "beer",
  "bier",
  "wine",
  "wein",
  "pub",
  "late food",
  "late-night food",
]);

function buildKeywordVariants(input: string) {
  const normalized = norm(input);
  const out = new Set<string>();
  if (!normalized) return out;

  out.add(normalized);
  normalized
    .split(/[\s,/+-]+/)
    .map((token) => norm(token))
    .filter((token) => token.length >= 3)
    .forEach((token) => out.add(token));

  return out;
}

function isNightlifeFriendlyLocation(loc: LocationRow) {
  const category = classify(loc);
  if (category === "nightlife" || category === "event") return true;
  return getSubtypes(loc).some((subtype) =>
    [
      "cocktail_bar",
      "rooftop_bar",
      "pub",
      "nightclub",
      "disco",
      "live_music",
      "afterhour",
    ].includes(subtype)
  );
}

export function buildInterestKeywords(interests: string[]) {
  const base = interests.map((x) => norm(x)).filter(Boolean);

  const out = new Set<string>();
  for (const item of base) {
    buildKeywordVariants(item).forEach((value) => out.add(value));

    const variants = INTEREST_CATALOG[item]?.keywords ?? [];
    variants.forEach((variant) => buildKeywordVariants(variant).forEach((value) => out.add(value)));
  }

  return Array.from(out);
}

export function getInterestCatalog() {
  return INTEREST_CATALOG;
}

export function getInterestGroup(interest: string): InterestGroup | null {
  return INTEREST_CATALOG[norm(interest)]?.group ?? null;
}

export function buildInterestKeywordsForGroups(
  interests: string[],
  groups: InterestGroup[]
) {
  const allowed = new Set(groups);
  const filtered = interests.filter((interest) => {
    const group = getInterestGroup(interest);
    return group != null && allowed.has(group);
  });
  return buildInterestKeywords(filtered);
}

export function interestGroupsForSlotKind(slotKind: SlotKind): InterestGroup[] {
  if (slotKind === "breakfast" || slotKind === "lunch" || slotKind === "dinner") {
    return ["food", "nightlife"];
  }

  if (slotKind === "activity") return ["activity"];
  if (slotKind === "sightseeing" || slotKind === "walk" || slotKind === "tour") {
    return ["sightseeing", "ambience", "activity"];
  }
  if (slotKind === "nightlife") return ["nightlife", "ambience"];
  if (slotKind === "anything") return ["activity", "sightseeing", "nightlife", "ambience"];
  return ["food", "activity", "sightseeing", "nightlife", "ambience"];
}

export function slotInterestBoost(params: {
  loc: LocationRow;
  interests: string[];
  weightMap?: Map<string, number>;
  slotKind: SlotKind;
}) {
  const { loc, interests, weightMap, slotKind } = params;
  const keywords = buildInterestKeywordsForGroups(interests, interestGroupsForSlotKind(slotKind));
  return preferenceBoost(loc, keywords, weightMap);
}

export function preferenceBoost(
  loc: LocationRow,
  interestKeywords: string[],
  weightMap?: Map<string, number>
) {
  if (interestKeywords.length === 0) return 0;

  const tags: string[] = Array.isArray(loc.tags)
    ? loc.tags.map((x: unknown) => norm(String(x))).filter(Boolean)
    : [];
  const text = buildLocationSearchText(loc);
  const subtypes = getSubtypes(loc);

  let tagScore = 0;
  let textScore = 0;
  let subtypeScore = 0;

  for (const keyword of interestKeywords) {
    if (!keyword) continue;
    const weight = weightMap?.get(keyword) ?? 1.0;

    if (tags.includes(keyword)) tagScore += 5 * weight;
    else if (subtypes.includes(keyword)) subtypeScore += 7 * weight;
    else if (text.includes(keyword)) {
      if (STRICT_NIGHTLIFE_KEYWORDS.has(keyword) && !isNightlifeFriendlyLocation(loc)) {
        continue;
      }
      textScore += 2 * weight;
    }
  }

  if (tagScore === 0 && textScore === 0 && subtypeScore === 0) return 0;

  const category = classify(loc);
  const categoryWeight =
    category === "restaurant"
      ? 16
      : category === "culture"
        ? 14
        : category === "event"
          ? 14
          : category === "activity"
            ? 13
            : category === "cafe"
              ? 10
              : category === "nightlife"
                ? 10
                : 9;

  const raw = (tagScore + subtypeScore + textScore) * categoryWeight;
  return Math.min(220, Math.round(raw));
}
