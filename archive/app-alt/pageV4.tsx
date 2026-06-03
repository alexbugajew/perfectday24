// app/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";

// ✅ PlanMap dynamic (no SSR)
import type { RouteSummary } from "@/components/PlanMap";
const PlanMap = dynamic(() => import("@/components/PlanMap").then((m) => m.default), {
  ssr: false,
});

type LocationCategory =
  | "cafe"
  | "restaurant"
  | "activity"
  | "culture"
  | "nightlife"
  | "event"
  | "other"
  | null;

type MealType = "breakfast" | "lunch" | "dinner" | null;

type LocationRow = {
  id: string;
  name: string;
  type: string;
  budget?: string | null;
  occasion?: string | null;

  // legacy / optional
  daytime?: string | null;

  // ✅ new columns (optional, falls noch nicht überall gefüllt)
  category?: LocationCategory;
  meal?: MealType;

  manual_category?: LocationCategory;
  manual_meal?: MealType;

  lat?: number | null;
  lng?: number | null;
  reservation_url?: string | null;

  duration_min?: number | null;
  tags?: any;

  // ✅ multi-city
  city_slug?: string | null;
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

type MatchLevel = "strict" | "relax_daytime" | "relax_budget" | "fallback";

type ScoredLocation = LocationRow & {
  score: number; // base score
  distanceKm: number | null;
  matchLevel: MatchLevel;
  prefBoost: number;
  totalScore: number;
};

type PlanMode = "morning" | "midday" | "evening" | "fullday"; // "evening" wird im UI als "Abend" dargestellt

type PlannedStop = {
  index: number; // 1..n
  label: string;
  hint: string;
  item: ScoredLocation | null;
  durationMin: number | null;
  travelMinFromPrev: number | null;
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

type GroupMember = {
  id: string;
  name: string;
  interests: string[];
};

type SlotKind = "breakfast" | "lunch" | "dinner" | "activity" | "anything";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toRad(v: number) {
  return (v * Math.PI) / 180;
}

function generateShareToken(len = 18) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(aLat)) *
      Math.cos(toRad(bLat)) *
      (Math.sin(dLng / 2) * Math.sin(dLng / 2));
  const c = 2 * Math.atan2(Math.sqrt(s1), Math.sqrt(1 - s1));
  return R * c;
}

function uniqueNumbers(arr: number[]) {
  return Array.from(new Set(arr)).filter((x) => Number.isFinite(x));
}

function norm(s: string | null | undefined) {
  return (s ?? "").toLowerCase().trim();
}

/** Legacy-Daytime Mapping: hält alte Werte kompatibel */
function normalizeDaytime(v: string | null | undefined): "morning" | "midday" | "evening" | "night" | null {
  const x = norm(v);
  if (!x) return null;

  // alte/alternative Werte
  if (x === "afternoon") return "evening";
  if (x === "mittag") return "midday";
  if (x === "vormittag") return "morning";
  if (x === "abend") return "evening";
  if (x === "nacht") return "night";

  if (x === "morning" || x === "midday" || x === "evening" || x === "night") return x;
  return null;
}

/** Heuristik: kategorisiert type/name grob. */
function classify(loc: LocationRow): LocationCategory {
  const manual = loc.manual_category as LocationCategory | null;
  if (manual) return manual;

  const dbCat = loc.category as LocationCategory | null;
  if (dbCat) return dbCat;

  const t = `${norm(loc.type)} ${norm(loc.name)}`;
  const has = (...words: string[]) => words.some((w) => t.includes(w));

  if (has("club", "disco", "nacht", "bar", "lounge", "pub", "cocktail", "party"))
    return "nightlife";

  if (
    has(
      "restaurant",
      "dinner",
      "gourmet",
      "steak",
      "sushi",
      "pizzeria",
      "bistro",
      "kitchen",
      "lunch"
    )
  )
    return "restaurant";

  if (
    has(
      "cafe",
      "café",
      "coffee",
      "brunch",
      "breakfast",
      "bakery",
      "patisserie"
    )
  )
    return "cafe";

  if (
    has(
      "museum",
      "galerie",
      "theater",
      "kino",
      "cinema",
      "kirche",
      "castle",
      "schloss"
    )
  )
    return "culture";

  if (
    has(
      "park",
      "wander",
      "hike",
      "lake",
      "zoo",
      "bowling",
      "escape",
      "minigolf"
    )
  )
    return "activity";

  if (has("event", "concert", "festival", "show"))
    return "event";

  return "other";
}

