create table if not exists public.event_source_configs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  city_slug text not null,
  country_code text,
  base_url text not null,
  parser_mode text not null default 'html',
  label text not null,
  notes text,
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_source_configs_provider_check
    check (provider in ('visitberlin', 'hamburg_tourism', 'muenchen_de')),
  constraint event_source_configs_parser_mode_check
    check (parser_mode in ('html', 'jsonld', 'api')),
  constraint event_source_configs_city_provider_unique unique (provider, city_slug)
);

create index if not exists event_source_configs_city_active_idx
  on public.event_source_configs (city_slug, is_active, priority);

create or replace function public.pd24_event_source_configs_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pd24_event_source_configs_set_updated_at on public.event_source_configs;
create trigger pd24_event_source_configs_set_updated_at
before update on public.event_source_configs
for each row
execute function public.pd24_event_source_configs_set_updated_at();

alter table public.event_source_configs enable row level security;

drop policy if exists event_source_configs_select_public on public.event_source_configs;
create policy event_source_configs_select_public
on public.event_source_configs
for select
to anon, authenticated
using (is_active = true);

insert into public.event_source_configs (
  provider,
  city_slug,
  country_code,
  base_url,
  parser_mode,
  label,
  notes,
  priority,
  is_active
)
values
  (
    'visitberlin',
    'berlin-berlin',
    'DE',
    'https://www.visitberlin.de/en/event-calendar-berlin',
    'html',
    'visitBerlin Event Calendar',
    'Offizieller Berlin-Kalender fuer Festivals, Maerkte, Kultur und Food-Events.',
    10,
    true
  ),
  (
    'hamburg_tourism',
    'hamburg-hamburg',
    'DE',
    'https://www.hamburg-tourism.de/sehen-erleben/veranstaltungen/veranstaltungskalender/',
    'html',
    'Hamburg Tourismus Veranstaltungskalender',
    'Offizielle Hamburg-Quelle fuer Festivals, Maerkte, Konzerte und Shows.',
    20,
    true
  ),
  (
    'muenchen_de',
    'muenchen',
    'DE',
    'https://www.muenchen.de/en/events/event-search',
    'html',
    'muenchen.de Event Search',
    'Offizielle Muenchen-Quelle fuer Kultur, Events, Familienformate und saisonale Highlights.',
    30,
    true
  )
on conflict (provider, city_slug) do update
set
  country_code = excluded.country_code,
  base_url = excluded.base_url,
  parser_mode = excluded.parser_mode,
  label = excluded.label,
  notes = excluded.notes,
  priority = excluded.priority,
  is_active = excluded.is_active,
  updated_at = now();
