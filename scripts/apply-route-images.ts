import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type JsonObject = Record<string, unknown>;

type Candidate = {
  id: string;
  provider: string;
  providerSource: string | null;
  title: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  landingUrl: string | null;
  width: number | null;
  height: number | null;
  license: string | null;
  licenseVersion: string | null;
  licenseUrl: string | null;
  creator: string | null;
  creatorUrl: string | null;
  attributionText: string;
  score: number;
  usageNotes: string[];
};

type ReviewTarget = {
  approved: boolean;
  selectedCandidateId: string | null;
  notes: string;
  candidates: Candidate[];
};

type ReviewStop = ReviewTarget & {
  order: number;
  title: string;
  type: string | null;
};

type ReviewRoute = {
  citySlug: string;
  cityLabel: string;
  routeSlug: string;
  routeTitle: string;
  cover: ReviewTarget;
  stops: ReviewStop[];
};

type ReviewFile = {
  version: number;
  generatedAt: string;
  candidatesFile?: string;
  routes: ReviewRoute[];
};

type DbRoute = {
  id: string;
  slug: string;
  city_slug: string | null;
  title: string;
  cover_image_url: string | null;
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
  overwrite: boolean;
  force: boolean;
  reviewPath: string;
  routeFilter: Set<string> | null;
  cityFilter: Set<string> | null;
};

const DEFAULT_REVIEW_FILE = "data/editorial_routes/pilot_top5_image_review.json";
const IMPORT_SOURCE = "pd24_editorial_routes";
const IMAGE_APPLY_SOURCE = "pd24_route_image_review";

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
    force: process.argv.includes("--force"),
    reviewPath: resolve(process.cwd(), valueFor("review") ?? DEFAULT_REVIEW_FILE),
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

