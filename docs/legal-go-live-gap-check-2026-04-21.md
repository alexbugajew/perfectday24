# Legal Go-Live Gap Check fuer PerfectDay24

Stand: 2026-04-21

## Ergebnis in einem Satz

Vor einem oeffentlichen Vercel-Go-Live fehlen bei `perfectday24` aktuell mindestens eine echte `Impressum`-Seite, eine echte `Datenschutz`-Seite, sichtbare Verlinkungen dorthin sowie die finalen Unternehmens- und Anbieterangaben. Zusaetzlich gibt es voraussichtlich Handlungsbedarf bei `Consent/Cookies` und moeglicherweise bei `DSA-/UGC-Prozessen`, weil die App oeffentliche Profile, Routen, Share-Links, Gruppen und Chats enthaelt.

## Repo-Check: Was aktuell fehlt oder unvollstaendig ist

### Klar fehlend

- Es gibt aktuell keine oeffentlichen Routen wie `app/impressum/page.tsx` oder `app/datenschutz/page.tsx`.
- In [app/layout.tsx](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/app/layout.tsx) ist kein globaler Footer oder Legal-Bereich eingebaut.
- In [components/MainNav.tsx](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/components/MainNav.tsx) gibt es keine Links zu `Impressum`, `Datenschutz` oder `AGB`.

### Schon vorhanden, aber nur als Entwurf

- [docs/datenschutzerklaerung-perfectday24.md](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/docs/datenschutzerklaerung-perfectday24.md) ist vorhanden, aber noch mit Platzhaltern und offenen Punkten.
- [docs/agb-perfectday24-ug-entwurf.md](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/docs/agb-perfectday24-ug-entwurf.md) ist vorhanden, aber noch `UG`-bezogen und nicht als Live-Seite eingebunden.

### Bereits als UI-Platzhalter sichtbar

- In [HomepageScaffold.tsx](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/components/home/HomepageScaffold.tsx) stehen im Footer nur Platzhalter `Impressum` und `Datenschutz` als `span`, nicht als echte Links.

### Im Code erkennbar, rechtlich relevant

- `Supabase` wird fuer Auth und Datenhaltung verwendet.
- `OpenAI` ist in [app/api/generate-plan-text/route.ts](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/app/api/generate-plan-text/route.ts) aktiv eingebunden.
- Es gibt OAuth-/Provider-Bezuege zu `Google` und `Microsoft`.
- Es gibt Karten-/Routing-Bezuege zu `OpenStreetMap`, `OSRM` und Leaflet-Infrastruktur.
- Es gibt monetarisierungsnahe Kennungen in `localStorage` und `sessionStorage`, siehe [lib/monetization/client.ts](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/lib/monetization/client.ts).
- Es gibt oeffentliche oder teil-oeffentliche Nutzerinhalte und Interaktionen: Profile, Routen, Share-Links, Gruppen, Chats.

### Was ich im Code-Scan aktuell nicht gefunden habe

- Keine klar eingebundene Consent- oder Cookie-Banner-Logik
- Keine klar sichtbare `Impressum`-/`Datenschutz`-Navigation
- Keine sichtbare Payment-Integration wie `Stripe` oder `PayPal`
- Keine klassische Web-Analytics-Einbindung wie `Google Analytics`, `Matomo`, `Plausible` oder `GTM`

## Pflichtpunkte vor oeffentlichem Launch

### 1. Impressum

Fuer eine oeffentliche, geschaeftsmaessige Website braucht ihr sehr wahrscheinlich ein Impressum nach `§ 5 DDG`.

Mindestens vorzubereiten:

- vollstaendiger rechtlicher Unternehmensname
- Rechtsform
- ladungsfaehige Anschrift
- vertretungsberechtigte Person(en)
- E-Mail-Adresse
- Registergericht und Handelsregisternummer, sobald eingetragen
- USt-IdNr. oder Wirtschafts-IdNr., falls bereits vorhanden
- falls einschlaegig Aufsichtsbehoerde

Pragmatisch zusaetzlich sinnvoll:

- Telefonnummer oder anderer direkt nutzbarer Kontaktkanal

### 2. Datenschutzerklaerung

Die vorhandene Fassung ist schon ein guter Rohentwurf, aber fuer Live fehlen insbesondere noch:

- Verantwortlicher mit echtem Firmennamen und echter Anschrift
- Datenschutzkontakt bzw. DSB, falls vorhanden
- Hosting-Anbieter und Serverstandort
- konkrete Empfaenger-/Dienstleisterliste
- konkrete Speicherdauern oder belastbare Kriterien je Datenkategorie
- Drittlandtransfers und genutzte Garantien
- zustaendige Datenschutzaufsichtsbehoerde
- Klarstellung, ob und wo automatisierte Entscheidungen oder Profiling stattfinden
- Klarstellung, welche Daten zwingend fuer die Nutzung notwendig sind und welche freiwillig sind

