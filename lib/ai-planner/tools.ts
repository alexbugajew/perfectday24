// AI-Planner Tools: kompakte DB-Wrapper, die das LLM via Function Calling
// aufrufen kann. Output ist bewusst klein gehalten (top N, nur essentielle
// Felder), damit der LLM-Context nicht explodiert.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizePlannerEventTitle } from "@/lib/planner/events";
import { berlinInstant, berlinParts, berlinToday, parseYmd } from "@/lib/planner/berlin-time";
import { familyEventFitsTimeLimits, type FamilyTimeLimits } from "@/lib/planner/family-age";

export type Daytime = "morning" | "midday" | "afternoon" | "evening" | "night";
export type BudgetLevel = "low" | "medium" | "high" | "any";

type LocationRow = {
  id: string;
  name: string;
  type: string | null;
  category: string | null;
  budget: string | null;
  daytime: string | null;
  evening_only: boolean | null;
  family_friendly: boolean | null;
  nightlife_fit: boolean | null;
  lat: number | null;
  lng: number | null;
  opening_hours_raw: string | null;
  duration_min: number | null;
  reservation_url: string | null;
  quality_score: number | null;
  importance_score: number | null;
  popularity_score: number | null;
  manual_boost: number | null;
  tags: string[] | null;
};

export type AiCandidate = {
  id: string;
  name: string;
  type: string;
  category: string;
  budget: string | null;
  duration_min: number | null;
  opening_hours: string | null;
  lat: number | null;
  lng: number | null;
  /** Distance in km vom Startpunkt — nur gesetzt wenn nearLat/nearLng übergeben. */
  distance_km?: number;
  /** 0-100. Höher = besser. Aggregat aus quality/importance/popularity/manual_boost. */
  score?: number;
  /** Curated tags, z.B. ["romantic","live-music","family-friendly"]. */
  tags?: string[];
  /** Nur Events: Beginn/Ende als Berliner Ortszeit "YYYY-MM-DDTHH:MM". */
  event_start_local?: string;
  event_end_local?: string | null;
};

/**
 * Serverseitiger Kontext für Tool-Aufrufe — kommt aus dem Request, nie aus den
 * Tool-Argumenten des Modells, damit es die Familiengrenzen nicht aushebeln kann.
 */
export type AiToolContext = {
  family?: {
    limits: FamilyTimeLimits;
    /** Frühester sinnvoller Event-Beginn im gewählten Tagesfenster, sonst null. */
    earliestEventStartMin: number | null;
  } | null;
};

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const aLatRad = (aLat * Math.PI) / 180;
  const bLatRad = (bLat * Math.PI) / 180;
  const aTrig = sinDLat * sinDLat + Math.cos(aLatRad) * Math.cos(bLatRad) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(aTrig)));
}

function aggregateScore(row: LocationRow): number {
  // Gewichteter Mix der vorhandenen Signale, alles 0-100 normalisiert.
  const quality = row.quality_score ?? 0;
  const importance = row.importance_score ?? 0;
  const popularity = row.popularity_score ?? 0;
  const boost = Math.min(100, Math.max(0, (row.manual_boost ?? 0) * 10));
  return Math.round(quality * 0.45 + importance * 0.25 + popularity * 0.2 + boost * 0.1);
}

function compactRow(
  row: LocationRow,
  near?: { lat: number; lng: number }
): AiCandidate {
  const distance =
    near && typeof row.lat === "number" && typeof row.lng === "number"
      ? Math.round(haversineKm(near.lat, near.lng, row.lat, row.lng) * 10) / 10
      : undefined;
  return {
    id: row.id,
    name: row.name,
    type: row.type ?? "",
    category: row.category ?? "",
    budget: row.budget,
    duration_min: row.duration_min,
    opening_hours: row.opening_hours_raw,
    lat: row.lat,
    lng: row.lng,
    distance_km: distance,
    score: aggregateScore(row),
    tags: row.tags && row.tags.length > 0 ? row.tags.slice(0, 8) : undefined,
  };
}

