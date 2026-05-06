import {
  buildLocationSearchText,
  classify,
  hasAudience,
  hasOccasionTag,
  hasSubtype,
} from "../features";
import type {
  LocationRow,
  OccasionPhase,
  PlanMode,
  PlanVariantGoal,
  ScoredLocation,
  SlotDefinition,
} from "../types";
import {
  capSignals,
  dedupeReasons,
  hasOpeningInfo,
  hasRatingVolume,
  hasStrongRating,
  scoreTextSupport,
} from "./helpers";
import { createOccasionModule } from "./types";

export type DateSignals = {
  lowPressure: number;
  conversation: number;
  interaction: number;
  outdoor: number;
  romantic: number;
  wow: number;
  closeFit: number;
};

export function inferDateSignals(loc: LocationRow): DateSignals {
  const cat = classify(loc);
  const text = buildLocationSearchText(loc);
  const structuredDate = hasOccasionTag(loc, "date") || hasAudience(loc, "date");
  const structuredRomantic = hasSubtype(
    loc,
    "promenade",
    "viewpoint",
    "rooftop",
    "romantic_spot",
    "botanical_garden"
  );
  const structuredInteractive = hasSubtype(
    loc,
    "bowling",
    "minigolf",
    "climbing",
    "lasertag",
    "escape_room"
  );
  const structuredDrinks = hasSubtype(loc, "cocktail_bar", "rooftop_bar");

  let lowPressure = 0;
  let conversation = 0;
  let interaction = 0;
  let outdoor = 0;
  let romantic = 0;
  let wow = 0;
  let closeFit = 0;

  if (cat === "cafe") {
    lowPressure += 3;
    conversation += 3;
  }

  if (cat === "restaurant") {
    conversation += 2;
    romantic += 2;
    closeFit += 1;
  }

  if (cat === "culture") {
    conversation += 2;
    wow += 1;
  }

  if (cat === "activity") {
    interaction += 3;
    outdoor += 1;
  }

  if (cat === "nightlife") {
    romantic += 2;
    closeFit += 3;
  }

  if (cat === "event") {
    interaction += 2;
    wow += 2;
  }

  if (structuredDate) {
    lowPressure += 3;
    conversation += 3;
    romantic += 3;
  }

  if (structuredRomantic) {
    outdoor += 4;
    romantic += 4;
    wow += 2;
  }

  if (structuredInteractive) {
    interaction += 5;
  }

  if (structuredDrinks) {
    closeFit += 4;
    romantic += 3;
  }

  if (hasOpeningInfo(loc)) {
    closeFit += 1;
  }

  if (hasStrongRating(loc) && hasRatingVolume(loc, 25)) {
    romantic += 1;
    wow += 1;
  }

  lowPressure += scoreTextSupport(
    text,
    ["coffee", "kaffee", "cafe", "brunch", "eis"],
    2,
    cat === "cafe"
  );
  conversation += scoreTextSupport(
    text,
    ["wein", "wine", "gallery", "galerie", "museum"],
    2,
    cat === "culture" || cat === "restaurant"
  );
  interaction += scoreTextSupport(
    text,
    [
      "bowling",
      "escape",
      "minigolf",
      "workshop",
      "kochkurs",
      "cocktail",
      "quiz",
      "klettern",
      "climb",
      "lasertag",
      "laser tag",
      "paintball",
      "kart",
      "gokart",
      "kino",
      "cinema",
      "kanu",
      "canoe",
      "kajak",
      "kayak",
    ],
    2,
    structuredInteractive
  );
  outdoor += scoreTextSupport(
    text,
    [
      "park",
      "garten",
      "garden",
      "lake",
      "see",
      "ufer",
      "spazier",
      "walk",
      "boot",
      "promenade",
      "strand",
    ],
    2,
    structuredRomantic
  );
  romantic += scoreTextSupport(
    text,
    [
      "rooftop",
      "dach",
      "sunset",
      "sonnen",
      "view",
      "aussicht",
      "terrasse",
      "cocktail",
      "wein",
      "promenade",
      "plattform",
    ],
    2,
    structuredRomantic || structuredDrinks
  );
  wow += scoreTextSupport(
    text,
    [
      "aussicht",
      "view",
      "rooftop",
      "workshop",
      "event",
      "konzert",
      "festival",
      "boat",
      "boot",
      "plattform",
      "historic",
    ],
    2,
    structuredRomantic
  );
  closeFit += scoreTextSupport(
    text,
    [
      "bar",
      "cocktail",
      "ufer",
      "terrasse",
      "rooftop",
      "spazier",
      "walk",
      "night",
    ],
    1,
    structuredDrinks || structuredRomantic
  );

  return capSignals(
    {
      lowPressure,
      conversation,
      interaction,
      outdoor,
      romantic,
      wow,
      closeFit,
    },
    {
      lowPressure: 10,
      conversation: 10,
      interaction: 10,
      outdoor: 8,
      romantic: 10,
      wow: 10,
      closeFit: 10,
    }
  );
}