/** Grobe Dauer je Kategorie (MVP) */
function estimateDurationMin(loc: LocationRow) {
  if (
    typeof loc.duration_min === "number" &&
    Number.isFinite(loc.duration_min) &&
    loc.duration_min > 0
  ) {
    return Math.round(loc.duration_min);
  }
  const c = classify(loc);
  if (c === "cafe") return 45;
  if (c === "restaurant") return 90;
  if (c === "culture") return 120;
  if (c === "activity") return 90;
  if (c === "nightlife") return 90;
  if (c === "event") return 120;
  return 60;
}

/** Wegezeit grob aus Distanz (MVP, ohne Routing API) */
function estimateTravelMinFromKm(distanceKm: number | null) {
  if (distanceKm == null) return null;
  const min = Math.max(5, Math.round(distanceKm * 10));
  return Math.min(90, min);
}

function timeBudgetForMode(mode: PlanMode) {
  if (mode === "morning") return 210;
  if (mode === "midday") return 180;
  if (mode === "evening") return 240;
  return 480;
}

function preferredDaytimesForMode(mode: PlanMode): Array<"morning" | "midday" | "evening" | "night"> {
  if (mode === "morning") return ["morning"];
  if (mode === "midday") return ["midday"];
  if (mode === "evening") return ["evening", "night"];
  return ["morning", "midday", "evening", "night"];
}

function buildInterestKeywords(interests: string[]) {
  const base = interests.map((x) => norm(x)).filter(Boolean);

  const expand: Record<string, string[]> = {
    italien: ["italien", "pizza", "pasta", "trattoria", "pizzeria"],
    sushi: ["sushi", "japan", "ramen", "izakaya"],
    vegan: ["vegan", "plant", "vegetar", "bio"],
    steak: ["steak", "bbq", "grill"],
    theater: ["theater", "bühne", "stage"],
    konzerte: ["konzert", "concert", "live", "gig"],
    museum: ["museum", "galerie", "ausstellung"],
    sport: ["sport", "klettern", "bowling", "fitness", "gym"],
    natur: ["park", "see", "lake", "wander", "hike", "aussicht"],
    stadt: ["city", "altstadt", "downtown", "shopping", "walk"],
    techno: ["techno", "club", "dj", "rave"],
    jazz: ["jazz", "live music", "bar"],
  };

  const out = new Set<string>();
  for (const b of base) {
    out.add(b);
    const ex = expand[b];
    if (ex) ex.forEach((w) => out.add(norm(w)));
  }
  return Array.from(out);
}

function interestWeights(owner: string[], members: GroupMember[], enabled: boolean) {
  const counts = new Map<string, number>();

  const addList = (arr: string[]) => {
    for (const x of arr.map(norm).filter(Boolean)) {
      counts.set(x, (counts.get(x) ?? 0) + 1);
    }
  };

  addList(owner);
  if (enabled) {
    for (const m of members) addList(m.interests ?? []);
  }

  const weight = new Map<string, number>();
  for (const [k, c] of counts.entries()) {
    const w = c <= 1 ? 1.0 : c === 2 ? 1.6 : c === 3 ? 2.1 : 2.6;
    weight.set(k, w);
  }
  return weight;
}

function mergeInterests(owner: string[], members: GroupMember[], enabled: boolean) {
  const all = new Set(owner.map(norm).filter(Boolean));
  if (enabled) {
    members.forEach((m) =>
      (m.interests ?? [])
        .map(norm)
        .filter(Boolean)
        .forEach((t) => all.add(t))
    );
  }
  return Array.from(all).slice(0, 20);
}