function applyNearAndSort(
  rows: LocationRow[],
  near?: { lat: number; lng: number; maxKm?: number },
  limit?: number,
  requireTags?: string[]
): AiCandidate[] {
  let candidates = rows.map((r) => compactRow(r, near));
  if (requireTags && requireTags.length > 0) {
    candidates = filterByTags(candidates, requireTags);
  }
  if (near?.maxKm) {
    candidates = candidates.filter(
      (c) => c.distance_km === undefined || c.distance_km <= near.maxKm!
    );
  }
  if (near) {
    // Combo-Sort: erst Distanz, dann Score als Tie-Breaker (Top-Locations <500m gewinnen vor schwachen <2km).
    candidates.sort((a, b) => {
      const da = a.distance_km ?? 999;
      const db = b.distance_km ?? 999;
      const bucketA = Math.floor(da * 2);
      const bucketB = Math.floor(db * 2);
      if (bucketA !== bucketB) return bucketA - bucketB;
      return (b.score ?? 0) - (a.score ?? 0);
    });
  } else {
    candidates.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }
  return typeof limit === "number" ? candidates.slice(0, limit) : candidates;
}

function budgetValues(level: BudgetLevel): string[] | null {
  if (level === "low") return ["free", "low"];
  if (level === "medium") return ["low", "medium"];
  if (level === "high") return ["medium", "high"];
  return null;
}

const SELECT_COLS =
  "id,name,type,category,budget,daytime,evening_only,family_friendly,nightlife_fit,lat,lng,opening_hours_raw,duration_min,reservation_url,quality_score,importance_score,popularity_score,manual_boost,tags";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runQuery(builder: any): Promise<LocationRow[]> {
  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  return (data ?? []) as LocationRow[];
}

type NearArgs = { nearLat?: number; nearLng?: number; maxKm?: number };
type TagArgs = { requireTags?: string[] };

function near(args: NearArgs): { lat: number; lng: number; maxKm?: number } | undefined {
  if (typeof args.nearLat === "number" && typeof args.nearLng === "number") {
    return { lat: args.nearLat, lng: args.nearLng, maxKm: args.maxKm };
  }
  return undefined;
}

function filterByTags(candidates: AiCandidate[], requireTags?: string[]): AiCandidate[] {
  if (!requireTags || requireTags.length === 0) return candidates;
  return candidates.filter((c) => {
    if (!c.tags || c.tags.length === 0) return false;
    return requireTags.some((t) => c.tags!.includes(t));
  });
}

// Wir fetchen einen größeren Pool als der LLM braucht, damit applyNearAndSort
// sinnvoll filtern + sortieren kann. limit aus args bestimmt dann das Endpaket.
const POOL_SIZE = 60;

export async function findFood(args: {
  citySlug: string;
  meal?: "breakfast" | "lunch" | "dinner" | "any";
  budget?: BudgetLevel;
  limit?: number;
} & NearArgs & TagArgs): Promise<AiCandidate[]> {
  const sb = getSupabase();
  const limit = Math.min(args.limit ?? 8, 15);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = sb
    .from("locations")
    .select(SELECT_COLS)
    .eq("city_slug", args.citySlug)
    .eq("is_plannable", true)
    .in("type", ["restaurant", "cafe"])
    .order("quality_score", { ascending: false, nullsFirst: false })
    .order("manual_boost", { ascending: false })
    .limit(POOL_SIZE);

  const bv = budgetValues(args.budget ?? "any");
  if (bv) query = query.in("budget", bv);
  if (args.meal === "breakfast") query = query.eq("type", "cafe");
  if (args.meal === "dinner") query = query.neq("evening_only", false);

  const rows = await runQuery(query);
  return applyNearAndSort(rows, near(args), limit, args.requireTags);
}

export async function findCulture(args: {
  citySlug: string;
  budget?: BudgetLevel;
  limit?: number;
} & NearArgs & TagArgs): Promise<AiCandidate[]> {
  const sb = getSupabase();
  const limit = Math.min(args.limit ?? 8, 15);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = sb
    .from("locations")
    .select(SELECT_COLS)
    .eq("city_slug", args.citySlug)
    .eq("is_plannable", true)
    .eq("category", "culture")
    .order("quality_score", { ascending: false, nullsFirst: false })
    .order("manual_boost", { ascending: false })
    .limit(POOL_SIZE);

  const bv = budgetValues(args.budget ?? "any");
  if (bv) query = query.in("budget", bv);

  const rows = await runQuery(query);
  return applyNearAndSort(rows, near(args), limit, args.requireTags);
}

