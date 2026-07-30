"use client";

import { useEffect, useMemo, useReducer, useRef } from "react";

// ─── Demo-Szenarien ─────────────────────────────────────────────────────────
// Kein API-Call, keine Live-Daten — kuratierte Beispiele die das Produkt-
// Versprechen zeigen: ein Satz rein, sauberer Ablauf raus.

type DemoStop = {
  time: string;
  label: string;
  name: string;
  hint: string;
};

type DemoScenario = {
  prompt: string;
  cityLabel: string;
  planTitle: string;
  peakTag: string;
  stops: DemoStop[];
};

const SCENARIOS: DemoScenario[] = [
  {
    prompt: "Date-Abend Berlin mit Live-Konzert",
    cityLabel: "Berlin · heute Abend",
    planTitle: "Date-Abend mit Konzert",
    peakTag: "Live-Event",
    stops: [
      { time: "17:45", label: "Aperitif", name: "Café Einstein Unter den Linden", hint: "ruhiger Start, kurze Anfahrt" },
      { time: "19:10", label: "Dinner", name: "Katz Orange", hint: "genug Luft vor der Show" },
      { time: "20:30", label: "Hauptmoment", name: "Konzerthaus Berlin", hint: "echter Anker mit fester Zeit" },
      { time: "22:40", label: "Ausklang", name: "Buck & Breck Bar", hint: "nah an der Venue, kein Takt mehr" },
    ],
  },
  {
    prompt: "Familientag München mit Museum und Park",
    cityLabel: "München · morgen",
    planTitle: "Familientag ohne Leerlauf",
    peakTag: "Kids-fit",
    stops: [
      { time: "10:00", label: "Frühstück", name: "Café Frischhut", hint: "Klassiker, offen ab 8" },
      { time: "11:15", label: "Museum", name: "Verkehrszentrum", hint: "interaktiv, Kinder-tauglich" },
      { time: "13:30", label: "Lunch", name: "Bavariapark Café", hint: "kurze Wege zum Park" },
      { time: "14:45", label: "Park & Spiel", name: "Bavariapark", hint: "Auslauf ohne Regenrisiko" },
    ],
  },
  {
    prompt: "Wochenende Hamburg mit Freunden und guter Bar",
    cityLabel: "Hamburg · Samstag",
    planTitle: "Freunde-Nacht auf St. Pauli",
    peakTag: "Nightlife",
    stops: [
      { time: "18:00", label: "Vorglühen", name: "Elbfähre 62", hint: "Blick auf die Docks" },
      { time: "19:30", label: "Dinner", name: "Bullerei", hint: "gemeinsam, laut, gut" },
      { time: "22:00", label: "Bar", name: "Le Lion", hint: "kurzer Weg zum Kiez" },
      { time: "23:30", label: "Peak", name: "Uebel & Gefährlich", hint: "spätstart, dichte Energie" },
    ],
  },
];

// ─── State machine ─────────────────────────────────────────────────────────
// idle → typing → generating → revealing → hold → next scenario

type Phase = "typing" | "generating" | "revealing" | "hold";
type State = {
  scenarioIdx: number;
  phase: Phase;
  typedChars: number;
  revealedStops: number;
};

type Action =
  | { type: "typeChar" }
  | { type: "startGenerating" }
  | { type: "startRevealing" }
  | { type: "revealNext" }
  | { type: "startHold" }
  | { type: "nextScenario" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "typeChar":
      return { ...state, typedChars: state.typedChars + 1 };
    case "startGenerating":
      return { ...state, phase: "generating", typedChars: SCENARIOS[state.scenarioIdx].prompt.length };
    case "startRevealing":
      return { ...state, phase: "revealing", revealedStops: 0 };
    case "revealNext":
      return { ...state, revealedStops: Math.min(state.revealedStops + 1, SCENARIOS[state.scenarioIdx].stops.length) };
    case "startHold":
      return { ...state, phase: "hold" };
    case "nextScenario":
      return {
        scenarioIdx: (state.scenarioIdx + 1) % SCENARIOS.length,
        phase: "typing",
        typedChars: 0,
        revealedStops: 0,
      };
    default:
      return state;
  }
}

