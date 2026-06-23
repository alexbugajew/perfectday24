import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PLANNER_33_ROLLOUT } from "../lib/cities/rollout";

type OverpassElement = {
  id: number;
  type: "node" | "way" | "relation";
  tags?: Record<string, string>;
};

type CityArg = { slug: string; label: string; lat: number; lng: number; radiusM: number };

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

// Normalisiert Stadt-POI-Namen für Matching zwischen Overpass und unserer DB.
// Behandelt: Großschreibung, deutsche Umlaute, Diakritik (é, ñ, ç), Punctuation
// (Apostroph in "L'Etoile"), häufige Suffixe ("GmbH", "& Co. KG"), Whitespace.
function norm(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    // Diakritik via NFD + Combining-Mark-Removal (é → e, ñ → n, ç → c, etc.)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // Common business suffixes als Wort-Boundary
    .replace(/\b(gmbh|ag|kg|gbr|ohg|ug|e\s*v|inc|ltd|co\.?\s*kg)\b\.?/g, " ")
    // & + andere Punctuation → Whitespace
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchOpeningHours(city: CityArg): Promise<Map<string, string>> {
  // Overpass query: alle POIs mit name + opening_hours im Radius.
  // Filtert direkt in der Query — minimiert Datenmenge.
  const queryGroups = [
    `nwr["amenity"~"^(cafe|restaurant|bar|pub|biergarten|nightclub|theatre|cinema|arts_centre)$"]["name"]["opening_hours"](around:${city.radiusM},${city.lat},${city.lng});`,
    `nwr["tourism"~"^(museum|gallery|attraction|viewpoint)$"]["name"]["opening_hours"](around:${city.radiusM},${city.lat},${city.lng});`,
    `nwr["leisure"~"^(park|garden|miniature_golf|bowling_alley)$"]["name"]["opening_hours"](around:${city.radiusM},${city.lat},${city.lng});`,
    `nwr["historic"]["name"]["opening_hours"](around:${city.radiusM},${city.lat},${city.lng});`,
  ];

  const query = `[out:json][timeout:75];\n(${queryGroups.join("\n")});\nout center tags;`;
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  const map = new Map<string, string>();
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const endpoint of endpoints) {
      // Hard timeout — sonst kann fetch endlos hängen ohne Fehler.
      const ac = new AbortController();
      const timeoutId = setTimeout(() => ac.abort(), 90_000);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "text/plain;charset=UTF-8",
            "user-agent": "perfectday24-opening-hours-backfill/1.0",
          },
          body: query,
          signal: ac.signal,
        });
        if (!res.ok) {
          if (res.status === 429 || res.status === 504) continue;
          throw new Error(`overpass HTTP ${res.status}`);
        }
        const body = await res.text();
        const json = JSON.parse(body) as { elements?: OverpassElement[] };
        const elements = json.elements ?? [];
        for (const el of elements) {
          const name = el.tags?.name;
          const oh = el.tags?.opening_hours;
          if (!name || !oh) continue;
          const key = norm(name);
          if (!map.has(key)) map.set(key, oh);
        }
        clearTimeout(timeoutId);
        return map;
      } catch (err) {
        clearTimeout(timeoutId);
        if (attempt === 2 && endpoint === endpoints[endpoints.length - 1]) throw err;
        // Try next endpoint
      }
    }
    await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
  }
  throw new Error("overpass all endpoints failed");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function backfillCity(
  supabase: any,
  city: CityArg
): Promise<{ matched: number; updated: number; total: number; osmHits: number }> {
  // Fetch all locations for the city (paginated — Supabase REST liefert
  // standardmäßig max 1000 rows pro Request).
  const locations: Array<{ id: string; name: string; opening_hours_raw: string | null }> = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("locations")
      .select("id, name, opening_hours_raw")
      .eq("city_slug", city.slug)
      .eq("is_plannable", true)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Locations laden für ${city.slug}: ${error.message}`);
    const rows = (data ?? []) as Array<{ id: string; name: string; opening_hours_raw: string | null }>;
    if (rows.length === 0) break;
    locations.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  if (locations.length === 0) return { matched: 0, updated: 0, total: 0, osmHits: 0 };

  // Fetch OSM data
  const osmMap = await fetchOpeningHours(city);

  // Build name lookup für locations, match auf OSM.
  // Strategie: 1) exakter Match auf normalisiertem Namen, 2) Substring-Match
  // wenn beide Seiten ≥8 Zeichen lang (filtert "pizza"/"hotel" etc. die
  // sonst gefährliche false positives erzeugen würden).
  const SUBSTRING_MIN_LENGTH = 8;
  const osmEntries = Array.from(osmMap.entries()).filter(
    ([key]) => key.length >= SUBSTRING_MIN_LENGTH
  );

  const updates: Array<{ id: string; opening_hours_raw: string }> = [];
  let exactCount = 0;
  let substringCount = 0;
  for (const loc of locations) {
    if (loc.opening_hours_raw) continue; // schon gesetzt, skip
    const key = norm(loc.name);

    // Exakter Match (Fast Path)
    const exact = osmMap.get(key);
    if (exact) {
      updates.push({ id: loc.id, opening_hours_raw: exact });
      exactCount++;
      continue;
    }

    // Substring-Match nur bei längeren Namen
    if (key.length < SUBSTRING_MIN_LENGTH) continue;
    for (const [osmName, hours] of osmEntries) {
      if (key.includes(osmName) || osmName.includes(key)) {
        updates.push({ id: loc.id, opening_hours_raw: hours });
        substringCount++;
        break;
      }
    }
  }
  if (substringCount > 0) {
    console.log(`    (exakt: ${exactCount}, substring: ${substringCount})`);
  }

  if (updates.length === 0) {
    return { matched: 0, updated: 0, total: locations.length, osmHits: osmMap.size };
  }

  // Batch update in Chunks von 100
  let updated = 0;
  for (let i = 0; i < updates.length; i += 100) {
    const chunk = updates.slice(i, i + 100);
    // Supabase unterstützt keinen bulk-update via REST. Wir machen
    // einzelne Updates — bei großen Mengen wäre RPC besser, aber
    // wir haben gut performante Indexes auf id (Primary Key).
    await Promise.all(
      chunk.map((u) =>
        supabase
          .from("locations")
          .update({ opening_hours_raw: u.opening_hours_raw })
          .eq("id", u.id)
      )
    );
    updated += chunk.length;
  }

  return { matched: updates.length, updated, total: locations.length, osmHits: osmMap.size };
}

async function main() {
  loadEnvFile(join(process.cwd(), ".env.local"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const scopeArg = parseArg("scope") ?? "all";
  const cityArg = parseArg("city");

  let cities: CityArg[] = PLANNER_33_ROLLOUT.map((c) => ({
    slug: c.slug,
    label: c.label,
    lat: c.lat,
    lng: c.lng,
    radiusM: c.radiusM,
  }));

  if (cityArg) {
    cities = cities.filter((c) => c.slug === cityArg);
  } else if (scopeArg === "core") {
    cities = cities.filter((_, i) => i < 3);
  } else if (scopeArg === "top10") {
    cities = cities.filter((_, i) => i < 10);
  }

  console.log(`Backfill für ${cities.length} Städte\n`);

  let totalMatched = 0;
  let totalUpdated = 0;
  let totalLocations = 0;
  let totalOsmHits = 0;
  const failures: string[] = [];

  for (const city of cities) {
    const t0 = Date.now();
    try {
      const r = await backfillCity(supabase, city);
      totalMatched += r.matched;
      totalUpdated += r.updated;
      totalLocations += r.total;
      totalOsmHits += r.osmHits;
      const pct = r.total > 0 ? Math.round((r.updated / r.total) * 100) : 0;
      console.log(
        `  ${city.slug.padEnd(30)} OSM hits=${String(r.osmHits).padStart(4)}, locations=${String(r.total).padStart(5)}, matched=${String(r.matched).padStart(4)}, coverage=${pct}% (${Date.now() - t0}ms)`
      );
    } catch (err) {
      failures.push(city.slug);
      console.error(`  ${city.slug} FEHLER: ${err instanceof Error ? err.message : String(err)}`);
    }
    // Throttle zwischen Städten — Overpass mag Pause
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log("");
  console.log(`Summe: ${totalMatched} matched / ${totalLocations} Locations`);
  console.log(`OSM Hits gesamt: ${totalOsmHits}`);
  console.log(`Updated: ${totalUpdated}`);
  if (failures.length) console.log(`Failures: ${failures.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
