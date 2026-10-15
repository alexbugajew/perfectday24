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
//      Exakte Treffer sortieren vor Teiltreffern; ein Ort, der nur NACH dem
//      Artikel benannt ist ("Das Center am Potsdamer Platz"), bekommt ihn nie
//      (lib/admin/prominence-match.ts).
//   2. Fallback: Wikidata-Namenssuche + Geo-Verifikation (<600m) — faengt
//      Flaggschiffe, deren Artikel nicht im Geo-Top-N liegt (z.B. Pergamon).
//   3. Typgate ueber Wikidata instance_of (P31): Stadtteile/Strassen/Raeume/
//      Skulpturen werden verworfen (sonst erbt ein Kleinmuseum die Bezirks-Fame).
//
// GEDENKORTE BEKOMMEN KEINEN WERT: Mahnmale, Ehrenmale, Friedhöfe und KZ-
// Gedenkorte werden über Name/Subtype UND über den Wikidata-Typ (P31) erkannt,
// bevor ein Score entsteht (lib/admin/prominence-memorial.ts).
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
// Der vollständige Report landet als TSV unter tmp/ (gitignored), die Konsole
// zeigt nur Zählungen und eine Vorschau.
//
// Ablauf: erst alle Orte auflösen, dann die Sicherheitsprüfung (abgesenkt /
// Gastronomie / Gedenkort) über ALLE geplanten Writes, erst danach schreiben.
// Bei einem Verstoß bricht der Lauf ohne einen einzigen Write ab. Große Läufe
// deshalb in Etappen mit --limit fahren — der Checkpoint wird erst nach den
// Writes gespeichert.
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
// Danach den Checkpoint tmp/prominence-backfill.json löschen. Sonst überspringt
// der nächste Lauf alle dort gelisteten Orte, obwohl ihr Wert zurückgerollt ist.
//
// Usage: npm run locations:backfill:prominence -- [--city=slug,…|--all]
//        [--name=Teilstring] [--write] [--limit=N] [--cap=80] [--delay-ms=150]
// --name schränkt den Auto-Pool für gezielte Proben ein ("--name=Ehrenmal");
// der Flaggschiff-Patch läuft trotzdem für die gewählten Städte.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  GASTRONOMY_CATEGORIES,
  hasProminenceEntry,
  isBoostableCategory,
  mergeProminenceEntry,
  originalPopularity,
  raisePopularity,
  safetyViolations,
  type ProminenceSource,
} from "../lib/admin/prominence-refs";
import { cityTokens, nameMatch } from "../lib/admin/prominence-match";
import { isSolemnMemorialName, solemnWikidataType } from "../lib/admin/prominence-memorial";

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
const NAME_FILTER = parseArg("name");
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

// Gedenkorte bekommen keinen Prominenz-Wert — Begründung und Begriffslogik in
// lib/admin/prominence-memorial.ts. Die Beschreibung wird dafür bewusst nicht
// mehr geladen: Sie lieferte nur Fehlalarme ("Volkstrauertag" in Öffnungszeiten).
type LocationRow = { id: string; name: string; lat: number | null; lng: number | null; source_refs: unknown; popularity_score: number | null; city_slug: string; category?: string | null; subtypes?: unknown };

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

function isDistrictTitle(t: string) {
  return /^(berlin|hamburg|muenchen|münchen|potsdam)-[a-zäöüß]+$/i.test((t || "").trim());
}
const REJECT_TYPES = ["ortsteil", "stadtteil", "stadtbezirk", "bezirk", "quarter", "borough", "neighbourhood", "neighborhood", "locality", "human settlement", "village", "municipality", "administrative territorial", "street", "strasse", "straße", "road", "avenue", "sculpture", "statue", "herm", "bust", "room", "zimmer", "andachtsraum", "human", "person", "company", "enterprise", "business", "dish", "food", "restaurant", "hotel", "u-bahnhof", "s-bahnhof", "railway station",
  // Wikidata führt U-Bahnhöfe heute als "underground station"/"Station der
  // U-Bahn Berlin" — "u-bahnhof" allein griff nicht mehr (Dry-Run 13.10.2026).
  "underground station", "metro station", "train station", "u-bahn", "s-bahn", "haltestelle"];
