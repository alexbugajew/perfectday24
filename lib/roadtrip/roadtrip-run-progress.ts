export type RoadtripRunStopState = "pending" | "done" | "skipped";

export type RoadtripRunProgress = {
  routeId: string;
  routeSlug: string | null;
  startDate: string;
  startedAt: string;
  updatedAt: string;
  currentStopId: string | null;
  stopStates: Record<string, RoadtripRunStopState>;
};

const ROADTRIP_RUN_STORAGE_PREFIX = "pd24_roadtrip_run_progress";

export function buildRoadtripRunStorageKey(routeId: string, routeSlug?: string | null, startDate?: string | null) {
  const stableId = routeSlug?.trim() || routeId;
  const safeStartDate = startDate?.trim() || "no-date";
  return `${ROADTRIP_RUN_STORAGE_PREFIX}:${stableId}:${safeStartDate}`;
}

export function readRoadtripRunProgress(routeId: string, routeSlug?: string | null, startDate?: string | null) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(buildRoadtripRunStorageKey(routeId, routeSlug, startDate));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RoadtripRunProgress>;
    if (!parsed || parsed.routeId !== routeId || typeof parsed.stopStates !== "object") return null;
    return {
      routeId,
      routeSlug: parsed.routeSlug ?? routeSlug ?? null,
      startDate: typeof parsed.startDate === "string" ? parsed.startDate : startDate ?? new Date().toISOString().slice(0, 10),
      startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : new Date().toISOString(),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      currentStopId: typeof parsed.currentStopId === "string" ? parsed.currentStopId : null,
      stopStates: parsed.stopStates as Record<string, RoadtripRunStopState>,
    } satisfies RoadtripRunProgress;
  } catch {
    return null;
  }
}

export function writeRoadtripRunProgress(progress: RoadtripRunProgress) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      buildRoadtripRunStorageKey(progress.routeId, progress.routeSlug, progress.startDate),
      JSON.stringify(progress)
    );
  } catch {}
}

export function clearRoadtripRunProgress(routeId: string, routeSlug?: string | null, startDate?: string | null) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(buildRoadtripRunStorageKey(routeId, routeSlug, startDate));
  } catch {}
}
