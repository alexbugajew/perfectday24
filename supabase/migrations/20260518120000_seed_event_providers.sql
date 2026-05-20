begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- Demo-Dienstleister für Berlin (intern, noch kein echtes Partnerverhältnis)
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.service_providers (
  slug, name, service_type, city_slug, description,
  website_url, min_guests, max_guests, base_price_cents,
  price_unit, is_verified, status
) values
  (
    'spreespeicher-event-berlin',
    'Spreespeicher Event',
    'location',
    'berlin-berlin',
    'Industriecharme direkt an der Spree. Flexibel für Feiern von 30 bis 500 Personen — von der Firmenfeier bis zur Hochzeit.',
    'https://www.spreespeicher-event.de',
    30, 500, 200000, 'total', true, 'active'
  ),
  (
    'berliner-catering-gmbh',
    'Berliner Catering GmbH',
    'catering',
    'berlin-berlin',
    'Full-Service-Catering mit regionalem Fokus. Büffets, Flying Dinner und Menüs — alles aus einer Hand.',
    null,
    20, 400, 3500, 'per_person', false, 'active'
  ),
  (
    'dj-marcus-berlin',
    'DJ Marcus',
    'dj',
    'berlin-berlin',
    'Über 15 Jahre Erfahrung bei Hochzeiten und Firmenfeiern. Modern, stilsicher, professionell moderiert.',
    null,
    null, null, 60000, 'total', true, 'active'
  ),
  (
    'pixel-und-moment-berlin',
    'Pixel & Moment',
    'photography',
    'berlin-berlin',
    'Reportage-Fotografie für Events. Natürlich, ungestellt, mit Liebe zum Detail.',
    null,
    null, null, 80000, 'total', false, 'active'
  ),
  (
    'deko-style-berlin',
    'Deko & Style Berlin',
    'decoration',
    'berlin-berlin',
    'Komplette Dekorationskonzepte — von der eleganten Tischdeko bis zur Raumgestaltung.',
    null,
    20, 300, 50000, 'total', false, 'active'
  ),
  (
    'berliner-blueten',
    'Berliner Blüten',
    'florist',
    'berlin-berlin',
    'Floristik für Hochzeiten und Events. Saisonale Gestecke, Brautsträuße und Tischdekoration.',
    null,
    null, null, 30000, 'total', false, 'active'
  ),
  (
    'events-und-wort-berlin',
    'Events & Wort',
    'moderator',
    'berlin-berlin',
    'Erfahrene Moderatorin für Firmenfeiern, Hochzeiten und Konferenzen. Deutsch und Englisch.',
    null,
    null, null, 60000, 'total', true, 'active'
  ),
  (
    'party-profis-berlin',
    'Party Profis Berlin',
    'animation',
    'berlin-berlin',
    'Animationsprogramm für Kindergeburtstage und Firmenteams. Kreativ, energetisch, zuverlässig.',
    null,
    5, 80, 15000, 'total', false, 'active'
  ),
  (
    'tortenart-berlin',
    'Tortenart Berlin',
    'cake',
    'berlin-berlin',
    'Individuelle Torten für jeden Anlass — Geburtstag, Hochzeit oder Jubiläum. Alles handgemacht.',
    null,
    null, null, 12000, 'total', false, 'active'
  ),
  (
    'eventtech-berlin',
    'Eventtech Berlin',
    'technology',
    'berlin-berlin',
    'AV-Technik, Licht und Bühne. Komplett-Ausstattung für Konferenzen und Veranstaltungen.',
    null,
    null, null, 80000, 'total', false, 'active'
  ),
  (
    'teamaction-berlin',
    'TeamAction Berlin',
    'animation',
    'berlin-berlin',
    'Teambuilding-Aktivitäten: Escape Rooms, Schnitzeljagden, Kochevents und mehr.',
    null,
    8, 120, 2500, 'per_person', true, 'active'
  ),
  (
    'film-moment-berlin',
    'Film & Moment',
    'video',
    'berlin-berlin',
    'Hochzeits- und Eventvideos. Cineastisch, emotional und schnell geliefert.',
    null,
    null, null, 120000, 'total', false, 'active'
  )
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Packages
-- ─────────────────────────────────────────────────────────────────────────────