export async function findActivity(args: {
  citySlug: string;
  familyFriendly?: boolean;
  limit?: number;
} & NearArgs & TagArgs): Promise<AiCandidate[]> {
  const sb = getSupabase();
  const limit = Math.min(args.limit ?? 8, 15);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = sb
    .from("locations")
    .select(SELECT_COLS)
    .eq("city_slug", args.citySlug)
    .eq("is_plannable", true)
    .eq("category", "activity")
    .order("quality_score", { ascending: false, nullsFirst: false })
    .order("manual_boost", { ascending: false })
    .limit(POOL_SIZE);

  if (args.familyFriendly === true) query = query.eq("family_friendly", true);

  const rows = await runQuery(query);
  return applyNearAndSort(rows, near(args), limit, args.requireTags);
}

export async function findNightlife(args: {
  citySlug: string;
  limit?: number;
} & NearArgs & TagArgs): Promise<AiCandidate[]> {
  const sb = getSupabase();
  const limit = Math.min(args.limit ?? 6, 12);
  const { data, error } = await sb
    .from("locations")
    .select(SELECT_COLS)
    .eq("city_slug", args.citySlug)
    .eq("is_plannable", true)
    .eq("category", "nightlife")
    .order("quality_score", { ascending: false, nullsFirst: false })
    .order("manual_boost", { ascending: false })
    .limit(POOL_SIZE);
  if (error) throw new Error(`findNightlife: ${error.message}`);
  return applyNearAndSort((data ?? []) as LocationRow[], near(args), limit, args.requireTags);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

/** Instant → "YYYY-MM-DDTHH:MM" Berliner Ortszeit (ohne Zone, für das Modell). */
function berlinLocalIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const p = berlinParts(date);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
}

export async function findEvent(args: {
  citySlug: string;
  date: string; // YYYY-MM-DD
  limit?: number;
} & NearArgs & TagArgs, toolContext: AiToolContext = {}): Promise<AiCandidate[]> {
  const sb = getSupabase();
  const limit = Math.min(args.limit ?? 6, 12);
  // Berliner Kalendertag statt UTC-Mitternacht: Vorher fielen Events zwischen
  // 00:00 und 02:00 Ortszeit auf den Vortag, späte Events des Vortags dafür
  // in den gesuchten Tag.
  const ymd = parseYmd(args.date) ?? berlinToday();
  const dayStart = berlinInstant(ymd, 0).toISOString();
  const dayEnd = berlinInstant(ymd, 24 * 60).toISOString();
  // Spaltennamen in planner_events: title (nicht name), start_at/end_at (nicht
  // starts_at/ends_at). Mit den falschen Namen antwortete PostgREST mit 42703,
  // und weil hier geworfen wird, ist jede Event-Suche des KI-Planners
  // abgebrochen — die Tabelle enthält knapp 34.000 Termine.
  const { data, error } = await sb
    .from("planner_events")
    .select("id,title,category,start_at,end_at,venue_name,lat,lng,ticket_url,family_friendly")
    .eq("city_slug", args.citySlug)
    .eq("status", "scheduled")
    .gte("start_at", dayStart)
    .lt("start_at", dayEnd)
    .order("start_at", { ascending: true })
    .limit(40);
  if (error) throw new Error(`findEvent: ${error.message}`);

  const n = near(args);
  const family = toolContext.family ?? null;
  // Familien bekommen nur Events, die vor der Altersgrenze liegen (Praxisfall
  // Berlin Sa 17.10.: alle 11 Tages-Events 19:00–20:30, Comedy/Konzerte) —
  // familienfreundlich markierte zuerst.
  const rows = (data ?? [])
    .filter(
      (e) =>
        !family ||
        familyEventFitsTimeLimits({
          limits: family.limits,
          startAt: e.start_at ? new Date(e.start_at) : null,
          endAt: e.end_at ? new Date(e.end_at) : null,
          durationMin: 90,
          earliestStartMin: family.earliestEventStartMin,
        })
    )
    .sort((a, b) =>
      family ? Number(b.family_friendly === true) - Number(a.family_friendly === true) : 0
    );
  const candidates: AiCandidate[] = rows.map((e) => {
    const distance =
      n && typeof e.lat === "number" && typeof e.lng === "number"
        ? Math.round(haversineKm(n.lat, n.lng, e.lat, e.lng) * 10) / 10
        : undefined;
    return {
      id: e.id,
      // Gleiche Bereinigung wie im Planner: Quellen stellen dem Namen
      // gelegentlich die Datumsspanne des Gesamtfestivals voran.
      name: normalizePlannerEventTitle(e.title),
      type: "event",
      category: e.category ?? "event",
      budget: null,
      duration_min: 90,
      // Ortszeit statt roher UTC-ISO — das Modell las "17:00:00+00:00" sonst
      // als 17 Uhr, gemeint war 19 Uhr Berliner Zeit.
      opening_hours: `${berlinLocalIso(e.start_at)?.slice(11) ?? "?"}–${
        berlinLocalIso(e.end_at)?.slice(11) ?? "?"
      } Uhr Ortszeit${e.venue_name ? ` @ ${e.venue_name}` : ""}`,
      lat: e.lat,
      lng: e.lng,
      distance_km: distance,
      tags: e.family_friendly === true ? ["family-friendly"] : undefined,
      event_start_local: berlinLocalIso(e.start_at) ?? undefined,
      event_end_local: berlinLocalIso(e.end_at),
    };
  });
  let filtered = candidates;
  if (n?.maxKm) {
    filtered = candidates.filter((c) => c.distance_km === undefined || c.distance_km <= n.maxKm!);
  }
  return filtered.slice(0, limit);
}

