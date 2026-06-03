begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- Echte Transport-Dienstleister (recherchierte Anbieter, Stand 06/2026)
-- service_type = 'transport' — Limousinen, VIP-Transfer, Shuttle
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.service_providers (
  slug, name, service_type, city_slug, description,
  website_url, min_guests, max_guests, base_price_cents,
  price_unit, is_verified, status
) values

  -- ── Berlin ──────────────────────────────────────────────────────────────────

  (
    'meissner-limousine-berlin',
    'Meissner Limousine',
    'transport',
    'berlin-berlin',
    'Exklusiver Chauffeur- und Limousinenservice in Berlin. Shuttle-Service für Hochzeiten, Galas und Red-Carpet-Events. Diskret, pünktlich, repräsentativ.',
    'https://meissner-limousine.de',
    1, 6, 20000, 'total', true, 'active'
  ),
  (
    'myviplimo-berlin',
    'MyVipLimo Berlin',
    'transport',
    'berlin-berlin',
    'Hochzeitsfahrten und VIP-Transfers in Berlin mit professionellem Chauffeur. Höchste Diskretion und Zuverlässigkeit — von der Standesamt-Fahrt bis zum Empfang.',
    'https://www.myviplimo.de',
    1, 4, 18000, 'total', true, 'active'
  ),
  (
    'bavaria-limousines-berlin',
    'Bavaria Limousines Berlin',
    'transport',
    'berlin-berlin',
    'Bundesweiter Limousinenservice mit Standort Berlin. S-Klasse, Maybach und Stretch-Limousinen für Hochzeiten, Firmenfeiern und VIP-Events. Chauffeure mit min. 10 Jahren Erfahrung.',
    'https://www.bavaria-limousines.de/standorte/limousinenservice-in-deutschland/limousinenservice-berlin/',
    1, 8, 25000, 'total', true, 'active'
  ),
  (
    'pivotti-vip-liner-berlin',
    'Pivotti VIP Liner',
    'transport',
    'berlin-berlin',
    'Exklusiver Limousinen-Shuttle in Berlin für Veranstaltungen, Messen und private Feiern. Langjähriger Partner bei Großevents.',
    'https://www.pivotti.com/limousinen-service-in-berlin/',
    1, 20, 30000, 'total', false, 'active'
  ),

  -- ── Hamburg ─────────────────────────────────────────────────────────────────

  (
    'driversline-hamburg',
    'Driversline Hamburg',
    'transport',
    'hamburg-hamburg',
    'Shuttle-Service und Limousinenservice für Hochzeiten, Messen und Konferenzen in Hamburg. Mercedes-Benz Maybach und koordinierte Gästebeförderung.',
    'https://www.driversline.de/hamburg/',
    1, 50, 22000, 'total', true, 'active'
  ),
  (
    'nordtransfer-hamburg',
    'Nordtransfer Hamburg',
    'transport',
    'hamburg-hamburg',
    'Limousinenservice für besondere Anlässe in Hamburg. Hochzeitsfahrten, Shuttles für Gästegruppen und Flughafen-Transfers — individuell geplant.',
    'https://www.nordtransfer.de',
    1, 30, 18000, 'total', true, 'active'
  ),
  (
    'interline-hamburg',
    'INTERLINE Hamburg',
    'transport',
    'hamburg-hamburg',
    'Erfahrener Chauffeur- und Limousinenservice auf höchstem Niveau. Zuverlässig, sicher und professionell — für Galas, Hochzeiten und Businessevents.',
    'https://www.interline.de/en/limousine-service-hamburg',
    1, 6, 20000, 'total', true, 'active'
  ),

  -- ── München ─────────────────────────────────────────────────────────────────

  (
    'bavaria-limousines-muenchen',
    'Bavaria Limousines München',
    'transport',
    'muenchen',
    'Seit 2005 exklusiver Premium-Transfer in München und ganz Deutschland. Hochzeits-Limousinen, Oktoberfest-Shuttle, Flughafentransfers und Firmenevents.',
    'https://www.bavaria-limousines.de/chauffeur-service-muenchen/',
    1, 8, 28000, 'total', true, 'active'
  ),
  (
    'stm-vip-service-muenchen',
    'STM VIP Service',
    'transport',
    'muenchen',
    'Professioneller Chauffeur- und Busservice aus München für ganz Deutschland. Hochzeitsfahrten, Flughafentransfers und Event-Shuttle in Premiumfahrzeugen.',
    'https://st-muenchen.de',
    1, 20, 25000, 'total', true, 'active'
  ),
  (
    'luxora-vip-muenchen',
    'Luxora VIP Chauffeur',
    'transport',
    'muenchen',
    'Hochzeits-Shuttle und Chauffeurdienst in München. Elegante und komfortable Transportlösungen in exklusiven Mercedes S-Klasse Fahrzeugen.',
    'https://luxoravip.de/chauffeurdienst-munchen/',
    1, 6, 22000, 'total', false, 'active'
  ),
  (
    'm-limo-muenchen',
    'M-Limo München',
    'transport',
    'muenchen',
    'Exklusiver Limousinenservice in München. Airport-Transfers, Business-Events und Hochzeiten mit professionellen Chauffeuren und Luxusfahrzeugen.',
    'https://m-limo.de',
    1, 4, 20000, 'total', false, 'active'
  ),

  -- ── Köln ────────────────────────────────────────────────────────────────────

  (
    'vip-transfer-koeln',
    'VIP Transfer Köln',
    'transport',
    'koeln',
    'Limousinenservice mit professionell ausgebildeten Fahrern in Köln. Hochzeitsfahrten, Flughafen Köln/Bonn und Düsseldorf, VIP-Transfers für Events.',
    'http://www.vip-transfer-koeln.de',
    1, 6, 18000, 'total', true, 'active'
  ),
  (
    'luxtransfer-koeln',
    'LUXTRANSFER Köln',
    'transport',
    'koeln',
    'VIP Chauffeur- und Limousinenservice in Köln, Bonn, Düsseldorf und Frankfurt. Für Hochzeiten, Galas und Businessevents — europaweit buchbar.',
    'https://luxtransfer.de',
    1, 8, 22000, 'total', true, 'active'
  ),
  (
    'via-colonia-koeln',
    'Via Colonia',
    'transport',
    'koeln',
    'Nr. 1 Limousinenservice in Köln. Flughafen-Transfers, Hochzeitsfahrten und Stadttransfers — diskret und pünktlich.',
    'https://via-colonia.de',
    1, 4, 15000, 'total', false, 'active'
  ),

  -- ── Frankfurt ───────────────────────────────────────────────────────────────

  (
    'german-limousines-frankfurt',
    'German Limousines Frankfurt',
    'transport',
    'frankfurt-am-main',
    'Limousinenservice in Frankfurt, Berlin, Köln, Hamburg und München. Hochzeiten, Abi-Feiern und Firmenevents mit professionellem Chauffeur.',
    'https://german-limousines.de',
    1, 6, 22000, 'total', true, 'active'
  ),
  (
    'mb-limousinenservice-frankfurt',
    'MB Limousinenservice Frankfurt',
    'transport',
    'frankfurt-am-main',
    'VIP-Fahrservice in Frankfurt und ganz Deutschland. Hochzeitsfahrten, Flughafen-Transfer Frankfurt, Messen und Firmenevents.',
    'https://mb-limousinenservice.de',
    1, 4, 18000, 'total', false, 'active'
  ),

  -- ── Stuttgart ───────────────────────────────────────────────────────────────

  (
    'driveline-stuttgart',
    'driveLINE Stuttgart',
    'transport',
    'stuttgart',
    'Chauffeurservice für Hochzeiten und Gala-Events in Stuttgart. Repräsentative Limousinen, diskrete Fahrer und individuelle Planung.',
    'https://driveline-online.de',
    1, 6, 20000, 'total', true, 'active'
  ),
  (
    'bavaria-limousines-stuttgart',
    'Bavaria Limousines Stuttgart',
    'transport',
    'stuttgart',
    'S-Klasse für Termine und Empfänge, Stretch-Limousinen für Junggesellenabschiede und Hochzeitsautos in Stuttgart und Umgebung.',
    'https://www.bavaria-limousines.de/standorte/limousinenservice-in-deutschland/limousinenservice-stuttgart/',
    1, 8, 22000, 'total', true, 'active'
  ),

  -- ── Düsseldorf ──────────────────────────────────────────────────────────────

  (
    'interline-duesseldorf',
    'INTERLINE Düsseldorf',
    'transport',
    'duesseldorf',
    'Chauffeur- und Limousinenservice für Galas, Flughafen-Transfers, Businesstermine und Messen in Düsseldorf und Essen.',
    'https://www.interline-duesseldorf.de',
    1, 6, 20000, 'total', true, 'active'
  ),
  (
    'fourdrive-duesseldorf',
    'FOURDRIVE Düsseldorf',
    'transport',
    'duesseldorf',
    'Exklusive Hochzeits-Limousinen und Event-Shuttle in Düsseldorf, Köln und Bonn. Maßgeschneiderte Transportlösungen für jeden Anlass.',
    'https://www.fourdrive.de/chauffeurservice-koeln/',
    1, 10, 18000, 'total', false, 'active'
  )

