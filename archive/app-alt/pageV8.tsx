"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";

import type { RouteSummary } from "@/components/PlanMap";
import type {
  GroupMember,
  LocationRow,
  PlanMode,
  PlannedStop,
  StartPointType,
} from "@/lib/planner";
import {
  generatePlan,
  haversineKm,
  mergeInterests,
  norm,
  timeBudgetForMode,
} from "@/lib/planner";

const PlanMap = dynamic(() => import("@/components/PlanMap").then((m) => m.default), {
  ssr: false,
});

type StartPointMode = "current_location" | "custom";

type StartPoint = {
  mode: StartPointMode;
  type: StartPointType;
  label: string;
  lat: number | null;
  lng: number | null;
};

type CityRow = {
  slug: string;
  name: string;
  country_code: string | null;
  center_lat: number | null;
  center_lng: number | null;
  population: number | null;
  is_active: boolean | null;
};

type SavedPlanRow = {
  id: string;
  title: string | null;
  created_at: string;
  filters: any;
  radius_km: number;
  effective_radius_km: number | null;
  sort_mode: string;
  active_level: string | null;
  slots: any;
  share_token?: string | null;
  ai_description?: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseNullableNumber(v: string) {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function generateShareToken(len = 18) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function buildGoogleMapsDirUrl(points: Array<{ lat: number; lng: number }>, mode: "foot" | "car") {
  if (points.length < 2) return null;

  const origin = `${points[0].lat},${points[0].lng}`;
  const destination = `${points[points.length - 1].lat},${points[points.length - 1].lng}`;

  const waypoints =
    points.length > 2
      ? points
          .slice(1, -1)
          .map((p) => `${p.lat},${p.lng}`)
          .join("|")
      : "";

  const travelmode = mode === "foot" ? "walking" : "driving";

  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("travelmode", travelmode);
  if (waypoints) url.searchParams.set("waypoints", waypoints);

  return url.toString();
}

export default function Home() {
  const [mounted, setMounted] = useState(false);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [cities, setCities] = useState<CityRow[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [selectedCitySlug, setSelectedCitySlug] = useState<string | null>(null);
  const [autoCitySlug, setAutoCitySlug] = useState<string | null>(null);

  const [budget, setBudget] = useState("medium");
  const [occasion, setOccasion] = useState("date");
  const [planMode, setPlanMode] = useState<PlanMode>("fullday");
  const [stopsCount, setStopsCount] = useState(3);

  const [fullDayActsAfterBreakfast, setFullDayActsAfterBreakfast] = useState(1);
  const [fullDayActsAfterLunch, setFullDayActsAfterLunch] = useState(1);

  const [radiusKm, setRadiusKm] = useState(10);
  const [sortMode, setSortMode] = useState<"match" | "distance">("match");

  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  const [routeProfile, setRouteProfile] = useState<"foot" | "car">("foot");
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);

  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const [showPrefsModal, setShowPrefsModal] = useState(false);

  const [groupEnabled, setGroupEnabled] = useState(false);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [memberName, setMemberName] = useState("");
  const [memberInterestInput, setMemberInterestInput] = useState("");

  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [startPoint, setStartPoint] = useState<StartPoint>({
    mode: "current_location",
    type: "address",
    label: "",
    lat: null,
    lng: null,
  });

  const [stopOffsets, setStopOffsets] = useState<number[]>([]);

  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [plans, setPlans] = useState<SavedPlanRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [planTitle, setPlanTitle] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<SavedPlanRow | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    try {
      const v = localStorage.getItem("pd24_route_profile");
      if (v === "foot" || v === "car") setRouteProfile(v);
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
      const v = localStorage.getItem("pd24_city_slug");
      if (v) {
        if (v === "__auto__") setSelectedCitySlug(null);
        else setSelectedCitySlug(v);
      } else {
        setSelectedCitySlug(null);
      }
    } catch {}
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem("pd24_city_slug", selectedCitySlug ? selectedCitySlug : "__auto__");
    } catch {}
  }, [mounted, selectedCitySlug]);

  useEffect(() => {
    if (!mounted) return;
    try {
      const raw = localStorage.getItem("pd24_start_point");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setStartPoint((prev) => ({
          ...prev,
          mode: parsed.mode === "custom" ? "custom" : "current_location",
          type:
            parsed.type === "hotel" ||
            parsed.type === "station" ||
            parsed.type === "airport" ||
            parsed.type === "other"
              ? parsed.type
              : "address",
          label: typeof parsed.label === "string" ? parsed.label : "",
          lat: typeof parsed.lat === "number" ? parsed.lat : null,
          lng: typeof parsed.lng === "number" ? parsed.lng : null,
        }));
      }
    } catch {}
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem("pd24_start_point", JSON.stringify(startPoint));
    } catch {}
  }, [mounted, startPoint]);

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

        if (!s?.session) {
          const { data: a, error: aErr } = await supabase.auth.signInAnonymously();
          if (aErr) {
            console.error("Anonymous Login fehlgeschlagen:", aErr);
            if (!isActive) return;
            setUserId(null);
            setAuthReady(true);
            return;
          }
          if (!isActive) return;
          setUserId(a.user?.id ?? null);
          setAuthReady(true);
        } else {
          if (!isActive) return;
          setUserId(s.session.user.id);
          setAuthReady(true);
        }
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
        setCities((data as CityRow[]) ?? []);
      } finally {
        setCitiesLoading(false);
      }
    })();
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    if (!navigator.geolocation) {
      setGeoError("Geolocation wird von diesem Browser nicht unterstützt.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
      },
      (err) => setGeoError(err.message || "Standort konnte nicht ermittelt werden."),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, [mounted]);

  useEffect(() => {
    if (!cities.length) return;
    if (userLat == null || userLng == null) return;

    let bestSlug: string | null = null;
    let bestD = Number.POSITIVE_INFINITY;

    for (const c of cities) {
      if (typeof c.center_lat !== "number" || typeof c.center_lng !== "number") continue;
      const d = haversineKm(userLat, userLng, c.center_lat, c.center_lng);
      if (d < bestD) {
        bestD = d;
        bestSlug = c.slug;
      }
    }

    setAutoCitySlug(bestSlug);
  }, [cities, userLat, userLng]);

  const effectiveCitySlug = useMemo(() => {
    return selectedCitySlug ?? autoCitySlug ?? (cities[0]?.slug ?? null);
  }, [selectedCitySlug, autoCitySlug, cities]);

  const selectedCity = useMemo(
    () => cities.find((c) => c.slug === effectiveCitySlug) ?? null,
    [cities, effectiveCitySlug]
  );

  const effectiveStartPoint = useMemo<StartPoint>(() => {
    if (startPoint.mode === "custom" && startPoint.lat != null && startPoint.lng != null) {
      return {
        mode: "custom",
        type: startPoint.type,
        label: startPoint.label.trim() || "Manueller Startpunkt",
        lat: startPoint.lat,
        lng: startPoint.lng,
      };
    }

    if (userLat != null && userLng != null) {
      return {
        mode: "current_location",
        type: "address",
        label: "Aktueller Standort",
        lat: userLat,
        lng: userLng,
      };
    }

    if (selectedCity?.center_lat != null && selectedCity?.center_lng != null) {
      return {
        mode: "custom",
        type: "address",
        label: `${selectedCity.name} Zentrum`,
        lat: selectedCity.center_lat,
        lng: selectedCity.center_lng,
      };
    }

    return {
      mode: startPoint.mode,
      type: startPoint.type,
      label: startPoint.label || "Kein Startpunkt",
      lat: null,
      lng: null,
    };
  }, [startPoint, userLat, userLng, selectedCity]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let q = supabase
          .from("locations")
          .select(`
            id,
            name,
            type,
            budget,
            occasion,
            daytime,
            category,
            meal,
            manual_category,
            manual_meal,
            lat,
            lng,
            reservation_url,
            duration_min,
            tags,
            city_slug
          `)
          .limit(4000);

        if (effectiveCitySlug) q = q.eq("city_slug", effectiveCitySlug);

        const { data, error } = await q;
        if (error) {
          console.error("Supabase Fehler:", error);
          setLocations([]);
          setLoading(false);
          return;
        }
        setLocations((data as LocationRow[]) ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [effectiveCitySlug]);

  useEffect(() => {
    if (!authReady || !userId) return;

    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, interests")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Profile load error:", error);
        setShowPrefsModal(true);
        return;
      }

      const arr = Array.isArray((data as any)?.interests) ? (data as any).interests : [];
      const clean = arr.map((x: any) => norm(String(x))).filter(Boolean);
      setInterests(clean);

      if (!clean.length) setShowPrefsModal(true);
    })();
  }, [authReady, userId]);

  async function saveProfileInterests(next: string[]) {
    if (!authReady || !userId) return;
    setProfileSaving(true);
    try {
      const clean = next.map((x) => norm(x)).filter(Boolean);
      const uniq = Array.from(new Set(clean)).slice(0, 12);
      setInterests(uniq);

      const { error } = await supabase.from("profiles").upsert(
        { user_id: userId, interests: uniq },
        { onConflict: "user_id" }
      );

      if (error) console.error("Profile upsert error:", error);
    } finally {
      setProfileSaving(false);
    }
  }

  function addInterestFromInput() {
    const v = norm(interestInput);
    if (!v) return;
    const next = Array.from(new Set([...interests, v]));
    setInterestInput("");
    saveProfileInterests(next);
  }

  function toggleInterest(tag: string) {
    const t = norm(tag);
    const has = interests.includes(t);
    const next = has ? interests.filter((x) => x !== t) : [...interests, t];
    saveProfileInterests(next);
  }

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
  }

  async function loadPlans() {
    if (!authReady) return;

    setLoadingPlans(true);
    try {
      let q = supabase.from("plans").select("*").order("created_at", { ascending: false }).limit(20);
      if (userId) q = q.eq("user_id", userId);

      const { data, error } = await q;
      if (error) {
        console.error("Load Plans Fehler:", error);
        setPlans([]);
        return;
      }
      setPlans((data as SavedPlanRow[]) ?? []);
    } finally {
      setLoadingPlans(false);
    }
  }

  useEffect(() => {
    if (!authReady) return;
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, userId]);

  const plannerRequest = useMemo(() => {
    return {
      citySlug: effectiveCitySlug,
      startPoint: {
        type: startPoint.mode === "current_location" ? "current_location" : startPoint.type,
        label: effectiveStartPoint.label,
        lat: effectiveStartPoint.lat,
        lng: effectiveStartPoint.lng,
      },
      planMode,
      radiusKm,
      budget: budget as "low" | "medium" | "high" | "free",
      occasion: occasion as "date" | "friends" | "family" | "party" | "tourism",
      interests,
      group: {
        enabled: groupEnabled,
        members: groupMembers,
      },
      fullDayActsAfterBreakfast,
      fullDayActsAfterLunch,
      stopsCount,
      sortMode,
    };
  }, [
    effectiveCitySlug,
    startPoint.mode,
    startPoint.type,
    effectiveStartPoint,
    planMode,
    radiusKm,
    budget,
    occasion,
    interests,
    groupEnabled,
    groupMembers,
    fullDayActsAfterBreakfast,
    fullDayActsAfterLunch,
    stopsCount,
    sortMode,
  ]);

  const plannerOutput = useMemo(() => {
    return generatePlan({
      request: plannerRequest,
      locations,
      stopOffsets,
    });
  }, [plannerRequest, locations, stopOffsets]);

  const planningContext = plannerOutput.context;
  const results = plannerOutput.results;
  const activeLevel = plannerOutput.activeLevel;
  const effectiveRadiusKm = plannerOutput.effectiveRadiusKm;
  const plannedStops: PlannedStop[] = plannerOutput.plannedStops;
  const fallbackSummary = plannerOutput.fallbackSummary;

  const mapStops = useMemo(() => {
    const pts: Array<{ label: string; name: string; lat: number; lng: number }> = [];

    if (effectiveStartPoint.lat != null && effectiveStartPoint.lng != null) {
      pts.push({
        label: "Start",
        name: effectiveStartPoint.label || "Startpunkt",
        lat: effectiveStartPoint.lat,
        lng: effectiveStartPoint.lng,
      });
    }

    for (const s of plannedStops) {
      if (s.item?.lat != null && s.item?.lng != null) {
        pts.push({
          label: s.label,
          name: s.item?.name ?? "Location",
          lat: Number(s.item.lat),
          lng: Number(s.item.lng),
        });
      }
    }

    return pts;
  }, [plannedStops, effectiveStartPoint]);

  const googleRouteUrl = useMemo(() => {
    return buildGoogleMapsDirUrl(
      mapStops.map((p) => ({ lat: p.lat, lng: p.lng })),
      routeProfile
    );
  }, [mapStops, routeProfile]);

  async function generateAIText() {
    try {
      setAiLoading(true);
      setAiText(null);

      const payloadStops = plannedStops.map((s) => ({
        index: s.index,
        label: s.label,
        hint: s.hint,
        durationMin: s.durationMin,
        travelMinFromPrev: s.travelMinFromPrev,
        reasons: s.reasons ?? [],
        location: s.item
          ? {
              id: s.item.id,
              name: s.item.name,
              type: s.item.type,
              duration_min: s.item.duration_min ?? null,
              reservation_url: s.item.reservation_url ?? null,
              lat: s.item.lat ?? null,
              lng: s.item.lng ?? null,
              distanceKm: s.item.distanceFromOriginKm ?? null,
              baseScore: s.item.score ?? 0,
              prefBoost: s.item.prefBoost ?? 0,
              totalScore: s.item.totalScore ?? 0,
              matchLevel: s.item.matchLevel ?? null,
            }
          : null,
      }));

      const res = await fetch("/api/generate-plan-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: {
            budget,
            occasion,
            planMode,
            stopsCount,
            interests,
            groupEnabled,
            groupMembers,
            fullDayActsAfterBreakfast,
            fullDayActsAfterLunch,
            citySlug: effectiveCitySlug,
            startPoint: effectiveStartPoint,
          },
          radiusKm,
          sortMode,
          activeLevel,
          effectiveRadiusKm,
          slots: payloadStops,
          stops: payloadStops,
          interests: mergeInterests(interests, groupMembers, groupEnabled),
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        console.error("AI endpoint error:", res.status, t);
        setAiText(`Fehler beim Generieren (API): ${res.status}`);
        return;
      }

      const json = await res.json();
      setAiText(typeof json?.text === "string" ? json.text : "");
    } catch (e) {
      console.error("generateAIText failed:", e);
      setAiText("Fehler beim Generieren (Client).");
    } finally {
      setAiLoading(false);
    }
  }

  async function savePlan() {
    setSaving(true);
    try {
      if (!authReady) {
        console.error("Auth noch nicht ready – bitte kurz warten.");
        return;
      }
      if (!userId) {
        console.error("Kein User vorhanden – Anonymous Auth fehlt/Session leer.");
        return;
      }

      const stopsPayload = plannedStops.map((s) => ({
        index: s.index,
        label: s.label,
        hint: s.hint,
        durationMin: s.durationMin ?? null,
        travelMinFromPrev: s.travelMinFromPrev ?? null,
        reasons: s.reasons ?? [],
        location: s.item
          ? {
              id: s.item.id,
              name: s.item.name,
              type: s.item.type,
              duration_min: s.item.duration_min ?? null,
              reservation_url: s.item.reservation_url ?? null,
              lat: s.item.lat ?? null,
              lng: s.item.lng ?? null,
              distanceKm: s.item.distanceFromOriginKm ?? null,
              baseScore: s.item.score ?? 0,
              prefBoost: s.item.prefBoost ?? 0,
              totalScore: s.item.totalScore ?? 0,
              matchLevel: s.item.matchLevel ?? null,
            }
          : null,
      }));

      const payload = {
        user_id: userId,
        title: planTitle.trim() ? planTitle.trim() : null,
        filters: {
          budget,
          occasion,
          planMode,
          stopsCount,
          interests,
          groupEnabled,
          groupMembers,
          fullDayActsAfterBreakfast,
          fullDayActsAfterLunch,
          citySlug: effectiveCitySlug,
          startPoint: effectiveStartPoint,
        },
        radius_km: radiusKm,
        effective_radius_km: effectiveRadiusKm ?? null,
        sort_mode: sortMode,
        active_level: activeLevel ?? null,
        slots: stopsPayload,
        ai_description: aiText ?? null,
      };

      const { error } = await supabase.from("plans").insert(payload as any);
      if (error) {
        console.error("Save Plan Fehler:", error);
        return;
      }

      setPlanTitle("");
      await loadPlans();
    } finally {
      setSaving(false);
    }
  }

  async function sharePlan(plan: SavedPlanRow) {
    if (!authReady) {
      console.error("Auth noch nicht ready.");
      return;
    }
    if (!userId) {
      console.error("Kein User vorhanden.");
      return;
    }

    let token = plan.share_token ?? null;

    if (!token) {
      token = generateShareToken(18);

      const { error } = await supabase
        .from("plans")
        .update({ share_token: token })
        .eq("id", plan.id)
        .eq("user_id", userId);

      if (error) {
        console.error("Share Token Update Fehler:", error);
        return;
      }

      await loadPlans();
    }

    const shareUrl = `${window.location.origin}/p/${token}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast("Share-Link kopiert ✅");
    } catch {
      prompt("Kopiere diesen Link:", shareUrl);
    }
  }

  const relaxedText =
    activeLevel === "strict"
      ? null
      : activeLevel === "relax_daytime"
      ? "Keine exakten Treffer – Tageszeit wurde gelockert, um mehr Vorschläge zu finden."
      : activeLevel === "relax_budget"
      ? "Keine exakten Treffer – Budget & Tageszeit wurden gelockert, um mehr Vorschläge zu finden."
      : "Keine passenden Treffer – zeige nahe Alternativen im Umkreis.";

  const expandedText =
    effectiveRadiusKm != null && effectiveRadiusKm > radiusKm
      ? `Um mehr Optionen zu finden, haben wir den Umkreis intern auf ${effectiveRadiusKm} km erweitert.`
      : null;

  const quickTags = [
    "sushi",
    "italien",
    "vegan",
    "steak",
    "theater",
    "konzerte",
    "museum",
    "sport",
    "natur",
    "stadt",
    "techno",
    "jazz",
  ];

  if (!mounted) return null;

  const effectiveInterests = mergeInterests(interests, groupMembers, groupEnabled);
  const cityLabel = cities.find((c) => c.slug === effectiveCitySlug)?.name ?? effectiveCitySlug ?? "—";

  return (
    <main className="p-10 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">PerfectDay24 🚀</h1>
          <p className="text-gray-600">
            Smart Local Planner – mit City, echtem Startpunkt, Vorlieben, Gruppe, Umkreis, Dauer & Wegezeit.
          </p>
        </div>

        <Link
          href="/routes"
          className="px-4 py-2 rounded border text-sm hover:bg-gray-50 whitespace-nowrap"
        >
          Creator Routes →
        </Link>
      </div>

      {showPrefsModal ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="text-lg font-semibold">Deine Vorlieben</div>
                <div className="text-sm text-gray-600">
                  Wähle ein paar Interessen (max. 12). Das beeinflusst alle Vorschläge.
                </div>
              </div>
              <button onClick={() => setShowPrefsModal(false)} className="px-3 py-2 rounded border text-sm">
                Schließen
              </button>
            </div>

            <div className="flex flex-wrap gap-2 my-3">
              {quickTags.map((t) => {
                const on = interests.includes(norm(t));
                return (
                  <button
                    key={t}
                    onClick={() => toggleInterest(t)}
                    className={`px-3 py-2 rounded border text-sm ${on ? "bg-black text-white" : ""}`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <input
                value={interestInput}
                onChange={(e) => setInterestInput(e.target.value)}
                placeholder="Eigene Vorliebe hinzufügen (z.B. Tapas)"
                className="border p-2 rounded flex-1"
              />
              <button onClick={addInterestFromInput} className="px-4 py-2 rounded bg-black text-white text-sm">
                Hinzufügen
              </button>
            </div>

            <div className="mt-3 text-xs text-gray-500">
              Aktuell: {interests.length ? interests.join(", ") : "—"} {profileSaving ? " • speichere…" : ""}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowPrefsModal(false)}
                className="px-4 py-2 rounded bg-black text-white text-sm"
              >
                Fertig ✅
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="p-4 border rounded-lg mb-6 space-y-4">
        <div className="flex gap-3 flex-wrap">
          <select
            value={selectedCitySlug ?? "__auto__"}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedCitySlug(v === "__auto__" ? null : v);
              resetPlan();
            }}
            className="border p-2 rounded"
            disabled={citiesLoading}
          >
            <option value="__auto__">📍 Auto (Standort)</option>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
                {typeof c.population === "number" ? ` • ${c.population.toLocaleString("de-DE")}` : ""}
              </option>
            ))}
          </select>

          <select value={budget} onChange={(e) => setBudget(e.target.value)} className="border p-2 rounded">
            <option value="low">Günstig</option>
            <option value="medium">Mittel</option>
            <option value="high">Premium</option>
            <option value="free">Kostenlos</option>
          </select>

          <select value={occasion} onChange={(e) => setOccasion(e.target.value)} className="border p-2 rounded">
            <option value="date">Date</option>
            <option value="friends">Freunde</option>
            <option value="family">Familie</option>
            <option value="party">Party</option>
            <option value="tourism">Tourismus</option>
          </select>

          <select
            value={planMode}
            onChange={(e) => setPlanMode(e.target.value as PlanMode)}
            className="border p-2 rounded"
          >
            <option value="morning">Vormittag</option>
            <option value="midday">Mittag</option>
            <option value="evening">Abend</option>
            <option value="fullday">Ganzer Tag</option>
          </select>

          <select
            value={String(stopsCount)}
            onChange={(e) => setStopsCount(parseInt(e.target.value, 10))}
            disabled={planMode === "fullday"}
            className="border p-2 rounded disabled:opacity-60"
          >
            <option value="1">1 Stop</option>
            <option value="2">2 Stops</option>
            <option value="3">3 Stops</option>
          </select>

          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as "match" | "distance")} className="border p-2 rounded">
            <option value="match">Sort: Best Match</option>
            <option value="distance">Sort: Distanz</option>
          </select>

          <button onClick={() => setShowPrefsModal(true)} className="border px-3 py-2 rounded text-sm">
            ⚙️ Vorlieben
          </button>
        </div>

        <div className="p-4 border rounded-lg space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-semibold">Startpunkt der Reise</div>
              <div className="text-xs text-gray-600">
                Lege fest, wo die Planung beginnt: aktueller Standort, Straße, Hotel, Bahnhof oder Flughafen.
              </div>
            </div>

            <select
              value={startPoint.mode}
              onChange={(e) =>
                setStartPoint((prev) => ({
                  ...prev,
                  mode: e.target.value as StartPointMode,
                }))
              }
              className="border p-2 rounded text-sm"
            >
              <option value="current_location">Aktueller Standort</option>
              <option value="custom">Manueller Startpunkt</option>
            </select>
          </div>

          {startPoint.mode === "custom" ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <select
                  value={startPoint.type}
                  onChange={(e) =>
                    setStartPoint((prev) => ({
                      ...prev,
                      type: e.target.value as StartPointType,
                    }))
                  }
                  className="border p-2 rounded"
                >
                  <option value="address">Straße / Adresse</option>
                  <option value="hotel">Hotel</option>
                  <option value="station">Bahnhof</option>
                  <option value="airport">Flughafen</option>
                  <option value="other">Sonstiges</option>
                </select>

                <input
                  value={startPoint.label}
                  onChange={(e) =>
                    setStartPoint((prev) => ({
                      ...prev,
                      label: e.target.value,
                    }))
                  }
                  placeholder="z.B. Hauptbahnhof Berlin, Hotel Adlon, Alexanderplatz 1"
                  className="border p-2 rounded"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={startPoint.lat ?? ""}
                  onChange={(e) =>
                    setStartPoint((prev) => ({
                      ...prev,
                      lat: e.target.value === "" ? null : parseNullableNumber(e.target.value),
                    }))
                  }
                  placeholder="Latitude, z.B. 52.5200"
                  className="border p-2 rounded"
                />
                <input
                  value={startPoint.lng ?? ""}
                  onChange={(e) =>
                    setStartPoint((prev) => ({
                      ...prev,
                      lng: e.target.value === "" ? null : parseNullableNumber(e.target.value),
                    }))
                  }
                  placeholder="Longitude, z.B. 13.4050"
                  className="border p-2 rounded"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() =>
                    setStartPoint((prev) => ({
                      ...prev,
                      lat: userLat,
                      lng: userLng,
                      label: prev.label || "Aktueller Standort",
                    }))
                  }
                  className="px-3 py-2 rounded border text-sm"
                >
                  Aktuellen Standort übernehmen
                </button>

                <button
                  onClick={() =>
                    setStartPoint((prev) => ({
                      ...prev,
                      label: "",
                      lat: null,
                      lng: null,
                    }))
                  }
                  className="px-3 py-2 rounded border text-sm"
                >
                  Felder leeren
                </button>
              </div>

              <div className="text-xs text-gray-600">
                Hinweis: Für freie Adressen/Hotels brauchst du aktuell Koordinaten. Im nächsten Ausbau kann Geocoding automatisch ergänzt werden.
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-700">
              {userLat != null && userLng != null ? (
                <>
                  Startet vom aktuellen Standort.{" "}
                  <span className="text-xs text-gray-500">
                    ({userLat.toFixed(4)}, {userLng.toFixed(4)})
                  </span>
                </>
              ) : (
                <>Aktueller Standort nicht verfügbar – es wird auf das Stadtzentrum zurückgefallen.</>
              )}
            </div>
          )}

          <div className="text-xs text-gray-600">
            Effektiver Startpunkt:{" "}
            <span className="font-semibold">{effectiveStartPoint.label || "—"}</span>
            {effectiveStartPoint.lat != null && effectiveStartPoint.lng != null
              ? ` • ${effectiveStartPoint.lat.toFixed(4)}, ${effectiveStartPoint.lng.toFixed(4)}`
              : " • ohne Koordinaten"}
          </div>
        </div>

        {planMode === "fullday" ? (
          <div className="p-3 border rounded-lg flex flex-col gap-3">
            <div className="text-sm font-semibold">Ganzer Tag: Aktivitäts-Blöcke</div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm">
                Zwischen <span className="font-semibold">Frühstück</span> → <span className="font-semibold">Mittag</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFullDayActsAfterBreakfast((v) => clamp(v - 1, 1, 2))}
                  className="px-3 py-2 rounded border text-sm"
                >
                  –
                </button>
                <div className="min-w-[28px] text-center font-semibold">{fullDayActsAfterBreakfast}</div>
                <button
                  onClick={() => setFullDayActsAfterBreakfast((v) => clamp(v + 1, 1, 2))}
                  className="px-3 py-2 rounded border text-sm"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm">
                Zwischen <span className="font-semibold">Mittag</span> → <span className="font-semibold">Abend</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFullDayActsAfterLunch((v) => clamp(v - 1, 1, 2))}
                  className="px-3 py-2 rounded border text-sm"
                >
                  –
                </button>
                <div className="min-w-[28px] text-center font-semibold">{fullDayActsAfterLunch}</div>
                <button
                  onClick={() => setFullDayActsAfterLunch((v) => clamp(v + 1, 1, 2))}
                  className="px-3 py-2 rounded border text-sm"
                >
                  +
                </button>
              </div>
            </div>

            <div className="text-xs text-gray-600">
              Ergebnis: Frühstück → {fullDayActsAfterBreakfast} Aktivität(en) → Mittag → {fullDayActsAfterLunch} Aktivität(en) → Abendessen
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-4 flex-wrap">
          <label className="font-medium">Umkreis: {radiusKm} km</label>
          <input
            type="range"
            min={1}
            max={50}
            value={radiusKm}
            onChange={(e) => setRadiusKm(parseInt(e.target.value, 10))}
          />
          <div className="text-sm text-gray-600">
            {effectiveStartPoint.lat != null && effectiveStartPoint.lng != null ? (
              <>Startpunkt aktiv ✅</>
            ) : geoError ? (
              <>Standort aus: {geoError}</>
            ) : (
              <>Startpunkt wird vorbereitet…</>
            )}
          </div>
        </div>

        <div className="text-xs text-gray-600">
          City: <span className="font-semibold">{cityLabel}</span> • Start:{" "}
          <span className="font-semibold">{effectiveStartPoint.label || "—"}</span> • Zeitbudget: ~
          {timeBudgetForMode(planMode)} Min • Vorlieben:{" "}
          {effectiveInterests.length ? effectiveInterests.join(", ") : "— (für bessere Ergebnisse Vorlieben setzen)"}
        </div>

        <div className="p-4 border rounded-lg space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">Gruppe</div>
              <div className="text-xs text-gray-600">Optional: Füge Gäste hinzu. Gemeinsame Interessen wirken stärker.</div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={groupEnabled} onChange={(e) => setGroupEnabled(e.target.checked)} />
              Gruppenmodus
            </label>
          </div>

          {groupEnabled ? (
            <>
              <div className="grid gap-2 md:grid-cols-3">
                <input
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Name (optional)"
                  className="border p-2 rounded"
                />
                <input
                  value={memberInterestInput}
                  onChange={(e) => setMemberInterestInput(e.target.value)}
                  placeholder="Interessen (z.B. sushi, techno)"
                  className="border p-2 rounded md:col-span-2"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => {
                    const name = memberName.trim();
                    const list = memberInterestInput
                      .split(",")
                      .map((x) => norm(x))
                      .filter(Boolean)
                      .slice(0, 10);

                    if (list.length === 0) return;

                    const id =
                      typeof crypto !== "undefined" && "randomUUID" in crypto
                        ? crypto.randomUUID()
                        : `${Date.now()}_${Math.random()}`;

                    setGroupMembers((prev) => [
                      ...prev,
                      { id: String(id), name: name || `Gast ${prev.length + 1}`, interests: list },
                    ]);
                    setMemberName("");
                    setMemberInterestInput("");
                  }}
                  className="px-4 py-2 rounded bg-black text-white text-sm"
                >
                  + Teilnehmer hinzufügen
                </button>

                {groupMembers.length > 0 ? (
                  <button onClick={() => setGroupMembers([])} className="px-4 py-2 rounded border text-sm">
                    Gruppe leeren
                  </button>
                ) : null}
              </div>

              {groupMembers.length > 0 ? (
                <div className="space-y-2">
                  {groupMembers.map((m) => (
                    <div key={m.id} className="p-3 border rounded flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm">{m.name}</div>
                        <div className="text-xs text-gray-600 break-words">{m.interests.join(", ")}</div>
                      </div>
                      <button
                        onClick={() => setGroupMembers((prev) => prev.filter((x) => x.id !== m.id))}
                        className="px-3 py-2 rounded border text-sm"
                      >
                        Entfernen
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-600">Noch keine Teilnehmer.</div>
              )}

              <div className="text-xs text-gray-600">
                Effektive Interessen: {effectiveInterests.length ? effectiveInterests.join(", ") : "—"}
              </div>
            </>
          ) : (
            <div className="text-xs text-gray-600">Gruppenmodus ist aus.</div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 mb-3">
        <h2 className="text-2xl font-semibold">Dein Plan</h2>
        <button onClick={resetPlan} className="px-3 py-2 rounded border text-sm">
          Plan zurücksetzen
        </button>
      </div>

      {expandedText ? <div className="mb-3 p-3 border rounded-lg text-sm text-gray-700">{expandedText}</div> : null}
      {relaxedText ? <div className="mb-4 p-3 border rounded-lg text-sm text-gray-700">{relaxedText}</div> : null}

      <div className="p-4 border rounded-lg mb-6 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-semibold">Route</div>
            <div className="text-xs text-gray-600">
              Echte Wege über OSRM. Startpunkt: {effectiveStartPoint.label || "—"} • Profil:{" "}
              {routeProfile === "foot" ? "zu Fuß" : "Auto"}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={routeProfile}
              onChange={(e) => setRouteProfile(e.target.value as "foot" | "car")}
              className="border p-2 rounded text-sm"
            >
              <option value="foot">🚶 Zu Fuß</option>
              <option value="car">🚗 Auto</option>
            </select>

            <button
              disabled={!googleRouteUrl}
              onClick={() => {
                if (googleRouteUrl) window.open(googleRouteUrl, "_blank", "noreferrer");
              }}
              className="px-3 py-2 rounded bg-black text-white text-sm disabled:opacity-60"
            >
              🗺️ Route öffnen
            </button>
          </div>
        </div>

        <PlanMap stops={mapStops} profile={routeProfile} height={360} onSummary={(s) => setRouteSummary(s)} />

        <div className="p-3 border rounded-lg text-sm text-gray-700">
          <div className="font-semibold mb-1">Travel Summary</div>

          {mapStops.length < 2 ? (
            <div className="text-xs text-gray-600">Für eine Route brauchen wir mindestens Start + 1 Stop mit Koordinaten.</div>
          ) : routeSummary ? (
            <>
              <div className="text-sm">
                Gesamt: <span className="font-semibold">{routeSummary.totalDistanceKm} km</span> •{" "}
                <span className="font-semibold">{routeSummary.totalDurationMin} Min</span>
              </div>

              <div className="mt-2 space-y-1">
                {routeSummary.legs.map((l, i) => (
                  <div key={i} className="text-xs text-gray-600">
                    {l.fromLabel} → {l.toLabel}: {l.distanceKm} km • {l.durationMin} Min
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-xs text-gray-600">
              Route wird berechnet oder ist aktuell nicht verfügbar.
              <div className="mt-2">
                Schätzung: ~{fallbackSummary.distanceKm} km • Aktivitäten ~{fallbackSummary.activityMin} Min • Wege ~{fallbackSummary.travelMin} Min • Gesamt ~{fallbackSummary.totalMin} Min
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border rounded-lg mb-6 space-y-4">
        <div className="flex gap-3 flex-wrap items-center">
          <input
            value={planTitle}
            onChange={(e) => setPlanTitle(e.target.value)}
            placeholder="Optionaler Titel (z.B. Date in Berlin)"
            className="border p-2 rounded flex-1 min-w-[240px]"
          />

          <button
            onClick={generateAIText}
            disabled={aiLoading}
            className="px-4 py-2 rounded border text-sm disabled:opacity-60"
          >
            {aiLoading ? "KI generiert…" : "🧠 KI-Text erzeugen"}
          </button>

          <button
            onClick={savePlan}
            disabled={!authReady || saving}
            className="px-4 py-2 rounded bg-black text-white text-sm disabled:opacity-60"
          >
            {!authReady ? "Auth…" : saving ? "Speichern…" : "💾 Plan speichern"}
          </button>

          <button onClick={loadPlans} disabled={!authReady || loadingPlans} className="px-4 py-2 rounded border text-sm">
            {loadingPlans ? "Lade…" : "↻ Meine Pläne"}
          </button>
        </div>

        {aiText ? (
          <div className="p-4 border rounded-lg text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{aiText}</div>
        ) : null}

        {authReady && userId ? (
          <div className="text-xs text-gray-500">User: {userId.slice(0, 8)}…</div>
        ) : !authReady ? (
          <div className="text-sm text-gray-600">Auth wird vorbereitet…</div>
        ) : (
          <div className="text-sm text-gray-600">Auth bereit, aber keine User-ID – Console prüfen.</div>
        )}
      </div>

      {loading ? (
        <div className="p-4 border rounded-lg">Lade Locations…</div>
      ) : results.length === 0 ? (
        <div className="p-4 border rounded-lg">
          Keine Vorschläge. (Tipp: City wechseln, Startpunkt prüfen oder Umkreis erhöhen.)
        </div>
      ) : (
        <>
          <div className="space-y-4 mb-10">
            {plannedStops.map((stop, i) => (
              <div key={stop.index} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-bold text-lg">
                        {stop.label}{" "}
                        <span className="text-xs font-normal text-gray-500">• {stop.hint}</span>
                      </h3>
                    </div>

                    {stop.item ? (
                      <>
                        <p className="mt-2 font-semibold">{stop.item.name}</p>
                        <p className="text-gray-700">{stop.item.type}</p>

                        <p className="text-sm text-gray-500">
                          Base: {stop.item.score} • Pref: +{stop.item.prefBoost} • Total: {stop.item.totalScore}
                          {stop.item.distanceFromOriginKm != null
                            ? ` • ${stop.item.distanceFromOriginKm.toFixed(1)} km vom Start`
                            : ""}
                        </p>

                        <p className="text-xs text-gray-500 mt-1">
                          Dauer: {stop.durationMin ?? "—"} Min
                          {stop.travelMinFromPrev != null ? ` • Anfahrt/Weg: ~${stop.travelMinFromPrev} Min` : ""}
                        </p>

                        {stop.reasons?.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {stop.reasons.map((reason) => (
                              <span
                                key={reason}
                                className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 border"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-gray-600">Keine passende Location für diesen Block gefunden.</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 items-end">
                    <button onClick={() => bumpStop(i)} className="px-3 py-2 rounded bg-black text-white text-sm">
                      Tauschen
                    </button>

                    {stop.item?.reservation_url ? (
                      <a
                        href={stop.item.reservation_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 rounded border text-sm"
                      >
                        Reservieren
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h3 className="text-xl font-semibold mb-3">Meine gespeicherten Pläne</h3>

          {plans.length === 0 ? (
            <div className="p-4 border rounded-lg text-sm text-gray-700">Noch keine Pläne gespeichert.</div>
          ) : (
            <div className="space-y-3 mb-6">
              {plans.map((p) => (
                <div key={p.id} className="p-4 border rounded-lg hover:bg-gray-50 flex items-start justify-between gap-4">
                  <button onClick={() => setSelectedPlan(p)} className="text-left flex-1">
                    <div className="font-semibold">{p.title || "Untitled Plan"}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(p.created_at).toLocaleString()} • Mode: {p.filters?.planMode ?? "—"} • Stops:{" "}
                      {p.filters?.stopsCount ?? "—"}
                    </div>
                    <div className="mt-2 inline-block text-xs px-2 py-1 rounded border">{p.active_level || "n/a"}</div>

                    {p.filters?.startPoint?.label ? (
                      <div className="mt-2 text-xs text-gray-600">
                        Start: {p.filters.startPoint.label}
                      </div>
                    ) : null}

                    {p.ai_description ? (
                      <div className="mt-2 text-xs text-gray-600 line-clamp-2">{p.ai_description}</div>
                    ) : null}
                  </button>

                  <div className="flex flex-col items-end gap-2">
                    <button onClick={() => sharePlan(p)} className="px-3 py-2 rounded bg-black text-white text-sm">
                      🔗 Teilen
                    </button>
                    {p.share_token ? (
                      <div className="text-[11px] text-gray-500">/p/{String(p.share_token).slice(0, 6)}…</div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedPlan ? (
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="font-semibold">{selectedPlan.title || "Untitled Plan"}</div>
                  <div className="text-xs text-gray-500">
                    Radius: {selectedPlan.radius_km} km • Sort: {selectedPlan.sort_mode} • Mode:{" "}
                    {selectedPlan.filters?.planMode ?? "—"} • Stops: {selectedPlan.filters?.stopsCount ?? "—"}
                  </div>
                </div>
                <button onClick={() => setSelectedPlan(null)} className="px-3 py-2 rounded border text-sm">
                  Schließen
                </button>
              </div>

              {selectedPlan.filters?.startPoint?.label ? (
                <div className="p-3 border rounded-lg text-sm text-gray-700 mb-3">
                  <span className="font-semibold">Startpunkt:</span> {selectedPlan.filters.startPoint.label}
                </div>
              ) : null}

              {selectedPlan.ai_description ? (
                <div className="p-3 border rounded-lg text-sm text-gray-700 whitespace-pre-wrap mb-3">
                  {selectedPlan.ai_description}
                </div>
              ) : null}

              <div className="space-y-3">
                {(selectedPlan.slots || []).map((s: any) => (
                  <div key={s.index ?? s.slot ?? JSON.stringify(s)} className="p-3 border rounded-lg">
                    <div className="text-sm font-semibold">{s.label ?? `Stop ${s.index}`}</div>
                    <div className="text-xs text-gray-500">{s.hint}</div>
                    {s.location ? (
                      <>
                        <div className="text-sm mt-1">{s.location.name}</div>
                        <div className="text-xs text-gray-500">{s.location.type}</div>
                        <div className="text-xs text-gray-500">
                          Dauer: {s.durationMin ?? "—"} Min
                          {typeof s.travelMinFromPrev === "number" ? ` • Weg: ~${s.travelMinFromPrev} Min` : ""}
                        </div>

                        {Array.isArray(s.reasons) && s.reasons.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {s.reasons.map((reason: string) => (
                              <span
                                key={reason}
                                className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 border"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="text-xs text-gray-500 mt-1">—</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      {toast ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-black text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      ) : null}
    </main>
  );
}