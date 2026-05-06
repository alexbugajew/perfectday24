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

export type PartySignals = {
  warmup: number;
  social: number;
  peak: number;
  late: number;
  walkable: number;
  premium: number;
  drinks: number;
  groupFit: number;
  fun: number;
};

export function inferPartySignals(loc: LocationRow): PartySignals {
  const cat = classify(loc);
  const text = buildLocationSearchText(loc);
  const structuredParty = hasOccasionTag(loc, "party") || hasAudience(loc, "party");
  const structuredWarmup = hasSubtype(loc, "cocktail_bar", "pub", "rooftop_bar");
  const structuredPeak = hasSubtype(loc, "nightclub", "disco", "live_music");
  const structuredLate = hasSubtype(loc, "afterhour", "late_food");

  let warmup = 0;
  let social = 0;
  let peak = 0;
  let late = 0;
  let walkable = 0;
  let premium = 0;
  let drinks = 0;
  let groupFit = 0;
  let fun = 0;

  if (cat === "nightlife") {
    social += 3;
    drinks += 3;
    fun += 3;
    groupFit += 2;
  }

  if (cat === "event") {
    peak += 4;
    fun += 3;
    groupFit += 2;
  }

  if (cat === "restaurant" || cat === "cafe") {
    warmup += 2;
    social += 1;
    peak -= 1;
  }

  if (structuredParty) {
    social += 4;
    groupFit += 4;
    fun += 3;
  }

  if (structuredWarmup) {
    warmup += 5;
    social += 4;
    drinks += 5;
    groupFit += 2;
  }

  if (structuredPeak) {
    peak += 7;
    fun += 4;
    late += 1;
  }

  if (structuredLate) {
    late += 6;
    walkable += 1;
  }

  if (hasOpeningInfo(loc)) {
    late += 1;
    walkable += 1;
  }

  if (hasStrongRating(loc) && hasRatingVolume(loc, 20)) {
    premium += 2;
    social += 1;
  }

  warmup += scoreTextSupport(text, ["rooftop", "pub", "bar", "lounge", "cafe"], 2, structuredWarmup);
  social += scoreTextSupport(text, ["bar", "cocktail", "eventbar", "pub", "rooftop", "lounge"], 2, structuredParty || structuredWarmup);
  peak += scoreTextSupport(text, ["club", "dj", "dance", "festival", "live", "event", "techno", "hiphop"], 2, structuredPeak);
  late += scoreTextSupport(text, ["after", "late", "24", "spati", "späti", "streetfood", "pizza", "doener", "döner"], 2, structuredLate);
  walkable += scoreTextSupport(text, ["bar", "club", "pub", "rooftop", "lounge", "späti", "spati"], 1, structuredWarmup || structuredPeak || structuredLate);
  premium += scoreTextSupport(text, ["rooftop", "exclusive", "vip", "signature", "premium", "stylish"], 2, structuredWarmup || structuredPeak);
  drinks += scoreTextSupport(text, ["cocktail", "bar", "drink", "wine", "beer", "happy hour"], 2, structuredWarmup);
  groupFit += scoreTextSupport(text, ["bar", "club", "event", "festival", "pub", "lounge"], 2, structuredParty || structuredPeak || structuredWarmup);
  fun += scoreTextSupport(text, ["dance", "club", "dj", "event", "festival", "party"], 2, structuredParty || structuredPeak);

  if (!structuredPeak && (cat === "restaurant" || cat === "cafe")) {
    peak -= 1;
    late -= 1;
  }

  return capSignals(
    {
      warmup,
      social,
      peak,
      late,
      walkable,
      premium,
      drinks,
      groupFit,
      fun,
    },
    {
      warmup: 10,
      social: 12,
      peak: 12,
      late: 10,
      walkable: 8,
      premium: 8,
      drinks: 10,
      groupFit: 10,
      fun: 10,
    }
  );
}

