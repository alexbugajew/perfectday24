"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "pd24_onboarding_done";

const CITIES = ["Berlin", "Hamburg", "München", "Wien", "Zürich", "Köln"];
const OCCASIONS = [
  "Geburtstag",
  "Städtetrip",
  "Date",
  "Familientag",
  "Gruppenausflug",
  "Einfach so",
];
const INTERESTS = [
  "Kultur",
  "Essen & Trinken",
  "Natur",
  "Shopping",
  "Nightlife",
  "Sport",
  "Kunst",
  "Geschichte",
];

type Step = 0 | 1 | 2 | 3;

export default function OnboardingWizard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [city, setCity] = useState("");
  const [occasion, setOccasion] = useState("");
  const [interests, setInterests] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) setOpen(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  function finish() {
    localStorage.setItem(STORAGE_KEY, "1");
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (occasion) params.set("occasion", occasion);
    if (interests.length) params.set("interests", interests.join(","));
    router.push(`/planner?${params.toString()}`);
  }

  function toggleInterest(interest: string) {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  }

  const canAdvance =
    (step === 1 && city !== "") ||
    (step === 2 && occasion !== "") ||
    step === 3;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Willkommen bei PerfectDay24"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[rgba(23,23,23,0.55)] backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg rounded-[var(--radius-hero)] border border-[var(--line-subtle)] bg-[var(--bg-surface-warm)] shadow-[0_32px_96px_rgba(49,39,27,0.22)]">
        {/* Progress bar */}
        <div className="absolute left-6 right-6 top-0 h-[3px] overflow-hidden rounded-full bg-[var(--line-subtle)]">
          <div
            className="h-full rounded-full bg-[var(--text-strong)] transition-all duration-300"
            style={{ width: `${((step + 1) / 4) * 100}%` }}
          />
        </div>

        <div className="px-7 pb-8 pt-8">
          {/* Step 0 — Willkommen */}
          {step === 0 && (
            <div className="text-center">
              <div className="pd24-kicker-warm">
                Willkommen
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--text-strong)]">
                Plane deinen perfekten Tag.
              </h2>
              <p className="mt-3 text-base leading-7 text-[var(--text-muted-warm)]">
                Sag uns kurz, was du planst — wir stellen den besten Startpunkt
                für deinen Planner zusammen. Dauert unter einer Minute.
              </p>
              <div className="mt-7 flex flex-col gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="pd24-btn pd24-btn-primary w-full"
                >
                  Los geht's
                </button>
                <button
                  onClick={dismiss}
                  className="text-sm text-[var(--text-soft-warm)] underline-offset-2 hover:underline"
                >
                  Lieber selbst erkunden
                </button>
              </div>
            </div>
          )}

          {/* Step 1 — Stadt wählen */}
          {step === 1 && (
            <div>
              <div className="pd24-kicker-warm">
                Schritt 1 von 3
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-strong)]">
                In welcher Stadt planst du?
              </h2>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CITIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCity(c)}
                    className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                      city === c
                        ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                        : "border-[var(--line-strong)] bg-white text-[var(--text-strong)] hover:border-[var(--text-strong)]"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Anlass */}
          {step === 2 && (
            <div>
              <div className="pd24-kicker-warm">
                Schritt 2 von 3
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-strong)]">
                Was ist der Anlass?
              </h2>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {OCCASIONS.map((o) => (
                  <button
                    key={o}
                    onClick={() => setOccasion(o)}
                    className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                      occasion === o
                        ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                        : "border-[var(--line-strong)] bg-white text-[var(--text-strong)] hover:border-[var(--text-strong)]"
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 — Interessen */}
          {step === 3 && (
            <div>
              <div className="pd24-kicker-warm">
                Schritt 3 von 3
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-strong)]">
                Was interessiert euch?
              </h2>
              <p className="mt-1 text-sm text-[var(--text-soft-warm)]">Mehrfachauswahl möglich</p>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {INTERESTS.map((i) => (
                  <button
                    key={i}
                    onClick={() => toggleInterest(i)}
                    className={`rounded-2xl border px-3 py-3 text-sm font-medium transition ${
                      interests.includes(i)
                        ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                        : "border-[var(--line-strong)] bg-white text-[var(--text-strong)] hover:border-[var(--text-strong)]"
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Navigation (steps 1–3) */}
          {step > 0 && (
            <div className="mt-7 flex items-center justify-between gap-3">
              <button
                onClick={() => setStep((s) => (s - 1) as Step)}
                className="pd24-btn pd24-btn-sm pd24-btn-secondary"
              >
                Zurück
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={dismiss}
                  className="text-sm text-[var(--text-soft-warm)] underline-offset-2 hover:underline"
                >
                  Überspringen
                </button>
                {step < 3 ? (
                  <button
                    onClick={() => setStep((s) => (s + 1) as Step)}
                    disabled={!canAdvance}
                    className="pd24-btn pd24-btn-sm pd24-btn-primary"
                  >
                    Weiter
                  </button>
                ) : (
                  <button
                    onClick={finish}
                    className="pd24-btn pd24-btn-sm pd24-btn-primary"
                  >
                    Planner öffnen
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
