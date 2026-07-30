"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  plannerEventLabel,
  type EventPlanningMode,
  type ExperienceMode,
  type PlannerEventRow,
} from "@/lib/planner";
import {
  eventStrictnessForExperienceMode,
  experienceModeLabel,
  formatPlannerTime,
  providerLabel,
} from "./helpers";

type PlannerEventCandidatesStripProps = {
  experienceMode: ExperienceMode;
  occasion: string;
  cityLabel: string;
  planDate: string;
  eventCandidates: PlannerEventRow[];
  eventPlanningMode: EventPlanningMode;
  setEventPlanningMode: Dispatch<SetStateAction<EventPlanningMode>>;
  selectedEventId: string | null;
  setSelectedEventId: Dispatch<SetStateAction<string | null>>;
  resetPlan: () => void;
  showToast: (msg: string) => void;
};

function eventMetaLine(event: PlannerEventRow) {
  const parts = [
    providerLabel(event.source),
    plannerEventLabel(event.category),
    event.venue_name,
    event.all_day ? "ganztagig" : formatPlannerTime(event.start_at),
  ].filter(Boolean);

  return parts.join(" | ");
}

export default function PlannerEventCandidatesStrip({
  experienceMode,
  occasion,
  cityLabel,
  planDate,
  eventCandidates,
  eventPlanningMode,
  setEventPlanningMode,
  selectedEventId,
  setSelectedEventId,
  resetPlan,
  showToast,
}: PlannerEventCandidatesStripProps) {
  if (experienceMode === "classic") return null;

  const strictness = eventStrictnessForExperienceMode(experienceMode);
  const selectedEvent = eventCandidates.find((event) => event.id === selectedEventId) ?? null;
  const eventLabel = experienceModeLabel(experienceMode, occasion);
  const emptyLabel =
    strictness === "required"
      ? "Für diese Auswahl brauchen wir ein Show- oder Event-Highlight. Sobald Daten für Stadt und Datum vorhanden sind, erscheinen sie hier."
      : "Noch keine passenden Event- oder Markt-Kandidaten für diese Kombination gefunden.";

  return (
    <section
      data-testid="planner-event-candidates-strip"
      className="mt-3 rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="pd24-meta">
            Lokale Event-Kandidaten
          </div>
          <div className="mt-1 text-sm font-semibold text-[var(--text-strong)]">
            {eventLabel} in {cityLabel}
          </div>
          <div className="mt-0.5 text-xs text-[var(--text-muted)]">
            {planDate || "gewähltes Datum"} | {eventCandidates.length} Kandidaten
            {strictness === "required" ? " | Event wird priorisiert" : ""}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setEventPlanningMode("auto");
              if (selectedEventId) setSelectedEventId(null);
              resetPlan();
            }}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              eventPlanningMode === "auto"
                ? "border-[var(--state-warning)] bg-[var(--state-warning)] text-white"
                : "border-[var(--line-subtle)] bg-white text-[var(--text-strong)] hover:bg-[var(--bg-panel)]"
            }`}
          >
            Automatisch
          </button>
          <button
            type="button"
            onClick={() => {
              setEventPlanningMode("disabled");
              setSelectedEventId(null);
              resetPlan();
            }}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              eventPlanningMode === "disabled"
                ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                : "border-[var(--line-subtle)] bg-white text-[var(--text-strong)] hover:bg-[var(--bg-panel)]"
            }`}
          >
            Ohne Event
          </button>
        </div>
      </div>

      {selectedEvent ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--state-warning)]/30 bg-white px-3 py-2 text-xs">
          <div className="min-w-0">
            <span className="font-semibold text-[var(--text-strong)]">Ausgewählt: </span>
            <span className="text-[var(--text-muted)]">{selectedEvent.title}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedEventId(null);
              setEventPlanningMode("auto");
              resetPlan();
            }}
            className="rounded-md border border-[var(--line-subtle)] bg-white px-2.5 py-1 font-medium hover:bg-[var(--bg-panel)]"
          >
            Auswahl lösen
          </button>
        </div>
      ) : null}

      {eventCandidates.length > 0 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {eventCandidates.slice(0, 10).map((event) => {
            const isSelected = selectedEventId === event.id;
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => {
                  setSelectedEventId(event.id);
                  setEventPlanningMode("locked");
                  resetPlan();
                  showToast("Event wird in die Planung übernommen.");
                }}
                className={`min-w-[230px] max-w-[260px] rounded-lg border bg-white px-3 py-2 text-left text-xs transition hover:-translate-y-0.5 hover:shadow-sm ${
                  isSelected
                    ? "border-[var(--state-warning)] ring-2 ring-[var(--state-warning)]/20"
                    : "border-[var(--line-subtle)]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="line-clamp-2 font-semibold text-[var(--text-strong)]">{event.title}</div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${
                      isSelected
                        ? "border-[var(--state-warning)] bg-[var(--state-warning)] text-white"
                        : "border-[var(--line-subtle)] text-[var(--text-muted)]"
                    }`}
                  >
                    {isSelected ? "aktiv" : "wählen"}
                  </span>
                </div>
                <div className="mt-2 line-clamp-2 text-[var(--text-muted)]">{eventMetaLine(event)}</div>
                {event.summary ? (
                  <div className="mt-2 line-clamp-2 text-[var(--text-muted)]">{event.summary}</div>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-dashed border-[var(--line-subtle)] bg-white px-3 py-2 text-xs text-[var(--text-muted)]">
          {emptyLabel}
        </div>
      )}
    </section>
  );
}
