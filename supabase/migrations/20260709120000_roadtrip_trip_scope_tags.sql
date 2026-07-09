-- Roadtrip Tages-Timing: explizite Per-Route-Flags statt reiner Distanz-Heuristik.
--
-- Die Detailseite (app/roadtrip/routes/[slug]/page.tsx) entscheidet über den
-- Tagesstart einer Route:
--   Tag "local-trip"  → immer Morgenstart (~09:30), kein Anreise-Nachmittag
--   Tag "road-trip"   → immer Nachmittags-Anreisetag (echte Fernstrecke)
--   ohne Tag          → geografische Spannweite entscheidet (< 45 km = lokal)
--
-- Diese Migration setzt die Flags dort, wo die Heuristik am Rand liegt:
--   • Sylt-Insel-Touren  → explizit lokal (Dörfer 7-30 km auseinander)
--   • Deutsche Weinstraße → explizit Fernstrecke (30 km, aber als Anreise-
--     Wochenende gedacht, daher bewusster Nachmittags-Check-in am Tag 1)
--
-- Idempotent: fügt den Tag nur an, wenn er noch nicht vorhanden ist.

update roadtrip_routes
set tags = array_append(tags, 'local-trip'),
    updated_at = now()
where slug in (
    'sylt-natur-slow-trail',
    'sylt-familien-inselzeit',
    'sylt-girls-getaway',
    'sylt-nightlife-beach-party'
  )
  and not (tags @> array['local-trip']::text[]);

update roadtrip_routes
set tags = array_append(tags, 'road-trip'),
    updated_at = now()
where slug = 'german-wine-route-weekender'
  and not (tags @> array['road-trip']::text[]);
