"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PD24Button,
  PD24SectionIntro,
  PD24SelectionControl,
  PD24StatusBadge,
} from "@/components/ui/pd24";
import {
  budgetLabel,
  experienceModeHint,
  experienceModeLabel,
  experienceOptionsForOccasion,
  occasionLabel,
} from "@/app/planner/helpers";
import type { ExperienceMode } from "@/lib/planner";

type PlannerEntryOccasion = "date" | "friends" | "tourism";
type PlannerEntryBudget = "low" | "medium" | "high";
type PlannerEntryField = "city" | "occasion" | "mode" | "budget" | "interests" | null;

type PlannerEntryCity = {
  slug: string;
  name: string;
  anchor: string;
  showScenario: {
    start: string;
    dinner: string;
    event: string;
    close: string;
  };
  eventVisitScenario: {
    start: string;
    event: string;
    close: string;
  };
  marketFestivalScenario: {
    event: string;
    food: string;
    explorer: string;
  };
  classicScenario: {
    start: string;
    explorer: string;
    close: string;
  };
};

type ScenarioStop = {
  time: string;
  title: string;
  note: string;
  transit: string;
  kind: string;
};

type ScenarioPreview = {
  label: string;
  badge: string;
  title: string;
  subtitle: string;
  reasoning: string;
  stops: ScenarioStop[];
  modeAccent: string;
};

const CITY_OPTIONS: PlannerEntryCity[] = [
  {
    slug: "berlin-berlin",
    name: "Berlin",
    anchor: "Alexanderplatz",
    showScenario: {
      start: "Dolcini",
      dinner: "Dolcini",
      event: "Naomi Jon - Strawberry Tour 2026",
      close: "Bar Saint Jean",
    },
    eventVisitScenario: {
      start: "The Pub",
      event: "Naomi Jon - Strawberry Tour 2026",
      close: "Bar Saint Jean",
    },
    marketFestivalScenario: {
      event: "Fruehlingsfest am Kurt-Schumacher-Damm",
      food: "Remi",
      explorer: "Synthesizer Museum BERLIN",
    },
    classicScenario: {
      start: "Ankunft in Mitte",
      explorer: "Spaziergang am Landwehrkanal",
      close: "Bar Saint Jean",
    },
  },
  {
    slug: "hamburg",
    name: "Hamburg",
    anchor: "Binnenalster",
    showScenario: {
      start: "Ugly Duckling",
      dinner: "Ugly Duckling",
      event: "MJ - Das Michael Jackson Musical",
      close: "Ciu' Die Bar",
    },
    eventVisitScenario: {
      start: "Ugly Duckling",
      event: "Abend in den Deichtorhallen",
      close: "Ciu' Die Bar",
    },
    marketFestivalScenario: {
      event: "Flohmarkt auf dem Grossneumarkt",
      food: "Havin Grill",
      explorer: "Hamburgische Staatsoper",
    },
    classicScenario: {
      start: "Start an der Binnenalster",
      explorer: "Blaue Stunde an den Landungsbruecken",
      close: "Ciu' Die Bar",
    },
  },
  {
    slug: "muenchen",
    name: "Muenchen",
    anchor: "Marienplatz",
    showScenario: {
      start: "Weisses Braeuhaus",
      dinner: "Weisses Braeuhaus",
      event: "DIRTY DANCING IN CONCERT",
      close: "Brown's Tea Bar",
    },
    eventVisitScenario: {
      start: "Bavaria Bowling",
      event: "Abend in der Kunsthalle",
      close: "Trachtenvogl Cafe-Lounge",
    },
    marketFestivalScenario: {
      event: "Fruehlingsfest in Muenchen",
      food: "Secret Garden Vegan Sushi",
      explorer: "Maximiliansplatz",
    },
    classicScenario: {
      start: "Start am Marienplatz",
      explorer: "Abendrunde ueber den Viktualienmarkt",
      close: "Trachtenvogl Cafe-Lounge",
    },
  },
  {
    slug: "koeln",
    name: "Koeln",
    anchor: "Koeln Altstadt / Dom",
    showScenario: {
      start: "Dinner am Rheinauhafen",
      dinner: "Dinner am Rheinauhafen",
      event: "Koelsch und Comedy",
      close: "Bar in der Suedstadt",
    },
    eventVisitScenario: {
      start: "Start am Koelner Dom",
      event: "Abend im Museum Ludwig",
      close: "Bar in der Suedstadt",
    },
    marketFestivalScenario: {
      event: "Wochenmarkt auf dem Auerbachplatz",
      food: "Lunch am Rheinauhafen",
      explorer: "Walk ueber die Hohenzollernbruecke",
    },
    classicScenario: {
      start: "Start am Koelner Dom",
      explorer: "Walk ueber die Hohenzollernbruecke",
      close: "Bar in der Suedstadt",
    },
  },
  {
    slug: "frankfurt-am-main",
    name: "Frankfurt am Main",
    anchor: "Roemerberg",
    showScenario: {
      start: "Dinner in Sachsenhausen",
      dinner: "Dinner in Sachsenhausen",
      event: "Cathedral tour with organ tour",
      close: "Rooftop Drink am Mainufer",
    },
    eventVisitScenario: {
      start: "Start am Roemerberg",
      event: "Abend an der Schirn",
      close: "Rooftop Drink am Mainufer",
    },
    marketFestivalScenario: {
      event: "Hoechst weekly market",
      food: "Lunch in Sachsenhausen",
      explorer: "Abendlicher Walk am Eisernen Steg",
    },
    classicScenario: {
      start: "Start am Roemerberg",
      explorer: "Abendlicher Walk am Eisernen Steg",
      close: "Rooftop Drink am Mainufer",
    },
  },
  {
    slug: "leipzig",
    name: "Leipzig",
    anchor: "Markt Leipzig",
    showScenario: {
      start: "Dinner in der Suedvorstadt",
      dinner: "Dinner in der Suedvorstadt",
      event: "Filmnacht mit Live-Programm",
      close: "Spaeter Drink in Plagwitz",
    },
    eventVisitScenario: {
      start: "Start am Markt Leipzig",
      event: "Abend im Kunstkraftwerk",
      close: "Spaeter Drink in Plagwitz",
    },
    marketFestivalScenario: {
      event: "3rd Borstel Day",
      food: "Lunch in der Innenstadt",
      explorer: "Passagenrunde durch die Innenstadt",
    },
    classicScenario: {
      start: "Start am Markt Leipzig",
      explorer: "Passagenrunde durch die Innenstadt",
      close: "Spaeter Drink in Plagwitz",
    },
  },
];

