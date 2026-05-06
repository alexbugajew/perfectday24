begin;

alter table public.locations
  add column if not exists source_primary text not null default 'osm',
  add column if not exists source_refs jsonb not null default '[]'::jsonb,
  add column if not exists subtypes text[] not null default '{}'::text[],
  add column if not exists audiences text[] not null default '{}'::text[],
  add column if not exists occasions text[] not null default '{}'::text[],
  add column if not exists energy_level text,
  add column if not exists indoor_outdoor text,
  add column if not exists family_friendly boolean not null default false,
  add column if not exists data_confidence numeric(5,2) not null default 0,
  add column if not exists enrichment_version integer not null default 1,
  add column if not exists last_enriched_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'locations_energy_level_check'
  ) then
    alter table public.locations
      add constraint locations_energy_level_check
      check (energy_level is null or energy_level in ('low', 'medium', 'high', 'late'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'locations_indoor_outdoor_check'
  ) then
    alter table public.locations
      add constraint locations_indoor_outdoor_check
      check (indoor_outdoor is null or indoor_outdoor in ('indoor', 'outdoor', 'mixed'));
  end if;
end $$;

create table if not exists public.location_source_data (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  source text not null,
  source_place_id text not null,
  raw_payload jsonb not null,
  fetched_at timestamptz not null default now(),
  checksum text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_place_id)
);

create index if not exists idx_location_source_data_location_id
  on public.location_source_data(location_id);

create index if not exists idx_location_source_data_source
  on public.location_source_data(source);

create table if not exists public.location_features (
  location_id uuid not null references public.locations(id) on delete cascade,
  feature_key text not null,
  feature_value text not null,
  confidence numeric(4,3) not null default 1,
  source text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (location_id, feature_key, feature_value)
);

create index if not exists idx_location_features_key
  on public.location_features(feature_key);

create index if not exists idx_location_features_key_value
  on public.location_features(feature_key, feature_value);

create table if not exists public.location_subtype_catalog (
  subtype text primary key,
  category text not null,
  default_audiences text[] not null default '{}'::text[],
  default_occasions text[] not null default '{}'::text[],
  default_energy_level text,
  default_indoor_outdoor text,
  notes text
);

