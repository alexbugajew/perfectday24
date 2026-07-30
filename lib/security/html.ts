// lib/security/html.ts
// HTML-Escaping für serverseitig zusammengebaute Templates (v. a. E-Mails).
// React escaped JSX automatisch — diese Helper sind für die Stellen gedacht,
// an denen HTML per String-Interpolation entsteht und dieser Schutz fehlt.

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escaped alle HTML-Metazeichen. Für Text, der in einen Element-Body oder in
 * ein Attribut (in Anführungszeichen) interpoliert wird.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] ?? char);
}

/**
 * Escaped und begrenzt gleichzeitig die Länge — für Freitextfelder aus
 * Nutzereingaben, die in Mails landen. Zeilenumbrüche werden zu <br>.
 */
export function escapeHtmlMultiline(value: unknown, maxLength = 2000): string {
  const truncated = String(value ?? "").slice(0, maxLength);
  return escapeHtml(truncated).replace(/\r?\n/g, "<br>");
}
