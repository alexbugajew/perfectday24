"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ReturnState = {
  citySlug: string | null;
  date: string | null;
  mode: string | null;
  profile: string | null;
};

const MODE_LABELS: Record<string, string> = {
  classic: "Klassisch",
  show: "Show",
  event_visit: "Event",
  market_festival: "Markt",
};

const PROFILE_LABELS: Record<string, string> = {
  foot: "zu Fuss",
  car: "Auto",
  public_transit: "OePNV",
};

function cityLabelFromSlug(slug: string | null) {
  if (!slug || slug === "__auto__") return "letzte Stadt";
  const firstPart = slug.split("-")[0] ?? slug;
  return firstPart.charAt(0).toUpperCase() + firstPart.slice(1);
}

function formatDateLabel(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
}

function readReturnState(): ReturnState | null {
  if (typeof window === "undefined") return null;
  try {
    const citySlug = window.localStorage.getItem("pd24_city_slug");
    const mode = window.localStorage.getItem("pd24_experience_mode");
    const date = window.localStorage.getItem("pd24_plan_date");
    const profile = window.localStorage.getItem("pd24_route_profile");
    if (!citySlug && !mode && !date && !profile) return null;
    return { citySlug, mode, date, profile };
  } catch {
    return null;
  }
}

export default function HomepageReturnPrompt() {
  const [returnState, setReturnState] = useState<ReturnState | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (active) setReturnState(readReturnState());
    };
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener("storage", refresh);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const summary = useMemo(() => {
    if (!returnState) return null;
    return [
      cityLabelFromSlug(returnState.citySlug),
      returnState.mode ? MODE_LABELS[returnState.mode] ?? returnState.mode : null,
      formatDateLabel(returnState.date),
      returnState.profile ? PROFILE_LABELS[returnState.profile] ?? returnState.profile : null,
    ]
      .filter(Boolean)
      .join(" | ");
  }, [returnState]);

  if (!returnState || !summary) return null;

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-[20px] border border-[rgba(23,23,23,0.08)] bg-white/78 p-3 shadow-[0_14px_34px_rgba(49,39,27,0.08)] sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8b7767]">
          Weitermachen
        </div>
        <div className="mt-1 text-sm font-medium text-[#171717]">{summary}</div>
      </div>
      <Link
        href="/planner"
        className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#171717] px-4 text-sm font-semibold text-white transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(23,23,23,0.18)]"
      >
        Planner fortsetzen
      </Link>
    </div>
  );
}