function preferenceBoost(loc: LocationRow, interestKeywords: string[], weightMap?: Map<string, number>) {
  if (interestKeywords.length === 0) return 0;

  const tags: string[] = Array.isArray((loc as any).tags)
    ? (loc as any).tags.map((x: any) => norm(String(x))).filter(Boolean)
    : [];

  const text = `${norm(loc.name)} ${norm(loc.type)}`;

  let tagScore = 0;
  let textScore = 0;

  for (const kw of interestKeywords) {
    if (!kw) continue;
    const w = weightMap?.get(kw) ?? 1.0;

    if (tags.includes(kw)) tagScore += 3 * w;
    else if (text.includes(kw)) textScore += 1 * w;
  }

  if (tagScore === 0 && textScore === 0) return 0;

  const c = classify(loc);
  const catWeight =
    c === "restaurant"
      ? 16
      : c === "culture"
      ? 14
      : c === "event"
      ? 14
      : c === "activity"
      ? 13
      : c === "cafe"
      ? 10
      : c === "nightlife"
      ? 10
      : 9;

  const raw = (tagScore + textScore) * catWeight;
  return Math.min(120, Math.round(raw));
}

/** Google Directions URL (ohne Key) */
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

function resolveMeal(loc: LocationRow): MealType {
  const manual = loc.manual_meal as MealType | null;
  if (manual) return manual;

  const dbMeal = loc.meal as MealType | null;
  if (dbMeal) return dbMeal;

  return null;
}

function slotCategoryMatch(kind: SlotKind, loc: LocationRow) {
  const cat = classify(loc);
  const meal = resolveMeal(loc);

  if (kind === "breakfast") {
    if (meal) return meal === "breakfast";
    return cat === "cafe";
  }

  if (kind === "lunch") {
    if (meal) return meal === "lunch";
    return cat === "restaurant";
  }

  if (kind === "dinner") {
    if (meal) return meal === "dinner";
    return cat === "restaurant";
  }

  if (kind === "activity") {
    return cat === "culture" || cat === "activity" || cat === "event";
  }

  return true;
}

