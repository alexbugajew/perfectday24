"use client";

import { useState, useRef, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type City = { slug: string; name: string };

type SingleProps = {
  cities: City[];
  placeholder?: string;
  multi?: false;
  value: string;
  onChange: (value: string) => void;
};

type MultiProps = {
  cities: City[];
  placeholder?: string;
  multi: true;
  value: string[];
  onChange: (value: string[]) => void;
};

export type CitySearchInputProps = SingleProps | MultiProps;

// ─── Component ────────────────────────────────────────────────────────────────

export function CitySearchInput(props: CitySearchInputProps) {
  const { cities, placeholder = "Stadt suchen …", multi } = props;

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedSlugs: string[] = multi
    ? (props.value as string[])
    : (props.value as string) ? [(props.value as string)] : [];

  const filtered =
    query.trim().length === 0
      ? []
      : cities.filter((c) =>
          c.name.toLowerCase().includes(query.toLowerCase().trim())
        );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Close on click outside
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current || !open) return;
    const active = listRef.current.children[activeIndex] as HTMLElement | undefined;
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function select(city: City) {
    if (multi) {
      const current = props.value as string[];
      props.onChange(
        current.includes(city.slug)
          ? current.filter((s) => s !== city.slug)
          : [...current, city.slug]
      );
      inputRef.current?.focus();
    } else {
      props.onChange(city.slug);
      setOpen(false);
      setQuery("");
    }
  }

  function deselect(slug: string) {
    if (multi) {
      props.onChange((props.value as string[]).filter((s) => s !== slug));
    } else {
      props.onChange("");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered[activeIndex]) select(filtered[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  const selectedCities = selectedSlugs
    .map((slug) => cities.find((c) => c.slug === slug))
    .filter((c): c is City => Boolean(c));

  const singleSelected =
    !multi && (props.value as string)
      ? cities.find((c) => c.slug === (props.value as string))
      : null;

  // Placeholder text: show selected city name for single mode
  const inputPlaceholder =
    !multi && singleSelected ? singleSelected.name : placeholder;

  return (
    <div ref={containerRef} className="relative">
      {/* ── Input row ────────────────────────────────────────────────────── */}
      <div
        className={`flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 transition ${
          open
            ? "border-[var(--text-strong)]"
            : "border-[var(--line-subtle)] focus-within:border-[var(--text-strong)]"
        }`}
      >
        {/* Search icon */}
        <svg
          className="h-4 w-4 shrink-0 text-[var(--text-muted)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (query.trim()) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={inputPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:outline-none"
        />

        {/* Clear button for single-select */}
        {!multi && (props.value as string) && (
          <button
            type="button"
            onClick={() => {
              props.onChange("");
              setQuery("");
              inputRef.current?.focus();
            }}
            className="shrink-0 text-lg leading-none text-[var(--text-muted)] transition hover:text-[var(--text-strong)]"
            aria-label="Auswahl entfernen"
          >
            ×
          </button>
        )}
      </div>

      {/* ── Dropdown ─────────────────────────────────────────────────────── */}
      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-[var(--line-subtle)] bg-white py-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.10)]"
        >
          {filtered.map((city, i) => {
            const isSelected = selectedSlugs.includes(city.slug);
            return (
              <button
                key={city.slug}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => select(city)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
                  i === activeIndex
                    ? "bg-[var(--bg-surface)]"
                    : "hover:bg-[var(--bg-surface)]"
                }`}
              >
                <span className="flex-1 text-[var(--text-strong)]">{city.name}</span>
                {isSelected && (
                  <span className="shrink-0 text-[var(--brand-accent)]">✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {open && query.trim().length > 0 && filtered.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3 text-sm text-[var(--text-muted)] shadow-[0_8px_24px_rgba(15,23,42,0.10)]">
          Keine Stadt gefunden
        </div>
      )}

      {/* ── Selected chips ────────────────────────────────────────────────── */}
      {multi && selectedCities.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedCities.map((city) => (
            <span
              key={city.slug}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs text-[var(--text-strong)]"
            >
              <span className="text-[var(--brand-accent)]">✓</span>
              {city.name}
              <button
                type="button"
                onClick={() => deselect(city.slug)}
                className="ml-0.5 text-[var(--text-muted)] transition hover:text-[var(--text-strong)]"
                aria-label={`${city.name} entfernen`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Single-select chip */}
      {!multi && singleSelected && (
        <div className="mt-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--text-strong)] bg-[var(--text-strong)] px-3 py-1 text-xs text-white">
            <span>✓</span>
            {singleSelected.name}
            <button
              type="button"
              onClick={() => props.onChange("")}
              className="ml-0.5 text-white/60 transition hover:text-white"
              aria-label={`${singleSelected.name} entfernen`}
            >
              ×
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
