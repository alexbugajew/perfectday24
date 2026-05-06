import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type JsonObject = Record<string, unknown>;

type DbRoute = {
  id: string;
  slug: string | null;
  city_slug: string | null;
  title: string | null;
  cover_image_url: string | null;
  meta: unknown;
};

type DbStop = {
  id: string;
  route_id: string;
  stop_order: number | null;
  title: string | null;
  photo_url: string | null;
  meta: unknown;
};

type GapRow = {
  citySlug: string | null;
  routeSlug: string | null;
  routeTitle: string | null;
  stopOrder?: number | null;
  stopTitle?: string | null;
  sourceStopOrder?: number | null;
  sourceStopTitle?: string | null;
};

const IMPORT_SOURCE = "pd24_editorial_routes";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function hasValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasImageAttribution(meta: unknown) {
  return Object.keys(asObject(asObject(meta).image_attribution)).length > 0;
}

function contextualFallbackInfo(meta: unknown) {
  const object = asObject(meta);
  if (object.image_apply_source !== "pd24_route_context_stop_photo_backfill" && object.image_match_level !== "route_context") {
    return null;
  }
  return asObject(object.stop_photo_backfill_source);
}

function importedRoute(route: DbRoute) {
  const meta = asObject(route.meta);
  return meta.import_source === IMPORT_SOURCE;
}

function routeGapRow(route: DbRoute): GapRow {
  return {
    citySlug: route.city_slug,
    routeSlug: route.slug,
    routeTitle: route.title,
  };
}

function stopGapRow(route: DbRoute, stop: DbStop): GapRow {
  return {
    citySlug: route.city_slug,
    routeSlug: route.slug,
    routeTitle: route.title,
    stopOrder: stop.stop_order,
    stopTitle: stop.title,
  };
}

function table<T extends Record<string, unknown>>(rows: T[], columns: Array<keyof T & string>) {
  if (rows.length === 0) return "_Keine._";
  const header = `| ${columns.join(" | ")} |`;
  const divider = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((row) => `| ${columns.map((column) => String(row[column] ?? "")).join(" | ")} |`)
    .join("\n");
  return [header, divider, body].join("\n");
}

