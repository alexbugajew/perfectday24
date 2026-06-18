"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Suspense, useEffect, useMemo, useState } from "react";
import type { PlanMapStop } from "@/components/PlanMap";
import { supabase } from "@/lib/supabaseClient";
import {
  clearRouteRunProgress,
  readRouteRunProgress,
  writeRouteRunProgress,
  type RouteRunProgress,
  type RouteRunStopState,
} from "@/lib/routes/route-run-progress";

const PlanMap = dynamic(() => import("@/components/PlanMap"), { ssr: false });

type UserRouteRow = {
  id: string;
  city_slug: string | null;
  title: string;
  slug: string | null;
  description: string | null;
  cover_image_url: string | null;
  start_label: string | null;
  start_type: string | null;
  start_lat: number | null;
  start_lng: number | null;
  visibility: "private" | "unlisted" | "public";
};

type RouteStopRow = {
  id: string;
  route_id: string;
  stop_order: number;
  location_id: string | null;
  title: string | null;
  note: string | null;
  external_url: string | null;
  is_required: boolean;
  duration_min: number | null;
  lat: number | null;
  lng: number | null;
  photo_url: string | null;
};

function niceStartType(value: string | null) {
  if (value === "hotel") return "Hotel";
  if (value === "station") return "Bahnhof";
  if (value === "airport") return "Flughafen";
  if (value === "other") return "Startpunkt";
  return "Adresse";
}

function routeStopTitle(stop: RouteStopRow) {
  return stop.title?.trim() || `Stop ${stop.stop_order}`;
}

function routeStopSummary(stop: RouteStopRow) {
  const parts = [
    stop.duration_min ? `${stop.duration_min} Min` : null,
    stop.is_required ? "Pflicht-Stop" : null,
    stop.external_url ? "Link" : null,
    stop.photo_url ? "Foto" : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" | ") : "Ohne Zusatzinfos";
}

