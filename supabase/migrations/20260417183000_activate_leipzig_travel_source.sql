update public.event_source_configs
set
  base_url = 'https://www.leipzig.travel/en/discover/events-in-Leipzig',
  label = 'Leipzig Travel Events in Leipzig',
  notes = 'Offizielle Leipzig-Quelle fuer Maerkte, Festivals, Kultur- und Stadttermine.',
  priority = 44,
  is_active = true,
  updated_at = now()
where provider = 'leipzig_travel'
  and city_slug = 'leipzig';
