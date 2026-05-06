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
values
  (
    'hamburg_de',
    'hamburg-hamburg',
    'DE',
    'https://www.hamburg.de/kultur/veranstaltungen',
    'html',
    'hamburg.de Kultur Veranstaltungen',
    'Redaktionelle Hamburg.de-Kulturseite mit saisonalen Kultur- und Eventtipps.',
    28,
    true
  ),
  (
    'hamburg_de',
    'hamburg-hamburg',
    'DE',
    'https://www.hamburg.de/kultur/veranstaltungen/april',
    'html',
    'hamburg.de Kultur Veranstaltungen April',
    'Monatsseite fuer datierte Kultur-, Show- und Veranstaltungstipps in Hamburg.',
    29,
    true
  )
on conflict (provider, city_slug, base_url) do update
set
  country_code = excluded.country_code,
  parser_mode = excluded.parser_mode,
  label = excluded.label,
  notes = excluded.notes,
  priority = excluded.priority,
  is_active = excluded.is_active,
  updated_at = now();