export function buildPartySlotTemplate(planMode: PlanMode): SlotDefinition[] {
  if (planMode === "morning") {
    return [
      {
        index: 0,
        kind: "activity",
        label: "Day Activity",
        hint: "Optionales Fun-Modul vor der Nacht",
        phase: "party_warmup",
        phaseGoal: "Optional tagsüber etwas gemeinsam erleben",
      },
      {
        index: 1,
        kind: "lunch",
        label: "Early Social",
        hint: "Früher Drink oder lockerer Lunch",
        phase: "party_social",
        phaseGoal: "Früh socialisen, ohne die Nacht zu verheizen",
      },
    ];
  }

  if (planMode === "midday") {
    return [
      {
        index: 0,
        kind: "activity",
        label: "Day Warm-up",
        hint: "Leichter Start mit Spaß oder Bewegung",
        phase: "party_warmup",
        phaseGoal: "Gemeinsame Energie für den Abend aufbauen",
      },
      {
        index: 1,
        kind: "lunch",
        label: "Early Drinks",
        hint: "Lunch oder erste Drinks",
        phase: "party_social",
        phaseGoal: "Die Gruppe locker in Stimmung bringen",
      },
      {
        index: 2,
        kind: "nightlife",
        label: "Pre-Drinks",
        hint: "Leichte Bar oder Rooftop als Ramp-up",
        phase: "party_social",
        phaseGoal: "Vor dem Peak gemeinsam hochfahren",
      },
    ];
  }

  if (planMode === "evening") {
    return [
      {
        index: 0,
        kind: "nightlife",
        label: "Warm-up",
        hint: "Bar, Rooftop oder lockerer Einstieg",
        phase: "party_warmup",
        phaseGoal: "Entspannt starten und die Gruppe sammeln",
      },
      {
        index: 1,
        kind: "nightlife",
        label: "Pre-Drinks",
        hint: "Lively Bar oder Social Spot",
        phase: "party_social",
        phaseGoal: "Dynamik und Energie spürbar steigern",
      },
      {
        index: 2,
        kind: "nightlife",
        label: "Peak",
        hint: "Club, Event oder DJ-Location",
        phase: "party_peak",
        phaseGoal: "Den Höhepunkt der Nacht klar setzen",
      },
      {
        index: 3,
        kind: "anything",
        label: "Afterparty",
        hint: "Late Bar, Chill Spot oder kleiner Weiterzieh-Moment",
        phase: "party_after",
        phaseGoal: "Nach dem Peak nicht abrupt zerfallen",
      },
    ];
  }

  return [
    {
      index: 0,
      kind: "activity",
      label: "Day Activity",
      hint: "Optionales Fun-Modul am Tag",
      phase: "party_warmup",
      phaseGoal: "Optional gemeinsam Energie aufbauen",
    },
    {
      index: 1,
      kind: "lunch",
      label: "Early Social",
      hint: "Lunch oder erste Drinks",
      phase: "party_social",
      phaseGoal: "Social Start ohne Druck",
    },
    {
      index: 2,
      kind: "nightlife",
      label: "Pre-Drinks",
      hint: "Bar oder Rooftop als Ramp-up",
      phase: "party_social",
      phaseGoal: "Die Nacht in die richtige Energie bringen",
    },
    {
      index: 3,
      kind: "nightlife",
      label: "Main Club",
      hint: "Club, DJ-Location oder Event",
      phase: "party_peak",
      phaseGoal: "Den Hauptwert der Nacht im Peak bündeln",
    },
    {
      index: 4,
      kind: "anything",
      label: "Afterparty",
      hint: "Late Spot, weitere Bar oder entspannter Ausklang",
      phase: "party_after",
      phaseGoal: "Die Gruppe nach dem Peak zusammenhalten",
    },
    {
      index: 5,
      kind: "lunch",
      label: "Late Food",
      hint: "Später Snack oder 24/7 Food-Stop",
      phase: "party_food",
      phaseGoal: "Mit einem guten Late-Food-Moment sauber schließen",
    },
  ];
}

export function isStrongPartyCandidate(loc: LocationRow) {
  const signals = inferPartySignals(loc);

  if (
    hasOccasionTag(loc, "party") ||
    hasAudience(loc, "party") ||
    hasSubtype(
      loc,
      "cocktail_bar",
      "pub",
      "rooftop_bar",
      "nightclub",
      "disco",
      "live_music",
      "afterhour",
      "late_food"
    )
  ) {
    return true;
  }

  const score =
    signals.warmup +
    signals.social +
    signals.peak +
    signals.late +
    signals.walkable +
    signals.groupFit +
    signals.fun;

  return score >= 3;
}

