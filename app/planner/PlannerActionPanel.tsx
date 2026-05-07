import Link from "next/link";
import type { SavedPlanRow, GroupPlanningSignals, GroupPlanSummary } from "./types";

type PlannerActionPanelProps = {
  plannerTemplateLoadedLabel: string | null;
  plannerTemplateSourceSlug: string | null;
  plannerTemplateInterests: string[];
  editingPlanId: string | null;
  selectedPlan: SavedPlanRow | null;
  planTitle: string;
  onPlanTitleChange: (value: string) => void;
  aiLoading: boolean;
  onGenerateAIText: () => unknown;
  authReady: boolean;
  userId: string | null;
  saving: boolean;
  plannedStopsCount: number;
  groupEnabled: boolean;
  finalChoiceExists: boolean;
  loadingPlans: boolean;
  authLoading: boolean;
  onSaveDefault: () => unknown;
  onSaveVariant: () => unknown;
  onSaveFinal: () => unknown;
  onOpenCurrentPlannerGroupChat: () => unknown;
  onHandoffPlanToRouteBuilder: () => void;
  onLoadPlans: () => unknown;
  onContinueAsGuest: () => unknown;
  groupPlanningSignals: GroupPlanningSignals;
  groupPlanSummary: GroupPlanSummary;
  aiText: string | null;
};

