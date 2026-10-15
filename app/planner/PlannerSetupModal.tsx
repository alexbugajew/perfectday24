"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getInterestCatalog } from "@/lib/planner/interest";

export type PlannerSetupConfig = {
  occasion: string;
  citySlug: string;
  budget: string;
  /** null = Schritt 4 nicht angefasst — vorhandene Interessen bleiben unverändert. */
  interests: string[] | null;
};

interface PlannerSetupModalProps {
  cities: Array<{ slug: string; name: string }>;
  citiesLoadError: boolean;
  initial: {
    occasion: string;
    citySlug: string | null;
    budget: string;
    interests: string[];
  };
  onSetup: (config: PlannerSetupConfig) => void;
  onSkip: () => void;
}

const OCCASIONS = [
  { id: "date", label: "Date Night", emoji: "💑" },
  { id: "friends", label: "Mit Freunden", emoji: "👯" },
  { id: "family", label: "Familientag", emoji: "👨‍👩‍👧‍👦" },
  { id: "tourism", label: "Stadt erkunden", emoji: "🗺️" },
  { id: "party", label: "Party/Events", emoji: "🎉" },
];

// Gleiche Werte und Namen wie das Budget-Feld im Planner (budgetLabel): Nur
// „free" schließt kostenpflichtige Orte aus — „low" ist lediglich günstig.
const BUDGETS = [
  { id: "free", label: "Kostenlos", emoji: "🌳" },
  { id: "low", label: "Günstig", emoji: "💰" },
  { id: "medium", label: "Mittel", emoji: "💵" },
  { id: "high", label: "Premium", emoji: "💎" },
];

const INTEREST_GROUP_LABELS: Record<string, string> = {
  food: "Küche & Food",
  activity: "Aktivität",
  sightseeing: "Sightseeing & Kultur",
  nightlife: "Nightlife & Drinks",
  ambience: "Ambiente & Outdoor",
};

