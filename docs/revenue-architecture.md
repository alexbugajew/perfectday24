# Revenue Architecture fuer PerfectDay24

## Ziel

PerfectDay24 soll als high-trust local commerce engine aufgebaut werden:

- Nutzer bekommen bessere Planung
- Partner bekommen kaufnahe Nachfrage
- die Plattform monetarisiert Handlung statt blosser Aufmerksamkeit

Die Ertragslogik wird ab sofort um Eventplanung als eigenstaendige Umsatzsaeule erweitert. PerfectDay24 plant damit nicht nur Tage, Dates, Staedterouten und Freizeitablaeufe, sondern auch private und berufliche Anlaesse wie Firmenfeiern, Geburtstage, Team-Events, Junggesellenabschiede, Vereinsfeiern, Jubiläen und saisonale Festivitaeten. Dafuer koennen Dienstleister ihre Angebote einstellen, zum Beispiel Locations, Catering, DJs, Fotografen, Dekoration, Technik, Shuttle, Entertainment, Aktivitaeten, Eventagenturen und Spezialanbieter.

## Expansionsannahme fuer die Ertragslogik

| Jahr | geografischer Scope | kommerzielle Logik |
| --- | --- | --- |
| Jahr 1 | Start direkt mit 33 deutschen Staedten | Produkt, SEO, Angebotsseiten und Dienstleister-Akquise in allen 33 Staedten; Vertrieb priorisiert in A-/B-Clustern innerhalb dieser 33 Staedte |
| Jahr 2 | Deutschlandweite Abdeckung | Ausbau auf alle relevanten deutschen Grossstaedte, Metropolraeume, touristischen Cluster und Eventregionen |
| Jahr 3 | DACH und erste EU-Maerkte | Lokalisierung, mehrsprachige Angebotslogik, Dienstleister-Onboarding in priorisierten Metropolen |
| Jahr 4 | Breitere Europa-Skalierung | standardisierte City-Launches, internationale Partnerpakete, White-Label- und API-Angebote |
| Jahr 5 | selektive globale Expansion | nur priorisierte Weltmetropolen mit hoher Event-, Tourismus-, Creator- und Dienstleisterdichte |

## Revenue Architecture nach Horizont

| Horizont | Hauptumsatz | Rolle im Modell | Reifegrad |
| --- | --- | --- | --- |
| Kurzfristig | Affiliate / Provision | schnellster Umsatzstart | sehr hoch |
| Kurzfristig | Sponsored Visibility | monetarisiert Nachfrageoberflaeche | hoch |
| Kurzfristig | Event-Dienstleister Leads | monetarisiert konkrete Anfragen fuer Feiern und Firmen-Events | hoch |
| Mittelfristig | Premium Partner Pakete | wiederkehrender Umsatz | hoch |
| Mittelfristig | Dienstleister-Pro Abos | wiederkehrender Umsatz fuer Eventanbieter, Venues und lokale Services | hoch |
| Mittelfristig | Creator / Brand Route Distribution | skaliert Content + B2B | mittel |
| Spaeter | B2C Premium | ARPU-Ergaenzung | selektiv |
| Langfristig | White-Label / Lizenz | grosser Ticket-Umsatz | attraktiv |
| Langfristig | Aggregierte Insights | margenstark, aber reichweitenabhaengig | spaeter |

## A. Transaction Revenue

Ziel: Monetarisierung dort, wo Nutzer schon entscheidungsnah sind.

| Use Case | Partner | Monetarisierung | Beispiel |
| --- | --- | --- | --- |
| Event-Tickets | Ticketing, Veranstalter | CPS / CPA | 5 bis 12% oder fixer Betrag |
| Freizeitaktivitaeten | Booking-/Experience-Partner | CPS / CPA | 6 bis 15% |
| Restaurants | Reservierung / Lead | CPL / CPA | 1 bis 4 EUR pro seated lead |
| Touristische Angebote | Anbieter, Touren | CPS | 8 bis 20% |
| Private Feiern | Catering, DJ, Fotograf, Deko, Location, Entertainment | CPL / CPA / Take Rate | 10 bis 80 EUR pro qualifiziertem Lead oder 5 bis 12% Take Rate |
| Firmenfeiern / Team-Events | Venues, Caterer, Eventagenturen, Activities, Technik | qualifizierter Lead / Erfolgsprovision | 50 bis 250 EUR pro qualifiziertem B2B-Lead oder 3 bis 8% Take Rate |

Empfehlung:

- Prioritaet auf Events und Experiences, weil dort Tracking und Zahlungsbereitschaft am besten sind
- Restaurants nur dort, wo Reservierungspartner oder qualifizierte Leads sauber messbar sind
- Eventplanung priorisieren, weil Budget, Dringlichkeit und Dienstleisterbedarf hoeher sind als bei spontaner Freizeitplanung
- bei Firmenfeiern und groesseren Geburtstagen zuerst Lead- und Angebotsanfragen monetarisieren, bevor eine vollstaendige Payment-/Booking-Strecke gebaut wird

