// Adress-Backfill für Locations aus OSM (Overpass, gebatcht per Element-ID).
// ============================================================================
// Die Location-Ingests haben addr:*-Tags nie übernommen — Exporte (ICS/PDF)
// konnten deshalb nur "Name, Stadt" ausgeben. Dieses Skript holt die
// Straßenadressen nach:
//
//   1. location_manual_seeds liefert die OSM-Referenz (notes: "node/123…")
//      und die Ziel-Location (published_location_id).
//   2. Overpass wird in ID-Batches abgefragt (out tags) — kein Geocoding,
//      nur die im Element hinterlegten addr:*-Tags.
//   3. Geschrieben wird doppelt: seeds.address (kanonisch, überlebt einen
//      Re-Publish) und locations.source_refs als {address:…}-Eintrag —
//      locations hat keine Adressspalte, und DDL läuft nur über Alex
//      (Schema-Drift-Konvention). source_refs steht bereits in der
//      Planner-SELECT-Liste, die Adresse fließt also ohne Query-Änderung
//      bis in die Exporte (lib/planner/location-address.ts).
//
// Qualität vor Menge: Eine Adresse wird nur übernommen, wenn Straße UND
// Hausnummer vorhanden sind — halbe Adressen wirken im bezahlten Export
// schlampiger als gar keine (der Navigations-Link deckt den Rest ab).
//
// OSM-Elemente ohne addr-Tags landen in einer Skip-Liste
// (tmp/address-backfill-no-addr.json), damit Folgeläufe sie nicht erneut
// anfragen; Seeds mit gesetzter address werden über den DB-Filter
// übersprungen — zusammen ergibt das einen natürlichen Checkpoint.
//
// Usage: npm run locations:backfill:addresses -- [--stage=core,top10,…|--city=slug,…|--all]
//        [--batch=250] [--delay-ms=1200] [--limit=N] [--dry-run]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  PLANNER_33_ROLLOUT,
  type PlannerRolloutStage,
} from "../lib/cities/rollout";

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

loadEnvFile(resolve(process.cwd(), ".env.local"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen.");
  process.exit(1);
}

const BATCH_SIZE = Math.max(50, Number(parseArg("batch") ?? "250"));
const DELAY_MS = Math.max(0, Number(parseArg("delay-ms") ?? "2500"));
const LIMIT = parseArg("limit") ? Number(parseArg("limit")) : null;
const DRY_RUN = process.argv.includes("--dry-run");
// Mirror-Rotation: Die Haupt-Instanz sperrt IPs nach Dauerlast komplett
// (Connect-Timeout, nicht nur 429). Bei Nichterreichbarkeit zum nächsten
// Endpunkt weiterdrehen — Kumi und private.coffee vertragen Batch-Läufe.
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
let overpassIndex = 0;
const SKIP_FILE = resolve(process.cwd(), "tmp/address-backfill-no-addr.json");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type SeedRow = {
  id: string;
  city_slug: string;
  notes: string | null;
  published_location_id: string | null;
};

function resolveCitySlugs(): string[] | null {
  const cityArg = parseArg("city");
  if (cityArg) {
    return cityArg.split(",").map((value) => value.trim()).filter(Boolean);
  }
  const stageArg = parseArg("stage");
  if (stageArg) {
    const stages = new Set(stageArg.split(",").map((value) => value.trim()));
    const cities = PLANNER_33_ROLLOUT.filter(
      (city) =>
        stages.has(city.stage satisfies PlannerRolloutStage) &&
        city.plannerVisibility === "visible"
    );
    if (cities.length === 0) {
      throw new Error(`Keine sichtbaren Rollout-Staedte fuer --stage=${stageArg}.`);
    }
    return cities.map((city) => city.slug);
  }
  if (process.argv.includes("--all")) return null;
  throw new Error("Bitte --stage=…, --city=… oder --all angeben.");
}

// Stadt-Label für den addr:city-Fallback (Overpass-Elemente in Randlagen
// tragen oft keine addr:city).
const CITY_LABELS = new Map(PLANNER_33_ROLLOUT.map((city) => [city.slug, city.label]));

function loadSkipSet(): Set<string> {
  try {
    const parsed = JSON.parse(readFileSync(SKIP_FILE, "utf8")) as unknown;
    if (Array.isArray(parsed)) return new Set(parsed.filter((v) => typeof v === "string"));
  } catch {
    /* erste Ausführung */
  }
  return new Set();
}

function saveSkipSet(skip: Set<string>) {
  mkdirSync(dirname(SKIP_FILE), { recursive: true });
  writeFileSync(SKIP_FILE, JSON.stringify([...skip]), "utf8");
}

const OSM_REF_PATTERN = /^(node|way|relation)\/(\d+)$/;

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  tags?: Record<string, string>;
};