// Die Seite hat kein Dark-Theme: Feste PD24-Tokens statt `dark:`-Varianten,
// sonst färbt Tailwind die Box bei System-Dunkelmodus dunkel, während der
// Text die helle Seitenfarbe erbt — praktisch unlesbar.
const OPTION_BASE = "rounded-lg border px-4 py-2.5 text-left transition-colors sm:py-3";
const OPTION_IDLE = "border-[var(--line-subtle)] bg-white text-[var(--text-strong)] hover:bg-[var(--bg-panel)]";
const OPTION_ACTIVE = "border-[var(--text-strong)] bg-[var(--text-strong)] text-white";

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export default function PlannerSetupModal({ cities, citiesLoadError, initial, onSetup, onSkip }: PlannerSetupModalProps) {
  const [step, setStep] = useState(1);
  const [selectedOccasion, setSelectedOccasion] = useState(
    OCCASIONS.some((occasion) => occasion.id === initial.occasion) ? initial.occasion : "date"
  );
  const [selectedCity, setSelectedCity] = useState<string | null>(initial.citySlug);
  const [selectedBudget, setSelectedBudget] = useState(
    BUDGETS.some((budget) => budget.id === initial.budget) ? initial.budget : "medium"
  );
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(new Set(initial.interests));
  const [interestsTouched, setInterestsTouched] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  // Ref statt Effekt-Abhängigkeit: Eine neue onSkip-Identität pro Render würde
  // den Effekt neu starten und den Fokus bei jedem Tastendruck verschieben.
  const onSkipRef = useRef(onSkip);
  useEffect(() => {
    onSkipRef.current = onSkip;
  }, [onSkip]);

  // Fokus in den Dialog, beim Schließen zurück; Escape überspringt, Tab bleibt
  // im Dialog — sonst wandert der Fokus durch den abgedunkelten Planner dahinter.
  useEffect(() => {
    const restoreTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => dialogRef.current?.focus(), 30);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onSkipRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const container = dialogRef.current;
      if (!container) return;
      const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !container.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
      restoreTarget?.focus();
    };
  }, []);

  const interestCatalog = Object.entries(getInterestCatalog()).reduce<Record<string, string[]>>(
    (acc, [interest, spec]) => {
      const group = spec.group;
      if (!acc[group]) acc[group] = [];
      acc[group].push(interest);
      return acc;
    },
    {}
  );

  const filteredCities = cities.filter((city) =>
    city.name.toLowerCase().includes(citySearch.toLowerCase())
  );

  const toggleInterest = (interest: string) => {
    const updated = new Set(selectedInterests);
    if (updated.has(interest)) {
      updated.delete(interest);
    } else {
      updated.add(interest);
    }
    setSelectedInterests(updated);
    setInterestsTouched(true);
  };

  const handleContinue = useCallback(() => {
    if (step === 1 && !selectedOccasion) return;
    if (step === 2 && !selectedCity) return;
    if (step === 4) {
      onSetup({
        occasion: selectedOccasion,
        citySlug: selectedCity!,
        budget: selectedBudget,
        interests: interestsTouched ? Array.from(selectedInterests) : null,
      });
      return;
    }
    setStep(step + 1);
  }, [step, selectedOccasion, selectedCity, selectedBudget, selectedInterests, interestsTouched, onSetup]);

  const titleId = "planner-setup-title";
  const titles = ["Was für ein Anlass?", "Welche Stadt?", "Dein Budget?", "Deine Interessen"];

  return (
    // z-[1350]: über Kopfzeile (1200) und Mobil-Navigation (1300), damit beide
    // abgedunkelt sind; unter dem Tracking-Hinweis (1400), der erreichbar bleiben
    // muss. Auf kleinen Displays liegt der Hinweis bis zur Antwort über dem
    // unteren Rand des Modals — gewollt: Einwilligung zuerst. Mobil oben
    // ausgerichtet, damit möglichst viel des Modals frei bleibt.
    <div className="fixed inset-0 z-[1350] flex items-start justify-center bg-black/50 px-4 pt-4 sm:items-center sm:pt-0">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-lg bg-white p-5 text-[var(--text-strong)] shadow-xl outline-none sm:p-6"
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-[var(--text-muted)]">Schritt {step} von 4</span>
          {/* Notausgang: Wer sofort einen Plan sehen will, soll nicht an der
              Abfrage hängen — der Planner nutzt dann die bisherigen Einstellungen. */}
          <button
            type="button"
            onClick={onSkip}
            className="min-h-9 text-xs font-medium text-[var(--text-muted)] underline-offset-2 hover:text-[var(--text-strong)] hover:underline"
          >
            Überspringen
          </button>
        </div>
        <h2 id={titleId} className="text-2xl font-bold text-[var(--text-strong)]">
          {titles[step - 1]}
        </h2>

        {/* Schritt 1: Anlass zuerst, weil er Tagesmodus und Stop-Mix des Plans bestimmt */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">Wähle, wofür du planen möchtest</p>
            <div className="grid grid-cols-1 gap-2">
              {OCCASIONS.map((occasion) => (
                <button
                  key={occasion.id}
                  type="button"
                  aria-pressed={selectedOccasion === occasion.id}
                  onClick={() => setSelectedOccasion(occasion.id)}
                  className={`${OPTION_BASE} ${selectedOccasion === occasion.id ? OPTION_ACTIVE : OPTION_IDLE}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{occasion.emoji}</span>
                    <span className="font-medium">{occasion.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Schritt 2: Stadt — Pflicht, ohne sie kann der Planner nichts generieren */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">Suche oder wähle eine Stadt</p>
            <input
              type="text"
              aria-label="Stadt suchen"
              placeholder="Stadt suchen …"
              value={citySearch}
              onChange={(e) => setCitySearch(e.target.value)}
              className="w-full rounded-lg border border-[var(--line-strong)] bg-white px-3 py-2 text-[var(--text-strong)] placeholder:text-[var(--text-muted)]"
            />
            {citiesLoadError ? (
              <p className="text-sm text-[var(--text-muted)]">
                Die Städte konnten gerade nicht geladen werden. Mit „Überspringen“ kommst du trotzdem in den Planner.
              </p>
            ) : cities.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Städte werden geladen …</p>
            ) : filteredCities.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Keine passende Stadt gefunden.</p>
            ) : (
              <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
                {filteredCities.slice(0, 20).map((city) => (
                  <button
                    key={city.slug}
                    type="button"
                    aria-pressed={selectedCity === city.slug}
                    onClick={() => setSelectedCity(city.slug)}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                      selectedCity === city.slug ? OPTION_ACTIVE : OPTION_IDLE
                    }`}
                  >
                    {city.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Schritt 3: Budget */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">Wie viel darf der Tag kosten?</p>
            <div className="grid grid-cols-1 gap-2">
              {BUDGETS.map((budget) => (
                <button
                  key={budget.id}
                  type="button"
                  aria-pressed={selectedBudget === budget.id}
                  onClick={() => setSelectedBudget(budget.id)}
                  className={`${OPTION_BASE} ${selectedBudget === budget.id ? OPTION_ACTIVE : OPTION_IDLE}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{budget.emoji}</span>
                    <span className="font-medium">{budget.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Schritt 4: Interessen optional, damit der Einstieg nicht an einer Pflichtauswahl hängt.
            Vorbelegt mit den vorhandenen Interessen; ohne Änderung bleiben sie unangetastet. */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">Wähle deine Vorlieben (optional)</p>
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {Object.entries(interestCatalog).map(([group, interests]) => (
                <div key={group}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {INTEREST_GROUP_LABELS[group] ?? group}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {interests.map((interest) => (
                      <button
                        key={interest}
                        type="button"
                        aria-pressed={selectedInterests.has(interest)}
                        onClick={() => toggleInterest(interest)}
                        className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                          selectedInterests.has(interest) ? OPTION_ACTIVE : OPTION_IDLE
                        }`}
                      >
                        {interest}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-5 flex gap-3">
          {step > 1 && (
            <button type="button" onClick={() => setStep(step - 1)} className="pd24-btn pd24-btn-secondary flex-1">
              Zurück
            </button>
          )}
          <button
            type="button"
            onClick={handleContinue}
            disabled={(step === 1 && !selectedOccasion) || (step === 2 && !selectedCity)}
            className="pd24-btn pd24-btn-primary flex-1 disabled:opacity-50"
          >
            {step === 4 ? "Plan erstellen" : "Weiter"}
          </button>
        </div>
      </div>
    </div>
  );
}
