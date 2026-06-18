"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlanMapStop } from "@/components/PlanMap";
import { fetchRoadtripRouteBySlug } from "@/lib/roadtrip/client";
import {
  stopArrivalDate,
  type RoadtripRoute,
  type RoadtripRouteStop,
} from "@/lib/roadtrip/types";
import {
  clearRoadtripRunProgress,
  readRoadtripRunProgress,
  writeRoadtripRunProgress,
  type RoadtripRunProgress,
  type RoadtripRunStopState,
} from "@/lib/roadtrip/roadtrip-run-progress";
import HotelSearchLinks from "@/components/roadtrip/HotelSearchLinks";

const PlanMap = dynamic(() => import("@/components/PlanMap"), { ssr: false });

const ROADTRIP_AFTERNOON_START_MIN = 14 * 60 + 30;

type RunStop = RoadtripRouteStop & {
  id: string;
  order: number;
  arrivalDate: string;
  departureDate: string;
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateDE(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function isValidDateInput(value: string | null) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function buildRoadtripStopId(stop: RoadtripRouteStop, index: number) {
  return `${stop.citySlug}:${index}`;
}

function cityNavigationUrl(stop: RoadtripRouteStop) {
  if (stop.lat != null && stop.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`;
  }
  return null;
}

function statusLabel(status: RoadtripRunStopState) {
  if (status === "done") return "Erledigt";
  if (status === "skipped") return "Uebersprungen";
  return "Offen";
}

function statusTone(status: RoadtripRunStopState) {
  if (status === "done") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "skipped") return "border-rose-200 bg-rose-50 text-rose-900";
  return "border-[var(--line-subtle)] bg-white text-[var(--text-muted)]";
}

function nextPendingStopId(
  stops: RunStop[],
  states: Record<string, RoadtripRunStopState>,
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

function buildRunStops(route: RoadtripRoute, startDate: string): RunStop[] {
  return route.stops.map((stop, index) => {
    const arrivalDate = stopArrivalDate(startDate, route.stops, index);
    return {
      ...stop,
      id: buildRoadtripStopId(stop, index),
      order: index + 1,
      arrivalDate,
      departureDate: addDays(arrivalDate, stop.nights),
    };
  });
}

function buildInitialProgress(route: RoadtripRoute, stops: RunStop[], startDate: string) {
  const persisted = readRoadtripRunProgress(route.id, route.slug, startDate);
  const stopStates: Record<string, RoadtripRunStopState> = {};
  stops.forEach((stop) => {
    stopStates[stop.id] = persisted?.stopStates?.[stop.id] ?? "pending";
  });
  const currentStopId =
    (persisted?.currentStopId && stopStates[persisted.currentStopId] ? persisted.currentStopId : null) ??
    nextPendingStopId(stops, stopStates) ??
    stops[0]?.id ??
    null;

  return {
    routeId: route.id,
    routeSlug: route.slug ?? null,
    startDate,
    startedAt: persisted?.startedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentStopId,
    stopStates,
  } satisfies RoadtripRunProgress;
}

function runStepSummary(stop: RunStop) {
  const parts = [`${stop.nights} ${stop.nights === 1 ? "Nacht" : "Naechte"}`];
  if (stop.creatorRouteTitle) parts.push("Creator-Route verfuegbar");
  else if (stop.plannedStops?.length) parts.push(`${stop.plannedStops.length} Tagesstopps`);
  else parts.push("Noch kein Tagesplan");
  return parts.join(" · ");
}

function runStepAction(stop: RunStop, roadtripSlug?: string) {
  if (stop.creatorRouteSlug) {
    const backParam = roadtripSlug ? `?fromRoadtrip=${encodeURIComponent(roadtripSlug)}&startDate=${stop.arrivalDate}` : "";
    return {
      href: `/routes/${stop.creatorRouteSlug}/run${backParam}`,
      label: "Creator-Route starten",
    };
  }
  return {
    href: `/planner?citySlug=${stop.citySlug}&planDate=${stop.arrivalDate}&dayStartMin=${ROADTRIP_AFTERNOON_START_MIN}`,
    label: stop.plannedStops?.length ? "Tagesplanung oeffnen" : "Tag planen",
  };
}

function isTodayStop(stop: RunStop, today: string) {
  return today >= stop.arrivalDate && today < stop.departureDate;
}

function runStepPlanPreview(stop: RunStop) {
  if (stop.creatorRouteTitle) return stop.creatorRouteTitle;
  if (stop.plannedStops?.length) return `${stop.plannedStops.length} Stopps vorbereitet`;
  return "Noch kein Tagesplan vorbereitet";
}

export default function RoadtripRouteRunPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [route, setRoute] = useState<RoadtripRoute | null>(null);
  const [progress, setProgress] = useState<RoadtripRunProgress | null>(null);
  const [checkedSubStops, setCheckedSubStops] = useState<Record<string, boolean>>({});
  const currentStopSectionRef = useRef<HTMLElement | null>(null);
  const previousCurrentStopIdRef = useRef<string | null>(null);

  const startDate = isValidDateInput(searchParams.get("startDate")) ? (searchParams.get("startDate") as string) : todayStr();
  const today = todayStr();
  const stops = useMemo(() => (route ? buildRunStops(route, startDate) : []), [route, startDate]);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    void (async () => {
      setLoading(true);
      setNotFound(false);
      const nextRoute = await fetchRoadtripRouteBySlug(slug);
      if (!active) return;
      if (!nextRoute) {
        setRoute(null);
        setNotFound(true);
      } else {
        setRoute(nextRoute);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!route) return;
    const next = buildInitialProgress(route, stops, startDate);
    setProgress(next);
    writeRoadtripRunProgress(next);
  }, [route, startDate, stops]);

  useEffect(() => {
    const nextStopId = progress?.currentStopId ?? null;
    if (!nextStopId) {
      previousCurrentStopIdRef.current = null;
      return;
    }
    const previousStopId = previousCurrentStopIdRef.current;
    previousCurrentStopIdRef.current = nextStopId;
    if (!previousStopId || previousStopId === nextStopId) return;
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      currentStopSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [progress?.currentStopId]);

  const completedCount = useMemo(
    () => stops.filter((stop) => progress?.stopStates[stop.id] === "done").length,
    [progress?.stopStates, stops]
  );
  const skippedCount = useMemo(
    () => stops.filter((stop) => progress?.stopStates[stop.id] === "skipped").length,
    [progress?.stopStates, stops]
  );
  const handledCount = completedCount + skippedCount;
  const pendingCount = Math.max(0, stops.length - handledCount);
  const progressPercent = stops.length > 0 ? Math.round((handledCount / stops.length) * 100) : 0;

  const currentStop = stops.find((stop) => stop.id === progress?.currentStopId) ?? stops[0] ?? null;
  const currentStopState = currentStop ? progress?.stopStates[currentStop.id] ?? "pending" : "pending";
  const currentStopNavigationUrl = currentStop ? cityNavigationUrl(currentStop) : null;
  const currentStopAction = currentStop ? runStepAction(currentStop, route?.slug) : null;
  const todayStop = stops.find((stop) => isTodayStop(stop, today)) ?? null;
  const isCurrentStopToday = currentStop ? isTodayStop(currentStop, today) : false;
  const firstPendingStop = stops.find((stop) => (progress?.stopStates[stop.id] ?? "pending") === "pending") ?? null;
  const nextPendingTargetId =
    currentStopState === "pending"
      ? nextPendingStopId(stops, progress?.stopStates ?? {}, currentStop?.id) ?? null
      : firstPendingStop?.id ?? null;
  const nextPendingStop =
    (nextPendingTargetId ? stops.find((stop) => stop.id === nextPendingTargetId) : null) ?? firstPendingStop;
  const showNextPendingCta = Boolean(
    nextPendingStop &&
      (
        !currentStop ||
        currentStopState !== "pending" ||
        nextPendingStop.id !== currentStop.id ||
        pendingCount > 1
      )
  );

  const mapStops = useMemo(() => {
    return stops
      .filter((stop) => stop.lat != null && stop.lng != null)
      .map((stop) => {
        const state = progress?.stopStates[stop.id] ?? "pending";
        const markerVariant =
          progress?.currentStopId === stop.id
            ? "active"
            : state === "done"
              ? "done"
              : state === "skipped"
                ? "skipped"
                : "default";
        return {
          label: `Stop ${stop.order}`,
          name: stop.cityLabel,
          lat: stop.lat,
          lng: stop.lng,
          markerVariant,
        } satisfies PlanMapStop;
      });
  }, [progress?.currentStopId, progress?.stopStates, stops]);

  const subStopKey = route ? `pd24:roadtrip-substops:${route.id}:${startDate}` : null;

  useEffect(() => {
    if (!subStopKey) return;
    try {
      const raw = localStorage.getItem(subStopKey);
      if (raw) setCheckedSubStops(JSON.parse(raw) as Record<string, boolean>);
    } catch { /* ignore */ }
  }, [subStopKey]);

  const toggleSubStop = useCallback((key: string) => {
    setCheckedSubStops((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (subStopKey) {
        try { localStorage.setItem(subStopKey, JSON.stringify(next)); } catch { /* ignore */ }
      }
      return next;
    });
  }, [subStopKey]);

  function persistProgress(next: RoadtripRunProgress) {
    setProgress(next);
    writeRoadtripRunProgress(next);
  }

  function setCurrentStop(stopId: string) {
    if (!progress) return;
    persistProgress({
      ...progress,
      currentStopId: stopId,
      updatedAt: new Date().toISOString(),
    });
  }

  function markStop(stopId: string, state: RoadtripRunStopState) {
    if (!route || !progress) return;
    const nextStates = {
      ...progress.stopStates,
      [stopId]: state,
    };
    persistProgress({
      routeId: route.id,
      routeSlug: route.slug ?? null,
      startDate,
      startedAt: progress.startedAt,
      updatedAt: new Date().toISOString(),
      currentStopId:
        state === "pending"
          ? stopId
          : nextPendingStopId(stops, nextStates, stopId) ?? stops.find((stop) => stop.id === stopId)?.id ?? stops[0]?.id ?? null,
      stopStates: nextStates,
    });
  }

  function resetRoadtripRun() {
    if (!route) return;
    clearRoadtripRunProgress(route.id, route.slug, startDate);
    const next = buildInitialProgress(route, stops, startDate);
    persistProgress(next);
  }

  if (loading) {
    return (
      <main className="pd24-page-wide">
        <div className="rounded-2xl border border-[var(--line-subtle)] bg-white p-5 shadow-sm">
          Roadtrip wird vorbereitet...
        </div>
      </main>
    );
  }

  if (!route || notFound) {
    return (
      <main className="pd24-page-wide space-y-4">
        <Link href="/roadtrip/routes" className="text-sm text-[var(--text-muted)] underline">
          Zurueck zu Roadtrip-Routen
        </Link>
        <div className="rounded-2xl border border-[var(--line-subtle)] bg-white p-5 shadow-sm">
          Dieser Roadtrip konnte nicht geladen werden.
        </div>
      </main>
    );
  }

  return (
    <main className="pd24-page-wide space-y-4 pb-28 sm:space-y-6 sm:pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
          <Link href={`/roadtrip/routes/${route.slug}`} className="hover:text-[var(--text-strong)]">
              Zurueck zum Roadtrip
          </Link>
          <span>Start: {formatDateDE(startDate)}</span>
        </div>
        <button
          type="button"
          onClick={resetRoadtripRun}
          className="w-full rounded-xl border border-[var(--line-subtle)] bg-white px-3 py-2.5 text-sm text-[var(--text-strong)] hover:bg-[var(--bg-panel)] sm:w-auto"
        >
          Fortschritt zuruecksetzen
        </button>
      </div>

      <section className="rounded-2xl border border-[var(--line-subtle)] bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="pd24-kicker mb-2">Roadtrip Live</div>
        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-[var(--text-strong)] sm:text-3xl">
          {route.title}
        </h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
            {stops.length} Staedte
          </span>
          <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
            {progressPercent}% geschafft
          </span>
          <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
            {pendingCount} offen
          </span>
          {todayStop ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
              Heute: {todayStop.cityLabel}
            </span>
          ) : null}
        </div>
      </section>

      {pendingCount > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm sm:rounded-3xl sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                Naechster offener Stop
              </div>
              <div className="mt-1 text-base font-semibold text-amber-950">
                {nextPendingStop ? nextPendingStop.cityLabel : "Offene Etappe fortsetzen"}
              </div>
              <div className="mt-1 text-sm text-amber-800">
                {nextPendingStop
                  ? `Stop ${nextPendingStop.order} · ${formatDateDE(nextPendingStop.arrivalDate)} bis ${formatDateDE(nextPendingStop.departureDate)}`
                  : "Es wartet noch mindestens eine offene Etappe auf dich."}
              </div>
              {nextPendingStop && todayStop?.id === nextPendingStop.id ? (
                <div className="mt-2 inline-flex rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-800">
                  Heute dran
                </div>
              ) : null}
            </div>
            {showNextPendingCta && nextPendingStop ? (
              <button
                type="button"
                onClick={() => setCurrentStop(nextPendingStop.id)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-amber-600"
              >
                Jetzt oeffnen
              </button>
            ) : (
              <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-medium text-amber-800">
                Du bist bereits am richtigen Stop
              </span>
            )}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm sm:rounded-3xl sm:p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Roadtrip abgeschlossen</div>
          <div className="mt-1 text-base font-semibold text-emerald-950">Alle Stopps sind erledigt oder bewusst uebersprungen.</div>
          <div className="mt-1 text-sm text-emerald-800">Du kannst den Fortschritt zuruecksetzen oder den Roadtrip als Vorlage erneut starten.</div>
        </section>
      )}

      {currentStop ? (
        <section ref={currentStopSectionRef} className="rounded-2xl border border-[var(--line-subtle)] bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Aktuelle Etappe
              </div>
              <h2 className="mt-1 break-words text-xl font-semibold text-[var(--text-strong)]">
                {currentStop.cityLabel}
              </h2>
              <div className="mt-1 text-sm text-[var(--text-muted)]">
                Stop {currentStop.order} - {formatDateDE(currentStop.arrivalDate)} bis {formatDateDE(currentStop.departureDate)}
              </div>
              <div className="mt-1 text-sm text-[var(--text-muted)]">{runStepSummary(currentStop)}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-[11px] ${statusTone(currentStopState)}`}>
                  {statusLabel(currentStopState)}
                </span>
                {isCurrentStopToday ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
                    Heute vor Ort
                  </span>
                ) : null}
                <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
                  Abreise bis 10:00
                </span>
              </div>
              {currentStopState === "pending" && (
                <div className="mt-2 text-xs font-medium text-amber-700">
                  Diese Etappe ist jetzt aktiv. Navigation und Tagesplanung sind direkt darunter verfuegbar.
                </div>
              )}
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs ${statusTone(currentStopState)}`}>
              {statusLabel(currentStopState)}
            </span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Anreise</div>
              <div className="mt-2 text-sm font-medium text-[var(--text-strong)]">Check-in ab 14:30</div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">Vormittag fuer Checkout und Fahrt reserviert.</div>
            </div>
            <div className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Tagesplanung</div>
              <div className="mt-2 text-sm font-medium text-[var(--text-strong)]">{runStepPlanPreview(currentStop)}</div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">Passe die Etappe bei Bedarf direkt im passenden Modus an.</div>
            </div>
            <div className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Abreise</div>
              <div className="mt-2 text-sm font-medium text-[var(--text-strong)]">{formatDateDE(currentStop.departureDate)}</div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">Naechster Ortswechsel und Hotel-Checkout bis 10:00.</div>
            </div>
          </div>

          {currentStop.planSummary ? (
            <div className="mt-4 rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Tagesplan-Zusammenfassung</div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-strong)]">{currentStop.planSummary}</p>
            </div>
          ) : null}

          {currentStop.plannedStops && currentStop.plannedStops.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Tagesstopps ({currentStop.plannedStops.filter((_, i) => checkedSubStops[`${currentStop.id}:${i}`]).length}/{currentStop.plannedStops.length})
                </div>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--bg-panel)]">
                  <div
                    className="h-full rounded-full bg-[var(--brand-warm)] transition-all"
                    style={{ width: `${Math.round((currentStop.plannedStops.filter((_, i) => checkedSubStops[`${currentStop.id}:${i}`]).length / currentStop.plannedStops.length) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {currentStop.plannedStops.map((subStop, i) => {
                  const key = `${currentStop.id}:${i}`;
                  const done = Boolean(checkedSubStops[key]);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleSubStop(key)}
                      className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                        done
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-[var(--line-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-panel)]"
                      }`}
                    >
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                        done ? "border-emerald-400 bg-emerald-400 text-white" : "border-[var(--line-subtle)] bg-white"
                      }`}>
                        {done ? "✓" : ""}
                      </span>
                      <div className="min-w-0">
                        <div className={`text-sm font-medium leading-snug ${done ? "text-emerald-800 line-through" : "text-[var(--text-strong)]"}`}>
                          {subStop.label}
                        </div>
                        {subStop.hint ? (
                          <div className="mt-0.5 text-xs text-[var(--text-muted)]">{subStop.hint}</div>
                        ) : null}
                        {subStop.time ? (
                          <div className="mt-1 inline-flex rounded-full border border-[var(--line-subtle)] bg-white px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                            {subStop.time}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-4">
            <HotelSearchLinks
              cityLabel={currentStop.cityLabel}
              checkin={currentStop.arrivalDate}
              checkout={currentStop.departureDate}
              nights={currentStop.nights}
              citySlug={currentStop.citySlug}
              occasion={route?.occasion ?? null}
              budget={route?.budget ?? null}
              planSummary={currentStop.planSummary ?? null}
            />
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {currentStopNavigationUrl ? (
              <Link
                href={currentStopNavigationUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--text-strong)] px-4 py-2.5 text-sm font-medium text-white"
              >
                Zum Standort navigieren
              </Link>
            ) : null}
            {currentStopAction ? (
              <Link
                href={currentStopAction.href}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--line-subtle)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--text-strong)] hover:bg-[var(--bg-panel)]"
              >
                {currentStopAction.label}
              </Link>
            ) : null}
            {currentStopState === "pending" ? (
              <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => markStop(currentStop.id, "done")}
                  className="min-h-11 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-950 hover:bg-emerald-100"
                >
                  Erledigt
                </button>
                <button
                  type="button"
                  onClick={() => markStop(currentStop.id, "skipped")}
                  className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-950 hover:bg-rose-100"
                >
                  Skippen
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => markStop(currentStop.id, "pending")}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--line-subtle)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--text-strong)] hover:bg-[var(--bg-panel)]"
              >
                Wieder oeffnen
              </button>
            )}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 sm:gap-6">
        <section className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_7rem]">
          <div className="overflow-hidden rounded-2xl border border-[var(--line-subtle)] bg-white shadow-sm sm:rounded-3xl">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line-subtle)] px-4 py-3 sm:px-5 sm:py-4">
              <h2 className="text-base font-semibold text-[var(--text-strong)] sm:text-[1.8rem]">Map + Strecke</h2>
              <div className="hidden text-sm text-[var(--text-muted)] sm:block">Roadtrip</div>
            </div>
            <div className="w-full overflow-hidden bg-white">
              <PlanMap stops={mapStops} profile="car" height={260} showHeader={false} />
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
              <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Offen</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{pendingCount}</div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--line-subtle)] bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold sm:text-2xl">Roadtrip-Verlauf</h2>
            <div className="rounded-full bg-[var(--bg-panel)] px-3 py-1.5 text-xs text-[var(--text-muted)] sm:px-4 sm:py-2 sm:text-sm">
              {progressPercent}% geschafft
            </div>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--bg-panel)]">
            <div className="h-full rounded-full bg-[var(--text-strong)] transition-all" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="mt-4 space-y-3">
            {stops.map((stop) => {
              const state = progress?.stopStates[stop.id] ?? "pending";
              const active = progress?.currentStopId === stop.id;
              const cardTone =
                state === "done"
                  ? active
                    ? "border-emerald-300 bg-emerald-50 shadow-sm"
                    : "border-emerald-200 bg-emerald-50/70"
                    : state === "skipped"
                      ? active
                        ? "border-rose-300 bg-rose-50 shadow-sm"
                        : "border-rose-200 bg-rose-50/70"
                      : active
                        ? "border-amber-300 bg-amber-50/40 shadow-sm ring-1 ring-amber-200/70"
                        : "border-[var(--line-subtle)] bg-white";
              const action = runStepAction(stop, route?.slug);
              const todayFlag = isTodayStop(stop, today);

              return (
                <div key={stop.id} className={`overflow-hidden rounded-2xl border transition sm:rounded-3xl ${cardTone}`}>
                  <button
                    type="button"
                    onClick={() => setCurrentStop(stop.id)}
                    className="grid min-h-24 w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4 text-left transition hover:bg-[var(--bg-surface)]"
                  >
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Stop {stop.order}</div>
                      <div className="mt-1 break-words text-base font-semibold leading-snug text-[var(--text-strong)] sm:text-lg">
                        {stop.cityLabel}
                      </div>
                      <div className="mt-2 text-xs text-[var(--text-muted)]">
                        {formatDateDE(stop.arrivalDate)} bis {formatDateDE(stop.departureDate)}
                      </div>
                      <div className="mt-1 truncate text-xs text-[var(--text-muted)]">{runStepSummary(stop)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {todayFlag ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
                          Heute
                        </span>
                      ) : null}
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] ${statusTone(state)}`}>
                        {statusLabel(state)}
                      </span>
                      <span className="hidden text-xs text-[var(--text-muted)] sm:inline">{active ? "Aktiv" : "Oeffnen"}</span>
                    </div>
                  </button>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[rgba(23,23,23,0.05)] bg-[rgba(23,23,23,0.015)] px-4 py-2.5">
                    <span className="text-xs text-[var(--text-muted)]">{runStepSummary(stop)}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {cityNavigationUrl(stop) ? (
                        <Link
                          href={cityNavigationUrl(stop)!}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line-subtle)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--text-strong)] hover:bg-[var(--bg-panel)]"
                        >
                          Navigieren
                        </Link>
                      ) : null}
                      <Link
                        href={action.href}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--text-strong)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1f2937]"
                      >
                        {action.label}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {currentStop ? (
        <div className="fixed inset-x-0 bottom-0 z-[1200] border-t border-[var(--line-subtle)] bg-white/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_40px_rgba(49,39,27,0.12)] backdrop-blur sm:hidden">
          <div className="mx-auto w-full max-w-7xl px-1">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--text-strong)]">
                  {currentStop.order}. {currentStop.cityLabel}
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
                    ? "grid-cols-2"
                    : "grid-cols-1"
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
                  Navigieren
                </Link>
              ) : null}
              {currentStopAction ? (
                <Link
                  href={currentStopAction.href}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--line-subtle)] bg-white px-3 text-sm font-medium text-[var(--text-strong)]"
                >
                  {currentStopAction.label}
                </Link>
              ) : null}
            </div>
            <div className={`mt-2 grid gap-2 ${currentStopState === "pending" ? "grid-cols-2" : "grid-cols-1"}`}>
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
                  Wieder oeffnen
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