export function buildDateSlotTemplate(planMode: PlanMode): SlotDefinition[] {
  if (planMode === "morning") {
    return [
      {
        index: 0,
        kind: "breakfast",
        label: "Ankommen",
        hint: "Kaffee / leichtes Fruehstueck",
        phase: "warmup",
        phaseGoal: "Locker ankommen und Nervositaet abbauen",
      },
      {
        index: 1,
        kind: "walk",
        label: "Vertiefung",
        hint: "Kurzer Spaziergang / entspannte Runde",
        phase: "deepen",
        phaseGoal: "Gespräch vertiefen ohne Druck",
      },
    ];
  }

  if (planMode === "midday") {
    return [
      {
        index: 0,
        kind: "breakfast",
        label: "Warm-up",
        hint: "Kaffee / lockerer Start",
        phase: "warmup",
        phaseGoal: "Locker starten und Gespräch öffnen",
      },
      {
        index: 1,
        kind: "activity",
        label: "Gemeinsames Erlebnis",
        hint: "Interaktive oder leichte Outdoor-Aktivitaet",
        phase: "shared_experience",
        phaseGoal: "Gemeinsame Dynamik erzeugen",
      },
      {
        index: 2,
        kind: "lunch",
        label: "Vertiefung",
        hint: "Lunch / Food Spot mit Gesprächsraum",
        phase: "deepen",
        phaseGoal: "Mehr Nähe und längeres Gespräch",
      },
    ];
  }

  if (planMode === "evening") {
    return [
      {
        index: 0,
        kind: "dinner",
        label: "Auftakt",
        hint: "Dinner mit entspannter Atmosphäre",
        phase: "warmup",
        phaseGoal: "Stilvoll und entspannt ankommen",
      },
      {
        index: 1,
        kind: "walk",
        label: "Moment zu zweit",
        hint: "Spaziergang / Aussicht / Ufer",
        phase: "highlight",
        phaseGoal: "Ein besonderer Moment mit Dynamikwechsel",
      },
      {
        index: 2,
        kind: "nightlife",
        label: "Ausklang",
        hint: "Bar / Cocktails / ruhiger Late Spot",
        phase: "close",
        phaseGoal: "Positiv, ruhig und nah enden",
      },
    ];
  }

  return [
    {
      index: 0,
      kind: "breakfast",
      label: "Ankommen",
      hint: "Kaffee / leichter Start",
      phase: "warmup",
      phaseGoal: "Locker ankommen und den Ton setzen",
    },
    {
      index: 1,
      kind: "activity",
      label: "Gemeinsame Aktivität",
      hint: "Spielerisch, kreativ oder outdoor",
      phase: "shared_experience",
      phaseGoal: "Verbindung durch gemeinsames Erlebnis",
    },
    {
      index: 2,
      kind: "lunch",
      label: "Vertiefung",
      hint: "Lunch / Food Spot mit Gesprächsraum",
      phase: "deepen",
      phaseGoal: "Mehr Ruhe und längeres Gespräch",
    },
    {
      index: 3,
      kind: "sightseeing",
      label: "Highlight",
      hint: "Aussicht, Kultur oder besonderer Moment",
      phase: "highlight",
      phaseGoal: "Emotionalen Peak erzeugen",
    },
    {
      index: 4,
      kind: "dinner",
      label: "Abendessen",
      hint: "Dinner mit Atmosphäre und Zeit zum Ausklingen",
      phase: "close",
      phaseGoal:
        "Den Tag mit einem echten Abendessen ruhig und stimmig abschließen",
    },
  ];
}

