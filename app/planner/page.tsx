"use client";

import { useSearchParams } from "next/navigation";
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
import { resolvePublicAffiliateLinksClient } from "@/lib/monetization/public-affiliate-client";
import { shouldShowInternalMonetization } from "@/lib/monetization/debug";
import {
  emptyPublicAffiliateResolution,
  type PublicAffiliateResolution,
} from "@/lib/monetization/affiliate-shared";

import type { RouteSummary } from "@/components/PlanMap";
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
  PlannerSaveMode,
  SavedPlanRow,
} from "./types";
import type {
  EvaluationMode,
  EventPlanningMode,
  ExperienceMode,
  GroupMember,
  PlanMode,
  PlannerRequest,
  RouteProfile,
} from "@/lib/planner";
import {
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
  const [variationSeed, setVariationSeed] = useState(0);

  const [cities, setCities] = useState<CityRow[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>("all");
  const [selectedCitySlug, setSelectedCitySlug] = useState<string | null>(null);

  const [budget, setBudget] = useState("medium");
  const [occasion, setOccasion] = useState("date");
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>("classic");
  const [planDate, setPlanDate] = useState(todayDateInputValue);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventPlanningMode, setEventPlanningMode] = useState<EventPlanningMode>("auto");
  const [planMode, setPlanMode] = useState<PlanMode>("fullday");
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

  const [stopOffsets, setStopOffsets] = useState<number[]>([]);

  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [draggedStopPosition, setDraggedStopPosition] = useState<number | null>(null);
  const [affiliateResolution, setAffiliateResolution] = useState<PublicAffiliateResolution>(
    () => emptyPublicAffiliateResolution()
  );

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

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
    const requestedExperienceMode = searchParams.get("experienceMode") ?? searchParams.get("mode");
    const requestedBudget = searchParams.get("budget");
    const requestedPlanDate = searchParams.get("planDate");
    const requestedInterests = searchParams.get("interests");

    const signature = [
      requestedCitySlug ?? "",
      requestedOccasion ?? "",
      requestedExperienceMode ?? "",
      requestedBudget ?? "",
      requestedPlanDate ?? "",
      requestedInterests ?? "",
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

    setSelectedEventId(null);
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
          return;
        }
        setCities(
          dedupeCitiesByCanonicalSlug((data as CityRow[]) ?? []).filter((city) =>
            isPlannerSupportedCitySlug(city.slug)
          )
        );
      } finally {
        setCitiesLoading(false);
      }
    })();
  }, [mounted]);

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

  useEffect(() => {
    if (!mounted) return;

    const template = consumePlannerRouteTemplate();
    if (!template) return;

    if (template.citySlug) setSelectedCitySlug(canonicalCitySlug(template.citySlug));
    if (template.occasion) setOccasion(template.occasion);
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
  }, [mounted, setStartPoint]);

  function bumpStop(idx: number) {
    setStopOffsets((prev) => {
      const copy = [...prev];
      copy[idx] = (copy[idx] ?? 0) + 1;
      return copy;
    });
  }

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

  function continueEditingSavedPlan(plan: SavedPlanRow) {
    const filters = (plan.filters ?? {}) as Record<string, unknown>;
    const startPointFilter =
      filters.startPoint && typeof filters.startPoint === "object"
        ? (filters.startPoint as Record<string, unknown>)
        : null;

    if (typeof filters.budget === "string") setBudget(filters.budget);
    if (typeof filters.occasion === "string") setOccasion(filters.occasion);
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
    setPlannerData(null);
    setRouteSummary(null);
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
    showToast("Plan in den Planner übernommen.");
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
    startPoint.mode,
    startPoint.type,
    effectiveStartPoint.label,
    effectiveStartPoint.lat,
    effectiveStartPoint.lng,
    planMode,
    radiusKm,
    budget,
    occasion,
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
    plannerData,
    setPlannerData,
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
    toggleVariantReaction,
  } = usePlannerGeneration({
    mounted,
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
  const {
    plans,
    planChoiceReactions,
    planEditSuggestions,
    saving,
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
    if (!requestedResume || !requestedPlanId || !plans.length) return;
    if (resumedPlanId === requestedPlanId) return;
    const match = plans.find((plan) => plan.id === requestedPlanId);
    if (!match) return;
    continueEditingSavedPlan(match);
    setResumedPlanId(requestedPlanId);
  }, [requestedResume, requestedPlanId, plans, resumedPlanId]);

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

  function handoffPlanToRouteBuilder() {
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
      })),
    });

    window.location.href = "/routes";
  }

  function startPlannerRouteRun() {
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

    window.location.href = "/run";
  }

  const relaxedText =
    activeLevel === "strict"
      ? null
      : activeLevel === "relax_daytime"
      ? "Keine exakten Treffer - Tageszeit wurde gelockert, um mehr Vorschlaege zu finden."
      : activeLevel === "relax_budget"
      ? "Keine exakten Treffer - Budget und Tageszeit wurden gelockert, um mehr Vorschlaege zu finden."
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
    experienceModeLabel(experienceMode, occasion),
    budgetLabel(budget),
    plannerDateLabel(planDate),
  ].join(" · ");
  const homepagePresetActive =
    Boolean(plannerTemplateLoadedLabel) ||
    [
      "citySlug",
      "city",
      "occasion",
      "experienceMode",
      "mode",
      "budget",
      "planDate",
      "interests",
    ].some((key) => searchParams.has(key));
  const quickExperienceOptions = eventModesAvailable
    ? experienceOptionsForOccasion(occasion)
    : experienceOptionsForOccasion(occasion).filter(
        (option) => option.value !== "event_visit" && option.value !== "market_festival"
      );
  const displayedStartPointLabel =
    startPoint.mode === "current_location" && !shouldUseCurrentLocationAsOrigin
      ? effectiveStartPoint.label
      : startPoint.label;

  return (
    <main className="space-y-4">
      <section className="relative overflow-hidden rounded-lg border border-[var(--line-subtle)] bg-white px-4 py-4 shadow-[var(--shadow-soft)] sm:px-5">
        <div className="pointer-events-none absolute right-[-4rem] top-[-4rem] h-40 w-40 rounded-full bg-[rgba(90,118,136,0.14)] blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-3rem] left-[16%] h-32 w-32 rounded-full bg-[rgba(124,144,160,0.12)] blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-2 flex flex-wrap gap-2">
              <span className="warm-chip rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
                Real local planning
              </span>
              <span className="rounded-full border border-[var(--line-subtle)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                {cityLabel}
              </span>
              <span className="rounded-full border border-[var(--line-subtle)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                {experienceModeLabel(experienceMode, occasion)}
              </span>
            </div>
            <h1 className="max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-[var(--text-strong)] sm:text-3xl">
              Planner
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
              PerfectDay24 verbindet Stadtwissen, echte Events, Gruppenentscheidungen und sinnvolle Wegezeiten
              zu einem Plan, der nicht nach Formular aussieht, sondern nach einem richtig guten Tag.
            </p>
          </div>

          <div className="w-full max-w-md">
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
              onOpenConfig={() => setShowPlannerConfig(true)}
              onUseCurrentLocation={useCurrentLocationAsStartPoint}
              onRerollPlan={rerollPlan}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--line-subtle)] bg-white p-3 shadow-[var(--shadow-soft)]">
        <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:overflow-visible">
          <label className="min-w-0 rounded-md border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 lg:min-w-[150px] lg:flex-1">
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
              className="mt-1 w-full bg-transparent text-sm font-semibold text-[var(--text-strong)] outline-none"
              disabled={citiesLoading}
            >
              <option value="__auto__">Auto</option>
              {visibleCities.map((city) => (
                <option key={city.slug} value={city.slug}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>

          <div className="relative min-w-0 rounded-md border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 lg:min-w-[240px] lg:flex-[1.5]">
            <label htmlFor="planner-quick-start" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Startpunkt
            </label>
            <input
              id="planner-quick-start"
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
              placeholder="Hotel, Bahnhof, Adresse..."
              className="mt-1 w-full bg-transparent text-sm font-semibold text-[var(--text-strong)] outline-none placeholder:text-[var(--text-muted)]"
            />

            {startPoint.mode === "custom" &&
            (startPointSearchLoading || startPointSuggestions.length > 0 || startPointSearchError) ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-30 overflow-hidden rounded-md border border-[var(--line-subtle)] bg-white shadow-lg">
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

          <label className="min-w-0 rounded-md border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 lg:min-w-[125px] lg:flex-[0.8]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Anlass
            </div>
            <select
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              className="mt-1 w-full bg-transparent text-sm font-semibold text-[var(--text-strong)] outline-none"
            >
              <option value="date">Date</option>
              <option value="friends">Freunde</option>
              <option value="family">Familie</option>
              <option value="party">Party</option>
              <option value="tourism">Tourismus</option>
            </select>
          </label>

          <label className="min-w-0 rounded-md border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 lg:min-w-[160px] lg:flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Fokus
            </div>
            <select
              data-testid="planner-quick-experience-mode"
              value={experienceMode}
              onChange={(e) => setExperienceMode(e.target.value as ExperienceMode)}
              className="mt-1 w-full bg-transparent text-sm font-semibold text-[var(--text-strong)] outline-none"
            >
              {quickExperienceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0 rounded-md border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 lg:min-w-[145px] lg:flex-[0.85]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
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

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
          <div>
            {manualStartFallsBackToCityCenter && selectedCity ? (
              <>
                Bis zur genauen Auswahl planen wir ab <span className="font-semibold">{selectedCityFallbackLabel}</span>.
              </>
            ) : (
              <>
                Start: <span className="font-semibold">{effectiveStartPoint.label || "-"}</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={useCurrentLocationAsStartPoint}
            className="rounded-md border border-[var(--line-subtle)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)]"
          >
            Aktueller Standort
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-3 border-t border-[rgba(68,57,46,0.08)] pt-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Dein Plan
            </div>
            {activeVariant ? (
              <div className="mt-1 truncate text-sm font-semibold text-[var(--text-strong)]">
                {activeVariant.label}
                {typeof activeVariant.totalScore === "number" ? ` | Score ${activeVariant.totalScore}` : ""}
                {pinnedVariant?.variantId === activeVariant.variantId ? " | Unsere Wahl" : ""}
              </div>
            ) : (
              <div className="mt-1 text-sm font-semibold text-[var(--text-strong)]">Noch kein Plan erstellt</div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startPlannerRouteRun}
              disabled={plannedStops.length === 0}
              className="rounded-md bg-[var(--state-success)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              Route Starten
            </button>
            <button
              type="button"
              onClick={rerollPlan}
              className="rounded-md bg-[var(--text-strong)] px-3 py-1.5 text-xs font-medium text-white"
            >
              neu generieren
            </button>
            <button
              type="button"
              onClick={() => void savePlan(false, editingPlanId ? "new_version" : "default")}
              disabled={!authReady || !userId || saving || plannedStops.length === 0}
              className="rounded-md border border-[var(--line-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] disabled:opacity-60"
            >
              {!authReady
                ? "Auth..."
                : !userId
                  ? "Login noetig"
                  : saving
                    ? "Speichern..."
                    : editingPlanId
                      ? "Als neuen Stand speichern"
                      : "Plan speichern"}
            </button>
            <button type="button" onClick={resetPlan} className="rounded-md border px-3 py-1.5 text-xs">
              Plan zuruecksetzen
            </button>
            <button
              type="button"
              onClick={handoffPlanToRouteBuilder}
              disabled={plannedStops.length === 0}
              className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-60"
            >
              Als Creator-Route vorbereiten
            </button>
            {groupEnabled && activeVariant ? (
              <button
                type="button"
                onClick={() => setPinnedVariantId((prev) => (prev === activeVariant.variantId ? null : activeVariant.variantId))}
                className={`rounded-md border px-3 py-1.5 text-xs ${
                  pinnedVariant?.variantId === activeVariant.variantId
                    ? "border-[var(--state-success)]/35 bg-[var(--brand-accent-cloud)] text-[var(--state-success)]"
                    : ""
                }`}
              >
                {pinnedVariant?.variantId === activeVariant.variantId ? "Unsere Wahl" : "Als Wahl markieren"}
              </button>
            ) : null}
            {groupEnabled && (pinnedVariant ?? activeVariant) ? (
              <button type="button" onClick={copyPinnedChoiceSummary} className="rounded-md border px-3 py-1.5 text-xs">
                Wahltext kopieren
              </button>
            ) : null}
            {groupEnabled && (pinnedVariant ?? activeVariant) ? (
              <button type="button" onClick={openChoiceInChat} className="rounded-md border px-3 py-1.5 text-xs">
                Chat vorbereiten
              </button>
            ) : null}
            {!userId && authReady ? (
              <button
                type="button"
                onClick={() => void continueAsGuest()}
                disabled={authLoading}
                className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-60"
              >
                {authLoading ? "Starte Gast..." : "Als Gast fortfahren"}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)] xl:items-start">
        <aside className="space-y-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pr-1">
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
        setOccasion={setOccasion}
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

        <section id="planner-results" className="min-w-0 scroll-mt-24 space-y-4">
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
      <PlannerOutputSection
        routeProfile={routeProfile}
        onRouteProfileChange={setRouteProfile}
        googleRouteUrl={googleRouteUrl}
        effectiveStartPointLabel={effectiveStartPoint.label || null}
        mapStops={mapStops}
        routeSummary={routeSummary}
        onRouteSummaryChange={setRouteSummary}
        plannerLoading={plannerLoading}
        plannerError={plannerError}
        fallbackSummary={fallbackSummary}
        resultsCount={results.length}
        plannedStops={plannedStops}
        occasion={occasion}
        plannerData={plannerData}
        activeVariantLabel={activeVariant?.label ?? null}
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
        </section>
      </div>

      {toast ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[var(--text-strong)] text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      ) : null}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="space-y-6">
          <section className="rounded-[32px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-6 py-7 shadow-[var(--shadow-large)] sm:px-8">
            <div className="text-sm text-[var(--text-muted)]">Planner wird geladen...</div>
          </section>
        </main>
      }
    >
      <PlannerPageContent />
    </Suspense>
  );
}



