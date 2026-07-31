"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { RouteSummary, PlanMapStop } from "@/components/PlanMap";
import type { RouteProfile, RouteSummaryLite } from "@/lib/planner";

const PlanMap = dynamic(
  () => import("@/components/PlanMap").then((module) => module.default),
  { ssr: false }
);

type PlannerMapPanelProps = {
  routeProfile: RouteProfile;
  onRouteProfileChange: (profile: RouteProfile) => void;
  googleRouteUrl: string | null;
  effectiveStartPointLabel: string | null;
  mapStops: PlanMapStop[];
  routeSummary: RouteSummary | null;
  onRouteSummaryChange: (summary: RouteSummary | null) => void;
  plannerLoading: boolean;
  fallbackSummary: RouteSummaryLite;
};

const ROUTE_PROFILE_OPTIONS: Array<{ value: RouteProfile; label: string }> = [
  { value: "foot", label: "Zu Fuß" },
  { value: "public_transit", label: "ÖPNV" },
  { value: "car", label: "Auto" },
];

export default function PlannerMapPanel({
  routeProfile,
  onRouteProfileChange,
  googleRouteUrl,
  effectiveStartPointLabel,
  mapStops,
  routeSummary,
  onRouteSummaryChange,
  plannerLoading,
  fallbackSummary,
}: PlannerMapPanelProps) {
  const [mapExpanded, setMapExpanded] = useState(false);
  const mapHeight = mapExpanded ? 440 : 260;
  const routeMetric =
    mapStops.length < 2
      ? "Mind. 2 Punkte"
      : routeSummary
        ? `${routeSummary.totalDistanceKm} km · ${routeSummary.totalDurationMin} Min`
        : `~${fallbackSummary.distanceKm} km · ~${fallbackSummary.totalMin} Min`;

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--line-subtle)] bg-white shadow-[var(--shadow-soft)]">
      <div className="border-b border-[var(--line-subtle)] px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="pd24-meta">
              Karte
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-[var(--text-strong)]">
              {effectiveStartPointLabel || "Startpunkt offen"}
            </div>
            <div className="mt-0.5 text-xs text-[var(--text-muted)]">
              {routeMetric}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMapExpanded((current) => !current)}
            className="inline-flex min-h-9 shrink-0 items-center rounded-md border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-strong)] hover:border-[var(--line-strong)]"
          >
            {mapExpanded ? "Kleiner" : "Größer"}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <div
            className="grid grid-cols-3 rounded-md border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-1"
            role="radiogroup"
            aria-label="Mobilität für Karte auswählen"
          >
            {ROUTE_PROFILE_OPTIONS.map((option) => {
              const active = routeProfile === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onRouteProfileChange(option.value)}
                  className={`min-h-9 rounded px-2 text-xs font-medium transition ${
                    active
                      ? "bg-white text-[var(--text-strong)] shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={!googleRouteUrl}
            onClick={() => {
              if (googleRouteUrl) window.open(googleRouteUrl, "_blank", "noreferrer");
            }}
            className="pd24-btn pd24-btn-sm pd24-btn-primary"
          >
            Route
          </button>
        </div>
      </div>

      <div className="overflow-hidden" style={{ height: mapHeight }}>
        <PlanMap
          stops={mapStops}
          profile={routeProfile}
          height={mapHeight}
          onSummary={onRouteSummaryChange}
        />
      </div>

      <div className="border-t border-[var(--line-subtle)] px-3 py-3 text-xs text-[var(--text-muted)]">
        {mapStops.length < 2 ? (
          <div>Mindestens Start + 1 Stop mit Koordinaten.</div>
        ) : routeSummary ? (
          <div className="space-y-1">
            <div>
              Gesamt: <span className="font-semibold">{routeSummary.totalDistanceKm} km</span> ·{" "}
              <span className="font-semibold">{routeSummary.totalDurationMin} Min</span>
            </div>
            <details>
              <summary className="cursor-pointer font-medium text-[var(--text-strong)]">
                Etappen anzeigen
              </summary>
              <div className="mt-2 space-y-1">
                {routeSummary.legs.map((leg, index) => (
                  <div key={`${leg.fromLabel}-${leg.toLabel}-${index}`}>
                    {leg.fromLabel} bis {leg.toLabel}: {leg.distanceKm} km · {leg.durationMin} Min
                  </div>
                ))}
              </div>
            </details>
          </div>
        ) : (
          <div>
            {plannerLoading ? "Route wird berechnet..." : "Route aktuell nicht verfügbar."}
            <div className="mt-1">
              Schätzung: ~{fallbackSummary.distanceKm} km · {fallbackSummary.totalMin} Min
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
