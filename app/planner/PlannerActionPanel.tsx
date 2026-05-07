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
  plannedStopsCount: number;
  groupEnabled: boolean;
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
  plannedStopsCount,
  groupEnabled,
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
            <span className="font-semibold">{plannerTemplateLoadedLabel}</span> wurde als Ausgangspunkt uebernommen. Passe jetzt Interessen,
            Radius und Varianten an und veroeffentliche den fertigen Tag spaeter bei Bedarf als Creator-Route.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {plannerTemplateSourceSlug ? (
              <Link
                href={`/routes/${plannerTemplateSourceSlug}`}
                className="rounded-full border border-[var(--state-success)]/25 bg-white px-3 py-1 text-xs text-[var(--state-success)]"
              >
                Originalroute oeffnen
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
            wurde als Arbeitsgrundlage in den Planner uebernommen. Aenderungen kannst du jetzt bewusst als neuen Stand
            weiterentwickeln und anschliessend wieder teilen oder als finalen Gruppenplan speichern.
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
              Aenderungen koennen als neuer Stand gespeichert werden
            </span>
          </div>
        </div>
      ) : null}

      <div className="space-y-3 rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.4fr)]">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Titel
            </span>
            <input
              value={planTitle}
              onChange={(e) => onPlanTitleChange(e.target.value)}
              placeholder="Optionaler Titel (z.B. Date in Berlin)"
              className="mt-1 min-h-10 w-full rounded-md border border-[var(--line-subtle)] bg-white px-3 py-2 text-sm"
            />
          </label>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Beschreibung
            </div>
            <div className="mt-1 min-h-20 rounded-md border border-[var(--line-subtle)] bg-white px-3 py-2 text-sm leading-relaxed text-[var(--text-muted)]">
              {aiText ? (
                <div className="whitespace-pre-wrap">{aiText}</div>
              ) : (
                <span>
                  Noch keine Beschreibung erzeugt. Sobald dein Plan steht, kannst du den KI-Text direkt hier erzeugen.
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onGenerateAIText()}
            disabled={aiLoading || plannedStopsCount === 0}
            className="rounded-md border border-[var(--line-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] disabled:opacity-60"
          >
            {aiLoading ? "KI generiert..." : "KI-Text erzeugen"}
          </button>
        </div>
      </div>

      {plannedStopsCount > 0 && groupEnabled ? (
        <div className="rounded-2xl border border-[var(--brand-accent)]/25 bg-[var(--brand-accent-soft)]/70 px-4 py-3 text-sm text-[var(--brand-accent)]">
          <div className="font-semibold">Fuer eure Gruppe priorisiert</div>
          <div className="mt-1 text-[var(--brand-accent)]">
            {groupPlanningSignals.sharedAcrossAll.length > 0
              ? `Der Plan stuetzt sich zuerst auf gemeinsame Nenner wie ${groupPlanningSignals.sharedAcrossAll.join(", ")}.`
              : groupPlanningSignals.overlapping.length > 0
                ? `Der Plan balanciert wiederkehrende Gruppensignale wie ${groupPlanningSignals.overlapping.join(", ")}.`
                : "Der Plan gleicht mehrere unterschiedliche Vorlieben aus und versucht einen fairen Mittelweg."}
          </div>
          {groupPlanningSignals.uniqueSignals.length > 0 ? (
            <div className="mt-2 text-xs text-[var(--brand-accent)]">
              Beruecksichtigte Einzelwuensche:{" "}
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
              {groupPlanSummary.singlePreferenceCount} bewusste Einzelwuensche
            </span>
          </div>
          {groupPlanSummary.matchedInterests.length > 0 ? (
            <div className="mt-2 text-xs text-[var(--brand-accent)]">
              Im Plan sichtbar: {groupPlanSummary.matchedInterests.join(", ")}
            </div>
          ) : null}
          {groupPlanSummary.reducedThemes.length > 0 ? (
            <div className="mt-1 text-xs text-[var(--brand-accent)]">
              Abgewogen oder abgeschwaecht: {groupPlanSummary.reducedThemes.join(", ")}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
