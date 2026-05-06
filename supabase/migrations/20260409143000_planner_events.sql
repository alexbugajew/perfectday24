begin;

create extension if not exists pgcrypto;

create table if not exists public.planner_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text not null,
  source_url text null,
  ticket_url text null,
  title text not null,
  summary text null,
  category text not null default 'other',
  kind text not null default 'flex_event',
  status text not null default 'scheduled',
  venue_name text null,
  venue_address text null,
  city_slug text null references public.cities(slug) on delete set null,
  country_code text null,
  lat double precision null,
  lng double precision null,
  timezone text null,
  start_at timestamptz not null,
  end_at timestamptz null,
  doors_at timestamptz null,
  all_day boolean not null default false,
  is_ticketed boolean not null default false,
  price_min numeric(10,2) null,
  price_max numeric(10,2) null,
  currency text null,
  family_friendly boolean null,
  indoor_outdoor text null,
  local_rank numeric(10,2) null,
  importance_score numeric(10,2) null,
  popularity_score numeric(10,2) null,
  tags jsonb not null default '[]'::jsonb,
  subtypes jsonb not null default '[]'::jsonb,
  audiences jsonb not null default '[]'::jsonb,
  occasions jsonb not null default '[]'::jsonb,
  source_payload jsonb null,
  source_updated_at timestamptz null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planner_events_source_external_key unique (source, external_id),
  constraint planner_events_category_check check (
    category in (
      'concert',
      'theater',
      'show',
      'market',
      'festival',
      'fair',
      'food_event',
      'community',
      'seasonal',
      'other'
    )
  ),
  constraint planner_events_kind_check check (
    kind in ('anchored_event', 'flex_event')
  ),
  constraint planner_events_status_check check (
    status in ('scheduled', 'cancelled', 'postponed', 'draft')
  ),
  constraint planner_events_indoor_outdoor_check check (
    indoor_outdoor in ('indoor', 'outdoor', 'mixed') or indoor_outdoor is null
  )
);

create index if not exists planner_events_city_start_idx
  on public.planner_events (city_slug, start_at);

create index if not exists planner_events_country_start_idx
  on public.planner_events (country_code, start_at);

create index if not exists planner_events_category_start_idx
  on public.planner_events (category, start_at);

create index if not exists planner_events_kind_start_idx
  on public.planner_events (kind, start_at);

create index if not exists planner_events_status_start_idx
  on public.planner_events (status, start_at);

create index if not exists planner_events_last_seen_idx
  on public.planner_events (last_seen_at desc);

create index if not exists planner_events_tags_gin_idx
  on public.planner_events using gin (tags);

create index if not exists planner_events_subtypes_gin_idx
  on public.planner_events using gin (subtypes);

create index if not exists planner_events_audiences_gin_idx
  on public.planner_events using gin (audiences);

create index if not exists planner_events_occasions_gin_idx
  on public.planner_events using gin (occasions);

create or replace function public.pd24_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pd24_planner_events_set_updated_at on public.planner_events;
create trigger pd24_planner_events_set_updated_at
before update on public.planner_events
for each row
execute function public.pd24_set_updated_at();

alter table public.planner_events enable row level security;

drop policy if exists planner_events_select_public on public.planner_events;
create policy planner_events_select_public
on public.planner_events
for select
to anon, authenticated
using (
  status = 'scheduled'
);

comment on table public.planner_events is
  'Normalized event store for planner ingestion from providers like Ticketmaster, PredictHQ and municipal calendars.';

commit;
