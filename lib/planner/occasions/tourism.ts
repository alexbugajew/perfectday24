import { buildLocationSearchText, classify, hasAudience, hasOccasionTag, hasSubtype } from "../features";
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

export type TourismSignals = {
  landmark: number;
  culture: number;
  scenic: number;
  efficiency: number;
  walkability: number;
  relaxation: number;
  foodAnchor: number;
  premium: number;
};

export function inferTourismSignals(loc: LocationRow): TourismSignals {
  const cat = classify(loc);
  const text = buildLocationSearchText(loc);
  const structuredTourism = hasOccasionTag(loc, "tourism") || hasAudience(loc, "tourism");
  const structuredLandmark = hasSubtype(loc, "landmark", "historic_site", "old_town", "monument", "memorial");
  const structuredCulture = hasSubtype(loc, "museum", "gallery");
  const structuredScenic = hasSubtype(loc, "viewpoint", "promenade", "rooftop");

  let landmark = 0;
  let culture = 0;
  let scenic = 0;
  let efficiency = 0;
  let walkability = 0;
  let relaxation = 0;
  let foodAnchor = 0;
  let premium = 0;

  if (cat === "culture") {
    landmark += 2;
    culture += 4;
    efficiency += 1;
  }

  if (cat === "activity") {
    scenic += 2;
    walkability += 2;
    relaxation += 1;
  }

  if (cat === "restaurant" || cat === "cafe") {
    foodAnchor += 4;
    relaxation += 2;
    premium += 1;
  }

  if (structuredTourism) {
    landmark += 4;
    culture += 4;
    walkability += 2;
  }

  if (structuredLandmark) {
    landmark += 6;
    culture += 3;
  }

  if (structuredCulture) {
    culture += 6;
  }

  if (structuredScenic) {
    scenic += 5;
    walkability += 3;
  }

  if (hasOpeningInfo(loc)) {
    efficiency += 1;
  }

  if (hasStrongRating(loc) && hasRatingVolume(loc, 25)) {
    premium += 2;
    landmark += 1;
  }

  landmark += scoreTextSupport(
    text,
    ["landmark", "historic", "history", "denkmal", "schloss", "cathedral", "kirche", "monument", "tower", "viewpoint"],
    2,
    structuredLandmark || structuredScenic
  );
  culture += scoreTextSupport(
    text,
    ["museum", "gallery", "galerie", "ausstellung", "historic", "theater", "castle", "memorial", "old town", "altstadt"],
    2,
    structuredCulture || structuredLandmark
  );
  scenic += scoreTextSupport(
    text,
    ["view", "aussicht", "rooftop", "tower", "park", "garden", "ufer", "promenade", "river", "plattform"],
    2,
    structuredScenic
  );
  walkability += scoreTextSupport(
    text,
    ["park", "walk", "spazier", "promenade", "old town", "altstadt", "city", "plaza", "historic center"],
    2,
    structuredTourism || structuredScenic || structuredLandmark
  );
  relaxation += scoreTextSupport(
    text,
    ["park", "garden", "cafe", "coffee", "promenade", "terrasse", "ufer"],
    2,
    structuredScenic || cat === "cafe"
  );
  foodAnchor += scoreTextSupport(
    text,
    ["restaurant", "bistro", "brasserie", "cafe", "coffee", "kitchen", "lunch", "dinner"],
    2,
    cat === "restaurant" || cat === "cafe"
  );
  premium += scoreTextSupport(
    text,
    ["fine dining", "rooftop", "view", "gourmet", "historic", "iconic", "signature"],
    2,
    structuredLandmark || structuredScenic
  );

  return capSignals(
    {
      landmark,
      culture,
      scenic,
      efficiency,
      walkability,
      relaxation,
      foodAnchor,
      premium,
    },
    {
      landmark: 12,
      culture: 12,
      scenic: 10,
      efficiency: 8,
      walkability: 10,
      relaxation: 8,
      foodAnchor: 8,
      premium: 8,
    }
  );
}

