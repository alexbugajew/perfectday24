begin;

insert into public.roadtrip_routes (
  slug, title, description, cover_image_url, author_user_id, author_name, visibility, status, is_featured,
  tags, total_nights, country_codes, occasion, budget, stops
)
values (
  'baltic-islands-family-loop',
  'Baltic Islands & Hanse Family Loop',
  'Ostsee, Seebruecken, Altstadtbilder und genug Luft fuer Familienrhythmus. Eine leichte Nordroute mit Strandmomenten, Promenaden und kurzen Wegen.',
  null,
  null,
  'PD24 Redaktion',
  'public',
  'completed',
  true,
  array['germany','nature','family','weekend'],
  5,
  array['DE'],
  'family',
  'medium',
  $$[
    {
      "citySlug":"rostock",
      "cityLabel":"Rostock",
      "lat":54.0924,
      "lng":12.0991,
      "nights":1,
      "planSummary":"Easy harbour opener with Warnemuende sea air and enough room to arrive without rushing.",
      "plannedStops":[
        {"label":"Warnemuende Arrival","hint":"Promenade, beach access and instant holiday energy","time":"15:00","itemName":"Warnemuende"},
        {"label":"Old Riverfront Walk","hint":"Short harbour stroll before dinner","time":"17:00","itemName":"Stadthafen Rostock"},
        {"label":"Pier Sunset","hint":"Wind, water and a simple first-evening payoff","time":"19:30","itemName":"Westmole Warnemuende"}
      ]
    },
    {
      "citySlug":"stralsund",
      "cityLabel":"Stralsund",
      "lat":54.3091,
      "lng":13.0827,
      "nights":1,
      "planSummary":"Brick-gothic facades, sea museum energy and a compact old-town stop that works well with kids and grandparents alike.",
      "plannedStops":[
        {"label":"Old Town Core","hint":"Market square, facades and easy orientation","time":"15:00","itemName":"Altstadt Stralsund"},
        {"label":"Ozeaneum Block","hint":"Big family highlight with marine mood","time":"17:00","itemName":"Ozeaneum"},
        {"label":"Harbour Evening","hint":"Waterfront dinner and ferries in the background","time":"19:30","itemName":"Stralsunder Hafen"}
      ]
    },
    {
      "citySlug":"binz-ruegen",
      "cityLabel":"Binz auf Ruegen",
      "lat":54.3994,
      "lng":13.6105,
      "nights":2,
      "planSummary":"This is the full resort section: long pier walks, beach time and enough flexibility for slow family pacing.",
      "plannedStops":[
        {"label":"Seebruecke Binz","hint":"Classic arrival with immediate Baltic postcard mood","time":"15:00","itemName":"Seebruecke Binz"},
        {"label":"Beach & Promenade","hint":"Low-friction family afternoon by the water","time":"16:30","itemName":"Strandpromenade Binz"},
        {"label":"Rasender Roland Option","hint":"Small adventure if you want a memorable detour","time":"19:00","itemName":"Rasender Roland"}
      ]
    },
    {
      "citySlug":"greifswald",
      "cityLabel":"Greifswald",
      "lat":54.0958,
      "lng":13.3815,
      "nights":1,
      "planSummary":"A quieter final stop with Hanse lanes, university-town calm and a softer ending to the coast run.",
      "plannedStops":[
        {"label":"Market Square First Look","hint":"Broad square and classic north-German facades","time":"15:00","itemName":"Marktplatz Greifswald"},
        {"label":"Museum Harbour","hint":"Wooden boats and relaxed waterside atmosphere","time":"17:00","itemName":"Museumshafen Greifswald"},
        {"label":"Old Town Dinner","hint":"Compact finale without long transfers","time":"19:30","itemName":"Altstadt Greifswald"}
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
  'harz-castles-steam-loop',
  'Harz Castles & Steam Loop',
  'Fachwerk, Schmalspurbahn, Brocken-Mood und Altstaedte mit Charakter. Eine starke Deutschland-Route fuer Kultur, Natur und ein wenig Maerchenstimmung.',
  null,
  null,
  'PD24 Redaktion',
  'public',
  'completed',
  false,
  array['germany','culture','nature','adventure'],
  4,
  array['DE'],
  'tourism',
  'medium',
  $$[
    {
      "citySlug":"goslar",
      "cityLabel":"Goslar",
      "lat":51.9059,
      "lng":10.4270,
      "nights":1,
      "planSummary":"A UNESCO-flavoured opener with old-town texture, mining history and a calm first evening.",
      "plannedStops":[
        {"label":"Old Town Arrival","hint":"Timber facades and compact walking distances","time":"15:00","itemName":"Altstadt Goslar"},
        {"label":"Imperial Palace","hint":"Big history anchor without overcomplicating the day","time":"17:00","itemName":"Kaiserpfalz Goslar"},
        {"label":"Evening on the Cobbles","hint":"Quiet dinner among medieval lanes","time":"19:30","itemName":"Marktplatz Goslar"}
      ]
    },
    {
      "citySlug":"wernigerode",
      "cityLabel":"Wernigerode",
      "lat":51.8369,
      "lng":10.7865,
      "nights":1,
      "planSummary":"Colourful half-timbered houses, castle backdrop and classic Harz postcard energy.",
      "plannedStops":[
        {"label":"Town Hall Core","hint":"One of the strongest facades in the region","time":"15:00","itemName":"Rathaus Wernigerode"},
        {"label":"Castle View","hint":"Walk or shuttle uphill for the big panorama","time":"17:00","itemName":"Schloss Wernigerode"},
        {"label":"Market Square Evening","hint":"Small-town glow and easy dinner finish","time":"19:30","itemName":"Marktplatz Wernigerode"}
      ]
    },
    {
      "citySlug":"quedlinburg",
      "cityLabel":"Quedlinburg",
      "lat":51.7884,
      "lng":11.1418,
      "nights":1,
      "planSummary":"Dense old-town magic with lanes that feel almost too cinematic to be real.",
      "plannedStops":[
        {"label":"Abbey Hill Start","hint":"Best first overview into the historic core","time":"15:00","itemName":"Schlossberg Quedlinburg"},
        {"label":"Fachwerk Drift","hint":"Wander the dense web of old houses slowly","time":"17:00","itemName":"Altstadt Quedlinburg"},
        {"label":"Evening under the Lanterns","hint":"This stop is all about atmosphere","time":"19:30","itemName":"Marktkirchhof Quedlinburg"}
      ]
    },
    {
      "citySlug":"braunlage",
      "cityLabel":"Braunlage",
      "lat":51.7263,
      "lng":10.6115,
      "nights":1,
      "planSummary":"Finish outdoors with mountain air, forest edges and the option for one proper Harz adventure block.",
      "plannedStops":[
        {"label":"Wurmberg Arrival","hint":"Mountain-town reset after the old-town days","time":"15:00","itemName":"Wurmberg"},
        {"label":"Cable Car or Lookout","hint":"Quick altitude payoff if the weather plays along","time":"17:00","itemName":"Wurmbergseilbahn"},
        {"label":"Forest-Edge Dinner","hint":"A grounded and cosy final evening","time":"19:30","itemName":"Braunlage Zentrum"}
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
  'moselle-wine-castle-curve',
  'Moselle Wine & Castle Curve',
  'Steillagen, Burgenblicke und Abende am Fluss. Diese Route ist fuer alle, die Deutschland von seiner weicheren, genussvolleren Seite erleben wollen.',
  null,
  null,
  'PD24 Redaktion',
  'public',
  'completed',
  true,
  array['germany','food','culture','luxury'],
  4,
  array['DE'],
  'date',
  'high',
  $$[
    {
      "citySlug":"koblenz",
      "cityLabel":"Koblenz",
      "lat":50.3569,
      "lng":7.5889,
      "nights":1,
      "planSummary":"A strong river confluence opener with fortress views and real first-evening scale.",
      "plannedStops":[
        {"label":"Deutsches Eck","hint":"Start where Rhine and Moselle meet","time":"15:00","itemName":"Deutsches Eck"},
        {"label":"Fortress View","hint":"Cable car or viewpoint for the panorama payoff","time":"17:00","itemName":"Festung Ehrenbreitstein"},
        {"label":"Riverside Dinner","hint":"Easy evening with water and city lights","time":"20:00","itemName":"Rheinufer Koblenz"}
      ]
    },
    {
      "citySlug":"cochem",
      "cityLabel":"Cochem",
      "lat":50.1451,
      "lng":7.1677,
      "nights":1,
      "planSummary":"Exactly the kind of river-bend stop people picture when they think of the Moselle.",
      "plannedStops":[
        {"label":"Castle Arrival","hint":"The Reichsburg sets the tone immediately","time":"15:00","itemName":"Reichsburg Cochem"},
        {"label":"Old Town Lanes","hint":"Small streets, wine bars and postcard facades","time":"17:00","itemName":"Altstadt Cochem"},
        {"label":"Moselle Blue Hour","hint":"Stay by the water as the town softens into evening","time":"20:00","itemName":"Moselpromenade Cochem"}
      ]
    },
    {
      "citySlug":"bernkastel-kues",
      "cityLabel":"Bernkastel-Kues",
      "lat":49.9167,
      "lng":7.0667,
      "nights":1,
      "planSummary":"A denser wine-town block with strong half-timbered atmosphere and easy tasting energy.",
      "plannedStops":[
        {"label":"Market Square Core","hint":"Classic old-town arrival with almost no dead space","time":"15:00","itemName":"Marktplatz Bernkastel"},
        {"label":"Vineyard Viewpoint","hint":"Short climb for the full river-and-vines picture","time":"17:30","itemName":"Burg Landshut"},
        {"label":"Wine Bar Finish","hint":"This stop should end with a terrace and a glass","time":"20:00","itemName":"Altstadt Bernkastel-Kues"}
      ]
    },
    {
      "citySlug":"trier",
      "cityLabel":"Trier",
      "lat":49.7499,
      "lng":6.6371,
      "nights":1,
      "planSummary":"Roman weight, broad plazas and a final city stop that still fits the soft Moselle rhythm.",
      "plannedStops":[
        {"label":"Porta Nigra Start","hint":"A landmark opening with real substance","time":"15:00","itemName":"Porta Nigra"},
        {"label":"Old Town & Cathedral","hint":"Layered history without needing a packed itinerary","time":"17:00","itemName":"Trierer Dom"},
        {"label":"Moselle Finale","hint":"Last evening with wine and river air","time":"20:00","itemName":"Zurlaubener Ufer"}
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
  'german-wine-route-weekender',
  'German Wine Route Weekender',
  'Pfalz statt Fernflug: Weinorte, kleine Plaetze, Abendterrassen und genau die richtige Dosis Landschaft. Ein kompakter Genuss-Roadtrip fuer zwei oder mit Freunden.',
  null,
  null,
  'PD24 Redaktion',
  'public',
  'completed',
  false,
  array['germany','food','weekend','luxury'],
  4,
  array['DE'],
  'date',
  'medium',
  $$[
    {
      "citySlug":"speyer",
      "cityLabel":"Speyer",
      "lat":49.3173,
      "lng":8.4310,
      "nights":1,
      "planSummary":"Historic city opener with cathedral scale and a smooth launch into the Palatinate.",
      "plannedStops":[
        {"label":"Cathedral Arrival","hint":"One big first impression before the wine-country stretch","time":"15:00","itemName":"Speyerer Dom"},
        {"label":"Old Town Drift","hint":"Easy strolling through a polished center","time":"17:00","itemName":"Maximilianstrasse"},
        {"label":"Evening by the Gate","hint":"Dinner in the historic core without long transfers","time":"19:30","itemName":"Altpfoertel"}
      ]
    },
    {
      "citySlug":"neustadt-an-der-weinstrasse",
      "cityLabel":"Neustadt an der Weinstrasse",
      "lat":49.3501,
      "lng":8.1389,
      "nights":1,
      "planSummary":"The route shifts fully into wine-country mode here: villages, glasses and vineyard slopes.",
      "plannedStops":[
        {"label":"Old Town Start","hint":"Historic lanes and a proper wine-route welcome","time":"15:00","itemName":"Altstadt Neustadt"},
        {"label":"Vineyard Outlook","hint":"Short drive or ride for that Pfalz panorama","time":"17:00","itemName":"Hambacher Schloss"},
        {"label":"Wine Tavern Night","hint":"Lean into local plates and Riesling","time":"20:00","itemName":"Weinstube Neustadt"}
      ]
    },
    {
      "citySlug":"bad-duerkheim",
      "cityLabel":"Bad Duerkheim",
      "lat":49.4618,
      "lng":8.1724,
      "nights":1,
      "planSummary":"Spa-town calm, vineyard edges and enough polish to make the middle of the route feel indulgent.",
      "plannedStops":[
        {"label":"Kurpark Arrival","hint":"Gentle first block and easy reset","time":"15:00","itemName":"Kurpark Bad Duerkheim"},
        {"label":"Giant Barrel Stop","hint":"One playful, classic German-wine-route landmark","time":"17:00","itemName":"Duerkheimer Fass"},
        {"label":"Terrace Evening","hint":"Low-key luxury with late-afternoon light","time":"19:30","itemName":"Bad Duerkheim Zentrum"}
      ]
    },
    {
      "citySlug":"landau-in-der-pfalz",
      "cityLabel":"Landau in der Pfalz",
      "lat":49.1984,
      "lng":8.1164,
      "nights":1,
      "planSummary":"A warmer final stop with market-square rhythm and a softer city ending than people expect.",
      "plannedStops":[
        {"label":"Main Square Intro","hint":"Arcades, facades and a broad old-town core","time":"15:00","itemName":"Rathausplatz Landau"},
        {"label":"Fortress Remnants","hint":"A small history detour before the final dinner","time":"17:00","itemName":"Landau Altstadt"},
        {"label":"Pfalz Finale","hint":"Last night for long dinner energy and a final bottle","time":"19:30","itemName":"Landau Zentrum"}
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
  'bavarian-castles-alpine-finish',
  'Bavarian Castles & Alpine Finish',
  'Grossstadtstart, Koenigsschloss, Bergkulisse und am Ende echtes Alpenfinale. Diese Route funktioniert fuer Sommer, Herbst und einen starken ersten Bayern-Trip.',
  null,
  null,
  'PD24 Redaktion',
  'public',
  'completed',
  true,
  array['germany','nature','family','luxury'],
  5,
  array['DE'],
  'tourism',
  'high',
  $$[
    {
      "citySlug":"muenchen",
      "cityLabel":"Muenchen",
      "lat":48.1374,
      "lng":11.5755,
      "nights":1,
      "planSummary":"Kick off polished and social before the route opens into castles and mountains.",
      "plannedStops":[
        {"label":"Viktualienmarkt Start","hint":"Food mood and immediate city rhythm","time":"15:00","itemName":"Viktualienmarkt"},
        {"label":"Isar or English Garden","hint":"Green reset before the roadtrip days","time":"17:30","itemName":"Englischer Garten"},
        {"label":"Beer Garden Night","hint":"One classic city evening before heading south","time":"20:00","itemName":"Biergarten"}
      ]
    },
    {
      "citySlug":"fuessen",
      "cityLabel":"Fuessen",
      "lat":47.5696,
      "lng":10.7000,
      "nights":1,
      "planSummary":"The fairytale-castle section lands here, but the alpine lakes around it matter just as much.",
      "plannedStops":[
        {"label":"Old Town Arrival","hint":"Compact center before the classic castle block","time":"15:00","itemName":"Altstadt Fuessen"},
        {"label":"Neuschwanstein Window","hint":"Do the postcard anchor without overfilling the day","time":"17:00","itemName":"Schloss Neuschwanstein"},
        {"label":"Alpsee Evening","hint":"Water, mountains and a softer close than the castle crowds","time":"19:30","itemName":"Alpsee"}
      ]
    },
    {
      "citySlug":"garmisch-partenkirchen",
      "cityLabel":"Garmisch-Partenkirchen",
      "lat":47.4917,
      "lng":11.0955,
      "nights":1,
      "planSummary":"Now the route fully commits to mountain scenery and proper southern-Bavaria atmosphere.",
      "plannedStops":[
        {"label":"Town Core","hint":"Painted houses and easy alpine-town orientation","time":"15:00","itemName":"Partenkirchen"},
        {"label":"Gorge or Viewpoint","hint":"Choose drama on foot or a cleaner scenic detour","time":"17:00","itemName":"Partnachklamm"},
        {"label":"Mountain Dinner","hint":"A strong place for one classic alpine evening","time":"19:30","itemName":"Garmisch Zentrum"}
      ]
    },
    {
      "citySlug":"berchtesgaden",
      "cityLabel":"Berchtesgaden",
      "lat":47.6324,
      "lng":13.0006,
      "nights":2,
      "planSummary":"The finale is all about lakes, peaks and one of the biggest scenery payoffs in southern Germany.",
      "plannedStops":[
        {"label":"Town Arrival","hint":"Easy first block before the landscape highlights","time":"15:00","itemName":"Berchtesgaden Zentrum"},
        {"label":"Koenigssee Block","hint":"Lake, cliffs and clean alpine drama","time":"17:00","itemName":"Koenigssee"},
        {"label":"Late-Light Mountain Finish","hint":"Stay with the view rather than overplanning the night","time":"20:00","itemName":"Berchtesgadener Alpen"}
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
  'lake-constance-grand-loop',
  'Lake Constance Grand Loop',
  'Vier Laender in einer Region, viel Wasserkante und sehr gute Sommerenergie. Diese Route spielt ihre Staerke bei langen Tagen, Promenaden und entspannten Stops aus.',
  null,
  null,
  'PD24 Redaktion',
  'public',
  'completed',
  true,
  array['europe','nature','family','luxury'],
  5,
  array['DE','AT','CH'],
  'tourism',
  'high',
  $$[
    {
      "citySlug":"konstanz-de",
      "cityLabel":"Konstanz",
      "lat":47.6779,
      "lng":9.1732,
      "nights":1,
      "planSummary":"Lakeside old-town energy with an easy launch into the multi-country mood of the whole loop.",
      "plannedStops":[
        {"label":"Harbour Arrival","hint":"Lake edge, boats and an immediate summer feeling","time":"15:00","itemName":"Hafen Konstanz"},
        {"label":"Old Town Drift","hint":"Compact center with lots of food options","time":"17:00","itemName":"Altstadt Konstanz"},
        {"label":"Lakefront Blue Hour","hint":"Stay close to the water for the first-night payoff","time":"20:00","itemName":"Bodenseeufer Konstanz"}
      ]
    },
    {
      "citySlug":"meersburg-de",
      "cityLabel":"Meersburg",
      "lat":47.6939,
      "lng":9.2718,
      "nights":1,
      "planSummary":"A smaller but very strong stop with terraces, vineyards and one of the prettiest historic waterfronts on the lake.",
      "plannedStops":[
        {"label":"Upper Town Start","hint":"Castle edges and good first views","time":"15:00","itemName":"Meersburg Oberstadt"},
        {"label":"Lakeside Promenade","hint":"Slow pacing is the point here","time":"17:00","itemName":"Uferpromenade Meersburg"},
        {"label":"Wine & Sunset","hint":"A terrace stop fits this route perfectly","time":"19:30","itemName":"Meersburg Zentrum"}
      ]
    },
    {
      "citySlug":"lindau-de",
      "cityLabel":"Lindau",
      "lat":47.5461,
      "lng":9.6843,
      "nights":1,
      "planSummary":"Island-town charm, harbour entrance drama and a very easy golden-hour win.",
      "plannedStops":[
        {"label":"Harbour Lions Arrival","hint":"Start with the most iconic lake gateway","time":"15:00","itemName":"Lindauer Hafen"},
        {"label":"Island Walk","hint":"Narrow lanes and low-stress exploring","time":"17:00","itemName":"Lindau Insel"},
        {"label":"Promenade Dinner","hint":"A classic summer-evening finish","time":"20:00","itemName":"Seepromenade Lindau"}
      ]
    },
    {
      "citySlug":"bregenz-at",
      "cityLabel":"Bregenz",
      "lat":47.5031,
      "lng":9.7471,
      "nights":1,
      "planSummary":"The route shifts slightly more urban here, but keeps the same lake-air ease.",
      "plannedStops":[
        {"label":"Lake Stage Zone","hint":"Waterfront architecture and open space","time":"15:00","itemName":"Bregenzer Seebuehne"},
        {"label":"Pfander View","hint":"Cable car or viewpoint for the big panorama","time":"17:30","itemName":"Pfaender"},
        {"label":"Harbour Night","hint":"A clean and polished evening block","time":"20:00","itemName":"Hafen Bregenz"}
      ]
    },
    {
      "citySlug":"st-gallen-ch",
      "cityLabel":"St. Gallen",
      "lat":47.4245,
      "lng":9.3767,
      "nights":1,
      "planSummary":"Finish with abbey-city texture and a more refined final stop away from the shoreline crowds.",
      "plannedStops":[
        {"label":"Abbey District","hint":"Historic core with real substance","time":"15:00","itemName":"Stiftsbezirk St. Gallen"},
        {"label":"Old Town Lanes","hint":"Short walks, cafes and elegant facades","time":"17:00","itemName":"Altstadt St. Gallen"},
        {"label":"Final Dinner","hint":"A softer, more urban close to the loop","time":"19:30","itemName":"St. Gallen Zentrum"}
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
  'salzkammergut-lakes-escape',
  'Salzkammergut Lakes Escape',
  'Seen, Berge, Belle-Epoque-Vibes und ein paar der saubersten Sommerbilder Mitteleuropas. Eine elegante Route fuer langsame Vormittage und starke Nachmittagskulissen.',
  null,
  null,
  'PD24 Redaktion',
  'public',
  'completed',
  false,
  array['europe','nature','luxury','food'],
  5,
  array['AT'],
  'date',
  'high',
  $$[
    {
      "citySlug":"salzburg-at",
      "cityLabel":"Salzburg",
      "lat":47.8095,
      "lng":13.0550,
      "nights":1,
      "planSummary":"Baroque city energy makes for a polished opener before the route becomes more scenic and lake-led.",
      "plannedStops":[
        {"label":"Old Town Arrival","hint":"A cinematic first block with almost no effort","time":"15:00","itemName":"Salzburger Altstadt"},
        {"label":"Moenchsberg View","hint":"Quick altitude for a classic panorama","time":"17:00","itemName":"Moenchsberg"},
        {"label":"River Evening","hint":"Blue-hour walk before dinner","time":"20:00","itemName":"Salzachufer"}
      ]
    },
    {
      "citySlug":"st-gilgen-at",
      "cityLabel":"St. Gilgen",
      "lat":47.7682,
      "lng":13.3646,
      "nights":1,
      "planSummary":"Now the route turns fully into lakes and mountain silhouettes, with a much slower rhythm.",
      "plannedStops":[
        {"label":"Wolfgangsee Arrival","hint":"Immediate water-and-mountain reset","time":"15:00","itemName":"Wolfgangsee"},
        {"label":"Lakeside Stroll","hint":"Exactly the kind of simple scenic block this trip needs","time":"17:00","itemName":"St. Gilgen Ufer"},
        {"label":"Lake Dinner","hint":"Terrace mood beats a packed checklist here","time":"19:30","itemName":"St. Gilgen Zentrum"}
      ]
    },
    {
      "citySlug":"hallstatt-at",
      "cityLabel":"Hallstatt",
      "lat":47.5622,
      "lng":13.6493,
      "nights":2,
      "planSummary":"The headline stop: dramatic lake village, vertical scenery and enough beauty for a two-night middle section.",
      "plannedStops":[
        {"label":"Lakeside Arrival","hint":"The postcard angle appears almost immediately","time":"15:00","itemName":"Hallstaetter See"},
        {"label":"Old Village Walk","hint":"Narrow lanes, viewpoints and small-shop texture","time":"17:00","itemName":"Hallstatt Zentrum"},
        {"label":"Late-Light Lakefront","hint":"Stay outside as long as the light lasts","time":"20:00","itemName":"Marktplatz Hallstatt"}
      ]
    },
    {
      "citySlug":"bad-ischl-at",
      "cityLabel":"Bad Ischl",
      "lat":47.7111,
      "lng":13.6181,
      "nights":1,
      "planSummary":"Finish with spa-town composure and a more refined final pace after the scenery blockbuster.",
      "plannedStops":[
        {"label":"Imperial Villa Zone","hint":"A gentler arrival into town culture","time":"15:00","itemName":"Kaiservilla Bad Ischl"},
        {"label":"Traun River Walk","hint":"Easy movement and clean spa-town atmosphere","time":"17:00","itemName":"Traunpromenade"},
        {"label":"Final Cafe Dinner","hint":"A calm and polished end to the route","time":"19:30","itemName":"Bad Ischl Zentrum"}
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
  'dolomites-great-passes',
  'Dolomites Great Passes',
  'Paesse, Zinnen, Bergdoerfer und ein Maximum an Landschaftswirkung. Diese Route ist fuer Reisende, die sich an Aussicht nicht sattsehen.',
  null,
  null,
  'PD24 Redaktion',
  'public',
  'completed',
  true,
  array['europe','nature','adventure','luxury'],
  5,
  array['IT'],
  'tourism',
  'high',
  $$[
    {
      "citySlug":"bolzano-it",
      "cityLabel":"Bolzano",
      "lat":46.4983,
      "lng":11.3548,
      "nights":1,
      "planSummary":"A South Tyrol opener with arcades, aperitivo mood and an easy transition into the mountains.",
      "plannedStops":[
        {"label":"Arcades Arrival","hint":"Coffee, facades and a clean first-city rhythm","time":"15:00","itemName":"Via dei Portici"},
        {"label":"Piazza Walther","hint":"Compact center with mountain edges already visible","time":"17:00","itemName":"Piazza Walther"},
        {"label":"South Tyrol Evening","hint":"Aperitivo and dinner before the pass roads begin","time":"20:00","itemName":"Centro Bolzano"}
      ]
    },
    {
      "citySlug":"ortisei-it",
      "cityLabel":"Ortisei",
      "lat":46.5753,
      "lng":11.6713,
      "nights":1,
      "planSummary":"The route now becomes unmistakably alpine, with chalet-town warmth and dramatic ridgelines.",
      "plannedStops":[
        {"label":"Village Arrival","hint":"Wood detail, shops and immediate mountain calm","time":"15:00","itemName":"Ortisei Zentrum"},
        {"label":"Seceda or Meadow View","hint":"Take the biggest nearby visual payoff you can get","time":"17:00","itemName":"Seceda"},
        {"label":"Mountain Dinner","hint":"One of those nights where the setting does most of the work","time":"20:00","itemName":"Ortisei"}
      ]
    },
    {
      "citySlug":"cortina-dampezzo-it",
      "cityLabel":"Cortina d Ampezzo",
      "lat":46.5405,
      "lng":12.1357,
      "nights":2,
      "planSummary":"This is the glamorous alpine center of the route: big peaks, passes and long scenic afternoons.",
      "plannedStops":[
        {"label":"Town Core Arrival","hint":"A polished mountain-town block before the viewpoints","time":"15:00","itemName":"Corso Italia Cortina"},
        {"label":"Pass Road Detour","hint":"Drive for the scenery, not just the destination","time":"17:30","itemName":"Passo Giau"},
        {"label":"Late-Light Dolomites","hint":"The colour shift on the rock faces is the headline","time":"20:00","itemName":"Cortina d Ampezzo"}
      ]
    },
    {
      "citySlug":"dobbiaco-it",
      "cityLabel":"Dobbiaco",
      "lat":46.7340,
      "lng":12.2253,
      "nights":1,
      "planSummary":"Finish with a quieter Dolomites landing built around lakes and cleaner, calmer scenery.",
      "plannedStops":[
        {"label":"Village Reset","hint":"A slower base after the pass-day drama","time":"15:00","itemName":"Dobbiaco"},
        {"label":"Lake Toblach","hint":"Simple and beautiful final nature block","time":"17:00","itemName":"Lago di Dobbiaco"},
        {"label":"Final Alpine Night","hint":"Keep the ending small, warm and scenic","time":"19:30","itemName":"Centro Dobbiaco"}
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
  'alsace-black-forest-borderline',
  'Alsace & Black Forest Borderline',
  'Fachwerk, Weinorte, Strasbourg-Flair und spaeter noch Schwarzwald-Eleganz. Eine sehr dankbare Grenzroute fuer Genuss, Architektur und starke Abendbilder.',
  null,
  null,
  'PD24 Redaktion',
  'public',
  'completed',
  false,
  array['europe','food','culture','luxury'],
  5,
  array['FR','DE'],
  'date',
  'high',
  $$[
    {
      "citySlug":"strasbourg-fr",
      "cityLabel":"Strasbourg",
      "lat":48.5734,
      "lng":7.7521,
      "nights":1,
      "planSummary":"Cathedral scale, canal quarters and one of the easiest premium city openers in this whole set.",
      "plannedStops":[
        {"label":"Grande Ile Arrival","hint":"Historic core with immediate wow density","time":"15:00","itemName":"Grande Ile Strasbourg"},
        {"label":"Petite France","hint":"Canals, bridges and evening-photo energy","time":"17:00","itemName":"Petite France"},
        {"label":"Alsace Dinner","hint":"The route should start with a long table here","time":"20:00","itemName":"Centre Strasbourg"}
      ]
    },
    {
      "citySlug":"colmar-fr",
      "cityLabel":"Colmar",
      "lat":48.0795,
      "lng":7.3585,
      "nights":1,
      "planSummary":"The middle of the route leans fully into wine villages, flowers, canals and facade detail.",
      "plannedStops":[
        {"label":"Old Town Start","hint":"Everything is close and visually dense","time":"15:00","itemName":"Vieille Ville Colmar"},
        {"label":"Little Venice","hint":"A small but highly photogenic late-afternoon block","time":"17:00","itemName":"La Petite Venise"},
        {"label":"Wine Bar Evening","hint":"A natural fit after a day like this","time":"19:30","itemName":"Centre Colmar"}
      ]
    },
    {
      "citySlug":"freiburg-im-breisgau",
      "cityLabel":"Freiburg",
      "lat":47.9990,
      "lng":7.8421,
      "nights":1,
      "planSummary":"A smoother city stop with sunlit lanes and a clean transition back into Germany.",
      "plannedStops":[
        {"label":"Muenster Intro","hint":"Strong center anchor and easy city orientation","time":"15:00","itemName":"Freiburger Muenster"},
        {"label":"Baechle & Old Town","hint":"Walk slowly, the details matter here","time":"17:00","itemName":"Altstadt Freiburg"},
        {"label":"Warm Evening Finish","hint":"This city does relaxed dinner mood very well","time":"20:00","itemName":"Augustinerplatz"}
      ]
    },
    {
      "citySlug":"baden-baden",
      "cityLabel":"Baden-Baden",
      "lat":48.7606,
      "lng":8.2398,
      "nights":2,
      "planSummary":"Finish with spa-town elegance, hill views and a final note of old-school glamour.",
      "plannedStops":[
        {"label":"Kurhaus Arrival","hint":"A polished final stop from minute one","time":"15:00","itemName":"Kurhaus Baden-Baden"},
        {"label":"Lichtentaler Allee","hint":"Gentle walking block through the classic green axis","time":"17:00","itemName":"Lichtentaler Allee"},
        {"label":"Terrace Finale","hint":"Close the route with one last refined evening","time":"20:00","itemName":"Baden-Baden Zentrum"}
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
  'andalusia-white-villages-run',
  'Andalusia White Villages Run',
  'Weisse Bergdoerfer, Tapas, Aussichtskanten und genau die richtige Dosis Roadmovie-Gefuehl. Diese Route lebt von warmen Abenden und spektakulaeren Ortslagen.',
  null,
  null,
  'PD24 Redaktion',
  'public',
  'completed',
  true,
  array['europe','culture','food','adventure'],
  5,
  array['ES'],
  'tourism',
  'medium',
  $$[
    {
      "citySlug":"seville-es",
      "cityLabel":"Seville",
      "lat":37.3891,
      "lng":-5.9845,
      "nights":1,
      "planSummary":"Start urban and vivid before the route moves into the higher, quieter village landscapes.",
      "plannedStops":[
        {"label":"Historic Core Arrival","hint":"Big atmosphere and easy tapas momentum","time":"15:00","itemName":"Casco Antiguo Sevilla"},
        {"label":"Cathedral & Streets","hint":"Layer one key landmark into the first evening","time":"17:00","itemName":"Catedral de Sevilla"},
        {"label":"Tapas Night","hint":"A social opener before the mountain-road days","time":"20:30","itemName":"Santa Cruz Sevilla"}
      ]
    },
    {
      "citySlug":"ronda-es",
      "cityLabel":"Ronda",
      "lat":36.7460,
      "lng":-5.1610,
      "nights":1,
      "planSummary":"Dramatic gorge-town arrival with one of the strongest single-stop views in southern Spain.",
      "plannedStops":[
        {"label":"Puente Nuevo First Look","hint":"Instant route headline and real scale","time":"15:00","itemName":"Puente Nuevo Ronda"},
        {"label":"Old Town Walk","hint":"Stone lanes and cliff-edge viewpoints","time":"17:00","itemName":"Casco Historico de Ronda"},
        {"label":"Sunset by the Edge","hint":"Stay out long enough for the late light on the gorge","time":"20:30","itemName":"Mirador de Ronda"}
      ]
    },
    {
      "citySlug":"setenil-de-las-bodegas-es",
      "cityLabel":"Setenil de las Bodegas",
      "lat":36.8634,
      "lng":-5.1817,
      "nights":1,
      "planSummary":"A smaller but unforgettable stop built around cave-like streets and a very singular sense of place.",
      "plannedStops":[
        {"label":"Rock-Street Arrival","hint":"The overhanging rock makes this place instantly memorable","time":"15:00","itemName":"Setenil de las Bodegas"},
        {"label":"Upper Viewpoint","hint":"Climb for the full village geometry","time":"17:00","itemName":"Mirador de Setenil"},
        {"label":"Tapas under the Rock","hint":"The route practically scripts the dinner for you here","time":"20:00","itemName":"Calle Cuevas del Sol"}
      ]
    },
    {
      "citySlug":"arcos-de-la-frontera-es",
      "cityLabel":"Arcos de la Frontera",
      "lat":36.7507,
      "lng":-5.8106,
      "nights":2,
      "planSummary":"Finish high above the valley with whitewashed facades, viewpoints and a proper final village atmosphere.",
      "plannedStops":[
        {"label":"Hilltop Core","hint":"Slow arrival through the whitewashed old center","time":"15:00","itemName":"Casco Antiguo Arcos"},
        {"label":"Mirador Block","hint":"This stop earns its place with viewpoints alone","time":"17:00","itemName":"Mirador de Arcos"},
        {"label":"Final Andalusian Night","hint":"Long dinner, warm air and the route closing softly","time":"20:30","itemName":"Centro Historico Arcos"}
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
