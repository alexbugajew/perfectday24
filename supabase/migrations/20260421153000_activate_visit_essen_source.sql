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
        'visit_essen'::text
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
  'visit_essen',
  'essen',
  'DE',
  'https://pages.visitessen.de/de/visitessen/streaming/search/Event',
  'api',
  'Visit Essen Eventsuche',
  'Offizieller Visit-Essen-Finder ueber den dokumentierten destination.one / ET4 search-Endpunkt mit expandierten Occurrences fuer wiederkehrende Events.',
  62,
  true
where not exists (
  select 1
  from public.event_source_configs
  where provider = 'visit_essen'
    and city_slug = 'essen'
);

update public.event_source_configs
set
  country_code = 'DE',
  base_url = 'https://pages.visitessen.de/de/visitessen/streaming/search/Event',
  parser_mode = 'api',
  label = 'Visit Essen Eventsuche',
  notes = 'Offizieller Visit-Essen-Finder ueber den dokumentierten destination.one / ET4 search-Endpunkt mit expandierten Occurrences fuer wiederkehrende Events.',
  priority = 62,
  is_active = true,
  updated_at = now()
where provider = 'visit_essen'
  and city_slug = 'essen';
