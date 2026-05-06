alter table public.event_source_configs
  drop constraint if exists event_source_configs_provider_check;

alter table public.event_source_configs
  add constraint event_source_configs_provider_check
  check (provider in ('visitberlin', 'berlin_de', 'hamburg_tourism', 'hamburg_de', 'muenchen_de'));

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
    'hamburg_de',
    'hamburg-hamburg',
    'DE',
    'https://www.hamburg.de/freizeit',
    'html',
    'hamburg.de Freizeit',
    'Redaktionelle Hamburg.de-Freizeitquelle fuer saisonale Freizeit- und Eventteaser.',
    24,
    true
  ),
  (
    'hamburg_de',
    'hamburg-hamburg',
    'DE',
    'https://www.hamburg.de/freizeit/veranstaltungshighlights',
    'html',
    'hamburg.de Veranstaltungshighlights',
    'Jahresuebersicht fuer grosse Veranstaltungen, Festivals und saisonale Highlights in Hamburg.',
    25,
    true
  ),
  (
    'hamburg_de',
    'hamburg-hamburg',
    'DE',
    'https://www.hamburg.de/freizeit/maerkte-und-messen/flohmaerkte/flohmaerkte-april-1013998',
    'html',
    'hamburg.de Flohmaerkte April',
    'Tabellarische Terminseite fuer Flohmaerkte in Hamburg mit Datum, Uhrzeit und Stadtteil.',
    26,
    true
  ),
  (
    'hamburg_de',
    'hamburg-hamburg',
    'DE',
    'https://www.hamburg.de/freizeit/maerkte-und-messen/foodmaerkte',
    'html',
    'hamburg.de Foodmaerkte',
    'Foodmaerkte, Street-Food-Formate und kulinarische Events in Hamburg.',
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
