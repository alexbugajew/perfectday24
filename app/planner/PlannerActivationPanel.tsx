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
      toneClass: "border-[var(--state-error)]/30 bg-[rgba(161,75,69,0.08)] text-[var(--state-error)]",
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
    eventCandidatesCount,
    expandedRadius,
    hasValidPlannerOrigin,
    interestsCount,
    latestPlanMeta,
    latestPlanTitle,
    loadingPlans,
    plannerError,
    plannerLoading,
    plannerSummaryLine,
    plannedStopsCount,
    presetActive,
    relaxedFilters,
    resultsCount,
    hasPlannerData,
    onOpenConfig,
    onRerollPlan,
    onResumeLatestPlan,
    onShareLatestPlan,
    onUseCurrentLocation,
    routeProfileLabel,
    startPointLabel,
    templateLabel,
  } = props;

  const isLoading = plannerLoading || citiesLoading;
  const activation = buildActivationState(props);
  const contextChips = [
    { label: "Start", value: startPointLabel || "-" },
    { label: "Profil", value: routeProfileLabel },
    { label: "Setup", value: plannerSummaryLine || "Standard" },
    interestsCount > 0 ? { label: "Vorlieben", value: String(interestsCount) } : null,
    eventCandidatesCount > 0 ? { label: "Events", value: String(eventCandidatesCount) } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <div className="flex h-full w-full flex-col rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft)]">
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

      <h2 className="mt-3 text-xl font-semibold leading-tight tracking-tight text-[var(--text-strong)]">
        {activation.title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{activation.body}</p>

      <div className="mt-3 grid gap-2">
        {contextChips.slice(0, 3).map((chip) => (
          <div
            key={chip.label}
            className="flex min-w-0 items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-white px-3 py-2"
          >
            <span className="pd24-meta shrink-0">
              {chip.label}
            </span>
            <span className="min-w-0 truncate text-sm font-semibold text-[var(--text-strong)]">
              {chip.value}
            </span>
          </div>
        ))}
      </div>

      {(presetActive || templateLabel || expandedRadius || relaxedFilters || latestPlanMeta || loadingPlans) ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {templateLabel ? (
            <span className="rounded-full border border-[var(--brand-accent)]/25 bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--brand-accent)]">
              Vorlage: {templateLabel}
            </span>
          ) : presetActive ? (
            <span className="rounded-full border border-[var(--brand-accent)]/20 bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--brand-accent)]">
              Preset aktiv
            </span>
          ) : null}
          {expandedRadius ? (
            <span className="rounded-full border border-[var(--state-warning)]/25 bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--state-warning)]">
              Umkreis erweitert
            </span>
          ) : null}
          {relaxedFilters ? (
            <span className="rounded-full border border-[var(--state-warning)]/25 bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--state-warning)]">
              Filter gelockert
            </span>
          ) : null}
          {latestPlanMeta ? (
            <span className="rounded-full border border-[var(--line-subtle)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
              {latestPlanMeta}
            </span>
          ) : null}
          {loadingPlans ? (
            <span className="rounded-full border border-[var(--line-subtle)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
              Pläne laden
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto pt-4">
        {plannedStopsCount > 0 ? (
        <a
          href="#planner-results"
          className="pd24-btn pd24-btn-primary mt-4 w-full active:scale-[0.98]"
        >
          Plan ansehen →
        </a>
      ) : plannerError || (hasPlannerData && resultsCount === 0) ? (
        <button
          type="button"
          onClick={onRerollPlan}
          disabled={plannerLoading}
          className="pd24-btn pd24-btn-secondary mt-4 w-full"
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
          Feinjustieren
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
        {latestPlanTitle && plannedStopsCount > 0 ? (
          <button
            type="button"
            onClick={onShareLatestPlan}
            className="rounded-md border border-[var(--line-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
          >
            Teilen
          </button>
        ) : null}
      </div>
      </div>
    </div>
  );
}
