import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PLANNER_33_CITY_CONFIGS } from "../lib/cities/rollout";

type CityConfig = {
  slug: string;
  label: string;
  countryCode: string;
  lat: number;
  lng: number;
  radiusM: number;
};

type IngestFocus = "full" | "food";

type OverpassElement = {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

type NominatimPlace = {
  osm_id: number;
  osm_type: "node" | "way" | "relation";
  lat?: string;
  lon?: string;
  class?: string;
  type?: string;
  name?: string;
  display_name?: string;
  extratags?: Record<string, string>;
};

type ManualSeedRow = {
  city_slug: string;
  name: string;
  category: "cafe" | "restaurant" | "activity" | "culture" | "nightlife" | "other";
  type: string;
  subtypes: string[];
  audiences: string[];
  occasions: string[];
  lat: number | null;
  lng: number | null;
  reservation_url: string | null;
  budget: "low" | "medium" | "high" | "free" | null;
  indoor_outdoor: "indoor" | "outdoor" | "mixed" | null;
  energy_level: "low" | "medium" | "high" | "late" | null;
  family_friendly: boolean;
  nightlife_fit: boolean;
  duration_min: number | null;
  opening_hours_raw: string | null;
  manual_boost: number;
  data_confidence: number;
  source_primary: string;
  import_batch: string;
  notes: string | null;
  is_active: boolean;
  publish_status: "draft";
  published_location_id: null;
  last_publish_error: null;
};

type LocationRow = {
  id: string;
  name: string | null;
  city_slug: string | null;
  type: string | null;
  is_plannable: boolean | null;
  manual_boost: number | null;
  data_confidence: number | null;
  reservation_url?: string | null;
  tags?: string[] | null;
  subtypes?: string[] | null;
  created_at?: string | null;
};

const CITY_CONFIGS: Record<string, CityConfig> = PLANNER_33_CITY_CONFIGS;

function loadEnvFile(path: string) {
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

function parseArg(name: string) {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function normalizeText(value: string | null | undefined) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => normalizeText(value)).filter((value): value is string => Boolean(value)))
  );
}

