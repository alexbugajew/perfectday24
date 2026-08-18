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
  if (status === "skipped") return "Übersprungen";
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
      <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Link href="/planner" className="text-sm text-[var(--text-muted)] underline">
          Zurück zum Planner
        </Link>
        <div className="rounded-2xl border border-[var(--line-subtle)] bg-white p-5 shadow-sm sm:p-6">
          <div className="pd24-kicker mb-2">Route Live</div>
          <h1 className="break-words text-2xl font-semibold tracking-tight text-[var(--text-strong)]">
            Noch keine Route gestartet
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Erzeuge im Planner zuerst einen Plan und starte ihn dort als Live-Route.
          </p>
          <Link
            href="/planner"
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[var(--text-strong)] px-4 py-3 text-sm font-medium text-white sm:w-auto"
          >
            Zum Planner
          </Link>
        </div>
      </main>
    );
  }

  const startUrl = startNavigationUrl(draft);
  const currentStop = draft.stops.find((stop) => stop.id === progress?.currentStopId) ?? draft.stops[0] ?? null;
  const currentStopState = currentStop ? progress?.stopStates[currentStop.id] ?? "pending" : "pending";
  const currentStopIndex = currentStop ? draft.stops.findIndex((stop) => stop.id === currentStop.id) + 1 : 0;
  const currentStopNavigationUrl = currentStop ? stopNavigationUrl(currentStop) : null;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 px-4 pb-28 pt-4 sm:space-y-6 sm:px-6 sm:pb-6 sm:pt-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
          <Link href="/planner" className="hover:text-[var(--text-strong)]">
            Zurück zum Planner
          </Link>
          <Link href="/routes" className="hover:text-[var(--text-strong)]">
            Route Builder
          </Link>
        </div>
        <button
          type="button"
          onClick={resetRun}
          className="w-full rounded-xl border border-[var(--line-subtle)] bg-white px-3 py-2.5 text-sm text-[var(--text-strong)] hover:bg-[var(--bg-panel)] sm:w-auto"
        >
          Fortschritt zurücksetzen
        </button>
      </div>

      <section className="w-full rounded-2xl border border-[var(--line-subtle)] bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="pd24-kicker mb-2">Route Live</div>
        <h1 className="break-words text-2xl font-semibold leading-tight tracking-tight text-[var(--text-strong)] sm:text-3xl">
          {draft.title}
        </h1>
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

      {currentStop ? (
        <section className="w-full rounded-2xl border border-[var(--line-subtle)] bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Aktueller Schritt
              </div>
              <h2 className="mt-1 break-words text-xl font-semibold leading-tight text-[var(--text-strong)]">
                {currentStop.title}
              </h2>
              <div className="mt-1 text-sm text-[var(--text-muted)]">
                Stop {currentStopIndex || currentStop.order} - {currentStop.label}
              </div>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs ${statusTone(currentStopState)}`}>
              {statusLabel(currentStopState)}
            </span>
          </div>
          {currentStop.note ? (
            <p className="mt-3 break-words text-sm leading-6 text-[var(--text-muted)]">{currentStop.note}</p>
          ) : null}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {currentStopNavigationUrl ? (
              <Link
                href={currentStopNavigationUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--text-strong)] px-4 py-2.5 text-sm font-medium text-white sm:w-auto"
              >
                Navigieren
              </Link>
            ) : null}
            {currentStopState === "pending" ? (
              <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => markStop(currentStop.id, "done")}
                  className="min-h-11 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-950 transition hover:bg-emerald-100"
                >
                  Erledigt
                </button>
                <button
                  type="button"
                  onClick={() => markStop(currentStop.id, "skipped")}
                  className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-950 transition hover:bg-rose-100"
                >
                  Skippen
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => markStop(currentStop.id, "pending")}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--line-subtle)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)] sm:w-auto"
              >
                Wieder öffnen
              </button>
            )}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_7rem]">
        <div className="w-full overflow-hidden rounded-2xl border border-[var(--line-subtle)] bg-white shadow-sm sm:rounded-3xl">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--line-subtle)] px-4 py-3 sm:px-5 sm:py-4">
            <h2 className="text-lg font-semibold leading-none text-[var(--text-strong)] sm:text-[1.8rem]">
              Map + Route
            </h2>
            <div className="text-sm text-[var(--text-muted)]">{draft.routeProfileLabel ?? "Route"}</div>
          </div>
          <div className="w-full overflow-hidden bg-white">
            <PlanMap stops={mapStops} profile="foot" height={280} showHeader={false} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 lg:auto-rows-fr lg:grid-cols-1 lg:gap-3">
          <div className="min-h-20 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 sm:rounded-3xl">
            <div className="text-[10px] uppercase tracking-wide text-emerald-800">Erledigt</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-950">{completedCount}</div>
          </div>
          <div className="min-h-20 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 sm:rounded-3xl">
            <div className="text-[10px] uppercase tracking-wide text-rose-800">Skippen</div>
            <div className="mt-2 text-2xl font-semibold text-rose-950">{skippedCount}</div>
          </div>
          <div className="min-h-20 rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-3 sm:rounded-3xl">
            <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Open</div>
            <div className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{pendingCount}</div>
          </div>
        </div>
      </section>

      <section className="w-full rounded-2xl border border-[var(--line-subtle)] bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Tagesverlauf</h2>
          </div>
          <div className="rounded-full bg-[var(--bg-panel)] px-4 py-2 text-sm text-[var(--text-muted)]">
            {progressPercent}% geschafft
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--bg-panel)]">
          <div className="h-full rounded-full bg-[var(--text-strong)] transition-all" style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4 sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Startpunkt</div>
                <div className="mt-2 break-words font-medium text-[var(--text-strong)]">
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
            return (
              <div
                key={stop.id}
                aria-current={active ? "step" : undefined}
                className={`overflow-hidden rounded-2xl border transition sm:rounded-3xl ${
                  active ? "border-[var(--text-strong)] bg-[var(--bg-panel)] shadow-sm" : "border-[var(--line-subtle)] bg-white"
                }`}
              >
                <button type="button" onClick={() => setCurrentStop(stop.id)} className="grid min-h-24 w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4 text-left transition hover:bg-[var(--bg-surface)]">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Stop {stop.order}</div>
                    <div className="mt-1 break-words text-base font-semibold leading-snug text-[var(--text-strong)] sm:text-lg">{stop.title}</div>
                    <div className="mt-1 truncate text-sm text-[var(--text-muted)]">{stop.label}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] ${statusTone(state)}`}>
                      {statusLabel(state)}
                    </span>
                    <span className="hidden text-xs text-[var(--text-muted)] sm:inline">{active ? "Aktiv" : "Öffnen"}</span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {currentStop ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line-subtle)] bg-white/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_40px_rgba(49,39,27,0.12)] backdrop-blur sm:hidden">
          <div className="mx-auto w-full max-w-7xl px-1 sm:px-6 lg:px-8">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--text-strong)]">
                  {currentStop.order}. {currentStop.title}
                </div>
                <div className="text-xs text-[var(--text-muted)]">{statusLabel(currentStopState)}</div>
              </div>
              <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-2 py-1 text-[11px] text-[var(--text-muted)]">
                {progressPercent}%
              </span>
            </div>
            <div
              className={`grid gap-2 ${
                currentStopState === "pending"
                  ? currentStopNavigationUrl
                    ? "grid-cols-3"
                    : "grid-cols-2"
                  : currentStopNavigationUrl
                    ? "grid-cols-2"
                    : "grid-cols-1"
              }`}
            >
              {currentStopNavigationUrl ? (
                <Link
                  href={currentStopNavigationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--text-strong)] px-3 text-sm font-medium text-white"
                >
                  Navi
                </Link>
              ) : null}
              {currentStopState === "pending" ? (
                <>
                  <button
                    type="button"
                    onClick={() => markStop(currentStop.id, "done")}
                    className="min-h-11 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-950"
                  >
                    Erledigt
                  </button>
                  <button
                    type="button"
                    onClick={() => markStop(currentStop.id, "skipped")}
                    className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-950"
                  >
                    Skippen
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => markStop(currentStop.id, "pending")}
                  className="min-h-11 rounded-xl border border-[var(--line-subtle)] bg-white px-3 text-sm font-medium text-[var(--text-strong)]"
                >
                  Wieder
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