async function fetchOverpassTags(refs: string[]): Promise<Map<string, Record<string, string>>> {
  const ids: Record<string, string[]> = { node: [], way: [], relation: [] };
  for (const ref of refs) {
    const match = OSM_REF_PATTERN.exec(ref);
    if (match) ids[match[1]].push(match[2]);
  }
  const parts = [
    ids.node.length ? `node(id:${ids.node.join(",")});` : "",
    ids.way.length ? `way(id:${ids.way.join(",")});` : "",
    ids.relation.length ? `rel(id:${ids.relation.join(",")});` : "",
  ].join("");
  if (!parts) return new Map();

  const query = `[out:json][timeout:180];(${parts});out tags;`;

  // Overpass drosselt gern (429/504), und bei Dauerlast sperrt die
  // Haupt-Instanz Verbindungen komplett (Connect-Timeout). Beides behandeln:
  // zum nächsten Mirror rotieren, mit wachsendem Backoff wiederholen.
  for (let attempt = 1; attempt <= 6; attempt++) {
    const endpoint = OVERPASS_URLS[overpassIndex % OVERPASS_URLS.length];
    let response: Response;
    try {
      // Overpass-Etikette: identifizierbarer User-Agent, sonst 406.
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "PerfectDay24-AddressBackfill/1.0 (https://www.perfectday24.de)",
          Accept: "application/json",
        },
        body: `data=${encodeURIComponent(query)}`,
      });
    } catch (error) {
      overpassIndex += 1;
      const wait = attempt * 10000;
      const reason = error instanceof Error ? error.message : String(error);
      console.log(
        `[adressen] ${endpoint} nicht erreichbar (${reason}) — Mirror-Wechsel, warte ${wait / 1000}s (Versuch ${attempt}/6)`
      );
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (response.status === 429 || response.status >= 500) {
      overpassIndex += 1;
      const wait = attempt * 10000;
      console.log(
        `[adressen] ${endpoint} → ${response.status} — Mirror-Wechsel, warte ${wait / 1000}s (Versuch ${attempt}/6)`
      );
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!response.ok) {
      throw new Error(`Overpass-Fehler ${response.status}: ${(await response.text()).slice(0, 200)}`);
    }
    const payload = (await response.json()) as { elements?: OverpassElement[] };
    const map = new Map<string, Record<string, string>>();
    for (const el of payload.elements ?? []) {
      // "relation" kürzt Overpass in der Antwort nicht ab — Query nutzt "rel",
      // die Antwort trägt wieder den vollen Typnamen.
      map.set(`${el.type}/${el.id}`, el.tags ?? {});
    }
    return map;
  }
  throw new Error("Overpass nach 6 Versuchen weiterhin nicht erreichbar/gedrosselt.");
}

function buildAddress(tags: Record<string, string>, citySlug: string): string | null {
  const street = tags["addr:street"]?.trim();
  const housenumber = tags["addr:housenumber"]?.trim();
  if (!street || !housenumber) return null;
  const postcode = tags["addr:postcode"]?.trim() ?? "";
  const city = tags["addr:city"]?.trim() || CITY_LABELS.get(citySlug) || "";
  const tail = [postcode, city].filter(Boolean).join(" ");
  return tail ? `${street} ${housenumber}, ${tail}` : `${street} ${housenumber}`;
}

// Keyset-Pagination statt range(): Geschriebene Seeds fallen aus dem
// address-is-null-Filter — Offsets würden dadurch Zeilen überspringen,
// ein id-Cursor bleibt stabil. Der notes-Filter (node/way/relation) läuft
// bewusst client-seitig: ein OR aus drei LIKEs über 210k Zeilen kippte
// serverseitig in den Statement-Timeout.
async function fetchSeedPage(citySlugs: string[] | null, afterId: string | null, pageSize: number) {
  for (let attempt = 1; ; attempt++) {
    let query = supabase
      .from("location_manual_seeds")
      .select("id, city_slug, notes, published_location_id")
      .eq("publish_status", "published")
      .is("address", null)
      .not("published_location_id", "is", null)
      .order("id", { ascending: true })
      .limit(pageSize);
    if (afterId) query = query.gt("id", afterId);
    if (citySlugs) query = query.in("city_slug", citySlugs);
    const { data, error } = await query;
    if (!error) return (data ?? []) as SeedRow[];
    if (attempt >= 4) throw new Error(`Seeds konnten nicht geladen werden: ${error.message}`);
    const wait = attempt * 10000;
    console.log(`[adressen] Seed-Query fehlgeschlagen (${error.message}) — warte ${wait / 1000}s (Versuch ${attempt}/4)`);
    await new Promise((r) => setTimeout(r, wait));
  }
}

type LocationRefsRow = { id: string; source_refs: unknown };

function hasAddressEntry(refs: unknown): boolean {
  if (!refs || typeof refs !== "object") return false;
  const entries = Array.isArray(refs) ? refs : [refs];
  return entries.some(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      typeof (entry as { address?: unknown }).address === "string"
  );
}

function mergeAddress(refs: unknown, address: string, osmRef: string): unknown {
  const entry = { address, address_source: "overpass", osm_ref: osmRef };
  if (Array.isArray(refs)) return [...refs, entry];
  if (refs && typeof refs === "object") return { ...(refs as Record<string, unknown>), ...entry };
  return [entry];
}

