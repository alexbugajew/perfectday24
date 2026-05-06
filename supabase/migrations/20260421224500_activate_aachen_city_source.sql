alter table public.event_source_configs
  drop constraint if exists event_source_configs_provider_check;

alter table public.event_source_configs
  add constraint event_source_configs_provider_check
  check (
    provider = any (
      array[
        'visitberlin'::text,
        'berlin_de'::text,
        'hamburg_tourism'::text,
        'hamburg_de'::text,
        'hamburg_infomax'::text,
        'muenchen_de'::text,
        'koeln_tourism'::text,
        'frankfurt_tourism'::text,
        'stuttgart_tourism'::text,
        'duesseldorf_tourism'::text,
        'leipzig_travel'::text,
        'dresden_tourism'::text,
        'hannover_tourism'::text,
        'nuernberg_tourism'::text,
        'bremen_tourism'::text,
        'dortmund_tourism'::text,
        'mannheim_tourism'::text,
        'wiesbaden_tourism'::text,
        'bonn_city'::text,
        'visit_essen'::text,
        'karlsruhe_tourism'::text,
        'muenster_tourism'::text,
        'aachen_city'::text
      ]
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
select
  'aachen_city',
  'aachen',
  'DE',
  'https://www.aachen.de/services/veranstaltungskalender/',
  'api',
  'Aachen offizieller Veranstaltungskalender',
  'Offizieller Aachen.de-Veranstaltungskalender ueber den stadtischen events.json-Feed plus places.json fuer Veranstaltungsorte.',
  66,
  true
where not exists (
  select 1
  from public.event_source_configs
  where provider = 'aachen_city'
    and city_slug = 'aachen'
);

update public.event_source_configs
set
  country_code = 'DE',
  base_url = 'https://www.aachen.de/services/veranstaltungskalender/',
  parser_mode = 'api',
  label = 'Aachen offizieller Veranstaltungskalender',
  notes = 'Offizieller Aachen.de-Veranstaltungskalender ueber den stadtischen events.json-Feed plus places.json fuer Veranstaltungsorte.',
  priority = 66,
  is_active = true,
  updated_at = now()
where provider = 'aachen_city'
  and city_slug = 'aachen';
