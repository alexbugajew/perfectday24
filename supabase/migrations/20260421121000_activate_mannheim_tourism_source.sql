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
      'muenchen_de',
      'koeln_tourism',
      'frankfurt_tourism',
      'stuttgart_tourism',
      'duesseldorf_tourism',
      'leipzig_travel',
      'dresden_tourism',
      'hannover_tourism',
      'nuernberg_tourism',
      'bremen_tourism',
      'dortmund_tourism',
      'mannheim_tourism'
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
    'mannheim_tourism',
    'mannheim',
    'DE',
    'https://www.mannheim.de/de/veranstaltungen',
    'html',
    'Mannheim.de Veranstaltungen',
    'Offizieller Mannheim.de-Veranstaltungskalender via RSS plus kategorisierte Event-Listings.',
    60,
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