function stopNavigationUrl(stop: RouteStopRow) {
  if (stop.lat != null && stop.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`;
  }
  return stop.external_url ?? null;
}

function statusLabel(status: RouteRunStopState) {
  if (status === "done") return "Erledigt";
  if (status === "skipped") return "Uebersprungen";
  return "Offen";
}

function statusTone(status: RouteRunStopState) {
  if (status === "done") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "skipped") return "border-rose-200 bg-rose-50 text-rose-900";
  return "border-[var(--line-subtle)] bg-white text-[var(--text-muted)]";
}

function nextPendingStopId(
  stops: RouteStopRow[],
  states: Record<string, RouteRunStopState>,
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

function buildMergedProgress(route: UserRouteRow, stops: RouteStopRow[]) {
  const persisted = readRouteRunProgress(route.id, route.slug);
  const stopStates: Record<string, RouteRunStopState> = {};
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
    startedAt: persisted?.startedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentStopId,
    stopStates,
  } satisfies RouteRunProgress;
}

function RouteRunPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const fromRoadtrip = searchParams.get("fromRoadtrip");
  const fromRoadtripDate = searchParams.get("startDate");

  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState<UserRouteRow | null>(null);
  const [stops, setStops] = useState<RouteStopRow[]>([]);
  const [progress, setProgress] = useState<RouteRunProgress | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setUserId(data.session?.user?.id ?? null);
      setAuthReady(true);
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setAuthReady(true);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!slug || !authReady) return;
    let active = true;
    void (async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const { data, error } = await supabase.from("user_routes").select("*").eq("slug", slug).maybeSingle();
        if (!active) return;
        if (error || !data) {
          setRoute(null);
          setStops([]);
          setNotFound(true);
          return;
        }
        const nextRoute = data as UserRouteRow;
        if (nextRoute.visibility === "private" && nextRoute.id && userId == null) {
          setRoute(null);
          setStops([]);
          setNotFound(true);
          return;
        }
        setRoute(nextRoute);

        const { data: stopRows, error: stopError } = await supabase
          .from("user_route_stops")
          .select("*")
          .eq("route_id", nextRoute.id)
          .order("stop_order", { ascending: true });

        if (!active) return;
        if (stopError) {
          setStops([]);
          return;
        }
        setStops((stopRows ?? []) as RouteStopRow[]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authReady, slug, userId]);

  useEffect(() => {
    if (!route) return;
    const next = buildMergedProgress(route, stops);
    setProgress(next);
    writeRouteRunProgress(next);
  }, [route, stops]);

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

  const mapStops = useMemo(() => {
    const points: PlanMapStop[] = [];
    if (route?.start_lat != null && route?.start_lng != null) {
      points.push({
        label: "Start",
        name: route.start_label || "Startpunkt",
        lat: route.start_lat,
        lng: route.start_lng,
        markerVariant: "start",
      });
    }
    stops.forEach((stop) => {
      const stopState = progress?.stopStates[stop.id] ?? "pending";
      const markerVariant =
        progress?.currentStopId === stop.id
          ? "active"
          : stopState === "done"
            ? "done"
            : stopState === "skipped"
              ? "skipped"
              : "default";
      if (stop.lat != null && stop.lng != null) {
        points.push({
          label: `Stop ${stop.stop_order}`,
          name: routeStopTitle(stop),
          lat: stop.lat,
          lng: stop.lng,
          markerVariant,
        });
      }
    });
    return points;
  }, [progress?.currentStopId, progress?.stopStates, route?.start_label, route?.start_lat, route?.start_lng, stops]);

  const startNavigationUrl =
    route?.start_lat != null && route?.start_lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${route.start_lat},${route.start_lng}`
      : null;
  const currentStop = stops.find((stop) => stop.id === progress?.currentStopId) ?? stops[0] ?? null;
  const currentStopState = currentStop ? progress?.stopStates[currentStop.id] ?? "pending" : "pending";
  const currentStopIndex = currentStop ? stops.findIndex((stop) => stop.id === currentStop.id) + 1 : 0;
  const currentStopNavigationUrl = currentStop ? stopNavigationUrl(currentStop) : null;

  function persistProgress(next: RouteRunProgress) {
    setProgress(next);
    writeRouteRunProgress(next);
  }

  function setCurrentStop(stopId: string) {
    if (!progress) return;
    persistProgress({
      ...progress,
      currentStopId: stopId,
      updatedAt: new Date().toISOString(),
    });
  }

  function markStop(stopId: string, state: RouteRunStopState) {
    if (!progress || !route) return;
    const nextStates = {
      ...progress.stopStates,
      [stopId]: state,
    };
    const nextCurrentStopId =
      state === "pending"
        ? stopId
        : nextPendingStopId(stops, nextStates, stopId) ??
          stops.find((stop) => stop.id === stopId)?.id ??
          stops[0]?.id ??
          null;

    persistProgress({
      routeId: route.id,
      routeSlug: route.slug ?? null,
      startedAt: progress.startedAt,
      updatedAt: new Date().toISOString(),
      currentStopId: nextCurrentStopId,
      stopStates: nextStates,
    });
  }

  function resetRouteRun() {
    if (!route) return;
    clearRouteRunProgress(route.id, route.slug);
    const next = buildMergedProgress(route, stops);
    persistProgress(next);
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="rounded-2xl border border-[var(--line-subtle)] bg-white p-5 shadow-sm">
          Route wird vorbereitet...
        </div>
      </main>
    );
  }

  if (!route || notFound) {
    return (
      <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Link href="/saved" className="text-sm text-[var(--text-muted)] underline">
          Meine Pläne
        </Link>
        <div className="rounded-2xl border border-[var(--line-subtle)] bg-white p-5 shadow-sm sm:p-6">
          Diese Route konnte nicht geladen werden.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-3 px-4 pb-28 pt-3 sm:space-y-6 sm:px-6 sm:pb-6 sm:pt-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3 text-xs text-[var(--text-muted)] sm:text-sm">
          {fromRoadtrip ? (
            <Link
              href={`/roadtrip/routes/${fromRoadtrip}/run${fromRoadtripDate ? `?startDate=${fromRoadtripDate}` : ""}`}
              className="flex items-center gap-1.5 hover:text-[var(--text-strong)]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
              </svg>
              Zurück zum Roadtrip
            </Link>
          ) : (
            <Link href={`/routes/${route.slug ?? slug}`} className="hover:text-[var(--text-strong)]">
              Zurück zur Route
            </Link>
          )}
          <Link href="/planner" className="hover:text-[var(--text-strong)]">
            Planner
          </Link>
        </div>
        <button
          type="button"
          onClick={resetRouteRun}
          className="shrink-0 rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1.5 text-xs text-[var(--text-strong)] hover:bg-[var(--bg-panel)]"
        >
          Reset
        </button>
      </div>

      <section className="w-full rounded-2xl border border-[var(--line-subtle)] bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div>
          <div className="pd24-kicker mb-1.5">Route Live</div>
          <h1 className="break-words text-xl font-semibold leading-tight tracking-tight text-[var(--text-strong)] sm:text-3xl">
            {route.title}
          </h1>
          {route.description ? (
            <p className="mt-2 hidden max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:block">{route.description}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] sm:text-xs">
              {route.city_slug ?? "ohne Stadt"}
            </span>
            <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] sm:text-xs">
              {stops.length} Stop{stops.length === 1 ? "" : "s"}
            </span>
            <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] sm:text-xs">
              {progressPercent}% geschafft
            </span>
          </div>
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
                {routeStopTitle(currentStop)}
              </h2>
              <div className="mt-1 text-sm text-[var(--text-muted)]">
                Stop {currentStopIndex || currentStop.stop_order} - {routeStopSummary(currentStop)}
              </div>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs ${statusTone(currentStopState)}`}>
              {statusLabel(currentStopState)}
            </span>
          </div>
          {currentStop.note ? (
            <p className="mt-3 break-words text-sm leading-6 text-[var(--text-muted)]">{currentStop.note}</p>
          ) : null}
          {currentStop.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentStop.photo_url}
              alt={routeStopTitle(currentStop)}
              className="mt-3 h-32 w-full rounded-2xl object-cover sm:h-44"
            />
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

      <div className="grid w-full gap-4 sm:gap-6">
        <section className="space-y-4">
          <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_7rem]">
            <div className="w-full overflow-hidden rounded-2xl border border-[var(--line-subtle)] bg-white shadow-sm sm:rounded-3xl">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--line-subtle)] px-4 py-3 sm:px-5 sm:py-4">
                <h2 className="text-base font-semibold leading-none text-[var(--text-strong)] sm:text-[1.8rem]">
                  Map + Route
                </h2>
                <div className="hidden text-sm text-[var(--text-muted)] sm:block">OSRM aktiv</div>
              </div>
              <div className="w-full overflow-hidden bg-white">
                <PlanMap stops={mapStops} profile="foot" height={240} showHeader={false} />
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
          </div>
        </section>

        <section className="w-full rounded-2xl border border-[var(--line-subtle)] bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold sm:text-2xl">Tagesverlauf</h2>
            </div>
            <div className="rounded-full bg-[var(--bg-panel)] px-3 py-1.5 text-xs text-[var(--text-muted)] sm:px-4 sm:py-2 sm:text-sm">
              {progressPercent}% geschafft
            </div>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--bg-panel)]">
            <div
              className="h-full rounded-full bg-[var(--text-strong)] transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4 sm:rounded-3xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Startpunkt</div>
                    <div className="mt-2 font-medium text-[var(--text-strong)]">
                      {route.start_label || "Kein expliziter Startpunkt"}
                    </div>
                    <div className="mt-1 text-sm text-[var(--text-muted)]">{niceStartType(route.start_type)}</div>
                  </div>
                  {startNavigationUrl ? (
                    <Link
                      href={startNavigationUrl}
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
                        ? "border-[rgba(15,23,42,0.28)] bg-white shadow-sm ring-1 ring-[rgba(15,23,42,0.06)]"
                        : "border-[var(--line-subtle)] bg-white";
                const buttonTone =
                  state === "done"
                    ? active
                      ? "bg-emerald-50"
                      : "hover:bg-emerald-50"
                    : state === "skipped"
                      ? active
                        ? "bg-rose-50"
                        : "hover:bg-rose-50"
                      : active
                        ? "bg-[var(--bg-panel)]"
                        : "hover:bg-[var(--bg-surface)]";

                return (
                  <div
                    key={stop.id}
                    aria-current={active ? "step" : undefined}
                    className={`overflow-hidden rounded-2xl border transition sm:rounded-3xl ${cardTone}`}
                  >
                    <button
                      type="button"
                      onClick={() => setCurrentStop(stop.id)}
                      className={`grid min-h-24 w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4 text-left transition ${buttonTone}`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Stop {stop.stop_order}</div>
                        <div className="mt-1 break-words text-base font-semibold leading-snug text-[var(--text-strong)] sm:text-lg">{routeStopTitle(stop)}</div>
                        <div className="mt-2 truncate text-xs text-[var(--text-muted)]">{routeStopSummary(stop)}</div>
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
      </div>

      {currentStop ? (
        <div className="fixed inset-x-0 bottom-0 z-[1200] border-t border-[var(--line-subtle)] bg-white/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_40px_rgba(49,39,27,0.12)] backdrop-blur sm:hidden">
          <div className="mx-auto w-full max-w-7xl px-1 sm:px-6 lg:px-8">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--text-strong)]">
                  {currentStop.stop_order}. {routeStopTitle(currentStop)}
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

export default function RouteRunPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="rounded-2xl border border-[var(--line-subtle)] bg-white p-5 shadow-sm">
            Route wird vorbereitet...
          </div>
        </main>
      }
    >
      <RouteRunPageContent />
    </Suspense>
  );
}
