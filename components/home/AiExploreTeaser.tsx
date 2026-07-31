"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Suggestion = {
  text: string;
  hint: string;
};

const SUGGESTIONS: Suggestion[] = [
  { text: "Date-Abend in München mit Live-Konzert", hint: "Hauptmoment Event · 18–23 Uhr" },
  { text: "Familientag in Berlin mit Museum und Park", hint: "Tagesplan · Mittagspause · viel Bewegung" },
  { text: "JGA-Wochenende in Hamburg, sportlich aber nicht zu wild", hint: "2 Tage · Mix Aktiv + Ausgehen" },
  { text: "Stadtreise nach Köln, erstes Mal, alles wichtige in einem Tag", hint: "9–22 Uhr · Highlights · Food" },
  { text: "Geburtstag in Leipzig für 30 Personen, Catering und Location nötig", hint: "Event-Wizard · Anbieter · Preise" },
  { text: "Solotrip Dresden mit Fotospots am Abend", hint: "Golden Hour · Aussichten · Bar" },
];

export default function AiExploreTeaser() {
  const [hovered, setHovered] = useState<string | null>(null);
  const router = useRouter();

  function handlePick(text: string) {
    // Route to homepage hero — that's where HeroIntentBar lives.
    // Eventually: dedicated /explore?q=... endpoint with full LLM-Explore.
    router.push(`/?intent=${encodeURIComponent(text)}#hero-proof`);
  }

  return (
    <div className="rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[linear-gradient(160deg,rgba(255,253,248,0.95),rgba(255,249,241,0.85))] p-6 shadow-[var(--shadow-soft)] sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="pd24-kicker-warm flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand-warm)] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--brand-warm)]" />
            </span>
            AI Explore · Inspiration
          </div>
          <h2 className="mt-3 pd24-display text-3xl tracking-tight text-[var(--text-strong)] sm:text-4xl">
            Du weißt noch nicht was? Hier ein paar Ideen.
          </h2>
          <p className="mt-3 text-base leading-7 text-[var(--text-muted-warm)]">
            Klick eine Idee an und der Autopilot baut den Tag. Oder schreib was Eigenes oben in den Hero.
          </p>
          <Link
            href="/explore"
            className="mt-5 inline-flex min-h-10 items-center text-sm font-medium text-[var(--text-strong)] underline-offset-2 hover:underline"
          >
            Mehr Routen entdecken →
          </Link>
        </div>

        <div className="space-y-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.text}
              type="button"
              onClick={() => handlePick(s.text)}
              onMouseEnter={() => setHovered(s.text)}
              onMouseLeave={() => setHovered(null)}
              className={`group flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                hovered === s.text
                  ? "border-[var(--brand-warm)] bg-white shadow-sm"
                  : "border-[var(--line-subtle)] bg-white/82 hover:border-[rgba(196,137,79,0.4)]"
              }`}
            >
              <span className="mt-1 text-xs">✨</span>
              <span className="flex-1">
                <span className="block text-sm font-medium text-[var(--text-strong)]">
                  &bdquo;{s.text}&ldquo;
                </span>
                <span className="mt-0.5 block text-xs text-[var(--text-muted-warm)]">{s.hint}</span>
              </span>
              <span className="mt-1 text-xs text-[var(--brand-warm-ink)] opacity-0 transition group-hover:opacity-100">
                →
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
