update public.event_source_configs
set
  base_url = 'https://www.koelntourismus.de/erlebnisse-lifestyle/veranstaltungen/veranstaltungskalender',
  label = 'KoelnTourismus Veranstaltungskalender',
  notes = 'Offizielle Koeln-Quelle fuer Maerkte, Ausstellungen, Fuehrungen und Stadttermine.',
  priority = 40,
  is_active = true,
  updated_at = now()
where provider = 'koeln_tourism'
  and city_slug = 'koeln';
