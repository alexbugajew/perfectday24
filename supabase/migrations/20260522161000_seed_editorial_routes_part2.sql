-- ============================================================
-- Editorial Routes Seed – Part 2: Köln, Frankfurt, Stuttgart,
--   Düsseldorf, Leipzig, Dresden
-- ============================================================

begin;

do $$
declare
  v_user_id uuid := '00000000-0000-0000-0000-000000000099';
  v_cp_id   uuid;
  v_r       uuid;
begin
  select id into v_cp_id
  from public.creator_profiles
  where user_id = v_user_id;

  if v_cp_id is null then
    raise exception 'Editorial creator profile not found – run part1 first';
  end if;

  -- ============================================================
  -- KÖLN
  -- ============================================================

  -- Paare · Dom & Rheinufer
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'koeln','Dom & Rhein – romantisches Köln','pd24-koeln-paare-01',
    'Das romantischste Köln: Dom-Silhouette, Hohenzollernbrücke mit Liebesschlössern, Rheinufer und Blick auf die Kranhäuser.',
    'Kölner Dom',50.9413,6.9583,'public','editorial','["paare","dom","rhein","koeln"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Kölner Dom (Westfassade)','UNESCO-Welterbe – zwei 157 m hohe Türme, bester Fotospot morgens ohne Menschenmassen.',50.9413,6.9583,30,true),
    (v_r,2,'Hohenzollernbrücke (Liebesschlösser)','Meistbefahrene Eisenbahnbrücke Deutschlands – Geländer mit über 1 Mio. Liebesschlössern.',50.9406,6.9600,20,true),
    (v_r,3,'Rheinboulevard (Deutzer Seite)','Breite Treppenanlage mit Panoramablick auf Dom und Altstadt – beliebtester Picknickspot.',50.9334,6.9650,30,true),
    (v_r,4,'Rheinauhafen Kranhäuser','Drei moderne Landmark-Gebäude in L-Form – erinnern an historische Hafenkräne.',50.9236,6.9617,25,true),
    (v_r,5,'Schokoladenmuseum (Außen)','Futuristisches Gebäude auf einer Halbinsel im Rhein – Schokoladenbrunnen sichtbar.',50.9268,6.9605,15,false);

  -- JGA · Kölner Altstadt & Südstadt
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'koeln','JGA Köln – Altstadt & Südstadt','pd24-koeln-jga-01',
    'Kölsch, Brauhäuser und die lebhafteste Altstadt Deutschlands: Heumayer, Früh und Reissdorf direkt am Dom.',
    'Hauptbahnhof Köln',50.9431,6.9585,'public','editorial','["jga","altstadt","kölsch","koeln"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Dom-Vorplatz & Domplatte','Zentraler Startpunkt – Selfie mit Dom-Türmen obligatorisch.',50.9413,6.9583,15,true),
    (v_r,2,'Brauhaus Früh am Dom','Traditionsbrauhaus seit 1904 – Kölsch vom Köbes direkt am Tisch nachgeschenkt.',50.9398,6.9573,45,true),
    (v_r,3,'Altstadt-Kneipenmeile (Gross St. Martin)','Enge Gassen mit Kneipen und Brauhäusern – typisch kölsche Atmosphäre.',50.9355,6.9564,60,true),
    (v_r,4,'Zülpicher Straße (Studentenmeile)','Kölns beliebteste Partystraße – günstige Bars und lebhaftes Nachtleben.',50.9215,6.9389,60,true),
    (v_r,5,'Kwartier Latäng (Südstadt)','Szeneviertel mit Independent-Bars und gemütlichen Kneipen für den Abschluss.',50.9222,6.9398,45,false);

  -- Architektur · Köln-Deutz & Moderne
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'koeln','Kölner Architektur – Dom, Kranhäuser & Rheinauhafen','pd24-koeln-architektur-01',
    'Gotik trifft Moderne: Dom, Groß St. Martin, die drei Kranhäuser und das Museum Ludwig – Kölns architektonische Vielfalt.',
    'Kölner Dom',50.9413,6.9583,'public','editorial','["architektur","dom","kranhaeuser","koeln"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Kölner Dom','Gotische Kathedrale – 632 Jahre Bauzeit, UNESCO-Welterbe.',50.9413,6.9583,35,true),
    (v_r,2,'Groß St. Martin','Romanische Kirche mit charakteristischem Vierungsturm – Herzstück der Altstadt.',50.9355,6.9560,20,true),
    (v_r,3,'Museum Ludwig (Busmann+Haberer)','Postmoderner Museumsbau mit Sägezahnfassade neben dem Dom.',50.9407,6.9590,20,true),
    (v_r,4,'Rheinauhafen Kranhäuser (Detailed)','Drei 62 m hohe Bürogebäude in L-Form von Alfons Linster – maritime Formensprache.',50.9236,6.9617,25,true),
    (v_r,5,'Colonius Fernsehturm','264 m hoher Fernsehturm – modernes Wahrzeichen der westlichen Stadtseite.',50.9438,6.9226,15,false);

  -- Foto · Köln Panoramen
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'koeln','Köln Panoramen – Top Foto-Spots','pd24-koeln-foto-01',
    'Die besten Kölner Fotoperspektiven: Rheinboulevard, Poller Wiesen, Hohenzollernbrücke und der Dom aus der Luft-Perspektive.',
    'Deutzer Brücke',50.9334,6.9650,'public','editorial','["foto-spots","panorama","rhein","koeln"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Rheinboulevard (Deutz)','Weithin sichtbare Treppenterrasse – bester Gesamtblick auf Dom und Altstadt.',50.9334,6.9650,25,true),
    (v_r,2,'Poller Wiesen','Flussinsel mit unverbautem Blick auf Kranhäuser und Dom – ideal bei Sonnenuntergang.',50.9133,6.9611,25,true),
    (v_r,3,'Hohenzollernbrücke (Mitte)','Blick über den Rhein mit Dom im Hintergrund – Liebesschlösser als Vordergrund.',50.9406,6.9600,20,true),
    (v_r,4,'KölnTriangle Aussichtsplattform','Dachterrasse des KölnTriangle-Hochhauses – Dom-Panorama aus Nordost.',50.9333,6.9661,20,true),
    (v_r,5,'Severinsbrücke (Blick Altstadt)','Suspension Bridge mit Dom-Silhouette – besonders photogen im Morgengrauen.',50.9133,6.9611,15,false);

  -- Paare · Stadtgarten & Belgisches Viertel
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'koeln','Belgisches Viertel & Stadtgarten','pd24-koeln-paare-02',
    'Kölns coolstes Kiez: Independent-Cafés, Vintage-Shops, Stadtgarten-Konzerte und der Aachener Weiher.',
    'Brüsseler Platz',50.9338,6.9369,'public','editorial','["paare","kiez","belgisches-viertel","koeln"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Brüsseler Platz','Mittelpunkt des Belgischen Viertels – abends voller Menschen mit Bier auf den Stufen von St. Michael.',50.9338,6.9369,25,true),
    (v_r,2,'Aachener Weiher','Kleiner See im Innenstadtgrün – Spaziergänger, Enten und Cafés am Ufer.',50.9271,6.9333,25,true),
    (v_r,3,'Stadtgarten','Grüner Innenstadtpark mit Jazz-Club und Open-Air-Bühne.',50.9380,6.9381,25,true),
    (v_r,4,'Ehrenstraße (Vintage-Shopping)','Kölns Flaniermeile mit Independent-Shops, Street Food und Cafés.',50.9369,6.9472,30,false),
    (v_r,5,'Rudolfplatz (Hahnentorburg)','Mittelalterliches Stadttor als Fotokulisse am Ende des Tages.',50.9369,6.9462,15,true);

  -- JGA · Severinsviertel & Rheinauhafen
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'koeln','JGA Köln – Rheinauhafen & Südstadt','pd24-koeln-jga-02',
    'Style-JGA mit Waterfront-Feeling: Kranhäuser-Fotoshooting, Aperitivo im Rheinauhafen, Südstadt-Bars.',
    'Rheinauhafen Kranhäuser',50.9236,6.9617,'public','editorial','["jga","rheinauhafen","südstadt","koeln"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Rheinauhafen Kranhäuser (Fotoshooting)','Spektakuläre Architektur als Hintergrund – goldene Stunde ab 17 Uhr ideal.',50.9236,6.9617,30,true),
    (v_r,2,'Silo 23 (Café/Bar im Rheinauhafen)','Umgebautes Getreidesilo am Rhein – Dachterrasse mit Panoramablick.',50.9248,6.9610,40,true),
    (v_r,3,'Poller Wiesen (Sundown)','Rheinufer für ein spontanes Picknick bei Sonnenuntergang.',50.9133,6.9611,30,true),
    (v_r,4,'Severinsviertel Kneipen','Authentisches Kölner Veedel mit Brauhäusern und kleinen Bars.',50.9225,6.9598,60,true),
    (v_r,5,'Sudhaus / Früh em Veedel','Brauhaus-Atmosphäre im Südviertel – Kölsch und kölsche Küche.',50.9218,6.9602,45,false);

  -- ============================================================
  -- FRANKFURT AM MAIN
  -- ============================================================

  -- Paare · Sachsenhausen & Eiserner Steg
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'frankfurt-am-main','Eiserner Steg & Sachsenhausen – Skyline zu zweit','pd24-frankfurt-paare-01',
    'Frankfurts romantischste Route: Liebesschlösser auf dem Eisernen Steg, Cider-Apfelwein in Sachsenhausen, Skyline-Blick beim Sonnenuntergang.',
    'Eiserner Steg',50.1083,8.6883,'public','editorial','["paare","sachsenhausen","skyline","frankfurt"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Eiserner Steg','Historische Hängebrücke (1868) mit 1000+ Liebesschlössern – bester Skyline-Blick von Mitte.',50.1083,8.6883,20,true),
    (v_r,2,'Sachsenhausen Ufer (Apfelwein)','Frankfurts Apfelwein-Viertel – Wagner, Dauth-Schneider und historische Wein-Läden.',50.1023,8.6857,45,true),
    (v_r,3,'Städel Museum (Museumsufer)','Weltklasse-Kunstmuseum am Main-Ufer – auch der Außenbereich ist fotogen.',50.1036,8.6725,30,false),
    (v_r,4,'Flößerbrücke (Skyline-Fotospot)','Perfekter Skyline-Blick von Sachsenhausen mit Brücke im Vordergrund.',50.0997,8.6793,20,true),
    (v_r,5,'Museumsufer Abendspaziergang','16 Museen in einer Reihe am Main-Ufer – beleuchtete Fassaden beim Abendspaziergang.',50.1036,8.6725,30,true);

  -- JGA · Skyline-Bar-Tour
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'frankfurt-am-main','JGA Frankfurt – Skyline & Rooftop-Bars','pd24-frankfurt-jga-01',
    'Mainhattan von oben: Main Tower Aussicht, Rooftop-Cocktails, Bahnhofsviertel-Bars und der bunteste Kiez Frankfurts.',
    'Main Tower',50.1128,8.6727,'public','editorial','["jga","skyline","rooftop","frankfurt"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Main Tower Aussichtsplattform','200 m hoch – beste Vogelperspektive auf Frankfurts Skyline, freier Blick ringsum.',50.1128,8.6727,30,true),
    (v_r,2,'Fressgasse','Frankfurts Gourmetmeile – erster Umtrunk bei gutem Essen.',50.1155,8.6765,30,true),
    (v_r,3,'Bahnhofsviertel (Bar-Crawl)','Frankfurts internationalster Kiez – Shisha-Cafés, Cocktailbars, Street Food.',50.1062,8.6649,60,true),
    (v_r,4,'Rotlintstraße / Nordend','Hipster-Kiez mit Independent-Bars für spätabends.',50.1285,8.6942,45,false),
    (v_r,5,'Sachsenhausen Nachtleben','Altbau-Bars in der Schweizer Straße – Frankfurts beliebteste Ausgehmeile.',50.1023,8.6857,60,true);

  -- Architektur · Bankenviertel & Skyline
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'frankfurt-am-main','Mainhattan – Skyline & Bankenviertel','pd24-frankfurt-architektur-01',
    'Europas Finanzmetropole: Commerzbank-Tower, Messeturm, EZB-Neubau – ein Spaziergang durch Frankfurts ikonische Hochhaus-Architektur.',
    'Hauptwache',50.1139,8.6787,'public','editorial','["architektur","skyline","bankenviertel","frankfurt"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Hauptwache (Baroque meets Highrise)','Historische Barockwache mit Skyline-Kulisse – Kontrast pur.',50.1139,8.6787,15,true),
    (v_r,2,'Commerzbank Tower (Foster)','259 m – Europas erster ökologischer Wolkenkratzer mit spiralförmigen Wintergärten.',50.1125,8.6719,20,true),
    (v_r,3,'Messeturm (Helmut Jahn)','256 m Spitzturm aus rotem Granit – Bleistift Frankfurts.',50.1150,8.6556,20,false),
    (v_r,4,'EZB-Neubau (Coop Himmelb(l)au)','185 m – skulpturales Hochhaus mit Markthallen-Umbau auf dem Ostend-Gelände.',50.1127,8.7186,20,true),
    (v_r,5,'Osthafen (Fotospot Skyline von Ost)','Ehemaliger Hafen – bester Blick auf Frankfurts Skyline von Osten.',50.1050,8.7102,25,true);

  -- Foto · Römerberg & Alt-Frankfurt
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'frankfurt-am-main','Römerberg & Alt-Frankfurt – historische Fotospots','pd24-frankfurt-foto-01',
    'Das historische Frankfurt: Römerberg, Kaiserdom, neue Altstadt und der Römer – die schönsten Fotomotive der rekonstruierten Altstadt.',
    'Römerberg',50.1104,8.6822,'public','editorial','["foto-spots","altstadt","roemerberg","frankfurt"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Römerberg','Frankfurts historischer Marktplatz mit Fachwerkhäusern – Gerechtigkeitsbrunnen als Mittelpunkt.',50.1104,8.6822,25,true),
    (v_r,2,'Römer (Rathaus)','Drei gotische Giebelhäuser als Rathausfassade – Symbol der Freien Reichsstadt.',50.1104,8.6822,15,true),
    (v_r,3,'Kaiserdom St. Bartholomäus','Gotischer Dom – Kaiserkrönungsort des Heiligen Römischen Reiches.',50.1100,8.6840,20,true),
    (v_r,4,'Neue Altstadt (DomRömer)','Rekonstruierte Altstadt 2018 eröffnet – 35 Häuser in historischen Stilen nachgebaut.',50.1102,8.6842,25,true),
    (v_r,5,'Eiserner Steg (Skyline-Blick)','Blick von der Mitte des Stegs Richtung Westen – Skyline plus Altstadt in einem Foto.',50.1083,8.6883,20,true);

  -- Paare · Palmengarten & Westend
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'frankfurt-am-main','Palmengarten & Westend – Grünes Frankfurt','pd24-frankfurt-paare-02',
    'Das grüne Gesicht Frankfurts: Palmengarten, Grüneburgpark und das elegante Westend-Viertel mit seinen Gründerzeitbauten.',
    'Palmengarten',50.1243,8.6550,'public','editorial','["paare","natur","westend","frankfurt"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Palmengarten','Ältester botanischer Garten Deutschlands – Gewächshäuser und Rosengarten.',50.1243,8.6550,40,true),
    (v_r,2,'Grüneburgpark','Weitläufiger Stadtpark mit koreanischem Garten und Spielwiesen.',50.1261,8.6661,30,true),
    (v_r,3,'Westend-Gründerzeitvillen','Elegantes Villenquartier – Frankfurts schönste Altbauten und Villengärten.',50.1197,8.6612,25,false),
    (v_r,4,'Opernplatz (Alte Oper)','Neo-Renaissance-Oper von 1880 – einer der schönsten Plätze Frankfurts.',50.1150,8.6716,20,true),
    (v_r,5,'Fressgasse (Kaffeepause)','Gemütlicher Abschluss auf Frankfurts Gourmetmeile.',50.1155,8.6765,30,false);

  -- JGA · Bahnhofsviertel & Multikulti
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'frankfurt-am-main','JGA Frankfurt – Bahnhofsviertel & Main-Ufer','pd24-frankfurt-jga-02',
    'Frankfurts internationalster Kiez hautnah: Street Food, Kulturmix, Cocktailbars und der Sonnenuntergang über dem Main.',
    'Hauptbahnhof Frankfurt',50.1062,8.6649,'public','editorial','["jga","bahnhofsviertel","multikulturell","frankfurt"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Hauptbahnhof Frankfurt (Architektur)','Wilhelminisches Gründerzeitgebäude – Hallendach aus Stahl und Glas, beeindruckend.',50.1062,8.6649,15,true),
    (v_r,2,'Kaiserstraße / Bahnhofsviertel','Frankfurts vielfältigstes Viertel – internationale Küche, Bars und quirliges Nachtleben.',50.1076,8.6693,45,true),
    (v_r,3,'Eiserner Steg (Gruppe-Foto)','Bestes Skyline-Foto mit der ganzen Gruppe auf der Brücke.',50.1083,8.6883,20,true),
    (v_r,4,'Sachsenhausen Apfelwein-Kneipen','Frankfurts Kultgetränk – Ebbelwei im Bembel mit traditioneller Grüner Soß.',50.1023,8.6857,60,true),
    (v_r,5,'Opernplatz Rooftop-Bar','Abschluss auf einer der zahlreichen Rooftop-Bars rund um die Alte Oper.',50.1150,8.6716,60,false);

  -- ============================================================
  -- STUTTGART
  -- ============================================================

  -- Paare · Schlossplatz & Schlossgarten
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'stuttgart','Schlossplatz & Schlossgarten – Stuttgart zu zweit','pd24-stuttgart-paare-01',
    'Stuttgarts grünes Herz: Neues Schloss, Schlossgarten-Promenade, Staatsoper und der Blick über die Kessellage der Stadt.',
    'Schlossplatz',48.7783,9.1806,'public','editorial','["paare","schlossplatz","schlossgarten","stuttgart"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Schlossplatz','Herz Stuttgarts mit Jubiläumssäule und Blick auf Neues und Altes Schloss.',48.7783,9.1806,20,true),
    (v_r,2,'Neues Schloss','Barocker Dreiflügelbau – Sitz des Staatsministeriums, perfektes Fotomotiv.',48.7786,9.1829,15,true),
    (v_r,3,'Schlossgarten (Oper)','60 ha Grünzug vom Schlossplatz bis zum Neckar – Staatsoper als Fotospot.',48.7840,9.1847,30,true),
    (v_r,4,'Königstraße (Bummel)','Längste Fußgängerzone Deutschlands – 1,2 km Shopping und Straßenmusik.',48.7807,9.1773,30,false),
    (v_r,5,'Bohnenviertel (Weinstube)','Historisches Handwerkerviertel mit Fachwerkhäusern und Weinstuben.',48.7712,9.1811,35,true);

  -- Architektur · Stuttgart Modern
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'stuttgart','Stuttgarter Architektur-Highlights','pd24-stuttgart-architektur-01',
    'Vom Weißenhof-Siedlung bis Neue Staatsgalerie: Stuttgart als Laboratorium des modernen Bauens – internationales Architektur-Erbe.',
    'Neue Staatsgalerie',48.7805,9.1893,'public','editorial','["architektur","bauhaus","modern","stuttgart"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Neue Staatsgalerie (James Stirling)','Postmodernes Meisterwerk mit bunten Röhren und Rampen – ikonisches Gebäude der 1980er.',48.7805,9.1893,30,true),
    (v_r,2,'Weißenhofsiedlung (Mies, Le Corbusier)','UNESCO-Weltdokumentation: 1927 Werkbundausstellung – 11 Originalhäuser erhalten.',48.8052,9.1716,30,true),
    (v_r,3,'Stuttgarter Fernsehturm','Welterster Fernsehturm aus Stahlbeton (1956) – 216 m hoch, Aussichtsplattform.',48.7501,9.2055,30,false),
    (v_r,4,'Killesbergturm','32 m schlanker Aussichtsturm aus Stahl im Höhenpark – Stuttgarter Kesselpanorama.',48.8055,9.1705,20,true),
    (v_r,5,'Wilhelma (maurische Gärten)','Einzigartiger Zoopark mit moorisch-historistischen Gebäuden – Architektur-Besonderheit.',48.8067,9.2057,30,false);

  -- JGA · Theodor-Heuss-Straße & Weinviertel
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'stuttgart','JGA Stuttgart – Theo & Württemberger Wein','pd24-stuttgart-jga-01',
    'Stuttgarter JGA zwischen Party und Weingenuss: Theodor-Heuss-Straße (\"Theo\"), Weinstube im Bohnenviertel und die Württemberger Weinberge.',
    'Theodor-Heuss-Straße',48.7790,9.1711,'public','editorial','["jga","wein","nachtleben","stuttgart"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Theodor-Heuss-Straße (\"Theo\")','Stuttgarts lebhafteste Partymeile mit Bars, Clubs und Restaurants.',48.7790,9.1711,60,true),
    (v_r,2,'Bohnenviertel Weinstube','Weinstube Schellenturm – original schwäbisch in historischen Mauern.',48.7712,9.1811,50,true),
    (v_r,3,'Württemberger Weinberge (Uhlbach)','Rebhänge über dem Neckar – Weingut-Besuch mit Stuttgarter Panorama.',48.7903,9.2700,45,false),
    (v_r,4,'Schlossplatz After-Dinner','Abendliches Flanieren auf dem beleuchteten Schlossplatz.',48.7783,9.1806,20,true),
    (v_r,5,'Schleyerhalle / Club-Viertel','Stuttgarts Clubs und Konzerte nahe der Arena.',48.7960,9.2089,60,false);

  -- Foto · Stuttgart Panoramen
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'stuttgart','Stuttgart von oben – Panorama & Foto-Spots','pd24-stuttgart-foto-01',
    'Stuttgarts Kessel-Lage macht es einzigartig: Aussichten vom Fernsehturm, Birkenkopf, Württemberg-Grabkapelle und dem Killesbergturm.',
    'Fernsehturm Stuttgart',48.7501,9.2055,'public','editorial','["foto-spots","panorama","aussicht","stuttgart"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Stuttgarter Fernsehturm','Welterster Beton-Fernsehturm – Panoramablick bei klarem Wetter bis zu den Alpen.',48.7501,9.2055,30,true),
    (v_r,2,'Birkenkopf (\"Monte Scherbelino\")','Trümmerhügel aus WWII-Schutt – bester kostenloser 360°-Blick über Stuttgart.',48.7789,9.1389,25,true),
    (v_r,3,'Württemberg-Grabkapelle','Rotunde über dem Neckartal mit Weinbergpanorama – romantischster Aussichtspunkt.',48.7467,9.2739,25,true),
    (v_r,4,'Killesbergturm (Höhenpark)','Schlanker Stahlturm im Park – Schlossgarten-Panorama ohne Touristen.',48.8055,9.1705,20,true),
    (v_r,5,'Schlossplatz (Goldene Stunde)','Blick auf Neues und Altes Schloss bei Sonnenuntergang – beste Kamera-Stunde.',48.7783,9.1806,25,false);

  -- ============================================================
  -- DÜSSELDORF
  -- ============================================================

  -- Architektur · Medienhafen Gehry
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'duesseldorf','Medienhafen – Gehry, Rheinturm & Stararchitektur','pd24-duesseldorf-architektur-01',
    'Düsseldorfs Stararchitektur-Meile: Gehry-Tänzer, Rheinturm und die spektakulären Bürobauten des Medienhafens – ein Architektur-Schaufenster.',
    'Gehry-Bauten (Neuer Zollhof)',51.2178,6.7682,'public','editorial','["architektur","medienhafen","gehry","duesseldorf"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Gehry-Bauten (Neuer Zollhof)','Drei Türme mit geschwungenen Fassaden – Backstein, Putz, Edelstahl – Düsseldorfs meistfotografiertes Motiv.',51.2178,6.7682,30,true),
    (v_r,2,'Rheinturm (Harald Deilmann)','240 m hoher Kommunikationsturm – Aussichtsplattform mit Panoramablick.',51.2198,6.7656,25,true),
    (v_r,3,'Colorium (Will Alsop)','Buntes Hochhaus im Medienhafen – farbige Fassade aus Glas und Metall.',51.2175,6.7690,15,true),
    (v_r,4,'Hafenspitze (Panorama)','Spitze des Medienhafens – Blick auf alle Architektur-Highlights gleichzeitig.',51.2162,6.7660,20,true),
    (v_r,5,'Hyatt Regency (Strandbar)','Uferboulevard-Bar mit Blick auf den Medienhafen.',51.2190,6.7650,30,false);

  -- Paare · Kö & Altstadt
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'duesseldorf','Königsallee & Altstadt – Düsseldorf de Luxe','pd24-duesseldorf-paare-01',
    'Düsseldorfs elegante Seite: Flanieren auf der Kö, Altstadt-Kneipen und romantischer Rheinboulevard mit Panoramablick.',
    'Königsallee',51.2258,6.7841,'public','editorial','["paare","koenigsallee","altstadt","duesseldorf"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Königsallee','Düsseldorfs Prachtboulevard mit Kö-Graben-Kanal – Luxus-Boutiquen und Brücken.',51.2258,6.7841,30,true),
    (v_r,2,'Hofgarten','Ältester öffentlicher Stadtpark Deutschlands – Spaziergänge unter alten Bäumen.',51.2313,6.7849,25,true),
    (v_r,3,'Altstadt (Kürzeste Theke)','Düsseldorfs Altbier-Meile mit 260 Kneipen auf engstem Raum.',51.2268,6.7728,45,true),
    (v_r,4,'Burgplatz (Schlossturm)','Historischer Stadtturm am Rheinufer – Schifffahrtsmuseum im Inneren.',51.2264,6.7679,15,true),
    (v_r,5,'Rheinuferpromenade (Sonnenuntergang)','Breite Promenade am Rhein – romantischer Spaziergang bei Abendsonne.',51.2218,6.7709,25,true);

  -- JGA · Altstadt & Medienhafen
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'duesseldorf','JGA Düsseldorf – Altbier & Medienhafen-Shooting','pd24-duesseldorf-jga-01',
    'Düsseldorfer JGA deluxe: Altbier-Runde in der Altstadt, Fotoshooting vor den Gehry-Bauten und die besten Club-Adressen.',
    'Altstadt Düsseldorf',51.2268,6.7728,'public','editorial','["jga","altbier","medienhafen","duesseldorf"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Uerige (Altbier-Brauhaus)','Düsseldorfs berühmtestes Brauhaus – obergäriges Altbier direkt vom Fass.',51.2270,6.7731,45,true),
    (v_r,2,'Altstadt Bar-Crawl','270 Kneipen auf 1 km² – Düsseldorfs legendäre Theke der Welt.',51.2268,6.7728,60,true),
    (v_r,3,'Gehry-Bauten Fotoshooting','Abends beleuchtet – spektakuläre JGA-Fotos vor der geschwungenen Architektur.',51.2178,6.7682,30,true),
    (v_r,4,'Medienhafen Bar (Monkey`s Music Club)','Trendige Bars und Clubs im Medienhafen.',51.2185,6.7680,60,true),
    (v_r,5,'Rheinturm Aussicht (Nacht)','Düsseldorf bei Nacht von oben – Abschluss vor dem Club.',51.2198,6.7656,30,false);

  -- Foto · Düsseldorf Top Spots
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'duesseldorf','Düsseldorf Foto-Spots – Kö bis Medienhafen','pd24-duesseldorf-foto-01',
    'Düsseldorfs schönste Fotoperspektiven: Kö-Graben-Spiegelungen, Gehry-Bauten, Rheinturm-Panorama und Altstadtidylle.',
    'Königsallee Graben',51.2258,6.7841,'public','editorial','["foto-spots","koenigsallee","panorama","duesseldorf"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Kö-Graben (Spiegelung)','Kanal entlang der Königsallee – Bäume und Gebäude spiegeln sich perfekt.',51.2258,6.7841,20,true),
    (v_r,2,'Altstadt-Gassen (Bergstraße)','Kopfsteinpflaster und Altbauten – Düsseldorf von seiner historischen Seite.',51.2268,6.7728,20,true),
    (v_r,3,'Gehry-Bauten (Golden Hour)','Metallfassaden leuchten bei tiefstehender Sonne warm – bester Kamera-Moment.',51.2178,6.7682,25,true),
    (v_r,4,'Rheinturm (von unten)','Froschperspektive auf den 240 m Turm – interessante Winkelaufnahmen.',51.2198,6.7656,15,true),
    (v_r,5,'Rheinuferpromenade (Panorama)','Breite Promenade mit Blick auf Rhein und Medienhafen.',51.2218,6.7709,20,false);

  -- Paare · Kaiserswerth & Natur
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'duesseldorf','Kaiserswerth & Rheinwiesen – stilles Düsseldorf','pd24-duesseldorf-paare-02',
    'Das romantische Düsseldorf abseits des Trubels: Kaiserswerther Altstadt, Burgruine am Rhein und grüne Rheinwiesen.',
    'Kaiserswerth Burgruine',51.3163,6.7250,'public','editorial','["paare","kaiserswerth","rheinwiesen","duesseldorf"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Kaiserswerth Burgruine','Romanische Burganlage direkt am Rhein – Rheinblick von alten Mauern aus.',51.3163,6.7250,25,true),
    (v_r,2,'Kaiserswerth Stiftskirche','Frühromanische Kirche im malerischen Kaiserswerther Ortskern.',51.3160,6.7255,15,true),
    (v_r,3,'Rheinwiesen (Stockum)','Weitläufige Grünwiesen am Rheinufer – Picknick mit Rheinblick.',51.2710,6.7510,30,true),
    (v_r,4,'Nordpark (Japanischer Garten)','Gestalteter Stadtpark mit Japangarten und Rhododendronhain.',51.2560,6.7749,25,false),
    (v_r,5,'Benrather Schloss','Barockschloss am Stadtrand – Park und Spiegelteich als romantischer Abschluss.',51.1691,6.8488,30,false);

  -- JGA · Friedrichstadt & Carlstadt
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'duesseldorf','JGA Düsseldorf – Carlstadt Boutique-Bar-Tour','pd24-duesseldorf-jga-02',
    'Der stilvolle JGA: Carlstadt-Galerien, Cocktail-Bars in der Friedrichstadt und abschließend Club-Hopping im Medienhafen.',
    'Carlstadt Düsseldorf',51.2215,6.7710,'public','editorial','["jga","carlstadt","cocktails","duesseldorf"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Carlstadt Galerien & Cafés','Kleines feines Viertel mit Kunstgalerien, Antikläden und Cafés.',51.2215,6.7710,30,true),
    (v_r,2,'Grabbeplatz & Kunsthalle','Belebter Platz mit moderner Kunsthalle – Beginn der Cocktail-Tour.',51.2244,6.7734,20,true),
    (v_r,3,'Cocktailbar-Meile (Friedrichstadt)','Cocktailbars in historischen Altbauten – mixologischer Startpunkt.',51.2158,6.7750,60,true),
    (v_r,4,'Bolkerstraße (Altstadt-Abstecher)','Bolker 9 – angeblich längste Theke der Welt: Altbier und Trubel.',51.2270,6.7731,45,true),
    (v_r,5,'Medienhafen Club (Salon des Amateurs)','Kultiger Club für elektronische Musik – Abschluss der Nacht.',51.2185,6.7680,90,false);

  -- ============================================================
  -- LEIPZIG
  -- ============================================================

  -- Paare · Plagwitz & Clara-Zetkin-Park
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'leipzig','Plagwitz & Clara-Zetkin-Park – Leipzig kreativ','pd24-leipzig-paare-01',
    'Leipzigs kreatives Westend: Alte Spinnerei, Karl-Heine-Kanal und grüner Clara-Zetkin-Park – das andere Leipzig zu zweit entdecken.',
    'Spinnerei Leipzig',51.3290,12.3255,'public','editorial','["paare","plagwitz","westend","leipzig"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Spinnerei Leipzig','Größtes Kulturzentrum Sachsens in ehemaliger Baumwollspinnerei – Galerien und Ateliers.',51.3290,12.3255,35,true),
    (v_r,2,'Karl-Heine-Kanal (Kanufahrt)','Innenstadtkanal durch Plagwitz – Kajak oder Kanu mieten, romantisch und einzigartig.',51.3298,12.3305,40,true),
    (v_r,3,'Plagwitz Altbauten (Buntgarnwerke)','Historische Backsteinbauten der Gründerzeit – Industriekultur als Fotohintergrund.',51.3287,12.3293,20,true),
    (v_r,4,'Clara-Zetkin-Park','Weitläufiger Stadtpark mit Teichen und Konzertpavillon – Picknick auf dem Rasen.',51.3327,12.3561,30,true),
    (v_r,5,'Café Narrenschiff (Kultstätte)','Legendäres Café im Westend – Kaffee und hausgemachter Kuchen.',51.3310,12.3480,25,false);

  -- JGA · Connewitz & Südvorstadt
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'leipzig','JGA Leipzig – Connewitz & Südvorstadt','pd24-leipzig-jga-01',
    'Leipzigs alternative Partymeile: Connewitz, Conne Island, die Karl-Liebknecht-Straße (\"Karl\") und die bunteste Kneipenszene Mitteldeutschlands.',
    'Karl-Liebknecht-Straße',51.3227,12.3712,'public','editorial','["jga","connewitz","karl-liebknecht","leipzig"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Karl-Liebknecht-Straße (\"Karl\")','Leipzigs alternativer Boulevard – Bars, Clubs und vegane Restaurants auf 2 km.',51.3227,12.3712,45,true),
    (v_r,2,'Werk 2','Kulturzentrum und Club in altem Fabrikgebäude – Konzerte und Partys.',51.3216,12.3728,45,true),
    (v_r,3,'Conne Island','Legändärer Alternativ-Club mit Open-Air-Areal direkt am Connewitzer Wehr.',51.3090,12.3819,60,true),
    (v_r,4,'Connewitz Wehr (Abkühlung)','Idyllischer Spot am Wehr – Biergarten und Wiese direkt am Wasser.',51.3090,12.3819,30,false),
    (v_r,5,'Auerbachs Keller (historisch)','Eines der ältesten Restaurants Deutschlands – Faust-Legende seit 1530.',51.3404,12.3789,30,true);

  -- Architektur · Gründerzeit & Moderne
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'leipzig','Völkerschlachtdenkmal & Gründerzeit-Architektur','pd24-leipzig-architektur-01',
    'Vom gigantischen Völkerschlachtdenkmal über die prachtvollen Gründerzeit-Boulevards bis zur modernen Stadtentwicklung am Augustusplatz.',
    'Völkerschlachtdenkmal',51.3140,12.4137,'public','editorial','["architektur","gruenderzeit","denkmal","leipzig"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Völkerschlachtdenkmal','91 m hohes Kolossaldenkmal (1913) – innen riesige Krypta und Panoramablick.',51.3140,12.4137,40,true),
    (v_r,2,'Waldstraßenviertel (Gründerzeit)','Prächtige Gründerzeitvillen und Jugendstilbauten – Leipzigs schönstes Wohnviertel.',51.3463,12.3649,30,true),
    (v_r,3,'Augustusplatz','Größter innerstädtischer Platz Deutschlands – Gewandhaus und Oper flankieren ihn.',51.3417,12.3792,20,true),
    (v_r,4,'Reichsgericht (Bundesverwaltungsgericht)','Wilhelminisches Gerichtsgebäude an der Promenade – imposant und wenig bekannt.',51.3380,12.3668,15,true),
    (v_r,5,'Moritzbastei (Stadtgeschichte)','Einzige erhaltene Bastion der Stadtbefestigung – heute Kulturzentrum.',51.3378,12.3789,20,false);

  -- Foto · Markt & Innenstadt
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'leipzig','Leipzig Foto-Klassiker – Markt bis Spinnerei','pd24-leipzig-foto-01',
    'Leipzigs beste Fotospots: Marktplatz, Nikolaikirche, Passagen und das Völkerschlachtdenkmal – ein fotografischer Stadtspaziergang.',
    'Markt Leipzig',51.3404,12.3753,'public','editorial','["foto-spots","innenstadt","klassiker","leipzig"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Marktplatz Leipzig','Altes Rathaus (1556) mit langer Renaissance-Fassade – Fotomotiv zu jeder Tageszeit.',51.3404,12.3753,20,true),
    (v_r,2,'Nikolaikirche','Geburtsort der Friedlichen Revolution 1989 – weiße Palmwedel-Säulen innen.',51.3404,12.3753,20,true),
    (v_r,3,'Mädlerpassage (Auerbachs Keller)','Prächtige Jugendstilpassage – Faust-Skulptur und glänzende Glasdächer.',51.3404,12.3789,20,true),
    (v_r,4,'Barfußgässchen (Gastromeile)','Enge Gasse mit Restaurants und Bars – besonders abends fotogen.',51.3393,12.3772,15,false),
    (v_r,5,'Augustusplatz Panorama','Größter Stadtplatz Deutschlands – Gewandhaus, Oper und Uni-Hochhaus im Bild.',51.3417,12.3792,20,true);

  -- Paare · Neuseenland & Wasser
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'leipzig','Neuseenland – Seen & Wasserrouten südlich von Leipzig','pd24-leipzig-paare-02',
    'Leipzigs Neuseenland: Cospudener See, Markkleeberger See – ehemalige Braunkohlegruben als romantische Wasserlandschaft.',
    'Cospudener See',51.2682,12.3512,'public','editorial','["paare","neuseenland","see","leipzig"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Cospudener See (Hafen)','Ehemaliger Tagebau, jetzt Freizeitsee – Strand, Segelboote und Cafés.',51.2682,12.3512,40,true),
    (v_r,2,'Hafenpromenade Cossi','Strandbar und Sonnenliegen direkt am See – urbanes Strandleben.',51.2680,12.3510,30,true),
    (v_r,3,'Markkleeberger See (Kanu)','Wildwasserkanal und ruhige Seen – Kanufahrten und SUP möglich.',51.2660,12.3790,40,false),
    (v_r,4,'Zwenkauer See (Sonnenuntergang)','Weitläufiger See mit Blick auf das Kraftwerk – surreale Kulisse.',51.2100,12.3200,25,false),
    (v_r,5,'Connewitzer Wehr (Rückkehr)','Naturstrand am Wehr – entspanntes Ausklingen des Tages.',51.3090,12.3819,30,true);

  -- JGA · Gohlis & Waldstraßenviertel
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'leipzig','JGA Leipzig – Waldstraßenviertel & Gohlis','pd24-leipzig-jga-02',
    'Stylisher JGA im schönsten Gründerzeit-Viertel: Fotoshooting in Villenstraßen, Craft-Beer im Gohlis und Abend-Bar-Crawl.',
    'Waldstraßenviertel Leipzig',51.3463,12.3649,'public','editorial','["jga","waldstraße","gohlis","leipzig"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Waldstraße (Fotoshooting)','Prächtige Gründerzeit-Alleen – opulente Villen als Fotohintergrund.',51.3463,12.3649,30,true),
    (v_r,2,'Schillerhaus (Gohlis)','Friedrich Schillers Sommerresidenz 1785 – Parkanlage und Rokoko-Gartenhaus.',51.3665,12.3663,20,false),
    (v_r,3,'Gohlis Craft-Beer-Bars','Szeneviertel nördlich des Zentrums – gemütliche Bars und Craft Beer.',51.3600,12.3690,50,true),
    (v_r,4,'Rosenthal (Spaziergang)','Weitläufiges Waldgebiet im Stadtgebiet – Abkühlung und Luftholen.',51.3671,12.3521,25,false),
    (v_r,5,'Barfußgässchen (Abschluss)','Zentrale Gasse mit Restaurants und Bars – perfekter Abend-Abschluss.',51.3393,12.3772,60,true);

  -- ============================================================
  -- DRESDEN
  -- ============================================================

  -- Paare · Elbufer & Altstadt
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'dresden','Elbufer & Altstadt – romantisches Dresden','pd24-dresden-paare-01',
    'Dresdens Bilderbuchkulisse: Canaletto-Blick vom Neustadt-Ufer, Brühlsche Terrasse, Frauenkirche und Augustusbrücke bei Abendsonne.',
    'Augustusbrücke',51.0553,13.7393,'public','editorial','["paare","altstadt","elbe","dresden"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Augustusbrücke (Canaletto-Blick)','Bester Gesamtblick auf Dresdner Altstadt – Frauenkirche, Schloss, Semperoper.',51.0553,13.7393,20,true),
    (v_r,2,'Brühlsche Terrasse','\"Balkon Europas\" – 500 m lange Terrasse über der Elbe, kostenloser Eintritt.',51.0530,13.7420,25,true),
    (v_r,3,'Frauenkirche (Neumarkt)','Wiederaufgebautes Barockwunder – Aussichtsplattform der Kuppel empfohlen.',51.0514,13.7416,30,true),
    (v_r,4,'Zwinger (Abendlicht)','Barockgalerie im Gartenambiente – Wallpavillon bei Sonnenuntergang.',51.0520,13.7337,25,true),
    (v_r,5,'Elbe-Rad-/Fußweg (Richtung Blasewitz)','Uferweg mit Blick auf die Elbhänge – Loschwitzer Brücke als Ziel.',51.0560,13.7500,30,false);

  -- Architektur · Barock & Semper
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'dresden','Barock-Dresden – Zwinger, Semperoper & Residenzschloss','pd24-dresden-architektur-01',
    'Europas Barockhauptstadt: Zwinger, Semperoper, Residenzschloss und Hofkirche – Augusts des Starken prunkvolles Erbe.',
    'Theaterplatz Dresden',51.0535,13.7339,'public','editorial','["architektur","barock","zwinger","dresden"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Zwinger (Pöppelmann)','Barockschlossanlage mit 6 Pavillons und Wallgraben – Fotospots an jedem Brunnen.',51.0520,13.7337,35,true),
    (v_r,2,'Semperoper','Eines der schönsten Opernhäuser der Welt – Außenfassade mit König-Johann-Denkmal.',51.0535,13.7339,20,true),
    (v_r,3,'Residenzschloss & Grünes Gewölbe','Ehemalige Residenz der Wettiner – Hausmannsturm für 360°-Blick.',51.0533,13.7363,25,true),
    (v_r,4,'Dresdner Hofkirche','Barockkirche direkt am Residenzschloss – Silbermann-Orgel im Inneren.',51.0535,13.7353,15,true),
    (v_r,5,'Neumarkt & Frauenkirche','Wiederaufgebauter historischer Platz rund um die Frauenkirche.',51.0514,13.7416,25,true);

  -- JGA · Neustadt & Scheunenviertel
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'dresden','JGA Dresden – Neustadt & Scheunenviertel','pd24-dresden-jga-01',
    'Das andere Dresden: Äußere Neustadt mit Scheunenviertel-Kneipen, Street Art, Kunsthofpassage und Elbe-Partys.',
    'Kunsthofpassage Dresden',51.0623,13.7435,'public','editorial','["jga","neustadt","scheunenviertel","dresden"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Kunsthofpassage','Fünf thematische Höfe mit Kunstinstallationen – Regenrinnen-Fassade und Tierklang-Hof.',51.0623,13.7435,25,true),
    (v_r,2,'Scheunenviertel (Alaunstraße)','Kneipenviertel der Neustadt – dichte Ansammlung von Bars und Cafés.',51.0625,13.7400,60,true),
    (v_r,3,'Elbepark / Elbwiesen (Chill-Out)','Grüne Elbwiesen zum Entspannen zwischen Bar-Hopping.',51.0630,13.7200,30,false),
    (v_r,4,'Weitblick Bar (Rooftop)','Bar mit Blick über die Neustadt und Richtung Altstadt.',51.0590,13.7400,45,true),
    (v_r,5,'Groove Station','Kultiger Club an der Katharinenstraße – elektronische Musik und Partynacht.',51.0590,13.7370,90,false);

  -- Foto · Dresdens Fotoklassiker
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'dresden','Dresden Foto-Klassiker – Canaletto bis Blaue Stunde','pd24-dresden-foto-01',
    'Die berühmtesten Fotoperspektiven Dresdens: Canaletto-Blick, Frauenkirche bei Sonnenaufgang, Zwinger-Brunnen und Loschwitzer Brücke.',
    'Neustadt-Ufer (Canaletto-Blick)',51.0558,13.7393,'public','editorial','["foto-spots","canaletto","panorama","dresden"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Neustädter Elbufer (Canaletto-Blick)','Ikone unter den Dresdenfotos – beste Zeit: kurz nach Sonnenaufgang.',51.0558,13.7393,25,true),
    (v_r,2,'Frauenkirche (Kuppel-Ausblick)','Plattform auf 67 m – 360°-Panorama über Altstadt und Elbtal.',51.0514,13.7416,30,true),
    (v_r,3,'Zwinger (Kronentor)','Prunktoranlage mit Weltkugel-Kuppel – beste Fotoachse.',51.0523,13.7337,20,true),
    (v_r,4,'Loschwitzer Brücke (Blaues Wunder)','Stahlkonstruktionsbrücke von 1893 – ungewöhnliche Farbe und Perspektive.',51.0477,13.8008,20,true),
    (v_r,5,'Pillnitzer Schlossanlage (Ausflug)','Barockschloss am Elbufer mit Schlosspark – ideal zum Nachmittag.',51.0218,13.8705,40,false);

  -- Paare · Elbhänge & Loschwitz
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'dresden','Elbhänge & Loschwitz – romantisches Weinberg-Dresden','pd24-dresden-paare-02',
    'Das verborgene Dresden: Loschwitz mit Weinbergen, Standseilbahn, Schwebebahn und dem besten Ausblick über das Elbtal.',
    'Körnerplatz Loschwitz',51.0508,13.8050,'public','editorial','["paare","loschwitz","elbhänge","dresden"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Körnerplatz Loschwitz','Malerischer Dorfplatz am Elbufer – Cafés und historische Gebäude.',51.0508,13.8050,20,true),
    (v_r,2,'Dresdner Schwebebahn','Älteste Bergschwebebahn der Welt (1901) – romantische Fahrt auf den Weißen Hirsch.',51.0500,13.8070,20,true),
    (v_r,3,'Loschwitzer Weinberge','Stille Weinbergspfade mit Blick über das Elbtal – Sonnenuntergangs-Highlight.',51.0470,13.8100,30,true),
    (v_r,4,'Schillergarten (Biergarten)','Historischer Biergarten direkt am Blauen Wunder – Dresdner Klassiker.',51.0477,13.8008,35,true),
    (v_r,5,'Schloss Albrechtsberg','Drei Elbschlösser auf dem Hang – Parkanlage kostenlos begehbar.',51.0700,13.7960,20,false);

  -- Architektur · Moderne DDR
  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'dresden','Dresdner Neuzeit – Moderne & DDR-Architektur','pd24-dresden-architektur-02',
    'Das moderne Dresden: Kulturpalast, Prager Straße, Neue Synagoge und der UFA-Kristallpalast – Architektur des 20. und 21. Jahrhunderts.',
    'Kulturpalast Dresden',51.0500,13.7399,'public','editorial','["architektur","modern","ddr","dresden"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Kulturpalast Dresden','Modernisierter DDR-Konzerthausbau mit neuem Paukert-Saal – Fassade als Zeitzeugnis.',51.0500,13.7399,20,true),
    (v_r,2,'Prager Straße (DDR-Fußgängerzone)','Sozialistisch geplante Prachtstraße – Brunnen, Plastiken und Plattenbauten.',51.0458,13.7378,20,true),
    (v_r,3,'Neue Synagoge (Wandel Hoefer Lorch)','Zeitgenössische Synagoge auf historischen Fundamenten – goldenes Würfelgewölbe.',51.0551,13.7377,15,true),
    (v_r,4,'UFA-Kristallpalast (Coop Himmelb(l)au)','Spektakulärer dekonstruktivistischer Kinobau – glasige Schrägen und Stahl.',51.0458,13.7441,15,true),
    (v_r,5,'Technische Sammlungen (Junghans-Bau)','Industriekultur in Gründerzeit-Fabrik – Dresdner Kamera- und Uhrengeschichte.',51.0462,13.7639,20,false);

end $$;

commit;