export function buildTourismSlotTemplate(planMode: PlanMode): SlotDefinition[] {
  if (planMode === "morning") {
    return [
      {
        index: 0,
        kind: "sightseeing",
        label: "Haupt-Highlight",
        hint: "Ikonische Sehenswürdigkeit oder Landmark",
        phase: "tour_highlight",
        phaseGoal: "Die wichtigsten Must-sees früh priorisieren",
      },
      {
        index: 1,
        kind: "sightseeing",
        label: "Kultur",
        hint: "Museum, Galerie oder historischer Spot",
        phase: "tour_culture",
        phaseGoal: "Kulturelle Tiefe mit kurzer Wegezeit ergänzen",
      },
    ];
  }

  if (planMode === "midday") {
    return [
      {
        index: 0,
        kind: "sightseeing",
        label: "Highlight",
        hint: "Landmark oder ikonischer Aussichtspunkt",
        phase: "tour_highlight",
        phaseGoal: "Ein prägendes Highlight mit hoher Sichtbarkeit starten",
      },
      {
        index: 1,
        kind: "lunch",
        label: "Lunch",
        hint: "Guter Lunch nahe des Sightseeing-Clusters",
        phase: "tour_lunch",
        phaseGoal: "Mittagspause ohne die Route zu unterbrechen",
      },
      {
        index: 2,
        kind: "activity",
        label: "Relaxed Explorer",
        hint: "Park, Aussicht oder leichter Nachmittags-Stop",
        phase: "tour_relaxed",
        phaseGoal: "Am Nachmittag leichter und entspannter werden",
      },
    ];
  }

  if (planMode === "evening") {
    return [
      {
        index: 0,
        kind: "sightseeing",
        label: "Abend-Highlight",
        hint: "Scenic Spot, Aussicht oder Altstadt",
        phase: "tour_relaxed",
        phaseGoal: "Den Abend mit einem atmosphärischen Highlight beginnen",
      },
      {
        index: 1,
        kind: "dinner",
        label: "Dinner",
        hint: "Atmosphärischer Abschluss in gutem Umfeld",
        phase: "tour_dinner",
        phaseGoal: "Den Tourismustag mit Genuss und Atmosphäre abschließen",
      },
      {
        index: 2,
        kind: "anything",
        label: "Optionaler Abschluss",
        hint: "Kleiner Scenic- oder Café-Stop",
        phase: "tour_optional",
        phaseGoal: "Nur optional verlängern, ohne Stress zu erzeugen",
      },
    ];
  }

  return [
    {
      index: 0,
      kind: "sightseeing",
      label: "Start-Highlight",
      hint: "Ikonische Sehenswürdigkeit nahe dem Startpunkt",
      phase: "tour_highlight",
      phaseGoal: "Mit einem klaren Must-see beginnen",
    },
    {
      index: 1,
      kind: "sightseeing",
      label: "Kultur-Stop",
      hint: "Museum, Galerie oder historischer Ort",
      phase: "tour_culture",
      phaseGoal: "Kultur und historische Tiefe in den Vormittag legen",
    },
    {
      index: 2,
      kind: "lunch",
      label: "Lunch",
      hint: "Guter Lunch im bestehenden Routencluster",
      phase: "tour_lunch",
      phaseGoal: "Mittagspause als Teil des Flows integrieren",
    },
    {
      index: 3,
      kind: "activity",
      label: "Relaxed Highlight",
      hint: "Park, Aussichtspunkt oder leichter Nachmittags-Stop",
      phase: "tour_relaxed",
      phaseGoal: "Nachmittags bewusster entschleunigen",
    },
    {
      index: 4,
      kind: "anything",
      label: "Optionaler Stop",
      hint: "Café oder kleiner Spot auf dem Weg",
      phase: "tour_optional",
      phaseGoal: "Flexibel ergänzen, wenn Zeit und Energie da sind",
    },
    {
      index: 5,
      kind: "dinner",
      label: "Dinner",
      hint: "Atmosphärischer Tagesabschluss",
      phase: "tour_dinner",
      phaseGoal: "Mit einem guten Dinner entspannt abschließen",
    },
  ];
}

