# Investoren-Strategie und Unternehmensbewertung für PerfectDay24

Stand: 2026-07-28

> **Hinweis:** Dieses Dokument ist eine strategische Arbeitsgrundlage, keine Rechts-, Steuer- oder Anlageberatung. Bewertungsspannen sind indikativ und aus marktüblichen Methoden abgeleitet. Vor Vertragsabschluss: Notar, Steuerberater und ggf. einen beteiligungserfahrenen Anwalt einbinden.

---

## 1. Kurzfazit

- **Indikative Pre-Money-Bewertung heute: ca. 1,5 – 2,5 Mio. EUR** (Herleitung in Abschnitt 4).
- **Empfohlene Dealstruktur: Wandeldarlehen (Convertible Loan) mit Cap 2,5 – 3,0 Mio. EUR und 20 % Discount** statt sofortiger Priced Round — schneller, günstiger, verschiebt die Bewertungsdiskussion auf den Zeitpunkt mit besserer Traktion.
- **Zielrunde: 250.000 EUR** (wie im 12-Monats-Finanzierungsmodell geplant), verteilt auf **2 – 4 Angels à 50 – 150k**, alle INVEST-fähig.
- **Wichtigster Bewertungshebel vor/bei der Ansprache: 3 – 5 zahlende Pilotpartner.** Ohne Umsatz- oder Nutzungsbelege landet ihr am unteren Ende der Spanne; mit ersten zahlenden Partnern und KPI-Daten ist das obere Ende verteidigbar.
- **Zeitfenster:** Das eigene Finanzierungsmodell sieht den Angel-Close bis Herbst 2026 vor. Jetzt (August/September) ist das Fenster für die aktive Ansprache.

---

## 2. Ausgangsbasis (Ist-Stand Juli 2026)

Was in Investorengesprächen als Substanz belegbar ist:

| Asset | Beleg |
| --- | --- |
| Produkt live | Planner, Explore, Events, Roadtrips, Saved, Profile — Web-App produktiv auf Vercel |
| Städte-Abdeckung | 473 Städte aktiv, Rollout-Pipeline für 704 deutsche Groß-/Mittelstädte mit Qualitäts-Gates |
| Dateninfrastruktur | Ingestion offizieller Eventquellen, OSM-Vendor-Import, Normalisierung, stage-abhängige Sichtbarkeits-Gates |
| Content | Kuratierte Roadtrips (Küste, Europa, Sylt), 17 JGA-Trips, Family-Routen |
| Partner-Seite | Partner-Dashboard und Profilseiten gebaut (Vorstufe der Revenue Rails) |
| Monetarisierung | Ausgearbeitete Revenue-Architektur (Affiliate, Sponsored Visibility, Leads, Partnerpakete, White-Label) |
| Rechtliches | AGB-/Datenschutz-Entwürfe, Security-Härtung (RLS, Bucket-Policies), Legal-Gap-Check |
| Förderpfad | BAFA-, Distr@l-, INVEST-, DIGI- und IGP-Pakete vorbereitet |

Was **fehlt** (und die Bewertung nach unten zieht):

- keine veröffentlichten Nutzer-/Retention-/Session-Zahlen
- kein zahlender Partner, kein Umsatz
- Rechtsform-/Firmendaten in den Unterlagen noch Platzhalter (UG/GmbH muss vor der Runde stehen — INVEST verlangt eine Kapitalgesellschaft)
- Team-Darstellung (2 Gründer) noch nicht als Investoren-One-Pager aufbereitet

---

## 3. Wer sind eure potenziellen Investoren?

Priorisierung nach Passung zu Phase (Pre-Seed, 250k, Deutschland/Hessen) und Modell (Local Commerce / Marktplatz / B2B2C):

### Priorität 1: Business Angels mit INVEST-Hebel

Das ist eure Kernzielgruppe — genau dafür ist das INVEST-Paket gebaut.

