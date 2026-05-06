update event_source_configs
set
  base_url = 'https://www.stuttgart-tourist.de/',
  parser_mode = 'html',
  label = 'Stuttgart Tourist Event Highlights',
  notes = 'Offizielle Event-Highlights von der Stuttgart-Tourist-Startseite mit Detail-Links fuer Shows, Festivals und aktuelle Stadttermine.',
  is_active = true
where provider = 'stuttgart_tourism'
  and city_slug = 'stuttgart';
