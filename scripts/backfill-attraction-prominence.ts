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
// NIE ABSENKEN: Geschrieben wird max(alt, neu). Seed-Staedte tragen ueberall den
// Standard 40 (neutraler Sockel, s. lib/admin/prominence-refs.ts) — ein
// schwacher Wikipedia-Score darunter laesst den Wert stehen, statt bekannte Orte
// unter anonyme OSM-Orte zu druecken. Gastronomie wird nie geboostet.
//
// DEFAULT IST DRY-RUN: ohne --write wird NICHTS geschrieben, nur ein Report
// (alt → neu) erzeugt. Ein popularity_score-Write verschiebt Plaene fuer alle
// Nutzer — deshalb erst Report pruefen, dann --write auf Kernstaedte (nur nach
// Freigabe), dann check:planner gegen die geaenderten Daten, dann weiter.
//
// ZURUECKROLLEN: Jeder Write legt genau einen Eintrag {prominence_source, …,
// previous_popularity_score} in source_refs ab; previous_popularity_score ist
// der Wert vor dem ERSTEN Backfill-Lauf. Rueckweg (SQL-Editor, nur nach
// Freigabe; per "and t.ref->>'prominence_source' = 'manual_flagship'" auch
// selektiv):
//   update public.locations l
//      set popularity_score = (p.ref ->> 'previous_popularity_score')::numeric,
//          source_refs = l.source_refs - p.idx
//     from (select loc.id, t.ref, (t.ord - 1)::int as idx
//             from public.locations loc
//             cross join lateral jsonb_array_elements(case when jsonb_typeof(loc.source_refs) = 'array'
//               then loc.source_refs else '[]'::jsonb end) with ordinality as t(ref, ord)
//            where t.ref ? 'prominence_source') p
//    where l.id = p.id;
//
// Usage: npm run locations:backfill:prominence -- [--city=slug,…|--all]
//        [--write] [--limit=N] [--cap=80] [--delay-ms=150]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  GASTRONOMY_CATEGORIES,
  hasProminenceEntry,
  isBoostableCategory,
  mergeProminenceEntry,
  originalPopularity,
  raisePopularity,
  type ProminenceSource,
} from "../lib/admin/prominence-refs";

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
// Wikimedia verlangt einen Kontakt im User-Agent; die Impressums-URL erfuellt
// das, ohne eine persoenliche Mailadresse ins (oeffentliche) Repo zu schreiben.
const UA = "PerfectDay24-ProminenceBackfill/1.1 (https://www.perfectday24.de/impressum)";
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
// match ist bewusst auf den GANZEN Namen verankert: Fehlt der eigentliche Ort,
// traf der Substring sonst ein Restaurant in der Naehe — der Dry-Run vom
// 12.10.2026 haette "Marienplatz-Alm" und "El Gaucho am Viktualienmarkt"
// geboostet. Lieber "FEHLT" loggen als den falschen Ort hochziehen.
// categories = erwartete Kategorie(n) des echten Orts (Live-Stand 12.10.2026,
// das Hamburger Rathaus steht dort als "other"/townhall). Ein Namens-Treffer in
// einer anderen Kategorie wird nicht geboostet, sondern geloggt — gleicher Name
// heisst nicht gleicher Ort. Gastronomie ist zusaetzlich hart ausgeschlossen
// (GASTRONOMY_CATEGORIES). Das Hofbraeuhaus stand frueher in dieser Liste, ist
// live aber category=restaurant: Als Wirtshaus konkurriert es in Essens-Slots,
// und ein anlass-blinder Prominenz-Boost wuerde es in jeden Plan druecken.
// Deshalb ist es bewusst KEIN Flaggschiff mehr.
const FLAGSHIP_PATCH: Array<{ city: string; q: string; match: RegExp; categories: string[]; score: number; label: string }> = [
  { city: "berlin-berlin", q: "gedächtnis", match: /^(kaiser-wilhelm-)?ged(ae|ä)chtniskirche$/i, categories: ["culture"], score: 45, label: "Gedächtniskirche" },
  { city: "berlin-berlin", q: "siegessäule", match: /^siegess(ae|ä)ule$/i, categories: ["culture", "activity"], score: 42, label: "Siegessäule" },
  { city: "berlin-berlin", q: "neue nationalgalerie", match: /^neue nationalgalerie$/i, categories: ["culture"], score: 45, label: "Neue Nationalgalerie" },
  { city: "berlin-berlin", q: "gemäldegalerie", match: /^gem(ae|ä)ldegalerie( am kulturforum)?$/i, categories: ["culture"], score: 42, label: "Gemäldegalerie" },
  { city: "hamburg-hamburg", q: "elbphilharmonie", match: /^elbphilharmonie( hamburg)?$/i, categories: ["culture"], score: 55, label: "Elbphilharmonie" },
  { city: "hamburg-hamburg", q: "wunderland", match: /^miniatur ?wunderland( hamburg)?$/i, categories: ["culture", "activity"], score: 52, label: "Miniatur Wunderland" },
  { city: "hamburg-hamburg", q: "landungsbrücken", match: /^(st\.? ?pauli[- ])?landungsbr(ue|ü)cken$/i, categories: ["activity", "culture", "other"], score: 45, label: "Landungsbrücken" },
  { city: "hamburg-hamburg", q: "rathaus", match: /^(hamburger )?rathaus( hamburg)?$/i, categories: ["other", "culture"], score: 42, label: "Hamburger Rathaus" },
  { city: "muenchen", q: "marienplatz", match: /^marienplatz$/i, categories: ["activity", "culture", "other"], score: 50, label: "Marienplatz" },
  { city: "muenchen", q: "englischer garten", match: /^englischer garten$/i, categories: ["activity"], score: 48, label: "Englischer Garten" },
  { city: "muenchen", q: "viktualienmarkt", match: /^viktualienmarkt$/i, categories: ["activity", "culture", "other"], score: 45, label: "Viktualienmarkt" },
];