function locationDuplicateKey(location: Pick<LocationRow, "name" | "city_slug" | "type">) {
  return [
    normalizeText(location.name).toLowerCase(),
    normalizeText(location.type).toLowerCase(),
    normalizeText(location.city_slug).toLowerCase(),
  ].join("::");
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

function categoryForElement(tags: Record<string, string>) {
  const amenity = normalizeText(tags.amenity).toLowerCase();
  const tourism = normalizeText(tags.tourism).toLowerCase();
  const leisure = normalizeText(tags.leisure).toLowerCase();

  if (amenity === "cafe") return { category: "cafe" as const, type: "cafe" };
  if (amenity === "restaurant") return { category: "restaurant" as const, type: "restaurant" };
  if (amenity === "bar" || amenity === "pub" || amenity === "biergarten" || amenity === "nightclub") {
    return { category: "nightlife" as const, type: amenity };
  }
  if (amenity === "theatre" || amenity === "cinema" || amenity === "arts_centre") {
    return { category: "culture" as const, type: amenity };
  }
  if (tourism === "museum" || tourism === "gallery" || tourism === "attraction" || tourism === "viewpoint") {
    return { category: "culture" as const, type: tourism };
  }
  if (leisure === "park" || leisure === "garden" || leisure === "miniature_golf" || leisure === "bowling_alley") {
    return { category: "activity" as const, type: leisure };
  }
  if (normalizeText(tags.historic)) {
    return { category: "culture" as const, type: "historic_site" };
  }
  return { category: "other" as const, type: amenity || tourism || leisure || "poi" };
}

function subtypesForElement(tags: Record<string, string>, type: string) {
  const amenity = normalizeText(tags.amenity).toLowerCase();
  const tourism = normalizeText(tags.tourism).toLowerCase();
  const leisure = normalizeText(tags.leisure).toLowerCase();
  const name = normalizeText(tags.name).toLowerCase();

  return unique([
    amenity === "pub" ? "pub" : null,
    amenity === "bar" && name.includes("cocktail") ? "cocktail_bar" : null,
    amenity === "bar" && name.includes("rooftop") ? "rooftop_bar" : null,
    amenity === "nightclub" ? "nightclub" : null,
    tourism === "viewpoint" ? "viewpoint" : null,
    tourism === "museum" ? "museum" : null,
    tourism === "gallery" ? "gallery" : null,
    tourism === "attraction" ? "landmark" : null,
    leisure === "park" ? "park" : null,
    leisure === "garden" ? "botanical_garden" : null,
    leisure === "miniature_golf" ? "minigolf" : null,
    leisure === "bowling_alley" ? "bowling" : null,
    normalizeText(tags.historic) ? "historic_site" : null,
    amenity === "cinema" ? "cinema" : null,
    amenity === "theatre" ? "performing_arts" : null,
    type,
  ]);
}

function audiencesForSeed(category: ManualSeedRow["category"], subtypes: string[]) {
  if (subtypes.includes("park") || subtypes.includes("botanical_garden") || subtypes.includes("museum")) {
    return ["family", "tourism"];
  }
  if (category === "cafe" || category === "restaurant") return ["date", "friends"];
  if (category === "nightlife") return ["friends", "party", "date"];
  if (category === "culture") return ["date", "tourism", "friends"];
  if (category === "activity") return ["date", "friends", "tourism"];
  return ["tourism"];
}

function occasionsForSeed(category: ManualSeedRow["category"], subtypes: string[]) {
  if (category === "cafe" || category === "restaurant") return ["date", "friends", "family", "tourism"];
  if (category === "nightlife") return ["date", "friends", "party"];
  if (subtypes.includes("museum") || subtypes.includes("gallery") || subtypes.includes("landmark")) {
    return ["tourism", "date", "friends"];
  }
  if (subtypes.includes("park") || subtypes.includes("botanical_garden")) {
    return ["date", "family", "friends", "tourism"];
  }
  return ["friends", "tourism"];
}

function indoorOutdoorForSeed(tags: Record<string, string>, category: ManualSeedRow["category"], subtypes: string[]) {
  if (normalizeText(tags.outdoor) === "yes") return "outdoor" as const;
  if (normalizeText(tags.indoor) === "yes") return "indoor" as const;
  if (subtypes.includes("park") || subtypes.includes("botanical_garden") || subtypes.includes("viewpoint")) {
    return "outdoor" as const;
  }
  if (category === "nightlife" || category === "cafe" || category === "restaurant" || category === "culture") {
    return "indoor" as const;
  }
  return null;
}

function energyLevelForSeed(category: ManualSeedRow["category"], subtypes: string[]) {
  if (subtypes.includes("nightclub")) return "high" as const;
  if (category === "nightlife") return "medium" as const;
  if (subtypes.includes("minigolf") || subtypes.includes("bowling")) return "medium" as const;
  return category === "cafe" || category === "culture" ? "low" as const : null;
}

function durationForSeed(category: ManualSeedRow["category"], subtypes: string[]) {
  if (category === "restaurant") return 95;
  if (category === "cafe") return 60;
  if (subtypes.includes("museum") || subtypes.includes("gallery")) return 90;
  if (subtypes.includes("park") || subtypes.includes("viewpoint")) return 60;
  if (subtypes.includes("minigolf") || subtypes.includes("bowling")) return 75;
  if (category === "nightlife") return 80;
  return 60;
}

function budgetForSeed(category: ManualSeedRow["category"], subtypes: string[]) {
  if (category === "activity") return subtypes.includes("park") || subtypes.includes("viewpoint") ? "free" as const : "low" as const;
  if (category === "culture") {
    if (subtypes.includes("museum") || subtypes.includes("gallery") || subtypes.includes("cinema")) {
      return "medium" as const;
    }
    return "low" as const;
  }
  if (category === "nightlife") return "medium" as const;
  if (category === "restaurant") return "medium" as const;
  if (category === "cafe") return "low" as const;
  return "low" as const;
}

function manualBoostForSeed(category: ManualSeedRow["category"], subtypes: string[], tags: Record<string, string>) {
  let score = 0;
  if (category === "restaurant" || category === "cafe") score += 10;
  if (category === "nightlife") score += 12;
  if (subtypes.includes("museum") || subtypes.includes("gallery")) score += 8;
  if (subtypes.includes("viewpoint") || subtypes.includes("landmark")) score += 10;
  if (normalizeText(tags.website) || normalizeText(tags["contact:website"])) score += 4;
  if (normalizeText(tags.opening_hours)) score += 4;
  if (normalizeText(tags.phone) || normalizeText(tags["contact:phone"])) score += 2;
  return score;
}

function reservationUrlForSeed(tags: Record<string, string>) {
  return (
    normalizeText(tags.website) ||
    normalizeText(tags["contact:website"]) ||
    normalizeText(tags.url) ||
    null
  );
}

function locationQualityScore(location: LocationRow) {
  let score = 0;
  score += Number(location.manual_boost ?? 0);
  score += Number(location.data_confidence ?? 0) * 10;
  if (normalizeText(location.reservation_url)) score += 6;
  score += (location.subtypes?.length ?? 0) * 2;
  score += Math.min(location.tags?.length ?? 0, 8);
  return score;
}

async function loadCityLocations(supabase: any, citySlug: string) {
  const rows: LocationRow[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("locations")
      .select("id,name,city_slug,type,is_plannable,manual_boost,data_confidence,reservation_url,tags,subtypes,created_at")
      .eq("city_slug", citySlug)
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Locations laden fehlgeschlagen: ${error.message}`);
    if (!data || data.length === 0) break;

    rows.push(...(data as LocationRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function hideDuplicateLocations(supabase: any, citySlug: string) {
  const locations = await loadCityLocations(supabase, citySlug);
  const groups = new Map<string, LocationRow[]>();

  for (const location of locations) {
    if (!location.is_plannable) continue;
    const key = locationDuplicateKey(location);
    if (!key || key.startsWith("::::")) continue;
    const list = groups.get(key) ?? [];
    list.push(location);
    groups.set(key, list);
  }

  const duplicateIds: string[] = [];

  for (const [, group] of groups) {
    if (group.length < 2) continue;
    group.sort((a, b) => {
      const scoreDiff = locationQualityScore(b) - locationQualityScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
    });
    duplicateIds.push(...group.slice(1).map((location) => location.id));
  }

  if (duplicateIds.length === 0) return 0;

  const chunkSize = 200;
  for (let index = 0; index < duplicateIds.length; index += chunkSize) {
    const chunk = duplicateIds.slice(index, index + chunkSize);
    const { error } = await (supabase
      .from("locations")
      .update({
        is_plannable: false,
        last_enriched_at: new Date().toISOString(),
      })
      .in("id", chunk) as any);

    if (error) throw new Error(`Location-Dedupe fehlgeschlagen: ${error.message}`);
  }
  return duplicateIds.length;
}

function coordsForElement(element: OverpassElement) {
  if (typeof element.lat === "number" && typeof element.lon === "number") {
    return { lat: element.lat, lng: element.lon };
  }
  if (typeof element.center?.lat === "number" && typeof element.center?.lon === "number") {
    return { lat: element.center.lat, lng: element.center.lon };
  }
  return { lat: null, lng: null };
}

function normalizeOverpassElement(
  element: OverpassElement,
  city: CityConfig,
  importBatch: string
): ManualSeedRow | null {
  const tags = element.tags ?? {};
  const name = normalizeText(tags.name);
  if (!name) return null;

  const { category, type } = categoryForElement(tags);
  if (category === "other") return null;

  const subtypes = subtypesForElement(tags, type);
  const audiences = audiencesForSeed(category, subtypes);
  const occasions = occasionsForSeed(category, subtypes);
  const { lat, lng } = coordsForElement(element);

  return {
    city_slug: city.slug,
    name,
    category,
    type,
    subtypes,
    audiences,
    occasions,
    lat,
    lng,
    reservation_url: reservationUrlForSeed(tags),
    budget: budgetForSeed(category, subtypes),
    indoor_outdoor: indoorOutdoorForSeed(tags, category, subtypes),
    energy_level: energyLevelForSeed(category, subtypes),
    family_friendly: audiences.includes("family"),
    nightlife_fit: category === "nightlife",
    duration_min: durationForSeed(category, subtypes),
    opening_hours_raw: normalizeText(tags.opening_hours) || null,
    manual_boost: manualBoostForSeed(category, subtypes, tags),
    data_confidence: 0.82,
    source_primary: "osm_seed",
    import_batch: importBatch,
    notes: `${element.type}/${element.id}`,
    is_active: true,
    publish_status: "draft",
    published_location_id: null,
    last_publish_error: null,
  };
}

async function fetchOverpassSeeds(city: CityConfig, radiusM: number) {
  const queryGroups = [
    `nwr["amenity"~"^(cafe|restaurant)$"](around:${radiusM},${city.lat},${city.lng});`,
    `nwr["amenity"~"^(bar|pub|biergarten|nightclub)$"](around:${radiusM},${city.lat},${city.lng});`,
    `nwr["amenity"~"^(theatre|cinema|arts_centre)$"](around:${radiusM},${city.lat},${city.lng});`,
    `nwr["tourism"~"^(museum|gallery|attraction|viewpoint)$"](around:${radiusM},${city.lat},${city.lng});`,
    `nwr["leisure"~"^(park|garden|miniature_golf|bowling_alley)$"](around:${radiusM},${city.lat},${city.lng});`,
    `nwr["historic"](around:${radiusM},${city.lat},${city.lng});`,
  ];
  return fetchOverpassSeedsForQueryGroups(city, radiusM, queryGroups);
}

async function fetchFoodBackfillSeeds(city: CityConfig, radiusM: number) {
  const queryGroups = [
    `nwr["amenity"="restaurant"](around:${radiusM},${city.lat},${city.lng});`,
    `nwr["amenity"="cafe"](around:${radiusM},${city.lat},${city.lng});`,
  ];

  return fetchOverpassSeedsForQueryGroups(city, radiusM, queryGroups, 120);
}

async function fetchOverpassSeedsForQueryGroups(
  city: CityConfig,
  radiusM: number,
  queryGroups: string[],
  fallbackLimit = 40
) {
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  const elements = new Map<string, OverpassElement>();

  for (const bodyLine of queryGroups) {
    const query = `
[out:json][timeout:75];
(
  ${bodyLine}
);
out center tags;
`.trim();

    let lastError: string | null = null;

    // Zwei Runden über alle Mirrors (mit Abkühlpause) BEVOR auf den mageren
    // Nominatim-Fallback degradiert wird — ein temporäres 429 darf die
    // Datenqualität einer Stadt nicht ruinieren.
    rounds: for (let round = 0; round < 2; round++) {
    if (round > 0) await new Promise((r) => setTimeout(r, 60_000));
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "text/plain;charset=UTF-8",
            "user-agent": "perfectday24-location-ingest/1.0",
          },
          body: query,
          // Hänger-Schutz: ein toter Mirror (z.B. kumi.systems ohne Response) darf
          // die Stadt nicht ewig blockieren — Server-Timeout ist 75s, Client 120s.
          signal: AbortSignal.timeout(120_000),
        });

        if (!response.ok) {
          lastError = `${endpoint} HTTP ${response.status}`;
          continue;
        }

        const body = await response.text();
        let payload: { elements?: OverpassElement[] } | null = null;
        try {
          payload = JSON.parse(body) as { elements?: OverpassElement[] };
        } catch {
          lastError = `${endpoint} invalid-json`;
          continue;
        }

        for (const element of payload.elements ?? []) {
          elements.set(`${element.type}/${element.id}`, element);
        }
        lastError = null;
        break rounds;
      } catch (error) {
        lastError = `${endpoint} ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    }

    // Höflichkeits-Delay zwischen Query-Groups (Overpass-Slots schonen)
    await new Promise((r) => setTimeout(r, 2_000));

    if (lastError) {
      const fallback = await fetchNominatimFallbackSeeds(city, radiusM, bodyLine, fallbackLimit);
      for (const element of fallback) {
        elements.set(`${element.type}/${element.id}`, element);
      }
    }
  }

  return [...elements.values()];
}

