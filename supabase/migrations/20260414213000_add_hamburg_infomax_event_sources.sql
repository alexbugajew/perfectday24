alter table public.event_source_configs
  drop constraint if exists event_source_configs_provider_check;

alter table public.event_source_configs
  add constraint event_source_configs_provider_check
  check (
    provider in (
      'visitberlin',
      'berlin_de',
      'hamburg_tourism',
      'hamburg_de',
      'hamburg_infomax',
      'muenchen_de'
    )
  );

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
    'hamburg_infomax',
    'hamburg-hamburg',
    'DE',
    'https://www.hamburg.de/kultur/veranstaltungen',
    'html',
    'Hamburg Kulturkalender (Infomax)',
    'Infomax-Widget hinter dem offiziellen Hamburg-Kulturkalender fuer Shows, Theater, Musicals und Konzerte.',
    21,
    true
  ),
  (
    'hamburg_infomax',
    'hamburg-hamburg',
    'DE',
    'https://www.hamburg.de/kultur/veranstaltungen/april',
    'html',
    'Hamburg Kulturkalender April (Infomax)',
    'Monatsansicht des Infomax-Kalenders fuer dichteres Show- und Kulturangebot in Hamburg.',
    22,
    true
  )
on conflict (provider, city_slug, base_url) do update
set
  country_code = excluded.country_code,
  parser_mode = excluded.parser_mode,
  label = excluded.label,
  notes = excluded.notes,
  priority = excluded.priority,
  is_active = excluded.is_active,
  updated_at = now();
