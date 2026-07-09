"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { PlanMapStop } from "@/components/PlanMap";
import { supabase } from "@/lib/supabaseClient";
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
import { getRoadtripCoverArt, type RoadtripCoverArt } from "@/lib/roadtrip/cover-art";
import { getRoadtripEditorial, type RoadtripEditorial } from "@/lib/roadtrip/editorial";
import { isPlannerSupportedCitySlug } from "@/lib/cities/planner-support";
import HotelSearchLinks from "@/components/roadtrip/HotelSearchLinks";
import { loadResolvedRouteCoverMap } from "@/lib/media/resolved-covers";
import EntityMediaGallery from "@/components/media/EntityMediaGallery";
import CommunityPhotoSubmission from "@/components/media/CommunityPhotoSubmission";
import { loadRoadtripMediaBundle, type MediaGalleryItem } from "@/lib/media/gallery";

const PlanMap = dynamic(() => import("@/components/PlanMap"), { ssr: false });

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

// Haversine-Distanz in km zwischen zwei Koordinaten.
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Ein "lokaler Trip" (Insel-Tour, Stadt-Umgebung) hat alle Stops eng beieinander
// — keine morgendliche Fernanfahrt. Dann startet der Tag morgens statt nachmittags
// und der "Anreise & Check-in"-Block entfällt. Schwelle: max. Distanz zwischen
// je zwei Stops < 45 km (Sylt komplett ~38 km lang; echte Roadtrips spannen mehr).
const ROADTRIP_LOCAL_SPAN_KM = 45;
const ROADTRIP_LOCAL_START_MIN = 9 * 60 + 30; // 09:30 Morgenstart für lokale Trips

function isLocalRoadtrip(stops: Array<{ lat?: number | null; lng?: number | null }>): boolean {
  const pts = stops.filter(
    (s): s is { lat: number; lng: number } => typeof s.lat === "number" && typeof s.lng === "number"
  );
  if (pts.length < 2) return true; // Ein Ort → immer lokal.
  let maxKm = 0;
  for (let i = 0; i < pts.length; i += 1) {
    for (let j = i + 1; j < pts.length; j += 1) {
      maxKm = Math.max(maxKm, haversineKm(pts[i].lat, pts[i].lng, pts[j].lat, pts[j].lng));
    }
  }
  return maxKm < ROADTRIP_LOCAL_SPAN_KM;
}

function normalizeRoadtripStopTimes<
  T extends {
    time: string | null;
  },
