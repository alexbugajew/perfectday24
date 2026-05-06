# Offizielle Eventquellen fuer die neuen Staedte

## Ziel

Die Top-10-Rollout-Staedte sollen nicht nur ueber OSM-Locations laufen, sondern stadtweise eine offizielle Eventbasis bekommen. Dabei trennen wir bewusst:

- `active`: offizielle Quelle ist live, ingestbar und bereits im Planner nutzbar
- `verified_candidate`: offizieller Kalenderpfad ist bereits als guter Einstieg verifiziert
- `domain_verified`: offizielle Domain und Event-Detailstruktur sind klar, der beste Listing-Pfad wird noch finalisiert
- `research_pending`: offizieller Einstieg ist klar, der konkrete crawlbare Eventpfad ist noch offen

## Priorisierte Stadtquellen

| Stadt | Provider | Status | Basis-URL | Hinweis |
| --- | --- | --- | --- | --- |
| Koeln | `koeln_tourism` | `active` | `https://www.koelntourismus.de/erlebnisse-lifestyle/veranstaltungen/` | offizieller Event-Hub fuer Kultur und Stadttermine |
| Frankfurt am Main | `frankfurt_tourism` | `active` | `https://www.visitfrankfurt.travel/erleben/veranstaltungskalender` | offizieller Veranstaltungskalender |
| Stuttgart | `stuttgart_tourism` | `active` | `https://www.stuttgart-tourist.de/` | offizielle Event-Highlights von der Stuttgart-Tourist-Startseite mit Detail-Links |
| Duesseldorf | `duesseldorf_tourism` | `active` | `https://www.visitduesseldorf.de/en/experience/events` | offizieller Eventbereich mit crawlbaren Kalender-Detailseiten |
| Leipzig | `leipzig_travel` | `active` | `https://www.leipzig.travel/en/discover/events-in-Leipzig` | offizieller Travel-Event-Hub mit vorgerenderten Eventkarten |
| Dresden | `dresden_tourism` | `active` | `https://www.dresden.de/en/tourism/attractions/events.php` | offizieller Tourismuseinstieg, der auf den strukturierten Dresden-Elbland-Kalender verweist |
| Hannover | `hannover_tourism` | `active` | `https://www.hannover.de/Veranstaltungskalender` | offizieller Hannover.de-Veranstaltungskalender mit Kategorie- und Detailseiten |
| Nuernberg | `nuernberg_tourism` | `active` | `https://tourismus.nuernberg.de/erleben/events/` | offizieller Event-Hub mit kuratierten Markt- und Jahreshighlight-Seiten |
| Bremen | `bremen_tourism` | `active` | `https://www.bremen.de/veranstaltungen` | offizieller Bremen-Bootstrap aus verifizierten Highlightseiten; dynamischer Scraper folgt spaeter |
| Dortmund | `dortmund_tourism` | `active` | `https://www.dortmund.de/dortmund-erleben/events-und-highlights/` | offizieller Dortmund.de-Highlightpfad mit strukturierten Kalender-Detailseiten |

## Rollout-Reihenfolge

Alle sichtbaren Planner-Staedte haben jetzt eine offizielle Eventquelle.

## Wave-1-Priorisierung

Nach dem Wave-1-Location-Import sind diese sieben Staedte die naechsten Kandidaten fuer offizielle Eventquellen.

