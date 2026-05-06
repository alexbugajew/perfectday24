export type RouteRunStopState = "pending" | "done" | "skipped";

export type RouteRunProgress = {
  routeId: string;
  routeSlug: string | null;
  startedAt: string;
  updatedAt: string;
  currentStopId: string | null;
  stopStates: Record<string, RouteRunStopState>;
};

const ROUTE_RUN_STORAGE_PREFIX = "pd24_route_run_progress";

export function buildRouteRunStorageKey(routeId: string, routeSlug?: string | null) {
  const stableId = routeSlug?.trim() || routeId;
  return `${ROUTE_RUN_STORAGE_PREFIX}:${stableId}`;
}

export function readRouteRunProgress(routeId: string, routeSlug?: string | null) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(buildRouteRunStorageKey(routeId, routeSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RouteRunProgress>;
    if (!parsed || parsed.routeId !== routeId || typeof parsed.stopStates !== "object") return null;
    return {
      routeId,
      routeSlug: parsed.routeSlug ?? routeSlug ?? null,
      startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : new Date().toISOString(),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      currentStopId: typeof parsed.currentStopId === "string" ? parsed.currentStopId : null,
      stopStates: parsed.stopStates as Record<string, RouteRunStopState>,
    } satisfies RouteRunProgress;
  } catch {
    return null;
  }
}

export function writeRouteRunProgress(progress: RouteRunProgress) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      buildRouteRunStorageKey(progress.routeId, progress.routeSlug),
      JSON.stringify(progress)
    );
  } catch {}
}

export function clearRouteRunProgress(routeId: string, routeSlug?: string | null) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(buildRouteRunStorageKey(routeId, routeSlug));
  } catch {}
}
