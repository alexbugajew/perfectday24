"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { dedupeCitiesByCanonicalSlug } from "@/lib/cities/canonical";
import { PLANNER_33_ROLLOUT } from "@/lib/cities/rollout";
import PlannerModeSwitcher from "@/components/planner/PlannerModeSwitcher";
import HotelSearchLinks from "@/components/roadtrip/HotelSearchLinks";
import HotelAutocomplete from "@/components/roadtrip/HotelAutocomplete";
import type { HotelSelection } from "@/components/roadtrip/HotelAutocomplete";
import {
  createRoadtripRoute,
  fetchRoadtripRouteBySlug,
  fetchPublicRoadtripRoutes,
  setRoadtripStatus,
  incrementRouteClones,
} from "@/lib/roadtrip/client";
import { loadResolvedRouteCoverMap } from "@/lib/media/resolved-covers";
import { ROADTRIP_TAGS, stopArrivalDate } from "@/lib/roadtrip/types";
import type { RoadtripRoute, RoadtripRouteVisibility } from "@/lib/roadtrip/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type CityRow = {
  slug: string;
  name: string;
  country_code: string;
  center_lat: number | null;
  center_lng: number | null;
  population: number | null;
};

type RoadtripStop = {
  id: string;
  citySlug: string;
  cityLabel: string;
  lat: number;
  lng: number;
  date: string; // YYYY-MM-DD arrival date
  nights: number;
  // Unterkunft (optional) — wird als Startpunkt für den Tagesplan genutzt
  hotelName?: string | null;
  hotelLat?: number | null;
  hotelLng?: number | null;
};

type StopPlan = {
  label: string;
  hint: string;
  time: string | null;
  itemName: string | null;
};

type GeneratedCityPlan = {
  citySlug: string;
  date: string;
  status: "idle" | "loading" | "done" | "error";
  stops: StopPlan[];
  variantLabel: string | null;
  error: string | null;
};

const ROADTRIP_CHECKOUT_MIN = 10 * 60;
const ROADTRIP_AFTERNOON_START_MIN = 14 * 60 + 30;

