// Gedenkort-Ausschluss für den Prominenz-Backfill.
// ============================================================================
// popularity_score wirkt anlass-BLIND: Ein Boost hebt einen Ort in jedem
// Kontext, auch in date/friends/party. Ein Mahnmal, ein Ehrenmal oder eine
// KZ-Gedenkstätte mit hoher Prominenz würde damit in Nicht-Anker-Slots
// fröhlicher Pläne rutschen. Solche Orte bekommen deshalb gar keinen
// Prominenz-Wert — die Entscheidung fällt, BEVOR ein Score entsteht.
//
// Zwei unabhängige Schichten, weil jede für sich Lücken hat:
//   1. Benennung (Name + OSM-Subtypes) — isSolemnMemorialName. Der Review zu
//      PR #38 fand "Sowjetisches Ehrenmal Tiergarten": kein Marker im Namen
//      erkannt, Subtype nur "landmark", Wikipedia-Treffer → wäre von 0
//      geboostet worden.
//   2. Wikidata-Typ (P31) des gematchten Artikels — isSolemnWikidataType. Der
//      Backfill lädt P31 ohnehin für das Typgate; ein Ort wie die "Neue Wache"
//      trägt keinen Marker im Namen, ist auf Wikidata aber als Gedenkstätte
//      (Q5003624) typisiert.
//
// Beschreibungen werden bewusst NICHT geprüft: Sie erwähnen, was rundherum
// passiert ("am Volkstrauertag geschlossen" in Öffnungszeiten), nicht was der
// Ort ist. Dieselbe Abwägung steht in lib/planner/memorial.ts (PR #35).
//
// Verhältnis zu lib/planner/memorial.ts (PR #35, Stand f2ad125): Die Benennungs-
// Logik unten ist dessen isSolemnMemorialPlace, inhaltlich unverändert
// übernommen (Begründungen der einzelnen Listen stehen dort), weil #35 noch
// nicht auf main ist. TODO nach dem Merge von #35: die Listen zusammenführen —
// isSolemnMemorialPlace von dort importieren und hier nur die strengeren
// Backfill-Zusätze (BACKFILL_*) und die Wikidata-Typen behalten.
//
// Warum der Backfill strenger sein darf als der Planner: Ein Fehlalarm kostet
// hier nichts — der Ort behält seinen bisherigen Wert, und der Planner
// entscheidet über Slots weiterhin mit seiner eigenen Logik. Ein verpasster
// Gedenkort dagegen bekommt dauerhaft einen anlass-blinden Boost. Deshalb
// zählen hier zusätzlich: Wortanfang-Marker auch nach Bindestrich
// ("Stasi-Gedenkstätte"), ohne Lage-Ausnahme ("Am Ehrenmal"), und der OSM-
// Subtype `memorial` schon allein.

// ---------- Übernommen aus lib/planner/memorial.ts (PR #35) ----------

const MEMORIAL_MARKERS = [
  "deportation",
  "deportiert",
  "zwangsarbeit",
  "holocaust",
  "shoah",
  "schoah",
  "stolperstein",
  "mahnmal",
  "volkstrauertag",
  "pogrom",
  "konzentrationslager",
  "kz-gedenk",
  "ns-gedenk",
  "totengedenk",
  "opfergedenk",
  "euthanasie",
  "opfer des nationalsozialismus",
  "trauerfeier",
  "kriegsgraeber",
  "kriegsgräber",
] as const;

const GEDENK_WORD_START_RE = /(?:^|[^\p{L}-])gedenk/u;
const KZ_WORD_RE = /(?:^|[^\p{L}])kz(?:[^\p{L}]|$)/u;

const SOLEMN_PLACE_MARKERS = [
  "friedhof",
  "ehrenmal",
  "kriegerdenkmal",
  "kriegsdenkmal",
  "gefallene",
  "kriegergedächtnis",
  "krieger-gedächtnis",
  "kriegsopfer",
  "grabstätte",
  "gräberstätte",
  "ermordeten",
] as const;

