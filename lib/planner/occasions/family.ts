import { buildLocationSearchText, classify, hasAudience, hasOccasionTag, hasSubtype } from "../features";
import type {
  FamilyAgeBand,
  LocationRow,
  OccasionPhase,
  PlanMode,
  PlanVariantGoal,
  ScoredLocation,
  SlotDefinition,
} from "../types";
import {
  DEFAULT_FAMILY_AGE_BAND,
  resolveFamilyAgeBand,
} from "../family-age";
import {
  capSignals,
  dedupeReasons,
  hasOpeningInfo,
  hasRatingVolume,
  hasStrongRating,
  scoreTextSupport,
} from "./helpers";
import type { OccasionModule } from "./types";

export type FamilySignals = {
  kidsFun: number;
  parentEase: number;
  logistics: number;
  flexibility: number;
  safety: number;
  movement: number;
  learning: number;
  wow: number;
  foodEase: number;
  freePlay: number;
  indoor: number;
};

export function inferFamilySignals(loc: LocationRow): FamilySignals {
  const cat = classify(loc);
  const text = buildLocationSearchText(loc);
  const structuredFamily =
    Boolean(loc.family_friendly) ||
    hasOccasionTag(loc, "family") ||
    hasAudience(loc, "family");
  const structuredBigFamily = hasSubtype(
    loc,
    "zoo",
    "wildpark",
    "aquarium",
    "theme_park",
    "water_park",
    "farm_experience"
  );
  const structuredPlay = hasSubtype(loc, "playground");
  const structuredLearning = hasSubtype(loc, "children_museum", "science_center");
  const structuredWater = hasSubtype(loc, "swimming_pool", "thermal_bath");
  const structuredClimb = hasSubtype(loc, "climbing");

  let kidsFun = 0;
  let parentEase = 0;
  let logistics = 0;
  let flexibility = 0;
  let safety = 0;
  let movement = 0;
  let learning = 0;
  let wow = 0;
  let foodEase = 0;
  let freePlay = 0;
  let indoor = 0;

  if (cat === "activity") {
    kidsFun += 3;
    movement += 3;
    flexibility += 1;
  }

  if (cat === "culture") {
    learning += 3;
    parentEase += 1;
    indoor += 2;
  }

  if (cat === "restaurant" || cat === "cafe") {
    parentEase += 2;
    logistics += 2;
    foodEase += 4;
    safety += 1;
  }

  if (cat === "event") {
    kidsFun += 2;
    wow += 3;
  }

  if (structuredFamily) {
    kidsFun += 4;
    parentEase += 4;
    safety += 4;
    logistics += 2;
  }

  if (structuredBigFamily) {
    kidsFun += 6;
    wow += 4;
  }

  if (structuredPlay) {
    freePlay += 7;
    flexibility += 3;
    movement += 4;
  }

  if (structuredLearning) {
    learning += 6;
    indoor += 4;
  }

  if (structuredWater) {
    wow += 3;
    movement += 3;
    indoor += 3;
  }

  if (structuredClimb) {
    kidsFun += 3;
    movement += 5;
    wow += 2;
  }

  if (hasOpeningInfo(loc)) {
    logistics += 1;
    parentEase += 1;
  }

  if (hasStrongRating(loc) && hasRatingVolume(loc, 15)) {
    safety += 1;
    wow += 1;
  }

  kidsFun += scoreTextSupport(
    text,
    ["zoo", "wildpark", "aquarium", "spielplatz", "lego", "museum", "science", "planetarium", "bauernhof", "park", "schwimmbad", "therme", "freizeitpark", "kindermuseum"],
    2,
    structuredBigFamily || structuredPlay || structuredLearning || structuredWater
  );
  parentEase += scoreTextSupport(
    text,
    ["picknick", "cafe", "restaurant", "eis", "snack", "spielbereich"],
    1,
    structuredFamily || cat === "restaurant" || cat === "cafe"
  );
  logistics += scoreTextSupport(
    text,
    ["park", "spielplatz", "zoo", "cafe", "picknick", "indoor", "museum", "aquarium", "kindermuseum", "schwimmbad"],
    1,
    structuredFamily || structuredBigFamily || structuredPlay || structuredLearning
  );
  flexibility += scoreTextSupport(
    text,
    ["park", "spielplatz", "picknick", "wiese", "wasser", "indoor"],
    1,
    structuredPlay
  );
  safety += scoreTextSupport(
    text,
    ["famil", "kinder", "zoo", "museum", "science", "planetarium", "cafe", "aquarium", "spielplatz", "kindermuseum"],
    1,
    structuredFamily || structuredBigFamily || structuredLearning || structuredPlay
  );
  movement += scoreTextSupport(
    text,
    ["spielplatz", "park", "wald", "wander", "see", "strand", "wasser", "zoo"],
    2,
    structuredPlay || structuredBigFamily || structuredWater || structuredClimb
  );
  learning += scoreTextSupport(
    text,
    ["museum", "science", "aquarium", "planetarium", "technik", "tierpark", "kindermuseum"],
    2,
    structuredLearning || structuredBigFamily
  );
  wow += scoreTextSupport(
    text,
    ["futter", "aquarium", "freizeitpark", "wasser", "event", "festival", "zirkus", "therme", "wildpark"],
    2,
    structuredBigFamily || structuredWater
  );
  foodEase += scoreTextSupport(
    text,
    ["restaurant", "cafe", "eis", "snack", "picknick", "streetfood"],
    2,
    cat === "restaurant" || cat === "cafe"
  );
  freePlay += scoreTextSupport(
    text,
    ["spielplatz", "wiese", "wasser", "indoor", "play", "park", "strand", "pool"],
    2,
    structuredPlay || structuredWater
  );
  indoor += scoreTextSupport(
    text,
    ["indoor", "museum", "science", "aquarium", "planetarium", "lego", "kindermuseum", "therme"],
    2,
    structuredLearning || structuredBigFamily || structuredWater
  );

  return capSignals(
    {
      kidsFun,
      parentEase,
      logistics,
      flexibility,
      safety,
      movement,
      learning,
      wow,
      foodEase,
      freePlay,
      indoor,
    },
    {
      kidsFun: 12,
      parentEase: 10,
      logistics: 10,
      flexibility: 10,
      safety: 10,
      movement: 10,
      learning: 10,
      wow: 10,
      foodEase: 10,
      freePlay: 10,
      indoor: 8,
    }
  );
}

