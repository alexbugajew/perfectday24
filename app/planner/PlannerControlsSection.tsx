"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { CitySearchInput } from "@/components/ui/CitySearchInput";
import InternalMonetizationSlot from "@/components/monetization/InternalMonetizationSlot";
import MonetizationDebugPanel from "@/components/monetization/MonetizationDebugPanel";
import MonetizedExternalLink from "@/components/monetization/MonetizedExternalLink";
import type { PublicAffiliateResolution } from "@/lib/monetization/affiliate-shared";
import {
  FAMILY_AGE_BAND_OPTIONS,
  getInterestCatalog,
  norm,
  type EvaluationMode,
  type EventPlanningMode,
  type ExperienceMode,
  type FamilyAgeBand,
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
  familyAgeBandHint,
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
  showQuickEventPicker: boolean;
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
  setOccasion: (value: string) => void;
  familyAgeBand: FamilyAgeBand;
  setFamilyAgeBand: Dispatch<SetStateAction<FamilyAgeBand>>;
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
  showQuickEventPicker,
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
  familyAgeBand,
  setFamilyAgeBand,
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

  // Vorlieben-Modal: Escape schließt (sofern erlaubt), Tab bleibt im Dialog,
  // Fokus wird beim Öffnen gesetzt und beim Schließen zurückgegeben.
  const prefsDialogRef = useRef<HTMLDivElement>(null);
  const prefsRestoreFocusRef = useRef<HTMLElement | null>(null);
  const prefsCanClose = !profileRequired || interests.length > 0;

  useEffect(() => {
    if (showPrefsModal) {
      prefsRestoreFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setTimeout(() => prefsDialogRef.current?.focus(), 60);
    } else {
      prefsRestoreFocusRef.current?.focus();
      prefsRestoreFocusRef.current = null;
    }
  }, [showPrefsModal]);

  useEffect(() => {
    if (!showPrefsModal) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (prefsCanClose) setShowPrefsModal(false);
        return;
      }
      if (event.key !== "Tab") return;
      const container = prefsDialogRef.current;
      if (!container) return;
      const focusables = container.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !container.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showPrefsModal, prefsCanClose, setShowPrefsModal]);

  return (
    <>
      {showPrefsModal ? (
        /* Overlay — z-index über der Bottom Nav (z-[1300]) */
        <div
          className="fixed inset-0 z-[1500] flex items-end bg-black/40 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="prefs-modal-title"
        >
          {/* Bottom Sheet auf Mobile, zentrierter Modal auf Desktop */}
          <div
            ref={prefsDialogRef}
            tabIndex={-1}
            className="flex w-full flex-col rounded-t-2xl bg-white shadow-xl outline-none sm:mx-auto sm:max-w-xl sm:rounded-2xl"
          >

            {/* Drag Handle (Mobile) */}
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-[var(--bg-panel)]" />
            </div>

            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-4">
              <div>
                <div id="prefs-modal-title" className="text-lg font-semibold text-[var(--text-strong)]">Deine Vorlieben</div>
                <div className="mt-0.5 text-sm text-[var(--text-muted)]">
                  Wähle bis zu 12 Interessen. Werden beim Planen automatisch verwendet.
                </div>
              </div>
              <button
                onClick={() => {
                  if (!profileRequired || interests.length > 0) {
                    setShowPrefsModal(false);
                  }
                }}
                disabled={profileRequired && interests.length === 0}
                className="shrink-0 rounded-full border border-[var(--line-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-surface)] disabled:opacity-50"
              >
                Schliessen
              </button>
            </div>

            {profileRequired && interests.length === 0 ? (
              <div className="mx-5 rounded-lg border border-[var(--state-warning)]/25 bg-[var(--brand-accent-cloud)] px-3 py-2 text-sm text-[var(--state-warning)]">
                Bitte wähle zuerst deine Interessen aus.
              </div>
            ) : null}

            {/* Scrollbarer Katalog — Höhe begrenzt, lässt Platz für Footer */}
            <div className="my-3 max-h-[45vh] space-y-4 overflow-y-auto px-5 pr-4 sm:max-h-[50vh]">
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
                          aria-pressed={selected}
                          className={`rounded-full border px-3 py-1.5 text-sm transition ${
                            selected
                              ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                              : "border-[var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-strong)] hover:border-[var(--line-strong)]"
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer — immer sichtbar, nicht scrollbar */}
            <div className="border-t border-[var(--line-subtle)] px-5 pb-6 pt-4 sm:pb-5">
              <div className="flex gap-2">
                <input
                  value={interestInput}
                  onChange={(e) => setInterestInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInterestFromInput(); } }}
                  placeholder="Eigene Vorliebe (z.B. Tapas)"
                  className="flex-1 rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)] outline-none transition focus:border-[var(--line-strong)]"
                />
                <button
                  onClick={addInterestFromInput}
                  className="rounded-xl border border-[var(--line-subtle)] px-3 py-2 text-sm text-[var(--text-muted)] transition hover:bg-[var(--bg-surface)]"
                >
                  + hinzufügen
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-xs text-[var(--text-muted)]">
                  {interests.length} / 12 gewählt{profileSaving ? " · speichere…" : ""}
                </div>
                <button
                  onClick={() => {
                    if (!profileRequired || interests.length > 0) {
                      setShowPrefsModal(false);
                    }
                  }}
                  disabled={profileRequired && interests.length === 0}
                  className="pd24-btn pd24-btn-primary"
                >
                  Fertig
                </button>
              </div>
            </div>

          </div>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-[var(--line-subtle)] bg-white p-3 shadow-[var(--shadow-soft)]">
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-[rgba(68,57,46,0.08)] pb-2">
          <h2 className="text-sm font-semibold tracking-tight text-[var(--text-strong)]">Filter</h2>
          <span className="warm-chip rounded-md px-2 py-0.5 text-[11px]">{cityLabel}</span>
        </div>

        <div className="space-y-3">
          <div className="grid gap-2">
            <label className="rounded-md border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2">
              <div className="pd24-meta">
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
                className="mt-1 min-h-9 w-full bg-transparent text-sm font-medium text-[var(--text-strong)] outline-none"
                disabled={citiesLoading}
              >
                <option value="all">Alle Länder</option>
                {availableCountryCodes.map((countryCode) => (
                  <option key={countryCode} value={countryCode}>
                    {countryLabel(countryCode)}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <div className="mb-1 pd24-meta">
                Stadt
              </div>
              <CitySearchInput
                cities={visibleCities}
                value={selectedCitySlug ?? ""}
                onChange={(slug) => {
                  setSelectedCitySlug(slug || null);
                  resetStartPointForSelectedCity();
                  resetPlan();
                }}
                placeholder={citiesLoading ? "Städte werden geladen..." : "Stadt suchen..."}
              />
            </div>

            <div className="rounded-md border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2">
              <div className="pd24-meta">
                Anlass
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[
                  { value: "date", label: "Date" },
                  { value: "friends", label: "Freunde" },
                  { value: "family", label: "Familie" },
                  { value: "party", label: "Party" },
                  { value: "tourism", label: "Tourismus" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setOccasion(opt.value)}
                    className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-xs font-medium transition ${
                      occasion === opt.value
                        ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                        : "border-[var(--line-subtle)] bg-white text-[var(--text-strong)] hover:bg-[var(--bg-panel)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {occasion === "family" ? (
              <div className="rounded-md border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2">
                <div className="pd24-meta">
                  Kinder-Alter
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {FAMILY_AGE_BAND_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFamilyAgeBand(option.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        familyAgeBand === option.value
                          ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                          : "border-[var(--line-subtle)] bg-white text-[var(--text-strong)] hover:bg-[var(--bg-panel)]"
                      }`}
                    >
                      {option.shortLabel}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setShowPlannerConfig((current) => !current)}
              className="rounded-md border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-left transition hover:border-[var(--line-strong)] hover:bg-white"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="pd24-meta">
                    Weitere Optionen
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
                  <div className="pd24-meta">
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
                  <div className="pd24-meta">Budget</div>
                  <select value={budget} onChange={(e) => setBudget(e.target.value)} className="mt-2 w-full bg-transparent text-base font-medium text-[var(--text-strong)] outline-none">
                    <option value="low">Günstig</option>
                    <option value="medium">Mittel</option>
                    <option value="high">Premium</option>
                    <option value="free">Kostenlos</option>
                  </select>
                </label>

                <div className="rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3">
                  <div className="pd24-meta">Fokus</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {experienceOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setExperienceMode(option.value)}
                        aria-pressed={experienceMode === option.value}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          experienceMode === option.value
                            ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                            : "border-[var(--line-subtle)] bg-white text-[var(--text-strong)] hover:bg-[var(--bg-panel)]"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {!eventModesAvailable ? (
                    <div className="mt-2 text-xs text-[var(--text-muted)]">
                      Event- und Markt-Foki sind für diese Stadt noch nicht voll aktiviert.
                    </div>
                  ) : null}
                </div>

                {occasion === "family" ? (
                  <div className="rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3">
                    <div className="pd24-meta">
                      Familien-Variante
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {FAMILY_AGE_BAND_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setFamilyAgeBand(option.value)}
                          aria-pressed={familyAgeBand === option.value}
                          className={`rounded-2xl border px-4 py-3 text-left transition ${
                            familyAgeBand === option.value
                              ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                              : "border-[var(--line-subtle)] bg-white text-[var(--text-strong)] hover:bg-[var(--bg-panel)]"
                          }`}
                        >
                          <div className="text-sm font-semibold">{option.label}</div>
                          <div className={`mt-1 text-xs leading-5 ${familyAgeBand === option.value ? "text-white/80" : "text-[var(--text-muted)]"}`}>
                            {option.description}
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
                      {familyAgeBandHint(familyAgeBand)}
                    </div>
                  </div>
                ) : null}

                <label className="hidden">
                  <div className="pd24-meta">Datum</div>
                  <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} className="mt-2 w-full bg-transparent text-base font-medium text-[var(--text-strong)] outline-none" />
                </label>

                <label className="rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3">
                  <div className="pd24-meta">Tagesfenster</div>
                  <select value={planMode} onChange={(e) => setPlanMode(e.target.value as PlanMode)} className="mt-2 w-full bg-transparent text-base font-medium text-[var(--text-strong)] outline-none">
                    <option value="morning">Vormittag</option>
                    <option value="midday">Mittag</option>
                    <option value="evening">Abend</option>
                    <option value="fullday">Ganzer Tag</option>
                  </select>
                </label>

                <div className="rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3">
                  <div className="pd24-meta">Stops</div>
                  {planMode === "fullday" ? (
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm text-[var(--text-muted)]">Frühstück bis Mittag</div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setFullDayActsAfterBreakfast((value) => clamp(value - 1, 1, 2))}
                            aria-label="Weniger Aktivitäten zwischen Frühstück und Mittag"
                            className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)] transition hover:bg-white"
                          >
                            -
                          </button>
                          <div
                            aria-live="polite"
                            aria-label={`Aktivitäten zwischen Frühstück und Mittag: ${fullDayActsAfterBreakfast}`}
                            className="min-w-[28px] text-center font-semibold text-[var(--text-strong)]"
                          >
                            {fullDayActsAfterBreakfast}
                          </div>
                          <button
                            onClick={() => setFullDayActsAfterBreakfast((value) => clamp(value + 1, 1, 2))}
                            aria-label="Mehr Aktivitäten zwischen Frühstück und Mittag"
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
                            aria-label="Weniger Aktivitäten zwischen Mittag und Abend"
                            className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)] transition hover:bg-white"
                          >
                            -
                          </button>
                          <div
                            aria-live="polite"
                            aria-label={`Aktivitäten zwischen Mittag und Abend: ${fullDayActsAfterLunch}`}
                            className="min-w-[28px] text-center font-semibold text-[var(--text-strong)]"
                          >
                            {fullDayActsAfterLunch}
                          </div>
                          <button
                            onClick={() => setFullDayActsAfterLunch((value) => clamp(value + 1, 1, 2))}
                            aria-label="Mehr Aktivitäten zwischen Mittag und Abend"
                            className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)] transition hover:bg-white"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-[var(--text-muted)]">
                        {fullDayActsAfterBreakfast + fullDayActsAfterLunch} Aktivitäts-Blöcke über den Tag verteilt
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
                  <div className="pd24-meta">Sortierung</div>
                  <select value={sortMode} onChange={(e) => setSortMode(e.target.value as "match" | "distance")} className="mt-2 w-full bg-transparent text-base font-medium text-[var(--text-strong)] outline-none">
                    <option value="match">Best Match</option>
                    <option value="distance">Distanz</option>
                  </select>
                </label>

                <div className="rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3">
                  <div className="pd24-meta">Mobilität</div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Mobilität">
                    {[
                      { value: "foot", label: "Fuß", icon: "🚶" },
                      { value: "car", label: "Auto", icon: "🚗" },
                      { value: "public_transit", label: "ÖPNV", icon: "🚊" },
                    ].map((opt) => {
                      const active = routeProfile === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setRouteProfile(opt.value as RouteProfile)}
                          className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 text-xs font-medium transition ${
                            active
                              ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                              : "border-[var(--line-subtle)] bg-white text-[var(--text-muted)] hover:border-[rgba(23,23,23,0.28)] hover:text-[var(--text-strong)]"
                          }`}
                        >
                          <span className="text-base leading-none" aria-hidden>{opt.icon}</span>
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
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

          <div className="hidden">
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
                aria-label="Startpunkttyp auswählen"
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
                  aria-label="Startpunkt suchen"
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
                      <div className="px-3 py-2 text-sm text-[var(--state-error)]">{startPointSearchError}</div>
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
                Du planst gerade für <span className="font-semibold">{selectedCity.name}</span>. Deshalb nutzen wir vorläufig{" "}
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

          <div className="flex items-center gap-4 flex-wrap rounded-[var(--radius-card-sm)] border border-[rgba(68,57,46,0.08)] bg-white/70 px-4 py-3">
            <label htmlFor="planner-radius-km" className="font-medium text-[var(--text-strong)]">Umkreis: {radiusKm} km</label>
            <input
              id="planner-radius-km"
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

          {!showQuickEventPicker && experienceMode !== "classic" ? (
            <div className="space-y-2 rounded-lg border border-[var(--state-warning)]/25 bg-[var(--brand-accent-cloud)] p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold">Lokale Event-Kandidaten</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    Geladen für {planDate || "den gewählten Tag"} in <span className="font-semibold">{cityLabel}</span>.
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
                          <div className="font-semibold">Ausgewähltes Event für diesen Plan</div>
                          <div className="text-[var(--text-muted)]">{selectedEvent.title}</div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {providerLabel(selectedEvent.source)} | {plannerEventLabel(selectedEvent.category)}
                            {selectedEvent.venue_name ? ` | ${selectedEvent.venue_name}` : ""}
                            {selectedEvent.start_at ? ` | ${selectedEvent.start_at.slice(11, 16)} Uhr` : ""}
                          </div>
                          <div className="mt-1 text-xs text-[var(--state-warning)]">
                            {eventPlanningMode === "locked"
                              ? "Dieses Event wird fest als Highlight verwendet."
                              : "Dieses Event ist vorausgewählt und wird bevorzugt eingeplant."}
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
                                showToast("Nächstes Event wird getestet.");
                              }}
                              className="rounded-lg border border-[var(--state-warning)]/35 px-3 py-2 text-xs hover:bg-[var(--brand-accent-cloud)]"
                            >
                              Nächstes Event
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
                            Auswahl lösen
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-[var(--state-warning)]">
                        {eventPlanningMode === "disabled"
                          ? "Events sind für diese Planung gerade deaktiviert."
                          : "Du kannst zwischen automatischer Eventwahl, festem Event und Planung ohne Event wechseln."}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[var(--state-warning)]/35 bg-white/70 px-3 py-3 text-xs text-[var(--text-muted)]">
                      {eventPlanningMode === "disabled"
                        ? "Events werden für diese Planung aktuell ignoriert. Du kannst jederzeit wieder auf automatisch oder ein festes Event wechseln."
                        : "Wähle hier ein konkretes Event aus, wenn genau dieses Event in deinen Plan übernommen werden soll."}
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
                                showToast("Event wird jetzt gezielt in die Planung übernommen.");
                              }}
                              className={`rounded-lg px-3 py-2 text-xs ${
                                selectedEventId === event.id
                                  ? "bg-[var(--state-warning)] text-white"
                                  : "border border-[var(--state-warning)]/25 hover:bg-[var(--brand-accent-cloud)]"
                              }`}
                            >
                              {selectedEventId === event.id ? "Ausgewählt" : "In Planung übernehmen"}
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
                  Für diesen Fokus wurden aktuell noch keine passenden Events geladen. Die klassische Planung läuft trotzdem normal weiter.
                </div>
              )}
            </div>
          ) : null}

          {timingWarnings.length > 0 ? (
            <div className="pd24-status-error space-y-2 rounded-lg p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm font-semibold">Timing-Warnungen</div>
                <div className="rounded-full border border-[var(--state-error)]/25 bg-white px-2 py-1 text-xs">
                  {timingWarnings.length} Hinweise
                </div>
              </div>
              <div className="space-y-1">
                {timingWarnings.slice(0, 4).map((entry, index) => (
                  <div key={`${entry.stopLabel}-${index}`} className="text-xs">
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

            {!groupEnabled ? (
              /* ── Kompakte Zeile wenn solo ── */
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-[var(--text-muted)]">
                  Mehrere Personen? Gemeinsame Interessen verbessern den Plan.
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:border-[var(--line-strong)] hover:text-[var(--text-strong)]">
                  <input
                    type="checkbox"
                    checked={groupEnabled}
                    onChange={(e) => setGroupEnabled(e.target.checked)}
                    className="sr-only"
                  />
                  + Gruppe
                </label>
              </div>
            ) : (
              /* ── Volle Gruppen-UI wenn aktiv ── */
              <>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">Gruppe</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      Gemeinsame Interessen wirken stärker im Plan.
                    </div>
                  </div>
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:border-[var(--line-strong)] hover:text-[var(--text-strong)]">
                    <input
                      type="checkbox"
                      checked={groupEnabled}
                      onChange={(e) => setGroupEnabled(e.target.checked)}
                      className="sr-only"
                    />
                    ✕ Entfernen
                  </label>
                </div>
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
                    className="pd24-btn pd24-btn-sm pd24-btn-secondary"
                  >
                    {memberProfileLoading ? "Profil wird geladen..." : "+ Profil hinzufügen"}
                  </button>

                  <button
                    onClick={addManualGroupMember}
                    className="pd24-btn pd24-btn-sm pd24-btn-primary"
                  >
                    + Teilnehmer hinzufügen
                  </button>

                  {groupMembers.length > 0 ? (
                    <button onClick={clearGroup} className="pd24-btn pd24-btn-sm pd24-btn-secondary">
                      Gruppe leeren
                    </button>
                  ) : null}
                </div>

                {memberProfileError ? (
                  <div className="text-xs text-[var(--state-error)]">{memberProfileError}</div>
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
                description="Interner Planner-Pilot für Featured Events direkt im kaufnahen Entscheidungsraum. Hier prüfen wir, ob ein klar markiertes Partner-Event sauber neben organischer Planung bestehen kann."
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
                description="Interner Planner-Pilot für Featured Locations im direkten Planungsfluss. So können wir testen, ob ein Partner-Spot mit Reservierungsziel klar markiert und trotzdem produktverträglich wirkt."
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
