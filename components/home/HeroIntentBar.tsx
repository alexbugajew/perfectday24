"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type OccasionKey = "date" | "friends" | "family" | "tourism" | "party";
type ExperienceMode = "classic" | "show" | "event_visit" | "market_festival";
type DatePref = "today" | "tomorrow" | "this_weekend" | "flexible";

type ParsedIntent = {
  citySlug: string | null;
  cityLabel: string | null;
  occasion: OccasionKey | null;
  experienceMode: ExperienceMode | null;
  datePreference: DatePref | null;
  confidence: number;
};

type Phase =
  | { kind: "idle" }
  | { kind: "parsing" }
  | { kind: "city_missing"; intent: ParsedIntent }
  | { kind: "ready"; intent: ParsedIntent }
  | { kind: "error"; message: string };

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const SCENARIOS: {
  key: OccasionKey;
  emoji: string;
  label: string;
}[] = [
  { key: "date", emoji: "🥂", label: "Date Night" },
  { key: "friends", emoji: "👫", label: "Mit Freunden" },
  { key: "family", emoji: "👨‍👩‍👧", label: "Familientag" },
  { key: "tourism", emoji: "🗺️", label: "Als Tourist" },
  { key: "party", emoji: "🎉", label: "Feiern" },
];

const CITY_DISPLAY: Record<string, string> = {
  "berlin-berlin": "Berlin",
  "hamburg-hamburg": "Hamburg",
  muenchen: "München",
  koeln: "Köln",
  "frankfurt-am-main": "Frankfurt",
  stuttgart: "Stuttgart",
  duesseldorf: "Düsseldorf",
  leipzig: "Leipzig",
  dresden: "Dresden",
  hannover: "Hannover",
  nuernberg: "Nürnberg",
  bremen: "Bremen",
  dortmund: "Dortmund",
  essen: "Essen",
  bonn: "Bonn",
  muenster: "Münster",
  mannheim: "Mannheim",
  wiesbaden: "Wiesbaden",
  aachen: "Aachen",
  karlsruhe: "Karlsruhe",
  duisburg: "Duisburg",
  bochum: "Bochum",
  wuppertal: "Wuppertal",
  bielefeld: "Bielefeld",
  augsburg: "Augsburg",
  braunschweig: "Braunschweig",
  kiel: "Kiel",
  gelsenkirchen: "Gelsenkirchen",
  moenchengladbach: "Mönchengladbach",
  magdeburg: "Magdeburg",
  "freiburg-im-breisgau": "Freiburg",
  luebeck: "Lübeck",
  erfurt: "Erfurt",
};

