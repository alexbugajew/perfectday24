"use client";

// components/roadtrip/HotelAutocomplete.tsx
// Unterkunfts-Suche per Nominatim (OpenStreetMap) — kostenlos, kein API-Key.
// Gibt lat/lng der gewählten Unterkunft zurück, damit der Tagesplan vom Hotel startet.

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
};

export type HotelSelection = {
  name: string;
  lat: number;
  lng: number;
};

type Props = {
  cityLabel: string;
  cityLat: number;
  cityLng: number;
  value: HotelSelection | null;
  onChange: (value: HotelSelection | null) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function HotelAutocomplete({
  cityLabel,
  cityLat,
  cityLng,
  value,
  onChange,
}: Props) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync query wenn value von außen gesetzt wird (z. B. nach Template-Load)
  useEffect(() => {
    setQuery(value?.name ?? "");
  }, [value?.name]);

  // Dropdown bei Klick außerhalb schließen
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleInput(q: string) {
    setQuery(q);

    // Leeren → Hotel-Auswahl zurücksetzen
    if (!q.trim()) {
      setResults([]);
      setShowDropdown(false);
      if (value) onChange(null);
      return;
    }

    // Debounce: 400 ms (Nominatim Rate-Limit: 1 req/s)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const delta = 0.6; // ~66 km Bounding-Box um die Stadt
        const viewbox = `${cityLng - delta},${cityLat + delta},${cityLng + delta},${cityLat - delta}`;

        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("q", q);
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("limit", "7");
        url.searchParams.set("addressdetails", "0");
        url.searchParams.set("viewbox", viewbox);
        url.searchParams.set("bounded", "0"); // Ergebnisse außerhalb der Box erlauben

        const res = await fetch(url.toString(), {
          headers: {
            // Nominatim Nutzungsbedingungen: User-Agent mit App-Name + Kontakt
            "User-Agent": "perfectday24.de/1.0 (hallo@perfectday24.de)",
          },
        });

        if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
        const data = (await res.json()) as NominatimResult[];
        setResults(data);
        setShowDropdown(data.length > 0);
      } catch {
        setResults([]);
        setShowDropdown(false);
      } finally {
        setLoading(false);
      }
    }, 420);
  }

  function select(result: NominatimResult) {
    // Kurzen Anzeigenamen ableiten: "Name, Straße" (max. 2 Teile)
    const parts = result.display_name.split(",").map((p) => p.trim());
    const shortName = parts.slice(0, 2).join(", ");

    const selection: HotelSelection = {
      name: shortName,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    };

    setQuery(shortName);
    onChange(selection);
    setShowDropdown(false);
    setResults([]);
  }

  function clear() {
    setQuery("");
    onChange(null);
    setResults([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  }

  const isSelected = !!value;

  return (
    <div ref={containerRef} className="relative">
      {/* ── Input ────────────────────────────────────────────────────────── */}
      <div
        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition ${
          isSelected
            ? "border-[rgba(183,106,67,0.3)] bg-[rgba(183,106,67,0.06)]"
            : "border-[var(--line-subtle)] bg-white focus-within:border-[rgba(23,23,23,0.22)] focus-within:bg-white"
        }`}
      >
        {/* Haus-Icon */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-[var(--brand-warm-deep)]" : "text-[var(--text-muted)]"}`}
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>

        <input
          ref={inputRef}
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setShowDropdown(true);
          }}
          placeholder={`Unterkunft in ${cityLabel} suchen…`}
          className="flex-1 min-w-0 bg-transparent text-xs font-medium text-[var(--text-strong)] outline-none placeholder:font-normal placeholder:text-[var(--text-muted)]"
        />

        {/* Lade-Spinner */}
        {loading && (
          <svg
            className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--text-muted)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        )}

        {/* Clear-Button */}
        {(query || isSelected) && !loading && (
          <button
            type="button"
            onClick={clear}
            className="shrink-0 text-[var(--text-muted)] transition hover:text-[var(--state-error)]"
            title="Unterkunft entfernen"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-3.5 w-3.5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Feedback-Zeile ────────────────────────────────────────────────── */}
      {isSelected && (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-[var(--brand-warm-deep)]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-3 w-3 shrink-0"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Tagesplan startet vom Hotel
        </p>
      )}

      {/* ── Ergebnis-Dropdown ─────────────────────────────────────────────── */}
      {showDropdown && results.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.3rem)] z-40 max-h-60 overflow-y-auto overscroll-contain rounded-xl border border-[var(--line-subtle)] bg-white shadow-lg">
          {results.map((r) => {
            const parts = r.display_name.split(",").map((p) => p.trim());
            const name = parts[0];
            const address = parts.slice(1, 3).join(", ");
            return (
              <button
                key={r.place_id}
                type="button"
                onClick={() => select(r)}
                className="flex w-full flex-col items-start gap-0.5 border-b border-[var(--line-subtle)] px-3 py-2.5 text-left transition last:border-b-0 hover:bg-[var(--bg-surface)]"
              >
                <span className="text-xs font-medium text-[var(--text-strong)] leading-snug">
                  {name}
                </span>
                {address && (
                  <span className="text-[11px] text-[var(--text-muted)] leading-snug">
                    {address}
                  </span>
                )}
              </button>
            );
          })}
          {/* Pflicht-Attribution Nominatim */}
          <div className="border-t border-[var(--line-subtle)] px-3 py-1.5 text-right">
            <span className="text-[10px] text-[var(--text-muted)]">
              © OpenStreetMap-Mitwirkende
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
