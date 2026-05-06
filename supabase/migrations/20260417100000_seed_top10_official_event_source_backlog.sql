alter table public.event_source_configs
  drop constraint if exists event_source_configs_provider_check;

alter table public.event_source_configs
  add constraint event_source_configs_provider_check
  check (
    provider in (
      'visitberlin',
      'berlin_de',
      'hamburg_tourism',
      'hamburg_de',
      'hamburg_infomax',
      'muenchen_de',
      'koeln_tourism',
      'frankfurt_tourism',
      'stuttgart_tourism',
      'duesseldorf_tourism',
      'leipzig_travel',
      'dresden_tourism',
      'hannover_tourism',
      'nuernberg_tourism',
      'bremen_tourism',
      'dortmund_tourism'
    )
  );

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
    'koeln_tourism',
    'koeln',
    'DE',
    'https://www.koelntourismus.de/erlebnisse-lifestyle/veranstaltungen/',
    'html',
    'KoelnTourismus Veranstaltungen',
    'Vorbereiteter offizieller Kandidat fuer Koeln. Parser und Live-Ingest folgen stadtweise.',
    40,
    false
  ),
  (
    'frankfurt_tourism',
    'frankfurt-am-main',
    'DE',
    'https://www.visitfrankfurt.travel/erleben/veranstaltungskalender',
    'html',
    'visitFrankfurt Veranstaltungskalender',
    'Vorbereiteter offizieller Kandidat fuer Frankfurt am Main. Parser und Live-Ingest folgen stadtweise.',
    41,
    false
  ),
  (
    'stuttgart_tourism',
    'stuttgart',
    'DE',
    'https://www.stuttgart-tourist.de/en',
    'html',
    'Stuttgart Tourist Event-Domain',
    'Offizielle Domain fuer Stuttgart. Der beste Listing-Pfad wird vor Parser-Freigabe noch finalisiert.',
    42,
    false
  ),
  (
    'duesseldorf_tourism',
    'duesseldorf',
    'DE',
    'https://www.visitduesseldorf.de/en/calendar-of-events',
    'html',
    'visitDuesseldorf Calendar of Events',
    'Vorbereiteter offizieller Kandidat fuer Duesseldorf. Parser und Live-Ingest folgen stadtweise.',
    43,
    false
  ),
  (
    'leipzig_travel',
    'leipzig',
    'DE',
    'https://www.leipzig.travel/en/discover/events-in-Leipzig',
    'html',
    'Leipzig Travel Events',
    'Vorbereiteter offizieller Kandidat fuer Leipzig. Parser und Live-Ingest folgen stadtweise.',
    44,
    false
  ),
  (
    'dresden_tourism',
    'dresden',
    'DE',
    'https://www.dresden.de/en/tourism/attractions/events.php',
    'html',
    'Dresden Official Events',
    'Vorbereiteter offizieller Kandidat fuer Dresden. Parser und Live-Ingest folgen stadtweise.',
    45,
    false
  ),
  (
    'hannover_tourism',
    'hannover',
    'DE',
    'https://www.visit-hannover.com/Event-Highlights,-Kultur-Freizeit/Veranstaltungen',
    'html',
    'visit Hannover Veranstaltungen',
    'Vorbereiteter offizieller Kandidat fuer Hannover. Parser und Live-Ingest folgen stadtweise.',
    46,
    false
  ),
  (
    'nuernberg_tourism',
    'nuernberg',
    'DE',
    'https://tourismus.nuernberg.de/en/events/',
    'html',
    'Nuernberg Tourismus Events',
    'Vorbereiteter offizieller Kandidat fuer Nuernberg. Parser und Live-Ingest folgen stadtweise.',
    47,
    false
  ),
  (
    'bremen_tourism',
    'bremen',
    'DE',
    'https://www.bremen.de/veranstaltungen',
    'html',
    'Bremen Veranstaltungen',
    'Vorbereiteter offizieller Kandidat fuer Bremen. Parser und Live-Ingest folgen stadtweise.',
    48,
    false
  ),
  (
    'dortmund_tourism',
    'dortmund',
    'DE',
    'https://www.dortmund-tourismus.de/',
    'html',
    'Dortmund Tourismus Einstieg',
    'Offizieller Startpunkt fuer Dortmund. Der konkrete crawlbare Kalendereinstieg wird noch finalisiert, bevor ein Parser aktiviert wird.',
    49,
    false
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
