"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { trackMonetizationEvent } from "@/lib/monetization/client";
import type {
  EvaluationMode,
  EventPlanningMode,
  ExperienceMode,
  GroupMember,
  PlannedStop,
  PlanMode,
  PlannerRequest,
  RouteProfile,
  RouteSummaryLite,
} from "@/lib/planner";
import {
  plannerEventLabel,
  summarizeRoute,
} from "@/lib/planner";
import {
  buildGoogleMapsDirUrl,
  eventDebugSignature,
  phaseMeta,
  providerLabel,
  reorderList,
  EMPTY_PLANNER_EVENT_ROWS,
  EMPTY_PLANNER_RESULTS,
  EMPTY_PLANNED_STOPS,
} from "./helpers";
import { rescheduleStops, sortStopsChronologically, optimizeStopOrderByGeo } from "./rescheduleStops";
import type {
  GroupPlanSummary,
  PlannerApiResponse,
  PlannerVoteMoment,
  StartPoint,
  StartPointMode,
} from "./types";

type UsePlannerGenerationParams = {
  mounted: boolean;
  presetsReady: boolean;
  effectiveCitySlug: string | null;
  hasValidPlannerOrigin: boolean;
  startPointMode: StartPointMode;
  plannerRequest: PlannerRequest;
  radiusKm: number;
  userId: string | null;
  occasion: string;
  experienceMode: ExperienceMode;
  planMode: PlanMode;
  routeProfile: RouteProfile;
  selectedEventId: string | null;
  groupEnabled: boolean;
  groupMembers: GroupMember[];
  effectiveStartPoint: StartPoint;
  activePlanGroupChatId: string | null;
  onPostGroupMessage?: (chatId: string, message: string) => Promise<void> | void;
};

