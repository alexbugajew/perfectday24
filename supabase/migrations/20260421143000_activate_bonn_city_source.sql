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
        'bonn_city'::text
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
  'bonn_city',
  'bonn',
  'DE',
  'https://www.bonn.de/bonn-erleben/ausgehen-und-erleben/veranstaltungskalender.php',
  'html',
  'Bonn Veranstaltungskalender',
  'Offizieller Bonn.de-Veranstaltungskalender mit servergerenderten Teasern, Detailseiten und breiter Kultur-, Markt- und Besuchslogik.',
  63,
  true
where not exists (
  select 1
  from public.event_source_configs
  where provider = 'bonn_city'
    and city_slug = 'bonn'
);

update public.event_source_configs
set
  country_code = 'DE',
  base_url = 'https://www.bonn.de/bonn-erleben/ausgehen-und-erleben/veranstaltungskalender.php',
  parser_mode = 'html',
  label = 'Bonn Veranstaltungskalender',
  notes = 'Offizieller Bonn.de-Veranstaltungskalender mit servergerenderten Teasern, Detailseiten und breiter Kultur-, Markt- und Besuchslogik.',
  priority = 63,
  is_active = true,
  updated_at = now()
where provider = 'bonn_city'
  and city_slug = 'bonn';
