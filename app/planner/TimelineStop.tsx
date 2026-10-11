"use client";

import Image from "next/image";
import { useState } from "react";
import MonetizedExternalLink from "@/components/monetization/MonetizedExternalLink";
import type { PlannedStop, RouteProfile } from "@/lib/planner";
import type { PublicAffiliateResolution } from "@/lib/monetization/affiliate-shared";
import StopDetailAccordion from "./StopDetailAccordion";
import {
  eventMetaBadges,
  eventTravelPriorityNote,
  formatPlannerTime,
  providerLabel,
  readEventSourceRefs,
} from "./helpers";
import {
  plannerStopImageUrl,
  stopCategoryMeta,
  stopQualitySignals,
  travelConnectorLabel,
  visibleStopReasons,
} from "./stopDisplay";

type TimelineStopProps = {
  stop: PlannedStop;
  position: number;
  totalStops: number;
  phaseLabel: string | null;
  description: string | null;
  routeProfile: RouteProfile;
  isDragged: boolean;
  groupEnabled: boolean;
  groupMembersCount: number;
  affiliateResolution: PublicAffiliateResolution;
  userId: string | null;
  effectiveCitySlug: string | null;
  onMovePlannedStop: (fromPosition: number, toPosition: number) => void;
  onSetDraggedStopPosition: (position: number | null) => void;
  onBumpStop: (position: number) => void;
};