export function isStrongDateCandidate(loc: LocationRow) {
  const category = classify(loc);
  const text = buildLocationSearchText(loc);
  const signals = inferDateSignals(loc);

  if (
    hasOccasionTag(loc, "date") ||
    hasAudience(loc, "date") ||
    hasSubtype(
      loc,
      "promenade",
      "viewpoint",
      "rooftop",
      "romantic_spot",
      "bowling",
      "minigolf",
      "climbing",
      "lasertag",
      "escape_room",
      "cocktail_bar",
      "rooftop_bar"
    )
  ) {
    return true;
  }

  if (
    text.includes("kinder") ||
    text.includes("kids") ||
    hasSubtype(
      loc,
      "playground",
      "children_museum",
      "science_center",
      "zoo",
      "wildpark",
      "aquarium",
      "farm_experience"
    )
  ) {
    return false;
  }

  if (category === "other") return false;

  if (
    category === "nightlife" &&
    !text.includes("cocktail") &&
    !text.includes("wine") &&
    !text.includes("bar")
  ) {
    return false;
  }

  const score =
    signals.lowPressure +
    signals.conversation +
    signals.interaction +
    signals.romantic +
    signals.wow +
    signals.closeFit;

  return score >= 2;
}

export function dateRetrievalBoost(loc: LocationRow) {
  let score = 0;
  const signals = inferDateSignals(loc);

  if (hasSubtype(loc, "promenade", "viewpoint", "rooftop", "romantic_spot", "botanical_garden")) score += 16;
  if (hasSubtype(loc, "bowling", "minigolf", "climbing", "lasertag", "escape_room")) score += 12;
  if (hasSubtype(loc, "cinema", "cocktail_workshop", "workshop_pottery", "workshop_painting")) score += 10;
  if (hasSubtype(loc, "playground", "children_museum", "science_center", "zoo", "wildpark", "aquarium", "farm_experience")) score -= 40;

  score += signals.lowPressure * 4;
  score += signals.conversation * 5;
  score += signals.interaction * 4;
  score += signals.romantic * 5;
  score += signals.wow * 4;
  score += signals.closeFit * 4;

  if (!isStrongDateCandidate(loc)) score -= 30;

  return score;
}

export function datePhaseFitBonus(
  phase: OccasionPhase | null | undefined,
  candidate: ScoredLocation
) {
  if (!phase) return 0;

  const signals = inferDateSignals(candidate);
  const cat = classify(candidate);
  const isFamilyCandidate = hasSubtype(
    candidate,
    "playground",
    "children_museum",
    "science_center",
    "zoo",
    "aquarium",
    "farm_experience"
  );

  if (phase === "warmup") {
    return signals.lowPressure * 8 + signals.conversation * 5 - signals.wow;
  }

  if (phase === "shared_experience") {
    return signals.interaction * 9 + signals.outdoor * 4;
  }

  if (phase === "deepen") {
    return signals.conversation * 8 + signals.romantic * 4;
  }

  if (phase === "highlight") {
    return signals.wow * 9 + signals.romantic * 5 + signals.outdoor * 3;
  }

  if (phase === "close") {
    return signals.closeFit * 8 + signals.romantic * 6 + signals.conversation * 2;
  }

  return 0;
}

