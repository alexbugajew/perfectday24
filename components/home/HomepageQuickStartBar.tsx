"use client";

import { useEffect, useMemo, useState } from "react";
import { PD24Button } from "@/components/ui/pd24";
import {
  experienceOptionsForOccasion,
  occasionLabel,
  plannerDateLabel,
  todayDateInputValue,
} from "@/app/planner/helpers";
import { supabase } from "@/lib/supabaseClient";
import { dedupeCitiesByCanonicalSlug } from "@/lib/cities/canonical";
import {
  isPlannerSupportedCitySlug,
  plannerCitySupportsEventModes,
} from "@/lib/cities/planner-support";
import { PLANNER_VISIBLE_CITY_ROLLOUT } from "@/lib/cities/rollout";
import type { ExperienceMode } from "@/lib/planner";

type QuickStartOccasion = "date" | "friends" | "family" | "tourism" | "party";

type QuickStartCityOption = {
  label: string;
  value: string;
  population?: number | null;
};

type PlannerCityRow = {
  slug: string;
  name: string;
  population?: number | null;
  is_active?: boolean | null;
};

const FALLBACK_CITY_OPTIONS: QuickStartCityOption[] = [...PLANNER_VISIBLE_CITY_ROLLOUT]
  .sort((a, b) => a.label.localeCompare(b.label, "de-DE"))
  .map((city) => ({
    label: city.label,
    value: city.slug,
    population: null,
  }));

const DEFAULT_CITY_OPTION =
  FALLBACK_CITY_OPTIONS.find((city) => city.value === "berlin-berlin") ??
  FALLBACK_CITY_OPTIONS[0] ?? {
    label: "Berlin",
    value: "berlin-berlin",
    population: null,
  };

const OCCASION_OPTIONS: QuickStartOccasion[] = [
  "date",
  "friends",
  "family",
  "tourism",
  "party",
];

const INTEREST_PRESETS: Record<QuickStartOccasion, Record<ExperienceMode, string[]>> = {
  date: {
    classic: ["Wine Bars", "Fine Dining"],
    show: ["Live Musik", "Cocktails"],
    event_visit: ["Live Musik", "Wine Bars"],
    market_festival: ["Food Markets", "Design"],
  },
  friends: {
    classic: ["Street Food", "Craft Beer"],
    show: ["Comedy", "Nightlife"],
    event_visit: ["Live Musik", "Street Food"],
    market_festival: ["Street Food", "Games"],
  },
  family: {
    classic: ["Museen", "Kaffee"],
    show: ["Aussicht", "Museen"],
    event_visit: ["Museen", "Food Markets"],
    market_festival: ["Food Markets", "Aussicht"],
  },
  tourism: {
    classic: ["Architektur", "Kaffee"],
    show: ["Museen", "Aussicht"],
    event_visit: ["Museen", "Design"],
    market_festival: ["Food Markets", "Architektur"],
  },
  party: {
    classic: ["Nightlife", "Cocktails"],
    show: ["Live Musik", "Nightlife"],
    event_visit: ["Live Musik", "Craft Beer"],
    market_festival: ["Street Food", "Nightlife"],
  },
};

function buildPlannerHref(args: {
  citySlug: string;
  occasion: QuickStartOccasion;
  experienceMode: ExperienceMode;
  planDate: string;
}) {
  const { citySlug, occasion, experienceMode, planDate } = args;
  const params = new URLSearchParams();
  params.set("citySlug", citySlug);
  params.set("occasion", occasion);
  params.set("experienceMode", experienceMode);
  params.set("budget", "medium");
  params.set("planDate", planDate);

  const interests = INTEREST_PRESETS[occasion][experienceMode];
  if (interests.length > 0) {
    params.set("interests", interests.join(","));
  }

  return `/planner?${params.toString()}`;
}

