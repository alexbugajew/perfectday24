import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type JsonObject = Record<string, unknown>;

type DbRoute = {
  id: string;
  slug: string | null;
  city_slug: string | null;
  title: string | null;
  meta: unknown;
};

type DbStop = {
  id: string;
  route_id: string;
  stop_order: number;
  location_id: string | null;
  title: string | null;
  note: string | null;
  external_url: string | null;
  is_required: boolean;
  duration_min: number | null;
  lat: number | null;
  lng: number | null;
  photo_url: string | null;
  meta: unknown;
};

type Options = {
  commit: boolean;
  routeFilter: Set<string> | null;
  cityFilter: Set<string> | null;
};

const IMPORT_SOURCE = "pd24_editorial_routes";
const IMAGE_APPLY_SOURCE = "pd24_route_context_stop_photo_backfill";

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

function hasValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function importedRoute(route: DbRoute) {
  return asObject(route.meta).import_source === IMPORT_SOURCE;
}

function filteredRoute(route: DbRoute, options: Options) {
  if (!importedRoute(route)) return false;
  if (options.cityFilter && (!route.city_slug || !options.cityFilter.has(route.city_slug))) return false;
  if (options.routeFilter && (!route.slug || !options.routeFilter.has(route.slug))) return false;
  return true;
}

function nearestSourceStop(target: DbStop, stops: DbStop[]) {
  return stops
    .filter((stop) => stop.id !== target.id && hasValue(stop.photo_url))
    .sort((a, b) => {
      const distance = Math.abs(a.stop_order - target.stop_order) - Math.abs(b.stop_order - target.stop_order);
      if (distance !== 0) return distance;
      return a.stop_order - b.stop_order;
    })[0] ?? null;
}

function stopInsertPayload(stop: DbStop, photoUrl: string | null, meta: JsonObject) {
  return {
    id: stop.id,
    route_id: stop.route_id,
    stop_order: stop.stop_order,
    location_id: stop.location_id,
    title: stop.title,
    note: stop.note,
    external_url: stop.external_url,
    is_required: stop.is_required,
    duration_min: stop.duration_min,
    lat: stop.lat,
    lng: stop.lng,
    photo_url: photoUrl,
    meta,
  };
}

async function replaceStopImage(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  dbStop: DbStop,
  photoUrl: string | null,
  meta: JsonObject
) {
  const originalPayload = stopInsertPayload(dbStop, dbStop.photo_url, asObject(dbStop.meta));
  const replacementPayload = stopInsertPayload(dbStop, photoUrl, meta);
  const deleteResult = await supabase.from("user_route_stops").delete().eq("id", dbStop.id);
  if (deleteResult.error) throw deleteResult.error;

  const insertResult = await supabase.from("user_route_stops").insert(replacementPayload);
  if (!insertResult.error) return;

  const restoreResult = await supabase.from("user_route_stops").insert(originalPayload);
  if (restoreResult.error) {
    throw new Error(`${insertResult.error.message}; Restore fehlgeschlagen: ${restoreResult.error.message}`);
  }
  throw insertResult.error;
}

async function writeStopImage(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  dbStop: DbStop,
  photoUrl: string | null,
  meta: JsonObject
) {
  const { error } = await supabase
    .from("user_route_stops")
    .update({
      photo_url: photoUrl,
      meta,
    })
    .eq("id", dbStop.id);

  if (!error) return;
  if (!error.message.includes('record "new" has no field "updated_at"')) throw error;
  await replaceStopImage(supabase, dbStop, photoUrl, meta);
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  const options = parseArgs();
  const supabase = getSupabaseAdmin();
  const appliedAt = new Date().toISOString();

  const { data: routeData, error: routeError } = await supabase
    .from("user_routes")
    .select("id,slug,city_slug,title,meta")
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
    .select("id,route_id,stop_order,location_id,title,note,external_url,is_required,duration_min,lat,lng,photo_url,meta")
    .in("route_id", routeIds)
    .order("route_id", { ascending: true })
    .order("stop_order", { ascending: true });
  if (stopError) throw stopError;

  const stopsByRoute = new Map<string, DbStop[]>();
  for (const stop of (stopData ?? []) as DbStop[]) {
    const list = stopsByRoute.get(stop.route_id) ?? [];
    list.push(stop);
    stopsByRoute.set(stop.route_id, list);
  }

  let updated = 0;
  let noSource = 0;
  const preview: string[] = [];

  for (const route of routes) {
    const stops = stopsByRoute.get(route.id) ?? [];
    for (const stop of stops) {
      if (hasValue(stop.photo_url)) continue;
      const sourceStop = nearestSourceStop(stop, stops);
      if (!sourceStop || !sourceStop.photo_url) {
        noSource += 1;
        continue;
      }

      const sourceMeta = asObject(sourceStop.meta);
      const sourceAttribution = asObject(sourceMeta.image_attribution);
      const backfillSource = {
        source: "same_route_stop_photo",
        source_stop_id: sourceStop.id,
        source_stop_order: sourceStop.stop_order,
        source_stop_title: sourceStop.title,
        source_photo_url: sourceStop.photo_url,
        order_distance: Math.abs(sourceStop.stop_order - stop.stop_order),
        applied_at: appliedAt,
      };
      const nextMeta: JsonObject = {
        ...asObject(stop.meta),
        image_candidate_id: hasValue(sourceMeta.image_candidate_id) ? sourceMeta.image_candidate_id : null,
        image_attribution:
          Object.keys(sourceAttribution).length > 0
            ? {
                ...sourceAttribution,
                contextual_backfill_source: backfillSource,
                apply_source: IMAGE_APPLY_SOURCE,
              }
            : sourceAttribution,
        image_review_status: "approved_contextual_fallback",
        image_applied_at: appliedAt,
        image_apply_source: IMAGE_APPLY_SOURCE,
        image_match_level: "route_context",
        stop_photo_backfill_source: backfillSource,
      };

      preview.push(`${route.slug ?? route.id} #${stop.stop_order}: ${stop.title ?? "ohne Titel"} <- #${sourceStop.stop_order} ${sourceStop.title ?? "ohne Titel"}`);
      if (options.commit) {
        await writeStopImage(supabase, stop, sourceStop.photo_url, nextMeta);
      }
      updated += 1;
    }
  }

  console.log(`${options.commit ? "Backfill" : "Dry run"} fuer ${routes.length} Editorial-Routen`);
  console.log(`- Kontext-Fallbacks ${options.commit ? "geschrieben" : "moeglich"}: ${updated}`);
  console.log(`- ohne Quelle in gleicher Route: ${noSource}`);
  if (preview.length > 0) {
    console.log("");
    console.log(preview.slice(0, 40).join("\n"));
    if (preview.length > 40) console.log(`... ${preview.length - 40} weitere`);
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