// ─── Motion Preference ─────────────────────────────────────────────────────

function usePrefersReducedMotion() {
  const prefersRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersRef.current = mq.matches;
    const listener = (e: MediaQueryListEvent) => {
      prefersRef.current = e.matches;
    };
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);
  return prefersRef;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function HeroLiveDemo() {
  const [state, dispatch] = useReducer(reducer, {
    scenarioIdx: 0,
    phase: "typing" as Phase,
    typedChars: 0,
    revealedStops: 0,
  });
  const scenario = SCENARIOS[state.scenarioIdx];
  const prefersReducedRef = usePrefersReducedMotion();

  // Animation-Sequenz durch useEffect. Alle Timeouts werden bei Umschaltung
  // sauber aufgeräumt damit's kein Race gibt.
  useEffect(() => {
    if (prefersReducedRef.current) {
      // Reduce-motion: direkt komplett anzeigen und dann alle 8s wechseln.
      const timer = setTimeout(() => dispatch({ type: "nextScenario" }), 8000);
      return () => clearTimeout(timer);
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const promptLen = scenario.prompt.length;

    if (state.phase === "typing") {
      if (state.typedChars < promptLen) {
        // 25–55ms pro Zeichen, leicht randomisiert für "Mensch-Feeling"
        const delay = 30 + Math.floor(Math.random() * 25);
        timers.push(setTimeout(() => dispatch({ type: "typeChar" }), delay));
      } else {
        // Fertig getippt → kurz halten, dann "generieren"
        timers.push(setTimeout(() => dispatch({ type: "startGenerating" }), 480));
      }
    } else if (state.phase === "generating") {
      // "Autopilot arbeitet" — realistische Latenz aber nicht zu lang
      timers.push(setTimeout(() => dispatch({ type: "startRevealing" }), 900));
    } else if (state.phase === "revealing") {
      if (state.revealedStops < scenario.stops.length) {
        timers.push(setTimeout(() => dispatch({ type: "revealNext" }), 380));
      } else {
        timers.push(setTimeout(() => dispatch({ type: "startHold" }), 200));
      }
    } else if (state.phase === "hold") {
      // Fertigen Plan 4s halten, dann nächstes Szenario
      timers.push(setTimeout(() => dispatch({ type: "nextScenario" }), 4200));
    }

    return () => timers.forEach((t) => clearTimeout(t));
  }, [state, scenario, prefersReducedRef]);

  const displayedText = scenario.prompt.slice(0, state.typedChars);
  const showCursor = state.phase === "typing" || state.phase === "generating";
  const isGenerating = state.phase === "generating";

  const progressPct = useMemo(() => {
    if (state.phase === "typing") return Math.min(45, Math.round((state.typedChars / scenario.prompt.length) * 45));
    if (state.phase === "generating") return 65;
    if (state.phase === "revealing") return 65 + Math.round((state.revealedStops / scenario.stops.length) * 33);
    return 100;
  }, [state, scenario]);

  return (
    <div
      className="pd24-card-featured overflow-hidden"
      style={{ background: "rgba(255,253,248,0.96)" }}
      aria-label="Live-Demo eines PerfectDay24-Plans"
      role="img"
    >
      {/* Fake Browser Chrome — signalisiert "Dies ist unser Produkt" */}
      <div className="flex items-center justify-between border-b border-[var(--line-subtle)] bg-[rgba(255,253,248,0.78)] px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/70" />
        </div>
        <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-soft-warm)]">
          perfectday24.de / planner
        </div>
        <div className="text-[10px] font-semibold text-[var(--brand-warm)]">Live-Demo</div>
      </div>

      {/* Prompt-Input mit tippendem Cursor */}
      <div className="border-b border-[var(--line-subtle)] bg-white px-4 py-4">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft-warm)]">
          Was möchtest du planen?
        </div>
        <div className="flex items-stretch gap-2">
          <div className="flex flex-1 items-center rounded-xl border border-[var(--line-strong)] bg-white px-3.5 py-2.5 text-sm text-[var(--text-strong)] shadow-inner">
            <span className="min-h-5">{displayedText}</span>
            {showCursor ? (
              <span
                className="ml-0.5 inline-block h-4 w-[2px] bg-[var(--brand-warm)]"
                style={{ animation: "pd24-caret-blink 0.9s steps(2) infinite" }}
              />
            ) : null}
          </div>
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--text-strong)] px-4 py-2 text-xs font-semibold text-white opacity-95"
          >
            {isGenerating ? (
              <>
                <span
                  className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-transparent"
                  aria-hidden
                />
                Baut…
              </>
            ) : (
              <>
                ✨ Autopilot
              </>
            )}
          </button>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-[rgba(196,137,79,0.15)]">
          <div
            className="h-full rounded-full bg-[var(--brand-warm)] transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Plan-Header */}
      <div className="bg-white px-4 pt-4">
        <div
          className="flex items-center justify-between gap-3"
          style={{
            opacity: state.phase === "typing" || state.phase === "generating" ? 0.4 : 1,
            transition: "opacity 300ms ease",
          }}
        >
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-warm)]">
              {scenario.cityLabel}
            </div>
            <div className="mt-0.5 truncate text-base font-semibold tracking-tight text-[var(--text-strong)]">
              {scenario.planTitle}
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-[rgba(196,137,79,0.32)] bg-[rgba(255,249,241,0.85)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-warm)]">
            {scenario.peakTag}
          </span>
        </div>
      </div>

      {/* Stops-Liste */}
      <div className="space-y-2 bg-white px-4 pb-4 pt-3">
        {scenario.stops.map((stop, i) => {
          const visible = state.phase === "hold" || (state.phase === "revealing" && i < state.revealedStops);
          return (
            <div
              key={`${state.scenarioIdx}-${i}`}
              className="grid grid-cols-[46px_1fr_auto] items-start gap-2.5 rounded-xl border border-[var(--line-subtle)] bg-[rgba(255,253,248,0.72)] px-3 py-2.5"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(6px)",
                transition: "opacity 320ms ease, transform 320ms ease",
                transitionDelay: visible ? "0ms" : "0ms",
              }}
            >
              <div className="text-[11px] font-semibold text-[var(--brand-warm)]">{stop.time}</div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft-warm)]">
                  {stop.label}
                </div>
                <div className="mt-0.5 truncate text-sm font-medium text-[var(--text-strong)]">
                  {stop.name}
                </div>
                <div className="mt-0.5 truncate text-[11px] leading-4 text-[var(--text-muted-warm)]">
                  {stop.hint}
                </div>
              </div>
              <div className="flex h-6 min-w-6 items-center justify-center rounded-md bg-[var(--text-strong)] px-1.5 text-[10px] font-semibold text-white">
                {i + 1}
              </div>
            </div>
          );
        })}
      </div>

      {/* Szenario-Pagination — subtile Punkte */}
      <div className="flex items-center justify-center gap-1.5 border-t border-[var(--line-subtle)] bg-[rgba(255,253,248,0.72)] py-2.5">
        {SCENARIOS.map((_, i) => (
          <span
            key={i}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: i === state.scenarioIdx ? 18 : 6,
              backgroundColor:
                i === state.scenarioIdx ? "var(--brand-warm)" : "rgba(196,137,79,0.24)",
            }}
          />
        ))}
      </div>

      {/* Blink-Keyframe für den Cursor. Scoped ins Component. */}
      <style>{`
        @keyframes pd24-caret-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
