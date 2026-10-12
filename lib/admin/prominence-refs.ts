// Prominenz-Backfill: Nie-absenken-Regel und umkehrbare source_refs-Einträge.
// ============================================================================
// Ausgelagert aus scripts/backfill-attraction-prominence.ts, weil die beiden
// Sicherheitszusagen des Backfills Unit-Tests brauchen (das Skript selbst
// verbindet sich beim Import mit der Live-DB):
//
// 1. popularity_score wird nie abgesenkt. In Seed-Städten trägt jeder Ort den
//    Standard 40 aus pd24_publish_manual_seed (München 918/918) — 40 ist dort
//    der neutrale Sockel „keine Information". Ein Wikipedia-Score darunter
//    (Heimatmuseum mit wenigen Aufrufen ≈ 16) ist kein Negativsignal; ihn hart
//    zu schreiben, würde bekannte Orte unter anonyme OSM-Orte drücken.
// 2. Jeder Write ist umkehrbar: Der Eintrag trägt den Wert VOR dem ersten
//    Backfill-Lauf (previous_popularity_score), auch wenn im selben Lauf erst
//    der Auto-Matcher und danach der Flaggschiff-Patch schreibt.

export type ProminenceSource = "wikipedia" | "manual_flagship";

export type ProminenceEntry = {
  prominence_source: ProminenceSource;
  /** Roh berechneter Wert (Wikipedia-Formel bzw. Flaggschiff-Mindestwert), vor der Nie-absenken-Regel. */
  prominence_score: number;
  /** popularity_score vor dem ersten Backfill-Write — Zielwert fürs Zurückrollen. */
  previous_popularity_score: number | null;
  wikidata_id: string | null;
  matched_title: string;
  sitelinks: number;
  pageviews_monthly: number;
};

// Restaurant, Café und Bar haben im Ranker eigene Signale; popularity_score
// wirkt dagegen anlass-blind in jedem Slot. Ein Boost für eine Touristen-
// Bierhalle würde sie in jeden Essens-Slot heben — deshalb wird Gastronomie
// vom Prominenz-Backfill grundsätzlich nicht angefasst.
export const GASTRONOMY_CATEGORIES: ReadonlySet<string> = new Set(["restaurant", "cafe", "nightlife"]);

/**
 * Darf ein Flaggschiff-Treffer geboostet werden? Nur in der erwarteten
 * Kategorie (gleicher Name heißt nicht gleicher Ort) und nie in der
 * Gastronomie — auch dann nicht, wenn jemand sie als erwartet einträgt.
 */
export function isBoostableCategory(category: string | null | undefined, expected: readonly string[]): boolean {
  if (!category || GASTRONOMY_CATEGORIES.has(category)) return false;
  return expected.includes(category);
}

function isProminenceEntry(candidate: unknown): candidate is Record<string, unknown> {
  return Boolean(candidate && typeof candidate === "object" && "prominence_source" in (candidate as object));
}

export function findProminenceEntry(refs: unknown): Record<string, unknown> | null {
  const entries = Array.isArray(refs) ? refs : refs && typeof refs === "object" ? [refs] : [];
  for (const entry of entries) if (isProminenceEntry(entry)) return entry;
  return null;
}

export function hasProminenceEntry(refs: unknown): boolean {
  return findProminenceEntry(refs) !== null;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Neuer popularity_score nach der Nie-absenken-Regel. null zählt wie 0, weil
 * der Ranker (popularityBoost) beides gleich behandelt.
 */
export function raisePopularity(current: unknown, computed: number): { previous: number; next: number; raised: boolean } {
  const previous = finiteOrNull(current) ?? 0;
  const next = Math.max(previous, computed);
  return { previous, next, raised: next > previous };
}

/**
 * Ursprungswert fürs Zurückrollen: Gibt es schon einen Prominenz-Eintrag
 * (früherer Lauf oder Auto-Match vor dem Flaggschiff-Patch), steht der echte
 * Ausgangswert dort — sonst würde ein Rollback nur bis zum Zwischenstand gehen.
 */
export function originalPopularity(refs: unknown, current: unknown): number | null {
  const existing = findProminenceEntry(refs);
  if (existing && "previous_popularity_score" in existing) return finiteOrNull(existing.previous_popularity_score);
  return finiteOrNull(current);
}

/**
 * Prominenz-Eintrag in source_refs mergen. Es gibt höchstens EINEN Eintrag pro
 * Ort (ein bestehender wird ersetzt), damit das Zurückrollen genau ein Element
 * entfernen muss; fremde Einträge (Seeds, Adressen, Fotos) bleiben unangetastet.
 * Ein Einzelobjekt wird wie beim Foto-Upload zum Array, statt die Prominenz-
 * Felder hineinzumischen — sonst könnte z. B. ein vorhandenes wikidata_id
 * überschrieben werden.
 */
export function mergeProminenceEntry(refs: unknown, entry: ProminenceEntry): unknown[] {
  if (Array.isArray(refs)) return [...refs.filter((existing) => !isProminenceEntry(existing)), entry];
  if (refs && typeof refs === "object") return isProminenceEntry(refs) ? [entry] : [refs, entry];
  return [entry];
}