function cityViewbox(city: CityConfig, radiusM: number) {
  const latDelta = radiusM / 111_000;
  const lngDelta = radiusM / (111_000 * Math.cos((city.lat * Math.PI) / 180));
  return {
    left: city.lng - lngDelta,
    right: city.lng + lngDelta,
    top: city.lat + latDelta,
    bottom: city.lat - latDelta,
  };
}

function nominatimQueriesForGroup(groupQuery: string) {
  if (groupQuery.includes("cafe|restaurant")) return ["restaurant", "cafe"];
  if (groupQuery.includes("bar|pub|biergarten|nightclub")) return ["bar", "pub", "biergarten", "nightclub"];
  if (groupQuery.includes("theatre|cinema|arts_centre")) return ["theatre", "cinema", "arts centre"];
  if (groupQuery.includes("museum|gallery|attraction|viewpoint")) return ["museum", "gallery", "attraction", "viewpoint"];
  if (groupQuery.includes("park|garden|miniature_golf|bowling_alley")) return ["park", "garden", "mini golf", "bowling"];
  return ["historic"];
}

function nominatimPlaceToElement(place: NominatimPlace): OverpassElement | null {
  const name = normalizeText(place.name || place.display_name?.split(",")[0] || "");
  if (!name) return null;

  const tags: Record<string, string> = {
    ...(place.extratags ?? {}),
    name,
  };

  if (place.class === "amenity") tags.amenity = normalizeText(place.type);
  if (place.class === "tourism") tags.tourism = normalizeText(place.type);
  if (place.class === "leisure") tags.leisure = normalizeText(place.type);
  if (place.class === "historic") tags.historic = normalizeText(place.type || "yes");

  const lat = place.lat ? Number(place.lat) : null;
  const lon = place.lon ? Number(place.lon) : null;

  return {
    id: place.osm_id,
    type: place.osm_type,
    lat: Number.isFinite(lat) ? lat ?? undefined : undefined,
    lon: Number.isFinite(lon) ? lon ?? undefined : undefined,
    tags,
  };
}

