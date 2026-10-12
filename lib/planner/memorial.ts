// Gemeinsame Signale für Gedenkorte (Mahnmale, KZ-Gedenkstätten, Friedhöfe,
// Kriegerdenkmäler) und Gedenkveranstaltungen.
//
// Produktentscheidung 24.09.: Gedenkorte dürfen bei tourism/Kultur als würdiger,
// korrekt betitelter Stop erscheinen (viele besuchen z.B. das Holocaust-Mahnmal
// bewusst) — aber nie als fröhlicher Höhepunkt. Auslöser: Der Planner bot am
// 19.10. für Berlin das "Denkmal für die ermordeten Juden Europas" als
// "Markt / Festival"-Höhepunkt an.
//
// Was der Code daraus tatsächlich macht (Stand 10/2026): Ein Gedenkort wird nie
// Peak-Anker, nie Kandidat für den Peak-Slot, nie automatischer Event-Anker und
// nie Markt/Festival (route/anchor.ts, route-construction.ts,
// market-festival.ts). In den übrigen Slots bleibt er zulässig — auch in
// party/date/friends. Ihn dort ganz aus den Pools zu nehmen, ist ein offener
// Backlog-Punkt, kein Versprechen dieses Moduls.
//
// Geprüft wird nur die BENENNUNG: Event-Titel plus Veranstaltungsort, bei
// Locations der Name. Nie Beschreibung, Summary oder Tags. Bis 10/2026 lief die
// Prüfung über den ganzen Suchtext — der "Internationale Weihnachtsmarkt Essen"
// galt als Gedenkort, weil seine Summary nebenbei "15. November: Volkstrauertag"
// erwähnt, und eine Kabarett-Ankündigung wegen "seit Menschengedenken". Eine
// Beschreibung erwähnt, was rundherum passiert; der Name sagt, was der Ort ist.
// Dieselbe Abwägung steht in events.ts (refinePlannerEventCategory) für die
// Kategorie-Regeln.
//
// Events prüft isSolemnMemorialEvent nur gegen die Gedenk-Marker des Ingests;
// Locations prüft isSolemnMemorialPlace zusätzlich gegen Orts-Marker
// (Friedhof, Ehrenmal, Kriegerdenkmal …). Warum die Trennung, steht bei
// SOLEMN_PLACE_MARKERS.

/**
 * Gedenk-Signalwörter für Event-Titel. Der Ingest (refinePlannerEventCategory)
 * schiebt Events mit einem dieser Marker im Titel komplett nach `other`; der
 * Planner nutzt dieselbe Liste in isSolemnMemorialEvent/-Place.
 *
 * Alle Einträge sind so spezifisch, dass sie auch mitten in einem Kompositum
 * sicher sind ("Novemberpogrom", "Holocaust-Mahnmal", "NS-Zwangsarbeit").
 * "gedenk" ist es nicht und steht deshalb separat in GEDENK_WORD_START_RE.
 */
