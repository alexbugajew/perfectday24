"use client";

// app/roadtrip/discover/page.tsx
// "Route entdecken" — KI schlägt Zwischenstopps vor (ähnlich Roadtrippers).

import Image from "next/image";
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
import type { RoadtripRoute } from "@/lib/roadtrip/types";
import { fetchPublicRoadtripRoutes } from "@/lib/roadtrip/client";
import { getRoadtripCoverArt } from "@/lib/roadtrip/cover-art";
import { getRoadtripEditorial } from "@/lib/roadtrip/editorial";

// Leaflet braucht dynamischen Import (kein SSR)
const DiscoverMap = dynamic(
  () => import("@/components/roadtrip/DiscoverMap"),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">Karte wird geladen…</div> }
) as React.ComponentType<DiscoverMapProps>;

// ── Inspirations-Routen ───────────────────────────────────────────────────────

type InspirationRoute = {
  image: string;
  name: string;
  from: string;
  to: string;
  fromCoords: { lat: number; lng: number };
  toCoords: { lat: number; lng: number };
  tags: string[];
  emoji: string;
};

const INSPIRATION_ROUTES: InspirationRoute[] = [
  {
    image: "/roadtrip/route-romantische-strasse.png",
    name: "Romantische Straße",
    from: "Würzburg",
    to: "Füssen",
    fromCoords: { lat: 49.7988, lng: 9.9361 },
    toCoords: { lat: 47.5710, lng: 10.7017 },
    tags: ["Mittelalter", "Fachwerk", "Kultur"],
    emoji: "🏰",
  },
  {
    image: "/roadtrip/route-mosel.png",
    name: "Mosel & Rhein",
    from: "Koblenz",
    to: "Trier",
    fromCoords: { lat: 50.3569, lng: 7.5890 },
    toCoords: { lat: 49.7499, lng: 6.6371 },
    tags: ["Burgen", "Weinberge", "Fluss"],
    emoji: "🍷",
  },
  {
    image: "/roadtrip/route-schwarzwald.png",
    name: "Schwarzwald",
    from: "Baden-Baden",
    to: "Freiburg im Breisgau",
    fromCoords: { lat: 48.7644, lng: 8.2467 },
    toCoords: { lat: 47.9990, lng: 7.8421 },
    tags: ["Wälder", "Natur", "Wandern"],
    emoji: "🌲",
  },
  {
    image: "/roadtrip/route-alpen.png",
    name: "Deutsche Alpenstraße",
    from: "Lindau",
    to: "Berchtesgaden",
    fromCoords: { lat: 47.5459, lng: 9.6826 },
    toCoords: { lat: 47.6340, lng: 13.0028 },
    tags: ["Alpen", "Seen", "Panorama"],
    emoji: "⛰️",
  },
];

// ── Kategorie-Farben für Stop-Karten ──────────────────────────────────────────