const OCCASION_OPTIONS: Array<{ value: PlannerEntryOccasion; label: string }> = [
  { value: "date", label: "Date" },
  { value: "friends", label: "Freunde" },
  { value: "tourism", label: "Tourismus" },
];

const BUDGET_OPTIONS: Array<{ value: PlannerEntryBudget; label: string }> = [
  { value: "low", label: "Leicht" },
  { value: "medium", label: "Mittel" },
  { value: "high", label: "Grosszuegig" },
];

const INTEREST_OPTIONS: Record<PlannerEntryOccasion, string[]> = {
  date: ["Wine Bars", "Fine Dining", "Live Musik", "Rooftop", "Theater", "Cocktails"],
  friends: ["Street Food", "Live Musik", "Craft Beer", "Comedy", "Nightlife", "Games"],
  tourism: ["Architektur", "Food Markets", "Museen", "Aussicht", "Kaffee", "Design"],
};

const ENTRY_STEPS = [
  "1 Stadt und Anlass setzen",
  "2 Preview kurz lesen",
  "3 Mit dieser Auswahl starten",
];

function selectionChipClass(isActive: boolean) {
  return isActive
    ? "border-[#111827] bg-[#111827] text-white shadow-[0_12px_24px_rgba(15,23,42,0.16)]"
    : "border-[rgba(17,24,39,0.1)] bg-white text-[#586373] hover:border-[rgba(17,24,39,0.18)] hover:text-[#111827]";
}

function fieldControlClass(isActive: boolean) {
  return isActive
    ? "border-[rgba(17,24,39,0.18)] bg-[#f8fafc] shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
    : "bg-white";
}

function plannerBadgeForMode(mode: ExperienceMode) {
  if (mode === "show") return "Show-Fokus";
  if (mode === "event_visit") return "Event-Fokus";
  if (mode === "market_festival") return "Markt-Fokus";
  return "Ausgewogen";
}

function plannerBadgeToneForMode(mode: ExperienceMode) {
  if (mode === "show") return "warning" as const;
  if (mode === "event_visit") return "info" as const;
  if (mode === "market_festival") return "success" as const;
  return "neutral" as const;
}