function slotsForMode(
  mode: PlanMode,
  desiredStops: number,
  opts?: { a1?: number; a2?: number }
): Array<{ kind: SlotKind; label: string; hint: string }> {
  if (mode === "morning") {
    const base = [
      { kind: "breakfast" as const, label: "Frühstück", hint: "Café / Breakfast" },
      { kind: "activity" as const, label: "Aktivität", hint: "Spaziergang / Museum / Highlight" },
      { kind: "anything" as const, label: "Bonus", hint: "Optionaler Abschluss" },
    ];
    return base.slice(0, clamp(desiredStops, 1, 3));
  }

  if (mode === "midday") {
    const base = [
      { kind: "lunch" as const, label: "Mittagessen", hint: "Restaurant / Lunch" },
      { kind: "activity" as const, label: "Aktivität", hint: "Kleine Aktivität danach" },
      { kind: "anything" as const, label: "Bonus", hint: "Optional" },
    ];
    return base.slice(0, clamp(desiredStops, 1, 3));
  }

  if (mode === "evening") {
    const base = [
      { kind: "activity" as const, label: "Aktivität", hint: "Warm-up / Erlebnis" },
      { kind: "dinner" as const, label: "Abendessen", hint: "Restaurant / Dinner" },
      { kind: "anything" as const, label: "After", hint: "Drink / Dessert / Bonus" },
    ];
    return base.slice(0, clamp(desiredStops, 1, 3));
  }

  const a1 = clamp(opts?.a1 ?? 1, 1, 2);
  const a2 = clamp(opts?.a2 ?? 1, 1, 2);

  const out: Array<{ kind: SlotKind; label: string; hint: string }> = [];
  out.push({ kind: "breakfast", label: "Frühstück", hint: "Café / Breakfast" });

  for (let i = 0; i < a1; i++) {
    const n = i + 1;
    out.push({
      kind: "activity",
      label: a1 === 1 ? "Aktivität (Vormittag)" : `Aktivität ${n} (Vormittag)`,
      hint: n === 1 ? "Sehenswürdigkeit / Kultur" : "Erlebnis / Location-Aktivität",
    });
  }

  out.push({ kind: "lunch", label: "Mittagessen", hint: "Restaurant / Lunch" });

  for (let i = 0; i < a2; i++) {
    const n = i + 1;
    out.push({
      kind: "activity",
      label: a2 === 1 ? "Aktivität (Nachmittag)" : `Aktivität ${n} (Nachmittag)`,
      hint: n === 1 ? "Sehenswürdigkeit / Spaziergang" : "Erlebnis / Location-Aktivität",
    });
  }

  out.push({ kind: "dinner", label: "Abendessen", hint: "Restaurant / Dinner" });
  return out;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ Cities
  const [cities, setCities] = useState<CityRow[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [selectedCitySlug, setSelectedCitySlug] = useState<string | null>(null); // null = Auto (Standort)
  const [autoCitySlug, setAutoCitySlug] = useState<string | null>(null);

  // Filter
  const [budget, setBudget] = useState("medium");
  const [occasion, setOccasion] = useState("date");

  // Plan mode + stops (stopsCount gilt für morning/midday/evening; fullday nutzt Blöcke)
  const [planMode, setPlanMode] = useState<PlanMode>("fullday");
  const [stopsCount, setStopsCount] = useState(3);

  // ✅ Fullday: Anzahl Aktivitäten zwischen den Mahlzeiten (1..2)
  const [fullDayActsAfterBreakfast, setFullDayActsAfterBreakfast] = useState(1);
  const [fullDayActsAfterLunch, setFullDayActsAfterLunch] = useState(1);

  // Umkreis + Sort
  const [radiusKm, setRadiusKm] = useState(10);
  const [sortMode, setSortMode] = useState<"match" | "distance">("match");

  // AI Text
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  // ✅ Routing profile + summary
  const [routeProfile, setRouteProfile] = useState<"foot" | "car">("foot");
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);

  // Profile / Vorlieben
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // UI: Onboarding / Modal
  const [showPrefsModal, setShowPrefsModal] = useState(false);

  // Gruppe
  const [groupEnabled, setGroupEnabled] = useState(false);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [memberName, setMemberName] = useState("");
  const [memberInterestInput, setMemberInterestInput] = useState("");

  // User Position
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Stop Swap Offsets (dynamisch)
  const [stopOffsets, setStopOffsets] = useState<number[]>([]);

  // Save/Load State
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [plans, setPlans] = useState<SavedPlanRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [planTitle, setPlanTitle] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<SavedPlanRow | null>(null);

  useEffect(() => setMounted(true), []);

  // ✅ routeProfile persistieren (foot/car)
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

  // ✅ selectedCitySlug persistieren (Auto = "__auto__")
  useEffect(() => {
    if (!mounted) return;
    try {
      const v = localStorage.getItem("pd24_city_slug");
      if (v) {
        if (v === "__auto__") setSelectedCitySlug(null);
        else setSelectedCitySlug(v);
      } else {
        setSelectedCitySlug(null); // default Auto
      }
    } catch {}
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem("pd24_city_slug", selectedCitySlug ? selectedCitySlug : "__auto__");
    } catch {}
  }, [mounted, selectedCitySlug]);

  // StopsCount sinnvoll begrenzen je Mode (außer fullday)
  useEffect(() => {
    if (planMode === "fullday") return;
    setStopsCount((prev) => clamp(prev, 1, 3));
  }, [planMode]);

  // Auth init + Listener
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

  // ✅ Cities laden
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

  // Geolocation
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

  // ✅ Auto-City aus Geolocation ableiten (nächste City)
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
    // Priorität: explizit gewählte City -> Auto City -> erste City
    return selectedCitySlug ?? autoCitySlug ?? (cities[0]?.slug ?? null);
  }, [selectedCitySlug, autoCitySlug, cities]);

  // ✅ Locations laden (city_slug Filter!)
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let q = supabase.from("locations").select("*");
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

  // Profile laden + ggf. Modal öffnen
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

  // --------- Matching + Scoring Pool ----------
  const { results, activeLevel, effectiveRadiusKm } = useMemo(() => {
    const merged = mergeInterests(interests, groupMembers, groupEnabled);
    const wMap = interestWeights(interests, groupMembers, groupEnabled);
    const interestKeywords = buildInterestKeywords(merged);

    const preferredDaytimes = preferredDaytimesForMode(planMode);

    const withDistance: (LocationRow & { distanceKm: number | null })[] = locations.map((loc) => {
      let distanceKm: number | null = null;
      if (
        userLat != null &&
        userLng != null &&
        typeof loc.lat === "number" &&
        typeof loc.lng === "number"
      ) {
        distanceKm = haversineKm(userLat, userLng, loc.lat, loc.lng);
      }
      return { ...loc, distanceKm };
    });

    const sortFn = (a: ScoredLocation, b: ScoredLocation) => {
      if (sortMode === "distance") {
        const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
        const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
        return da - db;
      }
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
      return da - db;
    };

    const radiusSteps =
      userLat != null && userLng != null
        ? uniqueNumbers([radiusKm, 20, 35, 50]).sort((a, b) => a - b)
        : [radiusKm];

    const withinRadius = (stepRadius: number) =>
      withDistance.filter((x) => {
        if (userLat == null || userLng == null) return true;
        if (x.distanceKm == null) return false;
        return x.distanceKm <= stepRadius;
      });

    const scoreStrict = (x: LocationRow) => {
      const locBudget = x.budget ?? "medium";
      const locOccasion = x.occasion ?? "date";
      const locDaytime = normalizeDaytime(x.daytime);

      let score = 0;
      if (locBudget === budget) score += 2;
      if (locOccasion === occasion) score += 3;

      // Tageszeit nur berücksichtigen, wenn in DB gepflegt (legacy daytime)
      if (locDaytime && preferredDaytimes.includes(locDaytime)) score += 2;
      return score;
    };

    const scoreRelaxDaytime = (x: LocationRow) => {
      const locBudget = x.budget ?? "medium";
      const locOccasion = x.occasion ?? "date";
      let score = 0;
      if (locBudget === budget) score += 2;
      if (locOccasion === occasion) score += 3;
      return score;
    };

    const scoreRelaxBudget = (x: LocationRow) => {
      const locOccasion = x.occasion ?? "date";
      let score = 0;
      if (locOccasion === occasion) score += 3;
      return score;
    };

    const totalize = (base: number, pb: number) => base * 8 + pb;

    for (const stepRadius of radiusSteps) {
      const pool = withinRadius(stepRadius);

      const strict: ScoredLocation[] = pool
        .map((x) => {
          const base = scoreStrict(x);
          const pb = preferenceBoost(x, interestKeywords, wMap);
          const total = totalize(base, pb);
          return { ...x, score: base, prefBoost: pb, totalScore: total, matchLevel: "strict" as const };
        })
        .filter((x) => x.score > 0 || x.prefBoost > 0)
        .sort(sortFn);

      if (strict.length > 0)
        return { results: strict, activeLevel: "strict" as const, effectiveRadiusKm: stepRadius };

      const relaxDaytime: ScoredLocation[] = pool
        .map((x) => {
          const base = scoreRelaxDaytime(x);
          const pb = preferenceBoost(x, interestKeywords, wMap);
          const total = totalize(base, pb);
          return { ...x, score: base, prefBoost: pb, totalScore: total, matchLevel: "relax_daytime" as const };
        })
        .filter((x) => x.score > 0 || x.prefBoost > 0)
        .sort(sortFn);

      if (relaxDaytime.length > 0)
        return { results: relaxDaytime, activeLevel: "relax_daytime" as const, effectiveRadiusKm: stepRadius };

      const relaxBudget: ScoredLocation[] = pool
        .map((x) => {
          const base = scoreRelaxBudget(x);
          const pb = preferenceBoost(x, interestKeywords, wMap);
          const total = totalize(base, pb);
          return { ...x, score: base, prefBoost: pb, totalScore: total, matchLevel: "relax_budget" as const };
        })
        .filter((x) => x.score > 0 || x.prefBoost > 0)
        .sort(sortFn);

      if (relaxBudget.length > 0)
        return { results: relaxBudget, activeLevel: "relax_budget" as const, effectiveRadiusKm: stepRadius };

      if (pool.length > 0) {
        const fallback: ScoredLocation[] = [...pool]
          .map((x) => {
            const pb = preferenceBoost(x, interestKeywords, wMap);
            return { ...x, score: 0, prefBoost: pb, totalScore: pb, matchLevel: "fallback" as const };
          })
          .sort(sortFn)
          .slice(0, 120);

        return { results: fallback, activeLevel: "fallback" as const, effectiveRadiusKm: stepRadius };
      }
    }

    return { results: [] as ScoredLocation[], activeLevel: "fallback" as const, effectiveRadiusKm: radiusKm };
  }, [
    locations,
    budget,
    occasion,
    radiusKm,
    sortMode,
    userLat,
    userLng,
    interests,
    planMode,
    groupEnabled,
    groupMembers,
  ]);

  // --------- Slots (für dynamische Länge + Offsets) ----------
  const slots = useMemo(() => {
    const desiredStops = planMode === "fullday" ? 7 : clamp(stopsCount, 1, 3);
    return slotsForMode(planMode, desiredStops, {
      a1: fullDayActsAfterBreakfast,
      a2: fullDayActsAfterLunch,
    });
  }, [planMode, stopsCount, fullDayActsAfterBreakfast, fullDayActsAfterLunch]);

  const slotCount = slots.length;

  useEffect(() => {
    setStopOffsets((prev) => {
      const next = new Array(slotCount).fill(0);
      for (let i = 0; i < Math.min(prev.length, next.length); i++) next[i] = prev[i] ?? 0;
      return next;
    });
  }, [slotCount]);

  // --------- Planner: Stops (Slots) mit Dauer + Wegezeit ----------
  const plannedStops: PlannedStop[] = useMemo(() => {
    const budgetMin = timeBudgetForMode(planMode);
    const candidates = results.slice(0, 160);

    const usedIds = new Set<string>();
    const usedCats: Array<LocationCategory> = [];
    const out: PlannedStop[] = [];

    let timeUsed = 0;
    let prev: ScoredLocation | null = null;

    const buffer = planMode === "fullday" ? 60 : 25;

    const getPoolForKind = (kind: SlotKind, mode: PlanMode) => {
      // 0) STRICT: exakt passend
      const strict = candidates.filter((c) => slotCategoryMatch(kind, c));
      if (strict.length > 0) return strict;

      // 1) CONTROLLED FALLBACKS (je Slot)

      // Frühstück: lieber Cafés, sonst zur Not Restaurants (nicht Kultur/Activity)
      if (kind === "breakfast") {
        const cafes = candidates.filter((c) => classify(c) === "cafe");
        if (cafes.length > 0) return cafes;

        const foodish = candidates.filter((c) => {
          const cc = classify(c);
          return cc === "restaurant" || cc === "cafe";
        });
        if (foodish.length > 0) return foodish;

        return candidates;
      }

      // Lunch/Dinner: Restaurants, sonst Cafés (aber keine Kultur/Activity)
      if (kind === "lunch" || kind === "dinner") {
        const restaurants = candidates.filter((c) => classify(c) === "restaurant");
        if (restaurants.length > 0) return restaurants;

        const cafes = candidates.filter((c) => classify(c) === "cafe");
        if (cafes.length > 0) return cafes;

        const foodish = candidates.filter((c) => {
          const cc = classify(c);
          return cc === "restaurant" || cc === "cafe";
        });
        if (foodish.length > 0) return foodish;

        return candidates;
      }

      // Activity: culture/activity/event, fallback other (aber NICHT food)
      if (kind === "activity") {
        const actish = candidates.filter((c) => {
          const cc = classify(c);
          return cc === "culture" || cc === "activity" || cc === "event";
        });
        if (actish.length > 0) return actish;

        const other = candidates.filter((c) => classify(c) === "other");
        if (other.length > 0) return other;

        const nonFood = candidates.filter((c) => {
          const cc = classify(c);
          return cc !== "cafe" && cc !== "restaurant";
        });
        if (nonFood.length > 0) return nonFood;

        return candidates;
      }

      // Anything: im Abendmodus gern nightlife priorisieren
      if (kind === "anything") {
        if (mode === "evening") {
          const nightlife = candidates.filter((c) => classify(c) === "nightlife");
          if (nightlife.length > 0) return nightlife;
        }
        return candidates;
      }

      return candidates;
    };

    for (let i = 0; i < slotCount; i++) {
      const slot = slots[i];
      const offset = stopOffsets[i] ?? 0;

      const pool = getPoolForKind(slot.kind, planMode).filter((c) => !usedIds.has(c.id));
      if (pool.length === 0) {
        out.push({
          index: i + 1,
          label: slot.label,
          hint: slot.hint,
          item: null,
          durationMin: null,
          travelMinFromPrev: null,
        });
        continue;
      }

      const prevCat = prev ? classify(prev) : null;

      const scored = pool
        .map((cand) => {
          let travelMin: number | null = null;

          if (prev && prev.lat != null && prev.lng != null && cand.lat != null && cand.lng != null) {
            const travelKm = haversineKm(prev.lat, prev.lng, cand.lat, cand.lng);
            travelMin = estimateTravelMinFromKm(travelKm);
          }

          const travelPenalty = travelMin != null ? Math.min(40, Math.round(travelMin / 3)) : 0;

          const isMealSlot = slot.kind === "breakfast" || slot.kind === "lunch" || slot.kind === "dinner";
          const strictMatch = slotCategoryMatch(slot.kind, cand);

          // Slot boosts
          const slotBoost = isMealSlot ? (strictMatch ? 35 : 10) : slot.kind === "activity" ? (strictMatch ? 18 : 6) : 0;

          // ✅ Diversity Penalty (MVP)
          const candCat = classify(cand);
          const sameAsPrevPenalty = prevCat && candCat && prevCat === candCat ? 18 : 0;

          const seen = candCat ? usedCats.filter((x) => x === candCat).length : 0;
          const overusePenalty = candCat && seen >= 2 ? 10 : 0;

          const diversityPenalty = sameAsPrevPenalty + overusePenalty;

          const total = cand.totalScore - travelPenalty - diversityPenalty + slotBoost;

          return { cand, total, travelMin, dur: estimateDurationMin(cand) };
        })
        .sort((a, b) => b.total - a.total);

      let found: ScoredLocation | null = null;
      let foundTravel: number | null = null;
      let foundDur: number | null = null;

      for (let k = 0; k < scored.length; k++) {
        const idx = (offset + k) % scored.length;
        const entry = scored[idx];
        const cand = entry.cand;

        if (usedIds.has(cand.id)) continue;

        const add = (entry.travelMin ?? 0) + entry.dur;
        if (timeUsed + add <= budgetMin + buffer) {
          found = cand;
          foundTravel = prev ? entry.travelMin : null;
          foundDur = entry.dur;
          timeUsed += add;
          break;
        }
      }

      out.push({
        index: i + 1,
        label: slot.label,
        hint: slot.hint,
        item: found,
        durationMin: found ? foundDur : null,
        travelMinFromPrev: found ? foundTravel : null,
      });

      if (found) {
        usedIds.add(found.id);
        usedCats.push(classify(found));
        prev = found;
      }
    }

    return out;
  }, [results, planMode, slots, slotCount, stopOffsets]);

  // ✅ Map-Stops (nur Koordinaten)
  const mapStops = useMemo(() => {
    return plannedStops
      .filter((s) => s.item?.lat != null && s.item?.lng != null)
      .map((s) => ({
        label: s.label,
        name: s.item?.name ?? "Location",
        lat: Number(s.item!.lat),
        lng: Number(s.item!.lng),
      }));
  }, [plannedStops]);

  // ✅ Google Maps URL (mit travelmode)
  const googleRouteUrl = useMemo(() => {
    return buildGoogleMapsDirUrl(
      mapStops.map((p) => ({ lat: p.lat, lng: p.lng })),
      routeProfile
    );
  }, [mapStops, routeProfile]);

  // ✅ Fallback summary (ohne OSRM)
  const fallbackSummary = useMemo(() => {
    const pts = plannedStops
      .map((s) => s.item)
      .filter((x) => x && typeof x.lat === "number" && typeof x.lng === "number") as ScoredLocation[];

    let distKm = 0;
    let travelMin = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const d = haversineKm(a.lat as number, a.lng as number, b.lat as number, b.lng as number);
      distKm += d;
      travelMin += estimateTravelMinFromKm(d) ?? 0;
    }

    const activityMin = plannedStops.reduce((sum, s) => sum + (s.durationMin ?? 0), 0);
    const totalMin = activityMin + travelMin;

    return {
      distanceKm: Math.round(distKm * 10) / 10,
      durationMin: Math.round(activityMin),
      travelMin: Math.round(travelMin),
      totalMin: Math.round(totalMin),
    };
  }, [plannedStops]);

  // ---------- AI call ----------
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
        location: s.item
          ? {
              id: s.item.id,
              name: s.item.name,
              type: s.item.type,
              duration_min: s.item.duration_min ?? null,
              reservation_url: s.item.reservation_url ?? null,
              lat: s.item.lat ?? null,
              lng: s.item.lng ?? null,
              distanceKm: s.item.distanceKm ?? null,
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

  // ---------- Save plan ----------
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
        location: s.item
          ? {
              id: s.item.id,
              name: s.item.name,
              type: s.item.type,
              duration_min: s.item.duration_min ?? null,
              reservation_url: s.item.reservation_url ?? null,
              lat: s.item.lat ?? null,
              lng: s.item.lng ?? null,
              distanceKm: s.item.distanceKm ?? null,
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

  // ---------- Share plan ----------
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
    userLat != null && userLng != null && effectiveRadiusKm != null && effectiveRadiusKm > radiusKm
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
    <main className="p-10 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-2">PerfectDay24 🚀</h1>
      <p className="text-gray-600 mb-6">
        Smart Local Planner – mit City, Vorlieben, Gruppe, Umkreis, Dauer & Wegezeit.
      </p>

      {/* Preferences Modal */}
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

      {/* Controls */}
      <div className="p-4 border rounded-lg mb-6 space-y-4">
        <div className="flex gap-3 flex-wrap">
          {/* ✅ City Select (Auto + aktivierte Cities) */}
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

          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as any)} className="border p-2 rounded">
            <option value="match">Sort: Best Match</option>
            <option value="distance">Sort: Distanz</option>
          </select>

          <button onClick={() => setShowPrefsModal(true)} className="border px-3 py-2 rounded text-sm">
            ⚙️ Vorlieben
          </button>
        </div>

        {/* Fullday: Blöcke steuern */}
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
            {userLat && userLng ? (
              <>Standort aktiv ✅</>
            ) : geoError ? (
              <>Standort aus: {geoError}</>
            ) : (
              <>Standort wird geladen…</>
            )}
          </div>
        </div>

        <div className="text-xs text-gray-600">
          City: <span className="font-semibold">{cityLabel}</span> • Zeitbudget: ~{timeBudgetForMode(planMode)} Min • Vorlieben:{" "}
          {effectiveInterests.length ? effectiveInterests.join(", ") : "— (für bessere Ergebnisse Vorlieben setzen)"}
        </div>

        {/* Gruppe */}
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

      {/* Plan header */}
      <div className="flex items-center justify-between gap-4 mb-3">
        <h2 className="text-2xl font-semibold">Dein Plan</h2>
        <button onClick={resetPlan} className="px-3 py-2 rounded border text-sm">
          Plan zurücksetzen
        </button>
      </div>

      {expandedText ? <div className="mb-3 p-3 border rounded-lg text-sm text-gray-700">{expandedText}</div> : null}
      {relaxedText ? <div className="mb-4 p-3 border rounded-lg text-sm text-gray-700">{relaxedText}</div> : null}

      {/* ✅ Map + Travel Summary */}
      <div className="p-4 border rounded-lg mb-6 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-semibold">Route</div>
            <div className="text-xs text-gray-600">
              Echte Wege über OSRM (ohne API-Key). Profil: {routeProfile === "foot" ? "zu Fuß" : "Auto"}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={routeProfile}
              onChange={(e) => setRouteProfile(e.target.value as any)}
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
            <div className="text-xs text-gray-600">Für eine Route brauchen wir mindestens 2 Stops mit Koordinaten.</div>
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
              Route wird berechnet oder ist aktuell nicht verfügbar (du kannst trotzdem „Route öffnen“ nutzen).
              <div className="mt-2">
                Schätzung: ~{fallbackSummary.distanceKm} km • Aktivitäten ~{fallbackSummary.durationMin} Min • Wege ~{fallbackSummary.travelMin} Min • Gesamt ~{fallbackSummary.totalMin} Min
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SAVE BAR */}
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

      {/* Plan stops */}
      {loading ? (
        <div className="p-4 border rounded-lg">Lade Locations…</div>
      ) : results.length === 0 ? (
        <div className="p-4 border rounded-lg">
          Keine Vorschläge. (Tipp: City wechseln oder Umkreis erhöhen.)
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
                          {stop.item.distanceKm != null ? ` • ${stop.item.distanceKm.toFixed(1)} km` : ""}
                        </p>

                        <p className="text-xs text-gray-500 mt-1">
                          Dauer: {stop.durationMin ?? "—"} Min
                          {stop.travelMinFromPrev != null ? ` • Weg: ~${stop.travelMinFromPrev} Min` : ""}
                        </p>
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