import { buildInterestKeywordsForGroups } from "@/lib/planner/interest";

export type PersonalizationLocation = {
  id: string;
  name: string;
  type: string;
  category?: string | null;
  meal?: string | null;
  lat?: number | null;
  lng?: number | null;
  reservation_url?: string | null;
  tags?: unknown;
  subtypes?: unknown;
  city_slug?: string | null;
};

export type PersonalizationKind =
  | "fixed"
  | "food_swap"
  | "activity_swap"
  | "nightlife_swap"
  | "ambience_swap";

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function asStringList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => normalize(item)).filter(Boolean)
    : [];
}

function buildSearchText(location: PersonalizationLocation) {
  return [
    location.name,
    location.type,
    location.category,
    location.meal,
    ...asStringList(location.tags),
    ...asStringList(location.subtypes),
  ]
    .map((value) => normalize(value))
    .filter(Boolean)
    .join(" ");
}

function stopSearchText(params: {
  title?: string | null;
  note?: string | null;
  location?: PersonalizationLocation | null;
}) {
  const { title, note, location } = params;
  return [title, note, location?.name, location?.type, location?.category, location?.meal]
    .map((value) => normalize(value))
    .filter(Boolean)
    .join(" ");
}

export function isFoodLikeStop(params: {
  title?: string | null;
  note?: string | null;
  location?: PersonalizationLocation | null;
}) {
  const { location } = params;
  const text = stopSearchText(params);

  const category = normalize(location?.category);
  const meal = normalize(location?.meal);
  const type = normalize(location?.type);
  const tags = asStringList(location?.tags);
  const subtypes = asStringList(location?.subtypes);

  if (["restaurant", "cafe", "nightlife"].includes(category)) return true;
  if (meal) return true;
  if (type.includes("restaurant") || type.includes("cafe") || type.includes("bar") || type.includes("brunch")) return true;
  if (tags.some((value) => ["restaurant", "cafe", "bar", "food", "brunch", "cocktail"].includes(value))) return true;
  if (subtypes.some((value) => value.includes("restaurant") || value.includes("cafe") || value.includes("bar"))) return true;

  return /(restaurant|essen|dinner|lunch|breakfast|brunch|cafe|coffee|bar|wein|wine|cocktail|sushi|pizza|burger|vegan)/.test(text);
}

function isActivityLikeStop(params: {
  title?: string | null;
  note?: string | null;
  location?: PersonalizationLocation | null;
}) {
  const { location } = params;
  const text = stopSearchText(params);
  const category = normalize(location?.category);
  const type = normalize(location?.type);
  const tags = asStringList(location?.tags);
  const subtypes = asStringList(location?.subtypes);

  if (category === "activity") return true;
  if (type.includes("museum") || type.includes("bowling") || type.includes("climbing") || type.includes("escape")) return true;
  if (subtypes.some((value) => ["bowling", "climbing", "boulder", "escape_room", "lasertag", "museum"].includes(value))) return true;
  if (tags.some((value) => ["activity", "playful", "museum", "culture", "gaming"].includes(value))) return true;

  return /(bowling|klettern|climbing|escape|lasertag|museum|science|aquarium|zoo|arcade|playful|workshop)/.test(text);
}

function isNightlifeLikeStop(params: {
  title?: string | null;
  note?: string | null;
  location?: PersonalizationLocation | null;
}) {
  const { location } = params;
  const text = stopSearchText(params);
  const category = normalize(location?.category);
  const type = normalize(location?.type);
  const tags = asStringList(location?.tags);
  const subtypes = asStringList(location?.subtypes);

  if (category === "nightlife" || category === "event") return true;
  if (type.includes("bar") || type.includes("club") || type.includes("lounge")) return true;
  if (subtypes.some((value) => ["cocktail_bar", "rooftop_bar", "pub", "nightclub", "disco", "live_music"].includes(value))) return true;
  if (tags.some((value) => ["nightlife", "bar", "club", "cocktail", "rooftop"].includes(value))) return true;

  return /(bar|club|cocktail|techno|pub|dj|wine bar|rooftop)/.test(text);
}

function isAmbienceLikeStop(params: {
  title?: string | null;
  note?: string | null;
  location?: PersonalizationLocation | null;
}) {
  const { location } = params;
  const text = stopSearchText(params);
  const category = normalize(location?.category);
  const type = normalize(location?.type);
  const tags = asStringList(location?.tags);
  const subtypes = asStringList(location?.subtypes);

  if (category === "outdoor" || category === "scenic") return true;
  if (type.includes("park") || type.includes("view") || type.includes("river")) return true;
  if (subtypes.some((value) => ["viewpoint", "park", "garden", "promenade", "riverwalk"].includes(value))) return true;
  if (tags.some((value) => ["outdoor", "park", "view", "walk", "rooftop"].includes(value))) return true;

  return /(park|walk|river|view|rooftop|promenade|garden|sunset|scenic)/.test(text);
}

export function inferPersonalizationKind(params: {
  title?: string | null;
  note?: string | null;
  location?: PersonalizationLocation | null;
}): PersonalizationKind {
  if (isFoodLikeStop(params)) return "food_swap";
  if (isActivityLikeStop(params)) return "activity_swap";
  if (isNightlifeLikeStop(params)) return "nightlife_swap";
  if (isAmbienceLikeStop(params)) return "ambience_swap";
  return "fixed";
}

function interestGroupsForKind(kind: PersonalizationKind) {
  if (kind === "food_swap") return ["food", "nightlife"] as const;
  if (kind === "activity_swap") return ["activity", "sightseeing"] as const;
  if (kind === "nightlife_swap") return ["nightlife", "ambience"] as const;
  if (kind === "ambience_swap") return ["ambience", "sightseeing"] as const;
  return [] as const;
}

function baseScoreForKind(candidate: PersonalizationLocation, kind: PersonalizationKind) {
  const category = normalize(candidate.category);
  const meal = normalize(candidate.meal);

  if (kind === "food_swap") {
    if (category === "restaurant") return 5;
    if (category === "cafe") return 4;
    if (category === "nightlife") return 3;
    if (meal) return 2;
  }

  if (kind === "activity_swap") {
    if (category === "activity" || category === "culture") return 5;
  }

  if (kind === "nightlife_swap") {
    if (category === "nightlife" || category === "event") return 5;
  }

  if (kind === "ambience_swap") {
    if (category === "outdoor" || category === "scenic" || category === "culture") return 4;
  }

  return 0;
}

export function buildSwapCandidates(params: {
  candidates: PersonalizationLocation[];
  interests: string[];
  currentLocationId?: string | null;
  kind: PersonalizationKind;
}) {
  const { candidates, interests, currentLocationId, kind } = params;
  if (kind === "fixed") return [];

  const groups = interestGroupsForKind(kind);
  const keywords = buildInterestKeywordsForGroups(interests, [...groups]);

  const ranked = candidates
    .filter((candidate) => candidate.id !== currentLocationId)
    .map((candidate) => {
      const text = buildSearchText(candidate);
      const tagValues = asStringList(candidate.tags);
      const subtypeValues = asStringList(candidate.subtypes);
      let score = baseScoreForKind(candidate, kind);

      for (const keyword of keywords) {
        if (!keyword) continue;
        if (subtypeValues.includes(keyword)) score += 8;
        else if (tagValues.includes(keyword)) score += 6;
        else if (text.includes(keyword)) score += 3;
      }

      return { candidate, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, 6).map((row) => row.candidate);
}
