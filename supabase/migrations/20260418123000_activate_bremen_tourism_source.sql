update event_source_configs
set
  base_url = 'https://www.bremen.de/veranstaltungen',
  parser_mode = 'html',
  label = 'Bremen Tourism Highlights',
  notes = 'Offizieller Bremen-Bootstrap aus verifizierten Bremen.de-Highlightseiten; dynamischer Scraper folgt spaeter, sobald der Cloudflare-Zugriff sauber loesbar ist.',
  is_active = true
where provider = 'bremen_tourism'
  and city_slug = 'bremen';
