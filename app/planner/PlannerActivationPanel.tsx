"use client";

type PlannerActivationPanelProps = {
  cityLabel: string;
  plannerSummaryLine: string;
  startPointLabel: string;
  routeProfileLabel: string;
  plannerLoading: boolean;
  plannerError: string | null;
  hasPlannerData: boolean;
  hasValidPlannerOrigin: boolean;
  citiesLoading: boolean;
  presetActive: boolean;
  templateLabel: string | null;
  plannedStopsCount: number;
  resultsCount: number;
  eventCandidatesCount: number;
  interestsCount: number;
  expandedRadius: boolean;
  relaxedFilters: boolean;
  latestPlanMeta: string | null;
  latestPlanTitle: string | null;
  loadingPlans: boolean;
  onOpenConfig: () => void;
  onResumeLatestPlan: () => void;
  onShareLatestPlan: () => void;
  onUseCurrentLocation: () => void;
  onRerollPlan: () => void;
};

type ActivationState = {
  badge: string;
  body: string;
  toneClass: string;
  title: string;
};

function buildActivationState({
  cityLabel,
  citiesLoading,
  hasPlannerData,
  hasValidPlannerOrigin,
  plannerError,
  plannerLoading,
  plannedStopsCount,
  presetActive,
  resultsCount,
}: Pick<
  PlannerActivationPanelProps,
  | "cityLabel"
  | "citiesLoading"
  | "hasPlannerData"
  | "hasValidPlannerOrigin"
  | "plannerError"
  | "plannerLoading"
  | "plannedStopsCount"
  | "presetActive"
  | "resultsCount"
>): ActivationState {
  if (citiesLoading) {
    return {
      badge: "Städte laden",
      title: "Wir bereiten den Planner vor.",
      body: "Stadt- und Startdaten werden geladen, bevor der erste belastbare Vorschlag entsteht.",
      toneClass: "border-[var(--line-subtle)] bg-white text-[var(--text-muted)]",
    };
  }

  if (!hasValidPlannerOrigin) {
    return {
      badge: "Startpunkt prüfen",
      title: "Ein genauer Start macht den Plan deutlich besser.",
      body: "Wähle einen Startpunkt oder nutze deinen aktuellen Standort, damit Radius und Wege realistisch bleiben.",
      toneClass: "border-[var(--state-warning)]/30 bg-[var(--brand-accent-cloud)] text-[var(--state-warning)]",
    };
  }

  if (plannerLoading) {
    return {
      badge: "Plan wird erstellt",
      title:
        cityLabel && cityLabel !== "-"
          ? `Wir planen deinen Tag in ${cityLabel}...`
          : "Wir planen deinen Tag...",
      body: "Orte, Events, Wege und Timing werden zu einem echten Vorschlag zusammengestellt.",
      toneClass: "border-[var(--brand-accent)]/30 bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]",
    };
  }

  if (plannerError) {
    return {
      badge: "Eingriff nötig",
      title: "Der letzte Lauf braucht eine Korrektur.",
      body: "Prüfe Startpunkt, Fokus oder Radius. Danach kann der Planner den Vorschlag neu berechnen.",
      toneClass: "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (plannedStopsCount > 0) {
    return {
      badge: "Vorschlag bereit",
      title: `Dein Plan steht — ${plannedStopsCount} Stops, alles abgestimmt.`,
      body: "Schau ihn dir an, verschiebe einzelne Stops oder starte direkt die Route.",
      toneClass: "border-[var(--state-success)]/30 bg-[var(--brand-accent-cloud)] text-[var(--state-success)]",
    };
  }

  if (hasPlannerData && resultsCount === 0) {
    return {
      badge: "Mehr Optionen nötig",
      title: "Noch kein belastbarer Vorschlag.",
      body: "Erweitere den Umkreis, prüfe den Startpunkt oder wechsle kurz auf einen klassischen Fokus.",
      toneClass: "border-[var(--state-warning)]/30 bg-[var(--brand-accent-cloud)] text-[var(--state-warning)]",
    };
  }

  return {
    badge: "Los geht's",
    title: "Wo soll dein Tag stattfinden?",
    body: "Wähle eine Stadt in der Leiste unten – PerfectDay24 plant deinen Tag automatisch.",
    toneClass: "border-[var(--line-subtle)] bg-white text-[var(--text-muted)]",
  };
}

export default function PlannerActivationPanel(props: PlannerActivationPanelProps) {
  const {
    citiesLoading,
    hasValidPlannerOrigin,
    latestPlanTitle,
    plannerError,
    plannerLoading,
    plannedStopsCount,
    resultsCount,
    hasPlannerData,
    onOpenConfig,
    onRerollPlan,
    onResumeLatestPlan,
    onUseCurrentLocation,
  } = props;

  const isLoading = plannerLoading || citiesLoading;
  const activation = buildActivationState(props);

  return (
    <div className="w-full rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-3">
      <div className="flex items-center justify-end gap-2">
        {isLoading && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand-accent)] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--brand-accent)]" />
          </span>
        )}
        <span className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-all ${activation.toneClass} ${isLoading ? "animate-pulse" : ""}`}>
          {activation.badge}
        </span>
      </div>

      <h2 className="mt-2 text-xl font-semibold leading-tight tracking-tight text-[var(--text-strong)]">
        {activation.title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{activation.body}</p>

      {plannedStopsCount > 0 ? (
        <a
          href="#planner-results"
          className="mt-4 flex w-full items-center justify-center rounded-2xl bg-[#171717] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1f2937] active:scale-[0.98]"
        >
          Plan ansehen →
        </a>
      ) : plannerError || (hasPlannerData && resultsCount === 0) ? (
        <button
          type="button"
          onClick={onRerollPlan}
          disabled={plannerLoading}
          className="mt-4 flex w-full items-center justify-center rounded-2xl border border-[var(--line-subtle)] bg-white px-5 py-3 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)] disabled:opacity-60"
        >
          Neu generieren
        </button>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpenConfig}
          className="rounded-md border border-[var(--line-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
        >
          Mehr anpassen
        </button>
        {!hasValidPlannerOrigin ? (
          <button
            type="button"
            onClick={onUseCurrentLocation}
            className="rounded-md border border-[var(--line-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
          >
            Standort nutzen
          </button>
        ) : null}
        {latestPlanTitle ? (
          <button
            type="button"
            onClick={onResumeLatestPlan}
            className="rounded-md border border-[var(--line-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
          >
            Letzten Plan fortsetzen
          </button>
        ) : null}
      </div>
    </div>
  );
}