type LocationRow = { id: string; name: string; lat: number | null; lng: number | null; source_refs: unknown; popularity_score: number | null; city_slug: string; category?: string | null; subtypes?: unknown; description?: string | null };

// Gedenkorte NICHT boosten. popularity_score wirkt anlass-BLIND (in jedem
// Kontext, auch date/friends/party). Ein hoher Prominenz-Score wuerde Mahnmale
// und Gedenkstaetten (Holocaust-Mahnmal, KZ-Orte, Stolpersteine) in Nicht-Anker-
// Slots froehlicher Plaene heben — im Widerspruch zur Memorial-Sensibilitaet
// (Planner-Guardrails, "echte Orte"). Solche Orte bleiben bewusst bei 0.
const MEMORIAL_MARKERS = ["gedenk", "mahnmal", "holocaust", "shoah", "schoah", "stolperstein", "konzentrationslager", "kz-", "ermordet", "opfer des nationalsozialismus", "ns-opfer", "zwangsarbeit", "deportation", "pogrom", "euthanasie", "kriegsgraeber", "kriegsgräber", "gestapo", "sa-gefängnis", "volkstrauertag", "trauerfeier"];
const MEMORIAL_SUBTYPES = ["memorial", "cemetery", "grave_yard", "war_memorial", "mass_grave"];
function isSolemnMemorial(loc: { name: string; description?: string | null; subtypes?: unknown }): boolean {
  const subs = Array.isArray(loc.subtypes) ? loc.subtypes.map((s) => String(s).toLowerCase()) : [];
  if (subs.some((s) => MEMORIAL_SUBTYPES.includes(s))) return true;
  const text = `${loc.name} ${loc.description ?? ""}`.toLowerCase();
  return MEMORIAL_MARKERS.some((m) => text.includes(m));
}

// ---------- Wikimedia-Helfer ----------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Voruebergehende Fehler (429 Rate-Limit, 5xx, Netz) duerfen NICHT wie "kein
// Wikipedia-Artikel" behandelt werden: Sonst landet der Ort ungeprueft im
// Checkpoint und wird nie wieder versucht. Die inneren Helfer schlucken deshalb
// nur endgueltige Fehler (z. B. 404 "keine Pageview-Daten") und reichen
// WikiTransientError bis in die Hauptschleife durch.
class WikiTransientError extends Error {}
const isTransient = (error: unknown) => error instanceof WikiTransientError;

