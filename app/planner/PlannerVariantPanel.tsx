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
};

function occasionFallbackVariantLabel(occasion: string) {
  if (occasion === "date") return "Date";
  if (occasion === "family") return "Family";
  if (occasion === "friends") return "Friends";
  if (occasion === "tourism") return "Tourism";
  if (occasion === "party") return "Party";
  return "Variante";
}

function occasionFlowTitle(occasion: string) {
  if (occasion === "date") return "Date-Dramaturgie";
  if (occasion === "family") return "Familien-Dramaturgie";
  if (occasion === "friends") return "Freunde-Dramaturgie";
  if (occasion === "tourism") return "Tourism-Dramaturgie";
  return "Party-Dramaturgie";
}

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
}: PlannerVariantPanelProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <h2 className="text-2xl font-semibold">Dein Plan</h2>
          {activeVariant ? (
            <div className="mt-1 text-sm text-[var(--text-muted)]">
              <span className="font-semibold">{activeVariant.label}</span>
              {typeof activeVariant.totalScore === "number" ? ` | Score ${activeVariant.totalScore}` : ""}
              {pinnedVariant?.variantId === activeVariant.variantId ? " | Unsere Wahl" : ""}
            </div>
          ) : null}
        </div>

        <div className="flex gap-2">
          <button onClick={onRerollPlan} className="px-3 py-2 rounded bg-[var(--text-strong)] text-white text-sm">
            Neu wuerfeln
          </button>

          <button onClick={onResetPlan} className="px-3 py-2 rounded border text-sm">
            Plan zurücksetzen
          </button>

          {activeVariant ? (
            <button
              onClick={() => onTogglePinnedVariant(activeVariant.variantId)}
              className={`px-3 py-2 rounded border text-sm ${
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
            <button onClick={onCopyPinnedChoiceSummary} className="px-3 py-2 rounded border text-sm">
              Wahltext kopieren
            </button>
          ) : null}

          {(pinnedVariant ?? activeVariant) ? (
            <button onClick={onOpenChoiceInChat} className="px-3 py-2 rounded border text-sm">
              Im Chat vorbereiten
            </button>
          ) : null}

          {!userId && authReady ? (
            <button
              onClick={() => void onContinueAsGuest()}
              disabled={authLoading}
              className="px-4 py-2 rounded border text-sm disabled:opacity-60"
            >
              {authLoading ? "Starte Gast..." : "Als Gast fortfahren"}
            </button>
          ) : null}
        </div>
      </div>

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
            <div className="p-3 border rounded-lg text-sm text-[var(--text-muted)]">
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
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="font-semibold">{occasionFlowTitle(occasion)}</div>
              <div className="text-sm text-[var(--text-muted)]">{occasionFlowDescription(occasion)}</div>
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              Variante: {activeVariant?.label ?? occasionFallbackVariantLabel(occasion)}
            </div>
          </div>

          <div className="mt-4 grid md:grid-cols-5 gap-3">
            {occasionFlow.map(({ stop, meta, phaseGoal }, idx) => (
              <div key={`${stop.index}-${idx}`} className="rounded-lg border bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  {meta?.label ?? stop.label}
                </div>
                <div className="mt-1 font-semibold text-sm">{stop.item?.name ?? stop.label}</div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">
                  {phaseGoal ?? meta?.short ?? stop.hint}
                </div>
              </div>
            ))}
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
