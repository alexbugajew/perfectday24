update event_source_configs
set
  base_url = 'https://www.dortmund.de/dortmund-erleben/events-und-highlights/',
  parser_mode = 'html',
  label = 'Dortmund.de Events & Highlights',
  notes = 'Offizieller Dortmund.de-Highlightpfad mit strukturierten Event-Detailseiten aus dem Veranstaltungskalender.',
  is_active = true,
  updated_at = now()
where provider = 'dortmund_tourism'
  and city_slug = 'dortmund';
