# Site-Audit 08/2026 (Re-Audit nach Design-Runde 07/2026)

Stand: 03.08.2026 · Methodik: DOM-Messungen (Kontrast per WCAG-Formel, Tap-Targets,
Overflow) auf 375px und Desktop gegen den lokalen Dev-Server (= deployter Stand
9e506ee), Server-HTML-Checks, Live-Checks gegen www.perfectday24.de per curl.

## Ergebnis in einem Satz

Die im Juli behobenen Systemprobleme (Kupfer-Kontrast, Tap-Targets, ASCII-Umlaute,
hartcodierte Reichweiten-Zahlen) sind sitewide sauber; kritisch ist aktuell nur
noch das **Preview-Gate in Produktion**, das alle Teil-Links (Einladung, Plan,
Route) für Gäste und Link-Crawler blockiert.

## Befunde

### 1. KRITISCH — Preview-Lock blockiert Teil-Links und OG-Vorschauen (Launch-Entscheidung)

`proxy.ts` leitet in Produktion jeden Request ohne Preview-Cookie auf
`/preview-login` um (307). Ausgenommen sind nur Assets und der Login selbst.
Folgen, solange das Gate aktiv ist:

- Gäste können Einladungs-Links (`/events/agenda/[token]`), geteilte Pläne
  (`/p/[token]`) und Routen-Links nicht öffnen.
- WhatsApp/Mail-Crawler bekommen den 307 → keine individuelle Link-Vorschau,
  obwohl Metadata + OG-Bilder implementiert und lokal verifiziert sind.

Empfehlung (nicht umgesetzt, Entscheidung Alex): Entweder Preview-Lock
deaktivieren (Launch) oder in `PUBLIC_PATH_PREFIXES` gezielt freigeben:
`/events/agenda`, `/p`, `/routes` (inkl. deren `opengraph-image`-Unterpfade).
Achtung: Freigabe von `/routes` macht den Routen-Katalog öffentlich.

### 2. Behoben im Zuge dieses Audits

- `/partner`: Kicker „Jetzt starten" im dunklen CTA-Panel rendertee durch das
  CSS-Layer-Verhalten (un-gelayerte `.pd24-kicker-warm` schlägt Tailwind-
  Utilities) in Warm-Ink auf Dunkel (3,2:1) → explizite helle Utilities.
- Homepage „Event Flow"-Kicker: totes Grün-Override entfernt bzw. Grün jetzt
  wirksam; totes Override bei „Für Anbieter" bereinigt.

Merkregel für künftige Flächen: `.pd24-kicker`/`.pd24-kicker-warm` nie mit
`text-*`-Utilities kombinieren — auf abweichenden Hintergründen explizite
Utilities verwenden.

### 3. Messwerte (mobil 375px)

| Seite | Overflow | Tap-Targets <36px | Kontrast-Verstöße |
|---|---|---|---|
| / | 0 | 0 | 0 (1 Scrim-False-Positive) |
| /planner | 0 | 0 (nur 1px-Hilfsinput) | 0 |
| /partner | 0 | 0 | 0 (nach Fix) |
| /events, /explore, /routes, /roadtrip | 0 | Stand 31.07. sauber; Client-Render im Headless-Pane nicht erneut messbar (Suspense-Artefakt), Code seitdem unverändert | — |

Konsole fehlerfrei; Einladungs-OG (81 kB) und Routen-OG rendern.

### 4. Kleinere offene Punkte (nicht behoben, geringe Priorität)

- **Heading-Semantik:** kein `<h1>` im SSR-HTML von `/planner`, `/routes`,
  `/roadtrip`, `/saved`, `/profile`; doppeltes `<h1>` auf `/explore`. Relevant
  v. a. für die indexierbaren Seiten (SEO), App-Seiten unkritisch.
- **OG-Bildgröße Routen:** Cover-basierte OG-PNGs werden groß (Beispiel JGA
  München ≈ 1,6 MB, da Foto als PNG re-encodiert). Funktioniert, aber für
  Crawler-Latenz unschön; Option: Cover direkt als og:image referenzieren
  (JPEG) statt durchs ImageResponse-PNG zu schleusen.
- **Statische OG-Defaults:** Root-Layout und Partner-Seite nutzen Unsplash-URLs
  als og:image — externe Abhängigkeit; könnte auf eigene ShareCard umgestellt
  werden.
- **Partner-Seite Gewicht:** 134 kB HTML, sehr viele Unsplash-Referenzen
  (next/image optimiert, aber die Seite ist die schwerste Marketing-Fläche).
- ROI-Rechner: drei beschriftungslose 16px-Inputs (Slider-Zeilen) — a11y-Label
  prüfen.

### 5. Offene To-dos aus der Juli-Runde

- SQL-Migration `20260731120000_event_plan_cover_image.sql` im Supabase-SQL-
  Editor ausführen (Titelbild-Upload + KI-Bild-Button erscheinen erst danach).
- KI-Text/Bild-Generierung Ende-zu-Ende mit eingeloggtem Account testen.
- WhatsApp-Vorschau nach Freigabe der Teil-Links mit frischem Link testen
  (WhatsApp cacht Vorschauen aggressiv).