-- Spreespeicher Event
insert into public.provider_packages (provider_id, name, description, price_cents, price_unit, min_guests, max_guests, includes, sort_order) values
  (
    (select id from public.service_providers where slug = 'spreespeicher-event-berlin'),
    'Basis',
    'Raummiete inkl. Grundausstattung',
    200000,
    'total',
    30, 150,
    '["8h Raumnutzung", "Tische & Stühle", "Garderobenservice", "Ansprechperson vor Ort"]'::jsonb,
    10
  ),
  (
    (select id from public.service_providers where slug = 'spreespeicher-event-berlin'),
    'Premium',
    'Komplettpaket inkl. Dekoration und Technik-Basis',
    380000,
    'total',
    80, 500,
    '["10h Raumnutzung", "Tische, Stühle & Lounge", "Basis-Licht & Ton", "Eventkoordination", "Reinigung"]'::jsonb,
    20
  )
on conflict do nothing;

-- Berliner Catering GmbH
insert into public.provider_packages (provider_id, name, description, price_cents, price_unit, min_guests, max_guests, includes, sort_order) values
  (
    (select id from public.service_providers where slug = 'berliner-catering-gmbh'),
    'Buffet Regional',
    'Warmes und kaltes Büffet mit regionalen Produkten',
    3500,
    'per_person',
    20, 250,
    '["Vorspeisenbüffet", "2 Hauptgänge", "Dessert", "Brot & Aufschnitt", "Auf- und Abbau"]'::jsonb,
    10
  ),
  (
    (select id from public.service_providers where slug = 'berliner-catering-gmbh'),
    'Flying Dinner',
    'Elegantes Walking Dinner in 4 Gängen',
    5800,
    'per_person',
    30, 200,
    '["4 Gänge", "Servicepersonal", "Gedeck & Besteck", "Auf- und Abbau", "Getränkebegleitung optional"]'::jsonb,
    20
  ),
  (
    (select id from public.service_providers where slug = 'berliner-catering-gmbh'),
    'Fingerfood & Snacks',
    'Ideal für Cocktailevents und Empfänge',
    2200,
    'per_person',
    20, 400,
    '["12 Fingerfood-Variationen", "Servicepersonal", "Auf- und Abbau"]'::jsonb,
    30
  )
on conflict do nothing;

-- DJ Marcus
insert into public.provider_packages (provider_id, name, description, price_cents, price_unit, min_guests, max_guests, includes, sort_order) values
  (
    (select id from public.service_providers where slug = 'dj-marcus-berlin'),
    '4h Set',
    'DJ-Set für kürzere Events und Abende',
    60000,
    'total',
    null, null,
    '["4h Musik", "Professionelles Equipment", "Lichtshow Basic", "Moderation auf Wunsch"]'::jsonb,
    10
  ),
  (
    (select id from public.service_providers where slug = 'dj-marcus-berlin'),
    '6h Set inkl. Moderation',
    'Für große Feiern mit Moderationsanteil',
    90000,
    'total',
    null, null,
    '["6h Musik", "Professionelles Equipment", "Lichtshow Premium", "Vollmoderation", "Playlist-Abstimmung im Vorfeld"]'::jsonb,
    20
  )
on conflict do nothing;

-- Pixel & Moment
insert into public.provider_packages (provider_id, name, description, price_cents, price_unit, min_guests, max_guests, includes, sort_order) values
  (
    (select id from public.service_providers where slug = 'pixel-und-moment-berlin'),
    'Halbtag (4h)',
    'Reportage-Fotografie für kompakte Events',
    80000,
    'total',
    null, null,
    '["4h Reportage", "150+ bearbeitete Fotos", "Online-Galerie", "Lieferung in 14 Tagen"]'::jsonb,
    10
  ),
  (
    (select id from public.service_providers where slug = 'pixel-und-moment-berlin'),
    'Ganztag (8h)',
    'Vollständige Event-Dokumentation',
    140000,
    'total',
    null, null,
    '["8h Reportage", "300+ bearbeitete Fotos", "Online-Galerie", "Druckdateien", "Lieferung in 10 Tagen"]'::jsonb,
    20
  )