export function isStrongTourismCandidate(loc: LocationRow) {
  const signals = inferTourismSignals(loc);

  if (
    hasOccasionTag(loc, "tourism") ||
    hasAudience(loc, "tourism") ||
    hasSubtype(
      loc,
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
  ) {
    return true;
  }

  const score =
    signals.landmark +
    signals.culture +
    signals.scenic +
    signals.walkability +
    signals.relaxation +
    signals.foodAnchor;

  return score >= 3;
}

export function tourismRetrievalBoost(loc: LocationRow) {
  let score = 0;
  const signals = inferTourismSignals(loc);

  if (hasSubtype(loc, "landmark", "historic_site", "museum", "gallery", "viewpoint", "old_town", "monument", "memorial", "promenade")) score += 18;

  score += signals.landmark * 6;
  score += signals.culture * 6;
  score += signals.scenic * 4;
  score += signals.efficiency * 4;
  score += signals.walkability * 5;
  score += signals.relaxation * 3;
  score += signals.foodAnchor * 4;
  score += signals.premium * 3;

  if (!isStrongTourismCandidate(loc)) score -= 25;

  return score;
}

export function tourismPhaseFitBonus(
  phase: OccasionPhase | null | undefined,
  candidate: ScoredLocation
) {
  if (!phase) return 0;

  const signals = inferTourismSignals(candidate);
  if (phase === "tour_start" || phase === "tour_highlight") {
    return signals.landmark * 9 + signals.culture * 4 + signals.efficiency * 3;
  }

  if (phase === "tour_culture") {
    return signals.culture * 9 + signals.landmark * 4 + signals.walkability * 2;
  }

  if (phase === "tour_lunch") {
    return signals.foodAnchor * 9 + signals.efficiency * 4 + signals.relaxation * 3;
  }

  if (phase === "tour_relaxed") {
    return signals.scenic * 7 + signals.relaxation * 7 + signals.walkability * 4;
  }

  if (phase === "tour_optional") {
    return signals.relaxation * 6 + signals.walkability * 5 + signals.foodAnchor * 3;
  }

  if (phase === "tour_dinner") {
    return signals.foodAnchor * 8 + signals.premium * 6 + signals.scenic * 3;
  }

  return 0;
}

export function tourismPhaseMismatchPenalty(
  phase: OccasionPhase | null | undefined,
  candidate: ScoredLocation
) {
  if (!phase) return 0;

  const category = classify(candidate);
  const isPureFood =
    (category === "restaurant" || category === "cafe") &&
    !hasSubtype(
      candidate,
      "viewpoint",
      "rooftop",
      "landmark",
      "historic_site",
      "museum",
      "gallery"
    );
  const isNightlife = category === "nightlife";

  if ((phase === "tour_start" || phase === "tour_highlight") && isPureFood) {
    return 22;
  }

  if (phase === "tour_relaxed" && isNightlife) {
    return 24;
  }

  if (phase === "tour_relaxed" && isPureFood) {
    return 18;
  }

  if (phase === "tour_optional" && isNightlife) {
    return 18;
  }

  if (phase === "tour_optional" && isPureFood) {
    return 14;
  }

  return 0;
}

export function tourismGoalBoost(
  goal: PlanVariantGoal,
  candidate: ScoredLocation
) {
  const signals = inferTourismSignals(candidate);

  if (goal === "best_match") {
    return signals.landmark * 6 + signals.culture * 5 + signals.walkability * 4;
  }

  if (goal === "shortest_route") {
    return signals.efficiency * 7 + signals.walkability * 6 + signals.foodAnchor * 3;
  }

  if (goal === "more_diverse") {
    return signals.culture * 6 + signals.scenic * 5 + signals.relaxation * 5;
  }

  if (goal === "premium") {
    return signals.premium * 8 + signals.landmark * 5 + signals.foodAnchor * 4;
  }

  return 0;
}

export function tourismVariantLabel(goal: PlanVariantGoal) {
  if (goal === "best_match") return "Efficient Sightseeing";
  if (goal === "shortest_route") return "Walkable Highlights";
  if (goal === "more_diverse") return "Relaxed Explorer";
  if (goal === "premium") return "Premium Experience";
  return "Sightseeing Day";
}

export function tourismVariantReason(goal: PlanVariantGoal) {
  if (goal === "best_match") {
    return "Diese Tourism-Variante priorisiert die wichtigsten Highlights in effizienter Reihenfolge und integriert Lunch und Dinner ohne große Umwege.";
  }

  if (goal === "shortest_route") {
    return "Diese Tourism-Variante hält Wege besonders kurz und fokussiert auf eine kompakte, gut laufbare Sightseeing-Route.";
  }

  if (goal === "more_diverse") {
    return "Diese Tourism-Variante mischt Must-sees, Kultur und entspanntere Scenic-Stops ausgewogener für einen lockeren Sightseeing-Flow.";
  }

  if (goal === "premium") {
    return "Diese Tourism-Variante priorisiert ikonische Orte, hochwertigere Food-Stops und insgesamt attraktivere Gesamtqualität.";
  }

  return "Alternative Tourism-Variante.";
}

export function explainTourismPhaseFit(params: {
  phase: OccasionPhase | null | undefined;
  candidate: ScoredLocation;
}) {
  const { phase, candidate } = params;
  if (!phase) return [];

  const signals = inferTourismSignals(candidate);

  if (phase === "tour_start" || phase === "tour_highlight") {
    return dedupeReasons([
      signals.landmark >= 8 ? "setzt frueh ein starkes Must-see" : null,
      signals.culture >= 6 ? "hat klaren touristischen und kulturellen Wert" : null,
      signals.efficiency >= 5 ? "passt gut als frueher Anker der Route" : null,
    ]);
  }

  if (phase === "tour_culture") {
    return dedupeReasons([
      signals.culture >= 8 ? "vertieft den Tag kulturell statt nur oberflaechlich zu bleiben" : null,
      signals.landmark >= 6 ? "traegt substanziell zur Sightseeing-Story bei" : null,
      signals.walkability >= 5 ? "bleibt gut in den Sightseeing-Flow integrierbar" : null,
    ]);
  }

  if (phase === "tour_lunch") {
    return dedupeReasons([
      signals.foodAnchor >= 7 ? "integriert die Mittagspause ohne grossen Umweg" : null,
      signals.relaxation >= 6 ? "gibt dem Sightseeing bewusst einen Erholungsmoment" : null,
      signals.efficiency >= 5 ? "passt gut in einen kompakten Tagesfluss" : null,
    ]);
  }

  if (phase === "tour_relaxed") {
    return dedupeReasons([
      signals.scenic >= 7 ? "lockert den Tag mit einem scenic Stop auf" : null,
      signals.relaxation >= 7 ? "entschleunigt den Sightseeing-Flow bewusst" : null,
      signals.walkability >= 6 ? "funktioniert gut als laufbarer Nachmittagsblock" : null,
    ]);
  }

  if (phase === "tour_optional") {
    return dedupeReasons([
      signals.relaxation >= 6 ? "funktioniert gut als optionaler Genuss- oder Ruhepunkt" : null,
      signals.walkability >= 6 ? "liegt gut im natuerlichen Wegeverlauf" : null,
      signals.foodAnchor >= 5 ? "taugt als kleiner optionaler Genuss-Stop" : null,
    ]);
  }

  if (phase === "tour_dinner") {
    return dedupeReasons([
      signals.foodAnchor >= 7 ? "gibt dem Tourismustag einen klaren kulinarischen Abschluss" : null,
      signals.premium >= 6 ? "fuehlt sich nach einem hochwertigen Tagesabschluss an" : null,
      signals.scenic >= 5 ? "schliesst den Tag mit Atmosphaere statt nur Funktion ab" : null,
    ]);
  }

  return [];
}

export function explainTourismPhaseMismatch(params: {
  phase: OccasionPhase | null | undefined;
  candidate: ScoredLocation;
}) {
  const { phase, candidate } = params;
  if (!phase) return [];

  const category = classify(candidate);
  const isPureFood =
    (category === "restaurant" || category === "cafe") &&
    !hasSubtype(
      candidate,
      "viewpoint",
      "rooftop",
      "landmark",
      "historic_site",
      "museum",
      "gallery"
    );

  if ((phase === "tour_start" || phase === "tour_highlight") && isPureFood) {
    return ["zu stark Food-only fuer ein touristisches Haupt-Highlight"];
  }

  if (phase === "tour_relaxed" && category === "nightlife") {
    return ["wirkt zu nightlife-lastig fuer einen touristischen Scenic-Auftakt"];
  }

  if (phase === "tour_relaxed" && isPureFood) {
    return ["ist zu stark Food-only statt ein eigener touristischer Abendmoment"];
  }

  if (phase === "tour_optional" && category === "nightlife") {
    return ["kippt zu sehr in Nightlife statt in einen kleinen touristischen Abschluss"];
  }

  if (phase === "tour_optional" && isPureFood) {
    return ["ist zu generisch kulinarisch fuer einen optionalen Tourism-Abschluss"];
  }

  return [];
}

export const tourismOccasion = createOccasionModule<TourismSignals>({
  key: "tourism",
  inferSignals: inferTourismSignals,
  isStrongCandidate: isStrongTourismCandidate,
  retrievalBoost: tourismRetrievalBoost,
  buildSlotTemplate: buildTourismSlotTemplate,
  phaseFitBonus: tourismPhaseFitBonus,
  phaseMismatchPenalty: tourismPhaseMismatchPenalty,
  goalBoost: tourismGoalBoost,
  explainPhaseFit: explainTourismPhaseFit,
  explainPhaseMismatch: explainTourismPhaseMismatch,
  variantMeta(goal: PlanVariantGoal) {
    return {
      label: tourismVariantLabel(goal),
      reason: tourismVariantReason(goal),
    };
  },
});
