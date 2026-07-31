import Image from "next/image";
import MonetizedExternalLink from "@/components/monetization/MonetizedExternalLink";
import type { PlannedStop, RouteProfile } from "@/lib/planner";
import type { PublicAffiliateResolution } from "@/lib/monetization/affiliate-shared";
import { stopPhotoFallback } from "@/lib/stop-photo-fallback";
import {
  eventMetaBadges,
  eventTravelPriorityNote,
  formatPlannerTime,
  phaseMeta,
  providerLabel,
  readEventSourceRefs,
  routeProfileLabel,
} from "./helpers";
import type { PlannerApiResponse } from "./types";

type PlannerStopListSectionProps = {
  plannedStops: PlannedStop[];
  occasion: string;
  plannerData: PlannerApiResponse | null;
  routeProfile: RouteProfile;
  activeVariantLabel: string | null;
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

function stringField(source: unknown, key: string) {
  if (!source || typeof source !== "object") return null;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function firstNestedImageUrl(source: unknown) {
  if (!source || typeof source !== "object") return null;
  const payload = (source as Record<string, unknown>).source_payload;
  if (!payload || typeof payload !== "object") return null;
  const images = (payload as Record<string, unknown>).images;
  if (!Array.isArray(images)) return null;

  for (const image of images) {
    const url =
      stringField(image, "url") ??
      stringField(image, "src") ??
      stringField(image, "image_url") ??
      stringField(image, "photo_url");
    if (url) return url;
  }

  return null;
}

function plannerStopImageUrl(stop: PlannedStop) {
  const item = stop.item;
  if (!item) return null;

  const own =
    stringField(item, "photo_url") ??
    stringField(item, "image_url") ??
    stringField(item, "cover_image_url") ??
    stringField(item, "thumbnail_url") ??
    stringField(item, "picture_url") ??
    firstNestedImageUrl(item);

  if (own) return own;

  // Stockfoto-Fallback nach Kategorie. Seed = id, damit derselbe Stop
  // immer dasselbe Foto bekommt.
  // 600x320 passt zum full-width Hero (h-32/h-40) — 200x200 war sichtbar unscharf.
  return stopPhotoFallback({
    category: item.category ?? null,
    type: item.type ?? null,
    sourcePrimary: item.source_primary ?? null,
    seed: String(item.id ?? stop.label ?? stop.index),
    width: 600,
    height: 320,
  });
}

function plannerStopVisualMeta(stop: PlannedStop) {
  const category = stop.item?.category ?? stop.item?.manual_category ?? null;
  const type = stop.item?.type?.toLowerCase() ?? "";

  if (stop.item?.source_primary === "planner_event" || category === "event") {
    return { icon: "EV", label: "Event" };
  }
  if (category === "restaurant" || type.includes("restaurant") || type.includes("food")) {
    return { icon: "FO", label: "Food" };
  }
  if (category === "cafe" || type.includes("cafe") || type.includes("coffee")) {
    return { icon: "CA", label: "Café" };
  }
  if (category === "nightlife" || type.includes("bar") || type.includes("club")) {
    return { icon: "NI", label: "Bar" };
  }
  if (category === "culture" || type.includes("museum") || type.includes("gallery")) {
    return { icon: "CU", label: "Kultur" };
  }
  if (category === "activity" || type.includes("park") || type.includes("tour")) {
    return { icon: "AC", label: "Aktivität" };
  }

  return { icon: "ST", label: "Stop" };
}

function hasPlannerEvent(stop: PlannedStop) {
  return stop.item?.source_primary === "planner_event" || stop.item?.category === "event";
}

function compactReason(reason: string) {
  return reason.replace(/\s+/g, " ").trim();
}

/**
 * Returns max 2 quality signals — focused on what's actually useful to the
 * user (warnings, event anchors, group context, transfer character).
 * Match-score chips, "Zeitfenster gesetzt" and "Guter Einstieg" were noise.
 */
function stopQualitySignals(
  stop: PlannedStop,
  index: number,
  routeProfile: RouteProfile,
  groupEnabled: boolean
): string[] {
  const signals: string[] = [];

  if (stop.timingWarnings?.length) signals.push("Timing prüfen");
  if (hasPlannerEvent(stop)) signals.push("Event-Anker");

  if (groupEnabled && stop.groupDecision) {
    if (stop.groupDecision.compromiseLevel === "shared") signals.push("Gruppenfit");
    else if (stop.groupDecision.compromiseLevel === "balanced") signals.push("Kompromiss");
  }

  if (index > 0 && typeof stop.travelMinFromPrev === "number") {
    if (routeProfile === "foot" && stop.travelMinFromPrev <= 18) signals.push("Fußläufig");
    else if (stop.travelMinFromPrev > 30) signals.push("Längerer Transfer");
  }

  return Array.from(new Set(signals)).slice(0, 2);
}

function visibleStopReasons(stop: PlannedStop) {
  const reasons = (stop.reasons ?? []).map(compactReason).filter(Boolean);
  if (reasons.length > 0) return Array.from(new Set(reasons)).slice(0, 2);
  return (stop.item?.retrievalReasons ?? []).map(compactReason).filter(Boolean).slice(0, 2);
}

function travelConnectorLabel(stop: PlannedStop, routeProfile: RouteProfile): string | null {
  if (typeof stop.travelMinFromPrev !== "number" || stop.travelMinFromPrev <= 0) return null;
  const verb =
    routeProfile === "foot" ? "zu Fuß" : routeProfile === "public_transit" ? "mit ÖPNV" : "mit Auto";
  return `${stop.travelMinFromPrev} Min ${verb}`;
}

export default function PlannerStopListSection({
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
}: PlannerStopListSectionProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--line-subtle)] bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <header className="mb-5 border-b border-[rgba(68,57,46,0.08)] pb-4">
        <div className="pd24-meta">
          Euer Plan
        </div>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-[var(--text-strong)] sm:text-xl">
          {occasion === "date"
            ? "Euer Abend, Schritt für Schritt."
            : occasion === "tourism"
              ? "Euer Tag, Schritt für Schritt."
              : "Euer Plan, Schritt für Schritt."}
        </h3>
        {activeVariantReason ? (
          <p className="mt-1.5 line-clamp-2 max-w-2xl text-xs leading-5 text-[var(--text-muted)] italic sm:text-sm sm:leading-relaxed">
            {activeVariantReason}
          </p>
        ) : null}
      </header>

      <ol className="relative space-y-0">
        {plannedStops.map((stop, i) => {
          const sourceRefs = readEventSourceRefs(stop.item?.source_refs);
          const eventTravelNote = eventTravelPriorityNote(stop, i, routeProfile);
          const imageUrl = plannerStopImageUrl(stop);
          const visualMeta = plannerStopVisualMeta(stop);
          const qualitySignals = stopQualitySignals(stop, i, routeProfile, groupEnabled);
          const primaryReasons = visibleStopReasons(stop);
          const isLast = i === plannedStops.length - 1;
          const phaseLabel =
            phaseMeta(plannerData?.context?.slotTemplate?.[i]?.phase, occasion)?.label ?? null;
          const travelLabel = travelConnectorLabel(stop, routeProfile);

          return (
            <li key={stop.index} className="relative">
              {/* Travel connector before this stop (not for first) */}
              {i > 0 && travelLabel ? (
                <div className="ml-[88px] flex items-center gap-3 py-2 sm:ml-[112px]">
                  <span className="h-5 w-px bg-[rgba(68,57,46,0.18)]" />
                  <span className="text-[11px] text-[var(--text-muted)]">↓ {travelLabel}</span>
                </div>
              ) : null}

              <div
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", String(i));
                  onSetDraggedStopPosition(i);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const fromPosition = Number.parseInt(event.dataTransfer.getData("text/plain"), 10);
                  if (Number.isNaN(fromPosition)) return;
                  onMovePlannedStop(fromPosition, i);
                  onSetDraggedStopPosition(null);
                }}
                onDragEnd={() => onSetDraggedStopPosition(null)}
                className={`relative flex gap-3 sm:gap-4 ${
                  draggedStopPosition === i ? "opacity-60" : ""
                }`}
              >
                {/* Time column + timeline marker */}
                <div className="relative flex w-[72px] shrink-0 flex-col items-end pr-3 sm:w-[96px] sm:pr-4">
                  {stop.scheduledStartAt ? (
                    <>
                      <div className="text-base font-semibold tabular-nums tracking-tight text-[var(--text-strong)] sm:text-lg">
                        {formatPlannerTime(stop.scheduledStartAt)}
                      </div>
                      {stop.scheduledEndAt ? (
                        <div className="text-[11px] tabular-nums text-[var(--text-muted)]">
                          – {formatPlannerTime(stop.scheduledEndAt)}
                        </div>
                      ) : null}
                      {stop.timingLock === "event" ? (
                        <div className="mt-0.5 rounded-full bg-[var(--brand-accent-soft)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--brand-accent)]">
                          fix
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="text-xs text-[var(--text-muted)]">flexibel</div>
                  )}

                  {/* Vertical timeline line + position marker */}
                  <span
                    aria-hidden
                    className="absolute right-0 top-1 z-10 flex h-6 w-6 -translate-x-[-3px] items-center justify-center rounded-full bg-[var(--text-strong)] text-[10px] font-semibold text-white shadow-sm"
                  >
                    {i + 1}
                  </span>
                  {!isLast ? (
                    <span
                      aria-hidden
                      className="absolute right-[10px] top-8 bottom-[-16px] w-px bg-[rgba(68,57,46,0.18)]"
                    />
                  ) : null}
                </div>

                {/* Leerer Slot: kompakte Karte statt voller Foto-Karte — die grosse
                    graue Hero-Flaeche wirkt sonst wie ein Rendering-Fehler. */}
                {!stop.item ? (
                  <div className="min-w-0 flex-1 self-start rounded-lg border border-dashed border-[rgba(68,57,46,0.22)] bg-[rgba(255,253,248,0.6)] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--text-strong)]">
                          {stop.label} · noch offen
                        </div>
                        <div className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">
                          Hier hat aktuell keine Location gepasst. Umkreis erweitern, Mobilität wechseln oder Alternative suchen.
                        </div>
                      </div>
                      <button
                        onClick={() => onBumpStop(i)}
                        className="shrink-0 rounded-md border border-[rgba(68,57,46,0.16)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] shadow-sm transition hover:bg-[var(--bg-panel)]"
                      >
                        Alternative suchen
                      </button>
                    </div>
                  </div>
                ) : (
                <div
                  className={`min-w-0 flex-1 overflow-hidden rounded-lg border ${
                    draggedStopPosition === i
                      ? "border-[rgba(199,104,60,0.32)] bg-[rgba(255,248,240,0.96)]"
                      : "border-[rgba(68,57,46,0.08)] bg-[rgba(255,253,248,0.94)]"
                  }`}
                >
                  {/* Großformatiges Hero-Foto */}
                  <div className="relative h-32 w-full overflow-hidden sm:h-40">
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[linear-gradient(135deg,rgba(248,244,237,0.96),rgba(231,238,242,0.92))]">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[rgba(68,57,46,0.12)] bg-white text-xs font-semibold tracking-[0.14em] text-[var(--text-strong)] shadow-sm">
                        {visualMeta.icon}
                      </div>
                      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        {visualMeta.label}
                      </div>
                    </div>
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={stop.item?.name ? `Bild von ${stop.item.name}` : `${visualMeta.label} Bild`}
                        fill
                        sizes="(min-width: 768px) 500px, 100vw"
                        className="object-cover"
                        loading="lazy"
                        unoptimized
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}
                    {/* Gradient overlay für Lesbarkeit der Chips */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/15" />
                    {/* Phase-Chip oben links */}
                    {phaseLabel ? (
                      <span className="absolute left-3 top-3 rounded-full border border-white/30 bg-white/85 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-strong)] backdrop-blur-sm">
                        {phaseLabel}
                      </span>
                    ) : null}
                    {/* Reorder-Buttons oben rechts — auch am Desktop sichtbar,
                        damit die Reihenfolge ohne Maus-Drag (Tastatur/Screenreader) änderbar ist */}
                    <div className="absolute right-2 top-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onMovePlannedStop(i, Math.max(0, i - 1))}
                        disabled={i === 0}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/85 text-xs text-[var(--text-strong)] backdrop-blur-sm disabled:opacity-40"
                        aria-label="Stop nach oben"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => onMovePlannedStop(i, Math.min(plannedStops.length - 1, i + 1))}
                        disabled={i === plannedStops.length - 1}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/85 text-xs text-[var(--text-strong)] backdrop-blur-sm disabled:opacity-40"
                        aria-label="Stop nach unten"
                      >
                        ↓
                      </button>
                    </div>
                    {/* Name und Type-Pill unten auf dem Foto */}
                    <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                      {stop.item?.type ? (
                        <span className="inline-block rounded-full border border-white/30 bg-white/85 px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)] backdrop-blur-sm">
                          {stop.item.type}
                        </span>
                      ) : null}
                      <div className="mt-1.5 text-base font-semibold leading-tight tracking-tight text-white drop-shadow sm:text-lg">
                        {stop.item?.name ?? stop.label}
                      </div>
                    </div>
                  </div>

                  {/* Content unter dem Foto */}
                  <div className="p-3 sm:p-4">
                    {(stop.hint || stop.durationMin != null) ? (
                      <div className="text-xs text-[var(--text-muted)]">
                        {stop.hint}
                        {stop.durationMin != null ? ` · ${stop.durationMin} Min` : null}
                      </div>
                    ) : null}

                    {/* Max 2 quality signals + warning chip */}
                    {qualitySignals.length > 0 || stop.timingWarnings?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {stop.timingWarnings?.length ? (
                          <span className="pd24-status-error rounded-full px-2 py-0.5 text-[10px] font-medium">
                            ⚠ Timing prüfen
                          </span>
                        ) : null}
                        {qualitySignals
                          .filter((s) => s !== "Timing prüfen")
                          .map((signal) => (
                            <span
                              key={`${stop.index}-${signal}`}
                              className="rounded-full border border-[rgba(68,57,46,0.1)] bg-white px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
                            >
                              {signal}
                            </span>
                          ))}
                      </div>
                    ) : null}

                  {stop.item ? (
                    <>
                      {/* Event quick info */}
                      {stop.item.source_primary === "planner_event" ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--state-warning)]">
                          <span className="font-semibold">
                            {providerLabel(sourceRefs?.source ?? null)}
                          </span>
                          {sourceRefs?.venueName ? <span>· {sourceRefs.venueName}</span> : null}
                          {sourceRefs?.startsAt ? (
                            <span>· Start {formatPlannerTime(sourceRefs.startsAt)}</span>
                          ) : null}
                          <div className="flex flex-wrap gap-1.5">
                            {(() => {
                              const affiliateMatch = affiliateResolution.byPlannerEventId[stop.item!.id] ?? null;
                              const ticketTargetUrl = affiliateMatch?.targetUrl ?? sourceRefs?.ticketUrl ?? null;
                              if (!ticketTargetUrl) return null;
                              return (
                                <MonetizedExternalLink
                                  href={ticketTargetUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  userId={userId}
                                  plannerEventId={stop.item!.id}
                                  partnerProfileId={affiliateMatch?.partnerProfileId ?? null}
                                  affiliateLinkId={affiliateMatch?.id ?? null}
                                  citySlug={effectiveCitySlug}
                                  surface="planner_event_stop"
                                  label={stop.item!.name}
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
                                plannerEventId={stop.item!.id}
                                citySlug={effectiveCitySlug}
                                surface="planner_event_stop"
                                label={stop.item!.name}
                                source="event_source_cta"
                                className="rounded-md border border-[var(--state-warning)]/25 bg-white px-3 py-1.5 text-xs text-[var(--state-warning)] hover:bg-[var(--brand-accent-cloud)]"
                              >
                                Eventquelle öffnen
                              </MonetizedExternalLink>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {/* Reservation CTA for non-events */}
                      {stop.item.source_primary !== "planner_event"
                        ? (() => {
                            const affiliateMatch = affiliateResolution.byLocationId[stop.item!.id] ?? null;
                            const reservationTargetUrl = affiliateMatch?.targetUrl ?? stop.item!.reservation_url ?? null;
                            if (!reservationTargetUrl) return null;
                            return (
                              <div className="mt-3">
                                <MonetizedExternalLink
                                  href={reservationTargetUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  userId={userId}
                                  locationId={stop.item!.id}
                                  partnerProfileId={affiliateMatch?.partnerProfileId ?? null}
                                  affiliateLinkId={affiliateMatch?.id ?? null}
                                  citySlug={effectiveCitySlug}
                                  surface="planner_stop"
                                  label={stop.item!.name}
                                  source={affiliateMatch ? "planner_stop_affiliate_cta" : "planner_stop_primary_cta"}
                                  className="inline-flex min-h-9 items-center rounded-md border border-[rgba(68,57,46,0.12)] bg-white px-3 text-xs text-[var(--text-muted)] hover:bg-[var(--brand-accent-cloud)]"
                                >
                                  {affiliateMatch ? `${affiliateMatch.providerName} öffnen` : "Reservieren"}
                                </MonetizedExternalLink>
                              </div>
                            );
                          })()
                        : null}

                      {/* Action row */}
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <details className="group flex-1">
                          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-[var(--brand-accent)] hover:underline">
                            <span className="select-none transition-transform group-open:rotate-90">▶</span>
                            Warum passt das?
                          </summary>
                          <div className="mt-2 space-y-2 rounded-lg border border-[rgba(68,57,46,0.08)] bg-white/80 p-3">
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
                              <div className="text-xs text-[var(--text-muted)]">
                                Passt zum gewählten Anlass und der Tageszeit.
                              </div>
                            )}
                            {Array.isArray(stop.timingWarnings) && stop.timingWarnings.length ? (
                              <div className="pd24-status-error rounded-lg px-3 py-2">
                                <div className="text-[10px] font-semibold uppercase tracking-wide">
                                  Timing-Hinweise
                                </div>
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
                            {stop.item.source_primary === "planner_event" ? (
                              <div className="rounded-lg border border-[var(--state-warning)]/25 bg-[var(--brand-accent-cloud)]/70 px-3 py-2 text-xs text-[var(--state-warning)] space-y-1">
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
                        </details>
                        <button
                          onClick={() => onBumpStop(i)}
                          aria-label={`Alternative für ${stop.item?.name ?? stop.label} suchen`}
                          className="inline-flex min-h-9 shrink-0 items-center rounded-md border border-[rgba(68,57,46,0.12)] bg-white px-3 text-xs font-medium text-[var(--text-strong)] shadow-sm transition hover:bg-[var(--bg-panel)]"
                        >
                          Alternative
                        </button>
                      </div>
                    </>
                  ) : null}
                  </div> {/* close p-3 sm:p-4 */}
                </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex items-center justify-between border-t border-[rgba(68,57,46,0.08)] pt-3 text-[11px] text-[var(--text-muted)]">
        <span>
          {plannedStops.filter((s) => s.item).length} Stops · {routeProfileLabel(routeProfile)}
        </span>
        <span className="hidden sm:inline">Tipp: Stops verschieben oder &bdquo;Alternative&ldquo; antippen.</span>
      </div>
    </section>
  );
}
