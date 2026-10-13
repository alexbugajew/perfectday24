// Namensabgleich Ort ↔ Wikipedia-Titel für den Prominenz-Backfill.
// ============================================================================
// Ausgelagert aus scripts/backfill-attraction-prominence.ts, damit die Regeln
// testbar sind (das Skript verbindet sich beim Import mit der Live-DB).
//
// Zwei Fehlerbilder, die der Review zu PR #38 fand:
//   1. Exakte Treffer und Teiltreffer bekamen beide 1.0 — die Reihenfolge hing
//      dann an der Titellänge, und der kürzere Teiltreffer gewann.
//   2. "Das Center am Potsdamer Platz" bekam den Artikel "Potsdamer Platz":
//      Der Titel steckt komplett im Ortsnamen, also galt das als Treffer. Der
//      Ort ist aber nur NACH dem Platz benannt — mit dessen Bekanntheit würde
//      jedes "Café am Brandenburger Tor" hochgezogen.
//
// Deshalb drei Stufen, strikt getrennt: exakt (≥ 0.95) vor Teiltreffer
// (≤ 0.9), und "benannt nach" (Titel ⊊ Ortsname) ist gar kein Treffer.

export type NameMatchKind = "exact" | "partial" | "named_after" | "none";
export type NameMatch = { conf: number; kind: NameMatchKind };

export function normName(value: string) {
  return (value || "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(["der", "die", "das", "und", "von", "zum", "zur", "des", "im", "am", "the", "of", "in", "a"]);

export function nameTokens(value: string) {
  return new Set(normName(value).split(" ").filter((word) => word.length > 2 && !STOP.has(word)));
}

/**
 * Stadt-Tokens aus dem city_slug ("hamburg-hamburg" → hamburg, hamburger).
 * "Elbphilharmonie Hamburg" ist derselbe Ort wie der Artikel "Elbphilharmonie";
 * der Stadtname ist dort Zusatz, kein eigener Bestandteil.
 */
export function cityTokens(citySlug: string | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const token of nameTokens((citySlug ?? "").replace(/-/g, " "))) {
    out.add(token);
    out.add(`${token}er`);
  }
  return out;
}

// Wikipedia-Klammerzusatz zur Begriffsklärung: "Siegessäule (Berlin)".
function stripDisambiguation(title: string) {
  return title.replace(/\s*\([^)]*\)\s*$/, "");
}

function withoutCity(tokens: Set<string>, city: Set<string>) {
  return new Set([...tokens].filter((token) => !city.has(token)));
}

// "Kunstverein am Rosa-Luxemburg-Platz e.V" ist der Kunstverein; was nach der
// Lage-Präposition kommt, ist Adresse. Der Dry-Run vom 13.10.2026 gab ihm
// sonst den "U-Bahnhof Rosa-Luxemburg-Platz" (3 von 4 Wörtern gemeinsam), und
// jeder Nachbar "… am Rosa-Luxemburg-Platz" hätte genauso gepasst. Ein Name, der
// mit der Präposition beginnt ("Am Husarendenkmal"), hat keine Adresse — dort
// ist der ganze Name die Identität.
const LOCATIVE_RE = / (?:am|an der|an|im|beim|vor|hinter|neben|gegenueber) /;

function splitLocative(locationName: string): { identity: Set<string>; address: Set<string> } | null {
  const value = normName(locationName);
  const match = LOCATIVE_RE.exec(value);
  if (!match) return null;
  const identity = nameTokens(value.slice(0, match.index));
  const address = nameTokens(value.slice(match.index + match[0].length));
  return identity.size && address.size ? { identity, address } : null;
}

function sameSet(a: Set<string>, b: Set<string>) {
  return a.size === b.size && [...a].every((token) => b.has(token));
}

/**
 * Wie gut passt ein Wikipedia-Titel zum Ortsnamen?
 *   exact       1.0 gleich · 0.98 gleich ohne Klammerzusatz · 0.95 gleiche
 *               Wörter (Reihenfolge, Artikel, Stadtname egal)
 *   partial     ≤ 0.9, damit jeder exakte Treffer vorne sortiert
 *   named_after 0 — der Titel steckt ganz im Ortsnamen, der Ort hat aber
 *               eigene Wörter darüber hinaus ("Das Center am Potsdamer Platz"
 *               vs. "Potsdamer Platz", "Deutsches Museum Verkehrszentrum" vs.
 *               "Deutsches Museum"), oder der Titel teilt nur die Adresse
 *               nach der Lage-Präposition
 */
export function nameMatch(locationName: string, title: string, city: Set<string> = new Set()): NameMatch {
  const base = stripDisambiguation(title);
  const nLoc = normName(locationName);
  if (!nLoc) return { conf: 0, kind: "none" };
  if (nLoc === normName(title)) return { conf: 1, kind: "exact" };
  if (nLoc === normName(base)) return { conf: 0.98, kind: "exact" };

  const loc = nameTokens(locationName);
  const ttl = nameTokens(base);
  if (!loc.size || !ttl.size) return { conf: 0, kind: "none" };

  const locCore = withoutCity(loc, city);
  const ttlCore = withoutCity(ttl, city);
  if (locCore.size && sameSet(locCore, ttlCore)) return { conf: 0.95, kind: "exact" };

  const locative = splitLocative(locationName);
  if (locative) {
    const sharesIdentity = [...ttl].some((token) => locative.identity.has(token));
    const sharesAddress = [...ttl].some((token) => locative.address.has(token));
    if (!sharesIdentity && sharesAddress) return { conf: 0, kind: "named_after" };
    // "Gemäldegalerie am Kulturforum" ist der Artikel "Gemäldegalerie (Berlin)".
    const identityCore = withoutCity(locative.identity, city);
    if (identityCore.size && sameSet(identityCore, ttlCore)) return { conf: 0.95, kind: "exact" };
  }

  // Titel komplett im Ortsnamen, und der Ort hat eigene Wörter darüber hinaus
  // (Stadtname und Adresse zählen nicht): Der Ort ist nach dem Artikel benannt,
  // nicht der Artikel selbst. Gilt auch für "Hamburg Dungeon" vs. "Hamburg".
  const titleInsideLocation = [...ttl].every((token) => loc.has(token));
  const ownWords = [...loc].some((token) => !ttl.has(token) && !city.has(token) && !locative?.address.has(token));
  if (titleInsideLocation && ownWords) return { conf: 0, kind: "named_after" };

  let inter = 0;
  for (const token of loc) if (ttl.has(token)) inter++;
  const nBase = normName(base);
  const contained = nLoc.includes(nBase) || nBase.includes(nLoc);
  const overlap = inter / Math.min(loc.size, ttl.size);
  const conf = Math.min(0.9, contained ? Math.max(overlap, 0.85) : overlap);
  return { conf, kind: conf > 0 ? "partial" : "none" };
}
