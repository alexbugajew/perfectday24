"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AiPlanModal from "./AiPlanModal";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { canonicalCitySlug, dedupeCitiesByCanonicalSlug } from "@/lib/cities/canonical";
import {
  isPlannerSupportedCitySlug,
  plannerCitySupportsEventModes,
} from "@/lib/cities/planner-support";
import {
  consumePlannerRouteTemplate,
  writeRouteBuilderDraft,
} from "@/lib/routes/planner-route-bridge";
import { writePlannerRunDraft } from "@/lib/routes/planner-run-bridge";
import { downloadPlanIcs, openPlanPrintWindow } from "@/lib/planner/plan-export";
import { usePremiumStatus } from "@/components/premium/usePremiumStatus";
import UpgradeModal from "@/components/premium/UpgradeModal";
import { trackMonetizationEvent } from "@/lib/monetization/client";
import { resolvePublicAffiliateLinksClient } from "@/lib/monetization/public-affiliate-client";
import { shouldShowInternalMonetization } from "@/lib/monetization/debug";
import {
  emptyPublicAffiliateResolution,
  type PublicAffiliateResolution,
} from "@/lib/monetization/affiliate-shared";

import type { RouteSummary } from "@/components/PlanMap";
import { CitySearchInput } from "@/components/ui/CitySearchInput";
import PlannerActionPanel from "./PlannerActionPanel";
import PlannerActivationPanel from "./PlannerActivationPanel";
import PlannerControlsSection from "./PlannerControlsSection";
import PlannerEventCandidatesStrip from "./PlannerEventCandidatesStrip";
import PlannerMapPanel from "./PlannerMapPanel";
import PlannerOutputSection from "./PlannerOutputSection";
import PlannerVariantPanel from "./PlannerVariantPanel";
import {
  budgetLabel,
  buildGroupPlanningSignals,
  clamp,
  compactPartyLabel,
  countryLabel,
  defaultPlanModeForOccasion,
  eventStrictnessForExperienceMode,
  experienceModeLabel,
  experienceOptionsForOccasion,
  inferRouteThemeFromInterests,
  occasionLabel,
  plannerDateLabel,
  routeProfileLabel,
  cityStartFallbackLabel,
  startPointSuggestionSourceLabel,
  startPointSuggestionTypeLabel,
  todayDateInputValue,
} from "./helpers";
import { usePlannerGeneration } from "./usePlannerGeneration";
import {
  postPlannerGroupChatSystemMessage,
  usePlannerPersistence,
} from "./usePlannerPersistence";
import { usePlannerPeople } from "./usePlannerPeople";
import { usePlannerStartPoint } from "./usePlannerStartPoint";
import type {
  CityRow,
  PlannerApiResponse,
  PlannerSaveMode,
  SavedPlanRow,
} from "./types";
import type {
  EvaluationMode,
  EventPlanningMode,
  ExperienceMode,
  FamilyAgeBand,
  GroupMember,
  PlanMode,
  PlannerRequest,
  RouteProfile,
} from "@/lib/planner";
import type { MatchLevel, ScoredLocation } from "@/lib/planner/types";
import {
  DEFAULT_FAMILY_AGE_BAND,
  familyAgeBandShortLabel,
  resolveFamilyAgeBand,
  mergeInterests,
} from "@/lib/planner";

