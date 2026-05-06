import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PLANNER_33_ROLLOUT, type PlannerRolloutCity } from "../lib/cities/rollout";

type JsonObject = Record<string, unknown>;

type SeedStop = {
  order: number;
  title: string;
  type?: string;
  address?: string;
  durationMin?: number;
  note?: string;
  sourceUrls?: string[];
  lat?: number | null;
  lng?: number | null;
};

type SeedRoute = {
  citySlug: string;
  slug: string;
  title: string;
  description?: string;
  creatorType?: "user" | "creator" | "influencer" | "brand" | "editorial";
  visibility?: "private" | "unlisted" | "public";
  tags?: string[];
  sourceUrls?: string[];
  sourceType?: string;
  stops: SeedStop[];
};

type SeedFile = {
  version: number;
  createdAt?: string;
  status?: string;
  importNotes?: {
    rightsNote?: string;
  };
  routes: SeedRoute[];
};

type LocationCandidate = {
  id: string;
  name: string | null;
  city_slug: string | null;
  lat: number | null;
  lng: number | null;
  reservation_url?: string | null;
  type?: string | null;
  category?: string | null;
};

type MatchedStop = SeedStop & {
  locationId: string | null;
  matchedLocationName: string | null;
  matchScore: number | null;
  lat: number | null;
  lng: number | null;
  geoSource: "seed" | "location_match" | "nominatim" | null;
  geocodedDisplayName: string | null;
};

type ExistingRouteMedia = {
  id: string;
  cover_image_url?: string | null;
  meta?: unknown;
};

type ExistingStopMedia = {
  stop_order: number;
  photo_url?: string | null;
  meta?: unknown;
};

type ImportOptions = {
  commit: boolean;
  force: boolean;
  filePath: string;
  cityFilter: Set<string> | null;
  routeFilter: Set<string> | null;
  limit: number | null;
  visibility: "private" | "unlisted" | "public" | null;
  creatorType: "user" | "creator" | "influencer" | "brand" | "editorial" | null;
  creatorUsername: string | null;
  userId: string | null;
  matchLocations: boolean;
  geocodeMissing: boolean;
  geocodeLimit: number | null;
  listCreators: boolean;
};

type NominatimPlace = {
  lat?: string;
  lon?: string;
  display_name?: string;
  class?: string;
  type?: string;
  importance?: number;
};

type GeocodeResult = {
  lat: number;
  lng: number;
  displayName: string | null;
};

type GeocodeState = {
  cache: Map<string, GeocodeResult | null>;
  remainingRequests: number | null;
  requestCount: number;
  hitCount: number;
};

const DEFAULT_SEED_FILE = "data/editorial_routes/pilot_top5_influencer_routes.json";
const IMPORT_SOURCE = "pd24_editorial_routes";
const NOMINATIM_DELAY_MS = 1100;
let lastNominatimRequestAt = 0;

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

