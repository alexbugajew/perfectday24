"use client";

import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import InternalMonetizationSlot from "@/components/monetization/InternalMonetizationSlot";
import MonetizationDebugPanel from "@/components/monetization/MonetizationDebugPanel";
import MonetizedExternalLink from "@/components/monetization/MonetizedExternalLink";
import type { PublicAffiliateResolution } from "@/lib/monetization/affiliate-shared";
import {
  getInterestCatalog,
  norm,
  type EvaluationMode,
  type EventPlanningMode,
  type ExperienceMode,
  type GroupMember,
  type PlannerEventRow,
  type PlanMode,
  type RouteProfile,
  type StartPointType,
  plannerEventLabel,
} from "@/lib/planner";
import {
  clamp,
  countryLabel,
  eventDebugSignature,
  eventDedupeFlags,
  eventStrictnessForExperienceMode,
  experienceModeHint,
  experienceModeLabel,
  experienceOptionsForOccasion,
  providerLabel,
  routeProfileHint,
  routeProfileLabel,
  startPointSuggestionSourceLabel,
  startPointSuggestionTypeLabel,
} from "./helpers";
import type {
  CityRow,
  GroupPlanningSignals,
  GroupProfileSuggestion,
  PlannerFriendSuggestion,
  StartPoint,
  StartPointSuggestion,
} from "./types";

type PlannerControlsSectionProps = {
  showPrefsModal: boolean;
  setShowPrefsModal: Dispatch<SetStateAction<boolean>>;
  profileRequired: boolean;
  interests: string[];
  interestInput: string;
  setInterestInput: Dispatch<SetStateAction<string>>;
  addInterestFromInput: () => void;
  toggleInterest: (tag: string) => void;
  profileSaving: boolean;
  cityLabel: string;
  groupEnabled: boolean;
  groupMembers: GroupMember[];
  eventCandidates: PlannerEventRow[];
  citiesLoading: boolean;
  selectedCountryCode: string;
  setSelectedCountryCode: Dispatch<SetStateAction<string>>;
  resetStartPointForSelectedCity: () => void;
  resetPlan: () => void;
  availableCountryCodes: string[];
  selectedCitySlug: string | null;
  setSelectedCitySlug: Dispatch<SetStateAction<string | null>>;
  visibleCities: CityRow[];
  showPlannerConfig: boolean;
  setShowPlannerConfig: Dispatch<SetStateAction<boolean>>;
  plannerAudienceLabel: string;
  plannerSummaryLine: string;
  effectiveInterests: string[];
  eventModesAvailable: boolean;
  routeProfile: RouteProfile;
  budget: string;
  setBudget: Dispatch<SetStateAction<string>>;
  occasion: string;
  setOccasion: Dispatch<SetStateAction<string>>;
  experienceMode: ExperienceMode;
  setExperienceMode: Dispatch<SetStateAction<ExperienceMode>>;
  planDate: string;
  setPlanDate: Dispatch<SetStateAction<string>>;
  planMode: PlanMode;
  setPlanMode: Dispatch<SetStateAction<PlanMode>>;
  stopsCount: number;
  setStopsCount: Dispatch<SetStateAction<number>>;
  fullDayActsAfterBreakfast: number;
  setFullDayActsAfterBreakfast: Dispatch<SetStateAction<number>>;
  fullDayActsAfterLunch: number;
  setFullDayActsAfterLunch: Dispatch<SetStateAction<number>>;
  sortMode: "match" | "distance";
  setSortMode: Dispatch<SetStateAction<"match" | "distance">>;
  setRouteProfile: Dispatch<SetStateAction<RouteProfile>>;
  setGroupEnabled: Dispatch<SetStateAction<boolean>>;
  evaluationMode: EvaluationMode;
  setEvaluationMode: Dispatch<SetStateAction<EvaluationMode>>;
  startPoint: StartPoint;
  setStartPoint: Dispatch<SetStateAction<StartPoint>>;
  updateStartPointType: (nextType: StartPointType) => void;
  startPointSuggestions: StartPointSuggestion[];
  startPointSearchLoading: boolean;
  startPointSearchError: string | null;
  applyStartPointSuggestion: (suggestion: StartPointSuggestion) => void;
  suggestedCustomStartPoint: StartPointSuggestion | null;
  manualStartFallsBackToCityCenter: boolean;
  selectedCity: CityRow | null;
  selectedCityFallbackLabel: string;
  shouldUseCurrentLocationAsOrigin: boolean;
  useCurrentLocationAsStartPoint: () => void;
  clearStartPoint: () => void;
  effectiveStartPoint: StartPoint;
  userLat: number | null;
  userLng: number | null;
  radiusKm: number;
  setRadiusKm: Dispatch<SetStateAction<number>>;
  geoError: string | null;
  groupPlanningSignals: GroupPlanningSignals;
  activeGroupLabel: string | null;
  friendsLoading: boolean;
  friendSuggestions: PlannerFriendSuggestion[];
  addFriendSuggestionToGroup: (friend: PlannerFriendSuggestion) => void;
  memberName: string;
  setMemberName: Dispatch<SetStateAction<string>>;
  memberProfileQuery: string;
  setMemberProfileQuery: Dispatch<SetStateAction<string>>;
  setMemberProfileError: Dispatch<SetStateAction<string | null>>;
  memberInterestInput: string;
  setMemberInterestInput: Dispatch<SetStateAction<string>>;
  memberProfileSearchLoading: boolean;
  memberProfileSuggestions: GroupProfileSuggestion[];
  selectMemberProfileSuggestion: (suggestion: GroupProfileSuggestion) => void;
  addGroupMemberFromProfile: () => Promise<void>;
  memberProfileLoading: boolean;
  addManualGroupMember: () => void;
  clearGroup: () => void;
  memberProfileError: string | null;
  removeGroupMember: (memberId: string) => void;
  timingWarnings: Array<{ stopLabel: string; warning: string }>;
  eventPlanningMode: EventPlanningMode;
  setEventPlanningMode: Dispatch<SetStateAction<EventPlanningMode>>;
  selectedEventId: string | null;
  setSelectedEventId: Dispatch<SetStateAction<string | null>>;
  selectedEvent: PlannerEventRow | null;
  selectedEventIndex: number;
  showToast: (msg: string) => void;
  eventProviderSummary: Array<[string, number]>;
  eventCategorySummary: Array<[string, number]>;
  affiliateResolution: PublicAffiliateResolution;
  userId: string | null;
  effectiveCitySlug: string | null;
  eventDebugRows: PlannerEventRow[];
  eventDebugGroupCounts: Map<string, number>;
  monetizationDebug: boolean;
};

