alter table public.event_source_configs
  drop constraint if exists event_source_configs_city_provider_unique;

alter table public.event_source_configs
  add constraint event_source_configs_city_provider_base_url_unique
  unique (provider, city_slug, base_url);

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
    'berlin_de',
    'berlin-berlin',
    'DE',
    'https://www.berlin.de/events/',
    'html',
    'Berlin.de Events & Festivals',
    'Berlin.de Uebersichtsseite fuer Events, Festivals und grosse Open-Air-Veranstaltungen.',
    16,
    true
  ),
  (
    'berlin_de',
    'berlin-berlin',
    'DE',
    'https://www.berlin.de/events/jahresuebersicht/april/',
    'html',
    'Berlin.de Event-Highlights April',
    'Monatsuebersicht fuer Berliner Event-Highlights im April.',
    17,
    true
  ),
  (
    'berlin_de',
    'berlin-berlin',
    'DE',
    'https://www.berlin.de/kultur-und-tickets/tipps/maifeiertag/',
    'html',
    'Berlin.de 1. Mai Specials',
    'Spezialseite fuer Walpurgisnacht, 1. Mai und Volksfeste in Berlin.',
    18,
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
