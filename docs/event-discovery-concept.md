# Event-Entdeckung — Konzept

Stand: 20.08.2026. Ausgelöst durch den Befund, dass „Events" in der Navigation
nicht zu einer Event-Übersicht führt, sondern in den Event-Planer.

## 1. Der Befund stimmt

`/events` ist der **Event-Planer**: die Strecke, mit der jemand ein *eigenes*
Event plant — Geburtstag, JGA, Firmenfeier — inklusive „Meine Events"-Dashboard
unter `/events/dashboard`. Das Wort „Events" in der Hauptnavigation verspricht
aber das Gegenteil: *zeig mir, was läuft.*

Es sind also zwei verschiedene Produkte unter einem Wort. Wer auf „Events"
klickt, um zu sehen was am Wochenende los ist, landet in einem Planungsformular
für die eigene Feier. Das ist keine Geschmacksfrage, sondern ein Fehler in der
Informationsarchitektur.

Eine Event-Entdeckung fehlt heute vollständig. Events tauchen nur als Zutat im
Tagesplaner auf, nie als eigene Fläche.

## 2. Ist eine Event-Übersicht sinnvoll?

**Als Liste: nein. Als Einstieg in die Tagesplanung: ja, und zwar deutlich.**

Der Markt für Event-Listen ist der am dichtesten besetzte im ganzen Umfeld —
Rausgegangen, Eventim, die Stadtportale selbst, Google Events. Eine weitere
Liste hätte keine Daseinsberechtigung; sie wäre schlechter als die Portale, aus
denen sie ihre Daten zieht.

Der Unterschied liegt ausschließlich im zweiten Schritt, und der ist genau das,
was PerfectDay24 kann und niemand sonst anbietet: **das Event als Hauptmoment
nehmen und den Tag darum herum bauen.** Was vorher, was danach, mit welchen
Wegen und realistischen Zeitfenstern.

Daraus folgt eine harte Gestaltungsregel für alles Weitere: Die Liste ist Mittel
zum Zweck, nicht das Ziel. Jede Fläche muss den Weg in die Tagesplanung
sichtbar anbieten, sonst bauen wir das schwächere Produkt der Konkurrenz nach.

## 3. Was bereits existiert — mehr als erwartet

**Die Daten.** 8.979 Veranstaltungen in den nächsten 30 Tagen über 28 Städte,
rund 34.000 insgesamt. Quellen sind Ticketmaster und 49 offizielle
Stadtportale.

> Kleine Korrektur zur Annahme: **Eventim ist nicht angebunden.** Der
> Ticket-Anbieter im System ist Ticketmaster. Eventim wäre eine eigene
> Integration — machbar, aber nichts, worauf sich das Konzept heute stützen kann.

**Die Planungsmaschine.** Der Planner kann bereits alles, was für „Tag um ein
Event herum" nötig ist: `selectedEventId` als Anker, Event-Kandidaten je Stadt
und Datum, Zeitfenster-Sperre über `timingLock: "event"`, und die
Städte-Regression prüft seit heute für neun Fälle genau das — Event liegt im
Ablauf, danach folgt ein Ausklang, kein zweites Event.

**Die Lücke.** Der Planner liest `citySlug`, `occasion`, `experienceMode`,
`budget`, `planDate`, `interests`, `dayStartMin`, `planId` und `resume` aus der
URL — **aber kein `eventId`**. Eine Übersichtsseite kann ihm heute also kein
Event übergeben. Das ist das fehlende Glied, und es ist klein.

## 4. Was zuerst gelöst werden muss: die Kategorien

Die vorgeschlagene Aufteilung nach Kategorie ist richtig gedacht, scheitert
aber am heutigen Datenstand. Ist-Verteilung der nächsten 30 Tage:

| Kategorie | Anzahl | Taugt als Navigation? |
|---|---|---|
| `fair` | 1.861 | **Nein** — siehe unten |
| `show` | 947 | teilweise |
| `concert` | 810 | ja |
| `theater` | 737 | ja |
| `market` | 691 | ja |
| `festival` | 489 | ja |
| `food_event` | 402 | ja |
| `other` | 144 | nein |
| `seasonal` | 60 | ja |
| `sports` | 0 | existiert nicht |

**Die größte Kategorie ist falsch etikettiert.** `fair` heißt „Kirmes,
Jahrmarkt" — tatsächlich stehen dort überwiegend Ausstellungen und
Museumsprogramme:

```
[kiel]      Ausstellung "Farbenspiel" - Malerei von Wiebke Buch
[essen]     1000 Jahre Frauenpower - Schloß Borbeck und die FürstÄbtissinnen
[bonn]      Ausstellung: Liebe blüht aus Ruinen
[frankfurt] Junges Museum unterwegs
```

Das ist kein Parser-Fehler, sondern eine bewusste Notlösung: Die Taxonomie in
`lib/planner/types.ts` kennt schlicht keine Ausstellung, deshalb mappen die
Parser sie auf den nächstbesten Eimer — nachzulesen etwa in
`lib/events/official/aachen.ts:290`. Für den Planner reicht ein grober Eimer.
Als sichtbare Navigation wäre es ein Vertrauensbruch: Wer „Kirmes & Jahrmarkt"
anklickt, bekommt Malerei.

Von den fünf gewünschten Kategorien funktionieren heute zwei:

| gewünscht | Stand |
|---|---|
| Konzert | vorhanden (`concert`) |
| Markt | vorhanden (`market`) |
| Comedy | fehlt — steckt vermutlich in `show` |
| Ausstellung | fehlt — steckt in `fair` |
| Kirmes | nominell `fair`, faktisch von Ausstellungen überlagert |

