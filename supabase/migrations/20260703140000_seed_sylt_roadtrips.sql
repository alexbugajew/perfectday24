-- Seed: 4 kuratierte Sylt-Roadtrips (Natur, Familie, Girls, Party)
-- ============================================================================
-- Sylt-Orte (List, Kampen, Wenningstedt, Westerland, Rantum, Hoernum, Keitum)
-- sind nicht in der cities-Tabelle — stops.citySlug ist display-only (wie bei
-- den Norway/Andalusia-Seeds). Karte rendert aus lat/lng, Planner-Deeplinks
-- degradieren graceful.
--
-- Idempotent: on conflict (slug) do nothing.

begin;

insert into public.roadtrip_routes (
  slug, title, description, cover_image_url,
  author_user_id, author_name, visibility, status, is_featured,
  tags, total_nights, country_codes, occasion, budget, stops
)
values
-- ── 1) NATUR ────────────────────────────────────────────────────────────────
(
  'sylt-natur-slow-trail',
  'Sylt Natur — Dünen, Watt & Weststrand',
  'Drei Tage nur Natur: wandernde Dünen am Ellenbogen, das Wattenmeer bei Keitum und Seehundbänke an der Hörnum-Odde. Für alle, die Sylt langsam und wild erleben wollen.',
  'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=1400&h=700&fit=crop&auto=format&q=80',
  null, 'PD24 Redaktion', 'public', 'completed', true,
  array['germany','nature','beach','island','slow-travel'],
  3, array['DE'], 'tourism', 'medium',
  $$[
    {
      "citySlug":"sylt-list","cityLabel":"List (Ellenbogen)","lat":55.0189,"lng":8.4114,"nights":1,
      "planSummary":"Nördlichster Punkt Deutschlands: Wanderdünen, Königshafen und weiter Weststrand ohne Trubel.",
      "plannedStops":[
        {"label":"Ellenbogen","hint":"Wandernde Dünen, Leuchttürme und endlose Weite an der Nordspitze","time":"10:00","itemName":"Ellenbogen Sylt"},
        {"label":"Königshafen","hint":"Ruhige Wattbucht, Vögel und Muschelbänke bei Ebbe","time":"13:30","itemName":"Königshafen"},
        {"label":"Weststrand List","hint":"Brandung und Sonnenuntergang am freien Strand","time":"18:30","itemName":"Lister Weststrand"}
      ]
    },
    {
      "citySlug":"sylt-keitum","cityLabel":"Keitum","lat":54.8930,"lng":8.3650,"nights":1,
      "planSummary":"Die grüne Seite der Insel: Wattenmeer, Kapitänshäuser und alte Friesenwälle.",
      "plannedStops":[
        {"label":"Wattwanderung Keitum","hint":"Geführt ins Weltnaturerbe Wattenmeer, Priele und Wattboden","time":"09:30","itemName":"Wattenmeer Keitum"},
        {"label":"Grüner Uferweg","hint":"Schattige Allee an der Wattkante mit Blick aufs Festland","time":"14:00","itemName":"Keitumer Uferweg"},
        {"label":"Friesendorf-Runde","hint":"Reetdächer, alte Kapitänshäuser und stille Gärten","time":"17:00","itemName":"Keitum Dorf"}
      ]
    },
    {
      "citySlug":"sylt-hoernum","cityLabel":"Hörnum","lat":54.7570,"lng":8.2960,"nights":1,
      "planSummary":"Die wilde Südspitze: Weststrand, Seehundbänke und die sich ständig verändernde Odde.",
      "plannedStops":[
        {"label":"Hörnum-Odde","hint":"Landzunge mit Brandung, Dünen und ständig neuer Küstenlinie","time":"10:00","itemName":"Hörnum Odde"},
        {"label":"Seehund-Bootstour","hint":"Zu den Sandbänken vor der Küste, Seehunde und Kegelrobben","time":"14:00","itemName":"Adler-Schiffe Hörnum"},
        {"label":"Weststrand Sundowner","hint":"Letztes Licht über der offenen Nordsee","time":"19:00","itemName":"Hörnumer Weststrand"}
      ]
    }
  ]$$
),
-- ── 2) FAMILIE ──────────────────────────────────────────────────────────────
(
  'sylt-familien-inselzeit',
  'Sylt mit Familie — Strand, Watt & Regentag-Plan B',
  'Drei entspannte Inseltage für Familien: flacher Familienstrand in Wenningstedt, das Erlebnisbad und Aquarium in Westerland und die Naturgewalten-Ausstellung in List. Mit Schlechtwetter-Backup an jedem Ort.',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1400&h=700&fit=crop&auto=format&q=80',
  null, 'PD24 Redaktion', 'public', 'completed', true,
  array['germany','family','beach','island','kids'],
  3, array['DE'], 'family', 'medium',
  $$[
    {
      "citySlug":"sylt-wenningstedt","cityLabel":"Wenningstedt","lat":54.9430,"lng":8.3280,"nights":1,
      "planSummary":"Ruhiger Familienstrand mit flachem Einstieg, Strandkörben und kurzem Weg zum Ort.",
      "plannedStops":[
        {"label":"Familienstrand","hint":"Flacher Einstieg, Strandkörbe und Sandburgen-Zone","time":"10:00","itemName":"Strand Wenningstedt"},
        {"label":"Denghoog Grabhügel","hint":"5000 Jahre alte Grabkammer — kleines Abenteuer für Kinder","time":"14:30","itemName":"Denghoog"},
        {"label":"Eis am Kliff","hint":"Sonnenuntergang am Rutschenkliff mit Eis in der Hand","time":"18:00","itemName":"Wenningstedt Kliff"}
      ]
    },
    {
      "citySlug":"sylt-westerland","cityLabel":"Westerland","lat":54.9079,"lng":8.3050,"nights":1,
      "planSummary":"Der lebendige Hauptort: Erlebnisbad, Aquarium und die lange Strandpromenade.",
      "plannedStops":[
        {"label":"Erlebnisbad Sylter Welle","hint":"Wellenbecken, Rutschen und Warmwasser — perfekt bei Regen","time":"10:00","itemName":"Sylter Welle"},
        {"label":"Sylt Aquarium","hint":"Nordsee-Fische, Haie und ein Unterwassertunnel","time":"14:00","itemName":"Sylt Aquarium"},
        {"label":"Promenade & Strand","hint":"Strandkörbe, Pommes und Drachensteigen bei Wind","time":"16:30","itemName":"Westerland Promenade"}
      ]
    },
    {
      "citySlug":"sylt-list","cityLabel":"List","lat":55.0189,"lng":8.4114,"nights":1,
      "planSummary":"Hafenidylle mit Fischbrötchen, Naturgewalten-Ausstellung und einer Robben-Bootstour.",
      "plannedStops":[
        {"label":"Erlebniszentrum Naturgewalten","hint":"Interaktive Ausstellung zu Watt, Wetter und Nordsee","time":"10:00","itemName":"Naturgewalten Sylt"},
        {"label":"Lister Hafen","hint":"Fischbrötchen, Kutter und Softeis direkt am Wasser","time":"13:00","itemName":"Lister Hafen"},
        {"label":"Robben-Bootstour","hint":"Seehunde auf den Sandbänken — Fernglas nicht vergessen","time":"15:30","itemName":"Adler-Schiffe List"}
      ]
    }
  ]$$
),
-- ── 3) GIRLS ────────────────────────────────────────────────────────────────
(
  'sylt-girls-getaway',
  'Sylt Girls Getaway — Kliff, Kunst & Champagner',
  'Drei Tage Sylt für die beste Runde: Sonnenuntergang am Roten Kliff in Kampen, Shopping und Spa in Westerland, Galerien und Landhaus-Charme in Keitum. Viel Café, Prosecco und Meer.',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1400&h=700&fit=crop&auto=format&q=80',
  null, 'PD24 Redaktion', 'public', 'completed', true,
  array['germany','friends','wellness','island','girls-trip'],
  3, array['DE'], 'friends', 'high',
  $$[
    {
      "citySlug":"sylt-kampen","cityLabel":"Kampen","lat":54.9500,"lng":8.3400,"nights":1,
      "planSummary":"Sylts glamouröse Seite: Rotes Kliff, kleine Galerien und die legendäre Champagner-Runde.",
      "plannedStops":[
        {"label":"Uwe-Düne","hint":"Höchster Punkt der Insel — 360°-Blick über Meer und Watt","time":"11:00","itemName":"Uwe Düne"},
        {"label":"Rotes Kliff Sunset","hint":"Der Sylt-Klassiker: rotglühendes Kliff im Abendlicht","time":"18:30","itemName":"Rotes Kliff Kampen"},
        {"label":"Champagner-Meile","hint":"Sundowner und Bubbles auf der Strönwai","time":"20:00","itemName":"Strönwai Kampen"}
      ]
    },
    {
      "citySlug":"sylt-westerland","cityLabel":"Westerland","lat":54.9079,"lng":8.3050,"nights":1,
      "planSummary":"Shopping auf der Friedrichstraße, ein langer Spa-Nachmittag und Café-Hopping mit Meerblick.",
      "plannedStops":[
        {"label":"Friedrichstraße Shopping","hint":"Boutiquen, Sylt-Mode und Concept Stores","time":"10:30","itemName":"Friedrichstraße Westerland"},
        {"label":"Meerwasser-Spa","hint":"Thalasso, Sauna und Meerblick — der Regen-Plan, der immer passt","time":"14:00","itemName":"Syltness Center"},
        {"label":"Café-Hopping","hint":"Franzbrötchen, Flat White und Leute schauen","time":"17:00","itemName":"Westerland Cafés"}
      ]
    },
    {
      "citySlug":"sylt-keitum","cityLabel":"Keitum","lat":54.8930,"lng":8.3650,"nights":1,
      "planSummary":"Ruhiger Ausklang: Galerien, Landhaus-Boutiquen und Tee unter Reetdächern.",
      "plannedStops":[
        {"label":"Galerien-Runde","hint":"Kunst und Kunsthandwerk in alten Friesenhäusern","time":"11:00","itemName":"Keitum Galerien"},
        {"label":"Landhaus-Boutiquen","hint":"Interior, Schmuck und Sylt-Klassiker zum Mitnehmen","time":"13:30","itemName":"Keitum Boutiquen"},
        {"label":"Tee am Watt","hint":"Ostfriesentee mit Blick auf die Wattkante","time":"16:00","itemName":"Keitumer Uferweg"}
      ]
    }
  ]$$
),
-- ── 4) PARTY ────────────────────────────────────────────────────────────────
(
  'sylt-nightlife-beach-party',
  'Sylt Party — Whisky-Meile, Beach Clubs & Sansibar',
  'Drei Nächte Sylt auf Vollgas: Bars und Strandclubs in Westerland, die legendäre Whisky-Meile in Kampen und Sundowner-Party an der Sansibar in Rantum. Für die Runde, die die Insel bei Nacht will.',
  'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1400&h=700&fit=crop&auto=format&q=80',
  null, 'PD24 Redaktion', 'public', 'completed', true,
  array['germany','party','nightlife','island','beach-club'],
  3, array['DE'], 'party', 'high',
  $$[
    {
      "citySlug":"sylt-westerland","cityLabel":"Westerland","lat":54.9079,"lng":8.3050,"nights":1,
      "planSummary":"Warm-up am Strand, Barhopping in der Stadt und späte Clubnacht direkt am Meer.",
      "plannedStops":[
        {"label":"Strandbar Sundowner","hint":"Aperol und Füße im Sand zum Sonnenuntergang","time":"18:30","itemName":"Westerland Strandbar"},
        {"label":"Barhopping Innenstadt","hint":"Von der Weinbar zur Cocktailbar rund um die Friedrichstraße","time":"21:00","itemName":"Westerland Bars"},
        {"label":"Club am Meer","hint":"Späte Nacht mit DJ und Blick auf die Brandung","time":"23:30","itemName":"Westerland Nightlife"}
      ]
    },
    {
      "citySlug":"sylt-kampen","cityLabel":"Kampen","lat":54.9500,"lng":8.3400,"nights":1,
      "planSummary":"Der Sylt-Nightlife-Klassiker: Whisky-Meile, Pony-Bar-Legende und Champagner bis spät.",
      "plannedStops":[
        {"label":"Kliff-Aperitif","hint":"Erst Sonnenuntergang am Roten Kliff, dann rein ins Dorf","time":"18:00","itemName":"Rotes Kliff Kampen"},
        {"label":"Whisky-Meile","hint":"Die berühmte Strönwai — von Bar zu Bar","time":"20:30","itemName":"Strönwai Kampen"},
        {"label":"Pony-Bar-Legende","hint":"Sylt-Institution mit Sägemehl am Boden und langer Nacht","time":"23:00","itemName":"Pony Bar Kampen"}
      ]
    },
    {
      "citySlug":"sylt-rantum","cityLabel":"Rantum","lat":54.8500,"lng":8.2900,"nights":1,
      "planSummary":"Finale an der Sansibar: Sundowner in den Dünen und Beach-Club-Stimmung bis spät.",
      "plannedStops":[
        {"label":"Dünen-Anmarsch","hint":"Über die Rantumer Dünen zum berühmtesten Strandlokal der Insel","time":"17:00","itemName":"Rantum Dünen"},
        {"label":"Sansibar Sundowner","hint":"Wein, Austern und Sonnenuntergang an der Kult-Location","time":"18:30","itemName":"Sansibar Rantum"},
        {"label":"Beach-Club-Ausklang","hint":"Musik, Sand und der letzte Drink unter Sternen","time":"21:00","itemName":"Rantum Beach"}
      ]
    }
  ]$$
)
on conflict (slug) do nothing;

commit;
