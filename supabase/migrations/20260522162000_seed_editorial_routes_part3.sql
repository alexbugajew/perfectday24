-- ============================================================
-- Editorial Routes Seed – Part 3:
--   Hannover, Nürnberg, Bremen, Dortmund,
--   Essen, Bonn, Münster, Mannheim, Wiesbaden, Aachen, Karlsruhe
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
  -- HANNOVER
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'hannover','Herrenhäuser Gärten – Barockpracht zu zweit','pd24-hannover-paare-01',
    'Europas bedeutendste Barockgärten: Großer Garten mit Heckentheater, Fontäne und dem Berggarten – romantischer Spaziergang für Verliebte.',
    'Großer Garten Hannover',52.3886,9.6927,'public','editorial','["paare","herrenhausen","barock","hannover"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Großer Garten (Herrenhausen)','82 ha Barockgarten – Fontäne, Labyrinth und Grotten als Fotohighlights.',52.3886,9.6927,45,true),
    (v_r,2,'Berggarten (Dahliengarten)','Botanischer Garten direkt nebenan – Kakteenhaus und Dahlienpracht.',52.3902,9.6940,25,true),
    (v_r,3,'Welfenschloss (Leibniz Universität)','Prachtvilles Gründerzeitschloss der Universität – herrliche Gartenanlage.',52.3814,9.7176,20,true),
    (v_r,4,'Neues Rathaus (Kuppelaufzug)','Wilhelminischer Prachtbau mit schrägem Aufzug – Panorama über Hannover.',52.3679,9.7399,30,true),
    (v_r,5,'Maschsee (Abendspaziergang)','Künstlicher See mit Ruderbooten und Cafés – Hannoveraner Lieblingsort.',52.3630,9.7407,30,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'hannover','JGA Hannover – Altstadt & List','pd24-hannover-jga-01',
    'Hannoveraner JGA: Altstadt-Kneipen, List-Barszene und der lebhafteste Markt Niedersachsens.',
    'Hannover Altstadt',52.3739,9.7363,'public','editorial','["jga","list","altstadt","hannover"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Hannover Altstadt (Marktkirche)','Gotische Hallenkirche – rote Backsteinarchitektur, Zentrum der Altstadt.',52.3739,9.7353,20,true),
    (v_r,2,'Kramerstraße / Altstadt-Kneipen','Kopfsteinpflaster, Fachwerk und Kneipen – echtes Hannover-Feeling.',52.3739,9.7363,45,true),
    (v_r,3,'Lister Meile (Cafés & Bars)','Hannoveraner Szeneboulevard mit Cafés, Bars und Independent-Shops.',52.3820,9.7500,45,true),
    (v_r,4,'Fössestraße (Craft-Beer)','Kreatives Viertel mit Brauereien und Craft-Beer-Bars.',52.3710,9.7000,50,false),
    (v_r,5,'Ihmeufer (Strandbar)','Open-Air-Bar am Fluss – entspannter Abschluss des JGA-Tages.',52.3684,9.7119,40,true);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'hannover','Hannover Architektur – Neues Rathaus & Sprengel','pd24-hannover-architektur-01',
    'Hannoveraner Architekturvielfalt: Wilhelminisches Rathaus, Sprengel Museum und der Funkturm – eine Zeitreise durch Baustile.',
    'Neues Rathaus Hannover',52.3679,9.7399,'public','editorial','["architektur","rathaus","sprengel","hannover"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Neues Rathaus (1913)','Einziger schräger Kuppelaufzug der Welt – Aussichtsplattform mit Hannover-Panorama.',52.3679,9.7399,35,true),
    (v_r,2,'Sprengel Museum','Brutalistischer Museumsbau mit Picasso und Miro – Architektur so bedeutend wie die Kunst.',52.3638,9.7375,25,true),
    (v_r,3,'Niedersächsisches Staatstheater','Neoklassizistischer Theaterbau am Opernplatz – Hannoveraner Kulturerbe.',52.3720,9.7406,15,true),
    (v_r,4,'Anzeiger-Hochhaus','Deutschlands erster Hochhausbau mit kupfergrüner Kuppel – Art déco am Steintor.',52.3752,9.7448,15,true),
    (v_r,5,'Herrenhäuser Gärten (Galerie)','Moderne Galerie im wiederaufgebauten Galeriegebäude – zeitgenössische Kunst trifft Barockgarten.',52.3886,9.6927,25,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'hannover','Hannover Foto-Spots – Maschsee bis Herrenhausen','pd24-hannover-foto-01',
    'Die schönsten Hannover-Fotospots: Neues Rathaus Spiegelung, Herrenhausen-Fontäne, Maschsee-Ufer und die Altstadt-Gassen.',
    'Maschsee Hannover',52.3630,9.7407,'public','editorial','["foto-spots","maschsee","herrenhausen","hannover"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Maschsee (Spiegelung Rathaus)','Rathaus spiegelt sich perfekt im See – Sonnenaufgang oder kurz vor Sonnenuntergang.',52.3630,9.7407,20,true),
    (v_r,2,'Neues Rathaus (Kuppelperspektive)','Von unten: Fischaugen-Aufnahme der Kuppel – ungewöhnlicher Winkel.',52.3679,9.7399,15,true),
    (v_r,3,'Herrenhäuser Großer Garten (Fontäne)','82 m hohe Fontäne – wird stündlich abgeschossen, perfektes Timing.',52.3886,9.6927,30,true),
    (v_r,4,'Altstadt-Gassen (Fachwerk)','Reste historischer Fachwerkbauten – besonders am frühen Morgen menschenleer.',52.3739,9.7363,20,true),
    (v_r,5,'Tiergarten Hannover (Natur)','Wildgehege mit Rehen und Wasservögeln – stiller Gegenpol zur Stadt.',52.4013,9.7617,25,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'hannover','Hannover romantisch – Eilenriede & Georgengarten','pd24-hannover-paare-02',
    'Hannoveraner Naturidylle: Eilenriede-Stadtwald, Georgengarten mit Schloss Herrenhausen und stiller Welfengarten – Erholung pur.',
    'Eilenriede Hannover',52.3820,9.7700,'public','editorial','["paare","eilenriede","natur","hannover"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Eilenriede (Stadtwald)','Einer der größten innerstädtischen Wälder Europas – 650 ha Naturerholung.',52.3820,9.7700,40,true),
    (v_r,2,'Georgengarten (Welfengarten)','Englischer Landschaftspark neben der Universität – Teiche und alte Bäume.',52.3844,9.7250,30,true),
    (v_r,3,'Welfenschloss Terrasse','Blick über den Welfengarten vom Schlossbau der Uni – ruhiger Spaziergang.',52.3814,9.7176,20,true),
    (v_r,4,'Stadtwald Picknick (Eilenriede)','Ruhige Lichtungen und Waldwege – ideal für ein romantisches Picknick.',52.3850,9.7800,35,false),
    (v_r,5,'Ihmeufer Sonnenuntergang','Uferspaziergang an der Ihme bei Abendsonne.',52.3684,9.7119,25,true);

  -- ============================================================
  -- NÜRNBERG
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'nuernberg','Kaiserburg & Altstadt – Nürnbergs Mittelalter-Highlights','pd24-nuernberg-architektur-01',
    'Die mittelalterliche Reichsstadt: Kaiserburg, Stadtmauer, Weißgerbergasse und der Hauptmarkt – Nürnberg in seiner historischsten Form.',
    'Kaiserburg Nürnberg',49.4577,11.0785,'public','editorial','["architektur","mittelalter","kaiserburg","nuernberg"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Kaiserburg Nürnberg','Residenz der deutschen Kaiser – Sinwellturm mit kostenlosem Panoramablick.',49.4577,11.0785,40,true),
    (v_r,2,'Stadtmauer & Neutorturm','Fast vollständig erhaltene mittelalterliche Stadtmauer – Wehrgang begehbar.',49.4550,11.0700,25,true),
    (v_r,3,'Weißgerbergasse','Dichtes Reihe historischer Fachwerkhäuser – malerischste Gasse Nürnbergs.',49.4541,11.0738,20,true),
    (v_r,4,'Hauptmarkt (Schöner Brunnen)','Gotischer Brunnen mit 40 Figuren – berühmter Ring soll Glück bringen.',49.4530,11.0772,20,true),
    (v_r,5,'Henkersteg (Holzbrücke)','Überdachte Holzbrücke über die Pegnitz – einer der romantischsten Spots Nürnbergs.',49.4557,11.0735,15,true);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'nuernberg','JGA Nürnberg – Altstadt & Szeneviertel','pd24-nuernberg-jga-01',
    'Fränkischer JGA: Altstadt-Kneipen, Craftbeer am Handwerkerhof und die lebhafte Lorenzer Altstadt.',
    'Handwerkerhof Nürnberg',49.4467,11.0777,'public','editorial','["jga","handwerkerhof","frankisch","nuernberg"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Handwerkerhof','Stilisiertes Mittelalterdorf am Königstor – Handwerk und fränkische Spezialitäten.',49.4467,11.0777,30,true),
    (v_r,2,'Bratwurst Röslein (Hauptmarkt)','Berühmtestes Bratwurstrestaurant der Welt – kleine fränkische Bratwürste im Bund.',49.4528,11.0773,35,true),
    (v_r,3,'Lorenzer Altstadt (Kneipen)','Bars und Cafés in historischen Gebäuden rund um St. Lorenz.',49.4485,11.0782,60,true),
    (v_r,4,'Meistersingerhalle / Szeneviertel','Nürnberger Kulturzentrum – abendliche Veranstaltungen und Bars.',49.4425,11.0922,45,false),
    (v_r,5,'Tafelhalle (Kulturzentrum)','Industriebau mit Bar und Events – alternatives Nürnberg.',49.4383,11.1019,45,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'nuernberg','Nürnberg Foto-Spots – Henkersteg bis Burg','pd24-nuernberg-foto-01',
    'Nürnbergs schönste Fotomotive: Henkersteg, Pegnitzufer, Kaiserburg-Panorama und die Weißgerbergasse bei Morgengrauen.',
    'Henkersteg Nürnberg',49.4557,11.0735,'public','editorial','["foto-spots","altstadt","pegnitz","nuernberg"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Henkersteg','Romantischster Spot Nürnbergs – überdachte Holzbrücke, frühmorgens menschenleer.',49.4557,11.0735,20,true),
    (v_r,2,'Weißgerbergasse (Fachwerk)','Engste und schönste Fachwerkgasse – Spiegelreflektion in Regenpfützen.',49.4541,11.0738,20,true),
    (v_r,3,'Kaiserburg (Panoramablick)','Blick vom Burghügel über die gesamte Altstadt und Pegnitztal.',49.4577,11.0785,25,true),
    (v_r,4,'Schöner Brunnen (Hauptmarkt)','Gotischer Brunnen – am frühen Morgen ohne Menschenmassen fotografieren.',49.4530,11.0772,15,true),
    (v_r,5,'St. Lorenz (Abendlicht)','Gotische Hallenkirche – Westfassade bei Abendsonne leuchtend orange.',49.4485,11.0782,20,true);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'nuernberg','Nürnberg romantisch – Pegnitz & Stadtpark','pd24-nuernberg-paare-01',
    'Das ruhige Nürnberg: Pegnitzufer, Stadtpark, Hesperidengärten und Burggarten – perfekt für einen entspannten Paar-Tag.',
    'Stadtpark Nürnberg',49.4606,11.0769,'public','editorial','["paare","pegnitz","stadtpark","nuernberg"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Stadtpark (Brunnen & Weiher)','Weitläufiger Stadtpark nordöstlich der Altstadt – Teiche und Rosengarten.',49.4606,11.0769,30,true),
    (v_r,2,'Burggarten Nürnberg','Stiller Garten unter der Kaiserburg – lauschige Plätze und Weinbergblick.',49.4590,11.0752,20,true),
    (v_r,3,'Pegnitzufer (Henkersteg-Bereich)','Spaziergang am Fluss – historische Mühlen und Wassertürme.',49.4557,11.0735,25,true),
    (v_r,4,'Hesperidengärten (Wöhrder See)','Historische Barockgärten mit Wöhrder See – Skulpturen und Brunnen.',49.4630,11.0940,30,false),
    (v_r,5,'Weinstube (Altstadt)','Fränkische Weinstube mit Frankenwein – gemütlicher Tagesausklang.',49.4530,11.0772,35,true);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'nuernberg','Nürnberg Moderne – Dokumentationszentrum & Luitpoldhain','pd24-nuernberg-architektur-02',
    'Das andere Nürnberg: NS-Dokumentationszentrum, Reichsparteitagsgelände und der Luitpoldhain – ein Ort für historische Reflexion.',
    'Dokumentationszentrum NS-Reichsparteitagsgelände',49.4350,11.1228,'public','editorial','["architektur","geschichte","moderne","nuernberg"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Dokumentationszentrum NS-Reichsparteitagsgelände','Weltklasse-Museum zur NS-Geschichte im unvollendeten Kongressbau.',49.4350,11.1228,60,true),
    (v_r,2,'Zeppelinfeld (Tribüne)','Colosseum-ähnliche Sporttribüne – heutiger Veranstaltungsort, begehbar.',49.4280,11.1266,25,true),
    (v_r,3,'Silbersee (Dutzendteich)','Natursee neben dem Parteitagsgelände – erholsamer Kontrast zur Geschichte.',49.4317,11.1150,20,false),
    (v_r,4,'Luitpoldhain (Ehrenhain)','Gedenkstätte im Park – stiller Ort der Erinnerung.',49.4387,11.1010,20,true),
    (v_r,5,'Germanisches Nationalmuseum','Größtes kulturhistorisches Museum Deutschlands – Ausstellungsgebäude verschiedener Epochen.',49.4477,11.0742,30,false);

  -- ============================================================
  -- BREMEN
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'bremen','Schnoor & Böttcherstraße – romantisches Mittelalter-Bremen','pd24-bremen-paare-01',
    'Bremer Seele zu zweit: Das mittelalterliche Schnoorviertel, die expressionistische Böttcherstraße und der Marktplatz mit Roland.',
    'Schnoorviertel Bremen',53.0752,8.8100,'public','editorial','["paare","schnoor","boettcherstrasse","bremen"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Schnoorviertel','Engste Gassen Bremens mit Fischerhäuschen – mittelalterliches Flair.',53.0752,8.8100,30,true),
    (v_r,2,'Böttcherstraße','108 m Expressionismus-Gasse – Glockenspiel täglich, Klinker und Skulpturen.',53.0749,8.8059,25,true),
    (v_r,3,'Marktplatz (Roland & Rathaus)','UNESCO-Welterbe – Roland-Statue (1404) und gotisches Rathaus.',53.0754,8.8076,20,true),
    (v_r,4,'Dom St. Petri','Bremer Dom mit Bleikeller – Turmaufstieg mit Weserpanorama.',53.0756,8.8082,20,true),
    (v_r,5,'Schlachte (Weserpromenade)','Historische Hafenmeile am Weserufer – Bars, Restaurants und Schiffe.',53.0760,8.8020,30,true);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'bremen','Bremen Architektur – Jugendstil, Moderne & Rathaus','pd24-bremen-architektur-01',
    'UNESCO Rathaus, Art Deco der Böttcherstraße und Bremer Jugendstilvillen in Schwachhausen – Bremens architektonische Bandbreite.',
    'Bremer Rathaus (UNESCO)',53.0754,8.8076,'public','editorial','["architektur","unesco","rathaus","bremen"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Bremer Rathaus (UNESCO)','Gotisches Rathaus (1405) – Goldene Kammer und Stadtwaage.',53.0754,8.8076,25,true),
    (v_r,2,'Böttcherstraße (Expressionismus)','Gesamtkunstwerk von Bernhard Hoetger – Backsteinexpressionismus, täglich Glockenspiell.',53.0749,8.8059,20,true),
    (v_r,3,'Stadtbibliothek (Am Wall)','Modernisierter historischer Bau am Altstadtring – interessante Fassadenkontraste.',53.0777,8.8085,15,false),
    (v_r,4,'Kunsthalle Bremen','Klassizistischer Museumsbau von 1849 – Anbau von 2011 als Kontrast.',53.0777,8.8118,20,true),
    (v_r,5,'Lloydhof Passage','Historische Einkaufspassage mit Jugendstilelementen.',53.0770,8.8079,15,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'bremen','JGA Bremen – Viertel & Weser','pd24-bremen-jga-01',
    'Bremer JGA im Viertel: Ostertorviertel-Bars, Schlachte-Kneipen und das bunte Leben in Bremens beliebtestem Ausgehviertel.',
    'Ostertorviertel Bremen',53.0769,8.8204,'public','editorial','["jga","viertel","ostertor","bremen"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Ostertorviertel (\"Das Viertel\")','Bremens Szeneviertel – Cafés, Bars, Vintage-Shops und Galerien.',53.0769,8.8204,45,true),
    (v_r,2,'Steinstraße / Fehrfeld','Alternativmeile mit Bars für jeden Geschmack.',53.0776,8.8238,60,true),
    (v_r,3,'Schlachte Abend','Weserpromenade mit Hausbooten, Bars und Restaurantschiffen.',53.0760,8.8020,45,true),
    (v_r,4,'Teerhof (Halbinsel)','Kunstmeile auf der Weserinsel – kleine Galerien und Ateliers.',53.0752,8.8000,25,false),
    (v_r,5,'Reisigerstraße / Sielwall','Lebhaftes Nachtleben im Viertel – Abschluss der Partynacht.',53.0776,8.8238,60,true);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'bremen','Bremen Foto-Spots – Roland bis Weserpromenade','pd24-bremen-foto-01',
    'Die schönsten Bremenfotomotive: Roland, Böttcherstraße-Portalblick, Weser-Panorama vom Teerhof und der nächtliche Schnoor.',
    'Bremer Roland',53.0754,8.8076,'public','editorial','["foto-spots","roland","weser","bremen"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Roland (Frontalblick)','6 m hohe Ritterfigur – beste Perspektive von der Marktplatzmitte.',53.0754,8.8076,15,true),
    (v_r,2,'Böttcherstraße (Portal)','Goldener Reliefbogen am Eingang – besonders abends beleuchtet photogen.',53.0749,8.8059,20,true),
    (v_r,3,'Teerhof (Weserpanorama)','Halbinsel in der Weser – Dom, Rathaus und Weserbrücken im Blick.',53.0752,8.8000,20,true),
    (v_r,4,'Schnoor bei Nacht','Enge Gassen mit Laternenbeleuchtung – magisch nach Einbruch der Dunkelheit.',53.0752,8.8100,20,true),
    (v_r,5,'Wallanlagen (Mühle)','Stadtpark-Ring mit historischer Windmühle – grüne Insel in der Innenstadt.',53.0769,8.8071,20,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'bremen','Bremen Natur & Entspannung – Bürgerpark & Weser','pd24-bremen-paare-02',
    'Das grüne Bremen: Bürgerpark-Mühlenteich, Stadtwaldsee und der ruhige Weserlauf – Erholung pur für Paare.',
    'Bürgerpark Bremen',53.0930,8.8248,'public','editorial','["paare","buergerpark","natur","bremen"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Bürgerpark (Mühlenteich)','Einer der ältesten Volksparks Deutschlands – Ruderboote am Mühlenteich.',53.0930,8.8248,35,true),
    (v_r,2,'Kaffee Haake (Parkrestaurant)','Historisches Café mitten im Bürgerpark – Kuchengenuss in Gartenatmosphäre.',53.0910,8.8220,25,true),
    (v_r,3,'Stadtwaldsee','Idyllischer See im Stadtwaldgebiet – Schwimmen im Sommer.',53.0850,8.8448,30,false),
    (v_r,4,'Osterdeich (Weserspaziergang)','Populärer Flanierweg am Weserdamm – Grillen und Sonnenbaden erlaubt.',53.0690,8.8338,30,true),
    (v_r,5,'Weserpromenade Schlachte','Abendspaziergang mit Blick auf beleuchtete Brücken.',53.0760,8.8020,25,true);

  -- ============================================================
  -- DORTMUND
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'dortmund','Dortmunder U & Industriekultur','pd24-dortmund-architektur-01',
    'Vom Bier zur Kultur: Das Dortmunder U als Medienkunstzentrum, Zeche Zollern und das neue Stadtquartier am Hafen.',
    'Dortmunder U',51.5177,7.4652,'public','editorial','["architektur","industrie","dortmunder-u","dortmund"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Dortmunder U','Ehemaliges Dortmunder Union-Brauereihochhaus – heute Medienkunstzentrum mit Dachterrasse.',51.5177,7.4652,35,true),
    (v_r,2,'Reinoldikirche','Mittelalterliche Stadtkirche – Turm mit Stadtpanorama.',51.5139,7.4651,20,true),
    (v_r,3,'Stadtgarten Dortmund','Ruhiger Stadtpark nahe der Innenstadt.',51.5167,7.4622,20,false),
    (v_r,4,'Zeche Zollern (Industriedenkmal)','\"Schloss der Arbeit\" – Jugendstil-Portal und begehbare Industrieanlage.',51.5293,7.3561,40,true),
    (v_r,5,'Phoenix See','Ehemaliger Stahlwerks-Standort – heute Naherholungsgebiet mit Yachthafen.',51.4847,7.5011,30,true);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'dortmund','JGA Dortmund – Kreuzviertel & Nachtleben','pd24-dortmund-jga-01',
    'JGA in Dortmunds lebendigstem Kiez: Kreuzviertel mit Gründerzeitflair, Craft-Bier-Szene und die Ausgeh-Meile rund um die Innenstadt.',
    'Kreuzviertel Dortmund',51.5217,7.4672,'public','editorial','["jga","kreuzviertel","nachtleben","dortmund"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Kreuzviertel (Lindemannstraße)','Gründerzeitviertel mit Boutique-Bars, Cafés und Kneipen.',51.5217,7.4672,45,true),
    (v_r,2,'Brauereiführung Dortmund','Einblick in Dortmunds Brauerei-Erbe – Bier gehört zur DNA der Stadt.',51.5177,7.4652,40,false),
    (v_r,3,'Westfälischer Anzeiger Passage','Historische Passage für die erste Cocktailrunde.',51.5139,7.4651,30,true),
    (v_r,4,'Kleppingstraße / Innenstadt-Bars','Dortmunds zentrale Ausgeh-Meile.',51.5155,7.4670,60,true),
    (v_r,5,'FZW (Freizeitzentrum West)','Dortmunds größter Club – Musik und Partys.',51.5083,7.4514,90,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'dortmund','Dortmund Foto-Spots – Signal Iduna Park bis Phoenix See','pd24-dortmund-foto-01',
    'Dortmunds ikonischste Fotomotive: Signal Iduna Park von außen, Dortmunder U-Dachpanorama, Zeche Zollern und Phoenix See.',
    'Signal Iduna Park',51.4926,7.4519,'public','editorial','["foto-spots","signal-iduna","phoenix-see","dortmund"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Signal Iduna Park (Außenansicht)','Größtes Fußballstadion Deutschlands – gelbe Wand auch von außen beeindruckend.',51.4926,7.4519,20,true),
    (v_r,2,'Dortmunder U (Dachterrasse)','360°-Blick über das Ruhrgebiet – abends beleuchtetes U leuchtet weit.',51.5177,7.4652,25,true),
    (v_r,3,'Zeche Zollern Jugendstil-Portal','Schmiedeeisernes Tor und Backsteingebäude – Industriearchitektur als Fotomotiv.',51.5293,7.3561,25,true),
    (v_r,4,'Phoenix See (Wasserspiegelung)','Neuer See mit Yachten – Spiegelung der Ufergebäude im ruhigen Wasser.',51.4847,7.5011,20,true),
    (v_r,5,'Reinoldikirche Turm','Altstadt-Panorama und Ruhrgebietsblick vom Kirchturm.',51.5139,7.4651,20,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'dortmund','Dortmund Paare – Phoenix See & Hohensyburg','pd24-dortmund-paare-01',
    'Das romantische Dortmund: Phoenix See mit Uferpromenade und der mittelalterliche Hohensyburg mit Ruhr-Panorama.',
    'Phoenix See Dortmund',51.4847,7.5011,'public','editorial','["paare","phoenix-see","hohensyburg","dortmund"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Phoenix See Uferpromenade','Rundweg um den See – Restaurants und Eisdielen am Ufer.',51.4847,7.5011,40,true),
    (v_r,2,'Phoenix See Hafengebäude','Moderne Architektur am Seeufer – interessante Fassaden und Stege.',51.4850,7.5020,15,false),
    (v_r,3,'Hörder Burg (Ruine)','Mittelalterliche Burganlage am Phoenix See – stiller Picknick-Spot.',51.4860,7.4982,20,true),
    (v_r,4,'Hohensyburg (Bergplateau)','Burganlage über dem Ruhrufer – weiter Blick über das Ruhrtal.',51.4505,7.5173,30,true),
    (v_r,5,'Kaiser-Wilhelm-Denkmal (Hohensyburg)','Imposantes Reiterstandbild auf dem Bergplateau.',51.4510,7.5180,15,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'dortmund','Dortmund Industriekultur & Ruhrgebiet','pd24-dortmund-architektur-02',
    'Das Ruhrgebiet hautnah: Zeche Zollern, Industriedenkmal Hoesch-Museum und die einzigartige Industrielandschaft des Reviers.',
    'Zeche Zollern Dortmund',51.5293,7.3561,'public','editorial','["architektur","industriekultur","zeche","dortmund"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Zeche Zollern','Schönste Zeche des Ruhrgebiets – Jugendstil-Eingangsgebäude und begehbare Maschinen.',51.5293,7.3561,50,true),
    (v_r,2,'Zechenpark (Bövinghausen)','Parkanlage auf dem ehemaligen Zechengelände – Fördertürme und Wasserflächen.',51.5300,7.3550,20,false),
    (v_r,3,'Westfalenpark','Riesengroßer Stadtpark mit Blumenbeeten und Freizeitangeboten.',51.5032,7.4833,30,false),
    (v_r,4,'Dortmunder U (Medienkunst)','Ausstellung moderner Medienkunst – Videoinstallationen und digitale Kunst.',51.5177,7.4652,35,true),
    (v_r,5,'Brückenviertel (Grünfläche)','Entspannter Park unter historischen Ruhrgebiets-Brücken.',51.5100,7.4600,20,false);

  -- ============================================================
  -- ESSEN
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'essen','Zeche Zollverein – UNESCO Welterbe der Industriekultur','pd24-essen-architektur-01',
    'Das bedeutendste Industriedenkmal der Welt: Zeche Zollverein mit Ruhr Museum, Coking Plant und stimmungsvollem Areal.',
    'Zeche Zollverein Essen',51.4871,7.0435,'public','editorial','["architektur","unesco","zollverein","essen"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Schacht XII (Förderturm)','Ikonisches Fördergerüst – Bauhaus-Architektur der 1930er Jahre.',51.4871,7.0435,30,true),
    (v_r,2,'Ruhr Museum','Weltklasse-Industriegeschichte im alten Kohlewäsche-Gebäude.',51.4882,7.0443,40,true),
    (v_r,3,'Kokerei (Coking Plant)','Riesige Koks-Anlage – Führungen durch die beeindruckende Infrastruktur.',51.4879,7.0415,30,true),
    (v_r,4,'Zollverein Areal (Spaziergang)','Gesamtareal mit Kunstinstallationen, Eisbahn (Winter) und Gastronomie.',51.4875,7.0440,25,false),
    (v_r,5,'Design Center Zollverein','Ausstellungen zeitgenössischen Designs im Industriegebäude.',51.4868,7.0432,25,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'essen','Essen Paare – Villa Hügel & Baldeneysee','pd24-essen-paare-01',
    'Das elegante Essen: Villa Hügel der Familie Krupp, Baldeneysee-Promenade und der stille Heissiwald.',
    'Villa Hügel Essen',51.4129,7.0074,'public','editorial','["paare","villa-hugel","baldeney","essen"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Villa Hügel','Repräsentationsgebäude der Krupps – Park frei zugänglich, Ausblick auf Baldeneysee.',51.4129,7.0074,35,true),
    (v_r,2,'Baldeneysee (Promenade)','Ruhrgebiet-Stausee – Segeln, Rudern und Spaziergänge am Ufer.',51.4088,7.0163,40,true),
    (v_r,3,'Heissiwald (Naturschutz)','Urwald-artiger Wald am Baldeneysee – romantische Waldwege.',51.4060,7.0180,30,false),
    (v_r,4,'Strandbad Seaside Beach','Urbaner Stadtsstrand am Baldeneysee – Liegestühle und Strandflair.',51.4043,7.0222,30,true),
    (v_r,5,'Haus Scheppen (Fotospot)','Historisches Herrenhaus am Seeufer – romantischer Abschluss.',51.4033,7.0250,15,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'essen','Essen Foto-Spots – Zollverein bis Folkwang','pd24-essen-foto-01',
    'Essens beste Fotospots: Zollverein-Förderturm, Museum Folkwang, Grugapark-Symmetrien und Baldeneysee-Sonnenuntergang.',
    'Museum Folkwang Essen',51.4531,7.0145,'public','editorial','["foto-spots","zollverein","folkwang","essen"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Museum Folkwang (David Chipperfield)','Eleganter Museumsneubau – Lichtarchitektur und klare Geometrie.',51.4531,7.0145,25,true),
    (v_r,2,'Zeche Zollverein Förderturm','UNESCO-Ikone – von unten fotografiert mit Weitwinkel.',51.4871,7.0435,25,true),
    (v_r,3,'Grugapark (Rosengarten)','Weitläufiger Botanischer Garten – Rosenpracht und grüne Symmetrien.',51.4449,7.0024,25,true),
    (v_r,4,'Villa Hügel (Parkblick)','Krupp-Residenz mit freiem Park – Jugendstil-Villa mit Waldkulisse.',51.4129,7.0074,20,true),
    (v_r,5,'Baldeneysee Sonnenuntergang','Stausee glänzt bei Abendsonne golden – romantischster Moment Essens.',51.4088,7.0163,20,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'essen','JGA Essen – Rüttenscheid & Kreativviertel','pd24-essen-jga-01',
    'JGA im Rüttenscheider Viertel: die beliebteste Ausgehmeile Essens mit Boutique-Bars, Restaurants und Nachtleben.',
    'Rüttenscheid Essen',51.4403,7.0097,'public','editorial','["jga","ruettenscheid","bars","essen"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Rüttenscheider Straße','Essens schönste Flaniermeile mit Cafés, Boutiquen und Restaurants.',51.4403,7.0097,40,true),
    (v_r,2,'Rü-Markt (Wochenmarkt)','Beliebter Markt mittwochs und samstags – lokale Produkte und Street Food.',51.4400,7.0100,30,false),
    (v_r,3,'Rottstraße (Bars)','Barszene in Rüttenscheid – Cocktails und Craft Beer.',51.4410,7.0120,60,true),
    (v_r,4,'Museum Folkwang Café','Nachmittagskaffee im eleganten Museumsambiente.',51.4531,7.0145,30,false),
    (v_r,5,'Zeche Zollverein (Abend)','Illuminiertes Industriedenkmal bei Nacht – Abschluss des JGA-Tages.',51.4871,7.0435,30,true);

  -- ============================================================
  -- BONN
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'bonn','Beethoven & Rhein – romantisches Bonn','pd24-bonn-paare-01',
    'Bonns charmante Doppelnatur: Beethovens Geburtshaus, rheinische Gemütlichkeit und romantischer Spaziergang durch die Bonner Altstadt.',
    'Beethoven-Haus Bonn',50.7339,7.0985,'public','editorial','["paare","beethoven","altstadt","bonn"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Beethoven-Haus','Geburtshaus des Komponisten – Museum mit Originalinstrumenten.',50.7339,7.0985,25,true),
    (v_r,2,'Münsterplatz (Beethoven-Denkmal)','Gotisches Münster und Beethoven-Statue – belebter Stadtmittelpunkt.',50.7363,7.0992,15,true),
    (v_r,3,'Rheinuferpromenade (Kennedybrücke)','Bonner Rheinpromenade – Siebengebirge in der Ferne.',50.7374,7.1020,25,true),
    (v_r,4,'Altes Rathaus & Markt','Rokoko-Rathaus auf dem Markt – wunderschöne Fassade in Rosa.',50.7353,7.0990,15,true),
    (v_r,5,'Botanischer Garten (Uni Bonn)','Einer der ältesten Gärten Deutschlands – ruhige Oase im Universitätsviertel.',50.7347,7.0959,30,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'bonn','Bonn Architektur – Museumsmeile & Regierungsviertel','pd24-bonn-architektur-01',
    'Das Bonner Bundesviertel: Museumsmeile, Post Tower, ehemaliges Regierungsviertel und das UN-Campus-Areal.',
    'Bundeskunsthalle Bonn',50.7216,7.1131,'public','editorial','["architektur","museumsmeile","modern","bonn"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Bundeskunsthalle (Gustav Peichl)','Drei Türme und Dachrampensystem – markanter Museumsneubau von 1992.',50.7216,7.1131,25,true),
    (v_r,2,'Kunstmuseum Bonn','Transparenter Glasneubau – Sammlung rheinischer Expressionisten.',50.7211,7.1135,20,true),
    (v_r,3,'Deutsches Museum Bonn','Wissenschaftsmuseum in elegantem Neubau – Forschung und Innovation.',50.7197,7.1163,20,false),
    (v_r,4,'Post Tower (DHL)','42 Stockwerke hoher Glastower – Landmark des Bonner Südens.',50.7162,7.1189,15,true),
    (v_r,5,'Altes Wasserwerk / UN-Campus','Historisches Pumpenhaus und modernes UN-Hochhaus als Kontrast.',50.7200,7.1167,20,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'bonn','JGA Bonn – Altstadt & Südstadt Weinbars','pd24-bonn-jga-01',
    'Bonner JGA: Studentenkneipen rund ums Münster, Südstadt-Weinbars und die Rheinpromenade bei Abenddämmerung.',
    'Bonner Münsterplatz',50.7363,7.0992,'public','editorial','["jga","altstadt","weinbar","bonn"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Münsterplatz Cafés','Startpunkt am schönsten Platz Bonns – Kaffee und erste Fotos.',50.7363,7.0992,25,true),
    (v_r,2,'Bonner Altstadt-Kneipen (Sterntorstraße)','Studenten-Kneipenmeile rund ums Sterntor.',50.7340,7.0994,50,true),
    (v_r,3,'Südstadt (Brotfabrik)','Kulturzentrum mit Bar und Biergarten in der Bonner Südstadt.',50.7274,7.0912,45,true),
    (v_r,4,'Rheinufer Abendlicht','Romantischer Sonnenuntergang über dem Rhein Richtung Siebengebirge.',50.7374,7.1020,30,true),
    (v_r,5,'Beuel (Rheinseite)','Ruhige Rheinseite mit Blick zurück auf Bonn – Bars und Restaurants.',50.7374,7.1100,40,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'bonn','Bonn Foto-Spots – Siebengebirge bis Rheinauenpark','pd24-bonn-foto-01',
    'Die schönsten Bonn-Fotospots: Altes Rathaus, Rheinpanorama mit Siebengebirge, Rheinaue und die Rosengarten-Symmetrien.',
    'Altes Rathaus Bonn',50.7353,7.0990,'public','editorial','["foto-spots","rhein","siebengebirge","bonn"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Altes Rathaus (Rokoko-Fassade)','Rosa Fassade mit Außentreppe – beste Fotoperspektive von der Marktmitte.',50.7353,7.0990,15,true),
    (v_r,2,'Rheinufer (Siebengebirge-Blick)','Blick über den Rhein zum Drachenfels – bei klarem Wetter atemberaubend.',50.7374,7.1020,20,true),
    (v_r,3,'Rheinaue (Botanisch)','Großer Rheinauenpark mit Rhododendronhain und Seenlandschaft.',50.7027,7.1204,30,true),
    (v_r,4,'Bundeskunsthalle Dachgarten','Kostenloser Dachgarten mit Bonn-Panorama – Säulengarten.',50.7216,7.1131,20,false),
    (v_r,5,'Kreuzberg (Pilgerort)','Spätbarocke Wallfahrtskirche auf Erhebung – Weinberg-Panorama.',50.7048,7.0771,25,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'bonn','Bonn Natur – Siebengebirge & Drachenfels','pd24-bonn-paare-02',
    'Tagesausflug ins Siebengebirge: Drachenfels mit Burgruine, Rheinblick aus 321 m und Ahrthal-Wein als romantischer Abschluss.',
    'Drachenfels Königswinter',50.6595,7.1880,'public','editorial','["paare","siebengebirge","drachenfels","bonn"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Drachenfels Burgruine','321 m hoch – älteste Zahnradbahn Deutschlands oder zu Fuß hinauf.',50.6595,7.1880,40,true),
    (v_r,2,'Drachenfels Panorama','Weiter Rhein-Blick von der Burgruine – Köln und Bonn bei klarem Wetter.',50.6598,7.1883,20,true),
    (v_r,3,'Schloss Drachenburg','Neugotisches Märchenschloss am Drachenfels-Hang – täglich geöffnet.',50.6620,7.1897,25,false),
    (v_r,4,'Rheinufer Königswinter','Spaziergänge am Rhein mit Blick zurück auf den Drachenfels.',50.6655,7.1898,25,true),
    (v_r,5,'Weinzimmer Drachenfels','Weinprobe mit Siebengebirgs-Wein auf dem Gipfelweg.',50.6595,7.1880,30,false);

  -- ============================================================
  -- MÜNSTER
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'muenster','Prinzipalmarkt & Altstadt – das historische Münster','pd24-muenster-architektur-01',
    'Münsters UNESCO-Ensemble: Prinzipalmarkt mit Renaissance-Giebeln, Dom St. Paulus und das historische Rathaus des Westfälischen Friedens.',
    'Prinzipalmarkt Münster',51.9619,7.6272,'public','editorial','["architektur","prinzipalmarkt","westfaelischer-frieden","muenster"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Prinzipalmarkt','Münsters elegante Hauptstraße mit gotischen und barocken Giebelhäusern – Arkadengänge.',51.9619,7.6272,25,true),
    (v_r,2,'Historisches Rathaus (Westfälischer Frieden)','Saal des Westfälischen Friedens von 1648 – Originalschauplatz des Friedensvertrags.',51.9625,7.6270,25,true),
    (v_r,3,'Dom St. Paulus','Romanisch-gotische Doppelturmkirche – astronomische Uhr von 1540.',51.9628,7.6258,25,true),
    (v_r,4,'Domplatz (Wochenmarkt)','Mittwochs und samstags Münsters größter Markt – Blumen, Käse und regionale Spezialitäten.',51.9628,7.6258,20,false),
    (v_r,5,'Kiepenkerl','Statue des Münsteraner Händlers mit Kiepe – kulturelles Wahrzeichen.',51.9618,7.6255,10,true);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'muenster','Aasee & Promenade – Münster entspannt','pd24-muenster-paare-01',
    'Münsters grüne Seele: Promenade-Fahrradtour, Aasee-Spiegelungen und der Skulpturenpark mit internationaler Kunst.',
    'Aasee Münster',51.9479,7.6171,'public','editorial','["paare","aasee","promenade","muenster"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Promenade (Fahrradtour)','Münsters legendäre Ringstraße – autofreier Grünzug um die Altstadt, am besten per Rad.',51.9624,7.6257,30,true),
    (v_r,2,'Aasee (Skulpturenweg)','Künstlicher See mit Open-Air-Skulpturen – Claes Oldenburg Riesenball.',51.9479,7.6171,35,true),
    (v_r,3,'Mühlenhof-Freilichtmuseum','Historische Mühlen und Bauerngüter am Aasee – idyllisch.',51.9435,7.6125,25,false),
    (v_r,4,'LWL-Museum für Kunst und Kultur','Moderner Museumskomplex am Domplatz – Architektur und Sammlung.',51.9624,7.6252,25,true),
    (v_r,5,'Aasee Biergarten (Abend)','Biergarten am Seeufer – entspannter Tagesausklang mit Wasserblick.',51.9500,7.6180,35,true);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'muenster','JGA Münster – Kuhviertel & Nachtleben','pd24-muenster-jga-01',
    'Münsteraner JGA im Studenten-Viertel: Kuhviertel-Bars, Promenade-Radtour und Münsters bunte Gastroszene.',
    'Kuhviertel Münster',51.9654,7.6349,'public','editorial','["jga","kuhviertel","bars","muenster"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Kuhviertel','Studierende Ausgehmeile – Bars, Clubs und Biergärten im historischen Viertel.',51.9654,7.6349,60,true),
    (v_r,2,'Hansaviertel (Alternative Szene)','Alternatives Viertel mit Galerien, Cafés und kleinen Bars.',51.9643,7.6162,45,true),
    (v_r,3,'Jovel Music Hall','Münsters größte Konzerthalle – Events und Partys.',51.9680,7.6215,60,false),
    (v_r,4,'Promenade (Radtour-Abstecher)','Kurze Radtour auf der Promenade – Stadtluft schnappen.',51.9624,7.6257,30,false),
    (v_r,5,'Café Kleekamp (Kultcafé)','Legendäres Münsteraner Café für den morgendlichen Abschluss.',51.9619,7.6272,30,true);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'muenster','Münster Foto-Spots – Dom bis Aasee','pd24-muenster-foto-01',
    'Münsters schönste Fotomotive: Prinzipalmarkt-Giebel, Dom-Reflexion im Domplatz, Aasee-Skulpturen und die herbstliche Promenade.',
    'Dom St. Paulus Münster',51.9628,7.6258,'public','editorial','["foto-spots","prinzipalmarkt","aasee","muenster"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Prinzipalmarkt (Giebelperspektive)','Reihe historischer Giebelhäuser – Weitwinkel-Aufnahme von der Stirnseite.',51.9619,7.6272,20,true),
    (v_r,2,'Dom St. Paulus (Turmaufstieg)','Blick über die Münsteraner Altstadt von oben.',51.9628,7.6258,25,true),
    (v_r,3,'Aasee (Claes Oldenburg Kugel)','Riesige Plastik-Spiegelkugel am Aasee – abstrakter Fotospot.',51.9479,7.6171,20,true),
    (v_r,4,'Promenade (Herbstlicht)','Doppelreihe der Platanen – besonders schön in Herbstfarben.',51.9624,7.6257,20,false),
    (v_r,5,'Erbdrostenhof','Barockpalais aus dem 17. Jahrhundert – verstecktes Architekturjuwel.',51.9620,7.6262,15,false);

  -- ============================================================
  -- MANNHEIM
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'mannheim','Mannheim Architektur – Planstadt & Wasserturm','pd24-mannheim-architektur-01',
    'Europas größte Barockplanstadt: Residenzschloss, Schachbrettgrundriss und der prächtige Jugendstil-Wasserturm – Mannheims Stadtbild-Erbe.',
    'Wasserturm Mannheim',49.4828,8.4744,'public','editorial','["architektur","planstadt","wasserturm","mannheim"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Wasserturm','Jugendstil-Wahrzeichen Mannheims auf dem Friedrichsplatz – beleuchtet im Brunnenrund.',49.4828,8.4744,20,true),
    (v_r,2,'Residenzschloss Mannheim','Eines der größten Barockschlösser Europas – 400 m lange Fassade.',49.4820,8.4638,30,true),
    (v_r,3,'Planken (Schachbrettgrundriss)','Mannheims Haupteinkaufsstraße – das Raster-Straßensystem hat keine Straßennamen.',49.4870,8.4730,20,true),
    (v_r,4,'Kunsthalle Mannheim','Preisgekrönter Museumsneubau von Gerkan & Marg – Glasfassade am Friedrichsplatz.',49.4832,8.4777,20,true),
    (v_r,5,'Nationaltheater Mannheim','Ältestes Nationaltheater Deutschlands – Uraufführungsort von Schillers Räubern.',49.4818,8.4776,15,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'mannheim','Mannheim Paare – Rhein, Neckar & Luisenpark','pd24-mannheim-paare-01',
    'Mannheims Wasserseite zu zweit: Rheinstrand, Luisenpark-Spaziergänge und Abend-Spaziergang am Neckarufer.',
    'Luisenpark Mannheim',49.4876,8.4901,'public','editorial','["paare","luisenpark","rhein","mannheim"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Luisenpark','Parkanlage mit Schmetterlinghaus, See und Konzertpavillon.',49.4876,8.4901,35,true),
    (v_r,2,'Fernmeldeturm Mannheim','Aussichtsturm im Luisenpark – Panoramablick über Rhein und Neckar.',49.4903,8.4931,20,true),
    (v_r,3,'Rheinstrand (Reiß-Insel)','Naturufer am Rhein – kleiner Strand und Natur direkt in der Stadt.',49.4700,8.4620,30,true),
    (v_r,4,'Neckarvorland (Abendspaziergang)','Uferweg entlang des Neckars – stilles Mannheim abseits der City.',49.4869,8.4638,25,false),
    (v_r,5,'Rosengarten (Abend)','Kongresszentrum mit Rosengarten – beleuchteter Brunnen am Abend.',49.4832,8.4760,20,true);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'mannheim','JGA Mannheim – Jungbusch & Innenstadt','pd24-mannheim-jga-01',
    'Mannheims JGA-Viertel Jungbusch: Techno-Clubs, Craft Beer und die vielfältigste Barszene zwischen Rhein und Neckar.',
    'Jungbusch Mannheim',49.4927,8.4650,'public','editorial','["jga","jungbusch","techno","mannheim"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Jungbusch Hafen (Foodtrucks)','Street-Food am Hafenbecken – Startpunkt des JGA-Abends.',49.4927,8.4650,30,true),
    (v_r,2,'Hafenstraße (Bars & Clubs)','Mannheims bekannteste Club-Meile – von Electro bis Hip-Hop.',49.4930,8.4657,90,true),
    (v_r,3,'SAP Arena Umfeld (Vorhang)','Konzerte und Events in Mannheims größter Halle.',49.4648,8.5119,30,false),
    (v_r,4,'Quadrate (Planken)','Mannheims Innenstadt-Quadrate – Cocktailbars in historischen Häusern.',49.4870,8.4730,50,true),
    (v_r,5,'Alte Feuerwache (Club)','Kultiger Club in historischer Feuerwache – Mannheims beste Partyadresse.',49.4870,8.4769,90,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'mannheim','Mannheim Foto-Spots – Wasserturm bis Kurpfalzbrücke','pd24-mannheim-foto-01',
    'Mannheims beste Fotospots: Wasserturm-Reflexion, Schloss-Fassade, Kurpfalzbrücke mit Hafen und Technoseum.',
    'Wasserturm Mannheim',49.4828,8.4744,'public','editorial','["foto-spots","wasserturm","schloss","mannheim"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Wasserturm Spiegelung','Brunnenbecken spiegelt den Turm perfekt – beste Zeit: früh morgens.',49.4828,8.4744,20,true),
    (v_r,2,'Schloss Mannheim (Ehrenhof)','400 m Schlossfassade – Symmetrie und Barockprunk.',49.4820,8.4638,20,true),
    (v_r,3,'Kurpfalzbrücke (Schlossblick)','Brücke über den Neckar mit Schloss im Hintergrund.',49.4830,8.4620,15,true),
    (v_r,4,'Jungbusch Hafen','Industrieller Hafen mit alten Lagerhäusern – urbane Fotografie.',49.4927,8.4650,20,false),
    (v_r,5,'Technoseum (Fassade)','Moderner Museumsbau – spannende Winkel und Strukturfotografie.',49.4878,8.4806,15,false);

  -- ============================================================
  -- WIESBADEN
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'wiesbaden','Wiesbaden Gründerzeit – Kurhaus & Wilhelmstraße','pd24-wiesbaden-architektur-01',
    'Europas schönste Kurstadt: Neoklassizistisches Kurhaus, prächtige Wilhelmstraße und das Kochbrunnen-Gebäude – Wiesbadens Belle Époque.',
    'Kurhaus Wiesbaden',50.0830,8.2432,'public','editorial','["architektur","kurhaus","gruenderzeit","wiesbaden"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Kurhaus Wiesbaden','Neoklassizistisches Meisterwerk von 1907 – Spielbank, Restaurant und Kurgarten.',50.0830,8.2432,25,true),
    (v_r,2,'Kurgarten','Gartenanlage vor dem Kurhaus – Brunnen und gepflegte Beete.',50.0833,8.2432,15,true),
    (v_r,3,'Wilhelmstraße','Wiesbadens Prachtboulevard – Jugendstil- und Gründerzeitfassaden auf 1 km.',50.0826,8.2400,20,true),
    (v_r,4,'Kochbrunnen','Heißeste Thermalquelle Wiesbadens – 66°C, schwefelhaltig.',50.0814,8.2393,15,true),
    (v_r,5,'Hessisches Staatstheater','Neobarocker Theaterbau von 1894 – einer der schönsten Theaterbauten Deutschlands.',50.0821,8.2462,15,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'wiesbaden','Wiesbaden Paare – Neroberg & Weinberge','pd24-wiesbaden-paare-01',
    'Wiesbadens romantische Höhe: Nerobergbahn zur Russisch-Orthodoxen Kirche, Weinbergsblick und lauschige Weingüter.',
    'Neroberg Wiesbaden',50.0952,8.2367,'public','editorial','["paare","neroberg","weinberge","wiesbaden"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Nerobergbahn (Wasserballast-Standseilbahn)','Einzige Wasserballast-Standseilbahn der Welt (1888) – romantische Fahrt auf den Neroberg.',50.0952,8.2367,15,true),
    (v_r,2,'Russisch-Orthodoxe Kirche (Neroberg)','Goldene Zwiebeltürme – 1855 für die russische Gattin Herzog Adolfs errichtet.',50.0952,8.2367,20,true),
    (v_r,3,'Neroberg-Panorama','Bester Blick über Wiesbaden und den Rheingau.',50.0960,8.2370,20,true),
    (v_r,4,'Weinberge Neroberg','Historische Weinbergterrassen – Weinprobe beim Weingut Schloss Schönborn.',50.0950,8.2350,35,true),
    (v_r,5,'Biebricher Schloss (Rheinufer)','Barockes Wasserschloss am Rheinufer – Park und Blick auf Mainz.',50.0072,8.2419,25,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'wiesbaden','JGA Wiesbaden – Kurhaus-Glam & Innenstadt','pd24-wiesbaden-jga-01',
    'Glamouröser Wiesbaden-JGA: Spielbank im Kurhaus, Wilhelmstraße-Shopping und Sektempfang in eleganten Bars.',
    'Spielbank Wiesbaden im Kurhaus',50.0830,8.2432,'public','editorial','["jga","spielbank","glamour","wiesbaden"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Kurhaus & Spielbank','Dresscode-Spielbank – Roulette, Sekt und Glamour.',50.0830,8.2432,45,true),
    (v_r,2,'Wilhelmstraße (Sekt-Bar)','Sektbar im historischen Gebäude – Wiesbadener Eleganz.',50.0826,8.2400,40,true),
    (v_r,3,'Mauritiusstraße (Szeneviertel)','Kleines Gastromeile mit Cocktailbars und Weinstuben.',50.0793,8.2467,50,true),
    (v_r,4,'Rheingauer Weinlokal','Weinstuben mit Rheingauer Riesling – Pflichtprogramm in Wiesbaden.',50.0814,8.2393,45,true),
    (v_r,5,'Schiersteiner Hafen (Abschluss)','Kleines Hafenviertel am Rhein – Bars und Rheinblick.',50.0160,8.2189,40,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'wiesbaden','Wiesbaden Foto-Spots – Kurhaus bis Neroberg','pd24-wiesbaden-foto-01',
    'Die schönsten Wiesbaden-Fotomotive: Kurhaus-Fassade, Neroberg-Kirchturmspitzen, Kochbrunnen-Dampf und Wilhelmstraßen-Symmetrien.',
    'Kurhaus Wiesbaden',50.0830,8.2432,'public','editorial','["foto-spots","kurhaus","neroberg","wiesbaden"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Kurhaus Frontale','Neoklassizistische Säulenfassade – bestes Licht am Vormittag von der Gartenachse.',50.0830,8.2432,20,true),
    (v_r,2,'Griechische Kapelle (Neroberg)','Goldene Kuppeln ragen über den Weinbergen – einzigartiges Fotomotiv.',50.0952,8.2367,20,true),
    (v_r,3,'Kochbrunnen (Dampfsäule)','Natürlicher Thermal-Dampf – besonders bei kühler Luft fotogen.',50.0814,8.2393,15,true),
    (v_r,4,'Wilhelmstraße (Fluchtpunkt)','Perfekte Fluchtpunkt-Fotografie durch die Jugendstil-Allee.',50.0826,8.2400,15,false),
    (v_r,5,'Biebricher Schloss (Rheinspiegelung)','Barockes Schloss spiegelt sich im Rheinstrom.',50.0072,8.2419,20,false);

  -- ============================================================
  -- AACHEN
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'aachen','Aachener Dom & Altstadt – Karls Erbe','pd24-aachen-architektur-01',
    'UNESCO-Welterbe Aachener Dom: Oktogon Karls des Großen, Domschatzkammer und das historische Rathaus auf dem Katschhof.',
    'Aachener Dom',50.7753,6.0839,'public','editorial','["architektur","dom","karl-der-grosse","aachen"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Aachener Dom (Oktogon)','UNESCO-Welterbe – Karls des Großen Pfalzkapelle aus dem 9. Jahrhundert.',50.7753,6.0839,35,true),
    (v_r,2,'Domschatzkammer','Weltklasse-Reliquienschatz – Goldene Büste Karls des Großen.',50.7753,6.0839,25,true),
    (v_r,3,'Historisches Rathaus (Katschhof)','Gotisches Rathaus auf dem Fundament von Karls Pfalz – Krönungssaal.',50.7758,6.0842,20,true),
    (v_r,4,'Ponttor','Mächtigstes erhaltenes Stadttor Deutschlands – Mittelalterliche Befestigungsanlage.',50.7817,6.0806,15,true),
    (v_r,5,'Elisenbrunnen','Neoklassizistischer Brunnen über heißen Thermalquellen – kostenlos probieren.',50.7749,6.0867,15,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'aachen','JGA Aachen – Ponttor & Studentenmeile','pd24-aachen-jga-01',
    'Aachener JGA: Studenten-Kneipenmeile rund ums Ponttor, Cocktailbars am Dom und der Abend im lebhaften Hochschulviertel.',
    'Ponttor Aachen',50.7817,6.0806,'public','editorial','["jga","ponttor","studentenmeile","aachen"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Ponttor (Foto-Einstieg)','Mächtiges Stadttor als Startpunkt – Mittelalter-Selfie inklusive.',50.7817,6.0806,15,true),
    (v_r,2,'Pontstraße (Kneipenviertel)','Aachens bekannteste Kneipenmeile – über 80 Bars und Restaurants.',50.7786,6.0848,60,true),
    (v_r,3,'Dom-Umgebung (Cocktailbars)','Moderne Bars direkt neben dem UNESCO-Dom.',50.7753,6.0839,45,true),
    (v_r,4,'Büchel (Nachtleben)','Aachener Club-Straße für Partynächte.',50.7750,6.0880,75,false),
    (v_r,5,'Strandgut (Bierbar)','Kultiger Außenbar-Bereich in der Aachener Innenstadt.',50.7753,6.0839,40,true);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'aachen','Aachen Paare – Lousberg & Therme','pd24-aachen-paare-01',
    'Das entspannte Aachen zu zweit: Lousberg mit Panoramablick, Carolus-Thermen und das grüne Kurpark-Viertel.',
    'Lousberg Aachen',50.7880,6.0790,'public','editorial','["paare","lousberg","therme","aachen"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Lousberg (Panorama)','Aachens höchste Erhebung – 264 m, Blick über die Stadt und Eifel.',50.7880,6.0790,25,true),
    (v_r,2,'Lousbergteich','Romantischer Teich unter alten Bäumen – Enten und stille Wege.',50.7875,6.0800,20,true),
    (v_r,3,'Carolus-Thermen','Hochwertige Thermalanlage in Aachens warmem Mineralwasser.',50.7724,6.1028,60,false),
    (v_r,4,'Westpark (Stadtgarten)','Gestaltete Grünanlage nahe der Innenstadt.',50.7750,6.0920,20,false),
    (v_r,5,'Elisenbrunnen & Kurpark','Thermalquellen-Promenade – Spaziergang durch den kleinen Kurpark.',50.7749,6.0867,20,true);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'aachen','Aachen Foto-Spots – Dom bis Grenzdreieck','pd24-aachen-foto-01',
    'Aachens beste Fotospots: Domkuppel, Ponttor-Perspektiven, Rathaus-Golddetails und das Dreiländer-Panorama am Dreiländereck.',
    'Aachener Dom',50.7753,6.0839,'public','editorial','["foto-spots","dom","ponttor","aachen"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Dom (Domkuppel-Blick von Katschhof)','Beste Frontalperspektive auf die Dom-Westseite.',50.7753,6.0839,15,true),
    (v_r,2,'Ponttor (Froschperspektive)','Weitwinkelaufnahme von unten – Torturm ragt in den Himmel.',50.7817,6.0806,15,true),
    (v_r,3,'Rathaus (Golddetails)','Gotische Figuren und Goldverzierungen an der Fassade – Makrofotografie.',50.7758,6.0842,20,true),
    (v_r,4,'Lousberg Panorama','Weitblick über Deutschland, Belgien und Niederlande.',50.7880,6.0790,20,true),
    (v_r,5,'Dreiländereck Vaalserberg','Tri-Border-Point DE/NL/BE – einmaliger Fotospot (10 km außerhalb).',50.7581,6.0049,30,false);

  -- ============================================================
  -- KARLSRUHE
  -- ============================================================

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'karlsruhe','Karlsruher Fächerstadt – Schloss & Stadtgrundriss','pd24-karlsruhe-architektur-01',
    'Die Fächerstadt: Karlsruher Schloss als Fächermittelpunkt, Bundesverfassungsgericht und die radialen Stadtachsen – ein einmaliger Stadtgrundriss.',
    'Karlsruher Schloss',49.0140,8.4044,'public','editorial','["architektur","schloss","faecherstadt","karlsruhe"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Karlsruher Schloss (Turm)','Fächermittelpunkt der Stadt – Naturkundemuseum im Schloss, Schlossturm für Panoramablick.',49.0140,8.4044,30,true),
    (v_r,2,'Schlosspark','Weitläufige Parkanlage hinter dem Schloss – Botanischer Garten und Rheinhafen-Allee.',49.0170,8.4030,25,true),
    (v_r,3,'Marktplatz (Pyramide)','Roter Sandstein-Pyramide über der Gruft von Stadtgründer Karl Wilhelm.',49.0078,8.4035,15,true),
    (v_r,4,'Bundesverfassungsgericht','Bedeutendster Gerichtsbau Deutschlands – moderne Architektur und symbolträchtig.',49.0107,8.4033,15,true),
    (v_r,5,'ZKM Zentrum für Kunst und Medien','Weltgrößtes Medienkunstzentrum in historischer Fabrik – Pflichtbesuch für Kunstinteressierte.',49.0060,8.3849,30,true);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'karlsruhe','Karlsruhe Paare – Schlosspark & Rheinufer','pd24-karlsruhe-paare-01',
    'Das grüne Karlsruhe zu zweit: Schlosspark-Spaziergang, Rheinauen-Naturschutz und romantisches Sonnenuntergangs-Panorama am Rhein.',
    'Karlsruher Schlosspark',49.0170,8.4030,'public','editorial','["paare","schlosspark","rhein","karlsruhe"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Schlosspark (Botanischer Garten)','Botanischer Garten im Schlosspark – Gewächshäuser und Themengärten.',49.0170,8.4030,30,true),
    (v_r,2,'Fasanengarten','Historischer Garten – lauschige Pfade und alte Bäume.',49.0200,8.4120,20,false),
    (v_r,3,'Rheinhafen-Allee','Promenade durch ehemalige Industriegegend – Kunst im öffentlichen Raum.',49.0060,8.3849,25,true),
    (v_r,4,'Rheinstrand Rappenwört','Rheinufer-Naturstrand – Sandstrand und Sonnenuntergangs-Feeling.',48.9938,8.3358,35,true),
    (v_r,5,'Turmberg (Bergbahn)','Höchster Punkt Karlsruhes – Bergbahn und Turm mit Schwarzwald-Panorama.',48.9940,8.4657,30,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'karlsruhe','JGA Karlsruhe – Innenstadt & Südstadt','pd24-karlsruhe-jga-01',
    'Karlsruher JGA: Weststadt-Bars, Cocktailrunde in der Innenstadt und Nightlife im Jubez und anderen Clubs.',
    'Karlsruhe Marktplatz',49.0078,8.4035,'public','editorial','["jga","weststadt","bars","karlsruhe"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Marktplatz (Startpunkt)','Karlsruhes zentrale Pyramide – Aperitivo auf dem Platz.',49.0078,8.4035,20,true),
    (v_r,2,'Kaiserstraße (Bars & Restaurants)','Karlsruhes Einkaufs- und Ausgehmeile.',49.0093,8.4035,45,true),
    (v_r,3,'Weststadt (Craft-Beer)','Szeneviertel westlich des Zentrums – Independent-Bars und Cafés.',49.0078,8.3900,50,true),
    (v_r,4,'Tollhaus (Club)','Kulturzentrum und Club in ehemaliger Fabrik – Konzerte und Partys.',49.0063,8.3843,60,false),
    (v_r,5,'Substage (Kultige Club-Location)','Einer der ältesten Clubs Karlsruhes – elektronische Musik.',49.0060,8.3870,90,false);

  insert into public.user_routes (user_id,creator_profile_id,city_slug,title,slug,description,start_label,start_lat,start_lng,visibility,creator_type,tags)
  values (v_user_id,v_cp_id,'karlsruhe','Karlsruhe Foto-Spots – Schloss bis ZKM','pd24-karlsruhe-foto-01',
    'Karlsruhes beste Fotomotive: Schloss-Hauptachse, Marktplatz-Pyramide, ZKM-Industriegebäude und Turmberg-Panorama.',
    'Karlsruher Schloss',49.0140,8.4044,'public','editorial','["foto-spots","schloss","zkm","karlsruhe"]'::jsonb)
  returning id into v_r;
  insert into public.user_route_stops (route_id,stop_order,title,note,lat,lng,duration_min,is_required) values
    (v_r,1,'Schloss (Hauptachse-Perspektive)','Fächerstadt-Radialachse – Schloss als Fluchtpunkt.',49.0140,8.4044,20,true),
    (v_r,2,'Marktplatz-Pyramide (Detail)','Rotsandstein-Pyramide – Detailaufnahmen der Oberfläche.',49.0078,8.4035,15,true),
    (v_r,3,'ZKM (Fabrikhalle)','Historisches Industriegebäude als Medienkunstzentrum – Backsteinästhetik.',49.0060,8.3849,20,true),
    (v_r,4,'Turmberg Aussichtsturm','Schwarzwald, Vogesen und Rheinebene bei klarer Luft sichtbar.',48.9940,8.4657,25,true),
    (v_r,5,'Schlosspark (Herbstlicht)','Parkanlage in Herbstfarben – goldene Stunde.',49.0170,8.4030,20,false);

end $$;

commit;
