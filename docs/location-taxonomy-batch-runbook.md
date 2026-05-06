# Location Taxonomy Batch Runbook

## Ziel

Wenn der komplette Backfill im Supabase SQL Editor in ein Timeout laeuft, soll die Taxonomie pro Stadt nachgezogen werden. Fuer den aktuellen Bestand reicht das fuer:

- `berlin-berlin`
- `hamburg-hamburg`

## Vorbereitung

1. Zuerst die Schema-Migration ausfuehren:
   - `supabase/migrations/20260323140000_location_taxonomy_schema.sql`
2. Danach die City-Batch-Funktion ausfuehren:
   - `supabase/migrations/20260324093000_location_taxonomy_city_batch.sql`

## Batch-Lauf

### Berlin

```sql
begin;
select public.pd24_backfill_location_taxonomy_city('berlin-berlin');
commit;
```

### Hamburg

```sql
begin;
select public.pd24_backfill_location_taxonomy_city('hamburg-hamburg');
commit;
```

## Status-Checks

```sql
select
  city_slug,
  count(*) as total,
  count(*) filter (where cardinality(subtypes) > 0) as with_subtypes,
  count(*) filter (where cardinality(audiences) > 0) as with_audiences,
  count(*) filter (where cardinality(occasions) > 0) as with_occasions
from public.locations
group by city_slug
order by city_slug;
```

## Wichtige Subtypen pruefen

```sql
select city_slug, count(*) from public.locations where 'zoo' = any(subtypes) group by city_slug order by city_slug;
select city_slug, count(*) from public.locations where 'aquarium' = any(subtypes) group by city_slug order by city_slug;
select city_slug, count(*) from public.locations where 'playground' = any(subtypes) group by city_slug order by city_slug;
select city_slug, count(*) from public.locations where 'viewpoint' = any(subtypes) group by city_slug order by city_slug;
select city_slug, count(*) from public.locations where 'bowling' = any(subtypes) group by city_slug order by city_slug;
select city_slug, count(*) from public.locations where 'nightclub' = any(subtypes) group by city_slug order by city_slug;
select city_slug, count(*) from public.locations where 'disco' = any(subtypes) group by city_slug order by city_slug;
```

## Wenn ein Batch haengen bleibt

- SQL Editor neu laden
- erst kleine Query wie `select 1;` testen
- den Batch nicht direkt erneut starten
- erst den Status pro Stadt pruefen

## Nächster technischer Schritt danach

Wenn beide Stadt-Batches sauber durch sind:

1. Planner mit den neuen Taxonomie-Feldern testen
2. Coverage gegen die Occasion-Matrix pruefen
3. fehlende High-Value-Locations per manuellen Seeds oder externen APIs anreichern
