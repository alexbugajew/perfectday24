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
import { createOccasionModule, type OccasionModule } from "./types";

export type FriendsSignals = {
  groupEnergy: number;
  socialEase: number;
  flexibility: number;
  spontaneity: number;
  interaction: number;
  fun: number;
  foodAnchor: number;
  peak: number;
  outdoor: number;
  comfort: number;
};

export function inferFriendsSignals(loc: LocationRow): FriendsSignals {
  const cat = classify(loc);
  const text = buildLocationSearchText(loc);
  const structuredFriends = hasOccasionTag(loc, "friends") || hasAudience(loc, "friends");
  const structuredWorkshop = hasSubtype(loc, "workshop_pottery", "workshop_painting", "cocktail_workshop");
  const structuredAction = hasSubtype(
    loc,
    "bowling",
    "minigolf",
    "climbing",
    "lasertag",
    "paintball",
    "gokart",
    "wakeboard",
    "escape_room"
  );
  const structuredNight = hasSubtype(loc, "pub", "cocktail_bar", "rooftop_bar");
  const structuredPartyPeak = hasSubtype(loc, "nightclub", "disco", "live_music", "afterhour");

  let groupEnergy = 0;
  let socialEase = 0;
  let flexibility = 0;
  let spontaneity = 0;
  let interaction = 0;
  let fun = 0;
  let foodAnchor = 0;
  let peak = 0;
  let outdoor = 0;
  let comfort = 0;

  if (cat === "activity") {
    groupEnergy += 3;
    interaction += 3;
    fun += 3;
  }

  if (cat === "restaurant" || cat === "cafe") {
    socialEase += 3;
    foodAnchor += 4;
    comfort += 2;
  }

  if (cat === "nightlife") {
    peak += 2;
    groupEnergy += 1;
    spontaneity += 2;
    socialEase += 1;
  }

  if (cat === "culture") {
    interaction += 1;
    comfort += 2;
  }

  if (cat === "event") {
    fun += 3;
    peak += 2;
    spontaneity += 2;
  }

  if (structuredFriends) {
    groupEnergy += 4;
    socialEase += 4;
    flexibility += 2;
  }

  if (structuredWorkshop) {
    interaction += 5;
    fun += 3;
    comfort += 2;
  }

  if (structuredAction) {
    groupEnergy += 5;
    interaction += 5;
    fun += 5;
    flexibility += 1;
  }

  if (structuredNight) {
    peak += 2;
    socialEase += 4;
    comfort += 1;
  }

  if (structuredPartyPeak) {
    peak += 2;
    spontaneity += 1;
  }

  if (hasOpeningInfo(loc)) {
    spontaneity += 1;
    comfort += 1;
  }

  if (hasStrongRating(loc) && hasRatingVolume(loc, 20)) {
    comfort += 1;
    fun += 1;
  }

  socialEase += scoreTextSupport(text, ["cafe", "brunch", "bar", "park", "coffee"], 2, structuredFriends || cat === "cafe" || cat === "restaurant" || structuredNight);
  interaction += scoreTextSupport(
    text,
    ["escape", "bowling", "minigolf", "workshop", "cocktail", "kart", "sport", "festival", "paintball", "lasertag", "laser tag", "wakeboard", "klettern", "pottery", "malen", "painting"],
    2,
    structuredWorkshop || structuredAction
  );
  outdoor += scoreTextSupport(
    text,
    ["park", "see", "beach", "boot", "wander", "bike", "volleyball", "spikeball", "sunset", "wakeboard"],
    2,
    structuredAction
  );
  foodAnchor += scoreTextSupport(
    text,
    ["brunch", "restaurant", "food", "bbq", "picknick", "streetfood", "burger"],
    2,
    cat === "restaurant" || cat === "cafe"
  );
  peak += scoreTextSupport(
    text,
    ["rooftop", "sunset", "bar", "club", "lounge", "festival", "event", "view", "aussicht", "disco"],
    2,
    structuredNight
  );
  spontaneity += scoreTextSupport(
    text,
    ["park", "bar", "see", "streetfood", "beach", "night", "walk"],
    1,
    structuredNight
  );
  comfort += scoreTextSupport(
    text,
    ["restaurant", "lounge", "rooftop", "cafe", "spa", "atelier"],
    1,
    structuredWorkshop || structuredNight || cat === "restaurant" || cat === "cafe"
  );
  flexibility += scoreTextSupport(
    text,
    ["park", "picknick", "bar", "see", "streetfood", "walk", "workshop"],
    1,
    structuredFriends || structuredWorkshop
  );

  if (structuredPartyPeak) {
    socialEase -= 1;
    comfort -= 1;
  }

  return capSignals(
    {
      groupEnergy,
      socialEase,
      flexibility,
      spontaneity,
      interaction,
      fun,
      foodAnchor,
      peak,
      outdoor,
      comfort,
    },
    {
      groupEnergy: 10,
      socialEase: 10,
      flexibility: 10,
      spontaneity: 8,
      interaction: 10,
      fun: 10,
      foodAnchor: 8,
      peak: 10,
      outdoor: 8,
      comfort: 8,
    }
  );
}

