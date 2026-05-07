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
              {typeof activeVariant.totalScore === "number" ? ` | Score ${activeVariant.totalScore}` : ""}
              {pinnedVariant?.variantId === activeVariant.variantId ? " | Unsere Wahl" : ""}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={onRerollPlan} className="rounded-md bg-[var(--text-strong)] px-3 py-1.5 text-xs font-medium text-white">
            Neu wuerfeln
          </button>

          <button onClick={onResetPlan} className="rounded-md border px-3 py-1.5 text-xs">
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
        <div className="mb-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {plannerData.variants.map((variant) => {
              const active = variant.variantId === selectedVariantId;
              const voteCount = variantVotes[variant.variantId]?.length ?? 0;

              return (
                <button
                  key={variant.variantId}
                  onClick={() => onSelectVariant(variant.variantId)}
                  className={`px-3 py-2 rounded border text-sm ${
                    active
                      ? "bg-[var(--text-strong)] text-white border-[var(--text-strong)]"
                      : "bg-white text-[var(--text-muted)]"
                  }`}
                >
                  <div className="font-medium">{variant.label}</div>
                  {variant.groupSummary?.label ? (
                    <div className={`text-[11px] ${active ? "text-white/80" : "text-[var(--text-muted)]"}`}>
                      {variant.groupSummary.label}
                    </div>
                  ) : null}
                  {voteCount > 0 ? (
                    <div className={`text-[11px] ${active ? "text-white/80" : "text-[var(--state-success)]"}`}>
                      {voteCount} von {reactionParticipants.length || 0}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>

          {activeVariant?.reason ? (
            <details className="hidden">
              <summary className="cursor-pointer list-none font-medium text-[var(--text-strong)]">
                Beschreibung der Variante anzeigen v
              </summary>
              <div className="mt-3">
              {pinnedVariant?.variantId === activeVariant.variantId ? (
                <div className="mb-2 inline-flex rounded-full border border-[var(--state-success)]/25 bg-[var(--brand-accent-cloud)] px-2 py-1 text-[11px] font-medium text-[var(--state-success)]">
                  Unsere Wahl
                </div>
              ) : null}
              {activeVariant.reason}

              {activeVariant.groupSummary ? (
                <div className="mt-3 rounded-xl border border-[var(--brand-accent)]/25 bg-[var(--brand-accent-soft)]/70 p-3 text-xs text-[var(--brand-accent)]">
                  <div className="font-semibold">{activeVariant.groupSummary.label}</div>
                  <div className="mt-1">{activeVariant.groupSummary.note}</div>
                  {activeVariant.groupSummary.badges.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {activeVariant.groupSummary.badges.map((badge) => (
                        <span
                          key={badge}
                          className="rounded-full border border-[var(--brand-accent)]/35 bg-white px-2 py-1 text-[11px] text-[var(--brand-accent)]"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {groupEnabled && reactionParticipants.length > 0 ? (
                <div className="mt-3 rounded-xl border border-[var(--state-success)]/25 bg-[var(--brand-accent-cloud)]/70 p-3 text-xs text-[var(--state-success)]">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="font-semibold">Reaktionen zur Variante</div>
                    <div className="rounded-full border border-[var(--state-success)]/35 bg-white px-2 py-1 text-[11px]">
                      {variantVotes[activeVariant.variantId]?.length ?? 0} von {reactionParticipants.length} haben gewählt
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {reactionParticipants.map((participant) => {
                      const activeReaction =
                        variantVotes[activeVariant.variantId]?.includes(participant) ?? false;
                      return (
                        <button
                          key={`${activeVariant.variantId}-${participant}`}
                          type="button"
                          onClick={() => onToggleVariantReaction(activeVariant.variantId, participant)}
                          className={`rounded-full border px-3 py-1 text-[11px] ${
                            activeReaction
                              ? "border-[var(--state-success)]/45 bg-[var(--brand-accent-cloud)] text-[var(--state-success)]"
                              : "border-[var(--state-success)]/25 bg-white text-[var(--state-success)]"
                          }`}
                        >
                          {participant}
                        </button>
                      );
                    })}
                  </div>
                  {leadingVariant?.variant.variantId === activeVariant.variantId &&
                  leadingVariant.votes >= majorityThreshold ? (
                    <div className="mt-2 text-[var(--state-success)]">
                      Diese Variante hat aktuell die stärkste Zustimmung in der Gruppe.
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeVariant.badges?.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {activeVariant.badges.map((badge) => (
                    <span
                      key={badge}
                      className="text-[11px] px-2 py-1 rounded-full bg-[var(--bg-panel)] text-[var(--text-muted)] border"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              ) : null}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      {(occasion === "date" ||
        occasion === "family" ||
        occasion === "friends" ||
        occasion === "tourism" ||
        occasion === "party") &&
      occasionFlow.length > 0 ? (
        <div
          className={`mb-6 p-4 border rounded-lg ${
            occasion === "date"
              ? "bg-rose-50/60"
              : occasion === "family"
                ? "bg-[var(--brand-accent-soft)]/60"
                : occasion === "friends"
                  ? "bg-[var(--brand-accent-cloud)]/60"
                  : occasion === "tourism"
                    ? "bg-[var(--brand-accent-cloud)]/60"
                    : "bg-fuchsia-50/60"
          }`}
        >
          <div className="text-sm leading-relaxed text-[var(--text-muted)]">
            {cleanOccasionFlowDescription(activeVariant?.reason ?? occasionFlowDescription(occasion))}
          </div>

          <div className="mt-3 max-w-full overflow-hidden rounded-lg border bg-white/70 px-2 py-3">
            <div
              className="grid min-h-[190px] items-end gap-2"
              style={{ gridTemplateColumns: `repeat(${occasionFlow.length}, minmax(0, 1fr))` }}
            >
            {occasionFlow.map(({ stop, meta, phaseGoal }, idx) => {
              const value = variantDramaValues(activeVariant, occasionFlow.length)[idx] ?? 56;
              const cardHeight = Math.round(104 + value * 0.8);

              return (
                <div
                  key={`${stop.index}-${idx}`}
                  className="flex min-w-0 flex-col justify-between rounded-lg border bg-white p-2 shadow-[0_10px_24px_rgba(49,39,27,0.04)] sm:p-3"
                  style={{ height: `${cardHeight}px` }}
                >
                  <div className="min-w-0">
                    <div className="line-clamp-2 text-xs font-semibold leading-snug text-[var(--text-strong)] sm:text-sm">
                      {stop.item?.name ?? stop.label}
                    </div>
                    <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--text-muted)] sm:text-xs">
                      {phaseGoal ?? meta?.short ?? stop.hint}
                    </div>
                  </div>
                  <div className="mt-2 break-words text-[10px] font-semibold uppercase leading-tight tracking-wide text-[var(--text-muted)] sm:text-[11px]">
                    {meta?.label ?? stop.label}
                  </div>
                </div>
              );
            })}
            </div>
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
        <div className="mb-4 p-3 border rounded-lg text-sm text-red-700">{plannerError}</div>
      ) : null}
    </>
  );
}
