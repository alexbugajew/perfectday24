// AI-Planner Tools: kompakte DB-Wrapper, die das LLM via Function Calling
// aufrufen kann. Output ist bewusst klein gehalten (top N, nur essentielle
// Felder), damit der LLM-Context nicht explodiert.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
};

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

function compactRow(row: LocationRow): AiCandidate {
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
  };
}

function budgetValues(level: BudgetLevel): string[] | null {
  if (level === "low") return ["free", "low"];
  if (level === "medium") return ["low", "medium"];
  if (level === "high") return ["medium", "high"];
  return null;
}

const SELECT_COLS =
  "id,name,type,category,budget,daytime,evening_only,family_friendly,nightlife_fit,lat,lng,opening_hours_raw,duration_min,reservation_url";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runQuery(builder: any): Promise<LocationRow[]> {
  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  return (data ?? []) as LocationRow[];
}

export async function findFood(args: {
  citySlug: string;
  meal?: "breakfast" | "lunch" | "dinner" | "any";
  budget?: BudgetLevel;
  limit?: number;
}): Promise<AiCandidate[]> {
  const sb = getSupabase();
  const limit = Math.min(args.limit ?? 8, 15);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = sb
    .from("locations")
    .select(SELECT_COLS)
    .eq("city_slug", args.citySlug)
    .eq("is_plannable", true)
    .in("type", ["restaurant", "cafe"])
    .order("manual_boost", { ascending: false })
    .limit(limit);

  const bv = budgetValues(args.budget ?? "any");
  if (bv) query = query.in("budget", bv);
  if (args.meal === "breakfast") query = query.eq("type", "cafe");
  if (args.meal === "dinner") query = query.neq("evening_only", false);

  const rows = await runQuery(query);
  return rows.map(compactRow);
}

export async function findCulture(args: {
  citySlug: string;
  budget?: BudgetLevel;
  limit?: number;
}): Promise<AiCandidate[]> {
  const sb = getSupabase();
  const limit = Math.min(args.limit ?? 8, 15);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = sb
    .from("locations")
    .select(SELECT_COLS)
    .eq("city_slug", args.citySlug)
    .eq("is_plannable", true)
    .eq("category", "culture")
    .order("manual_boost", { ascending: false })
    .limit(limit);

  const bv = budgetValues(args.budget ?? "any");
  if (bv) query = query.in("budget", bv);

  const rows = await runQuery(query);
  return rows.map(compactRow);
}

export async function findActivity(args: {
  citySlug: string;
  familyFriendly?: boolean;
  limit?: number;
}): Promise<AiCandidate[]> {
  const sb = getSupabase();
  const limit = Math.min(args.limit ?? 8, 15);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = sb
    .from("locations")
    .select(SELECT_COLS)
    .eq("city_slug", args.citySlug)
    .eq("is_plannable", true)
    .eq("category", "activity")
    .order("manual_boost", { ascending: false })
    .limit(limit);

  if (args.familyFriendly === true) query = query.eq("family_friendly", true);

  const rows = await runQuery(query);
  return rows.map(compactRow);
}

export async function findNightlife(args: {
  citySlug: string;
  limit?: number;
}): Promise<AiCandidate[]> {
  const sb = getSupabase();
  const limit = Math.min(args.limit ?? 6, 12);
  const { data, error } = await sb
    .from("locations")
    .select(
      "id,name,type,category,budget,daytime,evening_only,family_friendly,nightlife_fit,lat,lng,opening_hours_raw,duration_min,reservation_url"
    )
    .eq("city_slug", args.citySlug)
    .eq("is_plannable", true)
    .eq("category", "nightlife")
    .order("manual_boost", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`findNightlife: ${error.message}`);
  return (data ?? []).map(compactRow);
}

export async function findEvent(args: {
  citySlug: string;
  date: string; // YYYY-MM-DD
  limit?: number;
}): Promise<AiCandidate[]> {
  const sb = getSupabase();
  const limit = Math.min(args.limit ?? 6, 12);
  const dayStart = `${args.date}T00:00:00.000Z`;
  const dayEnd = `${args.date}T23:59:59.999Z`;
  const { data, error } = await sb
    .from("planner_events")
    .select("id,name,category,starts_at,ends_at,venue_name,lat,lng,ticket_url")
    .eq("city_slug", args.citySlug)
    .eq("status", "scheduled")
    .gte("starts_at", dayStart)
    .lte("starts_at", dayEnd)
    .order("starts_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`findEvent: ${error.message}`);
  return (data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    type: "event",
    category: e.category ?? "event",
    budget: null,
    duration_min: 90,
    opening_hours: `${e.starts_at} – ${e.ends_at ?? "?"}${e.venue_name ? ` @ ${e.venue_name}` : ""}`,
    lat: e.lat,
    lng: e.lng,
  }));
}

// Tool-Schema für OpenAI Function Calling.
export const AI_PLANNER_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "find_food",
      description:
        "Find restaurants or cafes in the city. Use for breakfast, lunch, dinner stops.",
      parameters: {
        type: "object",
        properties: {
          citySlug: { type: "string", description: "City slug, e.g. 'muenchen' or 'berlin-berlin'" },
          meal: { type: "string", enum: ["breakfast", "lunch", "dinner", "any"], default: "any" },
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
      name: "find_culture",
      description: "Find museums, galleries, theaters, cinemas in the city.",
      parameters: {
        type: "object",
        properties: {
          citySlug: { type: "string" },
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
          date: { type: "string", description: "ISO date YYYY-MM-DD" },
          limit: { type: "number", default: 6, maximum: 12 },
        },
        required: ["citySlug", "date"],
      },
    },
  },
] as const;

export type ToolName = "find_food" | "find_culture" | "find_activity" | "find_nightlife" | "find_event";

export async function callTool(name: ToolName, args: Record<string, unknown>): Promise<AiCandidate[]> {
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
      return findEvent(args as Parameters<typeof findEvent>[0]);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
