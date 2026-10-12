// Kontakt-Backfill (Website, Telefon) für Locations aus OSM (Overpass).
// ============================================================================
// Der „Mehr Info"-Aufklapper im Planner soll so viel wie möglich aus EIGENEN
// Daten zeigen (Beschluss Stufe 0, 11.10.2026 — Google Places ist für uns als
// EWR-Kunde vertraglich nicht nutzbar). Website und Telefon liegen in OSM
// (`website`/`contact:website`/`url`, `phone`/`contact:phone`); der Ingest
// (ingest-city-location-seeds.ts) liest sie nur fürs Scoring und legt allein die
// Website — als reservation_url — ab. Das Telefon ging bisher verloren.
//
// Ablage ohne DDL: locations hat weder Website- noch Telefonspalte, und DDL
// läuft nur über Alex (Schema-Drift-Konvention). Wie bei Adresse
// (backfill-location-addresses.ts) und Foto (Admin-Upload) wandert beides als
// {website, phone}-Eintrag in locations.source_refs. Der Planner liest source_refs
// ohnehin (Planner-SELECT-Liste), der Aufklapper zieht die Werte über
// lib/planner/location-contact.ts — keine Query-Änderung, keine Migration.
// Notlösung statt Spalten: sauber abfragbar ist das nicht; wird Kontakt zum
// Filter- oder Sortierkriterium, gehört er in echte Spalten (Migration-Entwurf
// und Freigabe durch Alex vorausgesetzt).
//
// DEFAULT IST DRY-RUN: ohne --write wird NICHTS geschrieben (weder in
// locations noch in tmp/-Checkpoints), es entsteht nur ein Report
// (tmp/contact-backfill-report.json) mit jedem geplanten Eintrag. `--write` ist
// die Freigabe durch Alex — erst Report prüfen, dann zuerst eine Stadt.
//
// Qualität vor Menge:
//   - Der heutige OSM-Name muss noch zum Namen der Location passen (namesMatch):
//     OSM-Elemente werden seit dem Ingest umbenannt oder neu belegt, und eine
//     falsche Telefonnummer ist schlimmer als keine.
//   - Websites laufen durch normalizeExternalUrl (nur http/https, Schema wird
//     ergänzt); OSM-Tags sind öffentlich editierbar.
//   - Entspricht die OSM-Website bereits der reservation_url, wird sie nicht
//     doppelt abgelegt (der Aufklapper dedupliziert ebenfalls).
//   - Telefonnummern müssen wie eine Nummer aussehen (cleanPhone), bei mehreren
//     Nummern zählt die erste.
//   - Locations mit vorhandenem Kontakt-Eintrag werden übersprungen; OSM-
//     Elemente ohne Kontakt-Tags landen (nur mit --write) in einer Skip-Liste
//     (tmp/contact-backfill-no-contact.json), damit Folgeläufe sie nicht erneut
//     anfragen.
//
// Read-Modify-Write auf source_refs: Admin-Foto-Upload und Adress-Backfill
// schreiben dasselbe Feld. Das Fenster ist klein gehalten (frisches Lesen
// direkt vor dem Schreiben), ein gleichzeitiger Lauf bleibt aber ein Risiko —
// nicht parallel zu /admin/fotos-Sitzungen laufen lassen.
//
// Usage: npm run locations:backfill:contacts -- [--stage=core,top10,…|--city=slug,…|--all]
//        [--batch=250] [--delay-ms=2500] [--limit=N] [--write]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PLANNER_33_ROLLOUT, type PlannerRolloutStage } from "../lib/cities/rollout";
import { cleanPhone, isSameWebTarget } from "../lib/planner/location-contact";
import { normalizeExternalUrl } from "../lib/security/safe-url";

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
    if (!(key in process.env)) process.env[key] = value;
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

const WRITE = process.argv.includes("--write");
const BATCH_SIZE = Math.max(50, Number(parseArg("batch") ?? "250"));
const DELAY_MS = Math.max(0, Number(parseArg("delay-ms") ?? "2500"));
const LIMIT = parseArg("limit") ? Number(parseArg("limit")) : null;
// Mirror-Rotation wie im Adress-Backfill: Die Haupt-Instanz sperrt IPs nach
// Dauerlast komplett; Kumi und private.coffee vertragen Batch-Läufe.
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
let overpassIndex = 0;
const SKIP_FILE = resolve(process.cwd(), "tmp/contact-backfill-no-contact.json");
const REPORT_FILE = resolve(process.cwd(), "tmp/contact-backfill-report.json");
const MAX_URL_LENGTH = 300;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type SeedRow = {
  id: string;
  city_slug: string;
  notes: string | null;
  published_location_id: string | null;
};

type LocationRow = {
  id: string;
  name: string | null;
  reservation_url: string | null;
  source_refs: unknown;
};

