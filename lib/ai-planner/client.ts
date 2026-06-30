// Client-side: AI-Plan abrufen und in PlannedStop[] mappen
// damit Stop-Cards out-of-the-box rendern.

import type { PlannedStop } from "@/lib/planner";
import type { MatchLevel, ScoredLocation } from "@/lib/planner/types";

type ResolvedStop = {
  index: number;
  label: string;
  hint: string;
  itemId: string;
  itemName: string;
  itemType: string;
  itemCategory: string | null;
  lat: number | null;
  lng: number | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  durationMin: number | null;
  source: "location" | "event";
};

export type AiPlanResponse = {
  summary: string;
  stops: ResolvedStop[];
  meta?: {
    model: string;
    toolCalls: number;
    candidatesPulled: number;
    usage?: unknown;
  };
};

function stopToPlannedStop(rs: ResolvedStop): PlannedStop {
  const item: ScoredLocation = {
    id: rs.itemId,
    name: rs.itemName,
    type: rs.itemType,
    category: rs.itemCategory ?? undefined,
    duration_min: rs.durationMin,
    reservation_url: null,
    lat: rs.lat,
    lng: rs.lng,
    distanceFromOriginKm: null,
    score: 0,
    prefBoost: 0,
    totalScore: 0,
    matchLevel: "medium" as MatchLevel,
    source_primary: rs.source === "event" ? "planner_event" : undefined,
  } as unknown as ScoredLocation;

  return {
    index: rs.index,
    label: rs.label,
    hint: rs.hint || "",
    item,
    durationMin: rs.durationMin,
    travelMinFromPrev: rs.index > 1 ? 15 : 0, // grobe Schätzung — rescheduleStops kalkuliert ggf. neu
    scheduledStartAt: rs.scheduledStartAt,
    scheduledEndAt: rs.scheduledEndAt,
    timingLock: rs.source === "event" ? "event" : "none",
    timingWarnings: [],
    reasons: [],
    groupDecision: null,
    debug: null,
  };
}

export async function generateAiPlan(params: {
  prompt: string;
  citySlug: string;
  planDate?: string;
  budget?: string;
  signal?: AbortSignal;
}): Promise<{ summary: string; stops: PlannedStop[]; meta?: AiPlanResponse["meta"] }> {
  const res = await fetch("/api/generate-plan-ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: params.prompt,
      citySlug: params.citySlug,
      planDate: params.planDate ?? "",
      budget: params.budget ?? "medium",
    }),
    signal: params.signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI plan failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as AiPlanResponse;
  if (!Array.isArray(json.stops) || json.stops.length === 0) {
    throw new Error("AI returned empty plan");
  }
  return {
    summary: json.summary,
    stops: json.stops.map(stopToPlannedStop),
    meta: json.meta,
  };
}
