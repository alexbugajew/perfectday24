# City Playbook fuer neue Staedte

## Ziel

Neue Staedte sollen nicht einfach "irgendwie live" gehen, sondern denselben Qualitaetsstandard wie Berlin, Hamburg und Muenchen erreichen.

## Phase 1: Stadtbasis

1. Stadt in der City-Tabelle anlegen oder pruefen
2. Zentrum / brauchbaren Startpunkt definieren
3. `locations:ingest:city` fuer die Stadt ausfuehren
4. Food-/Nightlife-/Culture-Bestand grob pruefen

## Phase 2: Eventquellen

1. Ticketmaster testen
2. offizielle Stadtquellen recherchieren
3. saisonale Quellen fuer Maerkte/Festivals ergaenzen
4. Venue-/Geo-Enrichment nachziehen

## Phase 3: Datenqualitaet

1. Dedupe-/Qualitaetslogik laufen lassen
2. `npm run check:quality`
3. pruefen:
   - genug Food-Locations
   - genug plannable locations
   - genug anchored events
   - genug flex events

## Phase 4: Produktcheck

Folgende Kernflows muessen einmal gezielt geprueft werden:

- `date + show + evening`
- `friends + event_visit + evening`
- `tourism + market_festival + midday`

Danach:

- `npm run regression:core-cities` erweitern oder neue Stadtfaelle vorbereiten
- Live-Checks fuer die Stadt dokumentieren

## Qualitaetskriterien fuer "stadtbereit"

- brauchbarer Restaurant-/Cafe-Bestand
- mindestens eine gute Show-/Theater-/Konzertquelle
- mindestens eine gute Markt-/Festivalquelle
- keine sichtbaren Dublettenprobleme
- Kernflows liefern keine peinlichen Fallbacks

## Rollout-Empfehlung

Nicht direkt 100 Staedte.

Sinnvoller Ausbau:

1. Top 10 bis 15 deutsche Staedte
2. danach weitere grosse Staedte mit guter Eventlage
3. danach DACH-Ausweitung

## Empfohlene naechste Staedte

- Koeln
- Frankfurt
- Stuttgart
- Duesseldorf
- Leipzig
- Dresden
- Hannover
- Nuernberg
- Bremen
- Dortmund