async function fetchNominatimFallbackSeeds(
  city: CityConfig,
  radiusM: number,
  groupQuery: string,
  limit = 40
) {
  const box = cityViewbox(city, radiusM);
  const queries = nominatimQueriesForGroup(groupQuery);
  const places = new Map<string, OverpassElement>();

  for (const query of queries) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("bounded", "1");
    url.searchParams.set("q", `${query} ${city.label}`);
    url.searchParams.set("viewbox", `${box.left},${box.top},${box.right},${box.bottom}`);
    url.searchParams.set("addressdetails", "0");
    url.searchParams.set("extratags", "1");

    const response = await fetch(url, {
      headers: {
        "user-agent": "perfectday24-location-ingest/1.0",
        accept: "application/json",
      },
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) continue;
    const data = (await response.json()) as NominatimPlace[];
    for (const place of data) {
      const element = nominatimPlaceToElement(place);
      if (!element) continue;
      places.set(`${element.type}/${element.id}`, element);
    }
  }

  return [...places.values()];
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen.");
  }

  const citySlug = parseArg("city") ?? "muenchen";
  const city = CITY_CONFIGS[citySlug];
  if (!city) {
    throw new Error(`Unbekannte Stadt: ${citySlug}`);
  }

  const focusArg = normalizeText(parseArg("focus") ?? "full").toLowerCase();
  const focus: IngestFocus = focusArg === "food" ? "food" : "full";
  const radiusM = Number(parseArg("radius") ?? city.radiusM);
  const publishLimit = Math.max(0, Number(parseArg("publishLimit") ?? "25"));
  // Cap per RPC call to stay below statement timeout (each call walks the
  // PostGIS match query for every seed). Tested values: 50 = safe, 1000 = timeout.
  const PUBLISH_BATCH_SIZE = 50;
  const importBatch =
    parseArg("batch") ??
    `osm_seed_${city.slug}_${new Date().toISOString().replace(/[:.]/g, "-")}`;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const raw =
    focus === "food"
      ? await fetchFoodBackfillSeeds(city, radiusM)
      : await fetchOverpassSeeds(city, radiusM);
  const normalized = raw
    .map((element) => normalizeOverpassElement(element, city, importBatch))
    .filter((seed): seed is ManualSeedRow => seed !== null);

  const deduped = Array.from(
    new Map(
      normalized.map((seed) => [`${seed.city_slug}::${seed.name.toLowerCase()}::${seed.type}`, seed] as const)
    ).values()
  );
  const categoryLimits: Record<ManualSeedRow["category"], number> =
    focus === "food"
      ? {
          restaurant: 220,
          cafe: 180,
          nightlife: 0,
          culture: 0,
          activity: 0,
          other: 0,
        }
      : {
          restaurant: 160,
          cafe: 120,
          nightlife: 120,
          culture: 140,
          activity: 100,
          other: 0,
        };
  const scored = deduped
    .map((seed) => {
      const distanceKm =
        seed.lat != null && seed.lng != null
          ? haversineKm(city.lat, city.lng, seed.lat, seed.lng)
          : 50;
      let score = seed.manual_boost;
      if (seed.category === "restaurant" || seed.category === "cafe") score += 20;
      if (seed.category === "nightlife") score += 16;
      if (seed.category === "culture") score += 12;
      if (seed.category === "activity") score += 8;
      if (seed.reservation_url) score += 8;
      if (seed.indoor_outdoor) score += 4;
      if (seed.energy_level) score += 3;
      if (seed.family_friendly) score += 2;
      score -= Math.round(distanceKm * 1.5);
      return { seed, score, distanceKm };
    })
    .sort((a, b) => b.score - a.score);
  const perCategoryCounts: Record<ManualSeedRow["category"], number> = {
    restaurant: 0,
    cafe: 0,
    nightlife: 0,
    culture: 0,
    activity: 0,
    other: 0,
  };
  const curated = scored.filter(({ seed }) => {
    const limit = categoryLimits[seed.category];
    if (limit <= 0) return false;
    if (perCategoryCounts[seed.category] >= limit) return false;
    perCategoryCounts[seed.category] += 1;
    return true;
  }).map((entry) => entry.seed);

  if (curated.length === 0) {
    console.log(`[locations] ${city.slug}: keine Seeds gefunden`);
    return;
  }

  // Schema-Drift-Guard: die Migration 20260621120000_opening_hours_raw.sql ist evtl.
  // noch nicht auf der Live-DB. Fehlt die Spalte, Seeds ohne sie schreiben (Warnung) —
  // Öffnungszeiten können später via backfill-opening-hours nachgezogen werden.
  const { error: hoursColumnError } = await supabase
    .from("location_manual_seeds")
    .select("opening_hours_raw")
    .limit(1);
  let upsertRows: Array<Record<string, unknown>> = curated;
  if (hoursColumnError) {
    console.warn(
      `[locations] ${city.slug}: opening_hours_raw fehlt in location_manual_seeds (Migration 20260621120000 nicht angewandt) — Seeds werden ohne Öffnungszeiten geschrieben`
    );
    upsertRows = curated.map(({ opening_hours_raw: _hours, ...rest }) => rest);
  }

  const { error: upsertError } = await supabase
    .from("location_manual_seeds")
    .upsert(upsertRows, {
      onConflict: "city_slug,name,type",
      ignoreDuplicates: false,
    });

  if (upsertError) {
    throw new Error(`Manual seed upsert fehlgeschlagen: ${upsertError.message}`);
  }

  let published = 0;
  let merged = 0;
  if (publishLimit > 0) {
    const totalLimit = publishLimit;
    let totalProcessed = 0;
    while (totalProcessed < totalLimit) {
      const batchLimit = Math.min(PUBLISH_BATCH_SIZE, totalLimit - totalProcessed);
      const { data, error } = await supabase.rpc("pd24_publish_manual_seed_batch", {
        p_city_slug: city.slug,
        p_import_batch: importBatch,
        p_limit: batchLimit,
        p_max_distance_m: 250,
      });

      if (error) {
        throw new Error(`Manual seed publish fehlgeschlagen: ${error.message}`);
      }

      const rows = (data ?? []) as Array<{ publish_status?: string | null }>;
      if (rows.length === 0) break;

      published += rows.filter((row) => row.publish_status === "published").length;
      merged += rows.filter((row) => row.publish_status === "merged").length;
      totalProcessed += rows.length;

      if (rows.length < batchLimit) break;
    }
  }

  const { count: locationCount, error: countError } = await supabase
    .from("locations")
    .select("*", { count: "exact", head: true })
    .eq("city_slug", city.slug)
    .eq("is_plannable", true);

  if (countError) {
    throw new Error(`Locations Count fehlgeschlagen: ${countError.message}`);
  }

  const hiddenDuplicates = await hideDuplicateLocations(supabase, city.slug);
  const { count: dedupedLocationCount, error: dedupedCountError } = await supabase
    .from("locations")
    .select("*", { count: "exact", head: true })
    .eq("city_slug", city.slug)
    .eq("is_plannable", true);

  if (dedupedCountError) {
    throw new Error(`Locations Count nach Dedupe fehlgeschlagen: ${dedupedCountError.message}`);
  }

  console.log(
    `[locations] ${city.slug} (${focus}): ${raw.length} raw, ${deduped.length} seeds, ${curated.length} kuratiert, ${published} neu, ${merged} gemerged, ${hiddenDuplicates} Dubletten ausgeblendet, ${dedupedLocationCount ?? locationCount ?? 0} plannable locations`
  );
}

main().catch((error) => {
  console.error("[locations] failed:", error);
  process.exitCode = 1;
});
