# Revenue Architecture fuer PerfectDay24

## Ziel

PerfectDay24 soll als high-trust local commerce engine aufgebaut werden:

- Nutzer bekommen bessere Planung
- Partner bekommen kaufnahe Nachfrage
- die Plattform monetarisiert Handlung statt blosser Aufmerksamkeit

## Revenue Architecture nach Horizont

| Horizont | Hauptumsatz | Rolle im Modell | Reifegrad |
| --- | --- | --- | --- |
| Kurzfristig | Affiliate / Provision | schnellster Umsatzstart | sehr hoch |
| Kurzfristig | Sponsored Visibility | monetarisiert Nachfrageoberflaeche | hoch |
| Mittelfristig | Premium Partner Pakete | wiederkehrender Umsatz | hoch |
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

Empfehlung:

- Prioritaet auf Events und Experiences, weil dort Tracking und Zahlungsbereitschaft am besten sind
- Restaurants nur dort, wo Reservierungspartner oder qualifizierte Leads sauber messbar sind

## B. Visibility Revenue

Ziel: lokale Anbieter monetarisieren, ohne das Ranking zu zerstoeren.

| Produkt | Kaeufer | Preislogik | Platzierung |
| --- | --- | --- | --- |
| Featured Event | Veranstalter | 49 bis 249 EUR / Woche / Stadt | Event-Discovery, Planner-Module |
| Featured Location | Restaurant, Venue | 99 bis 399 EUR / Monat | Detailseite, Explore, Themenlisten |
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

## D. Strategic Revenue

| Modell | Kunde | Preisidee |
| --- | --- | --- |
| White-Label City Guide | Tourismus / Staedte | 15k bis 60k EUR p.a. |
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

## Aktivierungsphasen

### Phase 1

- Datenmodell
- Attribution
- CTA-Flaechen vorbereiten
- erste manuelle Partner in 3 Kernstaedten

### Phase 2

- Featured Slots begrenzt aktivieren
- Partnerpakete standardisieren
- Creator-/Brand-Distribution einziehen

### Phase 3

- selektives B2C Premium testen
- Reporting- und City-Pakete
- erste Medien-/Tourismuskooperationen

### Phase 4

- White-Label
- API / Lizenz
- aggregierte Insights

## Harte Produktregel

PerfectDay24 soll nicht zuerst wie ein Werbeprodukt monetarisiert werden.

Die Reihenfolge bleibt:

1. Vertrauen
2. Nutzung
3. Wiederkehr
4. Conversion
5. Sichtbarkeitsumsatz
6. Recurring Partner Revenue