### 3. Sichtbare Verlinkung

Die Legal-Seiten muessen nicht nur existieren, sondern leicht erreichbar sein.

Empfehlung:

- Footer-Link auf jeder Seite
- zusaetzlich Links auf Landing-/Marketing-Seiten
- bei Login/Registrierung zumindest Verweis auf Datenschutz und AGB

## Wahrscheinlich zusaetzlich noetig

### 4. Consent / Cookie- bzw. Storage-Management

Im Code gibt es nicht nur technisch erforderliche Planner-Speicherungen, sondern auch monetarisierungsnahe Kennungen in Browser-Speichern. Das ist rechtlich der heikelste Punkt.

Meine Einordnung:

- Planner-bezogene `localStorage`-/`sessionStorage`-Nutzung kann teilweise unter `unbedingt erforderlich` fallen, wenn sie fuer die vom Nutzer ausdruecklich gewuenschte Funktion gebraucht wird.
- Die monetarisierungsnahen IDs in [lib/monetization/client.ts](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/lib/monetization/client.ts) wirken eher wie `Attribution`/`Affiliate`/`Tracking` als wie reine Kernfunktion. Das ist eine **Inference aus dem Code**.
- Dafuer solltet ihr sehr wahrscheinlich ein Consent-Setup vorsehen, bevor diese Logik live gegenueber Endnutzern aktiv wird.

### 5. AGB / Nutzungsbedingungen

AGB sind nicht in jeder Konstellation zwingend, fuer `perfectday24` aber sehr empfehlenswert.

Grund:

- Nutzerkonten
- oeffentliche Profile / Creator-Profile
- UGC wie Routen, Bewertungen, Chats, Gruppen
- Affiliate-/Partnerlinks
- KI-generierte Inhalte

Eure vorhandene AGB-Fassung ist ein guter Start, muss aber mindestens von `UG` auf die spaetere Rechtsform umgestellt und als echte Seite angebunden werden.

### 6. Streitbeilegung nach VSBG

Pruefen, ob ihr die Website-Information nach `§ 36 VSBG` aufnehmen muesst.

Wichtig:

- Wenn ihr am `31. Dezember` des Vorjahres `10 oder weniger` Personen beschaeftigt habt, entfällt die allgemeine Website-Informationspflicht zur Teilnahmebereitschaft.
- Wenn ihr freiwillig teilnehmt oder gesetzlich verpflichtet seid, muesst ihr die Schlichtungsstelle nennen.

Fuer ein fruehes Start-up ist oft nur eine knappe Negativauskunft relevant, aber das haengt an eurem Beschaeftigtenstand und eurer Entscheidung zur Teilnahme.

## Moeglicherweise relevant wegen oeffentlichen Nutzerinhalten

### 7. DSA-/Plattformpflichten

`perfectday24` hat nach dem Code-Stand Merkmale einer Hosting- bzw. Online-Plattform-Funktion:

- oeffentliche Profile
- oeffentliche bzw. unlistete Routen
- Share-Links
- Chats / Gruppen
- nutzergenerierte Inhalte

Daraus koennen zusaetzliche Pflichten folgen. Das ist kein pauschales Vollgutachten, aber ich wuerde diese Punkte ernsthaft pruefen:

- elektronischer Kontaktpunkt fuer Nutzeranfragen
- leicht zugaenglicher Mechanismus fuer Meldungen rechtswidriger Inhalte
- klare Moderations-/Sperrregeln in den Nutzungsbedingungen
- Moeglichkeit, Moderationsentscheidungen nachvollziehbar mitzuteilen
- internes Beschwerdesystem, wenn ihr Inhalte/Accounts sperrt oder entfernt

Das ist eine **Inference aus den sichtbaren Produktfunktionen in der Codebasis** und sollte vor offenem UGC-Launch einmal rechtlich gegengeprueft werden.

## Nur falls ihr bestimmte Features live nehmt

### 8. Redaktionell Verantwortlicher nach MStV

Nur pruefen, wenn ihr journalistisch-redaktionelle Inhalte im engeren Sinn veroeffentlicht, also etwa:

- Magazin-/Guide-Artikel
- News-/Blog-Bereiche
- redaktionell verantwortete Stadtguides

Reine Produktseiten, Routen, Profilseiten und App-Funktionalitaet loesen das nicht automatisch aus. Wenn ihr aber bewusst redaktionelle Inhalte publiziert, braucht ihr im Impressum zusaetzlich eine verantwortliche natuerliche Person.