>(stops: T[], isLocal = false): T[] {
  if (stops.length === 0) return stops;
  // Lokale Trips: Autoren-Zeiten unverändert lassen (starten schon morgens).
  if (isLocal) return stops;
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

function buildRoadtripStopMapHref(cityLabel: string, itemName: string | null | undefined): string {
  const query = encodeURIComponent(itemName?.trim() || cityLabel);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

type CityCreatorRouteSuggestion = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  city_slug: string | null;
  cover_image_url: string | null;
  avg_rating: number | null;
  bookmark_count: number | null;
  stop_count: number | null;
  creator_type: string | null;
};

function creatorRouteSuggestionMeta(route: CityCreatorRouteSuggestion): string {
  const parts: string[] = [];
  if (route.stop_count && route.stop_count > 0) parts.push(`${route.stop_count} Stops`);
  if (route.avg_rating && route.avg_rating > 0) parts.push(`${route.avg_rating.toFixed(1)} / 5`);
  if (route.bookmark_count && route.bookmark_count > 0) parts.push(`${route.bookmark_count} Saves`);
  return parts.join(" - ") || "Fertige Tagesroute";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type RoadtripPreviewCardProps = {
  coverArt: RoadtripCoverArt;
  editorial: RoadtripEditorial;
  stops: RoadtripRoute["stops"];
  startDate: string;
  firstStop: string;
  lastStop: string;
  totalNights: number;
};

function RoadtripPreviewCard({
  coverArt,
  editorial,
  stops,
  startDate,
  firstStop,
  lastStop,
  totalNights,
}: RoadtripPreviewCardProps) {
  const visibleStops = stops.slice(0, 5);

  return (
    <aside className="overflow-hidden rounded-[26px] border border-[rgba(15,23,42,0.08)] bg-white shadow-[0_16px_42px_rgba(15,23,42,0.08)] lg:sticky lg:top-24">
      <div
        className="relative overflow-hidden border-b border-[rgba(255,255,255,0.12)] px-5 py-5 text-white"
        style={{ backgroundImage: coverArt.backgroundImage }}
      >
        {editorial.coverImageUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-[0.56]"
            aria-hidden="true"
            style={{ backgroundImage: `url("${editorial.coverImageUrl}")` }}
          />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.2),rgba(15,23,42,0.56))]" />
        <div className="absolute inset-0 opacity-80" style={{ backgroundImage: coverArt.orbImage }} />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full border border-white/18 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] backdrop-blur-sm">
              Vorschau
            </span>
            <span className="rounded-full border border-white/18 bg-black/16 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/86 backdrop-blur-sm">
              Route
            </span>
          </div>
          <div className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/72">
            {firstStop} bis {lastStop}
          </div>
          <div className="mt-2 max-w-[16rem] text-[1.55rem] font-semibold leading-tight text-white">
            {coverArt.scene}
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Route auf einen Blick
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-3xl bg-[var(--bg-surface)] px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Städte
              </div>
              <div className="mt-2 text-[2rem] font-semibold leading-none text-[var(--text-strong)]">
                {stops.length}
              </div>
            </div>
            <div className="rounded-3xl bg-[var(--bg-surface)] px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Nächte
              </div>
              <div className="mt-2 text-[2rem] font-semibold leading-none text-[var(--text-strong)]">
                {totalNights}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Stop-Abfolge
          </div>
          <div className="mt-3 space-y-2.5">
            {visibleStops.map((stop, idx) => {
              const arrivalDate = stopArrivalDate(startDate, stops, idx);
              return (
                <div key={`${stop.citySlug}-${idx}-preview-card`} className="flex items-start gap-3">
                  <div className="flex w-8 shrink-0 flex-col items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--text-strong)] text-[11px] font-semibold text-white">
                      {idx + 1}
                    </div>
                    {idx < visibleStops.length - 1 ? (
                      <div className="mt-1 h-10 w-px bg-[rgba(23,23,23,0.12)]" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 rounded-[22px] border border-[rgba(23,23,23,0.06)] bg-[var(--bg-surface)] px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-semibold text-[var(--text-strong)]">
                        {stop.cityLabel}
                      </div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        {stop.nights} {stop.nights === 1 ? "Nacht" : "Nächte"}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      Ankunft {formatDateDE(arrivalDate)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[22px] border border-[rgba(23,23,23,0.06)] bg-white px-4 py-3.5 text-sm leading-6 text-[var(--text-muted)]">
          {stops.length} Stopps mit {totalNights} Nächten zwischen {firstStop} und {lastStop}.{" "}
          {editorial.highlights[0] ?? editorial.intro}
        </div>
      </div>
    </aside>
  );
}

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
  const [cityRouteSuggestions, setCityRouteSuggestions] = useState<Record<string, CityCreatorRouteSuggestion[]>>({});
  const [cityRouteSuggestionsLoading, setCityRouteSuggestionsLoading] = useState<Record<string, boolean>>({});
  const [roadtripGalleryItems, setRoadtripGalleryItems] = useState<MediaGalleryItem[]>([]);
  const [creatorRouteCoverMap, setCreatorRouteCoverMap] = useState<Map<string, string>>(new Map());
  const [roadtripMediaVersion, setRoadtripMediaVersion] = useState(0);

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

  useEffect(() => {
    if (!route) return;

    const uniqueStops = Array.from(new Map(route.stops.map((stop) => [stop.citySlug, stop])).values()).filter(
      (stop) => !stop.creatorRouteSlug
    );

    if (uniqueStops.length === 0) {
      setCityRouteSuggestions({});
      setCityRouteSuggestionsLoading({});
      return;
    }

    let active = true;
    setCityRouteSuggestions({});
    setCityRouteSuggestionsLoading(Object.fromEntries(uniqueStops.map((stop) => [stop.citySlug, true])));

    (async () => {
      const results = await Promise.all(
        uniqueStops.map(async (stop) => {
          const { data } = await supabase
            .from("user_routes")
            .select("id,title,slug,description,city_slug,cover_image_url,avg_rating,bookmark_count,stop_count,creator_type")
            .eq("city_slug", stop.citySlug)
            .eq("visibility", "public")
            .order("bookmark_count", { ascending: false })
            .limit(3);

          const rawRoutes = ((data as CityCreatorRouteSuggestion[] | null) ?? []).filter(
            (candidate) => candidate.slug !== stop.creatorRouteSlug
          );
          const coverMap = await loadResolvedRouteCoverMap(rawRoutes.map((route) => route.id));
          const routes = rawRoutes.map((candidate) => ({
            ...candidate,
            cover_image_url: coverMap.get(candidate.id) ?? candidate.cover_image_url,
          }));

          return [stop.citySlug, routes] as const;
        })
      );

      if (!active) return;

      setCityRouteSuggestions(Object.fromEntries(results));
      setCityRouteSuggestionsLoading(Object.fromEntries(uniqueStops.map((stop) => [stop.citySlug, false])));
    })();

    return () => {
      active = false;
    };
  }, [route]);

  useEffect(() => {
    if (!route) {
      setRoadtripGalleryItems([]);
      setCreatorRouteCoverMap(new Map());
      return;
    }

    let active = true;

    (async () => {
      const creatorRouteIds = Array.from(
        new Set(route.stops.map((stop) => stop.creatorRouteId).filter((value): value is string => Boolean(value)))
      );
      const [roadtripItems, creatorCoverMap] = await Promise.all([
        loadRoadtripMediaBundle(route.id),
        loadResolvedRouteCoverMap(creatorRouteIds),
      ]);

      if (!active) return;

      const creatorFallbacks = route.stops
        .map((stop, index) => {
          if (!stop.creatorRouteId) return null;
          const url = creatorCoverMap.get(stop.creatorRouteId);
          if (!url) return null;
          return {
            id: `creator-route-cover-${stop.creatorRouteId}-${index}`,
            url,
            alt: stop.creatorRouteTitle ?? stop.cityLabel,
            caption: stop.creatorRouteTitle ?? `${stop.cityLabel} erleben`,
            creditName: null,
            sourceLabel: `Creator-Route in ${stop.cityLabel}`,
            badge: "Stop",
          } satisfies MediaGalleryItem;
        })
        .filter(Boolean) as MediaGalleryItem[];

      const seenUrls = new Set<string>();
      const combinedItems = [...roadtripItems, ...creatorFallbacks].filter((item) => {
        if (seenUrls.has(item.url)) return false;
        seenUrls.add(item.url);
        return true;
      });

      setCreatorRouteCoverMap(creatorCoverMap);
      setRoadtripGalleryItems(combinedItems);
    })();

    return () => {
      active = false;
    };
  }, [route, roadtripMediaVersion]);

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
  const coverArt = getRoadtripCoverArt(route);
  const editorial = getRoadtripEditorial(route);
  const firstStop = route.stops[0]?.cityLabel ?? "Start";
  const lastStop = route.stops[route.stops.length - 1]?.cityLabel ?? "Ziel";
  const mapStops: PlanMapStop[] = route.stops.map((stop, idx) => ({
    label: stop.cityLabel,
    name: stop.creatorRouteTitle ? `${stop.cityLabel} - ${stop.creatorRouteTitle}` : stop.cityLabel,
    lat: stop.lat,
    lng: stop.lng,
    markerVariant:
      idx === 0 ? "start" : idx === route.stops.length - 1 ? "active" : "default",
  }));

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

          <div
            className="relative mb-4 overflow-hidden rounded-2xl border border-white/10"
            style={{ backgroundImage: coverArt.backgroundImage }}
          >
            {editorial.coverImageUrl && (
              <div
                className="absolute inset-0 bg-cover bg-center opacity-[0.54]"
                aria-hidden="true"
                style={{ backgroundImage: `url("${editorial.coverImageUrl}")` }}
              />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08),rgba(15,23,42,0.38))]" />
            <div className="absolute inset-0 opacity-80" style={{ backgroundImage: coverArt.orbImage }} />
            <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),transparent)]" />
            <div className="absolute -right-8 top-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -left-8 bottom-0 h-20 w-20 rounded-full bg-black/10 blur-2xl" />
            <div className="relative flex min-h-[176px] flex-col justify-between gap-4 p-4 text-white sm:min-h-[196px] sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="inline-flex rounded-full border border-white/20 bg-white/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] backdrop-blur-sm">
                  {coverArt.eyebrow}
                </div>
                <div className="rounded-full border border-white/16 bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/88 backdrop-blur-sm">
                  {firstStop} bis {lastStop}
                </div>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-2xl">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/68">
                    Scenic Summary
                  </div>
                  <div className="mt-1 text-lg font-semibold leading-6 text-white sm:text-xl">
                    {coverArt.scene}
                  </div>
                </div>
                <div
                  className="inline-flex w-fit flex-col rounded-2xl border border-white/18 bg-black/16 px-4 py-3 text-right backdrop-blur-sm"
                  style={{ boxShadow: `0 14px 34px ${coverArt.accent}33` }}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/62">Vibe</span>
                  <span className="mt-1 text-2xl font-semibold leading-none text-white">{coverArt.icon}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div className="space-y-5">
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
                    {route.clone_count}x nachgefahren
                  </span>
                )}
              </div>

              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Fertig geplanter Roadtrip
              </div>

              <h1 className="text-2xl font-semibold leading-tight tracking-tight text-[var(--text-strong)] sm:text-3xl">
                {route.title}
              </h1>

              {editorial.intro && (
                <p className="max-w-2xl text-sm leading-7 text-[var(--text-muted)]">
                  {editorial.intro}
                </p>
              )}

              {/* Value facts — was du konkret bekommst */}
              <div className="flex flex-wrap gap-2 text-xs">
                {editorial.highlights.slice(0, 2).map((highlight) => (
                  <span key={highlight} className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[var(--text-muted)]">
                    ✓ {highlight}
                  </span>
                ))}
              </div>

              {route.author_name && (
                <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(23,23,23,0.08)] text-[10px] font-semibold">
                    {route.author_name.slice(0, 1).toUpperCase()}
                  </div>
                  <span>von <strong className="text-[var(--text-strong)]">{route.author_name}</strong></span>
                  <span>/</span>
                  <span>{new Date(route.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}</span>
                </div>
              )}

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

              <div className="rounded-[24px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Auf los statt neu planen
                </div>
                <div className="mt-2 text-base font-semibold text-[var(--text-strong)]">
                  Reihenfolge, Übernachtungsstopps und Tageslogik stehen bereits.
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white px-3 py-3 text-sm text-[var(--text-muted)]">
                    <div className="font-semibold text-[var(--text-strong)]">1. Datum setzen</div>
                    <div className="mt-1">Ankunftstage und Stop-Abfolge werden direkt berechnet.</div>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-3 text-sm text-[var(--text-muted)]">
                    <div className="font-semibold text-[var(--text-strong)]">2. Live starten</div>
                    <div className="mt-1">Die Route ist sofort als Mehrtagesablauf nutzbar.</div>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-3 text-sm text-[var(--text-muted)]">
                    <div className="font-semibold text-[var(--text-strong)]">3. Pro Stadt verfeinern</div>
                    <div className="mt-1">Creator-Routen, Hotels und Karten bleiben entlang der Route griffbereit.</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <Link
                  href={roadtripRunHref}
                  className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 active:scale-[0.97]"
                >
                  Jetzt starten — {totalNights} Nächte, {route.stops.length} Städte
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
                <button
                  type="button"
                  onClick={() => setShowDatePicker((v) => !v)}
                  className="rounded-xl border border-[var(--line-subtle)] bg-white px-3.5 py-2 text-sm text-[var(--text-muted)] transition hover:bg-[var(--bg-surface)]"
                >
                  Start: {formatDateDE(startDate)}
                </button>
                <a
                  href="#roadtrip-preview"
                  className="rounded-xl border border-[var(--line-subtle)] bg-white px-3.5 py-2 text-sm text-[var(--text-muted)] transition hover:bg-[var(--bg-surface)]"
                >
                  Stop-Abfolge pruefen
                </a>
              </div>

              <p className="text-sm leading-6 text-[var(--text-muted)]">
                Startet mit Datum, Stop-Reihenfolge, Übernachtungen und vorbereiteten Tagesfenstern sofort in den Live-Flow.
              </p>

              {showDatePicker && (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3.5 py-3">
                  <label
                    htmlFor="roadtrip-start-date"
                    className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]"
                  >
                    Startdatum
                  </label>
                  <input
                    id="roadtrip-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-xl border border-[var(--line-subtle)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] outline-none focus:border-[rgba(23,23,23,0.4)]"
                  />
                </div>
              )}

              <div className="overflow-hidden rounded-[28px] border border-[rgba(15,23,42,0.09)] bg-[var(--bg-surface)] shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line-subtle)] bg-white/72 px-5 py-4 backdrop-blur-sm">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      Roadtrip-Karte
                    </div>
                    <div className="mt-1 text-sm text-[var(--text-muted)]">
                      Vorschau der Route mit allen Übernachtungsstopps in Reihenfolge.
                    </div>
                  </div>
                  <div className="rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    {route.stops.length} Stopps
                  </div>
                </div>
                <div className="p-3 sm:p-4">
                  <div className="overflow-hidden rounded-[24px] border border-[rgba(15,23,42,0.08)] bg-white ring-1 ring-black/[0.03]">
                    <PlanMap stops={mapStops} profile="car" height={600} showHeader={false} />
                  </div>
                </div>
              </div>
            </div>

            <div id="roadtrip-preview">
              <RoadtripPreviewCard
                coverArt={coverArt}
                editorial={editorial}
                stops={route.stops}
                startDate={startDate}
                firstStop={firstStop}
                lastStop={lastStop}
                totalNights={totalNights}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Route stops ────────────────────────────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Warum diese Route funktioniert
          </div>
          <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
            {editorial.intro}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Besondere Momente auf der Route
          </div>
          <div className="mt-3 space-y-2.5">
            {editorial.highlights.map((highlight) => (
              <div
                key={highlight}
                className="rounded-xl border border-[rgba(23,23,23,0.06)] bg-white px-3 py-2.5 text-sm leading-6 text-[var(--text-muted)]"
              >
                {highlight}
              </div>
            ))}
          </div>
        </div>
      </section>

      {editorial.stopSpotlights.length > 0 && (
        <section className="space-y-3">
          <div className="px-1 text-sm font-semibold text-[var(--text-strong)]">
            Stop-Highlights entlang der Route
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {editorial.stopSpotlights.map((spotlight, index) => (
              <article
                key={`${spotlight.city}-${index}`}
                className="overflow-hidden rounded-2xl border border-[var(--line-subtle)] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.05)]"
              >
                {creatorRouteCoverMap.get(route.stops[index]?.creatorRouteId ?? "") ? (
                  <div className="relative h-40 overflow-hidden bg-[var(--bg-surface)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={creatorRouteCoverMap.get(route.stops[index]?.creatorRouteId ?? "") ?? ""}
                      alt={spotlight.city}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08),rgba(15,23,42,0.5))]" />
                    <div className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/22 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
                      Stop-Vorschau
                    </div>
                  </div>
                ) : null}
                <div className="px-4 py-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-base font-semibold text-[var(--text-strong)]">
                    {spotlight.city}
                  </div>
                  <div className="rounded-full bg-[rgba(23,23,23,0.05)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    {spotlight.nights} {spotlight.nights === 1 ? "Nacht" : "Nächte"}
                  </div>
                </div>
                <div className="mt-2 text-sm font-medium text-[var(--text-strong)]">
                  {spotlight.title}
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  {spotlight.copy}
                </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <EntityMediaGallery
          title="Roadtrip-Impressionen"
          subtitle="Creator-Cover, Roadtrip-Bilder und spätere Community-Fotos sorgen dafür, dass jede Etappe sofort nach einem echten Ziel wirkt."
          items={roadtripGalleryItems}
          emptyTitle="Noch keine Roadtrip-Bilder verfügbar"
          emptyBody="Sobald Bilder für diese Mehrtagesroute vorliegen, erscheinen sie hier als starke Vorschau für Cover, Etappen und Community."
          rightsHint="Roadtrip-Cover, Stop-Bilder und Community-Fotos nutzen dieselbe Prioritätslogik: manuelles Cover vor freigegebenen Stop- und Galerie-Bildern."
        />
        <CommunityPhotoSubmission
          entityType="roadtrip"
          entityId={route.id}
          title="Roadtrip-Foto hinzufuegen"
          subtitle="Lade Bilder zur gesamten Route hoch. Freigegebene Fotos können später Cover, Galerie oder Highlights der Etappen stärken."
          previewItems={roadtripGalleryItems.slice(0, 16).map((item) => ({
            id: item.id,
            url: item.url,
            alt: item.alt,
          }))}
          onSubmitted={() => setRoadtripMediaVersion((version) => version + 1)}
        />
      </section>

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
          const isLocalTrip = isLocalRoadtrip(route.stops);
          // Lokaler Trip → Planner startet morgens (Sylt-Locations schliessen oft
          // gegen 18 Uhr). Fernstrecke → Nachmittagsstart nach der Anfahrt.
          const plannerDayStart = isLocalTrip ? ROADTRIP_LOCAL_START_MIN : ROADTRIP_AFTERNOON_START_MIN;
          const isToday = tripActive && idx === todayStopIdx;
          const plannerSupported = isPlannerSupportedCitySlug(stop.citySlug);
          const firstPlannedItemName = stop.plannedStops?.find((plannedStop) => plannedStop.itemName)?.itemName ?? null;
          const stopMapHref = buildRoadtripStopMapHref(stop.cityLabel, firstPlannedItemName);
          const suggestedRoutes = stop.creatorRouteSlug ? [] : cityRouteSuggestions[stop.citySlug] ?? [];
          const suggestedRoutesLoading = Boolean(cityRouteSuggestionsLoading[stop.citySlug]);
          const suggestedPrimaryRoute = suggestedRoutes.find((candidate) => Boolean(candidate.slug)) ?? null;
          const previewOnlyStop = !plannerSupported && !stop.creatorRouteSlug && !suggestedPrimaryRoute;

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

                  {!stop.creatorRouteTitle && (suggestedRoutesLoading || suggestedRoutes.length > 0) && (
                    <div className="mt-3 rounded-xl border border-[rgba(90,118,136,0.15)] bg-[rgba(90,118,136,0.05)] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                            Passende Creator-Routen
                          </div>
                          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                            Statt hier neu zu planen, kannst du direkt eine fertige Tagesroute für {stop.cityLabel} übernehmen.
                          </p>
                        </div>
                        {suggestedPrimaryRoute?.slug && (
                          <a
                            href={`/routes/${suggestedPrimaryRoute.slug}/run`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--text-strong)] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#1f2937] active:scale-[0.97]"
                          >
                            Top-Route starten
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                          </a>
                        )}
                      </div>

                      {suggestedRoutesLoading ? (
                        <div className="mt-3 grid gap-2 lg:grid-cols-2">
                          {[0, 1].map((index) => (
                            <div
                              key={index}
                              className="h-28 animate-pulse rounded-xl border border-[rgba(23,23,23,0.06)] bg-white/80"
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 grid gap-2 lg:grid-cols-2">
                          {suggestedRoutes.map((candidate) => (
                            <article
                              key={candidate.id}
                              className="overflow-hidden rounded-xl border border-[rgba(23,23,23,0.07)] bg-white"
                            >
                              <div className="flex h-full gap-3 p-3">
                                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-[linear-gradient(135deg,rgba(90,118,136,0.2),rgba(183,106,67,0.15))]">
                                  {candidate.cover_image_url ? (
                                    <img
                                      src={candidate.cover_image_url}
                                      alt={candidate.title}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-xl opacity-40">
                                      🗺️
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--text-strong)]">
                                    {candidate.title}
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[var(--text-muted)]">
                                    {candidate.description?.trim() || `Fertige Route fuer deinen Stop in ${stop.cityLabel}.`}
                                  </p>
                                  <div className="mt-2 text-[11px] text-[var(--text-muted)]">
                                    {creatorRouteSuggestionMeta(candidate)}
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {candidate.slug && (
                                      <a
                                        href={`/routes/${candidate.slug}/run`}
                                        className="inline-flex items-center gap-1 rounded-lg bg-[var(--text-strong)] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#1f2937]"
                                      >
                                        Route starten
                                      </a>
                                    )}
                                    {candidate.slug && (
                                      <a
                                        href={`/routes/${candidate.slug}`}
                                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--line-subtle)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)]"
                                      >
                                        Ansehen
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
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
                        {!isLocalTrip && (
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
                        )}
                        {normalizeRoadtripStopTimes(stop.plannedStops, isLocalTrip).map((s, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[rgba(23,23,23,0.08)] text-[9px] font-bold text-[var(--text-strong)]">
                              {isLocalTrip ? i + 1 : i + 2}
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
                  occasion={route.occasion}
                  budget={route.budget}
                  planSummary={stop.planSummary ?? null}
                  anchorLabel={firstPlannedItemName}
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
                {previewOnlyStop ? (
                  <>
                    <span className="text-xs text-[var(--text-muted)]">Roadtrip-Vorschau verfuegbar</span>
                    <a
                      href={stopMapHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line-subtle)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)] active:scale-[0.97]"
                    >
                      Karte oeffnen
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </a>
                  </>
                ) : (
                  <>
                <span className="text-xs text-[var(--text-muted)]">
                  {stop.creatorRouteSlug
                    ? "Creator-Route verfuegbar"
                    : !plannerSupported
                    ? "Roadtrip-Preview verfuegbar"
                    : stop.plannedStops?.length
                    ? `${stop.plannedStops.length} Stopps geplant`
                    : "Noch kein Tagesplan"}
                </span>
                {stop.creatorRouteSlug ? (
                  <a
                    href={`/routes/${stop.creatorRouteSlug}/run`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--text-strong)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1f2937] active:scale-[0.97]"
                  >
                    Route starten
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </a>
                ) : suggestedPrimaryRoute?.slug ? (
                  <a
                    href={`/routes/${suggestedPrimaryRoute.slug}/run`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--text-strong)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1f2937] active:scale-[0.97]"
                  >
                    Top-Route starten
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </a>
                ) : !plannerSupported ? (
                  <a
                    href={stopMapHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line-subtle)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)] active:scale-[0.97]"
                  >
                    Karte oeffnen
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </a>
                ) : stop.plannedStops?.length ? (
                  <a
                    href={`/planner?citySlug=${stop.citySlug}&planDate=${arrivalDate}&dayStartMin=${plannerDayStart}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--text-strong)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1f2937] active:scale-[0.97]"
                  >
                    📋 Im Planner öffnen
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </a>
                ) : (
                  <a
                    href={`/planner?citySlug=${stop.citySlug}&planDate=${arrivalDate}&dayStartMin=${plannerDayStart}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line-subtle)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)] active:scale-[0.97]"
                  >
                    📍 Tag planen
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </a>
                )}
                  </>
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