export function partyRetrievalBoost(loc: LocationRow) {
  let score = 0;
  const signals = inferPartySignals(loc);
  const warmupSubtype = hasSubtype(loc, "cocktail_bar", "pub", "rooftop_bar");
  const peakSubtype = hasSubtype(loc, "nightclub", "disco", "live_music");
  const lateSubtype = hasSubtype(loc, "afterhour", "late_food");

  if (hasSubtype(loc, "cocktail_bar", "pub", "rooftop_bar", "nightclub", "disco", "live_music", "afterhour", "late_food")) score += 18;
  if (peakSubtype) score += 10;
  if (lateSubtype) score += 8;

  score += signals.warmup * 2;
  score += signals.social * 5;
  score += signals.peak * 8;
  score += signals.late * 6;
  score += signals.walkable * 5;
  score += signals.premium * 3;
  score += signals.drinks * 5;
  score += signals.groupFit * 4;
  score += signals.fun * 5;

  if (!warmupSubtype && !peakSubtype && !lateSubtype) score -= 10;

  if (!isStrongPartyCandidate(loc)) score -= 30;

  return score;
}

export function partyPhaseFitBonus(
  phase: OccasionPhase | null | undefined,
  candidate: ScoredLocation
) {
  if (!phase) return 0;

  const signals = inferPartySignals(candidate);
  if (phase === "party_warmup") {
    return signals.warmup * 8 + signals.social * 4 + signals.walkable * 3;
  }

  if (phase === "party_social") {
    return signals.social * 8 + signals.drinks * 7 + signals.groupFit * 4;
  }

  if (phase === "party_peak") {
    return signals.peak * 11 + signals.fun * 6 + signals.groupFit * 4 + signals.drinks * 2;
  }

  if (phase === "party_after") {
    return signals.late * 9 + signals.social * 4 + signals.walkable * 3;
  }

  if (phase === "party_food") {
    return signals.late * 6 + signals.walkable * 4 + signals.groupFit * 2;
  }

  return 0;
}

export function partyPhaseMismatchPenalty(
  phase: OccasionPhase | null | undefined,
  candidate: ScoredLocation
) {
  if (!phase) return 0;

  const isPeakSpot = hasSubtype(candidate, "nightclub", "disco", "live_music");
  const isWarmupSpot = hasSubtype(candidate, "cocktail_bar", "pub", "rooftop_bar");
  const isLateSpot = hasSubtype(candidate, "afterhour", "late_food", "pub");
  const isFoodOnly = (classify(candidate) === "restaurant" || classify(candidate) === "cafe") && !isWarmupSpot && !isLateSpot;

  let penalty = 0;

  if (phase === "party_warmup" && isPeakSpot && !isWarmupSpot) {
    penalty += 18;
  }

  if (phase === "party_peak" && !isPeakSpot) {
    penalty += 18;
  }

  if (phase === "party_after" && isPeakSpot && !isLateSpot) {
    penalty += 16;
  }

  if (phase === "party_after" && isFoodOnly) {
    penalty += 10;
  }

  if (phase === "party_food" && !isLateSpot && classify(candidate) === "nightlife") {
    penalty += 12;
  }

  return penalty;
}

export function partyGoalBoost(
  goal: PlanVariantGoal,
  candidate: ScoredLocation
) {
  const signals = inferPartySignals(candidate);

  if (goal === "best_match") {
    return signals.social * 5 + signals.peak * 7 + signals.late * 4;
  }

  if (goal === "shortest_route") {
    return signals.walkable * 8 + signals.social * 4 + signals.groupFit * 3;
  }

  if (goal === "more_diverse") {
    return signals.social * 5 + signals.fun * 6 + signals.late * 5 + signals.drinks * 4;
  }

  if (goal === "premium") {
    return signals.premium * 8 + signals.peak * 6 + signals.social * 3 + signals.drinks * 3;
  }

  return 0;
}

export function partyVariantLabel(goal: PlanVariantGoal) {
  if (goal === "best_match") return "Best Party Flow";
  if (goal === "shortest_route") return "Club Focus";
  if (goal === "more_diverse") return "Bar Hopping";
  if (goal === "premium") return "Premium Night";
  return "Night Out";
}

export function partyVariantReason(goal: PlanVariantGoal) {
  if (goal === "best_match") {
    return "Diese Party-Variante baut die Nacht stufenweise auf: entspannter Start, socialer Ramp-up, klarer Peak und sauberer Late Flow.";
  }

  if (goal === "shortest_route") {
    return "Diese Party-Variante bringt euch schneller und mit weniger Umwegen in den Club-Fokus und hält die Nacht bewusst kompakt.";
  }

  if (goal === "more_diverse") {
    return "Diese Party-Variante setzt auf mehr Bars, wechselnde Vibes und eine lockerere Nacht mit mehreren sozialen Stops.";
  }

  if (goal === "premium") {
    return "Diese Party-Variante priorisiert hochwertigere Bars, stylischere Locations und einen exklusiveren Night-Out-Flow.";
  }

  return "Alternative Party-Variante.";
}