type ContactEntry = {
  website?: string;
  phone?: string;
  contact_source: "overpass";
  osm_ref: string;
  contact_checked_at: string;
};

type Proposal = {
  citySlug: string;
  locationId: string;
  name: string | null;
  osmRef: string;
  website: string | null;
  phone: string | null;
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
        stages.has(city.stage satisfies PlannerRolloutStage) && city.plannerVisibility === "visible"
    );
    if (cities.length === 0) {
      throw new Error(`Keine sichtbaren Rollout-Staedte fuer --stage=${stageArg}.`);
    }
    return cities.map((city) => city.slug);
  }
  if (process.argv.includes("--all")) return null;
  throw new Error("Bitte --stage=…, --city=… oder --all angeben.");
}

function loadSkipSet(): Set<string> {
  try {
    const parsed = JSON.parse(readFileSync(SKIP_FILE, "utf8")) as unknown;
    if (Array.isArray(parsed)) return new Set(parsed.filter((v) => typeof v === "string"));
  } catch {
    /* erste Ausführung */
  }
  return new Set();
}

function writeJson(path: string, payload: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(payload, null, 2), "utf8");
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

  // Overpass drosselt gern (429/504) und sperrt bei Dauerlast Verbindungen:
  // zum nächsten Mirror rotieren, mit wachsendem Backoff wiederholen.
  for (let attempt = 1; attempt <= 12; attempt++) {
    const endpoint = OVERPASS_URLS[overpassIndex % OVERPASS_URLS.length];
    let response: Response;
    try {
      // Overpass-Etikette: identifizierbarer User-Agent, sonst 406.
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "PerfectDay24-ContactBackfill/1.0 (https://www.perfectday24.de)",
          Accept: "application/json",
        },
        body: `data=${encodeURIComponent(query)}`,
      });
    } catch (error) {
      overpassIndex += 1;
      const wait = Math.min(attempt * 20000, 240000);
      const reason = error instanceof Error ? error.message : String(error);
      console.log(
        `[kontakte] ${endpoint} nicht erreichbar (${reason}) — Mirror-Wechsel, warte ${wait / 1000}s (Versuch ${attempt}/12)`
      );
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (response.status === 429 || response.status >= 500) {
      overpassIndex += 1;
      const wait = Math.min(attempt * 20000, 240000);
      console.log(
        `[kontakte] ${endpoint} → ${response.status} — Mirror-Wechsel, warte ${wait / 1000}s (Versuch ${attempt}/12)`
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
      map.set(`${el.type}/${el.id}`, el.tags ?? {});
    }
    return map;
  }
  throw new Error("Overpass nach 12 Versuchen weiterhin nicht erreichbar/gedrosselt.");
}

// Reihenfolge wie reservationUrlForSeed im Ingest: website → contact:website → url.
function websiteFromTags(tags: Record<string, string>): string | null {
  for (const key of ["website", "contact:website", "url"]) {
    const normalized = normalizeExternalUrl(tags[key]);
    if (normalized && normalized.length <= MAX_URL_LENGTH) return normalized;
  }
  return null;
}

function phoneFromTags(tags: Record<string, string>): string | null {
  for (const key of ["phone", "contact:phone"]) {
    const raw = tags[key];
    const cleaned = typeof raw === "string" ? cleanPhone(raw) : null;
    if (cleaned) return cleaned;
  }
  return null;
}

// Die Seed-Referenz (node/123) wurde beim Ingest gezogen; OSM-Elemente werden
// seither umbenannt, wiederverwendet oder von einem anderen Betrieb übernommen.
// Eine falsche Telefonnummer ist schlimmer als keine — deshalb übernehmen wir
// Kontakt nur, wenn der heutige OSM-Name noch zum Namen unserer Location passt
// (gleich, Teilstring oder ein gemeinsames Wort ab 4 Zeichen).
function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function namesMatch(osmName: string | undefined, locationName: string | null): boolean {
  if (!osmName || !locationName) return false;
  const left = nameTokens(osmName);
  const right = nameTokens(locationName);
  if (left.length === 0 || right.length === 0) return false;
  const leftJoined = left.join(" ");
  const rightJoined = right.join(" ");
  if (leftJoined === rightJoined) return true;
  if (leftJoined.length >= 4 && rightJoined.includes(leftJoined)) return true;
  if (rightJoined.length >= 4 && leftJoined.includes(rightJoined)) return true;
  return left.some((token) => token.length >= 4 && right.includes(token));
}

function hasContactEntry(refs: unknown): boolean {
  if (!refs || typeof refs !== "object") return false;
  const entries = Array.isArray(refs) ? refs : [refs];
  return entries.some(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      typeof (entry as { contact_source?: unknown }).contact_source === "string"
  );
}