| Profil | Warum passend | Zugang |
| --- | --- | --- |
| Ex-Gründer/Operator aus Travel, Local, Events, Gastro-Tech | verstehen Marktplatz-Dynamik, bringen Partnernetzwerk (Venues, Ticketing, Gastro) | LinkedIn-Direktansprache, Warm Intros über TechQuartier |
| Marktplatz-/SaaS-Angels | bewerten Revenue-Architektur und Take-Rates kompetent | BAND-Netzwerk, Angel-Syndikate |
| Regionale Angels Rhein-Main / Hessen | INVEST + regionale Nähe + Distr@l-Story verstärken sich gegenseitig | Business Angels FrankfurtRheinMain, StartHub Hessen, TechQuartier Frankfurt |
| Branchen-Angels aus dem eigenen Netzwerk (Energie-/Beratungsumfeld von Energieaudit365) | Vertrauen existiert bereits; oft schnellste Zusagen | direkte Ansprache |

Konkrete Anlaufstellen: **BAND** (Business Angels Netzwerk Deutschland, Dealflow-Einreichung), **Business Angels FrankfurtRheinMain e.V.** (Pitch-Abende), **TechQuartier Frankfurt** (Matching-Programme), **StartHub Hessen** (Investoren-Vermittlung).

### Priorität 2: Öffentliche/halböffentliche Frühphasen-Investoren

| Investor | Ticket | Anmerkung |
| --- | --- | --- |
| **MBG Hessen (Kleinbeteiligungskapital)** | 50 – 200k, stille Beteiligung | verwässert nicht, kombinierbar mit Angels; im 12-Monats-Modell bereits als Reserve genannt |
| **Hessen Kapital / BM H** | Co-Investment mit privaten Angels | verdoppelt faktisch jedes Angel-Ticket; Hessen-Betriebsstätte nötig |
| **High-Tech Gründerfonds (HTGF)** | 600k – 1 Mio. initial | eher für die Seed-Runde 2027; jetzt Kontakt aufbauen, nicht pitchen-um-jeden-Preis |

### Priorität 3: Strategische Investoren / Corporates (selektiv, erst ab Traktion)

- **Ticketing/Event** (z. B. Eventim-Umfeld, regionale Ticketing-Anbieter): euer Event-Inventar ist deren Distributionskanal
- **Medienhäuser/Publisher mit Lokalfokus**: Media-for-Equity-Modelle (z. B. SevenVentures-Typ) — erst sinnvoll, wenn der Funnel Conversion nachweist, sonst verbrennt Reichweite nur
- **Tourismus-/Destination-Akteure**: eher White-Label-Kunden als Investoren — als Kunden ansprechen, nicht als Gesellschafter

### Priorität 4: Crowdinvesting (Fallback)

Companisto/Seedmatch funktionieren für B2C-Brands mit Community — aber: hoher Aufwand, öffentliche Zahlen, unaufgeräumter Cap Table. Nur wenn Priorität 1+2 bis Ende 2026 nicht tragen.

### Wen ihr in dieser Phase NICHT ansprechen solltet

- klassische VCs mit 1-Mio.+-Mindesttickets (zu früh, kostet nur Zeit und Signaling)
- Banken/Fremdkapital (siehe Rückfalllogik im 12-Monats-Modell)
- Coparion (braucht privaten Lead-Investor und größere Runde)

---

## 4. Unternehmensbewertung auf aktueller Basis

Pre-Revenue heißt: keine Multiple-Bewertung möglich. Marktüblich sind drei Methoden, die hier trianguliert werden.

### 4.1 Berkus-Methode (Substanz-Check)

| Werttreiber | Max. | PD24-Ansatz | Begründung |
| --- | ---: | ---: | --- |
| Tragfähige Idee / Marktgröße | 500k | 400k | großer, fragmentierter Markt (lokale Freizeit + Event-Dienstleister), klare Monetarisierungslogik |
| Prototyp / Produkt | 500k | 450k | Produkt live, 473 Städte, Daten-Pipeline mit Qualitäts-Gates — deutlich über MVP-Niveau |
| Team | 500k | 300k | 2 Gründer, unternehmerische Erfahrung, aber kein dediziertes Growth-/Sales-Profil |
| Strategische Beziehungen | 500k | 100k | Förderpfad vorbereitet, aber noch keine Partner-/Pilotverträge |
| Erste Umsätze / Rollout | 500k | 50k | Rollout ja, Umsatz nein |
| **Summe** | | **≈ 1,3 Mio. EUR** | |

### 4.2 Scorecard-Methode (Vergleich mit typischer deutscher Pre-Seed)

Referenz: mediane Pre-Money deutscher Pre-Seed-Runden ≈ 2,0 – 2,5 Mio. EUR.