const interestGroupLabels: Record<string, string> = {
  food: "Küche & Food",
  activity: "Aktivität",
  sightseeing: "Sightseeing & Kultur",
  nightlife: "Nightlife & Drinks",
  ambience: "Ambiente & Outdoor",
};

export default function PlannerControlsSection({
  showPrefsModal,
  setShowPrefsModal,
  profileRequired,
  interests,
  interestInput,
  setInterestInput,
  addInterestFromInput,
  toggleInterest,
  profileSaving,
  cityLabel,
  groupEnabled,
  groupMembers,
  eventCandidates,
  citiesLoading,
  selectedCountryCode,
  setSelectedCountryCode,
  resetStartPointForSelectedCity,
  resetPlan,
  availableCountryCodes,
  selectedCitySlug,
  setSelectedCitySlug,
  visibleCities,
  showPlannerConfig,
  setShowPlannerConfig,
  plannerAudienceLabel,
  plannerSummaryLine,
  effectiveInterests,
  eventModesAvailable,
  routeProfile,
  budget,
  setBudget,
  occasion,
  setOccasion,
  experienceMode,
  setExperienceMode,
  planDate,
  setPlanDate,
  planMode,
  setPlanMode,
  stopsCount,
  setStopsCount,
  fullDayActsAfterBreakfast,
  setFullDayActsAfterBreakfast,
  fullDayActsAfterLunch,
  setFullDayActsAfterLunch,
  sortMode,
  setSortMode,
  setRouteProfile,
  setGroupEnabled,
  evaluationMode,
  setEvaluationMode,
  startPoint,
  setStartPoint,
  updateStartPointType,
  startPointSuggestions,
  startPointSearchLoading,
  startPointSearchError,
  applyStartPointSuggestion,
  suggestedCustomStartPoint,
  manualStartFallsBackToCityCenter,
  selectedCity,
  selectedCityFallbackLabel,
  shouldUseCurrentLocationAsOrigin,
  useCurrentLocationAsStartPoint,
  clearStartPoint,
  effectiveStartPoint,
  userLat,
  userLng,
  radiusKm,
  setRadiusKm,
  geoError,
  groupPlanningSignals,
  activeGroupLabel,
  friendsLoading,
  friendSuggestions,
  addFriendSuggestionToGroup,
  memberName,
  setMemberName,
  memberProfileQuery,
  setMemberProfileQuery,
  setMemberProfileError,
  memberInterestInput,
  setMemberInterestInput,
  memberProfileSearchLoading,
  memberProfileSuggestions,
  selectMemberProfileSuggestion,
  addGroupMemberFromProfile,
  memberProfileLoading,
  addManualGroupMember,
  clearGroup,
  memberProfileError,
  removeGroupMember,
  timingWarnings,
  eventPlanningMode,
  setEventPlanningMode,
  selectedEventId,
  setSelectedEventId,
  selectedEvent,
  selectedEventIndex,
  showToast,
  eventProviderSummary,
  eventCategorySummary,
  affiliateResolution,
  userId,
  effectiveCitySlug,
  eventDebugRows,
  eventDebugGroupCounts,
  monetizationDebug,
}: PlannerControlsSectionProps) {
  const experienceOptions = eventModesAvailable
    ? experienceOptionsForOccasion(occasion)
    : experienceOptionsForOccasion(occasion).filter(
        (option) => option.value !== "event_visit" && option.value !== "market_festival"
      );
  const displayedStartPointLabel =
    startPoint.mode === "current_location" && !shouldUseCurrentLocationAsOrigin
      ? effectiveStartPoint.label
      : startPoint.label;

  const interestCatalog = Object.entries(getInterestCatalog()).reduce<Record<string, string[]>>(
    (acc, [interest, spec]) => {
      const group = spec.group;
      if (!acc[group]) acc[group] = [];
      acc[group].push(interest);
      return acc;
    },
    {}
  );

  return (
    <>
      {showPrefsModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Deine Vorlieben</div>
                <div className="text-sm text-[var(--text-muted)]">
                  Wähle ein paar Interessen (max. 12). Diese werden in deinem Profil gespeichert und bei neuen Planungen automatisch verwendet.
                </div>
              </div>
              <button
                onClick={() => {
                  if (!profileRequired || interests.length > 0) {
                    setShowPrefsModal(false);
                  }
                }}
                disabled={profileRequired && interests.length === 0}
                className="rounded border px-3 py-2 text-sm disabled:opacity-50"
              >
                Schliessen
              </button>
            </div>

            {profileRequired && interests.length === 0 ? (
              <div className="mt-3 rounded-lg border border-[var(--state-warning)]/25 bg-[var(--brand-accent-cloud)] px-3 py-2 text-sm text-[var(--state-warning)]">
                Bitte wähle zuerst deine Interessen aus. So kann PerfectDay24 dir und deiner Gruppe passendere Vorschläge machen.
              </div>
            ) : null}

            <div className="my-3 max-h-[55vh] space-y-4 overflow-y-auto pr-1">
              {Object.entries(interestCatalog).map(([group, tags]) => (
                <div key={group}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {interestGroupLabels[group] ?? group}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => {
                      const selected = interests.includes(norm(tag));
                      return (
                        <button
                          key={tag}
                          onClick={() => toggleInterest(tag)}
                          className={`rounded border px-3 py-2 text-sm ${selected ? "bg-[var(--text-strong)] text-white" : ""}`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={interestInput}
                onChange={(e) => setInterestInput(e.target.value)}
                placeholder="Eigene Vorliebe hinzufügen (z.B. Tapas)"
                className="flex-1 rounded-xl border border-[var(--line-subtle)] bg-white p-2 text-[var(--text-strong)] outline-none transition focus:border-[var(--line-strong)]"
              />
              <button
                onClick={addInterestFromInput}
                className="rounded-xl bg-[var(--text-strong)] px-4 py-2 text-sm text-white transition hover:opacity-95"
              >
                Hinzufügen
              </button>
            </div>

            <div className="mt-3 text-xs text-[var(--text-muted)]">
              Aktuell: {interests.length ? interests.join(", ") : "-"}
              {profileSaving ? " | speichere..." : ""}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  if (!profileRequired || interests.length > 0) {
                    setShowPrefsModal(false);
                  }
                }}
                disabled={profileRequired && interests.length === 0}
                className="rounded bg-[var(--text-strong)] px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Fertig
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-[var(--line-subtle)] bg-white p-3 shadow-[var(--shadow-soft)]">
        <div className="mb-3 flex flex-col gap-3 border-b border-[rgba(68,57,46,0.08)] pb-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Filter
            </div>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-[var(--text-strong)]">
              Suche anpassen
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              Stadt, Anlass, Event-Fokus, Gruppe und Mobilitaet definieren. Danach wird aus den starken lokalen Kandidaten ein plausibler Ablauf statt nur einer Liste von Orten.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="warm-chip rounded-md px-2 py-1 text-[11px]">{cityLabel}</span>
            <span className="rounded-md border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-2 py-1 text-[11px] text-[var(--text-muted)]">
              {groupEnabled ? "Gruppenplanung aktiv" : "Persoenlicher Plan"}
            </span>
            <span className="rounded-md border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-2 py-1 text-[11px] text-[var(--text-muted)]">
              {eventCandidates.length} Event-Kandidaten
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-2">
            <label className="rounded-md border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Land
              </div>
              <select
                value={selectedCountryCode}
                onChange={(e) => {
                  setSelectedCountryCode(e.target.value);
                  setSelectedCitySlug(null);
                  resetStartPointForSelectedCity();
                  resetPlan();
                }}
                className="mt-1 w-full bg-transparent text-sm font-medium text-[var(--text-strong)] outline-none"
                disabled={citiesLoading}
              >
                <option value="all">Alle Laender</option>
                {availableCountryCodes.map((countryCode) => (
                  <option key={countryCode} value={countryCode}>
                    {countryLabel(countryCode)}
                  </option>
                ))}
              </select>
            </label>

            <label className="rounded-md border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Stadt
              </div>
              <select
                value={selectedCitySlug ?? "__auto__"}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setSelectedCitySlug(nextValue === "__auto__" ? null : nextValue);
                  resetStartPointForSelectedCity();
                  resetPlan();
                }}
                className="mt-1 w-full bg-transparent text-sm font-medium text-[var(--text-strong)] outline-none"
                disabled={citiesLoading}
              >
                <option value="__auto__">Auto (Standort)</option>
                {visibleCities.map((city) => (
                  <option key={city.slug} value={city.slug}>
                    {city.name}
                    {typeof city.population === "number" ? ` | ${city.population.toLocaleString("de-DE")}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => setShowPlannerConfig((current) => !current)}
              className="rounded-md border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-left transition hover:border-[var(--line-strong)] hover:bg-white"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Planung
                  </div>
                  <div className="mt-1 truncate text-sm font-semibold tracking-tight text-[var(--text-strong)]">
                    {plannerAudienceLabel}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-xs leading-4 text-[var(--text-muted)]">
                    {plannerSummaryLine}
                  </div>
                </div>
                <div className="mt-1 text-xl text-[var(--text-muted)]">{showPlannerConfig ? "−" : "+"}</div>
              </div>
            </button>
          </div>

          {showPlannerConfig ? (
            <div className="rounded-[28px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Planungsdetails
                  </div>
                  <div className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                    Alles, was den Plan fein justiert, liegt jetzt gesammelt in einem ruhigen Block.
                  </div>
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {eventCandidates.length} Event-Kandidaten · {effectiveInterests.length} Vorlieben · {routeProfileLabel(routeProfile)}
                </div>
              </div>

              <div className="grid gap-2">
                <label className="rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Budget</div>
                  <select value={budget} onChange={(e) => setBudget(e.target.value)} className="mt-2 w-full bg-transparent text-base font-medium text-[var(--text-strong)] outline-none">
                    <option value="low">Guenstig</option>
                    <option value="medium">Mittel</option>
                    <option value="high">Premium</option>
                    <option value="free">Kostenlos</option>
                  </select>
                </label>

                <label className="rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Anlass</div>
                  <select value={occasion} onChange={(e) => setOccasion(e.target.value)} className="mt-2 w-full bg-transparent text-base font-medium text-[var(--text-strong)] outline-none">
                    <option value="date">Date</option>
                    <option value="friends">Freunde</option>
                    <option value="family">Familie</option>
                    <option value="party">Party</option>
                    <option value="tourism">Tourismus</option>
                  </select>
                </label>

                <label className="rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Fokus</div>
                  <select value={experienceMode} onChange={(e) => setExperienceMode(e.target.value as ExperienceMode)} className="mt-2 w-full bg-transparent text-base font-medium text-[var(--text-strong)] outline-none">
                    {experienceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {!eventModesAvailable ? (
                    <div className="mt-2 text-xs text-[var(--text-muted)]">
                      Event- und Markt-Foki sind fuer diese Stadt noch nicht voll aktiviert.
                    </div>
                  ) : null}
                </label>

                <label className="rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Datum</div>
                  <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} className="mt-2 w-full bg-transparent text-base font-medium text-[var(--text-strong)] outline-none" />
                </label>

                <label className="rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Tagesfenster</div>
                  <select value={planMode} onChange={(e) => setPlanMode(e.target.value as PlanMode)} className="mt-2 w-full bg-transparent text-base font-medium text-[var(--text-strong)] outline-none">
                    <option value="morning">Vormittag</option>
                    <option value="midday">Mittag</option>
                    <option value="evening">Abend</option>
                    <option value="fullday">Ganzer Tag</option>
                  </select>
                </label>

                <div className="rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Stops</div>
                  {planMode === "fullday" ? (
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm text-[var(--text-muted)]">Fruehstueck bis Mittag</div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setFullDayActsAfterBreakfast((value) => clamp(value - 1, 1, 2))}
                            className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)] transition hover:bg-white"
                          >
                            -
                          </button>
                          <div className="min-w-[28px] text-center font-semibold text-[var(--text-strong)]">
                            {fullDayActsAfterBreakfast}
                          </div>
                          <button
                            onClick={() => setFullDayActsAfterBreakfast((value) => clamp(value + 1, 1, 2))}
                            className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)] transition hover:bg-white"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm text-[var(--text-muted)]">Mittag bis Abend</div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setFullDayActsAfterLunch((value) => clamp(value - 1, 1, 2))}
                            className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)] transition hover:bg-white"
                          >
                            -
                          </button>
                          <div className="min-w-[28px] text-center font-semibold text-[var(--text-strong)]">
                            {fullDayActsAfterLunch}
                          </div>
                          <button
                            onClick={() => setFullDayActsAfterLunch((value) => clamp(value + 1, 1, 2))}
                            className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)] transition hover:bg-white"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-[var(--text-muted)]">
                        {fullDayActsAfterBreakfast + fullDayActsAfterLunch} Aktivitaets-Bloecke ueber den Tag verteilt
                      </div>
                    </div>
                  ) : (
                    <select value={String(stopsCount)} onChange={(e) => setStopsCount(parseInt(e.target.value, 10))} className="mt-2 w-full bg-transparent text-base font-medium text-[var(--text-strong)] outline-none">
                      <option value="1">1 Stop</option>
                      <option value="2">2 Stops</option>
                      <option value="3">3 Stops</option>
                    </select>
                  )}
                </div>

                <label className="rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Sortierung</div>
                  <select value={sortMode} onChange={(e) => setSortMode(e.target.value as "match" | "distance")} className="mt-2 w-full bg-transparent text-base font-medium text-[var(--text-strong)] outline-none">
                    <option value="match">Best Match</option>
                    <option value="distance">Distanz</option>
                  </select>
                </label>

                <label className="rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Mobilitaet</div>
                  <select value={routeProfile} onChange={(e) => setRouteProfile(e.target.value as RouteProfile)} className="mt-2 w-full bg-transparent text-base font-medium text-[var(--text-strong)] outline-none">
                    <option value="foot">Zu Fuss</option>
                    <option value="public_transit">OePNV</option>
                    <option value="car">Auto</option>
                  </select>
                </label>
              </div>

              <div className="mt-3 grid gap-2">
                <button onClick={() => setShowPrefsModal(true)} className="rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3 text-left text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)]">
                  Vorlieben bearbeiten
                  <div className="mt-1 text-xs font-normal text-[var(--text-muted)]">
                    {effectiveInterests.length ? effectiveInterests.join(", ") : "Noch keine Vorlieben gesetzt"}
                  </div>
                </button>

                <label className="flex items-center gap-3 rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3 text-sm text-[var(--text-muted)]">
                  <input type="checkbox" checked={groupEnabled} onChange={(e) => setGroupEnabled(e.target.checked)} className="h-4 w-4 rounded border-[var(--line-subtle)]" />
                  Gruppenplanung
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3 text-sm text-[var(--text-muted)]">
                  <input type="checkbox" checked={evaluationMode === "trace"} onChange={(e) => setEvaluationMode(e.target.checked ? "trace" : "normal")} className="h-4 w-4 rounded border-[var(--line-subtle)]" />
                  Trace
                </label>
              </div>
            </div>
          ) : null}

          <div className="rounded-[28px] border border-[rgba(68,57,46,0.08)] bg-[rgba(255,252,247,0.92)] p-4 shadow-[0_18px_45px_rgba(49,39,27,0.05)] space-y-3 sm:p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-semibold text-[var(--text-strong)]">Startpunkt der Reise</div>
                <div className="hidden text-xs text-[var(--text-muted)]">
                  Lege fest, wo die Planung beginnt: aktueller Standort, Straße, Hotel, Bahnhof oder Flughafen.
                </div>
              </div>
            </div>

            <div className="relative">
              <select
                value={startPoint.type}
                onChange={(e) => updateStartPointType(e.target.value as StartPointType)}
                className="hidden"
              >
                <option value="address">Straße / Adresse</option>
                <option value="hotel">Hotel</option>
                <option value="station">Bahnhof</option>
                <option value="airport">Flughafen</option>
                <option value="other">Sonstiges</option>
              </select>

              <div className="relative">
                <input
                  value={displayedStartPointLabel}
                  onFocus={() =>
                    setStartPoint((prev) =>
                      prev.mode === "custom"
                        ? prev
                        : {
                            ...prev,
                            mode: "custom",
                            type: "address",
                            label:
                              prev.mode === "current_location"
                                ? shouldUseCurrentLocationAsOrigin
                                  ? ""
                                  : effectiveStartPoint.label
                                : prev.label,
                            lat: null,
                            lng: null,
                          }
                    )
                  }
                  onChange={(e) =>
                    setStartPoint((prev) => ({
                      ...prev,
                      mode: "custom",
                      type: prev.mode === "custom" ? prev.type : "address",
                      label: e.target.value,
                      lat: null,
                      lng: null,
                    }))
                  }
                  placeholder="Hotel, Straße, Bahnhof oder anderer Startpunkt"
                  className="w-full rounded-2xl border border-[rgba(68,57,46,0.1)] bg-white/95 px-4 py-3"
                />

                {startPoint.mode === "custom" &&
                (startPointSearchLoading || startPointSuggestions.length > 0 || startPointSearchError) ? (
                  <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-[rgba(68,57,46,0.1)] bg-white shadow-lg">
                    {startPointSearchLoading ? (
                      <div className="px-3 py-2 text-sm text-[var(--text-muted)]">Suche Startpunkte...</div>
                    ) : startPointSearchError ? (
                      <div className="px-3 py-2 text-sm text-red-600">{startPointSearchError}</div>
                    ) : (
                      startPointSuggestions.map((suggestion) => (
                        <button
                          key={`${suggestion.label}-${suggestion.lat}-${suggestion.lng}`}
                          type="button"
                          onClick={() => applyStartPointSuggestion(suggestion)}
                          className="block w-full border-b px-3 py-2 text-left hover:bg-[var(--bg-panel)] last:border-b-0"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-[var(--text-strong)]">
                                {suggestion.label}
                              </div>
                              {suggestion.subtitle ? (
                                <div className="mt-1 text-xs text-[var(--text-muted)]">
                                  {suggestion.subtitle}
                                </div>
                              ) : null}
                            </div>

                            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                              <span className="rounded-full bg-[rgba(193,124,74,0.12)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)]">
                                {startPointSuggestionTypeLabel(suggestion.type)}
                              </span>
                              <span className="rounded-full bg-[rgba(68,57,46,0.07)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                {startPointSuggestionSourceLabel(suggestion.source)}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="text-xs text-[var(--text-muted)]">
              Tippe einen Ort ein und wähle einen Vorschlag aus. Die Koordinaten werden im Hintergrund gesetzt.
            </div>

            {suggestedCustomStartPoint ? (
              <div className="text-xs text-[var(--text-muted)]">
                Erkannter Startpunkt: <span className="font-semibold">{suggestedCustomStartPoint.label}</span>
              </div>
            ) : null}

            {manualStartFallsBackToCityCenter && selectedCity ? (
              <div className="text-xs text-[var(--text-muted)]">
                Noch kein exakter Treffer gewählt. Bis dahin planen wir vorläufig ab{" "}
                <span className="font-semibold">{selectedCityFallbackLabel}</span>.
              </div>
            ) : null}

            {startPoint.mode === "current_location" &&
            !shouldUseCurrentLocationAsOrigin &&
            selectedCitySlug &&
            selectedCity ? (
              <div className="text-xs text-[var(--text-muted)]">
                Du planst gerade fuer <span className="font-semibold">{selectedCity.name}</span>. Deshalb nutzen wir vorlaeufig{" "}
                <span className="font-semibold">{selectedCityFallbackLabel}</span> statt deines aktuellen Standorts.
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={useCurrentLocationAsStartPoint}
                className="rounded-2xl border border-[rgba(68,57,46,0.1)] bg-white/95 px-3 py-2 text-sm text-[var(--text-strong)]"
              >
                Aktuellen Standort übernehmen
              </button>

              <button
                onClick={clearStartPoint}
                className="rounded-2xl border border-[rgba(68,57,46,0.1)] bg-white/95 px-3 py-2 text-sm text-[var(--text-strong)]"
              >
                Felder leeren
              </button>
            </div>

            <div className="text-xs text-[var(--text-muted)]">
              Effektiver Startpunkt: <span className="font-semibold">{effectiveStartPoint.label || "-"}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap rounded-[22px] border border-[rgba(68,57,46,0.08)] bg-white/70 px-4 py-3">
            <label className="font-medium text-[var(--text-strong)]">Umkreis: {radiusKm} km</label>
            <input
              type="range"
              min={1}
              max={50}
              value={radiusKm}
              onChange={(e) => setRadiusKm(parseInt(e.target.value, 10))}
            />
            <div className="text-sm text-[var(--text-muted)]">
              {effectiveStartPoint.lat != null && effectiveStartPoint.lng != null ? (
                <>Startpunkt aktiv...</>
              ) : geoError ? (
                <>Standort aus: {geoError}</>
              ) : (
                <>Startpunkt wird vorbereitet...</>
              )}
            </div>
          </div>

          <div className="text-xs text-[var(--text-muted)]">
            City: <span className="font-semibold">{cityLabel}</span> | Start:{" "}
            <span className="font-semibold">{effectiveStartPoint.label || "-"}</span> | Zeitbudget: ~
            {planMode === "fullday" ? 420 : planMode === "morning" ? 150 : planMode === "midday" ? 210 : 240} Min | Fokus:{" "}
            <span className="font-semibold">{experienceModeLabel(experienceMode, occasion)}</span> | Mobilität:{" "}
            <span className="font-semibold">{routeProfileLabel(routeProfile)}</span> | Vorlieben:{" "}
            {effectiveInterests.length ? effectiveInterests.join(", ") : "- (für bessere Ergebnisse Vorlieben setzen)"}
          </div>

          <div className="text-xs text-[var(--text-muted)]">{routeProfileHint(routeProfile)}</div>

          {groupEnabled && groupMembers.length > 0 ? (
            <div className="rounded-xl border border-[var(--brand-accent)]/25 bg-[var(--brand-accent-soft)]/70 p-3 text-sm text-[var(--brand-accent)]">
              <div className="font-semibold">
                Gruppenplanung für {groupPlanningSignals.participantCount} Personen
              </div>
              <div className="mt-1 text-xs text-[var(--brand-accent)]">
                {groupPlanningSignals.sharedAcrossAll.length > 0
                  ? `Gemeinsame Interessen: ${groupPlanningSignals.sharedAcrossAll.join(", ")}`
                  : groupPlanningSignals.overlapping.length > 0
                    ? `Mehrfach genannte Interessen: ${groupPlanningSignals.overlapping.join(", ")}`
                    : "Noch wenig Überschneidung. Der Planner sucht eher eine ausgewogene Mischung statt eines klaren Gruppenschwerpunkts."}
              </div>
              {groupPlanningSignals.uniqueSignals.length > 0 ? (
                <div className="mt-2 text-xs text-[var(--brand-accent)]">
                  Einzelne Signale:{" "}
                  {groupPlanningSignals.uniqueSignals
                    .map((participant) => `${participant.name}: ${participant.interests.slice(0, 2).join(", ")}`)
                    .join(" | ")}
                </div>
              ) : null}
            </div>
          ) : null}

          {experienceMode !== "classic" ? (
            <div className="space-y-2 rounded-lg border border-[var(--state-warning)]/25 bg-[var(--brand-accent-cloud)] p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold">Lokale Event-Kandidaten</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    Geladen fuer {planDate || "den gewaehlten Tag"} in <span className="font-semibold">{cityLabel}</span>.
                  </div>
                </div>
                <div className="rounded-full border border-[var(--state-warning)]/25 bg-white px-2 py-1 text-xs">
                  {eventCandidates.length} Events gefunden
                </div>
              </div>

              {eventCandidates.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEventPlanningMode("auto");
                        if (!selectedEventId) resetPlan();
                        else {
                          setSelectedEventId(null);
                          resetPlan();
                        }
                      }}
                      className={`rounded-full border px-3 py-2 text-xs ${
                        eventPlanningMode === "auto"
                          ? "border-[var(--state-warning)] bg-[var(--state-warning)] text-white"
                          : "border-[var(--state-warning)]/25 bg-white hover:bg-[var(--brand-accent-cloud)]"
                      }`}
                    >
                      Automatisch passendes Event
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEventPlanningMode("disabled");
                        setSelectedEventId(null);
                        resetPlan();
                      }}
                      className={`rounded-full border px-3 py-2 text-xs ${
                        eventPlanningMode === "disabled"
                          ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                          : "border-[var(--state-warning)]/25 bg-white hover:bg-[var(--brand-accent-cloud)]"
                      }`}
                    >
                      Ohne Event planen
                    </button>
                    {selectedEvent ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEventPlanningMode("locked");
                          resetPlan();
                        }}
                        className={`rounded-full border px-3 py-2 text-xs ${
                          eventPlanningMode === "locked"
                            ? "border-[var(--state-warning)] bg-[var(--state-warning)] text-white"
                            : "border-[var(--state-warning)]/25 bg-white hover:bg-[var(--brand-accent-cloud)]"
                        }`}
                      >
                        Dieses Event fest verwenden
                      </button>
                    ) : null}
                  </div>

                  {selectedEvent ? (
                    <div className="rounded-xl border border-[var(--state-warning)]/35 bg-white px-3 py-3 text-sm">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="font-semibold">Ausgewaehltes Event fuer diesen Plan</div>
                          <div className="text-[var(--text-muted)]">{selectedEvent.title}</div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {providerLabel(selectedEvent.source)} | {plannerEventLabel(selectedEvent.category)}
                            {selectedEvent.venue_name ? ` | ${selectedEvent.venue_name}` : ""}
                            {selectedEvent.start_at ? ` | ${selectedEvent.start_at.slice(11, 16)} Uhr` : ""}
                          </div>
                          <div className="mt-1 text-xs text-[var(--state-warning)]">
                            {eventPlanningMode === "locked"
                              ? "Dieses Event wird fest als Highlight verwendet."
                              : "Dieses Event ist vorausgewaehlt und wird bevorzugt eingeplant."}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {eventCandidates.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => {
                                const nextIndex =
                                  selectedEventIndex >= 0
                                    ? (selectedEventIndex + 1) % eventCandidates.length
                                    : 0;
                                const nextEvent = eventCandidates[nextIndex];
                                if (!nextEvent) return;
                                setSelectedEventId(nextEvent.id);
                                setEventPlanningMode("locked");
                                resetPlan();
                                showToast("Naechstes Event wird getestet.");
                              }}
                              className="rounded-lg border border-[var(--state-warning)]/35 px-3 py-2 text-xs hover:bg-[var(--brand-accent-cloud)]"
                            >
                              Naechstes Event
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEventId(null);
                              setEventPlanningMode("auto");
                              resetPlan();
                            }}
                            className="rounded-lg border border-[var(--state-warning)]/35 px-3 py-2 text-xs hover:bg-[var(--brand-accent-cloud)]"
                          >
                            Auswahl loesen
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-[var(--state-warning)]">
                        {eventPlanningMode === "disabled"
                          ? "Events sind fuer diese Planung gerade deaktiviert."
                          : "Du kannst zwischen automatischer Eventwahl, festem Event und Planung ohne Event wechseln."}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[var(--state-warning)]/35 bg-white/70 px-3 py-3 text-xs text-[var(--text-muted)]">
                      {eventPlanningMode === "disabled"
                        ? "Events werden fuer diese Planung aktuell ignoriert. Du kannst jederzeit wieder auf automatisch oder ein festes Event wechseln."
                        : "Waehle hier ein konkretes Event aus, wenn genau dieses Event in deinen Plan uebernommen werden soll."}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {eventProviderSummary.map(([provider, count]) => (
                      <div
                        key={provider}
                        className="rounded-full border border-[var(--state-warning)]/25 bg-white px-2 py-1 text-[11px] text-[var(--text-muted)]"
                      >
                        {provider}: {count}
                      </div>
                    ))}
                    {eventCategorySummary.map(([category, count]) => (
                      <div
                        key={category}
                        className="rounded-full border border-[var(--state-warning)]/25 bg-white px-2 py-1 text-[11px] text-[var(--text-muted)]"
                      >
                        {category}: {count}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {eventCandidates.slice(0, 6).map((event) => {
                      const affiliateMatch = affiliateResolution.byPlannerEventId[event.id] ?? null;
                      const ticketTargetUrl = affiliateMatch?.targetUrl ?? event.ticket_url;
                      return (
                        <div
                          key={event.id}
                          className={`rounded-xl border bg-white px-3 py-2 text-xs ${
                            selectedEventId === event.id
                              ? "border-[var(--state-warning)]/45 ring-2 ring-[var(--state-warning)]/20"
                              : "border-[var(--state-warning)]/25"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="font-semibold">{event.title}</div>
                            <div className="rounded-full border border-[var(--state-warning)]/25 px-2 py-0.5 text-[10px] text-[var(--state-warning)]">
                              {selectedEventId === event.id ? "im Plan" : "Event"}
                            </div>
                          </div>
                          <div className="text-[var(--text-muted)]">
                            {providerLabel(event.source)} | {plannerEventLabel(event.category)}
                          </div>
                          <div className="text-[var(--text-muted)]">
                            {event.venue_name ? event.venue_name : "ohne Venue"}
                          </div>
                          <div className="text-[var(--text-muted)]">
                            {event.start_at ? event.start_at.slice(11, 16) : "ganztägig"}
                            {event.doors_at ? ` | Doors ${event.doors_at.slice(11, 16)}` : ""}
                          </div>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedEventId(event.id);
                                setEventPlanningMode("locked");
                                resetPlan();
                                showToast("Event wird jetzt gezielt in die Planung uebernommen.");
                              }}
                              className={`rounded-lg px-3 py-2 text-xs ${
                                selectedEventId === event.id
                                  ? "bg-[var(--state-warning)] text-white"
                                  : "border border-[var(--state-warning)]/25 hover:bg-[var(--brand-accent-cloud)]"
                              }`}
                            >
                              {selectedEventId === event.id ? "Ausgewaehlt" : "In Planung uebernehmen"}
                            </button>
                            {ticketTargetUrl ? (
                              <MonetizedExternalLink
                                href={ticketTargetUrl}
                                target="_blank"
                                rel="noreferrer"
                                userId={userId}
                                plannerEventId={event.id}
                                partnerProfileId={affiliateMatch?.partnerProfileId ?? null}
                                affiliateLinkId={affiliateMatch?.id ?? null}
                                citySlug={effectiveCitySlug}
                                surface="planner_event_picker"
                                label={event.title}
                                source={affiliateMatch ? "ticket_picker_affiliate_cta" : "ticket_picker_cta"}
                                className="rounded-lg border border-[var(--state-warning)]/25 px-3 py-2 text-xs hover:bg-[var(--brand-accent-cloud)]"
                              >
                                {affiliateMatch ? `${affiliateMatch.providerName} Tickets` : "Tickets"}
                              </MonetizedExternalLink>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <details className="rounded-xl border border-[var(--state-warning)]/25 bg-white/80 p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-[var(--state-warning)]">
                      Event-Debug öffnen
                    </summary>
                    <div className="mt-3 space-y-2">
                      {eventDebugRows.map((event) => {
                        const flags = eventDedupeFlags(event);
                        const duplicateCount = eventDebugGroupCounts.get(eventDebugSignature(event)) ?? 1;
                        const mergedCount = Math.max(0, duplicateCount - 1);
                        return (
                          <div
                            key={`debug-${event.id}`}
                            className={`rounded-lg border p-3 text-xs ${
                              flags.isShadow
                                ? "border-[var(--line-subtle)] bg-[var(--bg-panel)] text-[var(--text-muted)]"
                                : "border-[var(--state-warning)]/20"
                            }`}
                          >
                            <div className="font-semibold">{event.title}</div>
                            <div className="text-[var(--text-muted)]">
                              Provider: {providerLabel(event.source)} | Kategorie: {plannerEventLabel(event.category)} | Kind: {event.kind}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {flags.isPrimary ? (
                                <span className="rounded-full border border-[var(--state-success)]/25 bg-[var(--brand-accent-cloud)] px-2 py-0.5 text-[10px] font-medium text-[var(--state-success)]">
                                  Primärquelle
                                </span>
                              ) : null}
                              {flags.isPrimary && mergedCount > 0 ? (
                                <span className="rounded-full border border-[var(--brand-accent)]/25 bg-[var(--brand-accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--brand-accent)]">
                                  aus anderer Quelle zusammengeführt ({mergedCount})
                                </span>
                              ) : null}
                              {flags.isShadow ? (
                                <span className="rounded-full border border-[var(--line-subtle)] bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                                  Duplikat ausgeblendet
                                </span>
                              ) : null}
                            </div>
                            <div className="text-[var(--text-muted)]">
                              Stadt: {event.city_slug ?? "-"} | Venue: {event.venue_name ?? "-"}
                            </div>
                            <div className="text-[var(--text-muted)]">
                              Start: {event.start_at ?? "-"}
                              {event.end_at ? ` | Ende: ${event.end_at}` : ""}
                              {event.doors_at ? ` | Doors: ${event.doors_at}` : ""}
                            </div>
                            <div className="text-[var(--text-muted)]">
                              Ticket: {event.is_ticketed ? "ja" : "nein"}
                              {event.ticket_url ? " | Ticket-Link vorhanden" : ""}
                              {event.family_friendly != null ? ` | Family: ${event.family_friendly ? "ja" : "nein"}` : ""}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </>
              ) : (
                <div className="text-xs text-[var(--text-muted)]">
                  Fuer diesen Fokus wurden aktuell noch keine passenden Events geladen. Die klassische Planung laeuft trotzdem normal weiter.
                </div>
              )}
            </div>
          ) : null}

          {timingWarnings.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm font-semibold text-rose-900">Timing-Warnungen</div>
                <div className="rounded-full border border-rose-200 bg-white px-2 py-1 text-xs text-rose-800">
                  {timingWarnings.length} Hinweise
                </div>
              </div>
              <div className="space-y-1">
                {timingWarnings.slice(0, 4).map((entry, index) => (
                  <div key={`${entry.stopLabel}-${index}`} className="text-xs text-rose-800">
                    <span className="font-semibold">{entry.stopLabel}:</span> {entry.warning}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-3 rounded-lg border p-4">
            <div className="text-xs text-[var(--text-muted)]">
              Erlebnis-Fokus: <span className="font-semibold">{experienceModeLabel(experienceMode, occasion)}</span> | Event-Modus:{" "}
              <span className="font-semibold">
                {eventStrictnessForExperienceMode(experienceMode) === "required"
                  ? "fest eingeplant"
                  : eventStrictnessForExperienceMode(experienceMode) === "hybrid"
                    ? "optional bevorzugt"
                    : "aus"}
              </span> | Datum: <span className="font-semibold">{planDate || "-"}</span>
              <div>{experienceModeHint(experienceMode, occasion)}</div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">Gruppe</div>
                <div className="text-xs text-[var(--text-muted)]">
                  Optional: Füge Gäste hinzu. Gemeinsame Interessen wirken stärker.
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/invite"
                  className="rounded border px-3 py-2 text-sm hover:bg-[var(--bg-panel)]"
                >
                  Profilsuche öffnen
                </Link>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={groupEnabled}
                    onChange={(e) => setGroupEnabled(e.target.checked)}
                  />
                  Gruppenmodus
                </label>
              </div>
            </div>

            {groupEnabled ? (
              <>
                {activeGroupLabel ? (
                  <div className="rounded-xl border bg-[var(--bg-panel)] p-3">
                    <div className="text-sm font-medium">Aktive Gruppe: {activeGroupLabel}</div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      Diese gespeicherte Gruppe wurde in den Planner übernommen.
                    </div>
                  </div>
                ) : null}

                <div className="rounded-xl border bg-[var(--bg-panel)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">Freunde schnell hinzufügen</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        Übernimm gespeicherte Freunde direkt mit ihren Interessen in die Gruppe.
                      </div>
                    </div>
                    <Link href="/profile" className="text-xs underline underline-offset-4">
                      Freunde verwalten
                    </Link>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {friendsLoading ? (
                      <div className="text-xs text-[var(--text-muted)]">Freunde werden geladen...</div>
                    ) : friendSuggestions.length > 0 ? (
                      friendSuggestions.map((friend) => {
                        const alreadyAdded = groupMembers.some(
                          (member) => (member.profileUserId || member.id) === friend.user_id
                        );
                        return (
                          <button
                            key={friend.user_id}
                            type="button"
                            onClick={() => addFriendSuggestionToGroup(friend)}
                            disabled={alreadyAdded}
                            className="rounded-full border bg-white px-3 py-2 text-sm hover:bg-[var(--bg-panel)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {friend.display_name || (friend.username ? `@${friend.username}` : "Freund")}
                            {alreadyAdded ? " · hinzugefügt" : ""}
                          </button>
                        );
                      })
                    ) : (
                      <div className="text-xs text-[var(--text-muted)]">
                        Noch keine Freunde mit gespeicherten Interessen vorhanden.
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-2">
                  <input
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    placeholder="Name (optional)"
                    className="rounded border p-2"
                  />
                  <input
                    value={memberProfileQuery}
                    onChange={(e) => {
                      setMemberProfileQuery(e.target.value);
                      setMemberProfileError(null);
                    }}
                    placeholder="Profil-ID oder @Username"
                    className="rounded border p-2"
                  />
                  <input
                    value={memberInterestInput}
                    onChange={(e) => setMemberInterestInput(e.target.value)}
                    placeholder="Interessen (z.B. sushi, techno)"
                    className="rounded border p-2"
                  />
                </div>

                {memberProfileQuery.trim().length >= 2 ? (
                  <div className="rounded-lg border bg-white">
                    {memberProfileSearchLoading ? (
                      <div className="px-3 py-2 text-xs text-[var(--text-muted)]">Suche Profile...</div>
                    ) : memberProfileSuggestions.length > 0 ? (
                      memberProfileSuggestions.map((suggestion) => (
                        <button
                          key={`${suggestion.user_id}-${suggestion.username ?? "no-username"}`}
                          type="button"
                          onClick={() => selectMemberProfileSuggestion(suggestion)}
                          className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left hover:bg-[var(--bg-panel)] last:border-b-0"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium">
                              {suggestion.display_name || suggestion.username || suggestion.user_id}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">
                              {suggestion.username ? `@${suggestion.username}` : suggestion.user_id}
                            </div>
                          </div>
                          {suggestion.avatar_url ? (
                            <img
                              src={suggestion.avatar_url}
                              alt={suggestion.display_name || suggestion.username || "Profil"}
                              className="h-9 w-9 rounded-full border object-cover"
                            />
                          ) : null}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-[var(--text-muted)]">
                        Keine Profile gefunden.
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={addGroupMemberFromProfile}
                    disabled={memberProfileLoading || memberProfileQuery.trim().length === 0}
                    className="rounded border px-4 py-2 text-sm disabled:opacity-50"
                  >
                    {memberProfileLoading ? "Profil wird geladen..." : "+ Profil hinzufügen"}
                  </button>

                  <button
                    onClick={addManualGroupMember}
                    className="rounded bg-[var(--text-strong)] px-4 py-2 text-sm text-white"
                  >
                    + Teilnehmer hinzufügen
                  </button>

                  {groupMembers.length > 0 ? (
                    <button onClick={clearGroup} className="rounded border px-4 py-2 text-sm">
                      Gruppe leeren
                    </button>
                  ) : null}
                </div>

                {memberProfileError ? (
                  <div className="text-xs text-red-600">{memberProfileError}</div>
                ) : null}

                {groupMembers.length > 0 ? (
                  <div className="space-y-2">
                    {groupMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-start justify-between gap-3 rounded border p-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">{member.name}</div>
                          {member.profileHandle || member.profileUserId ? (
                            <div className="text-[11px] text-[var(--text-muted)]">
                              {member.profileHandle ? `Profil: @${member.profileHandle}` : `Profil-ID: ${member.profileUserId}`}
                            </div>
                          ) : null}
                          <div className="break-words text-xs text-[var(--text-muted)]">
                            {member.interests.join(", ")}
                          </div>
                        </div>
                        <button onClick={() => removeGroupMember(member.id)} className="rounded border px-3 py-2 text-sm">
                          Entfernen
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-[var(--text-muted)]">Noch keine Teilnehmer.</div>
                )}

                <div className="text-xs text-[var(--text-muted)]">
                  Effektive Interessen: {effectiveInterests.length ? effectiveInterests.join(", ") : "-"}
                </div>
              </>
            ) : (
              <div className="text-xs text-[var(--text-muted)]">Gruppenmodus ist aus.</div>
            )}
          </div>
        </div>

        {monetizationDebug ? (
          <div className="mb-6 space-y-4">
            <div className="grid gap-3">
              <InternalMonetizationSlot
                enabled={monetizationDebug}
                slotKey="planner_featured_event_module"
                title="Planner: Featured Event Modul"
                description="Interner Planner-Pilot fuer Featured Events direkt im kaufnahen Entscheidungsraum. Hier pruefen wir, ob ein klar markiertes Partner-Event sauber neben organischer Planung bestehen kann."
                productKeys={["featured_event", "sponsored_placement"]}
                previewItems={["Ticket-Highlight", "Event-Partner", "Tonight Pick"]}
                citySlug={effectiveCitySlug}
                livePreview
                ctaSource="internal_planner_featured_event_pilot"
              />
              <InternalMonetizationSlot
                enabled={monetizationDebug}
                slotKey="planner_featured_location_module"
                title="Planner: Featured Location Modul"
                description="Interner Planner-Pilot fuer Featured Locations im direkten Planungsfluss. So koennen wir testen, ob ein Partner-Spot mit Reservierungsziel klar markiert und trotzdem produktvertraeglich wirkt."
                productKeys={["featured_location", "partner_basic", "partner_pro"]}
                previewItems={["Dinner-Partner", "Date-Spot", "Reservierungsziel"]}
                citySlug={effectiveCitySlug}
                livePreview
                ctaSource="internal_planner_featured_location_pilot"
              />
            </div>
            <MonetizationDebugPanel
              enabled={monetizationDebug}
              surface="planner"
              citySlug={effectiveCitySlug}
              title="Planner Monetization Debug"
            />
          </div>
        ) : null}
      </section>
    </>
  );
}