insert into public.location_subtype_catalog (
  subtype,
  category,
  default_audiences,
  default_occasions,
  default_energy_level,
  default_indoor_outdoor,
  notes
) values
  ('promenade', 'activity', array['date', 'friends', 'tourism'], array['date', 'friends', 'tourism'], 'low', 'outdoor', 'Walkable scenic waterfront or promenade'),
  ('viewpoint', 'culture', array['date', 'friends', 'tourism'], array['date', 'friends', 'tourism'], 'low', 'outdoor', 'Scenic overlook or lookout'),
  ('rooftop', 'nightlife', array['date', 'friends', 'party', 'tourism'], array['date', 'friends', 'party', 'tourism'], 'medium', 'mixed', 'Rooftop bar or viewpoint'),
  ('romantic_spot', 'activity', array['date'], array['date'], 'low', 'mixed', 'Atmospheric place for romantic occasions'),
  ('park', 'activity', array['date', 'family', 'friends', 'tourism'], array['date', 'family', 'friends', 'tourism'], 'low', 'outdoor', 'General park or garden'),
  ('botanical_garden', 'culture', array['date', 'family', 'tourism'], array['date', 'family', 'tourism'], 'low', 'outdoor', 'Curated garden or greenhouse'),
  ('bowling', 'activity', array['date', 'friends'], array['date', 'friends'], 'medium', 'indoor', 'Bowling alley'),
  ('minigolf', 'activity', array['date', 'friends', 'family'], array['date', 'friends', 'family'], 'medium', 'mixed', 'Miniature golf'),
  ('climbing', 'activity', array['date', 'friends'], array['date', 'friends'], 'high', 'mixed', 'Climbing or bouldering'),
  ('lasertag', 'activity', array['friends'], array['date', 'friends'], 'high', 'indoor', 'Laser tag arena'),
  ('escape_room', 'activity', array['date', 'friends'], array['date', 'friends'], 'medium', 'indoor', 'Escape room'),
  ('zoo', 'activity', array['family', 'tourism'], array['family', 'tourism'], 'medium', 'outdoor', 'Zoo'),
  ('wildpark', 'activity', array['family', 'tourism'], array['family', 'tourism'], 'medium', 'outdoor', 'Wildlife park'),
  ('aquarium', 'activity', array['family', 'tourism'], array['family', 'tourism'], 'low', 'indoor', 'Aquarium'),
  ('playground', 'activity', array['family'], array['family'], 'medium', 'outdoor', 'Playground'),
  ('children_museum', 'culture', array['family'], array['family', 'tourism'], 'low', 'indoor', 'Museum for children'),
  ('science_center', 'culture', array['family', 'tourism'], array['family', 'tourism'], 'low', 'indoor', 'Interactive science center'),
  ('swimming_pool', 'activity', array['family'], array['family'], 'medium', 'mixed', 'Pool or bath'),
  ('thermal_bath', 'activity', array['family', 'date'], array['family', 'date'], 'low', 'indoor', 'Thermal bath or spa'),
  ('theme_park', 'activity', array['family'], array['family'], 'high', 'outdoor', 'Theme or amusement park'),
  ('water_park', 'activity', array['family'], array['family'], 'high', 'mixed', 'Water park'),
  ('farm_experience', 'activity', array['family'], array['family'], 'low', 'outdoor', 'Farm or petting zoo'),
  ('workshop_pottery', 'activity', array['friends', 'date'], array['friends', 'date'], 'low', 'indoor', 'Pottery workshop'),
  ('workshop_painting', 'activity', array['friends', 'date'], array['friends', 'date'], 'low', 'indoor', 'Painting workshop'),
  ('cocktail_workshop', 'activity', array['friends', 'party'], array['friends', 'party'], 'medium', 'indoor', 'Cocktail-making workshop'),
  ('paintball', 'activity', array['friends'], array['friends'], 'high', 'outdoor', 'Paintball field'),
  ('gokart', 'activity', array['friends'], array['friends'], 'high', 'indoor', 'Karting track'),
  ('wakeboard', 'activity', array['friends'], array['friends'], 'high', 'outdoor', 'Wakeboard park'),
  ('event_social', 'event', array['friends', 'party'], array['friends', 'party'], 'medium', 'mixed', 'Social event venue'),
  ('landmark', 'culture', array['tourism'], array['tourism'], 'low', 'outdoor', 'Key tourist landmark'),
  ('historic_site', 'culture', array['tourism'], array['tourism'], 'low', 'mixed', 'Historic or heritage site'),
  ('museum', 'culture', array['tourism', 'family'], array['tourism'], 'low', 'indoor', 'Museum'),
  ('gallery', 'culture', array['tourism', 'date'], array['tourism', 'date'], 'low', 'indoor', 'Gallery'),
  ('old_town', 'culture', array['tourism', 'date'], array['tourism', 'date'], 'low', 'outdoor', 'Historic old town area'),
  ('monument', 'culture', array['tourism'], array['tourism'], 'low', 'outdoor', 'Monument'),
  ('memorial', 'culture', array['tourism'], array['tourism'], 'low', 'outdoor', 'Memorial site'),
  ('cocktail_bar', 'nightlife', array['date', 'friends', 'party'], array['date', 'friends', 'party'], 'medium', 'indoor', 'Cocktail-focused bar'),
  ('pub', 'nightlife', array['friends', 'party'], array['friends', 'party'], 'medium', 'indoor', 'Pub or tavern'),
  ('rooftop_bar', 'nightlife', array['date', 'friends', 'party', 'tourism'], array['date', 'friends', 'party', 'tourism'], 'medium', 'mixed', 'Rooftop nightlife venue'),
  ('nightclub', 'nightlife', array['friends', 'party'], array['friends', 'party'], 'high', 'indoor', 'Nightclub'),
  ('disco', 'nightlife', array['friends', 'party'], array['friends', 'party'], 'high', 'indoor', 'Dance club or disco'),
  ('live_music', 'nightlife', array['friends', 'party', 'date'], array['friends', 'party', 'date'], 'medium', 'indoor', 'Live music venue'),
  ('afterhour', 'nightlife', array['party'], array['party'], 'late', 'indoor', 'Afterhour venue'),
  ('late_food', 'restaurant', array['party', 'friends'], array['party', 'friends'], 'late', 'indoor', 'Late-night food stop')
on conflict (subtype) do update set
  category = excluded.category,
  default_audiences = excluded.default_audiences,
  default_occasions = excluded.default_occasions,
  default_energy_level = excluded.default_energy_level,
  default_indoor_outdoor = excluded.default_indoor_outdoor,
  notes = excluded.notes;

create or replace function public.pd24_unique_text_array(input text[])
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(distinct trimmed order by trimmed), '{}'::text[])
  from (
    select nullif(btrim(value), '') as trimmed
    from unnest(coalesce(input, '{}'::text[])) as value
  ) valueset
  where trimmed is not null;
$$;

create or replace function public.pd24_location_search_text(
  p_name text,
  p_type text,
  p_category text,
  p_tags text[]
)
returns text
language sql
immutable
as $$
  select lower(
    concat_ws(
      ' ',
      coalesce(p_name, ''),
      coalesce(p_type, ''),
      coalesce(p_category, ''),
      array_to_string(coalesce(p_tags, '{}'::text[]), ' ')
    )
  );
$$;

create index if not exists idx_locations_subtypes_gin
  on public.locations using gin(subtypes);

create index if not exists idx_locations_audiences_gin
  on public.locations using gin(audiences);

create index if not exists idx_locations_occasions_gin
  on public.locations using gin(occasions);

create index if not exists idx_locations_source_refs_gin
  on public.locations using gin(source_refs jsonb_path_ops);

create index if not exists idx_locations_source_primary
  on public.locations(source_primary);

create index if not exists idx_locations_family_friendly
  on public.locations(family_friendly);

create index if not exists idx_locations_energy_level
  on public.locations(energy_level);

create index if not exists idx_locations_city_category_plannable
  on public.locations(city_slug, category, is_plannable);

commit;
