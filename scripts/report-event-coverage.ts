import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PLANNER_VISIBLE_CITY_ROLLOUT } from "../lib/cities/rollout";

type PlannerEventCoverageRow = {
  city_slug: string | null;
  source: string | null;
  category: string | null;
  status: string | null;
  start_at: string | null;
  end_at: string | null;
  last_seen_at: string | null;
  updated_at: string | null;
};

type EventSourceConfigCoverageRow = {
  provider: string | null;
  city_slug: string | null;
  is_active: boolean | null;
};

const MARKET_CATEGORIES = new Set(["market", "festival", "fair", "food_event", "seasonal"]);
const EVENT_MODE_CATEGORIES = new Set([
  "concert",
  "theater",
  "show",
  "market",
  "festival",
  "fair",
  "food_event",
  "community",
  "seasonal",
]);

function loadEnvFile(path: string) {
  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return;
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function parseArg(name: string) {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function isActiveOnDate(row: PlannerEventCoverageRow, date: string) {
  if (!row.start_at) return false;
  const startDate = row.start_at.slice(0, 10);
  const endDate = row.end_at?.slice(0, 10) ?? null;
  return endDate ? startDate <= date && date <= endDate : startDate === date;
}

function isFuture(row: PlannerEventCoverageRow, date: string) {
  return Boolean(row.start_at && row.start_at.slice(0, 10) >= date);
}

function addCount(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

async function fetchAllRows<T>(
  queryPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>
) {
  const pageSize = 1000;
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryPage(from, from + pageSize - 1);
    if (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen.");
  }

  const date = parseArg("date") ?? new Date().toISOString().slice(0, 10);
  const format = parseArg("format") ?? "table";
  const citySlugs = PLANNER_VISIBLE_CITY_ROLLOUT.map((city) => city.slug);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const eventRows = await fetchAllRows<PlannerEventCoverageRow>(async (from, to) =>
    supabase
      .from("planner_events")
      .select("city_slug,source,category,status,start_at,end_at,last_seen_at,updated_at")
      .in("city_slug", citySlugs)
      .order("city_slug", { ascending: true })
      .order("source", { ascending: true })
      .order("start_at", { ascending: true })
      .range(from, to)
  );

  const sourceConfigRows = await fetchAllRows<EventSourceConfigCoverageRow>(async (from, to) =>
    supabase
      .from("event_source_configs")
      .select("provider,city_slug,is_active")
      .in("city_slug", citySlugs)
      .range(from, to)
  );

  const activeOfficialSourcesByCity = new Map<string, Set<string>>();
  for (const row of sourceConfigRows) {
    if (!row.city_slug || !row.provider || row.is_active !== true) continue;
    const current = activeOfficialSourcesByCity.get(row.city_slug) ?? new Set<string>();
    current.add(row.provider);
    activeOfficialSourcesByCity.set(row.city_slug, current);
  }

  const stats = PLANNER_VISIBLE_CITY_ROLLOUT.map((city) => ({
    slug: city.slug,
    label: city.label,
    stage: city.stage,
    total: 0,
    scheduled: 0,
    eventModeScheduled: 0,
    activeEventModeToday: 0,
    ticketmasterScheduled: 0,
    ticketmasterFuture: 0,
    ticketmasterActiveToday: 0,
    marketScheduled: 0,
    marketFuture: 0,
    marketActiveToday: 0,
    sources: {} as Record<string, number>,
    activeOfficialSources: Array.from(activeOfficialSourcesByCity.get(city.slug) ?? []).sort(),
    latestSeen: null as string | null,
  }));
  const statsByCity = new Map(stats.map((city) => [city.slug, city]));

  for (const row of eventRows) {
    if (!row.city_slug) continue;
    const city = statsByCity.get(row.city_slug);
    if (!city) continue;

    city.total += 1;
    addCount(city.sources, row.source ?? "unknown");

    if (row.status === "scheduled") {
      city.scheduled += 1;
    }

    if (row.category && EVENT_MODE_CATEGORIES.has(row.category) && row.status === "scheduled") {
      city.eventModeScheduled += 1;
      if (isActiveOnDate(row, date)) {
        city.activeEventModeToday += 1;
      }
    }

    if (row.source === "ticketmaster" && row.status === "scheduled") {
      city.ticketmasterScheduled += 1;
      if (isFuture(row, date)) city.ticketmasterFuture += 1;
      if (isActiveOnDate(row, date)) city.ticketmasterActiveToday += 1;
    }

    if (row.category && MARKET_CATEGORIES.has(row.category) && row.status === "scheduled") {
      city.marketScheduled += 1;
      if (isFuture(row, date)) city.marketFuture += 1;
      if (isActiveOnDate(row, date)) city.marketActiveToday += 1;
    }

    const seen = row.last_seen_at ?? row.updated_at;
    if (seen && (!city.latestSeen || seen > city.latestSeen)) {
      city.latestSeen = seen;
    }
  }

  const result = {
    date,
    cityCount: stats.length,
    totalPlannerEvents: eventRows.length,
    ticketmasterCities: stats.filter((city) => city.ticketmasterFuture > 0).map((city) => city.slug),
    missingTicketmasterFuture: stats
      .filter((city) => city.ticketmasterFuture === 0)
      .map((city) => city.slug),
    marketFutureCities: stats.filter((city) => city.marketFuture > 0).map((city) => city.slug),
    missingMarketFuture: stats.filter((city) => city.marketFuture === 0).map((city) => city.slug),
    activeMarketCities: stats.filter((city) => city.marketActiveToday > 0).map((city) => city.slug),
    missingActiveOfficialSource: stats
      .filter((city) => city.activeOfficialSources.length === 0)
      .map((city) => city.slug),
    citiesWithoutEvents: stats.filter((city) => city.total === 0).map((city) => city.slug),
    stats: stats.map((city) => ({
      ...city,
      sources: Object.entries(city.sources)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([source, count]) => ({ source, count })),
    })),
  };

  if (format === "json") {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Event Coverage ${date}`);
  console.log(
    [
      `cities=${result.cityCount}`,
      `events=${result.totalPlannerEvents}`,
      `ticketmaster_future=${result.ticketmasterCities.length}`,
      `market_future=${result.marketFutureCities.length}`,
      `active_market_today=${result.activeMarketCities.length}`,
    ].join(" | ")
  );
  console.log("");
  console.table(
    result.stats.map((city) => ({
      city: city.slug,
      events: city.total,
      scheduled: city.scheduled,
      tmFuture: city.ticketmasterFuture,
      marketFuture: city.marketFuture,
      marketToday: city.marketActiveToday,
      activeEventToday: city.activeEventModeToday,
      latestSeen: city.latestSeen?.slice(0, 10) ?? "-",
      sources: city.sources.map((source) => source.source).join(","),
    }))
  );
  console.log("");
  console.log(`missingTicketmasterFuture=${result.missingTicketmasterFuture.join(",") || "-"}`);
  console.log(`missingMarketFuture=${result.missingMarketFuture.join(",") || "-"}`);
  console.log(`citiesWithoutEvents=${result.citiesWithoutEvents.join(",") || "-"}`);
  console.log(`missingActiveOfficialSource=${result.missingActiveOfficialSource.join(",") || "-"}`);
}

main().catch((error) => {
  console.error("[events:coverage] failed:", error);
  process.exitCode = 1;
});
