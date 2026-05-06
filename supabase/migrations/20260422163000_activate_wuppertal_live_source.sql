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
        'wuppertal_live'::text
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
  'wuppertal_live',
  'wuppertal',
  'DE',
  'https://www.wuppertal-live.de/intro/disp=1;titel=1;cal=wuppertal',
  'html',
  'Wuppertal Live Veranstaltungskalender',
  'Offizieller Wuppertal-Live-Kalender ueber intro/events/detail mit Wuppertal-only calendar, canonical Eventseiten, Venue-/Adressdaten und haeufigen Geo-Hinweisen aus dem Kartenkommentar.',
  76,
  true
where not exists (
  select 1
  from public.event_source_configs
  where provider = 'wuppertal_live'
    and city_slug = 'wuppertal'
);

update public.event_source_configs
set
  country_code = 'DE',
  base_url = 'https://www.wuppertal-live.de/intro/disp=1;titel=1;cal=wuppertal',
  parser_mode = 'html',
  label = 'Wuppertal Live Veranstaltungskalender',
  notes = 'Offizieller Wuppertal-Live-Kalender ueber intro/events/detail mit Wuppertal-only calendar, canonical Eventseiten, Venue-/Adressdaten und haeufigen Geo-Hinweisen aus dem Kartenkommentar.',
  priority = 76,
  is_active = true,
  updated_at = now()
where provider = 'wuppertal_live'
  and city_slug = 'wuppertal';
