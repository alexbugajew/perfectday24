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
        'muenster_tourism'::text
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
  'muenster_tourism',
  'muenster',
  'DE',
  'https://www.stadt-muenster.de/tourismus/veranstaltungen/veranstaltungskalender',
  'html',
  'Muenster touristischer Veranstaltungskalender',
  'Offizieller touristischer Veranstaltungskalender der Stadt Muenster ueber die Session-gestuetzte Suche mit guestID=101, Ergebnislisten und Detailseiten.',
  65,
  true
where not exists (
  select 1
  from public.event_source_configs
  where provider = 'muenster_tourism'
    and city_slug = 'muenster'
);

update public.event_source_configs
set
  country_code = 'DE',
  base_url = 'https://www.stadt-muenster.de/tourismus/veranstaltungen/veranstaltungskalender',
  parser_mode = 'html',
  label = 'Muenster touristischer Veranstaltungskalender',
  notes = 'Offizieller touristischer Veranstaltungskalender der Stadt Muenster ueber die Session-gestuetzte Suche mit guestID=101, Ergebnislisten und Detailseiten.',
  priority = 65,
  is_active = true,
  updated_at = now()
where provider = 'muenster_tourism'
  and city_slug = 'muenster';