export function buildFriendsSlotTemplate(planMode: PlanMode): SlotDefinition[] {
  if (planMode === "morning") {
    return [
      {
        index: 0,
        kind: "breakfast",
        label: "Warm-up",
        hint: "Cafe, Brunch oder lockerer Treffpunkt",
        phase: "social_warmup",
        phaseGoal: "Locker ankommen ohne zu viel Struktur",
      },
      {
        index: 1,
        kind: "activity",
        label: "Erlebnis",
        hint: "Gemeinsame Aktivität oder Outdoor-Start",
        phase: "social_activity",
        phaseGoal: "Früh gemeinsame Energie aufbauen",
      },
    ];
  }

  if (planMode === "midday") {
    return [
      {
        index: 0,
        kind: "breakfast",
        label: "Ankommen",
        hint: "Brunch / Cafe / Park-Treff",
        phase: "social_warmup",
        phaseGoal: "Alle synchronisieren und locker starten",
      },
      {
        index: 1,
        kind: "activity",
        label: "Hauptaktivität",
        hint: "Interaktive oder Outdoor-Aktivität",
        phase: "social_activity",
        phaseGoal: "Das gemeinsame Erlebnis in den Mittelpunkt stellen",
      },
      {
        index: 2,
        kind: "lunch",
        label: "Essen",
        hint: "Sozialer Food-Anchor mit Zeit zum Chillen",
        phase: "social_meal",
        phaseGoal: "Energie und Gespräche am Essensanker bündeln",
      },
    ];
  }

  if (planMode === "evening") {
    return [
      {
        index: 0,
        kind: "lunch",
        label: "Social Start",
        hint: "Frühes Essen oder Drink als Startpunkt",
        phase: "social_warmup",
        phaseGoal: "Die Gruppe locker zusammenbringen",
      },
      {
        index: 1,
        kind: "activity",
        label: "Erlebnis",
        hint: "Workshop, Event oder Aktivität",
        phase: "social_activity",
        phaseGoal: "Einen gemeinsamen Erinnerungsmoment erzeugen",
      },
      {
        index: 2,
        kind: "nightlife",
        label: "Peak",
        hint: "Bar, Rooftop, Sunset oder Club",
        phase: "social_peak",
        phaseGoal: "Mit einem klaren sozialen Peak enden",
      },
    ];
  }

  return [
    {
      index: 0,
      kind: "breakfast",
      label: "Locker ankommen",
      hint: "Cafe, Brunch oder Park-Treff",
      phase: "social_warmup",
      phaseGoal: "Locker starten und die Gruppe synchronisieren",
    },
    {
      index: 1,
      kind: "activity",
      label: "Hauptaktivität",
      hint: "Action, Erlebnis oder Outdoor-Modul",
      phase: "social_activity",
      phaseGoal: "Ein gemeinsames Erlebnis mit echter Gruppendynamik schaffen",
    },
    {
      index: 2,
      kind: "lunch",
      label: "Essen & Pause",
      hint: "Restaurant, Food Market oder Picknick",
      phase: "social_meal",
      phaseGoal: "Essen als sozialen Mittelpunkt des Tages setzen",
    },
    {
      index: 3,
      kind: "activity",
      label: "Flexible Zweitaktivität",
      hint: "Optionaler zweiter Block mit lockerer Struktur",
      phase: "social_flex",
      phaseGoal: "Den Plan modular und spontan weiterführen",
    },
    {
      index: 4,
      kind: "nightlife",
      label: "Ausklang / Peak",
      hint: "Bar, Sunset, Rooftop oder Party",
      phase: "social_peak",
      phaseGoal: "Einen klaren sozialen Höhepunkt setzen",
    },
  ];
}

export function isStrongFriendsCandidate(loc: LocationRow) {
  const signals = inferFriendsSignals(loc);

  if (
    hasOccasionTag(loc, "friends") ||
    hasAudience(loc, "friends") ||
    hasSubtype(
      loc,
      "workshop_pottery",
      "workshop_painting",
      "cocktail_workshop",
      "paintball",
      "gokart",
      "wakeboard",
      "climbing",
      "bowling",
      "minigolf",
      "lasertag"
    )
  ) {
    return true;
  }

  const score =
    signals.groupEnergy +
    signals.socialEase +
    signals.flexibility +
    signals.interaction +
    signals.fun +
    signals.foodAnchor +
    signals.peak;

  return score >= 3;
}

