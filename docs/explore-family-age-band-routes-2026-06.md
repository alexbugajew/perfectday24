# Explore Family Age-Band Routes

## Ziel

Vier `Explore`-Routen, jeweils klar auf ein Familien-Altersband zugeschnitten und bewusst nicht vermischt.

## Route Cards

### 1. Frankfurt / 0-6 Jahre

- Titel: `Familienroute 0-6: Wasser, Gruen & ruhige Pausen`
- Hook: `Ein stressarmer Familien-Tag mit Spiel, Wasser und genug Luft fuer spontane Pausen.`
- Stops:
  1. `Palmengarten`
  2. `Palmengarten Wasserspielplatz & Minigolf`
  3. `Wasserspielanlage im Guenthersburgpark`
  4. `Junges Museum Frankfurt` als Regen-/Ruheoption
- Explore-CTA:
  - `Route ansehen`
  - `Ideal fuer 0-6 Jahre`
  - `Wenig Reibung, viel Flexibilitaet`

### 2. Muenchen / 4-10 Jahre

- Titel: `Familienroute 4-10: Tiere, Technik & Mitmachen`
- Hook: `Erst Tiere und Bewegung, danach Mitmach-Technik und Forscherenergie.`
- Stops:
  1. `Tierpark Hellabrunn`
  2. `Muehlendorf Streichelanlage Hellabrunn`
  3. `Deutsches Museum`
  4. `Kinderreich im Deutschen Museum`
- Explore-CTA:
  - `Route ansehen`
  - `Ideal fuer 4-10 Jahre`
  - `Starker Mix aus Zoo und Mitmachwelt`

### 3. Hamburg / 9-14 Jahre

- Titel: `Familienroute 9-14: Miniatur, VR & Sterne`
- Hook: `Detail-Wow, Technik, VR und Planetarium statt zu kindlicher Familienlogik.`
- Stops:
  1. `Miniatur Wunderland`
  2. `YULLBE WUNDERLAND`
  3. `Planetarium Hamburg`
  4. `Das Geheimnis der Papierrakete`
- Explore-CTA:
  - `Route ansehen`
  - `Ideal fuer 9-14 Jahre`
  - `Technik, Immersion und echter Wow-Faktor`

### 4. Berlin / 12-16 Jahre

- Titel: `Familienroute 12-16: Future, Street Art & Sunset`
- Hook: `Eine teen-gerechte Berlin-Route mit Zukunft, urbaner Kultur und freiem Ausklang.`
- Stops:
  1. `Futurium`
  2. `Family Open Lab im Futurium`
  3. `URBAN NATION Museum`
  4. `Tempelhofer Feld`
- Explore-CTA:
  - `Route ansehen`
  - `Ideal fuer 12-16 Jahre`
  - `Mehr Eigenstaendigkeit, weniger Kinderroute`

## Seed-Datei

- Datei: `data/editorial_routes/family-explore-age-bands-2026-06.json`
- Script-Alias: `npm run routes:ingest:editorial:family-explore`

## Seed-Schema

- `citySlug`: Zielstadt fuer Explore und Import
- `slug`: stabile Route-URL
- `title`: Explore-Card-Titel
- `description`: Hook + Alterslogik fuer Filter und Verstaendnis
- `tags`: muss `family` und das Altersband tragen
- `sourceUrls`: nur offizielle Quellen
- `stops[]`: kuratierte Reihenfolge mit kurzer redaktioneller Note

## Einspiel-Tickets

### Ticket 1: Family Explore Routes importieren

- Ziel: Die vier Age-Band-Routen in `user_routes` und `user_route_stops` einspielen.
- Command dry-run:

```bash
npm run routes:ingest:editorial:family-explore
```

- Command import:

```bash
npm run routes:ingest:editorial:family-explore -- --commit --creator-username=pd24-editorial --geocode-missing
```

- Akzeptanz:
  - 4 Routen angelegt oder aktualisiert
  - jede Route hat 4 Stops
  - keine Route ohne `family`-Tag
  - `description` enthaelt das jeweilige Altersband

### Ticket 2: Cover- und Stop-Bilder fuer Explore nachziehen

- Ziel: Jede Route soll in Explore visuell sofort nach Familien-Alterslogik differenziert sein.
- Arbeit:
  - Cover fuer `0-6`: Wasser, Gruen, Kleinkindenergie
  - Cover fuer `4-10`: Tiere oder Mitmach-Szene
  - Cover fuer `9-14`: Technik/Immersion
  - Cover fuer `12-16`: urban, teen, frei
- Akzeptanz:
  - 4 Cover gesetzt
  - keine generischen Stockbilder ohne Altersbezug
  - Route Cards lassen sich schon im Grid klar unterscheiden

### Ticket 3: Explore-QA auf Filter, Copy und Erwartung

- Ziel: Sicherstellen, dass die Routen in Explore sauber gefunden und verstanden werden.
- Pruefen:
  - `Familie`-Filter zeigt alle 4 Routen
  - Texte kommunizieren das Altersband klar
  - `0-6` wirkt nicht wie `9-14`
  - `12-16` wirkt nicht kindlich
- Akzeptanz:
  - alle 4 Routen im Family-Filter sichtbar
  - keine Route hat austauschbare oder falsche Alters-Copy
  - Reihenfolge und Hook sind mobil wie desktop klar

### Ticket 4: Optionaler Folgeausbau je Stadt

- Ziel: Aus den vier Leit-Routen spaeter je Altersband mehrere Alternativen machen.
- Beispiele:
  - `0-6` Regenvariante
  - `4-10` Outdoor-/Wintervariante
  - `9-14` Science- vs. Action-Variante
  - `12-16` Urban- vs. Event-Variante
- Akzeptanz:
  - jede Altersgruppe bekommt mittelfristig mindestens 2 Explore-Optionen
