# PerfectDay24 Gamification Concept

## Zielbild

Gamification in `perfectday24` sollte sich nicht wie ein klassisches Mobile-Game anfuehlen. Der richtige Rahmen ist:

- persoenliche Stadtreise
- kuratorische Reputation
- soziale Anerkennung

Die Nutzer sollen nicht fuer Masse belohnt werden, sondern fuer gute, interessante und wiederverwendbare Tagesplaene.

Das System muss drei Fragen beantworten:

1. Was habe ich in dieser Stadt schon erlebt oder kuratiert?
2. Wofuer bin ich auf `perfectday24` bekannt?
3. Was ist mein naechster sinnvoller Fortschritt?

## Produktprinzipien

- Keine laute XP-Show auf jeder Seite
- Keine Belohnung fuer Spam-Verhalten
- Keine harte globale Rangliste im MVP
- Fortschritt soll hochwertig, urban und persoenlich wirken
- Sichtbarkeit nur dort, wo sie Vertrauen oder Motivation erhoeht

## Systemarchitektur

Das System besteht aus 4 Ebenen:

1. `Badges`
   Dauerhafte Auszeichnungen fuer erreichte Meilensteine
2. `Progress`
   Sichtbarer Fortschritt auf dem Weg zum naechsten Badge
3. `Titel`
   Ein aktiver, oeffentlich sichtbarer Profil-Titel
4. `Score`
   Eine interne Punktewährung fuer Balance, Reihenfolge und Level

## Empfohlene Kernlogik

### 1. Badge-Kategorien

#### A. Explorer
Fuer Nutzer, die selbst planen, testen, speichern und entdecken.

Beispiele:

- `Erster Perfect Day`
- `Wochenendplaner`
- `Stadtentdecker`
- `Kontrastsammler`
- `Nachtmensch`

#### B. Curator
Fuer Nutzer, die eigene Routen erstellen und veroeffentlichen.

Beispiele:

- `Erste oeffentliche Route`
- `Beliebt gespeichert`
- `Sauber kuratiert`
- `Lokaler Guide`
- `Top Route der Woche`

#### C. Social
Fuer Gruppenplanung, Teilen, Reaktionen und kollaboratives Verhalten.

Beispiele:

- `Gastgeber`
- `Crew-Favorit`
- `Erster geteilte Plan`
- `Gruppenmoderator`

#### D. City Identity
Fuer wiederkehrende Aktivitaet in einer Stadt oder einem Stil.

Beispiele:

- `Berlin Walker`
- `Hamburg Night Explorer`
- `Museum Hopper`
- `Cafe Scout`

### 2. Titel-System

Titel sind die sichtbare, hochwertigere Form der Gamification.

Ein Nutzer kann einen aktiven Titel waehlen, zum Beispiel:

- `Kultur-Navigator`
- `Date Curator`
- `Night Explorer`
- `Food Scout`
- `Local Tastemaker`

Regel:

- Titel werden durch Badge-Gruppen freigeschaltet
- im Profil ist ein Titel aktiv
- im oeffentlichen Profil werden hoechstens 1 Titel und 3 Featured-Badges gezeigt

### 3. Score-System

Punkte sollten im Hintergrund existieren, aber im MVP nicht dominant sein.

Empfehlung:

- `Explorer Score`
- `Curator Score`
- `Social Score`
- `Total Reputation`

So kann spaeter differenziert werden, statt alles in einer Zahl zu vermischen.

## Punktelogik

### Empfehlte Startwerte

#### Explorer Actions

- Profil mit Interessen ausfuellen: `20`
- ersten Plan erzeugen: `25`
- ersten Plan speichern: `20`
- Route als Vorlage in den Planner uebernehmen: `10`
- Route tatsaechlich starten: `15`
- Plan mit mindestens 4 Stops abschliessen: `30`
- neuen Stadtteil oder neue Stadt entdecken: `20`

#### Curator Actions

- erste Route erstellen: `30`
- Route veroeffentlichen: `40`
- Route mit Cover, Beschreibung und mindestens 4 Stops: `25`
- erster Bookmark auf eigene Route: `15`
- erster Like auf eigene Route: `10`
- erste Bewertung auf eigene Route: `15`
- 5 Bookmarks auf eine Route: `30`
- Durchschnitt 4.5+ bei mindestens 5 Ratings: `60`

#### Social Actions

- erste Gruppenplanung starten: `20`
- erste Person einladen: `10`
- Plan erfolgreich teilen: `15`
- gemeinsam abgestimmte Auswahl finalisieren: `25`
- Freund folgt deinem Creator-Profil: `10`

### Punktebalance

