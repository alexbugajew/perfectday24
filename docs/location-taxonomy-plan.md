# Location Taxonomy Plan

## Ziel

`locations` soll von einer flachen OSM-Ablage zu einem planner-faehigen Place Layer werden. Die Engine soll kuenftig nicht mehr ueber Namensfragmente wie `zoo` oder `club` arbeiten, sondern ueber explizite Felder wie `subtypes`, `audiences` und `occasions`.

## Neue Kernfelder auf `locations`

- `source_primary`: kanonische Hauptquelle, z. B. `osm`, `google_places`, `manual_seed`
- `source_refs`: weitere Referenzen als `jsonb`
- `subtypes`: planner-relevante Ortstypen
- `audiences`: typische Zielgruppen wie `family`, `friends`, `tourism`
- `occasions`: Occasion-Fit fuer Retrieval und Explainability
- `energy_level`: `low | medium | high | late`
- `indoor_outdoor`: `indoor | outdoor | mixed`
- `family_friendly`: hartes Retrieval-Signal
- `data_confidence`: Qualitaet der Klassifikation
- `enrichment_version`, `last_enriched_at`: technische Nachvollziehbarkeit

## Neue Nebentabellen

### `location_source_data`

Speichert rohe Quelldaten pro Ort:

- mehrere Quellen pro kanonischem Ort
- Rohpayload fuer spaetere Re-Klassifikation
- Basis fuer Dedupe und Nachimporte

### `location_features`

Speichert auswertbare Features mit Confidence:

- `feature_key = subtype`
- `feature_value = zoo`
- spaeter auch `music`, `kid_friendly`, `view_quality`, `reservation_required`

### `location_subtype_catalog`

Zentrale Taxonomie fuer:

- Standard-Subtypen
- Default-Audiences
- Default-Occasions
- Default-Energy und Indoor/Outdoor

## Empfohlene Import-Pipeline

1. Raw Import
   OSM und spaeter externe APIs zunaechst roh in `location_source_data` oder Staging schreiben.

2. Normalize
   Gemeinsame Felder angleichen: Name, Geo, Typen, Oeffnungszeiten, Quelle.

3. Classify
   Regelwerk und Taxonomie auf `subtypes`, `audiences`, `occasions`, `energy_level`, `family_friendly`.

4. Deduplicate
   Orte ueber Geo + Name + Adresse zusammenfuehren.

5. Publish
   Nur planner-faehige, confidence-gepruefte Orte in `locations` aktivieren.

## Kurzfristige Prioritaeten

1. Migrationen aus `supabase/migrations` einspielen.
2. Retrieval schrittweise von Name-Matching auf `subtypes` umstellen.
3. Berlin und Hamburg mit kuratierten Seeds fuer die groessten Luecken auffuellen:
   - Zoo, Aquarium, Playground, Theme Park
   - Viewpoint, Promenade, Rooftop
   - Bowling, Lasertag, Paintball, Gokart, Wakeboard
   - Nightclub, Disco, Afterhour
4. Danach zweiten Coverage-Audit fahren.

## Migrationsdateien

- `supabase/migrations/20260323140000_location_taxonomy_schema.sql`
- `supabase/migrations/20260323141000_location_taxonomy_backfill.sql`