function previewShellClassForMode(mode: ExperienceMode) {
  if (mode === "show") {
    return "border-[rgba(180,83,9,0.16)] bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,247,237,0.98))]";
  }
  if (mode === "event_visit") {
    return "border-[rgba(14,116,144,0.16)] bg-[linear-gradient(180deg,rgba(240,249,255,0.98),rgba(236,246,255,0.96))]";
  }
  if (mode === "market_festival") {
    return "border-[rgba(22,101,52,0.14)] bg-[linear-gradient(180deg,rgba(240,253,244,0.98),rgba(236,252,243,0.96))]";
  }
  return "border-[rgba(17,24,39,0.08)] bg-[#f8fafc]";
}

function previewInnerCardClassForMode(mode: ExperienceMode) {
  if (mode === "show") {
    return "border-[rgba(180,83,9,0.12)] bg-[rgba(255,255,255,0.82)]";
  }
  if (mode === "event_visit") {
    return "border-[rgba(14,116,144,0.12)] bg-[rgba(255,255,255,0.82)]";
  }
  if (mode === "market_festival") {
    return "border-[rgba(22,101,52,0.12)] bg-[rgba(255,255,255,0.82)]";
  }
  return "border-[rgba(17,24,39,0.08)] bg-white";
}

function plannerReasoningPrefix(occasion: PlannerEntryOccasion) {
  if (occasion === "friends") {
    return "Gemeinsamer Rhythmus, gute Uebergaenge und ein klarer Peak fuer die Gruppe.";
  }
  if (occasion === "tourism") {
    return "Stadtmoment, Orientierung und ein klares Highlight greifen ruhig ineinander.";
  }
  return "Kompakte Wege, ein starker Hauptmoment und ein ruhiger Ausklang halten den Abend zusammen.";
}

