"use client";

import { useCallback, useState } from "react";
import { getInterestCatalog } from "@/lib/planner/interest";
import type { FamilyAgeBand } from "@/lib/planner";

interface PlannerSetupModalProps {
  isOpen: boolean;
  cities: Array<{ slug: string; name: string }>;
  onSetup: (config: {
    occasion: string;
    citySlug: string;
    budget: string;
    planMode: string;
    interests: string[];
  }) => void;
}

const OCCASIONS = [
  { id: "date", label: "Date Night", emoji: "💑" },
  { id: "friends", label: "Mit Freunden", emoji: "👯" },
  { id: "family", label: "Familientag", emoji: "👨‍👩‍👧‍👦" },
  { id: "tourism", label: "Stadt erkunden", emoji: "🗺️" },
  { id: "party", label: "Party/Events", emoji: "🎉" },
];

const BUDGETS = [
  { id: "low", label: "Budget (kostenlos)", emoji: "💰" },
  { id: "medium", label: "Gemischt", emoji: "💵" },
  { id: "high", label: "Großzügig", emoji: "💎" },
];

const INTEREST_GROUP_LABELS: Record<string, string> = {
  food: "Küche & Food",
  activity: "Aktivität",
  sightseeing: "Sightseeing & Kultur",
  nightlife: "Nightlife & Drinks",
  ambience: "Ambiente & Outdoor",
};

export default function PlannerSetupModal({ isOpen, cities, onSetup }: PlannerSetupModalProps) {
  const [step, setStep] = useState(1);
  const [selectedOccasion, setSelectedOccasion] = useState("date");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedBudget, setSelectedBudget] = useState("medium");
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(new Set());
  const [citySearch, setCitySearch] = useState("");

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
  };

  const handleContinue = useCallback(() => {
    if (step === 1 && !selectedOccasion) return;
    if (step === 2 && !selectedCity) return;
    if (step === 4) {
      const planMode = selectedOccasion === "date" || selectedOccasion === "friends" ? "evening" : "midday";
      onSetup({
        occasion: selectedOccasion,
        citySlug: selectedCity!,
        budget: selectedBudget,
        planMode,
        interests: Array.from(selectedInterests),
      });
      return;
    }
    setStep(step + 1);
  }, [step, selectedOccasion, selectedCity, selectedBudget, selectedInterests, onSetup]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-slate-900">
        {/* Step 1: Occasion */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Was für ein Anlass?</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Wähle, wofür du planen möchtest</p>
            <div className="grid grid-cols-1 gap-2 pt-4">
              {OCCASIONS.map((occasion) => (
                <button
                  key={occasion.id}
                  onClick={() => setSelectedOccasion(occasion.id)}
                  className={`rounded-lg px-4 py-3 text-left transition-all ${
                    selectedOccasion === occasion.id
                      ? "bg-slate-900 text-white dark:bg-blue-600"
                      : "border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  }`}
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

        {/* Step 2: City */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Welche Stadt?</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Suchiere oder wähle eine Stadt</p>
            <input
              type="text"
              placeholder="Stadt suchen..."
              value={citySearch}
              onChange={(e) => setCitySearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            />
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {filteredCities.slice(0, 20).map((city) => (
                <button
                  key={city.slug}
                  onClick={() => setSelectedCity(city.slug)}
                  className={`rounded-lg px-3 py-2 text-sm transition-all ${
                    selectedCity === city.slug
                      ? "bg-slate-900 text-white dark:bg-blue-600"
                      : "border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  }`}
                >
                  {city.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Budget */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Dein Budget?</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Wie großzügig soll es sein?</p>
            <div className="grid grid-cols-1 gap-2 pt-4">
              {BUDGETS.map((budget) => (
                <button
                  key={budget.id}
                  onClick={() => setSelectedBudget(budget.id)}
                  className={`rounded-lg px-4 py-3 text-left transition-all ${
                    selectedBudget === budget.id
                      ? "bg-slate-900 text-white dark:bg-blue-600"
                      : "border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  }`}
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

        {/* Step 4: Interests */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Deine Interessen</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Wähle deine Vorlieben (optional)</p>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {Object.entries(interestCatalog).map(([group, interests]) => (
                <div key={group}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {INTEREST_GROUP_LABELS[group] ?? group}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {interests.map((interest) => (
                      <button
                        key={interest}
                        onClick={() => toggleInterest(interest)}
                        className={`rounded-full px-3 py-1 text-sm transition ${
                          selectedInterests.has(interest)
                            ? "bg-slate-900 text-white dark:bg-blue-600"
                            : "border border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
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

        {/* Footer */}
        <div className="mt-6 flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2 transition-all hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Zurück
            </button>
          )}
          <button
            onClick={handleContinue}
            disabled={
              (step === 1 && !selectedOccasion) ||
              (step === 2 && !selectedCity)
            }
            className="flex-1 rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition-all hover:bg-slate-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            {step === 4 ? "Plan erstellen" : "Weiter"}
          </button>
        </div>
      </div>
    </div>
  );
}
