export type OfficialSourceRoadmapEntry = {
  citySlug: string;
  cityLabel: string;
  provider: string;
  baseUrl: string;
  rolloutStatus: "active" | "verified_candidate" | "domain_verified" | "research_pending";
  priority: number;
  notes: string;
};

export const OFFICIAL_SOURCE_ROADMAP: OfficialSourceRoadmapEntry[] = [
  {
    citySlug: "koeln",
    cityLabel: "Koeln",
    provider: "koeln_tourism",
    baseUrl: "https://www.koelntourismus.de/erlebnisse-lifestyle/veranstaltungen/",
    rolloutStatus: "active",
    priority: 40,
    notes: "KoelnTourismus Event-Hub als naechster Kandidat fuer Stadt- und Kulturtermine.",
  },
  {
    citySlug: "frankfurt-am-main",
    cityLabel: "Frankfurt am Main",
    provider: "frankfurt_tourism",
    baseUrl: "https://www.visitfrankfurt.travel/erleben/veranstaltungskalender",
    rolloutStatus: "active",
    priority: 41,
    notes: "visitFrankfurt Veranstaltungskalender als offizieller Kultur- und Event-Einstieg.",
  },
  {
    citySlug: "stuttgart",
    cityLabel: "Stuttgart",
    provider: "stuttgart_tourism",
    baseUrl: "https://www.stuttgart-tourist.de/",
    rolloutStatus: "active",
    priority: 42,
    notes:
      "Stuttgart-Tourist Event-Highlights von der offiziellen Startseite mit Detail-Links fuer Shows, Festivals und aktuelle Stadttermine.",
  },
  {
    citySlug: "duesseldorf",
    cityLabel: "Duesseldorf",
    provider: "duesseldorf_tourism",
    baseUrl: "https://www.visitduesseldorf.de/en/experience/events",
    rolloutStatus: "active",
    priority: 43,
    notes: "visitDuesseldorf Eventbereich mit offiziellen Kalender-Detailseiten fuer Stadttermine und saisonale Highlights.",
  },
  {
    citySlug: "leipzig",
    cityLabel: "Leipzig",
    provider: "leipzig_travel",
    baseUrl: "https://www.leipzig.travel/en/discover/events-in-Leipzig",
    rolloutStatus: "active",
    priority: 44,
    notes: "Leipzig Travel Event-Hub mit vorgerenderten Karten und offiziellen Detailseiten fuer Tourismus- und Kulturtermine.",
  },
  {
    citySlug: "dresden",
    cityLabel: "Dresden",
    provider: "dresden_tourism",
    baseUrl: "https://www.dresden.de/en/tourism/attractions/events.php",
    rolloutStatus: "active",
    priority: 45,
    notes: "Dresden offizieller Eventkalender fuer Stadt- und Kulturtermine.",
  },
  {
    citySlug: "hannover",
    cityLabel: "Hannover",
    provider: "hannover_tourism",
    baseUrl: "https://www.hannover.de/Veranstaltungskalender",
    rolloutStatus: "active",
    priority: 46,
    notes: "Hannover.de Veranstaltungskalender mit Markt-, Konzert- und Buehnen-Detailseiten.",
  },
  {
    citySlug: "nuernberg",
    cityLabel: "Nuernberg",
    provider: "nuernberg_tourism",
    baseUrl: "https://tourismus.nuernberg.de/erleben/events/",
    rolloutStatus: "active",
    priority: 47,
    notes: "Tourismus Nuernberg Events mit kuratierten Markt- und Jahreshighlight-Seiten.",
  },
  {
    citySlug: "bremen",
    cityLabel: "Bremen",
    provider: "bremen_tourism",
    baseUrl: "https://www.bremen.de/veranstaltungen",
    rolloutStatus: "active",
    priority: 48,
    notes:
      "Offizieller Bremen-Bootstrap aus verifizierten Bremen.de-Highlightseiten; dynamischer Scraper folgt spaeter, sobald der Cloudflare-Pfad stabil angebunden ist.",
  },
  {
    citySlug: "dortmund",
    cityLabel: "Dortmund",
    provider: "dortmund_tourism",
    baseUrl: "https://www.dortmund.de/dortmund-erleben/events-und-highlights/",
    rolloutStatus: "active",
    priority: 49,
    notes:
      "Offizieller Dortmund.de-Highlightpfad mit strukturierten Event-Detailseiten aus dem Veranstaltungskalender fuer Shows, Festivals und Stadttermine.",
  },
  {
    citySlug: "mannheim",
    cityLabel: "Mannheim",
    provider: "mannheim_tourism",
    baseUrl: "https://www.visit-mannheim.de/en/",
    rolloutStatus: "active",
    priority: 60,
    notes:
      "Wave-1-Quelle ist live: offizieller Mannheim.de-Veranstaltungskalender via RSS plus kategorisierte Event-Listings.",
  },
  {
    citySlug: "wiesbaden",
    cityLabel: "Wiesbaden",
    provider: "wiesbaden_tourism",
    baseUrl: "https://www.wiesbaden.de/leben-in-wiesbaden/freizeit/veranstaltungskalender/veranstaltungssuche.php",
    rolloutStatus: "active",
    priority: 61,
    notes:
      "Wave-1-Quelle ist live: offizieller Wiesbaden-Kalender ueber die GraphQL-gestuetzte Veranstaltungssuche auf wiesbaden.de.",
  },
  {
    citySlug: "essen",
    cityLabel: "Essen",
    provider: "visit_essen",
    baseUrl: "https://pages.visitessen.de/de/visitessen/streaming/search/Event",
    rolloutStatus: "active",
    priority: 62,
    notes:
      "Wave-1-Quelle ist live: offizieller Visit-Essen-Finder ueber den dokumentierten ET4 search-Endpunkt mit recurrierenden Occurrences fuer Show-, Besuchs- und Marktlogik.",
  },
  {
    citySlug: "bonn",
    cityLabel: "Bonn",
    provider: "bonn_city",
    baseUrl: "https://www.bonn.de/bonn-erleben/ausgehen-und-erleben/veranstaltungskalender.php",
    rolloutStatus: "active",
    priority: 63,
    notes:
      "Wave-1-Quelle ist live: offizieller Bonn.de-Veranstaltungskalender mit breiter Kultur-, Besuchs- und Marktbasis.",
  },
  {
    citySlug: "karlsruhe",
    cityLabel: "Karlsruhe",
    provider: "karlsruhe_tourism",
    baseUrl: "https://www.karlsruhe-erleben.de/veranstaltungen/kalender",
    rolloutStatus: "active",
    priority: 64,
    notes:
      "Wave-1-Quelle ist live: offizieller Karlsruhe-Erleben-Kalender ueber die eingebettete toubiz-API mit Date-Filtern und Exclude-Tag aus dem Widget; plannerseitig fuer show, event_visit und market_festival tragfaehig.",
  },
  {
    citySlug: "muenster",
    cityLabel: "Muenster",
    provider: "muenster_tourism",
    baseUrl: "https://www.stadt-muenster.de/tourismus/veranstaltungen/veranstaltungskalender",
    rolloutStatus: "active",
    priority: 65,
    notes:
      "Wave-1-Quelle ist live: offizieller touristischer Veranstaltungskalender der Stadt Muenster ueber Session-gestuetzte Suche, Ergebnislisten und Detailseiten mit guestID=101. Show, event_visit und market_festival sind plannerseitig verifiziert.",
  },
  {
    citySlug: "aachen",
    cityLabel: "Aachen",
    provider: "aachen_city",
    baseUrl: "https://www.aachen.de/services/veranstaltungskalender/",
    rolloutStatus: "active",
    priority: 66,
    notes:
      "Wave-1-Quelle ist live: offizieller Aachen.de-Kalender ueber events.json plus offizielle places.json-Venue-Daten. Show, event_visit und market_festival sind plannerseitig verifiziert, damit ist Wave 1 vollstaendig.",
  },
  {
    citySlug: "augsburg",
    cityLabel: "Augsburg",
    provider: "augsburg_city",
    baseUrl: "https://www.augsburg.de/veranstaltungen",
    rolloutStatus: "active",
    priority: 70,
    notes:
      "Wave-2-Quelle ist live: offizieller Augsburg.de-Kalender ueber die API event_occurrences; Show, Event-Visit und Marktlogik tragen bereits im Planner.",
  },
  {
    citySlug: "kiel",
    cityLabel: "Kiel",
    provider: "kiel_sailing_city",
    baseUrl: "https://kiel-sailing-city.de/veranstaltungen",
    rolloutStatus: "active",
    priority: 71,
    notes:
      "Wave-2-Quelle ist live: offizieller Kiel-Sailing-City-Kalender ueber ET4 search plus offiziellen Enhance-Pfad fuer Detailseiten. Show, event_visit und market_festival sind plannerseitig verifiziert; event_visit ist semantisch noch etwas community-lastiger als die staerksten Kernstaedte.",
  },
  {
    citySlug: "bielefeld",
    cityLabel: "Bielefeld",
    provider: "bielefeld_jetzt",
    baseUrl: "https://www.bielefeld.jetzt/termine",
    rolloutStatus: "active",
    priority: 72,
    notes:
      "Wave-2-Quelle ist live: offizieller Bielefeld.JETZT-Kalender ueber serverseitige Tageslisten unter /termine/datum/YYYY-MM-DD plus Detailseiten mit Terminblock, Kontaktinfos und Kartenmittelpunkt. Show, event_visit und market_festival sind plannerseitig verifiziert.",
  },
  {
    citySlug: "braunschweig",
    cityLabel: "Braunschweig",
    provider: "braunschweig_region",
    baseUrl: "https://braunschweig.die-region.de/seiten/suche",
    rolloutStatus: "active",
    priority: 73,
    notes:
      "Wave-2-Quelle ist live: offizieller Braunschweig-Kalender ueber braunschweig.die-region.de mit Listing-Formular, Partial-JSON fuer Load-More und offiziellen Detailseiten. Show und event_visit tragen bereits sauber; market_festival ist funktional da, semantisch aber noch etwas weich.",
  },
  {
    citySlug: "bochum",
    cityLabel: "Bochum",
    provider: "bochum_tourism",
    baseUrl: "https://www.bochum-tourismus.de/was-ist-los/veranstaltungskalender.html",
    rolloutStatus: "active",
    priority: 74,
    notes:
      "Wave-2-Quelle ist live: offizieller Bochum-Tourismus-Kalender ueber servergerenderte Eventkarten plus Detailseiten unter /was-ist-los/veranstaltungskalender/veranstaltung/*.html. Show, event_visit und market_festival sind plannerseitig verifiziert; Geo fehlt bei Teilen des Feeds noch.",
  },
  {
    citySlug: "duisburg",
    cityLabel: "Duisburg",
    provider: "duisburg_live",
    baseUrl: "https://www.duisburglive.de/alle-events/",
    rolloutStatus: "active",
    priority: 75,
    notes:
      "Wave-2-Quelle ist live: offizieller Stadtpfad ueber Duisburg Live und den JSON-Feed /api/events/ mit Kategorien, Venue, Zeiten, Ticket-URL und haeufigen Geo-Daten. Show, event_visit und market_festival sind plannerseitig verifiziert.",
  },
  {
    citySlug: "wuppertal",
    cityLabel: "Wuppertal",
    provider: "wuppertal_live",
    baseUrl: "https://www.wuppertal-live.de/intro/disp=1;titel=1;cal=wuppertal",
    rolloutStatus: "active",
    priority: 76,
    notes:
      "Wave-2-Quelle ist live: offizieller Wuppertal-Live-Pfad ueber intro/events/detail mit Wuppertal-only calendar. Show, event_visit und market_festival sind plannerseitig verifiziert; damit ist Wave 2 vollstaendig.",
  },
  {
    citySlug: "freiburg-im-breisgau",
    cityLabel: "Freiburg im Breisgau",
    provider: "freiburg_eventportal",
    baseUrl: "https://veranstaltungen.freiburg.de/freiburg/events",
    rolloutStatus: "active",
    priority: 80,
    notes:
      "Wave-3-Quelle ist live: offizielles Freiburg-Eventportal ueber den FWTM/imxplatform-GraphQL-Pfad mit paginierten Event-Knoten, Venue-/Geo-Daten und Occurrences aus eventDates. Ingest sowie show, event_visit und market_festival sind plannerseitig verifiziert.",
  },
  {
    citySlug: "luebeck",
    cityLabel: "Luebeck",
    provider: "luebeck_tourism",
    baseUrl: "https://www.luebeck-tourismus.de/veranstaltungen",
    rolloutStatus: "active",
    priority: 81,
    notes:
      "Wave-3-Quelle ist live: offizieller Luebeck-Tourismuskalender ueber den Datacycle-Endpoint der Veranstaltungsseite plus Detailseiten mit vollstaendigem JSON-LD fuer Venue, Geo und eventSchedule-Occurrences. Ingest sowie show, event_visit und market_festival sind plannerseitig verifiziert.",
  },
  {
    citySlug: "erfurt",
    cityLabel: "Erfurt",
    provider: "erfurt_tourism",
    baseUrl: "https://www.erfurt-tourismus.de/veranstaltungskalender",
    rolloutStatus: "active",
    priority: 82,
    notes:
      "Wave-3-Quelle ist live: offizieller TYPO3-Kalender von Stadt und Erfurt Tourismus ueber paginierte Listenseiten plus Detailseiten mit JSON-LD. Pagination, concrete_event_page-Subtypes und Planner-Anchor sind nachgezogen; Ingest sowie show, event_visit und market_festival sind plannerseitig verifiziert.",
  },
  {
    citySlug: "magdeburg",
    cityLabel: "Magdeburg",
    provider: "magdeburg_city",
    baseUrl: "https://www.magdeburg.de/veranstaltungen",
    rolloutStatus: "active",
    priority: 83,
    notes:
      "Wave-3-Quelle ist live: offizieller Veranstaltungsexport der Landeshauptstadt Magdeburg ueber RSS plus konkrete Event-Detailseiten. Ingest sowie show, event_visit und market_festival sind plannerseitig verifiziert; semantisch bleibt der Feed etwas civic-lastiger als Freiburg/Luebeck.",
  },
  {
    citySlug: "moenchengladbach",
    cityLabel: "Moenchengladbach",
    provider: "moenchengladbach_city",
    baseUrl: "https://www.moenchengladbach.de/de/aktuell-aktiv/veranstaltungskalender",
    rolloutStatus: "active",
    priority: 84,
    notes:
      "Wave-3-Kandidat: offizieller Veranstaltungskalender der Stadt Mönchengladbach. Nach Food-Backfill ist die Location-Basis jetzt stark genug; naechster Schritt ist der offizielle Eventpfad.",
  },
  {
    citySlug: "gelsenkirchen",
    cityLabel: "Gelsenkirchen",
    provider: "gelsenkirchen_city",
    baseUrl: "https://www.gelsenkirchen.de/de/_meta/veranstaltungskalender/",
    rolloutStatus: "active",
    priority: 85,
    notes:
      "Wave-3-Quelle ist live: offizieller Gelsenkirchen-Kalender ueber Listing-Seiten, stabile Detailseiten und ICS-Downloads. Ingest sowie show, event_visit und market_festival sind plannerseitig verifiziert.",
  },
];