// Anhängen statt in ein vorhandenes Objekt hineinmischen: fremde Einträge
// (Seeds, Adresse, Foto) bleiben byte-genau erhalten, und die Reader suchen
// ohnehin den ersten Eintrag mit dem jeweiligen Schlüssel.
function mergeContact(refs: unknown, entry: ContactEntry): unknown {
  if (Array.isArray(refs)) return [...refs, entry];
  if (refs && typeof refs === "object") return [refs, entry];
  return [entry];
}

// Keyset-Pagination über die Seeds (id-Cursor bleibt stabil, solange nichts
// an den Seeds selbst geschrieben wird). Der notes-Filter läuft bewusst
// client-seitig — ein OR aus drei LIKEs über 210k Zeilen kippte im
// Adress-Backfill in den Statement-Timeout.
async function fetchSeedPage(citySlugs: string[] | null, afterId: string | null, pageSize: number) {
  for (let attempt = 1; ; attempt++) {
    let query = supabase
      .from("location_manual_seeds")
      .select("id, city_slug, notes, published_location_id")
      .eq("publish_status", "published")
      .not("published_location_id", "is", null)
      .order("id", { ascending: true })
      .limit(pageSize);
    if (afterId) query = query.gt("id", afterId);
    if (citySlugs) query = query.in("city_slug", citySlugs);
    const { data, error } = await query;
    if (!error) return (data ?? []) as SeedRow[];
    if (attempt >= 4) throw new Error(`Seeds konnten nicht geladen werden: ${error.message}`);
    const wait = attempt * 10000;
    console.log(`[kontakte] Seed-Query fehlgeschlagen (${error.message}) — warte ${wait / 1000}s (Versuch ${attempt}/4)`);
    await new Promise((r) => setTimeout(r, wait));
  }
}

async function fetchLocations(ids: string[]): Promise<Map<string, LocationRow>> {
  const out = new Map<string, LocationRow>();
  // .in() trägt die IDs in der URL — in kleinen Stücken bleibt sie kurz genug.
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from("locations")
      .select("id, name, reservation_url, source_refs")
      .in("id", ids.slice(i, i + 100));
    if (error) throw new Error(`Locations konnten nicht geladen werden: ${error.message}`);
    for (const row of (data ?? []) as LocationRow[]) out.set(row.id, row);
  }
  return out;
}

async function writeWithRetry(job: () => PromiseLike<{ error: { message: string } | null }>) {
  for (let attempt = 1; ; attempt++) {
    const { error } = await job();
    if (!error) return;
    // Transiente Gateway-Fehler kommen als HTML-Seite zurück.
    const message = error.message.startsWith("<") ? "Gateway-Fehler (HTML-Antwort)" : error.message;
    if (attempt >= 4) throw new Error(`Kontakt-Update fehlgeschlagen: ${message}`);
    const wait = attempt * 8000;
    console.log(`[kontakte] Schreibfehler (${message}) — warte ${wait / 1000}s (Versuch ${attempt}/4)`);
    await new Promise((r) => setTimeout(r, wait));
  }
}

async function writeProposals(proposals: Proposal[]): Promise<number> {
  let written = 0;
  const CHUNK = 10;
  for (let i = 0; i < proposals.length; i += CHUNK) {
    const chunk = proposals.slice(i, i + CHUNK);
    // Frisch lesen, direkt vor dem Schreiben — verkleinert das
    // Read-Modify-Write-Fenster gegenüber parallelen Foto-/Adress-Schreibern.
    const fresh = await fetchLocations(chunk.map((p) => p.locationId));
    for (const proposal of chunk) {
      const current = fresh.get(proposal.locationId);
      if (!current || hasContactEntry(current.source_refs)) continue;
      const entry: ContactEntry = {
        ...(proposal.website ? { website: proposal.website } : {}),
        ...(proposal.phone ? { phone: proposal.phone } : {}),
        contact_source: "overpass",
        osm_ref: proposal.osmRef,
        contact_checked_at: new Date().toISOString(),
      };
      await writeWithRetry(() =>
        supabase
          .from("locations")
          .update({ source_refs: mergeContact(current.source_refs, entry) })
          .eq("id", proposal.locationId)
      );
      written += 1;
    }
  }
  return written;
}

