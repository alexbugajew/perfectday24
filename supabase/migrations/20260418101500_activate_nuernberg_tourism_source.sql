update public.event_source_configs
set
  base_url = 'https://tourismus.nuernberg.de/erleben/events/',
  parser_mode = 'html',
  label = 'Tourismus Nuernberg Events',
  notes = 'Offizieller Nuernberg-Tourismus-Eventhub mit kuratierten Markt- und Highlight-Seiten.',
  is_active = true,
  updated_at = now()
where provider = 'nuernberg_tourism'
  and city_slug = 'nuernberg';
