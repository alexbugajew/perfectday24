// Gemeinsame Signale für Gedenkorte (Mahnmale, KZ-Gedenkstätten, Friedhöfe).
//
// Produktentscheidung 24.09.: Gedenkorte dürfen bei tourism/Kultur als würdiger,
// korrekt betitelter Stop erscheinen (viele besuchen z.B. das Holocaust-Mahnmal
// bewusst) — aber NIE als fröhlicher Anker/Peak/Highlight und nie in den
// Spaß-Anlässen (market_festival/party/date). Auslöser: Der Planner bot am
// 19.10. für Berlin das "Denkmal für die ermordeten Juden Europas" als
// "Markt / Festival"-Höhepunkt an.
//
// Eine Quelle für die Marker, geteilt von events.ts (Kategorie-Refinement),
// features.ts (isSolemnMemorialCandidate) und market-festival.ts (Eignung).

export const MEMORIAL_MARKERS = [
  "gedenk",
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
  "euthanasie",
  "opfer des nationalsozialismus",
  "trauerfeier",
  "kriegsgraeber",
  "kriegsgräber",
] as const;

// OSM-/Taxonomie-Subtypes, die einen Ort als Gedenkort ausweisen. Bewusst OHNE
// das zu breite "monument" (viele neutrale Kulturdenkmäler) — nur klar solemne
// Signale.
export const SOLEMN_MEMORIAL_SUBTYPES = [
  "memorial",
  "cemetery",
  "grave_yard",
  "war_memorial",
  "mass_grave",
] as const;

/** Trägt der Text (Titel/Name/Beschreibung) ein Gedenk-Signalwort? */
export function textHasMemorialMarker(text: string | null | undefined): boolean {
  const value = (text ?? "").toLowerCase();
  if (!value.trim()) return false;
  return MEMORIAL_MARKERS.some((marker) => value.includes(marker));
}