function buildScenarioPreview(args: {
  city: PlannerEntryCity;
  occasion: PlannerEntryOccasion;
  mode: ExperienceMode;
  budget: PlannerEntryBudget;
  interests: string[];
}): ScenarioPreview {
  const { city, occasion, mode, budget, interests } = args;
  const interestText = interests.slice(0, 2).join(" + ");
  const budgetText =
    budget === "low"
      ? "mit leichterem Budget"
      : budget === "high"
        ? "mit mehr Spielraum"
        : "mit ausgeglichener Preislogik";
  const label = `${city.name} | ${occasionLabel(occasion)} | ${experienceModeLabel(mode, occasion)}`;

  if (mode === "show") {
    return {
      label,
      badge: plannerBadgeForMode(mode),
      modeAccent: "Event-Anker",
      title: "So koennte der Abend live gebaut werden",
      subtitle: `${city.anchor} als Startpunkt, dann Dinner, fester Show-Moment und ein sauberer After-Stop.`,
      reasoning: `${plannerReasoningPrefix(occasion)} ${budgetText}. Die Preview lehnt sich an aktuelle Show-Flows aus ${city.name} an und gewichtet ${interestText || "Live Musik + Stimmung"} als echten Hauptmoment.`,
      stops: [
        {
          time: "18:00",
          title: city.showScenario.start,
          note: "frueher Einstieg mit genug Luft vor dem Hauptevent",
          transit: "Transit 6-10 Min",
          kind: "Start",
        },
        {
          time: "19:00",
          title: city.showScenario.dinner,
          note: "Dinner-Slot vor dem festen Eventfenster",
          transit: "Transit 10-14 Min",
          kind: "Dinner",
        },
        {
          time: "20:30",
          title: city.showScenario.event,
          note: "echter Show-Anchor mit fixer Uhrzeit",
          transit: "Transit 8-12 Min",
          kind: "Show",
        },
      ],
    };
  }

  if (mode === "event_visit") {
    return {
      label,
      badge: plannerBadgeForMode(mode),
      modeAccent: "Flexible Event-Route",
      title: "So koennte die Route live aussehen",
      subtitle: `${city.anchor} als Einstieg, dann ein kuratierter Eventmoment und ein ruhiger Abschluss.`,
      reasoning: `${plannerReasoningPrefix(occasion)} ${budgetText}. Die Preview lehnt sich an aktuelle Event-Visit-Flows an und haelt den Event bewusst als Peak statt als Zufallstreffer.`,
      stops: [
        {
          time: "17:45",
          title: city.eventVisitScenario.start,
          note: "sauberer Einstieg mit kurzer Entscheidungsstrecke",
          transit: "Transit 5-9 Min",
          kind: "Start",
        },
        {
          time: "19:00",
          title: city.eventVisitScenario.event,
          note: "kuratierter Event-Peak mit genug Luft danach",
          transit: "Transit 12-16 Min",
          kind: "Event",
        },
        {
          time: "21:15",
          title: city.eventVisitScenario.close,
          note: "passender Ausklang statt zweitem Pflichtmoment",
          transit: "Transit 7-11 Min",
          kind: "Ausklang",
        },
      ],
    };
  }

  if (mode === "market_festival") {
    return {
      label,
      badge: plannerBadgeForMode(mode),
      modeAccent: "Offener Tagesfluss",
      title: "So koennte der Tag live gefuehrt werden",
      subtitle: `${city.anchor} als Ausgangspunkt, dann ein offenes Highlight mit Lunch und Explorer-Moment.`,
      reasoning: `${plannerReasoningPrefix(occasion)} ${budgetText}. Die Preview orientiert sich an aktuellen Markt- und Festival-Ankern aus ${city.name} und laesst ${interestText || "Stadt + Event"} bewusst offener atmen.`,
      stops: [
        {
          time: "11:00",
          title: city.marketFestivalScenario.event,
          note: "flexibler Event-Anchor ohne harte Abenddramaturgie",
          transit: "Transit 8-12 Min",
          kind: "Anchor",
        },
        {
          time: "13:00",
          title: city.marketFestivalScenario.food,
          note: "klarer Food-Slot nach dem Eventfenster",
          transit: "Transit 10-14 Min",
          kind: "Lunch",
        },
        {
          time: "15:00",
          title: city.marketFestivalScenario.explorer,
          note: "Explorer-Moment statt zweitem Pflichttermin",
          transit: "Transit 6-10 Min",
          kind: "Explorer",
        },
      ],
    };
  }

  return {
    label,
    badge: plannerBadgeForMode(mode),
    modeAccent: "Ruhiger Flow",
    title: "So koennte die Grundroute live wirken",
    subtitle: `${city.anchor} als Start, dann ein klarer Rhythmus aus Stadtmoment und Ausklang.`,
    reasoning: `${plannerReasoningPrefix(occasion)} ${budgetText}. Die Preview zeigt eine ruhigere Grundroute, die sich an aktuellen Classic-Faellen orientiert und ${interestText || "deine Vorauswahl"} in einen plausiblen Flow zieht.`,
    stops: [
      {
        time: "16:30",
        title: city.classicScenario.start,
        note: "einfacher Einstieg mit kurzer Uebergangszeit",
        transit: "Transit 6-10 Min",
        kind: "Start",
      },
      {
        time: "18:00",
        title: city.classicScenario.explorer,
        note: "starker Stadtmoment fuer Orientierung und Stimmung",
        transit: "Transit 9-13 Min",
        kind: "Explorer",
      },
      {
        time: "20:00",
        title: city.classicScenario.close,
        note: "klarer Ausklang statt ueberladener Route",
        transit: "Transit 8-12 Min",
        kind: "Ausklang",
      },
    ],
  };
}