export function friendsRetrievalBoost(loc: LocationRow) {
  let score = 0;
  const signals = inferFriendsSignals(loc);
  const partyPeakSubtype = hasSubtype(loc, "nightclub", "disco", "live_music", "afterhour");

  if (hasSubtype(loc, "workshop_pottery", "workshop_painting", "cocktail_workshop", "paintball", "gokart", "wakeboard", "climbing", "bowling", "minigolf", "lasertag")) score += 16;
  if (hasSubtype(loc, "pub", "cocktail_bar", "rooftop_bar", "street_food")) score += 8;

  score += signals.groupEnergy * 5;
  score += signals.socialEase * 5;
  score += signals.flexibility * 5;
  score += signals.spontaneity * 4;
  score += signals.interaction * 6;
  score += signals.fun * 5;
  score += signals.foodAnchor * 6;
  score += signals.peak * 2;
  score += signals.outdoor * 4;
  score += signals.comfort * 5;

  if (partyPeakSubtype) score -= 18;

  if (!isStrongFriendsCandidate(loc)) score -= 30;

  return score;
}

export function friendsPhaseFitBonus(
  phase: OccasionPhase | null | undefined,
  candidate: ScoredLocation
) {
  if (!phase) return 0;

  const signals = inferFriendsSignals(candidate);
  if (phase === "social_warmup") {
    return signals.socialEase * 8 + signals.flexibility * 5 + signals.foodAnchor * 4;
  }

  if (phase === "social_activity") {
    return (
      signals.groupEnergy * 7 +
      signals.interaction * 8 +
      signals.fun * 7 +
      signals.outdoor * 4
    );
  }

  if (phase === "social_meal") {
    return signals.foodAnchor * 9 + signals.socialEase * 6 + signals.comfort * 4;
  }

  if (phase === "social_flex") {
    return signals.flexibility * 8 + signals.spontaneity * 6 + signals.fun * 4;
  }

  if (phase === "social_peak") {
    return signals.peak * 6 + signals.groupEnergy * 4 + signals.spontaneity * 4 + signals.socialEase * 4 + signals.comfort * 2;
  }

  return 0;
}

export function friendsPhaseMismatchPenalty(
  phase: OccasionPhase | null | undefined,
  candidate: ScoredLocation
) {
  if (!phase) return 0;

  const category = classify(candidate);
  const isPeakNightlife = hasSubtype(candidate, "nightclub", "disco", "afterhour");
  const isBarSocial = hasSubtype(candidate, "pub", "cocktail_bar", "rooftop_bar");
  const hasFoodAnchor =
    category === "restaurant" || category === "cafe" || hasSubtype(candidate, "late_food");

  let penalty = 0;

  if (phase === "social_meal" && isPeakNightlife && !hasFoodAnchor) {
    penalty += 22;
  }

  if (phase === "social_warmup" && isPeakNightlife) {
    penalty += 14;
  }

  if (phase === "social_peak" && isPeakNightlife && !isBarSocial) {
    penalty += 10;
  }

  if (phase === "social_peak" && category === "event") {
    penalty += 64;
  }

  return penalty;
}

export function friendsGoalBoost(
  goal: PlanVariantGoal,
  candidate: ScoredLocation
) {
  const signals = inferFriendsSignals(candidate);

  if (goal === "best_match") {
    return signals.interaction * 5 + signals.fun * 4 + signals.foodAnchor * 5 + signals.socialEase * 4;
  }

  if (goal === "shortest_route") {
    return signals.socialEase * 5 + signals.foodAnchor * 4 + signals.comfort * 4;
  }

  if (goal === "more_diverse") {
    return (
      signals.fun * 5 +
      signals.outdoor * 5 +
      signals.spontaneity * 5 +
      signals.peak * 2
    );
  }

  if (goal === "premium") {
    return signals.peak * 4 + signals.fun * 4 + signals.comfort * 6 + signals.foodAnchor * 3;
  }

  return 0;
}

export function friendsVariantLabel(goal: PlanVariantGoal) {
  if (goal === "best_match") return "Classic Friends Day";
  if (goal === "shortest_route") return "Easy Friends Day";
  if (goal === "more_diverse") return "Active Friends Day";
  if (goal === "premium") return "Peak Friends Day";
  return "Friends Day";
}

export function friendsVariantReason(goal: PlanVariantGoal) {
  if (goal === "best_match") {
    return "Diese Freunde-Variante priorisiert die ausgewogenste Mischung aus Erlebnis, Essen, sozialem Flow und lockerem Ausklang.";
  }

  if (goal === "shortest_route") {
    return "Diese Freunde-Variante hält den Ablauf bewusst einfach, reduziert Reibung und funktioniert gut für entspannte Gruppen mit wenig Planungsstress.";
  }

  if (goal === "more_diverse") {
    return "Diese Freunde-Variante setzt stärker auf Aktivität, Wechsel und spontane Dynamik zwischen Erlebnis, Outdoor und Social Time.";
  }

  if (goal === "premium") {
    return "Diese Freunde-Variante priorisiert stärkere Peak-Momente, besondere Locations und einen höheren gemeinsamen Erinnerungswert.";
  }

  return "Alternative Freunde-Variante.";
}

