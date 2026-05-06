"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
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

export default function RouteRunPage() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState<UserRouteRow | null>(null);
  const [stops, setStops] = useState<RouteStopRow[]>([]);
  const [progress, setProgress] = useState<RouteRunProgress | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

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

  function persistProgress(next: RouteRunProgress) {
    setProgress(next);
    writeRouteRunProgress(next);
  }

  function setCurrentStop(stopId: string) {
    if (!progress) return;
    setTouchStartX(null);
    setSwipeOffset(0);
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

    setTouchStartX(null);
    setSwipeOffset(0);
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
    setTouchStartX(null);
    setSwipeOffset(0);
    const next = buildMergedProgress(route, stops);
    persistProgress(next);
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-2xl border bg-white p-5">Route wird vorbereitet...</div>
      </main>
    );
  }

  if (!route || notFound) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        <Link href="/routes" className="text-sm text-[var(--text-muted)] underline">
          Zurueck zu den Routen
        </Link>
        <div className="rounded-2xl border bg-white p-6">Diese Route konnte nicht geladen werden.</div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
          <Link href={`/routes/${route.slug ?? slug}`} className="hover:text-[var(--text-strong)]">
            Zurueck zur Route
          </Link>
          <Link href="/planner" className="hover:text-[var(--text-strong)]">
            Planner
          </Link>
        </div>
        <button
          type="button"
          onClick={resetRouteRun}
          className="rounded-xl border border-[var(--line-subtle)] px-3 py-2 text-sm text-[var(--text-strong)] hover:bg-white"
        >
          Fortschritt zuruecksetzen
        </button>
      </div>

      <section className="rounded-[28px] border border-[var(--line-subtle)] bg-white p-6 shadow-sm">
        <div>
          <div className="pd24-kicker mb-2">Route Live</div>
          <h1 className="text-3xl font-semibold text-[var(--text-strong)]">{route.title}</h1>
          {route.description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">{route.description}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-3 py-1 text-xs text-[var(--text-muted)]">
              {route.city_slug ?? "ohne Stadt"}
            </span>
            <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-3 py-1 text-xs text-[var(--text-muted)]">
              {stops.length} Stop{stops.length === 1 ? "" : "s"}
            </span>
            <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-3 py-1 text-xs text-[var(--text-muted)]">
              {progressPercent}% geschafft
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-6">
        <section className="space-y-4">
          <div className="rounded-[28px] border border-[var(--line-subtle)] bg-white p-4 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-center">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">So laeuft die Route</h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                    Stop antippen, direkt im Feld navigieren und danach erledigen oder skippen.
                  </p>
                </div>
                <div className="rounded-full bg-[var(--bg-panel)] px-3 py-1 text-xs text-[var(--text-muted)]">
                  {handledCount}/{stops.length}
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <div className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-muted)]">
                  1. Stop antippen
                </div>
                <div className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-muted)]">
                  2. Im Feld navigieren
                </div>
                <div className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-muted)]">
                  3. Erledigen oder skippen
                </div>
                <div className="rounded-full border border-dashed border-[var(--line-subtle)] bg-white px-3 py-2 text-sm text-[var(--text-muted)]">
                  Swipe: rechts erledigt, links skippen
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_6.25rem]">
            <div className="overflow-hidden rounded-[28px] border border-[var(--line-subtle)] bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--line-subtle)] px-5 py-4">
                <h2 className="text-[1.8rem] font-semibold leading-none text-[var(--text-strong)]">Map + Route</h2>
                <div className="text-sm text-[var(--text-muted)]">OSRM aktiv</div>
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
          </div>
        </section>

        <section className="rounded-[28px] border border-[var(--line-subtle)] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold">Tagesverlauf</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Der aktive Schritt bleibt direkt an seinem Platz in der Liste sichtbar.
              </p>
            </div>
            <div className="rounded-full bg-[var(--bg-panel)] px-4 py-2 text-sm text-[var(--text-muted)]">
              {progressPercent}% geschafft
            </div>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--bg-panel)]">
            <div
              className="h-full rounded-full bg-[var(--text-strong)] transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="mt-4 max-h-[46rem] space-y-3 overflow-y-auto pr-1">
              <div className="rounded-[22px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4">
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
                const navigationUrl = stopNavigationUrl(stop);
                const hasExternalDetails = Boolean(stop.external_url && stop.external_url !== navigationUrl);
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
                        ? "border-[var(--text-strong)] bg-[var(--bg-panel)] shadow-sm"
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
                    className={`overflow-hidden rounded-[22px] border transition ${cardTone}`}
                  >
                    <button
                      type="button"
                      onClick={() => setCurrentStop(stop.id)}
                      className={`w-full p-4 text-left transition ${buttonTone}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Stop {stop.stop_order}</div>
                          <div className="mt-1 font-semibold text-[var(--text-strong)]">{routeStopTitle(stop)}</div>
                          <div className="mt-2 text-xs text-[var(--text-muted)]">{routeStopSummary(stop)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] ${statusTone(state)}`}>
                            {statusLabel(state)}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">{active ? "Aktiv" : "Oeffnen"}</span>
                        </div>
                      </div>
                    </button>

                    {active ? (
                      <div className="border-t border-[var(--line-subtle)] bg-white p-4">
                        <div className="grid gap-2 text-xs text-[var(--text-muted)] sm:grid-cols-3">
                          <div className="rounded-2xl bg-[var(--bg-panel)] px-3 py-2">Stop {stop.stop_order}</div>
                          <div className="rounded-2xl bg-[var(--bg-panel)] px-3 py-2">{routeStopSummary(stop)}</div>
                          <div className="rounded-2xl bg-[var(--bg-panel)] px-3 py-2">
                            {stop.is_required ? "Pflicht-Stop" : "Optionaler Stop"}
                          </div>
                        </div>

                        <div className="mt-3 relative overflow-hidden rounded-[24px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-1">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-4 text-xs font-medium text-amber-900">
                            &lt;- Skippen
                          </div>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-xs font-medium text-emerald-900">
                            Erledigt -&gt;
                          </div>
                          <div
                            className="relative rounded-[20px] border border-[var(--line-subtle)] bg-white p-5 shadow-sm transition-transform"
                            style={{ transform: `translateX(${Math.max(-96, Math.min(96, swipeOffset))}px)` }}
                            onTouchStart={(event) => {
                              setTouchStartX(event.touches[0]?.clientX ?? null);
                              setSwipeOffset(0);
                            }}
                            onTouchMove={(event) => {
                              if (touchStartX == null) return;
                              setSwipeOffset((event.touches[0]?.clientX ?? 0) - touchStartX);
                            }}
                            onTouchEnd={() => {
                              if (swipeOffset >= 80) markStop(stop.id, "done");
                              if (swipeOffset <= -80) markStop(stop.id, "skipped");
                              setTouchStartX(null);
                              setSwipeOffset(0);
                            }}
                            onTouchCancel={() => {
                              setTouchStartX(null);
                              setSwipeOffset(0);
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-2xl font-semibold text-[var(--text-strong)]">{routeStopTitle(stop)}</div>
                                <div className="mt-2 text-xs uppercase tracking-wide text-[var(--text-muted)]">
                                  {statusLabel(state)}
                                </div>
                              </div>
                              {navigationUrl ? (
                                <Link
                                  href={navigationUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--line-subtle)] px-4 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)]"
                                >
                                  Navigieren -&gt;
                                </Link>
                              ) : null}
                            </div>

                            {stop.photo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={stop.photo_url}
                                alt={routeStopTitle(stop)}
                                className="mt-4 h-44 w-full rounded-[18px] object-cover"
                              />
                            ) : null}

                            {stop.note ? (
                              <div className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{stop.note}</div>
                            ) : (
                              <div className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
                                Fuer diesen Stop ist noch keine laengere Notiz hinterlegt.
                              </div>
                            )}

                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => markStop(stop.id, "done")}
                                className="rounded-xl bg-[var(--text-strong)] px-4 py-2.5 text-sm text-white transition hover:opacity-95"
                              >
                                Erledigt
                              </button>
                              <button
                                type="button"
                                onClick={() => markStop(stop.id, "skipped")}
                                className="rounded-xl border border-[var(--line-subtle)] px-4 py-2.5 text-sm text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)]"
                              >
                                Skippen
                              </button>
                              <button
                                type="button"
                                onClick={() => markStop(stop.id, "pending")}
                                className="rounded-xl border border-[var(--line-subtle)] px-4 py-2.5 text-sm text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)]"
                              >
                                Wieder offen
                              </button>
                              {hasExternalDetails ? (
                                <Link
                                  href={stop.external_url!}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-xl border border-[var(--line-subtle)] px-4 py-2.5 text-sm text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)]"
                                >
                                  Stop oeffnen
                                </Link>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
          </div>

          <div className="mt-5 rounded-[22px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4">
            <div className="text-sm font-medium text-[var(--text-strong)]">Naechster sinnvoller Schritt</div>
            <div className="mt-2 text-sm text-[var(--text-muted)]">
              {pendingCount > 0
                ? "Oeffne den aktiven Stop direkt in der Liste, navigiere von dort weiter und hake ihn dann ab oder skippe ihn."
                : "Die Route ist abgeschlossen. Du kannst sie neu starten oder zur Detailseite zurueckgehen."}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/routes/${route.slug ?? slug}`}
                className="rounded-xl border border-[var(--line-subtle)] px-4 py-2.5 text-sm text-[var(--text-strong)] hover:bg-[var(--bg-panel)]"
              >
                Zur Route zurueck
              </Link>
              {pendingCount === 0 ? (
                <button
                  type="button"
                  onClick={resetRouteRun}
                  className="rounded-xl bg-[var(--text-strong)] px-4 py-2.5 text-sm text-white transition hover:opacity-95"
                >
                  Route erneut starten
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
