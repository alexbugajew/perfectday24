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
        'aachen_city'::text,
        'augsburg_city'::text,
        'kiel_sailing_city'::text,
        'bielefeld_jetzt'::text,
        'braunschweig_region'::text,
        'bochum_tourism'::text,
        'duisburg_live'::text,
        'wuppertal_live'::text,
        'freiburg_eventportal'::text,
        'luebeck_tourism'::text,
        'erfurt_tourism'::text
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
  'erfurt_tourism',
  'erfurt',
  'DE',
  'https://www.erfurt-tourismus.de/veranstaltungskalender',
  'html',
  'Erfurt Tourismus',
  'Offizieller Erfurt-Tourismuskalender ueber paginierte TYPO3-Listenseiten und Detailseiten mit JSON-LD-Eventdaten fuer Zeit, Venue und Adresse.',
  82,
  true
where not exists (
  select 1
  from public.event_source_configs
  where provider = 'erfurt_tourism'
    and city_slug = 'erfurt'
);

update public.event_source_configs
set
  country_code = 'DE',
  base_url = 'https://www.erfurt-tourismus.de/veranstaltungskalender',
  parser_mode = 'html',
  label = 'Erfurt Tourismus',
  notes = 'Offizieller Erfurt-Tourismuskalender ueber paginierte TYPO3-Listenseiten und Detailseiten mit JSON-LD-Eventdaten fuer Zeit, Venue und Adresse.',
  priority = 82,
  is_active = true,
  updated_at = now()
where provider = 'erfurt_tourism'
  and city_slug = 'erfurt';