### 9. Widerruf / Preisangaben / Checkout

Nur erforderlich, wenn ihr kostenpflichtige B2C-Leistungen live nehmt, zum Beispiel:

- Premium-Abos
- kostenpflichtige digitale Zusatzfunktionen
- direkte Ticket- oder Serviceverkaeufe im eigenen Checkout

Aktuell habe ich im Code keine klare Checkout-/Payment-Integration gesehen.

## Welche konkreten Angaben ihr jetzt zusammentragen solltet

### Fuer das Impressum

- finaler Unternehmensname
- Rechtsform
- vollstaendige Anschrift
- Name des/der Geschaeftsfuehrer(s)
- Registergericht
- HRB-Nummer
- E-Mail-Adresse
- Telefonnummer, falls ihr sie angeben wollt
- USt-IdNr. / W-IdNr., falls bereits vorhanden
- Info zur Verbraucherschlichtung, falls einschlaegig
- optional verantwortliche Person fuer redaktionelle Inhalte, falls ihr solche habt

### Fuer die Datenschutzerklaerung

- Hosting-Anbieter, z. B. `Vercel`, wenn dort deployed
- Serverregion/Standort
- konkrete Log-Aufbewahrung
- `Supabase`: welche Module werden genutzt (`Auth`, `Database`, `Storage`, `Realtime`)
- `OpenAI`: welche Funktionen sind live und welche Daten gehen dort hin
- OAuth-Provider: `Google`, `Microsoft`
- Karten/Routing: `OpenStreetMap`, `OSRM`, ggf. weitere CDN-/Tile-Anbieter
- Kategorien externer Partner/Affiliate-Ziele
- Aufbewahrungsfristen fuer:
  - Nutzerkonten
  - Profil- und Creator-Daten
  - Chats
  - gespeicherte Plaene
  - Share-Daten
  - Gruppen
  - Tracking-/Attributionsdaten
- zustaendige Datenschutzaufsichtsbehoerde
- Drittlandtransfer-Mechanik fuer externe Anbieter

### Fuer Consent / Banner

- welche Speicherungen technisch erforderlich sind
- welche nicht erforderlich sind
- ob monetarisierungsnahe Kennungen erst nach Einwilligung gesetzt werden
- wie Nutzer Einwilligungen spaeter aendern oder widerrufen koennen

## Wichtiger Aktualitaetshinweis

- Den frueher oft verwendeten EU-OS-Plattform-Link solltet ihr nicht mehr blind uebernehmen. Die `ODR`-Plattform wurde laut EU-Rechtslage mit Wirkung zum `20. Juli 2025` eingestellt.

## Meine Priorisierung fuer euch

### Vor erstem oeffentlichen Launch zwingend

- `Impressum`
- `Datenschutz`
- echte Footer-/Legal-Links
- finale Firmendaten
- Consent-Entscheidung fuer monetarisierungsnahe Speicherungen

### Sehr kurzfristig danach

- `AGB` / Nutzungsbedingungen finalisieren
- DSA-/UGC-Prozesse pruefen und wenigstens minimal abbilden

### Nur falls Feature wirklich live geht

- Widerruf / Preisangaben / Checkout-Recht
- redaktionell Verantwortlicher
- VSBG-Schlichtungshinweis je nach Mitarbeiterzahl und Teilnahmebereitschaft

## Quellen

- [§ 5 DDG](https://www.gesetze-im-internet.de/ddg/__5.html)
- [§ 25 TDDDG](https://www.gesetze-im-internet.de/ttdsg/__25.html)
- [Art. 13 DSGVO / EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/art_13/oj/eng)
- [§ 36 VSBG](https://www.gesetze-im-internet.de/vsbg/__36.html)
- [MStV § 18 (offizielle Landesrechtsquelle)](https://www.gesetze-bayern.de/Content/Document/MStV-18)
- [DSA Nutzerrechte / Europaeische Kommission](https://digital-strategy.ec.europa.eu/en/factpages/user-rights-under-digital-services-act)
- [DSA Notice-and-Action / Europaeische Kommission](https://digital-strategy.ec.europa.eu/en/policies/dsa-notice-and-action-mechanism)
- [EUR-Lex: Verordnung (EU) 2024/3228 zur Einstellung der ODR-Plattform](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32024R3228)

## Hinweis

Dieses Dokument ist eine operative Go-Live- und Compliance-Checkliste, keine Rechtsberatung. Fuer Impressum, Datenschutz, DSA-/UGC-Prozesse und spaetere B2C-Checkout-Texte solltet ihr vor oeffentlichem Launch einmal anwaltlich oder datenschutzrechtlich gegenlesen lassen.
