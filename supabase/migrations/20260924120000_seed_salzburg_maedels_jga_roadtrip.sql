-- Seed: Salzburg Mädels-JGA — Stadt-JGA-Roadtrip (2 Nächte / 3 Tage)
-- Kuratierter Junggesellinnenabschied in Salzburg: Altstadt & Mozart, Salzwelten-
-- Bergwerk, Rooftop-Dinner und eine Nacht zum Tanzen — elegant statt Ballermann.
-- Zwei Etappen-Stops (Altstadt/Ankommen, Berg & Nightlife) mit planSummary +
-- plannedStops (echte Orte mit Zeiten). citySlug ist display-only (keine cities-FK).
-- Idempotent via on conflict (slug) do nothing.

begin;

insert into public.roadtrip_routes
  (slug,title,description,cover_image_url,author_user_id,author_name,visibility,status,is_featured,tags,total_nights,country_codes,occasion,budget,stops)
values
('salzburg-maedels-jga',
 'Salzburg Mädels-JGA — Mozart, Rooftops und ein bisschen Tanzen',
 'Ein eleganter Junggesellinnenabschied in Salzburg: Altstadt-Rundgang durch Mozarts Stadt, das Salzwelten-Bergwerk am Dürrnberg, Rooftop-Dinner mit Festungsblick und eine Nacht zum Tanzen — zwei Nächte, drei Tage, genussvoll statt Ballermann.',
 null,null,'PD24 Redaktion','public','completed',true,
 array['jga','nightlife','culture','europe','weekend'],
 2,array['AT'],'friends','high',
 $$[{"citySlug":"at-salzburg-altstadt","cityLabel":"Salzburg · Altstadt & Ankommen","lat":47.8006,"lng":13.0432,"nights":1,"planSummary":"Elegant ankommen: Check-in im arte Hotel, Willkommenssekt auf der Rooftop-Bar mit Festungsblick, ein feines Dinner in der Blauen Gans (ältestes Gasthaus der Stadt) und ein Absacker in der Sacher Bar an der Salzach.","plannedStops":[{"label":"Check-in arte Hotel","hint":"Zentrale Designer-Basis am Hauptbahnhof, ~15 Min zu Fuß in die Altstadt","time":"15:00","itemName":"arte Hotel Salzburg"},{"label":"Willkommensdrink auf der Rooftop-Bar","hint":"Erster Sekt mit 360-Grad-Blick auf Altstadt und Festung","time":"17:00","itemName":"arte Hotel Rooftop-Bar"},{"label":"Elegantes Dinner: Blaue Gans","hint":"Ältestes Gasthaus der Stadt, Gault-Millau — Sonntag Ruhetag, daher am Freitag","time":"19:00","itemName":"Restaurant Blaue Gans"},{"label":"Absacker in der Sacher Bar","hint":"Eleganter Drink an der Salzach mit Blick zur Altstadt","time":"21:30","itemName":"Sacher Bar Salzburg"}]},{"citySlug":"at-salzburg-neustadt","cityLabel":"Salzburg · Berg, Genuss & Nightlife","lat":47.7952,"lng":13.0487,"nights":1,"planSummary":"Der große Tag: Altstadt-Rundgang durch Mozarts Stadt, das Salzwelten-Bergwerk am Dürrnberg (Rutschen und Gruppenfoto in Montur), Rooftop-Dinner in der IMLAUER Sky Bar und Tanzen im Club Half Moon. Am Sonntag Brunch und ein letztes Panorama vor der Heimreise.","plannedStops":[{"label":"Altstadt-Rundgang: Mozart & Altstadt","hint":"Geführt durch UNESCO-Altstadt, Dom, Getreidegasse und Mirabellgarten — als Privatführung","time":"09:30","itemName":"Salzburg Altstadt-Rundgang"},{"label":"Salzwelten am Dürrnberg","hint":"Ältestes Schaubergwerk der Welt (~30 Min), Führung in Montur mit Rutschen und Salzsee","time":"15:00","itemName":"Salzwelten Salzburg Dürrnberg"},{"label":"Rooftop-Dinner: IMLAUER Sky Bar","hint":"Panorama über Altstadt und Festung, nur 2 Min vom Hotel","time":"19:30","itemName":"IMLAUER Sky Bar & Restaurant"},{"label":"Tanzen im Club Half Moon","hint":"Ältester Club der Stadt im 600 Jahre alten Gewölbe (nur Fr/Sa)","time":"22:30","itemName":"Club Half Moon Salzburg"},{"label":"Sonntag: Brunch","hint":"Legendäres Café Bazar mit Salzach-Terrasse oder Café Fingerlos beim Hotel","time":"09:30","itemName":"Café Bazar Salzburg"},{"label":"Finale: Festung & Mirabellgarten","hint":"Panorama und Do-Re-Mi-Treppe zum Abschluss vor der Heimreise","time":"11:00","itemName":"Festung Hohensalzburg"}]}]$$)
on conflict (slug) do nothing;

commit;
