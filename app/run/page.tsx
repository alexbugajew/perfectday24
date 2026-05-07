"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { PlanMapStop } from "@/components/PlanMap";
import {
  clearPlannerRunProgress,
  readPlannerRunDraft,
  readPlannerRunProgress,
  writePlannerRunProgress,
  type PlannerRunDraft,
  type PlannerRunProgress,
  type PlannerRunStop,
  type PlannerRunStopState,
} from "@/lib/routes/planner-run-bridge";

const PlanMap = dynamic(() => import("@/components/PlanMap"), { ssr: false });

function stopNavigationUrl(stop: PlannerRunStop) {
  if (stop.lat != null && stop.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`;
  }
  return stop.externalUrl;
}

function startNavigationUrl(draft: PlannerRunDraft) {
  if (draft.start.lat != null && draft.start.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${draft.start.lat},${draft.start.lng}`;
  }
  return null;
}

function statusLabel(status: PlannerRunStopState) {
  if (status === "done") return "Erledigt";
  if (status === "skipped") return "Uebersprungen";
  return "Offen";
}

function statusTone(status: PlannerRunStopState) {
  if (status === "done") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "skipped") return "border-rose-200 bg-rose-50 text-rose-900";
  return "border-[var(--line-subtle)] bg-white text-[var(--text-muted)]";
}

function nextPendingStopId(
  stops: PlannerRunStop[],
  states: Record<string, PlannerRunStopState>,
  fromStopId?: string | null
) {
  if (stops.length === 0) return null;
  const currentIndex = fromStopId ? stops.findIndex((stop) => stop.id === fromStopId) : -1;
  for (let index = currentIndex + 1; index < stops.length; index += 1) {
    if (states[stops[index].id] === "pending") return stops[index].id;
  }
  for (let index = 0; index <= currentIndex; index += 1) {
    if (states[stops[index].id] === "pending") return stops[index].id;
  }
  return null;
}

function buildInitialProgress(draft: PlannerRunDraft) {
  const persisted = readPlannerRunProgress(draft.id);
  const stopStates: Record<string, PlannerRunStopState> = {};
  draft.stops.forEach((stop) => {
    stopStates[stop.id] = persisted?.stopStates?.[stop.id] ?? "pending";
  });

  const currentStopId =
    (persisted?.currentStopId && stopStates[persisted.currentStopId] ? persisted.currentStopId : null) ??
    nextPendingStopId(draft.stops, stopStates) ??
    draft.stops[0]?.id ??
    null;

  return {
    draftId: draft.id,
    updatedAt: new Date().toISOString(),
    currentStopId,
    stopStates,
  } satisfies PlannerRunProgress;
}