async function wiki(url: string): Promise<any> {
  for (let attempt = 1; ; attempt++) {
    let r: Response;
    try {
      r = await fetch(url, { headers: { "User-Agent": UA } });
    } catch (error) {
      if (attempt >= 3) throw new WikiTransientError(`wiki netz (${error instanceof Error ? error.message : error})`);
      await sleep(attempt * 2000);
      continue;
    }
    if (r.ok) return r.json();
    const transient = r.status === 429 || r.status >= 500;
    if (!transient) throw new Error(`wiki ${r.status}`);
    if (attempt >= 3) throw new WikiTransientError(`wiki ${r.status}`);
    // Retry-After respektieren (Wikimedia-API-Etikette), gedeckelt auf 30 s.
    const retryAfter = Number(r.headers.get("retry-after"));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : attempt * 2000);
  }
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
  } catch (error) {
    if (isTransient(error)) throw error;
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
  } catch (error) {
    if (isTransient(error)) throw error;
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

type Resolved = { score: number; sitelinks: number; views: number; title: string; wikidata: string | null; source: ProminenceSource };

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
  } catch (error) {
    // Endgueltiger Geo-Fehler -> Namens-Fallback; Rate-Limit dagegen nach oben,
    // sonst wuerde ein leerer Fallback den Ort als "kein Treffer" abhaken.
    if (isTransient(error)) throw error;
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

const LOCATION_COLUMNS = "id, name, lat, lng, source_refs, popularity_score, city_slug, category, subtypes, description";

async function fetchPage(cities: string[] | null, afterId: string | null, pageSize: number): Promise<LocationRow[]> {
  let query = supabase
    .from("locations")
    .select(LOCATION_COLUMNS)
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

// next ist bereits nach der Nie-absenken-Regel berechnet (raisePopularity);
// aufgerufen wird nur, wenn er wirklich ueber dem alten Wert liegt.
async function writeProminence(loc: LocationRow, r: Resolved, next: number) {
  const sourceRefs = mergeProminenceEntry(loc.source_refs, {
    prominence_source: r.source,
    prominence_score: r.score,
    previous_popularity_score: originalPopularity(loc.source_refs, loc.popularity_score),
    wikidata_id: r.wikidata,
    matched_title: r.title,
    sitelinks: r.sitelinks,
    pageviews_monthly: r.views,
  });
  for (let attempt = 1; ; attempt++) {
    const { error } = await supabase
      .from("locations")
      .update({ popularity_score: next, source_refs: sourceRefs })
      .eq("id", loc.id);
    if (!error) return;
    if (attempt >= 4) throw new Error(`Prominenz-Write fehlgeschlagen: ${error.message}`);
    await sleep(attempt * 6000);
  }
}

type ReportRow = { name: string; city: string; category: string; previous: number; next: number; raw: number; title: string };

// Flaggschiffe, die der Auto-Matcher verfehlt (Plaetze/Venues/Parks), per
// Name+Stadt auf einen Mindest-Score heben. Fehlt die Location in PD24 ganz,
// wird das als Befund geloggt (boosten kann man nur, was existiert).
// planned = im Lauf bereits geplante Werte des Auto-Matchers. Im Write-Modus
// stehen sie schon in der DB, im Dry-Run nur hier — so trifft der Patch in
// beiden Modi dieselbe Entscheidung (Mindest-Score per Math.max, auch wenn der
// Auto-Matcher den Ort schon mit Provenienz versehen hat).
async function applyFlagshipPatch(cities: string[] | null, planned: Map<string, number>, report: ReportRow[]): Promise<number> {
  const patches = FLAGSHIP_PATCH.filter((p) => !cities || cities.includes(p.city));
  let boosted = 0;
  for (const p of patches) {
    const { data, error } = await supabase
      .from("locations")
      .select(LOCATION_COLUMNS)
      .eq("is_plannable", true)
      .eq("city_slug", p.city)
      .ilike("name", `%${p.q}%`)
      .limit(50);
    if (error) {
      // Ohne Abfrageergebnis waere "FEHLT" eine Falschmeldung.
      // Supabase liefert bei Cloudflare-5xx eine ganze HTML-Seite als message.
      console.log(`[prominenz] Flaggschiff ${p.label}: Abfrage fehlgeschlagen (${error.message.replace(/\s+/g, " ").slice(0, 160)}) — uebersprungen`);
      continue;
    }
    const named = ((data ?? []) as LocationRow[]).filter((row) => p.match.test(row.name));
    for (const row of named) {
      if (isBoostableCategory(row.category, p.categories)) continue;
      const why = row.category && GASTRONOMY_CATEGORIES.has(row.category) ? "Gastronomie wird nie geboostet" : `erwartet ${p.categories.join("/")}`;
      console.log(`[prominenz] Flaggschiff ${p.label}: "${row.name}" [${row.category ?? "?"}] nicht geboostet — ${why}`);
    }
    // Kanonischen Treffer waehlen: Regex-praezise, dann kuerzester Name
    // (die Hauptattraktion heisst meist schlichter als ihre Unterbereiche).
    const hit = named
      .filter((row) => isBoostableCategory(row.category, p.categories))
      .sort((a, b) => a.name.length - b.name.length)[0];
    if (!hit) {
      console.log(`[prominenz] Flaggschiff FEHLT in PD24: ${p.label} (${p.city}) — nicht boostbar, Location anlegen`);
      continue;
    }
    if (isSolemnMemorial(hit)) {
      console.log(`[prominenz] Flaggschiff ${p.label}: "${hit.name}" ist Gedenkort — kein Boost`);
      continue;
    }
    const { previous, next, raised } = raisePopularity(planned.get(hit.id) ?? hit.popularity_score, p.score);
    if (!raised) {
      console.log(`[prominenz] Flaggschiff ${p.label} → "${hit.name}" [${hit.category}] bleibt ${previous} (Mindestwert ${p.score} erreicht)`);
      continue;
    }
    console.log(`[prominenz] Flaggschiff ${p.label} → "${hit.name}" [${hit.category}] ${previous} → ${next}${WRITE ? "" : " [dry-run]"}`);
    report.push({ name: hit.name, city: hit.city_slug, category: hit.category ?? "?", previous, next, raw: p.score, title: `manual:${p.label}` });
    planned.set(hit.id, next);
    if (WRITE) {
      await writeProminence(hit, { score: p.score, sitelinks: 0, views: 0, title: `manual:${p.label}`, wikidata: null, source: "manual_flagship" }, next);
    }
    boosted += 1;
  }
  return boosted;
}

// Mehrere voruebergehende Fehler in Folge heissen: Wikimedia drosselt. Dann
// abbrechen statt weiter anzuklopfen; offene Orte holt der naechste Lauf.
const MAX_CONSECUTIVE_FAILURES = 5;

async function main() {
  const cities = resolveCitySlugs();
  const done = loadCheckpoint();
  console.log(
    `[prominenz] Start: ${cities ? cities.join(",") : "alle Staedte"} · Cap ${CAP} · ${done.size} bereits verarbeitet` +
      `${WRITE ? " · WRITE-MODUS" : " · DRY-RUN (kein Write)"}`
  );

  let processed = 0, matched = 0, raisedCount = 0, unchanged = 0, written = 0, memorials = 0, failed = 0, consecutiveFailures = 0;
  let aborted = false;
  let afterId: string | null = null;
  const pageSize = 1000;
  const report: ReportRow[] = [];
  const kept: ReportRow[] = [];
  const planned = new Map<string, number>();

  outer: for (;;) {
    if (LIMIT && processed >= LIMIT) break;
    const rows = await fetchPage(cities, afterId, pageSize);
    if (rows.length === 0) break;
    afterId = rows[rows.length - 1].id;

    for (const loc of rows) {
      if (LIMIT && processed >= LIMIT) break;
      if (done.has(loc.id) || hasProminenceEntry(loc.source_refs)) continue;
      // Gedenkorte bewusst ueberspringen — kein Prominenz-Boost (s.o.).
      if (isSolemnMemorial(loc)) { memorials += 1; done.add(loc.id); continue; }
      processed += 1;
      let r: Resolved | null = null;
      try {
        r = await resolveProminence(loc);
        consecutiveFailures = 0;
      } catch (error) {
        // Bewusst NICHT in den Checkpoint: Ein 429 sagt nichts ueber den Ort,
        // der naechste Lauf soll ihn erneut versuchen.
        failed += 1;
        consecutiveFailures += 1;
        console.log(`[prominenz] ${loc.name}: Aufloesung fehlgeschlagen (${error instanceof Error ? error.message : error}) — bleibt offen`);
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.log(`[prominenz] ${consecutiveFailures} Fehler in Folge — Abbruch, Rest im naechsten Lauf.`);
          aborted = true;
          break outer;
        }
        if (DELAY_MS > 0) await sleep(DELAY_MS);
        continue;
      }
      if (r && r.score > 0) {
        matched += 1;
        const { previous, next, raised } = raisePopularity(loc.popularity_score, r.score);
        const row: ReportRow = { name: loc.name, city: loc.city_slug, category: loc.category ?? "?", previous, next, raw: r.score, title: r.title };
        if (raised) {
          raisedCount += 1;
          report.push(row);
          planned.set(loc.id, next);
          if (WRITE) {
            await writeProminence(loc, r, next);
            written += 1;
          }
        } else {
          unchanged += 1;
          kept.push(row);
        }
      }
      done.add(loc.id);
      if (WRITE && processed % 25 === 0) saveCheckpoint(done);
      if (DELAY_MS > 0) await sleep(DELAY_MS);
    }
    console.log(`[prominenz] ${processed} geprueft, ${matched} mit Prominenz, ${raisedCount} erhoeht${WRITE ? `, ${written} geschrieben` : ""}`);
    if (rows.length < pageSize) break;
  }

  if (WRITE) saveCheckpoint(done);

  // Report je Stadt (auch fuer Dry-Run): alt → neu, damit vor dem --write
  // sichtbar ist, was sich im Ranking verschiebt — und was bewusst stehen bleibt.
  const cityKeys = [...new Set([...report, ...kept].map((r) => r.city))];
  for (const city of cityKeys) {
    const up = report.filter((r) => r.city === city).sort((a, b) => b.next - a.next);
    const same = kept.filter((r) => r.city === city).sort((a, b) => b.raw - a.raw);
    console.log(`\n[prominenz] ${city} · erhoeht ${up.length}, unveraendert ${same.length} (neu ≤ alt):`);
    for (const r of up.slice(0, 15)) {
      console.log(`   ${String(r.previous).padStart(3)} → ${String(r.next).padStart(3)}  ${r.name.slice(0, 40).padEnd(41)} [${r.category}] ← ${r.title}`);
    }
    for (const r of same.slice(0, 5)) {
      console.log(`   ${String(r.previous).padStart(3)} = ${String(r.next).padStart(3)}  ${r.name.slice(0, 40).padEnd(41)} [${r.category}] (roh ${r.raw}) ← ${r.title}`);
    }
  }

  // Nach einem Abbruch wegen Drosselung keine weiteren Abfragen nachschieben.
  const flagged = aborted ? 0 : await applyFlagshipPatch(cities, planned, report);

  // Nachgerechnet statt behauptet: Der Abschluss belegt, dass kein Ort
  // abgesenkt und keine Gastronomie geboostet wurde.
  const lowered = [...report, ...kept].filter((r) => r.next < r.previous).length;
  const gastro = report.filter((r) => GASTRONOMY_CATEGORIES.has(r.category)).length;
  console.log(
    `\n[prominenz] Fertig: ${processed} geprueft, ${matched} auto-gematcht, ${raisedCount} erhoeht, ${unchanged} unveraendert, ` +
      `${failed} fehlgeschlagen (offen)${WRITE ? `, ${written} geschrieben` : " (DRY-RUN, nichts geschrieben)"}. ` +
      `Flaggschiff-Patch: ${flagged} erhoeht. Gedenkorte uebersprungen: ${memorials}. Abgesenkt: ${lowered}. Gastronomie geboostet: ${gastro}.`
  );
  if (lowered > 0 || gastro > 0) throw new Error("Sicherheitsregel verletzt (Absenkung oder Gastronomie-Boost)");
  if (aborted) process.exitCode = 2;
}

main().catch((error) => {
  console.error("[prominenz] Backfill fehlgeschlagen:", error);
  process.exit(1);
});