- einfache Erstaktionen: `10-25`
- qualitaetsrelevante Aktionen: `25-60`
- seltene oder reputationsstarke Aktionen: `60-150`

Wichtig:

- Likes und Saves duplizieren nicht endlos Score
- wiederholbare Aktionen brauchen Tages- oder Lebenszeit-Limits
- Qualitaet muss mehr zaehlen als Volumen

## Level-System

Ich wuerde kein dominantes RPG-Level anzeigen, aber intern mit 5 Reputation-Stufen arbeiten.

- `1`: Newcomer `0-99`
- `2`: Explorer `100-249`
- `3`: Curator `250-499`
- `4`: Local Guide `500-899`
- `5`: Tastemaker `900+`

Im UI sollte eher der Titel sichtbar sein als das Level.

## Badge-Vorschlaege fuer MVP

### Explorer

1. `Erster Perfect Day`
   Freischaltung: erster gespeicherter Plan oder erste uebernommene Route

2. `Wochenendplaner`
   Freischaltung: 3 gespeicherte oder erzeugte Plaene

3. `Stadtentdecker`
   Freischaltung: 5 gespeicherte Routen aus mindestens 2 Stadtbereichen oder 2 Staedten

4. `Kontrastsammler`
   Freischaltung: Plaene mit mindestens 4 unterschiedlichen Kategorien wie Kultur, Food, Outdoor, Nightlife

### Curator

5. `Erste oeffentliche Route`
   Freischaltung: erste oeffentliche Route publiziert

6. `Sauber kuratiert`
   Freischaltung: Route mit Cover, Beschreibung, Startpunkt und mindestens 4 Stops

7. `Beliebt gespeichert`
   Freischaltung: eine eigene Route erreicht 5 Saves

8. `Empfohlen`
   Freischaltung: erste Bewertung auf eigener Route

### Social

9. `Gastgeber`
   Freischaltung: erste Gruppenplanung gestartet

10. `Crew-Favorit`
    Freischaltung: eine eigene Route wurde von mindestens 3 unterschiedlichen Nutzern gespeichert oder uebernommen

### City Identity

11. `Berlin Walker`
    Freischaltung: 3 Fuss-Routen oder Plaene in Berlin

12. `Night Explorer`
    Freischaltung: 3 Nightlife-bezogene Plaene oder Routen

## Badge-Typen

Jeder Badge braucht einen klaren Typ, damit UI und Datenmodell stabil bleiben.

- `milestone`
- `quality`
- `social`
- `city`
- `seasonal`
- `limited`

Beispiele:

- `Erste oeffentliche Route` = `milestone`
- `Beliebt gespeichert` = `social`
- `Sauber kuratiert` = `quality`
- `Berlin Walker` = `city`

## Seltenheitsstufen

Optional, aber stark fuer Motivation:

- `Core`
- `Rare`
- `Signature`

Nicht mehr als drei Stufen im MVP.

## UI-Integration

### 1. Eigenes Profil

Ort:
[app/profile/page.tsx](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/app/profile/page.tsx:1523)

Empfehlung:

- neue Karte `Deine Auszeichnungen`
- zeigt aktive Titelzeile
- zeigt 3 freigeschaltete Featured-Badges
- zeigt `naechster Badge` mit Fortschrittsbalken

Beispiel:

- Titel: `Berlin Walker`
- Badges: `Erster Perfect Day`, `Sauber kuratiert`, `Gastgeber`
- Fortschritt: `2 von 3 Nightlife-Routen fuer Night Explorer`

### 2. Oeffentliches Profil

Ort:
[app/u/[username]/page.tsx](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/app/u/[username]/page.tsx:1)

Empfehlung:

- 1 aktiver Titel unter dem Namen
- 3 Featured-Badges neben oder unter Profilstats
- keine komplette Badge-Wand auf der ersten Ausbaustufe

Ziel:

- Vertrauen
- Differenzierung zwischen normalen Nutzern und starken Curators

### 3. Route-Detailseite

Ort:
[app/routes/[slug]/page.tsx](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/app/routes/[slug]/page.tsx:1890)

Empfehlung:

- kleine Creator-Badges im Creator-Block
- optional `Badge earned by saving this route` fuer Nutzer nur sehr sparsam
- keine Badge-Ueberladung im Hero

Geeignet:

- `Beliebt gespeichert`
- `Top bewertet`
- `Berlin Walker`

### 4. Planner

Ort:
[app/planner/page.tsx](/C:/Users/AlexBugajew/SynologyDrive/Dokumente/ECB/PD24/perfectday24/app/planner/page.tsx:486)

Empfehlung:

- nur kleine Fortschrittsmomente
- nach erfolgreicher Uebernahme oder Planung:
  - `Badge freigeschaltet`
  - `Fortschritt aktualisiert`

