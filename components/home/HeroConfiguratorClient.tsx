"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const OCCASIONS = [
  { label: "Date Night", value: "date" },
  { label: "Mit Freunden", value: "friends" },
  { label: "Familientag", value: "family" },
  { label: "Solo", value: "solo" },
] as const;

type OccasionValue = (typeof OCCASIONS)[number]["value"];

const CITIES = ["Berlin", "Hamburg", "München", "Köln", "Frankfurt"];

export default function HeroConfiguratorClient() {
  const [occasion, setOccasion] = useState<OccasionValue>("date");
  const [city, setCity] = useState("Berlin");
  const router = useRouter();

  const handleStart = () => {
    const params = new URLSearchParams({ occasion, city });
    router.push(`/planner?${params.toString()}`);
  };

  const selectedLabel = OCCASIONS.find((o) => o.value === occasion)?.label ?? "";

  return (
    <div className="mt-7 flex flex-col gap-4">
      {/* Anlass */}
      <div>
        <div className="mb-2 pd24-meta">
          Anlass
        </div>
        <div className="flex flex-wrap gap-2">
          {OCCASIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setOccasion(o.value)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                occasion === o.value
                  ? "bg-[var(--text-strong)] text-white shadow-sm"
                  : "border border-[var(--line-strong)] bg-white/80 text-[var(--text-muted-warm)] hover:border-[rgba(23,23,23,0.25)] hover:bg-white"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stadt */}
      <div>
        <div className="mb-2 pd24-meta">
          Stadt
        </div>
        <div className="flex flex-wrap gap-2">
          {CITIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCity(c)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                city === c
                  ? "border border-[rgba(183,106,67,0.35)] bg-[rgba(183,106,67,0.12)] text-[var(--brand-warm-deep)]"
                  : "border border-[var(--line-strong)] bg-white/80 text-[var(--text-muted-warm)] hover:border-[rgba(23,23,23,0.25)] hover:bg-white"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* CTA + Social Proof */}
      <div className="flex flex-col items-start gap-3 pt-1">
        <button
          type="button"
          onClick={handleStart}
          className="pd24-btn pd24-btn-primary active:scale-[0.98]"
        >
          {selectedLabel} in {city} planen →
        </button>
        <div className="text-sm text-[var(--text-soft-warm)]">
          {"Kostenlos · Keine Anmeldung nötig · Berlin, Hamburg & mehr"}
        </div>
      </div>
    </div>
  );
}
