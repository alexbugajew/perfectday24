-- ============================================================
-- Editorial Routes Seed – Part 1: Berlin, Hamburg, München
-- 5-8 kuratierte Routen pro Stadt (Paare, JGA, Architektur, Foto-Spots)
-- Erstellt von PD24 Redaktion basierend auf Web-Recherche
-- ============================================================

begin;

do $$
declare
  v_user_id uuid := '00000000-0000-0000-0000-000000000099';
  v_cp_id   uuid;
  v_r       uuid;
begin

  -- ── Editorial auth user ───────────────────────────────────
  insert into auth.users (
    id, instance_id, aud, role,
    email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin
  ) values (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'editorial@pd24.internal', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"PD24 Redaktion"}'::jsonb,
    false
  ) on conflict (id) do nothing;

  -- ── Creator profile ───────────────────────────────────────
  insert into public.creator_profiles (
    user_id, username, display_name, bio,
    creator_type, is_verified, is_featured
  ) values (
    v_user_id,
    'pd24-redaktion',
    'PerfectDay24 Redaktion',
    'Kuratierte Tagesrouten – von der PD24 Redaktion handverlesen.',
    'editorial', true, true
  ) on conflict (user_id) do nothing;

  select id into v_cp_id
  from public.creator_profiles
  where user_id = v_user_id;

  -- ============================================================
  -- BERLIN
  -- ============================================================

  -- 1 · Paare · Verliebt an der Spree
  insert into public.user_routes (
    user_id, creator_profile_id, city_slug, title, slug, description,
    start_label, start_lat, start_lng, visibility, creator_type, tags
  ) values (
    v_user_id, v_cp_id, 'berlin-berlin',
    'Verliebt an der Spree',
    'pd24-berlin-paare-01',
    'Romantischer Spaziergang von der ikonischen Oberbaumbrücke über die East Side Gallery bis zum gemütlichen Holzmarkt – Spree-Panorama inklusive.',
    'Oberbaumbrücke', 52.5015, 13.4488, 'public', 'editorial',
    '["paare","romantisch","spaziergang","berlin"]'::jsonb
  ) returning id into v_r;
  insert into public.user_route_stops (route_id, stop_order, title, note, lat, lng, duration_min, is_required) values
    (v_r,1,'Oberbaumbrücke','Doppelstöckige Brücke mit Türmen – perfekter Startpunkt. Sonnenuntergang hier ist unvergesslich.',52.5015,13.4488,20,true),
    (v_r,2,'East Side Gallery','1,3 km Kunst auf der Berliner Mauer direkt am Spreeufer – interaktive Open-Air-Galerie.',52.5052,13.4395,30,true),
    (v_r,3,'Badeschiff Berlin','Pool in einem Frachtschiff in der Spree – Drinks mit Blick aufs Wasser.',52.4976,13.4452,25,false),
    (v_r,4,'Holzmarkt 25','Urban Village am Spreeufer mit Bars, Garten und Kunstinstallationen.',52.5133,13.4323,30,true),
    (v_r,5,'Osthafen-Brücke (Fotospot)','Perfekte Skyline-Perspektive mit Fernsehturm – besonders schön zur goldenen Stunde.',52.5050,13.4521,15,false);

  -- 2 · JGA · Hackescher Markt bis Mauerpark
  insert into public.user_routes (
    user_id, creator_profile_id, city_slug, title, slug, description,
    start_label, start_lat, start_lng, visibility, creator_type, tags
  ) values (
    v_user_id, v_cp_id, 'berlin-berlin',
    'JGA Berlin – Mitte & Prenzlauer Berg',
    'pd24-berlin-jga-01',
    'Legendärer JGA-Rundkurs: Hackescher Markt, Rooftop-Cocktails, Karaoke im Mauerpark und Berliner Nachtleben-Einstieg.',
    'Hackescher Markt', 52.5228, 13.4017, 'public', 'editorial',
    '["jga","party","nachtleben","berlin"]'::jsonb
  ) returning id into v_r;
  insert into public.user_route_stops (route_id, stop_order, title, note, lat, lng, duration_min, is_required) values
    (v_r,1,'Hackescher Markt','Beliebter Treffpunkt – Höfe, Boutiquen und erste Drinks zum Aufwärmen.',52.5228,13.4017,30,true),
    (v_r,2,'Rosenthaler Platz – Cocktailbars','Dichte Cocktailbar-Szene rund um den Platz – Banksy Bar, Weinerei & Co.',52.5298,13.4022,45,true),
    (v_r,3,'Mauerpark Karaoke (Bearpit)','Sonntags legendäres Freiluft-Karaoke im Amphitheater – auch unter der Woche toller Spot.',52.5408,13.4026,40,true),
    (v_r,4,'Prater Biergarten','Ältester Biergarten Berlins unter Kastanienbäumen – Pilsner und fränkische Bratwurst.',52.5398,13.4175,45,false),
    (v_r,5,'Boxhagener Platz','Hipster-Kiez-Zentrum mit Wochenmarkt und vielen Bars zum Weiterfeiern.',52.5142,13.4530,30,false);

  -- 3 · Architektur · Neue Berliner Mitte
  insert into public.user_routes (
    user_id, creator_profile_id, city_slug, title, slug, description,
    start_label, start_lat, start_lng, visibility, creator_type, tags
  ) values (
    v_user_id, v_cp_id, 'berlin-berlin',
    'Neue Berliner Mitte – Architektur-Spaziergang',
    'pd24-berlin-architektur-01',
    'Von Foster bis Schultes & Frank: Die architektonischen Ikonen rund ums Regierungsviertel – Bundestag, Kanzleramt, Holocaust-Mahnmal.',
    'Berliner Hauptbahnhof', 52.5251, 13.3693, 'public', 'editorial',
    '["architektur","regierungsviertel","modern","berlin"]'::jsonb
  ) returning id into v_r;
  insert into public.user_route_stops (route_id, stop_order, title, note, lat, lng, duration_min, is_required) values
    (v_r,1,'Berliner Hauptbahnhof','Größter Kreuzungsbahnhof Europas – Glasdach und Stahlkonstruktion von Meinhard von Gerkan.',52.5251,13.3693,20,true),
    (v_r,2,'Bundeskanzleramt','\"Waschmaschine\" – markanter Rundbau von Schultes & Frank direkt am Spreebogen.',52.5204,13.3687,20,true),
    (v_r,3,'Reichstag & Kuppel (Norman Foster)','Gläserne Kuppel mit Wendelrampe – Symbolbau der Demokratie, freier Eintritt nach Anmeldung.',52.5186,13.3762,40,true),
    (v_r,4,'Brandenburger Tor','Klassizistisches Wahrzeichen – beste Fotoperspektive vom Pariser Platz aus.',52.5163,13.3777,20,true),
    (v_r,5,'Holocaust-Mahnmal (Eisenman)','2711 Betonstelen auf unebenem Untergrund – beeindruckende Rauminstallation.',52.5138,13.3788,25,true);

  -- 4 · Architektur · Museumsinsel & DDR
  insert into public.user_routes (
    user_id, creator_profile_id, city_slug, title, slug, description,
    start_label, start_lat, start_lng, visibility, creator_type, tags
  ) values (
    v_user_id, v_cp_id, 'berlin-berlin',
    'Museumsinsel & DDR-Architektur',
    'pd24-berlin-architektur-02',
    'UNESCO-Welterbe Museumsinsel, Berliner Dom und die sozialistische Pracht der Karl-Marx-Allee – 3000 Jahre Kulturgeschichte in einem Spaziergang.',
    'James Simon Galerie', 52.5214, 13.3990, 'public', 'editorial',
    '["architektur","unesco","museum","ddr","berlin"]'::jsonb
  ) returning id into v_r;
  insert into public.user_route_stops (route_id, stop_order, title, note, lat, lng, duration_min, is_required) values
    (v_r,1,'James Simon Galerie (Chipperfield)','Neubau des Eingangsgebäudes der Museumsinsel – Kolonnaden und Treppen als Fotospot.',52.5214,13.3990,20,true),
    (v_r,2,'Pergamonmuseum & Bodemuseum','Klassizistische Museumsbauten auf der Insel – auch von außen architektonisch beeindruckend.',52.5211,13.3980,20,true),
    (v_r,3,'Berliner Dom','Neobarocker Prachtbau auf der Museumsinsel – Kuppel und Paradiesportal.',52.5192,13.4011,30,true),
    (v_r,4,'Fernsehturm','368 m hoch – Wahrzeichen der DDR, heute bester Aussichtspunkt der Stadt.',52.5208,13.4094,40,true),
    (v_r,5,'Karl-Marx-Allee (Strausberger Platz)','Sozialistische Prachtstraße im Zuckerbäckerstil – beeindruckende Symmetrie und Proportioen.',52.5156,13.4333,25,true);

  -- 5 · Foto-Spots · Berlin Klassiker
  insert into public.user_routes (
    user_id, creator_profile_id, city_slug, title, slug, description,
    start_label, start_lat, start_lng, visibility, creator_type, tags
  ) values (
    v_user_id, v_cp_id, 'berlin-berlin',
    'Berliner Ikonen – Die besten Foto-Spots',
    'pd24-berlin-foto-01',
    'Die meistfotografierten Orte Berlins in einem kompakten Rundgang: Gendarmenmarkt, Brandenburger Tor, Checkpoint Charlie und die Berliner Stadtmitte.',
    'Gendarmenmarkt', 52.5136, 13.3926, 'public', 'editorial',
    '["foto-spots","sightseeing","instagram","berlin"]'::jsonb
  ) returning id into v_r;
  insert into public.user_route_stops (route_id, stop_order, title, note, lat, lng, duration_min, is_required) values
    (v_r,1,'Gendarmenmarkt','Schönster Platz Berlins – Konzerthaus zwischen Deutschem und Französischem Dom.',52.5136,13.3926,20,true),
    (v_r,2,'Checkpoint Charlie','Ehemaliger US-Kontrollpunkt – Symbolort des Kalten Krieges mit Freilichtmuseum.',52.5076,13.3904,20,true),
    (v_r,3,'Potsdamer Platz','Modernes Aushängeschild Berlins – Sony Center Glaskuppel ist ein Top-Fotospot.',52.5096,13.3759,20,true),
    (v_r,4,'Brandenburger Tor (Sonnenuntergang)','Bestes Licht abends von Osten – Quadriga in der Abendsonne.',52.5163,13.3777,25,true),
    (v_r,5,'Siegessäule (Tiergarten)','Goldene Viktoria auf 67 m – Panoramablick über den Tiergarten zur Stadtmitte.',52.5144,13.3503,20,false);

  -- 6 · Paare · Kreuzberg & Landwehrkanal
  insert into public.user_routes (
    user_id, creator_profile_id, city_slug, title, slug, description,
    start_label, start_lat, start_lng, visibility, creator_type, tags
  ) values (
    v_user_id, v_cp_id, 'berlin-berlin',
    'Kreuzberg – Kanalromantik & Kiezspazierganz',
    'pd24-berlin-paare-02',
    'Entspannter Nachmittag zu zweit: Bergmannstraße bummeln, Viktoriapark picknicken, Admiralbrücke verweilen – das echte Kreuzberg.',
    'Bergmannstraße', 52.4877, 13.3970, 'public', 'editorial',
    '["paare","kiez","entspannt","berlin"]'::jsonb
  ) returning id into v_r;
  insert into public.user_route_stops (route_id, stop_order, title, note, lat, lng, duration_min, is_required) values
    (v_r,1,'Bergmannstraße','Kultige Einkaufsmeile in Kreuzberg – Cafés, Vintage-Shops und türkische Delikatessen.',52.4877,13.3970,30,true),
    (v_r,2,'Chamissoplatz','Gründerzeitviertel mit Wochenmarkt – besonders schön an Sommerabenden.',52.4875,13.3908,20,true),
    (v_r,3,'Viktoriapark','Höchster natürlicher Hügel Berlins mit Wasserfall – Picknick mit Stadtblick.',52.4867,13.3879,30,true),
    (v_r,4,'Landwehrkanal / Admiralbrücke','Beliebtester Treffpunkt Berlins am Kanal – abends Gitarrenklang und Picknick.',52.4904,13.4204,30,true),
    (v_r,5,'Görlitzer Park','Weitläufiger Park mit internationalem Flair – Kaffee und Entspannung.',52.4950,13.4370,20,false);

  -- 7 · JGA · East Side & Techno-Viertel
  insert into public.user_routes (
    user_id, creator_profile_id, city_slug, title, slug, description,
    start_label, start_lat, start_lng, visibility, creator_type, tags
  ) values (
    v_user_id, v_cp_id, 'berlin-berlin',
    'JGA Berlin – Street Art & Club-Viertel',
    'pd24-berlin-jga-02',
    'Der alternative JGA: East Side Gallery, Street-Art-Touren in Friedrichshain und Einstieg in Berlins legendäres Nachtleben.',
    'Warschauer Straße', 52.5079, 13.4490, 'public', 'editorial',
    '["jga","street-art","techno","berlin"]'::jsonb
  ) returning id into v_r;
  insert into public.user_route_stops (route_id, stop_order, title, note, lat, lng, duration_min, is_required) values
    (v_r,1,'Warschauer Straße (Doppeldecker-Brücke)','Inoffizieller Eingang zu Berlins Party-Viertel – Street Art und Graffiti überall.',52.5079,13.4490,15,true),
    (v_r,2,'East Side Gallery','Größtes Open-Air-Street-Art-Museum der Welt an der ehemaligen Mauer.',52.5052,13.4395,30,true),
    (v_r,3,'RAW-Gelände','Ehemaliges Bahnbetriebswerk – heute Clubs, Kletterhalle, Flohmarkt und Skaterbahn.',52.5087,13.4537,40,true),
    (v_r,4,'Holzmarkt 25','Kreative Gemeinschaft am Spreeufer mit Bar, Restaurant und Biergarten.',52.5133,13.4323,30,true),
    (v_r,5,'Club der Visionäre','Kultiger Outdoor-Club auf einem Holzponton an der Spree – elektronische Musik.',52.5020,13.4451,45,false);

  -- ============================================================
  -- HAMBURG
  -- ============================================================

  -- 8 · Paare · Speicherstadt für Zwei
  insert into public.user_routes (
    user_id, creator_profile_id, city_slug, title, slug, description,
    start_label, start_lat, start_lng, visibility, creator_type, tags
  ) values (
    v_user_id, v_cp_id, 'hamburg-hamburg',
    'Speicherstadt für Zwei – romantische Kanaltour',
    'pd24-hamburg-paare-01',
    'Das UNESCO-Welterbe Speicherstadt bei romantischem Licht: Wasserschloss, Brücken, Fleete und die Plaza der Elbphilharmonie als Abschluss.',
    'Elbphilharmonie', 53.5413, 9.9841, 'public', 'editorial',
    '["paare","romantisch","hafencity","hamburg"]'::jsonb
  ) returning id into v_r;
  insert into public.user_route_stops (route_id, stop_order, title, note, lat, lng, duration_min, is_required) values
    (v_r,1,'Elbphilharmonie Plaza','Öffentliche Aussichtsplattform in 37 m – kostenlos, atemberaubender Hafen- und Stadtblick.',53.5413,9.9841,30,true),
    (v_r,2,'Poggenmühlenbrücke (Wasserschloss-Blick)','Bester Blick auf das Wasserschloss mitten in den Fleeten – Hamburgs meistfotografierter Ort.',53.5432,9.9953,20,true),
    (v_r,3,'Fleetschlösschen','Rotes Backsteingebäude auf einer Flussinsel – Café mit Blick auf die Kanäle.',53.5432,9.9986,25,true),
    (v_r,4,'Speicherstadt bei Abenddämmerung','Beleuchtete Lagerhäuser spiegeln sich in den Fleeten – magische Atmosphäre.',53.5440,9.9960,20,false),
    (v_r,5,'Schwanenwikbrücke (Liebesschlösser)','Romantische Hängebrücke mit Liebesschlössern über der Außenalster.',53.5574,10.0151,15,true);

  -- 9 · JGA · St. Pauli & Landungsbrücken
  insert into public.user_routes (
    user_id, creator_profile_id, city_slug, title, slug, description,
    start_label, start_lat, start_lng, visibility, creator_type, tags
  ) values (
    v_user_id, v_cp_id, 'hamburg-hamburg',
    'JGA Hamburg – Hafen, Fischmarkt & Kiez',
    'pd24-hamburg-jga-01',
    'Der klassische Hamburger JGA: Landungsbrücken, Fischmarkt-Atmosphäre, Reeperbahn und das legendäre St. Pauli Nachtleben.',
    'Landungsbrücken', 53.5447, 9.9666, 'public', 'editorial',
    '["jga","stpauli","hafen","hamburg"]'::jsonb
  ) returning id into v_r;
  insert into public.user_route_stops (route_id, stop_order, title, note, lat, lng, duration_min, is_required) values
    (v_r,1,'Landungsbrücken','Maritimes Tor zur Welt – Hafenrundfahrten, Fischbrötchen und Hafenblick.',53.5447,9.9666,30,true),
    (v_r,2,'Fischmarkt Hamburg','Sonntags ab 5 Uhr oder tagsüber für Atmosphäre – Fischbrötchen und Marktleben.',53.5443,9.9654,25,true),
    (v_r,3,'Reeperbahn / Spielbudenplatz','Hamburgs berühmteste Partymeile – Bars, Clubs und Entertainment.',53.5489,9.9596,60,true),
    (v_r,4,'Mojo Club / Nachtleben-Einstieg','Legendäre Jazzbar direkt an der Reeperbahn – Warm-up für die Nacht.',53.5487,9.9614,45,false),
    (v_r,5,'Millerntor-Stadion (FC St. Pauli)','Kult-Stadion des Kiezclubs – Fan-Shop und Fotospot für echte Hamburger.',53.5530,9.9649,20,false);

  -- 10 · Architektur · Backstein-Expressionismus
  insert into public.user_routes (
    user_id, creator_profile_id, city_slug, title, slug, description,
    start_label, start_lat, start_lng, visibility, creator_type, tags
  ) values (
    v_user_id, v_cp_id, 'hamburg-hamburg',
    'Backstein-Expressionismus – UNESCO Kontorhausviertel',
    'pd24-hamburg-architektur-01',
    'Das UNESCO-Welterbe Kontorhausviertel: Chilehaus mit Schiffsbug, Sprinkenhof und das Afrikahaus – Expressionismus in rotem Backstein.',
    'Chilehaus', 53.5476, 9.9966, 'public', 'editorial',
    '["architektur","unesco","expressionismus","hamburg"]'::jsonb
  ) returning id into v_r;
  insert into public.user_route_stops (route_id, stop_order, title, note, lat, lng, duration_min, is_required) values
    (v_r,1,'Chilehaus','UNESCO-Welterbe: Bürohaus mit spitzem Schiffsbug – Meisterwerk des Backsteinexpressionismus (1924).',53.5476,9.9966,25,true),
    (v_r,2,'Sprinkenhof','Größtes Backsteingebäude Hamburgs – aufwändige Terrakotta-Ornamentik an den Fassaden.',53.5483,9.9983,20,true),
    (v_r,3,'Afrikahaus','Expressionistischer Kontorhaus-Bau mit beeindruckender Loggia und Reliefs.',53.5469,9.9952,15,true),
    (v_r,4,'Meßberg U-Bahn-Halle','Einer der schönsten U-Bahn-Bahnhöfe Deutschlands – Backsteingewölbe unter der Erde.',53.5480,9.9972,15,true),
    (v_r,5,'Deichstraße','Älteste erhaltene Straße Hamburgs mit Speichergebäuden aus dem 17. Jahrhundert.',53.5489,9.9896,20,false);

  -- 11 · Architektur · Elbphilharmonie & HafenCity
  insert into public.user_routes (
    user_id, creator_profile_id, city_slug, title, slug, description,
    start_label, start_lat, start_lng, visibility, creator_type, tags
  ) values (
    v_user_id, v_cp_id, 'hamburg-hamburg',
    'Elbphilharmonie & HafenCity – Zeitgenössische Architektur',
    'pd24-hamburg-architektur-02',
    'Hamburgs neues Stadtquartier: Elbphilharmonie von Herzog & de Meuron, Unilever-Haus und die modernen Wohnquartiere am Wasser.',
    'Elbphilharmonie', 53.5413, 9.9841, 'public', 'editorial',
    '["architektur","hafencity","modern","hamburg"]'::jsonb
  ) returning id into v_r;
  insert into public.user_route_stops (route_id, stop_order, title, note, lat, lng, duration_min, is_required) values
    (v_r,1,'Elbphilharmonie (Herzog & de Meuron)','Wellenförmige Glasfassade auf historischem Kaispeicher – Konzertsaal und Plaza.',53.5413,9.9841,30,true),
    (v_r,2,'Unilever-Haus (Behnisch)','Spektakulärer Glaspalast mit begrüntem Atrium an der HafenCity-Promenade.',53.5402,9.9784,20,true),
    (v_r,3,'Marco Polo Terrassen','Terrassenanlage mit Hafenpanorama – die schönste öffentliche Promenade der HafenCity.',53.5393,9.9769,20,true),
    (v_r,4,'Baakenhafen Brücke','Moderne Fußgängerbrücke mit Blick auf das neue Wohnviertel Baakenhafen.',53.5362,9.9952,15,false),
    (v_r,5,'Miniatur Wunderland / Speicherblock B','Speicherblock-Architektur von außen – massive Klinkerfassaden direkt am Fleet.',53.5434,9.9943,15,false);

  -- 12 · Foto · Hafen & Elbe
  insert into public.user_routes (
    user_id, creator_profile_id, city_slug, title, slug, description,
    start_label, start_lat, start_lng, visibility, creator_type, tags
  ) values (
    v_user_id, v_cp_id, 'hamburg-hamburg',
    'Hamburg von seiner besten Seite – Hafen-Fotospots',
    'pd24-hamburg-foto-01',
    'Die schönsten Fotoperspektiven Hamburgs: Elbphilharmonie, Speicherstadt-Fleete, Elbstrand und der Blick vom Museumshafen Övelgönne.',
    'Elbphilharmonie Plaza', 53.5413, 9.9841, 'public', 'editorial',
    '["foto-spots","hafen","panorama","hamburg"]'::jsonb
  ) returning id into v_r;
  insert into public.user_route_stops (route_id, stop_order, title, note, lat, lng, duration_min, is_required) values
    (v_r,1,'Elbphilharmonie Plaza','Bester Stadtpanorama-Blick – kostenlos zugänglich, keine Reservierung nötig.',53.5413,9.9841,25,true),
    (v_r,2,'Poggenmühlenbrücke (Wasserschloss)','Hamburgs meistfotografierter Kanal-Spot – Elbphilharmonie im Hintergrund möglich.',53.5432,9.9953,20,true),
    (v_r,3,'Pegelturm (Baumwall)','Historischer Pegelturm am Binnenhafen – Hafen-Flair mit Brücken und Booten.',53.5459,9.9876,15,false),
    (v_r,4,'Elbstrand Övelgönne','Stadtstrand direkt an der Elbe – einlaufende Containerriesen aus nächster Nähe.',53.5437,9.8929,30,true),
    (v_r,5,'Museumshafen Övelgönne','Historische Dampfschiffe und Schlepper – nostalgischer Hafenblick abseits der Touristenströme.',53.5439,9.8966,25,true);

  -- 13 · Paare · Alster Romantik
  insert into public.user_routes (
    user_id, creator_profile_id, city_slug, title, slug, description,
    start_label, start_lat, start_lng, visibility, creator_type, tags
  ) values (
    v_user_id, v_cp_id, 'hamburg-hamburg',
    'Alster-Romantik – Spaziergang für Zwei',
    'pd24-hamburg-paare-02',
    'Entlang der Alster: Jungfernstieg, Alsterarkaden, Binnenalster und die stille Außenalsterpromenade – Hamburgs grüne Wasserseele.',
    'Jungfernstieg', 53.5536, 9.9923, 'public', 'editorial',
    '["paare","alster","spaziergang","hamburg"]'::jsonb
  ) returning id into v_r;
  insert into public.user_route_stops (route_id, stop_order, title, note, lat, lng, duration_min, is_required) values
    (v_r,1,'Jungfernstieg','Hamburgs Prachtboulevard an der Binnenalster – Café-Terrassen mit Wasserblick.',53.5536,9.9923,20,true),
    (v_r,2,'Alsterarkaden','Elegante Einkaufspassage im venezianischen Stil – Kaffee und Blick auf das Wasser.',53.5489,9.9989,20,true),
    (v_r,3,'Binnenalster (Fontäne)','Malerischer Stadtsee mit der berühmten Fontäne im Zentrum Hamburgs.',53.5561,9.9933,15,true),
    (v_r,4,'Außenalster Promenade','Ruhige Grünanlage rund um den großen Alster-See – Ruderboote mieten.',53.5618,10.0026,45,true),
    (v_r,5,'Schwanenwikbrücke','Romantische Hängebrücke mit Liebesschlössern – stille Ecke abseits des Trubels.',53.5574,10.0151,15,false);

  -- 14 · JGA · Altona & Blankenese
  insert into public.user_routes (
    user_id, creator_profile_id, city_slug, title, slug, description,
    start_label, start_lat, start_lng, visibility, creator_type, tags
  ) values (
    v_user_id, v_cp_id, 'hamburg-hamburg',
    'JGA Hamburg – Altona, Elbe & Treppenviertel',
    'pd24-hamburg-jga-02',
    'Entspannter JGA-Tag mit Elb-Feeling: Fischmarkt, Elbstrand, Museumshafen und das malerische Treppenviertel in Blankenese.',
    'Altonaer Rathaus', 53.5488, 9.9357, 'public', 'editorial',
    '["jga","altona","elbe","hamburg"]'::jsonb
  ) returning id into v_r;
  insert into public.user_route_stops (route_id, stop_order, title, note, lat, lng, duration_min, is_required) values
    (v_r,1,'Altonaer Rathaus','Imposanter Gründerzeitbau – Startpunkt im schicken Altona-Viertel.',53.5488,9.9357,15,true),
    (v_r,2,'Fischmarkt Altona','Hamburgs bekanntester Markt – Fischbrötchen, Obst und Rummel.',53.5443,9.9654,30,true),
    (v_r,3,'Elbstrand (Strandperle)','Urbanster Stadtstrand Deutschlands – Kult-Kiosk direkt an der Elbe mit Blick auf Containerschiffe.',53.5437,9.9017,40,true),
    (v_r,4,'Museumshafen Övelgönne','Nostalgie-Hafen mit historischen Schiffen – Fotokulisse und Café.',53.5439,9.8966,25,false),
    (v_r,5,'Blankenese Treppenviertel','Pittoreskes Fischerdorf-Viertel mit 58 Treppen und Gassen direkt an der Elbe.',53.5606,9.7980,40,true);

  -- ============================================================
  -- MÜNCHEN
  -- ============================================================

  -- 15 · Paare · Englischer Garten
  insert into public.user_routes (
    user_id, creator_profile_id, city_slug, title, slug, description,
    start_label, start_lat, start_lng, visibility, creator_type, tags
  ) values (
    v_user_id, v_cp_id, 'muenchen',
    'Verliebt im Englischen Garten',
    'pd24-muenchen-paare-01',
    'Münchens grünes Herz zu zweit erleben: Monopteros-Panorama, Eisbachwelle, Chinesischer Turm und stiller Kleinhesseloher See.',
    'Monopteros', 48.1455, 11.5856, 'public', 'editorial',
    '["paare","englischer-garten","natur","muenchen"]'::jsonb
  ) returning id into v_r;
  insert into public.user_route_stops (route_id, stop_order, title, note, lat, lng, duration_min, is_required) values
    (v_r,1,'Monopteros','Klassizistischer Rundtempel auf Hügel – bestes Panorama auf die Münchner Türme.',48.1455,11.5856,20,true),
    (v_r,2,'Eisbachwelle (Surfer)','Mitten im Park surfen – legendäres Münchner Phänomen, das einzigartig auf der Welt ist.',48.1427,11.5878,20,true),
    (v_r,3,'Chinesischer Turm Biergarten','Ältester und beliebtester Biergarten der Stadt – 7.000 Plätze unter Kastanienbäumen.',48.1546,11.5907,45,true),
    (v_r,4,'Kleinhesseloher See (Seehaus)','Idyllischer See mit Ruderbooten mieten – romantisches Café am Ufer.',48.1643,11.5867,40,true),
    (v_r,5,'Japanisches Teehaus','Verborgenes Juwel: Authentisches Teehaus auf einer kleinen Insel im Westpark.',48.1609,11.5925,20,false);

  -- 16 · JGA · Maxvorstadt & Schwabing
  insert into public.user_routes (
    user_id, creator_profile_id, city_slug, title, slug, description,
    start_label, start_lat, start_lng, visibility, creator_type, tags
  ) values (
    v_user_id, v_cp_id, 'muenchen',
    'JGA München – Maxvorstadt & Schwabing',
    'pd24-muenchen-jga-01',
    'Kunstmeile trifft Partymeile: Pinakotheken-Pflaster, Siegestor-Selfies, Münchner Freiheit und die Bar-Szene der Leopoldstraße.',
    'Siegestor', 48.1504, 11.5788, 'public', 'editorial',
    '["jga","schwabing","bars","muenchen"]'::jsonb
  ) returning id into v_r;
  insert into public.user_route_stops (route_id, stop_order, title, note, lat, lng, duration_min, is_required) values
    (v_r,1,'Siegestor','Triumphbogen mit Inschrift „Dem Sieg geweiht, vom Krieg zerstört, zum Frieden mahnend" – Fotospot.',48.1504,11.5788,15,true),
    (v_r,2,'Pinakotheken-Vorplatz','Drei Weltklasse-Museen auf einem Platz – Freilichtgalerie mit modernen Skulpturen.',48.1484,11.5716,20,true),
    (v_r,3,'Leopoldstraße','Münchens Flaniermeile – Cafés, Bars und die perfekte Selfie-Straße Richtung Freiheit.',48.1560,11.5805,25,true),
    (v_r,4,'Münchner Freiheit','Belebter Platz mit Terrassencafés – Herz von Schwabing.',48.1631,11.5815,30,true),
    (v_r,5,'Schwabing Bar-Meile (Feilitschstraße)','Kleine Bars und Cocktailbuden – entspannter Einstieg in Münchens Nachtleben.',48.1610,11.5790,60,false);

  -- 17 · Architektur · Moderne Ikonen
  insert into public.user_routes (
    user_id, creator_profile_id, city_slug, title, slug, description,
    start_label, start_lat, start_lng, visibility, creator_type, tags
  ) values (
    v_user_id, v_cp_id, 'muenchen',
    'Moderne Architektur-Ikonen Münchens',
    'pd24-muenchen-architektur-01',
    'BMW Welt, Olympiapark und Museum Brandhorst – Münchens Highlights zeitgenössischer Architektur aus fünf Jahrzehnten.',
    'BMW Welt', 48.1767, 11.5585, 'public', 'editorial',
    '["architektur","modern","olympiapark","muenchen"]'::jsonb
  ) returning id into v_r;
  insert into public.user_route_stops (route_id, stop_order, title, note, lat, lng, duration_min, is_required) values
    (v_r,1,'BMW Welt','Spektakulärer Doppelkegel-Bau von Coop Himmelb(l)au – kostenloser Eintritt, futuristische Architektur.',48.1767,11.5585,30,true),
    (v_r,2,'Olympiaturm (Günter Behnisch)','Ikone der 1970er: 291 m hoher Turm mit TV-Antenne – Zeltdach-Konstruktion ist einzigartig.',48.1740,11.5518,30,true),
    (v_r,3,'Olympiastadion Zeltdach','Luftiges Hängedach von Behnisch – Architektur-Weltklasse, frei zugänglich von außen.',48.1733,11.5462,20,true),
    (v_r,4,'Museum Brandhorst (Sauerbruch Hutton)','36.000 Keramikstäbchen als Fassade – Farbenfrohes Highlight im Kunstareal.',48.1472,11.5704,25,true),
    (v_r,5,'Endlose Treppe (Ólafur Eliasson)','9 m hohe Doppelspiraltreppe im Münchner Westend – Kunst im öffentlichen Raum.',48.1411,11.5508,15,false);

  -- 18 · Foto · Münchner Postkarten-Klassiker
  insert into public.user_routes (
    user_id, creator_profile_id, city_slug, title, slug, description,
    start_label, start_lat, start_lng, visibility, creator_type, tags
  ) values (
    v_user_id, v_cp_id, 'muenchen',
    'Münchner Klassiker – Die perfekten Foto-Spots',
    'pd24-muenchen-foto-01',
    'Marienplatz, Frauenkirche, Viktualienmarkt und Hackerbrücke – die ikonischsten Fotomotive Münchens in einem kompakten Rundgang.',
    'Marienplatz', 48.1372, 11.5755, 'public', 'editorial',
    '["foto-spots","innenstadt","klassiker","muenchen"]'::jsonb
  ) returning id into v_r;
  insert into public.user_route_stops (route_id, stop_order, title, note, lat, lng, duration_min, is_required) values
    (v_r,1,'Marienplatz & Neues Rathaus','Münchens gute Stube – Glockenspiel um 11, 12 und 17 Uhr. Bester Fotospot ist die Galeria-Terrasse.',48.1372,11.5755,30,true),
    (v_r,2,'Frauenkirche','Wahrzeichen Münchens mit Zwillingstürmen – Panoramablick von der Galerie.',48.1387,11.5736,20,true),
    (v_r,3,'Viktualienmarkt','Ältester Markt Münchens – Blumengeschäfte, Delikatessen und der Biergarten mitten drin.',48.1351,11.5762,25,true),
    (v_r,4,'Hackerbrücke (Sonnenuntergang)','Denkmalgeschützte Stahlbogenkonstruktion – beste Fotoperspektive bei tiefstehender Sonne.',48.1428,11.5548,20,true),
    (v_r,5,'Olympiapark-See (Panorama)','Malerischer See mit Blick auf Olympiaturm und Stadion – perfekt bei Spiegelung im Wasser.',48.1759,11.5519,25,false);

  -- 19 · Paare · Isar-Romantik
  insert into public.user_routes (
    user_id, creator_profile_id, city_slug, title, slug, description,
    start_label, start_lat, start_lng, visibility, creator_type, tags
  ) values (
    v_user_id, v_cp_id, 'muenchen',
    'Isar-Romantik – Fluss, Brücken & Altstadt',
    'pd24-muenchen-paare-02',
    'Entlang der Isar: Maximilianeum-Panorama, Praterinsel, Deutsches Museum und das historische Isartor – romantisches München abseits der Touristenmassen.',
    'Maximilianeum', 48.1340, 11.5920, 'public', 'editorial',
    '["paare","isar","altstadt","muenchen"]'::jsonb
  ) returning id into v_r;
  insert into public.user_route_stops (route_id, stop_order, title, note, lat, lng, duration_min, is_required) values
    (v_r,1,'Maximilianeum (Blick von der Brücke)','Sitz des Bayerischen Landtags – bester Blick von der Maximiliansbrücke auf den Prachtbau.',48.1340,11.5920,15,true),
    (v_r,2,'Maximiliansbrücke (Praterinsel-Blick)','Brücke mit Blick auf die grüne Praterinsel – Isartal-Panorama.',48.1357,11.5882,15,true),
    (v_r,3,'Praterinsel (Kiesinsel)','Grüne Insel in der Isar – perfekt zum Picknicken mit den Füßen im Wasser.',48.1323,11.5894,30,true),
    (v_r,4,'Deutsches Museum (Außenansicht)','Insel mit weltgrößtem Technikmuseum – auch von außen imposant am Isartor.',48.1299,11.5822,20,false),
    (v_r,5,'Isartor','Östlichstes der drei Münchner Stadttore – mittelalterlich und fotogen.',48.1337,11.5800,15,true);

  -- 20 · Architektur · Historisches München
  insert into public.user_routes (
    user_id, creator_profile_id, city_slug, title, slug, description,
    start_label, start_lat, start_lng, visibility, creator_type, tags
  ) values (
    v_user_id, v_cp_id, 'muenchen',
    'Historisches München – Residenz & Odeonsplatz',
    'pd24-muenchen-architektur-02',
    'Bayerns königliches Erbe: Feldherrnhalle, Theatinerkirche, Hofgarten und die Residenz mit dem ältesten Renaissance-Gewölbe Europas.',
    'Odeonsplatz', 48.1431, 11.5778, 'public', 'editorial',
    '["architektur","historisch","residenz","muenchen"]'::jsonb
  ) returning id into v_r;
  insert into public.user_route_stops (route_id, stop_order, title, note, lat, lng, duration_min, is_required) values
    (v_r,1,'Odeonsplatz','Münchens elegantester Platz – Blick auf Feldherrnhalle und Theatinerkirche.',48.1431,11.5778,15,true),
    (v_r,2,'Feldherrnhalle','Neo-Renaissance-Loggia nach Florentiner Vorbild – historisch bedeutsam und fotogen.',48.1427,11.5773,15,true),
    (v_r,3,'Theatinerkirche','Italianisierende Barockkirche mit Zwillings-Glockentürmen – Interieur in leuchtendem Weiß.',48.1426,11.5768,20,true),
    (v_r,4,'Hofgarten','Geometrisch gestalteter Barockgarten hinter der Residenz – Diana-Tempel im Zentrum.',48.1430,11.5803,20,true),
    (v_r,5,'Residenz München & Antiquarium','Größte Stadtresidenz der Welt – Antiquarium: ältestes und schönstes Renaissance-Gewölbe nördlich der Alpen.',48.1403,11.5784,35,true);

  -- 21 · JGA · Oktoberfest-Feeling & Biergärten
  insert into public.user_routes (
    user_id, creator_profile_id, city_slug, title, slug, description,
    start_label, start_lat, start_lng, visibility, creator_type, tags
  ) values (
    v_user_id, v_cp_id, 'muenchen',
    'JGA München – Wiesn-Feeling & Biergärten',
    'pd24-muenchen-jga-02',
    'Bayern-JGA at its finest: Bavaria-Statue, Theresienwiese, Augustinerkeller und die besten Münchner Biergärten.',
    'Theresienwiese', 48.1317, 11.5499, 'public', 'editorial',
    '["jga","bier","oktoberfest","muenchen"]'::jsonb
  ) returning id into v_r;
  insert into public.user_route_stops (route_id, stop_order, title, note, lat, lng, duration_min, is_required) values
    (v_r,1,'Bavaria-Statue & Ruhmeshalle','18 m hohe Bronzestatue – begehbar, Blick über die Theresienwiese.',48.1297,11.5491,20,true),
    (v_r,2,'Theresienwiese','Das Oktoberfest-Gelände – auch außerhalb der Festzeit beeindruckende Größe.',48.1317,11.5499,15,true),
    (v_r,3,'Augustinerkeller Biergarten','Ältester Biergarten Münchens unter alten Kastanien – direkten Kellerbier-Ausschank.',48.1456,11.5499,60,true),
    (v_r,4,'Löwenbräukeller','Traditionelles Brauhaus in einem Gründerzeitbau – Bier direkt vom Fass.',48.1476,11.5517,45,true),
    (v_r,5,'Hirschgarten Biergarten','Größter Biergarten Europas mit 8.000 Plätzen im Nymphenburger Schlosspark.',48.1536,11.5064,45,false);

end $$;

commit;
