insert into public.event_source_configs (
  provider,
  city_slug,
  country_code,
  base_url,
  parser_mode,
  label,
  notes,
  priority,
  is_active
)
values
  (
    'muenchen_de',
    'muenchen',
    'DE',
    'https://www.muenchen.de/veranstaltungen/event/feste-festivals',
    'html',
    'muenchen.de Feste & Festivals',
    'Offizielle Muenchen-Quelle fuer Feste, Festivals und marktnahe Eventformate.',
    31,
    true
  ),
  (
    'muenchen_de',
    'muenchen',
    'DE',
    'https://www.muenchen.de/veranstaltungen/feste-festivals/fruehlingsfest-2026-theresienwiese',
    'html',
    'muenchen.de Fruehlingsfest',
    'Offizielle Muenchen-Quelle fuer Fruehlingsfest, Volksfest- und Saisontermine auf der Theresienwiese.',
    32,
    true
  ),
  (
    'hamburg_de',
    'hamburg-hamburg',
    'DE',
    'https://www.hamburg.de/freizeit/jahreszeiten/fruehling/ostertipps-termine-305558',
    'html',
    'hamburg.de Ostern & Fruehlingsmaerkte',
    'Offizielle Hamburg-Saisonquelle fuer Ostern, Fruehlingsmaerkte und saisonale Freizeitformate.',
    23,
    true
  ),
  (
    'hamburg_de',
    'hamburg-hamburg',
    'DE',
    'https://www.hamburg.de/freizeit/jahreszeiten/fruehling/1-mai-in-hamburg-304722',
    'html',
    'hamburg.de 1. Mai',
    'Offizielle Hamburg-Saisonquelle fuer 1.-Mai-Events, Feiertagsformate und saisonale Specials.',
    24,
    true
  ),
  (
    'hamburg_de',
    'hamburg-hamburg',
    'DE',
    'https://www.hamburg.de/freizeit/maerkte-und-messen/foodmaerkte',
    'html',
    'hamburg.de Foodmaerkte Saison',
    'Kulinarische Saisonseite fuer Food- und Street-Food-Formate in Hamburg.',
    27,
    true
  )
on conflict (provider, city_slug, base_url) do update
set
  country_code = excluded.country_code,
  parser_mode = excluded.parser_mode,
  label = excluded.label,
  notes = excluded.notes,
  priority = excluded.priority,
  is_active = excluded.is_active,
  updated_at = now();
