# Top-10-Staedte-Rollout

## Ziel

Die naechsten 10 deutschen Staedte sollen ueber denselben Basis-Import wie Berlin, Hamburg und Muenchen gezogen werden, damit der Planner schnell in mehr Maerkten testbar wird.

## Enthaltene Staedte

1. `koeln`
2. `frankfurt-am-main`
3. `stuttgart`
4. `duesseldorf`
5. `leipzig`
6. `dresden`
7. `hannover`
8. `nuernberg`
9. `bremen`
10. `dortmund`

## Technischer Pfad

- gemeinsame Stadtbasis ueber [ingest-city-location-seeds.ts](C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/scripts/ingest-city-location-seeds.ts)
- Bulk-Rollout ueber [ingest-top10-city-rollout.ts](C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/scripts/ingest-top10-city-rollout.ts)
- gezielter Food-Backfill ueber denselben Importpfad mit `--focus=food`
- Startbefehl:

```powershell
npm.cmd run events:build
npm.cmd run locations:ingest:top10 -- --publishLimit=10
```

- Food-Backfill fuer einzelne Staedte:

```powershell
npm.cmd run locations:ingest:food-backfill -- --city=stuttgart --radius=16000 --publishLimit=50
npm.cmd run locations:ingest:food-backfill -- --city=dortmund --radius=17000 --publishLimit=50
```

## Was der Rollout heute leistet

- OSM-/Nominatim-basierte Seeds fuer Food, Culture, Nightlife und Activity
- Kuratierung und Publish ueber den bestehenden `location_manual_seeds`-Pfad
- Dedupe auf `locations`

## Was noch nicht Teil dieses Schritts ist

- offizielle Eventquellen pro Stadt
- planner-spezifische Live-Checks je neuer Stadt
- Qualitaetsfreigabe fuer `date + show`, `friends + event_visit`, `tourism + market_festival`

## Nächste Folgearbeit nach dem Import

1. Food-/Culture-/Nightlife-Bestand pro Stadt pruefen
2. `check:quality` fuer die neuen Staedte erweitern
3. offizielle Eventquellen stadtweise aufbauen
4. Kernflows je Stadt gegentesten
