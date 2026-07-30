# Konkurrenzanalyse PerfectDay24

Stand: 2026-07-30

> **Zweck:** Vollständige Übersicht des Wettbewerbsumfelds für die lokale Freizeit-, Event- und Tagesplanung in Deutschland — inkl. der aktuellen KI-Entwicklungen von Google (I/O 2026), OpenAI und anderen Diensten. Nutzbar für Investoren-Unterlagen (ergänzt Abschnitt „Wettbewerbsumfeld" der Scorecard in `investoren-strategie-und-bewertung-2026-07.md`), Förderanträge und Produktstrategie.
>
> **Methodik:** Web-Recherche Juli 2026 über drei Felder: (1) Big-Tech-KI, (2) KI-Trip-Planner & Travel-Plattformen, (3) deutscher/DACH-Markt für Event-Discovery, Aktivitätenbuchung und Ausflugsplanung. Quellen am Ende je Abschnitt referenziert, Gesamtliste in Abschnitt 10.

---

## 1. Marktdefinition: Wo spielt PerfectDay24?

PerfectDay24 besetzt die Schnittmenge aus vier Märkten:

1. **Lokale Event-Discovery** (Was ist heute/dieses Wochenende los?)
2. **Freizeit-/Ausflugsplanung** (personalisierter Tages-/Wochenendplan, Roadtrips, Familienrouten, JGA)
3. **Aktivitäten-Commerce** (Tickets, Reservierungen, Affiliate, Partner-Sichtbarkeit, Leads)
4. **B2B/White-Label für Destinationen und Partner** (Revenue Rails, Partner-Dashboard)

Kein einzelner Wettbewerber deckt heute alle vier ab. Die Konkurrenz kommt deshalb aus **acht Richtungen**, die im Folgenden einzeln bewertet werden — jeweils mit Einstufung **direkt / indirekt** und Hinweis, wo aus Konkurrenz ein **Partner-Potenzial** wird.

**Kernbefund vorab:** Die Position „personalisierte lokale Tagesplanung + Events + Gruppenkoordination + Partner-Monetarisierung für Deutschland" ist aktuell **unbesetzt**. Die Angriffe kommen von außen: Big Tech von der generischen Such-/Agenten-Seite, Travel-Plattformen von der Fernreise-/Buchungsseite, Social-Apps von der Kalender-/Gruppenseite, Verlage und DMO-Tech von der Content-/Infrastrukturseite.

---

## 2. Big Tech / KI-Plattformen — die strategisch größte Bedrohung

### 2.1 Google (I/O 2026 und Folgeentwicklungen)

Google ist der mit Abstand relevanteste Bedrohungsvektor, weil sich mehrere Produktlinien exakt auf den PD24-Use-Case zubewegen:

| Entwicklung | Inhalt | Verfügbarkeit DE |
| --- | --- | --- |
| **AI Mode („KI-Modus") in der Suche** | Konversationelle Suche auf Gemini-3.5-Basis, >1 Mrd. Nutzer/Monat weltweit | **Seit 07.10.2025 in Deutschland live** |
| **„Weekend Planner Agent"** (I/O-Demo Mai 2026) | Baut aus Präferenzbeschreibungen personalisierte Wochenend-Itineraries; zapft Yelp, AllTrails, Eventbrite, Hotelverfügbarkeit und Echtzeitpreise an, mit direkten Buchungslinks ohne Google zu verlassen | US-only |
| **Agentisches Buchen im AI Mode** (seit 11/2025) | Restaurant-Reservierungen (OpenTable, Resy, Tock), Event-Tickets (Ticketmaster, StubHub, SeatGeek), Termin-Buchungen | US-only, teils Labs |
| **Canvas** | KI-Reiseplan-Baukasten mit Flug-/Hotel-/Maps-Daten | US-Desktop-Labs |
| **Ask Maps** (seit 12.03.2026) | Gemini-Konversationssuche direkt in Google Maps: komplexe Anfragen („Restaurant mit Terrasse, heute 19 Uhr frei"), Multi-Stop-Roadtrip-Planung, personalisiert über Suchhistorie und gespeicherte Orte | USA + Indien |
| **Personal Intelligence** (I/O 2026) | Personalisierung des AI Mode über Gmail, Fotos etc.; Rollout auf ~200 Länder ohne Abo-Pflicht | Rollout läuft |
| **Gemini Spark / Information Agents** (I/O 2026) | Proaktive Agenten, die kontinuierlich Web-/Echtzeitdaten zu Nutzerthemen überwachen; Drittanbieter-Anbindung via MCP ab Sommer 2026 | Sommer 2026, AI Pro/Ultra |
| **Universal Cart / UCP** (I/O 2026) | Checkout-Infrastruktur über Search/Gemini/YouTube hinweg; Google wird nicht Merchant of Record | Aufbau |

**Bewertung:**

- **Akut (heute):** Der AI Mode ist in Deutschland live und beantwortet generische Discovery-Anfragen („Was kann man am Wochenende in Köln machen?") direkt in der Suche. Das ist ein **reales, aktuelles SEO-Traffic-Risiko** für alle contentgetriebenen Freizeitportale — auch für PD24-Landingpages.
- **Mittelfristig (6–18 Monate):** Weekend Planner Agent und Ask Maps sind der PD24-Use-Case in Reinform, aber US-only. Der EU-Rollout agentischer Features hinkt wegen DMA/AI-Act typischerweise 6–12 Monate hinterher. Entscheidender Puffer: Googles Demos hängen an US-Datenpartnern (Yelp, Eventbrite, AllTrails), die in Deutschland **dünne lokale Abdeckung** haben. Googles Schwäche in DE ist nicht das Modell, sondern das lokale Event-/Vendor-Inventar.
- **Chance:** Über UCP bzw. agentische Schnittstellen kann PD24 perspektivisch selbst **Datenquelle/Buchungsendpunkt für Googles Agenten** werden statt nur Opfer.

### 2.2 OpenAI / ChatGPT

- **Agent Mode** (seit 07/2025, ehem. Operator): autonomes Multi-Step-Erledigen inkl. Reiserecherche/-buchung; in Deutschland nutzbar.
- **Apps in ChatGPT** (DevDay 10/2025): Expedia und Booking.com als Launch-Partner (Hotel-/Flugsuche mit Echtzeitpreisen im Chat), **Tripadvisor-App** mit Activity-Discovery und Buchung angekündigt. Reichweite: 800 Mio.+ Wochennutzer.
- **Bewertung:** Indirekt. Reise- und buchungsfokussiert, nicht lokalfreizeit-fokussiert; deutsche lokale Events sind der blinde Fleck. ChatGPT ersetzt aber zunehmend einfache „Was kann ich heute machen?"-Anfragen — die Antwortqualität scheitert dort an fehlenden strukturierten Lokaldaten, genau dem PD24-Asset. Das **Apps SDK ist zugleich Distributionskanal-Option** für PD24.

### 2.3 Weitere KI-Dienste

- **Perplexity (Comet-Browser):** Reise-Hub mit Itinerary-Erstellung und Buchung, Expedia-Partnerschaft, Background Assistant für Preis-Tracking; seit ~02/2026 mobil, in DE verfügbar. Wichtig: **Tripadvisor/Viator-Partnerschaft** — 300.000+ Experiences direkt in Perplexity buchbar. Nische, aber Vorbote des Musters „Discovery in der Antwortmaschine, Buchung beim Partner".
- **Meta AI:** „Ask Meta AI" in Instagram/WhatsApp liefert Restaurant-/Weekend-Empfehlungen; WhatsApp Business Agent seit 06/2026 global (kann Termine buchen). Eher Discovery-Kanal als Planungsprodukt; EU-Targeting eingeschränkt.
- **Apple (WWDC 06/2026):** Neues Siri AI mit Personal Context und Onscreen Awareness. Kein Planungsprodukt, aber künftiger Default-Einstiegspunkt auf iOS; EU-Rollout traditionell verzögert.
- **Amazon Alexa+:** Seit Ende 2025/2026 auch in Deutschland (Prime-inklusiv); Expedia-, Yelp-, Square-Integrationen rollen 2026 aus. Sprach-first und US-Partner-lastig — für lokale deutsche Freizeit-Discovery kurzfristig schwach.

---

## 3. KI-Trip-Planner-Startups

Die GPT-Wrapper-Welle von 2023 hat sich konsolidiert; ohne eigene Daten, Distribution oder Booking-Integration wächst niemand mehr.

| Anbieter | Profil | Relevanz für PD24 |
| --- | --- | --- |
| **Layla.ai** (Berlin) | ~3,4 Mio. € Seed; 2025 ~2,8 Mio. $ ARR; 03/2026 >1 Mrd. $ geplanter Reisewert, 30 Mio. Travel-Messages. Affiliate-Modell, TikTok-Herkunft („Swipe-to-Travel"). Bemerkenswert: >40 % der Trips starten ohne festes Ziel (2023: 12 %) — Inspiration-first-Trend | Relevantester EU-Player, aber Fernreise-Fokus, keine lokale Tages-/Eventplanung. **Indirekt** |
| **Mindtrip** (USA) | 22,5 Mio. $ Funding, ~48 MA; konversationelle Planung, ~11 Mio. POIs, zunehmend B2B/White-Label für Reisemarken | Bestes Produkt-Polish der Kategorie, aber kaum DE-Lokalisierung. **Indirekt**; White-Label-Modell als Blaupause beachten |
| **Wanderlog** (USA, YC) | „Google Docs für Reisen", >1 Mio. Nutzer, Freemium (KI hinter Pro-Paywall) | Stärkster Wettbewerber bei **Gruppen-Reiseplanung**; kein lokaler Event-Fokus. **Indirekt** |
| **GuideGeek** (Matador) | KI-Assistent in WhatsApp/Instagram, ~1 Mio.+ Nutzer; Pivot zu B2B: White-Label-Assistenten für Tourismusbehörden (Südafrika 12/2024, NYC 03/2026) | DE-Relevanz gering; **DMO-White-Label-Modell validiert PD24s B2B-Pfad** |
| **Kleinere** (Wonderplan, iplan.ai, Curiosio, Roam Around, Wanderboat) | Aktive Nischen-Tools ohne nennenswertes Funding | Vernachlässigbar |
| **Make My Day** (DE) | Deutsche KI-Ausflugsplaner-App: Tagestouren/Routen zwischen zwei Orten, offline, ohne Account; kein VC-Funding erkennbar | **Direktester deutscher Feature-Nachbar**, aber ohne Event-/Gruppendimension und ohne Partnermodell |
| **tripbot** (DE) | Solo-Founder-Startup (Mittelfranken, Mitte 2025), KI-Reiseplanung mit Preisvergleich | Sehr früh, keine Traction-Daten. Beobachten |

---

## 4. Travel-Plattformen mit KI-Planern

| Anbieter | KI-Entwicklung 2025/26 | Relevanz für PD24 |
| --- | --- | --- |
| **GetYourGuide** (Berlin) | 2025 ~1 Mrd. € (adj.) Revenue, erstmals profitabel, IPO-Vorbereitung; erklärtes Ziel „AI-first company": personalisierte Suche, KI-Review-Summaries, Expansion in Shows/Events; Frühjahr 2026 KI-Updates gegen die Lücke Planung→Buchung | **Wichtigster Dual-Player:** natürlicher Affiliate-/Buchungspartner — ODER Wettbewerber, falls GYG einen eigenen Tagesplaner baut. Touristisch/POI-fokussiert, nicht Alltags-Freizeit |
| **Airbnb** | Experiences-Relaunch 05/2025 (650 Städte) + „Services"; Umbau zur Super-App mit Social-Features; KI-Konversationssuche für 2026 angekündigt | **Größte strategische Bedrohung bei lokalen Erlebnissen**, da Experiences bewusst auch Locals adressiert; DACH-Tiefe außerhalb der Metropolen noch dünn |
| **Tripadvisor/Viator** | KI-Trip-Builder aus 1 Mrd. Reviews; große Perplexity-Partnerschaft (300.000+ Experiences in Perplexity buchbar); ChatGPT-App | Indirekt; Muster „Distribution über KI-Antwortmaschinen" ist richtungsweisend |
| **Booking.com** | AI Trip Planner + Smart Filter, enge OpenAI-Kooperation; Rollout zunächst US/UK/AU/NZ/SG | Unterkunftsfokus, DE hinkt nach. Indirekt |
| **Expedia (Romie)** | KI-„Travel Buddy", liest explizit in Gruppen-Chats mit und hilft bei Gruppenentscheidungen; 2026 weiter experimentell, US-zentriert | Konzeptionell nah an PD24-Gruppenplanung — beobachten |
| **Kayak** | „AI Mode" seit 10/2025 (chatbasierte Trip-Suche) | Flug/Hotel — irrelevant für lokale Freizeit |
| **Roadtrippers** (USA) | „Autopilot"-KI-Tripwizard als Premium-Abo-Feature | Nur Nordamerika; validiert Roadtrip-KI als Premium-Monetarisierung |

---

## 5. Event-Discovery Deutschland — die direkteste Konkurrenz

| Anbieter | Profil | Einstufung |
| --- | --- | --- |
| **Rausgegangen** (DuMont) | ~80 Städte, >4 Mio. Seitenaufrufe/Monat, 360.000+ registrierte Nutzer; seit 04/2025 DuMont-Mehrheit (Gründerteam bleibt); Modell: Veranstalter-Listings, Ticketverkauf, Media-Kooperationen | **Direktester Wettbewerber im Event-Segment.** Stärke: Reichweite, Kuration, Verlags-Rückenwind. Schwäche: nur Events (Konzerte, Partys, Kultur), keine Tages-/Ausflugsplanung, kein Outdoor/Familie |
| **Fever** | >500 Mio. $ Funding gesamt (2025: +100 Mio., L Catterton/Point72), DICE-Übernahme, „Secret Media"-Content-Netzwerk; DE: Berlin, Hamburg, München, Köln, Stuttgart + Mittelstädte | **Direkt** bei urbaner Event-Inspiration. Stärke: Kapital, Daten, Eigenformate (Candlelight). Schwäche: wenig lokale Tiefe jenseits eigener Formate |
| **CTS Eventim** | 2025 erstmals >3 Mrd. € Umsatz; reines Transaktions-/Ticketing-Powerhouse | Indirekt; Ticket-Endpunkt und potenzieller Affiliate-Partner (im Investoren-Dok bereits als strategischer Investor-Typ genannt) |
| **Eventbrite** | Self-Service-Ticketing, DE-Gebühren ~2,5 % + 0,99 €; stark bei kleinen/mittleren Events; Discovery schwach | Indirekt; eher Datenquelle/Partner. **Achtung:** Eventbrite ist Datenpartner von Googles Weekend Planner Agent |
| **Meetup** | Seit 2024 bei Bending Spoons; Organizer-Abos | Indirekt (Gruppenaktivitäten ohne lokale Redaktion) |
| **Mit Vergnügen / Geheimtipp-Netzwerk / Prinz** | Mit Vergnügen: ~4 Mio. Leser/Monat (B, HH, M, K); Geheimtipp-Portale Social-first; Monetarisierung Sponsored Content | **Direkt** im Kampf um Inspirations-Traffic und lokale Werbebudgets. Schwäche: keine Personalisierung, keine Buchung, keine strukturierte Planung |
| **ask.helmut** | Berliner Club-/Kultur-Nische | Vernachlässigbar |
| **Regionale Zeitungsportale** | Veranstaltungskalender (oft destination.one-/kalender.digital-Daten) | UX-schwach; eher Datenquellen-Konkurrenz |

---

## 6. Aktivitäten-/Erlebnisbuchung & Freizeit-Apps DACH

### 6.1 Erlebnis-Commerce

- **Groupon:** Turnaround unter tschechischer Führung (Pale Fire), Refokus auf lokale Deals; in DE aktiv, aber Vertrauens-/Qualitätsproblem. Direkt nur im Deal-Segment; Stärke: Merchant-Basis.
- **Jochen Schweizer mydays** (ProSiebenSat.1): Duopol der Erlebnisgutscheine; 04/2025 vollständige Übernahme durch P7S1, gilt als Verkaufskandidat. Geschenk-Anlass, nicht „Was mache ich heute" — indirekt, relevanter Affiliate-Pool.
- **Klook:** 100-Mio.-$-Runde 02/2025, IPO-Filing Ende 2025, Europa-Expansion (London, Amsterdam, Rom, Zürich) — Deutschland bislang nachrangig, mittelfristig beobachten.
- **Regiondo & bookingkit:** Die beiden deutschen B2B-Buchungssysteme für Freizeitanbieter (Regiondo 2023 mit Rezdy/Checkfront fusioniert). Keine Endkunden-Konkurrenz, sondern **potenzielle Inventar-/API-Partner** für PD24s buchbare Aktivitäten.

### 6.2 Ausflugs-/Freizeit-Apps

- **Komoot:** ~45 Mio. Nutzer; 03/2025 für ~300 Mio. € an Bending Spoons, danach ~75–85 % der Belegschaft entlassen, Monetarisierung verschärft, Community-Vertrauen erodiert. Outdoor-Routen, nicht Event/Gastro — indirekt. **Chance: verunsicherte deutsche Outdoor-Nutzerbasis ist abwerbbar.**
- **Outdooractive** (Immenstadt): Doppelmodell B2C + B2B-SaaS; positioniert sich 2025/26 aggressiv mit **White-Label-KI-Assistenten für DMOs** (z. B. Rheinland-Pfalz, Heidiland). **Wichtigster Wettbewerber im White-Label-Geschäft.** Schwäche: Outdoor-lastig, Events/urbane Freizeit schwach.
- **ADAC Trips:** Kostenlos, große Mitglieder-Reichweite, Freizeitprofil-Personalisierung, kuratierte Touren + neuer **KI-Reiseassistent**. Funktional dem PD24-Konzept erstaunlich nah — **wichtigster deutscher Incumbent im Ausflugsbereich**, aber redaktionell statt echt personalisiert, ohne Partner-Marktplatz, mit Auto-/Reise-Bias.
- **FreizeitMonster:** DE/AT/CH-Freizeit-Suchmaschine, >200 Stadttouren in 120+ Städten (lialo-Kooperation); kleines Team, SEO-getrieben. Direkter, aber ressourcenschwacher Wettbewerber.
- **Spontacts** (CH/DACH): >1 Mio. Nutzer, Freizeitpartner-Matching — komplementär bis indirekt.

---

## 7. Gruppen-/Social-Planung

Das Bedürfnis „Pläne raus aus dem Gruppenchat" ist massiv validiert — aber bisher ohne Content-/KI-Planungsschicht:

- **Howbout** (UK): Shared-Calendar für Gen Z, >13 Mio. $ Funding (Goodwater), >4 Mio. MAU, 50 Mio. Events. Kein KI-Planer, kein lokaler Content.
- **Partiful** (USA): Event-Einladungen als Social-Pages, 27,3 Mio. $ Funding, >500.000 MAU, +400 % YoY; Gen-Z-Standard in den USA, in DE kaum präsent.
- **Troupe** (USA): Gruppen-Abstimmung per Ranked-Choice-Voting — Nische.

**Bewertung:** Kurzfristig keine DE-Bedrohung, aber der Beweis, dass Gruppenkoordination ein eigenständiger Wachstumshebel ist. PD24s Gruppenplanung ist gegenüber diesen Apps durch den Content-/Event-Layer differenziert; umgekehrt könnte ein Howbout-DE-Launch die Gruppen-Schiene schnell besetzen.

---

## 8. White-Label/DMO-Markt und faktische Discovery-Kanäle

### 8.1 DMO-Tech (relevant für PD24s White-Label-Pfad)

Der DACH-Markt ist um wenige Anbieter konsolidiert: **destination.one** (hubermedia eT4 + neusta, Datenbank/Veranstaltungskalender/KI für hunderte Destinationen inkl. Open-Data-System), **Feratel** (Deskline, dominant im Alpenraum), **Outdooractive** (Touren + KI-Assistenten), Agenturen wie **land in sicht**. Konsequenz: DMOs haben meist schon Daten-Infrastruktur — PD24s Einstieg gelingt eher als **personalisierte Inspirations-/Planungsschicht auf bestehenden Datenquellen** (z. B. destination.one-APIs) denn als Ersatzsystem.

### 8.2 Social Media + Google Maps: die eigentlichen Marktanteilshalter

Der größte „Wettbewerber" ist kein Startup: ~40 % der Gen Z starten die Suche nach Restaurants/Orten auf TikTok oder Instagram statt bei Google; 46 % der 18–34-Jährigen nutzen Social Media zur Lokalsuche. Typisches Muster: **Inspiration auf TikTok/Instagram → Verifikation (Öffnungszeiten, Route) auf Google Maps.** Keiner der beiden Schritte erzeugt einen konkreten, teilbaren Tagesplan — genau diese Lücke ist PD24s USP. Konsequenz: Social-taugliche Inhalte (Share-Momente) und saubere strukturierte Orts-/Eventdaten sind Pflicht, nicht Kür.

---

## 9. Gesamtbewertung

### 9.1 Bedrohungsmatrix (Kurzform)

| Wettbewerber | Direktheit | Bedrohung | Zeithorizont | Partner-Potenzial |
| --- | --- | --- | --- | --- |
| Google AI Mode (DE live) | direkt (Discovery-Traffic) | **hoch** | **jetzt** | mittel (UCP/Agenten-Endpunkt) |
| Google Weekend Planner / Ask Maps | direkt | hoch | 6–18 Monate (EU-Rollout) | mittel |
| Rausgegangen (DuMont) | direkt (Events) | mittel–hoch | jetzt | gering |
| ADAC Trips | direkt (Ausflüge) | mittel | jetzt | gering |
| Outdooractive | direkt (White-Label/DMO) | mittel | jetzt | gering |
| Fever | direkt (urbane Events) | mittel | jetzt | gering |
| Airbnb Experiences + KI-Suche | direkt (lokale Erlebnisse) | mittel | 12–24 Monate | gering |
| GetYourGuide | dual | mittel | 12–24 Monate | **hoch (Affiliate)** |
| ChatGPT / Perplexity / Meta AI | indirekt | mittel | laufend | mittel (Apps SDK/MCP) |
| Mit Vergnügen / Geheimtipp | direkt (Inspiration/Werbung) | gering–mittel | jetzt | mittel (Content) |
| Layla / Mindtrip / Wanderlog | indirekt (Fernreise) | gering | — | gering |
| Howbout / Partiful | indirekt (Gruppen) | gering (DE) | 12+ Monate | gering |
| Eventim / Eventbrite / Regiondo / bookingkit / Jochen Schweizer mydays | indirekt | gering | — | **hoch (Inventar/Affiliate)** |
| Komoot (Bending Spoons) | indirekt | gering | — | — (Nutzerbasis abwerbbar) |
| FreizeitMonster / Spontacts / Make My Day / tripbot | direkt, ressourcenschwach | gering | — | — |
| TikTok / Instagram / Google Maps | faktischer Standard | strukturell | dauerhaft | Kanäle, keine Gegner |

### 9.2 Die Positionierungslücke

Kein Anbieter kombiniert heute: **KI-gestützte Tagesplanung + lokale Events (offizielle Quellen) + Aktivitäten/Vendors + Gruppenkoordination + Partner-Monetarisierung + White-Label — für Deutschland.** Die Nächsten an dieser Position sind ADAC Trips (ohne Marktplatz, ohne echte Personalisierung), Rausgegangen (nur Events), Outdooractive (nur Outdoor/DMO) und perspektivisch Googles Weekend Planner (ohne deutsche Lokaldaten).

### 9.3 Verteidigungslinien für PerfectDay24

1. **Deutsche Lokaldaten als Burggraben:** Googles und OpenAIs Demos hängen an US-Datenpartnern (Yelp, Eventbrite, AllTrails) mit dünner DE-Abdeckung. PD24s Pipeline aus offiziellen Eventquellen + OSM-Vendor-Import + Qualitäts-Gates über 473+ Städte ist genau das Asset, das Big Tech in Deutschland fehlt.
2. **Vom Prompt zum Plan:** Antwortmaschinen liefern Linklisten; PD24 liefert einen konkreten, teilbaren, gruppen­fähigen Tagesplan mit handlungsnahen Endpunkten (Ticket, Reservierung, Route). Diese „letzte Meile" der Entscheidung ist zugleich der Monetarisierungspunkt (vgl. `monetization-strategy.md`: Handlung vor Aufmerksamkeit).
3. **Andocken statt nur konkurrieren:** ChatGPT Apps SDK, MCP, Googles UCP und Perplexity zeigen das Muster: Agentische Oberflächen brauchen strukturierte, buchbare Lokaldaten-Endpunkte. PD24 kann sich als **der deutsche Lokal-Freizeit-Endpunkt für KI-Agenten** positionieren — Distribution statt Disruption.
4. **SEO-Abhängigkeit begrenzen:** AI Mode frisst generische Discovery-Suchen schon heute. Wachstumskanäle müssen App-Retention, Share-/Gruppen-Loops (Social-Momente) und B2B-Distribution (White-Label, Partner) sein — nicht primär organischer Such-Traffic.
5. **Konsolidierung als Fenster:** Bending Spoons (Komoot, Meetup), DuMont (Rausgegangen), Vertica (Regiondo), P7S1-Verkaufsabsichten (Jochen Schweizer mydays) zeigen: Der Markt sortiert sich über Distribution und Partnernetze. Komoots Vertrauensverlust und die Lücke zwischen Event-Apps und Ausflugs-Apps sind ein zeitlich begrenztes Einstiegsfenster.

### 9.4 Implikation für die Investoren-Story

Die Scorecard im Investoren-Dokument setzt „Wettbewerbsumfeld" bei 80 % an (Belastung durch Google, Eventim, GetYourGuide, Tourismusportale). Diese Analyse liefert die differenzierte Antwort für Investorengespräche: **Die genannten Player sind überwiegend Endpunkte oder Nachbarn, keine Positionsbesetzer** — und die reale Big-Tech-Bedrohung (Weekend Planner Agent) validiert zugleich die Kategorie und scheitert in Deutschland vorerst an den Daten, die PD24 aufbaut. Gleichzeitig gehört das Zeitfenster-Argument ehrlich dazu: Der EU-Rollout der Google-Agenten (geschätzt 2027) definiert die Frist, bis zu der PD24 Retention, Partnerumsätze und Datenexklusivität nachweisen muss.

---

## 10. Quellen (Auswahl)

**Big Tech / KI:**
- https://blog.google/products-and-platforms/products/search/agentic-plans-booking-travel-canvas-ai-mode/ (17.11.2025)
- https://blog.google/innovation-and-ai/technology/ai/google-io-2026-all-our-announcements/ (Mai 2026)
- https://9to5google.com/2026/05/19/google-io-2026-news/
- https://www.americasgreatresorts.net/google-io-2026-agentic-search-hotel-demand/
- https://skift.com/2025/11/17/google-is-building-agentic-travel-booking-plus-other-travel-ai-updates/
- https://www.horizont.net/medien/nachrichten/search-google-bringt-den-ai-mode-jetzt-auch-nach-deutschland-230967 (AI Mode DE, Okt. 2025)
- https://blog.google/products-and-platforms/products/maps/ask-maps-immersive-navigation/ (12.03.2026)
- https://www.cnbc.com/2026/03/12/google-brings-more-gemini-ai-to-navigation-with-ask-maps-feature.html
- https://skift.com/2025/10/06/expedia-booking-chatgpt-apps-openai/ (ChatGPT Apps)
- https://www.phocuswire.com/openai-chatgpt-apps-expedia-booking-tripadvisor
- https://www.apple.com/newsroom/2026/06/apple-introduces-siri-ai-a-profoundly-more-capable-and-personal-assistant/
- https://techcrunch.com/2025/12/23/amazons-ai-assistant-alexa-now-works-with-angi-expedia-square-and-yelp/
- https://techcrunch.com/2026/06/03/metas-ai-agent-for-whatsapp-business-is-now-available-globally/

**KI-Trip-Planner & Travel-Plattformen:**
- https://www.phocuswire.com/ai-travel-planner-mindtrip-receipts-funding
- https://finance.yahoo.com/news/layla-surpasses-1-billion-trips-165400507.html
- https://www.phocuswire.com/layla-launch-funding-ai-travel-planner
- https://en.wikipedia.org/wiki/GuideGeek
- https://tripadvisor.mediaroom.com/press-releases?item=126807 (Perplexity-Partnerschaft)
- https://news.booking.com/bookingcom-launches-new-ai-trip-planner-to-enhance-travel-planning-experience/
- https://www.hoteldive.com/news/expedia-ai-assistant-romie/716315/
- https://arival.travel/article/inside-airbnb-experiences-relaunch/
- https://techcrunch.com/2026/02/13/airbnb-plans-to-bake-in-ai-features-for-search-discovery-and-support/
- https://techcrunch.com/2025/10/16/kayak-launches-an-ai-mode-for-travel-questions-search-and-bookings/
- https://skift.com/2026/04/22/getyourguide-ai-updates/
- https://roadtrippers.com/media-center/new-ai-trip-planner-autopilot/
- https://www.starting-up.de/geschaeftsideen/gruenderstorys/tripbot-ki-reiseplanung-jenseits-der-inspiration.html
- https://apps.apple.com/de/app/make-my-day-ki-reiseplaner/id6744061128
- https://techcrunch.com/2024/09/13/howbout-raises-8m-from-goodwater-to-build-a-calendar-that-you-can-share-with-your-friends
- https://sacra.com/c/partiful/

**Deutschland/DACH:**
- https://www.bdzv.de/service/presse/branchennachrichten/2025/dumont-uebernimmt-mehrheit-an-digitalportal-rausgegangen
- https://newsroom.feverup.com/en-US/250714-fever-secures-100m-strengthening-its-position-as-the-leading-independent-live-entertainment-tech-platform/
- https://www.ticketnews.com/2025/06/fever-acquires-dice-announces-100-million-funding-round/
- https://retail-news.de/cts-eventim-umsatzwachstum-2025/
- https://www.goingpublic.de/going-public/getyourguide-macht-sich-fit-fuer-die-boerse/
- https://skift.com/2025/05/13/airbnb-relaunches-experiences-adds-hotel-style-services-latest-move-to-go-beyond-rentals/
- https://skift.com/2025/11/10/klook-ipo-global-travel-experiences-future/
- https://meedia.de/news/beitrag/19098-prosiebensat-1-kauft-erlebnisgeschaeft-von-jochen-schweizer-vollstaendig-auf
- https://www.checkfront.com/blog/checkfront-announces-global-merger-with-rezdy-and-regiondo/
- https://www.smartissimo.de/news/apps/komoot-nach-uebernahme-durch-bending-spoons-entlassung-von-rund-75-der-mitarbeitenden/
- https://corporate.outdooractive.com/presse/outdooractive-tourism-ai-immer-mehr-destinationen-setzen-auf-vollstaendig-integrierten-ki-assistenten/
- https://www.adac.de/services/apps/trips/
- https://legacy.hubermedia.de/willkommen-destination-one/
- https://www.feratel.at/unsere-loesungen/destinationsmanagementsystem/
- https://onlinemarketing.de/technologie/konkurrenz-google-suche-gen-z-tiktok-instagram
