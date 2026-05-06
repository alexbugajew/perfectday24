import { classify } from "./features";
import { dedupeReasons } from "./occasions/helpers";
import type {
  LocationCategory,
  OccasionPhase,
  PlannedStop,
  ScoredLocation,
  SlotKind,
  StopExplanation,
} from "./types";

export function buildStopReasons(params: {
  candidate: ScoredLocation;
  occasion: string;
  strictMatch: boolean;
  travelMin: number | null;
  usedCategories: LocationCategory[];
  slotKind: SlotKind;
  phase?: OccasionPhase | null;
  phaseGoal?: string | null;
  occasionReasons?: string[];
}) {
  const {
    candidate,
    occasion,
    strictMatch,
    travelMin,
    usedCategories,
    slotKind,
    phase,
    phaseGoal,
    occasionReasons = [],
  } = params;
  const reasons: string[] = [];
  const cat = classify(candidate);
  reasons.push(...occasionReasons);

  if (occasion === "date" && phaseGoal) {
    reasons.push(phaseGoal);
  }

  if (strictMatch) {
    if (slotKind === "breakfast") reasons.push("passt perfekt zum Frühstücks-Slot");
    else if (slotKind === "lunch") reasons.push("passt gut zum Lunch-Slot");
    else if (slotKind === "dinner") reasons.push("passt gut zum Dinner-Slot");
    else if (slotKind === "activity") reasons.push("passt gut als Aktivität");
  }

  if ((candidate.prefBoost ?? 0) > 0) reasons.push("passt zu deinen Vorlieben");

  if (travelMin != null) {
    if (travelMin <= 10) reasons.push("sehr kurze Wegezeit");
    else if (travelMin <= 20) reasons.push("gut erreichbar");
  }

  if (occasion === "date" && (cat === "cafe" || cat === "culture" || cat === "nightlife")) {
    reasons.push("passt gut zu einem Date");
  }

  if (occasion === "date" && phase === "warmup" && cat === "cafe") {
    reasons.push("lockerer Einstieg mit wenig Druck");
  }

  if (occasion === "date" && phase === "shared_experience" && (cat === "activity" || cat === "event")) {
    reasons.push("gemeinsame Aktivitaet bringt Dynamik");
  }

  if (occasion === "date" && phase === "deepen" && (cat === "restaurant" || cat === "culture")) {
    reasons.push("gut fuer laengere und tiefere Gespräche");
  }

  if (occasion === "date" && phase === "highlight") {
    reasons.push("setzt einen besonderen Moment im Ablauf");
  }

  if (occasion === "date" && phase === "close" && (cat === "nightlife" || cat === "restaurant" || cat === "culture")) {
    reasons.push("funktioniert gut als ruhiger positiver Ausklang");
  }

  if (occasion === "friends" && (cat === "activity" || cat === "nightlife")) {
    reasons.push("passt gut für Freunde/Gruppen");
  }

  if (occasion === "friends" && phaseGoal) {
    reasons.push(phaseGoal);
  }

  if (occasion === "friends" && phase === "social_warmup") {
    reasons.push("lockerer Start für die ganze Gruppe");
  }

  if (occasion === "friends" && phase === "social_activity") {
    reasons.push("fördert Gruppendynamik und gemeinsame Erinnerungen");
  }

  if (occasion === "friends" && phase === "social_meal") {
    reasons.push("setzt einen klaren sozialen Essensanker");
  }

  if (occasion === "friends" && phase === "social_flex") {
    reasons.push("lässt Raum für Spontaneität statt Überplanung");
  }

  if (occasion === "friends" && phase === "social_peak") {
    reasons.push("liefert einen klaren gemeinsamen Peak-Moment");
  }

  if (occasion === "family" && (cat === "activity" || cat === "culture")) {
    reasons.push("familienfreundliche Option");
  }

  if (occasion === "family" && phaseGoal) {
    reasons.push(phaseGoal);
  }

  if (occasion === "family" && phase === "arrival") {
    reasons.push("einfacher Start mit wenig Reibung");
  }

  if (occasion === "family" && phase === "main_activity") {
    reasons.push("legt das Haupt-Highlight in die stärkste Energiephase");
  }

  if (occasion === "family" && phase === "pause") {
    reasons.push("wichtige Pause für Stimmung und Energie");
  }

  if (occasion === "family" && phase === "light_activity") {
    reasons.push("hält den Nachmittag flexibel und leichter");
  }

  if (occasion === "family" && phase === "wind_down") {
    reasons.push("sorgt für einen ruhigen positiven Abschluss");
  }

  if (occasion === "party" && cat === "nightlife") {
    reasons.push("starker Party-/Nightlife-Fit");
  }

  if (occasion === "party" && phaseGoal) {
    reasons.push(phaseGoal);
  }

  if (occasion === "party" && phase === "party_warmup") {
    reasons.push("lockerer Einstieg für die ganze Gruppe");
  }

  if (occasion === "party" && phase === "party_social") {
    reasons.push("baut Stimmung und Gruppendynamik auf");
  }

  if (occasion === "party" && phase === "party_peak") {
    reasons.push("setzt den klaren Höhepunkt der Nacht");
  }

  if (occasion === "party" && phase === "party_after") {
    reasons.push("hält die Nacht nach dem Peak zusammen");
  }

  if (occasion === "party" && phase === "party_food") {
    reasons.push("schließt die Nacht mit einem späten Food-Stop sauber ab");
  }

  if (occasion === "tourism" && (cat === "culture" || cat === "activity")) {
    reasons.push("gut für Tourismus / Entdecken");
  }

  if (occasion === "tourism" && phaseGoal) {
    reasons.push(phaseGoal);
  }

  if (occasion === "tourism" && (phase === "tour_start" || phase === "tour_highlight")) {
    reasons.push("setzt früh ein starkes Must-see");
  }

  if (occasion === "tourism" && phase === "tour_culture") {
    reasons.push("vertieft den Tag kulturell ohne den Flow zu brechen");
  }

  if (occasion === "tourism" && phase === "tour_lunch") {
    reasons.push("integriert die Mittagspause ohne großen Umweg");
  }

  if (occasion === "tourism" && phase === "tour_relaxed") {
    reasons.push("lockert das Sightseeing am Nachmittag auf");
  }

  if (occasion === "tourism" && phase === "tour_optional") {
    reasons.push("fügt optionalen Genuss oder einen kleinen Scenic-Stop ein");
  }

  if (occasion === "tourism" && phase === "tour_dinner") {
    reasons.push("gibt dem Sightseeing-Tag einen klaren Abschluss");
  }

  const foodCount = usedCategories.filter((c) => c === "restaurant" || c === "cafe").length;
  if ((cat === "activity" || cat === "culture" || cat === "nightlife") && foodCount >= 1) {
    reasons.push("sorgt für mehr Abwechslung im Plan");
  }

  return dedupeReasons(reasons, 4);
}

export function buildExplanations(stops: PlannedStop[]): StopExplanation[] {
  return stops.map((stop) => ({
    stopIndex: stop.index,
    locationId: stop.item?.id ?? null,
    reasons: stop.reasons ?? [],
  }));
}