## B. Visibility Revenue

Ziel: lokale Anbieter monetarisieren, ohne das Ranking zu zerstoeren.

| Produkt | Kaeufer | Preislogik | Platzierung |
| --- | --- | --- | --- |
| Featured Event | Veranstalter | 49 bis 249 EUR / Woche / Stadt | Event-Discovery, Planner-Module |
| Featured Location | Restaurant, Venue | 99 bis 399 EUR / Monat | Detailseite, Explore, Themenlisten |
| Featured Event Service | Catering, DJ, Fotograf, Deko, Technik | 149 bis 599 EUR / Monat / Stadt oder Kategorie | Eventplaner, Anlassseiten, Dienstleisterlisten |
| Occasion Sponsorship | Marken, Venues, Dienstleister | 500 bis 5.000 EUR / Kampagne | Geburtstag, Firmenfeier, Weihnachtsfeier, Sommerfest, JGA |
| Sponsored Placement | lokale Anbieter | CPC + Mindestbudget | nur klar markierte Slots |
| City Spotlight | Tourismus, Medien, Brand | Paketpreis | saisonale oder kuratierte Flaechen |

Regel:

- wenige Premium-Slots pro Surface
- klare Kennzeichnung
- organisches Kernranking bleibt getrennt

## C. Recurring Partner Revenue

Ziel: planbarer Monatsumsatz.

| Paket | Zielgruppe | Preisidee | Leistung |
| --- | --- | --- | --- |
| Partner Basic | kleine lokale Anbieter | 79 bis 149 EUR / Monat | Profil, CTA, Basis-Insights |
| Partner Pro | aktive Venues / Veranstalter | 249 bis 499 EUR / Monat | bessere Sichtbarkeit, Kampagnen, Reporting |
| City Pro+ | Multi-Location / groessere Akteure | 750 bis 2.500 EUR / Monat | mehrere Standorte, Prioritaet, saisonale Pushes |
| Dienstleister Basic | Eventdienstleister in einer Stadt | 99 bis 199 EUR / Monat | Profil, Angebotsseiten, Anfrage-CTA, Basisreporting |
| Dienstleister Pro | Dienstleister mit aktivem Leadbedarf | 299 bis 799 EUR / Monat | bessere Sichtbarkeit, Kampagnen, Angebotsmodule, Leadreporting |
| Corporate Event Partner | Agenturen, Venues, Multi-Service-Anbieter | 1.000 bis 5.000 EUR / Monat | mehrere Kategorien, Firmenfeier-Funnel, Account-Betreuung, Reporting |

## D. Strategic Revenue

| Modell | Kunde | Preisidee |
| --- | --- | --- |
| White-Label City Guide | Tourismus / Staedte | 15k bis 60k EUR p.a. |
| White-Label Event Planner | Unternehmen, Tourismus, Venues, Destinationen | 25k bis 120k EUR p.a. |
| Medien-Widget / Co-Branding | Publisher | 1k bis 5k EUR / Monat |
| Demand Insights | groessere Akteure | 5k bis 25k EUR p.a. |

## Revenue Pools im Produkt

### Planner und Detailmomente

- Eventkarten
- Stop-Karten
- Plan uebernehmen
- Ticket / Reservieren / Jetzt einplanen

### Share und Gruppenmomente

- finalen Plan teilen
- Gruppenwahl bestaetigen
- Plan uebernehmen
- Route als Variante starten

### Public Discovery

- Explore-Listen
- oeffentliche Routen
- Creator-Profile
- Themenflaechen und saisonale Hubs

### Eventplanung und Dienstleister-Marktplatz

- Anlassauswahl, etwa Firmenfeier, Geburtstag, Team-Event, JGA, Vereinsfeier oder Jubiläum
- Budget-, Personenanzahl-, Standort- und Stilfilter
- Dienstleisterprofile mit Angebotsmodulen
- Anfrage- und Angebotsstrecken
- Paketvorschlaege fuer komplette Eventablaeufe
- Lead-, Booking- und Reporting-Logik fuer Anbieter

## Produktlogik fuer Monetisierung

### 1. Affiliate zuerst

Der schnellste Startpunkt sind transaktionsnahe CTA-Flows:

- Ticket-Links
- Experience-Buchungen
- Reservierungs- oder Lead-Weiterleitungen

### 2. Visibility begrenzen

Featured Visibility darf nie flaechig oder unsichtbar sein.

Stattdessen:

- wenige klar benannte Slots
- nur passende Kontexte
- keine bezahlte Verdrangung des Kernrankings

### 3. Partnerumsatz standardisieren

Sobald einzelne Partner sichtbar Nutzen bekommen, wird daraus ein Recurring-Modell:

- Profilpakete
- Kampagnen
- Reporting
- Mehrstandort-Pakete

### 3b. Event-Dienstleister als eigener Marketplace