// Ab dieser Namens-Konfidenz gilt ein Kandidat als der Ort selbst.
const ACCEPT_CONF = 0.6;
function typeGate(typeLabels: string[], conf: number): "accept" | "reject" {
  const t = typeLabels.map((x) => x.toLowerCase()).join(" | ");
  if (REJECT_TYPES.some((k) => t.includes(k))) return "reject";
  return conf >= ACCEPT_CONF ? "accept" : "reject";
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
type Memorial = { memorial: string; title: string; wikidata: string };

// Ein plausibler Kandidat (Namens-Konfidenz ≥ ACCEPT_CONF) mit Gedenk-Typ
// sperrt den GANZEN Ort, nicht nur sich selbst. Würde man zum nächsten
// Kandidaten weitergehen, bekäme ein Ehrenmal, dessen Name keinen Marker trägt,
// über die Wikidata-Namenssuche womöglich die Bekanntheit des Nachbarparks.
// Umgekehrt verliert höchstens ein Park auf einem alten Friedhof seinen Boost —
// das ist der billigere Fehler.
async function resolveProminence(loc: LocationRow): Promise<Resolved | Memorial | null> {
  if (loc.lat == null || loc.lng == null) return null;
  const city = cityTokens(loc.city_slug);
  // 1) GeoSearch + Namens-Match
  let cands: Array<{ title: string; dist: number; conf: number }> = [];
  try {
    const g = await wiki(`https://de.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${loc.lat}%7C${loc.lng}&gsradius=${RADIUS}&gslimit=20&format=json`);
    cands = (g?.query?.geosearch ?? [])
      .filter((c: any) => !isDistrictTitle(c.title))
      .map((c: any) => ({ title: c.title, dist: c.dist, conf: nameMatch(loc.name, c.title, city).conf }))
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
      // Vor dem Typgate: Das Typgate akzeptiert "Gedenkstätte"/"Friedhof".
      // Ein schwacher Kandidat (nur ein gemeinsames Wort: "Tennishalle
      // Bergstedt" ↔ "Friedhof Bergstedt") sagt nichts über den Ort und würde
      // ohnehin nicht akzeptiert — er wird übersprungen, nicht als Gedenkort
      // gewertet.
      const solemn = solemnWikidataType(e.p31, lb);
      if (solemn) {
        if (c.conf >= ACCEPT_CONF) return { memorial: solemn, title: c.title, wikidata: qid };
        continue;
      }
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
    // Die Geo-Verifikation allein reicht nicht: "Das Center am Potsdamer Platz"
    // liegt natürlich innerhalb von 600 m um den Potsdamer Platz.
    // Ohne jedes gemeinsame Wort ist der Treffer Suchrauschen: Der Dry-Run vom
    // 13.10.2026 ordnete dem "Bayernpark" den "Bayernplatz" zu.
    const match = nameMatch(loc.name, e.dewiki, city);
    if (match.kind === "named_after" || match.kind === "none") continue;
    const lb = await typeLabels(e.p31.slice(0, 6));
    await sleep(40);
    const solemn = solemnWikidataType(e.p31, lb);
    if (solemn) return { memorial: solemn, title: e.dewiki, wikidata: qid };
    if (typeGate(lb, Math.max(match.conf, ACCEPT_CONF)) !== "accept") continue;
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

const LOCATION_COLUMNS = "id, name, lat, lng, source_refs, popularity_score, city_slug, category, subtypes";

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
  if (NAME_FILTER) query = query.ilike("name", `%${NAME_FILTER}%`);
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

// ---------- Report ----------
type ReportStatus = "erhöht" | "unverändert" | "gedenkort" | "fehlgeschlagen" | "flaggschiff";
type ReportEntry = {
  status: ReportStatus;
  city: string;
  category: string;
  name: string;
  previous?: number;
  next?: number;
  raw?: number;
  title?: string;
  wikidata?: string | null;
  reason?: string;
};

const STATUS_ORDER: ReportStatus[] = ["erhöht", "unverändert", "gedenkort", "flaggschiff", "fehlgeschlagen"];
const tsv = (value: unknown) => (value == null ? "" : String(value).replace(/[\t\r\n]+/g, " "));

// Vollständige Liste als Datei: Die Konsole zeigte früher nur die ersten 15
// bzw. 5 Zeilen je Stadt — genau die Zeilen, die vor einem --write geprüft
// werden müssen (Gedenkorte, falsche Treffer), standen dann im Abgeschnittenen.
function writeReport(entries: ReportEntry[]): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const path = resolve(process.cwd(), `tmp/prominence-report-${stamp}${WRITE ? "-write" : "-dryrun"}.tsv`);
  const sorted = [...entries].sort(
    (a, b) =>
      a.city.localeCompare(b.city) ||
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
      (b.next ?? b.raw ?? 0) - (a.next ?? a.raw ?? 0) ||
      a.name.localeCompare(b.name)
  );
  const lines = [
    ["status", "stadt", "kategorie", "alt", "neu", "roh", "name", "wikipedia_titel", "wikidata", "grund"].join("\t"),
    ...sorted.map((e) => [e.status, e.city, e.category, e.previous, e.next, e.raw, e.name, e.title, e.wikidata, e.reason].map(tsv).join("\t")),
  ];
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
  return path;
}

// ---------- Flaggschiff-Patch ----------
type PlannedWrite = { loc: LocationRow; resolved: Resolved; next: number };

// Flaggschiffe, die der Auto-Matcher verfehlt (Plaetze/Venues/Parks), per
// Name+Stadt auf einen Mindest-Score heben. Fehlt die Location in PD24 ganz,
// wird das als Befund geloggt (boosten kann man nur, was existiert).
// planned = im Lauf bereits geplante Writes des Auto-Matchers. Geschrieben wird
// erst nach der Sicherheitsprüfung; hebt der Patch einen schon geplanten Ort
// weiter an, ersetzt er dessen Eintrag (ein Write je Ort, Mindest-Score per
// Math.max).
// solemnByWikidata = Orte, die der Auto-Matcher über den Wikidata-Typ als
// Gedenkort aussortiert hat. Die Flaggschiff-Liste ist eine redaktionelle,
// reviewte Entscheidung und darf das überstimmen — die Siegessäule führt
// Wikidata als "Kriegerdenkmal" (Q575759), sie ist aber Aussichtspunkt und
// Wahrzeichen, kein Ort der Trauer. Das wird geloggt, nicht still übergangen.
// Die Namens-/Subtype-Prüfung gilt dagegen auch hier.
async function applyFlagshipPatch(
  cities: string[] | null,
  planned: Map<string, PlannedWrite>,
  solemnByWikidata: Map<string, string>,
  entries: ReportEntry[]
): Promise<number> {
  const patches = FLAGSHIP_PATCH.filter((p) => !cities || cities.includes(p.city));
  let boosted = 0;
  const note = (p: (typeof FLAGSHIP_PATCH)[number], row: LocationRow | null, reason: string) => {
    console.log(`[prominenz] Flaggschiff ${p.label}${row ? `: "${row.name}" [${row.category ?? "?"}]` : ""} — ${reason}`);
    entries.push({ status: "flaggschiff", city: p.city, category: row?.category ?? "?", name: row?.name ?? p.label, title: `manual:${p.label}`, reason });
  };
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
      note(p, null, `Abfrage fehlgeschlagen (${error.message.replace(/\s+/g, " ").slice(0, 160)}) — übersprungen`);
      continue;
    }
    const named = ((data ?? []) as LocationRow[]).filter((row) => p.match.test(row.name));
    for (const row of named) {
      if (isBoostableCategory(row.category, p.categories)) continue;
      const why = row.category && GASTRONOMY_CATEGORIES.has(row.category) ? "Gastronomie wird nie geboostet" : `erwartet ${p.categories.join("/")}`;
      note(p, row, `nicht geboostet — ${why}`);
    }
    // Kanonischen Treffer waehlen: Regex-praezise, dann kuerzester Name
    // (die Hauptattraktion heisst meist schlichter als ihre Unterbereiche).
    const hit = named
      .filter((row) => isBoostableCategory(row.category, p.categories))
      .sort((a, b) => a.name.length - b.name.length)[0];
    if (!hit) {
      note(p, null, `FEHLT in PD24 (${p.city}) — nicht boostbar, Location anlegen`);
      continue;
    }
    if (isSolemnMemorialName(hit.name, hit.subtypes)) {
      note(p, hit, "ist Gedenkort (Name/Subtype) — kein Boost");
      continue;
    }
    const wikidataNote = solemnByWikidata.get(hit.id);
    if (wikidataNote) note(p, hit, `${wikidataNote} — redaktionelles Flaggschiff, Boost bleibt`);
    const base = planned.get(hit.id);
    const { previous, next, raised } = raisePopularity(base?.next ?? hit.popularity_score, p.score);
    if (!raised) {
      console.log(`[prominenz] Flaggschiff ${p.label} → "${hit.name}" [${hit.category}] bleibt ${previous} (Mindestwert ${p.score} erreicht)`);
      continue;
    }
    console.log(`[prominenz] Flaggschiff ${p.label} → "${hit.name}" [${hit.category}] ${previous} → ${next}${WRITE ? "" : " [dry-run]"}`);
    entries.push({ status: "erhöht", city: hit.city_slug, category: hit.category ?? "?", name: hit.name, previous, next, raw: p.score, title: `manual:${p.label}`, reason: "Flaggschiff-Patch" });
    planned.set(hit.id, {
      loc: base?.loc ?? hit,
      resolved: { score: p.score, sitelinks: 0, views: 0, title: `manual:${p.label}`, wikidata: null, source: "manual_flagship" },
      next,
    });
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
    `[prominenz] Start: ${cities ? cities.join(",") : "alle Staedte"}${NAME_FILTER ? ` · Name enthält "${NAME_FILTER}"` : ""} · Cap ${CAP} · ${done.size} bereits verarbeitet` +
      `${WRITE ? " · WRITE-MODUS" : " · DRY-RUN (kein Write)"}`
  );

  let processed = 0, matched = 0, raisedCount = 0, unchanged = 0, memorialsByName = 0, failed = 0, consecutiveFailures = 0;
  let aborted = false;
  let afterId: string | null = null;
  const pageSize = 1000;
  const entries: ReportEntry[] = [];
  const planned = new Map<string, PlannedWrite>();
  const solemnByWikidata = new Map<string, string>();

  // Phase 1: auflösen. Hier wird NICHTS geschrieben.
  outer: for (;;) {
    if (LIMIT && processed >= LIMIT) break;
    const rows = await fetchPage(cities, afterId, pageSize);
    if (rows.length === 0) break;
    afterId = rows[rows.length - 1].id;

    for (const loc of rows) {
      if (LIMIT && processed >= LIMIT) break;
      if (done.has(loc.id) || hasProminenceEntry(loc.source_refs)) continue;
      const base = { city: loc.city_slug, category: loc.category ?? "?", name: loc.name, previous: loc.popularity_score ?? 0 };
      // Gedenkorte nach Name/Subtype: gar nicht erst bei Wikipedia nachfragen.
      if (isSolemnMemorialName(loc.name, loc.subtypes)) {
        memorialsByName += 1;
        done.add(loc.id);
        entries.push({ ...base, status: "gedenkort", reason: "Name/Subtype" });
        continue;
      }
      processed += 1;
      let r: Resolved | Memorial | null = null;
      try {
        r = await resolveProminence(loc);
        consecutiveFailures = 0;
      } catch (error) {
        // Bewusst NICHT in den Checkpoint: Ein 429 sagt nichts ueber den Ort,
        // der naechste Lauf soll ihn erneut versuchen.
        failed += 1;
        consecutiveFailures += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.log(`[prominenz] ${loc.name}: Aufloesung fehlgeschlagen (${message}) — bleibt offen`);
        entries.push({ ...base, status: "fehlgeschlagen", reason: message });
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.log(`[prominenz] ${consecutiveFailures} Fehler in Folge — Abbruch, Rest im naechsten Lauf.`);
          aborted = true;
          break outer;
        }
        if (DELAY_MS > 0) await sleep(DELAY_MS);
        continue;
      }
      if (r && "memorial" in r) {
        solemnByWikidata.set(loc.id, r.memorial);
        console.log(`[prominenz] "${loc.name}" ist Gedenkort laut ${r.memorial} (← ${r.title}) — kein Wert`);
        entries.push({ ...base, status: "gedenkort", title: r.title, wikidata: r.wikidata, reason: r.memorial });
      } else if (r && r.score > 0) {
        matched += 1;
        const { previous, next, raised } = raisePopularity(loc.popularity_score, r.score);
        const entry: ReportEntry = { ...base, previous, next, raw: r.score, title: r.title, wikidata: r.wikidata, status: raised ? "erhöht" : "unverändert" };
        entries.push(entry);
        if (raised) {
          raisedCount += 1;
          planned.set(loc.id, { loc, resolved: r, next });
        } else {
          unchanged += 1;
        }
      }
      done.add(loc.id);
      if (DELAY_MS > 0) await sleep(DELAY_MS);
    }
    console.log(`[prominenz] ${processed} geprueft, ${matched} mit Prominenz, ${raisedCount} erhoeht (geplant)`);
    if (rows.length < pageSize) break;
  }

  // Nach einem Abbruch wegen Drosselung keine weiteren Abfragen nachschieben.
  const flagged = aborted ? 0 : await applyFlagshipPatch(cities, planned, solemnByWikidata, entries);

  // Phase 2: Sicherheitsprüfung über ALLE geplanten Writes, gegen den DB-Stand
  // vor diesem Lauf — nachgerechnet statt behauptet.
  const writes = [...planned.values()];
  const violations = safetyViolations(
    writes.map((w) => ({
      name: w.loc.name,
      category: w.loc.category,
      previous: w.loc.popularity_score,
      next: w.next,
      solemn: isSolemnMemorialName(w.loc.name, w.loc.subtypes),
    }))
  );
  const reportPath = writeReport(entries);

  const cityKeys = [...new Set(entries.map((e) => e.city))].sort();
  for (const city of cityKeys) {
    const of = (status: ReportStatus) => entries.filter((e) => e.city === city && e.status === status);
    const up = of("erhöht").sort((a, b) => (b.next ?? 0) - (a.next ?? 0));
    console.log(
      `\n[prominenz] ${city} · erhöht ${up.length}, unverändert ${of("unverändert").length}, ` +
        `Gedenkorte ${of("gedenkort").length}, fehlgeschlagen ${of("fehlgeschlagen").length} — Vorschau:`
    );
    for (const e of up.slice(0, 5)) {
      console.log(`   ${String(e.previous).padStart(3)} → ${String(e.next).padStart(3)}  ${e.name.slice(0, 40).padEnd(41)} [${e.category}] ← ${e.title}`);
    }
  }
  console.log(`\n[prominenz] Vollständiger Report: ${relative(process.cwd(), reportPath)}`);

  const memorialsByWikidata = solemnByWikidata.size;
  const summary =
    `${processed} geprueft, ${matched} auto-gematcht, ${raisedCount} erhoeht, ${unchanged} unveraendert, ${failed} fehlgeschlagen (offen). ` +
    `Flaggschiff-Patch: ${flagged} erhoeht. Gedenkorte uebersprungen: ${memorialsByName + memorialsByWikidata} ` +
    `(Name/Subtype ${memorialsByName}, Wikidata-Typ ${memorialsByWikidata}). ` +
    `Abgesenkt: ${violations.lowered.length}. Gastronomie geboostet: ${violations.gastronomy.length}. Gedenkorte geboostet: ${violations.memorials.length}.`;

  if (violations.lowered.length || violations.gastronomy.length || violations.memorials.length) {
    // Abbruch VOR dem ersten Write. Der Checkpoint bleibt unverändert, damit
    // der nächste Lauf nach dem Fix dieselben Orte erneut prüft.
    console.log(`\n[prominenz] ABBRUCH OHNE WRITE: ${summary}`);
    for (const [label, names] of Object.entries(violations)) if (names.length) console.log(`   ${label}: ${names.slice(0, 20).join(" | ")}`);
    throw new Error("Sicherheitsregel verletzt (Absenkung, Gastronomie- oder Gedenkort-Boost) — nichts geschrieben");
  }

  // Phase 3: schreiben (nur mit --write).
  let written = 0;
  if (WRITE) {
    try {
      for (const w of writes) {
        await writeProminence(w.loc, w.resolved, w.next);
        written += 1;
      }
    } catch (error) {
      // Nicht geschriebene Orte aus dem Checkpoint nehmen, sonst überspränge
      // sie der nächste Lauf, obwohl ihr Wert nie in der DB ankam.
      for (const w of writes.slice(written)) done.delete(w.loc.id);
      saveCheckpoint(done);
      throw error;
    }
    saveCheckpoint(done);
  }

  console.log(`\n[prominenz] Fertig: ${summary}${WRITE ? ` ${written} geschrieben.` : " DRY-RUN, nichts geschrieben."}`);
  if (aborted) process.exitCode = 2;
}

main().catch((error) => {
  console.error("[prominenz] Backfill fehlgeschlagen:", error);
  process.exit(1);
});
