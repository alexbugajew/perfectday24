import { useMemo } from "react";
import type { PublicAffiliateResolution } from "@/lib/monetization/affiliate-shared";
import type { PlannedStop, RouteProfile } from "@/lib/planner";
import PlannerStopListSection from "./PlannerStopListSection";
import {
  compareSavedPlans,
  deriveConfirmationMoment,
  eventTravelPriorityNoteForSavedSlot,
  savedPlanFamilyKey,
  savedPlanRoleLabel,
} from "./helpers";
import type {
  PlannerApiResponse,
  PlanEditSuggestionSummary,
  SavedPlanRow,
  SharedPlanChoiceReactionSummary,
} from "./types";

type PlannerOutputSectionProps = {
  routeProfile: RouteProfile;
  plannerLoading: boolean;
  plannerError: string | null;
  resultsCount: number;
  plannedStops: PlannedStop[];
  occasion: string;
  plannerData: PlannerApiResponse | null;
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
  plans: SavedPlanRow[];
  selectedPlan: SavedPlanRow | null;
  onSelectPlan: (plan: SavedPlanRow | null) => void;
  onSharePlan: (plan: SavedPlanRow) => void;
  onSendFinalPlanToFriends: (plan: SavedPlanRow) => Promise<void>;
  onOpenPlanGroupChat: (plan: SavedPlanRow) => Promise<void>;
  onContinueEditingSavedPlan: (plan: SavedPlanRow) => void;
  onResolveEditSuggestion: (suggestionId: string) => Promise<void>;
  planChoiceReactions: Record<string, SharedPlanChoiceReactionSummary>;
  planEditSuggestions: Record<string, PlanEditSuggestionSummary[]>;
};

type SavedPlanSlotForOutput = {
  index?: number | null;
  slot?: string | number | null;
  label?: string | null;
  hint?: string | null;
  durationMin?: number | null;
  travelMinFromPrev?: number | null;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  timingLock?: "none" | "event" | null;
  reasons?: string[];
  location?: {
    name?: string | null;
    type?: string | null;
    source_primary?: string | null;
  } | null;
};

const PLANNER_EMPTY_ACTIONS = [
  "Startpunkt genauer setzen",
  "Umkreis erweitern",
  "Anderen Fokus wählen",
];