function normalizedFamilyAgeBand(ageBand: FamilyAgeBand | null | undefined) {
  return resolveFamilyAgeBand(ageBand) ?? DEFAULT_FAMILY_AGE_BAND;
}

function familyAgeMarkers(loc: LocationRow) {
  const category = classify(loc);
  const text = buildLocationSearchText(loc);

  const toddlerFriendly =
    hasSubtype(loc, "playground", "farm_experience", "zoo", "wildpark", "water_park") ||
    /(spielplatz|abenteuerspielplatz|streichelzoo|bauernhof|karussell|indoor playground|soft play|wasserpark)/i.test(text);
  const interactiveKids =
    hasSubtype(loc, "children_museum", "science_center", "aquarium", "theme_park", "swimming_pool", "climbing") ||
    /(kindermuseum|minigolf|mini golf|trampolin|trampoline|aquarium|science|technik|planetarium)/i.test(text);
  const challengePreteen =
    hasSubtype(loc, "climbing", "science_center", "swimming_pool") ||
    /(escape|escape room|klettern|bould|trampolin|trampoline|arcade|gaming|lasertag|bowling|skate|science|kino|cinema)/i.test(text);
  const teenSocial =
    category === "event" ||
    /(shopping|streetfood|food hall|bubble tea|arcade|gaming|kino|cinema|bowling|viewpoint|rooftop|workshop|concert|festival|market|hangout)/i.test(text);
  const tooYoung =
    category === "nightlife" ||
    /(nightclub|club|cocktail|bar hopping|late night)/i.test(text);
  const tooChildish =
    /(spielplatz|streichelzoo|karussell|indoor playground|soft play|kindergeburtstag)/i.test(text);
  const adultCultureOnly =
    category === "culture" &&
    !hasSubtype(loc, "children_museum", "science_center", "aquarium") &&
    !/(interaktiv|interactive|technik|science|planetarium|family|familie|kinder)/i.test(text);

  return {
    toddlerFriendly,
    interactiveKids,
    challengePreteen,
    teenSocial,
    tooYoung,
    tooChildish,
    adultCultureOnly,
  };
}

