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
        'karlsruhe_tourism'::text
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
  'karlsruhe_tourism',
  'karlsruhe',
  'DE',
  'https://www.karlsruhe-erleben.de/veranstaltungen/kalender',
  'api',
  'Karlsruhe-Erleben Veranstaltungskalender',
  'Offizieller Karlsruhe-Erleben-Kalender ueber die eingebettete toubiz-API mit Date-Filtern und Exclude-Tag aus dem Widget.',
  64,
  true
where not exists (
  select 1
  from public.event_source_configs
  where provider = 'karlsruhe_tourism'
    and city_slug = 'karlsruhe'
);

update public.event_source_configs
set
  country_code = 'DE',
  base_url = 'https://www.karlsruhe-erleben.de/veranstaltungen/kalender',
  parser_mode = 'api',
  label = 'Karlsruhe-Erleben Veranstaltungskalender',
  notes = 'Offizieller Karlsruhe-Erleben-Kalender ueber die eingebettete toubiz-API mit Date-Filtern und Exclude-Tag aus dem Widget.',
  priority = 64,
  is_active = true,
  updated_at = now()
where provider = 'karlsruhe_tourism'
  and city_slug = 'karlsruhe';