// Tool-Schema für OpenAI Function Calling.
export const AI_PLANNER_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "find_food",
      description:
        "Restaurants/Cafés. Liefert pro Kandidat: id (UUID — NUR diese verwenden), name, score (0-100, höher=besser), tags (curated), distance_km (wenn nearLat/nearLng angegeben).",
      parameters: {
        type: "object",
        properties: {
          citySlug: { type: "string", description: "City slug, e.g. 'muenchen' or 'berlin-berlin'" },
          meal: { type: "string", enum: ["breakfast", "lunch", "dinner", "any"], default: "any" },
          budget: { type: "string", enum: ["low", "medium", "high", "any"], default: "any" },
          nearLat: { type: "number", description: "Optional: Latitude vom Startpunkt." },
          nearLng: { type: "number", description: "Optional: Longitude vom Startpunkt." },
          maxKm: { type: "number", description: "Optional: Max Distanz in km vom Startpunkt." },
          limit: { type: "number", default: 8, maximum: 15 },
        },
        required: ["citySlug"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_culture",
      description: "Find museums, galleries, theaters, cinemas in the city.",
      parameters: {
        type: "object",
        properties: {
          citySlug: { type: "string" },
          nearLat: { type: "number", description: "Optional: Latitude vom Startpunkt. Wenn gesetzt, werden nahe Locations bevorzugt." },
          nearLng: { type: "number", description: "Optional: Longitude vom Startpunkt." },
          maxKm: { type: "number", description: "Optional: Locations weiter als maxKm vom Startpunkt werden verworfen." },
          requireTags: {
            type: "array",
            items: { type: "string" },
            description: "Optional: Nur Locations zurückgeben, die mind. einen dieser Vibe-Tags haben. Beispiele: 'romantic', 'kid-friendly', 'live-music', 'date-friendly', 'hip', 'refined', 'lively', 'cozy', 'outdoor', 'late-night'.",
          },
          budget: { type: "string", enum: ["low", "medium", "high", "any"], default: "any" },
          limit: { type: "number", default: 8, maximum: 15 },
        },
        required: ["citySlug"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_activity",
      description: "Find parks, attractions, outdoor experiences, tours in the city.",
      parameters: {
        type: "object",
        properties: {
          citySlug: { type: "string" },
          nearLat: { type: "number", description: "Optional: Latitude vom Startpunkt. Wenn gesetzt, werden nahe Locations bevorzugt." },
          nearLng: { type: "number", description: "Optional: Longitude vom Startpunkt." },
          maxKm: { type: "number", description: "Optional: Locations weiter als maxKm vom Startpunkt werden verworfen." },
          requireTags: {
            type: "array",
            items: { type: "string" },
            description: "Optional: Nur Locations zurückgeben, die mind. einen dieser Vibe-Tags haben. Beispiele: 'romantic', 'kid-friendly', 'live-music', 'date-friendly', 'hip', 'refined', 'lively', 'cozy', 'outdoor', 'late-night'.",
          },
          familyFriendly: { type: "boolean", default: false },
          limit: { type: "number", default: 8, maximum: 15 },
        },
        required: ["citySlug"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_nightlife",
      description: "Find bars, pubs, biergartens, clubs for evening/night slots.",
      parameters: {
        type: "object",
        properties: {
          citySlug: { type: "string" },
          nearLat: { type: "number", description: "Optional: Latitude vom Startpunkt. Wenn gesetzt, werden nahe Locations bevorzugt." },
          nearLng: { type: "number", description: "Optional: Longitude vom Startpunkt." },
          maxKm: { type: "number", description: "Optional: Locations weiter als maxKm vom Startpunkt werden verworfen." },
          requireTags: {
            type: "array",
            items: { type: "string" },
            description: "Optional: Nur Locations zurückgeben, die mind. einen dieser Vibe-Tags haben. Beispiele: 'romantic', 'kid-friendly', 'live-music', 'date-friendly', 'hip', 'refined', 'lively', 'cozy', 'outdoor', 'late-night'.",
          },
          limit: { type: "number", default: 6, maximum: 12 },
        },
        required: ["citySlug"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_event",
      description:
        "Find scheduled events (concerts, shows, festivals) on a specific date in the city. Use this for plans with 'live concert', 'event', 'show'.",
      parameters: {
        type: "object",
        properties: {
          citySlug: { type: "string" },
          nearLat: { type: "number", description: "Optional: Latitude vom Startpunkt. Wenn gesetzt, werden nahe Locations bevorzugt." },
          nearLng: { type: "number", description: "Optional: Longitude vom Startpunkt." },
          maxKm: { type: "number", description: "Optional: Locations weiter als maxKm vom Startpunkt werden verworfen." },
          requireTags: {
            type: "array",
            items: { type: "string" },
            description: "Optional: Nur Locations zurückgeben, die mind. einen dieser Vibe-Tags haben. Beispiele: 'romantic', 'kid-friendly', 'live-music', 'date-friendly', 'hip', 'refined', 'lively', 'cozy', 'outdoor', 'late-night'.",
          },
          date: { type: "string", description: "ISO date YYYY-MM-DD" },
          limit: { type: "number", default: 6, maximum: 12 },
        },
        required: ["citySlug", "date"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "build_final_plan",
      description:
        "FINALE-Aktion: Wenn du genug Kandidaten hast, ruf NUR dieses Tool auf um den fertigen Plan abzuliefern. Danach wird nichts mehr gemacht. Alle location_ids MUESSEN exakt einer id aus den vorherigen Tool-Returns entsprechen.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "Kurze Beschreibung was den Plan ausmacht. Max 200 Zeichen, deutsch.",
            maxLength: 220,
          },
          stops: {
            type: "array",
            minItems: 2,
            maxItems: 8,
            items: {
              type: "object",
              properties: {
                location_id: {
                  type: "string",
                  description: "UUID einer Location/Event aus den Tool-Returns. NIEMALS Name verwenden.",
                },
                label: {
                  type: "string",
                  description: "Z.B. 'Aperitif', 'Dinner', 'Hauptmoment', 'Ausklang'.",
                  maxLength: 40,
                },
                hint: {
                  type: "string",
                  description: "Was passiert hier konkret. 1 Satz.",
                  maxLength: 160,
                },
                scheduled_start_at: {
                  type: "string",
                  description: "ISO timestamp im Plan-Datum.",
                },
                duration_min: {
                  type: "integer",
                  minimum: 15,
                  maximum: 240,
                },
                source: {
                  type: "string",
                  enum: ["location", "event"],
                },
              },
              required: ["location_id", "label", "scheduled_start_at", "duration_min", "source"],
            },
          },
        },
        required: ["summary", "stops"],
      },
    },
  },
] as const;

export type ToolName = "find_food" | "find_culture" | "find_activity" | "find_nightlife" | "find_event";

export async function callTool(
  name: ToolName,
  args: Record<string, unknown>,
  toolContext: AiToolContext = {}
): Promise<AiCandidate[]> {
  switch (name) {
    case "find_food":
      return findFood(args as Parameters<typeof findFood>[0]);
    case "find_culture":
      return findCulture(args as Parameters<typeof findCulture>[0]);
    case "find_activity":
      return findActivity(args as Parameters<typeof findActivity>[0]);
    case "find_nightlife":
      return findNightlife(args as Parameters<typeof findNightlife>[0]);
    case "find_event":
      return findEvent(args as Parameters<typeof findEvent>[0], toolContext);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