| Faktor | Gewicht | PD24 vs. Durchschnitt | Faktor-Beitrag |
| --- | ---: | ---: | ---: |
| Team | 30 % | 90 % | 0,27 |
| Marktgröße | 25 % | 110 % | 0,28 |
| Produkt/Technologie | 15 % | 120 % | 0,18 |
| Wettbewerbsumfeld | 10 % | 80 % (Google, Eventim, GetYourGuide, Tourismusportale) | 0,08 |
| Traktion/Marketing | 10 % | 50 % (keine belegten Zahlen) | 0,05 |
| Sonstiges (Förderhebel, Kapitalbedarf) | 10 % | 110 % | 0,11 |
| **Summe** | | | **0,97** |

→ 0,97 × 2,0 – 2,5 Mio. ≈ **1,9 – 2,4 Mio. EUR**

### 4.3 Dilution-Anker (was der Markt real zahlt)

Bei 250k Rundengröße und marktüblicher Pre-Seed-Verwässerung von 10 – 15 %:

- 250k / 15 % = 1,67 Mio. Post-Money → **1,4 Mio. Pre-Money** (Untergrenze)
- 250k / 10 % = 2,50 Mio. Post-Money → **2,25 Mio. Pre-Money** (Obergrenze)

### 4.4 Ergebnis

| Szenario | Pre-Money | Bedingung |
| --- | ---: | --- |
| Konservativ (heute, ohne Traktionsbelege) | **1,5 Mio. EUR** | Abschluss jetzt, reine Substanz-Story |
| Basis (Ziel) | **2,0 Mio. EUR** | KPI-Sheet mit Nutzungsdaten + 2 – 3 Pilotpartner in Verhandlung |
| Ambitioniert | **2,5 Mio. EUR** | 3 – 5 zahlende Pilotpartner, erste Monatsumsätze, Distr@l bewilligt |

**Praktische Konsequenz:** Nicht heute zur niedrigen Bewertung pricen, sondern per Wandeldarlehen den Bewertungszeitpunkt nach hinten schieben (siehe Abschnitt 5) und die 8 – 12 Wochen bis zum Close nutzen, um Pilotpartner zu closen.

---

## 5. Wie solltet ihr Anteile anbieten? (Dealstruktur)

### 5.1 Voraussetzung: Rechtsform fixieren

- Vor jeder Beteiligung: **UG (haftungsbeschränkt) oder direkt GmbH** notariell gründen bzw. den Stand aus der GmbH-Gründungs-Checkliste abschließen. INVEST verlangt eine Kapitalgesellschaft.
- Cap Table bei Gründung sauber: nur die operativen Gründer als Gesellschafter, keine Alt-Lasten, keine Mini-Beteiligungen.
- INVEST-Förderfähigkeitsbescheinigung **vor** der intensiven Angel-Ansprache beantragen (Reihenfolge laut INVEST-Paket: erst Start-up-Antrag, dann Investorenansprache, Investor stellt seinen Antrag vor Vertragsschluss).

### 5.2 Empfohlenes Instrument: Wandeldarlehen (Convertible Loan)

**Warum statt Priced Round:**

- kein Notar-Marathon pro Investor, Abschluss in Wochen statt Monaten (bei marktüblicher Gestaltung; Beurkundungspflicht mit Anwalt prüfen)
- Bewertungsdiskussion wird auf die Seed-Runde 2027 verschoben — dann mit Traktion
- mehrere Angels können zeitversetzt zu identischen Konditionen einsteigen (Rolling Close)
- INVEST fördert auch Wandeldarlehen, sofern die Bedingungen der aktuellen BAFA-Richtlinie eingehalten werden (vor Strukturierung prüfen)

**Empfohlene Terms:**

| Term | Empfehlung | Begründung |
| --- | --- | --- |
| Volumen | 250k (Range 200 – 300k) | deckt das 12-Monats-Modell |
| Bewertungs-Cap | 2,5 – 3,0 Mio. EUR | oberes Ende der heutigen Spanne — Angels partizipieren am Upside bis zur Seed |
| Discount | 20 % auf die Seed-Bewertung | marktüblich (15 – 25 %) |
| Floor | optional 1,5 Mio. | schützt Gründer gegen Down-Konversion |
| Zins | 4 – 6 % p.a., endfällig, kapitalisierend | marktüblich |
| Laufzeit | 24 – 36 Monate | genug Puffer bis zur Seed 2027 |
| Qualified Financing | Konversion ab z. B. 500k Neu-Equity | verhindert Zwangskonversion bei Mini-Runden |
| Rangrücktritt | qualifizierter Rangrücktritt | insolvenzrechtlich zwingend sauber zu machen |

