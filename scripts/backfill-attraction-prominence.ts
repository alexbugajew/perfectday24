// Prominenz-Backfill fuer Attraktionen aus Wikipedia/Wikidata.
// ============================================================================
// Problem: Der Planner-Ranker liest bereits popularity_score (×0.7), aber fuer
// Attraktionen aus dem OSM-Import ist das Feld leer (0/null) — und die einzigen
// vorhandenen "Prominenz"-Signale taugen nicht: sightseeing_score saettigt bei
// 112 fuer obskure Kleinmuseen, subtype "landmark" haengt an 13k Orten. Der
// ikonische Fernsehturm rankt deshalb hinter x-beliebigen Galerien und der
// Planner schlaegt ihn nicht vor.
//
// Loesung ohne Scoring-Code-Aenderung: ein echtes Bekanntheits-Signal befuellen.
// Quelle ist Wikipedia/Wikidata (frei, CC0 fuer Wikidata; wir speichern nur eine
// berechnete Zahl, keinen Content — anders als Google Places, dessen Terms das
// Langzeit-Speichern von Ratings verbieten). Prominenz = Wikipedia-Pageviews
// (letzte 3 Monate) + Wikidata-Sitelinks. Der Fernsehturm hat ~10k Views/Monat,
// das Heimatmuseum Treptow ~74 — sauberer Gradient statt der 112-Saettigung.
//
// WICHTIG — Ehrlichkeit: Wir befuellen popularity_score (ein *berechnetes*
// Feld), NICHT rating. Ein Sterne-Rating wuerde Nutzerbewertungen vortaeuschen,
// die es nicht gibt ("echte Orte", Northstar).
//
// Matching (source_refs traegt keine Wikidata-Referenz aus dem Import):
//   1. Wikipedia-GeoSearch um die Koordinaten (700m), Namens-Match Pflicht.
//   2. Fallback: Wikidata-Namenssuche + Geo-Verifikation (<600m) — faengt
//      Flaggschiffe, deren Artikel nicht im Geo-Top-N liegt (z.B. Pergamon).
//   3. Typgate ueber Wikidata instance_of (P31): Stadtteile/Strassen/Raeume/
//      Skulpturen werden verworfen (sonst erbt ein Kleinmuseum die Bezirks-Fame).
//
// DEFAULT IST DRY-RUN: ohne --write wird NICHTS geschrieben, nur ein Report
// erzeugt. Ein popularity_score-Write verschiebt Plaene fuer alle Nutzer —
// deshalb erst Report pruefen, dann --write auf Kernstaedte, dann check:planner
// gegen die geaenderten Daten, dann weiter. Provenienz landet in source_refs
// ({prominence_source: "wikipedia", ...}), damit die Writes identifizier- und
// reversibel sind.
//
// Usage: npm run locations:backfill:prominence -- [--city=slug,…|--all]
//        [--write] [--limit=N] [--cap=80] [--delay-ms=150]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";

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
const LIMIT = parseArg("limit") ? Number(parseArg("limit")) : null;
const CAP = Math.max(10, Math.min(100, Number(parseArg("cap") ?? "80")));
const DELAY_MS = Math.max(0, Number(parseArg("delay-ms") ?? "150"));
const RADIUS = Math.max(200, Number(parseArg("radius") ?? "700"));
const CORE_CITIES = ["berlin-berlin", "hamburg-hamburg", "muenchen"];
const UA = "PerfectDay24-ProminenceBackfill/1.0 (https://www.perfectday24.de; ab@energieaudit365.de)";
const CHECKPOINT = resolve(process.cwd(), "tmp/prominence-backfill.json");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function resolveCitySlugs(): string[] | null {
  const cityArg = parseArg("city");
  if (cityArg) return cityArg.split(",").map((v) => v.trim()).filter(Boolean);
  if (process.argv.includes("--all")) return null;
  return CORE_CITIES;
}

