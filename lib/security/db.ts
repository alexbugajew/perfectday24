// lib/security/db.ts
// Kleine Helfer, um Nutzereingaben sicher in Supabase-/PostgREST-Queries zu
// verwenden. PostgREST parametrisiert Werte, deshalb geht es hier nicht um
// SQL-Injection, sondern um zwei andere Effekte:
//   - `%` und `_` sind LIKE-Wildcards: `q=%` erzwingt einen Full-Table-Scan
//   - `,` `(` `)` `.` haben in PostgREST-Filterausdrücken Sonderbedeutung

/** Entschärft LIKE-Wildcards und PostgREST-Filter-Metazeichen. */
export function escapeLikePattern(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/[,()]/g, " ")
    .trim();
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True für kanonische UUIDs. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * Filtert eine Client-Liste auf gültige UUIDs und begrenzt ihre Länge.
 * Verhindert, dass eine Anfrage mit zehntausenden IDs die DB belastet.
 */
export function sanitizeUuidList(value: unknown, maxItems = 50): string[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  for (const entry of value) {
    if (isUuid(entry)) unique.add(entry);
    if (unique.size >= maxItems) break;
  }
  return [...unique];
}