export default function HomepagePlannerEntry() {
  const [activeField, setActiveField] = useState<PlannerEntryField>(null);
  const [selectedCitySlug, setSelectedCitySlug] = useState<string>("berlin-berlin");
  const [occasion, setOccasion] = useState<PlannerEntryOccasion>("date");
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>("show");
  const [budget, setBudget] = useState<PlannerEntryBudget>("medium");
  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    INTEREST_OPTIONS.date.slice(0, 2)
  );

  const selectedCity = useMemo(
    () => CITY_OPTIONS.find((city) => city.slug === selectedCitySlug) ?? CITY_OPTIONS[0],
    [selectedCitySlug]
  );

  const modeOptions = useMemo(() => experienceOptionsForOccasion(occasion), [occasion]);

  const scenarioPreview = useMemo(
    () =>
      buildScenarioPreview({
        city: selectedCity,
        occasion,
        mode: experienceMode,
        budget,
        interests: selectedInterests,
      }),
    [budget, experienceMode, occasion, selectedCity, selectedInterests]
  );

  const plannerHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("citySlug", selectedCity.slug);
    params.set("occasion", occasion);
    params.set("experienceMode", experienceMode);
    params.set("budget", budget);
    if (selectedInterests.length > 0) {
      params.set("interests", selectedInterests.join(","));
    }
    return `/planner?${params.toString()}`;
  }, [budget, experienceMode, occasion, selectedCity.slug, selectedInterests]);

  const mobileSelectionSummary = useMemo(
    () => [
      selectedCity.name,
      occasionLabel(occasion),
      experienceModeLabel(experienceMode, occasion),
      budgetLabel(budget),
      ...selectedInterests.slice(0, 2),
    ],
    [budget, experienceMode, occasion, selectedCity.name, selectedInterests]
  );

  useEffect(() => {
    const validModes = new Set(modeOptions.map((option) => option.value));
    if (!validModes.has(experienceMode)) {
      setExperienceMode(modeOptions[0]?.value ?? "classic");
    }
  }, [experienceMode, modeOptions]);

  useEffect(() => {
    const availableInterests = new Set(INTEREST_OPTIONS[occasion]);
    const nextSelected = selectedInterests.filter((interest) => availableInterests.has(interest));
    if (nextSelected.length === selectedInterests.length) return;
    if (nextSelected.length > 0) {
      setSelectedInterests(nextSelected);
      return;
    }
    setSelectedInterests(INTEREST_OPTIONS[occasion].slice(0, 2));
  }, [occasion, selectedInterests]);

  function toggleInterest(interest: string) {
    setSelectedInterests((prev) => {
      if (prev.includes(interest)) {
        const reduced = prev.filter((value) => value !== interest);
        return reduced.length > 0 ? reduced : [interest];
      }
      if (prev.length >= 3) return [...prev.slice(1), interest];
      return [...prev, interest];
    });
  }

  function fieldOptionLayoutClass(field: Exclude<PlannerEntryField, null>) {
    if (field === "interests") return "grid grid-cols-1 sm:flex sm:flex-wrap";
    return "grid grid-cols-2 sm:flex sm:flex-wrap";
  }

  function renderInlineFieldOptions(field: Exclude<PlannerEntryField, null>) {
    return (
      <div className="rounded-[22px] border border-[rgba(17,24,39,0.08)] bg-[#f8fafc] p-3.5 sm:rounded-[24px] sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#586373]">
            Auswahl
          </div>
          <div className="text-[11px] font-medium text-[#586373]">
            {field === "interests" ? "bis zu 3 aktiv" : "direkt auswaehlen"}
          </div>
        </div>

        <div className={`mt-3 gap-2 ${fieldOptionLayoutClass(field)}`}>
          {field === "city" &&
            CITY_OPTIONS.map((city) => (
              <button
                key={city.slug}
                type="button"
                className={`min-h-11 rounded-full border px-3 py-2 text-sm font-medium transition sm:min-h-0 ${selectionChipClass(city.slug === selectedCity.slug)}`}
                onClick={() => setSelectedCitySlug(city.slug)}
              >
                {city.name}
              </button>
            ))}

          {field === "occasion" &&
            OCCASION_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`min-h-11 rounded-full border px-3 py-2 text-sm font-medium transition sm:min-h-0 ${selectionChipClass(option.value === occasion)}`}
                onClick={() => setOccasion(option.value)}
              >
                {option.label}
              </button>
            ))}

          {field === "mode" &&
            modeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`min-h-11 rounded-full border px-3 py-2 text-sm font-medium transition sm:min-h-0 ${selectionChipClass(option.value === experienceMode)}`}
                onClick={() => setExperienceMode(option.value)}
              >
                {option.label}
              </button>
            ))}

          {field === "budget" &&
            BUDGET_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`min-h-11 rounded-full border px-3 py-2 text-sm font-medium transition sm:min-h-0 ${selectionChipClass(option.value === budget)}`}
                onClick={() => setBudget(option.value)}
              >
                {option.label}
              </button>
            ))}

          {field === "interests" &&
            INTEREST_OPTIONS[occasion].map((interest) => (
              <button
                key={interest}
                type="button"
                className={`min-h-11 rounded-full border px-3 py-2 text-sm font-medium transition sm:min-h-0 ${selectionChipClass(selectedInterests.includes(interest))}`}
                onClick={() => toggleInterest(interest)}
              >
                {interest}
              </button>
            ))}
        </div>
      </div>
    );
  }

  function renderExpandableField(args: {
    field: Exclude<PlannerEntryField, null>;
    label: string;
    value: string;
    hint: string;
  }) {
    const { field, label, value, hint } = args;
    const isActive = activeField === field;

    return (
      <div className="space-y-2.5 sm:space-y-3">
        <PD24SelectionControl
          label={label}
          value={value}
          hint={hint}
          icon={isActive ? "-" : "+"}
          aria-expanded={isActive}
          className={fieldControlClass(isActive)}
          onClick={() => setActiveField((prev) => (prev === field ? null : field))}
        />

        <div
          aria-hidden={!isActive}
          className={`overflow-hidden transition-all duration-200 ease-out ${
            isActive
              ? "max-h-[34rem] translate-y-0 opacity-100 sm:max-h-72"
              : "max-h-0 -translate-y-1 opacity-0"
          }`}
        >
          <div className="border-t border-[rgba(17,24,39,0.08)] pt-2.5 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
            {isActive ? renderInlineFieldOptions(field) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="pd24-shell scroll-mt-28 p-5 sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.08fr)] lg:gap-8">
        <div>
          <div className="inline-flex flex-wrap items-center gap-2 rounded-[22px] border border-[rgba(17,24,39,0.08)] bg-white/90 px-3 py-3">
            <span className="rounded-full bg-[#111827] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
              Selbst planen
            </span>
            <span className="rounded-full border border-[rgba(17,24,39,0.08)] bg-[#f8fafc] px-3 py-1.5 text-xs font-medium text-[#586373]">
              Mit eigener Auswahl
            </span>
            <span className="rounded-full border border-[rgba(17,24,39,0.08)] bg-[#f8fafc] px-3 py-1.5 text-xs font-medium text-[#586373]">
              Direkt in den Planner
            </span>
          </div>

          <PD24SectionIntro
            eyebrow="Selbst planen"
            title="Setze den Rahmen und springe mit einer sinnvollen Vorauswahl in den Planner."
            body="Stadt, Anlass, Fokus, Budget und Vorlieben greifen hier direkt ineinander. So siehst du schon vor dem Start, wie sich der Tag ungefaehr anfuehlen koennte."
          />

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {ENTRY_STEPS.map((step) => (
              <div
                key={step}
                className="rounded-[20px] border border-[rgba(17,24,39,0.08)] bg-white/90 px-4 py-3 text-sm font-medium text-[#111827]"
              >
                {step}
              </div>
            ))}
          </div>

          <div className="mt-3 text-sm leading-6 text-[#586373]">
            Gut fuer alle, die nicht mit einer fertigen Route starten wollen, sondern ihren Tag
            selbst aufsetzen moechten.
          </div>

          <div className="mt-5 rounded-[22px] border border-[rgba(17,24,39,0.08)] bg-white/90 p-4 sm:hidden">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#586373]">
              1. Deine aktuelle Auswahl
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {mobileSelectionSummary.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[rgba(17,24,39,0.08)] bg-[#f8fafc] px-3 py-1.5 text-xs font-medium text-[#586373]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-4 sm:mt-8">
            {renderExpandableField({
              field: "city",
              label: "Stadt",
              value: selectedCity.name,
              hint: "Stadt fuer den Einstieg waehlen",
            })}

            {renderExpandableField({
              field: "occasion",
              label: "Anlass",
              value: occasionLabel(occasion),
              hint: "Welcher Kontext soll den Plan fuehren?",
            })}

            {renderExpandableField({
              field: "mode",
              label: "Fokus",
              value: experienceModeLabel(experienceMode, occasion),
              hint: experienceModeHint(experienceMode, occasion),
            })}

            {renderExpandableField({
              field: "budget",
              label: "Budget",
              value: budgetLabel(budget),
              hint: "Wie grosszuegig soll der Plan rechnen?",
            })}

            {renderExpandableField({
              field: "interests",
              label: "Vorlieben",
              value:
                selectedInterests.length > 0
                  ? selectedInterests.slice(0, 2).join(" | ")
                  : "Noch keine Auswahl",
              hint: "Welche Stimmung oder Themen sollen den Plan ziehen?",
            })}
          </div>

          <div className="mt-5 rounded-[22px] border border-[rgba(17,24,39,0.08)] bg-white/85 p-4 sm:mt-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#586373]">
              3. Jetzt in den Planner
            </div>
            <PD24Button href={plannerHref} className="w-full sm:w-auto">
              Mit eigener Auswahl starten
            </PD24Button>
            <p className="mt-3 text-sm leading-6 text-[#586373]">
              Der Planner uebernimmt Stadt, Anlass, Fokus, Budget und ausgewaehlte Vorlieben
              direkt aus dieser Entry.
            </p>
            <p className="mt-2 text-sm leading-6 text-[#586373]">
              Wenn du lieber erst eine fertige Dramaturgie ansehen willst, ist darunter der
              Einstieg ueber Creator-Routen die passendere Alternative.
            </p>
          </div>
        </div>

        <div
          className={`rounded-[24px] border p-4 transition-colors sm:rounded-[26px] sm:p-6 ${previewShellClassForMode(
            experienceMode
          )}`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#586373]">
                2. Vorschau auf euren Tag
              </div>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-[#111827] sm:text-2xl">
                {scenarioPreview.title}
              </h3>
              <div className="mt-2 text-sm leading-6 text-[#586373]">{scenarioPreview.label}</div>
            </div>
            <PD24StatusBadge tone={plannerBadgeToneForMode(experienceMode)}>
              {scenarioPreview.badge}
            </PD24StatusBadge>
          </div>

          <div className="mt-3 text-sm leading-6 text-[#586373]">
            So koennte sich deine aktuelle Vorauswahl im Planner anfuehlen.
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-[rgba(17,24,39,0.08)] bg-white/80 px-3 py-1.5 text-xs font-medium text-[#586373]">
              {selectedCity.name}
            </span>
            <span className="rounded-full border border-[rgba(17,24,39,0.08)] bg-white/80 px-3 py-1.5 text-xs font-medium text-[#586373]">
              {occasionLabel(occasion)}
            </span>
            <span className="rounded-full border border-[rgba(17,24,39,0.08)] bg-white/80 px-3 py-1.5 text-xs font-medium text-[#586373]">
              {experienceModeLabel(experienceMode, occasion)}
            </span>
            <span className="rounded-full border border-[rgba(17,24,39,0.08)] bg-white/80 px-3 py-1.5 text-xs font-medium text-[#586373]">
              {scenarioPreview.modeAccent}
            </span>
          </div>

          <div
            className={`mt-4 rounded-[18px] border px-4 py-4 text-sm leading-6 text-[#586373] sm:rounded-[20px] ${previewInnerCardClassForMode(
              experienceMode
            )}`}
          >
            {scenarioPreview.subtitle}
          </div>

          <div className="mt-5 space-y-3 sm:mt-6">
            {scenarioPreview.stops.map((stop) => (
              <div
                key={`${stop.time}-${stop.title}`}
                className={`rounded-[18px] border px-4 py-4 transition hover:border-[rgba(17,24,39,0.14)] hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)] sm:rounded-[20px] ${previewInnerCardClassForMode(
                  experienceMode
                )}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[#111827]">{stop.time}</div>
                  <div className="rounded-full border border-[rgba(17,24,39,0.08)] bg-white/80 px-2.5 py-1 text-[11px] font-medium text-[#586373]">
                    {stop.kind}
                  </div>
                </div>
                <div className="mt-2 text-base font-medium text-[#111827]">{stop.title}</div>
                <div className="mt-1 flex flex-col gap-1 text-sm leading-6 text-[#586373] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <span>{stop.note}</span>
                  <span className="shrink-0 rounded-full border border-[rgba(17,24,39,0.08)] bg-white/80 px-2.5 py-0.5 text-[11px] font-medium text-[#586373]">
                    {stop.transit}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div
            className={`mt-5 rounded-[20px] border p-4 sm:rounded-[22px] ${previewInnerCardClassForMode(
              experienceMode
            )}`}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#586373]">
              Warum das passt
            </div>
            <p className="mt-3 text-sm leading-7 text-[#586373]">{scenarioPreview.reasoning}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedInterests.slice(0, 3).map((interest) => (
                <span
                  key={interest}
                  className="rounded-full border border-[rgba(17,24,39,0.08)] bg-[#f8fafc] px-3 py-1.5 text-xs font-medium text-[#586373]"
                >
                  {interest}
                </span>
              ))}
              <span className="rounded-full border border-[rgba(17,24,39,0.08)] bg-[#f8fafc] px-3 py-1.5 text-xs font-medium text-[#586373]">
                {budgetLabel(budget)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
