# Location Manual Seeds

## Ziel

`location_manual_seeds` ist die kuratierte High-Value-Quelle fuer Orte, die in OSM oder im automatischen Enrichment zu schwach, zu verrauscht oder gar nicht vorhanden sind.

Die Seeds sollen zuerst Berlin und Hamburg in den kritischen Occasion-Luecken verbessern:

- `family`
- `friends`
- `date`
- `party`

## Tabelle

Migration:

- `supabase/migrations/20260325110000_location_manual_seeds.sql`

CSV-Vorlage:

- `data/location_manual_seeds_template.csv`

## Felder

- `city_slug`: z. B. `berlin-berlin`
- `name`: kanonischer Ortsname
- `category`: `restaurant`, `cafe`, `activity`, `culture`, `nightlife`, `event`
- `type`: bestehender oder passender Roh-Typ, z. B. `zoo`, `bar`, `nightclub`, `viewpoint`
- `subtypes`: planner-relevante Taxonomie
- `audiences`: typische Zielgruppen
- `occasions`: Occasion-Fit fuer Retrieval
- `lat`, `lng`: bevorzugt immer fuellen
- `website`, `reservation_url`: produktrelevant fuer Trust und spaeter Monetarisierung
- `price_level`, `budget`: schnell nutzbare Preis-Signale
- `indoor_outdoor`, `energy_level`: starke Planner-Signale
- `family_friendly`, `nightlife_fit`: harte Retrieval-Signale
- `duration_min`: Default-Aufenthaltszeit
- `manual_boost`: kuratierte Priorisierung
- `data_confidence`: fuer Seeds in der Regel `0.95+`
- `source_primary`: standardmaessig `manual_seed`
- `import_batch`: z. B. `berlin_v1`, `hamburg_v1`
- `notes`: Freitext fuer Curation-Hinweise

## Empfohlene Seed-Prioritaeten

### Berlin

- Zoo
- Aquarium
- Playground
- Viewpoint
- Bowling
- Nightclub
- Disco
- Rooftop / Rooftop Bar
- Children Museum / Science Center
- Lasertag / Climbing / Workshops

### Hamburg

- Zoo
- Aquarium
- Playground
- Viewpoint
- Bowling
- Nightclub / Disco
- Rooftop / Promenade
- Children Museum / Science Center
- Water Park / Family Highlights

## Empfohlener Importablauf

1. CSV lokal pflegen
2. in `location_manual_seeds` laden
3. Seeds gegen bestehende `locations` deduplizieren
4. bei Match: `subtypes`, `audiences`, `occasions`, `manual_boost`, `website` anreichern
5. ohne Match: als neue `locations` publizieren

## Publish-Pfad

Migration:

- `supabase/migrations/20260325113000_location_manual_seed_publish.sql`

Wichtige Funktionen:

- `pd24_seed_match_location(seed_id, max_distance_m)`
- `pd24_publish_manual_seed(seed_id, max_distance_m)`
- `pd24_publish_manual_seed_batch(city_slug, import_batch, limit, max_distance_m)`

Logik:

- exakter Match zuerst ueber `city_slug + name + type`
- danach Fallback ueber `city_slug + name + Geo-Distanz`
- bei Match wird bestehende `location` angereichert
- ohne Match wird eine neue `location` mit `source_primary = manual_seed` erzeugt
- `location_manual_seeds` speichert danach `published_location_id`, `publish_status`, `published_at`

Beispiel:

```sql
select * from public.pd24_publish_manual_seed_batch('berlin-berlin', 'berlin_v1', 25, 250);
```

## CSV-Import

Kleines lokales Importskript:

- `importer/import_manual_seeds.py`

Beispiel:

```bash
python importer/import_manual_seeds.py --csv data/location_manual_seeds_template.csv --database-url "postgresql://..."
```

Verhalten:

- liest die CSV mit UTF-8-SIG
- parsed `{a,b,c}`-Arrays fuer `subtypes`, `audiences`, `occasions`
- upsertet nach `(city_slug, name, type)`
- aktualisiert bestehende Seeds statt Duplikate anzulegen

## Automatischer Seed-Kandidaten-Generator

Skript:

- `importer/generate_seed_candidates.py`

Beispiel:

```bash
python importer/generate_seed_candidates.py --cities berlin-berlin hamburg-hamburg --max-per-subtype 3 --output-dir data/seed_candidates --database-url "postgresql://..."
```

Output:

- `data/seed_candidates/berlin-berlin_seed_candidates.csv`
- `data/seed_candidates/hamburg-hamburg_seed_candidates.csv`

Ziel:

- erzeugt automatische Seed-Vorschlaege aus bestehenden `locations`
- priorisiert High-Value-Subtypen wie `zoo`, `aquarium`, `viewpoint`, `bowling`, `nightclub`
- reduziert manuellen Aufwand auf Review statt Vollrecherche

## Review-Skript

Skript:

- `importer/review_seed_candidates.py`

Beispiel:

```bash
python importer/review_seed_candidates.py data/seed_candidates/berlin-berlin_seed_candidates.csv data/seed_candidates/hamburg-hamburg_seed_candidates.csv
```

Ziel:

- gruppiert Kandidaten nach `subtypes`
- zeigt pro Subtyp die hoechstbewerteten Treffer
- erleichtert das schnelle Aussortieren offensichtlicher Fehlkandidaten

## Kuratiertes Zielniveau fuer die ersten Staedte

### Berlin

- `zoo`: 3-5
- `aquarium`: 2-4
- `playground`: 20-30
- `viewpoint`: 10-15
- `bowling`: 5-8
- `nightclub/disco`: 20-30
- `children_museum/science_center`: 5-10
- `date scenic`: 10-15
- `friends action/workshops`: 10-20

### Hamburg

- `zoo`: 2-4
- `aquarium`: 2-4
- `playground`: 15-25
- `viewpoint`: 8-12
- `bowling`: 4-6
- `nightclub/disco`: 15-25
- `children_museum/science_center`: 4-8
- `date scenic`: 8-12
- `friends action/workshops`: 8-15