function citySummary(routes: DbRoute[], stopsByRoute: Map<string, DbStop[]>) {
  const summary = new Map<
    string,
    {
      routes: number;
      missingCovers: number;
      stops: number;
      missingStopPhotos: number;
    }
  >();

  for (const route of routes) {
    const city = route.city_slug ?? "unknown";
    const row = summary.get(city) ?? { routes: 0, missingCovers: 0, stops: 0, missingStopPhotos: 0 };
    const stops = stopsByRoute.get(route.id) ?? [];
    row.routes += 1;
    row.missingCovers += hasValue(route.cover_image_url) ? 0 : 1;
    row.stops += stops.length;
    row.missingStopPhotos += stops.filter((stop) => !hasValue(stop.photo_url)).length;
    summary.set(city, row);
  }

  return Array.from(summary.entries())
    .map(([citySlug, row]) => ({ citySlug, ...row }))
    .sort((a, b) => a.citySlug.localeCompare(b.citySlug));
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  const supabase = getSupabaseAdmin();
  const generatedAt = new Date().toISOString();

  const { data: routeData, error: routeError } = await supabase
    .from("user_routes")
    .select("id,slug,city_slug,title,cover_image_url,meta")
    .eq("visibility", "public");

  if (routeError) throw routeError;

  const routes = ((routeData ?? []) as DbRoute[]).filter(importedRoute);
  const routeIds = routes.map((route) => route.id);

  const { data: stopData, error: stopError } =
    routeIds.length > 0
      ? await supabase
          .from("user_route_stops")
          .select("id,route_id,stop_order,title,photo_url,meta")
          .in("route_id", routeIds)
          .order("route_id", { ascending: true })
          .order("stop_order", { ascending: true })
      : { data: [], error: null };

  if (stopError) throw stopError;

  const stops = (stopData ?? []) as DbStop[];
  const routesById = new Map(routes.map((route) => [route.id, route]));
  const stopsByRoute = new Map<string, DbStop[]>();
  for (const stop of stops) {
    const routeStops = stopsByRoute.get(stop.route_id) ?? [];
    routeStops.push(stop);
    stopsByRoute.set(stop.route_id, routeStops);
  }

  const missingCovers = routes.filter((route) => !hasValue(route.cover_image_url)).map(routeGapRow);
  const coverAttributionMissing = routes
    .filter((route) => hasValue(route.cover_image_url) && !hasImageAttribution(route.meta))
    .map(routeGapRow);
  const missingStopPhotos = stops
    .filter((stop) => !hasValue(stop.photo_url))
    .map((stop) => stopGapRow(routesById.get(stop.route_id) as DbRoute, stop));
  const stopAttributionMissing = stops
    .filter((stop) => hasValue(stop.photo_url) && !hasImageAttribution(stop.meta))
    .map((stop) => stopGapRow(routesById.get(stop.route_id) as DbRoute, stop));
  const stopContextualFallbacks = stops
    .filter((stop) => hasValue(stop.photo_url) && contextualFallbackInfo(stop.meta))
    .map((stop) => {
      const source = contextualFallbackInfo(stop.meta);
      return {
        ...stopGapRow(routesById.get(stop.route_id) as DbRoute, stop),
        sourceStopOrder: typeof source?.source_stop_order === "number" ? source.source_stop_order : null,
        sourceStopTitle: typeof source?.source_stop_title === "string" ? source.source_stop_title : null,
      };
    });

  const report = {
    generatedAt,
    importSource: IMPORT_SOURCE,
    totals: {
      routes: routes.length,
      stops: stops.length,
      routeCovers: routes.filter((route) => hasValue(route.cover_image_url)).length,
      stopPhotos: stops.filter((stop) => hasValue(stop.photo_url)).length,
      missingCovers: missingCovers.length,
      missingStopPhotos: missingStopPhotos.length,
      coverAttributionMissing: coverAttributionMissing.length,
      stopAttributionMissing: stopAttributionMissing.length,
      stopContextualFallbacks: stopContextualFallbacks.length,
    },
    citySummary: citySummary(routes, stopsByRoute),
    missingCovers,
    coverAttributionMissing,
    missingStopPhotos,
    stopAttributionMissing,
    stopContextualFallbacks,
  };

  const reportDir = resolve(process.cwd(), "reports");
  mkdirSync(reportDir, { recursive: true });
  const jsonPath = resolve(reportDir, "route-image-gaps-latest.json");
  const mdPath = resolve(reportDir, "route-image-gaps-latest.md");

  const markdown = [
    "# Route Image Gap Report",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Totals",
    "",
    `- Routes: ${report.totals.routes}`,
    `- Stops: ${report.totals.stops}`,
    `- Route covers: ${report.totals.routeCovers}`,
    `- Stop photos: ${report.totals.stopPhotos}`,
    `- Missing route covers: ${report.totals.missingCovers}`,
    `- Missing stop photos: ${report.totals.missingStopPhotos}`,
    `- Cover attribution missing: ${report.totals.coverAttributionMissing}`,
    `- Stop attribution missing: ${report.totals.stopAttributionMissing}`,
    `- Stop contextual fallbacks: ${report.totals.stopContextualFallbacks}`,
    "",
    "## City Summary",
    "",
    table(report.citySummary, ["citySlug", "routes", "missingCovers", "stops", "missingStopPhotos"]),
    "",
    "## Missing Route Covers",
    "",
    table(missingCovers, ["citySlug", "routeSlug", "routeTitle"]),
    "",
    "## Route Covers Without Attribution",
    "",
    table(coverAttributionMissing, ["citySlug", "routeSlug", "routeTitle"]),
    "",
    "## Missing Stop Photos",
    "",
    table(missingStopPhotos, ["citySlug", "routeSlug", "stopOrder", "stopTitle"]),
    "",
    "## Stop Photos Without Attribution",
    "",
    table(stopAttributionMissing, ["citySlug", "routeSlug", "stopOrder", "stopTitle"]),
    "",
    "## Stop Contextual Fallbacks",
    "",
    table(stopContextualFallbacks, ["citySlug", "routeSlug", "stopOrder", "stopTitle", "sourceStopOrder", "sourceStopTitle"]),
    "",
  ].join("\n");

  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(mdPath, markdown, "utf8");

  console.log("Route Image Gap Report");
  console.log(`- Routen: ${report.totals.routes}, Covers: ${report.totals.routeCovers}, fehlende Covers: ${report.totals.missingCovers}`);
  console.log(`- Stops: ${report.totals.stops}, Stop-Fotos: ${report.totals.stopPhotos}, fehlende Stop-Fotos: ${report.totals.missingStopPhotos}`);
  console.log(`- Cover ohne Attribution: ${report.totals.coverAttributionMissing}`);
  console.log(`- Stop-Fotos ohne Attribution: ${report.totals.stopAttributionMissing}`);
  console.log(`- Stop-Kontext-Fallbacks: ${report.totals.stopContextualFallbacks}`);
  console.log(`- JSON: ${jsonPath}`);
  console.log(`- Markdown: ${mdPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
