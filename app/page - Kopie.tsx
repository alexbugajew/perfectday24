"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type LocationRow = {
  id: string;
  name: string;
  type: string;
  budget?: string | null;
  occasion?: string | null;
  daytime?: string | null;
  lat?: number | null;
  lng?: number | null;
  reservation_url?: string | null;
};

type MatchLevel = "strict" | "relax_daytime" | "relax_budget" | "fallback";

type ScoredLocation = LocationRow & {
  score: number;
  distanceKm: number | null;
  matchLevel: MatchLevel;
};

type PlanSlotKey = "morning" | "afternoon" | "evening" | "night";

type PlanSlot = {
  key: PlanSlotKey;
  label: string;
  hint: string;
  item: ScoredLocation | null;
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
  slots: any; // jsonb
};

function toRad(v: number) {
  return (v * Math.PI) / 180;
}

// Haversine Distanz in KM
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

/**
 * Heuristik: kategorisiert type/name grob.
 */
function classify(loc: LocationRow) {
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
      "kueche",
      "küche"
    )
  )
    return "restaurant";
  if (has("cafe", "café", "coffee", "kaffee", "brunch", "breakfast", "bäck", "baeck", "bakery", "patisserie"))
    return "cafe";
  if (has("museum", "galerie", "theater", "kino", "cinema", "denkmal", "kirche", "castle", "schloss", "aussicht"))
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
      "bowling"
    )
  )
    return "activity";
  if (has("event", "konzert", "concert", "festival", "show", "ticket")) return "event";

  return "other";
}

function slotScore(loc: ScoredLocation, slot: PlanSlotKey) {
  const c = classify(loc);
  const dt = norm(loc.daytime);

  let s = 0;

  s += (loc.score ?? 0) * 10;

  if (dt) {
    if (slot === "morning" && dt === "morning") s += 25;
    if (slot === "afternoon" && dt === "afternoon") s += 25;
    if (slot === "evening" && dt === "evening") s += 25;
    if (slot === "night" && dt === "night") s += 25;
  }

  if (slot === "morning") {
    if (c === "cafe") s += 30;
    if (c === "culture") s += 12;
    if (c === "activity") s += 10;
  }
  if (slot === "afternoon") {
    if (c === "activity") s += 28;
    if (c === "culture") s += 22;
    if (c === "cafe") s += 10;
  }
  if (slot === "evening") {
    if (c === "restaurant") s += 35;
    if (c === "culture") s += 10;
    if (c === "event") s += 10;
  }
  if (slot === "night") {
    if (c === "nightlife") s += 35;
    if (c === "event") s += 18;
  }

  if (typeof loc.distanceKm === "number") {
    const d = Math.max(0, Math.min(50, loc.distanceKm));
    s += Math.round((50 - d) * 0.4); // max +20
  }

  return s;
}