export function familyAgeBandBoost(
  ageBand: FamilyAgeBand | null | undefined,
  candidate: LocationRow
) {
  const band = normalizedFamilyAgeBand(ageBand);
  const signals = inferFamilySignals(candidate);
  const markers = familyAgeMarkers(candidate);

  if (band === "0_6") {
    let score =
      signals.safety * 7 +
      signals.logistics * 7 +
      signals.freePlay * 8 +
      signals.parentEase * 6 +
      signals.foodEase * 5 +
      signals.movement * 4;
    if (markers.toddlerFriendly) score += 48;
    if (markers.interactiveKids) score += 14;
    if (markers.challengePreteen) score -= 18;
    if (markers.tooYoung) score -= 90;
    if (markers.adultCultureOnly) score -= 34;
    return score;
  }

  if (band === "4_10") {
    let score =
      signals.kidsFun * 7 +
      signals.movement * 6 +
      signals.learning * 6 +
      signals.freePlay * 5 +
      signals.wow * 4 +
      signals.foodEase * 3;
    if (markers.toddlerFriendly) score += 18;
    if (markers.interactiveKids) score += 34;
    if (markers.challengePreteen) score += 12;
    if (markers.tooYoung) score -= 80;
    return score;
  }

  if (band === "9_14") {
    let score =
      signals.kidsFun * 5 +
      signals.movement * 7 +
      signals.learning * 6 +
      signals.wow * 5 +
      signals.flexibility * 3;
    if (markers.interactiveKids) score += 16;
    if (markers.challengePreteen) score += 42;
    if (markers.teenSocial) score += 16;
    if (markers.toddlerFriendly) score -= 18;
    if (markers.tooChildish) score -= 30;
    if (markers.tooYoung) score -= 72;
    return score;
  }

  let score =
    signals.wow * 6 +
    signals.movement * 5 +
    signals.learning * 4 +
    signals.flexibility * 4 +
    signals.foodEase * 3;
  if (markers.challengePreteen) score += 24;
  if (markers.teenSocial) score += 42;
  if (markers.toddlerFriendly) score -= 34;
  if (markers.tooChildish) score -= 44;
  if (markers.tooYoung) score -= 68;
  return score;
}

export function familyAgeBandPhaseBonus(
  ageBand: FamilyAgeBand | null | undefined,
  phase: OccasionPhase | null | undefined,
  candidate: ScoredLocation
) {
  const band = normalizedFamilyAgeBand(ageBand);
  const signals = inferFamilySignals(candidate);
  const markers = familyAgeMarkers(candidate);

  if (band === "0_6") {
    if (phase === "arrival") return signals.logistics * 6 + signals.parentEase * 5 + (markers.toddlerFriendly ? 10 : 0);
    if (phase === "main_activity") return signals.freePlay * 6 + signals.kidsFun * 5 + (markers.toddlerFriendly ? 18 : 0);
    if (phase === "pause") return signals.foodEase * 5 + signals.parentEase * 4;
    if (phase === "light_activity") return signals.freePlay * 6 + signals.flexibility * 4;
    if (phase === "wind_down") return signals.parentEase * 5 + signals.safety * 4;
    return 0;
  }

  if (band === "4_10") {
    if (phase === "main_activity") return signals.kidsFun * 5 + signals.learning * 4 + signals.movement * 4 + (markers.interactiveKids ? 12 : 0);
    if (phase === "light_activity") return signals.freePlay * 4 + signals.flexibility * 4;
    return 0;
  }

  if (band === "9_14") {
    if (phase === "main_activity") return signals.movement * 5 + signals.learning * 4 + (markers.challengePreteen ? 16 : 0);
    if (phase === "light_activity") return signals.flexibility * 4 + (markers.teenSocial ? 8 : 0);
    return 0;
  }

  if (phase === "main_activity") return signals.wow * 5 + signals.movement * 4 + (markers.teenSocial ? 14 : 0);
  if (phase === "pause") return signals.foodEase * 4 + (markers.teenSocial ? 6 : 0);
  if (phase === "light_activity") return signals.flexibility * 4 + (markers.teenSocial ? 8 : 0);
  return 0;
}

