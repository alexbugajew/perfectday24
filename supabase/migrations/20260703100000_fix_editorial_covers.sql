-- Korrektur: 4 der 10 Editorial-Cover-URLs aus 20260701160000 waren tote
-- Unsplash-IDs (404) — Hamburg, Stuttgart, Leipzig, Bremen zeigten dadurch
-- den Gradient-Fallback. Ersatz-IDs sind live gegen images.unsplash.com
-- verifiziert (2026-07-03).
--
-- WHERE matcht gezielt die tote URL: falls ein Cover inzwischen manuell
-- ersetzt wurde, wird es NICHT ueberschrieben.
--
-- Hinweis: Verfuegbarkeit ist geprueft, Motiv-Passung bitte einmal visuell
-- checken (/explore/<slug>) und bei Bedarf in Supabase Studio tauschen.

begin;

update public.cities set
  editorial_cover_url = 'https://images.unsplash.com/photo-1552751753-0fc84ae5b6c8?w=1400&h=700&fit=crop&auto=format&q=80',
  editorial_cover_alt = 'Hamburg Hafen und Speicherstadt'
where slug = 'hamburg-hamburg'
  and editorial_cover_url like '%photo-1591791635441%';

update public.cities set
  editorial_cover_url = 'https://images.unsplash.com/photo-1563284223-333497472e88?w=1400&h=700&fit=crop&auto=format&q=80',
  editorial_cover_alt = 'Stuttgart Stadtansicht'
where slug = 'stuttgart'
  and editorial_cover_url like '%photo-1585065798010%';

update public.cities set
  editorial_cover_url = 'https://images.unsplash.com/photo-1604580864964-0462f5d5b1a8?w=1400&h=700&fit=crop&auto=format&q=80',
  editorial_cover_alt = 'Leipzig Stadtansicht'
where slug = 'leipzig'
  and editorial_cover_url like '%photo-1628067213437%';

update public.cities set
  editorial_cover_url = 'https://images.unsplash.com/photo-1528728329032-2972f65dfb3f?w=1400&h=700&fit=crop&auto=format&q=80',
  editorial_cover_alt = 'Bremen Altstadt'
where slug = 'bremen'
  and editorial_cover_url like '%photo-1554236069%';

commit;