Nicht machen:

- keine laute Gamification mitten im Planungsflow

## Datenmodell

### Neue Tabellen

#### `badge_definitions`

- `id`
- `key`
- `name`
- `description`
- `category`
- `badge_type`
- `rarity`
- `icon_key`
- `city_slug` nullable
- `threshold_config` jsonb
- `points_reward`
- `is_active`
- `created_at`

#### `user_badges`

- `id`
- `user_id`
- `badge_id`
- `unlocked_at`
- `source_context` jsonb
- unique `(user_id, badge_id)`

#### `user_badge_progress`

- `id`
- `user_id`
- `badge_id`
- `progress_value`
- `progress_target`
- `updated_at`

#### `user_reputation`

- `user_id`
- `explorer_score`
- `curator_score`
- `social_score`
- `total_score`
- `active_title_badge_id`
- `updated_at`

### Warum dieses Modell sinnvoll ist

- Badge-Definitionen bleiben zentral steuerbar
- Progress kann getrennt vom Unlock gepflegt werden
- Scores koennen spaeter neu gewichtet werden
- Titel koennen aus Badges abgeleitet werden

## Freischaltlogik

Empfehlung fuer den Start:

- bei klaren Einzelereignissen direkt pruefen
- bei aggregierten Metriken ueber SQL-Refresh oder Background-Job

### Event-getrieben

- Route erstellt
- Route publiziert
- Route gespeichert
- Route geliked
- Route bewertet
- Gruppenplanung gestartet
- Route in Planner uebernommen

### Aggregat-getrieben

- Summe der Saves
- Durchschnittsbewertung
- Anzahl oeffentlicher Routen
- Anzahl Stadt- oder Kategorie-Kombinationen

## Anti-Spam-Regeln

Sehr wichtig fuer Datenqualitaet:

- Punkte fuer Like/Save auf eigene Route: `0`
- Punkte fuer private Test-Routen stark begrenzen
- nur oeffentliche oder sinnvolle Routen fuer Curator-Badges zaehlen
- Daily Caps fuer wiederholbare Aktionen
- Badge-Freischaltung nur einmal pro Badge

## KPI-Ziele

Das System sollte nicht nur motivieren, sondern Produktziele stuetzen.

Primaere KPIs:

- mehr vollstaendige Profile
- mehr gespeicherte Plaene
- mehr oeffentliche Routen
- mehr Route-Bookmarks
- mehr Gruppenplanungen
- mehr Route-to-Planner-Handoffs

Sekundaere KPIs:

- hoehere Wiederkehr
- mehr Profilaufrufe
- mehr Creator-Follows

## Empfohlener MVP

### Scope

- 12 Badges
- 3 Kategorien sichtbar
- 1 aktiver Titel
- 1 Profilmodul
- 1 oeffentliches Profilmodul
- kleine Unlock-Toasts

### Noch nicht im MVP

- globale Ranglisten
- saisonale Events
- taegliche Quests
- komplexer Shop oder virtuelle Waehrung
- Badge-Sharing in Social Media

## Spätere Ausbaustufen

### Phase 2

- Stadtserien wie `5 Tage in Berlin`
- saisonale Badges wie `Summer Rooftop`
- Gruppenbadges fuer gemeinsame Planung
- Creator-Medaillen fuer Reichweite und Qualitaet

### Phase 3

- lokale Challenges
- Wochenformate
- Partner- oder Event-bezogene Spezialbadges
- Editorial Collections mit Freischaltung

## Konkrete Integrationsempfehlung fuer jetzt

Der sinnvollste erste Schritt ist nicht, sofort Punkte ueberall einzubauen.

Stattdessen:

1. `Badge-Definitionen + Nutzer-Badges` als Datenmodell anlegen
2. `Deine Auszeichnungen` im eigenen Profil bauen
3. `Aktiver Titel + 3 Featured-Badges` im oeffentlichen Profil anzeigen
4. nur 4-6 klare Trigger aktivieren:
   - erste Route erstellt
   - erste Route oeffentlich
   - erste Route gespeichert
   - erste Gruppenplanung
   - erste Bewertung erhalten
   - erste Route als Vorlage in den Planner uebernommen

So bleibt der Einstieg einfach, hochwertig und messbar.

## Meine Produktempfehlung

Wenn `perfectday24` Gamification einfuehrt, dann als:

- `Ich entdecke meine Stadt`
- `Ich kuratiere gute Tage`
- `Ich werde als Geschmackstraeger sichtbar`

Nicht als:

- `Ich grinde Punkte`

Das ist der Unterschied zwischen einer hochwertigen urbanen Produktidentitaet und einem beliebigen Engagement-Layer.