export default function HomepageQuickStartBar() {
  const [cityOptions, setCityOptions] = useState<QuickStartCityOption[]>(FALLBACK_CITY_OPTIONS);
  const [selectedCitySlug, setSelectedCitySlug] = useState<string>(DEFAULT_CITY_OPTION.value);
  const [cityQuery, setCityQuery] = useState<string>(DEFAULT_CITY_OPTION.label);
  const [selectedOccasion, setSelectedOccasion] = useState<QuickStartOccasion>("date");
  const [selectedMode, setSelectedMode] = useState<ExperienceMode>("event_visit");
  const [selectedDate, setSelectedDate] = useState<string>(todayDateInputValue());

  useEffect(() => {
    let cancelled = false;

    async function loadCityOptions() {
      const { data, error } = await supabase
        .from("cities")
        .select("slug,name,population,is_active")
        .eq("is_active", true)
        .order("population", { ascending: false })
        .limit(500);

      if (cancelled || error) return;

      const nextOptions = dedupeCitiesByCanonicalSlug((data as PlannerCityRow[]) ?? [])
        .filter((city) => isPlannerSupportedCitySlug(city.slug))
        .sort((a, b) => {
          const populationDiff = (b.population ?? 0) - (a.population ?? 0);
          if (populationDiff !== 0) return populationDiff;
          return a.name.localeCompare(b.name, "de-DE");
        })
        .map((city) => ({
          label: city.name,
          value: city.slug,
          population: city.population ?? null,
        }));

      if (nextOptions.length === 0) return;

      setCityOptions(nextOptions);
      setSelectedCitySlug((current) =>
        nextOptions.some((city) => city.value === current) ? current : nextOptions[0].value
      );
      setCityQuery((current) => {
        const trimmed = current.trim();
        if (trimmed.length > 0) return current;
        return nextOptions[0].label;
      });
    }

    void loadCityOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  const modeOptions = useMemo(
    () => {
      const baseOptions = experienceOptionsForOccasion(selectedOccasion);
      if (plannerCitySupportsEventModes(selectedCitySlug)) return baseOptions;
      return baseOptions.filter(
        (option) => option.value !== "event_visit" && option.value !== "market_festival"
      );
    },
    [selectedCitySlug, selectedOccasion]
  );

  const filteredCityOptions = useMemo(() => {
    const query = cityQuery.trim().toLowerCase();
    if (!query) return cityOptions;
    return cityOptions.filter((city) =>
      city.label.toLowerCase().includes(query) || city.value.toLowerCase().includes(query)
    );
  }, [cityOptions, cityQuery]);

  const resolvedSelectedMode = useMemo(() => {
    if (modeOptions.some((option) => option.value === selectedMode)) return selectedMode;
    return modeOptions[0]?.value ?? "classic";
  }, [modeOptions, selectedMode]);

  const plannerHref = useMemo(
    () =>
      buildPlannerHref({
        citySlug: selectedCitySlug,
        occasion: selectedOccasion,
        experienceMode: resolvedSelectedMode,
        planDate: selectedDate,
      }),
    [resolvedSelectedMode, selectedCitySlug, selectedDate, selectedOccasion]
  );

  const eventMode = useMemo<ExperienceMode>(() => {
    if (resolvedSelectedMode !== "classic") return resolvedSelectedMode;
    return (
      modeOptions.find((option) => option.value !== "classic")?.value ??
      resolvedSelectedMode
    );
  }, [modeOptions, resolvedSelectedMode]);

  const plannerEventHref = useMemo(
    () =>
      buildPlannerHref({
        citySlug: selectedCitySlug,
        occasion: selectedOccasion,
        experienceMode: eventMode,
        planDate: selectedDate,
      }),
    [eventMode, selectedCitySlug, selectedDate, selectedOccasion]
  );
  const selectedCitySupportsEventModes = useMemo(
    () => plannerCitySupportsEventModes(selectedCitySlug),
    [selectedCitySlug]
  );

  const selectedCityLabel =
    cityOptions.find((city) => city.value === selectedCitySlug)?.label ?? "Berlin";
  const selectedDateLabel = plannerDateLabel(selectedDate);
  const selectedModeLabel =
    modeOptions.find((option) => option.value === resolvedSelectedMode)?.label ?? "Klassisch";

  const selectClassName =
    "mt-3 w-full rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-white px-4 py-3 text-sm text-[var(--text-strong)] outline-none transition focus:border-[rgba(23,23,23,0.22)] focus:ring-2 focus:ring-[rgba(183,106,67,0.14)]";
  const inputClassName =
    "mt-3 w-full rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-white px-4 py-3 text-sm text-[var(--text-strong)] outline-none transition placeholder:text-[var(--text-soft-warm)] focus:border-[rgba(23,23,23,0.22)] focus:ring-2 focus:ring-[rgba(183,106,67,0.14)]";

  return (
    <section className="rounded-[30px] border border-[var(--line-subtle)] bg-[rgba(255,253,248,0.86)] px-5 py-5 shadow-[0_18px_44px_rgba(49,39,27,0.08)] sm:px-7 sm:py-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="pd24-meta">
            Schnell starten
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-strong)]">
            Starte mit 4 Angaben in deinen ersten Plan.
          </h2>
          <p className="mt-3 text-base leading-7 text-[var(--text-muted-warm)]">
            Waehle Stadt, Anlass, Fokus und Datum. Der Planner uebernimmt den Rahmen direkt und
            erzeugt daraus den ersten belastbaren Vorschlag.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <PD24Button href={plannerHref}>Plan erstellen</PD24Button>
          {selectedCitySupportsEventModes ? (
            <PD24Button href={plannerEventHref} variant="secondary">
              Event-Plan erstellen
            </PD24Button>
          ) : (
            <PD24Button variant="secondary" disabled>
              Events folgen bald
            </PD24Button>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-4">
        <div className="rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-white/88 px-4 py-4">
          <div className="pd24-meta">
            Stadt
          </div>
          <div className="mt-2 text-lg font-medium text-[var(--text-strong)]">{selectedCityLabel}</div>
          <input
            aria-label="Stadt suchen"
            value={cityQuery}
            onChange={(e) => setCityQuery(e.target.value)}
            placeholder="Stadt eingeben"
            className={inputClassName}
          />
          <select
            aria-label="Stadt auswählen"
            value={
              filteredCityOptions.some((city) => city.value === selectedCitySlug)
                ? selectedCitySlug
                : ""
            }
            onChange={(e) => {
              const nextSlug = e.target.value;
              if (!nextSlug) return;
              setSelectedCitySlug(nextSlug);
              const nextCity = cityOptions.find((city) => city.value === nextSlug);
              if (nextCity) {
                setCityQuery(nextCity.label);
              }
            }}
            className={selectClassName}
          >
            {filteredCityOptions.length === 0 ? (
              <option value="">Keine passende Stadt gefunden</option>
            ) : null}
            {!filteredCityOptions.some((city) => city.value === selectedCitySlug) &&
            filteredCityOptions.length > 0 ? (
              <option value="">Stadt auswählen</option>
            ) : null}
            {filteredCityOptions.map((city) => (
              <option key={city.value} value={city.value}>
                {city.label}
                {typeof city.population === "number"
                  ? ` | ${city.population.toLocaleString("de-DE")}`
                  : ""}
              </option>
            ))}
          </select>
          <div className="mt-2 text-xs text-[var(--text-soft-warm)]">
            {filteredCityOptions.length} von {cityOptions.length} Staedten sichtbar
          </div>
          {!selectedCitySupportsEventModes ? (
            <div className="mt-2 text-xs text-[var(--text-soft-warm)]">
              Fuer diese Stadt ist Event- und Marktplanung noch nicht voll aktiviert.
            </div>
          ) : null}
        </div>

        <div className="rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-white/88 px-4 py-4">
          <div className="pd24-meta">
            Anlass
          </div>
          <div className="mt-2 text-lg font-medium text-[var(--text-strong)]">
            {occasionLabel(selectedOccasion)}
          </div>
          <select
            aria-label="Anlass auswählen"
            value={selectedOccasion}
            onChange={(e) => setSelectedOccasion(e.target.value as QuickStartOccasion)}
            className={selectClassName}
          >
            {OCCASION_OPTIONS.map((occasion) => (
              <option key={occasion} value={occasion}>
                {occasionLabel(occasion)}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-white/88 px-4 py-4">
          <div className="pd24-meta">
            Fokus
          </div>
          <div className="mt-2 text-lg font-medium text-[var(--text-strong)]">{selectedModeLabel}</div>
          <select
            aria-label="Fokus auswählen"
            value={resolvedSelectedMode}
            onChange={(e) => setSelectedMode(e.target.value as ExperienceMode)}
            className={selectClassName}
          >
            {modeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-white/88 px-4 py-4">
          <div className="pd24-meta">
            Datum
          </div>
          <div className="mt-2 text-lg font-medium text-[var(--text-strong)]">{selectedDateLabel}</div>
          <input
            aria-label="Datum auswählen"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={todayDateInputValue()}
            className={inputClassName}
          />
        </div>
      </div>
    </section>
  );
}
