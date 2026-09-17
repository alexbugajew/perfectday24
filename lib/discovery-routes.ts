// Manifest der redaktionellen Entdeckungspfade (Owner pd24-redaktion).
// Generiert aus data/editorial_routes/*.json. Die Hub-Seite /entdeckungsrouten
// verlinkt daraus alle Routen — interne Verlinkung fuers SEO + Browse-Einstieg.
// Neu erzeugen: node scripts/gen-discovery-manifest.mjs (bei neuen Wellen).

export type DiscoveryRoute = {
  slug: string;
  city: string;
  title: string;
  theme: string;
  teaser: string;
};

export const DISCOVERY_THEMES = [
  "Märchen & Literatur",
  "Musik",
  "Kunst im öffentlichen Raum",
  "Architektur & Jugendstil",
  "Geschichte & Zeitgeschichte",
  "Industriekultur",
  "Wissenschaft & Forschung",
  "Stadt & Altstadt",
] as const;

export const DISCOVERY_ROUTES: DiscoveryRoute[] = [
  { slug: "bergisch-gladbach-lyrikpfad", city: "Bergisch Gladbach", title: "Historischer Rundgang Bergisch Gladbach – Stadt- und Papiergeschichte", theme: "Märchen & Literatur", teaser: "Ein zu Fuß begehbarer Rundgang durch die Stadtmitte von Bergisch Gladbach und entlang der Strunde:" },
  { slug: "dresden-kaestner-pfad", city: "Dresden", title: "Erich-Kästner-Pfad Dresden (Neustadt)", theme: "Märchen & Literatur", teaser: "Ein selbst begehbarer Literaturpfad durch die Dresdner Neustadt entlang der Lebensorte von Erich Kästner — vom Erich Kästner Museum in de…" },
  { slug: "luebeck-literatur-nobelpreise", city: "Lübeck", title: "Literarischer Rundgang der Nobelpreisträger — Thomas Mann, Günter Grass und Willy Brandt in Lübeck", theme: "Märchen & Literatur", teaser: "Selbst begehbarer Altstadt-Rundgang zu den drei Lübecker Nobelpreisträgern:" },
  { slug: "marburg-grimm-dich-pfad", city: "Marburg", title: "Grimm-Dich-Pfad: Märchen-Rundgang durch Marburgs Oberstadt", theme: "Märchen & Literatur", teaser: "Auf den Spuren der Brüder Grimm durch die Marburger Oberstadt:" },
  { slug: "oldenburg-horst-janssen", city: "Oldenburg", title: "Auf den Spuren von Horst Janssen", theme: "Märchen & Literatur", teaser: "Selbst begehbarer Personen-Pfad zu den Oldenburger Lebensstationen des Zeichners und Grafikers Horst Janssen (1929–1995):" },
  { slug: "osnabrueck-remarque-spuren", city: "Osnabrück", title: "Auf Remarques Spuren durch Osnabrück", theme: "Märchen & Literatur", teaser: "Selbst begehbarer Literatur- und Personenpfad des Erich Maria Remarque-Friedenszentrums:" },
  { slug: "leipzig-notenspur", city: "Leipzig", title: "Leipziger Notenspur", theme: "Musik", teaser: "Ein rund fünf Kilometer langer Rundweg durch die Leipziger Innenstadt, der Wohn-, Wirkungs- und Aufführungsorte von Bach, Mendelssohn, Sc…" },
  { slug: "bielefeld-skulpturenpfad-sennestadt", city: "Bielefeld", title: "Skulpturenpfad Sennestadt (Nordrunde)", theme: "Kunst im öffentlichen Raum", teaser: "Selbst begehbare Nordrunde des Skulpturenpfads in Bielefeld-Sennestadt:" },
  { slug: "duisburg-brunnenmeile", city: "Duisburg", title: "Brunnenmeile Duisburg", theme: "Kunst im öffentlichen Raum", teaser: "Rund ein Kilometer langer, frei begehbarer Skulpturen- und Brunnenweg entlang der Fußgängerzone Königstraße und in die angrenzende Altstadt." },
  { slug: "frankfurt-gruenguertel-komische-kunst", city: "Frankfurt am Main", title: "Komische Kunst im GrünGürtel", theme: "Kunst im öffentlichen Raum", teaser: "Ein begehbarer Auswahl-Rundgang durch den Frankfurter Stadtwald zu den zugänglichsten Objekten der Komischen Kunst im GrünGürtel:" },
  { slug: "hagen-skulpturenrundgang", city: "Hagen", title: "Skulpturenrundgang durch Hagen (Skulpturen im öffentlichen Raum)", theme: "Kunst im öffentlichen Raum", teaser: "Selbst begehbarer Kunstpfad von rund 4 km durch Hagens Zentrum:" },
  { slug: "leverkusen-skulpturenweg", city: "Leverkusen", title: "Leverkusener Skulpturenweg – vom Rhein zum Schloss Morsbroich", theme: "Kunst im öffentlichen Raum", teaser: "Ein selbst begehbarer Themenpfad durch Kunst im öffentlichen Raum:" },
  { slug: "mannheim-skulpturenmeile", city: "Mannheim", title: "Skulpturenmeile Mannheim", theme: "Kunst im öffentlichen Raum", teaser: "Frei begehbarer Skulpturenweg entlang der Augustaanlage:" },
  { slug: "moenchengladbach-skulpturenmeile", city: "Mönchengladbach", title: "Skulpturenmeile Mönchengladbach", theme: "Kunst im öffentlichen Raum", teaser: "Rund 5,7 km langer, frei zugänglicher Skulpturen-Rundweg durch die Mönchengladbacher Innenstadt:" },
  { slug: "muenster-skulpturenpfad", city: "Münster", title: "Skulpturenpfad Münster – Dauerhafte Werke der Skulptur Projekte", theme: "Kunst im öffentlichen Raum", teaser: "Ein selbst begehbarer Rundgang zu den bekanntesten dauerhaften Kunstwerken der Skulptur Projekte Münster – von der Kirschensäule in der A…" },
  { slug: "salzgitter-skulpturenweg", city: "Salzgitter", title: "Skulpturenweg Salzgitter-Bad — Europäische Straße des Friedens", theme: "Kunst im öffentlichen Raum", teaser: "Selbst begehbarer Kunstpfad am Südrand von Salzgitter-Bad, entstanden zwischen 1999 und 2018 als deutscher Abschnitt der Europäischen Str…" },
  { slug: "wuppertal-skulpturenrundgang", city: "Wuppertal", title: "Skulpturen-Rundgang Wuppertal-Elberfeld", theme: "Kunst im öffentlichen Raum", teaser: "Ein selbst begehbarer Rundgang durch das Zentrum von Elberfeld entlang fest installierter Skulpturen im öffentlichen Raum." },
  { slug: "braunschweig-blik-wege", city: "Braunschweig", title: "Kraheweg – Auf den Spuren von Peter Joseph Krahe", theme: "Architektur & Jugendstil", teaser: "Der Kraheweg ist ein fest eingerichteter, selbst begehbarer Themenrundweg der Stadt Braunschweig rund um die historischen Wallanlagen." },
  { slug: "darmstadt-jugendstil-mathildenhoehe", city: "Darmstadt", title: "Jugendstil-Rundgang Mathildenhöhe (UNESCO-Welterbe Künstlerkolonie)", theme: "Architektur & Jugendstil", teaser: "Selbst begehbarer Rundgang durch das Jugendstil-Ensemble der Mathildenhöhe, seit 2021 UNESCO-Welterbe." },
  { slug: "wiesbaden-jugendstil-pfad", city: "Wiesbaden", title: "Jugendstil-Pfad Wiesbaden", theme: "Architektur & Jugendstil", teaser: "Der Jugendstil-Pfad verbindet vierzehn Bauwerke, Kunstwerke und Orte, an denen sich die Jugendstil- und Bäderarchitektur Wiesbadens ables…" },
  { slug: "aachen-route-charlemagne", city: "Aachen", title: "Route Charlemagne Aachen", theme: "Geschichte & Zeitgeschichte", teaser: "Die Route Charlemagne verbindet die bedeutendsten historischen Orte der Aachener Innenstadt zu einem Rundgang durch das Erbe Karls des Gr…" },
  { slug: "augsburg-welterbe-wasser", city: "Augsburg", title: "UNESCO-Welterbe Wasser-Tour: Augsburgs Altstadt und Lechviertel", theme: "Geschichte & Zeitgeschichte", teaser: "Selbst begehbarer Rundgang zu den Welterbe-Objekten des Augsburger Wassermanagement-Systems in Altstadt und Lechviertel:" },
  { slug: "berlin-mauerweg-geschichtsmeile", city: "Berlin", title: "Auf den Spuren der Berliner Mauer – zentrale Gedenkorte", theme: "Geschichte & Zeitgeschichte", teaser: "Ein begehbarer Kernrundgang zu den zentralen Gedenkorten der Berliner Mauer:" },
  { slug: "bonn-weg-der-demokratie", city: "Bonn", title: "Weg der Demokratie", theme: "Geschichte & Zeitgeschichte", teaser: "Selbst begehbarer Geschichtsrundweg durch das ehemalige Bonner Regierungsviertel:" },
  { slug: "erfurt-luthermeile", city: "Erfurt", title: "Luthers Stationen: Luthermeile durch Erfurt", theme: "Geschichte & Zeitgeschichte", teaser: "Ein zu Fuß begehbarer Altstadt-Rundgang zu den authentischen Wirkungsstätten Martin Luthers in Erfurt – vom Augustinerkloster, in das er…" },
  { slug: "heidelberg-us-amerikaner-spuren", city: "Heidelberg", title: "US-Amerikaner in Heidelberg – Spuren der deutsch-amerikanischen Geschichte", theme: "Geschichte & Zeitgeschichte", teaser: "Selbst begehbarer Themen-Rundgang zur deutsch-amerikanischen Geschichte Heidelbergs:" },
  { slug: "ingolstadt-festungsrundgang", city: "Ingolstadt", title: "Festungsrundgang Ingolstadt – Bayerische Landesfestung", theme: "Geschichte & Zeitgeschichte", teaser: "Selbst begehbarer Themenrundgang (rund 7 km) um die Ingolstädter Altstadt und über den Brückenkopf im Klenzepark:" },
  { slug: "kiel-matrosenaufstand-1918", city: "Kiel", title: "KulturSpuren-Route „Der Matrosenaufstand 1918“", theme: "Geschichte & Zeitgeschichte", teaser: "Selbst begehbarer historischer Rundgang der Stadt Kiel zu den zentralen Schauplätzen des Matrosenaufstands von 1918, dem Auftakt der Nove…" },
  { slug: "magdeburg-otto-orte", city: "Magdeburg", title: "Otto-Orte – Auf den Spuren der großen Ottos", theme: "Geschichte & Zeitgeschichte", teaser: "Begehbarer Altstadt-Rundgang durch die Ottostadt Magdeburg zu den Wirkungsstätten von Kaiser Otto dem Großen und Otto von Guericke – vom…" },
  { slug: "mainz-gutenberg-pfad", city: "Mainz", title: "Gutenberg-Pfad Mainz", theme: "Geschichte & Zeitgeschichte", teaser: "Der Gutenberg-Pfad führt in elf Stationen durch die Mainzer Altstadt zu den Lebens- und Wirkungsorten von Johannes Gutenberg, dem Erfinde…" },
  { slug: "pforzheim-goldschmiedemeile", city: "Pforzheim", title: "Goldschmiedemeile Pforzheim", theme: "Geschichte & Zeitgeschichte", teaser: "Selbst begehbarer Themen-Rundgang durch Pforzheims Erbe als Goldstadt." },
  { slug: "potsdam-geheimdienststadt", city: "Potsdam", title: "Geschichtspfad Sowjetische Geheimdienststadt „Militärstädtchen Nr. 7“", theme: "Geschichte & Zeitgeschichte", teaser: "Selbst begehbarer Geschichtspfad durch das ehemalige sowjetische Geheimdienstareal „Militärstädtchen Nr." },
  { slug: "regensburg-juedische-spuren", city: "Regensburg", title: "Jüdische Spuren in Regensburg", theme: "Geschichte & Zeitgeschichte", teaser: "Ein selbst begehbarer Erinnerungspfad durch die Regensburger Altstadt:" },
  { slug: "trier-roemerbauten", city: "Trier", title: "Römer in Trier - UNESCO-Römerbauten-Rundgang", theme: "Geschichte & Zeitgeschichte", teaser: "Ein begehbarer Rundgang durch das römische Trier:" },
  { slug: "ulm-festungsweg", city: "Ulm", title: "Festungsweg Ulm/Neu-Ulm: Rundgang durch die Bundesfestung", theme: "Geschichte & Zeitgeschichte", teaser: "Ein selbst begehbarer Rundgang entlang der erhaltenen Bauwerke der Bundesfestung Ulm/Neu-Ulm — von der Wilhelmsburg über Stadttore, Basti…" },
  { slug: "bochum-bergbauwanderweg", city: "Bochum", title: "Bergbauwanderweg Bochum-Süd (GeoPark Ruhr)", theme: "Industriekultur", teaser: "Ein selbst begehbarer, mit Schlägel und Eisen markierter Themenweg durch den Bochumer Süden rund um Stiepel." },
  { slug: "chemnitz-industriekultur", city: "Chemnitz", title: "Spaziergänger-Route Industriekultur Chemnitz", theme: "Industriekultur", teaser: "Selbst begehbarer Stadtrundgang zu elf Zeugnissen der Chemnitzer Industriekultur – von Fabrikantenvillen über Textilfabriken bis zu umgen…" },
  { slug: "duesseldorf-flingerpfad", city: "Düsseldorf", title: "FlingerPfad (Stadtteil Flingern)", theme: "Industriekultur", teaser: "Selbst begehbarer Auswahl-Rundgang über 16 dauerhaft installierte Info-Stelen des FlingerPfads zur Industrie- und Sozialgeschichte des Dü…" },
  { slug: "oberhausen-industriekultur", city: "Oberhausen", title: "Route der Industriekultur – Oberhausen: Industrie macht Stadt", theme: "Industriekultur", teaser: "Ein fußläufiger Industriekultur-Rundgang durch Oberhausen:" },
  { slug: "offenbach-industriekultur", city: "Offenbach am Main", title: "Route der Industriekultur – Lokaler Rundweg Offenbach", theme: "Industriekultur", teaser: "Selbst begehbarer Rundweg durch das Offenbacher Nordend zu zehn Zeugnissen der Leder-, Portefeuille- und Metallwarenindustrie – von der P…" },
  { slug: "goettingen-wissenschaftspfad", city: "Göttingen", title: "Weltwissen in Göttingen – auf den Spuren der Quantenphysik und der Nobelpreisträger", theme: "Wissenschaft & Forschung", teaser: "Ein rund fünf Kilometer langer Fußweg durch die Wissenschaftsgeschichte Göttingens:" },
  { slug: "jena-lichtstadt", city: "Jena", title: "Spaziergang „Lichtstadt\" Jena", theme: "Wissenschaft & Forschung", teaser: "Ein selbst begehbarer Themen-Spaziergang durch Jena entlang der Geschichte von Optik und Licht — von modernen Laserlaboren über das ältes…" },
  { slug: "bremen-nagelroute", city: "Bremen", title: "Nagelroute Bremen", theme: "Stadt & Altstadt", teaser: "Selbst begehbarer Rundgang durch die Bremer Altstadt:" },
  { slug: "bremerhaven-historische-meile", city: "Bremerhaven", title: "Historische Meile Geestemünde", theme: "Stadt & Altstadt", teaser: "Selbst begehbarer Rundgang durch den Bremerhavener Stadtteil Geestemünde:" },
  { slug: "erlangen-er1900", city: "Erlangen", title: "er1900 – Erlangens Stadtgeschichte um 1900", theme: "Stadt & Altstadt", teaser: "Der reale, selbst begehbare Rundgang »er1900« (Projekt »Erlangen sichtbar – unsichtbar«) folgt 17 ebenerdig in den Boden eingelassenen Ed…" },
  { slug: "essen-kulturpfad", city: "Essen", title: "Essener Kulturpfad", theme: "Stadt & Altstadt", teaser: "Ein rund 4 km langer, selbst begehbarer Kulturweg durch Essens Innenstadt und Südviertel:" },
  { slug: "fuerth-lauschtour", city: "Fürth", title: "Stadtspaziergang Fürth (Lauschtour)", theme: "Stadt & Altstadt", teaser: "Rund 2,7 km langer, selbst begehbarer Altstadt-Rundgang durch Fürth:" },
  { slug: "hamburg-hummel-bummel", city: "Hamburg", title: "Hummel-Bummel (Hamburger Neustadt)", theme: "Stadt & Altstadt", teaser: "Selbst begehbarer Themenrundgang entlang der roten Bodenlinie durch die Hamburger Neustadt:" },
  { slug: "hamm-stadtgeschichte-stelen", city: "Hamm", title: "Historischer Stadtrundgang Hamm (Stelen zur Stadtgeschichte)", theme: "Stadt & Altstadt", teaser: "Selbst begehbarer Rundgang durch die Innenstadt (Bezirk Mitte) entlang der fest installierten Stelen zur Stadtgeschichte, einem Gemeinsch…" },
  { slug: "hannover-roter-faden", city: "Hannover", title: "Der Rote Faden Hannover", theme: "Stadt & Altstadt", teaser: "Der Rote Faden ist ein selbstgefuehrter Altstadt-Rundgang, der auf rund 4,2 Kilometern einer roten Linie im Pflaster durch Hannovers Inne…" },
  { slug: "heilbronn-weinpanoramaweg", city: "Heilbronn", title: "Weinpanoramaweg am Wartberg", theme: "Stadt & Altstadt", teaser: "Begehbarer Themen-Rundweg über den Heilbronner Wartberg:" },
  { slug: "koblenz-rheinkulturpfad", city: "Koblenz", title: "Rheinkulturpfad Koblenz", theme: "Stadt & Altstadt", teaser: "Offizieller Themenpfad der Stadt Koblenz (seit 2006):" },
  { slug: "koeln-via-culturalis", city: "Köln", title: "Via Culturalis – Kölns Kulturachse", theme: "Stadt & Altstadt", teaser: "Begehbare Kulturachse der Kölner Innenstadt vom Kölner Dom im Norden bis zur romanischen Kirche St." },
  { slug: "moers-geschichtsstationen", city: "Moers", title: "Geschichtsstationen Moers (Moerser Rundgang)", theme: "Stadt & Altstadt", teaser: "Selbst begehbarer Rundgang durch die Moerser Altstadt:" },
  { slug: "muelheim-historischer-stadtrundgang", city: "Mülheim an der Ruhr", title: "Historischer Stadtrundgang Mülheim an der Ruhr", theme: "Stadt & Altstadt", teaser: "Selbst begehbarer historischer Stadtrundgang durch die Mülheimer Altstadt:" },
  { slug: "muenchen-kulturgeschichtspfad", city: "München", title: "Kulturgeschichtlicher Altstadt-Rundgang München", theme: "Stadt & Altstadt", teaser: "Selbst begehbarer Rundgang durch die Stadt- und Kulturgeschichte der Münchner Altstadt:" },
  { slug: "neuss-historischer-stadtrundgang", city: "Neuss", title: "Historischer Stadtrundgang Neuss", theme: "Stadt & Altstadt", teaser: "Selbst begehbarer Rundgang durch die Neusser Altstadt:" },
  { slug: "nuernberg-historische-meile", city: "Nürnberg", title: "Historische Meile Nürnberg", theme: "Stadt & Altstadt", teaser: "Die Historische Meile führt auf markierten Wegen – erkennbar am schwarzen H auf rotem Grund – vom Hauptbahnhof quer durch die Nürnberger…" },
  { slug: "paderborn-stadtrundgang", city: "Paderborn", title: "Historischer Stadtrundgang Paderborn", theme: "Stadt & Altstadt", teaser: "Selbst begehbarer Themenrundgang durch die Paderborner Altstadt (rund 3 km) entlang der wichtigsten Zeugnisse von über 1.200 Jahren Stadt…" },
  { slug: "recklinghausen-altstadtrundgang", city: "Recklinghausen", title: "Altstadtrundgang Recklinghausen zu Fuß", theme: "Stadt & Altstadt", teaser: "Ausgeschilderter, selbst begehbarer Altstadtrundgang durch die historische „gute Stube\" Recklinghausens:" },
  { slug: "siegen-historischer-stadtrundgang", city: "Siegen", title: "Historischer Stadtrundgang Siegen", theme: "Stadt & Altstadt", teaser: "Ein selbst begehbarer Rundgang durch die Siegener Oberstadt:" },
  { slug: "stuttgart-blaustruempflerweg", city: "Stuttgart", title: "Blaustrümpflerweg", theme: "Stadt & Altstadt", teaser: "Ausgeschilderter, selbst begehbarer Stäffele-, Aussichts- und Stadtgeschichts-Rundweg (rund 7,5 km) durch den Stuttgarter Süden und Westen." },
];