function parseArgs(): ImportOptions {
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

  const limitRaw = valueFor("limit");
  const limit = limitRaw ? Number(limitRaw) : null;
  if (limit !== null && (!Number.isInteger(limit) || limit <= 0)) {
    throw new Error("--limit muss eine positive ganze Zahl sein.");
  }

  const geocodeLimitRaw = valueFor("geocode-limit");
  const geocodeLimit = geocodeLimitRaw ? Number(geocodeLimitRaw) : null;
  if (geocodeLimit !== null && (!Number.isInteger(geocodeLimit) || geocodeLimit <= 0)) {
    throw new Error("--geocode-limit muss eine positive ganze Zahl sein.");
  }

  const visibilityRaw = valueFor("visibility");
  const visibility =
    visibilityRaw === "private" || visibilityRaw === "unlisted" || visibilityRaw === "public"
      ? visibilityRaw
      : null;
  if (visibilityRaw && !visibility) {
    throw new Error("--visibility muss private, unlisted oder public sein.");
  }

  const creatorTypeRaw = valueFor("creator-type");
  const creatorType =
    creatorTypeRaw === "user" ||
    creatorTypeRaw === "creator" ||
    creatorTypeRaw === "influencer" ||
    creatorTypeRaw === "brand" ||
    creatorTypeRaw === "editorial"
      ? creatorTypeRaw
      : null;
  if (creatorTypeRaw && !creatorType) {
    throw new Error("--creator-type muss user, creator, influencer, brand oder editorial sein.");
  }

  return {
    commit: process.argv.includes("--commit"),
    force: process.argv.includes("--force"),
    filePath: resolve(process.cwd(), valueFor("file") ?? DEFAULT_SEED_FILE),
    cityFilter: splitSet(valueFor("city")),
    routeFilter: splitSet(valueFor("route")),
    limit,
    visibility,
    creatorType,
    creatorUsername:
      valueFor("creator-username") ?? process.env.PD24_EDITORIAL_CREATOR_USERNAME ?? "pd24-editorial",
    userId: valueFor("user-id") ?? process.env.PD24_EDITORIAL_USER_ID ?? null,
    matchLocations: !process.argv.includes("--no-location-match"),
    geocodeMissing: process.argv.includes("--geocode-missing"),
    geocodeLimit,
    listCreators: process.argv.includes("--list-creators"),
  };
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalizeKey(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter((item): item is string => Boolean(item))
    : [];
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}

function readSeed(filePath: string): SeedFile {
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Seed-Datei ist kein JSON-Objekt.");
  }

  const seed = parsed as SeedFile;
  if (!Number.isInteger(seed.version)) {
    throw new Error("Seed-Datei braucht eine numerische version.");
  }
  if (!Array.isArray(seed.routes) || seed.routes.length === 0) {
    throw new Error("Seed-Datei enthaelt keine routes.");
  }

  const slugs = new Set<string>();
  for (const [index, route] of seed.routes.entries()) {
    if (!normalizeText(route.citySlug)) throw new Error(`Route ${index + 1}: citySlug fehlt.`);
    if (!normalizeText(route.slug)) throw new Error(`Route ${index + 1}: slug fehlt.`);
    if (!normalizeText(route.title)) throw new Error(`Route ${index + 1}: title fehlt.`);
    if (!Array.isArray(route.stops) || route.stops.length === 0) {
      throw new Error(`Route ${route.slug}: stops fehlen.`);
    }
    if (slugs.has(route.slug)) throw new Error(`Doppelter Route-Slug im Seed: ${route.slug}`);
    slugs.add(route.slug);

    const orders = new Set<number>();
    for (const [stopIndex, stop] of route.stops.entries()) {
      if (!Number.isInteger(stop.order) || stop.order <= 0) {
        throw new Error(`Route ${route.slug}, Stop ${stopIndex + 1}: order ist ungueltig.`);
      }
      if (orders.has(stop.order)) throw new Error(`Route ${route.slug}: doppelter stop order ${stop.order}.`);
      orders.add(stop.order);
      if (!normalizeText(stop.title)) throw new Error(`Route ${route.slug}, Stop ${stop.order}: title fehlt.`);
    }
  }

  return seed;
}

function filterRoutes(routes: SeedRoute[], options: ImportOptions) {
  let out = routes.filter((route) => {
    if (options.cityFilter && !options.cityFilter.has(route.citySlug)) return false;
    if (options.routeFilter && !options.routeFilter.has(route.slug)) return false;
    return true;
  });

  if (options.limit !== null) out = out.slice(0, options.limit);
  return out;
}

function inferTheme(route: SeedRoute) {
  const tags = new Set(asStringArray(route.tags));
  const stopTypes = new Set(route.stops.map((stop) => normalizeKey(stop.type)));
  if (tags.has("food") || stopTypes.has("restaurant") || stopTypes.has("coffee") || stopTypes.has("bakery")) {
    return "food";
  }
  if (tags.has("bar") || tags.has("nightlife") || stopTypes.has("bar")) return "nightlife";
  if (tags.has("museum") || tags.has("culture") || stopTypes.has("museum") || stopTypes.has("activity")) {
    return "culture";
  }
  if (tags.has("photo") || tags.has("outdoor") || stopTypes.has("sight") || stopTypes.has("viewpoint")) {
    return "outdoor";
  }
  return "mixed";
}

function computeDurationBucket(stopCount: number) {
  if (stopCount <= 2) return "short";
  if (stopCount <= 4) return "halfday";
  if (stopCount <= 6) return "extended";
  return "fullday";
}

