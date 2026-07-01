// Client-side: AI-Plan abrufen und in PlannedStop[] mappen
// damit Stop-Cards out-of-the-box rendern.

import type { PlannedStop } from "@/lib/planner";
import type { MatchLevel, ScoredLocation } from "@/lib/planner/types";
import { supabase } from "@/lib/supabaseClient";

export class FreeLimitReachedError extends Error {
  used: number;
  limit: number;
  constructor(used: number, limit: number) {
    super(`Free-Limit erreicht (${used}/${limit})`);
    this.name = "FreeLimitReachedError";
    this.used = used;
    this.limit = limit;
  }
}

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
  occasion?: string;
  startPointLabel?: string;
  startPointLat?: number;
  startPointLng?: number;
  interests?: string[];
  stopsCount?: number;
  familyAgeBand?: string;
  groupEnabled?: boolean;
  groupSize?: number;
  signal?: AbortSignal;
}): Promise<{ summary: string; stops: PlannedStop[]; meta?: AiPlanResponse["meta"] }> {
  // Auth-Header mitschicken, damit der Server das Free-Limit pruefen kann.
  // Wenn kein Session-Token verfuegbar: Anfrage geht anonym raus (kein Gate).
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token ?? null;

  const res = await fetch("/api/generate-plan-ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      prompt: params.prompt,
      citySlug: params.citySlug,
      planDate: params.planDate ?? "",
      budget: params.budget ?? "medium",
      occasion: params.occasion,
      startPointLabel: params.startPointLabel,
      startPointLat: params.startPointLat,
      startPointLng: params.startPointLng,
      interests: params.interests,
      stopsCount: params.stopsCount,
      familyAgeBand: params.familyAgeBand,
      groupEnabled: params.groupEnabled,
      groupSize: params.groupSize,
    }),
    signal: params.signal,
  });
  if (res.status === 402) {
    const info = await res.json().catch(() => ({}));
    const used = typeof info.used === "number" ? info.used : 0;
    const limit = typeof info.limit === "number" ? info.limit : 3;
    throw new FreeLimitReachedError(used, limit);
  }
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