on conflict do nothing;

-- Deko & Style Berlin
insert into public.provider_packages (provider_id, name, description, price_cents, price_unit, min_guests, max_guests, includes, sort_order) values
  (
    (select id from public.service_providers where slug = 'deko-style-berlin'),
    'Tischdeko Basis',
    'Elegante Tischdekoration für alle Tische',
    50000,
    'total',
    20, 100,
    '["Tischläufer", "Vasen & Blumen", "Kerzenhalter", "Auf- und Abbau"]'::jsonb,
    10
  ),
  (
    (select id from public.service_providers where slug = 'deko-style-berlin'),
    'Raumkonzept Premium',
    'Komplette Raumgestaltung mit individuellem Konzept',
    150000,
    'total',
    50, 300,
    '["Konzeptberatung", "Tischdeko", "Eingangsbereich", "Beleuchtungskonzept", "Auf- und Abbau", "Postkarten & Namensschilder"]'::jsonb,
    20
  )
on conflict do nothing;

-- Berliner Blüten
insert into public.provider_packages (provider_id, name, description, price_cents, price_unit, min_guests, max_guests, includes, sort_order) values
  (
    (select id from public.service_providers where slug = 'berliner-blueten'),
    'Brautstrauß + Anstecker',
    'Klassische Hochzeitsblumen',
    30000,
    'total',
    null, null,
    '["1 Brautstrauß", "2 Anstecker", "Persönliche Beratung"]'::jsonb,
    10
  ),
  (
    (select id from public.service_providers where slug = 'berliner-blueten'),
    'Hochzeitspaket',
    'Komplettausstattung für die Hochzeit',
    80000,
    'total',
    null, null,
    '["Brautstrauß", "Anstecker für Bräutigam & Familie", "Tischdeko (10 Tische)", "Kirchenschmuck"]'::jsonb,
    20
  )
on conflict do nothing;

-- Events & Wort
insert into public.provider_packages (provider_id, name, description, price_cents, price_unit, min_guests, max_guests, includes, sort_order) values
  (
    (select id from public.service_providers where slug = 'events-und-wort-berlin'),
    'Moderation (4h)',
    'Professionelle Moderation für Firmenevents',
    60000,
    'total',
    null, null,
    '["Vorgespräch & Briefing", "4h Moderation vor Ort", "Ablaufplanung"]'::jsonb,
    10
  ),
  (
    (select id from public.service_providers where slug = 'events-und-wort-berlin'),
    'Freie Trauung',
    'Individuelle freie Rede für die Hochzeit',
    90000,
    'total',
    null, null,
    '["2 Vorbereitungsgespräche", "Individuelle Rede (ca. 30 Min.)", "Zeremonie-Moderation", "Manuskript als Erinnerung"]'::jsonb,
    20
  )
on conflict do nothing;

-- Party Profis
insert into public.provider_packages (provider_id, name, description, price_cents, price_unit, min_guests, max_guests, includes, sort_order) values
  (
    (select id from public.service_providers where slug = 'party-profis-berlin'),
    'Kinderprogramm 2h',
    'Animationsprogramm für Kindergeburtstage',
    15000,
    'total',
    5, 25,
    '["Spiele & Aktivitäten", "Bastelstation", "Zauberei-Einlage", "Material inklusive"]'::jsonb,
    10
  ),
  (
    (select id from public.service_providers where slug = 'party-profis-berlin'),
    'Kinderprogramm 4h',
    'Voller Nachmittag mit Programm und Abschlussshow',
    25000,
    'total',
    8, 40,
    '["Spiele & Aktivitäten", "Bastelstation", "Zauberei-Show", "Fotowand", "Material inklusive"]'::jsonb,
    20
  )
