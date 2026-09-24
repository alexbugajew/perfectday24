-- Seed: Allgäu Wellness-JGA — Mädels-Roadtrip (2 Nächte)
-- Kuratierter Junggesellinnenabschied als Roadtrip durchs Oberallgäu: Therme mit
-- Neuschwanstein-Blick, Wellnesshotel als Basis, eine Haupt-Aktivität nach Wahl,
-- Highlight-Dinner und Tanzen. Echte, recherchierte Orte je Stop (planSummary +
-- plannedStops mit Zeiten). citySlug ist display-only (keine cities-FK).
-- Idempotent via on conflict (slug) do nothing.

begin;

insert into public.roadtrip_routes
  (slug,title,description,cover_image_url,author_user_id,author_name,visibility,status,is_featured,tags,total_nights,country_codes,occasion,budget,stops)
values
('allgaeu-wellness-jga',
 'Allgäu Wellness-JGA — Sauna, Gipfel und Cocktails',
 'Ein Junggesellinnenabschied als Roadtrip durchs Allgäu: Therme mit Neuschwanstein-Blick, ein Wellnesshotel als Basis, Canyoning oder Alpakawanderung, Highlight-Dinner und Tanzen — zwei Nächte zwischen Sauna und Gipfeln.',
 null,null,'PD24 Redaktion','public','completed',true,
 array['jga','luxury','nature','weekend','germany'],
 2,array['DE'],'friends','medium',
 $$[{"citySlug":"de-oberstaufen","cityLabel":"Oberstaufen · Wellness-Auftakt","lat":47.5556,"lng":10.0206,"nights":1,"planSummary":"Anreise mit Therme-Stopp und erstes Ankommen: Sole und Neuschwanstein-Blick in der Kristall-Therme Schwangau, danach Check-in im Wellnesshotel, Sauna und ein geselliges Welcome-Dinner mit Cocktail-Auftakt in Sonthofen.","plannedStops":[{"label":"Kristall-Therme Schwangau","hint":"Sole-Thermalbecken mit Blick auf Schloss Neuschwanstein — der Entspannungs-Auftakt auf der Anreise","time":"14:00","itemName":"Königliche Kristall-Therme Schwangau"},{"label":"Marienbrücke","hint":"Der klassische Postkartenblick auf Neuschwanstein — kurzer Foto-Abstecher","time":"16:00","itemName":"Marienbrücke Neuschwanstein"},{"label":"Check-in und Sauna","hint":"Wellnesshotel in Oberstaufen beziehen, Bademäntel an, erstes Ankommen im Spa","time":"17:30","itemName":"Hotel Allgäu Sonne Oberstaufen"},{"label":"Welcome-Dinner","hint":"Uriger Brauereigasthof mit eigener Brauerei — deftig und gruppentauglich","time":"19:30","itemName":"Ferdls Bräustüble Sonthofen"},{"label":"Cocktail-Auftakt","hint":"Happy Hour 19 bis 21 Uhr in der Cocktailbar — der Start in den JGA-Abend","time":"21:30","itemName":"Cocktailbar Barino Sonthofen"}]},{"citySlug":"de-oberstdorf","cityLabel":"Oberstdorf · Aktiv & Feiern","lat":47.4104,"lng":10.2794,"nights":1,"planSummary":"Der große Tag: entspannter Spa-Morgen, dann eine Haupt-Aktivität nach Wahl — Canyoning und Rafting, Alpsee Coaster mit SUP oder eine Alpakawanderung. Abends ein Highlight-Dinner und Tanzen, am Sonntag ein gemütlicher Katerbrunch zum Ausklang.","plannedStops":[{"label":"Spa-Morgen","hint":"Ausschlafen, Frühstück, Sauna — wer mag, bucht eine Beauty-Behandlung für die Braut","time":"09:30","itemName":"Spa und Frühstück im Hotel"},{"label":"Haupt-Aktivität nach Wahl","hint":"Canyoning und Rafting (Mai bis Oktober), Alpsee Coaster mit SUP am Großen Alpsee oder eine Alpakawanderung","time":"12:00","itemName":"Canyoning Team Allgäu Sonthofen"},{"label":"Sekt auf der Terrasse","hint":"Zurück ins Spa, aufwärmen und ein Glas Sekt mit Bergblick","time":"16:30","itemName":"Spa-Terrasse mit Bergblick"},{"label":"Highlight-Dinner","hint":"Bib-Gourmand-Küche im Tapas-Stil — das Abend-Highlight (Reservierung nötig)","time":"19:30","itemName":"Das Fetzwerk Oberstdorf"},{"label":"Tanzen","hint":"Lebhafte Musikbar mit Live-Musik — die Feier-Adresse (Mittwoch bis Samstag)","time":"22:00","itemName":"Music Bar Mühle Oberstdorf"},{"label":"Katerbrunch am Sonntag","hint":"Traditionskonditorei mit Wochenend-Frühstücksbuffet — die sanfte Landung","time":"10:00","itemName":"Café Gerlach Oberstdorf"}]}]$$)
on conflict (slug) do nothing;

commit;
