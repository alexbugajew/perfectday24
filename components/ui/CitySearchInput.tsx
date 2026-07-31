"use client";

import { useState, useRef, useEffect, useId } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type City = { slug: string; name: string };

// Umlaut-tolerante Suche: „Gießen" findet „Giessen" und umgekehrt,
// „Munchen" findet „München". Beide Seiten werden auf dieselbe Form gebracht.
function normalizeCitySearchText(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replaceAll("ä", "a")
    .replaceAll("ö", "o")
    .replaceAll("ü", "u")
    .replaceAll("ß", "ss")
    .replaceAll("ae", "a")
    .replaceAll("oe", "o")
    .replaceAll("ue", "u")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

type SharedProps = {
  cities: City[];
  placeholder?: string;
  /** "bare" rendert nur Input + Dropdown ohne eigenen Rahmen — für kompakte Leisten. */
  variant?: "default" | "bare";
  /** Chip mit der gewählten Stadt unter dem Input anzeigen (default: true). */
  showSelectedChip?: boolean;
};

type SingleProps = SharedProps & {
  multi?: false;
  value: string;
  onChange: (value: string) => void;
};

type MultiProps = SharedProps & {
  multi: true;
  value: string[];
  onChange: (value: string[]) => void;
};

export type CitySearchInputProps = SingleProps | MultiProps;

// ─── Component ────────────────────────────────────────────────────────────────

export function CitySearchInput(props: CitySearchInputProps) {
  const {
    cities,
    placeholder = "Stadt suchen …",
    multi,
    variant = "default",
    showSelectedChip = true,
  } = props;
  const bare = variant === "bare";

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

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
          normalizeCitySearchText(c.name).includes(normalizeCitySearchText(query))
        );

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
        className={
          bare
            ? "flex items-center gap-2"
            : `flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 transition ${
                open
                  ? "border-[var(--text-strong)]"
                  : "border-[var(--line-subtle)] focus-within:border-[var(--text-strong)]"
              }`
        }
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
          role="combobox"
          aria-label={placeholder}
          aria-autocomplete="list"
          aria-expanded={open && filtered.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={
            open && filtered[activeIndex] ? optionId(activeIndex) : undefined
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => {
            if (query.trim()) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={inputPlaceholder}
          className={`min-h-9 min-w-0 flex-1 bg-transparent text-sm text-[var(--text-strong)] focus:outline-none ${
            bare && singleSelected
              ? "font-semibold placeholder:text-[var(--text-strong)]"
              : "placeholder:text-[var(--text-muted)]"
          }`}
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
            className="-my-3 -mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg leading-none text-[var(--text-muted)] transition hover:text-[var(--text-strong)]"
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
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-[var(--line-subtle)] bg-white py-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.10)]"
        >
          {filtered.map((city, i) => {
            const isSelected = selectedSlugs.includes(city.slug);
            return (
              <button
                key={city.slug}
                id={optionId(i)}
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
      {multi && showSelectedChip && selectedCities.length > 0 && (
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
                className="-my-2 -mr-2 ml-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm leading-none text-[var(--text-muted)] transition hover:text-[var(--text-strong)]"
                aria-label={`${city.name} entfernen`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Single-select chip */}
      {!multi && showSelectedChip && singleSelected && (
        <div className="mt-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--text-strong)] bg-[var(--text-strong)] px-3 py-1 text-xs text-white">
            <span>✓</span>
            {singleSelected.name}
            <button
              type="button"
              onClick={() => props.onChange("")}
              className="-my-2 -mr-2 ml-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm leading-none text-white/60 transition hover:text-white"
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
