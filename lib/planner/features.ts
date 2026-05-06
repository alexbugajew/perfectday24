import type { LocationCategory, LocationRow, MealType } from "./types";

export function norm(s: string | null | undefined) {
  return (s ?? "").toLowerCase().trim();
}

function arrayFromUnknown(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => norm(String(entry))).filter(Boolean);
}

function scalarText(value: unknown) {
  if (typeof value === "string") return norm(value);
  return "";
}

export function getTags(loc: LocationRow) {
  return arrayFromUnknown(loc.tags);
}

export function getSubtypes(loc: LocationRow) {
  const values = [
    scalarText((loc as { subtype?: unknown }).subtype),
    ...arrayFromUnknown(loc.subtypes),
  ].filter(Boolean);
  return Array.from(new Set(values));
}

export function getAudiences(loc: LocationRow) {
  const values = [
    scalarText((loc as { audience?: unknown }).audience),
    ...arrayFromUnknown(loc.audiences),
    ...arrayFromUnknown((loc as { audience_tags?: unknown }).audience_tags),
  ].filter(Boolean);
  return Array.from(new Set(values));
}

export function getOccasions(loc: LocationRow) {
  const values = [
    scalarText((loc as { occasion?: unknown }).occasion),
    ...arrayFromUnknown(loc.occasions),
    ...arrayFromUnknown((loc as { occasion_tags?: unknown }).occasion_tags),
  ].filter(Boolean);
  return Array.from(new Set(values));
}

export function hasSubtype(loc: LocationRow, ...expected: string[]) {
  if (expected.length === 0) return false;
  const needles = expected.map((entry) => norm(entry)).filter(Boolean);
  const haystack = [
    ...getSubtypes(loc),
    ...getTags(loc),
    buildLocationSearchText(loc),
  ].filter(Boolean);
  return needles.some((needle) => haystack.some((item) => item.includes(needle)));
}

export function hasAudience(loc: LocationRow, ...expected: string[]) {
  if (expected.length === 0) return false;
  const needles = expected.map((entry) => norm(entry)).filter(Boolean);
  const haystack = [
    ...getAudiences(loc),
    ...getTags(loc),
    buildLocationSearchText(loc),
  ].filter(Boolean);
  return needles.some((needle) => haystack.some((item) => item.includes(needle)));
}

export function hasOccasionTag(loc: LocationRow, ...expected: string[]) {
  if (expected.length === 0) return false;
  const needles = expected.map((entry) => norm(entry)).filter(Boolean);
  const haystack = [
    ...getOccasions(loc),
    ...getTags(loc),
    buildLocationSearchText(loc),
  ].filter(Boolean);
  return needles.some((needle) => haystack.some((item) => item.includes(needle)));
}

