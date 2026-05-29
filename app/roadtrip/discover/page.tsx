"use client";

// app/roadtrip/discover/page.tsx
// "Route entdecken" — KI schlägt Zwischenstopps vor (ähnlich Roadtrippers).

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SuggestedStop, RoutePreference } from "@/lib/roadtrip/suggest-types";
import {
  ROUTE_PREFERENCES,
  DETOUR_LABELS,
  DETOUR_COLORS,
  durationLabel,
} from "@/lib/roadtrip/suggest-types";
import type { DiscoverMapProps } from "@/components/roadtrip/DiscoverMap";
import { slugifyTitle } from "@/lib/roadtrip/types";

// Leaflet braucht dynamischen Import (kein SSR)
const DiscoverMap = dynamic(
  () => import("@/components/roadtrip/DiscoverMap"),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">Karte wird geladen…</div> }
) as React.ComponentType<DiscoverMapProps>;

// ── Typen ─────────────────────────────────────────────────────────────────────

type LocationSuggestion = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
};

type SelectedLocation = {
  label: string;
  lat: number;
  lng: number;
};

// ── LocationInput-Komponente ──────────────────────────────────────────────────

function LocationInput({
  placeholder,
  value,
  onSelect,
  icon,
}: {
  placeholder: string;
  value: SelectedLocation | null;
  onSelect: (loc: SelectedLocation | null) => void;
  icon: string;
}) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync external value
  useEffect(() => {
    if (value) setQuery(value.label);
  }, [value]);

  // Click outside → close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleChange(q: string) {
    setQuery(q);
    if (!q.trim()) {
      onSelect(null);
      setSuggestions([]);
      setOpen(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=0`,
          { headers: { "User-Agent": "perfectday24.de/1.0 (hallo@perfectday24.de)" } }
        );
        const data = (await res.json()) as LocationSuggestion[];
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 380);
  }

  function handleSelect(s: LocationSuggestion) {
    const shortLabel = s.display_name.split(",").slice(0, 2).join(",").trim();
    setQuery(shortLabel);
    onSelect({ label: shortLabel, lat: parseFloat(s.lat), lng: parseFloat(s.lon) });
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <div className="flex items-center gap-2 rounded-xl border border-[var(--line-subtle)] bg-white px-3 py-2.5 transition focus-within:border-[rgba(23,23,23,0.35)] focus-within:ring-2 focus-within:ring-[rgba(23,23,23,0.06)]">
        <span className="text-base">{icon}</span>
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-[var(--text-strong)] outline-none placeholder:text-[var(--text-muted)]"
        />
        {loading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--line-subtle)] border-t-[var(--text-muted)]" />
        )}
        {value && (
          <button
            type="button"
            onClick={() => { setQuery(""); onSelect(null); setSuggestions([]); setOpen(false); }}
            className="text-[var(--text-muted)] hover:text-[var(--text-strong)]"
          >
            ✕
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-[var(--line-subtle)] bg-white shadow-lg">
          {suggestions.map((s) => (
            <li key={s.place_id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(s)}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-[var(--bg-surface)]"
              >
                <span className="mt-0.5 shrink-0 text-[var(--text-muted)]">📍</span>
                <span className="line-clamp-2 text-[var(--text-strong)]">{s.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Stop-Karte ────────────────────────────────────────────────────────────────

function StopCard({
  stop,
  number,
  selected,
  active,
  onToggle,
  onHover,
}: {
  stop: SuggestedStop;
  number: number;
  selected: boolean;
  active: boolean;
  onToggle: () => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <div
      onMouseEnter={() => onHover(stop.id)}
      onMouseLeave={() => onHover(null)}
      className={`relative overflow-hidden rounded-2xl border p-4 transition-all cursor-pointer ${
        active
          ? "border-amber-300 bg-amber-50/60 shadow-md"
          : selected
          ? "border-emerald-300 bg-emerald-50/40 shadow-sm"
          : "border-[var(--line-subtle)] bg-white hover:border-[rgba(23,23,23,0.2)] hover:shadow-sm"
      }`}
      onClick={onToggle}
    >
      {/* Nummer */}
      <div className="absolute left-4 top-4">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${
            selected ? "bg-emerald-500" : "bg-amber-500"
          }`}
        >
          {number}
        </div>
      </div>

      {/* Ausgewählt-Checkmark */}
      {selected && (
        <div className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white text-xs">
          ✓
        </div>
      )}

      <div className="pl-10 pr-8">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xl">{stop.emoji}</span>
          <span className="font-semibold text-[var(--text-strong)]">{stop.name}</span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
              DETOUR_COLORS[stop.detour]
            }`}
          >
            {DETOUR_LABELS[stop.detour]}
          </span>
          <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
            ⏱ {durationLabel(stop.duration_min)}
          </span>
        </div>

        {/* Beschreibung */}
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{stop.description}</p>

        {/* Warum lohnt es sich */}
        <div className="mt-2 flex items-start gap-1.5">
          <span className="mt-0.5 shrink-0 text-amber-500">★</span>
          <p className="text-xs font-medium text-[var(--text-strong)]">{stop.why_visit}</p>
        </div>

        {/* Toggle-Text */}
        <div className="mt-3 text-xs font-semibold">
          {selected ? (
            <span className="text-emerald-600">✓ Zur Route hinzugefügt — klicken zum Entfernen</span>
          ) : (
            <span className="text-[var(--text-muted)]">Klicken zum Hinzufügen</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Hauptseite ────────────────────────────────────────────────────────────────

export default function RoadtripDiscoverPage() {
  const router = useRouter();

  const [from, setFrom] = useState<SelectedLocation | null>(null);
  const [to, setTo] = useState<SelectedLocation | null>(null);
  const [preferences, setPreferences] = useState<Set<RoutePreference>>(new Set());
  const [stopCount, setStopCount] = useState(6);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SuggestedStop[]>([]);
  const [resultFrom, setResultFrom] = useState<SelectedLocation | null>(null);
  const [resultTo, setResultTo] = useState<SelectedLocation | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeStopId, setActiveStopId] = useState<string | null>(null);

  function togglePreference(p: RoutePreference) {
    setPreferences((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  function toggleStop(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const handleSuggest = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    setResult([]);
    setSelectedIds(new Set());

    try {
      const res = await fetch("/api/roadtrip/suggest-stops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: from.label,
          to: to.label,
          fromLat: from.lat,
          fromLng: from.lng,
          toLat: to.lat,
          toLng: to.lng,
          preferences: Array.from(preferences),
          count: stopCount,
        }),
      });

      const data = (await res.json()) as { stops?: SuggestedStop[]; error?: string };

      if (!res.ok || data.error) {
        setError(data.error ?? "Fehler beim Laden der Vorschläge.");
        return;
      }

      setResult(data.stops ?? []);
      setResultFrom(from);
      setResultTo(to);
      // Standardmäßig alle direkt-am-Weg Stopps vorauswählen
      const autoSelect = new Set(
        (data.stops ?? [])
          .filter((s) => s.detour === "none" || s.detour === "slight")
          .map((s) => s.id)
      );
      setSelectedIds(autoSelect);
    } catch {
      setError("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  }, [from, to, preferences, stopCount]);

  function handlePlanRoadtrip() {
    if (!resultFrom || !resultTo || selectedIds.size === 0) return;

    // Ausgewählte Stopps in Reihenfolge
    const orderedStops = result.filter((s) => selectedIds.has(s.id));

    // Als RoadtripRouteStop-ähnliche Objekte (cityLabel, lat, lng, nights)
    const stopsForPlanner = [
      // Start-Stadt als ersten Stop
      {
        citySlug: slugifyTitle(resultFrom.label.split(",")[0] ?? resultFrom.label),
        cityLabel: resultFrom.label.split(",")[0]?.trim() ?? resultFrom.label,
        lat: resultFrom.lat,
        lng: resultFrom.lng,
        nights: 0,
      },
      // Zwischenstopps
      ...orderedStops.map((s) => ({
        citySlug: slugifyTitle(s.name),
        cityLabel: s.name,
        lat: s.lat,
        lng: s.lng,
        nights: Math.max(1, Math.round(s.duration_min / (24 * 60))),
      })),
      // Ziel als letzten Stop
      {
        citySlug: slugifyTitle(resultTo.label.split(",")[0] ?? resultTo.label),
        cityLabel: resultTo.label.split(",")[0]?.trim() ?? resultTo.label,
        lat: resultTo.lat,
        lng: resultTo.lng,
        nights: 1,
      },
    ];

    // In sessionStorage speichern → /roadtrip liest es aus
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        "roadtrip_discover_stops",
        JSON.stringify({
          stops: stopsForPlanner,
          from: resultFrom.label,
          to: resultTo.label,
        })
      );
    }

    router.push("/roadtrip?fromDiscover=1");
  }

  const selectedCount = selectedIds.size;
  const canSuggest = !!from && !!to && !loading;
  const hasResults = result.length > 0 && resultFrom && resultTo;

  return (
    <main className="pd24-page-wide space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--line-subtle)] bg-white px-6 py-6 shadow-[var(--shadow-soft)]">
        <div className="pointer-events-none absolute right-[-4rem] top-[-4rem] h-56 w-56 rounded-full bg-[rgba(183,106,67,0.08)] blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-3rem] left-[20%] h-40 w-40 rounded-full bg-[rgba(90,118,136,0.08)] blur-3xl" />

        <div className="relative">
          {/* Breadcrumb */}
          <div className="mb-3 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <Link href="/roadtrip" className="transition hover:text-[var(--text-strong)]">Roadtrip</Link>
            <span>/</span>
            <span className="text-[var(--text-strong)]">Route entdecken</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-3xl">
            🗺️ Route entdecken
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-muted)]">
            Gib Start und Ziel ein — perfectday schlägt dir die schönsten Zwischenstopps vor.
            Seen, Aussichten, Burgen, Geheimtipps.
          </p>
        </div>
      </section>

      {/* ── Eingabe-Panel ─────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-[var(--line-subtle)] bg-white px-5 py-5 shadow-sm">
        <div className="space-y-4">
          {/* From / To */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <LocationInput
              placeholder="Startort eingeben…"
              value={from}
              onSelect={setFrom}
              icon="🟢"
            />
            <div className="flex shrink-0 items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 rotate-90 text-[var(--text-muted)] sm:rotate-0">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
            <LocationInput
              placeholder="Zielort eingeben…"
              value={to}
              onSelect={setTo}
              icon="🔴"
            />
          </div>

          {/* Präferenzen */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Was interessiert dich? (optional)
            </div>
            <div className="flex flex-wrap gap-2">
              {ROUTE_PREFERENCES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => togglePreference(p.value)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    preferences.has(p.value)
                      ? "border-amber-400 bg-amber-50 text-amber-800"
                      : "border-[var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:border-[rgba(23,23,23,0.2)] hover:bg-white hover:text-[var(--text-strong)]"
                  }`}
                >
                  {p.emoji} {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Anzahl Stopps + Button */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">Anzahl Stopps:</span>
              {[3, 5, 6, 8, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStopCount(n)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                    stopCount === n
                      ? "bg-[var(--text-strong)] text-white"
                      : "border border-[var(--line-subtle)] bg-white text-[var(--text-muted)] hover:bg-[var(--bg-surface)]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSuggest}
              disabled={!canSuggest}
              className={`ml-auto inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition active:scale-[0.97] ${
                canSuggest
                  ? "bg-amber-500 text-white shadow-sm hover:bg-amber-600"
                  : "cursor-not-allowed bg-[rgba(23,23,23,0.08)] text-[var(--text-muted)]"
              }`}
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  KI analysiert Route…
                </>
              ) : (
                <>
                  ✨ Stopps vorschlagen
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ── Fehler ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Ergebnisse ────────────────────────────────────────────────────── */}
      {hasResults && resultFrom && resultTo && (
        <>
          {/* Zusammenfassung */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm">
            <span className="text-[var(--text-muted)]">
              <strong className="text-[var(--text-strong)]">{result.length}</strong> Stopps vorgeschlagen zwischen{" "}
              <strong className="text-[var(--text-strong)]">{resultFrom.label.split(",")[0]}</strong>
              {" → "}
              <strong className="text-[var(--text-strong)]">{resultTo.label.split(",")[0]}</strong>
            </span>
            <span className="ml-auto text-xs text-[var(--text-muted)]">
              {selectedCount} ausgewählt
            </span>
          </div>

          {/* Zweispaltiges Layout: Karte + Stopps */}
          <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
            {/* Karte (sticky auf Desktop) */}
            <div className="order-2 lg:order-1">
              <div className="sticky top-4 overflow-hidden rounded-2xl border border-[var(--line-subtle)] shadow-sm" style={{ height: 520 }}>
                <DiscoverMap
                  fromLabel={resultFrom.label.split(",")[0] ?? resultFrom.label}
                  fromLat={resultFrom.lat}
                  fromLng={resultFrom.lng}
                  toLabel={resultTo.label.split(",")[0] ?? resultTo.label}
                  toLat={resultTo.lat}
                  toLng={resultTo.lng}
                  stops={result}
                  selectedIds={selectedIds}
                  activeStopId={activeStopId}
                  onStopClick={(id) => setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id); else next.add(id);
                    return next;
                  })}
                  className="h-full w-full"
                />
              </div>
            </div>

            {/* Stop-Karten (rechts / unten) */}
            <div className="order-1 space-y-3 lg:order-2">
              {result.map((stop, idx) => (
                <StopCard
                  key={stop.id}
                  stop={stop}
                  number={idx + 1}
                  selected={selectedIds.has(stop.id)}
                  active={stop.id === activeStopId}
                  onToggle={() => toggleStop(stop.id)}
                  onHover={setActiveStopId}
                />
              ))}
            </div>
          </div>

          {/* ── CTA: Roadtrip planen ──────────────────────────────────────── */}
          <section className={`sticky bottom-4 z-40 rounded-2xl border shadow-lg px-5 py-4 transition-all ${
            selectedCount > 0
              ? "border-amber-300 bg-amber-50"
              : "border-[var(--line-subtle)] bg-white"
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                {selectedCount > 0 ? (
                  <>
                    <div className="font-semibold text-amber-900">
                      {selectedCount} {selectedCount === 1 ? "Stopp" : "Stopps"} ausgewählt
                    </div>
                    <div className="mt-0.5 text-sm text-amber-700">
                      {resultFrom.label.split(",")[0]} →{" "}
                      {result
                        .filter((s) => selectedIds.has(s.id))
                        .map((s) => s.name)
                        .join(" → ")}{" "}
                      → {resultTo.label.split(",")[0]}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-[var(--text-muted)]">
                    Klicke auf Stopps um sie zur Route hinzuzufügen
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // Alle auswählen / abwählen
                    if (selectedCount === result.length) {
                      setSelectedIds(new Set());
                    } else {
                      setSelectedIds(new Set(result.map((s) => s.id)));
                    }
                  }}
                  className="rounded-xl border border-[var(--line-subtle)] bg-white px-3.5 py-2 text-xs font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)]"
                >
                  {selectedCount === result.length ? "Alle abwählen" : "Alle auswählen"}
                </button>

                <button
                  type="button"
                  onClick={handlePlanRoadtrip}
                  disabled={selectedCount === 0}
                  className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition active:scale-[0.97] ${
                    selectedCount > 0
                      ? "bg-amber-500 text-white shadow-sm hover:bg-amber-600"
                      : "cursor-not-allowed bg-[rgba(23,23,23,0.08)] text-[var(--text-muted)]"
                  }`}
                >
                  🚀 Roadtrip planen
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ── Empty state (noch keine Suche) ────────────────────────────────── */}
      {!loading && result.length === 0 && !error && (
        <div className="rounded-2xl border border-dashed border-[var(--line-subtle)] bg-white px-6 py-12 text-center">
          <div className="text-4xl">🗺️</div>
          <div className="mt-3 text-base font-semibold text-[var(--text-strong)]">
            Wohin geht die Reise?
          </div>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Gib Start und Ziel ein und klicke auf „Stopps vorschlagen" — die KI findet die besten
            Zwischenstopps für dich.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm text-[var(--text-muted)]">
            {["🌿 Seen & Natur", "🏰 Burgen", "👁️ Aussichten", "🍽️ Kulinarik"].map((t) => (
              <span key={t} className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Loading Skeleton ─────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: stopCount }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-[var(--line-subtle)] bg-white p-4">
              <div className="h-4 w-32 rounded bg-[var(--bg-panel)]" />
              <div className="mt-3 h-3 w-full rounded bg-[var(--bg-panel)]" />
              <div className="mt-2 h-3 w-4/5 rounded bg-[var(--bg-panel)]" />
              <div className="mt-4 h-3 w-1/3 rounded bg-[var(--bg-panel)]" />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