export default function PlannerRunPage() {
  const [draft, setDraft] = useState<PlannerRunDraft | null>(null);
  const [progress, setProgress] = useState<PlannerRunProgress | null>(null);

  useEffect(() => {
    window.setTimeout(() => {
      const nextDraft = readPlannerRunDraft();
      setDraft(nextDraft);
      if (nextDraft) {
        const nextProgress = buildInitialProgress(nextDraft);
        setProgress(nextProgress);
        writePlannerRunProgress(nextProgress);
      }
    }, 0);
  }, []);

  const completedCount = useMemo(
    () => draft?.stops.filter((stop) => progress?.stopStates[stop.id] === "done").length ?? 0,
    [draft?.stops, progress?.stopStates]
  );
  const skippedCount = useMemo(
    () => draft?.stops.filter((stop) => progress?.stopStates[stop.id] === "skipped").length ?? 0,
    [draft?.stops, progress?.stopStates]
  );
  const handledCount = completedCount + skippedCount;
  const pendingCount = Math.max(0, (draft?.stops.length ?? 0) - handledCount);
  const progressPercent = draft && draft.stops.length > 0 ? Math.round((handledCount / draft.stops.length) * 100) : 0;

  const mapStops = useMemo(() => {
    const points: PlanMapStop[] = [];
    if (draft?.start.lat != null && draft.start.lng != null) {
      points.push({
        label: "Start",
        name: draft.start.label || "Startpunkt",
        lat: draft.start.lat,
        lng: draft.start.lng,
        markerVariant: "start",
      });
    }
    draft?.stops.forEach((stop) => {
      const state = progress?.stopStates[stop.id] ?? "pending";
      const markerVariant =
        progress?.currentStopId === stop.id
          ? "active"
          : state === "done"
            ? "done"
            : state === "skipped"
              ? "skipped"
              : "default";
      if (stop.lat != null && stop.lng != null) {
        points.push({
          label: `Stop ${stop.order}`,
          name: stop.title,
          lat: stop.lat,
          lng: stop.lng,
          markerVariant,
        });
      }
    });
    return points;
  }, [draft, progress?.currentStopId, progress?.stopStates]);

  function persistProgress(next: PlannerRunProgress) {
    setProgress(next);
    writePlannerRunProgress(next);
  }

  function setCurrentStop(stopId: string) {
    if (!progress) return;
    persistProgress({
      ...progress,
      currentStopId: stopId,
      updatedAt: new Date().toISOString(),
    });
  }

  function markStop(stopId: string, state: PlannerRunStopState) {
    if (!draft || !progress) return;
    const nextStates = {
      ...progress.stopStates,
      [stopId]: state,
    };
    persistProgress({
      draftId: draft.id,
      updatedAt: new Date().toISOString(),
      currentStopId:
        state === "pending"
          ? stopId
          : nextPendingStopId(draft.stops, nextStates, stopId) ?? draft.stops[0]?.id ?? null,
      stopStates: nextStates,
    });
  }

  function resetRun() {
    if (!draft) return;
    clearPlannerRunProgress();
    const next = buildInitialProgress(draft);
    persistProgress(next);
  }

  if (!draft) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        <Link href="/planner" className="text-sm text-[var(--text-muted)] underline">
          Zurueck zum Planner
        </Link>
        <div className="rounded-2xl border bg-white p-6">
          Es liegt noch keine gestartete Planner-Route vor. Erzeuge im Planner zuerst einen Plan und starte ihn dort.
        </div>
      </main>
    );
  }

  const startUrl = startNavigationUrl(draft);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
          <Link href="/planner" className="hover:text-[var(--text-strong)]">
            Zurueck zum Planner
          </Link>
          <Link href="/routes" className="hover:text-[var(--text-strong)]">
            Route Builder
          </Link>
        </div>
        <button
          type="button"
          onClick={resetRun}
          className="rounded-xl border border-[var(--line-subtle)] px-3 py-2 text-sm text-[var(--text-strong)] hover:bg-white"
        >
          Fortschritt zuruecksetzen
        </button>
      </div>

      <section className="rounded-[28px] border border-[var(--line-subtle)] bg-white p-6 shadow-sm">
        <div className="pd24-kicker mb-2">Route Live</div>
        <h1 className="text-3xl font-semibold text-[var(--text-strong)]">{draft.title}</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          {draft.cityLabel ? (
            <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-3 py-1 text-xs text-[var(--text-muted)]">
              {draft.cityLabel}
            </span>
          ) : null}
          {draft.occasionLabel ? (
            <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-3 py-1 text-xs text-[var(--text-muted)]">
              {draft.occasionLabel}
            </span>
          ) : null}
          <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-3 py-1 text-xs text-[var(--text-muted)]">
            {draft.stops.length} Stops
          </span>
          <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-3 py-1 text-xs text-[var(--text-muted)]">
            {progressPercent}% geschafft
          </span>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_6.25rem]">
        <div className="overflow-hidden rounded-[28px] border border-[var(--line-subtle)] bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--line-subtle)] px-5 py-4">
            <h2 className="text-[1.8rem] font-semibold leading-none text-[var(--text-strong)]">Map + Route</h2>
            <div className="text-sm text-[var(--text-muted)]">{draft.routeProfileLabel ?? "Route"}</div>
          </div>
          <div className="h-[320px] w-full overflow-hidden bg-white">
            <PlanMap stops={mapStops} profile="foot" height={320} showHeader={false} />
          </div>
        </div>

        <div className="grid auto-rows-fr gap-3">
          <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-3 py-3">
            <div className="text-[10px] uppercase tracking-wide text-emerald-800">Done</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-950">{completedCount}</div>
          </div>
          <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-3 py-3">
            <div className="text-[10px] uppercase tracking-wide text-rose-800">Skip</div>
            <div className="mt-2 text-2xl font-semibold text-rose-950">{skippedCount}</div>
          </div>
          <div className="rounded-[22px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-3">
            <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Open</div>
            <div className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{pendingCount}</div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--line-subtle)] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Tagesverlauf</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Stop antippen, navigieren und danach erledigen oder skippen.
            </p>
          </div>
          <div className="rounded-full bg-[var(--bg-panel)] px-4 py-2 text-sm text-[var(--text-muted)]">
            {progressPercent}% geschafft
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--bg-panel)]">
          <div className="h-full rounded-full bg-[var(--text-strong)] transition-all" style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-[22px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Startpunkt</div>
                <div className="mt-2 font-medium text-[var(--text-strong)]">
                  {draft.start.label || "Kein expliziter Startpunkt"}
                </div>
              </div>
              {startUrl ? (
                <Link
                  href={startUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-white text-sm text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)]"
                  aria-label="Zum Startpunkt navigieren"
                >
                  -&gt;
                </Link>
              ) : null}
            </div>
          </div>

          {draft.stops.map((stop) => {
            const state = progress?.stopStates[stop.id] ?? "pending";
            const active = progress?.currentStopId === stop.id;
            const navUrl = stopNavigationUrl(stop);
            return (
              <div
                key={stop.id}
                className={`rounded-[22px] border p-4 transition ${
                  active ? "border-[var(--text-strong)] bg-[var(--bg-panel)]" : "border-[var(--line-subtle)] bg-white"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button type="button" onClick={() => setCurrentStop(stop.id)} className="min-w-0 flex-1 text-left">
                    <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Stop {stop.order}</div>
                    <div className="mt-1 text-lg font-semibold text-[var(--text-strong)]">{stop.title}</div>
                    <div className="mt-1 text-sm text-[var(--text-muted)]">{stop.label}</div>
                    {stop.note ? <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{stop.note}</p> : null}
                  </button>
                  <div className={`rounded-full border px-3 py-1 text-xs ${statusTone(state)}`}>{statusLabel(state)}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {navUrl ? (
                    <Link
                      href={navUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-[var(--line-subtle)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] hover:bg-[var(--bg-panel)]"
                    >
                      Navigieren
                    </Link>
                  ) : null}
                  <button type="button" onClick={() => markStop(stop.id, "done")} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
                    Erledigt
                  </button>
                  <button type="button" onClick={() => markStop(stop.id, "skipped")} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-950">
                    Skip
                  </button>
                  {state !== "pending" ? (
                    <button type="button" onClick={() => markStop(stop.id, "pending")} className="rounded-xl border border-[var(--line-subtle)] px-3 py-2 text-sm text-[var(--text-strong)]">
                      Wieder oeffnen
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
