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
        'erfurt_tourism'::text,
        'magdeburg_city'::text,
        'moenchengladbach_city'::text,
        'gelsenkirchen_city'::text
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
  'gelsenkirchen_city',
  'gelsenkirchen',
  'DE',
  'https://www.gelsenkirchen.de/de/_meta/veranstaltungskalender/',
  'html',
  'Gelsenkirchen',
  'Offizieller Veranstaltungskalender der Stadt Gelsenkirchen ueber Listing-Seiten, stabile Detailseiten und ICS-Downloads je Event.',
  85,
  true
where not exists (
  select 1
  from public.event_source_configs
  where provider = 'gelsenkirchen_city'
    and city_slug = 'gelsenkirchen'
);

update public.event_source_configs
set
  country_code = 'DE',
  base_url = 'https://www.gelsenkirchen.de/de/_meta/veranstaltungskalender/',
  parser_mode = 'html',
  label = 'Gelsenkirchen',
  notes = 'Offizieller Veranstaltungskalender der Stadt Gelsenkirchen ueber Listing-Seiten, stabile Detailseiten und ICS-Downloads je Event.',
  priority = 85,
  is_active = true,
  updated_at = now()
where provider = 'gelsenkirchen_city'
  and city_slug = 'gelsenkirchen';
