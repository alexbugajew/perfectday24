"use client";

import { useEffect, useRef, useState } from "react";
import type { PlannedStop, RouteProfile } from "@/lib/planner";
import type { PublicAffiliateResolution } from "@/lib/monetization/affiliate-shared";
import DayBlock from "./DayBlock";
import TimelineStop from "./TimelineStop";
import { phaseMeta, routeProfileLabel } from "./helpers";
import { stopDescription } from "./stopDisplay";
import type { PlannerApiResponse } from "./types";

type PlannerTimelineViewProps = {
  plannedStops: PlannedStop[];
  occasion: string;
  plannerData: PlannerApiResponse | null;
  routeProfile: RouteProfile;
  activeVariantReason?: string | null;
  draggedStopPosition: number | null;
  groupEnabled: boolean;
  groupMembersCount: number;
  affiliateResolution: PublicAffiliateResolution;
  userId: string | null;
  effectiveCitySlug: string | null;
  onMovePlannedStop: (fromPosition: number, toPosition: number) => void;
  onSetDraggedStopPosition: (position: number | null) => void;
  onBumpStop: (position: number) => void;
};

// Ein Plan ist genau ein Tag — auch wenn der Ausklang nach Mitternacht liegt.
// Deshalb kommt das Datum aus dem Plan-Kontext und nicht aus den Stop-Zeiten.
function planDateLabel(plannerData: PlannerApiResponse | null, plannedStops: PlannedStop[]) {
  const planDate = plannerData?.context?.planDate ?? null;
  const reference = planDate
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(planDate) ? `${planDate}T12:00:00Z` : planDate)
    : plannedStops[0]?.scheduledStartAt
      ? new Date(plannedStops[0].scheduledStartAt)
      : null;
  if (!reference || !Number.isFinite(reference.getTime())) return null;
  return reference.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

export default function PlannerTimelineView({
  plannedStops,
  occasion,
  plannerData,
  routeProfile,
  activeVariantReason,
  draggedStopPosition,
  groupEnabled,
  groupMembersCount,
  affiliateResolution,
  userId,
  effectiveCitySlug,
  onMovePlannedStop,
  onSetDraggedStopPosition,
  onBumpStop,
}: PlannerTimelineViewProps) {
  // Einladende Location-Beschreibungen: gepflegte Texte kommen direkt mit dem
  // Plan (item.description); fehlende werden on-demand generiert und in der DB
  // gecacht (/api/locations/describe). requestedRef verhindert Doppel-Requests.
  const [aiDescriptions, setAiDescriptions] = useState<Record<string, string>>({});
  const requestedDescriptionIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const missingIds = plannedStops
      .filter(
        (stop) =>
          stop.item &&
          stop.item.source_primary !== "planner_event" &&
          !(typeof stop.item.description === "string" && stop.item.description.trim().length > 0)
      )
      .map((stop) => String(stop.item!.id))
      .filter((id) => !requestedDescriptionIds.current.has(id));
    if (missingIds.length === 0) return;
    missingIds.forEach((id) => requestedDescriptionIds.current.add(id));

    // Bewusst KEIN Abbruch über ein Cleanup-Flag: plannedStops bekommt bei
    // jedem Parent-Render eine neue Identität, das Cleanup würde die Antwort
    // verwerfen, obwohl die IDs schon als angefragt markiert sind. Der
    // Cache-Merge ist idempotent und damit auch nach Re-Renders unbedenklich.
    void (async () => {
      try {
        const res = await fetch("/api/locations/describe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locationIds: missingIds.slice(0, 12) }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as { descriptions?: Record<string, string> };
        if (!json?.descriptions) return;
        setAiDescriptions((prev) => ({ ...prev, ...json.descriptions }));
      } catch {
        // Beschreibungen sind Zusatz-Komfort — Fehler still schlucken.
      }
    })();
  }, [plannedStops]);

  if (plannedStops.length === 0) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">
        <p className="mb-2 text-lg font-medium">Noch keine Stops geplant</p>
        <p className="text-sm">Der Plan wird nach Bestätigung angezeigt</p>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--line-subtle)] bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <header className="border-b border-[rgba(68,57,46,0.08)] pb-4">
        <div className="pd24-meta">Euer Plan</div>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-[var(--text-strong)] sm:text-xl">
          {occasion === "date"
            ? "Euer Abend, Schritt für Schritt."
            : occasion === "tourism"
              ? "Euer Tag, Schritt für Schritt."
              : "Euer Plan, Schritt für Schritt."}
        </h3>
        {activeVariantReason ? (
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-[var(--text-muted)] italic sm:text-sm sm:leading-relaxed">
            {activeVariantReason}
          </p>
        ) : null}
        {/* Ehrlichkeits-Hinweis (Northstar „Echte Orte"): Event-Anlässe in
            Städten ohne angebundene Events liefen bisher stillschweigend als
            normaler Plan — der Nutzer muss erfahren, dass hier (noch) kein
            Event drinsteckt, statt es im Plan zu suchen. */}
        {plannerData &&
        plannerData.context.experienceMode &&
        plannerData.context.experienceMode !== "classic" &&
        plannerData.eventCandidates.length === 0 &&
        !plannedStops.some((stop) => stop.item?.source_primary === "planner_event") ? (
          <p className="mt-2 max-w-2xl rounded-lg border border-[rgba(196,137,79,0.35)] bg-[rgba(255,249,241,0.8)] px-3 py-2 text-xs leading-5 text-[var(--text-strong)] sm:text-sm">
            In dieser Stadt sind noch keine Veranstaltungen angebunden — wir haben dir
            stattdessen einen passenden Tagesplan ohne Event zusammengestellt.
          </p>
        ) : null}
      </header>

      <DayBlock date={planDateLabel(plannerData, plannedStops)} stops={plannedStops}>
        {plannedStops.map((stop, position) => (
          <TimelineStop
            key={`${stop.index}-${stop.item?.id ?? "leer"}`}
            stop={stop}
            position={position}
            totalStops={plannedStops.length}
            phaseLabel={phaseMeta(plannerData?.context?.slotTemplate?.[position]?.phase, occasion)?.label ?? null}
            description={stopDescription(stop, aiDescriptions)}
            routeProfile={routeProfile}
            isDragged={draggedStopPosition === position}
            groupEnabled={groupEnabled}
            groupMembersCount={groupMembersCount}
            affiliateResolution={affiliateResolution}
            userId={userId}
            effectiveCitySlug={effectiveCitySlug}
            onMovePlannedStop={onMovePlannedStop}
            onSetDraggedStopPosition={onSetDraggedStopPosition}
            onBumpStop={onBumpStop}
          />
        ))}
      </DayBlock>

      <div className="flex items-center justify-between border-t border-[rgba(68,57,46,0.08)] pt-3 text-[11px] text-[var(--text-muted)]">
        <span>
          {plannedStops.filter((stop) => stop.item).length} Stops · {routeProfileLabel(routeProfile)}
        </span>
        <span className="hidden sm:inline">Tipp: Stops verschieben oder &bdquo;Alternative&ldquo; antippen.</span>
      </div>
    </section>
  );
}