export function familyAgeBandPhaseMismatchPenalty(
  ageBand: FamilyAgeBand | null | undefined,
  phase: OccasionPhase | null | undefined,
  candidate: ScoredLocation
) {
  const band = normalizedFamilyAgeBand(ageBand);
  const markers = familyAgeMarkers(candidate);

  if (markers.tooYoung) return 26;
  if (band === "0_6" && markers.adultCultureOnly) return 24;
  if ((band === "9_14" || band === "12_16") && markers.tooChildish) return 20;
  if (phase === "main_activity" && band === "12_16" && markers.toddlerFriendly) return 18;
  return 0;
}

export function familyAgeBandGoalBoost(
  ageBand: FamilyAgeBand | null | undefined,
  goal: PlanVariantGoal,
  candidate: ScoredLocation
) {
  const band = normalizedFamilyAgeBand(ageBand);
  const base = familyAgeBandBoost(band, candidate);

  if (goal === "shortest_route" && band === "0_6") return base + inferFamilySignals(candidate).logistics * 12;
  if (goal === "more_diverse" && band === "4_10") return base + inferFamilySignals(candidate).learning * 8 + inferFamilySignals(candidate).movement * 6;
  if (goal === "more_diverse" && band === "9_14") return base + inferFamilySignals(candidate).movement * 8 + inferFamilySignals(candidate).wow * 5;
  if (goal === "premium" && band === "12_16") return base + inferFamilySignals(candidate).wow * 9;
  return base;
}