on conflict do nothing;

-- Tortenart Berlin
insert into public.provider_packages (provider_id, name, description, price_cents, price_unit, min_guests, max_guests, includes, sort_order) values
  (
    (select id from public.service_providers where slug = 'tortenart-berlin'),
    'Geburtstagstorte (bis 20 Personen)',
    '3-stöckige Torte mit individueller Dekoration',
    12000,
    'total',
    null, 20,
    '["3 Etagen", "Wunschmotiv", "Lieferung in Berlin"]'::jsonb,
    10
  ),
  (
    (select id from public.service_providers where slug = 'tortenart-berlin'),
    'Hochzeitstorte',
    'Mehrstöckige Hochzeitstorte nach Wunsch',
    35000,
    'total',
    null, 120,
    '["4–5 Etagen", "Persönliche Beratung", "Probeschnitt", "Lieferung & Aufbau"]'::jsonb,
    20
  )
on conflict do nothing;

-- Eventtech Berlin
insert into public.provider_packages (provider_id, name, description, price_cents, price_unit, min_guests, max_guests, includes, sort_order) values
  (
    (select id from public.service_providers where slug = 'eventtech-berlin'),
    'Basis-Technik',
    'PA-Anlage und Mikrofon für kleine Events',
    80000,
    'total',
    null, 100,
    '["PA-Anlage", "2 Mikrofone", "Techniker vor Ort (4h)", "Auf- und Abbau"]'::jsonb,
    10
  ),
  (
    (select id from public.service_providers where slug = 'eventtech-berlin'),
    'Konferenz-Setup',
    'Vollausstattung für Konferenzen und Präsentationen',
    180000,
    'total',
    null, 300,
    '["Beamer & Leinwand", "PA-Anlage", "4 Mikrofone", "Liveschalte-Option", "Techniker (8h)", "Auf- und Abbau"]'::jsonb,
    20
  )
on conflict do nothing;

-- TeamAction Berlin
insert into public.provider_packages (provider_id, name, description, price_cents, price_unit, min_guests, max_guests, includes, sort_order) values
  (
    (select id from public.service_providers where slug = 'teamaction-berlin'),
    'Stadtralley Berlin',
    'GPS-gestützte Teamrallye durch Berlin',
    2500,
    'per_person',
    8, 60,
    '["Vorbesprechung", "3h Ralley mit App", "Auswertung & Siegerehrung", "Getränke im Anschluss"]'::jsonb,
    10
  ),
  (
    (select id from public.service_providers where slug = 'teamaction-berlin'),
    'Kochevent Team',
    'Gemeinsam kochen und essen',
    5500,
    'per_person',
    10, 40,
    '["3h Kochkurs", "Alle Zutaten", "Moderiertes Programm", "Gemeinsames Essen", "Rezeptheft"]'::jsonb,
    20
  )
on conflict do nothing;

-- Film & Moment
insert into public.provider_packages (provider_id, name, description, price_cents, price_unit, min_guests, max_guests, includes, sort_order) values
  (
    (select id from public.service_providers where slug = 'film-moment-berlin'),
    'Highlight-Film (3–4 min)',
    'Emotionaler Kurzfilm vom Event',
    120000,
    'total',
    null, null,
    '["6h Drehtag", "Highlight-Film 3–4 Min.", "Rohmaterial optional", "Lieferung in 3 Wochen"]'::jsonb,
    10
  ),
  (
    (select id from public.service_providers where slug = 'film-moment-berlin'),
    'Hochzeitsfilm',
    'Kompletter Hochzeitsfilm inkl. Zeremonie',
    200000,
    'total',
    null, null,
    '["8h Drehtag", "Langfilm 30–50 Min.", "Highlight-Film 5 Min.", "Dankesvideo", "Lieferung in 4 Wochen"]'::jsonb,
    20
  )
on conflict do nothing;

commit;
