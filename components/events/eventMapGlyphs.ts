// components/events/eventMapGlyphs.ts
//
// Kleine Strich-Symbole je Kartengruppe — als SVG-Strings, weil Leaflet-Pins
// (L.divIcon) HTML erwarten und keine React-Elemente. Die Filter-Chips nutzen
// dieselben Strings, damit Pin und Chip sichtbar zusammengehören.
//
// Die Farben der Palette liegen nah beieinander; erst das Symbol macht einen
// Konzert-Pin von einem Fest-Pin unterscheidbar.

import type { EventMapGroupKey } from "@/lib/events/event-map";

const GLYPH_PATHS: Record<EventMapGroupKey, string> = {
  // Marktstand mit Markise
  maerkte: '<path d="M4 10h16l-1.6-5H5.6z"/><path d="M5.5 10v9h13v-9"/><path d="M10 19v-5h4v5"/>',
  // Stern für Feste
  feste: '<path d="M12 3.5l2.5 5.3 5.8.7-4.3 4 1.1 5.8L12 16.4l-5.1 2.9 1.1-5.8-4.3-4 5.8-.7z"/>',
  // Notenpaar
  konzerte: '<path d="M9 17.5V5.5l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/>',
  // Eintrittskarte
  shows:
    '<path d="M3.5 8.5a2 2 0 0 0 2-2h13a2 2 0 0 0 2 2v7a2 2 0 0 0-2 2h-13a2 2 0 0 0-2-2z"/><path d="M13.5 7v2M13.5 11v2M13.5 15v2"/>',
  // Bild im Rahmen
  ausstellungen: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-4.5-4.5-8.5 8"/>',
  // Besteck
  food: '<path d="M7 3.5v17"/><path d="M4.5 3.5v4.5a2.5 2.5 0 0 0 5 0V3.5"/><path d="M17 20.5v-17c-2 1-3 3.5-3 6.5v3h3"/>',
  // Kalenderblatt
  sonstiges: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
};

export function eventMapGlyphSvg(group: EventMapGroupKey, size: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    `${GLYPH_PATHS[group]}</svg>`
  );
}
