begin;

insert into public.roadtrip_routes (
  slug,
  title,
  description,
  cover_image_url,
  author_user_id,
  author_name,
  visibility,
  status,
  is_featured,
  tags,
  total_nights,
  country_codes,
  occasion,
  budget,
  stops
)
values (
  'hanse-sea-city-loop',
  'Hanse & Sea City Loop',
  'Vier Tage zwischen Hafenflair, Backstein, Strandmomenten und Altstadtgassen. Ideal fuer alle, die Norddeutschland mit Design, Fischbroetchen und Wasserkante erleben wollen.',
  null,
  null,
  'PD24 Redaktion',
  'public',
  'completed',
  true,
  array['germany','culture','food','weekend'],
  4,
  array['DE'],
  'tourism',
  'medium',
  $$[
    {
      "citySlug":"hamburg-hamburg",
      "cityLabel":"Hamburg",
      "lat":53.5511,
      "lng":9.9937,
      "nights":1,
      "planSummary":"Blue-hour harbour energy, Speicherstadt brick mood and a first fish sandwich by the water.",
      "plannedStops":[
        {"label":"Speicherstadt Walk","hint":"Brick lanes, canals and coffee with warehouse views","time":"15:00","itemName":"Speicherstadt"},
        {"label":"Elbphilharmonie Plaza","hint":"Big skyline payoff over harbour and city","time":"17:00","itemName":"Elbphilharmonie"},
        {"label":"Landungsbruecken Sunset","hint":"Ferries, lights and a classic north-coast finish","time":"19:30","itemName":"Landungsbruecken"}
      ]
    },
    {
      "citySlug":"luebeck",
      "cityLabel":"Luebeck",
      "lat":53.8655,
      "lng":10.6866,
      "nights":1,
      "planSummary":"Medieval gates, marzipan, little courtyards and easy golden-hour old-town strolling.",
      "plannedStops":[
        {"label":"Holstentor Arrival","hint":"Start with the iconic gate and canal edge","time":"15:00","itemName":"Holstentor"},
        {"label":"Old Town Courtyards","hint":"Tiny passages, brick facades and hidden corners","time":"16:30","itemName":"Luebecker Altstadt"},
        {"label":"Marzipan & River Walk","hint":"Sweet stop and calm evening by the Trave","time":"18:30","itemName":"Cafe Niederegger"}
      ]
    },
    {
      "citySlug":"kiel",
      "cityLabel":"Kiel",
      "lat":54.3233,
      "lng":10.1228,
      "nights":1,
      "planSummary":"Harbour promenade, sea breeze and a short detour for proper Baltic coastline feeling.",
      "plannedStops":[
        {"label":"Kiellinie Promenade","hint":"Easy harbour stroll with ferries and sailboats","time":"15:00","itemName":"Kiellinie"},
        {"label":"Laboe Detour","hint":"Beach mood and naval memorial panorama","time":"17:00","itemName":"Laboe"},
        {"label":"Harbour Dinner","hint":"Fish, sunset light and a relaxed waterfront ending","time":"19:30","itemName":"Kieler Foerde"}
      ]
    },
    {
      "citySlug":"bremen",
      "cityLabel":"Bremen",
      "lat":53.0793,
      "lng":8.8017,
      "nights":1,
      "planSummary":"Schnoor romance, market-square classics and a compact old-town finish before the trip ends.",
      "plannedStops":[
        {"label":"Marktplatz & Rathaus","hint":"Start with the postcard core of Bremen","time":"15:00","itemName":"Bremer Marktplatz"},
        {"label":"Schnoor Quarter","hint":"Tiny lanes, handmade shops and storybook corners","time":"16:30","itemName":"Schnoor"},
        {"label":"Schlachte Riverside","hint":"Dinner and last-night drinks by the Weser","time":"19:00","itemName":"Schlachte"}
      ]
    }
  ]$$::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  cover_image_url = excluded.cover_image_url,
  author_name = excluded.author_name,
  visibility = excluded.visibility,
  status = excluded.status,
  is_featured = excluded.is_featured,
  tags = excluded.tags,
  total_nights = excluded.total_nights,
  country_codes = excluded.country_codes,
  occasion = excluded.occasion,
  budget = excluded.budget,
  stops = excluded.stops,
  updated_at = now();

insert into public.roadtrip_routes (
  slug, title, description, cover_image_url, author_user_id, author_name, visibility, status, is_featured,
  tags, total_nights, country_codes, occasion, budget, stops
)
values (
  'east-germany-design-history-loop',
  'East Germany Design & History Loop',
  'Ein starker Ost-Deutschland-Trip mit Hauptstadtenergie, Elbpanorama, Kreativvierteln und viel Geschichte ohne Museumsoverload.',
  null,
  null,
  'PD24 Redaktion',
  'public',
  'completed',
  true,
  array['germany','culture','food'],
  6,
  array['DE'],
  'tourism',
  'medium',
  $$[
    {
      "citySlug":"berlin-berlin",
      "cityLabel":"Berlin",
      "lat":52.52,
      "lng":13.405,
      "nights":2,
      "planSummary":"Big-city kickoff with brutalist icons, canalside coffee and one long night with options.",
      "plannedStops":[
        {"label":"Museumsinsel Edge","hint":"Historic core, broad views and easy entry into the city","time":"15:00","itemName":"Museumsinsel"},
        {"label":"Hackescher Markt Drift","hint":"Courtyards, galleries and people-watching","time":"17:00","itemName":"Hackescher Markt"},
        {"label":"Spree Blue Hour","hint":"Riverside walk before dinner and nightlife","time":"20:00","itemName":"Spreeufer"}
      ]
    },
    {
      "citySlug":"dresden",
      "cityLabel":"Dresden",
      "lat":51.0504,
      "lng":13.7373,
      "nights":2,
      "planSummary":"Baroque skyline, river terraces and a softer pace that still feels grand.",
      "plannedStops":[
        {"label":"Bruehlsche Terrasse","hint":"The classic first panorama over the Elbe","time":"15:00","itemName":"Bruehlsche Terrasse"},
        {"label":"Neustadt Round","hint":"Courtyard bars, murals and indie energy","time":"17:30","itemName":"Dresden Neustadt"},
        {"label":"Frauenkirche Lights","hint":"Old-town glow and a dramatic evening finish","time":"20:00","itemName":"Frauenkirche"}
      ]
    },
    {
      "citySlug":"leipzig",
      "cityLabel":"Leipzig",
      "lat":51.3397,
      "lng":12.3731,
      "nights":1,
      "planSummary":"Creative Leipzig with passages, record-store energy and sunset by the canals.",
      "plannedStops":[
        {"label":"Maedler Passage","hint":"Elegant arcades and a polished city-center start","time":"15:00","itemName":"Maedler Passage"},
        {"label":"Plagwitz Canals","hint":"Industrial facades and waterside creative scene","time":"17:00","itemName":"Plagwitz"},
        {"label":"Karl-Heine Night","hint":"Bars, small plates and easy local energy","time":"19:30","itemName":"Karl-Heine-Strasse"}
      ]
    },
    {
      "citySlug":"erfurt",
      "cityLabel":"Erfurt",
      "lat":50.9848,
      "lng":11.0299,
      "nights":1,
      "planSummary":"A compact final stop with bridges, half-timbered lanes and a slower old-town landing.",
      "plannedStops":[
        {"label":"Kraemerbruecke First Look","hint":"Iconic houses-on-a-bridge arrival moment","time":"15:00","itemName":"Kraemerbruecke"},
        {"label":"Domplatz Climb","hint":"Wide square and cathedral backdrop","time":"17:00","itemName":"Domplatz"},
        {"label":"Old Town Dinner","hint":"Quiet finale with medieval facades all around","time":"19:30","itemName":"Altstadt Erfurt"}
      ]
    }
  ]$$::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  cover_image_url = excluded.cover_image_url,
  author_name = excluded.author_name,
  visibility = excluded.visibility,
  status = excluded.status,
  is_featured = excluded.is_featured,
  tags = excluded.tags,
  total_nights = excluded.total_nights,
  country_codes = excluded.country_codes,
  occasion = excluded.occasion,
  budget = excluded.budget,
  stops = excluded.stops,
  updated_at = now();

insert into public.roadtrip_routes (
  slug, title, description, cover_image_url, author_user_id, author_name, visibility, status, is_featured,
  tags, total_nights, country_codes, occasion, budget, stops
)
values (
  'ruhr-industriekultur-after-dark',
  'Ruhr Industriekultur After Dark',
  'Von Altbier bis Hochofenblick: ein Roadtrip fuer alle, die Industriegeschichte, starke Food-Stops und urbane Nachtmomente zusammen erleben wollen.',
  null,
  null,
  'PD24 Redaktion',
  'public',
  'completed',
  true,
  array['germany','culture','nightlife','friends'],
  4,
  array['DE'],
  'friends',
  'medium',
  $$[
    {
      "citySlug":"duesseldorf",
      "cityLabel":"Duesseldorf",
      "lat":51.2277,
      "lng":6.7735,
      "nights":1,
      "planSummary":"Riverside polish, Koe style and an easy first evening with lots of food-and-drink range.",
      "plannedStops":[
        {"label":"Rheinufer Start","hint":"Open river views and a clean city arrival","time":"15:00","itemName":"Rheinuferpromenade"},
        {"label":"Altstadt Drift","hint":"Old-town alleys, altbier and fast mood shift","time":"17:30","itemName":"Altstadt Duesseldorf"},
        {"label":"Medienhafen Blue Hour","hint":"Architecture and lights for the late-night look","time":"20:00","itemName":"Medienhafen"}
      ]
    },
    {
      "citySlug":"essen",
      "cityLabel":"Essen",
      "lat":51.4556,
      "lng":7.0116,
      "nights":1,
      "planSummary":"The Ruhr changes tone here: from heavy-industry memory to lake air and serious architecture.",
      "plannedStops":[
        {"label":"Zeche Zollverein","hint":"The must-see Ruhr icon with scale and history","time":"15:00","itemName":"Zeche Zollverein"},
        {"label":"Design & Cafe Break","hint":"A slower creative block on the same grounds","time":"17:00","itemName":"Red Dot Design Museum"},
        {"label":"Baldeney Evening","hint":"Waterfront reset after steel and brick","time":"19:30","itemName":"Baldeneysee"}
      ]
    },
    {
      "citySlug":"dortmund",
      "cityLabel":"Dortmund",
      "lat":51.5136,
      "lng":7.4653,
      "nights":1,
      "planSummary":"Big spaces, football aura and a strong working-city edge with surprising nightlife pockets.",
      "plannedStops":[
        {"label":"Phoenix See Loop","hint":"Modern waterside contrast to the old Ruhr image","time":"15:00","itemName":"Phoenix See"},
        {"label":"Dortmunder U","hint":"Art, roof views and culture without stiffness","time":"17:30","itemName":"Dortmunder U"},
        {"label":"Unionviertel Night","hint":"Bars, casual dinner and local creative scene","time":"20:00","itemName":"Unionviertel"}
      ]
    },
    {
      "citySlug":"duisburg",
      "cityLabel":"Duisburg",
      "lat":51.4344,
      "lng":6.7623,
      "nights":1,
      "planSummary":"A final stop built around giant industrial drama and one of the strongest evening atmospheres in the region.",
      "plannedStops":[
        {"label":"Innenhafen Arrival","hint":"Waterfront warehouses and an easy first block","time":"15:00","itemName":"Innenhafen"},
        {"label":"Landschaftspark Climb","hint":"Steel giants, viewpoints and epic scale","time":"17:30","itemName":"Landschaftspark Duisburg-Nord"},
        {"label":"Night Lights on Site","hint":"Stay after dark for the full colour payoff","time":"21:00","itemName":"Landschaftspark Duisburg-Nord"}
      ]
    }
  ]$$::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  cover_image_url = excluded.cover_image_url,
  author_name = excluded.author_name,
  visibility = excluded.visibility,
  status = excluded.status,
  is_featured = excluded.is_featured,
  tags = excluded.tags,
  total_nights = excluded.total_nights,
  country_codes = excluded.country_codes,
  occasion = excluded.occasion,
  budget = excluded.budget,
  stops = excluded.stops,
  updated_at = now();

insert into public.roadtrip_routes (
  slug, title, description, cover_image_url, author_user_id, author_name, visibility, status, is_featured,
  tags, total_nights, country_codes, occasion, budget, stops
)
values (
  'black-forest-spa-city-loop',
  'Black Forest Spa & City Loop',
  'Kurhaeuser, Tannenblicke, Wein am Abend und genau genug City-Tempo. Ein kompakter Suedwest-Roadtrip mit viel Genussfaktor.',
  null,
  null,
  'PD24 Redaktion',
  'public',
  'completed',
  true,
  array['germany','nature','food','luxury'],
  4,
  array['DE'],
  'date',
  'high',
  $$[
    {
      "citySlug":"karlsruhe",
      "cityLabel":"Karlsruhe",
      "lat":49.0069,
      "lng":8.4037,
      "nights":1,
      "planSummary":"Grand avenues, easy museum energy and a smooth opener before heading south.",
      "plannedStops":[
        {"label":"Schlossgarten Walk","hint":"Wide paths and calm city-green arrival","time":"15:00","itemName":"Karlsruher Schloss"},
        {"label":"ZKM Block","hint":"Media art and sharp architecture contrast","time":"17:00","itemName":"ZKM"},
        {"label":"Evening in the Fan City","hint":"Dinner in a center that feels open and relaxed","time":"19:30","itemName":"Karlsruhe Innenstadt"}
      ]
    },
    {
      "citySlug":"freiburg-im-breisgau",
      "cityLabel":"Freiburg",
      "lat":47.999,
      "lng":7.8421,
      "nights":2,
      "planSummary":"Sunlit old-town lanes, vineyard views and easy Black Forest access all in one stop.",
      "plannedStops":[
        {"label":"Muenster & Baechle","hint":"Classic Freiburg intro with flowing old-town rhythm","time":"15:00","itemName":"Freiburger Muenster"},
        {"label":"Schlossberg View","hint":"Quick climb or cable ride for the city panorama","time":"17:00","itemName":"Schlossberg"},
        {"label":"Wine-Bar Finale","hint":"Warm evening close with Baden glasses and late light","time":"20:00","itemName":"Altstadt Freiburg"}
      ]
    },
    {
      "citySlug":"stuttgart",
      "cityLabel":"Stuttgart",
      "lat":48.7758,
      "lng":9.1829,
      "nights":1,
      "planSummary":"A stronger city ending with hills, architecture and one last polished dinner block.",
      "plannedStops":[
        {"label":"Weissenhof Start","hint":"Design history and skyline angles","time":"15:00","itemName":"Weissenhofsiedlung"},
        {"label":"Eugensplatz Sunset","hint":"Classic view over the basin and city lights","time":"18:00","itemName":"Eugensplatz"},
        {"label":"Dinner in the Valley","hint":"A final urban evening with a little elegance","time":"20:00","itemName":"Stuttgart Mitte"}
      ]
    }
  ]$$::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  cover_image_url = excluded.cover_image_url,
  author_name = excluded.author_name,
  visibility = excluded.visibility,
  status = excluded.status,
  is_featured = excluded.is_featured,
  tags = excluded.tags,
  total_nights = excluded.total_nights,
  country_codes = excluded.country_codes,
  occasion = excluded.occasion,
  budget = excluded.budget,
  stops = excluded.stops,
  updated_at = now();

insert into public.roadtrip_routes (
  slug, title, description, cover_image_url, author_user_id, author_name, visibility, status, is_featured,
  tags, total_nights, country_codes, occasion, budget, stops
)
values (
  'franconia-bavaria-slow-drive',
  'Franconia to Bavaria Slow Drive',
  'Mittelalter, Brauereien, Fuggerstadt und dann grosses Muenchen-Finish. Eine Route fuer alle, die Bayern nicht nur schnell, sondern gut erleben wollen.',
  null,
  null,
  'PD24 Redaktion',
  'public',
  'completed',
  false,
  array['germany','culture','food','date'],
  4,
  array['DE'],
  'tourism',
  'medium',
  $$[
    {
      "citySlug":"nuernberg",
      "cityLabel":"Nuernberg",
      "lat":49.4521,
      "lng":11.0767,
      "nights":1,
      "planSummary":"A walled-city opener with castle views, franconian food and plenty of evening atmosphere.",
      "plannedStops":[
        {"label":"Kaiserburg Start","hint":"Castle views and the city laid out below","time":"15:00","itemName":"Kaiserburg Nuernberg"},
        {"label":"Old Town Lanes","hint":"Half-timbered corners and market-square rhythm","time":"17:00","itemName":"Altstadt Nuernberg"},
        {"label":"Franconian Dinner","hint":"A proper first-night tavern stop","time":"19:30","itemName":"Altstadt Nuernberg"}
      ]
    },
    {
      "citySlug":"augsburg",
      "cityLabel":"Augsburg",
      "lat":48.3705,
      "lng":10.8978,
      "nights":1,
      "planSummary":"A very underrated Bavarian stop with water channels, Renaissance facades and calm city luxury.",
      "plannedStops":[
        {"label":"Fuggerei & Center","hint":"Historic social history meets pretty lanes","time":"15:00","itemName":"Fuggerei"},
        {"label":"Lech Canals","hint":"Water channels and softer corners for wandering","time":"17:00","itemName":"Augsburger Altstadt"},
        {"label":"Rathausplatz Evening","hint":"A broad square and clean late-day glow","time":"19:30","itemName":"Rathausplatz"}
      ]
    },
    {
      "citySlug":"muenchen",
      "cityLabel":"Muenchen",
      "lat":48.1374,
      "lng":11.5755,
      "nights":2,
      "planSummary":"A big-finish city with beer garden ease, Isar energy and enough highlights for a final two-night stay.",
      "plannedStops":[
        {"label":"Viktualienmarkt Arrival","hint":"Snack stop and instant city mood","time":"15:00","itemName":"Viktualienmarkt"},
        {"label":"Isar & English Garden","hint":"Green reset before the evening block","time":"17:30","itemName":"Englischer Garten"},
        {"label":"Beer Garden Finale","hint":"Classic Munich close with sociable atmosphere","time":"20:00","itemName":"Biergarten"}
      ]
    }
  ]$$::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  cover_image_url = excluded.cover_image_url,
  author_name = excluded.author_name,
  visibility = excluded.visibility,
  status = excluded.status,
  is_featured = excluded.is_featured,
  tags = excluded.tags,
  total_nights = excluded.total_nights,
  country_codes = excluded.country_codes,
  occasion = excluded.occasion,
  budget = excluded.budget,
  stops = excluded.stops,
  updated_at = now();

insert into public.roadtrip_routes (
  slug, title, description, cover_image_url, author_user_id, author_name, visibility, status, is_featured,
  tags, total_nights, country_codes, occasion, budget, stops
)
values (
  'rhine-main-wine-city-loop',
  'Rhine & Main Wine City Loop',
  'Domstadt, Regierungsviertel, Spa-vibes und Skyline. Ein kurzer West-Deutschland-Roadtrip mit viel Abendqualitaet und guten Terrassen.',
  null,
  null,
  'PD24 Redaktion',
  'public',
  'completed',
  false,
  array['germany','food','culture','friends'],
  4,
  array['DE'],
  'friends',
  'medium',
  $$[
    {
      "citySlug":"koeln",
      "cityLabel":"Koeln",
      "lat":50.9375,
      "lng":6.9603,
      "nights":1,
      "planSummary":"Cathedral scale, Rhine walks and a first evening with strong local energy.",
      "plannedStops":[
        {"label":"Dom & River Intro","hint":"Big first impression with short walking distances","time":"15:00","itemName":"Koelner Dom"},
        {"label":"Belgisches Viertel","hint":"Coffee, boutiques and easy neighbourhood vibe","time":"17:00","itemName":"Belgisches Viertel"},
        {"label":"Rheinauhafen Night","hint":"Modern waterfront and dinner with view","time":"20:00","itemName":"Rheinauhafen"}
      ]
    },
    {
      "citySlug":"bonn",
      "cityLabel":"Bonn",
      "lat":50.7374,
      "lng":7.0982,
      "nights":1,
      "planSummary":"A smaller stop with river calm, museum weight and good pacing after Cologne.",
      "plannedStops":[
        {"label":"Beethoven Core","hint":"Compact center and first-city orientation","time":"15:00","itemName":"Bonner Innenstadt"},
        {"label":"Rheinaue Block","hint":"Green space and long paths by the water","time":"17:00","itemName":"Rheinaue"},
        {"label":"Suedstadt Dinner","hint":"Relaxed evening in a handsome neighbourhood","time":"19:30","itemName":"Bonner Suedstadt"}
      ]
    },
    {
      "citySlug":"wiesbaden",
      "cityLabel":"Wiesbaden",
      "lat":50.082,
      "lng":8.2417,
      "nights":1,
      "planSummary":"Spa-town architecture, hill views and a polished evening that feels a bit grander.",
      "plannedStops":[
        {"label":"Kurhaus Arrival","hint":"Old-school elegance from the first minute","time":"15:00","itemName":"Kurhaus Wiesbaden"},
        {"label":"Neroberg View","hint":"Wide city look with a short uphill payoff","time":"17:30","itemName":"Neroberg"},
        {"label":"Wine Bar Finish","hint":"Riesling and terrace mood for the night","time":"20:00","itemName":"Wiesbaden Innenstadt"}
      ]
    },
    {
      "citySlug":"frankfurt-am-main",
      "cityLabel":"Frankfurt am Main",
      "lat":50.1109,
      "lng":8.6821,
      "nights":1,
      "planSummary":"Finish with skyline punch, Main river light and one last dense urban evening.",
      "plannedStops":[
        {"label":"Mainkai Start","hint":"Skyline reflections and easy orientation","time":"15:00","itemName":"Mainkai"},
        {"label":"Neue Altstadt","hint":"Fast contrast between finance city and old-town texture","time":"17:00","itemName":"Neue Altstadt"},
        {"label":"Sachsenhausen Night","hint":"Apple wine, bars and a proper finale","time":"20:00","itemName":"Sachsenhausen"}
      ]
    }
  ]$$::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  cover_image_url = excluded.cover_image_url,
  author_name = excluded.author_name,
  visibility = excluded.visibility,
  status = excluded.status,
  is_featured = excluded.is_featured,
  tags = excluded.tags,
  total_nights = excluded.total_nights,
  country_codes = excluded.country_codes,
  occasion = excluded.occasion,
  budget = excluded.budget,
  stops = excluded.stops,
  updated_at = now();

insert into public.roadtrip_routes (
  slug, title, description, cover_image_url, author_user_id, author_name, visibility, status, is_featured,
  tags, total_nights, country_codes, occasion, budget, stops
)
values (
  'alpine-lakes-borderline',
  'Alpine Lakes Borderline',
  'Muenchen, Salzburg, alpine lakes and mountain roads in one elegant cross-border route. Strong for summer, shoulder season and anyone who wants wow-moments without chaos.',
  null,
  null,
  'PD24 Redaktion',
  'public',
  'completed',
  true,
  array['europe','nature','luxury','adventure'],
  5,
  array['DE','AT'],
  'tourism',
  'high',
  $$[
    {
      "citySlug":"muenchen",
      "cityLabel":"Muenchen",
      "lat":48.1374,
      "lng":11.5755,
      "nights":1,
      "planSummary":"Start urban and polished before the route opens into lakes and mountain silhouettes.",
      "plannedStops":[
        {"label":"Viktualienmarkt Kickoff","hint":"Easy arrival and first Bavarian food block","time":"15:00","itemName":"Viktualienmarkt"},
        {"label":"Isar Evening","hint":"A soft city-green intro before crossing the border","time":"17:30","itemName":"Isarufer"},
        {"label":"Beer Garden Start","hint":"One classic social night before the mountain days","time":"20:00","itemName":"Biergarten"}
      ]
    },
    {
      "citySlug":"salzburg-at",
      "cityLabel":"Salzburg",
      "lat":47.8095,
      "lng":13.055,
      "nights":1,
      "planSummary":"Baroque old-town drama, fortress views and river light with a very easy wow-factor.",
      "plannedStops":[
        {"label":"Altstadt Arrival","hint":"Narrow lanes and immediate cinematic payoff","time":"15:00","itemName":"Salzburger Altstadt"},
        {"label":"Moenchsberg View","hint":"Climb for the postcard panorama","time":"17:00","itemName":"Moenchsberg"},
        {"label":"River & Dinner","hint":"Blue-hour walk by the Salzach","time":"20:00","itemName":"Salzachufer"}
      ]
    },
    {
      "citySlug":"zell-am-see-at",
      "cityLabel":"Zell am See",
      "lat":47.3235,
      "lng":12.7967,
      "nights":2,
      "planSummary":"Pure lake-and-peaks reset with one of the strongest scenic middle sections in this whole batch.",
      "plannedStops":[
        {"label":"Lakeside Loop","hint":"Quick reset with water and mountain reflections","time":"15:00","itemName":"Zeller See"},
        {"label":"Kaprun Side Mission","hint":"Glacier-road feeling and big alpine scale nearby","time":"17:30","itemName":"Kaprun"},
        {"label":"Golden-Hour Promenade","hint":"Easy evening walk with long light","time":"20:00","itemName":"Zell Promenade"}
      ]
    },
    {
      "citySlug":"innsbruck-at",
      "cityLabel":"Innsbruck",
      "lat":47.2692,
      "lng":11.4041,
      "nights":1,
      "planSummary":"Finish with mountain-ringed city energy, cable-car options and a clean Tyrol ending.",
      "plannedStops":[
        {"label":"Golden Roof Core","hint":"Fast historic center entry and mountain backdrop","time":"15:00","itemName":"Goldenes Dachl"},
        {"label":"Nordkette View","hint":"Big vertical contrast between city and peaks","time":"17:30","itemName":"Nordkette"},
        {"label":"Old Town Night","hint":"A final evening under the mountains","time":"20:00","itemName":"Altstadt Innsbruck"}
      ]
    }
  ]$$::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  cover_image_url = excluded.cover_image_url,
  author_name = excluded.author_name,
  visibility = excluded.visibility,
  status = excluded.status,
  is_featured = excluded.is_featured,
  tags = excluded.tags,
  total_nights = excluded.total_nights,
  country_codes = excluded.country_codes,
  occasion = excluded.occasion,
  budget = excluded.budget,
  stops = excluded.stops,
  updated_at = now();

insert into public.roadtrip_routes (
  slug, title, description, cover_image_url, author_user_id, author_name, visibility, status, is_featured,
  tags, total_nights, country_codes, occasion, budget, stops
)
values (
  'slovenia-lakes-to-sea',
  'Slovenia Lakes to Sea',
  'Ein kleiner, sehr starker Europa-Roadtrip: alpine Seen, Soca-Farbe, Weindetours und am Ende Adriakante.',
  null,
  null,
  'PD24 Redaktion',
  'public',
  'completed',
  false,
  array['europe','nature','food','adventure'],
  5,
  array['SI'],
  'tourism',
  'medium',
  $$[
    {
      "citySlug":"ljubljana-si",
      "cityLabel":"Ljubljana",
      "lat":46.0569,
      "lng":14.5058,
      "nights":1,
      "planSummary":"A compact capital opener with riverside cafe culture and one of the friendliest old towns in Europe.",
      "plannedStops":[
        {"label":"Riverside Arrival","hint":"Cafe tables, bridges and an easy city welcome","time":"15:00","itemName":"Ljubljanica"},
        {"label":"Castle Viewpoint","hint":"Short climb for the whole-city look","time":"17:00","itemName":"Ljubljana Castle"},
        {"label":"Old Town Evening","hint":"Soft lights and low-stress dinner streets","time":"20:00","itemName":"Ljubljana Old Town"}
      ]
    },
    {
      "citySlug":"bled-si",
      "cityLabel":"Bled",
      "lat":46.3683,
      "lng":14.1146,
      "nights":1,
      "planSummary":"This is the postcard section: island church, mountain reflections and one very easy scenic win after another.",
      "plannedStops":[
        {"label":"Lake Loop Start","hint":"Classic arrival with immediate view reward","time":"15:00","itemName":"Lake Bled"},
        {"label":"Castle Edge","hint":"High look over the water and island","time":"17:00","itemName":"Bled Castle"},
        {"label":"Cream Cake Sunset","hint":"Lean fully into the famous lakeside mood","time":"19:30","itemName":"Bled Promenade"}
      ]
    },
    {
      "citySlug":"bovec-si",
      "cityLabel":"Bovec",
      "lat":46.3381,
      "lng":13.5524,
      "nights":2,
      "planSummary":"Wild-water colour, mountain roads and proper outdoor energy in the Soca Valley core.",
      "plannedStops":[
        {"label":"Soca Colour Stop","hint":"That unreal river colour lives up to the hype","time":"15:00","itemName":"Soca Valley"},
        {"label":"Kobarid Side Drive","hint":"Short drive for history and another strong valley view","time":"17:30","itemName":"Kobarid"},
        {"label":"Mountain Dinner","hint":"Slow evening after a visually huge day","time":"20:00","itemName":"Bovec Center"}
      ]
    },
    {
      "citySlug":"piran-si",
      "cityLabel":"Piran",
      "lat":45.5283,
      "lng":13.5683,
      "nights":1,
      "planSummary":"End with Venetian facades, salt-air evenings and a final sea-facing old-town block.",
      "plannedStops":[
        {"label":"Tartini Square","hint":"Best first look into the old-town core","time":"15:00","itemName":"Tartini Square"},
        {"label":"Sea Wall Walk","hint":"Salt air and late light over the Adriatic","time":"17:30","itemName":"Piran Waterfront"},
        {"label":"Harbour Dinner","hint":"Seafood finale with water reflections","time":"20:00","itemName":"Piran Harbour"}
      ]
    }
  ]$$::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  cover_image_url = excluded.cover_image_url,
  author_name = excluded.author_name,
  visibility = excluded.visibility,
  status = excluded.status,
  is_featured = excluded.is_featured,
  tags = excluded.tags,
  total_nights = excluded.total_nights,
  country_codes = excluded.country_codes,
  occasion = excluded.occasion,
  budget = excluded.budget,
  stops = excluded.stops,
  updated_at = now();

insert into public.roadtrip_routes (
  slug, title, description, cover_image_url, author_user_id, author_name, visibility, status, is_featured,
  tags, total_nights, country_codes, occasion, budget, stops
)
values (
  'istria-sunset-loop',
  'Istria Sunset Loop',
  'Adriafarben, Hilltowns, Design-Hotels und kleine Hafenabende. Ein Roadtrip fuer spaete Lunches, Fotolicht und viel Genuss.',
  null,
  null,
  'PD24 Redaktion',
  'public',
  'completed',
  false,
  array['europe','food','date','weekend'],
  5,
  array['IT','HR'],
  'date',
  'high',
  $$[
    {
      "citySlug":"trieste-it",
      "cityLabel":"Trieste",
      "lat":45.6495,
      "lng":13.7768,
      "nights":1,
      "planSummary":"Coffee-house grandeur, sea breeze and a very elegant first-night energy.",
      "plannedStops":[
        {"label":"Piazza Unita","hint":"Open sea-facing square with instant scale","time":"15:00","itemName":"Piazza Unita d Italia"},
        {"label":"Canal Grande","hint":"A softer, more photogenic late-afternoon block","time":"17:00","itemName":"Canal Grande"},
        {"label":"Historic Cafe Night","hint":"Trieste is built for long coffee-and-wine evenings","time":"20:00","itemName":"Trieste Center"}
      ]
    },
    {
      "citySlug":"rovinj-hr",
      "cityLabel":"Rovinj",
      "lat":45.0812,
      "lng":13.6387,
      "nights":2,
      "planSummary":"Pastel facades, harbour boats and one of the easiest old-town evening wins on the Adriatic.",
      "plannedStops":[
        {"label":"Old Town Climb","hint":"Stone lanes rising to the church hill","time":"15:00","itemName":"Rovinj Old Town"},
        {"label":"Harbour Apertivo","hint":"Sit close to the boats and let the light change","time":"18:00","itemName":"Rovinj Harbour"},
        {"label":"Sunset by the Rocks","hint":"Big colour payoff with a drink in hand","time":"20:30","itemName":"Rovinj Waterfront"}
      ]
    },
    {
      "citySlug":"pula-hr",
      "cityLabel":"Pula",
      "lat":44.8666,
      "lng":13.8496,
      "nights":1,
      "planSummary":"Roman stones, harbour energy and a more grounded city feel after romantic Rovinj.",
      "plannedStops":[
        {"label":"Arena Arrival","hint":"Instant wow at one of the great Roman landmarks","time":"15:00","itemName":"Pula Arena"},
        {"label":"Old Town Lanes","hint":"Coffee, ruins and compact city texture","time":"17:00","itemName":"Pula Center"},
        {"label":"Waterfront Evening","hint":"A relaxed last-light stroll by the port","time":"20:00","itemName":"Pula Harbour"}
      ]
    },
    {
      "citySlug":"motovun-hr",
      "cityLabel":"Motovun",
      "lat":45.3367,
      "lng":13.8286,
      "nights":1,
      "planSummary":"Finish high above the valley with stone walls, truffle menus and an unmistakable hilltop ending.",
      "plannedStops":[
        {"label":"Hilltop Gate","hint":"Walk in slowly and let the valley views open up","time":"15:00","itemName":"Motovun Old Town"},
        {"label":"Wall Walk","hint":"One full panorama lap before dinner","time":"17:00","itemName":"Motovun Walls"},
        {"label":"Truffle Finale","hint":"Last-night dinner with proper Istrian depth","time":"19:30","itemName":"Motovun Center"}
      ]
    }
  ]$$::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  cover_image_url = excluded.cover_image_url,
  author_name = excluded.author_name,
  visibility = excluded.visibility,
  status = excluded.status,
  is_featured = excluded.is_featured,
  tags = excluded.tags,
  total_nights = excluded.total_nights,
  country_codes = excluded.country_codes,
  occasion = excluded.occasion,
  budget = excluded.budget,
  stops = excluded.stops,
  updated_at = now();

insert into public.roadtrip_routes (
  slug, title, description, cover_image_url, author_user_id, author_name, visibility, status, is_featured,
  tags, total_nights, country_codes, occasion, budget, stops
)
values (
  'highlands-coastline-run',
  'Highlands Coastline Run',
  'Wenige Roadtrips fuehlen sich so gross an: single-track drama, empty beaches, mountain passes and pubs, in denen man bleiben will.',
  null,
  null,
  'PD24 Redaktion',
  'public',
  'completed',
  false,
  array['europe','nature','adventure'],
  5,
  array['GB'],
  'friends',
  'medium',
  $$[
    {
      "citySlug":"inverness-gb",
      "cityLabel":"Inverness",
      "lat":57.4778,
      "lng":-4.2247,
      "nights":1,
      "planSummary":"An easy launch city before the roads get wild and the distances start to feel epic.",
      "plannedStops":[
        {"label":"River Ness Arrival","hint":"Compact center and a calm first-night start","time":"15:00","itemName":"River Ness"},
        {"label":"Castle View","hint":"Set the tone before heading north-west","time":"17:00","itemName":"Inverness Castle"},
        {"label":"Pub Warmup","hint":"Fuel up before the dramatic driving days","time":"20:00","itemName":"Inverness Old Town"}
      ]
    },
    {
      "citySlug":"applecross-gb",
      "cityLabel":"Applecross",
      "lat":57.4331,
      "lng":-5.8095,
      "nights":1,
      "planSummary":"This is the wow-road segment: huge bends, open air and one of the strongest route days in northern Europe.",
      "plannedStops":[
        {"label":"Bealach na Ba View","hint":"The pass is the headline for a reason","time":"15:00","itemName":"Bealach na Ba"},
        {"label":"Applecross Shoreline","hint":"Sea edge and mountain backdrop in one frame","time":"17:30","itemName":"Applecross"},
        {"label":"Remote Inn Night","hint":"Lean into the isolation and stay local","time":"20:00","itemName":"Applecross Inn"}
      ]
    },
    {
      "citySlug":"ullapool-gb",
      "cityLabel":"Ullapool",
      "lat":57.8968,
      "lng":-5.1604,
      "nights":1,
      "planSummary":"Harbour calm, ferry-town rhythm and a clean, scenic reset after the pass.",
      "plannedStops":[
        {"label":"Harbour Walk","hint":"Boats, colour and sea-air decompressing","time":"15:00","itemName":"Ullapool Harbour"},
        {"label":"Loch Broom View","hint":"A soft, open panorama before the evening","time":"17:00","itemName":"Loch Broom"},
        {"label":"Seafood Dinner","hint":"One of the easiest good-night endings on the route","time":"19:30","itemName":"Ullapool Center"}
      ]
    },
    {
      "citySlug":"durness-gb",
      "cityLabel":"Durness",
      "lat":58.5674,
      "lng":-4.7468,
      "nights":1,
      "planSummary":"Beach, cliffs and huge open space - this is the section that makes the Highlands feel truly remote.",
      "plannedStops":[
        {"label":"Smoo Cave Stop","hint":"Fast detour with instant drama","time":"15:00","itemName":"Smoo Cave"},
        {"label":"Balnakeil Beach","hint":"Wind, white sand and proper edge-of-Europe feeling","time":"17:00","itemName":"Balnakeil Beach"},
        {"label":"Late-Light Coastline","hint":"Stay outside until the sky goes long and pale","time":"20:30","itemName":"Durness Coast"}
      ]
    },
    {
      "citySlug":"thurso-gb",
      "cityLabel":"Thurso",
      "lat":58.5949,
      "lng":-3.5221,
      "nights":1,
      "planSummary":"A final north-coast stop before looping back - rugged but with enough town energy to land softly.",
      "plannedStops":[
        {"label":"North Coast Pull-offs","hint":"Do not rush this final driving section","time":"15:00","itemName":"North Coast"},
        {"label":"Thurso Waterfront","hint":"Clean sea views and a compact town center","time":"17:30","itemName":"Thurso"},
        {"label":"Last Pub Night","hint":"A warm final stop before heading back inland","time":"20:00","itemName":"Thurso Center"}
      ]
    }
  ]$$::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  cover_image_url = excluded.cover_image_url,
  author_name = excluded.author_name,
  visibility = excluded.visibility,
  status = excluded.status,
  is_featured = excluded.is_featured,
  tags = excluded.tags,
  total_nights = excluded.total_nights,
  country_codes = excluded.country_codes,
  occasion = excluded.occasion,
  budget = excluded.budget,
  stops = excluded.stops,
  updated_at = now();

insert into public.roadtrip_routes (
  slug, title, description, cover_image_url, author_user_id, author_name, visibility, status, is_featured,
  tags, total_nights, country_codes, occasion, budget, stops
)
values (
  'norway-fjords-icons',
  'Norway Fjords Icons',
  'Fjordwasser, switchbacks, quiet villages and absurdly good viewpoints. A pure scenery route for travellers who want maximum landscape payoff.',
  null,
  null,
  'PD24 Redaktion',
  'public',
  'completed',
  false,
  array['europe','nature','adventure','luxury'],
  5,
  array['NO'],
  'tourism',
  'high',
  $$[
    {
      "citySlug":"bergen-no",
      "cityLabel":"Bergen",
      "lat":60.3913,
      "lng":5.3221,
      "nights":1,
      "planSummary":"Rainy-day beautiful and a perfect first-night port city before the route turns cinematic.",
      "plannedStops":[
        {"label":"Bryggen Arrival","hint":"Wooden facades and harbour texture immediately","time":"15:00","itemName":"Bryggen"},
        {"label":"Floeyen View","hint":"Lift or walk for the first fjord-city panorama","time":"17:00","itemName":"Floeyen"},
        {"label":"Harbour Dinner","hint":"A calm first night with sea air and lights","time":"20:00","itemName":"Bergen Harbour"}
      ]
    },
    {
      "citySlug":"flam-no",
      "cityLabel":"Flam",
      "lat":60.8608,
      "lng":7.1131,
      "nights":1,
      "planSummary":"A tiny stop with oversized surroundings - water, cliffs and one of the strongest slow-travel moods in Norway.",
      "plannedStops":[
        {"label":"Aurlandsfjord Edge","hint":"Take in the scale before doing anything else","time":"15:00","itemName":"Aurlandsfjord"},
        {"label":"Stegastein Viewpoint","hint":"Glass-edge panorama with ridiculous depth","time":"17:30","itemName":"Stegastein"},
        {"label":"Quiet Fjord Evening","hint":"Let the small-town silence do the work","time":"20:00","itemName":"Flam Harbor"}
      ]
    },
    {
      "citySlug":"geiranger-no",
      "cityLabel":"Geiranger",
      "lat":62.1015,
      "lng":7.2056,
      "nights":2,
      "planSummary":"This middle section is the blockbuster: waterfalls, lookouts and roads you remember for years.",
      "plannedStops":[
        {"label":"Fjord Arrival","hint":"The village sits inside the scenery headline","time":"15:00","itemName":"Geirangerfjord"},
        {"label":"Flydalsjuvet","hint":"A signature viewpoint that never disappoints","time":"17:30","itemName":"Flydalsjuvet"},
        {"label":"Seven Sisters Light","hint":"Stay out long enough for the water-and-shadow drama","time":"20:00","itemName":"Geirangerfjord"}
      ]
    },
    {
      "citySlug":"alesund-no",
      "cityLabel":"Alesund",
      "lat":62.4722,
      "lng":6.1495,
      "nights":1,
      "planSummary":"Finish with Jugendstil facades, sea views and a more urban harbour landing.",
      "plannedStops":[
        {"label":"Art Nouveau Center","hint":"Alesund looks different from every angle","time":"15:00","itemName":"Alesund Center"},
        {"label":"Aksla View","hint":"One last big lookout over islands and sea","time":"17:30","itemName":"Aksla"},
        {"label":"Harbour Finale","hint":"Seafood and a last clean coastal evening","time":"20:00","itemName":"Alesund Harbour"}
      ]
    }
  ]$$::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  cover_image_url = excluded.cover_image_url,
  author_name = excluded.author_name,
  visibility = excluded.visibility,
  status = excluded.status,
  is_featured = excluded.is_featured,
  tags = excluded.tags,
  total_nights = excluded.total_nights,
  country_codes = excluded.country_codes,
  occasion = excluded.occasion,
  budget = excluded.budget,
  stops = excluded.stops,
  updated_at = now();

commit;