// Flaggschiff-Patch: die beruehmtesten "Nicht-Museen" (Plaetze, Venues, Parks)
// faellt der Auto-Matcher, weil sie nicht im Kandidatenpool liegen oder ihr
// P31-Typ nicht als Attraktion durchgeht. Hier per Name+Stadt ein Mindest-Score
// erzwingen. Existiert die Location gar nicht in PD24, wird das geloggt (man
// kann nicht boosten, was fehlt) — die Zahl ist bewusst konservativ.
// q = ilike-Substring fuer die Server-Suche (findet den Ort trotz grosser
// Stadt-Menge), match = Regex zur Praezisierung, score = konservativer Mindestwert.
const FLAGSHIP_PATCH: Array<{ city: string; q: string; match: RegExp; score: number; label: string }> = [
  { city: "berlin-berlin", q: "gedächtnis", match: /ged(ae|ä)chtnis/i, score: 45, label: "Gedächtniskirche" },
  { city: "berlin-berlin", q: "siegessäule", match: /siegess(ae|ä)ule/i, score: 42, label: "Siegessäule" },
  { city: "berlin-berlin", q: "neue nationalgalerie", match: /neue nationalgalerie/i, score: 45, label: "Neue Nationalgalerie" },
  { city: "berlin-berlin", q: "gemäldegalerie", match: /gem(ae|ä)ldegalerie/i, score: 42, label: "Gemäldegalerie" },
  { city: "hamburg-hamburg", q: "elbphilharmonie", match: /elbphilharmonie/i, score: 55, label: "Elbphilharmonie" },
  { city: "hamburg-hamburg", q: "wunderland", match: /miniatur ?wunderland/i, score: 52, label: "Miniatur Wunderland" },
  { city: "hamburg-hamburg", q: "landungsbrücken", match: /landungsbr(ue|ü)cken/i, score: 45, label: "Landungsbrücken" },
  { city: "hamburg-hamburg", q: "rathaus", match: /rathaus/i, score: 42, label: "Hamburger Rathaus" },
  { city: "muenchen", q: "marienplatz", match: /marienplatz/i, score: 50, label: "Marienplatz" },
  { city: "muenchen", q: "englischer garten", match: /englischer garten/i, score: 48, label: "Englischer Garten" },
  { city: "muenchen", q: "viktualienmarkt", match: /viktualienmarkt/i, score: 45, label: "Viktualienmarkt" },
  { city: "muenchen", q: "hofbräuhaus", match: /hofbr(ae|äu)haus/i, score: 45, label: "Hofbräuhaus" },
];

type LocationRow = { id: string; name: string; lat: number | null; lng: number | null; source_refs: unknown; popularity_score: number | null; city_slug: string };

// ---------- Wikimedia-Helfer ----------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function wiki(url: string): Promise<any> {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`wiki ${r.status}`);
  return r.json();
}