async function main() {
  const citySlugs = resolveCitySlugs();
  const skip = loadSkipSet();
  console.log(
    `[adressen] Start: ${citySlugs ? `${citySlugs.length} Staedte` : "alle Staedte"}, ` +
      `Batch ${BATCH_SIZE}, Skip-Liste ${skip.size} Refs${DRY_RUN ? " (dry-run)" : ""}`
  );

  let processed = 0;
  let written = 0;
  let noAddress = 0;
  let afterId: string | null = null;
  const pageSize = 1000;

  for (;;) {
    if (LIMIT && processed >= LIMIT) break;
    const seeds = await fetchSeedPage(citySlugs, afterId, pageSize);
    if (seeds.length === 0) break;
    afterId = seeds[seeds.length - 1].id;

    // Nur Seeds mit unbekanntem Adress-Status anfragen.
    const pending = seeds.filter(
      (seed) => seed.notes && OSM_REF_PATTERN.test(seed.notes) && !skip.has(seed.notes)
    );
    if (pending.length === 0) {
      if (seeds.length < pageSize) break;
      continue;
    }

    for (let offset = 0; offset < pending.length; offset += BATCH_SIZE) {
      if (LIMIT && processed >= LIMIT) break;
      const batch = pending.slice(offset, offset + BATCH_SIZE);
      const refs = [...new Set(batch.map((seed) => seed.notes as string))];
      const tagsByRef = await fetchOverpassTags(refs);

      const updates: Array<{ seed: SeedRow; address: string }> = [];
      for (const seed of batch) {
        processed += 1;
        const tags = tagsByRef.get(seed.notes as string);
        const address = tags ? buildAddress(tags, seed.city_slug) : null;
        if (!address) {
          noAddress += 1;
          skip.add(seed.notes as string);
          continue;
        }
        updates.push({ seed, address });
      }

      if (!DRY_RUN && updates.length > 0) {
        // source_refs der Ziel-Locations lesen, Adresse mergen, zurückschreiben.
        const locationIds = updates.map((u) => u.seed.published_location_id as string);
        const { data: locationRows, error: locationError } = await supabase
          .from("locations")
          .select("id, source_refs")
          .in("id", locationIds);
        if (locationError) {
          throw new Error(`Locations konnten nicht geladen werden: ${locationError.message}`);
        }
        const refsById = new Map(
          ((locationRows ?? []) as LocationRefsRow[]).map((row) => [row.id, row.source_refs])
        );

        // Reihenfolge pro Paar: erst locations, dann seeds. Scheitert der
        // Seed-Write, bleibt address=null und der nächste Lauf holt beides
        // nach (hasAddressEntry verhindert doppelte Merges) — andersherum
        // ginge der source_refs-Merge dauerhaft verloren.
        const writeWithRetry = async (job: () => PromiseLike<{ error: { message: string } | null }>) => {
          for (let attempt = 1; ; attempt++) {
            const { error } = await job();
            if (!error) return;
            // Transiente Gateway-Fehler kommen als HTML-Seite zurück.
            const message = error.message.startsWith("<") ? "Gateway-Fehler (HTML-Antwort)" : error.message;
            if (attempt >= 4) throw new Error(`Adress-Update fehlgeschlagen: ${message}`);
            const wait = attempt * 8000;
            console.log(`[adressen] Schreibfehler (${message}) — warte ${wait / 1000}s (Versuch ${attempt}/4)`);
            await new Promise((r) => setTimeout(r, wait));
          }
        };

        const CHUNK = 10;
        for (let i = 0; i < updates.length; i += CHUNK) {
          const chunk = updates.slice(i, i + CHUNK);
          await Promise.all(
            chunk.map(async (update) => {
              const locationId = update.seed.published_location_id as string;
              const currentRefs = refsById.get(locationId);
              if (!hasAddressEntry(currentRefs)) {
                await writeWithRetry(() =>
                  supabase
                    .from("locations")
                    .update({
                      source_refs: mergeAddress(currentRefs, update.address, update.seed.notes as string),
                    })
                    .eq("id", locationId)
                );
              }
              await writeWithRetry(() =>
                supabase
                  .from("location_manual_seeds")
                  .update({ address: update.address })
                  .eq("id", update.seed.id)
              );
            })
          );
        }
        written += updates.length;
      } else if (DRY_RUN) {
        written += updates.length;
        for (const update of updates.slice(0, 5)) {
          console.log(`  ${update.seed.city_slug}: ${update.address}`);
        }
      }

      if (!DRY_RUN) saveSkipSet(skip);
      console.log(
        `[adressen] ${processed} geprueft, ${written} Adressen, ${noAddress} ohne addr-Tags`
      );
      if (DELAY_MS > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    if (seeds.length < pageSize) break;
  }

  if (!DRY_RUN) saveSkipSet(skip);
  console.log(
    `[adressen] Fertig: ${processed} Seeds geprueft, ${written} Adressen geschrieben, ` +
      `${noAddress} ohne verwertbare addr-Tags${DRY_RUN ? " (dry-run, nichts geschrieben)" : ""}.`
  );
}

main().catch((error) => {
  console.error("[adressen] Backfill fehlgeschlagen:", error);
  process.exit(1);
});
