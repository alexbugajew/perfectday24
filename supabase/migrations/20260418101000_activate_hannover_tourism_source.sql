update public.event_source_configs
set
  base_url = 'https://www.hannover.de/Veranstaltungskalender',
  parser_mode = 'html',
  label = 'Hannover.de Veranstaltungskalender',
  notes = 'Offizieller Hannover.de-Veranstaltungskalender mit Kategorie- und Detailseiten.',
  is_active = true,
  updated_at = now()
where provider = 'hannover_tourism'
  and city_slug = 'hannover';