**Konsequenz:** Die Taxonomie um `exhibition` und `comedy` erweitern und die
betroffenen Zeilen neu klassifizieren, *bevor* Kategorien zu Navigation werden.
Ohne diesen Schritt ist die ganze Fläche unbrauchbar.

## 5. Das Konzept

### Seitentypen

| URL | Zweck | Beständigkeit |
|---|---|---|
| `/events` | Einstieg: Stadt wählen, was läuft gerade | dauerhaft |
| `/events/<stadt>` | alles in einer Stadt, nach Zeit gefiltert | dauerhaft |
| `/events/<stadt>/<kategorie>` | „Konzerte in Köln" | dauerhaft |
| `/events/<stadt>/<event-slug>` | **Einstieg in die Tagesplanung** | flüchtig |

Der bestehende Event-Planer zieht dabei um — etwa auf `/feiern` oder
`/events/planen`. Der Namenskonflikt muss aufgelöst werden, sonst verschiebt
sich das Missverständnis nur.

### Die Kategorieseite

Zeitfilter als erstes Element (heute, dieses Wochenende, nächste 30 Tage), dann
Karten mit Titel, Beginn, Ort, Kategorie und Preisspanne. Auf jeder Karte zwei
Aktionen: **Ticket** und **Tag drumherum planen**. Die zweite ist die, die uns
von jeder anderen Liste unterscheidet — sie darf nie fehlen.

### Die Event-Detailseite — das eigentliche Produkt

Diese Seite gibt es sonst nirgends, und sie ist der Grund, das Ganze zu bauen.

Oben das Event als Hauptmoment mit Zeit, Ort, Preis und Ticketlink. Darunter
zwei Blöcke, serverseitig vorberechnet aus den vorhandenen Locations:

- **Davor** — zwei bis drei konkrete Vorschläge mit Gehzeit und passendem
  Zeitfenster („18:30 Abendessen im X, 8 Minuten zu Fuß")
- **Danach** — ein Ausklang in der Nähe, der zur Uhrzeit passt

Ein Knopf „Diesen Tag planen" öffnet den Planner mit dem Event als gesetztem
Anker. Von dort läuft alles Bestehende weiter: Varianten, Gruppe, Speichern,
Teilen.

Der Nutzer kommt also mit einer konkreten Absicht („ich will zu diesem Konzert")
und geht mit einem vollständigen Abend. Das ist die Umkehrung des heutigen
Planner-Einstiegs, der bei „Stadt und Anlass" beginnt — und für viele Menschen
der natürlichere Weg.

## 6. Auffindbarkeit — mit dem Verfallsproblem

Events sind flüchtig, Seiten über Events auch. Wer tausende Detailseiten
indexieren lässt, sammelt in drei Monaten tausende tote Seiten ein. Deshalb:

- **Indexiert werden die beständigen Flächen:** `/events/<stadt>` und
  `/events/<stadt>/<kategorie>`. Die Frage „Was ist am Samstag in Köln los?"
  wird jede Woche neu gestellt; die Seite dazu bleibt.
- **Event-Detailseiten bleiben auf `noindex`**, tragen aber
  `schema.org/Event`-Auszeichnung. Antwortmaschinen crawlen zum Zeitpunkt der
  Frage live — sie profitieren davon, ohne dass wir Index-Müll produzieren.
- **Abgelaufene Events** leiten auf die Kategorieseite ihrer Stadt weiter statt
  ins Leere zu laufen.

## 7. Risiken

**Die Datenqualität wird sichtbar.** Im Planner erscheint ein Event als einer
von vier Stopps; in einer Liste stehen hundert nebeneinander, und jeder Fehler
fällt auf. Bekannte offene Punkte: 10.679 geplante Events ohne `end_at`
(Dauer unbekannt), Dubletten zwischen Ticketmaster und Stadtquellen (der
`dedupe_shadow`-Mechanismus existiert, ist aber nicht auf eine Listenansicht
ausgelegt), uneinheitliche Titel.

**Die Wartungslast steigt.** Eine Liste ist nur so gut wie ihr schlechtester
Eintrag. Ohne laufende Qualitätskontrolle verfällt sie schneller, als sie Nutzen
stiftet.

**Der Wettbewerb ist erdrückend** — aber nur auf der Listenebene. Sobald der
Tag um das Event herum entsteht, gibt es keinen direkten Vergleich mehr.

## 8. Vorgeschlagene Reihenfolge

1. **Taxonomie erweitern** (`exhibition`, `comedy`) und die betroffenen Zeilen
   neu klassifizieren. Ohne diesen Schritt ist alles Weitere wertlos.
2. **`eventId` als Planner-Parameter.** Klein, und ab dann kann jede Fläche ein
   Event in die Planung übergeben.
3. **Event-Detailseite mit Davor/Danach.** Der eigentliche Produktwert. Lässt
   sich für eine Stadt prototypisch bauen und bewerten.
4. **Kategorie- und Stadtseiten** darüber legen.
5. **Namenskonflikt auflösen**, Event-Planer umziehen, Navigation anpassen.
6. **Erst dann Indexierung** und strukturierte Daten.

Schritt 1 und 2 sind Voraussetzung und zusammen überschaubar. Schritt 3 ist der
Punkt, an dem sich zeigt, ob die Idee trägt — und der sollte an einer Stadt
gemessen werden, bevor die Fläche breit ausgerollt wird.
