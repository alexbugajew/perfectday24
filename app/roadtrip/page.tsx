"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { canonicalCitySlug, dedupeCitiesByCanonicalSlug } from "@/lib/cities/canonical";
import { isPlannerSupportedCitySlug } from "@/lib/cities/planner-support";
import { PLANNER_33_ROLLOUT } from "@/lib/cities/rollout";
import PlannerModeSwitcher from "@/components/planner/PlannerModeSwitcher";
import HotelSearchLinks from "@/components/roadtrip/HotelSearchLinks";
import { createRoadtripRoute } from "@/lib/roadtrip/client";
import { ROADTRIP_TAGS } from "@/lib/roadtrip/types";
import type { RoadtripRouteVisibility } from "@/lib/roadtrip/types";

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

  // Auth — used for attribution tracking only
  const [userId, setUserId] = useState<string | null>(null);

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

        const filtered = dedupeCitiesByCanonicalSlug((data as CityRow[]) ?? []).filter((c) =>
          isPlannerSupportedCitySlug(c.slug)
        );
        setCities(filtered);
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
              startPoint: {
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

  async function saveRoute() {
    if (!stops.length || saving) return;
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user?.id ?? null;

      const routeStops = stops.map((stop, idx) => ({
        citySlug: stop.citySlug,
        cityLabel: stop.cityLabel,
        lat: stop.lat,
        lng: stop.lng,
        nights: stop.nights,
        planSummary:
          generatedPlans[idx]?.status === "done"
            ? (generatedPlans[idx]?.variantLabel ?? null)
            : null,
      }));

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

          {/* Badges */}
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="warm-chip rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
              Roadtrip
            </span>
            {stops.length > 0 && (
              <span className="rounded-full border border-[var(--line-subtle)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                {stops.length} {stops.length === 1 ? "Stadt" : "Städte"} · {totalNights}{" "}
                {totalNights === 1 ? "Nacht" : "Nächte"}
              </span>
            )}
          </div>

          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-[var(--text-strong)] sm:text-3xl">
            {tripName.trim() || "Roadtrip planen"}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            Wähle Städte, lege die Reihenfolge und Aufenthaltsdauer fest. Für jede Stadt
            erstellen wir einen konkreten Tagesplan.
          </p>
        </div>
      </section>

      {/* ── Trip settings ───────────────────────────────────────────────── */}
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

      {/* ── Route builder ───────────────────────────────────────────────── */}
      <section className="rounded-xl bg-white p-4 shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
        {/* Header */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--text-strong)]">Reiseroute</h2>
          {stops.length >= 2 && (
            <span className="text-xs text-[var(--text-muted)]">
              {formatDateDE(tripStartDate)} → {formatDateDE(tripEndDate)}
            </span>
          )}
        </div>

        {/* Stop cards */}
        {stops.length > 0 && (
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

        {/* City search */}
        <div className="relative">
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
        </div>

        {/* Action buttons */}
        {stops.length >= 1 && (
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void generateRoadtrip()}
              disabled={generating}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--text-strong)] px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1f2937] active:scale-[0.98] disabled:opacity-60"
            >
              {generating ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Pläne werden erstellt…
                </>
              ) : (
                <>
                  Roadtrip planen
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>

            {/* Save & Share button */}
            <button
              type="button"
              onClick={() => {
                setSaveTitle(tripName.trim() || "");
                setSavedRouteSlug(null);
                setShowSaveModal(true);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--line-subtle)] bg-white px-5 py-3 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)] active:scale-[0.98]"
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

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {stops.length === 0 && (
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
                    <div className="text-xs text-[var(--text-muted)]">
                      {formatDateDE(plan.date)} · {stop?.nights ?? 1}{" "}
                      {(stop?.nights ?? 1) === 1 ? "Nacht" : "Nächte"}
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
                  <div className="border-t border-[var(--line-subtle)] px-4 py-4">
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
                          <p className="text-sm italic text-[var(--text-muted)]">
                            {plan.variantLabel}
                          </p>
                        )}

                        {plan.stops.length > 0 ? (
                          <ol className="space-y-2.5">
                            {plan.stops.map((s, i) => (
                              <li key={i} className="flex items-start gap-2.5">
                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(23,23,23,0.08)] text-[10px] font-semibold text-[var(--text-strong)]">
                                  {i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-[var(--text-strong)]">
                                    {s.label}
                                  </div>
                                  {s.hint && (
                                    <div className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">
                                      {s.hint}
                                    </div>
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

                        {/* Hotel affiliate links */}
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
                            href={`/planner?citySlug=${encodeURIComponent(plan.citySlug)}&occasion=${occasion}&budget=${budget}&planDate=${plan.date}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] transition hover:bg-white"
                          >
                            In Tagesplanung öffnen
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-3 w-3">
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                          </a>
                        </div>
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