| Prioritaet | Stadt | Provider | Status | Basis-URL | Warum jetzt |
| ---: | --- | --- | --- | --- | --- |
| 1 | Mannheim | `mannheim_tourism` | `active` | `https://www.visit-mannheim.de/en/` | Wave-1-Quelle ist live und bereits plannerseitig nutzbar |
| 2 | Wiesbaden | `wiesbaden_tourism` | `active` | `https://www.wiesbaden.de/leben-in-wiesbaden/freizeit/veranstaltungskalender/veranstaltungssuche.php` | Wave-1-Quelle ist live ueber die GraphQL-gestuetzte Eventsuche |
| 3 | Bonn | `bonn_city` | `active` | `https://www.bonn.de/bonn-erleben/ausgehen-und-erleben/veranstaltungskalender.php` | offizieller Bonn.de-Kalender ist live und plannerseitig nutzbar |
| 4 | Essen | `visit_essen` | `active` | `https://pages.visitessen.de/de/visitessen/streaming/search/Event` | offizieller Visit-Essen-Finder ist live und plannerseitig bereits tragfaehig |
| 5 | Karlsruhe | `karlsruhe_tourism` | `active` | `https://www.karlsruhe-erleben.de/veranstaltungen/kalender` | offizieller Karlsruhe-Erleben-Kalender ist live und plannerseitig fuer Show-, Besuchs- und Marktlogik tragfaehig |
| 6 | Muenster | `muenster_tourism` | `active` | `https://www.stadt-muenster.de/tourismus/veranstaltungen/veranstaltungskalender` | offizieller touristischer Veranstaltungskalender ist live und plannerseitig fuer Show-, Besuchs- und Marktlogik verifiziert |
| 7 | Aachen | `aachen_city` | `active` | `https://www.aachen.de/services/veranstaltungskalender/` | offizieller Aachen.de-Kalender ist live ueber `events.json` plus `places.json` und traegt Show-, Besuchs- und Marktlogik fuer den Planner |

### Empfohlene Parser-Reihenfolge fuer Wave 1

1. Mannheim
2. Wiesbaden
3. Bonn
4. Essen
5. Karlsruhe
6. Muenster
7. Aachen

### Warum genau diese Reihenfolge

- Mannheim, Wiesbaden, Bonn und Essen sind jetzt live und bilden das starke Wave-1-Fundament fuer sichtbare Freigaben
- Karlsruhe ist jetzt ebenfalls live und hebt Wave 1 auf fuenf sichtbarkeitsreife Staedte
- Muenster ist jetzt live und hebt Wave 1 auf sechs sichtbarkeitsreife Staedte
- Aachen ist jetzt live und schliesst Wave 1 mit sieben sichtbarkeitsreifen Staedten vollstaendig ab

## Wave-2-Priorisierung

Wave 2 wird erst nach dem Location-Import parserseitig angegangen. Die empfohlene Reihenfolge ist:

1. Augsburg
2. Kiel
3. Bielefeld
4. Braunschweig
5. Bochum
6. Duisburg
7. Wuppertal

Warum diese Reihenfolge:

- Augsburg und Kiel sind gute Kandidaten fuer einen fruehen offiziellen Stadt-/Tourismuspfad mit klarerem Einstieg
- Bielefeld und Braunschweig folgen als mittelgrosse Staedte mit guter Chance auf saubere offizielle Kalender
- Bochum und Duisburg sind inhaltlich attraktiv, sitzen aber oft in raueren Ruhrgebietspfaden mit mehr civic- und Aggregatorrauschen
- Wuppertal kommt bewusst spaeter, weil die Stadtstruktur und Eventverteilung oft weniger zentral aus einem einzigen Kernkalender tragen

Aktueller Stand in Wave 2:

