import { existsSync, readFileSync } from "node:fs";
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

type Options = {
  commit: boolean;
  overwrite: boolean;
  routeFilter: Set<string> | null;
  cityFilter: Set<string> | null;
};

const IMPORT_SOURCE = "pd24_editorial_routes";
const COVER_BACKFILL_SOURCE = "pd24_stop_photo_cover_backfill";

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

function parseArgs(): Options {
  const valueFor = (name: string) => {
    const prefix = `--${name}=`;
    const found = process.argv.find((value) => value.startsWith(prefix));
    return found ? found.slice(prefix.length) : null;
  };

  const splitSet = (value: string | null) =>
    value
      ? new Set(
          value
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
        )
      : null;

  return {
    commit: process.argv.includes("--commit"),
    overwrite: process.argv.includes("--overwrite"),
    routeFilter: splitSet(valueFor("route")),
    cityFilter: splitSet(valueFor("city")),
  };
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

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hasValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function importedRoute(route: DbRoute) {
  const meta = asObject(route.meta);
  return meta.import_source === IMPORT_SOURCE;
}

function filteredRoute(route: DbRoute, options: Options) {
  if (!importedRoute(route)) return false;
  if (options.cityFilter && (!route.city_slug || !options.cityFilter.has(route.city_slug))) return false;
  if (options.routeFilter && (!route.slug || !options.routeFilter.has(route.slug))) return false;
  return true;
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  const options = parseArgs();
  const supabase = getSupabaseAdmin();
  const appliedAt = new Date().toISOString();

  const { data: routeData, error: routeError } = await supabase
    .from("user_routes")
    .select("id,slug,city_slug,title,cover_image_url,meta")
    .eq("visibility", "public");

  if (routeError) throw routeError;

  const routes = ((routeData ?? []) as DbRoute[]).filter((route) => filteredRoute(route, options));
  const routeIds = routes.map((route) => route.id);
  if (routeIds.length === 0) {
    console.log("Keine passenden Editorial-Routen gefunden.");
    return;
  }

  const { data: stopData, error: stopError } = await supabase
    .from("user_route_stops")
    .select("id,route_id,stop_order,title,photo_url,meta")
    .in("route_id", routeIds)
    .order("route_id", { ascending: true })
    .order("stop_order", { ascending: true });

  if (stopError) throw stopError;

  const stopsByRoute = new Map<string, DbStop[]>();
  for (const stop of (stopData ?? []) as DbStop[]) {
    const stops = stopsByRoute.get(stop.route_id) ?? [];
    stops.push(stop);
    stopsByRoute.set(stop.route_id, stops);
  }

  let alreadyCovered = 0;
  let missingStopPhoto = 0;
  let updated = 0;
  const preview: string[] = [];

  for (const route of routes) {
    if (!options.overwrite && hasValue(route.cover_image_url)) {
      alreadyCovered += 1;
      continue;
    }

    const sourceStop = (stopsByRoute.get(route.id) ?? []).find((stop) => hasValue(stop.photo_url));
    if (!sourceStop) {
      missingStopPhoto += 1;
      continue;
    }

    const sourceStopMeta = asObject(sourceStop.meta);
    const sourceAttribution = asObject(sourceStopMeta.image_attribution);
    const backfillSource = {
      source: "stop_photo",
      stop_id: sourceStop.id,
      stop_order: sourceStop.stop_order,
      stop_title: sourceStop.title,
      applied_at: appliedAt,
    };
    const nextMeta: JsonObject = {
      ...asObject(route.meta),
      cover_image_source: "stop_photo",
      cover_image_stop_id: sourceStop.id,
      cover_backfill_source: backfillSource,
      image_applied_at: appliedAt,
      image_apply_source: COVER_BACKFILL_SOURCE,
    };

    const candidateId = cleanText(sourceStopMeta.image_candidate_id);
    if (candidateId) nextMeta.image_candidate_id = candidateId;
    if (Object.keys(sourceAttribution).length > 0) {
      nextMeta.image_attribution = {
        ...sourceAttribution,
        cover_backfill_source: backfillSource,
        apply_source: COVER_BACKFILL_SOURCE,
      };
      nextMeta.image_review_status = "approved_from_stop_photo";
    }

    preview.push(`${route.slug ?? route.id}: Stop ${sourceStop.stop_order ?? "?"} (${sourceStop.title ?? "ohne Titel"})`);

    if (options.commit) {
      const { error: updateError } = await supabase
        .from("user_routes")
        .update({
          cover_image_url: sourceStop.photo_url,
          meta: nextMeta,
        })
        .eq("id", route.id);
      if (updateError) throw updateError;
    }

    updated += 1;
  }

  console.log(`${options.commit ? "Backfill" : "Dry run"} fuer ${routes.length} Editorial-Routen`);
  console.log(`- aktualisierbar/aktualisiert: ${updated}`);
  console.log(`- bereits mit Cover: ${alreadyCovered}`);
  console.log(`- ohne Stop-Foto als Quelle: ${missingStopPhoto}`);
  if (preview.length > 0) {
    console.log("");
    console.log(preview.slice(0, 30).join("\n"));
    if (preview.length > 30) console.log(`... ${preview.length - 30} weitere`);
  }
  if (!options.commit && updated > 0) {
    console.log("");
    console.log("Zum Schreiben erneut mit --commit ausfuehren.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