const LOCATIVE_PREFIX_RE =
  /(?:^|[^\p{L}])(?:am|an|an der|beim|hinter|neben|vor|zum|zur|westlich|östlich|nördlich|südlich)\s+(?:(?:alten|alter|altem|neuen|neuer|neuem)\s+)?["„']?[\p{L}-]*$/u;

const MEMORIAL_CONTEXT_MARKERS = [
  "opfer",
  "ermordet",
  "verfolgt",
  "verfolgung",
  "krieg",
  "gefallen",
  "widerstand",
  "deportiert",
  "sinti",
] as const;

const SOLEMN_MEMORIAL_SUBTYPES = ["cemetery", "grave_yard", "war_memorial", "mass_grave"] as const;

function hasPlaceMarker(value: string) {
  for (const marker of SOLEMN_PLACE_MARKERS) {
    let index = value.indexOf(marker);
    while (index >= 0) {
      if (!LOCATIVE_PREFIX_RE.test(value.slice(0, index))) return true;
      index = value.indexOf(marker, index + marker.length);
    }
  }
  return false;
}

function plannerSolemnPlace(name: string, subtypes: Set<string>): boolean {
  if (SOLEMN_MEMORIAL_SUBTYPES.some((subtype) => subtypes.has(subtype))) return true;
  if (!name.trim()) return false;
  if (GEDENK_WORD_START_RE.test(name) || KZ_WORD_RE.test(name)) return true;
  if (MEMORIAL_MARKERS.some((marker) => name.includes(marker))) return true;
  if (hasPlaceMarker(name)) return true;
  const memorialLike = subtypes.has("memorial") || subtypes.has("historic_site") || name.includes("denkmal");
  return memorialLike && MEMORIAL_CONTEXT_MARKERS.some((marker) => name.includes(marker));
}

// ---------- Strengere Zusätze nur für den Backfill ----------

// Wortanfang heißt hier: Anfang des Namens oder nach jedem Nicht-Buchstaben,
// AUCH nach einem Bindestrich. "Opfer" trifft damit auch "Opferberg" — ein
// Fehlalarm, der nur einen Boost verhindert (s. o.).
const BACKFILL_WORD_START_MARKERS = [
  "ehrenmal",
  "friedhof",
  "kz",
  "mahnmal",
  "gedenkstätte",
  "gedenkstaette",
  "opfer",
  "deportiert",
  "gefallene",
  "kriegergedächtnis",
  "kriegergedaechtnis",
] as const;
const BACKFILL_WORD_START_RE = new RegExp(`(?:^|[^\\p{L}])(?:${BACKFILL_WORD_START_MARKERS.join("|")})`, "u");

// `memorial` allein reicht hier (im Planner nur mit Kontext-Marker): Lilienthal-
// oder Bismarck-Denkmal ohne Boost ist harmlos.
const BACKFILL_SOLEMN_SUBTYPES = ["memorial"] as const;

function subtypeSet(subtypes: unknown): Set<string> {
  return new Set(Array.isArray(subtypes) ? subtypes.map((value) => String(value).toLowerCase()) : []);
}

/**
 * Ist der Ort nach Name oder OSM-Subtype ein Gedenkort? Bekommt nie die
 * Beschreibung (s. o.).
 */
export function isSolemnMemorialName(name: string | null | undefined, subtypes?: unknown): boolean {
  const value = (name ?? "").toLowerCase();
  const subs = subtypeSet(subtypes);
  if (BACKFILL_SOLEMN_SUBTYPES.some((subtype) => subs.has(subtype))) return true;
  if (plannerSolemnPlace(value, subs)) return true;
  return BACKFILL_WORD_START_RE.test(value);
}

// ---------- Wikidata-Typen (P31) ----------

/**
 * Solemne Wikidata-Klassen, exakt per Q-ID verglichen. Jede ID und jedes Label
 * am 13.10.2026 per wbgetentities nachgeprüft. Eine eigene Klasse
 * "KZ-Gedenkstätte" gibt es nicht: Neuengamme (Q1719324) und Dachau
 * (Q1532094) sind als Gedenkstätte Q5003624 typisiert. Das Sowjetische Ehrenmal
 * Tiergarten (Q32660126) als Friedhof Q39614, das Holocaust-Mahnmal (Q160700)
 * als Holocaust-Denkmal Q20011797.
 */
export const SOLEMN_WIKIDATA_TYPES: Readonly<Record<string, string>> = {
  Q5003624: "Gedenkstätte (memorial)",
  Q575759: "Kriegerdenkmal (war memorial)",
  Q3238324: "Gefallenendenkmal Erster Weltkrieg",
  Q64374896: "Gefallenendenkmal Zweiter Weltkrieg",
  Q1885014: "Mahnmal (cautionary memorial)",
  Q20011797: "Holocaust-Denkmal",
  Q26703203: "Stolperstein",
  Q136703445: "LGBT-Denkmal oder Mahnmal",
  Q11734477: "Gedenkstein",
  Q39614: "Friedhof (cemetery)",
  Q846659: "jüdischer Friedhof",
  Q13424425: "Waldfriedhof",
  Q2073075: "Pestfriedhof",
  Q1241568: "Soldatenfriedhof (war cemetery)",
  Q1707610: "Kriegsgräberstätte",
  Q2305029: "Sowjetische Kriegsgräberstätten in Deutschland",
  Q90717531: "Kriegsgrab",
  Q173387: "Grab",
  Q734271: "Massengrab",
  Q152081: "Konzentrationslager",
  Q328468: "NS-Konzentrationslager",
  Q1719244: "KZ-Außenlager",
};

// Wikidata hat Dutzende Unterklassen (z. B. "Gefallenendenkmal Deutsch-
// Französischer Krieg"), die keine feste Liste vollständig abdeckt. Deshalb
// zusätzlich die de/en-Labels der P31-Typen, die der Backfill ohnehin lädt.
// "friedhof" als Teilstring (Waldfriedhof, Pestfriedhof), der Rest am
// Wortanfang. Bewusst NICHT "denkmal": Das träfe "Kulturdenkmal"/"Baudenkmal".
const SOLEMN_TYPE_LABEL_RE =
  /friedhof|(?:^|[^\p{L}])(?:cemetery|graveyard|gedenkstätte|gedenkstein|mahnmal|ehrenmal|memorial|holocaust|stolperstein|konzentrationslager|concentration camp|kz|kriegsgr(?:ä|ae)b|kriegerdenkmal|gefallenendenkmal|massengrab|mass grave|war grave)/iu;

/**
 * Ist einer der P31-Typen solemn? Gibt den Grund zurück (für den Report) oder
 * null.
 */
export function solemnWikidataType(p31: readonly string[], typeLabels: readonly string[] = []): string | null {
  for (const id of p31) {
    if (SOLEMN_WIKIDATA_TYPES[id]) return `Wikidata ${id} ${SOLEMN_WIKIDATA_TYPES[id]}`;
  }
  const label = typeLabels.find((value) => SOLEMN_TYPE_LABEL_RE.test(value));
  return label ? `Wikidata-Typ "${label}"` : null;
}
