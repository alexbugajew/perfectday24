# Web-Analytics: Einrichtung und Instrumentierung

Stand: 18.08.2026

## Warum überhaupt

Vor dem Launch war im Code **keine** Reichweiten- oder Funnel-Messung vorhanden.
Ohne sie lässt sich weder beurteilen, ob eine Anzeige funktioniert, noch wo im
Produkt Nutzer abbrechen. Das ist die Voraussetzung dafür, dass bezahlte
Werbung überhaupt sinnvoll geschaltet werden kann.

Bewusst getrennt bleiben zwei Dinge:

- **`lib/monetization`** — die interne Attribution: welcher Partner, welcher
  Klick, welche Vergütung. Erste-Partei-Buchführung in der eigenen Datenbank,
  einwilligungspflichtig, hohes Ereignisvolumen.
- **`lib/analytics`** (neu) — die Marketing-Sicht: Woher kommen Besucher, wie
  weit kommen sie im Funnel? Wenige, grobkörnige Ereignisse.

## Anbieter

Angebunden ist **Plausible** (EU-Hosting, cookielos, keine Speicherung auf dem
Endgerät). Daraus folgt:

- Keine Einwilligung nach § 25 Abs. 1 TTDSG nötig — die Messung läuft auch,
  wenn im Consent-Banner „Nur Notwendige" gewählt wurde. Wer das strenger
  handhaben will, setzt `NEXT_PUBLIC_ANALYTICS_REQUIRE_CONSENT=true`; das kostet
  erfahrungsgemäß den größten Teil der Daten.
- Das Skript wird über die **eigene Domain** ausgeliefert
  (`/pd/js/script.js` → Rewrite in `next.config.ts`). Damit bleibt die CSP bei
  `script-src 'self'`, und Werbeblocker filtern die Messung nicht heraus.

Ein Anbieter, der etwas auf dem Endgerät ablegt (GA4, Meta-Pixel), darf **nicht**
ohne `hasTrackingConsent()`-Gate eingehängt werden. Die Abstraktion in
`lib/analytics/client.ts` ist so gebaut, dass ein solcher Anbieter dort ergänzt
werden kann, ohne die Aufrufstellen anzufassen.

## Einrichtung (einmalig)

1. Konto bei plausible.io anlegen, Site `perfectday24.de` hinzufügen.
2. In Vercel setzen: `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=perfectday24.de`.
   Ohne diese Variable ist die Messung vollständig inaktiv — kein Skript, keine
   Ereignisse.
3. In Plausible unter *Site Settings → Goals* die unten gelisteten Ereignisse
   als Custom Events anlegen. Ohne diesen Schritt kommen die Ereignisse zwar an,
   werden aber nicht als Ziel ausgewiesen.
4. Unter *Site Settings → Custom Properties* die Properties freischalten, die
   ausgewertet werden sollen (`city`, `occasion`, `channel`, `plan`, `target`).
5. Zur Kontrolle vor dem Launch: `NEXT_PUBLIC_ANALYTICS_DEBUG=true` setzen —
   dann schreibt jeder Aufruf zusätzlich in die Browser-Konsole, auch wenn keine
   Domain konfiguriert ist.

## Gemessene Ereignisse

| Ereignis | Ausgelöst wo | Properties |
|---|---|---|
| `plan_generated` | Planner, sobald ein Plan mit Stopps entsteht | `city`, `occasion`, `mode`, `stops` |
| `plan_saved` | Plan wurde dauerhaft gespeichert | `city` |
| `plan_shared` | Share-Link kopiert bzw. in den Gruppenchat gegeben | `channel`, `city`, `group` |
| `shared_plan_opened` | Gast öffnet einen geteilten Plan (`/p/<token>`) | `occasion` |
| `shared_plan_copied` | Gast übernimmt den geteilten Plan | `city` |
| `invite_opened` | Gruppen-Einladung geöffnet (`/events/agenda/<token>`) | `occasion` |
| `route_copied` | Redaktions-/Creator-Route als Vorlage übernommen | `city`, `target` |
| `signup_completed` | Registrierung abgeschlossen | `method` |
| `checkout_started` | Stripe-Checkout gestartet | `plan`, `interval` |
| `partner_lead` | Klick auf einen Partner-Akquise-CTA | `surface` |

Die drei Leitzahlen für den Launch sind das Verhältnis
`plan_generated → plan_shared → shared_plan_opened`: Es beschreibt, ob der
Teilen-Loop trägt, der laut Wettbewerbsanalyse der eigentliche Wachstumskanal
sein soll.

### Was bewusst nicht gemessen wird

- Seitenaufrufe zählt das Plausible-Skript selbst, auch bei Client-Navigation
  über die History-API. Eine eigene Pageview-Instrumentierung würde doppelt
  zählen.
- Der **Abschluss** eines Abos wird hier nicht gemeldet — er passiert bei
  Stripe und landet über den Webhook in der Datenbank. `checkout_started` ist
  die letzte im Browser messbare Stufe.
- Bei Anmeldung über Google/Microsoft ist am Callback nicht unterscheidbar, ob
  jemand neu ist oder sich nur wieder anmeldet. `signup_completed` greift dort
  auf die Heuristik „Konto jünger als fünf Minuten" zurück
  (`maybeTrackFreshSignup` in `app/profile/page.tsx`). Der E-Mail-Pfad meldet
  sich exakt.

## Regel für neue Ereignisse

Erst in `lib/analytics/events.ts` eintragen (Name + erlaubte Properties), dann
aufrufen. Properties mit hoher Kardinalität — IDs, Tokens, Freitext,
E-Mail-Adressen — gehören nie hinein: Sie machen die Auswertung unbrauchbar und
wären personenbeziehbar.