const CATEGORY_GRADIENT: Record<string, string> = {
  nature:    "from-emerald-500 to-green-600",
  lake:      "from-blue-400 to-cyan-600",
  viewpoint: "from-orange-400 to-amber-500",
  culture:   "from-violet-500 to-purple-600",
  castle:    "from-stone-500 to-gray-600",
  food:      "from-red-400 to-rose-500",
  town:      "from-yellow-400 to-amber-500",
  adventure: "from-lime-500 to-green-600",
  beach:     "from-sky-400 to-blue-500",
  market:    "from-pink-400 to-rose-500",
};

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

  useEffect(() => {
    if (value) setQuery(value.label);
  }, [value]);

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
      <div className="flex items-center gap-2 rounded-xl border border-white/40 bg-white/90 px-3 py-2.5 backdrop-blur-sm transition focus-within:border-white focus-within:ring-2 focus-within:ring-white/30">
        <span className="text-base">{icon}</span>
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-500"
        />
        {loading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-500" />
        )}
        {value && (
          <button
            type="button"
            onClick={() => { setQuery(""); onSelect(null); setSuggestions([]); setOpen(false); }}
            className="text-gray-400 hover:text-gray-700"
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
  const gradientClass = CATEGORY_GRADIENT[stop.category] ?? "from-amber-400 to-orange-500";

  return (
    <div
      onMouseEnter={() => onHover(stop.id)}
      onMouseLeave={() => onHover(null)}
      className={`relative overflow-hidden rounded-2xl border transition-all cursor-pointer ${
        active
          ? "border-amber-300 shadow-md"
          : selected
          ? "border-emerald-300 shadow-sm"
          : "border-[var(--line-subtle)] bg-white hover:border-[rgba(23,23,23,0.2)] hover:shadow-sm"
      }`}
      onClick={onToggle}
    >
      {/* Kategorie-Bild-Banner */}
      <div className={`relative flex h-20 items-center justify-center bg-gradient-to-r ${gradientClass}`}>
        <span className="text-4xl drop-shadow-sm">{stop.emoji}</span>

        {/* Nummer-Badge */}
        <div className="absolute left-3 top-3">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow ${
            selected ? "bg-emerald-500" : "bg-white/30 backdrop-blur-sm"
          }`}>
            {number}
          </div>
        </div>

        {/* Ausgewählt-Badge */}
        {selected && (
          <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white text-xs shadow">
            ✓
          </div>
        )}

        {/* Detour + Dauer rechts unten */}
        <div className="absolute bottom-2 right-2 flex gap-1">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium bg-white/90 ${DETOUR_COLORS[stop.detour]}`}>
            {DETOUR_LABELS[stop.detour]}
          </span>
          <span className="rounded-full bg-white/90 border border-[var(--line-subtle)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
            ⏱ {durationLabel(stop.duration_min)}
          </span>
        </div>
      </div>

      {/* Text-Bereich */}
      <div className={`p-4 ${selected ? "bg-emerald-50/40" : active ? "bg-amber-50/60" : "bg-white"}`}>
        <div className="font-semibold text-[var(--text-strong)]">{stop.name}</div>
        <p className="mt-1.5 text-sm leading-5 text-[var(--text-muted)]">{stop.description}</p>
        <div className="mt-2 flex items-start gap-1.5">
          <span className="mt-0.5 shrink-0 text-amber-500">★</span>
          <p className="text-xs font-medium text-[var(--text-strong)]">{stop.why_visit}</p>
        </div>
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

  // ── DB-getriebene Inspirations-Routen ────────────────────────────────────
  const [dbRoutes, setDbRoutes] = useState<RoadtripRoute[]>([]);
  const [dbRoutesLoading, setDbRoutesLoading] = useState(true);

  useEffect(() => {
    fetchPublicRoadtripRoutes(8)
      .then((rows) => setDbRoutes(rows.filter((r) => r.stops.length >= 2)))
      .catch(() => setDbRoutes([]))
      .finally(() => setDbRoutesLoading(false));
  }, []);

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

  function handleInspirationClick(route: InspirationRoute) {
    setFrom({ label: route.from, ...route.fromCoords });
    setTo({ label: route.to, ...route.toCoords });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleDbRouteClick(route: RoadtripRoute) {
    const first = route.stops[0];
    const last  = route.stops[route.stops.length - 1];
    if (!first || !last) return;
    setFrom({ label: first.cityLabel, lat: first.lat, lng: first.lng });
    setTo({   label: last.cityLabel,  lat: last.lat,  lng: last.lng  });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Occasion → Emoji mapping for DB routes
  const OCCASION_EMOJI: Record<string, string> = {
    friends: "👫", family: "👨‍👩‍👧", date: "🥂", tourism: "🗺️", party: "🎉",
  };

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

    const orderedStops = result.filter((s) => selectedIds.has(s.id));

    const stopsForPlanner = [
      {
        citySlug: slugifyTitle(resultFrom.label.split(",")[0] ?? resultFrom.label),
        cityLabel: resultFrom.label.split(",")[0]?.trim() ?? resultFrom.label,
        lat: resultFrom.lat,
        lng: resultFrom.lng,
        nights: 0,
      },
      ...orderedStops.map((s) => ({
        citySlug: slugifyTitle(s.name),
        cityLabel: s.name,
        lat: s.lat,
        lng: s.lng,
        nights: Math.max(1, Math.round(s.duration_min / (24 * 60))),
      })),
      {
        citySlug: slugifyTitle(resultTo.label.split(",")[0] ?? resultTo.label),
        cityLabel: resultTo.label.split(",")[0]?.trim() ?? resultTo.label,
        lat: resultTo.lat,
        lng: resultTo.lng,
        nights: 1,
      },
    ];

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

      {/* ── Hero mit Hintergrundfoto ───────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl shadow-lg" style={{ minHeight: 280 }}>
        <Image
          src="/roadtrip/hero-discover.png"
          alt="Roadtrip auf der Autobahn im Sonnenuntergang"
          fill
          priority
          className="object-cover object-center"
          sizes="(max-width: 768px) 100vw, 1200px"
        />
        {/* Gradient-Overlay: unten dunkel für Lesbarkeit */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10" />

        {/* Inhalt */}
        <div className="relative z-10 px-6 pb-8 pt-6">
          {/* Breadcrumb */}
          <div className="mb-4 flex items-center gap-1.5 text-xs text-white/70">
            <Link href="/roadtrip" className="transition hover:text-white">Roadtrip</Link>
            <span>/</span>
            <span className="text-white/90">Route entdecken</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-md sm:text-3xl">
            Dein Roadtrip, perfekt geplant ✨
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/85 drop-shadow-sm">
            KI findet die schönsten Zwischenstopps für deine Route —
            Seen, Panoramen, Burgen und Geheimtipps.
          </p>

          {/* Such-Formular direkt im Hero */}
          <div className="mt-5 space-y-3 max-w-2xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <LocationInput
                placeholder="Startort eingeben…"
                value={from}
                onSelect={setFrom}
                icon="🟢"
              />
              <div className="flex shrink-0 items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 rotate-90 text-white/60 sm:rotate-0">
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

            {/* Präferenzen + Button in einer Zeile */}
            <div className="flex flex-wrap items-center gap-2">
              {ROUTE_PREFERENCES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => togglePreference(p.value)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    preferences.has(p.value)
                      ? "border-amber-300 bg-amber-400/80 text-white backdrop-blur-sm"
                      : "border-white/30 bg-white/15 text-white/80 backdrop-blur-sm hover:bg-white/25 hover:text-white"
                  }`}
                >
                  {p.emoji} {p.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-white/70">Stopps:</span>
                {[3, 5, 6, 8, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setStopCount(n)}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                      stopCount === n
                        ? "bg-white text-gray-800"
                        : "border border-white/30 bg-white/15 text-white/80 hover:bg-white/25 backdrop-blur-sm"
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
                    ? "bg-amber-500 text-white shadow-md hover:bg-amber-400"
                    : "cursor-not-allowed bg-white/20 text-white/40 backdrop-blur-sm"
                }`}
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    KI analysiert Route…
                  </>
                ) : (
                  <>✨ Stopps vorschlagen</>
                )}
              </button>
            </div>
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
              <strong className="text-[var(--text-strong)]">{result.length}</strong> Stopps zwischen{" "}
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

            {/* Stop-Karten */}
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
                      {result.filter((s) => selectedIds.has(s.id)).map((s) => s.name).join(" → ")}{" "}
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

      {/* ── Empty State: Inspirations-Routen ──────────────────────────────── */}
      {!loading && result.length === 0 && !error && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              {dbRoutes.length > 0 ? "Community-Routen als Inspiration" : "Beliebte Routen als Inspiration"}
            </h2>
            <div className="h-px flex-1 bg-[var(--line-subtle)]" />
            {dbRoutes.length > 0 && (
              <a href="/roadtrip/routes" className="shrink-0 text-xs text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--text-strong)]">
                Alle ansehen
              </a>
            )}
          </div>

          {/* DB-Routen wenn vorhanden, sonst hardcodierte Fallbacks */}
          {dbRoutesLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl bg-[var(--bg-panel)]" style={{ height: 200 }} />
              ))}
            </div>
          ) : dbRoutes.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {dbRoutes.slice(0, 8).map((route) => {
                const first = route.stops[0];
                const last  = route.stops[route.stops.length - 1];
                const emoji = OCCASION_EMOJI[route.occasion] ?? "🗺️";
                const editorial = getRoadtripEditorial(route);
                const hasCover = Boolean(route.cover_image_url || editorial.coverImageUrl);
                const coverArt = getRoadtripCoverArt(route);
                return (
                  <button
                    key={route.id}
                    type="button"
                    onClick={() => handleDbRouteClick(route)}
                    className="group relative overflow-hidden rounded-2xl text-left shadow-sm transition hover:shadow-lg active:scale-[0.98]"
                    style={{ height: 200 }}
                  >
                    {hasCover ? (
                      <Image src={(route.cover_image_url ?? editorial.coverImageUrl)!} alt={editorial.coverImageAlt} fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
                    ) : (
                      <>
                        <div className="absolute inset-0" style={{ backgroundImage: coverArt.backgroundImage }} />
                        <div className="absolute inset-0 opacity-80" style={{ backgroundImage: coverArt.orbImage }} />
                        <div className="absolute -right-8 top-4 h-20 w-20 rounded-full bg-white/10 blur-2xl transition-transform duration-500 group-hover:scale-125" />
                        <div className="absolute -left-6 bottom-0 h-16 w-16 rounded-full bg-black/10 blur-2xl transition-transform duration-500 group-hover:scale-110" />
                        <div className="absolute left-3 top-3 rounded-full border border-white/20 bg-white/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
                          {coverArt.eyebrow}
                        </div>
                        <div
                          className="absolute right-3 top-3 rounded-2xl border border-white/16 bg-black/14 px-3 py-2 text-right text-white backdrop-blur-sm"
                          style={{ boxShadow: `0 12px 28px ${coverArt.accent}33` }}
                        >
                          <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/62">Vibe</div>
                          <div className="mt-0.5 text-lg font-semibold leading-none">{coverArt.icon}</div>
                        </div>
                      </>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <div className="text-base font-bold text-white drop-shadow">
                        {emoji} {route.title}
                      </div>
                      <div className="mt-1 text-[11px] leading-4 text-white/78 line-clamp-3">
                        {editorial.teaser}
                      </div>
                      {first && last && (
                        <div className="mt-0.5 text-xs text-white/80">
                          {first.cityLabel} {"->"} {last.cityLabel}
                        </div>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
                          {route.stops.length} Staedte / {route.total_nights} Naechte
                        </span>
                      </div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
                        Route starten ✨
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {INSPIRATION_ROUTES.map((route) => (
                <button
                  key={route.name}
                  type="button"
                  onClick={() => handleInspirationClick(route)}
                  className="group relative overflow-hidden rounded-2xl text-left shadow-sm transition hover:shadow-lg active:scale-[0.98]"
                  style={{ height: 200 }}
                >
                  <Image src={route.image} alt={route.name} fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <div className="text-base font-bold text-white drop-shadow">{route.emoji} {route.name}</div>
                    <div className="mt-0.5 text-xs text-white/80">{route.from} {"->"} {route.to}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {route.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white shadow-lg">Route starten ✨</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <p className="text-center text-xs text-[var(--text-muted)]">
            Klicke auf eine Route - oder gib oben deinen eigenen Start- und Zielort ein.
          </p>
        </div>
      )}

      {/* ── Loading Skeleton ─────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: stopCount }).map((_, i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-[var(--line-subtle)] bg-white">
              <div className="h-20 bg-gradient-to-r from-gray-200 to-gray-100" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-32 rounded bg-gray-200" />
                <div className="h-3 w-full rounded bg-gray-100" />
                <div className="h-3 w-4/5 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