on conflict (slug) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Packages
-- ─────────────────────────────────────────────────────────────────────────────

-- Meissner Limousine Berlin
insert into public.provider_packages (provider_id, name, description, price_cents, price_unit, min_guests, max_guests, includes, sort_order)
values
  ((select id from public.service_providers where slug = 'meissner-limousine-berlin'),
   'Hochzeits-Transfer (4h)', 'Repräsentative Limousine für das Brautpaar am Hochzeitstag',
   20000, 'total', 1, 4,
   '["4h Verfügbarkeit","Chauffeur in Livree","Blumendekoration auf Wunsch","Sekt an Bord","Schilderservice"]'::jsonb, 10),
  ((select id from public.service_providers where slug = 'meissner-limousine-berlin'),
   'Shuttle-Service (ganztägig)', 'Gäste-Shuttle für Hochzeiten und Events — mehrere Touren',
   45000, 'total', 5, 30,
   '["8h Verfügbarkeit","Mehrfachfahrten","Koordination mit Eventplanung","Kindersitze auf Anfrage"]'::jsonb, 20)
on conflict do nothing;

-- MyVipLimo Berlin
insert into public.provider_packages (provider_id, name, description, price_cents, price_unit, min_guests, max_guests, includes, sort_order)
values
  ((select id from public.service_providers where slug = 'myviplimo-berlin'),
   'Standesamt & Feier (3h)', 'Fahrt vom Standesamt zur Feierlichkeit',
   15000, 'total', 1, 3,
   '["Standesamt-Fahrt","Wartezeit inklusive","Fahrt zur Feier","Dekoration optional"]'::jsonb, 10),
  ((select id from public.service_providers where slug = 'myviplimo-berlin'),
   'VIP-Abend (4h)', 'Exklusive Abendfahrten für besondere Anlässe',
   18000, 'total', 1, 4,
   '["4h Verfügbarkeit","Mercedes S-Klasse oder E-Klasse","Chauffeur","Getränke"]'::jsonb, 20)