- Augsburg ist jetzt als erste offizielle Wave-2-Quelle live
- der offizielle Pfad laeuft ueber `https://api.augsburg-api.de/api/v2/calendar/event_occurrences/`
- Augsburg traegt bereits `show`, `event_visit` und `market_festival` im Planner
- Kiel ist jetzt als zweite offizielle Wave-2-Quelle live
- der offizielle Pfad laeuft ueber `https://meta.et4.de/rest.ashx/search/` mit `experience=kiel-sailing-city` plus `https://kiel-sailing-city.de/api/events/enhance` fuer die offiziellen Detailseiten
- Kiel traegt `show`, `event_visit` und `market_festival` bereits im Planner
- Bielefeld ist jetzt als dritte offizielle Wave-2-Quelle live
- der offizielle Pfad laeuft ueber `https://www.bielefeld.jetzt/termine/datum/YYYY-MM-DD` plus die offiziellen Detailseiten unter `/node/...`
- Bielefeld traegt `show`, `event_visit` und `market_festival` bereits im Planner
- Braunschweig ist jetzt als vierte offizielle Wave-2-Quelle live
- der offizielle Pfad laeuft ueber `https://braunschweig.die-region.de/seiten/suche` plus die offiziellen Detailseiten unter `/veranstaltungen-detailseite/event/...`
- die effiziente Listing-Erweiterung kommt ueber den offiziellen Partial-JSON-Pfad `type=672342022`
- Braunschweig traegt `show` und `event_visit` bereits sauber im Planner; `market_festival` ist funktional da, semantisch aber noch etwas weich
- Bochum ist jetzt als fuenfte offizielle Wave-2-Quelle live
- der offizielle Pfad laeuft ueber `https://www.bochum-tourismus.de/was-ist-los/veranstaltungskalender.html` plus die offiziellen Detailseiten unter `/was-ist-los/veranstaltungskalender/veranstaltung/*.html`
- der Provider nutzt die servergerenderten `poi-list-item event-list-item`-Karten und zieht Termine, Website-/Ticket-Buttons sowie Venue-/Adress-Fallbacks aus den Detailseiten
- Bochum traegt `show`, `event_visit` und `market_festival` bereits im Planner
- Duisburg ist jetzt als sechste offizielle Wave-2-Quelle live
- der offizielle Stadtpfad laeuft ueber `https://www.duisburglive.de/alle-events/` und nutzt direkt den offiziellen JSON-Feed `https://www.duisburglive.de/api/events/`
- der Feed liefert bereits Kategorien, Venue, Zeiten, Ticket-URL und haeufig auch Geo, dadurch brauchen wir fuer den ersten Wurf kein zusaetzliches HTML-Detail-Scraping
- Duisburg traegt `show`, `event_visit` und `market_festival` bereits im Planner
- Wuppertal ist jetzt als letzte offizielle Wave-2-Quelle live
- der offizielle Pfad laeuft ueber `https://www.wuppertal-live.de/intro/disp=1;titel=1;cal=wuppertal` plus die AJAX-Endpunkte `/events/...what=date...` und `/events/...what=detail...`
- der Provider zieht Wuppertal-only-Tageslisten, canonical Eventseiten, Venue-/Adressdaten, haeufig Geo aus dem Kartenkommentar und Preisblöcke aus den Detailseiten
- Wuppertal traegt `show`, `event_visit` und `market_festival` bereits im Planner
- Wave 2 steht damit jetzt bei `7/7 visibility-ready`

## Wave-3-Priorisierung

Wave 3 ist jetzt location-seitig vorbereitet. Nach dem Import und dem Mönchengladbach-Food-Backfill stehen alle 6 Staedte mit belastbarer Location-/Food-Basis da; offen sind nur noch `events` und `official-source`.

Empfohlene Reihenfolge fuer den naechsten Parser-Block:

1. Freiburg im Breisgau
2. Luebeck
3. Erfurt
4. Magdeburg
5. Moenchengladbach
6. Gelsenkirchen

Warum genau diese Reihenfolge:

- Freiburg und Luebeck wirken tourismus- und detailseiten-seitig aktuell wie die saubersten fruehen Kandidaten
- Erfurt hat mit dem gemeinsamen Stadt-/Tourismuskalender einen gebuendelten offiziellen Einstieg
- Magdeburg verspricht breite Eventabdeckung, wirkt aber schon im offiziellen Stadtpfad etwas civic-lastiger
- Moenchengladbach ist jetzt live ueber den offiziellen `?type=420`-Feed angebunden und traegt plannerseitig fuer `show`, `event_visit` und `market_festival`
- Gelsenkirchen ist jetzt live ueber den offiziellen Kalender plus ICS-Export und schliesst Wave 3 damit vollstaendig

Aktueller Wave-3-Stand:

- Gelsenkirchen: `635` Locations, `279` Food
- Moenchengladbach: `578` Locations, `219` Food
- Gelsenkirchen ist jetzt als sechste offizielle Wave-3-Quelle live ueber `gelsenkirchen.de/de/_meta/veranstaltungskalender` plus Detailseiten und ICS-Downloads
- der offizielle Ingest lief mit `138 raw / 93 normalisiert`
- `show` traegt am `26. April 2026` sauber mit `Hammer + 3 – Improvisierte Musik`
- `event_visit` ist gruen und anchored aktuell am `24. April 2026` auf `Tag der IGA`
- `market_festival` traegt am `25. April 2026` mit `Kleidermarkt im Elisabeth Käsemann FamilienNetzwerk`
- Moenchengladbach ist jetzt als fuenfte offizielle Wave-3-Quelle live ueber den offiziellen `?type=420`-Feed der Stadt
- der offizielle Ingest lief mit `757 raw / 757 normalisiert`
- `show` traegt am `25. April 2026` sauber mit `Sinfoniekonzert`
- `event_visit` ist ebenfalls gruen und anchored aktuell auf `Konzert | Vermillion Blue`
- `market_festival` traegt am `25. April 2026` mit `Auktion | Leihhaus Bodenhagen`
- Magdeburg: `458` Locations, `266` Food
- Magdeburg ist jetzt als vierte offizielle Wave-3-Quelle live ueber den offiziellen RSS-Export `Veranstaltungsexport.xml` plus konkrete Event-Detailseiten
- der offizielle Ingest lief mit `64 raw / 64 normalisiert`
- `show` traegt am `25. April 2026` sauber mit `Sternenstaub`
- `event_visit` ist funktional gruen und anchored aktuell ebenfalls auf `Sternenstaub`
- `market_festival` traegt am `26. April 2026` mit `Thiemmarkt`
- Freiburg im Breisgau: `621` Locations, `280` Food
- Freiburg ist jetzt als erste offizielle Wave-3-Quelle live ueber den offiziellen FWTM/imxplatform-GraphQL-Pfad mit Event-Knoten, Venue-/Geo-Daten und Occurrences aus `eventDates`
- Freiburg traegt `show`, `event_visit` und `market_festival` bereits im Planner
- Luebeck: `487` Locations, `256` Food
- Luebeck ist jetzt als zweite offizielle Wave-3-Quelle live
- der offizielle Pfad laeuft ueber den Datacycle-Endpoint der Veranstaltungsseite plus Detailseiten unter `/event/<slug>` mit vollstaendigem JSON-LD fuer Venue, Geo und `eventSchedule`
- Luebeck traegt `show`, `event_visit` und `market_festival` bereits im Planner
- Erfurt: `468` Locations, `253` Food
- Erfurt ist jetzt als dritte offizielle Wave-3-Quelle live ueber den offiziellen TYPO3-Kalender von Stadt und Erfurt Tourismus
- der aktuelle Re-Ingest lief mit `168 raw / 168 normalisiert`
- `market_festival` traegt bereits sauber mit `Hartwarenmarkt`
- `event_visit` ist funktional grün, derzeit aber noch food-event-lastig
- `event_visit` und `show` sind jetzt plannerseitig ebenfalls sauber verifiziert, z. B. am `8. Mai 2026` mit `Manfred Mann's Earth Band`
- `4/6 visibility-ready`

Der aktuelle Scope-Report ist:

- [planner-rollout-wave3-audit-2026-04-23T23-02-21-204Z.md](C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/reports/planner-rollout-wave3-audit-2026-04-23T23-02-21-204Z.md)

Vor dem ersten Wave-3-Parser gilt:

1. Location-Basis importieren
2. Scope-Audit laufen lassen
3. echte City-Zentren und Food-Coverage pruefen
4. erst danach die offizielle Eventquelle je Stadt final festlegen

## Warum diese Reihenfolge

- Hannover, Nuernberg, Bremen, Stuttgart und Dortmund sind jetzt live und decken die sichtbaren Planner-Staedte vollstaendig ab
- fuer Bremen nutzen wir vorerst einen offiziellen Bootstrap aus verifizierten Bremen.de-Highlightseiten, weil Bremen.de automatisierte HTML-Fetches aktuell per Cloudflare blockiert
- Stuttgart ist jetzt live ueber die offizielle Stuttgart-Tourist-Highlight-Schiene
- damit ist die sichtbare Planner-Staedtebasis eventseitig geschlossen

## Technische Vorbereitung

- Typed Roadmap: [source-roadmap.ts](C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/lib/events/official/source-roadmap.ts)
- Inaktive Source-Configs per Migration
- Parser bleiben vorerst aus, bis jede Stadt einzeln freigegeben wird

## Naechster Parser-Block

Fuer jede Stadt:

1. offiziellen Listing-/Kalenderpfad final verifizieren
2. ersten Parser bauen
3. Live-Ingest fuer die Stadt fahren
4. `check:quality` und Planner-Livecheck gegen dieselbe Stadt laufen lassen
5. erst dann `is_active = true`