const TOP_CITY_SLUGS = [
  "berlin-berlin",
  "hamburg-hamburg",
  "muenchen",
  "koeln",
  "frankfurt-am-main",
  "stuttgart",
  "duesseldorf",
  "leipzig",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function resolvePlanDate(pref: DatePref | null): string {
  const today = new Date();
  if (!pref || pref === "flexible") return today.toISOString().slice(0, 10);
  if (pref === "today") return today.toISOString().slice(0, 10);
  if (pref === "tomorrow") {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  if (pref === "this_weekend") {
    const day = today.getDay();
    const daysToSat = ((6 - day + 7) % 7) || 7;
    const sat = new Date(today);
    sat.setDate(sat.getDate() + daysToSat);
    return sat.toISOString().slice(0, 10);
  }
  return today.toISOString().slice(0, 10);
}

function buildPlannerUrl(intent: ParsedIntent): string {
  const params = new URLSearchParams({
    citySlug: intent.citySlug ?? "",
    occasion: intent.occasion ?? "date",
    experienceMode: intent.experienceMode ?? "classic",
    budget: "medium",
    planDate: resolvePlanDate(intent.datePreference),
  });
  return `/planner?${params.toString()}`;
}

function buildExploreUrl(intent: ParsedIntent): string {
  const params = new URLSearchParams();
  if (intent.citySlug) params.set("citySlug", intent.citySlug);
  if (intent.occasion) params.set("occasion", intent.occasion);
  return `/explore?${params.toString()}`;
}

function formatDateLabel(pref: DatePref | null): string {
  if (!pref || pref === "flexible") return "Flexibel";
  if (pref === "today") return "Heute";
  if (pref === "tomorrow") return "Morgen";
  if (pref === "this_weekend") return "Dieses Wochenende";
  return "Flexibel";
}

function cityDisplayName(intent: ParsedIntent): string {
  if (intent.cityLabel) return intent.cityLabel;
  if (intent.citySlug) return CITY_DISPLAY[intent.citySlug] ?? intent.citySlug;
  return "—";
}

function occasionEmoji(key: OccasionKey | null): string {
  return SCENARIOS.find((s) => s.key === key)?.emoji ?? "📅";
}

function occasionLabel(key: OccasionKey | null): string {
  return SCENARIOS.find((s) => s.key === key)?.label ?? "Outing";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function HeroIntentBar() {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const focusTargetRef = useRef<HTMLElement | null>(null);

  // Beim Phasenwechsel wird das fokussierte Input unmounted; Fokus gezielt
  // auf die neue Überschrift bzw. Meldung setzen statt auf <body> fallen lassen.
  useEffect(() => {
    if (phase.kind === "idle" || phase.kind === "parsing") return;
    focusTargetRef.current?.focus();
  }, [phase.kind]);

  async function parseAndRoute(inputText: string) {
    setPhase({ kind: "parsing" });
    try {
      const res = await fetch("/api/parse-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ParsedIntent;

      if (!data.citySlug) {
        setPhase({ kind: "city_missing", intent: data });
      } else {
        setPhase({ kind: "ready", intent: data });
      }
    } catch {
      setPhase({
        kind: "error",
        message: "Kurz nicht erreichbar — bitte nochmal versuchen.",
      });
    }
  }

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    void parseAndRoute(trimmed);
  }

  function handleScenarioTile(scenario: (typeof SCENARIOS)[0]) {
    setPhase({
      kind: "city_missing",
      intent: {
        citySlug: null,
        cityLabel: null,
        occasion: scenario.key,
        experienceMode: null,
        datePreference: null,
        confidence: 0.9,
      },
    });
  }

  function handleCitySelect(slug: string) {
    if (phase.kind !== "city_missing") return;
    const updated: ParsedIntent = {
      ...phase.intent,
      citySlug: slug,
      cityLabel: CITY_DISPLAY[slug] ?? slug,
    };
    setPhase({ kind: "ready", intent: updated });
  }

  function handleReset() {
    setPhase({ kind: "idle" });
    setText("");
    setTimeout(() => inputRef.current?.focus(), 60);
  }

  // Inhalt pro Phase; wird unten in einem dauerhaft gemounteten
  // aria-live-Container gerendert (Container bleibt, nur Inhalt wechselt).
  function renderPhase() {
  // ── Parsing ──────────────────────────────────────────────────────────────
  if (phase.kind === "parsing") {
    return (
      <div className="mt-7 flex items-center gap-3 text-sm text-[var(--text-muted-warm)]">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--brand-warm)] border-t-transparent" />
        Dein Plan wird vorbereitet …
      </div>
    );
  }

  // ── City missing ─────────────────────────────────────────────────────────
  if (phase.kind === "city_missing") {
    return (
      <div className="mt-7 space-y-4">
        <div
          ref={(el) => { focusTargetRef.current = el; }}
          tabIndex={-1}
          className="text-sm font-semibold text-[var(--text-strong)] outline-none"
        >
          {phase.intent.occasion ? (
            <>
              {occasionEmoji(phase.intent.occasion)} {occasionLabel(phase.intent.occasion)} — in
              welcher Stadt?
            </>
          ) : (
            "In welcher Stadt planst du?"
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TOP_CITY_SLUGS.map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => handleCitySelect(slug)}
              className="min-h-11 rounded-2xl border border-[var(--line-strong)] bg-white/80 px-3 py-2.5 text-sm font-medium text-[var(--text-strong)] transition hover:border-[rgba(196,137,79,0.4)] hover:bg-[rgba(196,137,79,0.06)] active:scale-[0.98]"
            >
              {CITY_DISPLAY[slug]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex min-h-11 items-center text-xs text-[var(--text-soft-warm)] underline-offset-2 hover:underline"
        >
          ← Neu eingeben
        </button>
      </div>
    );
  }

  // ── Ready ─────────────────────────────────────────────────────────────────
  if (phase.kind === "ready") {
    const { intent } = phase;
    return (
      <div className="mt-7 space-y-4">
        {/* Summary card */}
        <div className="rounded-[var(--radius-card-sm)] border border-[rgba(196,137,79,0.28)] bg-[rgba(196,137,79,0.07)] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="pd24-kicker-warm">
                Dein Plan
              </div>
              <div
                ref={(el) => { focusTargetRef.current = el; }}
                tabIndex={-1}
                className="mt-1.5 text-lg font-semibold tracking-tight text-[var(--text-strong)] outline-none"
              >
                {occasionEmoji(intent.occasion)} {occasionLabel(intent.occasion)}
                {" · "}
                {cityDisplayName(intent)}
                {" · "}
                {formatDateLabel(intent.datePreference)}
              </div>
            </div>
            <button
              type="button"
              onClick={handleReset}
              aria-label="Zurücksetzen"
              className="mt-0.5 flex-shrink-0 rounded-full p-1.5 text-[var(--text-soft-warm)] transition hover:bg-[rgba(23,23,23,0.07)] hover:text-[var(--text-strong)]"
            >
              ✕
            </button>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(buildPlannerUrl(intent))}
            className="pd24-btn pd24-btn-primary active:scale-[0.98]"
          >
            Plan erstellen →
          </button>
          <button
            type="button"
            onClick={() => router.push(buildExploreUrl(intent))}
            className="pd24-btn pd24-btn-secondary active:scale-[0.98]"
          >
            Routen ansehen →
          </button>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (phase.kind === "error") {
    return (
      <div className="mt-7 space-y-3">
        <div
          ref={(el) => { focusTargetRef.current = el; }}
          tabIndex={-1}
          className="rounded-2xl border border-[rgba(196,137,79,0.3)] bg-[rgba(196,137,79,0.08)] px-4 py-3 text-sm text-[var(--brand-warm-ink)] outline-none"
        >
          {phase.message}
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex min-h-11 items-center text-xs text-[var(--text-soft-warm)] underline-offset-2 hover:underline"
        >
          ← Zurück
        </button>
      </div>
    );
  }

  // ── Idle ──────────────────────────────────────────────────────────────────
  return (
    <div className="mt-8 space-y-4">
      {/* Natural language input — prominent */}
      <div className="flex items-stretch gap-0 overflow-hidden rounded-2xl border border-[rgba(23,23,23,0.18)] bg-white shadow-[0_4px_20px_rgba(49,39,27,0.10)] transition-all focus-within:border-[rgba(196,137,79,0.6)] focus-within:shadow-[0_4px_24px_rgba(196,137,79,0.16)]">
        <input
          ref={inputRef}
          type="text"
          aria-label="Beschreibe deinen Tag"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          placeholder='z. B. „Date-Abend in München mit Live-Konzert"'
          className="min-h-[56px] w-0 min-w-0 flex-1 bg-transparent px-5 text-base text-[var(--text-strong)] placeholder-[#b0a49a] outline-none"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={text.trim().length === 0}
          className="pd24-btn pd24-btn-sm pd24-btn-primary m-1.5 shrink-0 active:scale-[0.97]"
        >
          <span className="sm:hidden">Autopilot</span>
          <span className="hidden sm:inline">Autopilot starten</span>
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Scenario tiles — mobil als ruhiges 2er-Raster statt wild umbrechender Pillen */}
      <div className="space-y-2">
        <span className="pd24-meta block sm:inline">Oder Vorlage:</span>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.key}
              type="button"
              onClick={() => handleScenarioTile(scenario)}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--line-strong)] bg-white/80 px-4 text-sm font-medium text-[var(--text-muted-warm)] transition hover:border-[rgba(196,137,79,0.35)] hover:bg-[rgba(196,137,79,0.06)] hover:text-[var(--text-strong)] active:scale-[0.97] sm:justify-start"
            >
              {scenario.emoji} {scenario.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
  }

  // Dauerhaft gemounteter Live-Container: Phasenwechsel werden announced.
  return <div aria-live="polite">{renderPhase()}</div>;
}