// Creator-Route-Karte (aus user_routes-Tabelle)
type CityCreatorRoute = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  city_slug: string | null;
  cover_image_url: string | null;
  avg_rating: number;
  bookmark_count: number;
  stop_count: number;
  creator_type: string;
  tags: string[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return `${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  // Avoid DST issues: parse as UTC noon
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateDE(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
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

function normalizeRoadtripStopTimes(stops: StopPlan[]): StopPlan[] {
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

const ROADTRIP_AFTERNOON_START_LABEL = formatTimeLabel(ROADTRIP_AFTERNOON_START_MIN);
const ROADTRIP_TRAVEL_WINDOW_LABEL = `${formatTimeLabel(ROADTRIP_CHECKOUT_MIN)}-${ROADTRIP_AFTERNOON_START_LABEL}`;

// ─── Constants ────────────────────────────────────────────────────────────────

const OCCASION_OPTIONS = [
  { value: "tourism", label: "Städtetour" },
  { value: "friends", label: "Mit Freunden" },
  { value: "date",    label: "Zu zweit" },
  { value: "family",  label: "Familienurlaub" },
] as const;

const BUDGET_OPTIONS = [
  { value: "low",    label: "Günstig" },
  { value: "medium", label: "Mittel" },
  { value: "high",   label: "Gehoben" },
] as const;

// Suggested city starters (shown in empty state)
const STARTER_CITIES = ["Berlin", "Hamburg", "München", "Köln", "Frankfurt am Main", "Stuttgart"];

// ─── Component ────────────────────────────────────────────────────────────────

function RoadtripPageContent() {
  const [mounted, setMounted] = useState(false);

  // Cities (loaded from Supabase)
  const [cities, setCities] = useState<CityRow[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);

  // Trip meta
  const [tripName, setTripName] = useState("");
  const [occasion, setOccasion] = useState<string>("tourism");
  const [budget, setBudget] = useState<string>("medium");

  // Stop sequence
  const [stops, setStops] = useState<RoadtripStop[]>([]);
  const [citySearch, setCitySearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Generation
  const [generatedPlans, setGeneratedPlans] = useState<GeneratedCityPlan[]>([]);
  const [generating, setGenerating] = useState(false);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  // Per-Stadt Plan-Modus im Accordion (individual | creator)
  const [cityPlanModes, setCityPlanModes] = useState<Record<string, "individual" | "creator">>({});
  // Cache: citySlug → geladene Creator-Routen
  const [cityCreatorRoutes, setCityCreatorRoutes] = useState<Record<string, CityCreatorRoute[]>>({});
  const [cityCreatorLoading, setCityCreatorLoading] = useState<Record<string, boolean>>({});
  // Ausgewählte Creator-Route pro Stadt
  const [selectedCreatorRoutes, setSelectedCreatorRoutes] = useState<Record<string, CityCreatorRoute>>({});

  // Auth — used for attribution tracking only
  const [userId, setUserId] = useState<string | null>(null);

  // Template loading (from ?fromRouteSlug URL param)
  const searchParams = useSearchParams();
  const templateLoadedRef = useRef(false);
  const [templateBanner, setTemplateBanner] = useState<{ title: string; slug: string } | null>(null);

  // Hero entry mode — drives the lower page content
  const [heroMode, setHeroMode] = useState<"ki" | "individual" | "creator">("individual");

  // Plan-Modus: individuelle Planung vs. Creator-Routen Karussell (synced to heroMode)
  const [planMode, setPlanMode] = useState<"individual" | "creator">("individual");
  const [creatorRoutes, setCreatorRoutes] = useState<RoadtripRoute[]>([]);
  const [creatorRoutesLoading, setCreatorRoutesLoading] = useState(false);
  const creatorRoutesLoadedRef = useRef(false);

  // Roadtrip starten (speichert privat mit status=active)
  const [starting, setStarting] = useState(false);
  const [startedRouteSlug, setStartedRouteSlug] = useState<string | null>(null);

  // Save-Route modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveDesc, setSaveDesc] = useState("");
  const [saveTags, setSaveTags] = useState<string[]>([]);
  const [saveVisibility, setSaveVisibility] = useState<RoadtripRouteVisibility>("link_only");
  const [saving, setSaving] = useState(false);
  const [savedRouteSlug, setSavedRouteSlug] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  // Lightweight auth check for attribution
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
    });
  }, []);

  // Sync heroMode → planMode so the route-builder stays in sync
  useEffect(() => {
    if (heroMode === "creator") setPlanMode("creator");
    else if (heroMode === "individual") setPlanMode("individual");
  }, [heroMode]);

  // Pre-populate planner from a saved route template (?fromRouteSlug=&startDate=)
  useEffect(() => {
    const fromRouteSlug = searchParams.get("fromRouteSlug");
    if (!fromRouteSlug || templateLoadedRef.current) return;
    templateLoadedRef.current = true;

    const fromStartDate = searchParams.get("startDate") ?? todayStr();

    (async () => {
      const route = await fetchRoadtripRouteBySlug(fromRouteSlug);
      if (!route) return;

      const newStops: RoadtripStop[] = route.stops.map((rs, idx) => ({
        id: uid(),
        citySlug: rs.citySlug,
        cityLabel: rs.cityLabel,
        lat: rs.lat,
        lng: rs.lng,
        date: stopArrivalDate(fromStartDate, route.stops, idx),
        nights: rs.nights,
      }));

      setStops(newStops);
      setTripName(route.title);
      setOccasion(route.occasion);
      setBudget(route.budget);
      setTemplateBanner({ title: route.title, slug: route.slug });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Pre-populate planner from "Route entdecken" (?fromDiscover=1 + sessionStorage)
  useEffect(() => {
    const isFromDiscover = searchParams.get("fromDiscover") === "1";
    if (!isFromDiscover || templateLoadedRef.current) return;
    templateLoadedRef.current = true;
    if (typeof window === "undefined") return;

    const raw = window.sessionStorage.getItem("roadtrip_discover_stops");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as {
        stops: Array<{ citySlug: string; cityLabel: string; lat: number; lng: number; nights: number }>;
        from: string;
        to: string;
      };

      const baseDate = todayStr();
      let offset = 0;
      const newStops: RoadtripStop[] = parsed.stops.map((s) => {
        const nights = Math.max(1, s.nights);
        const stop: RoadtripStop = {
          id: uid(),
          citySlug: s.citySlug,
          cityLabel: s.cityLabel,
          lat: s.lat,
          lng: s.lng,
          date: addDays(baseDate, offset),
          nights,
        };
        offset += nights;
        return stop;
      });

      setStops(newStops);
      const fromShort = parsed.from.split(",")[0]?.trim() ?? parsed.from;
      const toShort   = parsed.to.split(",")[0]?.trim() ?? parsed.to;
      setTripName(`${fromShort} → ${toShort}`);
      window.sessionStorage.removeItem("roadtrip_discover_stops");
    } catch {
      // ignore parse errors
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Creator-Routen beim ersten Öffnen des Karussells laden
  useEffect(() => {
    if (planMode !== "creator" || creatorRoutesLoadedRef.current) return;
    creatorRoutesLoadedRef.current = true;
    setCreatorRoutesLoading(true);
    fetchPublicRoadtripRoutes(12).then((routes) => {
      setCreatorRoutes(routes);
      setCreatorRoutesLoading(false);
    });
  }, [planMode]);

  // Load cities
  useEffect(() => {
    (async () => {
      setCitiesLoading(true);
      try {
        const { data } = await supabase
          .from("cities")
          .select("slug,name,country_code,center_lat,center_lng,population")
          .eq("is_active", true)
          .order("population", { ascending: false })
          .limit(500);

        // Roadtrip: alle aktiven Städte zeigen (nicht auf Planner-Rollout begrenzt)
        const deduped = dedupeCitiesByCanonicalSlug((data as CityRow[]) ?? []);
        setCities(deduped);
      } finally {
        setCitiesLoading(false);
      }
    })();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchRef.current &&
        !searchRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Filtered city list for search dropdown
  const filteredCities = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    const base = q ? cities.filter((c) => c.name.toLowerCase().includes(q)) : cities;
    return base.slice(0, 12);
  }, [cities, citySearch]);

  // Derive trip date range
  const tripStartDate = stops[0]?.date ?? todayStr();
  const tripEndDate = useMemo(() => {
    if (!stops.length) return tripStartDate;
    const last = stops[stops.length - 1];
    return addDays(last.date, last.nights);
  }, [stops, tripStartDate]);
  const totalNights = stops.reduce((sum, s) => sum + s.nights, 0);

  // Add a city to the stop sequence
  const addStop = useCallback(
    (city: CityRow) => {
      const rollout = PLANNER_33_ROLLOUT.find((r) => r.slug === city.slug);
      const lat = city.center_lat ?? rollout?.lat ?? 0;
      const lng = city.center_lng ?? rollout?.lng ?? 0;

      const lastStop = stops[stops.length - 1];
      const date = lastStop ? addDays(lastStop.date, lastStop.nights) : todayStr();

      setStops((prev) => [
        ...prev,
        { id: uid(), citySlug: city.slug, cityLabel: city.name, lat, lng, date, nights: 1 },
      ]);
      setCitySearch("");
      setShowDropdown(false);
    },
    [stops]
  );

  const removeStop = useCallback((id: string) => {
    setStops((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const updateStop = useCallback((id: string, patch: Partial<RoadtripStop>) => {
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  // Move a stop up or down in the sequence
  const moveStop = useCallback((id: string, direction: "up" | "down") => {
    setStops((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const next = direction === "up" ? idx - 1 : idx + 1;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  }, []);

  // Generate day plans for every stop in parallel
  async function generateRoadtrip() {
    if (!stops.length || generating) return;
    setGenerating(true);

    // Initialise all as loading and open first accordion
    setGeneratedPlans(
      stops.map((stop) => ({
        citySlug: stop.citySlug,
        date: stop.date,
        status: "loading",
        stops: [],
        variantLabel: null,
        error: null,
      }))
    );
    setOpenSlug(stops[0].citySlug);

    const results: GeneratedCityPlan[] = await Promise.all(
      stops.map(async (stop) => {
        try {
          const res = await fetch("/api/planner/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              citySlug: stop.citySlug,
              planDate: stop.date,
              dayStartMin: ROADTRIP_AFTERNOON_START_MIN,
              // Hotel als Startpunkt wenn vorhanden, sonst Stadtzentrum
              startPoint: stop.hotelLat && stop.hotelLng
                ? {
                    type: "address",
                    label: stop.hotelName ?? stop.cityLabel,
                    lat: stop.hotelLat,
                    lng: stop.hotelLng,
                  }
                : {
                    type: "address",
                    label: stop.cityLabel,
                    lat: stop.lat,
                    lng: stop.lng,
                  },
              planMode: "fullday",
              radiusKm: 12,
              budget,
              occasion,
              experienceMode: "classic",
              interests: [],
              group: { enabled: false, members: [] },
              fullDayActsAfterBreakfast: 1,
              fullDayActsAfterLunch: 1,
              stopsCount: 4,
              sortMode: "match",
              routeProfile: "foot",
              variationSeed: 0,
            }),
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json() as {
            plannedStops?: Array<{
              label: string;
              hint: string;
              item?: { name?: string } | null;
              scheduledStartAt?: string | null;
            }>;
            variants?: Array<{ label?: string }>;
          };

          const apiStops = data.plannedStops ?? [];
          const variant = data.variants?.[0] ?? null;

          return {
            citySlug: stop.citySlug,
            date: stop.date,
            status: "done" as const,
            stops: apiStops.map((s) => ({
              label: s.label ?? s.item?.name ?? "Stop",
              hint: s.hint ?? "",
              time: s.scheduledStartAt
                ? s.scheduledStartAt.slice(11, 16) // "HH:MM" from ISO string
                : null,
              itemName: s.item?.name ?? null,
            })),
            variantLabel: variant?.label ?? null,
            error: null,
          };
        } catch (err) {
          return {
            citySlug: stop.citySlug,
            date: stop.date,
            status: "error" as const,
            stops: [],
            variantLabel: null,
            error: err instanceof Error ? err.message : "Unbekannter Fehler",
          };
        }
      })
    );

    setGeneratedPlans(results);
    setGenerating(false);
  }

  /** Baut den vollständigen Stop-Array mit generiertem Plan + Creator-Auswahl */
  function buildRouteStops() {
    return stops.map((stop, idx) => {
      const plan = generatedPlans[idx];
      const cityMode = cityPlanModes[stop.citySlug] ?? "individual";
      const creatorPick = selectedCreatorRoutes[stop.citySlug] ?? null;
      const planDone = plan?.status === "done";

      return {
        citySlug: stop.citySlug,
        cityLabel: stop.cityLabel,
        lat: stop.lat,
        lng: stop.lng,
        nights: stop.nights,
        // Kurztext-Zusammenfassung
        planSummary: planDone ? (plan.variantLabel ?? null) : null,
        // Generierte Einzel-Stops (nur im Individual-Modus)
        plannedStops:
          cityMode === "individual" && planDone && plan.stops.length > 0
            ? plan.stops
            : null,
        // Ausgewählte Creator-Route (nur im Creator-Modus)
        creatorRouteId: cityMode === "creator" && creatorPick ? creatorPick.id : null,
        creatorRouteSlug: cityMode === "creator" && creatorPick ? creatorPick.slug : null,
        creatorRouteTitle: cityMode === "creator" && creatorPick ? creatorPick.title : null,
      };
    });
  }

  async function saveRoute() {
    if (!stops.length || saving) return;
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user?.id ?? null;

      const routeStops = buildRouteStops();

      const { route, error } = await createRoadtripRoute({
        title: saveTitle.trim() || tripName.trim() || "Mein Roadtrip",
        description: saveDesc.trim() || null,
        tags: saveTags,
        occasion,
        budget,
        visibility: saveVisibility,
        stops: routeStops,
        authorUserId: currentUserId,
        authorName: currentUserId ? null : "Anonym",
      });

      if (error || !route) {
        alert(`Fehler beim Speichern: ${error ?? "Unbekannter Fehler"}`);
        return;
      }

      setSavedRouteSlug(route.slug);
    } finally {
      setSaving(false);
    }
  }

  /** Creator-Routen für eine Stadt laden (lazy, gecacht) */
  async function loadCityCreatorRoutes(citySlug: string) {
    if (cityCreatorRoutes[citySlug] !== undefined) return; // already cached
    setCityCreatorLoading((prev) => ({ ...prev, [citySlug]: true }));
    try {
      const { data } = await supabase
        .from("user_routes")
        .select("id,title,slug,description,city_slug,cover_image_url,avg_rating,bookmark_count,stop_count,creator_type,tags")
        .eq("city_slug", citySlug)
        .eq("visibility", "public")
        .order("bookmark_count", { ascending: false })
        .limit(8);
      const rows = (data as CityCreatorRoute[] | null) ?? [];
      const coverMap = await loadResolvedRouteCoverMap(rows.map((route) => route.id));
      setCityCreatorRoutes((prev) => ({
        ...prev,
        [citySlug]: rows.map((route) => ({
          ...route,
          cover_image_url: coverMap.get(route.id) ?? route.cover_image_url,
        })),
      }));
    } finally {
      setCityCreatorLoading((prev) => ({ ...prev, [citySlug]: false }));
    }
  }

  /** Stadt-Accordion-Modus umschalten */
  function setCityMode(citySlug: string, mode: "individual" | "creator") {
    setCityPlanModes((prev) => ({ ...prev, [citySlug]: mode }));
    if (mode === "creator") void loadCityCreatorRoutes(citySlug);
  }

  /** Creator-Route als Plan für eine Stadt auswählen / abwählen */
  function toggleCreatorRouteForCity(citySlug: string, route: CityCreatorRoute) {
    setSelectedCreatorRoutes((prev) => {
      if (prev[citySlug]?.id === route.id) {
        const next = { ...prev };
        delete next[citySlug];
        return next;
      }
      return { ...prev, [citySlug]: route };
    });
  }

  /** Creator-Route als Vorlage laden und Modus auf "individual" wechseln */
  function loadCreatorRoute(route: RoadtripRoute) {
    const baseDate = todayStr();
    const newStops: RoadtripStop[] = route.stops.map((rs, idx) => ({
      id: uid(),
      citySlug: rs.citySlug,
      cityLabel: rs.cityLabel,
      lat: rs.lat,
      lng: rs.lng,
      date: stopArrivalDate(baseDate, route.stops, idx),
      nights: rs.nights,
    }));
    setStops(newStops);
    setTripName(route.title);
    setOccasion(route.occasion);
    setBudget(route.budget);
    setTemplateBanner({ title: route.title, slug: route.slug });
    setGeneratedPlans([]);
    setPlanMode("individual");
    incrementRouteClones(route.id);
    // Scroll zurück nach oben
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Roadtrip starten — speichert als private Route mit status=active */
  async function startRoadtrip() {
    if (!stops.length || starting) return;
    if (!userId) {
      // Nicht eingeloggt — zum Login weiterleiten
      window.location.href = `/auth/login?redirect=${encodeURIComponent("/roadtrip")}`;
      return;
    }
    setStarting(true);
    try {
      const routeStops = buildRouteStops();

      const { route, error } = await createRoadtripRoute({
        title: tripName.trim() || "Mein Roadtrip",
        description: null,
        tags: [],
        occasion,
        budget,
        visibility: "private",
        status: "active",
        stops: routeStops,
        authorUserId: userId,
        authorName: null,
      });

      if (error || !route) {
        alert(`Fehler: ${error ?? "Unbekannter Fehler"}`);
        return;
      }

      // Sicherstellen dass status=active gesetzt ist (falls createRoadtripRoute es noch nicht persistiert)
      await setRoadtripStatus(route.id, "active");
      setStartedRouteSlug(route.slug);
      const runStartDate = stops[0]?.date ?? todayStr();
      window.location.href = `/roadtrip/routes/${route.slug}/run?startDate=${runStartDate}`;
    } finally {
      setStarting(false);
    }
  }

  if (!mounted) return null;

  return (
    <main className="pd24-page-wide space-y-4">
      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-xl border border-[var(--line-subtle)] bg-white px-4 py-4 shadow-[var(--shadow-soft)] sm:px-5">
        <div className="pointer-events-none absolute right-[-4rem] top-[-4rem] h-44 w-44 rounded-full bg-[rgba(183,106,67,0.1)] blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-3rem] left-[20%] h-36 w-36 rounded-full bg-[rgba(90,118,136,0.1)] blur-3xl" />

        <div className="relative">
          {/* Mode switcher */}
          <div className="mb-3">
            <PlannerModeSwitcher />
          </div>

          {/* Template banner — shown when planner was pre-filled from a saved route */}
          {templateBanner && (
            <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-[rgba(183,106,67,0.25)] bg-[rgba(183,106,67,0.07)] px-3 py-2.5">
              <span className="mt-px text-base leading-none">🗺️</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--text-strong)]">
                  Vorlage geladen: <span className="font-bold">„{templateBanner.title}"</span>
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-muted)]">
                  Städte, Reihenfolge und Nächte wurden übernommen — passe alles nach deinen Wünschen an.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTemplateBanner(null)}
                className="mt-px shrink-0 rounded-full p-1 text-[var(--text-muted)] transition hover:bg-[rgba(23,23,23,0.08)]"
                title="Banner schließen"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}

          {/* Hero heading */}
          <div className="mb-1 flex items-center gap-2">
            <span className="warm-chip rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
              Roadtrip
            </span>
          </div>
          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-[var(--text-strong)] sm:text-3xl">
            Wie möchtest du planen?
          </h1>
          <p className="mt-1.5 mb-4 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            Wähle deinen Einstieg — die KI macht Vorschläge, du planst selbst oder nutzt fertige Creator-Routen.
          </p>

          {/* ── 3 Foto-Einstiegskarten ─────────────────────────────────────── */}
          <div className="mb-4 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Auf dieser Seite
              </div>
              <div className="mt-1 text-sm font-semibold text-[var(--text-strong)]">
                Eigenen Roadtrip bauen oder Vorlage direkt in den Builder laden
              </div>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                `/roadtrip` ist dein Planer. Hier stellst du Staedte, Naechte und Tagesplaene zusammen.
              </p>
            </div>
            <Link
              href="/roadtrip/routes"
              className="group rounded-2xl border border-[rgba(183,106,67,0.24)] bg-[linear-gradient(135deg,rgba(183,106,67,0.08),rgba(90,118,136,0.06))] px-4 py-3 transition hover:border-[rgba(183,106,67,0.34)] hover:shadow-[0_10px_30px_rgba(15,23,42,0.08)]"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9d5a38]">
                Fertige Roadtrips
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--text-strong)]">
                    Alle Roadtrip-Routen entdecken
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                    `/roadtrip/routes` zeigt dir direkt fertige Mehrtagesrouten zum Sofortstart.
                  </p>
                </div>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[var(--text-strong)] shadow-sm transition group-hover:translate-x-0.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">

            {/* KI-Planung */}
            <button
              type="button"
              onClick={() => setHeroMode("ki")}
              className={`group relative overflow-hidden rounded-2xl text-left transition active:scale-[0.98] ${
                heroMode === "ki"
                  ? "ring-2 ring-[#b76a43] ring-offset-2 shadow-lg"
                  : "shadow-sm hover:shadow-md"
              }`}
              style={{ height: 200 }}
            >
              <Image
                src="/roadtrip/mode-ki.png"
                alt="KI-Planung"
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, 33vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              {heroMode === "ki" && (
                <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#b76a43] shadow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="h-3 w-3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#b76a43]/90 backdrop-blur-sm">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.75} className="h-4 w-4">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                    </svg>
                  </span>
                  <span className="text-sm font-bold text-white drop-shadow">KI-Planung</span>
                </div>
                <p className="mt-1 text-xs leading-4 text-white/80">
                  KI schlägt Zwischenstopps &amp; Highlights vor
                </p>
              </div>
            </button>

            {/* Individuell planen */}
            <button
              type="button"
              onClick={() => setHeroMode("individual")}
              className={`group relative overflow-hidden rounded-2xl text-left transition active:scale-[0.98] ${
                heroMode === "individual"
                  ? "ring-2 ring-[#5a7688] ring-offset-2 shadow-lg"
                  : "shadow-sm hover:shadow-md"
              }`}
              style={{ height: 200 }}
            >
              <Image
                src="/roadtrip/mode-individual.png"
                alt="Individuell planen"
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, 33vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              {heroMode === "individual" && (
                <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#5a7688] shadow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="h-3 w-3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#5a7688]/90 backdrop-blur-sm">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.75} className="h-4 w-4">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                      <circle cx="12" cy="9" r="2.5" />
                    </svg>
                  </span>
                  <span className="text-sm font-bold text-white drop-shadow">Individuell planen</span>
                </div>
                <p className="mt-1 text-xs leading-4 text-white/80">
                  Städte, Nächte &amp; Tagespläne selbst zusammenstellen
                </p>
              </div>
            </button>

            {/* Roadtrip-Vorlagen */}
            <button
              type="button"
              onClick={() => setHeroMode("creator")}
              className={`group relative overflow-hidden rounded-2xl text-left transition active:scale-[0.98] ${
                heroMode === "creator"
                  ? "ring-2 ring-[#7c6fa0] ring-offset-2 shadow-lg"
                  : "shadow-sm hover:shadow-md"
              }`}
              style={{ height: 200 }}
            >
              <Image
                src="/roadtrip/mode-creator.png"
                alt="Roadtrip-Vorlagen"
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, 33vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              {heroMode === "creator" && (
                <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#7c6fa0] shadow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="h-3 w-3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#7c6fa0]/90 backdrop-blur-sm">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.75} className="h-4 w-4">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </span>
                  <span className="text-sm font-bold text-white drop-shadow">Roadtrip-Vorlagen</span>
                </div>
                <p className="mt-1 text-xs leading-4 text-white/80">
                  Fertige Roadtrips direkt in deinen Plan uebernehmen
                </p>
              </div>
            </button>

          </div>
        </div>
      </section>

      {/* ── KI-Planung Panel ────────────────────────────────────────────── */}
      {heroMode === "ki" && (
        <section className="overflow-hidden rounded-2xl border border-[rgba(183,106,67,0.2)] bg-white shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
          <div className="relative bg-[linear-gradient(135deg,rgba(183,106,67,0.08),rgba(183,106,67,0.03))] px-5 py-8 text-center">
            <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-[rgba(183,106,67,0.1)] blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-32 w-32 rounded-full bg-[rgba(183,106,67,0.07)] blur-2xl" />
            <div className="relative">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#b76a43] shadow-[0_4px_14px_rgba(183,106,67,0.35)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.75} className="h-7 w-7">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-[var(--text-strong)]">KI-Planung</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--text-muted)]">
                Gib Start und Ziel an — die KI schlägt dir die besten Zwischenstopps, Sehenswürdigkeiten
                und Highlights passend zu deinen Vorlieben vor.
              </p>
              <a
                href="/roadtrip/discover"
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#b76a43] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#9d5a38] active:scale-[0.97]"
              >
                KI-Route entdecken
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-[var(--line-subtle)] border-t border-[var(--line-subtle)]">
            {[
              { icon: "🗺️", label: "Strecke eingeben" },
              { icon: "✨", label: "KI generiert Stopps" },
              { icon: "🚗", label: "Route starten" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1.5 px-3 py-4">
                <span className="text-xl">{icon}</span>
                <span className="text-center text-[11px] font-medium text-[var(--text-muted)]">{label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Trip settings ───────────────────────────────────────────────── */}
      {heroMode !== "ki" && (
      <section className="rounded-xl bg-white p-3 shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
        <div className="grid gap-2 sm:grid-cols-3">
          {/* Trip name */}
          <label className="rounded-xl border border-[rgba(17,24,39,0.06)] bg-[var(--bg-surface)] px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Tripname
            </div>
            <input
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              placeholder="z.B. Norddeutschland Roadtrip"
              className="mt-1 w-full bg-transparent text-sm font-semibold text-[var(--text-strong)] outline-none placeholder:font-normal placeholder:text-[var(--text-muted)]"
            />
          </label>

          {/* Occasion */}
          <label className="rounded-xl border border-[rgba(17,24,39,0.06)] bg-[var(--bg-surface)] px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Art der Reise
            </div>
            <select
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              className="mt-1 w-full bg-transparent text-sm font-semibold text-[var(--text-strong)] outline-none"
            >
              {OCCASION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {/* Budget */}
          <label className="rounded-xl border border-[rgba(17,24,39,0.06)] bg-[var(--bg-surface)] px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Budget
            </div>
            <select
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="mt-1 w-full bg-transparent text-sm font-semibold text-[var(--text-strong)] outline-none"
            >
              {BUDGET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      )}

      {/* ── Route builder ───────────────────────────────────────────────── */}
      {heroMode !== "ki" && (
      <section className="rounded-xl bg-white p-4 shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
        {/* ── Header mit Mode-Switcher — versteckt wenn heroMode schon bestimmt ─── */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {/* Segmented control — nur zeigen wenn heroMode="individual", nicht wenn "creator" (da redundant) */}
          <div className="flex items-center gap-0.5 rounded-xl border border-[rgba(17,24,39,0.08)] bg-[var(--bg-surface)] p-0.5">
            <button
              type="button"
              onClick={() => setPlanMode("individual")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                planMode === "individual"
                  ? "bg-white text-[var(--text-strong)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-3.5 w-3.5">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              Individuell planen
            </button>
            <button
              type="button"
              onClick={() => setPlanMode("creator")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                planMode === "creator"
                  ? "bg-white text-[var(--text-strong)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-3.5 w-3.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Vorlagen
              {creatorRoutes.length > 0 && (
                <span className="rounded-full bg-[rgba(183,106,67,0.15)] px-1.5 py-0.5 text-[10px] text-[#b76a43]">
                  {creatorRoutes.length}
                </span>
              )}
            </button>
          </div>

          {planMode === "individual" && stops.length >= 2 && (
            <span className="text-xs text-[var(--text-muted)]">
              {formatDateDE(tripStartDate)} → {formatDateDE(tripEndDate)}
            </span>
          )}
        </div>

        {/* ── Creator-Routen Karussell ─────────────────────────────────── */}
        {planMode === "creator" && (
          <div className="mb-4">
            <p className="mb-2.5 text-xs text-[var(--text-muted)]">
              Wähle eine Route als Vorlage — Städte, Reihenfolge und Nächte werden übernommen.
            </p>

            {creatorRoutesLoading ? (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-44 min-w-[220px] animate-pulse rounded-xl bg-[rgba(23,23,23,0.06)]" />
                ))}
              </div>
            ) : creatorRoutes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[rgba(23,23,23,0.12)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                Noch keine öffentlichen Routen vorhanden.
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {creatorRoutes.map((route) => {
                  const sequence = route.stops.map((s) => s.cityLabel).join(" → ");
                  const totalN = route.stops.reduce((s, st) => s + st.nights, 0);
                  return (
                    <div
                      key={route.id}
                      className="group flex min-w-[220px] max-w-[220px] snap-start flex-col overflow-hidden rounded-xl border border-[var(--line-subtle)] bg-white transition hover:border-[rgba(23,23,23,0.2)] hover:shadow-[0_4px_16px_rgba(15,23,42,0.1)]"
                    >
                      {/* Cover */}
                      <div className="relative h-24 bg-[linear-gradient(135deg,rgba(90,118,136,0.18),rgba(183,106,67,0.14))]">
                        <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-25">🗺️</div>
                        {route.is_featured && (
                          <div className="absolute right-2 top-2 rounded-full bg-[#b76a43] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                            Featured
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                          {route.stops.length} Städte · {totalN} Nächte
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex flex-1 flex-col gap-1.5 p-3">
                        <p className="text-xs font-semibold leading-snug text-[var(--text-strong)] line-clamp-1 group-hover:text-[#b76a43] transition-colors">
                          {route.title}
                        </p>
                        <p className="text-[10px] leading-snug text-[var(--text-muted)] line-clamp-2">
                          {sequence}
                        </p>
                        <button
                          type="button"
                          onClick={() => loadCreatorRoute(route)}
                          className="mt-auto flex items-center justify-center gap-1.5 rounded-lg bg-[var(--text-strong)] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#1f2937] active:scale-[0.97]"
                        >
                          Vorlage nutzen
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Stop cards + City-Search nur im individual Modus */}
        {stops.length > 0 && planMode === "individual" && (
          <div className="mb-3 space-y-2">
            {stops.map((stop, idx) => (
              <div
                key={stop.id}
                className="relative flex items-start gap-3 rounded-xl border border-[rgba(17,24,39,0.06)] bg-[var(--bg-surface)] px-3 py-3"
              >
                {/* Number bubble + connector line */}
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--text-strong)] text-[10px] font-bold text-white">
                    {idx + 1}
                  </div>
                  {idx < stops.length - 1 && (
                    <div className="w-px flex-1 bg-[rgba(23,23,23,0.14)]" style={{ minHeight: 14 }} />
                  )}
                </div>

                {/* Stop details */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--text-strong)]">{stop.cityLabel}</span>
                    <div className="flex items-center gap-1">
                      {idx > 0 && (
                        <button
                          type="button"
                          title="Nach oben"
                          onClick={() => moveStop(stop.id, "up")}
                          className="rounded p-1 text-[var(--text-muted)] transition hover:bg-[rgba(23,23,23,0.06)] hover:text-[var(--text-strong)]"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                            <path d="M18 15l-6-6-6 6" />
                          </svg>
                        </button>
                      )}
                      {idx < stops.length - 1 && (
                        <button
                          type="button"
                          title="Nach unten"
                          onClick={() => moveStop(stop.id, "down")}
                          className="rounded p-1 text-[var(--text-muted)] transition hover:bg-[rgba(23,23,23,0.06)] hover:text-[var(--text-strong)]"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeStop(stop.id)}
                        className="rounded px-2 py-1 text-xs text-[var(--text-muted)] transition hover:bg-red-50 hover:text-red-500"
                      >
                        Entfernen
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-3">
                    {/* Arrival date */}
                    <label className="flex items-center gap-1.5">
                      <span className="text-[11px] text-[var(--text-muted)]">Ankunft</span>
                      <input
                        type="date"
                        value={stop.date}
                        onChange={(e) => updateStop(stop.id, { date: e.target.value })}
                        className="border-b border-[var(--line-subtle)] bg-transparent text-xs font-medium text-[var(--text-strong)] outline-none"
                      />
                    </label>

                    {/* Nights */}
                    <label className="flex items-center gap-1.5">
                      <span className="text-[11px] text-[var(--text-muted)]">Nächte</span>
                      <select
                        value={stop.nights}
                        onChange={(e) => updateStop(stop.id, { nights: Number(e.target.value) })}
                        className="bg-transparent text-xs font-medium text-[var(--text-strong)] outline-none"
                      >
                        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>

                    {/* Departure computed */}
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Abreise: {formatDateDE(addDays(stop.date, stop.nights))}
                    </span>
                  </div>

                  {/* Hotel-Unterkunft suchen (Nominatim) */}
                  <div className="mt-2.5">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      Unterkunft
                    </p>
                    <HotelAutocomplete
                      cityLabel={stop.cityLabel}
                      cityLat={stop.lat}
                      cityLng={stop.lng}
                      value={
                        stop.hotelLat && stop.hotelLng
                          ? { name: stop.hotelName ?? "", lat: stop.hotelLat, lng: stop.hotelLng }
                          : null
                      }
                      onChange={(hotel: HotelSelection | null) =>
                        updateStop(stop.id, {
                          hotelName: hotel?.name ?? null,
                          hotelLat: hotel?.lat ?? null,
                          hotelLng: hotel?.lng ?? null,
                        })
                      }
                    />
                  </div>

                  {/* Hotel search — visible immediately after a stop is added */}
                  <div className="mt-2">
                    <HotelSearchLinks
                      cityLabel={stop.cityLabel}
                      checkin={stop.date}
                      checkout={addDays(stop.date, stop.nights)}
                      nights={stop.nights}
                      adults={2}
                      citySlug={stop.citySlug}
                      userId={userId}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* City search — nur im individual Modus */}
        {planMode === "individual" && <div className="relative">
          <div className="flex items-center gap-2 rounded-xl border border-[rgba(17,24,39,0.08)] bg-[var(--bg-surface)] px-3 py-2.5 focus-within:border-[rgba(23,23,23,0.25)] focus-within:bg-white transition">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              className="h-4 w-4 shrink-0 text-[var(--text-muted)]"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchRef}
              value={citySearch}
              onChange={(e) => {
                setCitySearch(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder={
                stops.length === 0 ? "Erste Stadt hinzufügen…" : "Nächste Stadt hinzufügen…"
              }
              disabled={citiesLoading}
              className="flex-1 bg-transparent text-sm font-medium text-[var(--text-strong)] outline-none placeholder:font-normal placeholder:text-[var(--text-muted)] disabled:opacity-60"
            />
            {citySearch && (
              <button
                type="button"
                onClick={() => { setCitySearch(""); setShowDropdown(false); }}
                className="text-[var(--text-muted)] hover:text-[var(--text-strong)] transition"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {showDropdown && filteredCities.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-30 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-[var(--line-subtle)] bg-white shadow-lg"
            >
              {filteredCities.map((city) => {
                const added = stops.some((s) => s.citySlug === city.slug);
                return (
                  <button
                    key={city.slug}
                    type="button"
                    disabled={added}
                    onClick={() => addStop(city)}
                    className="flex w-full items-center justify-between border-b border-[var(--line-subtle)] px-3 py-2.5 text-left transition last:border-b-0 hover:bg-[var(--bg-surface)] disabled:opacity-40"
                  >
                    <span className="text-sm font-medium text-[var(--text-strong)]">
                      {city.name}
                    </span>
                    {added && (
                      <span className="text-xs text-[var(--text-muted)]">bereits dabei</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>}

        {/* Action buttons */}
        {stops.length >= 1 && (
          <div className="mt-4 flex flex-col gap-2">
            {/* Roadtrip gestartet — Erfolgs-Banner */}
            {startedRouteSlug && (
              <div className="flex items-start gap-2.5 rounded-xl border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.07)] px-3 py-3">
                <span className="text-lg">🚀</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-emerald-800">Roadtrip gestartet!</p>
                  <p className="mt-0.5 text-[11px] text-emerald-700">
                    Deine Route ist im Profil gespeichert — du kannst sie jederzeit fortsetzen.
                  </p>
                  <a
                    href="/roadtrip/routes"
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 underline underline-offset-2"
                  >
                    Zum Profil →
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => setStartedRouteSlug(null)}
                  className="shrink-0 text-emerald-600 hover:text-emerald-800 transition"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}

            {/* 🚀 Roadtrip starten — primärer CTA */}
            <button
              type="button"
              onClick={() => void startRoadtrip()}
              disabled={starting || generating}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#b76a43] px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#9d5a38] active:scale-[0.98] disabled:opacity-60"
            >
              {starting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Wird gespeichert…
                </>
              ) : (
                <>
                  🚀 Roadtrip starten
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>

            {/* Tagesplan generieren */}
            <button
              type="button"
              onClick={() => void generateRoadtrip()}
              disabled={generating || starting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--text-strong)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1f2937] active:scale-[0.98] disabled:opacity-60"
            >
              {generating ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Tagesplan wird erstellt…
                </>
              ) : (
                <>
                  Tagesplan generieren
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                  </svg>
                </>
              )}
            </button>

            {/* Route speichern & teilen */}
            <button
              type="button"
              onClick={() => {
                setSaveTitle(tripName.trim() || "");
                setSavedRouteSlug(null);
                setShowSaveModal(true);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--line-subtle)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)] active:scale-[0.98]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Route speichern & teilen
            </button>
          </div>
        )}
      </section>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {stops.length === 0 && heroMode === "individual" && (
        <section className="rounded-xl border border-dashed border-[rgba(23,23,23,0.15)] bg-[var(--bg-surface)] px-6 py-10 text-center">
          <div className="mb-3 text-4xl">🗺️</div>
          <div className="font-semibold text-[var(--text-strong)]">Starte deinen Roadtrip</div>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-[var(--text-muted)]">
            Füge Städte hinzu und leg fest, wie viele Nächte du wo verbringst. Wir erstellen
            für jede Station einen vollständigen Tagesplan.
          </p>
          {!citiesLoading && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {STARTER_CITIES.map((name) => {
                const city = cities.find(
                  (c) => c.name.toLowerCase() === name.toLowerCase()
                );
                return city ? (
                  <button
                    key={name}
                    type="button"
                    onClick={() => addStop(city)}
                    className="rounded-full border border-[var(--line-subtle)] bg-white px-3.5 py-1.5 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[rgba(23,23,23,0.04)] active:scale-[0.97]"
                  >
                    + {name}
                  </button>
                ) : null;
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Generated plan accordion ────────────────────────────────────── */}
      {generatedPlans.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-[var(--text-strong)]">
              {tripName.trim() || "Dein Roadtrip-Plan"}
            </h2>
            <span className="text-xs text-[var(--text-muted)]">
              {formatDateDE(tripStartDate)} → {formatDateDE(tripEndDate)} · {totalNights}{" "}
              {totalNights === 1 ? "Nacht" : "Nächte"}
            </span>
          </div>

          {generatedPlans.map((plan, idx) => {
            const stop = stops[idx];
            const isOpen = openSlug === plan.citySlug;

            return (
              <div
                key={`${plan.citySlug}-${idx}`}
                className="overflow-hidden rounded-xl border border-[var(--line-subtle)] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.05)]"
              >
                {/* Accordion header */}
                <button
                  type="button"
                  onClick={() => setOpenSlug(isOpen ? null : plan.citySlug)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[var(--bg-surface)]"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--text-strong)] text-[10px] font-bold text-white">
                    {idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[var(--text-strong)]">
                      {stop?.cityLabel ?? plan.citySlug}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--text-muted)]">
                      <span>
                        {formatDateDE(plan.date)} · {stop?.nights ?? 1}{" "}
                        {(stop?.nights ?? 1) === 1 ? "Nacht" : "Nächte"}
                      </span>
                      {stop?.hotelName && (
                        <span className="flex items-center gap-1 text-[#b76a43]">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-3 w-3 shrink-0">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                          </svg>
                          {stop.hotelName.split(",")[0]}
                        </span>
                      )}
                      {selectedCreatorRoutes[plan.citySlug] && (
                        <span className="flex items-center gap-1 text-[#b76a43]">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 shrink-0 text-amber-400">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                          {selectedCreatorRoutes[plan.citySlug].title.split(" ").slice(0, 4).join(" ")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="flex items-center gap-2">
                    {plan.status === "loading" && (
                      <svg className="h-4 w-4 animate-spin text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                    )}
                    {plan.status === "done" && (
                      <span className="rounded-full bg-[rgba(34,197,94,0.12)] px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        {plan.stops.length} Stops
                      </span>
                    )}
                    {plan.status === "error" && (
                      <span className="rounded-full bg-[rgba(239,68,68,0.1)] px-2 py-0.5 text-[10px] font-semibold text-red-600">
                        Fehler
                      </span>
                    )}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.75}
                      className={`h-4 w-4 text-[var(--text-muted)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </button>

                {/* Accordion body */}
                {isOpen && (
                  <div className="border-t border-[var(--line-subtle)] px-4 py-4 space-y-3">

                    {/* ── Mini Mode-Switcher (nur wenn Plan generiert/lädt) ─── */}
                    {plan.status !== "idle" && (
                      <div className="flex items-center gap-0.5 w-fit rounded-lg border border-[rgba(17,24,39,0.08)] bg-[var(--bg-surface)] p-0.5">
                        <button
                          type="button"
                          onClick={() => setCityMode(plan.citySlug, "individual")}
                          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                            (cityPlanModes[plan.citySlug] ?? "individual") === "individual"
                              ? "bg-white text-[var(--text-strong)] shadow-sm"
                              : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                          }`}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-3 w-3">
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          Individuell planen
                        </button>
                        <button
                          type="button"
                          onClick={() => setCityMode(plan.citySlug, "creator")}
                          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                            (cityPlanModes[plan.citySlug] ?? "individual") === "creator"
                              ? "bg-white text-[var(--text-strong)] shadow-sm"
                              : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                          }`}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-3 w-3">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                          Creator-Routen
                          {selectedCreatorRoutes[plan.citySlug] && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[#b76a43]" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* ── INDIVIDUAL PLAN ────────────────────────────────────── */}
                    {(cityPlanModes[plan.citySlug] ?? "individual") === "individual" && (
                      <>
                        {plan.status === "loading" && (
                          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                            Tagesplan wird generiert…
                          </div>
                        )}

                        {plan.status === "error" && (
                          <p className="text-sm text-red-600">{plan.error}</p>
                        )}

                        {plan.status === "done" && (
                          <div className="space-y-3">
                            {plan.variantLabel && (
                              <p className="text-sm italic text-[var(--text-muted)]">{plan.variantLabel}</p>
                            )}

                            <div className="rounded-xl border border-[rgba(23,23,23,0.08)] bg-[var(--bg-surface)] px-3 py-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                                Anreise
                              </p>
                              <p className="mt-1 text-sm text-[var(--text-strong)]">
                                Vormittag für Check-out, Anfahrt und Check-in reserviert.
                              </p>
                              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                                Die Tagesplanung startet hier bewusst erst ab {ROADTRIP_AFTERNOON_START_LABEL} Uhr.
                              </p>
                            </div>

                            {normalizeRoadtripStopTimes(plan.stops).length > 0 ? (
                              <ol className="space-y-2.5">
                                <li className="flex items-start gap-2.5">
                                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(23,23,23,0.08)] text-[10px] font-semibold text-[var(--text-strong)]">
                                    1
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-[var(--text-strong)]">Anreise &amp; Check-in</div>
                                    <div className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">
                                      Check-out, Anfahrt und Hotel-Check-in bis zum Nachmittag.
                                    </div>
                                  </div>
                                  <span className="mt-0.5 shrink-0 rounded bg-[rgba(23,23,23,0.06)] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[var(--text-muted)]">
                                    {ROADTRIP_TRAVEL_WINDOW_LABEL}
                                  </span>
                                </li>
                                {normalizeRoadtripStopTimes(plan.stops).map((s, i) => (
                                  <li key={i} className="flex items-start gap-2.5">
                                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(23,23,23,0.08)] text-[10px] font-semibold text-[var(--text-strong)]">
                                      {i + 2}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium text-[var(--text-strong)]">{s.label}</div>
                                      {s.hint && (
                                        <div className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">{s.hint}</div>
                                      )}
                                    </div>
                                    {s.time && (
                                      <span className="mt-0.5 shrink-0 rounded bg-[rgba(23,23,23,0.06)] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[var(--text-muted)]">
                                        {s.time}
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ol>
                            ) : (
                              <p className="text-sm text-[var(--text-muted)]">
                                Keine Stops gefunden — versuche eine andere Stadt oder Datum.
                              </p>
                            )}

                            <div className="pt-1">
                              <HotelSearchLinks
                                cityLabel={stop?.cityLabel ?? plan.citySlug}
                                checkin={plan.date}
                                checkout={addDays(plan.date, stop?.nights ?? 1)}
                                nights={stop?.nights ?? 1}
                                adults={2}
                                citySlug={plan.citySlug}
                                userId={userId}
                              />
                            </div>

                            <div className="pt-1">
                              <a
                                href={`/planner?citySlug=${encodeURIComponent(plan.citySlug)}&occasion=${occasion}&budget=${budget}&planDate=${plan.date}&dayStartMin=${ROADTRIP_AFTERNOON_START_MIN}`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] transition hover:bg-white"
                              >
                                In Tagesplanung öffnen
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-3 w-3">
                                  <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                              </a>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* ── CREATOR-ROUTEN ──────────────────────────────────────── */}
                    {(cityPlanModes[plan.citySlug] ?? "individual") === "creator" && (
                      <div className="space-y-2">
                        {/* Aktuelle Auswahl-Banner */}
                        {selectedCreatorRoutes[plan.citySlug] && (
                          <div className="flex items-center gap-2 rounded-xl border border-[rgba(183,106,67,0.28)] bg-[rgba(183,106,67,0.07)] px-3 py-2">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5 shrink-0 text-[#b76a43]">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <p className="flex-1 text-xs font-semibold text-[#b76a43] truncate">
                              {selectedCreatorRoutes[plan.citySlug].title}
                            </p>
                            <button
                              type="button"
                              onClick={() => toggleCreatorRouteForCity(plan.citySlug, selectedCreatorRoutes[plan.citySlug])}
                              className="text-[#b76a43] hover:text-red-500 transition"
                              title="Auswahl aufheben"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        )}

                        {/* Laden */}
                        {cityCreatorLoading[plan.citySlug] && (
                          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                            Creator-Routen werden geladen…
                          </div>
                        )}

                        {/* Keine Routen */}
                        {!cityCreatorLoading[plan.citySlug] &&
                          (cityCreatorRoutes[plan.citySlug] ?? []).length === 0 && (
                          <div className="rounded-xl border border-dashed border-[rgba(23,23,23,0.12)] px-4 py-6 text-center">
                            <div className="text-2xl mb-1.5">🗺️</div>
                            <p className="text-sm font-medium text-[var(--text-strong)]">
                              Noch keine Creator-Routen für {stop?.cityLabel ?? plan.citySlug}
                            </p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                              Nutze den individuellen Plan oder erstelle selbst eine Route.
                            </p>
                          </div>
                        )}

                        {/* Routen-Karten */}
                        {!cityCreatorLoading[plan.citySlug] &&
                          (cityCreatorRoutes[plan.citySlug] ?? []).length > 0 &&
                          (cityCreatorRoutes[plan.citySlug] ?? []).map((cr) => {
                            const isSelected = selectedCreatorRoutes[plan.citySlug]?.id === cr.id;
                            return (
                              <div
                                key={cr.id}
                                className={`flex items-start gap-3 rounded-xl border p-3 transition ${
                                  isSelected
                                    ? "border-[rgba(183,106,67,0.4)] bg-[rgba(183,106,67,0.06)]"
                                    : "border-[var(--line-subtle)] bg-white hover:border-[rgba(23,23,23,0.15)]"
                                }`}
                              >
                                {/* Cover-Thumbnail */}
                                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[linear-gradient(135deg,rgba(90,118,136,0.2),rgba(183,106,67,0.15))]">
                                  {cr.cover_image_url ? (
                                    <img
                                      src={cr.cover_image_url}
                                      alt={cr.title}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-lg opacity-40">
                                      🗺️
                                    </div>
                                  )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-semibold leading-snug ${isSelected ? "text-[#b76a43]" : "text-[var(--text-strong)]"}`}>
                                    {cr.title}
                                  </p>
                                  {cr.description && (
                                    <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-muted)] line-clamp-2">
                                      {cr.description}
                                    </p>
                                  )}
                                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-[var(--text-muted)]">
                                    {cr.stop_count > 0 && (
                                      <span className="flex items-center gap-1">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-3 w-3">
                                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                                        </svg>
                                        {cr.stop_count} Stops
                                      </span>
                                    )}
                                    {cr.avg_rating > 0 && (
                                      <span className="flex items-center gap-0.5">
                                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 text-amber-400">
                                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                        </svg>
                                        {cr.avg_rating.toFixed(1)}
                                      </span>
                                    )}
                                    {cr.creator_type !== "user" && (
                                      <span className="rounded-full bg-[rgba(23,23,23,0.06)] px-1.5 py-0.5 text-[10px] font-medium capitalize">
                                        {cr.creator_type}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => toggleCreatorRouteForCity(plan.citySlug, cr)}
                                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                                      isSelected
                                        ? "bg-[#b76a43] text-white"
                                        : "border border-[var(--line-subtle)] bg-white text-[var(--text-strong)] hover:bg-[var(--bg-surface)]"
                                    }`}
                                  >
                                    {isSelected ? "✓ Gewählt" : "Auswählen"}
                                  </button>
                                  {cr.slug && (
                                    <a
                                      href={`/routes/${cr.slug}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10px] text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--text-strong)] transition"
                                    >
                                      Ansehen →
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
      {/* ── Save / Share Modal ───────────────────────────────────────────── */}
      {showSaveModal && (
        <div
          className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSaveModal(false); }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-[var(--line-subtle)] px-5 py-4">
              <h2 className="font-semibold text-[var(--text-strong)]">Route speichern & teilen</h2>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="rounded-full p-1.5 text-[var(--text-muted)] transition hover:bg-[rgba(23,23,23,0.06)]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              {savedRouteSlug ? (
                // ── Success state ────────────────────────────────────────────
                <div className="space-y-4 text-center">
                  <div className="text-4xl">🎉</div>
                  <div>
                    <div className="font-semibold text-[var(--text-strong)]">Route gespeichert!</div>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      Deine Route ist jetzt unter folgendem Link erreichbar:
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2.5">
                    <code className="flex-1 truncate text-xs text-[var(--text-strong)]">
                      {typeof window !== "undefined" ? `${window.location.origin}/roadtrip/routes/${savedRouteSlug}` : ""}
                    </code>
                    <button
                      type="button"
                      onClick={async () => {
                        const url = typeof window !== "undefined" ? `${window.location.origin}/roadtrip/routes/${savedRouteSlug}` : "";
                        await navigator.clipboard.writeText(url);
                      }}
                      className="shrink-0 rounded-lg border border-[var(--line-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)]"
                    >
                      Kopieren
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`/roadtrip/routes/${savedRouteSlug}`}
                      className="flex-1 rounded-2xl bg-[var(--text-strong)] px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-[#1f2937]"
                    >
                      Route ansehen →
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowSaveModal(false)}
                      className="rounded-2xl border border-[var(--line-subtle)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-surface)]"
                    >
                      Schließen
                    </button>
                  </div>
                </div>
              ) : (
                // ── Form state ───────────────────────────────────────────────
                <>
                  {/* Title */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-1.5">
                      Route-Name
                    </label>
                    <input
                      value={saveTitle}
                      onChange={(e) => setSaveTitle(e.target.value)}
                      placeholder={tripName.trim() || "Mein Roadtrip"}
                      className="w-full rounded-xl border border-[rgba(17,24,39,0.1)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm font-medium text-[var(--text-strong)] outline-none focus:border-[rgba(23,23,23,0.35)] transition"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-1.5">
                      Beschreibung <span className="font-normal text-[var(--text-muted)]">(optional)</span>
                    </label>
                    <textarea
                      value={saveDesc}
                      onChange={(e) => setSaveDesc(e.target.value)}
                      placeholder="Was macht diese Route besonders? Tipps, Highlights, Erfahrungen…"
                      rows={3}
                      className="w-full resize-none rounded-xl border border-[rgba(17,24,39,0.1)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm text-[var(--text-strong)] outline-none focus:border-[rgba(23,23,23,0.35)] transition"
                    />
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-1.5">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {ROADTRIP_TAGS.map((tag) => {
                        const active = saveTags.includes(tag.value);
                        return (
                          <button
                            key={tag.value}
                            type="button"
                            onClick={() =>
                              setSaveTags((prev) =>
                                active ? prev.filter((t) => t !== tag.value) : [...prev, tag.value]
                              )
                            }
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                              active
                                ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                                : "border-[rgba(23,23,23,0.1)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:border-[rgba(23,23,23,0.25)]"
                            }`}
                          >
                            {tag.emoji} {tag.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Visibility */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-1.5">
                      Sichtbarkeit
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { value: "public",    label: "Öffentlich",    desc: "In Entdecken sichtbar" },
                          { value: "link_only", label: "Nur per Link",  desc: "Nur wer den Link hat" },
                          { value: "private",   label: "Privat",        desc: "Nur für dich" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setSaveVisibility(opt.value)}
                          className={`flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition ${
                            saveVisibility === opt.value
                              ? "border-[var(--text-strong)] bg-[rgba(23,23,23,0.04)]"
                              : "border-[rgba(23,23,23,0.1)] bg-[var(--bg-surface)] hover:border-[rgba(23,23,23,0.2)]"
                          }`}
                        >
                          <span className="text-xs font-semibold text-[var(--text-strong)]">{opt.label}</span>
                          <span className="text-[10px] text-[var(--text-muted)] leading-tight">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Save button */}
                  <button
                    type="button"
                    onClick={() => void saveRoute()}
                    disabled={saving || stops.length === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--text-strong)] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#1f2937] active:scale-[0.98] disabled:opacity-60"
                  >
                    {saving ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                        Wird gespeichert…
                      </>
                    ) : (
                      "Route speichern"
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function RoadtripPage() {
  return (
    <Suspense
      fallback={
        <main className="pd24-page-wide space-y-4">
          <section className="rounded-xl border border-[var(--line-subtle)] bg-white px-4 py-4 shadow-[var(--shadow-soft)]">
            <div className="text-sm text-[var(--text-muted)]">Roadtrip-Planner wird geladen…</div>
          </section>
        </main>
      }
    >
      <RoadtripPageContent />
    </Suspense>
  );
}
