-- Functional indexes für pd24_seed_match_location.
-- Ohne diese macht der Manual-Seed-Publish einen Sequential Scan auf
-- locations für jeden Seed (lower(btrim(name)) ist nicht indexierbar
-- über bestehende b-tree Indexes). Bei tausenden Locations pro Stadt
-- führt das zu statement timeouts wenn p_limit > ~50.

begin;

create index if not exists idx_locations_city_lower_name
  on public.locations (city_slug, lower(btrim(name)))
  where is_plannable = true;

create index if not exists idx_locations_city_lower_name_type
  on public.locations (city_slug, lower(btrim(name)), lower(btrim(type)))
  where is_plannable = true;

-- Auch für die manual_seeds Seite — wenn das Match in der anderen Richtung
-- läuft (z.B. UI-Suche nach published seeds für eine Stadt).
create index if not exists idx_location_manual_seeds_city_lower_name
  on public.location_manual_seeds (city_slug, lower(btrim(name)))
  where is_active = true;

analyze public.locations;
analyze public.location_manual_seeds;

commit;