function safeJsonObject(value: JsonObject) {
  return value;
}

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function preservedImageMeta(meta: unknown): JsonObject {
  const source = asJsonObject(meta);
  const out: JsonObject = {};
  for (const key of [
    "image_candidate_id",
    "image_attribution",
    "image_review_status",
    "image_applied_at",
    "image_apply_source",
  ]) {
    if (key in source) out[key] = source[key];
  }
  return out;
}

function hasCoordinates(value: { lat: number | null; lng: number | null }) {
  return typeof value.lat === "number" && typeof value.lng === "number";
}

function cityConfigForSlug(citySlug: string) {
  return (
    PLANNER_33_ROLLOUT.find((city) => city.slug === citySlug || city.aliasSlugs?.includes(citySlug)) ?? null
  );
}

function cityViewbox(city: PlannerRolloutCity) {
  const latDelta = city.radiusM / 111_320;
  const lngDelta = city.radiusM / (111_320 * Math.cos((city.lat * Math.PI) / 180));
  return {
    left: city.lng - lngDelta,
    top: city.lat + latDelta,
    right: city.lng + lngDelta,
    bottom: city.lat - latDelta,
  };
}

function germanSearchText(value: string) {
  return value
    .replace(/Muenchen/g, "München")
    .replace(/muenchen/g, "münchen")
    .replace(/Koeln/g, "Köln")
    .replace(/koeln/g, "köln")
    .replace(/Duesseldorf/g, "Düsseldorf")
    .replace(/duesseldorf/g, "düsseldorf")
    .replace(/Neukoelln/g, "Neukölln")
    .replace(/neukoelln/g, "neukölln")
    .replace(/Eimsbuettel/g, "Eimsbüttel")
    .replace(/eimsbuettel/g, "eimsbüttel")
    .replace(/Suelz/g, "Sülz")
    .replace(/suelz/g, "sülz")
    .replace(/Roemerberg/g, "Römerberg")
    .replace(/roemerberg/g, "römerberg")
    .replace(/ae/g, "ä")
    .replace(/oe/g, "ö")
    .replace(/ue/g, "ü")
    .replace(/Ae/g, "Ä")
    .replace(/Oe/g, "Ö")
    .replace(/Ue/g, "Ü")
    .replace(/Strasse/g, "Straße")
    .replace(/strasse/g, "straße")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueQueries(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .flatMap((value) => [germanSearchText(value), value])
    .map((value) => normalizeText(value))
    .filter((value) => {
      const key = normalizeKey(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function geocodeQueries(stop: SeedStop, route: SeedRoute, city: PlannerRolloutCity | null) {
  const cityLabel = city?.label ?? route.citySlug.replace(/-/g, " ");
  const address = normalizeText(stop.address);
  const title = normalizeText(stop.title);
  return uniqueQueries([
    address ? `${title}, ${address}` : "",
    address,
    `${title}, ${cityLabel}, Germany`,
  ]);
}

function parseNominatimPlace(place: NominatimPlace): GeocodeResult | null {
  const lat = Number(place.lat);
  const lng = Number(place.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    displayName: normalizeText(place.display_name) || null,
  };
}

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function waitForNominatimSlot() {
  const elapsed = Date.now() - lastNominatimRequestAt;
  if (elapsed < NOMINATIM_DELAY_MS) {
    await sleep(NOMINATIM_DELAY_MS - elapsed);
  }
  lastNominatimRequestAt = Date.now();
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

async function listCreators(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data, error } = await supabase
    .from("creator_profiles")
    .select("id,user_id,username,display_name,creator_type,route_count")
    .order("route_count", { ascending: false })
    .limit(30);

  if (error) throw new Error(`creator_profiles konnten nicht gelesen werden: ${error.message}`);
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    console.log(
      [
        `username=${normalizeText(row.username) || "-"}`,
        `display=${normalizeText(row.display_name) || "-"}`,
        `type=${normalizeText(row.creator_type) || "-"}`,
        `routes=${row.route_count ?? 0}`,
        `user_id=${normalizeText(row.user_id) || "-"}`,
      ].join(" | ")
    );
  }
}

async function resolveOwner(supabase: ReturnType<typeof getSupabaseAdmin>, options: ImportOptions) {
  if (options.creatorUsername) {
    const { data, error } = await supabase
      .from("creator_profiles")
      .select("id,user_id,username,display_name")
      .eq("username", options.creatorUsername)
      .maybeSingle();

    if (error) throw new Error(`Creator-Profil konnte nicht gelesen werden: ${error.message}`);
    if (data) {
      const row = data as { id: string; user_id: string; username: string; display_name: string | null };
      return {
        creatorProfileId: row.id,
        userId: row.user_id,
        username: row.username,
        displayName: row.display_name ?? row.username,
      };
    }
  }

  if (!options.userId) {
    throw new Error(
      `Kein Creator-Owner gefunden. Lege ein Creator-Profil an oder uebergib --creator-username=<username> fuer ein bestehendes Profil bzw. --user-id=<auth-user-id>.`
    );
  }

  const username = options.creatorUsername ?? "pd24-editorial";
  const { data: created, error: createError } = await supabase
    .from("creator_profiles")
    .upsert(
      {
        user_id: options.userId,
        username,
        display_name: "PerfectDay24 Editorial",
        creator_type: "creator",
        is_verified: true,
        tags: ["editorial", "perfectday24", "routes"],
        meta: {
          import_source: IMPORT_SOURCE,
          note: "Editorial owner profile for imported PerfectDay24 route content.",
        },
      },
      { onConflict: "user_id" }
    )
    .select("id,user_id,username,display_name")
    .single();

  if (createError) throw new Error(`Creator-Profil konnte nicht angelegt werden: ${createError.message}`);
  const row = created as { id: string; user_id: string; username: string; display_name: string | null };
  return {
    creatorProfileId: row.id,
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name ?? row.username,
  };
}

async function loadLocationsByCity(supabase: ReturnType<typeof getSupabaseAdmin>, citySlug: string) {
  const { data, error } = await supabase
    .from("locations")
    .select("id,name,city_slug,lat,lng,reservation_url,type,category")
    .eq("city_slug", citySlug)
    .limit(4000);

  if (error) throw new Error(`Locations fuer ${citySlug} konnten nicht geladen werden: ${error.message}`);
  return (data ?? []) as LocationCandidate[];
}

function tokenSet(value: string) {
  return new Set(
    normalizeKey(value)
      .split(" ")
      .map((part) => part.trim())
      .filter((part) => part.length >= 3)
  );
}

function scoreLocation(stop: SeedStop, location: LocationCandidate) {
  const stopKey = normalizeKey(stop.title);
  const locationKey = normalizeKey(location.name);
  if (!stopKey || !locationKey) return 0;
  if (stopKey === locationKey) return 100;
  if (locationKey.includes(stopKey) || stopKey.includes(locationKey)) return 82;

  const stopTokens = tokenSet(stop.title);
  const locationTokens = tokenSet(location.name ?? "");
  if (stopTokens.size === 0 || locationTokens.size === 0) return 0;
  const intersection = Array.from(stopTokens).filter((token) => locationTokens.has(token)).length;
  const union = new Set([...Array.from(stopTokens), ...Array.from(locationTokens)]).size;
  const jaccard = intersection / union;
  if (intersection >= 2 && jaccard >= 0.45) return 55 + Math.round(jaccard * 35);
  return 0;
}

function matchStop(stop: SeedStop, locations: LocationCandidate[]): MatchedStop {
  const seedLat = typeof stop.lat === "number" ? stop.lat : null;
  const seedLng = typeof stop.lng === "number" ? stop.lng : null;
  let best: { location: LocationCandidate; score: number } | null = null;
  for (const location of locations) {
    const score = scoreLocation(stop, location);
    if (!best || score > best.score) {
      best = { location, score };
    }
  }

  if (!best || best.score < 70) {
    return {
      ...stop,
      locationId: null,
      matchedLocationName: null,
      matchScore: null,
      lat: seedLat,
      lng: seedLng,
      geoSource: seedLat !== null && seedLng !== null ? "seed" : null,
      geocodedDisplayName: null,
    };
  }

  const locationLat = typeof best.location.lat === "number" ? best.location.lat : null;
  const locationLng = typeof best.location.lng === "number" ? best.location.lng : null;
  const lat = locationLat ?? seedLat;
  const lng = locationLng ?? seedLng;

  return {
    ...stop,
    locationId: best.location.id,
    matchedLocationName: best.location.name,
    matchScore: best.score,
    lat,
    lng,
    geoSource:
      locationLat !== null && locationLng !== null
        ? "location_match"
        : seedLat !== null && seedLng !== null
          ? "seed"
          : null,
    geocodedDisplayName: null,
  };
}

async function fetchNominatimGeocode(
  query: string,
  route: SeedRoute,
  city: PlannerRolloutCity | null,
  state: GeocodeState
) {
  const box = city ? cityViewbox(city) : null;
  const cacheKey = `${route.citySlug}:${box ? `${box.left},${box.top},${box.right},${box.bottom}` : "unbounded"}:${query}`;
  if (state.cache.has(cacheKey)) return state.cache.get(cacheKey) ?? null;
  if (state.remainingRequests !== null && state.remainingRequests <= 0) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "de");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("q", query);
  if (box) {
    url.searchParams.set("bounded", "1");
    url.searchParams.set("viewbox", `${box.left},${box.top},${box.right},${box.bottom}`);
  }

  await waitForNominatimSlot();
  state.requestCount += 1;
  if (state.remainingRequests !== null) state.remainingRequests -= 1;

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "accept-language": "de,en",
      "user-agent": "perfectday24-editorial-route-ingest/1.0",
    },
  });

  if (!response.ok) {
    console.warn(`Nominatim ${response.status} fuer ${route.slug}: ${query}`);
    state.cache.set(cacheKey, null);
    return null;
  }

  const data = (await response.json()) as NominatimPlace[];
  const result = data[0] ? parseNominatimPlace(data[0]) : null;
  state.cache.set(cacheKey, result);
  if (result) state.hitCount += 1;
  return result;
}

