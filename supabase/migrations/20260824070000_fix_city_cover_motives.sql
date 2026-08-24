-- Stadt-Cover: acht falsche Motive ersetzt
-- ============================================================================
-- Die Seeds aus 20260701160000 und 20260703100000 haben Unsplash-IDs gesetzt,
-- ohne zu pruefen, was darauf zu sehen ist — die Korrektur-Migration sagt das
-- selbst ("Motiv-Passung bitte einmal visuell checken"). Der Check ist nie
-- passiert. Tatsaechlich zeigten die Kacheln auf /explore und die Hero-Bilder
-- auf /explore/<stadt>:
--
--   Bremen      Berlin bei Nacht mit Fernsehturm
--   Dresden     ein Blockhaus im Wald
--   Duesseldorf aufgeschlagene Taschenbuecher
--   Frankfurt   Schloss Belvedere in Wien
--   Hamburg     Perito-Moreno-Gletscher in Argentinien
--   Koeln       Portraet eines Mannes
--   Leipzig     Kolosseum in Rom
--   Stuttgart   Gergeti-Kirche in Georgien
--
-- Die Alt-Texte behaupteten dabei Dinge wie "Hamburg Hafen und Speicherstadt".
-- Berlin und Muenchen waren korrekt und bleiben unberuehrt.
--
-- Ersatz kommt aus Wikimedia Commons statt Unsplash: Dort ist das Motiv aus
-- Dateiname und Beschreibung nachpruefbar, bei Unsplash ist die ID opak —
-- genau daran ist der erste Versuch gescheitert. Jedes Bild wurde einzeln
-- angesehen und auf Querformat geprueft (Kachel 168x96, Hero 1400x700).
--
-- ACHTUNG Lizenz: Alle acht stehen unter CC BY oder CC BY-SA und verlangen
-- Namensnennung. /explore/<stadt> zeigt sie ueber editorial_cover_credit
-- ("Foto: ..."), die Kachelleiste auf /explore bislang nicht — dort muss die
-- Nennung noch ergaenzt werden.

begin;

-- hamburg-hamburg: Speicherstadt Hamburg mit Wasserschloss zur blauen Stunde
update public.cities set
  editorial_cover_url    = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Hamburg%2C_Speicherstadt%2C_Wasserschloss_--_2016_--_3265-71.jpg/1280px-Hamburg%2C_Speicherstadt%2C_Wasserschloss_--_2016_--_3265-71.jpg',
  editorial_cover_alt    = 'Speicherstadt Hamburg mit Wasserschloss zur blauen Stunde',
  editorial_cover_credit = 'Dietmar Rabich / Wikimedia Commons (CC BY-SA 4.0)',
  editorial_cover_source = 'https://commons.wikimedia.org/wiki/File%3AHamburg%2C_Speicherstadt%2C_Wasserschloss_--_2016_--_3265-71.jpg'
where slug = 'hamburg-hamburg';

-- koeln: Koelner Altstadt aus der Luft mit Dom und Rhein
update public.cities set
  editorial_cover_url    = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Ballonfahrt_%C3%BCber_K%C3%B6ln_-_Deutz%2C_Rhein%2C_K%C3%B6lner_Dom%2C_Altstadt-RS-4114.jpg/1280px-Ballonfahrt_%C3%BCber_K%C3%B6ln_-_Deutz%2C_Rhein%2C_K%C3%B6lner_Dom%2C_Altstadt-RS-4114.jpg',
  editorial_cover_alt    = 'Koelner Altstadt aus der Luft mit Dom und Rhein',
  editorial_cover_credit = 'Raimond Spekking / Wikimedia Commons (CC BY-SA 4.0)',
  editorial_cover_source = 'https://commons.wikimedia.org/wiki/File%3ABallonfahrt_%C3%BCber_K%C3%B6ln_-_Deutz%2C_Rhein%2C_K%C3%B6lner_Dom%2C_Altstadt-RS-4114.jpg'
where slug = 'koeln';

-- duesseldorf: Duesseldorfer Rheinuferpromenade und Altstadt am Abend
update public.cities set
  editorial_cover_url    = 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/D%C3%BCsseldorf_%28DE%29%2C_Rheinuferpromenade_--_2023_--_0027.jpg/1280px-D%C3%BCsseldorf_%28DE%29%2C_Rheinuferpromenade_--_2023_--_0027.jpg',
  editorial_cover_alt    = 'Duesseldorfer Rheinuferpromenade und Altstadt am Abend',
  editorial_cover_credit = 'Anil Öztas / Wikimedia Commons (CC BY-SA 4.0)',
  editorial_cover_source = 'https://commons.wikimedia.org/wiki/File%3AD%C3%BCsseldorf_%28DE%29%2C_Rheinuferpromenade_--_2023_--_0027.jpg'