Die Eventplanung schafft einen zweiten Nachfragepfad neben der Tagesplanung:

- Nutzer suchen nicht nur Inspiration, sondern konkrete Umsetzung
- Dienstleister haben klaren wirtschaftlichen Bedarf an qualifizierten Anfragen
- Firmenfeiern und groessere private Anlaesse haben hoehere Warenkoerbe als normale Freizeitentscheidungen
- Leadqualitaet kann ueber Anlass, Datum, Budget, Personenanzahl und Stadt deutlich besser bewertet werden

Die Plattform sollte zuerst qualifizierte Anfrage- und Angebotsleads verkaufen. Eine vollstaendige Booking- und Payment-Logik wird erst nach Nachweis von Leadqualitaet und Anbieter-Retention priorisiert.

### 4. Creator als Verstaerker

Creator- und Brand-Routen skalieren Reichweite und Distribution.

Das Modell sollte spaeter erlauben:

- bessere Ausspielung
- Kampagnen-Distribution
- Credits / Reward-Systeme
- spaeter Revenue Share

### 5. B2C Premium spaet und selektiv

Kein harter Kern-Paywall-Move.

Sinnvoll spaeter eher fuer:

- Power User
- Gruppenorganisatoren
- Vielplaner
- Reise- und Verlauf-Features

## KPI-Logik

Wichtige Leitgroessen:

- Plan Intent Rate
- Revenue per Planning Session
- Partner CTR
- Booking / Lead Rate
- Revenue per Active City
- Revenue per Partner
- Share-to-Activation Rate
- Route Copy Rate
- Repeat Planning Rate
- Qualified Event Request Rate
- Service Provider Activation Rate
- Lead Acceptance Rate
- Event GMV Pipeline
- Take Rate je Eventkategorie

## Aktivierungsphasen

### Phase 1

- Datenmodell
- Attribution
- CTA-Flaechen vorbereiten
- 33-Staedte-Start produktseitig sichtbar halten
- erste manuelle Partner und Dienstleister in priorisierten A-/B-Staedten innerhalb der 33 Staedte

### Phase 2

- Featured Slots begrenzt aktivieren
- Partnerpakete standardisieren
- Dienstleisterprofile und Anfrage-Logik fuer Eventplanung aktivieren
- Creator-/Brand-Distribution einziehen

### Phase 3

- selektives B2C Premium testen
- Reporting- und City-Pakete
- deutschlandweiten Dienstleister-Rollout und Eventkategorien standardisieren
- erste Medien-/Tourismuskooperationen

### Phase 4

- White-Label
- API / Lizenz
- aggregierte Insights
- internationale Dienstleister- und Eventplanungslogik lokalisieren

## 5-Jahres-Ertragsmodell als Orientierungsrahmen

| Umsatzquelle | Jahr 1: 33 Staedte | Jahr 2: Deutschland | Jahr 3: DACH/EU Start | Jahr 4: Europa | Jahr 5: global selektiv |
| --- | ---: | ---: | ---: | ---: | ---: |
| Partner- und Dienstleister-Abos | 45.000 EUR | 220.000 EUR | 650.000 EUR | 1.400.000 EUR | 2.400.000 EUR |
| Event-Leads / Booking-Provisionen | 20.000 EUR | 160.000 EUR | 500.000 EUR | 1.300.000 EUR | 2.800.000 EUR |
| Featured / Sponsored Visibility | 18.000 EUR | 120.000 EUR | 350.000 EUR | 850.000 EUR | 1.600.000 EUR |
| Affiliate / CPA / CPL | 12.000 EUR | 85.000 EUR | 280.000 EUR | 750.000 EUR | 1.500.000 EUR |
| Eventplanungspakete / Concierge | 15.000 EUR | 80.000 EUR | 220.000 EUR | 500.000 EUR | 900.000 EUR |
| Creator / Brand / City Campaigns | 5.000 EUR | 70.000 EUR | 200.000 EUR | 450.000 EUR | 800.000 EUR |
| White-Label / API / Insights | 0 EUR | 20.000 EUR | 100.000 EUR | 350.000 EUR | 1.000.000 EUR |
| Gesamtumsatz Orientierungsrahmen | 115.000 EUR | 755.000 EUR | 2.300.000 EUR | 5.600.000 EUR | 11.000.000 EUR |

Diese Zahlen sind kein garantierter Forecast, sondern ein strategischer Orientierungsrahmen fuer die Businessplan-Logik. Der groesste Hebel entsteht nicht aus B2C-Premium, sondern aus Dienstleister-Abos, qualifizierten Eventanfragen, Provisionen und wiederkehrenden B2B-Paketen.

## Harte Produktregel

PerfectDay24 soll nicht zuerst wie ein Werbeprodukt monetarisiert werden.

Die Reihenfolge bleibt:

1. Vertrauen
2. Nutzung
3. Wiederkehr
4. Conversion
5. Sichtbarkeitsumsatz
6. Recurring Partner Revenue
