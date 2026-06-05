"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchRoadtripRouteBySlug,
  incrementRouteViews,
  incrementRouteClones,
} from "@/lib/roadtrip/client";
import {
  type RoadtripRoute,
  stopArrivalDate,
  occasionLabel,
  budgetLabel,
  ROADTRIP_TAGS,
} from "@/lib/roadtrip/types";
import HotelSearchLinks from "@/components/roadtrip/HotelSearchLinks";

const ROADTRIP_CHECKOUT_MIN = 10 * 60;
const ROADTRIP_AFTERNOON_START_MIN = 14 * 60 + 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateDE(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseTimeLabel(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatTimeLabel(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normalizeRoadtripStopTimes<
  T extends {
    time: string | null;
  },
>(stops: T[]): T[] {
  if (stops.length === 0) return stops;
  const firstTimedStop = stops.find((stop) => parseTimeLabel(stop.time) !== null);
  const firstStopMinutes = parseTimeLabel(firstTimedStop?.time);
  if (firstStopMinutes === null || firstStopMinutes >= ROADTRIP_AFTERNOON_START_MIN) {
    return stops;
  }
  const offset = ROADTRIP_AFTERNOON_START_MIN - firstStopMinutes;
  return stops.map((stop) => {
    const parsedTime = parseTimeLabel(stop.time);
    if (parsedTime === null) return stop;
    return {
      ...stop,
      time: formatTimeLabel(parsedTime + offset),
    };
  });
}

const ROADTRIP_TRAVEL_WINDOW_LABEL = `${formatTimeLabel(ROADTRIP_CHECKOUT_MIN)}-${formatTimeLabel(ROADTRIP_AFTERNOON_START_MIN)}`;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RoadtripRouteDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();

  const [route, setRoute] = useState<RoadtripRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Date customisation when using as template
  const [startDate, setStartDate] = useState(todayStr());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tripActive] = useState(false);

  useEffect(() => {
    if (!params?.slug) return;

    (async () => {
      setLoading(true);
      const r = await fetchRoadtripRouteBySlug(params.slug);
      if (!r) {
        setNotFound(true);
      } else {
        setRoute(r);
        // Track view (fire-and-forget)
        incrementRouteViews(r.id);
      }
      setLoading(false);
    })();
  }, [params?.slug]);

  async function copyShareLink() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      prompt("Link kopieren:", url);
    }
  }

  function useAsTemplate() {
    if (!route) return;
    incrementRouteClones(route.id);

    // Build query params for /roadtrip with the route pre-loaded
    const params = new URLSearchParams({
      fromRouteId: route.id,
      fromRouteSlug: route.slug,
      startDate,
    });
    router.push(`/roadtrip?${params}`);
  }

  // ── Loading / Not Found ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="pd24-page-wide space-y-4">
        <div className="rounded-xl border border-[var(--line-subtle)] bg-white px-6 py-8 text-sm text-[var(--text-muted)]">
          Route wird geladen…
        </div>
      </main>
    );
  }

  if (notFound || !route) {
    return (
      <main className="pd24-page-wide space-y-4">
        <div className="rounded-xl border border-[var(--line-subtle)] bg-white px-6 py-8 text-center">
          <div className="text-2xl mb-2">🔍</div>
          <div className="font-semibold text-[var(--text-strong)]">Route nicht gefunden</div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Der Link ist ungültig oder die Route wurde gelöscht.
          </p>
          <Link
            href="/roadtrip/routes"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--text-strong)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1f2937]"
          >
            Alle Roadtrip-Routen →
          </Link>
        </div>
      </main>
    );
  }

  const totalNights = route.stops.reduce((s, st) => s + st.nights, 0);
  const tagDefs = ROADTRIP_TAGS.filter((t) => route.tags.includes(t.value));
  const roadtripRunHref = `/roadtrip/routes/${route.slug}/run?startDate=${startDate}`;

  // Welcher Stop ist heute? Nur relevant wenn tripActive = true
  const todayStopIdx = (() => {
    if (!tripActive) return -1;
    const today = todayStr();
    let offset = 0;
    for (let i = 0; i < route.stops.length; i++) {
      const arrival = addDays(startDate, offset);
      const departure = addDays(arrival, route.stops[i].nights);
      if (today >= arrival && today < departure) return i;
      offset += route.stops[i].nights;
    }
    return -1;
  })();

  return (
    <main className="pd24-page-wide space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-xl border border-[var(--line-subtle)] bg-white px-5 py-5 shadow-[var(--shadow-soft)]">
        <div className="pointer-events-none absolute right-[-4rem] top-[-4rem] h-48 w-48 rounded-full bg-[rgba(183,106,67,0.1)] blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-3rem] left-[30%] h-36 w-36 rounded-full bg-[rgba(90,118,136,0.1)] blur-3xl" />

        <div className="relative">
          {/* Breadcrumb */}
          <div className="mb-3 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <Link href="/explore" className="hover:text-[var(--text-strong)] transition">Entdecken</Link>
            <span>/</span>
            <Link href="/roadtrip/routes" className="hover:text-[var(--text-strong)] transition">Roadtrip-Routen</Link>
            <span>/</span>
            <span className="text-[var(--text-strong)]">{route.title}</span>
          </div>

          {/* Chips */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="warm-chip rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
              Roadtrip
            </span>
            <span className="rounded-full border border-[var(--line-subtle)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
              {route.stops.length} Städte · {totalNights} Nächte
            </span>
            <span className="rounded-full border border-[var(--line-subtle)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
              {occasionLabel(route.occasion)}
            </span>
            <span className="rounded-full border border-[var(--line-subtle)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
              {budgetLabel(route.budget)}
            </span>
            {route.clone_count > 0 && (
              <span className="rounded-full border border-[var(--line-subtle)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                {route.clone_count}× nachgefahren
              </span>
            )}
          </div>

          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-[var(--text-strong)] sm:text-3xl">
            {route.title}
          </h1>

          {route.description && (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
              {route.description}
            </p>
          )}

          {/* Author */}
          {route.author_name && (
            <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(23,23,23,0.08)] text-[10px] font-semibold">
                {route.author_name.slice(0, 1).toUpperCase()}
              </div>
              <span>von <strong className="text-[var(--text-strong)]">{route.author_name}</strong></span>
              <span>·</span>
              <span>{new Date(route.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}</span>
            </div>
          )}

          {/* Tags */}
          {tagDefs.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tagDefs.map((tag) => (
                <span
                  key={tag.value}
                  className="rounded-full border border-[rgba(23,23,23,0.08)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]"
                >
                  {tag.emoji} {tag.label}
                </span>
              ))}
            </div>
          )}

          {/* Roadtrip-Start CTA */}
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Link
              href={roadtripRunHref}
              className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 active:scale-[0.97]"
            >
              🚀 Roadtrip live starten
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <button
              type="button"
              onClick={() => setShowDatePicker((v) => !v)}
              className="rounded-xl border border-[var(--line-subtle)] bg-white px-3.5 py-2 text-sm text-[var(--text-muted)] transition hover:bg-[var(--bg-surface)]"
            >
              📅 Start: {formatDateDE(startDate)}
            </button>
          </div>
        </div>
      </section>

      {/* ── Route stops ────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold text-[var(--text-strong)]">
          Reiseroute — {route.stops.map((s) => s.cityLabel).join(" → ")}
        </h2>

        {/* Aktiver Roadtrip-Tag Banner */}
        {tripActive && todayStopIdx >= 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold">
              {todayStopIdx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-emerald-800">
                Heute: {route.stops[todayStopIdx].cityLabel} — Tag {todayStopIdx + 1}
              </div>
              <div className="text-xs text-emerald-600">
                {route.stops[todayStopIdx].creatorRouteTitle
                  ? `Creator-Route: ${route.stops[todayStopIdx].creatorRouteTitle}`
                  : route.stops[todayStopIdx].plannedStops?.length
                  ? `${route.stops[todayStopIdx].plannedStops.length} geplante Stopps`
                  : "Noch kein Tagesplan — jetzt planen"}
              </div>
            </div>
            <a
              href={`#stop-${todayStopIdx}`}
              className="shrink-0 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              Zum Stop →
            </a>
          </div>
        )}

        {route.stops.map((stop, idx) => {
          const arrivalDate = stopArrivalDate(startDate, route.stops, idx);
          const departureDate = addDays(arrivalDate, stop.nights);
          const isToday = tripActive && idx === todayStopIdx;

          return (
            <div
              key={`${stop.citySlug}-${idx}`}
              id={`stop-${idx}`}
              className={`overflow-hidden rounded-xl border shadow-[0_2px_8px_rgba(15,23,42,0.04)] scroll-mt-20 ${
                isToday
                  ? "border-emerald-300 bg-white ring-2 ring-emerald-200/50"
                  : "border-[var(--line-subtle)] bg-white"
              }`}
            >
              {/* Stop header */}
              <div className="flex items-start gap-3 px-4 py-3.5">
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--text-strong)] text-[10px] font-bold text-white">
                    {idx + 1}
                  </div>
                  {idx < route.stops.length - 1 && (
                    <div className="w-px bg-[rgba(23,23,23,0.12)]" style={{ height: 16 }} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[var(--text-strong)]">{stop.cityLabel}</div>
                      <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {showDatePicker
                          ? `${formatDateDE(arrivalDate)} → ${formatDateDE(departureDate)}`
                          : `${stop.nights} ${stop.nights === 1 ? "Nacht" : "Nächte"}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isToday && (
                        <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                          Heute
                        </span>
                      )}
                      <span className="rounded-full bg-[rgba(23,23,23,0.06)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                        {stop.nights} {stop.nights === 1 ? "Nacht" : "Nächte"}
                      </span>
                    </div>
                  </div>

                  {/* Creator-Route — wenn für diese Stadt gewählt */}
                  {stop.creatorRouteTitle && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-[rgba(183,106,67,0.25)] bg-[rgba(183,106,67,0.06)] px-2.5 py-1.5">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-amber-400">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      <span className="flex-1 text-xs font-semibold text-[#b76a43] truncate">
                        {stop.creatorRouteTitle}
                      </span>
                      {stop.creatorRouteSlug && (
                        <a
                          href={`/routes/${stop.creatorRouteSlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-[10px] text-[#b76a43] underline underline-offset-2 hover:text-[#9d5a38]"
                        >
                          Ansehen →
                        </a>
                      )}
                    </div>
                  )}

                  {/* Generierter Tagesplan */}
                  {stop.plannedStops && stop.plannedStops.length > 0 && (
                    <div className="mt-2.5 space-y-1.5">
                      {stop.planSummary && (
                        <p className="text-[11px] italic text-[var(--text-muted)]">{stop.planSummary}</p>
                      )}
                      <ol className="space-y-1.5">
                        <li className="flex items-start gap-2">
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[rgba(23,23,23,0.08)] text-[9px] font-bold text-[var(--text-strong)]">
                            1
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium text-[var(--text-strong)]">Anreise &amp; Check-in</span>
                            <span className="ml-1.5 text-[11px] text-[var(--text-muted)]">- Check-out, Anfahrt und Hotel-Check-in bis zum Nachmittag</span>
                          </div>
                          <span className="shrink-0 rounded bg-[rgba(23,23,23,0.06)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--text-muted)]">
                            {ROADTRIP_TRAVEL_WINDOW_LABEL}
                          </span>
                        </li>
                        {normalizeRoadtripStopTimes(stop.plannedStops).map((s, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[rgba(23,23,23,0.08)] text-[9px] font-bold text-[var(--text-strong)]">
                              {i + 2}
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-medium text-[var(--text-strong)]">{s.label}</span>
                              {s.hint && (
                                <span className="ml-1.5 text-[11px] text-[var(--text-muted)]">— {s.hint}</span>
                              )}
                            </div>
                            {s.time && (
                              <span className="shrink-0 rounded bg-[rgba(23,23,23,0.06)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--text-muted)]">
                                {s.time}
                              </span>
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Nur planSummary (kein vollständiger Plan) */}
                  {stop.planSummary && !stop.plannedStops?.length && !stop.creatorRouteTitle && (
                    <p className="mt-1.5 text-xs italic text-[var(--text-muted)]">{stop.planSummary}</p>
                  )}
                </div>
              </div>

              {/* Hotel links */}
              <div className="border-t border-[rgba(23,23,23,0.05)] px-4 pb-3 pt-2.5">
                <HotelSearchLinks
                  cityLabel={stop.cityLabel}
                  checkin={arrivalDate}
                  checkout={departureDate}
                  nights={stop.nights}
                  adults={2}
                  citySlug={stop.citySlug}
                />
              </div>

              {/* Per-Stop Aktion */}
              <div
                className={`flex items-center justify-between gap-2 border-t px-4 py-2.5 ${
                  isToday
                    ? "border-emerald-100 bg-emerald-50/40"
                    : "border-[rgba(23,23,23,0.05)] bg-[rgba(23,23,23,0.015)]"
                }`}
              >
                <span className="text-xs text-[var(--text-muted)]">
                  {stop.creatorRouteSlug
                    ? "Creator-Route verfügbar"
                    : stop.plannedStops?.length
                    ? `${stop.plannedStops.length} Stopps geplant`
                    : "Noch kein Tagesplan"}
                </span>
                {stop.creatorRouteSlug ? (
                  <a
                    href={`/routes/${stop.creatorRouteSlug}/run`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--text-strong)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1f2937] active:scale-[0.97]"
                  >
                    🗺️ Route starten
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </a>
                ) : stop.plannedStops?.length ? (
                  <a
                    href={`/planner?citySlug=${stop.citySlug}&planDate=${arrivalDate}&dayStartMin=${ROADTRIP_AFTERNOON_START_MIN}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--text-strong)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1f2937] active:scale-[0.97]"
                  >
                    📋 Im Planner öffnen
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </a>
                ) : (
                  <a
                    href={`/planner?citySlug=${stop.citySlug}&planDate=${arrivalDate}&dayStartMin=${ROADTRIP_AFTERNOON_START_MIN}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line-subtle)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)] active:scale-[0.97]"
                  >
                    📍 Tag planen
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Use as template CTA ────────────────────────────────────────────── */}
      <section className="rounded-xl border border-[var(--line-subtle)] bg-white px-4 py-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-[var(--text-strong)]">Diese Route planen</div>
            <div className="mt-0.5 text-sm text-[var(--text-muted)]">
              Route als Vorlage in den Roadtrip-Planner übernehmen
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Date chooser toggle */}
            <button
              type="button"
              onClick={() => setShowDatePicker((v) => !v)}
              className="rounded-xl border border-[var(--line-subtle)] px-3 py-2 text-sm text-[var(--text-muted)] transition hover:bg-[var(--bg-surface)]"
            >
              {showDatePicker ? "Datum ausblenden" : "Startdatum wählen"}
            </button>

            {showDatePicker && (
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-xl border border-[var(--line-subtle)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] outline-none focus:border-[rgba(23,23,23,0.4)]"
              />
            )}

            <button
              type="button"
              onClick={useAsTemplate}
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--text-strong)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1f2937] active:scale-[0.97]"
            >
              Route planen
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* ── Share section ───────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[var(--text-strong)]">Route teilen</div>
            <div className="mt-0.5 text-xs text-[var(--text-muted)]">
              Teile diesen Link mit Freunden oder deiner Reisegruppe
            </div>
          </div>
          <div className="flex items-center gap-2">
            <code className="hidden rounded-lg border border-[var(--line-subtle)] bg-white px-2.5 py-1 text-xs text-[var(--text-muted)] sm:block">
              {typeof window !== "undefined" ? window.location.href.slice(0, 60) : ""}…
            </code>
            <button
              type="button"
              onClick={copyShareLink}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition ${
                copied
                  ? "bg-emerald-600 text-white"
                  : "border border-[var(--line-subtle)] bg-white text-[var(--text-strong)] hover:bg-[var(--bg-panel)]"
              }`}
            >
              {copied ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Kopiert!
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
                    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  Link kopieren
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ── Planner CTA footer ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[rgba(23,23,23,0.03)] px-4 py-3 text-xs text-[var(--text-muted)]">
        <span>
          Willst du einen eigenen Roadtrip planen?
        </span>
        <Link
          href="/roadtrip"
          className="rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1.5 font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)]"
        >
          Neuen Roadtrip erstellen →
        </Link>
      </div>
    </main>
  );
}