function buildSlotCandidates(results: ScoredLocation[], slot: PlanSlotKey) {
  return [...results]
    .map((x) => ({ item: x, s: slotScore(x, slot) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.item)
    .slice(0, 30);
}

function pickWithOffset(candidates: ScoredLocation[], usedIds: Set<string>, offset: number): ScoredLocation | null {
  if (candidates.length === 0) return null;
  const n = candidates.length;

  for (let i = 0; i < n; i++) {
    const idx = (offset + i) % n;
    const cand = candidates[idx];
    if (!usedIds.has(cand.id)) return cand;
  }
  return null;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [budget, setBudget] = useState("medium");
  const [occasion, setOccasion] = useState("date");
  const [daytime, setDaytime] = useState("evening");

  // Umkreis + Sort
  const [radiusKm, setRadiusKm] = useState(10);
  const [sortMode, setSortMode] = useState<"match" | "distance">("match");

  // User Position
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Plan Swap Offsets
  const [slotOffsets, setSlotOffsets] = useState<Record<PlanSlotKey, number>>({
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
  });

  // Save/Load State
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [plans, setPlans] = useState<SavedPlanRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [planTitle, setPlanTitle] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<SavedPlanRow | null>(null);

  // ✅ mounted sauber setzen (fehlte bei dir zuletzt)
  useEffect(() => setMounted(true), []);

  // ✅ Auth init + Listener (stabil)
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

  // Locations laden
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const { data, error } = await supabase.from("locations").select("*");
      if (error) {
        console.error("Supabase Fehler:", error);
        setLocations([]);
        setLoading(false);
        return;
      }
      setLocations((data as LocationRow[]) ?? []);
      setLoading(false);
    }
    loadData();
  }, []);

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

  const { results, activeLevel, effectiveRadiusKm } = useMemo(() => {
    const withDistance: (LocationRow & { distanceKm: number | null })[] = locations.map((loc) => {
      let distanceKm: number | null = null;

      if (userLat != null && userLng != null && typeof loc.lat === "number" && typeof loc.lng === "number") {
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
      if (b.score !== a.score) return b.score - a.score;
      const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
      return da - db;
    };

    const radiusSteps =
      userLat != null && userLng != null ? uniqueNumbers([radiusKm, 20, 35, 50]).sort((a, b) => a - b) : [radiusKm];

    const withinRadius = (stepRadius: number) =>
      withDistance.filter((x) => {
        if (userLat == null || userLng == null) return true;
        if (x.distanceKm == null) return false;
        return x.distanceKm <= stepRadius;
      });

    const scoreStrict = (x: LocationRow) => {
      const locBudget = x.budget ?? "medium";
      const locOccasion = x.occasion ?? "date";
      const locDaytime = x.daytime ?? "evening";

      let score = 0;
      if (locBudget === budget) score += 2;
      if (locOccasion === occasion) score += 3;
      if (locDaytime === daytime) score += 2;
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

    for (const stepRadius of radiusSteps) {
      const pool = withinRadius(stepRadius);

      const strict: ScoredLocation[] = pool
        .map((x) => ({ ...x, score: scoreStrict(x), matchLevel: "strict" as const }))
        .filter((x) => x.score > 0)
        .sort(sortFn);

      if (strict.length > 0) return { results: strict, activeLevel: "strict" as const, effectiveRadiusKm: stepRadius };

      const relaxDaytime: ScoredLocation[] = pool
        .map((x) => ({ ...x, score: scoreRelaxDaytime(x), matchLevel: "relax_daytime" as const }))
        .filter((x) => x.score > 0)
        .sort(sortFn);

      if (relaxDaytime.length > 0)
        return { results: relaxDaytime, activeLevel: "relax_daytime" as const, effectiveRadiusKm: stepRadius };

      const relaxBudget: ScoredLocation[] = pool
        .map((x) => ({ ...x, score: scoreRelaxBudget(x), matchLevel: "relax_budget" as const }))
        .filter((x) => x.score > 0)
        .sort(sortFn);

      if (relaxBudget.length > 0)
        return { results: relaxBudget, activeLevel: "relax_budget" as const, effectiveRadiusKm: stepRadius };

      if (pool.length > 0) {
        const fallback: ScoredLocation[] = [...pool]
          .map((x) => ({ ...x, score: 0, matchLevel: "fallback" as const }))
          .sort(sortFn)
          .slice(0, 25);

        return { results: fallback, activeLevel: "fallback" as const, effectiveRadiusKm: stepRadius };
      }
    }

    return { results: [] as ScoredLocation[], activeLevel: "fallback" as const, effectiveRadiusKm: radiusKm };
  }, [locations, budget, occasion, daytime, radiusKm, sortMode, userLat, userLng]);

  // Plan Builder (4 Slots)
  const planSlots: PlanSlot[] = useMemo(() => {
    const slotMeta: Array<{ key: PlanSlotKey; label: string; hint: string }> = [
      { key: "morning", label: "Morgen", hint: "Café / Start / leichter Einstieg" },
      { key: "afternoon", label: "Nachmittag", hint: "Aktivität / Sightseeing / Kultur" },
      { key: "evening", label: "Abend", hint: "Dinner / Restaurant / Highlight" },
      { key: "night", label: "Nacht", hint: "Bar / Club / Event" },
    ];

    const slotCandidates: Record<PlanSlotKey, ScoredLocation[]> = {
      morning: buildSlotCandidates(results, "morning"),
      afternoon: buildSlotCandidates(results, "afternoon"),
      evening: buildSlotCandidates(results, "evening"),
      night: buildSlotCandidates(results, "night"),
    };

    const used = new Set<string>();
    const built: PlanSlot[] = [];

    for (const meta of slotMeta) {
      const offset = slotOffsets[meta.key] ?? 0;
      const picked = pickWithOffset(slotCandidates[meta.key], used, offset);
      if (picked) used.add(picked.id);
      built.push({ key: meta.key, label: meta.label, hint: meta.hint, item: picked });
    }

    return built;
  }, [results, slotOffsets]);

  function bumpSlot(key: PlanSlotKey) {
    setSlotOffsets((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
  }

  function resetPlan() {
    setSlotOffsets({ morning: 0, afternoon: 0, evening: 0, night: 0 });
  }

  async function loadPlans() {
    setLoadingPlans(true);
    const { data, error } = await supabase.from("plans").select("*").order("created_at", { ascending: false }).limit(20);

    if (error) {
      console.error("Load Plans Fehler:", error);
      setPlans([]);
      setLoadingPlans(false);
      return;
    }

    setPlans((data as SavedPlanRow[]) ?? []);
    setLoadingPlans(false);
  }

  // Auto-load sobald Auth steht
  useEffect(() => {
    if (!authReady) return;
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady]);

  async function savePlan() {
    setSaving(true);

    if (!authReady) {
      console.error("Auth noch nicht ready – bitte kurz warten.");
      setSaving(false);
      return;
    }
    if (!userId) {
      console.error("Kein User vorhanden – Anonymous Auth fehlt/Session leer.");
      setSaving(false);
      return;
    }

    const slotsPayload = planSlots.map((s) => ({
      slot: s.key,
      label: s.label,
      hint: s.hint,
      location: s.item
        ? {
            id: s.item.id,
            name: s.item.name,
            type: s.item.type,
            reservation_url: s.item.reservation_url ?? null,
            lat: s.item.lat ?? null,
            lng: s.item.lng ?? null,
            distanceKm: s.item.distanceKm ?? null,
            score: s.item.score ?? 0,
            matchLevel: s.item.matchLevel ?? null,
          }
        : null,
    }));

    const payload = {
      user_id: userId,
      title: planTitle.trim() ? planTitle.trim() : null,
      filters: { budget, occasion, daytime },
      radius_km: radiusKm,
      effective_radius_km: effectiveRadiusKm ?? null,
      sort_mode: sortMode,
      active_level: activeLevel ?? null,
      slots: slotsPayload,
    };

    const { error } = await supabase.from("plans").insert(payload as any);
    if (error) {
      console.error("Save Plan Fehler:", error);
      setSaving(false);
      return;
    }

    setPlanTitle("");
    await loadPlans();
    setSaving(false);
  }

  const relaxedText =
    activeLevel === "strict"
      ? null
      : activeLevel === "relax_daytime"
      ? "Keine exakten Treffer – Tageszeit wurde ignoriert, um mehr Vorschläge zu finden."
      : activeLevel === "relax_budget"
      ? "Keine exakten Treffer – Budget und Tageszeit wurden ignoriert, um mehr Vorschläge zu finden."
      : "Keine passenden Treffer – zeige nahe Alternativen im Umkreis.";

  const expandedText =
    userLat != null && userLng != null && effectiveRadiusKm != null && effectiveRadiusKm > radiusKm
      ? `Um mehr Optionen zu finden, haben wir den Umkreis intern auf ${effectiveRadiusKm} km erweitert.`
      : null;

  if (!mounted) return null;

  return (
    <main className="p-10 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-2">PerfectDay24 🚀</h1>
      <p className="text-gray-600 mb-6">Personalisierte Vorschläge – mit Umkreis, Tageszeit & Budget.</p>

      <div className="p-4 border rounded-lg mb-6 space-y-4">
        <div className="flex gap-3 flex-wrap">
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

          <select value={daytime} onChange={(e) => setDaytime(e.target.value)} className="border p-2 rounded">
            <option value="morning">Morgen</option>
            <option value="afternoon">Nachmittag</option>
            <option value="evening">Abend</option>
            <option value="night">Nacht</option>
          </select>

          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as any)} className="border p-2 rounded">
            <option value="match">Sort: Best Match</option>
            <option value="distance">Sort: Distanz</option>
          </select>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <label className="font-medium">Umkreis: {radiusKm} km</label>
          <input type="range" min={1} max={50} value={radiusKm} onChange={(e) => setRadiusKm(parseInt(e.target.value, 10))} />
          <div className="text-sm text-gray-600">
            {userLat && userLng ? <>Standort aktiv ✅</> : geoError ? <>Standort aus: {geoError}</> : <>Standort wird geladen…</>}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 mb-3">
        <h2 className="text-2xl font-semibold">Dein Tagesplan</h2>
        <button onClick={resetPlan} className="px-3 py-2 rounded border text-sm">
          Plan zurücksetzen
        </button>
      </div>

      {expandedText ? <div className="mb-3 p-3 border rounded-lg text-sm text-gray-700">{expandedText}</div> : null}
      {relaxedText ? <div className="mb-4 p-3 border rounded-lg text-sm text-gray-700">{relaxedText}</div> : null}

      {/* SAVE BAR */}
      <div className="p-4 border rounded-lg mb-6 space-y-3">
        <div className="flex gap-3 flex-wrap items-center">
          <input
            value={planTitle}
            onChange={(e) => setPlanTitle(e.target.value)}
            placeholder="Optionaler Titel (z.B. Date in Berlin)"
            className="border p-2 rounded flex-1 min-w-[240px]"
          />

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

        {authReady && userId ? (
          <div className="text-xs text-gray-500">User: {userId.slice(0, 8)}…</div>
        ) : !authReady ? (
          <div className="text-sm text-gray-600">Auth wird vorbereitet…</div>
        ) : (
          <div className="text-sm text-gray-600">Auth bereit, aber keine User-ID (ungewöhnlich) – Console prüfen.</div>
        )}
      </div>

      {loading ? (
        <div className="p-4 border rounded-lg">Lade Locations…</div>
      ) : results.length === 0 ? (
        <div className="p-4 border rounded-lg">Keine Vorschläge.</div>
      ) : (
        <>
          <div className="space-y-4 mb-10">
            {planSlots.map((slot) => (
              <div key={slot.key} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-bold text-lg">{slot.label}</h3>
                      <span className="text-xs px-2 py-1 rounded border text-gray-700">{slot.hint}</span>
                    </div>

                    {slot.item ? (
                      <>
                        <p className="mt-2 font-semibold">{slot.item.name}</p>
                        <p className="text-gray-700">{slot.item.type}</p>
                        <p className="text-sm text-gray-500">
                          Match: {slot.item.score}
                          {slot.item.distanceKm != null ? ` • ${slot.item.distanceKm.toFixed(1)} km` : ""}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-gray-600">Keine passende Location für diesen Slot gefunden.</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 items-end">
                    <button onClick={() => bumpSlot(slot.key)} className="px-3 py-2 rounded bg-black text-white text-sm">
                      Tauschen
                    </button>

                    {slot.item?.reservation_url ? (
                      <a
                        href={slot.item.reservation_url}
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
                <button
                  key={p.id}
                  onClick={() => setSelectedPlan(p)}
                  className="w-full text-left p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{p.title || "Untitled Plan"}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(p.created_at).toLocaleString()} • Budget: {p.filters?.budget} • Occasion:{" "}
                        {p.filters?.occasion}
                      </div>
                    </div>
                    <div className="text-xs px-2 py-1 rounded border">{p.active_level || "n/a"}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedPlan ? (
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="font-semibold">{selectedPlan.title || "Untitled Plan"}</div>
                  <div className="text-xs text-gray-500">
                    Radius: {selectedPlan.radius_km} km • Sort: {selectedPlan.sort_mode}
                  </div>
                </div>
                <button onClick={() => setSelectedPlan(null)} className="px-3 py-2 rounded border text-sm">
                  Schließen
                </button>
              </div>

              <div className="space-y-3">
                {(selectedPlan.slots || []).map((s: any) => (
                  <div key={s.slot} className="p-3 border rounded-lg">
                    <div className="text-sm font-semibold">{s.label}</div>
                    {s.location ? (
                      <>
                        <div className="text-sm">{s.location.name}</div>
                        <div className="text-xs text-gray-500">{s.location.type}</div>
                      </>
                    ) : (
                      <div className="text-xs text-gray-500">—</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}