function isSavedPlanSlotForOutput(value: unknown): value is SavedPlanSlotForOutput {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function savedPlanSlotsForOutput(slots: unknown) {
  return Array.isArray(slots) ? slots.filter(isSavedPlanSlotForOutput) : [];
}

function savedPlanSlotKey(slot: SavedPlanSlotForOutput, index: number) {
  return String(slot.index ?? slot.slot ?? `${slot.label ?? "slot"}-${index}`);
}

export default function PlannerOutputSection({
  routeProfile,
  plannerLoading,
  plannerError,
  resultsCount,
  plannedStops,
  occasion,
  plannerData,
  activeVariantLabel,
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
  plans,
  selectedPlan,
  onSelectPlan,
  onSharePlan,
  onSendFinalPlanToFriends,
  onOpenPlanGroupChat,
  onContinueEditingSavedPlan,
  onResolveEditSuggestion,
  planChoiceReactions,
  planEditSuggestions,
}: PlannerOutputSectionProps) {
  const savedPlanFamilies = useMemo(() => {
    const byKey = new Map<string, { key: string; rootId: string; rootTitle: string; plans: SavedPlanRow[] }>();

    for (const plan of plans) {
      const key = savedPlanFamilyKey(plan);
      const rootId =
        typeof plan.filters?.familyRootId === "string" && plan.filters.familyRootId.trim().length
          ? plan.filters.familyRootId
          : plan.id;
      const rootTitle =
        typeof plan.filters?.familyRootTitle === "string" && plan.filters.familyRootTitle.trim().length
          ? plan.filters.familyRootTitle
          : plan.title || "Planfamilie";
      const existing = byKey.get(key);

      if (existing) {
        existing.plans.push(plan);
        if (existing.rootId !== rootId && rootId === plan.id) {
          existing.rootId = rootId;
          existing.rootTitle = rootTitle;
        }
      } else {
        byKey.set(key, { key, rootId, rootTitle, plans: [plan] });
      }
    }

    return Array.from(byKey.values()).map((family) => ({
      ...family,
      plans: [...family.plans].sort((left, right) => {
        const leftDate = left.created_at || "";
        const rightDate = right.created_at || "";
        if (leftDate === rightDate) return 0;
        return leftDate > rightDate ? -1 : 1;
      }),
    }));
  }, [plans]);

  const familySummaryByKey = useMemo(
    () =>
      new Map(
        savedPlanFamilies.map((family) => [
          family.key,
          { rootTitle: family.rootTitle, count: family.plans.length },
        ])
      ),
    [savedPlanFamilies]
  );

  const selectedPlanExpectedCount = useMemo(() => {
    if (!selectedPlan) return null;
    return (
      Array.from(
        new Set(
          Object.values((selectedPlan.filters?.variantVotes ?? {}) as Record<string, string[]>)
            .flatMap((voters) => (Array.isArray(voters) ? voters : []))
            .map((voter) => (typeof voter === "string" ? voter.trim() : ""))
            .filter(Boolean)
        )
      ).length || null
    );
  }, [selectedPlan]);

  const selectedPlanConfirmationMoment = useMemo(() => {
    if (!selectedPlan) return null;
    const count = planChoiceReactions[selectedPlan.id]?.count ?? 0;
    return deriveConfirmationMoment(count, selectedPlanExpectedCount);
  }, [selectedPlan, planChoiceReactions, selectedPlanExpectedCount]);

  const selectedPlanBasePlan = useMemo(() => {
    if (!selectedPlan?.filters?.editSourcePlanId) return null;
    return plans.find((plan) => plan.id === selectedPlan.filters.editSourcePlanId) ?? null;
  }, [selectedPlan, plans]);

  const selectedPlanChanges = useMemo(
    () => compareSavedPlans(selectedPlanBasePlan, selectedPlan),
    [selectedPlanBasePlan, selectedPlan]
  );

  const selectedPlanEditSuggestions = useMemo(
    () => (selectedPlan ? planEditSuggestions[selectedPlan.id] ?? [] : []),
    [selectedPlan, planEditSuggestions]
  );

  const selectedOpenEditSuggestions = useMemo(
    () => selectedPlanEditSuggestions.filter((entry) => !entry.resolved_at),
    [selectedPlanEditSuggestions]
  );

  const selectedResolvedEditSuggestions = useMemo(
    () => selectedPlanEditSuggestions.filter((entry) => entry.resolved_at),
    [selectedPlanEditSuggestions]
  );

  return (
    <>
      {plannerLoading ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-[var(--line-subtle)] bg-white p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-3">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--brand-warm)] border-t-transparent" />
              <h2 className="text-base font-semibold tracking-tight text-[var(--text-strong)] sm:text-lg">
                Dein Plan wird zusammengestellt …
              </h2>
            </div>
          </div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border border-[var(--line-subtle)] bg-white p-4 shadow-[var(--shadow-soft)]"
            >
              <div className="flex gap-4">
                <div className="h-28 w-28 shrink-0 rounded-md bg-[rgba(68,57,46,0.08)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 rounded-full bg-[rgba(68,57,46,0.10)]" />
                  <div className="h-5 w-3/5 rounded-full bg-[rgba(68,57,46,0.12)]" />
                  <div className="h-3 w-2/5 rounded-full bg-[rgba(68,57,46,0.08)]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : plannerError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-red-700">
            Planner braucht Eingriff
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            Der Vorschlag konnte noch nicht gebaut werden.
          </h2>
          <p className="mt-2 text-sm leading-6">
            {plannerError} Prüfe vor allem Startpunkt, Stadt und Fokus. Danach stößt der
            Planner automatisch einen neuen Lauf an.
          </p>
        </div>
      ) : resultsCount === 0 && plannedStops.length === 0 ? (
        <div className="rounded-lg border border-[var(--line-subtle)] bg-white p-4 shadow-[var(--shadow-soft)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
            Noch kein Vorschlag
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-strong)]">
            Es fehlen noch belastbare Kandidaten.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            Der Planner zeigt lieber keinen schwachen Ablauf als eine zufällige Liste. Diese
            Anpassungen bringen meistens schnell mehr Substanz:
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {PLANNER_EMPTY_ACTIONS.map((action) => (
              <span
                key={action}
                className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]"
              >
                {action}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <>
          <PlannerStopListSection
            plannedStops={plannedStops}
            occasion={occasion}
            plannerData={plannerData}
            routeProfile={routeProfile}
            activeVariantLabel={activeVariantLabel}
            activeVariantReason={activeVariantReason}
            draggedStopPosition={draggedStopPosition}
            groupEnabled={groupEnabled}
            groupMembersCount={groupMembersCount}
            affiliateResolution={affiliateResolution}
            userId={userId}
            effectiveCitySlug={effectiveCitySlug}
            onMovePlannedStop={onMovePlannedStop}
            onSetDraggedStopPosition={onSetDraggedStopPosition}
            onBumpStop={onBumpStop}
          />

          {plans.length === 0 ? null : (
          <details className="mb-6 mt-6 rounded-lg border border-[var(--line-subtle)] bg-white shadow-[var(--shadow-soft)]">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="font-semibold text-[var(--text-strong)]">
                Meine gespeicherten Pläne
              </span>
              <span className="rounded-full bg-[var(--bg-panel)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                {plans.length}
              </span>
            </summary>
            <div className="space-y-3 border-t border-[var(--line-subtle)] p-4">
              {plans.map((plan, index) => {
                const familySummary = familySummaryByKey.get(savedPlanFamilyKey(plan));
                return (
                  <div key={`${plan.id}-${savedPlanFamilyKey(plan)}-${index}`}>
                    {index === 0 || savedPlanFamilyKey(plans[index - 1]) !== savedPlanFamilyKey(plan) ? (
                      <div className="mb-3 rounded-xl border border-dashed bg-[var(--bg-panel)] px-4 py-3 text-sm text-[var(--text-muted)]">
                        <div className="font-semibold">
                          {familySummary?.rootTitle || plan.title || "Planfamilie"}
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">
                          {familySummary?.count ?? 1} Einträge in dieser Planfamilie
                        </div>
                      </div>
                    ) : null}

                    <div className="flex items-start justify-between gap-4 rounded-lg border p-4 hover:bg-[var(--bg-panel)]">
                      <button onClick={() => onSelectPlan(plan)} className="flex-1 text-left">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-semibold">{plan.title || "Unbenannter Plan"}</div>
                          <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-2 py-1 text-[11px] text-[var(--text-muted)]">
                            {savedPlanRoleLabel(plan)}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {new Date(plan.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}
                          {plan.filters?.stopsCount ? ` · ${plan.filters.stopsCount} Stops` : null}
                        </div>
                        {plan.filters?.pinnedVariantLabel ? (
                          <div className="mt-2 inline-block rounded-full border border-[var(--state-success)]/25 bg-[var(--brand-accent-cloud)] px-2 py-1 text-[11px] text-[var(--state-success)]">
                            {plan.filters?.groupChoiceLabel || "Unsere Wahl"}: {plan.filters.pinnedVariantLabel}
                          </div>
                        ) : null}
                        {plan.filters?.finalGroupPlan ? (
                          <div className="mt-2 inline-block rounded-full border border-[var(--brand-accent)]/25 bg-[var(--brand-accent-soft)] px-2 py-1 text-[11px] text-[var(--brand-accent)]">
                            {plan.filters?.finalGroupStatusLabel || plan.filters?.finalGroupPlanLabel || "Finaler Gruppenplan"}
                          </div>
                        ) : null}
                        {typeof plan.filters?.leadingVariantVotes === "number" &&
                        plan.filters?.leadingVariantVotes > 0 &&
                        plan.filters?.leadingVariantLabel ? (
                          <div className="mt-2 text-[11px] text-[var(--text-muted)]">
                            Zustimmung: {plan.filters.leadingVariantVotes} Stimmen für {plan.filters.leadingVariantLabel}
                          </div>
                        ) : null}
                        {planChoiceReactions[plan.id]?.count ? (
                          <div className="mt-2 text-[11px] text-[var(--brand-accent)]">
                            Share-Bestätigungen: {planChoiceReactions[plan.id].count}
                            {planChoiceReactions[plan.id].voters.length
                              ? ` · ${planChoiceReactions[plan.id].voters.slice(0, 3).join(", ")}`
                              : ""}
                          </div>
                        ) : null}
                        {(() => {
                          const expectedCount =
                            Array.from(
                              new Set(
                                Object.values((plan.filters?.variantVotes ?? {}) as Record<string, string[]>)
                                  .flatMap((voters) => (Array.isArray(voters) ? voters : []))
                                  .map((voter) => (typeof voter === "string" ? voter.trim() : ""))
                                  .filter(Boolean)
                              )
                            ).length || null;
                          const moment = deriveConfirmationMoment(planChoiceReactions[plan.id]?.count ?? 0, expectedCount);
                          return moment ? (
                            <div
                              className={`mt-2 inline-block rounded-full border px-2 py-1 text-[11px] ${
                                moment.tone === "emerald"
                                  ? "border-[var(--state-success)]/25 bg-[var(--brand-accent-cloud)] text-[var(--state-success)]"
                                  : moment.tone === "amber"
                                    ? "border-[var(--state-warning)]/25 bg-[var(--brand-accent-cloud)] text-[var(--state-warning)]"
                                    : "border-[var(--brand-accent)]/25 bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]"
                              }`}
                            >
                              {moment.label}
                            </div>
                          ) : null;
                        })()}
                        {plan.filters?.startPoint?.label ? (
                          <div className="mt-2 text-xs text-[var(--text-muted)]">
                            Start: {plan.filters.startPoint.label}
                          </div>
                        ) : null}

                        {plan.filters?.editSourcePlanTitle ? (
                          <div className="mt-2 text-xs text-[var(--text-muted)]">
                            Basis: {plan.filters.editSourcePlanTitle}
                          </div>
                        ) : null}

                        {plan.ai_description ? (
                          <div className="mt-2 line-clamp-2 text-xs text-[var(--text-muted)]">
                            {plan.ai_description}
                          </div>
                        ) : null}
                      </button>

                      <div className="flex flex-col items-end gap-2">
                        <button onClick={() => onSharePlan(plan)} className="rounded bg-[var(--text-strong)] px-3 py-2 text-sm text-white">
                          Teilen
                        </button>
                        {plan.filters?.finalGroupPlan ? (
                          <button onClick={() => void onSendFinalPlanToFriends(plan)} className="rounded border px-3 py-2 text-sm">
                            An Freunde senden
                          </button>
                        ) : null}
                        {plan.filters?.finalGroupPlan ? (
                          <button onClick={() => void onOpenPlanGroupChat(plan)} className="rounded border px-3 py-2 text-sm">
                            Gruppenchat
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
          )}

          {selectedPlan ? (
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{selectedPlan.title || "Unbenannter Plan"}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {selectedPlan.filters?.stopsCount ? `${selectedPlan.filters.stopsCount} Stops` : null}
                    {selectedPlan.radius_km ? ` · ${selectedPlan.radius_km} km Umkreis` : null}
                  </div>
                </div>
                <button onClick={() => onSelectPlan(null)} className="rounded border px-3 py-2 text-sm">
                  Schliessen
                </button>
              </div>

              {selectedPlan.filters?.startPoint?.label ? (
                <div className="mb-3 rounded-lg border p-3 text-sm text-[var(--text-muted)]">
                  <span className="font-semibold">Startpunkt:</span> {selectedPlan.filters.startPoint.label}
                </div>
              ) : null}

              {selectedPlan.filters?.pinnedVariantLabel ? (
                <div className="mb-3 rounded-lg border bg-[var(--brand-accent-cloud)]/70 p-3 text-sm text-[var(--state-success)]">
                  <span className="font-semibold">
                    {selectedPlan.filters?.groupChoiceLabel || "Unsere Wahl"}:
                  </span>{" "}
                  {selectedPlan.filters.pinnedVariantLabel}
                </div>
              ) : null}

              {selectedPlanBasePlan && selectedPlanChanges.length > 0 ? (
                <div className="mb-3 rounded-lg border bg-[var(--bg-panel)]/80 p-3 text-sm text-[var(--text-strong)]">
                  <div className="font-semibold">Was hat sich geändert?</div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    Gegenüber {selectedPlanBasePlan.title || "dem Basisplan"}
                  </div>
                  <div className="mt-2 space-y-1">
                    {selectedPlanChanges.map((change) => (
                      <div key={change} className="text-sm text-[var(--text-muted)]">
                        • {change}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedPlan.filters?.finalGroupPlan ? (
                <div className="mb-3 rounded-lg border bg-[var(--brand-accent-soft)]/70 p-3 text-sm text-[var(--brand-accent)]">
                  <span className="font-semibold">
                    {selectedPlan.filters?.finalGroupStatusLabel || selectedPlan.filters?.finalGroupPlanLabel || "Finaler Gruppenplan"}
                  </span>
                  {selectedPlan.filters?.finalVariantLabel ? <> · {selectedPlan.filters.finalVariantLabel}</> : null}
                </div>
              ) : null}

              {selectedPlan.filters?.finalGroupPlan ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  <button onClick={() => onContinueEditingSavedPlan(selectedPlan)} className="rounded border px-3 py-2 text-sm">
                    Diesen Plan weiterbearbeiten
                  </button>
                  <button onClick={() => void onSendFinalPlanToFriends(selectedPlan)} className="rounded border px-3 py-2 text-sm">
                    Finalen Gruppenplan an Freunde senden
                  </button>
                  <button onClick={() => onSharePlan(selectedPlan)} className="rounded border px-3 py-2 text-sm">
                    Share-Link kopieren
                  </button>
                  <button onClick={() => void onOpenPlanGroupChat(selectedPlan)} className="rounded border px-3 py-2 text-sm">
                    Gruppenchat öffnen
                  </button>
                </div>
              ) : null}

              {typeof selectedPlan.filters?.leadingVariantVotes === "number" &&
              selectedPlan.filters?.leadingVariantVotes > 0 &&
              selectedPlan.filters?.leadingVariantLabel ? (
                <div className="mb-3 rounded-lg border p-3 text-sm text-[var(--text-muted)]">
                  <span className="font-semibold">Aktuelle Zustimmung:</span> {selectedPlan.filters.leadingVariantVotes} Stimmen für{" "}
                  {selectedPlan.filters.leadingVariantLabel}
                </div>
              ) : null}

              {planChoiceReactions[selectedPlan.id]?.count ? (
                <div className="mb-3 rounded-lg border bg-[var(--brand-accent-soft)]/70 p-3 text-sm text-[var(--brand-accent)]">
                  <span className="font-semibold">Bestätigungen aus dem Share-Link:</span> {planChoiceReactions[selectedPlan.id].count}
                  {planChoiceReactions[selectedPlan.id].voters.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {planChoiceReactions[selectedPlan.id].voters.map((voter) => (
                        <span
                          key={`${selectedPlan.id}-${voter}`}
                          className="rounded-full border border-[var(--brand-accent)]/35 bg-white px-2 py-1 text-[11px] text-[var(--brand-accent)]"
                        >
                          {voter}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {selectedPlanConfirmationMoment ? (
                <div
                  className={`mb-3 rounded-lg border p-3 text-sm ${
                    selectedPlanConfirmationMoment.tone === "emerald"
                      ? "border-[var(--state-success)]/25 bg-[var(--brand-accent-cloud)]/70 text-[var(--state-success)]"
                      : selectedPlanConfirmationMoment.tone === "amber"
                        ? "border-[var(--state-warning)]/25 bg-[var(--brand-accent-cloud)]/70 text-[var(--state-warning)]"
                        : "border-[var(--brand-accent)]/25 bg-[var(--brand-accent-soft)]/70 text-[var(--brand-accent)]"
                  }`}
                >
                  <span className="font-semibold">{selectedPlanConfirmationMoment.label}</span> ·{" "}
                  {selectedPlanConfirmationMoment.secondaryLabel}
                </div>
              ) : null}

              {selectedPlan.ai_description ? (
                <div className="mb-3 whitespace-pre-wrap rounded-lg border p-3 text-sm text-[var(--text-muted)]">
                  {selectedPlan.ai_description}
                </div>
              ) : null}

              {selectedPlanEditSuggestions.length ? (
                <div className="mb-3 rounded-lg border bg-[var(--brand-accent-cloud)]/60 p-3 text-sm text-[var(--state-warning)]">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-semibold">Gemeinsame Bearbeitung</div>
                      <div className="mt-1 text-xs text-[var(--state-warning)]/80">
                        Änderungswünsche aus der geteilten Planseite und dem Gruppenflow.
                      </div>
                    </div>
                    <div className="rounded-full border border-[var(--state-warning)]/35 bg-white px-3 py-1 text-xs font-medium text-[var(--state-warning)]">
                      {selectedOpenEditSuggestions.length} offen
                    </div>
                  </div>

                  {selectedOpenEditSuggestions.length ? (
                    <div className="mt-3 space-y-2">
                      {selectedOpenEditSuggestions.map((entry) => (
                        <div key={entry.id} className="rounded-lg border border-[var(--state-warning)]/25 bg-white px-3 py-3">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <div className="font-medium">{entry.author_label}</div>
                              <div className="mt-1 text-sm text-[var(--state-warning)]">{entry.message}</div>
                              <div className="mt-2 text-[11px] text-[var(--state-warning)]/70">
                                {new Date(entry.created_at).toLocaleString("de-DE")}
                              </div>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <button onClick={() => onContinueEditingSavedPlan(selectedPlan)} className="rounded border px-3 py-2 text-sm">
                                Im Planner bearbeiten
                              </button>
                              <button
                                onClick={() => void onResolveEditSuggestion(entry.id)}
                                className="rounded bg-[var(--text-strong)] px-3 py-2 text-sm text-white"
                              >
                                Als aufgenommen markieren
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {selectedResolvedEditSuggestions.length ? (
                    <details className="mt-3 rounded-lg border border-[var(--state-success)]/25 bg-white px-3 py-3">
                      <summary className="cursor-pointer text-xs font-medium text-[var(--state-success)]/80">
                        Bereits aufgenommen ({selectedResolvedEditSuggestions.length})
                      </summary>
                      <div className="mt-3 space-y-2">
                        {selectedResolvedEditSuggestions.slice(0, 8).map((entry) => (
                          <div key={entry.id} className="rounded-lg border border-[var(--state-success)]/25 bg-[var(--brand-accent-cloud)] px-3 py-2">
                            <div className="font-medium text-[var(--state-success)]">{entry.author_label}</div>
                            <div className="mt-1 text-sm text-[var(--state-success)]">{entry.message}</div>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-3">
                {savedPlanSlotsForOutput(selectedPlan.slots).map((slot, index) => (
                  <div key={savedPlanSlotKey(slot, index)} className="rounded-lg border p-3">
                    <div className="text-sm font-semibold">{slot.label ?? `Stop ${slot.index}`}</div>
                    <div className="text-xs text-[var(--text-muted)]">{slot.hint}</div>
                    {slot.location ? (
                      <>
                        <div className="mt-1 text-sm">{slot.location.name}</div>
                        <div className="text-xs text-[var(--text-muted)]">{slot.location.type}</div>
                        <div className="text-xs text-[var(--text-muted)]">
                          Dauer: {slot.durationMin ?? "-"} Min
                          {typeof slot.travelMinFromPrev === "number" ? ` | Weg: ~${slot.travelMinFromPrev} Min` : ""}
                        </div>

                        {slot.location.source_primary === "planner_event" ? (
                          <div className="mt-1 text-xs text-[var(--state-warning)]">
                            Event-Highlight: Dieser Stop wurde als lokaler Event-Anker in die Route gezogen.
                          </div>
                        ) : null}

                        {eventTravelPriorityNoteForSavedSlot(slot, index, routeProfile) ? (
                          <div className="mt-2 rounded-lg border border-[var(--state-warning)]/25 bg-[var(--brand-accent-cloud)]/60 px-3 py-2 text-xs text-[var(--state-warning)]">
                            {eventTravelPriorityNoteForSavedSlot(slot, index, routeProfile)}
                          </div>
                        ) : null}

                        {Array.isArray(slot.reasons) && slot.reasons.length ? (
                          <div className="mt-3 rounded-lg border bg-[var(--bg-panel)]/80 p-3">
                            <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                              Warum dieser Stop?
                            </div>
                            <div className="mt-2 space-y-2">
                              {slot.reasons.map((reason: string) => (
                                <div key={reason} className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
                                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--text-muted)]/50" />
                                  <span>{reason}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="mt-1 text-xs text-[var(--text-muted)]">-</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
