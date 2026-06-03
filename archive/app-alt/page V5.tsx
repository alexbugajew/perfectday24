// app/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";

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

type StartPointMode = "current_location" | "custom";
type StartPointType = "address" | "hotel" | "station" | "airport" | "other";

type StartPoint = {
  mode: StartPointMode;
  type: StartPointType;
  label: string;
  lat: number | null;
  lng: number | null;
};

type LocationRow = {
  id: string;
  name: string;
  type: string;
  budget?: string | null;
  occasion?: string | null;
  daytime?: string | null;
  category?: LocationCategory;
  meal?: MealType;
  manual_category?: LocationCategory;
  manual_meal?: MealType;
  lat?: number | null;
  lng?: number | null;
  reservation_url?: string | null;
  duration_min?: number | null;
  tags?: any;
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
  score: number;
  distanceKm: number | null;
  matchLevel: MatchLevel;
  prefBoost: number;
  totalScore: number;
};

type PlanMode = "morning" | "midday" | "evening" | "fullday";

type PlannedStop = {
  index: number;
  label: string;
  hint: string;
  item: ScoredLocation | null;
  durationMin: number | null;
  travelMinFromPrev: number | null;
  reasons: string[];
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

function parseNullableNumber(v: string) {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
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

function normalizeDaytime(v: string | null | undefined): "morning" | "midday" | "evening" | "night" | null {
  const x = norm(v);
  if (!x) return null;

  if (x === "afternoon") return "evening";
  if (x === "mittag") return "midday";
  if (x === "vormittag") return "morning";
  if (x === "abend") return "evening";
  if (x === "nacht") return "night";

  if (x === "morning" || x === "midday" || x === "evening" || x === "night") return x;
  return null;
}

function classify(loc: LocationRow): LocationCategory {
  const manual = loc.manual_category as LocationCategory | null;
  if (manual) return manual;

  const dbCat = loc.category as LocationCategory | null;
  if (dbCat) return dbCat;

  const t0 = norm(loc.type);

  const typeMap: Record<string, Exclude<LocationCategory, null>> = {
    cafe: "cafe",
    restaurant: "restaurant",
    fast_food: "restaurant",
    food: "restaurant",
    ice_cream: "cafe",
    internet_cafe: "cafe",
    biergarten: "nightlife",
    bar: "nightlife",
    pub: "nightlife",
    nightclub: "nightlife",
    club: "nightlife",
    museum: "culture",
    gallery: "culture",
    theatre: "culture",
    cinema: "culture",
    arts_centre: "culture",
    planetarium: "culture",
    library: "culture",
    attraction: "activity",
    park: "activity",
    sports_centre: "activity",
    fitness_centre: "activity",
    bowling_alley: "activity",
    miniature_golf: "activity",
    trampoline_park: "activity",
    water_park: "activity",
    sauna: "activity",
    public_bath: "activity",
    dog_park: "activity",
    dojo: "activity",
    zoo: "activity",
    events_venue: "event",
    event: "event",
  };

  if (t0 && typeMap[t0]) return typeMap[t0];

  const t = `${norm(loc.type)} ${norm(loc.name)}`;
  const has = (...words: string[]) => words.some((w) => t.includes(w));

  if (has("club", "disco", "nacht", "bar", "lounge", "pub", "cocktail", "party")) return "nightlife";
  if (
    has(
      "restaurant",
      "dinner",
      "fine",
      "gourmet",
      "steak",
      "sushi",
      "pizzeria",
      "italien",
      "asi",
      "tapas",
      "brasserie",
      "bistro",
      "kitchen",
      "küche",
      "küche",
      "mittag",
      "lunch",
      "abend"
    )
  )
    return "restaurant";
  if (
    has(
      "cafe",
      "café",
      "coffee",
      "kaffee",
      "brunch",
      "breakfast",
      "frühstück",
      "frühstück",
      "bäck",
      "baeck",
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
      "denkmal",
      "kirche",
      "castle",
      "schloss",
      "aussicht"
    )
  )
    return "culture";
  if (
    has(
      "park",
      "wander",
      "hike",
      "trail",
      "see",
      "lake",
      "boot",
      "zoo",
      "freizeitpark",
      "klettern",
      "sport",
      "bowling",
      "escape",
      "minigolf"
    )
  )
    return "activity";
  if (has("event", "konzert", "concert", "festival", "show", "ticket")) return "event";

  return "other";
}

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

function bucketForCategory(cat: LocationCategory): "food" | "culture" | "activity" | "nightlife" | "other" {
  if (cat === "cafe" || cat === "restaurant") return "food";
  if (cat === "culture") return "culture";
  if (cat === "activity" || cat === "event") return "activity";
  if (cat === "nightlife") return "nightlife";
  return "other";
}

function occasionBonus(occasion: string, cand: LocationRow) {
  const cat = classify(cand);

  if (occasion === "date") {
    if (cat === "cafe") return 10;
    if (cat === "culture") return 14;
    if (cat === "nightlife") return 12;
    if (cat === "activity") return 6;
    return 0;
  }

  if (occasion === "friends") {
    if (cat === "activity") return 14;
    if (cat === "nightlife") return 12;
    if (cat === "restaurant") return 8;
    return 0;
  }

  if (occasion === "family") {
    if (cat === "activity") return 12;
    if (cat === "culture") return 10;
    if (cat === "cafe") return 8;
    return 0;
  }

  if (occasion === "party") {
    if (cat === "nightlife") return 18;
    if (cat === "restaurant") return 8;
    return 0;
  }

  if (occasion === "tourism") {
    if (cat === "culture") return 16;
    if (cat === "activity") return 12;
    if (cat === "cafe") return 6;
    return 0;
  }

  return 0;
}

function diversityPenalty(prev: ScoredLocation | null, cand: LocationRow, slotKind: SlotKind) {
  if (!prev) return 0;

  const prevCat = classify(prev);
  const candCat = classify(cand);

  if (prevCat && candCat && prevCat === candCat) {
    const isMeal = slotKind === "breakfast" || slotKind === "lunch" || slotKind === "dinner";
    return isMeal ? 10 : 22;
  }

  const b1 = bucketForCategory(prevCat);
  const b2 = bucketForCategory(candCat);
  if (b1 === b2) return 8;

  return 0;
}

function overusePenalty(usedCats: LocationCategory[], cand: LocationRow) {
  const candCat = classify(cand);
  if (!candCat) return 0;

  const usedBuckets = usedCats.map(bucketForCategory);
  const candBucket = bucketForCategory(candCat);
  const count = usedBuckets.filter((b) => b === candBucket).length;

  if (candBucket === "food") {
    if (count >= 2) return 18;
    if (count === 1) return 8;
    return 0;
  }

  if (candBucket === "culture" || candBucket === "activity") {
    if (count >= 2) return 12;
    if (count === 1) return 5;
    return 0;
  }

  if (candBucket === "nightlife") {
    if (count >= 1) return 10;
    return 0;
  }

  return 0;
}

function foodOverweightPenalty(usedCats: LocationCategory[], cand: LocationRow) {
  const cat = classify(cand);
  if (cat !== "restaurant" && cat !== "cafe") return 0;

  const foodCount = usedCats.filter((c) => c === "restaurant" || c === "cafe").length;

  if (foodCount >= 3) return 25;
  if (foodCount >= 2) return 14;
  if (foodCount >= 1) return 6;

  return 0;
}

function buildReasons(params: {
  cand: LocationRow;
  occasion: string;
  strictMatch: boolean;
  travelMin: number | null;
  prefBoost: number;
  usedCats: LocationCategory[];
  slotKind: SlotKind;
}) {
  const { cand, occasion, strictMatch, travelMin, prefBoost, usedCats, slotKind } = params;

  const reasons: string[] = [];
  const cat = classify(cand);

  if (strictMatch) {
    if (slotKind === "breakfast") reasons.push("passt perfekt zum Frühstücks-Slot");
    else if (slotKind === "lunch") reasons.push("passt gut zum Lunch-Slot");
    else if (slotKind === "dinner") reasons.push("passt gut zum Dinner-Slot");
    else if (slotKind === "activity") reasons.push("passt gut als Aktivität");
  }

  if (prefBoost > 0) reasons.push("passt zu deinen Vorlieben");

  if (travelMin != null) {
    if (travelMin <= 10) reasons.push("sehr kurze Wegezeit");
    else if (travelMin <= 20) reasons.push("gut erreichbar");
  }

  if (occasion === "date" && (cat === "cafe" || cat === "culture" || cat === "nightlife")) {
    reasons.push("passt gut zu einem Date");
  }

  if (occasion === "friends" && (cat === "activity" || cat === "nightlife")) {
    reasons.push("passt gut für Freunde/Gruppen");
  }

  if (occasion === "family" && (cat === "activity" || cat === "culture")) {
    reasons.push("familienfreundliche Option");
  }

  if (occasion === "party" && cat === "nightlife") {
    reasons.push("starker Party-/Nightlife-Fit");
  }

  if (occasion === "tourism" && (cat === "culture" || cat === "activity")) {
    reasons.push("gut für Tourismus / Entdecken");
  }

  const foodCount = usedCats.filter((c) => c === "restaurant" || c === "cafe").length;
  if ((cat === "activity" || cat === "culture" || cat === "nightlife") && foodCount >= 1) {
    reasons.push("sorgt für mehr Abwechslung im Plan");
  }

  return reasons.slice(0, 4);
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

  const { results, activeLevel, effectiveRadiusKm } = useMemo(() => {
    const merged = mergeInterests(interests, groupMembers, groupEnabled);
    const wMap = interestWeights(interests, groupMembers, groupEnabled);
    const interestKeywords = buildInterestKeywords(merged);

    const preferredDaytimes = preferredDaytimesForMode(planMode);

    const originLat = effectiveStartPoint.lat;
    const originLng = effectiveStartPoint.lng;

    const withDistance: (LocationRow & { distanceKm: number | null })[] = locations.map((loc) => {
      let distanceKm: number | null = null;
      if (
        originLat != null &&
        originLng != null &&
        typeof loc.lat === "number" &&
        typeof loc.lng === "number"
      ) {
        distanceKm = haversineKm(originLat, originLng, loc.lat, loc.lng);
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
      originLat != null && originLng != null
        ? uniqueNumbers([radiusKm, 20, 35, 50]).sort((a, b) => a - b)
        : [radiusKm];

    const withinRadius = (stepRadius: number) =>
      withDistance.filter((x) => {
        if (originLat == null || originLng == null) return true;
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

      if (strict.length > 0) return { results: strict, activeLevel: "strict" as const, effectiveRadiusKm: stepRadius };

      const relaxDaytime: ScoredLocation[] = pool
        .map((x) => {
          const base = scoreRelaxDaytime(x);
          const pb = preferenceBoost(x, interestKeywords, wMap);
          const total = totalize(base, pb);
          return { ...x, score: base, prefBoost: pb, totalScore: total, matchLevel: "relax_daytime" as const };
        })
        .filter((x) => x.score > 0 || x.prefBoost > 0)
        .sort(sortFn);

      if (relaxDaytime.length > 0) return { results: relaxDaytime, activeLevel: "relax_daytime" as const, effectiveRadiusKm: stepRadius };

      const relaxBudget: ScoredLocation[] = pool
        .map((x) => {
          const base = scoreRelaxBudget(x);
          const pb = preferenceBoost(x, interestKeywords, wMap);
          const total = totalize(base, pb);
          return { ...x, score: base, prefBoost: pb, totalScore: total, matchLevel: "relax_budget" as const };
        })
        .filter((x) => x.score > 0 || x.prefBoost > 0)
        .sort(sortFn);

      if (relaxBudget.length > 0) return { results: relaxBudget, activeLevel: "relax_budget" as const, effectiveRadiusKm: stepRadius };

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
    effectiveStartPoint,
    interests,
    planMode,
    groupEnabled,
    groupMembers,
  ]);

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
      const strict = candidates.filter((c) => slotCategoryMatch(kind, c));
      if (strict.length > 0) return strict;

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
          reasons: [],
        });
        continue;
      }

      const usedCatsArr = [...usedCats];

      const scored = pool
        .map((cand) => {
          let travelMin: number | null = null;

          const anchorLat = prev?.lat ?? effectiveStartPoint.lat;
          const anchorLng = prev?.lng ?? effectiveStartPoint.lng;

          if (anchorLat != null && anchorLng != null && cand.lat != null && cand.lng != null) {
            const travelKm = haversineKm(anchorLat, anchorLng, cand.lat, cand.lng);
            travelMin = estimateTravelMinFromKm(travelKm);
          }

          const travelPenalty = travelMin != null ? Math.min(40, Math.round(travelMin / 3)) : 0;

          const isMealSlot = slot.kind === "breakfast" || slot.kind === "lunch" || slot.kind === "dinner";
          const strictMatch = slotCategoryMatch(slot.kind, cand);

          const slotBoost =
            isMealSlot ? (strictMatch ? 35 : 10) :
            slot.kind === "activity" ? (strictMatch ? 18 : 6) :
            0;

          const divPenalty = diversityPenalty(prev, cand, slot.kind);
          const overPenalty = overusePenalty(usedCatsArr, cand);
          const foodPenalty = foodOverweightPenalty(usedCatsArr, cand);
          const occBonus = occasionBonus(occasion, cand);

          let afterBoost = 0;
          if (slot.kind === "anything" && planMode === "evening") {
            const cc = classify(cand);
            if (cc === "nightlife") afterBoost = 14;
          }

          const total =
            cand.totalScore
            - travelPenalty
            - divPenalty
            - overPenalty
            - foodPenalty
            + slotBoost
            + occBonus
            + afterBoost;

          return { cand, total, travelMin, dur: estimateDurationMin(cand) };
        })
        .sort((a, b) => b.total - a.total);

      let found: ScoredLocation | null = null;
      let foundTravel: number | null = null;
      let foundDur: number | null = null;
      let foundReasons: string[] = [];

      for (let k = 0; k < scored.length; k++) {
        const idx = (offset + k) % scored.length;
        const entry = scored[idx];
        const cand = entry.cand;

        if (usedIds.has(cand.id)) continue;

        const add = (entry.travelMin ?? 0) + entry.dur;
        if (timeUsed + add <= budgetMin + buffer) {
          found = cand;
          foundTravel = entry.travelMin;
          foundDur = entry.dur;

          foundReasons = buildReasons({
            cand,
            occasion,
            strictMatch: slotCategoryMatch(slot.kind, cand),
            travelMin: entry.travelMin,
            prefBoost: cand.prefBoost ?? 0,
            usedCats: usedCatsArr,
            slotKind: slot.kind,
          });

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
        reasons: found ? foundReasons : [],
      });

      if (found) {
        usedIds.add(found.id);
        usedCats.push(classify(found));
        prev = found;
      }
    }

    return out;
  }, [results, planMode, slots, slotCount, stopOffsets, occasion, effectiveStartPoint]);

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

  const fallbackSummary = useMemo(() => {
    let distKm = 0;
    let travelMin = 0;

    for (let i = 1; i < mapStops.length; i++) {
      const a = mapStops[i - 1];
      const b = mapStops[i];
      const d = haversineKm(a.lat, a.lng, b.lat, b.lng);
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
  }, [plannedStops, mapStops]);

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

          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as any)} className="border p-2 rounded">
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
                Schätzung: ~{fallbackSummary.distanceKm} km • Aktivitäten ~{fallbackSummary.durationMin} Min • Wege ~{fallbackSummary.travelMin} Min • Gesamt ~{fallbackSummary.totalMin} Min
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
                          {stop.item.distanceKm != null ? ` • ${stop.item.distanceKm.toFixed(1)} km vom Start` : ""}
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