async function main() {
  const citySlugs = resolveCitySlugs();
  const skip = loadSkipSet();
  console.log(
    `[kontakte] Start: ${citySlugs ? `${citySlugs.length} Staedte` : "alle Staedte"}, Batch ${BATCH_SIZE}, ` +
      `Skip-Liste ${skip.size} Refs — ${WRITE ? "SCHREIBMODUS (--write)" : "DRY-RUN, nichts wird geschrieben"}`
  );

  const proposals: Proposal[] = [];
  const stats = {
    seedsChecked: 0,
    alreadyHadContact: 0,
    noContactTags: 0,
    nameMismatch: 0,
    withWebsite: 0,
    withPhone: 0,
    websiteSameAsReservation: 0,
    reservationUrlAlreadySet: 0,
    written: 0,
  };
  let afterId: string | null = null;
  const pageSize = 1000;

  outer: for (;;) {
    const seeds = await fetchSeedPage(citySlugs, afterId, pageSize);
    if (seeds.length === 0) break;
    afterId = seeds[seeds.length - 1].id;

    const candidates = seeds.filter(
      (seed) => seed.notes && OSM_REF_PATTERN.test(seed.notes) && !skip.has(seed.notes)
    );
    const locations = await fetchLocations(candidates.map((seed) => seed.published_location_id as string));

    const pending = candidates.filter((seed) => {
      const location = locations.get(seed.published_location_id as string);
      if (!location) return false;
      if (hasContactEntry(location.source_refs)) {
        stats.alreadyHadContact += 1;
        return false;
      }
      return true;
    });

    for (let offset = 0; offset < pending.length; offset += BATCH_SIZE) {
      if (LIMIT && stats.seedsChecked >= LIMIT) break outer;
      const batch = pending.slice(offset, offset + BATCH_SIZE);
      const tagsByRef = await fetchOverpassTags([...new Set(batch.map((seed) => seed.notes as string))]);

      const batchProposals: Proposal[] = [];
      for (const seed of batch) {
        stats.seedsChecked += 1;
        const location = locations.get(seed.published_location_id as string) as LocationRow;
        const tags = tagsByRef.get(seed.notes as string) ?? {};
        if (Object.keys(tags).length > 0 && !namesMatch(tags.name, location.name)) {
          // Nicht in die Skip-Liste: Wird der OSM-Name später korrigiert, soll
          // ein Folgelauf das Element wieder prüfen.
          stats.nameMismatch += 1;
          continue;
        }
        const osmWebsite = websiteFromTags(tags);
        let website = osmWebsite;
        const phone = phoneFromTags(tags);

        if (location.reservation_url) stats.reservationUrlAlreadySet += 1;
        if (website && isSameWebTarget(website, location.reservation_url)) {
          stats.websiteSameAsReservation += 1;
          website = null;
        }
        if (!website && !phone) {
          if (!osmWebsite) stats.noContactTags += 1;
          skip.add(seed.notes as string);
          continue;
        }
        if (website) stats.withWebsite += 1;
        if (phone) stats.withPhone += 1;
        batchProposals.push({
          citySlug: seed.city_slug,
          locationId: location.id,
          name: location.name,
          osmRef: seed.notes as string,
          website,
          phone,
        });
      }

      proposals.push(...batchProposals);
      if (WRITE) {
        stats.written += await writeProposals(batchProposals);
        writeJson(SKIP_FILE, [...skip]);
      }
      console.log(
        `[kontakte] ${stats.seedsChecked} geprueft, ${stats.withWebsite} neue Websites, ${stats.withPhone} Telefonnummern, ` +
          `${stats.noContactTags} ohne verwertbare Tags`
      );
      if (DELAY_MS > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    if (seeds.length < pageSize) break;
  }

  if (WRITE) writeJson(SKIP_FILE, [...skip]);
  // Report nur im Dry-Run schreiben: Er ist die Entscheidungsgrundlage für die
  // Freigabe; nach einem --write-Lauf wäre er Altlast.
  if (!WRITE) {
    writeJson(REPORT_FILE, {
      generatedAt: new Date().toISOString(),
      scope: citySlugs ?? "all",
      stats,
      proposals,
    });
  }

  console.log(
    `[kontakte] Fertig: ${stats.seedsChecked} Seeds geprueft — ${stats.withWebsite} Websites, ${stats.withPhone} Telefonnummern ` +
      `${WRITE ? `geschrieben bei ${stats.written} Locations` : "vorgeschlagen (Dry-Run, nichts geschrieben)"}.`
  );
  console.log(
    `[kontakte] Einordnung: ${stats.websiteSameAsReservation} OSM-Websites entsprechen schon der reservation_url, ` +
      `${stats.reservationUrlAlreadySet} geprueften Locations haben eine reservation_url, ${stats.alreadyHadContact} hatten schon einen Kontakt-Eintrag, ` +
      `${stats.nameMismatch} uebersprungen (OSM-Name passt nicht mehr zur Location).`
  );
  if (!WRITE) console.log(`[kontakte] Report: ${REPORT_FILE} — zum Schreiben mit --write wiederholen (Freigabe durch Alex).`);
}

main().catch((error) => {
  console.error("[kontakte] Backfill fehlgeschlagen:", error);
  process.exit(1);
});