export function explainFriendsPhaseFit(params: {
  phase: OccasionPhase | null | undefined;
  candidate: ScoredLocation;
}) {
  const { phase, candidate } = params;
  if (!phase) return [];

  const signals = inferFriendsSignals(candidate);

  if (phase === "social_warmup") {
    return dedupeReasons([
      signals.socialEase >= 7 ? "lockerer Start fuer die ganze Gruppe" : null,
      signals.flexibility >= 6 ? "laesst der Gruppe Spielraum statt Ueberplanung" : null,
      signals.foodAnchor >= 5 ? "funktioniert gut als gemeinsamer Anker zum Ankommen" : null,
    ]);
  }

  if (phase === "social_activity") {
    return dedupeReasons([
      signals.interaction >= 7 ? "foerdert Gruppendynamik und gemeinsame Erinnerungen" : null,
      signals.fun >= 7 ? "bringt spuerbar Energie in die Gruppe" : null,
      signals.outdoor >= 6 ? "funktioniert gut als aktiver Szenenwechsel" : null,
    ]);
  }

  if (phase === "social_meal") {
    return dedupeReasons([
      signals.foodAnchor >= 7 ? "setzt einen klaren sozialen Essensanker" : null,
      signals.socialEase >= 6 ? "haelt Gesprache und Flow zusammen" : null,
      signals.comfort >= 6 ? "passt gut fuer einen laengeren gemeinsamen Stop" : null,
    ]);
  }

  if (phase === "social_flex") {
    return dedupeReasons([
      signals.flexibility >= 7 ? "laesst Raum fuer Spontaneitaet statt starrer Planung" : null,
      signals.spontaneity >= 6 ? "funktioniert gut als offener Anschluss-Stop" : null,
      signals.fun >= 6 ? "haelt den Flow locker und lebendig" : null,
    ]);
  }

  if (phase === "social_peak") {
    return dedupeReasons([
      signals.peak >= 7 ? "liefert einen klaren gemeinsamen Peak-Moment" : null,
      signals.groupEnergy >= 6 ? "passt gut, wenn die Gruppe zusammen hochfahren soll" : null,
      signals.spontaneity >= 6 ? "funktioniert gut als lebendiger Ausklang" : null,
      signals.socialEase >= 6 ? "bleibt sozial und gruppentauglich statt zu club-fokussiert" : null,
    ]);
  }

  return [];
}

export function explainFriendsPhaseMismatch(params: {
  phase: OccasionPhase | null | undefined;
  candidate: ScoredLocation;
}) {
  const { phase, candidate } = params;
  if (!phase) return [];

  const category = classify(candidate);
  const isPeakNightlife = hasSubtype(candidate, "nightclub", "disco", "afterhour");
  const isBarSocial = hasSubtype(candidate, "pub", "cocktail_bar", "rooftop_bar");
  const hasFoodAnchor =
    category === "restaurant" || category === "cafe" || hasSubtype(candidate, "late_food");

  if (phase === "social_meal" && isPeakNightlife && !hasFoodAnchor) {
    return ["zu club-lastig fuer einen sozialen Essensanker"];
  }

  if (phase === "social_warmup" && isPeakNightlife) {
    return ["eskaliert zu frueh fuer einen lockeren Gruppenstart"];
  }

  if (phase === "social_peak" && isPeakNightlife && !isBarSocial) {
    return ["zieht zu stark in echte Partynacht statt in einen Friends-Peak"];
  }

  if (phase === "social_peak" && category === "event") {
    return ["setzt eher noch ein zweites Event als einen sozialen Ausklang"];
  }

  return [];
}

export const friendsOccasion = createOccasionModule<FriendsSignals>({
  key: "friends",
  inferSignals: inferFriendsSignals,
  isStrongCandidate: isStrongFriendsCandidate,
  retrievalBoost: friendsRetrievalBoost,
  buildSlotTemplate: buildFriendsSlotTemplate,
  phaseFitBonus: friendsPhaseFitBonus,
  phaseMismatchPenalty: friendsPhaseMismatchPenalty,
  goalBoost: friendsGoalBoost,
  explainPhaseFit: explainFriendsPhaseFit,
  explainPhaseMismatch: explainFriendsPhaseMismatch,
  variantMeta(goal: PlanVariantGoal) {
    return {
      label: friendsVariantLabel(goal),
      reason: friendsVariantReason(goal),
    };
  },
});