export function buildFamilySlotTemplate(
  planMode: PlanMode,
  ageBand?: FamilyAgeBand | null
): SlotDefinition[] {
  const band = normalizedFamilyAgeBand(ageBand);
  if (planMode === "morning") {
    return [
      {
        index: 0,
        kind: "breakfast",
        label: "Stressfreier Start",
        hint: "Snack / Cafe / lockeres Ankommen",
        phase: "arrival",
        phaseGoal: "Ohne Stress starten und Energie sammeln",
      },
      {
        index: 1,
        kind: "activity",
        label: "Hauptaktivität",
        hint:
          band === "12_16"
            ? "Challenge, Szene-Spot oder aktiver Start"
            : band === "9_14"
              ? "Interaktives Highlight mit Bewegung oder Challenge"
              : "Kinderfreundliches Highlight mit Bewegung oder Entdecken",
        phase: "main_activity",
        phaseGoal:
          band === "12_16"
            ? "Früh mit einem eigenständigen, spannenden Programmpunkt starten"
            : "Den Höhepunkt früh legen, solange die Energie hoch ist",
      },
    ];
  }

  if (planMode === "midday") {
    return [
      {
        index: 0,
        kind: "activity",
        label: "Highlight",
        hint:
          band === "0_6"
            ? "Zoo, Wasser, Indoor-Spiel oder Bauernhof"
            : band === "12_16"
              ? "Arcade, Kino, Klettern, Spot oder Szene-Ort"
              : band === "9_14"
                ? "Science, Challenge, Sport oder interaktive Aktivität"
                : "Zoo, Museum, Indoor oder Bewegung",
        phase: "main_activity",
        phaseGoal: "Spaß und Aufmerksamkeit in die stärkste Tagesphase legen",
      },
      {
        index: 1,
        kind: "lunch",
        label: "Pause",
        hint: "Kinderfreundliches Essen oder Snack",
        phase: "pause",
        phaseGoal: "Rechtzeitig essen, bevor Stress entsteht",
      },
      {
        index: 2,
        kind: "walk",
        label: band === "12_16" ? "Freier Block" : "Freies Spielen",
        hint:
          band === "12_16"
            ? "Chillen, kurzer Spot-Wechsel oder flexibler Abschluss"
            : band === "9_14"
              ? "Freier Block, Bewegung oder lockerer Ortswechsel"
              : "Spielplatz, Wiese oder entspannter Weg",
        phase: "light_activity",
        phaseGoal: "Leicht auslaufen und Konflikte abbauen",
      },
    ];
  }

  if (planMode === "evening") {
    return [
      {
        index: 0,
        kind: "lunch",
        label: "Frühes Essen",
        hint: "Einfacher Essens-Stop ohne langes Warten",
        phase: "pause",
        phaseGoal: "Energie stabil halten und Überforderung vermeiden",
      },
      {
        index: 1,
        kind: "activity",
        label: "Leichte Aktivität",
        hint:
          band === "12_16"
            ? "Kino, Spot oder ruhiger Szene-Ort"
            : band === "9_14"
              ? "Kleine Challenge oder interaktiver Abend-Stop"
              : "Kleines Highlight mit geringer Reibung",
        phase: "light_activity",
        phaseGoal: "Etwas Schönes erleben, aber rechtzeitig runterfahren",
      },
      {
        index: 2,
        kind: "walk",
        label: "Ruhiger Ausklang",
        hint: "Kurzer Spaziergang / Spielbereich / einfacher Abschluss",
        phase: "wind_down",
        phaseGoal: "Positiv und ruhig beenden",
      },
    ];
  }

  return [
    {
      index: 0,
      kind: "breakfast",
      label: "Ankommen",
      hint: "Snack / Eis / lockerer Einstieg",
      phase: "arrival",
      phaseGoal: "Stressfrei starten und alle abholen",
    },
    {
      index: 1,
      kind: "activity",
      label: "Hauptaktivität",
      hint:
        band === "0_6"
          ? "Spielplatz, Tiere, Wasser oder sicheres Mitmach-Highlight"
          : band === "4_10"
            ? "Zoo, Park, Mitmach-Museum oder aktives Familien-Highlight"
            : band === "9_14"
              ? "Challenge, Science, Klettern oder interaktives Highlight"
              : "Arcade, Klettern, Kino, Streetfood-Spot oder urbanes Highlight",
      phase: "main_activity",
      phaseGoal:
        band === "12_16"
          ? "Den stärksten Programmpunkt so setzen, dass er Eigenständigkeit und gemeinsame Zeit verbindet"
          : "Das große Highlight früh legen, wenn die Kinder noch Energie haben",
    },
    {
      index: 2,
      kind: "lunch",
      label: "Pause & Essen",
      hint: "Kinderfreundlicher Essens-Stop oder Picknick",
      phase: "pause",
      phaseGoal: "Rechtzeitig regenerieren und Hungerstress vermeiden",
    },
    {
      index: 3,
      kind: "activity",
      label: band === "12_16" ? "Freier Social-Block" : "Leichte Zweitaktivität",
      hint:
        band === "0_6"
          ? "Freies Spielen oder ruhiger zweiter Block"
          : band === "4_10"
            ? "Freies Spielen, kleine Aktivität oder ruhiger Lern-Mix"
            : band === "9_14"
              ? "Kurze Challenge, freier Block oder lockerer Szenenwechsel"
              : "Freier Block, urbaner Spot oder kurzer gemeinsamer Szenenwechsel",
      phase: "light_activity",
      phaseGoal: "Nur noch leicht und flexibel weiterführen",
    },
    {
      index: 4,
      kind: "walk",
      label: "Ausklang",
      hint:
        band === "12_16"
          ? "Dessert, Spot oder kurzer gemeinsamer Abschluss"
          : band === "9_14"
            ? "Lockerer Abschluss mit wenig Reibung"
            : "Spielplatz, Wiese oder kurzer entspannter Abschluss",
      phase: "wind_down",
      phaseGoal: "Positiv beenden und nicht zu spät überziehen",
    },
  ];
}

export function isStrongFamilyCandidate(loc: LocationRow) {
  const category = classify(loc);
  const text = buildLocationSearchText(loc);
  const signals = inferFamilySignals(loc);

  if (
    loc.family_friendly ||
    hasOccasionTag(loc, "family") ||
    hasAudience(loc, "family") ||
    hasSubtype(
      loc,
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
    ) ||
    (hasSubtype(loc, "climbing") &&
      (loc.family_friendly ||
        hasOccasionTag(loc, "family") ||
        hasAudience(loc, "family")))
  ) {
    return true;
  }

  if (category === "nightlife") return false;
  if (text.includes("club") || text.includes("night")) return false;

  const score =
    signals.kidsFun +
    signals.parentEase +
    signals.logistics +
    signals.flexibility +
    signals.safety +
    signals.foodEase +
    signals.freePlay;

  return score >= 3;
}