export function usePlannerGeneration({
  mounted,
  presetsReady,
  effectiveCitySlug,
  hasValidPlannerOrigin,
  startPointMode,
  plannerRequest,
  radiusKm,
  userId,
  occasion,
  experienceMode,
  planMode,
  routeProfile,
  selectedEventId,
  groupEnabled,
  groupMembers,
  effectiveStartPoint,
  activePlanGroupChatId,
  onPostGroupMessage,
}: UsePlannerGenerationParams) {
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [plannerData, setPlannerData] = useState<PlannerApiResponse | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("best-match");
  const [pinnedVariantId, setPinnedVariantId] = useState<string | null>(null);
  const [variantVotes, setVariantVotes] = useState<Record<string, string[]>>({});
  const [manualStopOrder, setManualStopOrder] = useState<number[] | null>(null);

  useEffect(() => {
    if (!mounted) return;
    if (!presetsReady) return;
    if (!effectiveCitySlug) return;
    if (!hasValidPlannerOrigin) {
      setPlannerData(null);
      setPlannerLoading(false);
      setPlannerError(
        startPointMode === "custom"
          ? "Ein manueller Startpunkt braucht Latitude und Longitude. Sonst kann der Radius nicht korrekt um den gewählten Ort geplant werden."
          : "Startpunkt wird noch ermittelt."
      );
      return;
    }

    let isCancelled = false;

    (async () => {
      setPlannerLoading(true);
      setPlannerError(null);

      try {
        const res = await fetch("/api/planner/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(plannerRequest),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Planner API Fehler: ${res.status}`);
        }

        const json = (await res.json()) as PlannerApiResponse;

        if (!isCancelled) {
          setPlannerData(json);
          if (json.plannedStops?.length) {
            void trackMonetizationEvent({
              eventType: "plan_intent",
              userId,
              citySlug: effectiveCitySlug,
              surface: "planner",
              metadata: {
                occasion,
                experienceMode,
                planMode,
                routeProfile,
                selectedEventId: selectedEventId ?? null,
                stopsCount: json.plannedStops.length,
                variantCount: json.variants?.length ?? 0,
              },
            });
          }
          if (json.variants?.length) {
            setSelectedVariantId((prev) => {
              const exists = json.variants.some((variant) => variant.variantId === prev);
              return exists ? prev : json.variants[0].variantId;
            });
            setPinnedVariantId((prev) => {
              if (prev && json.variants.some((variant) => variant.variantId === prev)) {
                return prev;
              }
              return null;
            });
          }
        }
      } catch (error) {
        console.error("Planner fetch failed:", error);
        if (!isCancelled) {
          setPlannerData(null);
          setPlannerError("Der Plan konnte aktuell nicht generiert werden.");
        }
      } finally {
        if (!isCancelled) {
          setPlannerLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    mounted,
    presetsReady,
    effectiveCitySlug,
    hasValidPlannerOrigin,
    startPointMode,
    plannerRequest,
    userId,
    occasion,
    experienceMode,
    planMode,
    routeProfile,
    selectedEventId,
  ]);

  const results = plannerData?.results ?? EMPTY_PLANNER_RESULTS;
  const activeLevel = plannerData?.activeLevel ?? "fallback";
  const effectiveRadiusKm = plannerData?.effectiveRadiusKm ?? radiusKm;
  const eventCandidates = plannerData?.eventCandidates ?? EMPTY_PLANNER_EVENT_ROWS;
  const eventDebugRows = plannerData?.eventDebugRows ?? eventCandidates;

  const eventDebugGroupCounts = useMemo(() => {
    return eventDebugRows.reduce((map, event) => {
      const signature = eventDebugSignature(event);
      map.set(signature, (map.get(signature) ?? 0) + 1);
      return map;
    }, new Map<string, number>());
  }, [eventDebugRows]);

  const reactionParticipants = useMemo(() => {
    if (!groupEnabled || groupMembers.length === 0) return [] as string[];
    return [
      "Du",
      ...groupMembers
        .map((member, index) => member.name?.trim() || `Gast ${index + 1}`)
        .filter(Boolean),
    ];
  }, [groupEnabled, groupMembers]);

  const activeVariant = useMemo(() => {
    if (!plannerData?.variants?.length) return null;
    return (
      plannerData.variants.find((variant) => variant.variantId === selectedVariantId) ??
      plannerData.variants[0]
    );
  }, [plannerData, selectedVariantId]);

  const pinnedVariant = useMemo(() => {
    if (!plannerData?.variants?.length || !pinnedVariantId) return null;
    return plannerData.variants.find((variant) => variant.variantId === pinnedVariantId) ?? null;
  }, [plannerData, pinnedVariantId]);

  const majorityThreshold =
    reactionParticipants.length > 0 ? Math.max(2, Math.ceil(reactionParticipants.length / 2)) : 0;

  const leadingVariant = useMemo(() => {
    if (!plannerData?.variants?.length) return null;
    const ranked = plannerData.variants
      .map((variant) => ({
        variant,
        votes: variantVotes[variant.variantId]?.length ?? 0,
      }))
      .sort((a, b) => b.votes - a.votes);
    return ranked[0]?.votes ? ranked[0] : null;
  }, [plannerData, variantVotes]);

  const plannerVoteMoment = useMemo<PlannerVoteMoment | null>(() => {
    if (!leadingVariant || reactionParticipants.length === 0) return null;
    const votes = leadingVariant.votes;
    const total = reactionParticipants.length;

    if (votes >= total) {
      return {
        label: "Alle haben bestätigt",
        note: "Diese Variante ist lokal vollständig von der Gruppe getragen.",
        tone: "emerald",
      };
    }
    if (votes >= majorityThreshold) {
      return {
        label: "Mehrheit erreicht",
        note: "Diese Variante hat aktuell genug lokale Zustimmung.",
        tone: "emerald",
      };
    }
    if (majorityThreshold - votes === 1) {
      return {
        label: "Noch 1 Stimme bis zur Gruppenwahl",
        note: "Eine weitere Stimme würde diese Variante lokal absichern.",
        tone: "amber",
      };
    }
    return {
      label: "Noch offen",
      note: "Die lokale Gruppenentscheidung ist noch in Bewegung.",
      tone: "sky",
    };
  }, [leadingVariant, majorityThreshold, reactionParticipants.length]);

  const finalChoice = pinnedVariant ?? activeVariant;

  const rawPlannedStops: PlannedStop[] =
    activeVariant?.plannedStops ?? plannerData?.plannedStops ?? EMPTY_PLANNED_STOPS;

  const plannedStops: PlannedStop[] = useMemo(() => {
    if (!manualStopOrder?.length) {
      return sortStopsChronologically(rawPlannedStops);
    }
    const byIndex = new Map(rawPlannedStops.map((stop) => [stop.index, stop] as const));
    const ordered = manualStopOrder
      .map((index) => byIndex.get(index))
      .filter((stop): stop is PlannedStop => Boolean(stop));
    const remaining = rawPlannedStops.filter((stop) => !manualStopOrder.includes(stop.index));
    const rescheduled = rescheduleStops([...ordered, ...remaining]);
    return sortStopsChronologically(rescheduled);
  }, [rawPlannedStops, manualStopOrder]);

  const occasionFlow = useMemo(() => {
    if (
      occasion !== "date" &&
      occasion !== "family" &&
      occasion !== "friends" &&
      occasion !== "tourism" &&
      occasion !== "party"
    ) {
      return [];
    }

    return plannedStops.map((stop, i) => {
      const slot = plannerData?.context?.slotTemplate?.[i];
      return {
        stop,
        phase: slot?.phase ?? null,
        phaseGoal: slot?.phaseGoal ?? null,
        meta: phaseMeta(slot?.phase, occasion),
      };
    });
  }, [occasion, plannedStops, plannerData]);

  const groupPlanSummary = useMemo<GroupPlanSummary>(() => {
    const decisions = plannedStops
      .map((stop) => stop.groupDecision)
      .filter((decision): decision is NonNullable<PlannedStop["groupDecision"]> => Boolean(decision));

    const sharedCount = decisions.filter((decision) => decision.compromiseLevel === "shared").length;
    const balancedCount = decisions.filter((decision) => decision.compromiseLevel === "balanced").length;
    const singlePreferenceCount = decisions.filter(
      (decision) => decision.compromiseLevel === "single_preference"
    ).length;

    const reducedThemes = new Set<string>();
    const matchedInterests = new Set<string>();

    for (const decision of decisions) {
      for (const interest of decision.matchedInterests) {
        matchedInterests.add(interest);
      }
      const note = (decision.balanceNote ?? "").toLowerCase();
      if (note.includes("nightlife")) reducedThemes.add("Nightlife");
      if (note.includes("outdoor")) reducedThemes.add("Outdoor");
      if (note.includes("essens-stop") || note.includes("essen")) reducedThemes.add("Food");
    }

    return {
      sharedCount,
      balancedCount,
      singlePreferenceCount,
      matchedInterests: Array.from(matchedInterests).slice(0, 4),
      reducedThemes: Array.from(reducedThemes).slice(0, 3),
    };
  }, [plannedStops]);

  const timingWarnings = useMemo(
    () =>
      plannedStops.flatMap((stop) =>
        (stop.timingWarnings ?? []).map((warning) => ({
          stopLabel: stop.label,
          warning,
        }))
      ),
    [plannedStops]
  );

  const eventProviderSummary = useMemo(
    () =>
      Array.from(
        eventCandidates.reduce((map, event) => {
          const key = providerLabel(event.source);
          map.set(key, (map.get(key) ?? 0) + 1);
          return map;
        }, new Map<string, number>())
      ),
    [eventCandidates]
  );

  const eventCategorySummary = useMemo(
    () =>
      Array.from(
        eventCandidates.reduce((map, event) => {
          const key = plannerEventLabel(event.category);
          map.set(key, (map.get(key) ?? 0) + 1);
          return map;
        }, new Map<string, number>())
      ),
    [eventCandidates]
  );

  useEffect(() => {
    if (!plannerData?.variants?.length) {
      setVariantVotes({});
      return;
    }

    const allowedVariantIds = new Set(plannerData.variants.map((variant) => variant.variantId));
    const allowedParticipants = new Set(reactionParticipants);

    setVariantVotes((prev) => {
      const next: Record<string, string[]> = {};
      for (const [variantId, voters] of Object.entries(prev)) {
        if (!allowedVariantIds.has(variantId)) continue;
        const cleaned = voters.filter((voter) => allowedParticipants.has(voter));
        if (cleaned.length > 0) next[variantId] = cleaned;
      }
      return next;
    });
  }, [plannerData, reactionParticipants]);

  useEffect(() => {
    setManualStopOrder(null);
  }, [activeVariant?.variantId, plannerData]);

  const movePlannedStop = useCallback(
    (fromPosition: number, toPosition: number) => {
      if (fromPosition === toPosition) return;
      const baseOrder = plannedStops.map((stop) => stop.index);
      setManualStopOrder(reorderList(baseOrder, fromPosition, toPosition));
    },
    [plannedStops]
  );

  const optimizeStopOrder = useCallback(() => {
    if (plannedStops.length < 3) return;
    const optimized = optimizeStopOrderByGeo(plannedStops);
    setManualStopOrder(optimized.map((stop) => stop.index));
  }, [plannedStops]);

  const fallbackSummary: RouteSummaryLite = useMemo(() => {
    if (activeVariant?.fallbackSummary) return activeVariant.fallbackSummary;
    if (plannerData?.fallbackSummary) return plannerData.fallbackSummary;

    return summarizeRoute({
      stops: plannedStops,
      origin: {
        lat: effectiveStartPoint.lat,
        lng: effectiveStartPoint.lng,
      },
    });
  }, [activeVariant, plannerData, plannedStops, effectiveStartPoint]);

  const mapStops = useMemo(() => {
    const points: Array<{ label: string; name: string; lat: number; lng: number }> = [];

    if (effectiveStartPoint.lat != null && effectiveStartPoint.lng != null) {
      points.push({
        label: "Start",
        name: effectiveStartPoint.label || "Startpunkt",
        lat: effectiveStartPoint.lat,
        lng: effectiveStartPoint.lng,
      });
    }

    for (const stop of plannedStops) {
      if (stop.item?.lat != null && stop.item?.lng != null) {
        points.push({
          label: stop.label,
          name: stop.item?.name ?? "Location",
          lat: Number(stop.item.lat),
          lng: Number(stop.item.lng),
        });
      }
    }

    return points;
  }, [plannedStops, effectiveStartPoint]);

  const googleRouteUrl = useMemo(() => {
    return buildGoogleMapsDirUrl(
      mapStops.map((point) => ({ lat: point.lat, lng: point.lng })),
      routeProfile
    );
  }, [mapStops, routeProfile]);

  const toggleVariantReaction = useCallback(
    (variantId: string, participantName: string) => {
      const next: Record<string, string[]> = {};

      for (const [key, voters] of Object.entries(variantVotes)) {
        const filtered = voters.filter((voter) => voter !== participantName);
        if (filtered.length > 0) next[key] = filtered;
      }

      const alreadySelected = variantVotes[variantId]?.includes(participantName) ?? false;
      if (!alreadySelected) {
        next[variantId] = [...(next[variantId] ?? []), participantName];
      }

      const prevVotes = variantVotes[variantId]?.length ?? 0;
      const nextVotes = next[variantId]?.length ?? 0;
      const pickedVariant =
        plannerData?.variants?.find((variant) => variant.variantId === variantId) ?? null;

      if (majorityThreshold > 0 && nextVotes >= majorityThreshold) {
        setPinnedVariantId(variantId);
      } else if (pinnedVariantId === variantId && nextVotes === 0) {
        setPinnedVariantId(null);
      }

      setVariantVotes(next);

      if (!activePlanGroupChatId || !pickedVariant || !onPostGroupMessage) return;

      if (!alreadySelected) {
        void onPostGroupMessage(
          activePlanGroupChatId,
          `${participantName} bevorzugt jetzt "${pickedVariant.label}".`
        );
      }

      if (
        reactionParticipants.length > 0 &&
        prevVotes < reactionParticipants.length &&
        nextVotes >= reactionParticipants.length
      ) {
        void onPostGroupMessage(
          activePlanGroupChatId,
          `Alle haben "${pickedVariant.label}" bestaetigt.`
        );
        return;
      }

      if (majorityThreshold > 0 && prevVotes < majorityThreshold && nextVotes >= majorityThreshold) {
        void onPostGroupMessage(
          activePlanGroupChatId,
          `Mehrheit erreicht für "${pickedVariant.label}" (${nextVotes} von ${reactionParticipants.length}).`
        );
      }
    },
    [
      variantVotes,
      plannerData,
      majorityThreshold,
      pinnedVariantId,
      activePlanGroupChatId,
      reactionParticipants.length,
      onPostGroupMessage,
    ]
  );

  return {
    plannerLoading,
    setPlannerLoading,
    plannerError,
    setPlannerError,
    plannerData,
    setPlannerData,
    selectedVariantId,
    setSelectedVariantId,
    pinnedVariantId,
    setPinnedVariantId,
    variantVotes,
    setVariantVotes,
    manualStopOrder,
    setManualStopOrder,
    results,
    activeLevel,
    effectiveRadiusKm,
    eventCandidates,
    eventDebugRows,
    eventDebugGroupCounts,
    reactionParticipants,
    activeVariant,
    pinnedVariant,
    majorityThreshold,
    leadingVariant,
    plannerVoteMoment,
    finalChoice,
    plannedStops,
    occasionFlow,
    groupPlanSummary,
    timingWarnings,
    eventProviderSummary,
    eventCategorySummary,
    fallbackSummary,
    mapStops,
    googleRouteUrl,
    movePlannedStop,
    optimizeStopOrder,
    toggleVariantReaction,
  };
}
