"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { RouteSummary, PlanMapStop } from "@/components/PlanMap";
import type { RouteProfile, RouteSummaryLite } from "@/lib/planner";
import { routeProfileLabel } from "./helpers";

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
  const mapHeight = mapExpanded ? 440 : 220;

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--line-subtle)] bg-white shadow-[var(--shadow-soft)]">
      <div className="border-b border-[var(--line-subtle)] px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Karte
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-[var(--text-strong)]">
              {effectiveStartPointLabel || "Startpunkt offen"}
            </div>
            <div className="mt-0.5 text-xs text-[var(--text-muted)]">
              {routeProfileLabel(routeProfile)}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMapExpanded((current) => !current)}
            className="shrink-0 rounded-md border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-strong)] hover:border-[var(--line-strong)]"
          >
            {mapExpanded ? "Kleiner" : "Groesser"}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <select
            value={routeProfile}
            onChange={(event) => onRouteProfileChange(event.target.value as RouteProfile)}
            className="min-h-9 rounded-md border border-[var(--line-subtle)] bg-white px-2 text-sm text-[var(--text-strong)]"
          >
            <option value="foot">Zu Fuss</option>
            <option value="public_transit">OePNV</option>
            <option value="car">Auto</option>
          </select>

          <button
            type="button"
            disabled={!googleRouteUrl}
            onClick={() => {
              if (googleRouteUrl) window.open(googleRouteUrl, "_blank", "noreferrer");
            }}
            className="min-h-9 rounded-md bg-[var(--text-strong)] px-3 text-xs font-medium text-white disabled:opacity-50"
          >
            Route
          </button>
        </div>
      </div>

      <div className="transition-[height] duration-200" style={{ height: mapHeight }}>
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
            {plannerLoading ? "Route wird berechnet..." : "Route aktuell nicht verfuegbar."}
            <div className="mt-1">
              Schaetzung: ~{fallbackSummary.distanceKm} km · {fallbackSummary.totalMin} Min
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