export function explainPartyPhaseFit(params: {
  phase: OccasionPhase | null | undefined;
  candidate: ScoredLocation;
}) {
  const { phase, candidate } = params;
  if (!phase) return [];

  const signals = inferPartySignals(candidate);

  if (phase === "party_warmup") {
    return dedupeReasons([
      signals.warmup >= 7 ? "lockerer Einstieg fuer die ganze Gruppe" : null,
      signals.social >= 6 ? "bringt die Gruppe zusammen ohne direkt zu ueberziehen" : null,
      signals.walkable >= 5 ? "funktioniert gut als frueher Startpunkt der Nacht" : null,
    ]);
  }

  if (phase === "party_social") {
    return dedupeReasons([
      signals.social >= 8 ? "baut Stimmung und Gruppendynamik auf" : null,
      signals.drinks >= 7 ? "passt gut fuer Pre-Drinks oder einen Social-Ramp-up" : null,
      signals.groupFit >= 6 ? "funktioniert gut fuer eine groessere Runde" : null,
    ]);
  }

  if (phase === "party_peak") {
    return dedupeReasons([
      signals.peak >= 8 ? "setzt den klaren Hoehepunkt der Nacht" : null,
      signals.fun >= 7 ? "liefert Energie statt nur Hintergrundkulisse" : null,
      signals.groupFit >= 6 ? "zieht die Gruppe gemeinsam in den Peak" : null,
    ]);
  }

  if (phase === "party_after") {
    return dedupeReasons([
      signals.late >= 7 ? "haelt die Nacht nach dem Peak zusammen" : null,
      signals.social >= 5 ? "funktioniert gut fuer den gemeinsamen Weiterzieh-Moment" : null,
      signals.walkable >= 5 ? "passt gut als spaeter Anschluss-Stop" : null,
    ]);
  }

  if (phase === "party_food") {
    return dedupeReasons([
      signals.late >= 6 ? "schliesst die Nacht mit einem spaeten Food-Moment sauber ab" : null,
      signals.walkable >= 5 ? "liegt gut auf dem Heim- oder Weiterweg" : null,
      signals.groupFit >= 5 ? "funktioniert gut als letzter gemeinsamer Stop" : null,
    ]);
  }

  return [];
}

export function explainPartyPhaseMismatch(params: {
  phase: OccasionPhase | null | undefined;
  candidate: ScoredLocation;
}) {
  const { phase, candidate } = params;
  if (!phase) return [];

  const category = classify(candidate);
  const isPeakSpot = hasSubtype(candidate, "nightclub", "disco", "live_music");
  const isWarmupSpot = hasSubtype(candidate, "cocktail_bar", "pub", "rooftop_bar");
  const isLateSpot = hasSubtype(candidate, "afterhour", "late_food", "pub");
  const isFoodOnly = (category === "restaurant" || category === "cafe") && !isWarmupSpot && !isLateSpot;

  if (phase === "party_warmup" && isPeakSpot && !isWarmupSpot) {
    return ["zu peak-lastig fuer einen lockeren Party-Start"];
  }

  if (phase === "party_peak" && !isPeakSpot) {
    return ["hat nicht genug echten Peak- oder Club-Charakter fuer den Hoehepunkt"];
  }

  if (phase === "party_after" && isPeakSpot && !isLateSpot) {
    return ["ist eher Peak als After- oder Weiterzieh-Spot"];
  }

  if (phase === "party_after" && isFoodOnly) {
    return ["wirkt zu statisch fuer den After-Flow nach dem Peak"];
  }

  if (phase === "party_food" && !isLateSpot && category === "nightlife") {
    return ["bleibt zu sehr Nightlife statt in einen spaeten Food-Stop zu kippen"];
  }

  return [];
}

export const partyOccasion = createOccasionModule<PartySignals>({
  key: "party",
  inferSignals: inferPartySignals,
  isStrongCandidate: isStrongPartyCandidate,
  retrievalBoost: partyRetrievalBoost,
  buildSlotTemplate: buildPartySlotTemplate,
  phaseFitBonus: partyPhaseFitBonus,
  phaseMismatchPenalty: partyPhaseMismatchPenalty,
  goalBoost: partyGoalBoost,
  explainPhaseFit: explainPartyPhaseFit,
  explainPhaseMismatch: explainPartyPhaseMismatch,
  variantMeta(goal: PlanVariantGoal) {
    return {
      label: partyVariantLabel(goal),
      reason: partyVariantReason(goal),
    };
  },
});
