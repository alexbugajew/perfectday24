alter table public.event_source_configs
  drop constraint if exists event_source_configs_provider_check;

alter table public.event_source_configs
  add constraint event_source_configs_provider_check
  check (provider in ('visitberlin', 'berlin_de', 'hamburg_tourism', 'muenchen_de'));

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
    'berlin_de',
    'berlin-berlin',
    'DE',
    'https://www.berlin.de/kultur-und-tickets/rubric.rss',
    'html',
    'Berlin.de Kultur & Tickets RSS',
    'Offizielle Berlin.de-Quelle fuer Kultur, Tickets und redaktionelle Eventtipps.',
    15,
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
