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
        'wiesbaden_tourism'::text
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
values (
  'wiesbaden_tourism',
  'wiesbaden',
  'DE',
  'https://www.wiesbaden.de/leben-in-wiesbaden/freizeit/veranstaltungskalender/veranstaltungssuche.php',
  'api',
  'Wiesbaden Veranstaltungskalender',
  'Offizielle Eventsuche der Landeshauptstadt Wiesbaden ueber den GraphQL-gestuetzten Veranstaltungskalender.',
  61,
  true
)
select
  'wiesbaden_tourism',
  'wiesbaden',
  'DE',
  'https://www.wiesbaden.de/leben-in-wiesbaden/freizeit/veranstaltungskalender/veranstaltungssuche.php',
  'api',
  'Wiesbaden Veranstaltungskalender',
  'Offizielle Eventsuche der Landeshauptstadt Wiesbaden ueber den GraphQL-gestuetzten Veranstaltungskalender.',
  61,
  true
where not exists (
  select 1
  from public.event_source_configs
  where provider = 'wiesbaden_tourism'
    and city_slug = 'wiesbaden'
);

update public.event_source_configs
set
  country_code = 'DE',
  base_url = 'https://www.wiesbaden.de/leben-in-wiesbaden/freizeit/veranstaltungskalender/veranstaltungssuche.php',
  parser_mode = 'api',
  label = 'Wiesbaden Veranstaltungskalender',
  notes = 'Offizielle Eventsuche der Landeshauptstadt Wiesbaden ueber den GraphQL-gestuetzten Veranstaltungskalender.',
  priority = 61,
  is_active = true,
  updated_at = now()
where provider = 'wiesbaden_tourism'
  and city_slug = 'wiesbaden';