on conflict do nothing;

-- Bavaria Limousines Berlin
insert into public.provider_packages (provider_id, name, description, price_cents, price_unit, min_guests, max_guests, includes, sort_order)
values
  ((select id from public.service_providers where slug = 'bavaria-limousines-berlin'),
   'Hochzeits-Limousine (4h)', 'Mercedes S-Klasse oder Maybach für das Brautpaar',
   25000, 'total', 1, 4,
   '["4h Verfügbarkeit","Maybach oder S-Klasse","Chauffeur (10+ J. Erfahrung)","Champagner","Blumendekor","Schilderservice"]'::jsonb, 10),
  ((select id from public.service_providers where slug = 'bavaria-limousines-berlin'),
   'Stretch-Limousine JGA (4h)', 'Stretch-Limo für Junggesellenabschiede und Gruppen',
   40000, 'total', 1, 8,
   '["4h Verfügbarkeit","Stretch-Limousine","Minibar","Panoramadach","Sound-System","Chauffeur"]'::jsonb, 20)
on conflict do nothing;

-- Driversline Hamburg
insert into public.provider_packages (provider_id, name, description, price_cents, price_unit, min_guests, max_guests, includes, sort_order)
values
  ((select id from public.service_providers where slug = 'driversline-hamburg'),
   'Hochzeits-Maybach (4h)', 'Mercedes-Benz Maybach für das Brautpaar in Hamburg',
   35000, 'total', 1, 4,
   '["4h Verfügbarkeit","Maybach S-Klasse","Chauffeur in Livree","Dekoration","Champagner"]'::jsonb, 10),
  ((select id from public.service_providers where slug = 'driversline-hamburg'),
   'Event-Shuttle Koordiniert', 'Koordinierter Gäste-Shuttle für Hochzeiten und Konferenzen',
   50000, 'total', 10, 50,
   '["Mehrere Fahrzeuge","Shuttleplan","Koordinator vor Ort","Flugüberwachung optional"]'::jsonb, 20)
on conflict do nothing;

-- Bavaria Limousines München
insert into public.provider_packages (provider_id, name, description, price_cents, price_unit, min_guests, max_guests, includes, sort_order)
values
  ((select id from public.service_providers where slug = 'bavaria-limousines-muenchen'),
   'Hochzeits-Limousine (4h)', 'Premium-Hochzeitsfahrt mit Maybach oder S-Klasse in München',
   28000, 'total', 1, 4,
   '["4h Verfügbarkeit","Maybach oder S-Klasse","Chauffeur","Champagner","Blumendekor","Schilderservice"]'::jsonb, 10),
  ((select id from public.service_providers where slug = 'bavaria-limousines-muenchen'),
   'Oktoberfest-Shuttle', 'VIP-Transfer zum und vom Oktoberfest für Gruppen',
   30000, 'total', 1, 8,
   '["Hin- und Rückfahrt","Terminplanung","Minivan oder S-Klasse","Chauffeur","Reservierungen auf Anfrage"]'::jsonb, 20)