function PlannerPageContent() {
  const searchParams = useSearchParams();
  const homepagePresetSignatureRef = useRef<string | null>(null);
  const homepagePresetStartPointRef = useRef<string | null>(null);
  const monetizationDebug = useMemo(
    () => shouldShowInternalMonetization(searchParams.get("monetization")),
    [searchParams]
  );
  const requestedPlanId = searchParams.get("planId");
  const requestedResume = searchParams.get("resume") === "1";
  const [mounted, setMounted] = useState(false);
  // True once URL params (if any) have been applied — prevents auto-generating
  // with stale localStorage values before the homepage preset takes effect.
  const hasHomepageParams = [
    "citySlug", "city", "occasion", "familyAgeBand", "experienceMode", "mode", "budget", "planDate", "interests", "dayStartMin",
  ].some((key) => searchParams.has(key));
  const [presetsReady, setPresetsReady] = useState(!hasHomepageParams);
  const [variationSeed, setVariationSeed] = useState(0);

  const [cities, setCities] = useState<CityRow[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [citiesLoadError, setCitiesLoadError] = useState(false);
  const [citiesReloadKey, setCitiesReloadKey] = useState(0);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>("all");
  const [selectedCitySlug, setSelectedCitySlug] = useState<string | null>(null);

  // Startpunkt-Vorschläge nur zeigen, solange der Nutzer im Feld arbeitet
  const [startPointFieldActive, setStartPointFieldActive] = useState(false);
  const startPointFieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!startPointFieldActive) return;
    function onMouseDown(e: MouseEvent) {
      if (startPointFieldRef.current && !startPointFieldRef.current.contains(e.target as Node)) {
        setStartPointFieldActive(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [startPointFieldActive]);

  const [budget, setBudget] = useState("medium");
  const [occasion, setOccasion] = useState("date");
  const [familyAgeBand, setFamilyAgeBand] = useState<FamilyAgeBand>(DEFAULT_FAMILY_AGE_BAND);
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>("classic");
  const [planDate, setPlanDate] = useState(todayDateInputValue);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventPlanningMode, setEventPlanningMode] = useState<EventPlanningMode>("auto");
  // Initial passend zum Default-Anlass "date": Abend-Modus (18 Uhr, 3 Stops).
  // Vorher hart "fullday" — dadurch bekamen Dates einen Ganztagsplan ab vormittags.
  const [planMode, setPlanMode] = useState<PlanMode>(() => defaultPlanModeForOccasion("date"));
  const [dayStartMin, setDayStartMin] = useState<number | null>(null);
  const [stopsCount, setStopsCount] = useState(3);

  const [fullDayActsAfterBreakfast, setFullDayActsAfterBreakfast] = useState(1);
  const [fullDayActsAfterLunch, setFullDayActsAfterLunch] = useState(1);

  const [radiusKm, setRadiusKm] = useState(10);
  const [sortMode, setSortMode] = useState<"match" | "distance">("match");

  const [aiText, setAiText] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [activePlanGroupChatId, setActivePlanGroupChatId] = useState<string | null>(null);

  const [routeProfile, setRouteProfile] = useState<RouteProfile>("foot");
  const [evaluationMode, setEvaluationMode] = useState<EvaluationMode>("normal");
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);

  const [plannerTemplateLoadedLabel, setPlannerTemplateLoadedLabel] = useState<string | null>(null);
  const [plannerTemplateSourceSlug, setPlannerTemplateSourceSlug] = useState<string | null>(null);
  const [plannerTemplateInterests, setPlannerTemplateInterests] = useState<string[]>([]);
  const [showPlannerConfig, setShowPlannerConfig] = useState(false);
  const [showWeitere, setShowWeitere] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPlanPrompt, setAiPlanPrompt] = useState<string | null>(null);

  const [stopOffsets, setStopOffsets] = useState<number[]>([]);

  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { isPremium, usedThisMonth } = usePremiumStatus(userId);
  const [showExportUpgrade, setShowExportUpgrade] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [draggedStopPosition, setDraggedStopPosition] = useState<number | null>(null);
  const [affiliateResolution, setAffiliateResolution] = useState<PublicAffiliateResolution>(
    () => emptyPublicAffiliateResolution()
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }, []);

  const {
    interests,
    setInterests,
    interestInput,
    setInterestInput,
    profileSaving,
    profileRequired,
    showPrefsModal,
    setShowPrefsModal,
    groupEnabled,
    setGroupEnabled,
    groupMembers,
    setGroupMembers,
    activeGroupLabel,
    memberName,
    setMemberName,
    memberProfileQuery,
    setMemberProfileQuery,
    memberProfileLoading,
    memberProfileError,
    setMemberProfileError,
    memberProfileSuggestions,
    memberProfileSearchLoading,
    memberInterestInput,
    setMemberInterestInput,
    friendSuggestions,
    friendsLoading,
    addGroupMemberFromProfile,
    addFriendSuggestionToGroup,
    addInterestFromInput,
    toggleInterest,
    addManualGroupMember,
    clearGroup,
    removeGroupMember,
    selectMemberProfileSuggestion,
  } = usePlannerPeople({
    mounted,
    authReady,
    userId,
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    try {
      const v = localStorage.getItem("pd24_route_profile");
      if (v === "foot" || v === "car" || v === "public_transit") setRouteProfile(v as RouteProfile);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const v = localStorage.getItem("pd24_experience_mode");
      if (
        v === "classic" ||
        v === "show" ||
        v === "event_visit" ||
        v === "market_festival"
      ) {
        setExperienceMode(v);
      }
      const savedDate = localStorage.getItem("pd24_plan_date");
      if (savedDate) setPlanDate(savedDate);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("pd24_route_profile", routeProfile);
    } catch {}
  }, [routeProfile]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem("pd24_experience_mode", experienceMode);
      localStorage.setItem("pd24_plan_date", planDate);
    } catch {}
  }, [mounted, experienceMode, planDate]);

  useEffect(() => {
    if (!mounted) return;
    try {
      const country = localStorage.getItem("pd24_country_code");
      if (country) setSelectedCountryCode(country);
      const v = localStorage.getItem("pd24_city_slug");
      if (v) {
        if (v === "__auto__") setSelectedCitySlug(null);
        else setSelectedCitySlug(canonicalCitySlug(v));
      } else {
        setSelectedCitySlug(null);
      }
    } catch {}
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem("pd24_country_code", selectedCountryCode);
      localStorage.setItem(
        "pd24_city_slug",
        selectedCitySlug ? canonicalCitySlug(selectedCitySlug) ?? selectedCitySlug : "__auto__"
      );
    } catch {}
  }, [mounted, selectedCountryCode, selectedCitySlug]);

  useEffect(() => {
    if (!mounted) return;

    const requestedCitySlug = canonicalCitySlug(
      searchParams.get("citySlug") ?? searchParams.get("city")
    );
    const requestedOccasion = searchParams.get("occasion");
    const requestedFamilyAgeBand = resolveFamilyAgeBand(searchParams.get("familyAgeBand"));
    const requestedExperienceMode = searchParams.get("experienceMode") ?? searchParams.get("mode");
    const requestedBudget = searchParams.get("budget");
    const requestedPlanDate = searchParams.get("planDate");
    const requestedInterests = searchParams.get("interests");
    const requestedDayStartMin = searchParams.get("dayStartMin");

    const signature = [
      requestedCitySlug ?? "",
      requestedOccasion ?? "",
      requestedFamilyAgeBand ?? "",
      requestedExperienceMode ?? "",
      requestedBudget ?? "",
      requestedPlanDate ?? "",
      requestedInterests ?? "",
      requestedDayStartMin ?? "",
    ].join("|");

    if (!signature.replace(/\|/g, "")) return;
    if (homepagePresetSignatureRef.current === signature) return;
    homepagePresetSignatureRef.current = signature;

    if (requestedCitySlug) {
      setSelectedCitySlug(requestedCitySlug);
    }

    if (
      requestedOccasion === "date" ||
      requestedOccasion === "friends" ||
      requestedOccasion === "tourism" ||
      requestedOccasion === "family" ||
      requestedOccasion === "party"
    ) {
      setOccasion(requestedOccasion);
      // Apply the occasion's default time frame (evening for date/friends, midday for family, etc.)
      setPlanMode(defaultPlanModeForOccasion(requestedOccasion));
    }

    if (requestedFamilyAgeBand) {
      setFamilyAgeBand(requestedFamilyAgeBand);
    }

    if (
      requestedExperienceMode === "classic" ||
      requestedExperienceMode === "show" ||
      requestedExperienceMode === "event_visit" ||
      requestedExperienceMode === "market_festival"
    ) {
      setExperienceMode(requestedExperienceMode);
    }

    if (
      requestedBudget === "low" ||
      requestedBudget === "medium" ||
      requestedBudget === "high"
    ) {
      setBudget(requestedBudget);
    }

    if (
      requestedPlanDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(requestedPlanDate)
    ) {
      setPlanDate(requestedPlanDate);
    }

    if (requestedInterests) {
      const normalizedInterests = Array.from(
        new Set(
          requestedInterests
            .split(",")
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
        )
      );
      if (normalizedInterests.length > 0) {
        setInterests(normalizedInterests);
      }
    }

    if (requestedDayStartMin && /^\d{1,4}$/.test(requestedDayStartMin)) {
      const parsedDayStartMin = Number(requestedDayStartMin);
      setDayStartMin(
        Number.isFinite(parsedDayStartMin) && parsedDayStartMin >= 0 && parsedDayStartMin <= 1439
          ? parsedDayStartMin
          : null
      );
    } else {
      setDayStartMin(null);
    }

    setSelectedEventId(null);
    // Mark homepage params as applied so generation can start with correct values.
    setPresetsReady(true);
  }, [mounted, searchParams, setInterests]);

  useEffect(() => {
    const validOptions = new Set(
      experienceOptionsForOccasion(occasion).map((option) => option.value)
    );
    if (!validOptions.has(experienceMode)) {
      setExperienceMode("classic");
    }
  }, [occasion, experienceMode]);

  useEffect(() => {
    if (planMode === "fullday") return;
    setStopsCount((prev) => clamp(prev, 1, 3));
  }, [planMode]);

  useEffect(() => {
    if (!mounted) return;

    let isActive = true;

    (async () => {
      try {
        const { data: s, error: sErr } = await supabase.auth.getSession();
        if (sErr) console.error("getSession error:", sErr);
        if (!isActive) return;
        setUserId(s.session?.user?.id ?? null);
        setAuthReady(true);
      } catch (e) {
        console.error("Auth init error:", e);
        if (!isActive) return;
        setUserId(null);
        setAuthReady(true);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setAuthReady(true);
    });

    return () => {
      isActive = false;
      listener.subscription.unsubscribe();
    };
  }, [mounted]);

  async function continueAsGuest() {
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error("Anonymous login failed:", error);
        showToast(`Gastzugang fehlgeschlagen: ${error.message}`);
        return;
      }
      setUserId(data.user?.id ?? null);
      setAuthReady(true);
      showToast("Gastzugang aktiviert.");
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    if (!mounted) return;

    (async () => {
      setCitiesLoading(true);
      setCitiesLoadError(false);
      try {
        const { data, error } = await supabase
          .from("cities")
          .select("slug,name,country_code,center_lat,center_lng,population,is_active")
          .eq("is_active", true)
          .order("population", { ascending: false })
          .limit(500);

        if (error) {
          console.error("Cities load error:", error);
          setCities([]);
          setCitiesLoadError(true);
          return;
        }
        setCities(
          dedupeCitiesByCanonicalSlug((data as CityRow[]) ?? []).filter((city) =>
            isPlannerSupportedCitySlug(city.slug)
          )
        );
      } catch (error) {
        console.error("Cities load error:", error);
        setCities([]);
        setCitiesLoadError(true);
      } finally {
        setCitiesLoading(false);
      }
    })();
  }, [mounted, citiesReloadKey]);

  const availableCountryCodes = useMemo(
    () =>
      Array.from(
        new Set(
          cities
            .map((city) => city.country_code?.toUpperCase() ?? null)
            .filter((code): code is string => Boolean(code))
        )
      ).sort((a, b) => countryLabel(a).localeCompare(countryLabel(b), "de-DE")),
    [cities]
  );

  const visibleCities = useMemo(
    () =>
      selectedCountryCode === "all"
        ? cities
        : cities.filter((city) => (city.country_code?.toUpperCase() ?? "") === selectedCountryCode),
    [cities, selectedCountryCode]
  );

  const requestedHomepageCitySlug = useMemo(
    () => canonicalCitySlug(searchParams.get("citySlug") ?? searchParams.get("city")),
    [searchParams]
  );

  const {
    geoError,
    userLat,
    userLng,
    startPoint,
    setStartPoint,
    startPointSuggestions,
    startPointSearchLoading,
    startPointSearchError,
    effectiveCitySlug,
    selectedCity,
    suggestedCustomStartPoint,
    manualStartFallsBackToCityCenter,
    selectedCityFallbackLabel,
    shouldUseCurrentLocationAsOrigin,
    effectiveStartPoint,
    hasValidPlannerOrigin,
    resetStartPointForSelectedCity,
    applyStartPointSuggestion,
    updateStartPointType,
    useCurrentLocationAsStartPoint,
    clearStartPoint,
  } = usePlannerStartPoint({
    mounted,
    cities,
    visibleCities,
    selectedCountryCode,
    selectedCitySlug,
  });

  const eventModesAvailable = useMemo(
    () => plannerCitySupportsEventModes(effectiveCitySlug),
    [effectiveCitySlug]
  );

  const postPlanGroupChatSystemMessage = useCallback(
    (chatId: string, body: string) =>
      postPlannerGroupChatSystemMessage({
        chatId,
        body,
        userId,
      }),
    [userId]
  );

  useEffect(() => {
    if (selectedCitySlug == null) return;
    if (!visibleCities.length) return;
    const canonicalSelectedCitySlug = canonicalCitySlug(selectedCitySlug);
    if (!visibleCities.some((city) => city.slug === canonicalSelectedCitySlug)) {
      setSelectedCitySlug(null);
    }
  }, [selectedCitySlug, visibleCities]);

  useEffect(() => {
    if (!mounted) return;
    if (!requestedHomepageCitySlug) return;
    if (!cities.length) return;
    if (homepagePresetStartPointRef.current === requestedHomepageCitySlug) return;
    if (searchParams.get("citySlug") == null && searchParams.get("city") == null) return;

    const presetCity =
      cities.find((city) => city.slug === requestedHomepageCitySlug) ??
      cities.find((city) => canonicalCitySlug(city.slug) === requestedHomepageCitySlug) ??
      null;
    if (!presetCity) return;
    if (presetCity.center_lat == null || presetCity.center_lng == null) return;

    setStartPoint({
      mode: "custom",
      type: "address",
      label: cityStartFallbackLabel(presetCity),
      lat: presetCity.center_lat,
      lng: presetCity.center_lng,
    });
    homepagePresetStartPointRef.current = requestedHomepageCitySlug;
  }, [mounted, requestedHomepageCitySlug, cities, searchParams, setStartPoint]);

  useEffect(() => {
    if (experienceMode !== "event_visit" && experienceMode !== "market_festival") return;
    if (citiesLoading || !effectiveCitySlug) return;
    if (eventModesAvailable) return;
    setExperienceMode("classic");
    setSelectedEventId(null);
    setEventPlanningMode("disabled");
  }, [citiesLoading, effectiveCitySlug, eventModesAvailable, experienceMode]);

  function bumpStop(idx: number) {
    setStopOffsets((prev) => {
      const copy = [...prev];
      copy[idx] = (copy[idx] ?? 0) + 1;
      return copy;
    });
  }

  /** Changes the occasion and automatically sets the matching default planMode. */
  const handleOccasionChange = useCallback(
    (value: string) => {
      setOccasion(value);
      setPlanMode(defaultPlanModeForOccasion(value));
      // Family + Fuß + Innenstadt filtert alle Bowling/Kart/Klettern-Kandidaten
      // durch den engen 3km-Radius weg. Fuer Family default deshalb "car",
      // fuer alle anderen Anlaesse "foot" (Innenstadt-zentrisch).
      setRouteProfile(value === "family" ? "car" : "foot");
    },
    []
  );

  function resetPlan() {
    setStopOffsets((prev) => prev.map(() => 0));
    setAiText(null);
    setRouteSummary(null);
    setVariationSeed(0);
    setPlannerError(null);
    setSelectedVariantId("best-match");
    setPinnedVariantId(null);
    setEditingPlanId(null);
  }

  function rerollPlan() {
    setAiText(null);
    setRouteSummary(null);
    setActivePlanGroupChatId(null);
    setEditingPlanId(null);
    setVariationSeed((prev) => prev + 1);
  }

  function applyAiPlan(aiStops: import("@/lib/planner").PlannedStop[], summary: string, prompt: string) {
    // AI-Plan-Modus aktivieren BEVOR wir Daten setzen — sonst überschreibt der
    // normale /api/planner/generate-Effekt unseren State beim nächsten Re-Render.
    setAiPlanActive(true);
    setAiPlanPrompt(prompt);
    setPinnedVariantId(null);
    setSelectedVariantId("ai-plan");
    if (effectiveCitySlug) {
      void trackMonetizationEvent({
        eventType: "ai_plan_applied",
        userId,
        citySlug: effectiveCitySlug,
        surface: "planner",
        // locationIds + occasion sind die Lernbasis für den Qualitäts-Loop:
        // welche Orte die KI für welchen Anlass kombiniert hat.
        metadata: {
          stopCount: aiStops.length,
          promptLength: prompt.length,
          occasion,
          locationIds: aiStops
            .map((stop) => stop.item?.id)
            .filter((id): id is string => Boolean(id)),
        },
      });
    }
    // slotTemplate muss mind. so lang sein wie aiStops, damit occasionFlow nicht crasht.
    // Wir bauen ein minimales Template — Phase-Labels kommen sonst leer raus, was ok ist.
    const stubSlotTemplate = aiStops.map(() => ({
      phase: null,
      phaseGoal: null,
      kind: "anything" as const,
    }));
    setPlannerData({
      context: {
        slotTemplate: stubSlotTemplate,
      } as unknown as PlannerApiResponse["context"],
      results: [],
      activeLevel: "strict" as MatchLevel,
      effectiveRadiusKm: 10,
      eventCandidates: [],
      eventDebugRows: [],
      plannedStops: aiStops,
      fallbackSummary: { distanceKm: 0, travelMin: 0, activityMin: 0, totalMin: 0 },
      variants: [],
      recommendedVariantId: null,
    });
    setAiText(summary);
    setShowAiModal(false);
  }

  function exitAiPlanMode() {
    if (effectiveCitySlug) {
      void trackMonetizationEvent({
        eventType: "ai_plan_exited",
        userId,
        citySlug: effectiveCitySlug,
        surface: "planner",
        metadata: {},
      });
    }
    setAiPlanActive(false);
    setAiPlanPrompt(null);
    setAiText(null);
    setSelectedVariantId("best-match");
    // plannerData wird vom useEffect frisch geladen sobald aiPlanActive false ist.
  }

  function defaultEditedPlanTitle(saveMode: PlannerSaveMode, finalizeGroupPlan: boolean) {
    const baseTitle =
      planTitle.trim() ||
      (editingPlanId && selectedPlan
        ? selectedPlan.title ||
          selectedPlan.filters?.finalVariantLabel ||
          selectedPlan.filters?.pinnedVariantLabel ||
          "Gruppenplan"
        : null);

    if (!baseTitle) {
      if (finalizeGroupPlan) return `${finalChoice?.label || "Gruppenplan"} (final)`;
      return null;
    }

    if (!editingPlanId || !selectedPlan) {
      return finalizeGroupPlan ? `${baseTitle} (final)` : baseTitle;
    }

    if (saveMode === "new_variant") {
      return `${baseTitle} - ${finalChoice?.label || activeVariant?.label || "Neue Variante"}`;
    }

    if (saveMode === "new_version") {
      return `${baseTitle} - Neuer Stand`;
    }

    return finalizeGroupPlan ? `${baseTitle} (final)` : baseTitle;
  }

  const plannerRequest = useMemo<PlannerRequest>(() => {
    const eventStrictness = eventStrictnessForExperienceMode(experienceMode);
      return {
        citySlug: effectiveCitySlug,
        planDate,
        dayStartMin,
        selectedEventId,
        eventPlanningMode,
        startPoint: {
        type: startPoint.mode === "current_location" ? "current_location" : startPoint.type,
        label: effectiveStartPoint.label,
        lat: effectiveStartPoint.lat,
        lng: effectiveStartPoint.lng,
      },
      planMode,
      radiusKm,
      budget: budget as PlannerRequest["budget"],
      occasion: occasion as PlannerRequest["occasion"],
      familyAgeBand: occasion === "family" ? familyAgeBand : null,
      experienceMode,
      eventStrictness,
      interests,
      group: {
        enabled: groupEnabled,
        members: groupMembers,
      },
      fullDayActsAfterBreakfast,
      fullDayActsAfterLunch,
      stopsCount,
      sortMode,
      routeProfile,
      stopOffsets,
      variationSeed,
      evaluationMode,
    };
  }, [
    effectiveCitySlug,
    planDate,
    dayStartMin,
    startPoint.mode,
    startPoint.type,
    effectiveStartPoint.label,
    effectiveStartPoint.lat,
    effectiveStartPoint.lng,
    planMode,
    radiusKm,
    budget,
    occasion,
    familyAgeBand,
    experienceMode,
    selectedEventId,
    eventPlanningMode,
    interests,
    groupEnabled,
    groupMembers,
    fullDayActsAfterBreakfast,
    fullDayActsAfterLunch,
    stopsCount,
    sortMode,
    routeProfile,
    stopOffsets,
    variationSeed,
    evaluationMode,
  ]);
  const {
    plannerLoading,
    plannerError,
    setPlannerError,
    plannerErrorKind,
    retryPlannerGeneration,
    plannerData,
    setPlannerData,
    aiPlanActive,
    setAiPlanActive,
    selectedVariantId,
    setSelectedVariantId,
    setPinnedVariantId,
    variantVotes,
    setVariantVotes,
    results,
    activeLevel,
    effectiveRadiusKm,
    eventCandidates,
    eventDebugRows,
    eventDebugGroupCounts,
    reactionParticipants,
    activeVariant,
    pinnedVariant,
    majorityThreshold,
    leadingVariant,
    plannerVoteMoment,
    finalChoice,
    plannedStops,
    occasionFlow,
    groupPlanSummary,
    timingWarnings,
    eventProviderSummary,
    eventCategorySummary,
    fallbackSummary,
    mapStops,
    googleRouteUrl,
    movePlannedStop,
    optimizeStopOrder,
    toggleVariantReaction,
  } = usePlannerGeneration({
    mounted,
    presetsReady,
    effectiveCitySlug,
    hasValidPlannerOrigin,
    startPointMode: startPoint.mode,
    plannerRequest,
    radiusKm,
    userId,
    occasion,
    experienceMode,
    planMode,
    routeProfile,
    selectedEventId,
    groupEnabled,
    groupMembers,
    effectiveStartPoint,
    activePlanGroupChatId,
    onPostGroupMessage: postPlanGroupChatSystemMessage,
  });

  // Mobile-UX: Nach abgeschlossener Generierung Setup-Blöcke einklappen
  // (kompakte Summary-Bar mit "Ändern" ersetzt sie) und direkt zum Plan
  // scrollen — auf 375px liegen die Blöcke sonst vor dem Ergebnis.
  const planOutputRef = useRef<HTMLDivElement | null>(null);
  const prevPlannerLoadingRef = useRef(false);
  const [mobileSetupOpen, setMobileSetupOpen] = useState(true);
  useEffect(() => {
    const wasLoading = prevPlannerLoadingRef.current;
    prevPlannerLoadingRef.current = plannerLoading;
    if (
      wasLoading &&
      !plannerLoading &&
      plannedStops.length > 0 &&
      typeof window !== "undefined" &&
      window.innerWidth < 640
    ) {
      setMobileSetupOpen(false);
      planOutputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [plannerLoading, plannedStops.length]);

  const {
    plans,
    planChoiceReactions,
    planEditSuggestions,
    saving,
    loadingPlans,
    planTitle,
    setPlanTitle,
    selectedPlan,
    setSelectedPlan,
    resumedPlanId,
    setResumedPlanId,
    editingPlanId,
    setEditingPlanId,
    savePlan,
    sharePlan,
    sendFinalPlanToFriends,
    openPlanGroupChat,
    resolveEditSuggestion,
  } = usePlannerPersistence({
    authReady,
    userId,
    requestedPlanId,
    effectiveCitySlug,
    budget,
    occasion,
    familyAgeBand,
    planMode,
    stopsCount,
    interests,
    groupEnabled,
    groupMembers,
    fullDayActsAfterBreakfast,
    fullDayActsAfterLunch,
    effectiveStartPoint,
    activeVariant,
    pinnedVariant,
    finalChoice,
    leadingVariant,
    variantVotes,
    radiusKm,
    effectiveRadiusKm,
    sortMode,
    activeLevel,
    aiText,
    aiPlanActive,
    aiPlanPrompt,
    experienceMode,
    routeProfile,
    plannedStops,
    getCurrentFinalStatusLabel: () => currentFinalStatusLabel,
    showToast,
    defaultEditedPlanTitle,
    buildChoiceSummaryText,
    onSetActivePlanGroupChatId: setActivePlanGroupChatId,
  });

  useEffect(() => {
    if (!mounted) return;

    const template = consumePlannerRouteTemplate();
    if (!template) return;

    if (template.citySlug) setSelectedCitySlug(canonicalCitySlug(template.citySlug));
    if (template.occasion) {
      setOccasion(template.occasion);
      setPlanMode(defaultPlanModeForOccasion(template.occasion));
    }
    if (
      template.experienceMode === "classic" ||
      template.experienceMode === "show" ||
      template.experienceMode === "event_visit" ||
      template.experienceMode === "market_festival"
    ) {
      setExperienceMode(template.experienceMode);
      setEventPlanningMode(template.experienceMode === "classic" ? "disabled" : "auto");
      setSelectedEventId(null);
    } else if (template.occasion === "party") {
      setExperienceMode("event_visit");
      setEventPlanningMode("auto");
      setSelectedEventId(null);
    }
    if (template.routeProfile) setRouteProfile(template.routeProfile);
    if (Array.isArray(template.interests) && template.interests.length > 0) {
      const normalizedTemplateInterests = Array.from(
        new Set(
          template.interests.filter(
            (value): value is string => typeof value === "string" && value.trim().length > 0
          )
        )
      );
      setInterests(normalizedTemplateInterests);
      setPlannerTemplateInterests(normalizedTemplateInterests);
    } else {
      setPlannerTemplateInterests([]);
    }
    if (template.title) {
      setPlanTitle(template.title);
      setPlannerTemplateLoadedLabel(template.title);
    } else {
      setPlannerTemplateLoadedLabel("diese Route");
    }
    setPlannerTemplateSourceSlug(template.sourceRouteSlug ?? null);
    if (template.startPoint && template.startPoint.lat != null && template.startPoint.lng != null) {
      setStartPoint({
        mode: template.startPoint.mode === "custom" ? "custom" : "custom",
        type:
          template.startPoint.type === "hotel" ||
          template.startPoint.type === "station" ||
          template.startPoint.type === "airport" ||
          template.startPoint.type === "other"
            ? template.startPoint.type
            : "address",
        label: template.startPoint.label ?? "",
        lat: template.startPoint.lat,
        lng: template.startPoint.lng,
      });
    }

    showToast("Route als Vorlage in den Planner übernommen.");
  }, [mounted, setStartPoint, setInterests, setPlanTitle, showToast]);

  const continueEditingSavedPlan = useCallback((plan: SavedPlanRow) => {
    const filters = (plan.filters ?? {}) as Record<string, unknown>;
    const startPointFilter =
      filters.startPoint && typeof filters.startPoint === "object"
        ? (filters.startPoint as Record<string, unknown>)
        : null;

    if (typeof filters.budget === "string") setBudget(filters.budget);
    if (typeof filters.occasion === "string") setOccasion(filters.occasion);
    if (filters.familyAgeBand) {
      const restoredFamilyAgeBand = resolveFamilyAgeBand(filters.familyAgeBand);
      if (restoredFamilyAgeBand) setFamilyAgeBand(restoredFamilyAgeBand);
    }
    if (typeof filters.planMode === "string") setPlanMode(filters.planMode as PlanMode);
    if (typeof filters.stopsCount === "number") setStopsCount(filters.stopsCount);
    if (Array.isArray(filters.interests)) {
      setInterests(filters.interests.filter((value): value is string => typeof value === "string"));
    }
    if (typeof filters.groupEnabled === "boolean") setGroupEnabled(filters.groupEnabled);
    if (Array.isArray(filters.groupMembers)) {
      setGroupMembers(filters.groupMembers as GroupMember[]);
    }
    if (typeof filters.fullDayActsAfterBreakfast === "number") {
      setFullDayActsAfterBreakfast(filters.fullDayActsAfterBreakfast);
    }
    if (typeof filters.fullDayActsAfterLunch === "number") {
      setFullDayActsAfterLunch(filters.fullDayActsAfterLunch);
    }
    if (typeof filters.citySlug === "string" || filters.citySlug === null) {
      setSelectedCitySlug(canonicalCitySlug(filters.citySlug ?? null));
    }
    if (startPointFilter) {
      setStartPoint({
        mode:
          startPointFilter.mode === "custom" || startPointFilter.type !== "current_location"
            ? "custom"
            : "current_location",
        type:
          startPointFilter.type === "current_location" ||
          startPointFilter.type === "address" ||
          startPointFilter.type === "hotel" ||
          startPointFilter.type === "station" ||
          startPointFilter.type === "airport" ||
          startPointFilter.type === "other"
            ? startPointFilter.type
            : "other",
        label: typeof startPointFilter.label === "string" ? startPointFilter.label : "Startpunkt",
        lat: typeof startPointFilter.lat === "number" ? startPointFilter.lat : null,
        lng: typeof startPointFilter.lng === "number" ? startPointFilter.lng : null,
      });
    }
    if (typeof plan.radius_km === "number") setRadiusKm(plan.radius_km);
    if (plan.sort_mode === "match" || plan.sort_mode === "distance") {
      setSortMode(plan.sort_mode);
    }

    setSelectedEventId(null);
    setEventPlanningMode("auto");
    setAiText(plan.ai_description ?? null);
    setRouteSummary(null);

    // Restore the saved stops so the user sees their plan immediately
    // without waiting for a full regeneration.
    const savedSlots = Array.isArray(plan.slots) ? (plan.slots as Array<Record<string, unknown>>) : [];
    if (savedSlots.length > 0) {
      const restoredStops = savedSlots.map((slot) => {
        const loc = slot.location && typeof slot.location === "object"
          ? (slot.location as Record<string, unknown>)
          : null;
        return {
          index: typeof slot.index === "number" ? slot.index : 0,
          label: typeof slot.label === "string" ? slot.label : "",
          hint: typeof slot.hint === "string" ? slot.hint : "",
          item: loc
            ? ({
                id: String(loc.id ?? ""),
                name: String(loc.name ?? ""),
                type: String(loc.type ?? ""),
                category: undefined,
                duration_min: typeof loc.duration_min === "number" ? loc.duration_min : null,
                reservation_url: typeof loc.reservation_url === "string" ? loc.reservation_url : null,
                lat: typeof loc.lat === "number" ? loc.lat : null,
                lng: typeof loc.lng === "number" ? loc.lng : null,
                distanceFromOriginKm: typeof loc.distanceKm === "number" ? loc.distanceKm : null,
                score: typeof loc.baseScore === "number" ? loc.baseScore : 0,
                prefBoost: typeof loc.prefBoost === "number" ? loc.prefBoost : 0,
                totalScore: typeof loc.totalScore === "number" ? loc.totalScore : 0,
                matchLevel: (typeof loc.matchLevel === "string" ? loc.matchLevel : "medium") as MatchLevel,
              } as ScoredLocation)
            : null,
          durationMin: typeof slot.durationMin === "number" ? slot.durationMin : null,
          travelMinFromPrev: typeof slot.travelMinFromPrev === "number" ? slot.travelMinFromPrev : null,
          scheduledStartAt: typeof slot.scheduledStartAt === "string" ? slot.scheduledStartAt : null,
          scheduledEndAt: typeof slot.scheduledEndAt === "string" ? slot.scheduledEndAt : null,
          timingLock: null,
          timingWarnings: [],
          reasons: Array.isArray(slot.reasons)
            ? (slot.reasons as unknown[]).filter((r): r is string => typeof r === "string")
            : [],
          groupDecision: null,
          debug: null,
        };
      });
      setPlannerData({
        context: {} as PlannerApiResponse["context"],
        results: [],
        activeLevel: (plan.active_level ?? "medium") as MatchLevel,
        effectiveRadiusKm: plan.effective_radius_km ?? plan.radius_km ?? 10,
        eventCandidates: [],
        eventDebugRows: [],
        plannedStops: restoredStops,
        fallbackSummary: { distanceKm: 0, travelMin: 0, activityMin: 0, totalMin: 0 },
        variants: [],
        recommendedVariantId: null,
      });
    } else {
      setPlannerData(null);
    }
    setSelectedVariantId(typeof filters.variantId === "string" ? filters.variantId : "best-match");
    setPinnedVariantId(typeof filters.pinnedVariantId === "string" ? filters.pinnedVariantId : null);
    setVariantVotes(
      filters.variantVotes && typeof filters.variantVotes === "object"
        ? (filters.variantVotes as Record<string, string[]>)
        : {}
    );
    setPlanTitle(typeof plan.title === "string" ? plan.title : "");
    setSelectedPlan(plan);
    setEditingPlanId(plan.id);
    void trackMonetizationEvent({
      eventType: "plan_intent",
      userId,
      planId: plan.id,
      citySlug: typeof filters.citySlug === "string" ? filters.citySlug : effectiveCitySlug,
      surface: "planner_resume",
      metadata: {
        target: "resume_saved_plan",
        groupEnabled: Boolean(filters.groupEnabled),
        hasShareToken: Boolean(plan.share_token),
        source: requestedResume && requestedPlanId === plan.id ? "query_resume" : "manual_resume",
        stopsCount:
          typeof filters.stopsCount === "number"
            ? filters.stopsCount
            : Array.isArray(plan.slots)
              ? plan.slots.length
              : null,
      },
    });
    showToast("Plan in den Planner übernommen.");
  }, [
    setBudget,
    setOccasion,
    setPlanMode,
    setStopsCount,
    setInterests,
    setGroupEnabled,
    setGroupMembers,
    setFullDayActsAfterBreakfast,
    setFullDayActsAfterLunch,
    setSelectedCitySlug,
    setStartPoint,
    setRadiusKm,
    setSortMode,
    setSelectedEventId,
    setEventPlanningMode,
    setAiText,
    setPlannerData,
    setRouteSummary,
    setSelectedVariantId,
    setPinnedVariantId,
    setVariantVotes,
    setPlanTitle,
    setSelectedPlan,
    setEditingPlanId,
    showToast,
    userId,
    effectiveCitySlug,
    requestedResume,
    requestedPlanId,
  ]);

  useEffect(() => {
    if (!requestedResume || !requestedPlanId || !plans.length) return;
    if (resumedPlanId === requestedPlanId) return;
    const match = plans.find((plan) => plan.id === requestedPlanId);
    if (!match) return;
    continueEditingSavedPlan(match);
    setResumedPlanId(requestedPlanId);
  }, [requestedResume, requestedPlanId, plans, resumedPlanId, continueEditingSavedPlan, setResumedPlanId]);

  const latestSavedPlan = useMemo(() => {
    if (!plans.length) return null;
    return [...plans].sort((left, right) => {
      const leftDate = left.created_at || "";
      const rightDate = right.created_at || "";
      if (leftDate === rightDate) return 0;
      return leftDate > rightDate ? -1 : 1;
    })[0] ?? null;
  }, [plans]);

  const latestSavedPlanTitle =
    latestSavedPlan?.title ||
    latestSavedPlan?.filters?.finalVariantLabel ||
    latestSavedPlan?.filters?.pinnedVariantLabel ||
    null;

  const latestSavedPlanMeta = useMemo(() => {
    if (!latestSavedPlan) return null;
    const createdAt = latestSavedPlan.created_at ? new Date(latestSavedPlan.created_at) : null;
    const dateLabel =
      createdAt && !Number.isNaN(createdAt.getTime())
        ? createdAt.toLocaleDateString("de-DE", { day: "2-digit", month: "short" })
        : null;
    const stopsCount =
      typeof latestSavedPlan.filters?.stopsCount === "number"
        ? `${latestSavedPlan.filters.stopsCount} Stops`
        : Array.isArray(latestSavedPlan.slots)
          ? `${latestSavedPlan.slots.length} Stops`
          : null;
    return [dateLabel, stopsCount].filter(Boolean).join(" | ") || null;
  }, [latestSavedPlan]);

  const currentShareChoiceSummary = useMemo(() => {
    if (!selectedPlan?.id) return null;
    const summary = planChoiceReactions[selectedPlan.id];
    if (!summary?.count) return null;
    return summary;
  }, [selectedPlan, planChoiceReactions]);
  const shareVoteMoment = useMemo(() => {
    if (!currentShareChoiceSummary) return null;
    const votes = currentShareChoiceSummary.count;
    const total = reactionParticipants.length || null;
    const majority = total ? Math.max(2, Math.ceil(total / 2)) : null;

    if (total && votes >= total) {
      return {
        label: "Alle haben bestätigt",
        note: "Die Share-Wahl ist jetzt vollständig von der Gruppe bestätigt.",
        tone: "emerald",
      } as const;
    }
    if (majority && votes >= majority) {
      return {
        label: "Mehrheit erreicht",
        note: "Die Share-Seite zeigt jetzt genug Zustimmung für die gemeinsame Wahl.",
        tone: "emerald",
      } as const;
    }
    if (majority && majority - votes === 1) {
      return {
        label: "Noch 1 Stimme bis zur Gruppenwahl",
        note: "Eine weitere Bestätigung im Share-Link würde die Gruppenwahl absichern.",
        tone: "amber",
      } as const;
    }
    return {
      label: votes >= 2 ? "Trägt schon in der Gruppe" : "Erste Zustimmung",
      note:
        votes >= 2
          ? "Die Gruppenwahl wird über den Share-Link schon sichtbar getragen."
          : "Die erste Bestätigung über den Share-Link ist da.",
      tone: "sky",
    } as const;
  }, [currentShareChoiceSummary, reactionParticipants.length]);
  const currentFinalStatusLabel =
    shareVoteMoment?.label === "Alle haben bestätigt"
      ? "Tag ist abgestimmt"
      : shareVoteMoment?.tone === "emerald" || plannerVoteMoment?.tone === "emerald"
        ? "Gruppenwahl bestätigt"
        : "Finaler Gruppenplan";

  useEffect(() => {
    let active = true;

    const locationIds = Array.from(
      new Set(
        plannedStops
          .map((stop) =>
            stop.item?.source_primary !== "planner_event" && typeof stop.item?.id === "string"
              ? stop.item.id
              : null
          )
          .filter((value): value is string => Boolean(value))
      )
    );

    const plannerEventIds = Array.from(
      new Set(
        [
          ...eventCandidates.map((event) => event.id),
          ...plannedStops
            .map((stop) =>
              stop.item?.source_primary === "planner_event" && typeof stop.item?.id === "string"
                ? stop.item.id
                : null
            )
            .filter((value): value is string => Boolean(value)),
        ].filter(Boolean)
      )
    );

    if (locationIds.length === 0 && plannerEventIds.length === 0) {
      setAffiliateResolution(emptyPublicAffiliateResolution());
      return () => {
        active = false;
      };
    }

    (async () => {
      try {
        const resolution = await resolvePublicAffiliateLinksClient({
          locationIds,
          plannerEventIds,
        });
        if (!active) return;
        setAffiliateResolution(resolution);
      } catch (error) {
        console.error("Planner affiliate resolution failed:", error);
        if (!active) return;
        setAffiliateResolution(emptyPublicAffiliateResolution());
      }
    })();

    return () => {
      active = false;
    };
  }, [eventCandidates, plannedStops]);

  const selectedEvent =
    selectedEventId != null
      ? eventCandidates.find((event) => event.id === selectedEventId) ?? null
      : null;
  const selectedEventIndex =
    selectedEventId != null ? eventCandidates.findIndex((event) => event.id === selectedEventId) : -1;

  useEffect(() => {
    if (experienceMode === "classic") {
      setSelectedEventId(null);
      setEventPlanningMode("auto");
      return;
    }

    if (selectedEventId && !eventCandidates.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(null);
      setEventPlanningMode((prev) => (prev === "locked" ? "auto" : prev));
    }
  }, [experienceMode, eventCandidates, selectedEventId]);

  useEffect(() => {
    setDraggedStopPosition(null);
  }, [activeVariant?.variantId, plannerData]);

  async function copyPinnedChoiceSummary() {
    const choice = pinnedVariant ?? activeVariant;
    if (!choice) {
      showToast("Wähle zuerst eine Variante aus, damit wir die Zusammenfassung erzeugen können.");
      return;
    }

    const text = buildChoiceSummaryText();

    try {
      await navigator.clipboard.writeText(text);
      showToast("Wahltext kopiert. Du kannst ihn jetzt direkt in Chat oder Abstimmung weitergeben.");
    } catch {
      prompt("Kopiere diese Wahl:", text);
    }
  }

  function buildChoiceSummaryText(
    choicePlan?: {
      filters?: {
        groupChoiceLabel?: string | null;
        pinnedVariantLabel?: string | null;
        leadingVariantLabel?: string | null;
        leadingVariantVotes?: number | null;
      } | null;
    } | null
  ) {
    if (choicePlan?.filters?.pinnedVariantLabel) {
      const lines = [
        `${choicePlan.filters.groupChoiceLabel || "Unsere Wahl"}: ${choicePlan.filters.pinnedVariantLabel}`,
      ];
      if (
        typeof choicePlan.filters.leadingVariantVotes === "number" &&
        choicePlan.filters.leadingVariantVotes > 0 &&
        choicePlan.filters.leadingVariantLabel
      ) {
        lines.push(
          `${choicePlan.filters.leadingVariantVotes} Stimmen für ${choicePlan.filters.leadingVariantLabel}`
        );
      }
      return lines.join("\n");
    }

    const choice = pinnedVariant ?? activeVariant;
    if (!choice) return "";

    return [
      pinnedVariant ? "Unsere Wahl" : "Aktuelle Wahl",
      `${choice.label}`,
      choice.groupSummary?.note ?? choice.reason,
      groupEnabled && reactionParticipants.length > 0
        ? `${variantVotes[choice.variantId]?.length ?? 0} von ${reactionParticipants.length} haben zugestimmt`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  function openChoiceInChat() {
    const text = buildChoiceSummaryText();
    if (!text) {
      showToast("Wähle zuerst eine Variante aus.");
      return;
    }

    window.location.href = `/chat?prefill=${encodeURIComponent(text)}`;
  }

  function openReminderInChat() {
    const text = buildChoiceSummaryText();
    if (!text) {
      showToast("Wähle zuerst eine Variante aus.");
      return;
    }

    const reminderText = `${text}\n\nUns fehlt noch eine Stimme zur gemeinsamen Wahl.`;
    window.location.href = `/chat?prefill=${encodeURIComponent(reminderText)}`;
  }

  function plannerActivationMetadata(target: string) {
    const mergedInterests = mergeInterests(interests, groupMembers, groupEnabled);
    return {
      target,
      budget,
      experienceMode,
      groupEnabled,
      groupMemberCount: groupEnabled ? groupMembers.length : 0,
      hasStartPoint: Boolean(effectiveStartPoint.lat != null && effectiveStartPoint.lng != null),
      interestsCount: mergedInterests.length,
      occasion,
      planMode,
      routeProfile,
      selectedEventId: selectedEventId ?? null,
      stopsCount: plannedStops.length,
    };
  }

  async function handoffPlanToRouteBuilder() {
    if (!plannedStops.length) {
      showToast("Erstelle zuerst einen Tagesplan.");
      return;
    }

    const mergedInterests = mergeInterests(interests, groupMembers, groupEnabled);
    const routeTheme = inferRouteThemeFromInterests(mergedInterests);
    writeRouteBuilderDraft({
      title:
        planTitle.trim() ||
        `${occasion.charAt(0).toUpperCase()}${occasion.slice(1)} in ${selectedCity?.name ?? effectiveCitySlug ?? "deiner Stadt"}`,
      description: aiText ?? null,
      citySlug: effectiveCitySlug,
      coverImageUrl: null,
      routeOccasion:
        occasion === "date" || occasion === "family" || occasion === "friends" || occasion === "tourism" || occasion === "party"
          ? occasion
          : "none",
      routeProfileMode: routeProfile,
      routeTheme,
      routeTags: mergedInterests,
      startType:
        effectiveStartPoint.type === "hotel" ||
        effectiveStartPoint.type === "station" ||
        effectiveStartPoint.type === "airport" ||
        effectiveStartPoint.type === "other"
          ? effectiveStartPoint.type
          : "address",
        startLabel: effectiveStartPoint.label || null,
        startLat: effectiveStartPoint.lat != null ? String(effectiveStartPoint.lat) : null,
        startLng: effectiveStartPoint.lng != null ? String(effectiveStartPoint.lng) : null,
        sourcePlanTitle: planTitle.trim() || null,
        sourceKind: "planner",
        sourceGroupLabel: groupEnabled && groupMembers.length > 0 ? `${groupMembers.length + 1} Personen` : "Für dich",
        sourceInterests: mergedInterests,
        sourceMembers: [
          ...(interests.length > 0 ? [{ name: "Du", interests, isCurrentUser: true }] : []),
          ...groupMembers.map((member) => ({
            name: member.name,
            interests: member.interests,
            isCurrentUser: false,
          })),
        ],
        draftStops: plannedStops.map((stop) => ({
        location_id: stop.item?.id ?? null,
        title: stop.label || stop.item?.name || "Stop",
        subtitle: stop.item ? [stop.item.type, stop.item.category].filter(Boolean).join(" | ") : stop.hint || "Aus dem Planner",
        note: [stop.hint, ...(stop.reasons ?? [])].filter(Boolean).join("\n"),
        external_url: stop.item?.reservation_url ?? "",
        is_required: stop.index === 1,
        duration_min: stop.durationMin != null ? String(stop.durationMin) : stop.item?.duration_min != null ? String(stop.item.duration_min) : "",
        lat: stop.item?.lat != null ? String(stop.item.lat) : "",
        lng: stop.item?.lng != null ? String(stop.item.lng) : "",
        photo_url: "",
        scheduled_start_at: stop.scheduledStartAt ?? null,
        scheduled_end_at: stop.scheduledEndAt ?? null,
        travel_min_from_prev: stop.travelMinFromPrev ?? null,
      })),
    });

    await trackMonetizationEvent({
      eventType: "route_copy",
      userId,
      citySlug: effectiveCitySlug,
      surface: "planner",
      metadata: plannerActivationMetadata("creator_route_prepare"),
    });

    window.location.href = "/routes";
  }

  async function startPlannerRouteRun() {
    if (!plannedStops.length) {
      showToast("Erstelle zuerst einen Tagesplan.");
      return;
    }

    writePlannerRunDraft({
      id: `planner-${Date.now()}`,
      title:
        planTitle.trim() ||
        `${occasionLabel(occasion)} in ${selectedCity?.name ?? effectiveCitySlug ?? "deiner Stadt"}`,
      cityLabel: selectedCity?.name ?? effectiveCitySlug ?? null,
      occasionLabel: occasionLabel(occasion),
      routeProfileLabel: routeProfileLabel(routeProfile),
      startedAt: new Date().toISOString(),
      start: {
        label: effectiveStartPoint.label || null,
        lat: effectiveStartPoint.lat ?? null,
        lng: effectiveStartPoint.lng ?? null,
      },
      stops: plannedStops.map((stop, index) => ({
        id: `${stop.item?.id ?? "planner"}-${index + 1}`,
        order: index + 1,
        title: stop.item?.name || stop.label || `Stop ${index + 1}`,
        label: stop.label || stop.item?.type || "Stop",
        note: [stop.hint, ...(stop.reasons ?? [])].filter(Boolean).join("\n"),
        durationMin: stop.durationMin ?? stop.item?.duration_min ?? null,
        externalUrl: stop.item?.reservation_url ?? null,
        lat: stop.item?.lat ?? null,
        lng: stop.item?.lng ?? null,
        isRequired: stop.index === 1,
      })),
    });

    await trackMonetizationEvent({
      eventType: "plan_intent",
      userId,
      citySlug: effectiveCitySlug,
      surface: "planner",
      metadata: plannerActivationMetadata("route_run_start"),
    });

    window.location.href = "/run";
  }

  const relaxedText =
    activeLevel === "strict"
      ? null
      : activeLevel === "relax_daytime"
      ? "Keine exakten Treffer - Tageszeit wurde gelockert, um mehr Vorschläge zu finden."
      : activeLevel === "relax_budget"
      ? "Keine exakten Treffer - Budget und Tageszeit wurden gelockert, um mehr Vorschläge zu finden."
      : "Keine passenden Treffer - zeige nahe Alternativen im Umkreis.";

  const expandedText =
    effectiveRadiusKm != null && effectiveRadiusKm > radiusKm
      ? `Um mehr Optionen zu finden, haben wir den Umkreis intern auf ${effectiveRadiusKm} km erweitert.`
      : null;

  const groupPlanningSignals = useMemo(
    () => buildGroupPlanningSignals(interests, groupMembers, groupEnabled),
    [interests, groupMembers, groupEnabled]
  );
  const effectiveInterests = mergeInterests(interests, groupMembers, groupEnabled);
  if (!mounted) return null;

  const cityLabel =
    cities.find((c) => c.slug === effectiveCitySlug)?.name ??
    effectiveCitySlug ??
    "-";
  const plannerAudienceLabel = compactPartyLabel(occasion, groupEnabled, groupMembers);
  const plannerSummaryLine = [
    occasionLabel(occasion),
    occasion === "family" ? familyAgeBandShortLabel(familyAgeBand) : null,
    experienceModeLabel(experienceMode, occasion),
    budgetLabel(budget),
    plannerDateLabel(planDate),
  ].filter(Boolean).join(" · ");
  const homepagePresetActive =
    Boolean(plannerTemplateLoadedLabel) ||
    [
      "citySlug",
      "city",
      "occasion",
      "familyAgeBand",
      "experienceMode",
      "mode",
      "budget",
      "planDate",
      "interests",
    ].some((key) => searchParams.has(key));

  const occasionPageTitleMap: Record<string, string> = {
    date: "Date Night",
    friends: "Mit Freunden",
    family: "Familientag",
    solo: "Solotrip",
    party: "Party",
    tourism: "Stadtentdeckung",
  };
  const occasionTitle = occasionPageTitleMap[occasion] ?? occasionLabel(occasion);
  const plannerPageTitle =
    cityLabel && cityLabel !== "-"
      ? `${occasionTitle} in ${cityLabel}`
      : occasionTitle;

  // Premium-Export: PDF (Druckansicht) und Kalender (.ics). Free-User sehen
  // das Upgrade-Modal — das ist das beworbene Premium-Feature.
  function handlePlanExport(kind: "pdf" | "ics") {
    if (plannedStops.length === 0) return;
    if (!isPremium) {
      setShowExportUpgrade(true);
      return;
    }
    const input = {
      title: plannerPageTitle,
      cityLabel: cityLabel !== "-" ? cityLabel : null,
      planDate: planDate || null,
      stops: plannedStops,
    };
    if (kind === "pdf") {
      const opened = openPlanPrintWindow(input);
      if (!opened) showToast("Bitte Pop-ups für diese Seite erlauben, um das PDF zu erstellen.");
    } else {
      downloadPlanIcs(input);
    }
  }

  const plannerHeaderDescription = homepagePresetActive
    ? plannerLoading || citiesLoading
      ? "Wir stellen deinen Plan gerade zusammen — Orte, Timing und Wege werden abgestimmt."
      : plannedStops.length > 0
        ? "Dein erster Vorschlag ist fertig. Schau ihn dir an und pass ihn nach Lust an."
        : "Noch kein Vorschlag — wähle einen Startpunkt oder justiere die Parameter."
    : "Wähle Stadt und Anlass. PerfectDay24 erstellt automatisch einen konkreten Tagesplan mit Orten, Zeiten und Wegen.";

  const displayedStartPointLabel =
    startPoint.mode === "current_location" && !shouldUseCurrentLocationAsOrigin
      ? effectiveStartPoint.label
      : startPoint.label;
  const plannerReadinessSteps = [
    {
      label: "Start",
      value: hasValidPlannerOrigin
        ? effectiveStartPoint.label || selectedCityFallbackLabel || cityLabel
        : "offen",
      state: hasValidPlannerOrigin ? "done" : "active",
    },
    {
      label: "Plan",
      value: plannerLoading
        ? "wird gebaut"
        : plannedStops.length > 0
          ? `${plannedStops.length} ${plannedStops.length === 1 ? "Stop" : "Stops"}`
          : "bereit",
      state: plannedStops.length > 0 ? "done" : plannerLoading ? "active" : "idle",
    },
    {
      label: "Route",
      value:
        plannedStops.length > 1
          ? routeSummary
            ? `${routeSummary.totalDurationMin} Min`
            : `~${fallbackSummary.totalMin} Min`
          : routeProfileLabel(routeProfile),
      state: plannedStops.length > 1 ? "done" : "idle",
    },
    {
      label: "Sichern",
      value: userId ? "aktiv" : "Anmeldung fehlt",
      state: userId && plannedStops.length > 0 ? "done" : "idle",
    },
  ];

  return (
    // pb-40: Platz für den sticky "Route starten"-CTA über der Bottom-Nav (nur mobil)
    <main className={`pd24-page-wide space-y-4 ${plannedStops.length > 0 ? "pb-40 sm:pb-0" : ""}`}>
      <section
        className={`gap-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start ${
          mobileSetupOpen ? "grid" : "hidden sm:grid"
        }`}
      >
        <div className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-4 shadow-[var(--shadow-soft)] sm:px-5">
          <div className="flex flex-col gap-5">
            <div>
              <div className="mb-2 flex flex-wrap gap-2">
                <span className="warm-chip rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
                  {occasionTitle}
                </span>
                {cityLabel !== "-" && (
                  <span className="rounded-full border border-[var(--line-subtle)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                    {cityLabel}
                  </span>
                )}
                {plannerTemplateLoadedLabel ? (
                  <span className="rounded-full border border-[var(--brand-accent)]/25 bg-[var(--brand-accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--brand-accent)]">
                    Vorlage
                  </span>
                ) : null}
              </div>
              <h1 className="max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-[var(--text-strong)] sm:text-3xl">
                {plannerPageTitle}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                {plannerHeaderDescription}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {plannerReadinessSteps.map((step, index) => (
                <div
                  key={step.label}
                  className={`min-w-0 rounded-[var(--radius-control)] border px-3 py-2 ${
                    step.state === "done"
                      ? "border-[var(--state-success)]/25 bg-[var(--brand-accent-cloud)]"
                      : step.state === "active"
                        ? "border-[var(--state-warning)]/30 bg-[var(--brand-warm-cloud)]"
                        : "border-[var(--line-subtle)] bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                        step.state === "done"
                          ? "bg-[var(--state-success)] text-white"
                          : step.state === "active"
                            ? "bg-[var(--state-warning)] text-white"
                            : "bg-[var(--bg-panel)] text-[var(--text-muted)]"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="pd24-meta">
                      {step.label}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-sm font-semibold text-[var(--text-strong)]">
                    {step.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <PlannerActivationPanel
          cityLabel={cityLabel}
          plannerSummaryLine={plannerSummaryLine}
          startPointLabel={effectiveStartPoint.label || selectedCityFallbackLabel || "-"}
          routeProfileLabel={`${routeProfileLabel(routeProfile)} | ${planMode}`}
          plannerLoading={plannerLoading}
          plannerError={plannerError}
          hasPlannerData={Boolean(plannerData)}
          hasValidPlannerOrigin={hasValidPlannerOrigin}
          citiesLoading={citiesLoading}
          presetActive={homepagePresetActive}
          templateLabel={plannerTemplateLoadedLabel}
          plannedStopsCount={plannedStops.length}
          resultsCount={results.length}
          eventCandidatesCount={eventCandidates.length}
          interestsCount={effectiveInterests.length}
          expandedRadius={Boolean(expandedText)}
          relaxedFilters={Boolean(relaxedText)}
          latestPlanTitle={latestSavedPlanTitle}
          latestPlanMeta={latestSavedPlanMeta}
          loadingPlans={loadingPlans}
          onOpenConfig={() => setShowPlannerConfig(true)}
          onResumeLatestPlan={() => {
            if (latestSavedPlan) continueEditingSavedPlan(latestSavedPlan);
          }}
          onShareLatestPlan={() => {
            if (latestSavedPlan) void sharePlan(latestSavedPlan);
          }}
          onUseCurrentLocation={useCurrentLocationAsStartPoint}
          onRerollPlan={rerollPlan}
        />
      </section>

      {!homepagePresetActive && !effectiveCitySlug && !citiesLoading && (
        <section
          className={`rounded-xl border border-[var(--brand-accent)]/20 bg-[var(--brand-accent-soft)] px-4 py-3 ${
            mobileSetupOpen ? "" : "hidden sm:block"
          }`}
        >
          <div className="font-medium text-[var(--text-strong)]">Wo soll dein Tag stattfinden?</div>
          <div className="mt-0.5 text-sm text-[var(--text-muted)]">
            Wähle unten eine Stadt – PerfectDay24 erstellt deinen Plan automatisch.
          </div>
        </section>
      )}

      {!mobileSetupOpen && plannedStops.length > 0 ? (
        // Kompakte Mobile-Summary statt der Setup-Blöcke — "Ändern" klappt sie wieder auf.
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 sm:hidden">
          <div className="min-w-0 truncate text-sm text-[var(--text-strong)]">
            <span className="font-semibold">{occasionTitle}</span>
            {cityLabel !== "-" ? <span className="text-[var(--text-muted)]"> · {cityLabel}</span> : null}
            <span className="text-[var(--text-muted)]">
              {" · "}
              {new Date(`${planDate}T12:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileSetupOpen(true)}
            className="pd24-btn pd24-btn-secondary pd24-btn-sm shrink-0"
          >
            Ändern
          </button>
        </div>
      ) : null}

      <section
        className={`rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-soft)] ${
          mobileSetupOpen ? "" : "hidden sm:block"
        }`}
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:overflow-visible">
          <div className="min-w-0 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] px-3 py-2.5 lg:min-w-[150px] lg:flex-1">
            <div className="pd24-meta">
              Stadt
            </div>
            <div className="mt-1">
              <CitySearchInput
                cities={visibleCities}
                value={selectedCitySlug ?? ""}
                onChange={(slug) => {
                  setSelectedCitySlug(slug || null);
                  resetStartPointForSelectedCity();
                  resetPlan();
                }}
                placeholder={citiesLoading ? "Städte werden geladen..." : "Stadt suchen (Auto)"}
                variant="bare"
                showSelectedChip={false}
              />
            </div>
            {citiesLoadError ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--state-warning)]">
                <span>Städte konnten nicht geladen werden.</span>
                <button
                  type="button"
                  onClick={() => setCitiesReloadKey((key) => key + 1)}
                  className="font-semibold underline underline-offset-2 transition hover:text-[var(--text-strong)]"
                >
                  Erneut versuchen
                </button>
              </div>
            ) : null}
          </div>

          <div
            ref={startPointFieldRef}
            className="relative min-w-0 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] px-3 py-2.5 lg:min-w-[240px] lg:flex-[1.5]"
          >
            <label htmlFor="planner-quick-start" className="pd24-meta">
              Startpunkt
            </label>
            <input
              id="planner-quick-start"
              value={displayedStartPointLabel}
              onFocus={() => {
                setStartPointFieldActive(true);
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
                );
              }}
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
              onKeyDown={(e) => {
                if (e.key === "Escape") setStartPointFieldActive(false);
              }}
              placeholder="Hotel, Bahnhof, Adresse..."
              className="mt-1 w-full bg-transparent text-sm font-semibold text-[var(--text-strong)] outline-none placeholder:text-[var(--text-muted)]"
            />

            {startPointFieldActive &&
            startPoint.mode === "custom" &&
            (startPointSearchLoading || startPointSuggestions.length > 0 || startPointSearchError) ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-30 overflow-hidden rounded-md border border-[var(--line-subtle)] bg-white shadow-lg">
                {startPointSearchLoading ? (
                  <div className="px-3 py-2 text-sm text-[var(--text-muted)]">Suche Startpunkte...</div>
                ) : startPointSearchError ? (
                  <div className="px-3 py-2 text-sm text-[var(--state-error)]">{startPointSearchError}</div>
                ) : (
                  startPointSuggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.label}-${suggestion.lat}-${suggestion.lng}`}
                      type="button"
                      onClick={() => {
                        applyStartPointSuggestion(suggestion);
                        setStartPointFieldActive(false);
                      }}
                      className="block w-full border-b border-[var(--line-subtle)] px-3 py-2 text-left hover:bg-[var(--bg-panel)] last:border-b-0"
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

          <label className="min-w-0 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] px-3 py-2.5 lg:min-w-[125px] lg:flex-[0.8]">
            <div className="pd24-meta">
              Anlass
            </div>
            <select
              value={occasion}
              onChange={(e) => handleOccasionChange(e.target.value)}
              className="mt-1 w-full bg-transparent text-sm font-semibold text-[var(--text-strong)] outline-none"
            >
              <option value="date">Date</option>
              <option value="friends">Freunde</option>
              <option value="family">Familie</option>
              <option value="party">Party</option>
              <option value="tourism">Tourismus</option>
            </select>
          </label>

          <label className="min-w-0 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] px-3 py-2.5 lg:min-w-[145px] lg:flex-[0.85]">
            <div className="pd24-meta">
              Datum
            </div>
            <input
              type="date"
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
              className="mt-1 w-full bg-transparent text-sm font-semibold text-[var(--text-strong)] outline-none"
            />
          </label>
        </div>

        <PlannerEventCandidatesStrip
          experienceMode={experienceMode}
          occasion={occasion}
          cityLabel={cityLabel}
          planDate={planDate}
          eventCandidates={eventCandidates}
          eventPlanningMode={eventPlanningMode}
          setEventPlanningMode={setEventPlanningMode}
          selectedEventId={selectedEventId}
          setSelectedEventId={setSelectedEventId}
          resetPlan={resetPlan}
          showToast={showToast}
        />

        {manualStartFallsBackToCityCenter && selectedCity ? (
          <div className="mt-2 text-xs text-[var(--text-muted)]">
            Bis zur genauen Auswahl planen wir ab <span className="font-semibold">{selectedCityFallbackLabel}</span>.
          </div>
        ) : null}

        <div className="mt-3 flex flex-col gap-3 border-t border-[rgba(68,57,46,0.08)] pt-3 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="min-w-0 lg:flex-1">
            <div className="pd24-meta">
              Dein Plan
            </div>
            {aiPlanActive ? (
              <div className="mt-1 truncate text-sm font-semibold text-[var(--text-strong)]">
                ✨ KI-Vorschlag · {plannedStops.length} {plannedStops.length === 1 ? "Stop" : "Stops"}
              </div>
            ) : activeVariant ? (
              <div className="mt-1 truncate text-sm font-semibold text-[var(--text-strong)]">
                {activeVariant.label}
                {pinnedVariant?.variantId === activeVariant.variantId ? " · Unsere Wahl" : ""}
              </div>
            ) : (
              <div className="mt-1 text-sm font-semibold text-[var(--text-strong)]">Noch kein Plan erstellt</div>
            )}
          </div>

          {aiPlanActive ? (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-[rgba(196,137,79,0.32)] bg-[linear-gradient(90deg,rgba(255,249,241,0.85),rgba(255,253,248,0.85))] px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="pd24-kicker-warm">
                  KI-Modus aktiv
                </div>
                {aiPlanPrompt ? (
                  <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]" title={aiPlanPrompt}>
                    &bdquo;{aiPlanPrompt}&ldquo;
                    {/*
                    „{aiPlanPrompt}"
                    */}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={exitAiPlanMode}
                className="shrink-0 rounded-full border border-[var(--line-subtle)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)] transition hover:text-[var(--text-strong)]"
              >
                Standard
              </button>
            </div>
          ) : null}

          {/* Primäraktion — Route starten */}
          <button
            type="button"
            onClick={() => void startPlannerRouteRun()}
            disabled={plannedStops.length === 0}
            className="pd24-btn pd24-btn-primary w-full active:scale-[0.98] lg:w-auto lg:min-w-[220px]"
          >
            Route starten
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>

          {/* Sekundäraktion — nur ein klarer nächster Schritt */}
          <div className="flex gap-2 lg:w-auto">
            {groupEnabled ? (
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    const planToShare = selectedPlan ?? latestSavedPlan;
                    if (planToShare) {
                      await sharePlan(planToShare);
                      return;
                    }
                    // Kein gespeicherter Plan: automatisch speichern und direkt teilen —
                    // im Gruppenmodus gibt es keinen separaten Speichern-Button.
                    if (!userId) {
                      showToast("Melde dich an, um den Plan mit deiner Gruppe zu teilen.");
                      return;
                    }
                    const saved = await savePlan(false, editingPlanId ? "new_version" : "default");
                    if (saved) await sharePlan(saved);
                    else showToast("Der Plan konnte nicht gespeichert werden. Bitte versuche es erneut.");
                  })();
                }}
                disabled={plannedStops.length === 0}
                className="pd24-btn pd24-btn-secondary flex-1 active:scale-[0.98]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Link an Gruppe
              </button>
            ) : authReady && !userId ? (
              <Link
                href="/profile"
                className="pd24-btn pd24-btn-secondary flex-1 active:scale-[0.98]"
              >
                Anmelden zum Speichern
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void savePlan(false, editingPlanId ? "new_version" : "default")}
                  disabled={!authReady || !userId || saving || plannedStops.length === 0}
                  className="pd24-btn pd24-btn-secondary flex-1 active:scale-[0.98]"
                >
                  {!authReady ? "Einen Moment ..." : saving ? "Speichern..." : editingPlanId ? "Als neuen Stand speichern" : "Plan speichern"}
                </button>
                {selectedPlan ?? latestSavedPlan ? (
                  // Teilen auch ohne Gruppenmodus, sobald ein gespeicherter Plan da ist —
                  // z. B. nach dem Öffnen aus "Meine Pläne".
                  <button
                    type="button"
                    onClick={() => {
                      const planToShare = selectedPlan ?? latestSavedPlan;
                      if (planToShare) void sharePlan(planToShare);
                    }}
                    disabled={plannedStops.length === 0}
                    className="pd24-btn pd24-btn-secondary flex-1 active:scale-[0.98]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                    </svg>
                    Plan teilen
                  </button>
                ) : null}
              </>
            )}
          </div>

          {/* Premium-Export — PDF & Kalender */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handlePlanExport("pdf")}
              disabled={plannedStops.length === 0}
              className="pd24-btn pd24-btn-secondary flex-1 active:scale-[0.98]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Als PDF
              {isPremium === false ? (
                <span className="rounded-full bg-[var(--brand-warm)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">Premium</span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => handlePlanExport("ics")}
              disabled={plannedStops.length === 0}
              className="pd24-btn pd24-btn-secondary flex-1 active:scale-[0.98]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              In Kalender
              {isPremium === false ? (
                <span className="rounded-full bg-[var(--brand-warm)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">Premium</span>
              ) : null}
            </button>
          </div>

          {/* Gruppenkontext-Hinweis */}
          {groupEnabled && (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--state-success)]/20 bg-[var(--brand-accent-cloud)] px-3 py-2 text-xs text-[var(--state-success)]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span>Gruppe aktiv — &bdquo;Link an Gruppe&ldquo; kopiert den Plan als teilbaren Link für alle.</span>
            </div>
          )}

          {/* AI als prominente Sekundär-Aktion — gehört nicht in die "Weitere Aktionen"-Schublade */}
          {!aiPlanActive ? (
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[rgba(196,137,79,0.45)] bg-[linear-gradient(90deg,rgba(255,249,241,0.95),rgba(255,253,248,0.95))] px-4 py-3 text-sm font-semibold text-[var(--brand-warm-ink)] transition hover:bg-[rgba(255,249,241,1)] active:scale-[0.98] lg:w-auto lg:min-w-[190px]"
            >
              <span>Mit KI planen</span>
              <span className="rounded-full bg-[var(--brand-warm)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">Neu</span>
            </button>
          ) : null}

          {/* Weitere Optionen — bewusst sekundär */}
          <button
            type="button"
            onClick={() => setShowWeitere((v) => !v)}
            className="self-start rounded-full border border-[var(--line-subtle)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)] hover:text-[var(--text-strong)]"
          >
            {showWeitere ? "Weitere Aktionen ausblenden" : "Weitere Aktionen"}
          </button>
          <div
            className={`flex flex-wrap items-center gap-2 border-t border-[var(--line-subtle)] pt-2 ${showWeitere ? "" : "hidden"}`}
          >
            <button
              type="button"
              onClick={rerollPlan}
              disabled={plannedStops.length === 0}
              className="rounded-md border border-[var(--line-subtle)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)] disabled:opacity-60"
            >
              Anderer Vorschlag
            </button>
            <button
              type="button"
              onClick={optimizeStopOrder}
              disabled={plannedStops.length < 3}
              className="rounded-md border border-[rgba(196,137,79,0.28)] bg-[rgba(255,249,241,0.55)] px-3 py-1.5 text-xs font-medium text-[var(--brand-warm-ink)] transition hover:bg-[rgba(255,249,241,0.85)] disabled:opacity-60"
            >
              Reihenfolge optimieren
            </button>
            <button
              type="button"
              onClick={resetPlan}
              className="rounded-md border border-[var(--line-subtle)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
            >
              Plan zurücksetzen
            </button>
            <button
              type="button"
              onClick={() => void handoffPlanToRouteBuilder()}
              disabled={plannedStops.length === 0}
              className="rounded-md border border-[var(--line-subtle)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)] disabled:opacity-60"
            >
              Im Routenstudio weiterbearbeiten
            </button>
            {groupEnabled && activeVariant ? (
              <button
                type="button"
                onClick={() => setPinnedVariantId((prev) => (prev === activeVariant.variantId ? null : activeVariant.variantId))}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                  pinnedVariant?.variantId === activeVariant.variantId
                    ? "border-[var(--state-success)]/35 bg-[var(--brand-accent-cloud)] text-[var(--state-success)]"
                    : "border-[var(--line-subtle)] bg-white text-[var(--text-muted)] hover:bg-[var(--bg-panel)]"
                }`}
              >
                {pinnedVariant?.variantId === activeVariant.variantId ? "✓ Gruppenentscheidung" : "Als Gruppenentscheidung markieren"}
              </button>
            ) : null}
            {groupEnabled && (pinnedVariant ?? activeVariant) ? (
              <>
                <button
                  type="button"
                  onClick={copyPinnedChoiceSummary}
                  className="rounded-md border border-[var(--line-subtle)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
                >
                  Zusammenfassung kopieren
                </button>
                <button
                  type="button"
                  onClick={openChoiceInChat}
                  className="rounded-md border border-[var(--line-subtle)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
                >
                  Im Chat besprechen
                </button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <aside className="order-2 space-y-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pl-1">
          <PlannerMapPanel
            routeProfile={routeProfile}
            onRouteProfileChange={setRouteProfile}
            googleRouteUrl={googleRouteUrl}
            effectiveStartPointLabel={effectiveStartPoint.label || null}
            mapStops={mapStops}
            routeSummary={routeSummary}
            onRouteSummaryChange={setRouteSummary}
            plannerLoading={plannerLoading}
            fallbackSummary={fallbackSummary}
          />

          <PlannerControlsSection
        showPrefsModal={showPrefsModal}
        setShowPrefsModal={setShowPrefsModal}
        profileRequired={profileRequired}
        interests={interests}
        interestInput={interestInput}
        setInterestInput={setInterestInput}
        addInterestFromInput={addInterestFromInput}
        toggleInterest={toggleInterest}
        profileSaving={profileSaving}
        cityLabel={cityLabel}
        groupEnabled={groupEnabled}
        groupMembers={groupMembers}
        eventCandidates={eventCandidates}
        showQuickEventPicker={true}
        citiesLoading={citiesLoading}
        selectedCountryCode={selectedCountryCode}
        setSelectedCountryCode={setSelectedCountryCode}
        resetStartPointForSelectedCity={resetStartPointForSelectedCity}
        resetPlan={resetPlan}
        availableCountryCodes={availableCountryCodes}
        selectedCitySlug={selectedCitySlug}
        setSelectedCitySlug={setSelectedCitySlug}
        visibleCities={visibleCities}
        showPlannerConfig={showPlannerConfig}
        setShowPlannerConfig={setShowPlannerConfig}
        plannerAudienceLabel={plannerAudienceLabel}
        plannerSummaryLine={plannerSummaryLine}
        effectiveInterests={effectiveInterests}
        eventModesAvailable={eventModesAvailable}
        routeProfile={routeProfile}
        budget={budget}
        setBudget={setBudget}
        occasion={occasion}
        setOccasion={handleOccasionChange}
        familyAgeBand={familyAgeBand}
        setFamilyAgeBand={setFamilyAgeBand}
        experienceMode={experienceMode}
        setExperienceMode={setExperienceMode}
        planDate={planDate}
        setPlanDate={setPlanDate}
        planMode={planMode}
        setPlanMode={setPlanMode}
        stopsCount={stopsCount}
        setStopsCount={setStopsCount}
        fullDayActsAfterBreakfast={fullDayActsAfterBreakfast}
        setFullDayActsAfterBreakfast={setFullDayActsAfterBreakfast}
        fullDayActsAfterLunch={fullDayActsAfterLunch}
        setFullDayActsAfterLunch={setFullDayActsAfterLunch}
        sortMode={sortMode}
        setSortMode={setSortMode}
        setRouteProfile={setRouteProfile}
        setGroupEnabled={setGroupEnabled}
        evaluationMode={evaluationMode}
        setEvaluationMode={setEvaluationMode}
        startPoint={startPoint}
        setStartPoint={setStartPoint}
        updateStartPointType={updateStartPointType}
        startPointSuggestions={startPointSuggestions}
        startPointSearchLoading={startPointSearchLoading}
        startPointSearchError={startPointSearchError}
        applyStartPointSuggestion={applyStartPointSuggestion}
        suggestedCustomStartPoint={suggestedCustomStartPoint}
        manualStartFallsBackToCityCenter={manualStartFallsBackToCityCenter}
        selectedCity={selectedCity}
        selectedCityFallbackLabel={selectedCityFallbackLabel}
        shouldUseCurrentLocationAsOrigin={shouldUseCurrentLocationAsOrigin}
        useCurrentLocationAsStartPoint={useCurrentLocationAsStartPoint}
        clearStartPoint={clearStartPoint}
        effectiveStartPoint={effectiveStartPoint}
        userLat={userLat}
        userLng={userLng}
        radiusKm={radiusKm}
        setRadiusKm={setRadiusKm}
        geoError={geoError}
        groupPlanningSignals={groupPlanningSignals}
        activeGroupLabel={activeGroupLabel}
        friendsLoading={friendsLoading}
        friendSuggestions={friendSuggestions}
        addFriendSuggestionToGroup={addFriendSuggestionToGroup}
        memberName={memberName}
        setMemberName={setMemberName}
        memberProfileQuery={memberProfileQuery}
        setMemberProfileQuery={setMemberProfileQuery}
        setMemberProfileError={setMemberProfileError}
        memberInterestInput={memberInterestInput}
        setMemberInterestInput={setMemberInterestInput}
        memberProfileSearchLoading={memberProfileSearchLoading}
        memberProfileSuggestions={memberProfileSuggestions}
        selectMemberProfileSuggestion={selectMemberProfileSuggestion}
        addGroupMemberFromProfile={addGroupMemberFromProfile}
        memberProfileLoading={memberProfileLoading}
        addManualGroupMember={addManualGroupMember}
        clearGroup={clearGroup}
        memberProfileError={memberProfileError}
        removeGroupMember={removeGroupMember}
        timingWarnings={timingWarnings}
        eventPlanningMode={eventPlanningMode}
        setEventPlanningMode={setEventPlanningMode}
        selectedEventId={selectedEventId}
        setSelectedEventId={setSelectedEventId}
        selectedEvent={selectedEvent}
        selectedEventIndex={selectedEventIndex}
        showToast={showToast}
        eventProviderSummary={eventProviderSummary}
        eventCategorySummary={eventCategorySummary}
        affiliateResolution={affiliateResolution}
        userId={userId}
        effectiveCitySlug={effectiveCitySlug}
        eventDebugRows={eventDebugRows}
        eventDebugGroupCounts={eventDebugGroupCounts}
            monetizationDebug={monetizationDebug}
          />

        </aside>

        <section id="planner-results" className="order-1 min-w-0 scroll-mt-24 space-y-4">
          <PlannerVariantPanel
        activeVariant={activeVariant}
        pinnedVariant={pinnedVariant}
        leadingVariant={leadingVariant}
        currentShareChoiceSummary={currentShareChoiceSummary}
        plannerVoteMoment={plannerVoteMoment}
        shareVoteMoment={shareVoteMoment}
        plannerData={plannerData}
        selectedVariantId={selectedVariantId}
        variantVotes={variantVotes}
        reactionParticipants={reactionParticipants}
        majorityThreshold={majorityThreshold}
        groupEnabled={groupEnabled}
        occasion={occasion}
        occasionFlow={occasionFlow}
        expandedText={expandedText}
        relaxedText={relaxedText}
        plannerError={plannerError}
        authReady={authReady}
        userId={userId}
        authLoading={authLoading}
        onRerollPlan={rerollPlan}
        onResetPlan={resetPlan}
        onTogglePinnedVariant={(variantId) =>
          setPinnedVariantId((prev) => (prev === variantId ? null : variantId))
        }
        onCopyPinnedChoiceSummary={copyPinnedChoiceSummary}
        onOpenChoiceInChat={openChoiceInChat}
        onOpenReminderInChat={openReminderInChat}
        onContinueAsGuest={continueAsGuest}
        onSelectVariant={setSelectedVariantId}
        onToggleVariantReaction={toggleVariantReaction}
        showPlanHeader={false}
      />

      <PlannerActionPanel
          plannerTemplateLoadedLabel={plannerTemplateLoadedLabel}
          plannerTemplateSourceSlug={plannerTemplateSourceSlug}
          plannerTemplateInterests={plannerTemplateInterests}
          editingPlanId={editingPlanId}
          selectedPlan={selectedPlan}
          plannedStopsCount={plannedStops.length}
          groupEnabled={groupEnabled}
          groupPlanningSignals={groupPlanningSignals}
          groupPlanSummary={groupPlanSummary}
        />
      <div ref={planOutputRef} className="scroll-mt-20">
      <PlannerOutputSection
        routeProfile={routeProfile}
        plannerLoading={plannerLoading}
        plannerError={plannerError}
        plannerErrorKind={plannerErrorKind}
        onRetryGeneration={retryPlannerGeneration}
        resultsCount={results.length}
        plannedStops={plannedStops}
        occasion={occasion}
        plannerData={plannerData}
        activeVariantLabel={activeVariant?.label ?? null}
        activeVariantReason={activeVariant?.reason ?? null}
        draggedStopPosition={draggedStopPosition}
        groupEnabled={groupEnabled}
        groupMembersCount={groupMembers.length}
        affiliateResolution={affiliateResolution}
        userId={userId}
        effectiveCitySlug={effectiveCitySlug}
        onMovePlannedStop={movePlannedStop}
        onSetDraggedStopPosition={setDraggedStopPosition}
        onBumpStop={bumpStop}
        plans={plans}
        selectedPlan={selectedPlan}
        onSelectPlan={setSelectedPlan}
        onSharePlan={sharePlan}
        onSendFinalPlanToFriends={sendFinalPlanToFriends}
        onOpenPlanGroupChat={openPlanGroupChat}
        onContinueEditingSavedPlan={continueEditingSavedPlan}
        onResolveEditSuggestion={resolveEditSuggestion}
        planChoiceReactions={planChoiceReactions}
        planEditSuggestions={planEditSuggestions}
      />
      </div>
        </section>
      </div>

      <UpgradeModal
        open={showExportUpgrade}
        used={usedThisMonth}
        limit={3}
        onClose={() => setShowExportUpgrade(false)}
      />

      <AiPlanModal
        open={showAiModal}
        citySlug={effectiveCitySlug}
        cityLabel={selectedCity?.name ?? null}
        planDate={planDate}
        budget={budget}
        occasion={occasion}
        startPointLabel={effectiveStartPoint?.label ?? null}
        startPointLat={typeof effectiveStartPoint?.lat === "number" ? effectiveStartPoint.lat : null}
        startPointLng={typeof effectiveStartPoint?.lng === "number" ? effectiveStartPoint.lng : null}
        interests={interests}
        stopsCount={stopsCount}
        familyAgeBand={occasion === "family" ? familyAgeBand : null}
        groupEnabled={groupEnabled}
        groupSize={groupEnabled ? groupMembers.length + 1 : undefined}
        onClose={() => setShowAiModal(false)}
        onApply={applyAiPlan}
        onOpen={() => {
          if (effectiveCitySlug) {
            void trackMonetizationEvent({
              eventType: "ai_plan_open",
              userId,
              citySlug: effectiveCitySlug,
              surface: "planner",
              metadata: {},
            });
          }
        }}
        onGenerated={(stopCount) => {
          if (effectiveCitySlug) {
            void trackMonetizationEvent({
              eventType: "ai_plan_generated",
              userId,
              citySlug: effectiveCitySlug,
              surface: "planner",
              metadata: { stopCount },
            });
          }
        }}
      />

      {plannedStops.length > 0 ? (
        <div className="fixed bottom-16 left-0 right-0 z-[1200] sm:hidden pb-safe">
          <div className="mx-3 mb-2 rounded-2xl border border-[rgba(68,57,46,0.08)] bg-white/96 p-2 shadow-[0_16px_40px_rgba(15,23,42,0.18)] backdrop-blur">
            <button
              type="button"
              onClick={() => void startPlannerRouteRun()}
              className="pd24-btn pd24-btn-primary w-full active:scale-[0.98]"
            >
              Route starten
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      {/* Toast: dauerhaft gerenderte Live-Region — nur der Inhalt wechselt,
          damit Screenreader die Meldung zuverlässig ansagen. */}
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[var(--text-strong)] px-4 py-2 text-sm text-white shadow-lg transition-opacity duration-200 ${
          toast ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {toast}
      </div>

      {/* Visually-hidden Statuszeile für Plan-Generierung und Fehler */}
      <div role="status" aria-live="polite" className="sr-only">
        {plannerLoading
          ? "Dein Plan wird zusammengestellt."
          : plannerError
            ? plannerError
            : plannedStops.length > 0
              ? `Plan bereit: ${plannedStops.length} ${plannedStops.length === 1 ? "Stop" : "Stops"}.`
              : ""}
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="space-y-6">
          <section className="rounded-[var(--radius-hero)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-6 py-7 shadow-[var(--shadow-large)] sm:px-8">
            {/* Diese Ersatzansicht ist das, was Crawler ohne JavaScript sehen:
                Die Planner-Oberflaeche ist eine Client-Komponente mit
                useSearchParams und wird deshalb nicht vorgerendert. Ueberschrift
                und Einleitung muessen hier stehen, sonst liefert die Seite im
                SSR-HTML weder h1 noch Text. */}
            <h1 className="max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-[var(--text-strong)] sm:text-3xl">
              Tagesplan erstellen
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
              Stadt, Anlass und Zeitrahmen angeben — PerfectDay24 baut daraus einen
              fertigen Ablauf aus echten Orten, aktuellen Events und den Wegen dazwischen.
            </p>
            <div className="mt-4 text-sm text-[var(--text-muted)]">Planner wird geladen...</div>
          </section>
        </main>
      }
    >
      <PlannerPageContent />
    </Suspense>
  );
}

