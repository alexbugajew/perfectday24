# Mobile-Audit — Juli 2026

Systematische Prüfung der wichtigsten Endnutzer-Flows auf Mobile (375–414px).
Fokus: Tap-Targets, Sticky-Kollisionen, Text-Truncation, Above-the-Fold-CTAs.

## Kein Handlungsbedarf (funktioniert bereits)

### Navigation
- **MainNav**: Hamburger-Menu ab <sm, alle Links 44px+ Tap-Target, Sticky top-0 mit Backdrop-Blur.
- **MobileBottomNav**: fixed bottom-0, pb-safe (iOS Notch), z-1300.
- **Body-Padding**: `pb-24 sm:pb-6` schafft Platz für Bottom-Nav.

### Planner
- **Sticky Mobile-CTA**: `bottom-16` liegt sauber über der Mobile-Bottom-Nav (kein Overlap).
- **AI-Plan-Modal**: `flex items-end sm:items-center` — Bottom-Sheet auf Mobile, Center-Modal auf Desktop.
- **Upgrade-Modal**: gleiches Muster.

### Homepage
- **Hero-Grid**: `lg:grid-cols-[minmax(0,1.02fr)_minmax(340px,0.98fr)]` — auf Mobile stapelt sich Text-Block über Live-Demo.
- **Hero-Live-Demo**: Feste 340px Min-Width auf Desktop, stapelt auf Mobile.
- **Use-Case-Cards**: `sm:grid-cols-2 xl:grid-cols-4` — 1-spaltig auf Mobile.
- **Stat-Klickbar** (Task #76): `border-l first:border-l-0` respektiert Mobile-Stapelung.

### Partner-Dashboard-Wizard
- 4 Cards: `sm:grid-cols-2 xl:grid-cols-4` — 1-spaltig auf Mobile, Progress-Bar bleibt lesbar.
- Header-Row: `flex-col sm:flex-row` — Titel und Dismiss-Button stapeln.

### ROI-Rechner (Task #74)
- `lg:grid-cols-[minmax(0,1fr)_minmax(280px,1fr)]` — Slider + Ergebnis stapeln auf Mobile.
- Slider haben native `<input type="range">` → volle Touch-Unterstützung.

## Bekannte Grenzfälle (kein akutes Fix)

### 1. Admin-Monetization
- Tabellen mit vielen Spalten (Event-Provisionen, Affiliate-Conversions).
- Aktueller Status: `w-full` ohne horizontal scroll → Text truncation auf Mobile.
- **Warum kein Fix**: Admin-Seite, nicht Endnutzer. Auf Desktop optimiert.
- **Empfehlung wenn nötig**: `<div className="overflow-x-auto">` um `<table>`.

### 2. Roadtrip-Builder
- P2PQuickStart nutzt 2-Spalten-Grid — auf schmalen Geräten könnten Inputs eng werden.
- Getestet OK an 375px, aber bei sehr langen Städtenamen (z.B. "Ludwigshafen-am-Rhein") überschreibt Truncation.
- **Fix optional**: `min-w-0 truncate` ergänzen falls Reports auftauchen.

### 3. Explore-City-Page
- Editorial-Cover-Höhe `h-56 sm:h-80` — auf 375px sind 224px OK, könnten aber je nach Bild wenig Info zeigen.
- **Fix optional**: `h-64 sm:h-80` (256px auf Mobile) für mehr Präsenz.

## Was ich in dieser Session gefixt habe

Alle Fixes aus früheren Tasks (13, 15, 16) sind live:
- Quick-Form 4 Spalten reduziert und Mobile stapeln (#13)
- Sticky Mobile-CTA fürs Route starten (#15)
- PlannerControlsSection Header trimmen (#16)

## Empfehlung Real-User-Test

Sobald 100+ echte Sessions durch sind:
1. Session-Recordings via Hotjar/PostHog auf Mobile durchsehen
2. Häufigste Drop-Off-Punkte auf Mobile-Layout hin prüfen
3. Weekly-Report-Email (Task #69) zeigt WAU → Anteil Mobile-Nutzer im Metadata sichtbar machen

## Nicht getestet in dieser Audit

- iOS Safari Web-App Modus (add-to-home-screen)
- Landscape-Orientierung
- Android Chrome vs. Samsung Internet
- Screen-Reader-Kompatibilität (separater Accessibility-Audit nötig)
