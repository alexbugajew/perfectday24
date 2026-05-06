# Top-33 City Rollout

## Zielbild

PerfectDay24 ist jetzt von den urspruenglichen 13 sichtbaren Planner-Staedten auf einen qualitaetsgesteuerten 33-Staedte-Pfad gewachsen.

Die sichtbare Planner-Auswahl wird dabei nicht einfach auf 33 gestellt. Stattdessen arbeiten wir mit drei Stufen:

- `full`: sichtbar und in allen Kernmodi belastbar
- `planner_ready`: sichtbar oder kurzfristig freigabereif fuer `classic` plus breite Eventmodi
- `prepared`: import- und auditbereit, aber noch nicht sichtbar

## Sichtbarkeits-Gates

Eine Stadt soll erst dann im Planner sichtbar werden, wenn sie diese Mindestwerte erreicht:

- mindestens `250` plannable Locations
- mindestens `120` Food-Locations (`restaurant` oder `cafe`)
- mindestens `12` geplante Events im Planner-Datenbestand
- aktive offizielle Eventquelle fuer stabile `show`, `event_visit` und `market_festival`-Modi

Diese Gates sind zentral in [rollout.ts](C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/lib/cities/rollout.ts) abgelegt und werden vom Visible-City-Audit mitgeprueft.

## Aktuell sichtbar

Aktuell sichtbar und im Planner freigeschaltet:

- Berlin
- Hamburg
- Muenchen
- Koeln
- Frankfurt am Main
- Stuttgart
- Duesseldorf
- Leipzig
- Dresden
- Hannover
- Nuernberg
- Bremen
- Dortmund
- Essen
- Bonn
- Muenster
- Mannheim
- Wiesbaden
- Aachen
- Karlsruhe
- Duisburg
- Bochum
- Wuppertal
- Bielefeld
- Augsburg
- Braunschweig
- Kiel

## Ziel-Liste 33

### Bestehender Kern

- Berlin
- Hamburg
- Muenchen

### Bereits ausgerollte Erweiterung

- Koeln
- Frankfurt am Main
- Stuttgart
- Duesseldorf
- Leipzig
- Dresden
- Hannover
- Nuernberg
- Bremen
- Dortmund

### Wave 1

- Essen
- Bonn
- Muenster
- Mannheim
- Wiesbaden
- Aachen
- Karlsruhe

### Wave 2

- Duisburg
- Bochum
- Wuppertal
- Bielefeld
- Augsburg
- Braunschweig
- Kiel

### Wave 3

- Gelsenkirchen
- Moenchengladbach
- Magdeburg
- Freiburg im Breisgau
- Luebeck
- Erfurt

## Operative Nutzung

### Einzelstadt importieren

```powershell
npm.cmd run locations:ingest:city -- --city=essen
```

### Bestehende Top-10-Erweiterung erneut ziehen

```powershell
npm.cmd run locations:ingest:top10
```

### Ganze 33er-Zielliste ziehen

```powershell
npm.cmd run locations:ingest:top33
```

### Nur vorbereitete Zusatzwellen ziehen

```powershell
npm.cmd run locations:ingest:top33 -- --scope=prepared
```

### Nur Wave 1 ziehen

```powershell
npm.cmd run locations:ingest:top33 -- --scope=wave1
```

## Empfehlung fuer den naechsten Schritt

Die 33er-Struktur steht damit jetzt nicht nur technisch, sondern mit einer voll freigeschalteten Wave 1, Wave 2 und Wave 3.

Der sichere operative Weg ab hier ist:

1. den jetzt sichtbaren 33er-Block im Live-Produkt beobachten
2. Planner-Qualitaet und Performance in den neuen Staedten nachziehen
3. semantische Restfaelle in spaeter freigeschalteten Wellen polieren
4. danach weitere Expansion nur noch ueber dieselben Qualitaets-Gates fahren

## Wave-1 Ops

Wave 1 umfasst:

- Essen
- Bonn
- Muenster
- Mannheim
- Wiesbaden
- Aachen
- Karlsruhe

Empfohlener Ablauf:

```powershell
npm.cmd run events:build
npm.cmd run check:rollout-scope -- --scope=wave1
npm.cmd run locations:ingest:top33 -- --scope=wave1
npm.cmd run check:rollout-scope -- --scope=wave1
```

Der Scope-Audit schreibt fuer jede Wave-1-Stadt:

- plannable Locations
- Food-Coverage
- Event-Bestand
- aktive offizielle Provider
- naechsten sinnvollen Ops-Schritt

Ergaenzend fuer den produktischen Planner-Check:

```powershell
npm.cmd run check:wave1-planner
```

Der Audit prueft pro sichtbarer Wave-1-Stadt:

- `show`
- `event_visit`
- `market_festival`
- finale Event-Anchor-Nutzung
- grobe Planner-Laufzeiten fuer Query + Generierung

Stand 21. April 2026:

- `7/7` Wave-1-Staedte sind `visibility-ready`
- Wave 1 ist im Planner sichtbar geschaltet

## Wave-2 Ops

Wave 2 umfasst:

- Duisburg
- Bochum
- Wuppertal
- Bielefeld
- Augsburg
- Braunschweig
- Kiel

Empfohlener Ablauf:

```powershell
npm.cmd run events:build
npm.cmd run locations:ingest:top33 -- --scope=wave2
npm.cmd run check:rollout-scope -- --scope=wave2
```

Empfohlene Reihenfolge nach dem Location-Import:

1. Augsburg
2. Kiel
3. Bielefeld
4. Braunschweig
5. Bochum
6. Duisburg
7. Wuppertal

Warum genau diese Reihenfolge:

- zuerst Staedte mit voraussichtlich klarerem Tourismus-/Stadtkalenderpfad und guter Innenstadtlogik
- danach Staedte mit starker Metropolnaehe oder breiter Eventchance, aber meist rauerer Semantik im offiziellen Kalender
- Wuppertal bewusst spaeter, weil dort die Stadtstruktur erfahrungsgemaess staerker ueber mehrere Teilzentren verteilt ist

Aktueller Stand:

- Augsburg ist jetzt als erste offizielle Wave-2-Quelle live
- Kiel ist jetzt als zweite offizielle Wave-2-Quelle live
- Bielefeld ist jetzt als dritte offizielle Wave-2-Quelle live
- Braunschweig ist jetzt als vierte offizielle Wave-2-Quelle live
- Bochum ist jetzt als fuenfte offizielle Wave-2-Quelle live
- Duisburg ist jetzt als sechste offizielle Wave-2-Quelle live
- Wuppertal ist jetzt als siebte offizielle Wave-2-Quelle live
- Wave 2 ist jetzt sichtbar geschaltet
- der aktuelle Wave-2-Scope steht damit bei `7/7 visibility-ready`
- der aktuelle Produktcheck steht bei `7/7` Staedten mit allen drei Flows gruen
- Wuppertal `market_festival` zieht im Mittagsmodus jetzt marktnaehere Anker statt spaeter Festival-/Clubfaelle

Der aktuelle Freigabestand fuer Wave 2 ist jetzt:

- alle 7 Staedte stehen auf `planner_ready`
- alle 7 Staedte sind im Planner sichtbar
- die naechste Absicherung liegt jetzt bei Produktqualitaet und Performance, nicht mehr bei der Quellenvorbereitung

Der operative Produktcheck fuer die sichtbaren Wave-2-Staedte laeuft ueber:

```bash
npm.cmd run check:wave2-planner
```

## Wave-3 Ops

Wave 3 umfasst:

- Gelsenkirchen
- Moenchengladbach
- Magdeburg
- Freiburg im Breisgau
- Luebeck
- Erfurt

Empfohlener Ablauf:

```powershell
npm.cmd run events:build
npm.cmd run locations:ingest:top33 -- --scope=wave3
npm.cmd run check:rollout-scope -- --scope=wave3
```

Ergaenzender Backfill, wenn einzelne Staedte location-seitig schon stark sind, aber Food knapp bleibt:

```powershell
npm.cmd run locations:ingest:city -- --city=moenchengladbach --focus=food --publishLimit=50
```

Aktueller Stand vom 24. April 2026:

- Gelsenkirchen: `635` Locations, `279` Food
- Moenchengladbach: `578` Locations, `219` Food
- Gelsenkirchen ist jetzt als sechste offizielle Wave-3-Quelle live ueber den offiziellen Stadtkalender mit Detailseiten und ICS-Export
- der offizielle Ingest lief mit `138 raw / 93 normalisiert`
- `show`, `event_visit` und `market_festival` sind jetzt plannerseitig verifiziert
- Moenchengladbach ist jetzt als fuenfte offizielle Wave-3-Quelle live ueber den offiziellen `?type=420`-Feed der Stadt
- der offizielle Ingest lief mit `757 raw / 757 normalisiert`
- `show`, `event_visit` und `market_festival` sind jetzt plannerseitig verifiziert
- Magdeburg: `458` Locations, `266` Food
- Magdeburg ist jetzt als vierte offizielle Wave-3-Quelle live ueber den offiziellen RSS-Export `Veranstaltungsexport.xml` plus konkrete Event-Detailseiten
- der offizielle Ingest lief mit `64 raw / 64 normalisiert`
- `show`, `event_visit` und `market_festival` sind jetzt plannerseitig verifiziert
- Freiburg im Breisgau: `621` Locations, `280` Food
- Freiburg ist jetzt als erste offizielle Wave-3-Quelle live und plannerseitig fuer `show`, `event_visit` und `market_festival` verifiziert
- Luebeck: `487` Locations, `256` Food
- Luebeck ist jetzt als zweite offizielle Wave-3-Quelle live ueber den offiziellen Datacycle-Endpoint der Veranstaltungsseite plus Detailseiten mit JSON-LD fuer Venue, Geo und `eventSchedule`
- Luebeck ist plannerseitig fuer `show`, `event_visit` und `market_festival` verifiziert
- Erfurt: `468` Locations, `253` Food
- Erfurt ist jetzt als dritte offizielle Wave-3-Quelle live ueber den offiziellen TYPO3-Kalender
- der aktuelle Re-Ingest lief mit `168 raw / 168 normalisiert`
- `show`, `event_visit` und `market_festival` sind jetzt plannerseitig verifiziert
- `6/6 visibility-ready`
- Wave 3 ist jetzt im Planner sichtbar geschaltet
- der aktuelle sichtbare Produktstand liegt damit bei `33` Planner-Staedten

Das ist fuer Wave 3 jetzt der erreichte Live-Stand:

- die Location-/Food-Basis steht jetzt fuer alle 6 Staedte
- Mönchengladbach hat den noetigen Food-Backfill bereits bekommen
- der naechste Engpass ist nicht mehr OSM/Seed-Coverage, sondern Produktqualitaet und Performance im 33er-Block
- mit Freiburg, Luebeck, Erfurt, Magdeburg, Moenchengladbach und Gelsenkirchen sind jetzt alle sechs Wave-3-Staedte eventseitig live angebunden und sichtbar

Der aktuelle Scope-Report ist:

- [planner-rollout-wave3-audit-2026-04-24T07-07-05-017Z.md](C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/reports/planner-rollout-wave3-audit-2026-04-24T07-07-05-017Z.md)
- [planner-visible-city-audit-2026-04-24T07-08-56-527Z.md](C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/reports/planner-visible-city-audit-2026-04-24T07-08-56-527Z.md)
