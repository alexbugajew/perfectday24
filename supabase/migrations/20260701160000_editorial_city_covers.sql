-- Editorial Cover fuer Top-Staedte
-- ============================================================================
-- Erweitert die Cities-Tabelle um kuratierte Cover-Bilder pro Stadt.
-- Fallback-Kette (Client-Seite):
--   1. cities.editorial_cover_url  (dieses Feld)
--   2. Erstes user_route.cover_image_url der Stadt
--   3. Blanker Gradient-Fallback

begin;

alter table public.cities
  add column if not exists editorial_cover_url text,
  add column if not exists editorial_cover_alt text,
  add column if not exists editorial_cover_credit text,
  add column if not exists editorial_cover_source text;

-- ─── Seed fuer Top-10 ───────────────────────────────────────────────────────
-- Alle URLs zeigen auf images.unsplash.com (bereits im Safe-Host-Whitelist
-- und in next.config remotePatterns). Falls ein Bild nicht optimal passt,
-- einfach ueber Supabase Studio ersetzen:
--   UPDATE cities SET editorial_cover_url = '<new-url>' WHERE slug = 'xxx';

update public.cities set
  editorial_cover_url    = 'https://images.unsplash.com/photo-1587330979470-3595ac045ab0?w=1400&h=700&fit=crop&auto=format&q=80',
  editorial_cover_alt    = 'Brandenburger Tor am Abend',
  editorial_cover_credit = 'Unsplash',
  editorial_cover_source = 'https://unsplash.com'
where slug = 'berlin-berlin' and editorial_cover_url is null;

update public.cities set
  editorial_cover_url    = 'https://images.unsplash.com/photo-1595867818082-083862f3d630?w=1400&h=700&fit=crop&auto=format&q=80',
  editorial_cover_alt    = 'Muenchen Innenstadt mit Frauenkirche',
  editorial_cover_credit = 'Unsplash',
  editorial_cover_source = 'https://unsplash.com'
where slug = 'muenchen' and editorial_cover_url is null;

update public.cities set
  editorial_cover_url    = 'https://images.unsplash.com/photo-1591791635441-e29e2c6c9a34?w=1400&h=700&fit=crop&auto=format&q=80',
  editorial_cover_alt    = 'Hamburg Speicherstadt am Wasser',
  editorial_cover_credit = 'Unsplash',
  editorial_cover_source = 'https://unsplash.com'
where slug = 'hamburg-hamburg' and editorial_cover_url is null;

update public.cities set
  editorial_cover_url    = 'https://images.unsplash.com/photo-1607346256330-dee7af15f7c5?w=1400&h=700&fit=crop&auto=format&q=80',
  editorial_cover_alt    = 'Koelner Dom bei Sonnenuntergang',
  editorial_cover_credit = 'Unsplash',
  editorial_cover_source = 'https://unsplash.com'
where slug = 'koeln' and editorial_cover_url is null;

update public.cities set
  editorial_cover_url    = 'https://images.unsplash.com/photo-1573599852326-2d4da0bbe613?w=1400&h=700&fit=crop&auto=format&q=80',
  editorial_cover_alt    = 'Frankfurt Skyline am Abend',
  editorial_cover_credit = 'Unsplash',
  editorial_cover_source = 'https://unsplash.com'
where slug = 'frankfurt-am-main' and editorial_cover_url is null;

update public.cities set
  editorial_cover_url    = 'https://images.unsplash.com/photo-1585065798010-0a2c1f2ee7ee?w=1400&h=700&fit=crop&auto=format&q=80',
  editorial_cover_alt    = 'Stuttgart Schlossplatz',
  editorial_cover_credit = 'Unsplash',
  editorial_cover_source = 'https://unsplash.com'
where slug = 'stuttgart' and editorial_cover_url is null;

update public.cities set
  editorial_cover_url    = 'https://images.unsplash.com/photo-1610116306796-6fea9f4fae38?w=1400&h=700&fit=crop&auto=format&q=80',
  editorial_cover_alt    = 'Duesseldorf Rheinufer mit Fernsehturm',
  editorial_cover_credit = 'Unsplash',
  editorial_cover_source = 'https://unsplash.com'
where slug = 'duesseldorf' and editorial_cover_url is null;

update public.cities set
  editorial_cover_url    = 'https://images.unsplash.com/photo-1628067213437-1c9e2ec5619e?w=1400&h=700&fit=crop&auto=format&q=80',
  editorial_cover_alt    = 'Leipziger Innenstadt',
  editorial_cover_credit = 'Unsplash',
  editorial_cover_source = 'https://unsplash.com'
where slug = 'leipzig' and editorial_cover_url is null;

update public.cities set
  editorial_cover_url    = 'https://images.unsplash.com/photo-1554236069-eb31e97cbcc4?w=1400&h=700&fit=crop&auto=format&q=80',
  editorial_cover_alt    = 'Bremer Rathaus mit Roland-Statue',
  editorial_cover_credit = 'Unsplash',
  editorial_cover_source = 'https://unsplash.com'
where slug = 'bremen' and editorial_cover_url is null;

update public.cities set
  editorial_cover_url    = 'https://images.unsplash.com/photo-1571055107559-3e67626fa8be?w=1400&h=700&fit=crop&auto=format&q=80',
  editorial_cover_alt    = 'Dresden Zwinger und Frauenkirche',
  editorial_cover_credit = 'Unsplash',
  editorial_cover_source = 'https://unsplash.com'
where slug = 'dresden' and editorial_cover_url is null;

commit;
