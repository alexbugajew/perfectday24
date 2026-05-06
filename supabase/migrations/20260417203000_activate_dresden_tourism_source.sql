update public.event_source_configs
set
  base_url = 'https://www.dresden.de/en/tourism/attractions/events.php',
  label = 'Dresden Official Events',
  notes = 'Offizielle Dresden-Quelle ueber den strukturierten Dresden-Elbland-Veranstaltungskalender.',
  priority = 45,
  is_active = true,
  updated_at = now()
where provider = 'dresden_tourism'
  and city_slug = 'dresden';
