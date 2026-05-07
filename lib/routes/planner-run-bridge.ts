export const PLANNER_RUN_DRAFT_STORAGE_KEY = "pd24_planner_run_draft";
export const PLANNER_RUN_PROGRESS_STORAGE_KEY = "pd24_planner_run_progress";

export type PlannerRunStop = {
  id: string;
  order: number;
  title: string;
  label: string;
  note: string;
  durationMin: number | null;
  externalUrl: string | null;
  lat: number | null;
  lng: number | null;
  isRequired: boolean;
};

export type PlannerRunDraft = {
  id: string;
  title: string;
  cityLabel: string | null;
  occasionLabel: string | null;
  routeProfileLabel: string | null;
  startedAt: string;
  start: {
    label: string | null;
    lat: number | null;
    lng: number | null;
  };
  stops: PlannerRunStop[];
};

export type PlannerRunStopState = "pending" | "done" | "skipped";

export type PlannerRunProgress = {
  draftId: string;
  updatedAt: string;
  currentStopId: string | null;
  stopStates: Record<string, PlannerRunStopState>;
};

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function writePlannerRunDraft(value: PlannerRunDraft) {
  writeJson(PLANNER_RUN_DRAFT_STORAGE_KEY, value);
  window.localStorage.removeItem(PLANNER_RUN_PROGRESS_STORAGE_KEY);
}

export function readPlannerRunDraft() {
  return readJson<PlannerRunDraft>(PLANNER_RUN_DRAFT_STORAGE_KEY);
}

export function readPlannerRunProgress(draftId: string) {
  const progress = readJson<Partial<PlannerRunProgress>>(PLANNER_RUN_PROGRESS_STORAGE_KEY);
  if (!progress || progress.draftId !== draftId || typeof progress.stopStates !== "object") return null;
  return {
    draftId,
    updatedAt: typeof progress.updatedAt === "string" ? progress.updatedAt : new Date().toISOString(),
    currentStopId: typeof progress.currentStopId === "string" ? progress.currentStopId : null,
    stopStates: progress.stopStates as Record<string, PlannerRunStopState>,
  } satisfies PlannerRunProgress;
}

export function writePlannerRunProgress(value: PlannerRunProgress) {
  writeJson(PLANNER_RUN_PROGRESS_STORAGE_KEY, value);
}

export function clearPlannerRunProgress() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PLANNER_RUN_PROGRESS_STORAGE_KEY);
}
