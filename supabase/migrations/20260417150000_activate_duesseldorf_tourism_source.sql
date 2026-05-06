update public.event_source_configs
set
  base_url = 'https://www.visitduesseldorf.de/en/experience/events',
  label = 'visitDuesseldorf Events',
  notes = 'Offizielle Duesseldorf-Quelle fuer Stadttermine, Festivals, Kultur- und Event-Highlights.',
  priority = 43,
  is_active = true,
  updated_at = now()
where provider = 'duesseldorf_tourism'
  and city_slug = 'duesseldorf';