export default function TimelineStop({
  stop,
  position,
  totalStops,
  phaseLabel,
  description,
  routeProfile,
  isDragged,
  groupEnabled,
  groupMembersCount,
  affiliateResolution,
  userId,
  effectiveCitySlug,
  onMovePlannedStop,
  onSetDraggedStopPosition,
  onBumpStop,
}: TimelineStopProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isWhyOpen, setIsWhyOpen] = useState(false);

  const category = stopCategoryMeta(stop);
  const startTime = formatPlannerTime(stop.scheduledStartAt);
  const endTime = formatPlannerTime(stop.scheduledEndAt);
  const timeLabel = startTime ? `${startTime}${endTime ? `–${endTime}` : ""}` : "flexibel";
  // „Alternative" erhöht den Offset eines Slots der Routenkonstruktion
  // (stopOffsets[slot]). Nach manuellem Umsortieren weicht die Anzeigeposition
  // vom Slot ab — index ist slot.index + 1; gespeicherte Pläne ohne index
  // fallen auf die Position zurück.
  const slotPosition = stop.index >= 1 ? stop.index - 1 : position;
  const travelLabel = position > 0 ? travelConnectorLabel(stop, routeProfile) : null;
  const imageUrl = plannerStopImageUrl(stop);
  const qualitySignals = stopQualitySignals(stop, position, routeProfile, groupEnabled).filter(
    (signal) => signal !== "Timing prüfen"
  );
  const primaryReasons = visibleStopReasons(stop);
  const sourceRefs = readEventSourceRefs(stop.item?.source_refs);
  const eventTravelNote = eventTravelPriorityNote(stop, position, routeProfile);
  const isEvent = stop.item?.source_primary === "planner_event";
  const detailsId = `stop-details-${stop.index}-${position}`;
  const whyId = `stop-why-${stop.index}-${position}`;

  return (
    <li
      className="relative"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(position));
        onSetDraggedStopPosition(position);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        event.preventDefault();
        const fromPosition = Number.parseInt(event.dataTransfer.getData("text/plain"), 10);
        if (Number.isNaN(fromPosition)) return;
        onMovePlannedStop(fromPosition, position);
        onSetDraggedStopPosition(null);
      }}
      onDragEnd={() => onSetDraggedStopPosition(null)}
    >
      {travelLabel ? (
        <div className="mb-2 ml-6 text-xs font-medium text-[var(--text-muted)]">↓ {travelLabel}</div>
      ) : null}

      <span
        aria-hidden
        className={`absolute left-[-13px] z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--text-strong)] text-[10px] font-semibold text-white shadow-sm ${
          travelLabel ? "top-[2.25rem]" : "top-3"
        }`}
      >
        {position + 1}
      </span>

      {/* Leerer Slot: kompakte Karte statt voller Stop-Karte — eine leere
          Karte wirkt sonst wie ein Rendering-Fehler. */}
      {!stop.item ? (
        <div
          className={`mb-6 ml-6 rounded-xl border border-dashed border-[rgba(68,57,46,0.22)] bg-[rgba(255,253,248,0.6)] px-4 py-3 ${
            isDragged ? "opacity-60" : ""
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono text-xs font-bold tabular-nums text-[var(--brand-warm-ink)]">{timeLabel}</div>
              <div className="mt-0.5 text-sm font-semibold text-[var(--text-strong)]">{stop.label} · noch offen</div>
              <div className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">
                Hier hat aktuell keine Location gepasst. Umkreis erweitern, Mobilität wechseln oder Alternative suchen.
              </div>
            </div>
            <button
              type="button"
              onClick={() => onBumpStop(slotPosition)}
              className="shrink-0 rounded-md border border-[rgba(68,57,46,0.16)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] shadow-sm transition hover:bg-[var(--bg-panel)]"
            >
              Alternative suchen
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`mb-6 ml-6 rounded-xl border p-4 transition-shadow hover:shadow-md ${
            isDragged
              ? "border-[rgba(199,104,60,0.32)] bg-[rgba(255,248,240,0.96)] opacity-60"
              : "border-[var(--line-subtle)] bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="font-mono text-xs font-bold tabular-nums text-[var(--brand-warm-ink)]">
                {timeLabel}
              </span>
              {stop.timingLock === "event" ? (
                <span className="rounded-full bg-[var(--brand-accent-soft)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--brand-accent)]">
                  fix
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-panel)] px-2 py-0.5 text-xs font-semibold text-[var(--text-strong)]">
                {category.icon} {category.label}
              </span>
              {phaseLabel ? (
                <span className="rounded-full border border-[rgba(68,57,46,0.12)] bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  {phaseLabel}
                </span>
              ) : null}
            </div>
            {/* Reorder-Buttons auch am Desktop sichtbar, damit die Reihenfolge
                ohne Maus-Drag (Tastatur/Screenreader) änderbar ist */}
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onMovePlannedStop(position, Math.max(0, position - 1))}
                disabled={position === 0}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(68,57,46,0.14)] bg-white text-xs text-[var(--text-strong)] disabled:opacity-40"
                aria-label="Stop nach oben"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => onMovePlannedStop(position, Math.min(totalStops - 1, position + 1))}
                disabled={position === totalStops - 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(68,57,46,0.14)] bg-white text-xs text-[var(--text-strong)] disabled:opacity-40"
                aria-label="Stop nach unten"
              >
                ↓
              </button>
            </div>
          </div>

          <div className="mt-3 flex gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[linear-gradient(135deg,rgba(248,244,237,0.96),rgba(231,238,242,0.92))] sm:h-20 sm:w-20">
              <span aria-hidden className="absolute inset-0 flex items-center justify-center text-2xl">
                {category.icon}
              </span>
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={`Bild von ${stop.item.name}`}
                  fill
                  sizes="80px"
                  className="object-cover"
                  loading="lazy"
                  unoptimized
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="break-words text-base font-semibold leading-snug tracking-tight text-[var(--text-strong)] sm:text-lg">
                {stop.item.name ?? stop.label}
              </h4>
              {stop.hint ? <div className="mt-0.5 text-xs text-[var(--text-muted)]">{stop.hint}</div> : null}
            </div>
          </div>

          {description ? <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{description}</p> : null}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {stop.durationMin != null ? (
              <span className="rounded-full border border-[rgba(68,57,46,0.1)] bg-white px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                ⏱️ {stop.durationMin} Min
              </span>
            ) : null}
            {/* Ehrlichkeit statt stillem „geöffnet": Ohne hinterlegte
                Öffnungszeiten behandelt der Planner den Ort als offen —
                das muss der Nutzer sehen, bevor er hinläuft. */}
            {!isEvent &&
            !(typeof stop.item.opening_hours_raw === "string" && stop.item.opening_hours_raw.trim().length > 0) ? (
              <span
                className="rounded-full border border-[rgba(68,57,46,0.1)] bg-white px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
                title="Für diesen Ort liegen uns keine Öffnungszeiten vor — bitte vor dem Besuch kurz prüfen."
              >
                Öffnungszeiten unbestätigt
              </span>
            ) : null}
            {stop.timingWarnings?.length ? (
              <span className="pd24-status-error rounded-full px-2 py-0.5 text-[10px] font-medium">⚠ Timing prüfen</span>
            ) : null}
            {qualitySignals.map((signal) => (
              <span
                key={`${stop.index}-${signal}`}
                className="rounded-full border border-[rgba(68,57,46,0.1)] bg-white px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
              >
                {signal}
              </span>
            ))}
          </div>

          {isEvent ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--state-warning)]">
              <span className="font-semibold">{providerLabel(sourceRefs?.source ?? null)}</span>
              {sourceRefs?.venueName ? <span>· {sourceRefs.venueName}</span> : null}
              {sourceRefs?.startsAt ? <span>· Start {formatPlannerTime(sourceRefs.startsAt)}</span> : null}
              <div className="flex flex-wrap gap-1.5">
                {(() => {
                  const affiliateMatch = affiliateResolution.byPlannerEventId[stop.item.id] ?? null;
                  const ticketTargetUrl = affiliateMatch?.targetUrl ?? sourceRefs?.ticketUrl ?? null;
                  if (!ticketTargetUrl) return null;
                  return (
                    <MonetizedExternalLink
                      href={ticketTargetUrl}
                      target="_blank"
                      rel="noreferrer"
                      userId={userId}
                      plannerEventId={stop.item.id}
                      partnerProfileId={affiliateMatch?.partnerProfileId ?? null}
                      affiliateLinkId={affiliateMatch?.id ?? null}
                      citySlug={effectiveCitySlug}
                      surface="planner_event_stop"
                      label={stop.item.name}
                      source={affiliateMatch ? "ticket_affiliate_cta" : "ticket_cta"}
                      className="rounded-md border border-[var(--state-warning)]/25 bg-white px-3 py-1.5 text-xs text-[var(--state-warning)] hover:bg-[var(--brand-accent-cloud)]"
                    >
                      {affiliateMatch ? `${affiliateMatch.providerName} Tickets` : "Tickets ansehen"}
                    </MonetizedExternalLink>
                  );
                })()}
                {sourceRefs?.sourceUrl ? (
                  <MonetizedExternalLink
                    href={sourceRefs.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    userId={userId}
                    plannerEventId={stop.item.id}
                    citySlug={effectiveCitySlug}
                    surface="planner_event_stop"
                    label={stop.item.name}
                    source="event_source_cta"
                    className="rounded-md border border-[var(--state-warning)]/25 bg-white px-3 py-1.5 text-xs text-[var(--state-warning)] hover:bg-[var(--brand-accent-cloud)]"
                  >
                    Eventquelle öffnen
                  </MonetizedExternalLink>
                ) : null}
              </div>
            </div>
          ) : (
            (() => {
              const affiliateMatch = affiliateResolution.byLocationId[stop.item.id] ?? null;
              const reservationTargetUrl = affiliateMatch?.targetUrl ?? stop.item.reservation_url ?? null;
              if (!reservationTargetUrl) return null;
              return (
                <div className="mt-3">
                  <MonetizedExternalLink
                    href={reservationTargetUrl}
                    target="_blank"
                    rel="noreferrer"
                    userId={userId}
                    locationId={stop.item.id}
                    partnerProfileId={affiliateMatch?.partnerProfileId ?? null}
                    affiliateLinkId={affiliateMatch?.id ?? null}
                    citySlug={effectiveCitySlug}
                    surface="planner_stop"
                    label={stop.item.name}
                    source={affiliateMatch ? "planner_stop_affiliate_cta" : "planner_stop_primary_cta"}
                    className="inline-flex min-h-9 items-center rounded-md border border-[rgba(68,57,46,0.12)] bg-white px-3 text-xs text-[var(--text-muted)] hover:bg-[var(--brand-accent-cloud)]"
                  >
                    {affiliateMatch ? `${affiliateMatch.providerName} öffnen` : "Reservieren"}
                  </MonetizedExternalLink>
                </div>
              );
            })()
          )}

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
              <button
                type="button"
                onClick={() => setIsWhyOpen((open) => !open)}
                aria-expanded={isWhyOpen}
                aria-controls={whyId}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-accent)] hover:underline"
              >
                <span className={`select-none transition-transform ${isWhyOpen ? "rotate-90" : ""}`}>▶</span>
                Warum passt das?
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded((open) => !open)}
                aria-expanded={isExpanded}
                aria-controls={detailsId}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-accent)] hover:underline"
              >
                <span className={`select-none transition-transform ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                Mehr Info
              </button>
            </div>
            <button
              type="button"
              onClick={() => onBumpStop(slotPosition)}
              aria-label={`Alternative für ${stop.item.name ?? stop.label} suchen`}
              className="inline-flex min-h-9 shrink-0 items-center rounded-md border border-[rgba(68,57,46,0.12)] bg-white px-3 text-xs font-medium text-[var(--text-strong)] shadow-sm transition hover:bg-[var(--bg-panel)]"
            >
              Alternative
            </button>
          </div>

          {isWhyOpen ? (
            <div id={whyId} className="mt-2 space-y-2 rounded-lg border border-[rgba(68,57,46,0.08)] bg-white/80 p-3">
              {primaryReasons.length ? (
                <ul className="space-y-1.5 text-xs leading-5 text-[var(--text-muted)]">
                  {primaryReasons.map((reason) => (
                    <li key={`${stop.index}-${reason}`} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-muted)]/50" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-[var(--text-muted)]">Passt zum gewählten Anlass und der Tageszeit.</div>
              )}
              {stop.timingWarnings?.length ? (
                <div className="pd24-status-error rounded-lg px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide">Timing-Hinweise</div>
                  <ul className="mt-1 space-y-1">
                    {stop.timingWarnings.map((warning) => (
                      <li key={warning} className="text-xs">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {stop.groupDecision && groupEnabled && groupMembersCount > 0 ? (
                <div className="rounded-lg border border-[var(--brand-accent)]/25 bg-[var(--brand-accent-soft)]/70 px-3 py-2 text-xs text-[var(--brand-accent)]">
                  <div className="font-semibold">Gruppe</div>
                  <div className="mt-0.5">
                    {stop.groupDecision.explanation}
                    {stop.groupDecision.matchCount > 0
                      ? ` · für ${stop.groupDecision.matchCount} von ${stop.groupDecision.participantCount}`
                      : ""}
                  </div>
                </div>
              ) : null}
              {isEvent ? (
                <div className="space-y-1 rounded-lg border border-[var(--state-warning)]/25 bg-[var(--brand-accent-cloud)]/70 px-3 py-2 text-xs text-[var(--state-warning)]">
                  {sourceRefs?.doorsAt ? (
                    <div>
                      Einlass: <span className="font-semibold">{formatPlannerTime(sourceRefs.doorsAt)}</span>
                    </div>
                  ) : null}
                  {sourceRefs?.endsAt ? (
                    <div>
                      Ende: <span className="font-semibold">{formatPlannerTime(sourceRefs.endsAt)}</span>
                    </div>
                  ) : null}
                  {eventTravelNote ? <div>{eventTravelNote}</div> : null}
                  {eventMetaBadges(stop).length ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {eventMetaBadges(stop).map((badge) => (
                        <span
                          key={badge}
                          className="rounded-full border border-[var(--state-warning)]/25 bg-white px-2 py-0.5 text-[10px]"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {isExpanded ? (
            <div id={detailsId}>
              <StopDetailAccordion
                stop={stop}
                affiliateResolution={affiliateResolution}
                userId={userId}
                effectiveCitySlug={effectiveCitySlug}
              />
            </div>
          ) : null}
        </div>
      )}
    </li>
  );
}
