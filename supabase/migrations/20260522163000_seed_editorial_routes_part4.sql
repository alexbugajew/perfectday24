-- ============================================================
-- Editorial Routes Seed – Part 4 (Final):
--   Wave2: Duisburg, Bochum, Wuppertal, Bielefeld, Augsburg,
--          Braunschweig, Kiel
--   Wave3: Gelsenkirchen, Moenchengladbach, Magdeburg,
--          Freiburg im Breisgau, Luebeck, Erfurt
-- ============================================================

begin;

do $$
declare
  v_user_id uuid := '00000000-0000-0000-0000-000000000099';
  v_cp_id   uuid;
  v_r       uuid;
begin
  select id into v_cp_id from public.creator_profiles where user_id = v_user_id;
  if v_cp_id is null then raise exception 'Run part1 first'; end if;

  -- ============================================================
  -- DUISBURG
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'duisburg','Duisburg Innenhafen – Industrieromantik zu zweit','pd24-duisburg-paare-01',
    'Romantischer Abend am Duisburger Innenhafen: aufgegebene Speicher als Kulturkulisse, abendliches Hafenlicht und die Ruhrgebiets-Skyline über dem Wasser.',
    'Duisburger Innenhafen',51.4296,6.7615,'public','editorial','["paare","innenhafen","ruhrgebiet","duisburg"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Duisburger Innenhafen (Speicher)','Historische Speichergebäude direkt am Wasser – Abendlicht taucht den Hafen in Gold.',51.4296,6.7615,30,true),
    (v_r,2,'Küppersmühle Museum','Getreidespeicher als Gegenwartskunst-Museum – spektakuläre Industriearchitektur.',51.4305,6.7622,40,true),
    (v_r,3,'Portsmouthplatz (Hafenblick)','Aussichtspunkt über den Innenhafen – Sonnenuntergang über Ruhrgebiet.',51.4290,6.7600,20,true),
    (v_r,4,'Landschaftspark Duisburg-Nord (Abend)','Ehemalige Hochofenanlage beleuchtet – eines der eindrucksvollsten Industriedenkmäler Europas.',51.4556,6.7739,45,false),
    (v_r,5,'Rheinhausen Rheinufer','Ruhiger Abschluss am Rheinufer – Blick auf die Rheinbrücken.',51.4042,6.7220,25,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'duisburg','JGA Duisburg – Innenstadt & Landschaftspark','pd24-duisburg-jga-01',
    'Duisburger JGA: Altstadt-Bars, Cocktailrunde am Innenhafen und die spektakuläre Lichtinstallation im Landschaftspark Duisburg-Nord.',
    'Duisburg Altstadt',51.4344,6.7623,'public','editorial','["jga","innenstadt","landschaftspark","duisburg"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Duisburg Altstadt (Startpunkt)','Historisches Zentrum – erste Runde zur Einstimmung.',51.4344,6.7623,30,true),
    (v_r,2,'König-Heinrich-Platz (Bars)','Zentraler Platz mit Bars und Restaurants – lebendige Abendatmosphäre.',51.4330,6.7610,45,true),
    (v_r,3,'Innenhafen (Cocktailbar)','Bars mit Hafenblick – angesagteste Adressen am Wasser.',51.4296,6.7615,60,true),
    (v_r,4,'Landschaftspark Nord (Klettern/Tauchen)','Abenteuerprogramm im Hochofenwerk – Klettern, Tauchen im Gasometer.',51.4556,6.7739,90,false),
    (v_r,5,'Mercator-Passage (Abschluss)','Nachtleben in der Innenstadt – diverse Clubs und Bars.',51.4344,6.7623,60,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'duisburg','Duisburg Industriekultur – Landschaftspark & Innenhafen','pd24-duisburg-architektur-01',
    'Duisburger Industriekultur: Landschaftspark Nord als globales Vorbild der Umnutzung, Küppersmühle als Kunstort und der Innenhafen als lebendiges Stadtquartier.',
    'Landschaftspark Duisburg-Nord',51.4556,6.7739,'public','editorial','["industriekultur","landschaftspark","architektur","duisburg"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Landschaftspark Duisburg-Nord','Hochofen-Anlage als Kletterpark und Kulturzentrum – Pflichtbesuch für Industriekultur-Fans.',51.4556,6.7739,60,true),
    (v_r,2,'Küppersmühle Museum','MKM Museum Küppersmühle für Gegenwartskunst – Erweiterungsbau von Herzog & de Meuron.',51.4305,6.7622,45,true),
    (v_r,3,'Duisburger Innenhafen','Revitalisiertes Hafenareal mit Büros, Gastronomie und Museen.',51.4296,6.7615,30,true),
    (v_r,4,'Lehmbruck Museum','Skulpturenmuseum mit Arbeiten von Wilhelm Lehmbruck – internationales Rang.',51.4360,6.7640,35,true),
    (v_r,5,'Alsumer Berg (Panorama)','Halde mit Panoramablick über Rhein, Ruhr und Duisburg.',51.4720,6.7300,20,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'duisburg','Duisburg Foto-Spots – Hafen & Hüttenwerk','pd24-duisburg-foto-01',
    'Duisburgs industrielle Bildmotive: Hochöfen im Gegenlicht, Spiegelungen im Innenhafen und die Ästhetik des Strukturwandels.',
    'Landschaftspark Duisburg-Nord',51.4556,6.7739,'public','editorial','["foto-spots","industriekultur","innenhafen","duisburg"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Landschaftspark (Hochöfen bei Nacht)','Beleuchtete Hochöfen – nächtliche Aufnahmen mit langer Belichtungszeit.',51.4556,6.7739,40,true),
    (v_r,2,'Innenhafen (Spiegelungen)','Wasserspiegelungen der Speicher – beste Stunde bei Windstille kurz nach Sonnenaufgang.',51.4296,6.7615,30,true),
    (v_r,3,'Küppersmühle Außenfassade','Backsteinfassade im Kontrast zum Neubau – Architekturfotografie.',51.4305,6.7622,20,true),
    (v_r,4,'Rheinbrücken-Panorama','Autobahnbrücke A40 über den Rhein – Langzeitbelichtung mit Fahrzeuglichtern.',51.4180,6.7380,25,false),
    (v_r,5,'Alsumer Berg (Weitblick)','Haldenpanorama über das Ruhrgebiet – beste Sicht bei klarem Wetter.',51.4720,6.7300,20,false);

  -- ============================================================
  -- BOCHUM
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'bochum','Bochum Paare – Bermudadreieck & Stadtpark','pd24-bochum-paare-01',
    'Romantisches Bochum: Abend im Bermudadreieck, Spaziergang durch den Stadtpark und eine Runde im historischen Planetarium.',
    'Bochum Bermudadreieck',51.4815,7.2170,'public','editorial','["paare","bermudadreieck","stadtpark","bochum"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Bermudadreieck (Aperitivo)','Bochums berühmte Kneipengasse – gemütliches Beisammensein zum Einstieg.',51.4815,7.2170,30,true),
    (v_r,2,'Stadtpark Bochum','Weitläufiger Park mit Teich und Rosengarten – entspannter Nachmittagsspaziergang.',51.4794,7.2253,35,true),
    (v_r,3,'Zeiss Planetarium','Ältestes Zeiss-Planetarium der Welt – romantische Sternenshows.',51.4789,7.2247,60,true),
    (v_r,4,'Kortumstraße (Abendessen)','Bochums Einkaufs- und Gastronomieachse – breite Restaurantauswahl.',51.4818,7.2162,45,true),
    (v_r,5,'Jahrhunderthalle (Event)','Ehemalige Gasproduktionshalle als Veranstaltungsort – Konzerte und Theater.',51.4978,7.1900,60,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'bochum','JGA Bochum – Bermudadreieck & Innenstadt','pd24-bochum-jga-01',
    'Bochumer JGA: Bermudadreieck als Startpunkt, Craft-Beer-Bars im Univiertel und Nachtleben auf der Kortumstraße.',
    'Bochum Kortumstraße',51.4818,7.2162,'public','editorial','["jga","bermudadreieck","innenstadt","bochum"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Kortumstraße (Startpunkt)','Bochums Zentrum – erster Treffpunkt und Foto-Stop.',51.4818,7.2162,20,true),
    (v_r,2,'Bermudadreieck (Kneipentour)','Dichtes Kneipen-Viertel – mehrere Bars in wenigen Minuten Fußweg.',51.4815,7.2170,90,true),
    (v_r,3,'Univiertel (Craft-Beer)','Studentisches Viertel – Craft-Beer-Bars und günstige Cocktails.',51.4440,7.2621,60,false),
    (v_r,4,'Rotunde (Club)','Legendärer Bochumer Club – elektronische Musik in Rundgebäude.',51.4790,7.2100,90,false),
    (v_r,5,'Jahrhunderthalle (Late Night)','Große Konzert- und Club-Venue für den krönenden Abschluss.',51.4978,7.1900,120,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'bochum','Bochum Industriekultur – Bergbaumuseum & Jahrhunderthalle','pd24-bochum-architektur-01',
    'Bochums Industriegeschichte: Bergbaumuseum als weltgrößtes Bergbaumuseum, die denkmalgeschützte Jahrhunderthalle und das Zeiss-Planetarium.',
    'Deutsches Bergbau-Museum Bochum',51.4887,7.2169,'public','editorial','["industriekultur","bergbaumuseum","architektur","bochum"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Deutsches Bergbau-Museum','Weltgrößtes Bergbaumuseum – Förderturm mit Aussichtsplattform über Bochum.',51.4887,7.2169,75,true),
    (v_r,2,'Jahrhunderthalle Bochum','Industriedenkmal aus 1902 – heute Bochums bedeutendste Kulturstätte.',51.4978,7.1900,30,true),
    (v_r,3,'Zeiss Planetarium','Ältestes noch betriebenes Zeiss-Planetarium der Welt (1928).',51.4789,7.2247,45,true),
    (v_r,4,'Bergbau-Museum Förderturm (Aussicht)','Panoramablick vom Förderturm – Ruhrgebiet auf einen Blick.',51.4887,7.2169,20,true),
    (v_r,5,'Stadtpark (Rosengarten)','Historischer Stadtpark – grüne Lunge mitten in Bochum.',51.4794,7.2253,25,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'bochum','Bochum Foto-Spots – Bergbauturm & Jahrhunderthalle','pd24-bochum-foto-01',
    'Bochums beste Fotomotive: Förderturm-Panorama, Jahrhunderthalle-Industriearchitektur und nächtliches Bermudadreieck.',
    'Deutsches Bergbau-Museum Bochum',51.4887,7.2169,'public','editorial','["foto-spots","bergbauturm","industriekultur","bochum"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Bergbau-Museum Förderturm','Ikonisches Industriedenkmal – Weitwinkelaufnahme von unten.',51.4887,7.2169,25,true),
    (v_r,2,'Jahrhunderthalle (Innen/Außen)','Backsteingewölbe und Stahlkonstruktion – Architekturfotografie.',51.4978,7.1900,30,true),
    (v_r,3,'Zeiss Planetarium Kuppel','Art-Déco-Kuppelbau im Stadtpark – symmetrische Frontalaufnahmen.',51.4789,7.2247,20,true),
    (v_r,4,'Bermudadreieck (Nacht)','Beleuchtete Kneipenstraße – bunte Lichter in der Abenddämmerung.',51.4815,7.2170,20,false),
    (v_r,5,'Bochum Innenstadt Skyline','Urbane Weitwinkelperspektive über die Innenstadt.',51.4818,7.2162,15,false);

  -- ============================================================
  -- WUPPERTAL
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'wuppertal','Wuppertal Paare – Schwebebahn & Von der Heydt','pd24-wuppertal-paare-01',
    'Romantisches Wuppertal: Fahrt mit der historischen Schwebebahn, Besuch des Von der Heydt-Museums und Spaziergang durch den Luisenpark.',
    'Wuppertal Schwebebahn Hbf',51.2562,7.1508,'public','editorial','["paare","schwebebahn","museum","wuppertal"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Schwebebahn (Barmen – Vohwinkel)','Ikonische Hängebahn über dem Fluss – einmaliges Erlebnis, 13 km über der Wupper.',51.2700,7.1935,45,true),
    (v_r,2,'Von der Heydt-Museum','Bedeutendes Kunstmuseum mit Meisterwerken des 19./20. Jahrhunderts.',51.2558,7.1491,50,true),
    (v_r,3,'Luisenpark (Elberfeld)','Historischer Stadtpark mit Teich und Pavillons – Wuppertaler Lieblingspark.',51.2538,7.1390,30,true),
    (v_r,4,'Mirker Bahnhof (Utopiastadt)','Ehemalige Bahnanlage als kreatives Kulturzentrum – Café und Galerie.',51.2635,7.1168,25,false),
    (v_r,5,'Wupper-Promenade','Spaziergang entlang der Wupper – begrünte Uferpromenade.',51.2562,7.1508,25,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'wuppertal','JGA Wuppertal – Barmen & Elberfeld','pd24-wuppertal-jga-01',
    'Wuppertaler JGA: Schwebebahn-Abenteuer, Craft-Beer im Mirker Viertel und Nachtleben in Elberfeld.',
    'Wuppertal Elberfeld',51.2562,7.1508,'public','editorial','["jga","schwebebahn","elberfeld","wuppertal"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Schwebebahn (Erlebnisfahrt)','JGA-Start mit Schwebebahn-Fahrt – historisches Wahrzeichen als Einstieg.',51.2562,7.1508,50,true),
    (v_r,2,'Elberfeld Innenstadt (Bars)','Fußgängerzone mit Bars und Restaurants – Wuppertaler Feierkultur.',51.2545,7.1478,60,true),
    (v_r,3,'Mirker Viertel (Craft-Beer)','Hipster-Viertel mit unabhängigen Bars und Biergärten.',51.2635,7.1168,60,false),
    (v_r,4,'Loch (Barmen Kneipenszene)','Traditionelles Kneipen-Viertel in Barmen – authentisches Wuppertal.',51.2700,7.1935,60,true),
    (v_r,5,'Café Ada (Live-Musik)','Kultiger Veranstaltungsort – Konzerte und Partys.',51.2562,7.1508,90,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'wuppertal','Wuppertal Architektur – Schwebebahn & Historismus','pd24-wuppertal-architektur-01',
    'Wuppertals einzigartiges Stadtbild: Die Schwebebahn als Weltkulturerbe-Kandidat, Historismusbauten der Gründerzeit und das Engels-Haus.',
    'Wuppertal Schwebebahn',51.2562,7.1508,'public','editorial','["architektur","schwebebahn","historismus","wuppertal"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Schwebebahn Station Elberfeld','Stählerne Konstruktion von 1901 – Ingenieurkunst des Wilhelminismus.',51.2562,7.1508,20,true),
    (v_r,2,'Von der Heydt-Museum (Fassade)','Klassizistisches Museumsgebäude – repräsentative Stadtarchitektur.',51.2558,7.1491,15,true),
    (v_r,3,'Engels-Haus (Barmen)','Geburtshaus von Friedrich Engels – historisches Bürgerhaus.',51.2683,7.1956,30,true),
    (v_r,4,'Historische Stadthalle','Repräsentativer Konzertsaal von 1900 – Jugendstil und Historismus.',51.2557,7.1440,20,true),
    (v_r,5,'Schwebebahn Brücken (Detailansicht)','Stählerne Brückenkonstruktionen über der Wupper – Ingenieurkunst.',51.2600,7.1600,25,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'wuppertal','Wuppertal Foto-Spots – Schwebebahn über der Wupper','pd24-wuppertal-foto-01',
    'Wuppertals ikonische Bildmotive: Schwebebahn im Gegenlicht über der Wupper, Gründerzeitfassaden und das Tal-Panorama.',
    'Wuppertal Schwebebahn',51.2562,7.1508,'public','editorial','["foto-spots","schwebebahn","wupper","wuppertal"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Schwebebahn über Wupper (Brücke)','Blick von Straßenbrücken auf die Schwebebahn – klassisches Wuppertal-Motiv.',51.2562,7.1508,30,true),
    (v_r,2,'Wuppertal Tal-Panorama (Toelleturm)','Aussichtsturm über dem Tal – Stadtpanorama und Schwebebahn aus der Vogelperspektive.',51.2475,7.1300,30,true),
    (v_r,3,'Mirker Bahnhof (Streetstyle)','Urbane Streetfotografie im alternativen Viertel.',51.2635,7.1168,25,false),
    (v_r,4,'Von der Heydt-Museum Vorgarten','Skulpturen im Freien – natürliches Licht auf Kunstobjekte.',51.2558,7.1491,20,false),
    (v_r,5,'Schwebebahn Kaiserwagen','Historischer Kaiserwagen als stationäre Ausstellung – Detailaufnahmen.',51.2620,7.1540,15,false);

  -- ============================================================
  -- BIELEFELD
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'bielefeld','Bielefeld Paare – Sparrenburg & Altstadt','pd24-bielefeld-paare-01',
    'Romantisches Bielefeld: Sparrenburg-Panorama über der Stadt, Altstadt-Bummel und Spaziergang durch den Botanischen Garten.',
    'Bielefeld Sparrenburg',52.0225,8.5278,'public','editorial','["paare","sparrenburg","altstadt","bielefeld"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Sparrenburg','Mittelalterliche Festungsanlage – Panoramablick über Bielefeld und das Münsterland.',52.0225,8.5278,45,true),
    (v_r,2,'Bielefeld Altstadt','Historische Altstadt mit Fachwerk und kleinen Cafés – Flanieren und Kaffee.',52.0219,8.5308,30,true),
    (v_r,3,'Botanischer Garten Bielefeld','Weitläufige Gartenanlage am Hang – romantischer Spaziergang.',52.0283,8.5261,35,true),
    (v_r,4,'Alter Markt','Marktplatz mit historischen Fassaden – Wochenmarkt und Cafés.',52.0220,8.5330,25,true),
    (v_r,5,'Teutoburger Wald (Hermanns)','Naturspaziergang in der Nähe – Hermannsdenkmal bei Detmold.',51.9119,8.8387,60,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'bielefeld','JGA Bielefeld – Innenstadt & Altstadt-Bars','pd24-bielefeld-jga-01',
    'Bielefelder JGA: Altstadt-Kneipen, Cocktailrunde in der Innenstadt und Sparrenburg-Aussicht zum Abschluss des Tages.',
    'Bielefeld Innenstadt',52.0212,8.5347,'public','editorial','["jga","altstadt","innenstadt","bielefeld"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Bielefeld Hauptbahnhof (Treffpunkt)','Zentraler Start – alle kommen hier an.',52.0289,8.5329,15,true),
    (v_r,2,'Bielefeld Altstadt (Kneipen)','Kleine Gassen mit Biergärten und Bars – gemütliche erste Runde.',52.0219,8.5308,60,true),
    (v_r,3,'Alter Markt (Cocktail-Bar)','Gastronomieangebot am Marktplatz – breite Auswahl.',52.0220,8.5330,50,true),
    (v_r,4,'Sparrenburg bei Nacht','Burg mit Nachtbeleuchtung – optionaler Abendbesuch.',52.0225,8.5278,30,false),
    (v_r,5,'Innenstadt-Clubs','Bielefelds Clubszene – diverse Locations für den Rest der Nacht.',52.0212,8.5347,120,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'bielefeld','Bielefeld Architektur – Sparrenburg & Ravensberger Park','pd24-bielefeld-architektur-01',
    'Bielefelds Architekturgeschichte: Mittelalterliche Sparrenburg, Historismus der Gründerzeit und der Ravensberger Park auf ehemaligem Fabrikgelände.',
    'Bielefeld Sparrenburg',52.0225,8.5278,'public','editorial','["architektur","sparrenburg","industriekultur","bielefeld"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Sparrenburg','Mittelalterliche Festungsanlage von 1240 – Kasematten und Bergfried.',52.0225,8.5278,45,true),
    (v_r,2,'Kunsthalle Bielefeld','Phillip-Johnson-Bau von 1968 – bedeutendes Beispiel moderner Museumsarchitektur.',52.0254,8.5257,35,true),
    (v_r,3,'Ravensberger Park','Ehemalige Spinnerei als Freizeitanlage – Industriekultur der Textilwirtschaft.',52.0323,8.5362,25,true),
    (v_r,4,'Bielefelder Rathaus','Historisches Rathaus am Niederwall – repräsentative Innenstadt.',52.0218,8.5323,15,true),
    (v_r,5,'Stadttheater Bielefeld','Neoklassizistischer Theaterbau – Kulturmittelpunkt der Stadt.',52.0256,8.5313,15,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'bielefeld','Bielefeld Foto-Spots – Sparrenburg & Altstadt','pd24-bielefeld-foto-01',
    'Bielefelds schönste Bildmotive: Sparrenburg-Panorama, Altstadt-Fachwerk und der Botanische Garten im Frühling.',
    'Bielefeld Sparrenburg',52.0225,8.5278,'public','editorial','["foto-spots","sparrenburg","altstadt","bielefeld"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Sparrenburg Panorama-Aussicht','Weitblick über Bielefeld und Teutoburger Wald – ideale Goldene Stunde.',52.0225,8.5278,30,true),
    (v_r,2,'Altstadt Fachwerk (Gassen)','Historische Fachwerkfassaden – Detailaufnahmen in engen Gassen.',52.0219,8.5308,25,true),
    (v_r,3,'Botanischer Garten (Frühling)','Blütenvielfalt im April/Mai – Makrofotografie.',52.0283,8.5261,30,true),
    (v_r,4,'Kunsthalle Bielefeld Außen','Sichtbeton-Kubus von Philip Johnson – Architekturfotografie.',52.0254,8.5257,15,false),
    (v_r,5,'Alter Markt (Gegenlicht)','Marktplatz-Perspektive gegen die Abendsonne.',52.0220,8.5330,20,false);

  -- ============================================================
  -- AUGSBURG
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'augsburg','Augsburg Paare – Fuggerei & Altstadt','pd24-augsburg-paare-01',
    'Romantisches Augsburg: Die weltälteste Sozialsiedlung in der Fuggerei, Abendspaziergang durch die Renaissance-Altstadt und Dinner am Stadtmarkt.',
    'Augsburg Fuggerei',48.3667,10.9000,'public','editorial','["paare","fuggerei","altstadt","augsburg"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Fuggerei','Weltälteste Sozialsiedlung (1521) – noch heute bewohnt, Eintritt für Besucher.',48.3667,10.9000,45,true),
    (v_r,2,'Augsburg Dom (St. Maria)','Romanischer Dom mit Bronzetüren von 1356 – älteste Glasfenster der Welt.',48.3700,10.8965,30,true),
    (v_r,3,'Maximilianstraße (Renaissance)','Augsburgs Prachtstraße mit Renaissancepalais und Brunnen.',48.3682,10.8978,35,true),
    (v_r,4,'Stadtmarkt Augsburg','Überdachter Markt mit Fischbrunnen – frische Produkte und Imbiss.',48.3675,10.8955,25,true),
    (v_r,5,'Augsburger Puppenkiste','Welterühmtes Marionettentheater – Kulturdenkmal der Nachkriegszeit.',48.3670,10.8955,30,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'augsburg','JGA Augsburg – Maximilianstraße & Bierkeller','pd24-augsburg-jga-01',
    'Augsburger JGA: Stadtmarkt-Besuch am Morgen, Cocktails auf der Maximilianstraße und traditionelle Bierkeller am Abend.',
    'Augsburg Rathausplatz',48.3680,10.8978,'public','editorial','["jga","maximilianstrasse","bierkeller","augsburg"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Rathausplatz (Start)','Augsburgs zentraler Platz – Treffpunkt und erster Foto-Stop.',48.3680,10.8978,20,true),
    (v_r,2,'Maximilianstraße (Gastronomie)','Prächtige Renaissance-Achse – zahlreiche Bars und Restaurants.',48.3682,10.8978,60,true),
    (v_r,3,'Stadtmarkt Weinbar','Augsburger Weinkultur auf dem Stadtmarkt – lokale Spezialitäten.',48.3675,10.8955,45,true),
    (v_r,4,'Bierkeller (Innenstadtnähe)','Bayerische Biergarten-Tradition – Augsburger Brauereien.',48.3680,10.9010,60,false),
    (v_r,5,'Herrenbach-Viertel (Bars)','Alternatives Szeneviertel mit Bars und Konzertlocation.',48.3620,10.9100,90,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'augsburg','Augsburg UNESCO-Welterbe – Wassermanagement & Renaissance','pd24-augsburg-architektur-01',
    'Augsburgs UNESCO-Welterbe Wassermanagement: historische Wassertürme, Brunnen und die Renaissance-Stadtpalais auf der Maximilianstraße.',
    'Augsburg Rotes Tor',48.3620,10.9007,'public','editorial','["architektur","welterbe","renaissance","augsburg"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Rotes Tor (Wasserturm)','Historisches Stadttor mit Wasserwerk – UNESCO-Welterbe-Ankerpunkt.',48.3620,10.9007,25,true),
    (v_r,2,'Augustusbrunnen','Renaissancebrunnen von 1594 – Meisterwerk des Manierismus.',48.3680,10.8978,15,true),
    (v_r,3,'Fuggerei (Sozialbau-Architektur)','Frühneuzeitlicher Sozialbau – Renaissance-Stadtplanung.',48.3667,10.9000,40,true),
    (v_r,4,'Dom St. Maria (Romanik)','Romanischer Dom mit ältesten figürlichen Glasfenstern der Welt.',48.3700,10.8965,35,true),
    (v_r,5,'Maximilianmuseum','Palais mit stadtgeschichtlichen Sammlungen – Architekturfragmente.',48.3683,10.8969,30,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'augsburg','Augsburg Foto-Spots – Renaissance & Fuggerei','pd24-augsburg-foto-01',
    'Augsburgs malerische Bildmotive: Fuggerei-Gassen im Gegenlicht, Maximilianstraßen-Perspektiven und der mächtige Dom.',
    'Augsburg Fuggerei',48.3667,10.9000,'public','editorial','["foto-spots","fuggerei","renaissance","augsburg"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Fuggerei (Hauptgasse)','Enge Siedlungsgassen mit Renaissancehäusern – Goldenes-Stunden-Fotografie.',48.3667,10.9000,25,true),
    (v_r,2,'Maximilianstraße (Fluchtpunkt)','Lange Prachtstraße als Fluchtstrecke – Architekturkomposition.',48.3682,10.8978,20,true),
    (v_r,3,'Dom (Westfassade)','Romanische Westfassade im Morgenlicht.',48.3700,10.8965,20,true),
    (v_r,4,'Rotes Tor (Wassertürme)','Symmetrische Türme – blaue Stunde für Spiegelungen im Wassergraben.',48.3620,10.9007,25,true),
    (v_r,5,'Stadtmarkt (Markttreiben)','Lebendige Marktszenen – Street Photography.',48.3675,10.8955,20,false);

  -- ============================================================
  -- BRAUNSCHWEIG
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'braunschweig','Braunschweig Paare – Burgplatz & Okerufer','pd24-braunschweig-paare-01',
    'Romantisches Braunschweig: Mittelalterlicher Burgplatz mit dem Braunschweiger Löwen, Abendspaziergang am Okufer und Dom-Besuch.',
    'Braunschweig Burgplatz',52.2657,10.5239,'public','editorial','["paare","burgplatz","oker","braunschweig"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Burgplatz (Braunschweiger Löwe)','Historischer Platz mit Löwenstatue von Heinrich dem Löwen – Stadtgründungsort.',52.2657,10.5239,25,true),
    (v_r,2,'Braunschweiger Dom (St. Blasii)','Romanische Kathedrale – Grabstätte Heinrichs des Löwen.',52.2659,10.5236,35,true),
    (v_r,3,'Dankwarderode Burg','Romanische Pfalz neben dem Burgplatz – Rekonstruktion des Löwenburg-Palastes.',52.2658,10.5227,25,true),
    (v_r,4,'Okerufer Spaziergang','Grüner Promenadenring entlang der Oker – Leinpfad durch den Grüngürtel.',52.2689,10.5200,35,true),
    (v_r,5,'Altstadtmarkt','Historischer Marktplatz mit dem gotischen Altstadtrathaus.',52.2668,10.5235,20,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'braunschweig','JGA Braunschweig – Innenstadt & Magniviertel','pd24-braunschweig-jga-01',
    'Braunschweiger JGA: Magniviertel-Bars, Schlossarkaden und das lebendige Nachtleben rund um den Kohlmarkt.',
    'Braunschweig Kohlmarkt',52.2672,10.5251,'public','editorial','["jga","magniviertel","innenstadt","braunschweig"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Kohlmarkt (Start)','Zentraler Innenstadtplatz – Treffpunkt mit Restaurantauswahl.',52.2672,10.5251,20,true),
    (v_r,2,'Magniviertel (Kneipen)','Historisches Viertel mit engen Gassen und vielen Bars – Braunschweiger Kneipenkultur.',52.2658,10.5270,75,true),
    (v_r,3,'Schlossarkaden (Bars)','Shopping-Center auf historischem Residenzschlossgelände – moderne Bars.',52.2678,10.5273,45,true),
    (v_r,4,'Eulenspiegelgasse (Craft-Beer)','Kleine Gasse mit Craft-Beer-Bars und Tapas-Lokalen.',52.2660,10.5280,60,false),
    (v_r,5,'Prinzenpark (Late Night)','Braunschweigs Nachtleben-Meile – diverse Clubs.',52.2680,10.5200,90,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'braunschweig','Braunschweig Architektur – Heinrichs Löwe & Romanik','pd24-braunschweig-architektur-01',
    'Braunschweiger Romanik und Stadtgeschichte: Burgplatz als ältester Stadtplatz, Dom St. Blasii und die Rekonstruktion des Residenzschlosses.',
    'Braunschweig Burgplatz',52.2657,10.5239,'public','editorial','["architektur","romanik","dom","braunschweig"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Burgplatz (Löwe & Dom)','Geschichtsträchtiger Platz mit Löwendenkmal und Dom-Ensemble.',52.2657,10.5239,20,true),
    (v_r,2,'Dom St. Blasii','Bedeutendste romanische Kirche Niedersachsens – Sarkophag Heinrichs des Löwen.',52.2659,10.5236,40,true),
    (v_r,3,'Dankwarderode Burg','Romanische Pfalz – heute Museum mit mittelalterlichen Kunstwerken.',52.2658,10.5227,35,true),
    (v_r,4,'Altstadtmarkt (Rathaus)','Gotisches Rathaus von 1393 – eindrucksvolle Arkadenfront.',52.2668,10.5235,20,true),
    (v_r,5,'Residenzschloss (Rekonstruktion)','Rekonstruiertes Residenzschloss als Einkaufszentrum – Spannungsfeld Geschichte.',52.2678,10.5273,15,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'braunschweig','Braunschweig Foto-Spots – Burgplatz & Oker','pd24-braunschweig-foto-01',
    'Braunschweigs beste Fotomotive: Löwendenkmal und Dom-Ensemble, Oker-Spiegelungen und das gotische Altstadtrathaus.',
    'Braunschweig Burgplatz',52.2657,10.5239,'public','editorial','["foto-spots","burgplatz","dom","braunschweig"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Burgplatz Löwe (Goldene Stunde)','Löwendenkmal mit Dom-Hintergrund – beste Aufnahme bei Sonnenuntergang.',52.2657,10.5239,25,true),
    (v_r,2,'Dom St. Blasii Westfassade','Romanische Fassadendetails – Morgenlicht von Westen.',52.2659,10.5236,20,true),
    (v_r,3,'Okerpromenade (Spiegelungen)','Baumgesäumter Kanal – Wasserspiegelungen bei Windstille.',52.2750,10.5100,25,true),
    (v_r,4,'Altstadtrathaus Arkaden','Gotische Dreierarkade – Architekturfotografie.',52.2668,10.5235,15,false),
    (v_r,5,'Magniviertel (Streetfoto)','Historische Gassen mit Fachwerkbauten – Street Photography.',52.2658,10.5270,20,false);

  -- ============================================================
  -- KIEL
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'kiel','Kiel Paare – Kieler Förde & Strandpromenade','pd24-kiel-paare-01',
    'Romantisches Kiel an der Ostsee: Fördepromenade mit Blick auf Kreuzfahrtschiffe, historischer Hafen und Badestrand bei Schilksee.',
    'Kiel Hauptbahnhof (Förde)',54.3149,10.1345,'public','editorial','["paare","foerde","ostsee","kiel"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Kieler Förde (Bahnhofsanleger)','Panoramablick auf die Förde – Ausflugsdampfer und Kreuzfahrtschiffe.',54.3149,10.1345,25,true),
    (v_r,2,'Kiel Hörn (Hafen)','Innenstadthafen mit historischem Feuerschiff und Yachten.',54.3200,10.1395,30,true),
    (v_r,3,'Düsternbrooker Gehölz','Naturpark direkt an der Förde – romantischer Waldspaziergang.',54.3390,10.1256,35,true),
    (v_r,4,'Strandpromenade Schilksee','Kieler Olympiahafen (1972) – Sandstrand und Cafés.',54.4300,10.1600,40,false),
    (v_r,5,'Kiellinie Förde-Promenade','Beliebte Uferpromenade für Abendspaziergang mit Fördeblick.',54.3350,10.1280,30,true);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'kiel','JGA Kiel – Hafen & Innenstadt','pd24-kiel-jga-01',
    'Kieler JGA: Hafenrundfahrt, Strandbar in Schilksee und das Nachtleben rund um die Holstenstraße.',
    'Kiel Innenstadt',54.3233,10.1228,'public','editorial','["jga","hafen","innenstadt","kiel"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Kiel Hörn (Startpunkt)','Innenstadthafen – Treffpunkt mit Meerblick.',54.3200,10.1395,20,true),
    (v_r,2,'Hafenrundfahrt','Schiffsfahrt durch den Kriegsmarinehafen – Kiel aus dem Wasser erleben.',54.3149,10.1345,60,true),
    (v_r,3,'Schilksee (Strandbar)','Olympiastrand mit Strandbar – Cocktails mit Ostseeblick.',54.4300,10.1600,60,true),
    (v_r,4,'Holstenstraße (Bars)','Kieler Einkaufsstraße mit Bars und Kneipen am Abend.',54.3233,10.1228,60,true),
    (v_r,5,'Kunstwerk Club','Kieler Club-Location für den Abschluss.',54.3200,10.1280,90,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'kiel','Kiel Architektur & Geschichte – Hafen & Nikolaikirche','pd24-kiel-architektur-01',
    'Kieler Maritime Geschichte: Nikolaikirche, Schifffahrtsmuseum und die Förde als natürliche Hafenarchitektur.',
    'Kiel Nikolaikirche',54.3233,10.1390,'public','editorial','["architektur","maritim","nikolaikirche","kiel"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Nikolaikirche Kiel','Gotische Backsteinkirche – Ernst-Barlach-Gedächtnisfigur „Geistkämpfer".',54.3233,10.1390,25,true),
    (v_r,2,'Schifffahrtsmuseum','Deutsches Schifffahrtsmuseum im historischen Gebäude – maritime Geschichte.',54.3200,10.1395,45,true),
    (v_r,3,'Kieler Rathaus','Backsteinrathaus mit Rathausturm – Aussicht über Kiel und Förde.',54.3225,10.1360,20,true),
    (v_r,4,'Marineehrenmal Laboe','Kriegsmarinegedenkstätte mit U-Boot-Museum (20 km).',54.4100,10.2200,60,false),
    (v_r,5,'Kiel Hörn Feuerschiff','Historisches Feuerschiff „Feuerschiff Kiel" – schwimmendes Denkmal.',54.3200,10.1395,15,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'kiel','Kiel Foto-Spots – Förde & Ostsee','pd24-kiel-foto-01',
    'Kiels maritime Bildmotive: Förde-Sonnenuntergang, Kreuzfahrtschiffe im Hafen und der Olympiastrand bei blauem Himmel.',
    'Kiel Kiellinie',54.3350,10.1280,'public','editorial','["foto-spots","foerde","ostsee","kiel"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Kiellinie (Förde-Sonnenuntergang)','Beliebtester Aussichtspunkt Kiels – Förde-Panorama in der Abendsonne.',54.3350,10.1280,30,true),
    (v_r,2,'Kiel Hörn (Schiffe)','Große Kreuzfahrtschiffe und Fähren – Perspektiven von unten.',54.3200,10.1395,25,true),
    (v_r,3,'Olympiahafen Schilksee','Segelboote vor Ostsee-Horizont – klassisches Kiel-Motiv.',54.4300,10.1600,30,true),
    (v_r,4,'Nikolaikirche (Detail-Barlach)','Ernst-Barlach-Skulptur – Schwarz-Weiß-Fotografie.',54.3233,10.1390,15,false),
    (v_r,5,'Düsternbrooker Weg (Segelboote)','Wohnviertel-Promenade mit Yachtblick – entspannte Streetfotografie.',54.3390,10.1256,20,false);

  -- ============================================================
  -- GELSENKIRCHEN
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'gelsenkirchen','Gelsenkirchen Paare – Nordsternpark & Wissenschaftspark','pd24-gelsenkirchen-paare-01',
    'Gelsenkirchen entdecken: Nordsternpark auf ehemaligem Zechengelände, Schloss Horst im Grünen und der moderne Wissenschaftspark.',
    'Nordsternpark Gelsenkirchen',51.5454,7.0611,'public','editorial','["paare","nordsternpark","industriekultur","gelsenkirchen"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Nordsternpark','Landesgartenschau-Gelände auf Zechengelände – grüner Park mit Industriekulisse.',51.5454,7.0611,40,true),
    (v_r,2,'Schloss Horst','Frührenaissance-Schloss am Emscher-Kanal – Wassergraben und Parkanlage.',51.5560,7.0080,35,true),
    (v_r,3,'Wissenschaftspark Gelsenkirchen','Postmodernes Bürogebäude von 1995 – innovative Architektur.',51.5177,7.1050,20,true),
    (v_r,4,'ZOOM Erlebniswelt','Erlebniszoo mit drei Kontinenten – optional für Paare mit Sinn für Natur.',51.5250,7.0920,90,false),
    (v_r,5,'Stadtgarten Gelsenkirchen','Traditionsreicher Stadtpark – Minigolf und Cafés.',51.5090,7.1040,25,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'gelsenkirchen','JGA Gelsenkirchen – Veltins-Arena & Innenstadt','pd24-gelsenkirchen-jga-01',
    'Gelsenkirchener JGA: Schalke-Tour durch die Veltins-Arena, Kneipentour in der Innenstadt und Abschluss im Nordsternpark.',
    'Veltins-Arena Gelsenkirchen',51.5543,7.0680,'public','editorial','["jga","veltins-arena","schalke","gelsenkirchen"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Veltins-Arena (Stadionführung)','Heimstadion des FC Schalke 04 – beeindruckende Stadiontour.',51.5543,7.0680,75,true),
    (v_r,2,'Schalker Markt (Kult-Kneipen)','Traditionskneipen rund um die Arena – authentisches Ruhrgebiet.',51.5500,7.0680,60,true),
    (v_r,3,'Buer Innenstadt','Nordstadtzentrum mit Marktplatz – Gastronomie und Bars.',51.5730,7.0500,45,true),
    (v_r,4,'Nordsternpark (Bier im Grünen)','Grillplatz im Park – entspannter JGA-Abschnitt.',51.5454,7.0611,60,false),
    (v_r,5,'Gelsenkirchen Innenstadt Clubs','Nachtleben in der City – diverse Optionen.',51.5177,7.0857,90,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'gelsenkirchen','Gelsenkirchen Foto-Spots – Arena & Industriepark','pd24-gelsenkirchen-foto-01',
    'Gelsenkirchens industrielle Bildwelten: Veltins-Arena-Perspektiven, Nordsternpark-Zechenarchitektur und Schloss Horst im Abendlicht.',
    'Veltins-Arena Gelsenkirchen',51.5543,7.0680,'public','editorial','["foto-spots","veltins-arena","industriekultur","gelsenkirchen"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Veltins-Arena Außen','Modernes Stadion aus verschiedenen Perspektiven – Dämmerungsaufnahmen.',51.5543,7.0680,25,true),
    (v_r,2,'Nordsternpark (Förderturm)','Zechenförderturm als Industriedenkmal – Schwarz-Weiß-Fotografie.',51.5454,7.0611,30,true),
    (v_r,3,'Schloss Horst (Wassergraben)','Renaissanceschloss spiegelt sich im Graben – Morgenstimmung.',51.5560,7.0080,25,true),
    (v_r,4,'Wissenschaftspark (Architektur)','Glasfassaden und postmoderne Formen – Architekturfotografie.',51.5177,7.1050,20,false),
    (v_r,5,'Emscher-Kanal Industriepanorama','Kanal mit Industriekulisse – langer Belichtungszeit Nachtaufnahmen.',51.5400,7.0500,20,false);

  -- ============================================================
  -- MOENCHENGLADBACH
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'moenchengladbach','Mönchengladbach Paare – Abteiberg & Schloss Rheydt','pd24-moenchengladbach-paare-01',
    'Romantisches Mönchengladbach: Das weltbekannte Abteiberg Museum, Schloss Rheydt mit Wassergraben und der historische Marktplatz.',
    'Museum Abteiberg Mönchengladbach',51.1977,6.4368,'public','editorial','["paare","abteiberg","schloss-rheydt","moenchengladbach"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Museum Abteiberg','Weltberühmtes postmodernes Museum von Hans Hollein – Pflichtbesuch für Kunstinteressierte.',51.1977,6.4368,60,true),
    (v_r,2,'Alter Markt (Altstadt)','Historischer Marktplatz mit Münster – Mittelpunkt der Altstadt.',51.1980,6.4389,25,true),
    (v_r,3,'Schloss Rheydt','Niederrheinische Renaissancewasserburg – Museum und Schlossgarten.',51.1550,6.4592,40,true),
    (v_r,4,'Kaiser-Friedrich-Halle','Historische Stadthalle am Abteiberg – Konzertveranstaltungen.',51.1985,6.4378,15,false),
    (v_r,5,'Bunter Garten Mönchengladbach','Botanischer Garten – Ruhepunkt am Stadtrand.',51.1900,6.4200,25,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'moenchengladbach','JGA Mönchengladbach – Innenstadt & Rheydt','pd24-moenchengladbach-jga-01',
    'Mönchengladbacher JGA: Altstadt-Bars, Schloss Rheydt-Besuch und Nachtleben in der Innenstadt.',
    'Mönchengladbach Innenstadt',51.1805,6.4428,'public','editorial','["jga","innenstadt","rheydt","moenchengladbach"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Alter Markt (Start)','Altstadt-Marktplatz – Einstimmung und erste Runde.',51.1980,6.4389,30,true),
    (v_r,2,'Rheydt Marktplatz (Bars)','Rheydt als zweites Stadtzentrum – eigene Kneipenszene.',51.1700,6.4500,60,true),
    (v_r,3,'Schloss Rheydt (Foto-Stop)','Kurzer Fotostop am Wassergraben des Renaissanceschlosses.',51.1550,6.4592,20,false),
    (v_r,4,'Hindenburgstraße (Innenstadt)','Haupteinkaufsstraße mit Bars und Restaurants.',51.1850,6.4380,50,true),
    (v_r,5,'Minto (Nightlife)','Einkaufscenter-Umfeld mit Clubs und Bars.',51.1900,6.4350,90,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'moenchengladbach','Mönchengladbach Foto-Spots – Abteiberg & Schloss','pd24-moenchengladbach-foto-01',
    'Mönchengladbachs Bildwelten: Abteiberg-Terrassenarchitektur, Schloss Rheydt im Wasserspiegellicht und der Münster-Münsterplatz.',
    'Museum Abteiberg Mönchengladbach',51.1977,6.4368,'public','editorial','["foto-spots","abteiberg","schloss-rheydt","moenchengladbach"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Abteiberg Museum Außen (Terrassenarchitektur)','Stufenförmige Fassade von Hans Hollein – Architekturfotografie aus verschiedenen Winkeln.',51.1977,6.4368,30,true),
    (v_r,2,'Münster Mönchengladbach','Romanische Stiftskirche – Westfassade im Morgenlicht.',51.1978,6.4382,20,true),
    (v_r,3,'Schloss Rheydt (Wassergraben)','Spiegelung des Renaissanceschlosses – beste Aufnahme bei Windstille.',51.1550,6.4592,30,true),
    (v_r,4,'Alter Markt (Fassaden)','Historische Marktplatzfassaden im Abendlicht.',51.1980,6.4389,15,false),
    (v_r,5,'Volkspark Mönchengladbach','Parkanlage – Naturfotografie und Herbstlicht.',51.2000,6.4200,20,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'gelsenkirchen','Gelsenkirchen Industriekultur – Zechenarchitektur & Schloss Horst','pd24-gelsenkirchen-architektur-01',
    'Gelsenkirchener Industriekultur: Zechengebäude als Denkmal im Nordsternpark, Schloss Horst als Frührenaissance-Juwel und der moderne Wissenschaftspark.',
    'Nordsternpark Gelsenkirchen',51.5454,7.0611,'public','editorial','["architektur","industriekultur","schloss-horst","gelsenkirchen"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Nordsternpark (Zechengebäude)','Ehemalige Zeche Nordstern – Industriedenkmal auf Landesgartenschau-Gelände.',51.5454,7.0611,40,true),
    (v_r,2,'Schloss Horst','Frührenaissance-Wasserburg von 1554 – ältestes Renaissanceschloss des Ruhrgebiets.',51.5560,7.0080,35,true),
    (v_r,3,'Wissenschaftspark Gelsenkirchen','Postmodernes Bürogebäude von Uwe Kiessler (1995) – Spiegelglasfassade.',51.5177,7.1050,20,true),
    (v_r,4,'ZOOM Erlebniswelt (Architektur)','Zoologische Gartengestaltung als Landschaftsarchitektur.',51.5250,7.0920,30,false),
    (v_r,5,'Veltins-Arena Außen','Retractable-Roof-Stadion – moderner Stadionbau der 1990er Jahre.',51.5543,7.0680,20,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'moenchengladbach','Mönchengladbach Architektur – Abteiberg & Stift','pd24-moenchengladbach-architektur-01',
    'Mönchengladbachs Architektur: Das weltberühmte Hollein-Museum am Abteiberg, die romanische Münsterbasilika und das Renaissanceschloss Rheydt.',
    'Museum Abteiberg Mönchengladbach',51.1977,6.4368,'public','editorial','["architektur","abteiberg","muenster","moenchengladbach"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Museum Abteiberg (Hollein-Bau)','Weltbekanntes postmodernes Museum von Hans Hollein (1982) – terrassenförmig in Hang integriert.',51.1977,6.4368,50,true),
    (v_r,2,'Münster Mönchengladbach (Basilika)','Romanische Stiftsbasilika – mittelalterlicher Kern der Stadt.',51.1978,6.4382,30,true),
    (v_r,3,'Schloss Rheydt (Renaissance)','Niederrheinisches Renaissanceschloss mit Wassergraben – Museum.',51.1550,6.4592,35,true),
    (v_r,4,'Kaiser-Friedrich-Halle','Historische Stadthalle – Gründerzeit-Repräsentativbau.',51.1985,6.4378,15,true),
    (v_r,5,'Alter Markt (Rathaus)','Historischer Marktplatz mit barockem Rathaus.',51.1980,6.4389,15,false);

  -- ============================================================
  -- MAGDEBURG
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'magdeburg','Magdeburg Paare – Dom & Elbpromenade','pd24-magdeburg-paare-01',
    'Romantisches Magdeburg: Ältester gotischer Dom Deutschlands, Elbpromenade mit Blick auf Grüne Zitadelle und abendlicher Spaziergang am Fluss.',
    'Magdeburger Dom',52.1280,11.6380,'public','editorial','["paare","dom","elbe","magdeburg"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Magdeburger Dom','Ältester gotischer Dom Deutschlands (1209) – Grabstätte Kaiser Ottos I.',52.1280,11.6380,45,true),
    (v_r,2,'Grüne Zitadelle (Hundertwasser)','Letztes vollendetes Projekt von Friedensreich Hundertwasser – schillerndes Außenbild.',52.1281,11.6297,30,true),
    (v_r,3,'Elbpromenade Stadtpark','Promenade am Westufer der Elbe – Blick auf Dom-Silhouette.',52.1300,11.6340,35,true),
    (v_r,4,'Hasselbachplatz (Gastronomie)','Magdeburgs Ausgehviertel – Cafés und Restaurants für Abendessen.',52.1217,11.6299,40,true),
    (v_r,5,'Herrenkrug Park','Weitläufige Parkanlage an der Alten Elbe – romantischer Abendspaziergang.',52.1460,11.6590,30,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'magdeburg','JGA Magdeburg – Hasselbachplatz & Elbauen','pd24-magdeburg-jga-01',
    'Magdeburger JGA: Hasselbachplatz als Kneipenmeile, Cocktailrunde in der Altstadt und Outdoor-Aktivitäten in den Elbauen.',
    'Hasselbachplatz Magdeburg',52.1217,11.6299,'public','editorial','["jga","hasselbachplatz","altstadt","magdeburg"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Hasselbachplatz (Start)','Magdeburgs lebhaftester Ausgehplatz – zahlreiche Bars.',52.1217,11.6299,30,true),
    (v_r,2,'Hasselbachplatz Kneipentour','Runde durch alle Hasselbachplatz-Bars – Magdeburger Abendkultur.',52.1217,11.6299,90,true),
    (v_r,3,'Alter Markt (Cocktails)','Historischer Marktplatz – Barauswahl im Stadtzentrum.',52.1257,11.6360,50,true),
    (v_r,4,'Elbauen (Strandbar)','Sommerliche Strandbar an der Elbe – entspannter JGA-Abschnitt.',52.1400,11.6500,60,false),
    (v_r,5,'Factory Magdeburg (Club)','Große Clubanlage – Magdeburger Nachtleben-Institution.',52.1200,11.6400,120,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'magdeburg','Magdeburg Architektur – Dom & Hundertwasser','pd24-magdeburg-architektur-01',
    'Magdeburgs architektonische Kontraste: Gotischer Dom und bunte Hundertwasser-Zitadelle, Otto-der-Große-Denkmal und moderne Elbbrücken.',
    'Magdeburger Dom',52.1280,11.6380,'public','editorial','["architektur","dom","hundertwasser","magdeburg"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Magdeburger Dom (Gotik)','Ältester gotischer Dom Deutschlands – Doppelturmfassade und romanischer Kreuzgang.',52.1280,11.6380,50,true),
    (v_r,2,'Grüne Zitadelle (Hundertwasser)','Postmodern-organische Architektur – schroffer Kontrast zum Dom.',52.1281,11.6297,35,true),
    (v_r,3,'Alter Markt (Rekonstruktion)','Wiederaufgebauter historischer Marktplatz – moderne Stadtplanung.',52.1257,11.6360,20,true),
    (v_r,4,'Kunstmuseum Magdeburg','Klosterbau des 10. Jahrhunderts – Kloster Unser Lieben Frauen.',52.1303,11.6355,35,true),
    (v_r,5,'Elbebrücken','Moderne Brückenkonstruktionen über die Elbe – Ingenieurbaukunst.',52.1250,11.6450,15,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'magdeburg','Magdeburg Foto-Spots – Dom & Elbe','pd24-magdeburg-foto-01',
    'Magdeburgs Bildwelten: Dom-Silhouette über der Elbe, farbenfrohe Hundertwasser-Fassaden und abendliche Elbpromenade.',
    'Magdeburger Dom',52.1280,11.6380,'public','editorial','["foto-spots","dom","elbe","magdeburg"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Dom Westfassade (Sonnenuntergang)','Gotische Türme im Abendrot – beste Aufnahme von der Elbseite.',52.1280,11.6380,25,true),
    (v_r,2,'Grüne Zitadelle (Farben)','Hundertwassers Farbigkeit – Detailaufnahmen der Fassade.',52.1281,11.6297,25,true),
    (v_r,3,'Elbpromenade (Dom-Spiegelung)','Dom-Reflexion in der Elbe bei ruhigem Wasser.',52.1300,11.6340,25,true),
    (v_r,4,'Kloster Unser Lieben Frauen','Romanisches Kloster – Kreuzgang-Architekturfotografie.',52.1303,11.6355,20,false),
    (v_r,5,'Herrenkrug Park (Naturfoto)','Naturpark mit Elbe-Auenlandschaft – Weitwinkelaufnahmen.',52.1460,11.6590,25,false);

  -- ============================================================
  -- FREIBURG IM BREISGAU
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'freiburg-im-breisgau','Freiburg Paare – Münster & Bächle','pd24-freiburg-im-breisgau-paare-01',
    'Romantisches Freiburg: Spaziergang durch die Bächle, Münstermarkt am frühen Morgen, Schlossberg-Sonnenuntergang und Wein aus dem Kaiserstuhl.',
    'Freiburger Münster',47.9953,7.8522,'public','editorial','["paare","muenster","baechle","freiburg"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Freiburger Münster','Gotisches Münster mit dem schönsten Turm der Christenheit (Burkhard von Halle) – Marktplatz-Atmosphäre.',47.9953,7.8522,45,true),
    (v_r,2,'Bächle Stadtspaziergang','Historische Wasserläufe durch die Altstadt – Legende: wer hineintritt, heiratet einen Freiburger.',47.9953,7.8522,25,true),
    (v_r,3,'Schlossberg (Aussicht)','Stadtberg mit Panoramablick über Freiburg, Schwarzwald und Kaiserstuhl.',47.9960,7.8605,35,true),
    (v_r,4,'Augustinerplatz (Abend)','Beliebter Abendplatz im Sommer – Picknick und Wein mit Einheimischen.',47.9937,7.8534,30,true),
    (v_r,5,'Stadtgarten (Rosengarten)','Botanischer Garten am Rande der Altstadt – Ruhepunkt.',47.9990,7.8480,25,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'freiburg-im-breisgau','JGA Freiburg – Altstadt & Weinstuben','pd24-freiburg-im-breisgau-jga-01',
    'Freiburger JGA: Kaiserstuhl-Weintour, Augustinerplatz-Stimmung und Nachtleben im Stühlinger-Viertel.',
    'Freiburg Augustinerplatz',47.9937,7.8534,'public','editorial','["jga","weinstuben","altstadt","freiburg"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Münstermarkt (Start)','Täglicher Wochenmarkt – lokale Produkte und Badischer Wein zum Einstieg.',47.9953,7.8522,30,true),
    (v_r,2,'Augustinerplatz (Wein im Freien)','Freiburgs bekanntester Treffpunkt – Wein und Bier im Freien.',47.9937,7.8534,60,true),
    (v_r,3,'Stühlinger Viertel (Bars)','Alternatives Szeneviertel – Craft-Beer und Cocktailbars.',47.9929,7.8424,60,true),
    (v_r,4,'Schlossberg (Nacht-Aussicht)','Beleuchtetes Freiburg bei Nacht – optionaler Aufstieg.',47.9960,7.8605,35,false),
    (v_r,5,'Freiburg Clubs','Nachtleben im Stühlinger und in der Innenstadt.',47.9929,7.8424,120,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'freiburg-im-breisgau','Freiburg Architektur – Münster & Altstadt','pd24-freiburg-im-breisgau-architektur-01',
    'Freiburgs Architekturjuwelen: Gotisches Münster als Marktplatz-Landmark, mittelalterliche Schwabentore und historische Zunfthäuser.',
    'Freiburger Münster',47.9953,7.8522,'public','editorial','["architektur","muenster","gotik","freiburg"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Freiburger Münster (Turm)','Gotischer Turm mit durchbrochenem Oktogon – Turmbesteigung mit Fernblick.',47.9953,7.8522,50,true),
    (v_r,2,'Historisches Kaufhaus','Rotes gotisches Kaufhaus am Münsterplatz – Habsburger Wappen.',47.9949,7.8518,20,true),
    (v_r,3,'Martinstor & Schwabentor','Zwei erhaltene Stadttore der mittelalterlichen Stadtmauer.',47.9930,7.8490,20,true),
    (v_r,4,'Augustinermuseum','Augustinerkloster als Museum – gotische Skulpturen im Originalkontext.',47.9940,7.8525,40,true),
    (v_r,5,'Colombipark (Stadtgeschichte)','Ehemaliges Festungsgelände – Stadtgeschichte im Grünen.',47.9992,7.8463,20,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'freiburg-im-breisgau','Freiburg Foto-Spots – Münster & Schlossberg','pd24-freiburg-im-breisgau-foto-01',
    'Freiburgs ikonische Bildmotive: Münster über dem Marktplatz, Bächle-Spiegelungen und Schlossberg-Panorama bei Sonnenuntergang.',
    'Freiburger Münster',47.9953,7.8522,'public','editorial','["foto-spots","muenster","schlossberg","freiburg"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Münster Marktplatz (Froschperspektive)','Turm-Perspektive von unten – Weitwinkel empfohlen.',47.9953,7.8522,25,true),
    (v_r,2,'Bächle Spiegelung','Wasseroberfläche der Bächle – Reflexionen des Münsters.',47.9950,7.8515,20,true),
    (v_r,3,'Schlossberg (Sonnenuntergang)','Panoramablick über Freiburg und Schwarzwald – Goldene Stunde.',47.9960,7.8605,30,true),
    (v_r,4,'Historisches Kaufhaus Fassade','Rote Fassade mit Habsburger Wappen – Detailaufnahmen.',47.9949,7.8518,15,false),
    (v_r,5,'Augustinerplatz (Street)','Lebendiges Alltagsleben – Street Photography.',47.9937,7.8534,20,false);

  -- ============================================================
  -- LUEBECK
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'luebeck','Lübeck Paare – Holstentor & Altstadt','pd24-luebeck-paare-01',
    'Romantisches UNESCO-Lübeck: Holstentor als Wahrzeichen, Abendspaziergang durch die mittelalterliche Backstein-Altstadt und Marzipan vom Café Niederegger.',
    'Holstentor Lübeck',53.8660,10.6832,'public','editorial','["paare","holstentor","altstadt","luebeck"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Holstentor','Wahrzeichen Lübecks und Symbol der Hanse – Stadttor von 1478.',53.8660,10.6832,30,true),
    (v_r,2,'Marktplatz & Rathaus','Gotisches Rathaus mit schwarzen glasierten Kacheln – Marktplatz-Atmosphäre.',53.8681,10.6868,25,true),
    (v_r,3,'Niederegger Marzipan (Café)','Traditionshaus seit 1806 – Marzipan-Spezialitäten und Café-Genuss.',53.8680,10.6864,30,true),
    (v_r,4,'Trave-Ufer (Abendspaziergang)','Ufer der Trave mit Blick auf Holstentor – romantische Abendsonne.',53.8660,10.6820,30,true),
    (v_r,5,'Buddenbrookhaus','Thomas Mann Gedenkstätte – literarisches Lübeck erfahren.',53.8682,10.6877,35,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'luebeck','JGA Lübeck – Altstadt & Travemünde','pd24-luebeck-jga-01',
    'Lübecker JGA: Altstadt-Weinstuben, Strandtag in Travemünde und abendliche Kneipentour durch das Gründerviertel.',
    'Holstentor Lübeck',53.8660,10.6832,'public','editorial','["jga","altstadt","travemuende","luebeck"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Holstentor (Einstiegs-Foto)','Pflicht-Gruppenfoto am Wahrzeichen zum JGA-Auftakt.',53.8660,10.6832,20,true),
    (v_r,2,'Altstadt-Weinstuben','Mittelalterliches Flair in Lübecks Gastronomie – Wein im Gewölbekeller.',53.8670,10.6860,60,true),
    (v_r,3,'Travemünde (Ostsee-Strand)','20 km östlich – Strandtag mit Strandkorb und Fischbrötchen.',53.9588,10.8675,120,false),
    (v_r,4,'Gründerviertel (Abendbar)','Szene-Viertel in Lübeck – Craft-Beer und gute Musik.',53.8650,10.6900,60,true),
    (v_r,5,'Lübeck Late Night','Diverse Kneipen und kleinere Clubs für den Abschluss.',53.8670,10.6870,90,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'luebeck','Lübeck UNESCO-Backstein – Hansearchitektur','pd24-luebeck-architektur-01',
    'Lübecks UNESCO-Welterbe: Backsteinarchitektur der Hanse, sieben Kirchtürme, Holstentor und das gotische Rathaus.',
    'Holstentor Lübeck',53.8660,10.6832,'public','editorial','["architektur","hanse","backstein","luebeck"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Holstentor (Stadttor 1478)','Meisterwerk der Backsteingotik – unsymmetrische Türme durch Bodensenkung.',53.8660,10.6832,25,true),
    (v_r,2,'Lübecker Dom (Backsteinromanik)','Romanischer Dom von 1173 – Heinrich der Löwe als Gründer.',53.8640,10.6882,35,true),
    (v_r,3,'Rathaus & Markt','Gotisches Rathaus in Schwarz – einzigartige Fassadengestaltung.',53.8681,10.6868,20,true),
    (v_r,4,'Marienkirche','Dreiflügeliche Kirche – Vorbild für alle Backsteinkirchen der Ostseeregion.',53.8672,10.6875,30,true),
    (v_r,5,'Heiligen-Geist-Hospital','Gotisches Hospital von 1286 – älteste erhaltene soziale Einrichtung Deutschlands.',53.8695,10.6875,20,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'luebeck','Lübeck Foto-Spots – Holstentor & Trave','pd24-luebeck-foto-01',
    'Lübecks berühmteste Bildmotive: Holstentor spiegelt sich in der Trave, sieben Türme der Altstadt und Backsteindetails.',
    'Holstentor Lübeck',53.8660,10.6832,'public','editorial','["foto-spots","holstentor","trave","luebeck"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Holstentor Trave-Reflexion','Klassisches Motiv: Spiegelung des Holstentors in der Trave – Morgen- oder Abendlicht.',53.8655,10.6825,30,true),
    (v_r,2,'Sieben-Türme-Panorama','Blick vom Trave-Ufer auf alle sieben Altstadtkirchtürme.',53.8645,10.6840,20,true),
    (v_r,3,'Rathaus Fassade','Schwarze Glasur-Kacheln im Detail – Makrofotografie.',53.8681,10.6868,15,true),
    (v_r,4,'Altstadt Salzspeicher','Historische Speicher direkt am Holstentor – Industriearchitektur.',53.8655,10.6840,20,false),
    (v_r,5,'Marienkirche (Innen)','Hochgotisches Kircheninneres – Weitwinkel und Gegenlicht-Komposition.',53.8672,10.6875,20,false);

  -- ============================================================
  -- ERFURT
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'erfurt','Erfurt Paare – Krämerbrücke & Domhügel','pd24-erfurt-paare-01',
    'Romantisches Erfurt: Mittelalterliche Krämerbrücke mit Fachwerkhäusern, Domhügel-Panorama und Abendessen in der Altstadt.',
    'Krämerbrücke Erfurt',50.9776,11.0280,'public','editorial','["paare","kraemerbruecke","dom","erfurt"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Krämerbrücke','Einzige mittelalterliche, noch bewohnte Brücke nördlich der Alpen – 32 Fachwerkhäuser.',50.9776,11.0280,35,true),
    (v_r,2,'Erfurter Dom (St. Marien)','Gotische Kathedrale auf dem Domhügel – Gloriosa-Glocke und Wolfram-Leuchter.',50.9740,11.0249,40,true),
    (v_r,3,'Severikirche','Fünftürmige Kirche direkt neben dem Dom – eindrucksvolles Doppel.',50.9738,11.0254,20,true),
    (v_r,4,'Fischmarkt (Altstadt)','Historischer Marktplatz mit Rathaus – Schmuckstück der Gründerzeit.',50.9779,11.0300,25,true),
    (v_r,5,'Petersberg Zitadelle','Barockfestung auf dem Petersberg – Panorama über Erfurt.',50.9800,11.0225,30,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'erfurt','JGA Erfurt – Altstadt & Kneipengassen','pd24-erfurt-jga-01',
    'Erfurter JGA: Krämerbrücken-Shops am Tag, Cocktailrunde auf dem Fischmarkt und Nachtleben in der Altstadt.',
    'Krämerbrücke Erfurt',50.9776,11.0280,'public','editorial','["jga","altstadt","kneipengassen","erfurt"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Krämerbrücke (Start)','Mittelalterliche Brücke mit kleinen Shops – erster Anlaufpunkt.',50.9776,11.0280,30,true),
    (v_r,2,'Fischmarkt (Bars & Restaurants)','Historischer Marktplatz – breit gefächertes Restaurantangebot.',50.9779,11.0300,60,true),
    (v_r,3,'Futterstraße / Marktstraße (Kneipen)','Altstadt-Kneipenachse – Erfurts beliebteste Abend-Locations.',50.9770,11.0295,75,true),
    (v_r,4,'Petersberg (Abend-Blick)','Optionaler Aufstieg zur Zitadelle – Erfurt bei Nacht.',50.9800,11.0225,30,false),
    (v_r,5,'Erfurt Clubs (Innenstadt)','Diverse Clubs für den Abschluss – Nachtleben in der Altstadt.',50.9779,11.0300,120,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'erfurt','Erfurt Architektur – Mittelalter & Barock','pd24-erfurt-architektur-01',
    'Erfurts außergewöhnliche Dichte mittelalterlicher Architektur: Dom, Krämerbrücke, Petersberg-Zitadelle und Augustinerkloster.',
    'Erfurter Dom',50.9740,11.0249,'public','editorial','["architektur","mittelalter","dom","erfurt"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Erfurter Dom (Gotik)','Gotische Kathedrale auf dem Domhügel – Gloriosa-Glocke (1497, größte freischwingende Glocke der Welt).',50.9740,11.0249,45,true),
    (v_r,2,'Krämerbrücke (Mittelalter)','Einzige noch bewohnte mittelalterliche Brücke mit Fachwerkhäusern.',50.9776,11.0280,30,true),
    (v_r,3,'Petersberg Zitadelle','Barockfestungsanlage auf dem Petersberg – besterhaltene Barockfestung Mitteleuropas.',50.9800,11.0225,35,true),
    (v_r,4,'Augustinerkloster','Kloster, in dem Martin Luther Mönch war – Reformation in Erfurt.',50.9748,11.0242,35,true),
    (v_r,5,'Alte Synagoge','Älteste erhaltene Synagoge Deutschlands (1094) – jüdisches Mittelalter.',50.9780,11.0310,30,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'erfurt','Erfurt Foto-Spots – Krämerbrücke & Domhügel','pd24-erfurt-foto-01',
    'Erfurts malerische Bildmotive: Krämerbrücke im Morgennebel, Doppelkirchen-Ensemble vom Domplatz und Petersberg-Panorama.',
    'Krämerbrücke Erfurt',50.9776,11.0280,'public','editorial','["foto-spots","kraemerbruecke","dom","erfurt"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Krämerbrücke (Morgennebel)','Fachwerkhäuser auf der Brücke im Frühnebel – beste Aufnahme früh morgens.',50.9776,11.0280,30,true),
    (v_r,2,'Domhügel (Dom + Severi)','Doppelkirchen-Ensemble auf Treppenanlage – Weitwinkel von unten.',50.9740,11.0251,25,true),
    (v_r,3,'Petersberg (Stadtpanorama)','Überblick über Erfurt von der Zitadellenmauer.',50.9800,11.0225,25,true),
    (v_r,4,'Alte Synagoge (Detailarchitektur)','Romanisches Mauerwerk – historische Architekturfotografie.',50.9780,11.0310,15,false),
    (v_r,5,'Fischmarkt (Gründerzeit)','Historische Rathausfassade im Abendlicht.',50.9779,11.0300,15,false);

end $$;

commit;