export function familyRetrievalBoost(loc: LocationRow) {
  let score = 0;
  const signals = inferFamilySignals(loc);

  if (hasSubtype(loc, "zoo", "wildpark", "aquarium", "playground", "children_museum", "science_center", "swimming_pool", "thermal_bath", "theme_park", "water_park", "farm_experience")) score += 18;
  if (hasSubtype(loc, "zoo", "aquarium", "swimming_pool", "water_park", "theme_park")) score += 20;
  if (hasSubtype(loc, "climbing") && (loc.family_friendly || hasOccasionTag(loc, "family") || hasAudience(loc, "family"))) score += 14;

  score += signals.kidsFun * 5;
  score += signals.parentEase * 4;
  score += signals.logistics * 5;
  score += signals.flexibility * 4;
  score += signals.safety * 4;
  score += signals.foodEase * 5;
  score += signals.freePlay * 5;
  score += signals.learning * 3;
  score += signals.wow * 3;

  if (!isStrongFamilyCandidate(loc)) score -= 35;

  return score;
}

export function familyPhaseFitBonus(
  phase: OccasionPhase | null | undefined,
  candidate: ScoredLocation
) {
  if (!phase) return 0;

  const signals = inferFamilySignals(candidate);

  if (phase === "arrival") {
    return signals.logistics * 8 + signals.parentEase * 6 + signals.foodEase * 5;
  }

  if (phase === "main_activity") {
      return (
      signals.kidsFun * 8 +
      signals.movement * 6 +
      signals.learning * 4 +
      signals.wow * 5
    );
  }

  if (phase === "pause") {
    return signals.foodEase * 9 + signals.parentEase * 6 + signals.safety * 4;
  }

  if (phase === "light_activity") {
    return signals.freePlay * 8 + signals.flexibility * 6 + signals.parentEase * 3;
  }

  if (phase === "wind_down") {
    return signals.parentEase * 7 + signals.flexibility * 5 + signals.safety * 5 + signals.freePlay * 3;
  }

  return 0;
}

export function familyPhaseMismatchPenalty(
  phase: OccasionPhase | null | undefined,
  candidate: ScoredLocation
) {
  if (!phase) return 0;

  const category = classify(candidate);
  const isNightlife =
    category === "nightlife" || hasSubtype(candidate, "nightclub", "disco", "cocktail_bar");
  const isHeavyEvent =
    category === "event" && !hasSubtype(candidate, "children_museum", "science_center");

  let penalty = 0;

  if (phase === "pause" && isNightlife) {
    penalty += 24;
  }

  if (phase === "pause" && isHeavyEvent) {
    penalty += 12;
  }

  if (phase === "wind_down" && isNightlife) {
    penalty += 30;
  }

  return penalty;
}

export function familyGoalBoost(
  goal: PlanVariantGoal,
  candidate: ScoredLocation
) {
  const signals = inferFamilySignals(candidate);

  if (goal === "best_match") {
    return signals.kidsFun * 5 + signals.parentEase * 5 + signals.logistics * 4;
  }

  if (goal === "shortest_route") {
    return signals.logistics * 7 + signals.foodEase * 4 + signals.parentEase * 4;
  }

  if (goal === "more_diverse") {
    return (
      signals.learning * 5 +
      signals.movement * 5 +
      signals.freePlay * 5 +
      signals.wow * 3
    );
  }

  if (goal === "premium") {
    return signals.wow * 7 + signals.kidsFun * 5 + signals.parentEase * 4;
  }

  return 0;
}

export function familyVariantLabel(goal: PlanVariantGoal) {
  if (goal === "best_match") return "Classic Family Day";
  if (goal === "shortest_route") return "Easy Family Day";
  if (goal === "more_diverse") return "Explore Family Day";
  if (goal === "premium") return "Wow Family Day";
  return "Family Day";
}

export function familyVariantReason(goal: PlanVariantGoal) {
  if (goal === "best_match") {
    return "Diese Familien-Variante priorisiert die zuverlässigste Balance aus Spaß für Kinder, Pausen, einfacher Logistik und einem ruhigen Ende.";
  }

  if (goal === "shortest_route") {
    return "Diese Familien-Variante hält Wege, Wechsel und Organisationsaufwand niedrig und eignet sich besonders für entspannte, stressarme Ausflüge.";
  }

  if (goal === "more_diverse") {
    return "Diese Familien-Variante mischt Bewegung, Entdecken, Essen und freies Spielen ausgewogener für mehr Abwechslung im Tagesverlauf.";
  }

  if (goal === "premium") {
    return "Diese Familien-Variante priorisiert stärkere Highlights, Erinnerungswert und begeisternde Erlebnisse für Kinder und Erwachsene.";
  }

  return "Alternative Familien-Variante.";
}

