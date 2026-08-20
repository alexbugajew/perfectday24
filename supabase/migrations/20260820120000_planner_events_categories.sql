-- Erweitert die erlaubten Event-Kategorien um 'exhibition' und 'comedy'.
--
-- Hintergrund: Die Taxonomie kannte beide nicht. Die rund 30 Stadt-Parser
-- legen Ausstellungen deshalb unter 'fair' ("Kirmes, Jahrmarkt") ab und Comedy
-- unter 'show'. Fuer den Planner war der grobe Eimer ausreichend; sobald
-- Kategorien zur Navigation werden, fuehrt er Nutzer in die Irre — die
-- groesste Kategorie enthielt ueberwiegend Malerei und Museumsprogramm.
--
-- Die Nachklassifizierung der bestehenden Zeilen passiert nach dieser
-- Migration mit `npm run events:reclassify -- --live` (rund 3.700 Zeilen).

alter table public.planner_events
  drop constraint if exists planner_events_category_check;

alter table public.planner_events
  add constraint planner_events_category_check check (
    category in (
      'concert',
      'theater',
      'show',
      'comedy',
      'exhibition',
      'market',
      'festival',
      'fair',
      'food_event',
      'community',
      'seasonal',
      'other'
    )
  );
