begin;

create table if not exists public.location_manual_seeds (
  id uuid primary key default gen_random_uuid(),
  city_slug text not null,
  name text not null,
  category text not null,
  type text not null,
  subtypes text[] not null default '{}'::text[],
  audiences text[] not null default '{}'::text[],
  occasions text[] not null default '{}'::text[],
  lat double precision,
  lng double precision,
  address text,
  website text,
  reservation_url text,
  price_level integer,
  budget text,
  indoor_outdoor text,
  energy_level text,
  family_friendly boolean not null default false,
  nightlife_fit boolean not null default false,
  duration_min integer,
  manual_boost numeric(8,2) not null default 0,
  data_confidence numeric(5,2) not null default 0.95,
  source_primary text not null default 'manual_seed',
  import_batch text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_slug, name, type)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'location_manual_seeds_budget_check'
  ) then
    alter table public.location_manual_seeds
      add constraint location_manual_seeds_budget_check
      check (budget is null or budget in ('free', 'low', 'medium', 'high'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'location_manual_seeds_energy_level_check'
  ) then
    alter table public.location_manual_seeds
      add constraint location_manual_seeds_energy_level_check
      check (energy_level is null or energy_level in ('low', 'medium', 'high', 'late'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'location_manual_seeds_indoor_outdoor_check'
  ) then
    alter table public.location_manual_seeds
      add constraint location_manual_seeds_indoor_outdoor_check
      check (indoor_outdoor is null or indoor_outdoor in ('indoor', 'outdoor', 'mixed'));
  end if;
end $$;

create index if not exists idx_location_manual_seeds_city_slug
  on public.location_manual_seeds(city_slug);

create index if not exists idx_location_manual_seeds_active
  on public.location_manual_seeds(is_active);

create index if not exists idx_location_manual_seeds_category
  on public.location_manual_seeds(category);

create index if not exists idx_location_manual_seeds_type
  on public.location_manual_seeds(type);

create index if not exists idx_location_manual_seeds_subtypes_gin
  on public.location_manual_seeds using gin(subtypes);

create index if not exists idx_location_manual_seeds_audiences_gin
  on public.location_manual_seeds using gin(audiences);

create index if not exists idx_location_manual_seeds_occasions_gin
  on public.location_manual_seeds using gin(occasions);

create or replace function public.pd24_prepare_manual_seed_location(
  p_seed_id uuid
)
returns table (
  city_slug text,
  name text,
  category text,
  type text,
  subtypes text[],
  audiences text[],
  occasions text[],
  lat double precision,
  lng double precision,
  reservation_url text,
  duration_min integer,
  is_plannable boolean,
  quality_score integer,
  importance_score integer,
  popularity_score integer,
  manual_boost numeric,
  data_confidence numeric,
  source_primary text,
  family_friendly boolean,
  nightlife_fit boolean,
  energy_level text,
  indoor_outdoor text,
  budget text,
  tags text[]
)
language sql
stable
as $$
  select
    s.city_slug,
    s.name,
    s.category,
    s.type,
    public.pd24_unique_text_array(s.subtypes),
    public.pd24_unique_text_array(s.audiences),
    public.pd24_unique_text_array(s.occasions),
    s.lat,
    s.lng,
    s.reservation_url,
    s.duration_min,
    true as is_plannable,
    85 as quality_score,
    70 as importance_score,
    40 as popularity_score,
    s.manual_boost,
    s.data_confidence,
    s.source_primary,
    s.family_friendly,
    s.nightlife_fit,
    s.energy_level,
    s.indoor_outdoor,
    s.budget,
    public.pd24_unique_text_array(
      coalesce(s.subtypes, '{}'::text[]) ||
      coalesce(s.audiences, '{}'::text[]) ||
      coalesce(s.occasions, '{}'::text[]) ||
      case when s.import_batch is not null then array[s.import_batch] else '{}'::text[] end
    ) as tags
  from public.location_manual_seeds s
  where s.id = p_seed_id
    and s.is_active = true;
$$;

commit;
