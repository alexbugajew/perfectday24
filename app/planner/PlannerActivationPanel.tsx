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
      title: presetActive
        ? "Dein Quickstart ist angekommen."
        : cityLabel && cityLabel !== "-"
          ? `Wir planen deinen Tag in ${cityLabel}...`
          : "Wir planen deinen Tag...",
      body: "Orte, Eventfenster, Wege und Timing werden zu einem konkreten Vorschlag zusammengeführt.",
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
      title: `${plannedStopsCount} Stops als erster Ablauf.`,
      body: "Du kannst die Variante vergleichen, Stops verschieben, speichern oder als gemeinsame Wahl markieren.",
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
    badge: "Bereit",
    title: "Der Planner wartet auf deinen Rahmen.",
    body: "Setze Stadt, Anlass, Fokus und Startpunkt. Danach entsteht automatisch der erste Vorschlag.",
    toneClass: "border-[var(--line-subtle)] bg-white text-[var(--text-muted)]",
  };
}

export default function PlannerActivationPanel(props: PlannerActivationPanelProps) {
  const {
    cityLabel,
    eventCandidatesCount,
    expandedRadius,
    hasPlannerData,
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
    routeProfileLabel,
    startPointLabel,
    templateLabel,
    onOpenConfig,
    onRerollPlan,
    onResumeLatestPlan,
    onShareLatestPlan,
    onUseCurrentLocation,
  } = props;

  const activation = buildActivationState(props);
  const steps = [
    {
      label: presetActive || templateLabel ? "Rahmen übernommen" : "Rahmen gesetzt",
      done: presetActive || Boolean(templateLabel) || cityLabel !== "-",
      active: false,
    },
    {
      label: "Optionen prüfen",
      done: plannerLoading || plannedStopsCount > 0 || resultsCount > 0 || hasPlannerData,
      active: plannerLoading,
    },
    {
      label: "Ablauf bereit",
      done: plannedStopsCount > 0,
      active: false,
    },
  ];

  return (
    <div className="w-full rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
          Activation
        </div>
        <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${activation.toneClass}`}>
          {activation.badge}
        </span>
      </div>

      <h2 className="mt-3 text-xl font-semibold leading-tight tracking-tight text-[var(--text-strong)]">
        {activation.title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{activation.body}</p>

      {templateLabel ? (
        <div className="mt-3 rounded-md border border-[var(--brand-accent)]/25 bg-white px-3 py-2 text-xs text-[var(--brand-accent)]">
          Vorlage geladen: <span className="font-semibold">{templateLabel}</span>
        </div>
      ) : presetActive ? (
        <div className="mt-3 rounded-md border border-[var(--state-success)]/25 bg-white px-3 py-2 text-xs text-[var(--state-success)]">
          Quickstart-Parameter wurden übernommen.
        </div>
      ) : null}

      {latestPlanTitle ? (
        <div className="mt-3 rounded-md border border-[var(--line-subtle)] bg-white px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Weitermachen
            </span>
            {latestPlanMeta ? (
              <span className="shrink-0 rounded-full bg-[var(--bg-panel)] px-2 py-1 text-[10px] text-[var(--text-muted)]">
                {latestPlanMeta}
              </span>
            ) : null}
          </div>
          <div className="mt-1 line-clamp-1 text-sm font-semibold text-[var(--text-strong)]">
            {latestPlanTitle}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onResumeLatestPlan}
              className="rounded-md bg-[var(--text-strong)] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-[#1f2937]"
            >
              Fortsetzen
            </button>
            <button
              type="button"
              onClick={onShareLatestPlan}
              className="rounded-md border border-[var(--line-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)]"
            >
              Teilen
            </button>
          </div>
        </div>
      ) : loadingPlans ? (
        <div className="mt-3 rounded-md border border-[var(--line-subtle)] bg-white px-3 py-2 text-xs text-[var(--text-muted)]">
          Gespeicherte Pläne werden geprüft.
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {[
          ["Stadt", cityLabel],
          ["Rahmen", plannerSummaryLine],
          ["Start", startPointLabel || "Startpunkt offen"],
          ["Signale", `${eventCandidatesCount} Events | ${interestsCount} Vorlieben`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-[rgba(68,57,46,0.08)] bg-white px-3 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {label}
            </div>
            <div className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[var(--text-strong)]">
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2">
        {steps.map((step, index) => (
          <div
            key={step.label}
            className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
              step.done
                ? "border-[var(--state-success)]/25 bg-white text-[var(--state-success)]"
                : step.active
                  ? "border-[var(--brand-accent)]/25 bg-white text-[var(--brand-accent)]"
                  : "border-[var(--line-subtle)] bg-white text-[var(--text-muted)]"
            }`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-panel)] text-[11px] font-semibold">
              {index + 1}
            </span>
            <span className="font-medium">{step.label}</span>
          </div>
        ))}
      </div>

      {(expandedRadius || relaxedFilters) && plannedStopsCount > 0 ? (
        <div className="mt-3 rounded-md border border-[var(--brand-accent)]/25 bg-white px-3 py-2 text-xs leading-5 text-[var(--brand-accent)]">
          Der Planner hat den Suchraum intelligent erweitert, damit der erste Vorschlag nicht leer bleibt.
        </div>
      ) : null}

      {plannedStopsCount > 0 ? (
        <div className="mt-4">
          <a
            href="#planner-results"
            className="flex w-full items-center justify-center rounded-2xl bg-[#171717] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1f2937]"
          >
            Vorschlag ansehen →
          </a>
        </div>
      ) : plannerError || (hasPlannerData && resultsCount === 0) ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={onRerollPlan}
            disabled={plannerLoading}
            className="flex w-full items-center justify-center rounded-2xl border border-[var(--line-subtle)] bg-white px-5 py-3 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)] disabled:opacity-60"
          >
            Neu generieren
          </button>
        </div>
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
        {interestsCount === 0 ? (
          <a
            href="/profile#profile-interests"
            className="rounded-md border border-[var(--brand-accent)]/25 bg-[var(--brand-accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--brand-accent)] transition hover:bg-white"
          >
            Vorlieben speichern
          </a>
        ) : null}
        <span className="rounded-md border border-[var(--line-subtle)] bg-white px-3 py-1.5 text-xs text-[var(--text-muted)]">
          {routeProfileLabel}
        </span>
      </div>
    </div>
  );
}
