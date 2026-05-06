import { constructRoute } from "./route-construction";
import { optimizeRoute } from "./route-optimization";
import { summarizeRoute } from "./summary";
import { classify } from "./features";
import { buildInterestKeywords, preferenceBoost } from "./interest";
import { getOccasionModule } from "./occasions/registry";
import type {
  PlanMode,
  PlanVariant,
  PlanningContext,
  PlannedStop,
  RouteSummaryLite,
  ScoredLocation,
} from "./types";

function cloneCandidates(candidates: ScoredLocation[]): ScoredLocation[] {
  return candidates.map((c) => ({ ...c }));
}

function dedupeVariantCandidates(candidates: ScoredLocation[]) {
  const seen = new Set<string>();
  const out: ScoredLocation[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    out.push(candidate);
  }

  return out;
}

function scoreVariantStops(stops: PlannedStop[]) {
  let total = 0;

  for (const stop of stops) {
    if (!stop.item) continue;
    total += stop.item.totalScore ?? 0;
  }

  return Math.round(total);
}

function buildVariantGroupSummary(context: PlanningContext, stops: PlannedStop[]) {
  if (!context.groupSignals.enabled || context.groupSignals.participantCount <= 1) {
    return null;
  }

  const decisions = stops
    .map((stop) => stop.groupDecision)
    .filter((decision): decision is NonNullable<PlannedStop["groupDecision"]> => Boolean(decision));

  if (decisions.length === 0) {
    return null;
  }

  const sharedCount = decisions.filter((decision) => decision.compromiseLevel === "shared").length;
  const balancedCount = decisions.filter((decision) => decision.compromiseLevel === "balanced").length;
  const singlePreferenceCount = decisions.filter(
    (decision) => decision.compromiseLevel === "single_preference"
  ).length;
  const participantFocusCounts = decisions.reduce((map, decision) => {
    for (const participant of decision.matchedParticipants) {
      map.set(participant, (map.get(participant) ?? 0) + 1);
    }
    return map;
  }, new Map<string, number>());
  const topParticipant = Array.from(participantFocusCounts.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
  const focusParticipant =
    topParticipant && topParticipant[1] >= Math.max(2, sharedCount + 1) ? topParticipant[0] : null;

  let label = "Gruppenmix";
  let note = "Balanciert gemeinsame Nenner und einzelne Vorlieben.";

  if (focusParticipant && singlePreferenceCount >= Math.max(1, balancedCount)) {
    label = `Mehr für ${focusParticipant}`;
    note = `Gewichtet die Vorlieben von ${focusParticipant} etwas stärker, ohne den Gruppenfit ganz zu verlieren.`;
  } else if (sharedCount >= balancedCount && sharedCount >= singlePreferenceCount) {
    label = "Harmonischer";
    note = "Stützt sich stärker auf gemeinsame Nenner der Gruppe.";
  } else if (singlePreferenceCount > sharedCount && singlePreferenceCount >= balancedCount) {
    label = "Mehr Einzelwünsche";
    note = "Lässt bewusst mehr Raum für individuelle Vorlieben einzelner Personen.";
  } else if (balancedCount > 0) {
    label = "Ausbalanciert";
    note = "Hält mehrere Interessen gleichzeitig im Plan und verteilt Kompromisse fairer.";
  }

  const badges: string[] = [];
  if (sharedCount > 0) badges.push(`${sharedCount}x gemeinsam`);
  if (balancedCount > 0) badges.push(`${balancedCount}x balanciert`);
  if (singlePreferenceCount > 0) badges.push(`${singlePreferenceCount}x Einzelwunsch`);
  if (focusParticipant) badges.push(`Fokus ${focusParticipant}`);

  return {
    label,
    note,
    badges,
    focusParticipant,
  };
}

function buildVariantReason(goal: PlanVariant["goal"], occasion?: string) {
  if (
    occasion === "date" ||
    occasion === "family" ||
    occasion === "friends" ||
    occasion === "tourism" ||
    occasion === "party"
  ) {
    return getOccasionModule(occasion).variantMeta(goal).reason;
  }

  if (goal === "best_match") {
    return "Beste Übereinstimmung mit deinen Vorlieben, dem Anlass und den wichtigsten Qualitäts-Signalen.";
  }

  if (goal === "shortest_route") {
    return "Diese Variante priorisiert kurze Wege und eine kompaktere Route mit möglichst wenig Transferzeit.";
  }

  if (goal === "more_diverse") {
    return "Diese Variante legt mehr Wert auf Abwechslung zwischen Essen, Aktivitäten, Kultur und Erlebnischarakter.";
  }

  if (goal === "premium") {
    return "Diese Variante priorisiert höherwertige, besser bewertete und insgesamt attraktivere Locations.";
  }

  return "Alternative Routenvariante.";
}

function buildVariantBadges(goal: PlanVariant["goal"], summary: RouteSummaryLite, occasion?: string) {
  const badges: string[] = [];

  if (occasion === "date") {
    if (goal === "best_match") badges.push("Klassisch");
    if (goal === "shortest_route") badges.push("Locker");
    if (goal === "more_diverse") badges.push("Spielerisch");
    if (goal === "premium") badges.push("Romantisch");
  } else if (occasion === "family") {
    if (goal === "best_match") badges.push("Zuverlässig");
    if (goal === "shortest_route") badges.push("Stressarm");
    if (goal === "more_diverse") badges.push("Ausgewogen");
    if (goal === "premium") badges.push("Wow");
  } else if (occasion === "friends") {
    if (goal === "best_match") badges.push("Sozial");
    if (goal === "shortest_route") badges.push("Unkompliziert");
    if (goal === "more_diverse") badges.push("Aktiv");
    if (goal === "premium") badges.push("Peak");
  } else if (occasion === "tourism") {
    if (goal === "best_match") badges.push("Highlights");
    if (goal === "shortest_route") badges.push("Walkable");
    if (goal === "more_diverse") badges.push("Entspannt");
    if (goal === "premium") badges.push("Premium");
  } else if (occasion === "party") {
    if (goal === "best_match") badges.push("Flow");
    if (goal === "shortest_route") badges.push("Club");
    if (goal === "more_diverse") badges.push("Bars");
    if (goal === "premium") badges.push("Premium");
  } else {
    if (goal === "best_match") badges.push("Empfohlen");
    if (goal === "shortest_route") badges.push("Wenig Wege");
    if (goal === "more_diverse") badges.push("Mehr Abwechslung");
    if (goal === "premium") badges.push("Premium");
  }

  if (summary.travelMin <= 35) badges.push("Kompakt");
  if (summary.distanceKm <= 6) badges.push("Nah");
  if (summary.totalMin <= 240) badges.push("Effizient");

  return badges;
}

type VariantFocus =
  | {
      type: "shared";
      label: string;
      interests: string[];
      reason: string;
      badges: string[];
    }
  | {
      type: "participant";
      label: string;
      participantName: string;
      interests: string[];
      reason: string;
      badges: string[];
    };

function applyVariantFocus(
  candidates: ScoredLocation[],
  focus: VariantFocus | null | undefined
) {
  if (!focus || focus.interests.length === 0) {
    return candidates;
  }

  const focusKeywords = buildInterestKeywords(focus.interests);
  if (focusKeywords.length === 0) {
    return candidates;
  }

  const bonusStrength = focus.type === "shared" ? 1.05 : 1.2;

  return [...candidates].sort((a, b) => {
    const bonusA = Math.round(preferenceBoost(a, focusKeywords) * bonusStrength);
    const bonusB = Math.round(preferenceBoost(b, focusKeywords) * bonusStrength);
    const scoreA = (a.totalScore ?? 0) + bonusA;
    const scoreB = (b.totalScore ?? 0) + bonusB;

    if (scoreB !== scoreA) return scoreB - scoreA;

    const da = a.distanceFromOriginKm ?? Number.POSITIVE_INFINITY;
    const db = b.distanceFromOriginKm ?? Number.POSITIVE_INFINITY;
    return da - db;
  });
}

function tweakForGoal(goal: PlanVariant["goal"], candidates: ScoredLocation[]) {
  const cloned = cloneCandidates(candidates);

  if (goal === "best_match") {
    return cloned.sort((a, b) => {
      if ((b.totalScore ?? 0) !== (a.totalScore ?? 0)) {
        return (b.totalScore ?? 0) - (a.totalScore ?? 0);
      }

      const da = a.distanceFromOriginKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanceFromOriginKm ?? Number.POSITIVE_INFINITY;
      return da - db;
    });
  }

  if (goal === "shortest_route") {
    return cloned.sort((a, b) => {
      const da = a.distanceFromOriginKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanceFromOriginKm ?? Number.POSITIVE_INFINITY;

      if (da !== db) return da - db;
      return (b.totalScore ?? 0) - (a.totalScore ?? 0);
    });
  }

  if (goal === "more_diverse") {
    return cloned.sort((a, b) => {
      const categoryBoost = (candidate: ScoredLocation) => {
        const cat = classify(candidate);

        if (cat === "culture") return 18;
        if (cat === "activity") return 16;
        if (cat === "event") return 15;
        if (cat === "nightlife") return 10;
        if (cat === "restaurant") return 4;
        if (cat === "cafe") return 3;
        return 0;
      };

      const scoreA = (a.totalScore ?? 0) + categoryBoost(a);
      const scoreB = (b.totalScore ?? 0) + categoryBoost(b);

      return scoreB - scoreA;
    });
  }

  if (goal === "premium") {
    return cloned.sort((a, b) => {
      const premiumScore = (candidate: ScoredLocation) => {
        const ratingBoost =
          typeof candidate.rating === "number" ? candidate.rating * 8 : 0;

        const qualityBoost =
          typeof candidate.quality_score === "number"
            ? candidate.quality_score * 0.8
            : 0;

        const importanceBoost =
          typeof candidate.importance_score === "number"
            ? candidate.importance_score * 0.6
            : 0;

        return (candidate.totalScore ?? 0) + ratingBoost + qualityBoost + importanceBoost;
      };

      return premiumScore(b) - premiumScore(a);
    });
  }

  return cloned;
}

function tweakForGoalAndOccasion(
  goal: PlanVariant["goal"],
  occasion: string,
  candidates: ScoredLocation[]
) {
  const base = tweakForGoal(goal, candidates);

  if (
    occasion !== "date" &&
    occasion !== "family" &&
    occasion !== "friends" &&
    occasion !== "tourism" &&
    occasion !== "party"
  ) {
    return base;
  }

  const occasionModule = getOccasionModule(occasion);

  return base.sort((a, b) => {
    const scoreA = (a.totalScore ?? 0) + occasionModule.goalBoost(goal, a);
    const scoreB = (b.totalScore ?? 0) + occasionModule.goalBoost(goal, b);

    if (scoreB !== scoreA) return scoreB - scoreA;

    const da = a.distanceFromOriginKm ?? Number.POSITIVE_INFINITY;
    const db = b.distanceFromOriginKm ?? Number.POSITIVE_INFINITY;
    return da - db;
  });
}

function sliceCandidatesForVariant(
  goal: PlanVariant["goal"],
  candidates: ScoredLocation[]
) {
  if (goal === "best_match") {
    return candidates.slice(0, Math.min(candidates.length, 420));
  }

  if (goal === "shortest_route") {
    return candidates.slice(0, Math.min(candidates.length, 320));
  }

  if (goal === "premium") {
    return candidates.slice(0, Math.min(candidates.length, 360));
  }

  if (goal === "more_diverse") {
    const byCategory: Record<string, ScoredLocation[]> = {
      cafe: [],
      restaurant: [],
      activity: [],
      culture: [],
      nightlife: [],
      event: [],
      other: [],
    };

    for (const candidate of candidates) {
      const cat = classify(candidate) ?? "other";
      byCategory[cat] = byCategory[cat] ?? [];
      byCategory[cat].push(candidate);
    }

    return dedupeVariantCandidates([
      ...byCategory.activity.slice(0, 90),
      ...byCategory.culture.slice(0, 90),
      ...byCategory.event.slice(0, 60),
      ...byCategory.restaurant.slice(0, 80),
      ...byCategory.cafe.slice(0, 60),
      ...byCategory.nightlife.slice(0, 70),
      ...byCategory.other.slice(0, 40),
      ...candidates.slice(0, 120),
    ]).slice(0, Math.min(candidates.length, 420));
  }

  return candidates;
}

function buildVariant(params: {
  variantId: string;
  label: string;
  goal: PlanVariant["goal"];
  context: PlanningContext;
  candidates: ScoredLocation[];
  planMode: PlanMode;
  stopOffsets?: number[];
  variationSeed?: number;
  focus?: VariantFocus | null;
  preserveCustomLabel?: boolean;
}): PlanVariant {
  const {
    variantId,
    label,
    goal,
    context,
    candidates,
    planMode,
    stopOffsets = [],
    variationSeed = 0,
    focus = null,
    preserveCustomLabel = false,
  } = params;

  const adjustedCandidates = tweakForGoalAndOccasion(
    goal,
    context.filters.occasion,
    candidates
  );
  const focusedCandidates = applyVariantFocus(adjustedCandidates, focus);
  const variantCandidates = sliceCandidatesForVariant(goal, focusedCandidates);

  const rawStops = constructRoute({
    context,
    candidates: variantCandidates,
    planMode,
    stopOffsets,
    variationSeed,
  });

  const plannedStops = optimizeRoute({
    stops: rawStops,
    origin: {
      lat: context.origin.lat,
      lng: context.origin.lng,
    },
    planMode,
  });

  const fallbackSummary: RouteSummaryLite = summarizeRoute({
    stops: plannedStops,
    origin: {
      lat: context.origin.lat,
      lng: context.origin.lng,
    },
  });

  const totalScore = scoreVariantStops(plannedStops);
  const reason = focus?.reason ?? buildVariantReason(goal, context.filters.occasion);
  const badges = [
    ...(focus?.badges ?? []),
    ...buildVariantBadges(goal, fallbackSummary, context.filters.occasion),
  ];
  const meta = getOccasionModule(context.filters.occasion).variantMeta(goal);

  return {
    variantId,
    label: preserveCustomLabel ? label : meta.label || label,
    goal,
    plannedStops,
    fallbackSummary,
    reason,
    badges,
    groupSummary: buildVariantGroupSummary(context, plannedStops),
    totalScore,
  };
}

export function buildPlanVariants(params: {
  context: PlanningContext;
  candidates: ScoredLocation[];
  planMode: PlanMode;
  stopOffsets?: number[];
  variationSeed?: number;
}): PlanVariant[] {
  const {
    context,
    candidates,
    planMode,
    stopOffsets = [],
    variationSeed = 0,
  } = params;

  const variants: PlanVariant[] = [
    buildVariant({
      variantId: "best-match",
      label: "Best Match",
      goal: "best_match",
      context,
      candidates,
      planMode,
      stopOffsets,
      variationSeed,
    }),
    buildVariant({
      variantId: "shortest-route",
      label: "Shortest Route",
      goal: "shortest_route",
      context,
      candidates,
      planMode,
      stopOffsets,
      variationSeed: variationSeed + 1,
    }),
    buildVariant({
      variantId: "more-diverse",
      label: "More Diverse",
      goal: "more_diverse",
      context,
      candidates,
      planMode,
      stopOffsets,
      variationSeed: variationSeed + 2,
    }),
    buildVariant({
      variantId: "premium",
      label: "Premium",
      goal: "premium",
      context,
      candidates,
      planMode,
      stopOffsets,
      variationSeed: variationSeed + 3,
    }),
  ];

  if (context.groupSignals.enabled && context.groupSignals.participantCount > 1) {
    if (context.groupSignals.sharedAcrossAll.length > 0) {
      variants.push(
        buildVariant({
          variantId: "shared-focus",
          label: "Mehr gemeinsamer Nenner",
          goal: "best_match",
          context,
          candidates,
          planMode,
          stopOffsets,
          variationSeed: variationSeed + 4,
          preserveCustomLabel: true,
          focus: {
            type: "shared",
            label: "Mehr gemeinsamer Nenner",
            interests: context.groupSignals.sharedAcrossAll,
            reason:
              "Diese Variante priorisiert vor allem die Interessen, die in eurer Gruppe gemeinsam geteilt werden.",
            badges: ["Gemeinsamer Nenner"],
          },
        })
      );
    }

    const participantVariants = context.groupSignals.participants
      .filter((participant) => participant.interests.length > 0)
      .slice(0, 2);

    participantVariants.forEach((participant, index) => {
      variants.push(
        buildVariant({
          variantId: `participant-focus-${index + 1}`,
          label: participant.isCurrentUser ? "Mehr für dich" : `Mehr für ${participant.name}`,
          goal: "best_match",
          context,
          candidates,
          planMode,
          stopOffsets,
          variationSeed: variationSeed + 5 + index,
          preserveCustomLabel: true,
          focus: {
            type: "participant",
            label: participant.isCurrentUser ? "Mehr für dich" : `Mehr für ${participant.name}`,
            participantName: participant.name,
            interests: participant.interests,
            reason: participant.isCurrentUser
              ? "Diese Variante gewichtet deine persönlichen Vorlieben etwas stärker als den reinen Gruppenkonsens."
              : `Diese Variante gewichtet die Vorlieben von ${participant.name} etwas stärker, ohne den Gruppenfit ganz zu verlieren.`,
            badges: [participant.isCurrentUser ? "Dein Fokus" : `Fokus ${participant.name}`],
          },
        })
      );
    });
  }

  return variants;
}
