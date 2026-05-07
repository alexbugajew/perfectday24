import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { RouteSummary, PlanMapStop } from "@/components/PlanMap";
import type { PublicAffiliateResolution } from "@/lib/monetization/affiliate-shared";
import type { PlannedStop, RouteProfile, RouteSummaryLite } from "@/lib/planner";
import PlannerStopListSection from "./PlannerStopListSection";
import {
  compareSavedPlans,
  deriveConfirmationMoment,
  eventTravelPriorityNoteForSavedSlot,
  routeProfileLabel,
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
  onRouteProfileChange: (profile: RouteProfile) => void;
  googleRouteUrl: string | null;
  effectiveStartPointLabel: string | null;
  mapStops: PlanMapStop[];
  routeSummary: RouteSummary | null;
  onRouteSummaryChange: (summary: RouteSummary | null) => void;
  plannerLoading: boolean;
  fallbackSummary: RouteSummaryLite;
  resultsCount: number;
  plannedStops: PlannedStop[];
  occasion: string;
  plannerData: PlannerApiResponse | null;
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

const PlanMap = dynamic(
  () => import("@/components/PlanMap").then((module) => module.default),
  { ssr: false }
);

export default function PlannerOutputSection({
  routeProfile,
  onRouteProfileChange,
  googleRouteUrl,
  effectiveStartPointLabel,
  mapStops,
  routeSummary,
  onRouteSummaryChange,
  plannerLoading,
  fallbackSummary,
  resultsCount,
  plannedStops,
  occasion,
  plannerData,
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
      <div className="hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Route</div>
            <div className="text-xs text-[var(--text-muted)]">
              Echte Wege über OSRM. Startpunkt: {effectiveStartPointLabel || "-"} | Profil:{" "}
              {routeProfileLabel(routeProfile)}
            </div>
            {routeProfile === "public_transit" ? (
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                Die Kartenroute nutzt hier eine Auto-Näherung. Für die Planner-Logik gelten trotzdem gelockerte ÖPNV-Wege statt eines reinen Fuß-Clusters.
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={routeProfile}
              onChange={(e) => onRouteProfileChange(e.target.value as RouteProfile)}
              className="rounded-2xl border border-[rgba(68,57,46,0.1)] bg-white/95 px-3 py-2 text-sm text-[var(--text-strong)]"
            >
              <option value="foot">Zu Fuß</option>
              <option value="public_transit">ÖPNV</option>
              <option value="car">Auto</option>
            </select>

            <button
              disabled={!googleRouteUrl}
              onClick={() => {
                if (googleRouteUrl) window.open(googleRouteUrl, "_blank", "noreferrer");
              }}
              className="rounded bg-[var(--text-strong)] px-3 py-2 text-sm text-white disabled:opacity-60"
            >
              Route öffnen
            </button>
          </div>
        </div>

        <PlanMap
          stops={mapStops}
          profile={routeProfile}
          height={360}
          onSummary={onRouteSummaryChange}
        />

        <div className="rounded-lg border p-3 text-sm text-[var(--text-muted)]">
          <div className="mb-1 font-semibold">Travel Summary</div>

          {mapStops.length < 2 ? (
            <div className="text-xs text-[var(--text-muted)]">
              Für eine Route brauchen wir mindestens Start + 1 Stop mit Koordinaten.
            </div>
          ) : routeSummary ? (
            <>
              <div className="text-sm">
                Gesamt: <span className="font-semibold">{routeSummary.totalDistanceKm} km</span> |{" "}
                <span className="font-semibold">{routeSummary.totalDurationMin} Min</span>
              </div>

              <div className="mt-2 space-y-1">
                {routeSummary.legs.map((leg, index) => (
                  <div key={index} className="text-xs text-[var(--text-muted)]">
                    {leg.fromLabel} to {leg.toLabel}: {leg.distanceKm} km | {leg.durationMin} Min
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-xs text-[var(--text-muted)]">
              {plannerLoading
                ? "Route wird berechnet..."
                : "Route wird berechnet oder ist aktuell nicht verfügbar."}
              <div className="mt-2">
                Schätzung: ~{fallbackSummary.distanceKm} km | Aktivitäten ~
                {fallbackSummary.activityMin} Min | Wege ~{fallbackSummary.travelMin} Min | Gesamt ~
                {fallbackSummary.totalMin} Min
              </div>
            </div>
          )}
        </div>
      </div>

      {plannerLoading ? (
        <div className="rounded-lg border p-4">
          Der Plan wird gerade zusammengesetzt. Orte, Wege und Event-Fenster werden abgestimmt.
        </div>
      ) : resultsCount === 0 ? (
        <div className="rounded-lg border p-4">
          Noch keine passenden Vorschläge. Prüfe Stadt, Startpunkt oder erweitere den Umkreis für mehr Optionen.
        </div>
      ) : (
        <>
          <PlannerStopListSection
            plannedStops={plannedStops}
            occasion={occasion}
            plannerData={plannerData}
            routeProfile={routeProfile}
            activeVariantLabel={activeVariantLabel}
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

          <h3 className="mb-3 text-xl font-semibold">Meine gespeicherten Pläne</h3>

          {plans.length === 0 ? (
            <div className="mb-6 rounded-lg border p-4 text-sm text-[var(--text-muted)]">
              Noch keine Pläne gespeichert. Sichere einen guten Stand, damit du später daran weiterarbeiten oder ihn teilen kannst.
            </div>
          ) : (
            <div className="mb-6 space-y-3">
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
                          <div className="font-semibold">{plan.title || "Untitled Plan"}</div>
                          <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-2 py-1 text-[11px] text-[var(--text-muted)]">
                            {savedPlanRoleLabel(plan)}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {new Date(plan.created_at).toLocaleString()} | Mode: {plan.filters?.planMode ?? "-"} | Stops:{" "}
                          {plan.filters?.stopsCount ?? "-"}
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
                        <div className="mt-2 inline-block rounded border px-2 py-1 text-xs">
                          {plan.active_level || "n/a"}
                        </div>

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
                        {plan.share_token ? (
                          <div className="text-[11px] text-[var(--text-muted)]">
                            Share-ID: /p/{String(plan.share_token).slice(0, 6)}...
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedPlan ? (
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{selectedPlan.title || "Untitled Plan"}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    Radius: {selectedPlan.radius_km} km | Sort: {selectedPlan.sort_mode} | Mode:{" "}
                    {selectedPlan.filters?.planMode ?? "-"} | Stops: {selectedPlan.filters?.stopsCount ?? "-"}
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
                        Aenderungswuensche aus der geteilten Planseite und dem Gruppenflow.
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
                {(selectedPlan.slots || []).map((slot: any, index: number) => (
                  <div key={slot.index ?? slot.slot ?? JSON.stringify(slot)} className="rounded-lg border p-3">
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