async function geocodeMissingStops(route: SeedRoute, stops: MatchedStop[], state: GeocodeState) {
  const city = cityConfigForSlug(route.citySlug);
  let updated = 0;

  for (const stop of stops) {
    if (hasCoordinates(stop)) continue;

    for (const query of geocodeQueries(stop, route, city)) {
      const result = await fetchNominatimGeocode(query, route, city, state);
      if (!result) continue;

      stop.lat = result.lat;
      stop.lng = result.lng;
      stop.geoSource = "nominatim";
      stop.geocodedDisplayName = result.displayName;
      updated += 1;
      break;
    }
  }

  return updated;
}

function countGeoSources(stops: MatchedStop[]) {
  return stops.reduce<Record<string, number>>((acc, stop) => {
    const key = stop.geoSource ?? "missing";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function buildRoutePayload(
  seed: SeedFile,
  route: SeedRoute,
  stops: MatchedStop[],
  owner: { userId: string; creatorProfileId: string },
  options: ImportOptions,
  existingRoute: ExistingRouteMedia | null
) {
  const firstStop = stops[0] ?? null;
  const allSourceUrls = unique([
    ...(route.sourceUrls ?? []),
    ...stops.flatMap((stop) => stop.sourceUrls ?? []),
  ]);
  const missingGeoStops = stops.filter((stop) => typeof stop.lat !== "number" || typeof stop.lng !== "number");
  const matchedStops = stops.filter((stop) => stop.locationId);
  const geocodedStops = stops.filter((stop) => stop.geoSource === "nominatim");
  const tags = unique([...(route.tags ?? []), "editorial", "influencer-inspired"]);

  return {
    id: existingRoute?.id ?? undefined,
    user_id: owner.userId,
    creator_profile_id: owner.creatorProfileId,
    city_slug: route.citySlug,
    title: route.title,
    slug: route.slug,
    description: route.description ?? null,
    cover_image_url: existingRoute?.cover_image_url ?? null,
    start_label: firstStop?.title ?? null,
    start_type: "other",
    start_lat: firstStop?.lat ?? null,
    start_lng: firstStop?.lng ?? null,
    visibility: options.visibility ?? route.visibility ?? "public",
    creator_type: options.creatorType ?? (route.creatorType === "editorial" ? "creator" : route.creatorType ?? "creator"),
    is_featured: false,
    quality_score: missingGeoStops.length === 0 ? 0.82 : matchedStops.length > 0 ? 0.72 : 0.64,
    trending_score: 0,
    ranking_score: missingGeoStops.length === 0 ? 0.7 : 0.55,
    tags,
    meta: safeJsonObject({
      import_source: IMPORT_SOURCE,
      import_source_version: seed.version,
      seed_status: seed.status ?? null,
      seed_created_at: seed.createdAt ?? null,
      source_urls: allSourceUrls,
      source_type: route.sourceType ?? null,
      editorial_status: missingGeoStops.length === 0 ? "ready" : "needs_geocoding",
      editorial_creator_type: route.creatorType ?? "editorial",
      rights_note: seed.importNotes?.rightsNote ?? null,
      primaryTheme: inferTheme(route),
      durationBucket: computeDurationBucket(stops.length),
      routeTags: tags,
      matched_stop_count: matchedStops.length,
      geocoded_stop_count: geocodedStops.length,
      missing_geo_stop_count: missingGeoStops.length,
      geo_source_counts: countGeoSources(stops),
      imported_at: new Date().toISOString(),
      ...preservedImageMeta(existingRoute?.meta),
    }),
  };
}

function buildStopPayload(routeId: string, stop: MatchedStop, existingStop: ExistingStopMedia | null) {
  return {
    route_id: routeId,
    stop_order: stop.order,
    location_id: stop.locationId,
    title: stop.title,
    note: stop.note ?? null,
    external_url: stop.sourceUrls?.[0] ?? null,
    is_required: true,
    duration_min: typeof stop.durationMin === "number" ? stop.durationMin : null,
    lat: stop.lat,
    lng: stop.lng,
    photo_url: existingStop?.photo_url ?? null,
    meta: safeJsonObject({
      import_source: IMPORT_SOURCE,
      stop_type: stop.type ?? null,
      address: stop.address ?? null,
      source_urls: stop.sourceUrls ?? [],
      matched_location_name: stop.matchedLocationName,
      location_match_score: stop.matchScore,
      geo_source: stop.geoSource,
      geocoded_display_name: stop.geocodedDisplayName,
      needs_geocoding: typeof stop.lat !== "number" || typeof stop.lng !== "number",
      ...preservedImageMeta(existingStop?.meta),
    }),
  };
}

function canReplaceExisting(route: { user_id?: unknown; creator_type?: unknown; meta?: unknown }, ownerUserId: string) {
  const meta = route.meta && typeof route.meta === "object" ? (route.meta as JsonObject) : {};
  return (
    route.user_id === ownerUserId ||
    route.creator_type === "editorial" ||
    meta.import_source === IMPORT_SOURCE
  );
}

async function importRoutes(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  seed: SeedFile,
  routes: SeedRoute[],
  owner: { userId: string; creatorProfileId: string; username: string },
  options: ImportOptions
) {
  const locationCache = new Map<string, LocationCandidate[]>();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let insertedStops = 0;
  let geocodedStops = 0;
  const geocodeState: GeocodeState = {
    cache: new Map(),
    remainingRequests: options.geocodeLimit,
    requestCount: 0,
    hitCount: 0,
  };

  for (const route of routes) {
    if (!locationCache.has(route.citySlug)) {
      locationCache.set(
        route.citySlug,
        options.matchLocations ? await loadLocationsByCity(supabase, route.citySlug) : []
      );
    }

    const cityLocations = locationCache.get(route.citySlug) ?? [];
    const matchedStops = route.stops
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((stop) => matchStop(stop, cityLocations));

    const { data: existing, error: existingError } = await supabase
      .from("user_routes")
      .select("id,user_id,creator_type,cover_image_url,meta")
      .eq("slug", route.slug)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Bestehende Route ${route.slug} konnte nicht gelesen werden: ${existingError.message}`);
    }

    const existingRow = existing as
      | { id: string; user_id?: string; creator_type?: string; cover_image_url?: string | null; meta?: unknown }
      | null;
    if (existingRow && !options.force && !canReplaceExisting(existingRow, owner.userId)) {
      console.warn(`Skip ${route.slug}: existiert bereits und wirkt nicht wie ein ${IMPORT_SOURCE}-Import.`);
      skipped += 1;
      continue;
    }

    const geocodedInRoute = options.geocodeMissing
      ? await geocodeMissingStops(route, matchedStops, geocodeState)
      : 0;
    geocodedStops += geocodedInRoute;

    const existingStopMedia = new Map<number, ExistingStopMedia>();
    if (existingRow) {
      const { data: oldStops, error: oldStopsError } = await supabase
        .from("user_route_stops")
        .select("stop_order,photo_url,meta")
        .eq("route_id", existingRow.id);
      if (oldStopsError) {
        throw new Error(`Bestehende Stop-Bilder fuer ${route.slug} konnten nicht gelesen werden: ${oldStopsError.message}`);
      }
      for (const oldStop of (oldStops ?? []) as ExistingStopMedia[]) {
        existingStopMedia.set(oldStop.stop_order, oldStop);
      }
    }

    const payload = buildRoutePayload(seed, route, matchedStops, owner, options, existingRow ?? null);
    const routeWrite = existingRow
      ? await supabase.from("user_routes").update(payload).eq("id", existingRow.id).select("id").single()
      : await supabase.from("user_routes").insert(payload).select("id").single();

    if (routeWrite.error) {
      throw new Error(`Route ${route.slug} konnte nicht geschrieben werden: ${routeWrite.error.message}`);
    }

    const routeId = (routeWrite.data as { id: string }).id;
    const deleteResult = await supabase.from("user_route_stops").delete().eq("route_id", routeId);
    if (deleteResult.error) {
      throw new Error(`Stops fuer ${route.slug} konnten nicht ersetzt werden: ${deleteResult.error.message}`);
    }

    const stopPayload = matchedStops.map((stop) => buildStopPayload(routeId, stop, existingStopMedia.get(stop.order) ?? null));
    const stopInsert = await supabase.from("user_route_stops").insert(stopPayload);
    if (stopInsert.error) {
      throw new Error(`Stops fuer ${route.slug} konnten nicht angelegt werden: ${stopInsert.error.message}`);
    }

    insertedStops += stopPayload.length;
    if (existingRow) updated += 1;
    else created += 1;

    const missingGeo = matchedStops.filter((stop) => typeof stop.lat !== "number" || typeof stop.lng !== "number").length;
    console.log(
      `${existingRow ? "updated" : "created"} ${route.slug} (${matchedStops.length} stops, ${missingGeo} ohne Koordinaten, ${geocodedInRoute} geocoded)`
    );
  }

  return {
    created,
    updated,
    skipped,
    insertedStops,
    geocodedStops,
    geocodeRequests: geocodeState.requestCount,
    geocodeHits: geocodeState.hitCount,
  };
}

function summarizeDryRun(routes: SeedRoute[]) {
  const stopCount = routes.reduce((sum, route) => sum + route.stops.length, 0);
  const cities = new Map<string, number>();
  for (const route of routes) {
    cities.set(route.citySlug, (cities.get(route.citySlug) ?? 0) + 1);
  }

  console.log(`Dry-Run: ${routes.length} Routen, ${stopCount} Stops, ${cities.size} Staedte.`);
  for (const [citySlug, count] of Array.from(cities.entries()).sort()) {
    console.log(`  ${citySlug}: ${count} Routen`);
  }
  console.log("Kein DB-Write. Fuer Import: npm.cmd run routes:ingest:editorial -- --commit --creator-username=<username>");
  console.log(
    "Geocoding fehlender Stops: npm.cmd run routes:ingest:editorial -- --commit --creator-username=<username> --geocode-missing"
  );
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  const options = parseArgs();

  if (options.listCreators) {
    await listCreators(getSupabaseAdmin());
    return;
  }

  const seed = readSeed(options.filePath);
  const routes = filterRoutes(seed.routes, options);
  if (routes.length === 0) {
    throw new Error("Keine Routen nach Filterung uebrig.");
  }

  if (!options.commit) {
    summarizeDryRun(routes);
    return;
  }

  const supabase = getSupabaseAdmin();
  const owner = await resolveOwner(supabase, options);
  console.log(`Import owner: ${owner.displayName} (@${owner.username})`);
  const result = await importRoutes(supabase, seed, routes, owner, options);
  console.log(
    `Fertig: ${result.created} erstellt, ${result.updated} aktualisiert, ${result.skipped} uebersprungen, ${result.insertedStops} Stops geschrieben.`
  );
  if (options.geocodeMissing) {
    console.log(
      `Geocoding: ${result.geocodedStops} Stops ergaenzt, ${result.geocodeRequests} Nominatim-Requests, ${result.geocodeHits} Treffer.`
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