function norm(s: string) {
  return (s || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
const STOP = new Set(["der", "die", "das", "und", "von", "zum", "zur", "des", "im", "am", "the", "of", "in", "a"]);
function tokens(s: string) {
  return new Set(norm(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w)));
}
function nameMatch(a: string, b: string): number {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const na = norm(a), nb = norm(b);
  if (na === nb) return 1;
  const overlap = inter / Math.min(ta.size, tb.size);
  if (na.includes(nb) || nb.includes(na)) return Math.max(overlap, 0.85);
  return overlap;
}
function isDistrictTitle(t: string) {
  return /^(berlin|hamburg|muenchen|münchen|potsdam)-[a-zäöüß]+$/i.test((t || "").trim());
}
const REJECT_TYPES = ["ortsteil", "stadtteil", "stadtbezirk", "bezirk", "quarter", "borough", "neighbourhood", "neighborhood", "locality", "human settlement", "village", "municipality", "administrative territorial", "street", "strasse", "straße", "road", "avenue", "sculpture", "statue", "herm", "bust", "room", "zimmer", "andachtsraum", "human", "person", "company", "enterprise", "business", "dish", "food", "restaurant", "hotel", "u-bahnhof", "s-bahnhof", "railway station"];
function typeGate(typeLabels: string[], conf: number): "accept" | "reject" {
  const t = typeLabels.map((x) => x.toLowerCase()).join(" | ");
  if (REJECT_TYPES.some((k) => t.includes(k))) return "reject";
  return conf >= 0.6 ? "accept" : "reject";
}

// Pageview-Fenster: letzte 3 vollen Monate.
const NOW = new Date();
const START_M = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - 3, 1));
const END_M = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), 1));
const fmtM = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}0100`;

async function pageviews(title: string): Promise<number> {
  try {
    const pv = await wiki(`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/de.wikipedia/all-access/all-agents/${encodeURIComponent(title.replace(/ /g, "_"))}/monthly/${fmtM(START_M)}/${fmtM(END_M)}`);
    const items: Array<{ views?: number }> = pv?.items ?? [];
    return items.length ? Math.round(items.reduce((a, i) => a + (i.views ?? 0), 0) / items.length) : 0;
  } catch {
    return 0;
  }
}
async function wikibaseItems(titles: string[]): Promise<Record<string, string | null>> {
  const q = titles.map(encodeURIComponent).join("%7C");
  const pp = await wiki(`https://de.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&titles=${q}&format=json`);
  const map: Record<string, string | null> = {};
  for (const p of Object.values(pp?.query?.pages ?? {}) as any[]) if (p.title) map[p.title] = p?.pageprops?.wikibase_item ?? null;
  return map;
}
async function entity(qid: string): Promise<{ sitelinks: number; p31: string[]; coords: { lat: number; lng: number } | null; dewiki: string | null }> {
  const wd = await wiki(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=sitelinks%7Cclaims&format=json`);
  const e = wd?.entities?.[qid] ?? {};
  const sitelinks = Object.keys(e.sitelinks ?? {}).length;
  const p31: string[] = (e.claims?.P31 ?? []).map((c: any) => c?.mainsnak?.datavalue?.value?.id).filter(Boolean);
  const c625 = e.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
  const coords = c625 ? { lat: c625.latitude, lng: c625.longitude } : null;
  const dewiki = e.sitelinks?.dewiki?.title ?? null;
  return { sitelinks, p31, coords, dewiki };
}
async function typeLabels(qids: string[]): Promise<string[]> {
  if (!qids.length) return [];
  const wd = await wiki(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qids.join("%7C")}&props=labels&languages=de%7Cen&format=json`);
  const out: string[] = [];
  for (const id of qids) {
    const e = wd?.entities?.[id];
    if (e?.labels?.de?.value) out.push(e.labels.de.value);
    if (e?.labels?.en?.value) out.push(e.labels.en.value);
  }
  return out;
}
async function wdSearch(name: string): Promise<string[]> {
  try {
    const r = await wiki(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=de&type=item&limit=4&format=json`);
    return (r?.search ?? []).map((s: any) => s.id);
  } catch {
    return [];
  }
}
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number } | null): number {
  if (!b) return 1e9;
  const R = 6371000, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180, la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function scoreOf(sitelinks: number, avgViews: number): number {
  const v = avgViews > 0 ? 15 * Math.max(0, Math.log10(avgViews) - 1) : 0;
  const l = sitelinks > 0 ? 6 * Math.log10(1 + sitelinks) : 0;
  return Math.min(CAP, Math.round(v + l));
}

type Resolved = { score: number; sitelinks: number; views: number; title: string; wikidata: string | null; source: "wikipedia" | "manual_flagship" };

async function resolveProminence(loc: LocationRow): Promise<Resolved | null> {
  if (loc.lat == null || loc.lng == null) return null;
  // 1) GeoSearch + Namens-Match
  let cands: Array<{ title: string; dist: number; conf: number }> = [];
  try {
    const g = await wiki(`https://de.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${loc.lat}%7C${loc.lng}&gsradius=${RADIUS}&gslimit=20&format=json`);
    cands = (g?.query?.geosearch ?? [])
      .filter((c: any) => !isDistrictTitle(c.title))
      .map((c: any) => ({ title: c.title, dist: c.dist, conf: nameMatch(loc.name, c.title) }))
      .filter((c: any) => c.conf >= 0.5)
      .sort((a: any, b: any) => b.conf - a.conf || a.title.length - b.title.length || a.dist - b.dist)
      .slice(0, 3);
  } catch {
    /* Geo-Fehler -> Fallback */
  }
  if (cands.length) {
    const wb = await wikibaseItems(cands.map((c) => c.title));
    for (const c of cands) {
      const qid = wb[c.title];
      if (!qid) continue;
      const e = await entity(qid);
      await sleep(40);
      const lb = await typeLabels(e.p31.slice(0, 6));
      await sleep(40);
      if (typeGate(lb, c.conf) !== "accept") continue;
      const views = await pageviews(c.title);
      return { score: scoreOf(e.sitelinks, views), sitelinks: e.sitelinks, views, title: c.title, wikidata: qid, source: "wikipedia" };
    }
  }
  // 2) Wikidata-Namenssuche + Geo-Verifikation
  const ids = await wdSearch(loc.name);
  await sleep(40);
  for (const qid of ids.slice(0, 3)) {
    const e = await entity(qid);
    await sleep(40);
    if (!e.dewiki) continue;
    if (haversine({ lat: loc.lat, lng: loc.lng }, e.coords) > 600) continue;
    const lb = await typeLabels(e.p31.slice(0, 6));
    await sleep(40);
    if (typeGate(lb, Math.max(nameMatch(loc.name, e.dewiki), 0.6)) !== "accept") continue;
    const views = await pageviews(e.dewiki);
    return { score: scoreOf(e.sitelinks, views), sitelinks: e.sitelinks, views, title: e.dewiki, wikidata: qid, source: "wikipedia" };
  }
  return null;
}

// ---------- Provenienz + Checkpoint ----------
function hasProminenceEntry(refs: unknown): boolean {
  if (!refs) return false;
  const entries = Array.isArray(refs) ? refs : [refs];
  return entries.some((e) => e && typeof e === "object" && "prominence_source" in (e as object));
}
function mergeProvenance(refs: unknown, r: Resolved): unknown {
  const entry = {
    prominence_source: r.source,
    prominence_score: r.score,
    wikidata_id: r.wikidata,
    matched_title: r.title,
    sitelinks: r.sitelinks,
    pageviews_monthly: r.views,
  };
  if (Array.isArray(refs)) return [...refs, entry];
  if (refs && typeof refs === "object") return { ...(refs as Record<string, unknown>), ...entry };
  return [entry];
}
function loadCheckpoint(): Set<string> {
  try {
    const parsed = JSON.parse(readFileSync(CHECKPOINT, "utf8"));
    if (Array.isArray(parsed)) return new Set(parsed.filter((v) => typeof v === "string"));
  } catch {
    /* erster Lauf */
  }
  return new Set();
}
function saveCheckpoint(done: Set<string>) {
  mkdirSync(dirname(CHECKPOINT), { recursive: true });
  writeFileSync(CHECKPOINT, JSON.stringify([...done]), "utf8");
}

async function fetchPage(cities: string[] | null, afterId: string | null, pageSize: number): Promise<LocationRow[]> {
  let query = supabase
    .from("locations")
    .select("id, name, lat, lng, source_refs, popularity_score, city_slug")
    .eq("is_plannable", true)
    .in("category", ["culture", "activity"])
    .order("id", { ascending: true })
    .limit(pageSize);
  if (afterId) query = query.gt("id", afterId);
  if (cities) query = query.in("city_slug", cities);
  const { data, error } = await query;
  if (error) throw new Error(`Locations konnten nicht geladen werden: ${error.message}`);
  return (data ?? []) as LocationRow[];
}

async function writeProminence(loc: LocationRow, r: Resolved) {
  for (let attempt = 1; ; attempt++) {
    const { error } = await supabase
      .from("locations")
      .update({ popularity_score: r.score, source_refs: mergeProvenance(loc.source_refs, r) })
      .eq("id", loc.id);
    if (!error) return;
    if (attempt >= 4) throw new Error(`Prominenz-Write fehlgeschlagen: ${error.message}`);
    await sleep(attempt * 6000);
  }
}

// Flaggschiffe, die der Auto-Matcher verfehlt (Plaetze/Venues/Parks), per
// Name+Stadt auf einen Mindest-Score heben. Fehlt die Location in PD24 ganz,
// wird das als Befund geloggt (boosten kann man nur, was existiert).
async function applyFlagshipPatch(cities: string[] | null): Promise<number> {
  const patches = FLAGSHIP_PATCH.filter((p) => !cities || cities.includes(p.city));
  if (patches.length === 0) return 0;
  let set = 0;
  for (const p of patches) {
    const { data } = await supabase
      .from("locations")
      .select("id, name, lat, lng, source_refs, popularity_score, city_slug")
      .eq("is_plannable", true)
      .eq("city_slug", p.city)
      .ilike("name", `%${p.q}%`)
      .limit(50);
    // Kanonischen Treffer waehlen: Regex-praezise, dann kuerzester Name
    // (die Hauptattraktion heisst meist schlichter als ihre Unterbereiche).
    const hit = ((data ?? []) as LocationRow[])
      .filter((row) => p.match.test(row.name))
      .sort((a, b) => a.name.length - b.name.length)[0];
    if (!hit) {
      console.log(`[prominenz] Flaggschiff FEHLT in PD24: ${p.label} (${p.city}) — nicht boostbar, Location anlegen`);
      continue;
    }
    if (hasProminenceEntry(hit.source_refs)) continue;
    const score = Math.max(p.score, typeof hit.popularity_score === "number" ? hit.popularity_score : 0);
    console.log(`[prominenz] Flaggschiff ${p.label} → "${hit.name}" (score ${score})${WRITE ? "" : " [dry-run]"}`);
    if (WRITE) {
      await writeProminence(hit, { score, sitelinks: 0, views: 0, title: `manual:${p.label}`, wikidata: null, source: "manual_flagship" });
      set += 1;
    } else {
      set += 1;
    }
  }
  return set;
}

async function main() {
  const cities = resolveCitySlugs();
  const done = loadCheckpoint();
  console.log(
    `[prominenz] Start: ${cities ? cities.join(",") : "alle Staedte"} · Cap ${CAP} · ${done.size} bereits verarbeitet` +
      `${WRITE ? " · WRITE-MODUS" : " · DRY-RUN (kein Write)"}`
  );

  let processed = 0, matched = 0, written = 0;
  let afterId: string | null = null;
  const pageSize = 1000;
  const results: Array<{ name: string; city: string; score: number; title: string }> = [];

  for (;;) {
    if (LIMIT && processed >= LIMIT) break;
    const rows = await fetchPage(cities, afterId, pageSize);
    if (rows.length === 0) break;
    afterId = rows[rows.length - 1].id;

    for (const loc of rows) {
      if (LIMIT && processed >= LIMIT) break;
      if (done.has(loc.id) || hasProminenceEntry(loc.source_refs)) continue;
      processed += 1;
      let r: Resolved | null = null;
      try {
        r = await resolveProminence(loc);
      } catch (error) {
        console.log(`[prominenz] ${loc.name}: Aufloesung fehlgeschlagen (${error instanceof Error ? error.message : error})`);
      }
      if (r && r.score > 0) {
        matched += 1;
        results.push({ name: loc.name, city: loc.city_slug, score: r.score, title: r.title });
        if (WRITE) {
          await writeProminence(loc, r);
          written += 1;
        }
      }
      done.add(loc.id);
      if (WRITE && processed % 25 === 0) saveCheckpoint(done);
      if (DELAY_MS > 0) await sleep(DELAY_MS);
    }
    console.log(`[prominenz] ${processed} geprueft, ${matched} mit Prominenz${WRITE ? `, ${written} geschrieben` : ""}`);
    if (rows.length < pageSize) break;
  }

  if (WRITE) saveCheckpoint(done);

  // Report: Top-Treffer je Stadt (auch fuer Dry-Run)
  const byCity = new Map<string, typeof results>();
  for (const r of results) {
    if (!byCity.has(r.city)) byCity.set(r.city, []);
    byCity.get(r.city)!.push(r);
  }
  for (const [city, list] of byCity) {
    list.sort((a, b) => b.score - a.score);
    console.log(`\n[prominenz] ${city} · Top 15 (von ${list.length} Treffern):`);
    for (const r of list.slice(0, 15)) console.log(`   ${String(r.score).padStart(3)}  ${r.name.slice(0, 40).padEnd(41)} ← ${r.title}`);
  }

  const flagged = await applyFlagshipPatch(cities);

  console.log(`\n[prominenz] Fertig: ${processed} geprueft, ${matched} auto-gematcht${WRITE ? `, ${written} geschrieben` : " (DRY-RUN, nichts geschrieben)"}. Flaggschiff-Patch: ${flagged} gesetzt.`);
}

main().catch((error) => {
  console.error("[prominenz] Backfill fehlgeschlagen:", error);
  process.exit(1);
});