on conflict do nothing;

-- STM VIP Service München
insert into public.provider_packages (provider_id, name, description, price_cents, price_unit, min_guests, max_guests, includes, sort_order)
values
  ((select id from public.service_providers where slug = 'stm-vip-service-muenchen'),
   'VIP-Transfer einzeln', 'Einzeltransfer in Premium-Fahrzeug',
   12000, 'total', 1, 4,
   '["Direktfahrt","Chauffeur","Wasserflasche","Zeitungsservice"]'::jsonb, 10),
  ((select id from public.service_providers where slug = 'stm-vip-service-muenchen'),
   'Gruppen-Shuttle (bis 20)', 'Minibus oder Van für Gruppenfahrten',
   25000, 'total', 8, 20,
   '["Minibus oder Sprinter","Chauffeur","Mehrere Touren","Koordination"]'::jsonb, 20)
on conflict do nothing;

-- VIP Transfer Köln
insert into public.provider_packages (provider_id, name, description, price_cents, price_unit, min_guests, max_guests, includes, sort_order)
values
  ((select id from public.service_providers where slug = 'vip-transfer-koeln'),
   'Hochzeitsfahrt Köln (3h)', 'First-Class-Fahrzeug für das Brautpaar',
   18000, 'total', 1, 4,
   '["3h Verfügbarkeit","First-Class Fahrzeug","Professioneller Fahrer","Dekoration auf Wunsch"]'::jsonb, 10),
  ((select id from public.service_providers where slug = 'vip-transfer-koeln'),
   'Flughafen-Transfer CGN/DUS', 'Transfer zu den Flughäfen Köln/Bonn und Düsseldorf',
   9000, 'total', 1, 4,
   '["Pünktliche Abholung","Flugüberwachung","Kostenfreies Warten (45 Min.)","Namensschild"]'::jsonb, 20)
on conflict do nothing;

-- German Limousines Frankfurt
insert into public.provider_packages (provider_id, name, description, price_cents, price_unit, min_guests, max_guests, includes, sort_order)
values
  ((select id from public.service_providers where slug = 'german-limousines-frankfurt'),
   'Hochzeitsfahrt Frankfurt (4h)', 'Limousine mit Chauffeur für Hochzeiten in Frankfurt',
   22000, 'total', 1, 4,
   '["4h Verfügbarkeit","Limousine nach Wahl","Chauffeur","Sekt","Schilderservice"]'::jsonb, 10),
  ((select id from public.service_providers where slug = 'german-limousines-frankfurt'),
   'Messe-Transfer (halbtags)', 'Zuverlässige Transfers zur Messe Frankfurt',
   15000, 'total', 1, 4,
   '["4h Verfügbarkeit","Business-Limousine","WLAN","Getränke","Parkservice"]'::jsonb, 20)
on conflict do nothing;

-- driveLINE Stuttgart
insert into public.provider_packages (provider_id, name, description, price_cents, price_unit, min_guests, max_guests, includes, sort_order)
values
  ((select id from public.service_providers where slug = 'driveline-stuttgart'),
   'Hochzeits-Limousine (4h)', 'Repräsentative Limousine für Hochzeiten in Stuttgart',
   20000, 'total', 1, 4,
   '["4h Verfügbarkeit","Limousine nach Wahl","Chauffeur in Livree","Blumendekoration","Champagner"]'::jsonb, 10)
on conflict do nothing;

-- INTERLINE Düsseldorf
insert into public.provider_packages (provider_id, name, description, price_cents, price_unit, min_guests, max_guests, includes, sort_order)
values
  ((select id from public.service_providers where slug = 'interline-duesseldorf'),
   'Gala-Transfer Düsseldorf (4h)', 'Business-Limousine für Galas und Firmenfeiern',
   20000, 'total', 1, 4,
   '["4h Verfügbarkeit","Business-Limousine","Chauffeur","Getränke","Zeitungsservice"]'::jsonb, 10),
  ((select id from public.service_providers where slug = 'interline-duesseldorf'),
   'Messe-Shuttle Düsseldorf', 'Shuttle-Service für Messen und Konferenzen in Düsseldorf',
   28000, 'total', 1, 20,
   '["Mehrere Touren","Koordinierter Shuttle","Minivan oder Sprinter","Messeterminplanung"]'::jsonb, 20)
on conflict do nothing;

commit;