where slug = 'duesseldorf';

-- frankfurt-am-main: Roemerberg in Frankfurt am Abend vor der Skyline
update public.cities set
  editorial_cover_url    = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/R%C3%B6merberg_Frankfurt_abends.jpg/1280px-R%C3%B6merberg_Frankfurt_abends.jpg',
  editorial_cover_alt    = 'Roemerberg in Frankfurt am Abend vor der Skyline',
  editorial_cover_credit = 'Thomas Wolf (Der Wolf im Wald) / Wikimedia Commons (CC BY-SA 3.0)',
  editorial_cover_source = 'https://commons.wikimedia.org/wiki/File%3AR%C3%B6merberg_Frankfurt_abends.jpg'
where slug = 'frankfurt-am-main';

-- dresden: Dresdner Elbpanorama mit Frauenkirche und Hofkirche
update public.cities set
  editorial_cover_url    = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/20030816480DR_Dresden_Frauenkirche_Schlo%C3%9F_Semperoper.jpg/1280px-20030816480DR_Dresden_Frauenkirche_Schlo%C3%9F_Semperoper.jpg',
  editorial_cover_alt    = 'Dresdner Elbpanorama mit Frauenkirche und Hofkirche',
  editorial_cover_credit = 'Jörg Blobelt / Wikimedia Commons (CC BY-SA 4.0)',
  editorial_cover_source = 'https://commons.wikimedia.org/wiki/File%3A20030816480DR_Dresden_Frauenkirche_Schlo%C3%9F_Semperoper.jpg'
where slug = 'dresden';

-- bremen: Bremer Rathaus mit Roland am Marktplatz
update public.cities set
  editorial_cover_url    = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Bremen%2C_Rathaus_--_2021_--_6357.jpg/1280px-Bremen%2C_Rathaus_--_2021_--_6357.jpg',
  editorial_cover_alt    = 'Bremer Rathaus mit Roland am Marktplatz',
  editorial_cover_credit = 'Dietmar Rabich / Wikimedia Commons (CC BY-SA 4.0)',
  editorial_cover_source = 'https://commons.wikimedia.org/wiki/File%3ABremen%2C_Rathaus_--_2021_--_6357.jpg'
where slug = 'bremen';

-- leipzig: Altes Rathaus am Markt in Leipzig
update public.cities set
  editorial_cover_url    = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Leipzig_-_Markt_%2B_Altes_Rathaus_06_ies.jpg/1280px-Leipzig_-_Markt_%2B_Altes_Rathaus_06_ies.jpg',
  editorial_cover_alt    = 'Altes Rathaus am Markt in Leipzig',
  editorial_cover_credit = 'Frank Vincentz / Wikimedia Commons (CC BY-SA 3.0)',
  editorial_cover_source = 'https://commons.wikimedia.org/wiki/File%3ALeipzig_-_Markt_%2B_Altes_Rathaus_06_ies.jpg'
where slug = 'leipzig';

-- stuttgart: Stuttgarter Schlossplatz mit Neuem Schloss und Jubilaeumssaeule
update public.cities set
  editorial_cover_url    = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Neues_Schloss_Schlossplatzspringbrunnen_Jubil%C3%A4umss%C3%A4ule_Schlossplatz_Stuttgart_2015_02.jpg/1280px-Neues_Schloss_Schlossplatzspringbrunnen_Jubil%C3%A4umss%C3%A4ule_Schlossplatz_Stuttgart_2015_02.jpg',
  editorial_cover_alt    = 'Stuttgarter Schlossplatz mit Neuem Schloss und Jubilaeumssaeule',
  editorial_cover_credit = 'Julian Herzog (Website) / Wikimedia Commons (CC BY 4.0)',
  editorial_cover_source = 'https://commons.wikimedia.org/wiki/File%3ANeues_Schloss_Schlossplatzspringbrunnen_Jubil%C3%A4umss%C3%A4ule_Schlossplatz_Stuttgart_2015_02.jpg'
where slug = 'stuttgart';

commit;