export function datePhaseMismatchPenalty(
  phase: OccasionPhase | null | undefined,
  candidate: ScoredLocation
) {
  if (!phase) return 0;

  const category = classify(candidate);
  const isFamilyCandidate = hasSubtype(
    candidate,
    "playground",
    "children_museum",
    "science_center",
    "zoo",
    "aquarium",
    "farm_experience"
  );
  const isSoftNightlife = hasSubtype(candidate, "cocktail_bar", "rooftop_bar", "pub");
  const isInteractiveDate = hasSubtype(
    candidate,
    "bowling",
    "minigolf",
    "climbing",
    "lasertag",
    "escape_room",
    "cinema"
  );

  let penalty = 0;

  if (phase === "warmup" && category === "nightlife" && !isSoftNightlife) {
    penalty += 20;
  }

  if ((phase === "shared_experience" || phase === "highlight") && isFamilyCandidate) {
    penalty += 18;
  }

  if (phase === "shared_experience" && !isInteractiveDate && isFamilyCandidate) {
    penalty += 10;
  }

  if (phase === "close" && isFamilyCandidate) {
    penalty += 24;
  }

  if (phase === "close" && category === "event") {
    penalty += 90;
  }

  if (phase === "close" && category === "culture" && !isSoftNightlife) {
    penalty += 18;
  }

  return penalty;
}

export function dateGoalBoost(
  goal: PlanVariantGoal,
  candidate: ScoredLocation
) {
  const signals = inferDateSignals(candidate);

  if (goal === "best_match") {
    return (
      signals.lowPressure * 5 +
      signals.conversation * 5 +
      signals.romantic * 3
    );
  }

  if (goal === "shortest_route") {
    return signals.lowPressure * 7 + signals.conversation * 3 + signals.closeFit;
  }

  if (goal === "more_diverse") {
    return signals.interaction * 8 + signals.outdoor * 6 + signals.wow * 5;
  }

  if (goal === "premium") {
    return signals.romantic * 8 + signals.wow * 8 + signals.conversation * 2;
  }

  return 0;
}

export function dateVariantLabel(goal: PlanVariantGoal) {
  if (goal === "best_match") return "Classic Date";
  if (goal === "shortest_route") return "Easy Date";
  if (goal === "more_diverse") return "Playful Date";
  if (goal === "premium") return "Romantic Date";
  return "Date";
}

export function dateVariantReason(goal: PlanVariantGoal) {
  if (goal === "best_match") {
    return "Diese Date-Variante folgt der zuverlässigsten Dramaturgie: lockerer Einstieg, gemeinsamer Moment, gutes Gespräch und ein runder positiver Ausklang.";
  }

  if (goal === "shortest_route") {
    return "Diese Date-Variante hält Wege, Ortswechsel und Commitment bewusst niedrig und eignet sich besonders für entspannte erste Dates mit wenig Reibung.";
  }

  if (goal === "more_diverse") {
    return "Diese Date-Variante priorisiert Dynamik, spielerische Aktivität und mehr Szenenwechsel für ein lebendigeres gemeinsames Erlebnis.";
  }

  if (goal === "premium") {
    return "Diese Date-Variante priorisiert Atmosphäre, besondere Orte und einen stärkeren Wow- und Romantik-Fokus über den gesamten Ablauf.";
  }

  return "Alternative Date-Variante.";
}