export default function PlannerActionPanel({
  plannerTemplateLoadedLabel,
  plannerTemplateSourceSlug,
  plannerTemplateInterests,
  editingPlanId,
  selectedPlan,
  planTitle,
  onPlanTitleChange,
  aiLoading,
  onGenerateAIText,
  authReady,
  userId,
  saving,
  plannedStopsCount,
  groupEnabled,
  finalChoiceExists,
  loadingPlans,
  authLoading,
  onSaveDefault,
  onSaveVariant,
  onSaveFinal,
  onOpenCurrentPlannerGroupChat,
  onHandoffPlanToRouteBuilder,
  onLoadPlans,
  onContinueAsGuest,
  groupPlanningSignals,
  groupPlanSummary,
  aiText,
}: PlannerActionPanelProps) {
  const isEditingSelectedPlan = Boolean(editingPlanId && selectedPlan?.id === editingPlanId);

  return (
    <div className="space-y-3 rounded-lg border border-[var(--line-subtle)] bg-white p-3 shadow-[var(--shadow-soft)]">
      {plannerTemplateLoadedLabel ? (
        <div className="rounded-2xl border border-[var(--state-success)]/25 bg-[var(--brand-accent-cloud)] px-4 py-3 text-sm text-[var(--state-success)]">
          <div className="font-medium">Diese Vorlage in Planner geladen</div>
          <div className="mt-1 text-[var(--state-success)]">
            <span className="font-semibold">{plannerTemplateLoadedLabel}</span> wurde als Ausgangspunkt übernommen. Passe jetzt Interessen,
            Radius und Varianten an und veröffentliche den fertigen Tag später bei Bedarf als Creator-Route.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {plannerTemplateSourceSlug ? (
              <Link
                href={`/routes/${plannerTemplateSourceSlug}`}
                className="rounded-full border border-[var(--state-success)]/25 bg-white px-3 py-1 text-xs text-[var(--state-success)]"
              >
                Originalroute öffnen
              </Link>
            ) : null}
            {plannerTemplateInterests.slice(0, 8).map((interest) => (
              <span
                key={interest}
                className="rounded-full border border-[var(--state-success)]/25 bg-white px-3 py-1 text-xs text-[var(--state-success)]"
              >
                {interest}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {isEditingSelectedPlan ? (
        <div className="rounded-2xl border border-[var(--brand-accent)]/25 bg-[var(--brand-accent-soft)] px-4 py-3 text-sm text-[var(--brand-accent)]">
          <div className="font-medium">Du bearbeitest gerade eine bestehende Gruppenplanung</div>
          <div className="mt-1 text-[var(--brand-accent)]">
            <span className="font-semibold">
              {selectedPlan?.title || selectedPlan?.filters?.finalVariantLabel || "Dieser Plan"}
            </span>{" "}
            wurde als Arbeitsgrundlage in den Planner übernommen. Änderungen kannst du jetzt bewusst als neuen Stand
            weiterentwickeln und anschließend wieder teilen oder als finalen Gruppenplan speichern.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedPlan?.filters?.pinnedVariantLabel ? (
              <span className="rounded-full border border-[var(--brand-accent)]/25 bg-white px-3 py-1 text-xs text-[var(--brand-accent)]">
                Unsere Wahl: {selectedPlan.filters.pinnedVariantLabel}
              </span>
            ) : null}
            {selectedPlan?.filters?.finalGroupStatusLabel ? (
              <span className="rounded-full border border-[var(--brand-accent)]/25 bg-white px-3 py-1 text-xs text-[var(--brand-accent)]">
                {selectedPlan.filters.finalGroupStatusLabel}
              </span>
            ) : null}
            <span className="rounded-full border border-[var(--brand-accent)]/25 bg-white px-3 py-1 text-xs text-[var(--brand-accent)]">
              Änderungen können als neuer Stand gespeichert werden
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={planTitle}
          onChange={(e) => onPlanTitleChange(e.target.value)}
          placeholder="Optionaler Titel (z.B. Date in Berlin)"
          className="min-h-9 min-w-[220px] flex-1 rounded-md border border-[var(--line-subtle)] px-3 py-1.5 text-sm"
        />

        <button
          onClick={() => void onGenerateAIText()}
          disabled={aiLoading || plannedStopsCount === 0}
          className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-60"
        >
          {aiLoading ? "KI generiert..." : "KI-Text erzeugen"}
        </button>

        <button
          onClick={() => void onSaveDefault()}
          disabled={!authReady || !userId || saving || plannedStopsCount === 0}
          className="rounded-md bg-[var(--text-strong)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {!authReady
            ? "Auth..."
            : !userId
              ? "Login nötig"
              : saving
                ? "Speichern..."
                : editingPlanId
                  ? "Als neuen Stand speichern"
                  : "Plan speichern"}
        </button>

        {editingPlanId && groupEnabled && finalChoiceExists ? (
          <button
            onClick={() => void onSaveVariant()}
            disabled={!authReady || !userId || saving || plannedStopsCount === 0}
            className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-60"
          >
            {!authReady
              ? "Auth..."
              : !userId
                ? "Login nötig"
                : saving
                  ? "Speichern..."
                  : "Als neue Gruppenvariante speichern"}
          </button>
        ) : null}

        {groupEnabled && finalChoiceExists ? (
          <button
            onClick={() => void onSaveFinal()}
            disabled={!authReady || !userId || saving || plannedStopsCount === 0}
            className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-60"
          >
            {!authReady
              ? "Auth..."
              : !userId
                ? "Login nötig"
                : saving
                  ? "Speichern..."
                  : "Als finalen Gruppenplan speichern"}
          </button>
        ) : null}

        {groupEnabled && finalChoiceExists ? (
          <button
            onClick={() => void onOpenCurrentPlannerGroupChat()}
            disabled={!authReady || !userId || saving || plannedStopsCount === 0}
            className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-60"
          >
            Gruppenchat zu diesem Plan öffnen
          </button>
        ) : null}

        <button
          onClick={onHandoffPlanToRouteBuilder}
          disabled={plannedStopsCount === 0}
          className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-60"
        >
          Als Creator-Route vorbereiten
        </button>

        <button
          onClick={() => void onLoadPlans()}
          disabled={!authReady || !userId || loadingPlans}
          className="rounded-md border px-3 py-1.5 text-xs"
        >
          {!authReady ? "Auth..." : loadingPlans ? "Lade..." : "Meine Pläne"}
        </button>

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

      {plannedStopsCount > 0 ? (
        <div className="rounded-2xl border bg-[var(--bg-panel)] px-4 py-3 text-sm text-[var(--text-muted)]">
          Wenn dein Tagesplan steht, kannst du ihn mit <span className="font-semibold">Als Creator-Route vorbereiten</span> direkt in den
          Route Builder übernehmen, dort mit Cover und Beschreibung ausarbeiten und später veröffentlichen.
        </div>
      ) : null}

      {plannedStopsCount > 0 && groupEnabled ? (
        <div className="rounded-2xl border border-[var(--brand-accent)]/25 bg-[var(--brand-accent-soft)]/70 px-4 py-3 text-sm text-[var(--brand-accent)]">
          <div className="font-semibold">Für eure Gruppe priorisiert</div>
          <div className="mt-1 text-[var(--brand-accent)]">
            {groupPlanningSignals.sharedAcrossAll.length > 0
              ? `Der Plan stützt sich zuerst auf gemeinsame Nenner wie ${groupPlanningSignals.sharedAcrossAll.join(", ")}.`
              : groupPlanningSignals.overlapping.length > 0
                ? `Der Plan balanciert wiederkehrende Gruppensignale wie ${groupPlanningSignals.overlapping.join(", ")}.`
                : "Der Plan gleicht mehrere unterschiedliche Vorlieben aus und versucht einen fairen Mittelweg."}
          </div>
          {groupPlanningSignals.uniqueSignals.length > 0 ? (
            <div className="mt-2 text-xs text-[var(--brand-accent)]">
              Berücksichtigte Einzelwünsche:{" "}
              {groupPlanningSignals.uniqueSignals
                .map((participant) => `${participant.name}: ${participant.interests.slice(0, 2).join(", ")}`)
                .join(" | ")}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-[var(--brand-accent)]/35 bg-white px-2 py-1">
              {groupPlanSummary.sharedCount} gemeinsame Nenner gehalten
            </span>
            <span className="rounded-full border border-[var(--brand-accent)]/35 bg-white px-2 py-1">
              {groupPlanSummary.balancedCount} ausbalancierte Kompromisse
            </span>
            <span className="rounded-full border border-[var(--brand-accent)]/35 bg-white px-2 py-1">
              {groupPlanSummary.singlePreferenceCount} bewusste Einzelwünsche
            </span>
          </div>
          {groupPlanSummary.matchedInterests.length > 0 ? (
            <div className="mt-2 text-xs text-[var(--brand-accent)]">
              Im Plan sichtbar: {groupPlanSummary.matchedInterests.join(", ")}
            </div>
          ) : null}
          {groupPlanSummary.reducedThemes.length > 0 ? (
            <div className="mt-1 text-xs text-[var(--brand-accent)]">
              Abgewogen oder abgeschwächt: {groupPlanSummary.reducedThemes.join(", ")}
            </div>
          ) : null}
        </div>
      ) : null}

      {aiText ? (
        <div className="p-4 border rounded-lg text-sm text-[var(--text-muted)] leading-relaxed whitespace-pre-wrap">
          {aiText}
        </div>
      ) : null}

      {authReady && userId ? (
        <div className="text-xs text-[var(--text-muted)]">User: {userId.slice(0, 8)}...</div>
      ) : !authReady ? (
        <div className="text-sm text-[var(--text-muted)]">Auth wird vorbereitet...</div>
      ) : (
        <div className="text-sm text-[var(--text-muted)]">
          Kein aktiver Nutzer. Für Speichern, Teilen und eigene Pläne bitte anmelden oder als Gast fortfahren.
        </div>
      )}
    </div>
  );
}
