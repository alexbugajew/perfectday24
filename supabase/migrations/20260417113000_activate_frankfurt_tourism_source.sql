update public.event_source_configs
set
  base_url = 'https://www.visitfrankfurt.travel/en/experience/calendar-of-events',
  label = 'visitFrankfurt Calendar of Events',
  notes = 'Offizielle Frankfurt-Quelle fuer Maerkte, Fuehrungen, Kultur- und Eventtermine.',
  priority = 41,
  is_active = true,
  updated_at = now()
where provider = 'frankfurt_tourism'
  and city_slug = 'frankfurt-am-main';