**Verwässerungs-Check (Beispiel):** Seed 2027 zu 4 Mio. Pre-Money → Wandeldarlehen konvertiert zum Cap 2,5 Mio. bzw. mit 20 % Discount (3,2 Mio.), also zum Cap → 250k / 2,75 Mio. ≈ **9 % an die Angels**. Gründer halten nach Pre-Seed + Seed realistisch noch 65 – 75 %.

### 5.3 Alternative: kleine Priced Round (wenn Angels darauf bestehen)

- Kapitalerhöhung, Angels zeichnen neue Geschäftsanteile (notariell)
- Pre-Money 1,8 – 2,2 Mio., Abgabe **max. 12 – 15 %** in dieser Runde
- Beteiligungsvertrag schlank halten: 1x Liquidationspräferenz non-participating, Vesting auch für Gründer (4 Jahre, 1 Jahr Cliff), Tag-along/Drag-along, Informationsrechte — **keine** Vetorechte auf operative Entscheidungen, keine Ratchets, kein Board-Sitz für 50k-Tickets

### 5.4 Cap-Table-Leitplanken (nicht verhandelbar)

1. Gründer halten nach dieser Runde **≥ 85 %**.
2. **VSOP-Pool 8 – 10 %** einplanen (virtuell reicht in dieser Phase), idealerweise vor der Seed aus dem Gründeranteil reserviert und so kommuniziert.
3. Kein Einzel-Angel über 10 %; keine Sonderrechte, die die Seed-Runde 2027 blockieren können.
4. Jede Beteiligung INVEST-kompatibel dokumentieren (erhöht faktisch die Rendite des Angels um den BAFA-Zuschuss — aktives Verkaufsargument, aktuelle Konditionen beim BAFA verifizieren).

---

## 6. Prozessplan August – November 2026

| Zeitraum | Meilenstein |
| --- | --- |
| bis Mitte Aug | Rechtsform final, INVEST-Antrag (Start-up) eingereicht, Angel-Deck (10 – 12 Slides) + KPI-One-Pager + Datenraum (HR-Auszug, Satzung, Cap Table, 12-Monats-Finanzplan, Produkt-Demo) |
| bis Ende Aug | Longlist 30 – 40 Angels (Priorität 1), 10 Warm Intros angestoßen; parallel IGP-Entscheidung (Frist 2026-08-20 beachten — nur mit echtem Konsortialpartner) |
| Sep | 15 – 20 Erstgespräche; parallel 3 – 5 Pilotpartner-Verhandlungen (stärkt Story UND Bewertung) |
| Okt | Term-Sheet-Phase, Rolling Close des Wandeldarlehens (First Close ab 100k nicht aufhalten) |
| Nov | Final Close 250k; Distr@l-Antrag mit gesicherter Eigenmittelbasis |

**Pitch-Kernbotschaft:** Nicht „noch eine Freizeit-App", sondern: *„Wir haben die Dateninfrastruktur für lokale Erlebnis- und Eventplanung in 473 deutschen Städten bereits gebaut — jetzt monetarisieren wir entscheidungsnahe Nachfrage über Partner, Leads und Provisionen. Die Runde finanziert den Umsatzbeweis, nicht den Produktbau."*

---

## 7. Offene Punkte vor Ansprache

- [ ] Rechtsform + HR-Eintrag final (Blocker für INVEST)
- [ ] Nutzungs-KPIs aus Produktions-Analytics extrahieren (auch kleine ehrliche Zahlen schlagen keine Zahlen)
- [ ] Team-Slide: Rollen, Vollzeit-Commitment, Track Record
- [ ] Wandeldarlehens-Muster von beteiligungserfahrenem Anwalt (INVEST-kompatibel) aufsetzen lassen
- [ ] Pilotpartner-Pipeline: 10 Zielpartner aus Revenue-Architektur (Venues, Eventdienstleister, Ticketing) benennen
