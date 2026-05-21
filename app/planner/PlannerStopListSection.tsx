import Image from "next/image";
import MonetizedExternalLink from "@/components/monetization/MonetizedExternalLink";
import { plannerEventLabel, type PlannedStop, type RouteProfile } from "@/lib/planner";
import type { PublicAffiliateResolution } from "@/lib/monetization/affiliate-shared";
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

function plannerStopEventKind(stop: PlannedStop) {
  if (!Array.isArray(stop.item?.subtypes)) return "other";
  const lowerSubtypes = stop.item.subtypes.map((value) => String(value).toLowerCase());
  if (lowerSubtypes.some((value) => value.includes("concert"))) return "concert";
  if (lowerSubtypes.some((value) => value.includes("theater"))) return "theater";
  if (lowerSubtypes.some((value) => value.includes("show"))) return "show";
  if (lowerSubtypes.some((value) => value.includes("market"))) return "market";
  if (lowerSubtypes.some((value) => value.includes("festival"))) return "festival";
  if (lowerSubtypes.some((value) => value.includes("fair"))) return "fair";
  if (lowerSubtypes.some((value) => value.includes("food"))) return "food_event";
  if (lowerSubtypes.some((value) => value.includes("seasonal"))) return "seasonal";
  return "other";
}

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

  return (
    stringField(item, "photo_url") ??
    stringField(item, "image_url") ??
    stringField(item, "cover_image_url") ??
    stringField(item, "thumbnail_url") ??
    stringField(item, "picture_url") ??
    firstNestedImageUrl(item)
  );
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
    return { icon: "CA", label: "Cafe" };
  }
  if (category === "nightlife" || type.includes("bar") || type.includes("club")) {
    return { icon: "NI", label: "Nightlife" };
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

function formatShortMinutes(minutes: number | null | undefined) {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return "-";
  if (minutes < 60) return `${Math.round(minutes)} Min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest > 0 ? `${hours} h ${rest} Min` : `${hours} h`;
}

function compactReason(reason: string) {
  return reason.replace(/\s+/g, " ").trim();
}

function routeQualityMetrics(plannedStops: PlannedStop[], routeProfile: RouteProfile) {
  const activeStops = plannedStops.filter((stop) => stop.item).length;
  const eventStops = plannedStops.filter(hasPlannerEvent).length;
  const timedStops = plannedStops.filter((stop) => stop.scheduledStartAt || stop.timingLock === "event").length;
  const warningCount = plannedStops.reduce((sum, stop) => sum + (stop.timingWarnings?.length ?? 0), 0);
  const travelMinutes = plannedStops.reduce((sum, stop) => sum + (stop.travelMinFromPrev ?? 0), 0);

  return [
    { label: "Stops", value: `${activeStops}/${plannedStops.length}`, note: "aktiv geplant" },
    {
      label: "Event-Anker",
      value: eventStops > 0 ? String(eventStops) : "0",
      note: eventStops > 0 ? "zeitlich eingebaut" : "optional",
    },
    {
      label: "Timing",
      value: warningCount > 0 ? `${warningCount} Hinweis` : timedStops > 0 ? `${timedStops} fix` : "flex",
      note: warningCount > 0 ? "bitte prüfen" : "route stabil",
    },
    { label: "Transfer", value: formatShortMinutes(travelMinutes), note: routeProfileLabel(routeProfile) },
  ];
}

function stopQualitySignals(stop: PlannedStop, index: number, routeProfile: RouteProfile, groupEnabled: boolean) {
  const signals: string[] = [];

  if (hasPlannerEvent(stop)) signals.push("Event-Anker");
  if (stop.timingLock === "event") {
    signals.push("Zeit fixiert");
  } else if (stop.scheduledStartAt) {
    signals.push("Zeitfenster gesetzt");
  } else {
    signals.push("Flexibler Slot");
  }

  if (index === 0) {
    signals.push("Guter Einstieg");
  } else if (typeof stop.travelMinFromPrev === "number") {
    if (stop.travelMinFromPrev <= 12) signals.push("Kurzer Wechsel");
    else if (stop.travelMinFromPrev <= 25) signals.push("Weg geprüft");
    else signals.push("Bewusster Transfer");
  }

  if (groupEnabled && stop.groupDecision) {
    if (stop.groupDecision.compromiseLevel === "shared") signals.push("Gruppenfit");
    else if (stop.groupDecision.compromiseLevel === "balanced") signals.push("Balance-Stop");
    else signals.push("Persönlicher Fit");
  }

  if (typeof stop.item?.totalScore === "number") {
    if (stop.item.totalScore >= 80) signals.push("Hoher Match-Score");
    else if (stop.item.totalScore >= 60) signals.push("Solider Match");
  }

  if (routeProfile === "foot" && index > 0) signals.push("Fußläufig");
  if (stop.timingWarnings?.length) signals.push("Timing prüfen");

  return Array.from(new Set(signals)).slice(0, 5);
}

function visibleStopReasons(stop: PlannedStop) {
  const reasons = (stop.reasons ?? []).map(compactReason).filter(Boolean);
  if (reasons.length > 0) return Array.from(new Set(reasons)).slice(0, 2);

  return (stop.item?.retrievalReasons ?? []).map(compactReason).filter(Boolean).slice(0, 2);
}

export default function PlannerStopListSection({
  plannedStops,
  occasion,
  plannerData,
  routeProfile,
  activeVariantLabel,
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
  const routeMetrics = routeQualityMetrics(plannedStops, routeProfile);

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--line-subtle)] bg-white p-4 shadow-[var(--shadow-soft)]">
      <div className="mb-4 flex flex-col gap-3 border-b border-[rgba(68,57,46,0.08)] pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
            Euer Plan
          </div>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-strong)]">
            {occasion === "date" ? "Euer Abend, Schritt für Schritt." : occasion === "tourism" ? "Euer Tag, Schritt für Schritt." : "Euer Plan, Schritt für Schritt."}
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--text-muted)]">
            Timing, Wege und Reihenfolge — alles aufeinander abgestimmt.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="warm-chip rounded-full px-3 py-1 text-xs">
            {plannedStops.filter((stop) => stop.item).length} Stops aktiv
          </span>
          <span className="rounded-full border border-[rgba(68,57,46,0.08)] bg-[var(--bg-panel)] px-3 py-1 text-xs text-[var(--text-muted)]">
            {routeProfileLabel(routeProfile)}
          </span>
          <span className="rounded-full border border-[rgba(68,57,46,0.08)] bg-[var(--bg-panel)] px-3 py-1 text-xs text-[var(--text-muted)]">
            {activeVariantLabel ?? "Hauptvariante"}
          </span>
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {routeMetrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-lg border border-[rgba(68,57,46,0.08)] bg-[var(--bg-panel)] px-3 py-2"
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {metric.label}
            </div>
            <div className="mt-1 text-base font-semibold tracking-tight text-[var(--text-strong)]">
              {metric.value}
            </div>
            <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{metric.note}</div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {plannedStops.map((stop, i) => {
          const sourceRefs = readEventSourceRefs(stop.item?.source_refs);
          const eventTravelNote = eventTravelPriorityNote(stop, i, routeProfile);
          const imageUrl = plannerStopImageUrl(stop);
          const visualMeta = plannerStopVisualMeta(stop);
          const qualitySignals = stopQualitySignals(stop, i, routeProfile, groupEnabled);
          const primaryReasons = visibleStopReasons(stop);

          return (
            <div
              key={stop.index}
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
              className={`relative overflow-hidden rounded-lg border p-3 shadow-[0_10px_24px_rgba(49,39,27,0.05)] sm:p-4 ${
                draggedStopPosition === i
                  ? "border-[rgba(199,104,60,0.28)] bg-[rgba(255,248,240,0.96)] opacity-75"
                  : "border-[rgba(68,57,46,0.08)] bg-[rgba(255,253,248,0.94)]"
              }`}
            >
              <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-[rgba(199,104,60,0.08)] blur-2xl" />
              <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="relative h-36 overflow-hidden rounded-lg border border-[rgba(68,57,46,0.08)] bg-[var(--bg-panel)] md:h-32 md:w-36 md:shrink-0">
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[linear-gradient(135deg,rgba(248,244,237,0.96),rgba(231,238,242,0.92))] text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md border border-[rgba(68,57,46,0.12)] bg-white text-sm font-semibold tracking-[0.14em] text-[var(--text-strong)] shadow-sm">
                      {visualMeta.icon}
                    </div>
                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {visualMeta.label}
                    </div>
                  </div>
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={stop.item?.name ? `Bild von ${stop.item.name}` : `${visualMeta.label} Bild`}
                      fill
                      sizes="(min-width: 768px) 144px, 100vw"
                      className="object-cover"
                      loading="lazy"
                      unoptimized
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : null}
                  <div className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-[var(--text-strong)] shadow-sm">
                    Slot {i + 1}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--text-strong)] text-xs font-semibold text-white shadow-sm">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                        className="inline-flex cursor-grab items-center gap-1.5 rounded-md border border-[rgba(68,57,46,0.12)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--text-muted)] shadow-sm active:cursor-grabbing"
                      title="Zum Verschieben ziehen"
                    >
                      <span className="text-sm leading-none text-[var(--text-muted)]">⋮⋮</span>
                      <span>Verschieben</span>
                    </span>
                    <div className="flex items-center gap-1 sm:hidden">
                      <button
                        type="button"
                        onClick={() => onMovePlannedStop(i, Math.max(0, i - 1))}
                        disabled={i === 0}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(68,57,46,0.12)] bg-white text-xs text-[var(--text-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Stop nach oben verschieben"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => onMovePlannedStop(i, Math.min(plannedStops.length - 1, i + 1))}
                        disabled={i === plannedStops.length - 1}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(68,57,46,0.12)] bg-white text-xs text-[var(--text-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Stop nach unten verschieben"
                      >
                        ↓
                      </button>
                    </div>
                    {occasion === "date" ||
                    occasion === "family" ||
                    occasion === "friends" ||
                    occasion === "tourism" ||
                    occasion === "party" ? (
                      <span
                        className={`text-[11px] px-2 py-1 rounded-full border font-medium ${
                          occasion === "date"
                            ? "bg-rose-100 text-rose-700 border-rose-200"
                            : occasion === "family"
                              ? "bg-[var(--brand-accent-soft)] text-[var(--brand-accent)] border-[var(--brand-accent)]/25"
                              : occasion === "friends"
                                ? "bg-[var(--brand-accent-cloud)] text-[var(--state-warning)] border-[var(--state-warning)]/25"
                                : occasion === "tourism"
                                  ? "bg-[var(--brand-accent-cloud)] text-[var(--state-success)] border-[var(--state-success)]/25"
                                  : "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200"
                        }`}
                      >
                        {phaseMeta(
                          plannerData?.context.slotTemplate[Math.max(0, stop.index - 1)]?.phase,
                          occasion
                        )?.label ??
                          (occasion === "date"
                            ? "Date-Phase"
                            : occasion === "family"
                              ? "Familien-Phase"
                              : occasion === "friends"
                                ? "Freunde-Phase"
                                : occasion === "tourism"
                                  ? "Tourism-Phase"
                                  : "Party-Phase")}
                      </span>
                    ) : null}
                    <h3 className="text-base font-semibold tracking-tight text-[var(--text-strong)]">
                      {stop.label}{" "}
                      <span className="text-xs font-normal text-[var(--text-muted)]">| {stop.hint}</span>
                    </h3>
                  </div>

                  {stop.item ? (
                    <>
                      <p className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-strong)]">
                        {stop.item.name}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--text-muted)]">
                        <span className="rounded-full border border-[rgba(68,57,46,0.08)] bg-white px-2.5 py-1">
                          {stop.item.type}
                        </span>
                        <span>
                          {stop.durationMin ?? "-"} Min
                          {stop.travelMinFromPrev != null ? ` · ~${stop.travelMinFromPrev} Min Weg` : ""}
                        </span>
                        {stop.item.distanceFromOriginKm != null ? (
                          <span>{stop.item.distanceFromOriginKm.toFixed(1)} km vom Start</span>
                        ) : null}
                      </div>

                      {stop.scheduledStartAt ? (
                        <p className="mt-2 text-xs text-[var(--state-warning)]">
                          Zeitfenster: {formatPlannerTime(stop.scheduledStartAt)}
                          {stop.scheduledEndAt ? ` - ${formatPlannerTime(stop.scheduledEndAt)}` : ""}
                          {stop.timingLock === "event" ? " | Einlass/Event-Zeit fixiert" : ""}
                        </p>
                      ) : null}

                      <div className="mt-3 rounded-lg border border-[rgba(68,57,46,0.08)] bg-white/80 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                            Warum passt das?
                          </div>
                          {stop.timingWarnings?.length ? (
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700">
                              Timing prüfen
                            </span>
                          ) : (
                            <span className="rounded-full border border-[var(--state-success)]/25 bg-[var(--brand-accent-cloud)] px-2 py-1 text-[11px] font-medium text-[var(--state-success)]">
                              Ergebnis plausibel
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {qualitySignals.map((signal) => (
                            <span
                              key={`${stop.index}-${signal}`}
                              className="rounded-full border border-[rgba(68,57,46,0.1)] bg-[var(--bg-panel)] px-2 py-1 text-[11px] text-[var(--text-muted)]"
                            >
                              {signal}
                            </span>
                          ))}
                        </div>
                        {primaryReasons.length ? (
                          <div className="mt-3 grid gap-1.5 text-xs leading-5 text-[var(--text-muted)]">
                            {primaryReasons.map((reason) => (
                              <div key={`${stop.index}-${reason}`} className="flex items-start gap-2">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-muted)]/50" />
                                <span>{reason}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <details className="mt-3 rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2">
                        <summary className="cursor-pointer text-xs font-medium text-[var(--text-strong)]">
                          Details und Begründung
                        </summary>
                        <div className="mt-3 space-y-3">
                      <details className="rounded-lg border border-dashed border-[rgba(68,57,46,0.14)] bg-white px-3 py-2">
                        <summary className="cursor-pointer text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                          Scoring
                        </summary>
                        <div className="mt-2 text-xs text-[var(--text-muted)]">
                          Base: {stop.item.score} | Pref: +{stop.item.prefBoost} | Total: {stop.item.totalScore}
                        </div>
                      </details>

                      {stop.groupDecision && groupEnabled && groupMembersCount > 0 ? (
                        <div className="mt-4 rounded-2xl border border-[var(--brand-accent)]/25 bg-[var(--brand-accent-soft)]/70 p-3 text-xs text-[var(--brand-accent)]">
                          <div className="font-semibold">Gruppenentscheidung</div>
                          <div className="mt-1">
                            {stop.groupDecision.explanation}
                            {stop.groupDecision.matchCount > 0
                              ? ` · für ${stop.groupDecision.matchCount} von ${stop.groupDecision.participantCount}`
                              : ""}
                          </div>
                          {stop.groupDecision.matchedInterests.length > 0 ? (
                            <div className="mt-1 text-[var(--brand-accent)]">
                              Berücksichtigte Vorlieben: {stop.groupDecision.matchedInterests.join(", ")}
                            </div>
                          ) : null}
                          {stop.groupDecision.matchedParticipants.length > 0 ? (
                            <div className="mt-1 text-[var(--brand-accent)]">
                              Besonders passend für: {stop.groupDecision.matchedParticipants.join(", ")}
                            </div>
                          ) : null}
                          {stop.groupDecision.balanceNote ? (
                            <div className="mt-2 rounded-lg border border-[var(--brand-accent)]/35/70 bg-white/80 px-2.5 py-2 text-[var(--brand-accent)]">
                              {stop.groupDecision.balanceNote}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {stop.item.source_primary !== "planner_event" ? (
                        <div className="mt-4 flex gap-2 flex-wrap">
                          {(() => {
                            const affiliateMatch = affiliateResolution.byLocationId[stop.item!.id] ?? null;
                            const reservationTargetUrl =
                              affiliateMatch?.targetUrl ?? stop.item!.reservation_url ?? null;
                            if (!reservationTargetUrl) return null;

                            return (
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
                                className="rounded-lg border border-[rgba(68,57,46,0.12)] bg-white px-3 py-2 text-xs hover:bg-[var(--brand-accent-cloud)]"
                              >
                                {affiliateMatch ? `${affiliateMatch.providerName} öffnen` : "Reservieren"}
                              </MonetizedExternalLink>
                            );
                          })()}
                        </div>
                      ) : null}

                      {stop.item.source_primary === "planner_event" ? (
                        <div className="mt-4 rounded-2xl border border-[var(--state-warning)]/25 bg-[var(--brand-accent-cloud)]/70 p-3">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <div className="text-[11px] uppercase tracking-wide text-[var(--state-warning)]">
                                Event-Highlight
                              </div>
                              <div className="mt-1 text-sm font-semibold text-[var(--state-warning)]">
                                {providerLabel(sourceRefs?.source ?? null)} |{" "}
                                {plannerEventLabel(plannerStopEventKind(stop))}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {eventMetaBadges(stop).map((badge) => (
                                <span
                                  key={badge}
                                  className="rounded-full border border-[var(--state-warning)]/25 bg-white px-2 py-1 text-[11px] text-[var(--state-warning)]"
                                >
                                  {badge}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="mt-2 space-y-1 text-xs text-[var(--state-warning)]">
                            {sourceRefs?.venueName ? (
                              <div>
                                Venue: <span className="font-semibold">{sourceRefs.venueName}</span>
                              </div>
                            ) : null}
                            <div>
                              {sourceRefs?.doorsAt ? (
                                <>
                                  Doors <span className="font-semibold">{formatPlannerTime(sourceRefs.doorsAt)}</span>
                                </>
                              ) : (
                                <>Kein separater Einlass hinterlegt</>
                              )}
                              {sourceRefs?.startsAt ? (
                                <>
                                  {" | "}Start{" "}
                                  <span className="font-semibold">{formatPlannerTime(sourceRefs.startsAt)}</span>
                                </>
                              ) : null}
                              {sourceRefs?.endsAt ? (
                                <>
                                  {" | "}Ende{" "}
                                  <span className="font-semibold">{formatPlannerTime(sourceRefs.endsAt)}</span>
                                </>
                              ) : null}
                            </div>
                          </div>

                          {eventTravelNote ? (
                            <div className="mt-3 rounded-lg border border-[var(--state-warning)]/35/80 bg-white/80 px-3 py-2 text-xs text-[var(--state-warning)]">
                              {eventTravelNote}
                            </div>
                          ) : null}

                          <div className="mt-3 flex gap-2 flex-wrap">
                            {(() => {
                              const affiliateMatch = affiliateResolution.byPlannerEventId[stop.item!.id] ?? null;
                              const ticketTargetUrl =
                                affiliateMatch?.targetUrl ?? sourceRefs?.ticketUrl ?? null;
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
                                  className="rounded-lg border border-[var(--state-warning)]/25 bg-white px-3 py-2 text-xs hover:bg-[var(--brand-accent-cloud)]"
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
                                className="rounded-lg border border-[var(--state-warning)]/25 bg-white px-3 py-2 text-xs hover:bg-[var(--brand-accent-cloud)]"
                              >
                                Eventquelle öffnen
                              </MonetizedExternalLink>
                            ) : null}
                          </div>

                          <div className="mt-2 text-xs text-[var(--state-warning)]">
                            Dieser Stop wurde bewusst als Event-Anker in den Ablauf gezogen. Plane davor lieber etwas mit sicherem Puffer und danach eher einen lockeren Ausklang.
                          </div>
                        </div>
                      ) : null}

                      {Array.isArray(stop.timingWarnings) && stop.timingWarnings.length ? (
                        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-wide text-rose-700">Timing-Hinweise</div>
                          <div className="mt-1 space-y-1">
                            {stop.timingWarnings.map((warning) => (
                              <div key={warning} className="text-xs text-rose-800">
                                {warning}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {stop.reasons?.length ? (
                        <div className="mt-4 rounded-2xl border border-[rgba(68,57,46,0.08)] bg-[var(--bg-panel)]/80 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                            Warum dieser Stop?
                          </div>
                          <div className="mt-2 space-y-2">
                            {stop.reasons.map((reason) => (
                              <div
                                key={reason}
                                className="flex items-start gap-2 text-sm text-[var(--text-muted)]"
                              >
                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--text-muted)]/50" />
                                <span>{reason}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {stop.debug ? (
                        <details className="mt-4 rounded-2xl border border-dashed border-[rgba(68,57,46,0.14)] bg-white p-3">
                          <summary className="cursor-pointer text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                            Policy Trace
                          </summary>
                          <div className="mt-3 space-y-3">
                            <div className="text-xs text-[var(--text-muted)]">
                              Source: {stop.debug.selectedFrom} | Final: {stop.debug.finalScore} | Candidate:{" "}
                              {stop.debug.candidateTotalScore} | Travel feasible:{" "}
                              {stop.debug.travelFeasible ? "ja" : "nein"}
                            </div>
                            <div className="space-y-2">
                              {stop.debug.policyResults.map((result) => (
                                <div key={result.key} className="rounded border p-2 text-xs">
                                  <div className="font-medium">
                                    {result.key} | {result.scoreDelta >= 0 ? "+" : ""}
                                    {result.scoreDelta}
                                    {result.hardFail ? " | hard fail" : ""}
                                  </div>
                                  {result.reasons?.length ? (
                                    <div className="mt-1 text-[var(--text-muted)]">
                                      {result.reasons.join(" | ")}
                                    </div>
                                  ) : null}
                                  {result.meta ? (
                                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-[var(--bg-panel)] p-2 text-[11px] text-[var(--text-muted)]">
                                      {JSON.stringify(result.meta, null, 2)}
                                    </pre>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        </details>
                      ) : null}

                      {stop.item?.retrievalReasons?.length ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-[rgba(68,57,46,0.14)] bg-white p-3">
                          <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                            Retrieval-Signale
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {stop.item.retrievalReasons.slice(0, 3).map((reason) => (
                              <span
                                key={reason}
                                className="text-[11px] px-2 py-1 rounded-full bg-[var(--bg-panel)] text-[var(--text-muted)] border"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                        </div>
                      </details>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-[var(--text-muted)]">
                      Keine passende Location für diesen Block gefunden.
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col gap-2 items-end">
                  <button
                    onClick={() => onBumpStop(i)}
                    aria-label={`Alternative für ${stop.item?.name ?? stop.label} suchen`}
                    className="rounded-md bg-[var(--text-strong)] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:opacity-95"
                  >
                    Alternative suchen
                  </button>

                  {stop.item?.reservation_url ? (
                    <a
                      href={stop.item.reservation_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-[rgba(68,57,46,0.12)] bg-white px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
                    >
                      Reservieren
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