export const MEMORIAL_MARKERS = [
  "deportation",
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

// "gedenk" nur am Wortanfang. Als Teilstring traf es "seit Menschengedenken"
// (Kabarett) und "eingedenk" (Komödie). Ein Bindestrich zählt bewusst NICHT als
// Wortanfang: "Anna-Seghers-Gedenkstätte" und "Mori-Ôgai-Gedenkstätte" sind
// Literaturmuseen, keine Orte der Trauer. Die solemnen Komposita (KZ-, NS-,
// Holocaust-, Euthanasie-Gedenk…, Totengedenken) fangen die Marker oben ab.
const GEDENK_WORD_START_RE = /(?:^|[^\p{L}-])gedenk/u;

/**
 * Zusätzliche Marker nur für Orts-NAMEN (Locations): Orte, die als Ort solemn
 * sind, auch wenn ihr Name kein "Gedenk" trägt.
 *
 * Nicht für Events, auch nicht für deren Veranstaltungsort: Als Venue ist
 * "Friedhof" meist Adresse oder Kirchenname — in der "Friedhofskirche
 * Elberfeld" laufen Gospelkonzerte, an der "Haltestelle Waldfriedhof" startet
 * eine Pilz-Exkursion. Und auch nicht im Ingest: Eine Friedhofsführung soll
 * nicht still aus der gesamten Eventplanung verschwinden.
 */
const SOLEMN_PLACE_MARKERS = [
  "friedhof",
  "ehrenmal",
  "kriegerdenkmal",
  "kriegsdenkmal",
  "gefallenendenkmal",
  "kriegsopfer",
  "grabstätte",
  "gräberstätte",
  "ermordeten",
] as const;

// "Conviva am Ostfriedhof" ist ein Café, "Park am Urnenfriedhof" ein Park,
// "Sportplatz Am Ehrenmal" ein Sportplatz: Der Ortsname dient dort nur als
// Adresse. Steht direkt davor eine Lage-Präposition, zählt der Treffer nicht.
const LOCATIVE_PREFIX_RE =
  /(?:^|[^\p{L}])(?:am|an|an der|beim|hinter|neben|vor|zum|zur|westlich|östlich|nördlich|südlich)\s+(?:(?:alten|alter|altem|neuen|neuer|neuem)\s+)?["„']?[\p{L}-]*$/u;

// Ein Denkmal mit einem dieser Wörter im Namen ist ein Gedenkort ("Denkmal für
// die Opfer …", "Denkmal 2. Weltkrieg", "… im Nationalsozialismus verfolgten
// …"). Allein sind die Wörter zu breit ("Opferfest", "Krieg der Sterne"),
// deshalb zählen sie nur zusammen mit einem Denkmal-Signal (Name oder Subtype
// `memorial`).
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

// OSM-/Taxonomie-Subtypes, die einen Ort für sich allein als Gedenkort
// ausweisen. Exakt verglichen, nicht als Teilstring.
//
// `memorial` steht bewusst NICHT hier: OSM vergibt es für jedes Denkmal —
// Lilienthal-Denkmal, Bismarck-Denkmal, Freiheits- und Einheitsdenkmal,
// Literatur-Gedenkstätten. Es zählt nur zusammen mit MEMORIAL_CONTEXT_MARKERS.
// Ebenso fehlt das noch breitere `monument`.
export const SOLEMN_MEMORIAL_SUBTYPES = [
  "cemetery",
  "grave_yard",
  "war_memorial",
  "mass_grave",
] as const;

function lower(text: string | null | undefined) {
  return (text ?? "").toLowerCase();
}

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

/**
 * Trägt eine Benennung ein Gedenk-Signalwort? Der Ingest ruft das mit dem
 * Event-Titel auf, der Planner mit Titel plus Veranstaltungsort bzw. dem Namen —
 * nie mit Beschreibung oder Summary (siehe oben).
 */
export function textHasMemorialMarker(text: string | null | undefined): boolean {
  const value = lower(text);
  if (!value.trim()) return false;
  return (
    GEDENK_WORD_START_RE.test(value) ||
    MEMORIAL_MARKERS.some((marker) => value.includes(marker))
  );
}

/**
 * Die Benennung, an der die Gedenk-Prüfung hängt: Name bzw. Titel plus
 * Veranstaltungsort. Nimmt Event-Zeilen (`title`, `venue_name`) ebenso wie
 * LocationRows (`name`, bei Events `source_refs.venueName`).
 */
export function memorialNameText(source: {
  name?: unknown;
  title?: unknown;
  venue_name?: unknown;
  source_refs?: unknown;
}): string {
  const refs =
    source.source_refs && typeof source.source_refs === "object"
      ? (source.source_refs as Record<string, unknown>)
      : null;
  return [source.name, source.title, source.venue_name, refs?.venueName]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" · ");
}

function subtypeSet(subtypes: Iterable<string> | null | undefined) {
  return new Set(Array.from(subtypes ?? [], (value) => lower(value)));
}

type SolemnMemorialInput = {
  /** Die Benennung aus memorialNameText — nie der volle Suchtext. */
  name: string | null | undefined;
  /** Exakt verglichen, nicht als Teilstring. */
  subtypes?: Iterable<string> | null | undefined;
};

/**
 * Ist das Event eine Gedenkveranstaltung (bzw. findet es an einem Gedenkort
 * statt, dessen Name einen Gedenk-Marker trägt — "KZ-Gedenkstätte Neuengamme")?
 * Nur die Gedenk-Marker des Ingests, keine Orts-Marker (siehe oben).
 */
export function isSolemnMemorialEvent(input: SolemnMemorialInput): boolean {
  const subtypes = subtypeSet(input.subtypes);
  if (SOLEMN_MEMORIAL_SUBTYPES.some((subtype) => subtypes.has(subtype))) return true;
  return textHasMemorialMarker(input.name);
}

/** Ist die Location ein solemner Gedenkort? */
export function isSolemnMemorialPlace(input: SolemnMemorialInput): boolean {
  if (isSolemnMemorialEvent(input)) return true;

  const name = lower(input.name);
  if (!name.trim()) return false;
  if (hasPlaceMarker(name)) return true;

  const memorialLike = subtypeSet(input.subtypes).has("memorial") || name.includes("denkmal");
  return memorialLike && MEMORIAL_CONTEXT_MARKERS.some((marker) => name.includes(marker));
}