export function explainDatePhaseFit(params: {
  phase: OccasionPhase | null | undefined;
  candidate: ScoredLocation;
}) {
  const { phase, candidate } = params;
  if (!phase) return [];

  const signals = inferDateSignals(candidate);
  const cat = classify(candidate);

  if (phase === "warmup") {
    return dedupeReasons([
      signals.lowPressure >= 7 ? "lockerer Einstieg mit wenig Druck" : null,
      signals.conversation >= 7 ? "gut fuer ein entspanntes erstes Gespraech" : null,
      cat === "cafe" ? "niedrige Einstiegshuerde fuer den Start" : null,
    ]);
  }

  if (phase === "shared_experience") {
    return dedupeReasons([
      signals.interaction >= 7 ? "bringt spielerische Dynamik ins Date" : null,
      signals.outdoor >= 6 ? "funktioniert gut als gemeinsamer Bewegungs- oder Outdoor-Moment" : null,
      hasSubtype(candidate, "bowling", "minigolf", "climbing", "lasertag", "escape_room", "cinema")
        ? "liefert ein gemeinsames Erlebnis statt nur Gespraech"
        : null,
    ]);
  }

  if (phase === "deepen") {
    return dedupeReasons([
      signals.conversation >= 7 ? "gut fuer laengere und tiefere Gespraeche" : null,
      signals.romantic >= 6 ? "hat genug Atmosphaere fuer mehr Naehe" : null,
      cat === "restaurant" || cat === "culture" ? "gibt dem Date mehr Ruhe und Tiefe" : null,
    ]);
  }

  if (phase === "highlight") {
    return dedupeReasons([
      signals.wow >= 7 ? "setzt einen besonderen Moment im Ablauf" : null,
      signals.romantic >= 6 ? "hat echten Date- und Atmosphaeren-Fit" : null,
      signals.outdoor >= 6 ? "passt gut als Aussicht oder gemeinsamer Szenenwechsel" : null,
    ]);
  }

  if (phase === "close") {
    return dedupeReasons([
      signals.closeFit >= 7 ? "funktioniert gut als ruhiger positiver Ausklang" : null,
      signals.romantic >= 6 ? "haelt die Date-Stimmung bis zum Schluss" : null,
      hasSubtype(candidate, "cocktail_bar", "rooftop_bar", "pub") ? "passt gut fuer einen stimmigen Abschlussdrink" : null,
    ]);
  }

  return [];
}

export function explainDatePhaseMismatch(params: {
  phase: OccasionPhase | null | undefined;
  candidate: ScoredLocation;
}) {
  const { phase, candidate } = params;
  if (!phase) return [];

  const category = classify(candidate);
  const isFamilyCandidate = hasSubtype(
    candidate,
    "playground",
    "children_museum",
    "science_center",
    "zoo",
    "aquarium",
    "farm_experience"
  );
  const isSoftNightlife = hasSubtype(candidate, "cocktail_bar", "rooftop_bar", "pub");
  const isInteractiveDate = hasSubtype(
    candidate,
    "bowling",
    "minigolf",
    "climbing",
    "lasertag",
    "escape_room",
    "cinema"
  );

  if (phase === "warmup" && category === "nightlife" && !isSoftNightlife) {
    return ["zu hart fuer einen entspannten Date-Einstieg"];
  }

  if ((phase === "shared_experience" || phase === "highlight") && isFamilyCandidate) {
    return [
      phase === "shared_experience" && !isInteractiveDate
        ? "wirkt eher familienorientiert als date-tauglich"
        : "passt fachlich eher zu Family als zu Date",
    ];
  }

  if (phase === "close" && isFamilyCandidate) {
    return ["wirkt zu familienorientiert fuer einen romantischen Ausklang"];
  }

  if (phase === "close" && category === "event") {
    return ["wirkt eher wie ein zweites Event als wie ein ruhiger Date-Ausklang"];
  }

  if (phase === "close" && category === "culture" && !isSoftNightlife) {
    return ["fuehlt sich eher nach weiterem Kulturstop als nach Abschlussdrink an"];
  }

  return [];
}

export const dateOccasion = createOccasionModule<DateSignals>({
  key: "date",
  inferSignals: inferDateSignals,
  isStrongCandidate: isStrongDateCandidate,
  retrievalBoost: dateRetrievalBoost,
  buildSlotTemplate: buildDateSlotTemplate,
  phaseFitBonus: datePhaseFitBonus,
  phaseMismatchPenalty: datePhaseMismatchPenalty,
  goalBoost: dateGoalBoost,
  explainPhaseFit: explainDatePhaseFit,
  explainPhaseMismatch: explainDatePhaseMismatch,
  variantMeta(goal: PlanVariantGoal) {
    return {
      label: dateVariantLabel(goal),
      reason: dateVariantReason(goal),
    };
  },
});
