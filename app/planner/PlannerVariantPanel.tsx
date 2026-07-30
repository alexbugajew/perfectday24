import type { PlannedStop } from "@/lib/planner";
import type {
  LeadingVariantSummary,
  OccasionPhaseMeta,
  PlannerApiResponse,
  PlannerVoteMoment,
  PlanVariant,
  SharedPlanChoiceReactionSummary,
} from "./types";

type OccasionFlowEntry = {
  stop: PlannedStop;
  meta: OccasionPhaseMeta | null;
  phaseGoal: string | null;
};

type PlannerVariantPanelProps = {
  activeVariant: PlanVariant | null;
  pinnedVariant: PlanVariant | null;
  leadingVariant: LeadingVariantSummary | null;
  currentShareChoiceSummary: SharedPlanChoiceReactionSummary | null;
  plannerVoteMoment: PlannerVoteMoment | null;
  shareVoteMoment: PlannerVoteMoment | null;
  plannerData: PlannerApiResponse | null;
  selectedVariantId: string;
  variantVotes: Record<string, string[]>;
  reactionParticipants: string[];
  majorityThreshold: number;
  groupEnabled: boolean;
  occasion: string;
  occasionFlow: OccasionFlowEntry[];
  expandedText: string | null;
  relaxedText: string | null;
  plannerError: string | null;
  authReady: boolean;
  userId: string | null;
  authLoading: boolean;
  onRerollPlan: () => void;
  onResetPlan: () => void;
  onTogglePinnedVariant: (variantId: string) => void;
  onCopyPinnedChoiceSummary: () => void;
  onOpenChoiceInChat: () => void;
  onOpenReminderInChat: () => void;
  onContinueAsGuest: () => void | Promise<void>;
  onSelectVariant: (variantId: string) => void;
  onToggleVariantReaction: (variantId: string, participantName: string) => void;
  showPlanHeader?: boolean;
};

function occasionFlowDescription(occasion: string) {
  if (occasion === "date") {
    return "Der Plan folgt einer bewusst aufgebauten Abfolge statt nur einzelne passende Orte zu listen.";
  }
  if (occasion === "family") {
    return "Der Plan balanciert Highlight, Essen, freie Spielzeit und rechtzeitigen Ausklang statt nur Orte aneinanderzureihen.";
  }
  if (occasion === "friends") {
    return "Der Plan bleibt modular und sozial: gemeinsames Erlebnis, Essen als Anker und ein klarer Peak-Moment.";
  }
  if (occasion === "tourism") {
    return "Der Plan priorisiert Must-sees, kurze Wege und bewusste Genussphasen statt hektischem Zick-Zack-Sightseeing.";
  }
  return "Der Plan steigert die Nacht bewusst vom Warm-up über Pre-Drinks bis zum Peak und hält danach den Late Flow zusammen.";
}

function cleanOccasionFlowDescription(description: string) {
  return description
    .replace(/^Diese\s+[^:]+:\s*/i, "")
    .replace(/^Der Plan folgt einer bewusst aufgebauten Abfolge statt nur einzelne passende Orte zu listen\.\s*/i, "")
    .trim();
}

function variantDramaValues(variant: PlanVariant | null, count: number) {
  const patterns: Record<PlanVariant["goal"], number[]> = {
    best_match: [42, 56, 72, 88, 68],
    shortest_route: [50, 58, 64, 70, 56],
    more_diverse: [48, 78, 54, 90, 64],
    premium: [38, 58, 76, 96, 72],
  };
  const pattern = patterns[variant?.goal ?? "best_match"];

  return Array.from({ length: count }, (_, index) => {
    if (count <= 1) return pattern[0] ?? 56;
    const scaledIndex = Math.round((index / Math.max(1, count - 1)) * (pattern.length - 1));
    return pattern[Math.min(pattern.length - 1, scaledIndex)] ?? 56;
  });
}

function formatVariantMinutes(minutes: number | null | undefined) {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return "-";
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours <= 0) return `${Math.round(minutes)} Min`;
  if (rest <= 0) return `${hours} h`;
  return `${hours} h ${rest} Min`;
}