export function explainFamilyPhaseFit(params: {
  phase: OccasionPhase | null | undefined;
  candidate: ScoredLocation;
}) {
  const { phase, candidate } = params;
  if (!phase) return [];

  const signals = inferFamilySignals(candidate);

  if (phase === "arrival") {
    return dedupeReasons([
      signals.logistics >= 7 ? "einfacher Start mit wenig Orga-Reibung" : null,
      signals.parentEase >= 7 ? "entlastet Eltern schon zu Beginn" : null,
      signals.foodEase >= 6 ? "eignet sich gut zum stressfreien Ankommen" : null,
    ]);
  }

  if (phase === "main_activity") {
    return dedupeReasons([
      signals.kidsFun >= 8 ? "starkes Familien-Highlight fuer die Hauptenergiephase" : null,
      signals.movement >= 7 ? "gibt Kindern Bewegung statt Leerlauf" : null,
      signals.learning >= 7 ? "verbindet Spass mit Entdecken" : null,
      signals.wow >= 6 ? "hat echten Ausflugs-Charakter fuer Kinder und Eltern" : null,
    ]);
  }

  if (phase === "pause") {
    return dedupeReasons([
      signals.foodEase >= 8 ? "gut als Essens- und Regenerationsanker" : null,
      signals.parentEase >= 6 ? "nimmt Druck aus Hunger- und Pausensituationen" : null,
      signals.safety >= 6 ? "fuehlt sich stabil und familiengeeignet an" : null,
    ]);
  }

  if (phase === "light_activity") {
    return dedupeReasons([
      signals.freePlay >= 7 ? "laesst Raum fuer freies Spielen statt starrem Programm" : null,
      signals.flexibility >= 7 ? "funktioniert gut als leichter flexibler Nachmittagsblock" : null,
      signals.parentEase >= 6 ? "haelt den Ablauf entspannter" : null,
    ]);
  }

  if (phase === "wind_down") {
    return dedupeReasons([
      signals.parentEase >= 7 ? "sorgt fuer einen ruhigen Abschluss ohne Ueberforderung" : null,
      signals.safety >= 6 ? "passt gut fuer ein entspanntes Ende" : null,
      signals.freePlay >= 6 ? "laesst den Tag locker auslaufen" : null,
    ]);
  }

  return [];
}

export function explainFamilyPhaseMismatch(params: {
  phase: OccasionPhase | null | undefined;
  candidate: ScoredLocation;
}) {
  const { phase, candidate } = params;
  if (!phase) return [];

  const category = classify(candidate);
  const isNightlife =
    category === "nightlife" || hasSubtype(candidate, "nightclub", "disco", "cocktail_bar");
  const isHeavyEvent =
    category === "event" && !hasSubtype(candidate, "children_museum", "science_center");

  if (phase === "pause" && isNightlife) {
    return ["zu unruhig fuer eine familienfreundliche Essens- oder Pausenphase"];
  }

  if (phase === "pause" && isHeavyEvent) {
    return ["zu eventlastig fuer eine stabile Familienpause"];
  }

  if (phase === "wind_down" && isNightlife) {
    return ["zu laut oder spaet fuer einen ruhigen Familienausklang"];
  }

  return [];
}

export const familyOccasion: OccasionModule<FamilySignals> = {
  key: "family",
  inferSignals: inferFamilySignals,
  isStrongCandidate: isStrongFamilyCandidate,
  retrievalBoost: familyRetrievalBoost,
  buildSlotTemplate: buildFamilySlotTemplate,
  phaseFitBonus: familyPhaseFitBonus,
  phaseMismatchPenalty: familyPhaseMismatchPenalty,
  goalBoost: familyGoalBoost,
  explainPhaseFit: explainFamilyPhaseFit,
  explainPhaseMismatch: explainFamilyPhaseMismatch,
  variantMeta(goal: PlanVariantGoal) {
    return {
      label: familyVariantLabel(goal),
      reason: familyVariantReason(goal),
    };
  },
};