export function buildLocationSearchText(loc: LocationRow) {
  return Array.from(
    new Set(
      [
        norm(loc.name),
        norm(loc.type),
        scalarText(loc.category ?? null),
        scalarText(loc.manual_category ?? null),
        scalarText(loc.meal ?? null),
        scalarText(loc.manual_meal ?? null),
        scalarText((loc as { quality_notes?: unknown }).quality_notes),
        scalarText((loc as { description?: unknown }).description),
        ...getTags(loc),
        ...getSubtypes(loc),
        ...getAudiences(loc),
        ...getOccasions(loc),
      ].filter(Boolean)
    )
  ).join(" ");
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function isFoodFirstType(type: string) {
  return (
    type === "restaurant" ||
    type === "fast_food" ||
    type === "food" ||
    type === "food_court"
  );
}

function isCafeFirstType(type: string) {
  return type === "cafe" || type === "ice_cream" || type === "internet_cafe";
}

function isHardNightlifeType(type: string) {
  return (
    type === "pub" ||
    type === "nightclub" ||
    type === "club" ||
    type === "disco" ||
    type === "biergarten"
  );
}

function isHardNightlifeText(text: string) {
  return hasAny(text, [
    "cocktail",
    "nightclub",
    "clubnacht",
    "afterhour",
    "after-party",
    "after party",
    "dancefloor",
    "dance club",
    "dj ",
    " dj",
    "rave",
    "techno",
    "tabledance",
    "stripclub",
    "shisha",
    "hookah",
    "pub",
    "kneipe",
  ]);
}

function isStrongRestaurantText(text: string) {
  return hasAny(text, [
    "restaurant",
    "ristorante",
    "trattoria",
    "osteria",
    "pizzeria",
    "pizza",
    "pasta",
    "sushi",
    "ramen",
    "izakaya",
    "pho",
    "bistro",
    "brasserie",
    "tapas",
    "steak",
    "grill",
    "kitchen",
    "kueche",
    "küche",
    "mittag",
    "mittagessen",
    "lunch",
    "dinner",
    "abendessen",
  ]);
}

function isStrongCafeText(text: string) {
  return hasAny(text, [
    "cafe",
    "café",
    "coffee",
    "kaffee",
    "brunch",
    "breakfast",
    "frühstück",
    "fruehstueck",
    "bakery",
    "bäck",
    "baeck",
    "patisserie",
    "espresso",
  ]);
}

export function normalizeDaytime(
  v: string | null | undefined
): "morning" | "midday" | "evening" | "night" | null {
  const x = norm(v);
  if (!x) return null;

  if (x === "afternoon") return "evening";
  if (x === "mittag") return "midday";
  if (x === "vormittag") return "morning";
  if (x === "abend") return "evening";
  if (x === "nacht") return "night";

  if (x === "morning" || x === "midday" || x === "evening" || x === "night") {
    return x;
  }

  return null;
}

export function resolveMeal(loc: LocationRow): MealType {
  const manual = (loc.manual_meal ?? null) as MealType;
  if (manual) return manual;

  const dbMeal = (loc.meal ?? null) as MealType;
  if (dbMeal) return dbMeal;

  const text = buildLocationSearchText(loc);

  if (
    text.includes("breakfast") ||
    text.includes("frühstück") ||
    text.includes("fruehstueck") ||
    text.includes("brunch")
  ) {
    return "breakfast";
  }

  if (
    text.includes("lunch") ||
    text.includes("mittag") ||
    text.includes("mittagessen")
  ) {
    return "lunch";
  }

  if (
    text.includes("dinner") ||
    text.includes("abendessen") ||
    text.includes("fine dining")
  ) {
    return "dinner";
  }

  return null;
}

export function classify(loc: LocationRow): LocationCategory {
  const manual = (loc.manual_category ?? null) as LocationCategory;
  if (manual) return manual;

  const t0 = norm(loc.type);
  const text = buildLocationSearchText(loc);
  const strongRestaurantText = isStrongRestaurantText(text);
  const strongCafeText = isStrongCafeText(text);
  const hardNightlifeType = isHardNightlifeType(t0);
  const hardNightlifeText = isHardNightlifeText(text);

  const dbCat = (loc.category ?? null) as LocationCategory;
  if (dbCat) {
    if (dbCat === "nightlife") {
      if (isFoodFirstType(t0) || (strongRestaurantText && !hardNightlifeType && !hardNightlifeText)) {
        return "restaurant";
      }

      if (isCafeFirstType(t0) || (strongCafeText && !hardNightlifeType && !hardNightlifeText)) {
        return "cafe";
      }
    }

    if (dbCat === "cafe" && strongRestaurantText && !strongCafeText) {
      return "restaurant";
    }

    return dbCat;
  }

  if (hasSubtype(loc, "cocktail_bar", "pub", "rooftop_bar", "nightclub", "disco", "live_music", "afterhour")) {
    return "nightlife";
  }

  if (hasSubtype(loc, "museum", "gallery", "landmark", "historic_site", "old_town", "monument", "memorial", "viewpoint")) {
    return "culture";
  }

  if (
    hasSubtype(
      loc,
      "promenade",
      "romantic_spot",
      "park",
      "botanical_garden",
      "bowling",
      "minigolf",
      "climbing",
      "lasertag",
      "escape_room",
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
      "workshop_pottery",
      "workshop_painting",
      "cocktail_workshop",
      "paintball",
      "gokart",
      "wakeboard"
    )
  ) {
    return "activity";
  }

  const typeMap: Record<string, Exclude<LocationCategory, null>> = {
    cafe: "cafe",
    restaurant: "restaurant",
    fast_food: "restaurant",
    food: "restaurant",
    ice_cream: "cafe",
    internet_cafe: "cafe",
    food_court: "restaurant",

    biergarten: "nightlife",
    bar: "nightlife",
    pub: "nightlife",
    nightclub: "nightlife",
    club: "nightlife",
    disco: "nightlife",

    museum: "culture",
    gallery: "culture",
    theatre: "culture",
    cinema: "culture",
    arts_centre: "culture",
    planetarium: "culture",
    library: "culture",
    aquarium: "culture",
    viewpoint: "culture",
    memorial: "culture",

    attraction: "activity",
    park: "activity",
    sports_centre: "activity",
    fitness_centre: "activity",
    bowling_alley: "activity",
    miniature_golf: "activity",
    trampoline_park: "activity",
    water_park: "activity",
    sauna: "activity",
    public_bath: "activity",
    dog_park: "activity",
    dojo: "activity",
    zoo: "activity",
    theme_park: "activity",
    amusement_arcade: "activity",
    swimming_pool: "activity",
    playground: "activity",
    thermal_bath: "activity",

    events_venue: "event",
    event: "event",
  };

  if (t0 && typeMap[t0]) return typeMap[t0];

  if (strongRestaurantText && !hardNightlifeType && !hardNightlifeText) {
    return "restaurant";
  }

  if (strongCafeText && !hardNightlifeType && !hardNightlifeText) {
    return "cafe";
  }

  const has = (...words: string[]) => words.some((w) => text.includes(w));

  if (
    has(
      "club",
      "disco",
      "nacht",
      "bar",
      "lounge",
      "pub",
      "cocktail",
      "party",
      "afterhour",
      "dj",
      "dancefloor"
    )
  ) {
    return "nightlife";
  }

  if (
    has(
      "restaurant",
      "dinner",
      "fine",
      "gourmet",
      "steak",
      "sushi",
      "pizzeria",
      "italien",
      "asi",
      "tapas",
      "brasserie",
      "bistro",
      "kitchen",
      "kueche",
      "küche",
      "mittag",
      "lunch",
      "abend"
    )
  ) {
    return "restaurant";
  }

  if (
    has(
      "cafe",
      "café",
      "coffee",
      "kaffee",
      "brunch",
      "breakfast",
      "frühstück",
      "fruehstueck",
      "bäck",
      "baeck",
      "bakery",
      "patisserie"
    )
  ) {
    return "cafe";
  }

  if (
    has(
      "museum",
      "galerie",
      "theater",
      "theatre",
      "kino",
      "cinema",
      "denkmal",
      "kirche",
      "church",
      "castle",
      "schloss",
      "aussicht",
      "viewpoint",
      "historic",
      "history",
      "old town",
      "altstadt",
      "aquarium",
      "memorial",
      "observatory",
      "plattform",
      "gallery",
      "planetarium",
      "bibliothek",
      "library"
    )
  ) {
    return "culture";
  }

  if (
    has(
      "park",
      "wander",
      "hike",
      "trail",
      "see",
      "lake",
      "boot",
      "zoo",
      "wildpark",
      "aquarium",
      "spielplatz",
      "playground",
      "therme",
      "thermal",
      "schwimmbad",
      "pool",
      "freizeitpark",
      "theme park",
      "water park",
      "klettern",
      "boulder",
      "bouldern",
      "sport",
      "bowling",
      "escape",
      "lasertag",
      "laser tag",
      "paintball",
      "gokart",
      "kart",
      "wakeboard",
      "töpfer",
      "toepfer",
      "pottery",
      "malen",
      "painting",
      "lego",
      "science center",
      "kindermuseum",
      "minigolf",
      "fitness",
      "gym",
      "spa",
      "sauna",
      "attraction",
      "tour"
    )
  ) {
    return "activity";
  }

  if (has("event", "konzert", "concert", "festival", "show", "ticket", "live")) {
    return "event";
  }

  return "other";
}

export function classifyActivitySubkind(loc: LocationRow):
  | "walk"
  | "museum"
  | "landmark"
  | "park"
  | "wellness"
  | "sport"
  | "family"
  | "workshop"
  | "water"
  | "nightclub"
  | "event"
  | "nightlife"
  | "food"
  | "generic" {
  const text = buildLocationSearchText(loc);
  const cat = classify(loc);

  if (hasSubtype(loc, "museum", "gallery", "children_museum", "science_center")) {
    return "museum";
  }

  if (hasSubtype(loc, "park", "botanical_garden", "promenade")) {
    return "park";
  }

  if (hasSubtype(loc, "promenade")) {
    return "walk";
  }

  if (hasSubtype(loc, "thermal_bath", "swimming_pool", "water_park")) {
    return "wellness";
  }

  if (hasSubtype(loc, "bowling", "minigolf", "climbing", "lasertag", "paintball", "gokart", "wakeboard", "escape_room")) {
    return "sport";
  }

  if (hasSubtype(loc, "workshop_pottery", "workshop_painting", "cocktail_workshop")) {
    return "workshop";
  }

  if (hasSubtype(loc, "swimming_pool", "water_park", "wakeboard")) {
    return "water";
  }

  if (hasSubtype(loc, "zoo", "wildpark", "aquarium", "playground", "children_museum", "science_center", "farm_experience")) {
    return "family";
  }

  if (hasSubtype(loc, "nightclub", "disco", "afterhour", "rooftop_bar", "cocktail_bar", "pub", "live_music")) {
    return "nightclub";
  }

  if (hasSubtype(loc, "landmark", "historic_site", "old_town", "monument", "memorial", "viewpoint")) {
    return "landmark";
  }

  if (cat === "event") return "event";
  if (cat === "nightlife") return "nightlife";
  if (cat === "restaurant" || cat === "cafe") return "food";

  if (
    text.includes("museum") ||
    text.includes("galerie") ||
    text.includes("gallery") ||
    text.includes("ausstellung") ||
    text.includes("theater") ||
    text.includes("theatre") ||
    text.includes("cinema") ||
    text.includes("kino")
  ) {
    return "museum";
  }

  if (
    text.includes("park") ||
    text.includes("garden") ||
    text.includes("garten") ||
    text.includes("lake") ||
    text.includes("see") ||
    text.includes("promenade") ||
    text.includes("ufer")
  ) {
    return "park";
  }

  if (
    text.includes("walk") ||
    text.includes("spazier") ||
    text.includes("wander") ||
    text.includes("trail") ||
    text.includes("hike")
  ) {
    return "walk";
  }

  if (
    text.includes("spa") ||
    text.includes("sauna") ||
    text.includes("wellness") ||
    text.includes("massage") ||
    text.includes("bath") ||
    text.includes("therme") ||
    text.includes("thermal")
  ) {
    return "wellness";
  }

  if (
    text.includes("sport") ||
    text.includes("fitness") ||
    text.includes("gym") ||
    text.includes("bowling") ||
    text.includes("climb") ||
    text.includes("klettern") ||
    text.includes("minigolf") ||
    text.includes("lasertag") ||
    text.includes("laser tag") ||
    text.includes("paintball") ||
    text.includes("kart") ||
    text.includes("gokart") ||
    text.includes("wakeboard")
  ) {
    return "sport";
  }

  if (
    text.includes("töpfer") ||
    text.includes("toepfer") ||
    text.includes("pottery") ||
    text.includes("malen") ||
    text.includes("painting") ||
    text.includes("workshop") ||
    text.includes("atelier") ||
    text.includes("cocktailkurs")
  ) {
    return "workshop";
  }

  if (
    text.includes("pool") ||
    text.includes("schwimmbad") ||
    text.includes("see") ||
    text.includes("lake") ||
    text.includes("beach") ||
    text.includes("strand") ||
    text.includes("wakeboard")
  ) {
    return "water";
  }

  if (
    text.includes("zoo") ||
    text.includes("aquarium") ||
    text.includes("spielplatz") ||
    text.includes("playground") ||
    text.includes("lego") ||
    text.includes("kindermuseum") ||
    text.includes("family") ||
    text.includes("kids") ||
    text.includes("kinder") ||
    text.includes("play")
  ) {
    return "family";
  }

  if (
    text.includes("club") ||
    text.includes("disco") ||
    text.includes("dance") ||
    text.includes("dj")
  ) {
    return "nightclub";
  }

  if (
    text.includes("monument") ||
    text.includes("landmark") ||
    text.includes("denkmal") ||
    text.includes("castle") ||
    text.includes("schloss") ||
    text.includes("viewpoint") ||
    text.includes("aussicht") ||
    text.includes("historic") ||
    text.includes("altstadt") ||
    text.includes("old town") ||
    text.includes("tower") ||
    text.includes("attraction")
  ) {
    return "landmark";
  }

  return "generic";
}

export function bucketForCategory(
  cat: LocationCategory
): "food" | "culture" | "activity" | "nightlife" | "other" {
  if (cat === "cafe" || cat === "restaurant") return "food";
  if (cat === "culture") return "culture";
  if (cat === "activity" || cat === "event") return "activity";
  if (cat === "nightlife") return "nightlife";
  return "other";
}