function formatVariantDistance(km: number | null | undefined) {
  if (typeof km !== "number" || !Number.isFinite(km) || km <= 0) return "-";
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

function variantGoalLabel(goal: PlanVariant["goal"]) {
  if (goal === "shortest_route") return "Kürzeste Wege";
  if (goal === "more_diverse") return "Mehr Vielfalt";
  if (goal === "premium") return "Premium-Fokus";
  return "Bester Fit";
}

function variantGoalCopy(goal: PlanVariant["goal"]) {
  if (goal === "shortest_route") {
    return "Priorisiert weniger Transferzeit und ruhigere Übergänge.";
  }
  if (goal === "more_diverse") {
    return "Mischt bewusst verschiedene Kategorien und Stimmungen.";
  }
  if (goal === "premium") {
    return "Setzt stärker auf hochwertige Orte und besondere Momente.";
  }
  return "Balanciert Match, Timing, Entfernung und Anlass.";
}

function variantQualityMetrics(variant: PlanVariant) {
  const activeStops = variant.plannedStops.filter((stop) => stop.item).length;
  const eventStops = variant.plannedStops.filter((stop) => stop.item?.source_primary === "planner_event").length;
  // "Fest" heisst: an eine Event-Uhrzeit gebunden, nicht verschiebbar.
  // Frueher zaehlte das jede geplante Uhrzeit (auch leerer Slots) — Ergebnis
  // war "3 fix" bei 2 Stops und fuer Nutzer unverstaendlich.
  const lockedStops = variant.plannedStops.filter(
    (stop) => stop.item && stop.timingLock === "event"
  ).length;

  return [
    { label: "Stops", value: String(activeStops) },
    { label: "Dauer", value: formatVariantMinutes(variant.fallbackSummary.totalMin) },
    { label: "Weg", value: formatVariantMinutes(variant.fallbackSummary.travelMin) },
    { label: "Distanz", value: formatVariantDistance(variant.fallbackSummary.distanceKm) },
    { label: "Events", value: eventStops > 0 ? String(eventStops) : "0" },
    { label: "Timing", value: lockedStops > 0 ? `${lockedStops}× fest` : "flexibel" },
  ];
}

// Uebersetzt den internen totalScore in eine relative, verstaendliche Aussage.
// Roh-Werte wie "Score 991" sagen Nutzern nichts — relativ zur besten Variante
// schon ("Beste Passung" / "Passung 65 %").
function variantFitLabel(variant: PlanVariant, allVariants: PlanVariant[]): string | null {
  if (typeof variant.totalScore !== "number") return null;
  const scores = allVariants
    .map((v) => v.totalScore)
    .filter((s): s is number => typeof s === "number" && s > 0);
  if (scores.length === 0 || variant.totalScore <= 0) return null;
  const max = Math.max(...scores);
  if (variant.totalScore >= max) return "Beste Passung";
  return `Passung ${Math.round((variant.totalScore / max) * 100)} %`;
}

function variantProofBadges(variant: PlanVariant) {
  return [variantGoalLabel(variant.goal), ...(variant.badges ?? []).slice(0, 3)].filter(Boolean);
}

export default function PlannerVariantPanel({
  activeVariant,
  pinnedVariant,
  leadingVariant,
  currentShareChoiceSummary,
  plannerVoteMoment,
  shareVoteMoment,
  plannerData,
  selectedVariantId,
  variantVotes,
  reactionParticipants,
  majorityThreshold,
  groupEnabled,
  occasion,
  occasionFlow,
  expandedText,
  relaxedText,
  plannerError,
  authReady,
  userId,
  authLoading,
  onRerollPlan,
  onResetPlan,
  onTogglePinnedVariant,
  onCopyPinnedChoiceSummary,
  onOpenChoiceInChat,
  onOpenReminderInChat,
  onContinueAsGuest,
  onSelectVariant,
  onToggleVariantReaction,
  showPlanHeader = true,
}: PlannerVariantPanelProps) {
  return (
    <>
      {showPlanHeader ? (
      <div className="mb-3 rounded-lg border border-[var(--line-subtle)] bg-white p-3 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Dein Plan</h2>
          {activeVariant ? (
            <div className="mt-1 text-sm text-[var(--text-muted)]">
              <span className="font-semibold">{activeVariant.label}</span>
              {` · ${variantGoalLabel(activeVariant.goal)}`}
              {pinnedVariant?.variantId === activeVariant.variantId ? " · Unsere Wahl" : ""}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={onRerollPlan} className="rounded-md bg-[var(--text-strong)] px-3 py-1.5 text-xs font-medium text-white">
            neu generieren
          </button>

          <button
            onClick={onResetPlan}
            className="rounded-md border border-[var(--line-subtle)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
          >
            Plan zurücksetzen
          </button>

          {activeVariant ? (
            <button
              onClick={() => onTogglePinnedVariant(activeVariant.variantId)}
              className={`rounded-md border px-3 py-1.5 text-xs ${
                pinnedVariant?.variantId === activeVariant.variantId
                  ? "bg-[var(--brand-accent-cloud)] border-[var(--state-success)]/35 text-[var(--state-success)]"
                  : ""
              }`}
            >
              {pinnedVariant?.variantId === activeVariant.variantId
                ? "Unsere Wahl"
                : "Als unsere Wahl markieren"}
            </button>
          ) : null}

          {(pinnedVariant ?? activeVariant) ? (
            <button onClick={onCopyPinnedChoiceSummary} className="rounded-md border px-3 py-1.5 text-xs">
              Wahltext kopieren
            </button>
          ) : null}

          {(pinnedVariant ?? activeVariant) ? (
            <button onClick={onOpenChoiceInChat} className="rounded-md border px-3 py-1.5 text-xs">
              Im Chat vorbereiten
            </button>
          ) : null}

          {!userId && authReady ? (
            <button
              onClick={() => void onContinueAsGuest()}
              disabled={authLoading}
              className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-60"
            >
              {authLoading ? "Starte Gast..." : "Als Gast fortfahren"}
            </button>
          ) : null}
        </div>
      </div>
      </div>
      ) : null}

      {(leadingVariant || currentShareChoiceSummary) && (
        <div className="mb-4 rounded-xl border border-[var(--brand-accent)]/25 bg-[var(--brand-accent-soft)]/70 p-4 text-sm text-[var(--brand-accent)]">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-semibold">Gruppenzustimmung</div>
              {shareVoteMoment?.tone === "emerald" ? (
                <span className="rounded-full border border-[var(--state-success)]/35 bg-white px-2 py-1 text-[11px] font-medium text-[var(--state-success)]">
                  Unsere Wahl bestätigt
                </span>
              ) : null}
              {shareVoteMoment?.label === "Alle haben bestätigt" ? (
                <span className="rounded-full border border-[var(--brand-accent)]/35 bg-white px-2 py-1 text-[11px] font-medium text-[var(--brand-accent)]">
                  Bereit für den Tag
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {plannerVoteMoment?.label === "Noch 1 Stimme bis zur Gruppenwahl" ||
              shareVoteMoment?.label === "Noch 1 Stimme bis zur Gruppenwahl" ? (
                <button
                  type="button"
                  onClick={onOpenReminderInChat}
                  className="rounded-full border border-[var(--state-warning)]/35 bg-white px-3 py-1 text-[11px] font-medium text-[var(--state-warning)]"
                >
                  Im Chat erinnern
                </button>
              ) : null}
              {currentShareChoiceSummary ? (
                <div className="rounded-full border border-[var(--brand-accent)]/35 bg-white px-3 py-1 text-[11px] font-medium">
                  {currentShareChoiceSummary.count} Bestätigungen im Share-Link
                </div>
              ) : null}
            </div>
          </div>

          {leadingVariant ? (
            <div className="mt-2">
              <div>
                Aktuell führt <span className="font-semibold">{leadingVariant.variant.label}</span> mit{" "}
                {leadingVariant.votes} von {reactionParticipants.length || 0} lokalen Stimmen.
              </div>
              {plannerVoteMoment ? (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span
                    className={`rounded-full border bg-white px-2 py-1 text-[11px] font-medium ${
                      plannerVoteMoment.tone === "emerald"
                        ? "border-[var(--state-success)]/35 text-[var(--state-success)]"
                        : plannerVoteMoment.tone === "amber"
                          ? "border-[var(--state-warning)]/35 text-[var(--state-warning)]"
                          : "border-[var(--brand-accent)]/35 text-[var(--brand-accent)]"
                    }`}
                  >
                    {plannerVoteMoment.label}
                  </span>
                  <span className="text-xs text-[var(--brand-accent)]/80">{plannerVoteMoment.note}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {currentShareChoiceSummary ? (
            <div className="mt-2">
              {pinnedVariant?.label ? (
                <div>
                  <span className="font-semibold">{pinnedVariant.label}</span> wurde bereits über den Share-Link bestätigt.
                </div>
              ) : null}
              {shareVoteMoment ? (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span
                    className={`rounded-full border bg-white px-2 py-1 text-[11px] font-medium ${
                      shareVoteMoment.tone === "emerald"
                        ? "border-[var(--state-success)]/35 text-[var(--state-success)]"
                        : shareVoteMoment.tone === "amber"
                          ? "border-[var(--state-warning)]/35 text-[var(--state-warning)]"
                          : "border-[var(--brand-accent)]/35 text-[var(--brand-accent)]"
                    }`}
                  >
                    {shareVoteMoment.label}
                  </span>
                  <span className="text-xs text-[var(--brand-accent)]/80">{shareVoteMoment.note}</span>
                </div>
              ) : null}
              {currentShareChoiceSummary.voters.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {currentShareChoiceSummary.voters.map((voter) => (
                    <span
                      key={`current-share-${voter}`}
                      className="rounded-full border border-[var(--brand-accent)]/35 bg-white px-2 py-1 text-[11px] text-[var(--brand-accent)]"
                    >
                      {voter}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {plannerData?.variants?.length ? (
        <div className="mb-5 rounded-lg border border-[var(--line-subtle)] bg-white p-4 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="pd24-meta">
                Variantenvergleich
              </div>
              <h3 className="mt-1 text-lg font-semibold tracking-tight text-[var(--text-strong)]">
                Welche Route hat den besten Trade-off?
              </h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--text-muted)]">
                Vergleiche Zeit, Weg, Event-Anker, Timing und Gruppenfit, bevor ihr euch auf eine Route festlegt.
              </p>
            </div>
            <div className="inline-flex w-fit rounded-full border border-[rgba(68,57,46,0.1)] bg-[var(--bg-panel)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
              {plannerData.variants.length} Varianten aktiv
            </div>
          </div>

          {/* ── Mobile: horizontale Chip-Reihe ── */}
          <div className="mt-3 flex gap-2 overflow-x-auto pd24-scrollbar-none pb-1 md:hidden">
            {plannerData.variants.map((variant) => {
              const active = variant.variantId === selectedVariantId;
              const voteCount = variantVotes[variant.variantId]?.length ?? 0;
              return (
                <button
                  key={variant.variantId}
                  type="button"
                  onClick={() => onSelectVariant(variant.variantId)}
                  aria-pressed={active}
                  className={`inline-flex shrink-0 flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/30 ${
                    active
                      ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white shadow-sm"
                      : "border-[rgba(68,57,46,0.12)] bg-[rgba(255,253,248,0.94)] text-[var(--text-strong)] hover:border-[var(--brand-accent)]/35 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {active && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                    )}
                    <span className="text-xs font-semibold leading-none">{variant.label}</span>
                  </div>
                  <span className={`text-[10px] leading-none ${active ? "text-white/65" : "text-[var(--text-muted)]"}`}>
                    {variantGoalLabel(variant.goal)}
                    {voteCount > 0 ? ` · ${voteCount} ✓` : ""}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Desktop: vollständige Kacheln ── */}
          <div className="mt-4 hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">
            {plannerData.variants.map((variant) => {
              const active = variant.variantId === selectedVariantId;
              const voteCount = variantVotes[variant.variantId]?.length ?? 0;
              const metrics = variantQualityMetrics(variant);
              const badges = variantProofBadges(variant);

              return (
                <button
                  key={variant.variantId}
                  type="button"
                  onClick={() => onSelectVariant(variant.variantId)}
                  aria-pressed={active}
                  className={`flex h-full flex-col rounded-lg border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/30 ${
                    active
                      ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white shadow-[0_18px_40px_rgba(49,39,27,0.18)]"
                      : "border-[rgba(68,57,46,0.1)] bg-[rgba(255,253,248,0.94)] text-[var(--text-strong)] hover:border-[var(--brand-accent)]/35 hover:bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold leading-snug">{variant.label}</div>
                      <div className={`mt-1 text-[11px] leading-4 ${active ? "text-white/80" : "text-[var(--text-muted)]"}`}>
                        {variantGoalCopy(variant.goal)}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                        active
                          ? "border-white/25 bg-white/10 text-white"
                          : "border-[rgba(68,57,46,0.1)] bg-white text-[var(--text-muted)]"
                      }`}
                    >
                      {active ? "Aktiv" : "Wählen"}
                    </span>
                  </div>

                  <div className={`mt-3 grid grid-cols-3 gap-x-3 gap-y-2 border-t pt-3 ${active ? "border-white/20" : "border-[rgba(68,57,46,0.08)]"}`}>
                    {metrics.map((metric) => (
                      <div key={`${variant.variantId}-${metric.label}`} className="min-w-0">
                        <div className={`text-[10px] uppercase tracking-wide ${active ? "text-white/60" : "text-[var(--text-muted)]"}`}>
                          {metric.label}
                        </div>
                        <div className="mt-0.5 truncate text-xs font-semibold">{metric.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex items-end gap-0.5 h-4">
                    {variantDramaValues(variant, Math.min(8, Math.max(3, variant.plannedStops.length || 5))).map((v, i) => (
                      <div
                        key={`flow-${variant.variantId}-${i}`}
                        className={`flex-1 rounded-[1px] transition-all ${active ? "bg-white/25" : "bg-[rgba(68,57,46,0.12)]"}`}
                        style={{ height: `${Math.round(4 + (v / 100) * 10)}px` }}
                      />
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {badges.slice(0, 4).map((badge) => (
                      <span
                        key={`${variant.variantId}-${badge}`}
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${
                          active
                            ? "border-white/20 bg-white/10 text-white/80"
                            : "border-[rgba(68,57,46,0.1)] bg-white text-[var(--text-muted)]"
                        }`}
                      >
                        {badge}
                      </span>
                    ))}
                  </div>

                  <div className={`mt-auto pt-3 text-[11px] ${active ? "text-white/70" : "text-[var(--text-muted)]"}`}>
                    {(() => {
                      const fit = variantFitLabel(variant, plannerData.variants);
                      const parts = [
                        fit,
                        groupEnabled && variant.groupSummary?.label ? variant.groupSummary.label : null,
                        voteCount > 0 ? `${voteCount} von ${reactionParticipants.length || 0} Stimmen` : null,
                      ].filter(Boolean);
                      return parts.length > 0 ? parts.join(" · ") : variantGoalLabel(variant.goal);
                    })()}
                  </div>
                </button>
              );
            })}
          </div>

        </div>
      ) : null}

      {expandedText ? (
        <div className="mb-3 p-3 border rounded-lg text-sm text-[var(--text-muted)]">{expandedText}</div>
      ) : null}

      {relaxedText ? (
        <div className="mb-4 p-3 border rounded-lg text-sm text-[var(--text-muted)]">{relaxedText}</div>
      ) : null}

      {plannerError ? (
        <div className="mb-4 rounded-lg border border-[var(--state-warning)]/25 bg-[var(--brand-warm-cloud)] p-3 text-sm text-[var(--state-warning)]">
          {plannerError}
        </div>
      ) : null}
    </>
  );
}
