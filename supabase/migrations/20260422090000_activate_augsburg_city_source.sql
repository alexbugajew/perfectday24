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
        'augsburg_city'::text
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
  'augsburg_city',
  'augsburg',
  'DE',
  'https://www.augsburg.de/veranstaltungen',
  'api',
  'Augsburg offizieller Veranstaltungskalender',
  'Offizieller Augsburg.de-Kalender ueber die API event_occurrences mit Date-Filtern und reichhaltigem Event-Payload fuer Show-, Event-Visit- und Marktlogik.',
  70,
  true
where not exists (
  select 1
  from public.event_source_configs
  where provider = 'augsburg_city'
    and city_slug = 'augsburg'
);

update public.event_source_configs
set
  country_code = 'DE',
  base_url = 'https://www.augsburg.de/veranstaltungen',
  parser_mode = 'api',
  label = 'Augsburg offizieller Veranstaltungskalender',
  notes = 'Offizieller Augsburg.de-Kalender ueber die API event_occurrences mit Date-Filtern und reichhaltigem Event-Payload fuer Show-, Event-Visit- und Marktlogik.',
  priority = 70,
  is_active = true,
  updated_at = now()
where provider = 'augsburg_city'
  and city_slug = 'augsburg';