function readReview(path: string): ReviewFile {
  if (!existsSync(path)) throw new Error(`Review-Datei nicht gefunden: ${path}`);
  const review = JSON.parse(readFileSync(path, "utf8")) as ReviewFile;
  if (!Array.isArray(review.routes)) throw new Error("Review-Datei enthaelt keine routes.");
  return review;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function filterRoutes(routes: ReviewRoute[], options: Options) {
  return routes.filter((route) => {
    if (options.cityFilter && !options.cityFilter.has(route.citySlug)) return false;
    if (options.routeFilter && !options.routeFilter.has(route.routeSlug)) return false;
    return true;
  });
}

function selectedCandidate(target: ReviewTarget, context: string) {
  if (!target.approved || !target.selectedCandidateId) return null;
  const candidate = target.candidates.find((item) => item.id === target.selectedCandidateId) ?? null;
  if (!candidate) {
    throw new Error(`${context}: selectedCandidateId ${target.selectedCandidateId} ist nicht in candidates enthalten.`);
  }
  if (!candidate.imageUrl && !candidate.thumbnailUrl) {
    throw new Error(`${context}: Kandidat ${candidate.id} hat keine imageUrl/thumbnailUrl.`);
  }
  return candidate;
}

function imageUrlFor(candidate: Candidate) {
  return candidate.imageUrl ?? candidate.thumbnailUrl ?? null;
}

function attributionPayload(candidate: Candidate, notes: string, appliedAt: string) {
  return {
    candidate_id: candidate.id,
    provider: candidate.provider,
    provider_source: candidate.providerSource,
    title: candidate.title,
    image_url: candidate.imageUrl,
    thumbnail_url: candidate.thumbnailUrl,
    landing_url: candidate.landingUrl,
    width: candidate.width,
    height: candidate.height,
    license: candidate.license,
    license_version: candidate.licenseVersion,
    license_url: candidate.licenseUrl,
    creator: candidate.creator,
    creator_url: candidate.creatorUrl,
    attribution_text: candidate.attributionText,
    score: candidate.score,
    usage_notes: candidate.usageNotes ?? [],
    review_notes: normalizeText(notes) || null,
    review_required: false,
    approved_at: appliedAt,
    apply_source: IMAGE_APPLY_SOURCE,
  };
}

function metaWithImage(meta: unknown, candidate: Candidate, notes: string, appliedAt: string) {
  return {
    ...asObject(meta),
    image_candidate_id: candidate.id,
    image_attribution: attributionPayload(candidate, notes, appliedAt),
    image_review_status: "approved",
    image_applied_at: appliedAt,
    image_apply_source: IMAGE_APPLY_SOURCE,
  };
}

function routeLooksSafe(route: DbRoute) {
  const meta = asObject(route.meta);
  return meta.import_source === IMPORT_SOURCE;
}

async function loadRoutes(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  routes: ReviewRoute[]
) {
  const slugs = routes.map((route) => route.routeSlug);
  const { data, error } = await supabase
    .from("user_routes")
    .select("id,slug,city_slug,title,cover_image_url,meta")
    .in("slug", slugs);

  if (error) throw new Error(`Routen konnten nicht geladen werden: ${error.message}`);
  return new Map((data ?? []).map((route) => [(route as DbRoute).slug, route as DbRoute]));
}

async function loadStops(supabase: ReturnType<typeof getSupabaseAdmin>, routeIds: string[]) {
  if (routeIds.length === 0) return new Map<string, DbStop[]>();
  const { data, error } = await supabase
    .from("user_route_stops")
    .select("id,route_id,stop_order,location_id,title,note,external_url,is_required,duration_min,lat,lng,photo_url,meta")
    .in("route_id", routeIds);

  if (error) throw new Error(`Stops konnten nicht geladen werden: ${error.message}`);

  const out = new Map<string, DbStop[]>();
  for (const stop of (data ?? []) as DbStop[]) {
    const list = out.get(stop.route_id) ?? [];
    list.push(stop);
    out.set(stop.route_id, list);
  }
  return out;
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

async function applyImages(review: ReviewFile, options: Options) {
  const routes = filterRoutes(review.routes, options);
  if (routes.length === 0) throw new Error("Keine Routen nach Filterung uebrig.");

  const supabase = getSupabaseAdmin();
  const dbRoutes = await loadRoutes(supabase, routes);
  const routeIds = Array.from(dbRoutes.values()).map((route) => route.id);
  const dbStopsByRouteId = await loadStops(supabase, routeIds);
  const appliedAt = new Date().toISOString();

  let routeUpdates = 0;
  let stopUpdates = 0;
  let skipped = 0;
  let missingRoutes = 0;
  let missingStops = 0;

  for (const routeReview of routes) {
    const dbRoute = dbRoutes.get(routeReview.routeSlug) ?? null;
    if (!dbRoute) {
      console.warn(`Skip ${routeReview.routeSlug}: Route nicht in DB gefunden.`);
      missingRoutes += 1;
      continue;
    }
    if (!options.force && !routeLooksSafe(dbRoute)) {
      console.warn(`Skip ${routeReview.routeSlug}: Route wirkt nicht wie ein ${IMPORT_SOURCE}-Import.`);
      skipped += 1;
      continue;
    }

    const coverCandidate = selectedCandidate(routeReview.cover, `${routeReview.routeSlug} cover`);
    if (coverCandidate) {
      if (dbRoute.cover_image_url && !options.overwrite) {
        console.log(`skip cover ${routeReview.routeSlug}: cover_image_url ist bereits gesetzt.`);
        skipped += 1;
      } else {
        routeUpdates += 1;
        console.log(
          `${options.commit ? "update" : "dry-run"} cover ${routeReview.routeSlug}: ${coverCandidate.id}`
        );
        if (options.commit) {
          const { error } = await supabase
            .from("user_routes")
            .update({
              cover_image_url: imageUrlFor(coverCandidate),
              meta: metaWithImage(dbRoute.meta, coverCandidate, routeReview.cover.notes, appliedAt),
            })
            .eq("id", dbRoute.id);
          if (error) throw new Error(`Cover fuer ${routeReview.routeSlug} konnte nicht geschrieben werden: ${error.message}`);
        }
      }
    }

    const dbStops = dbStopsByRouteId.get(dbRoute.id) ?? [];
    const dbStopsByOrder = new Map(dbStops.map((stop) => [stop.stop_order, stop]));
    for (const stopReview of routeReview.stops) {
      const candidate = selectedCandidate(stopReview, `${routeReview.routeSlug} stop ${stopReview.order}`);
      if (!candidate) continue;
      const dbStop = dbStopsByOrder.get(stopReview.order) ?? null;
      if (!dbStop) {
        console.warn(`Skip ${routeReview.routeSlug} stop ${stopReview.order}: Stop nicht in DB gefunden.`);
        missingStops += 1;
        continue;
      }
      if (dbStop.photo_url && !options.overwrite) {
        console.log(`skip stop ${routeReview.routeSlug} #${stopReview.order}: photo_url ist bereits gesetzt.`);
        skipped += 1;
        continue;
      }

      stopUpdates += 1;
      console.log(`${options.commit ? "update" : "dry-run"} stop ${routeReview.routeSlug} #${stopReview.order}: ${candidate.id}`);
      if (options.commit) {
        try {
          await writeStopImage(
            supabase,
            dbStop,
            imageUrlFor(candidate),
            metaWithImage(dbStop.meta, candidate, stopReview.notes, appliedAt)
          );
        } catch (error) {
          throw new Error(
            `Bild fuer ${routeReview.routeSlug} stop ${stopReview.order} konnte nicht geschrieben werden: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    }
  }

  return { routeUpdates, stopUpdates, skipped, missingRoutes, missingStops };
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  const options = parseArgs();
  const review = readReview(options.reviewPath);
  const result = await applyImages(review, options);
  console.log(
    `${options.commit ? "Fertig" : "Dry-Run"}: ${result.routeUpdates} Cover, ${result.stopUpdates} Stop-Bilder, ${result.skipped} uebersprungen, ${result.missingRoutes} fehlende Routen, ${result.missingStops} fehlende Stops.`
  );
  if (!options.commit) {
    console.log("Kein DB-Write. Fuer Apply: npm.cmd run routes:images:apply -- --commit");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
