# PWA: Service Worker, Updates und Kill-Switch

Stand: 12.10.2026 · Dateien: `public/sw.js`, `public/offline.html`,
`components/pwa/ServiceWorkerRegistration.tsx`, `app/manifest.ts`,
`/sw.js`-Header in `next.config.ts`, `/sw.js` ausgenommen im `proxy.ts`-Matcher.

## Wann der Worker registriert wird — nur in der installierten App

| Kontext | Verhalten |
| --- | --- |
| Normaler Browser-Tab (`display-mode: browser`, auch Vollbild per F11/Video) | **Keine** Registrierung, kein Cache Storage. Ein früher registrierter pd24-Worker wird abgemeldet, `pd24-offline-*`-Caches werden gelöscht. |
| Installierte App (`display-mode: standalone` oder `minimal-ui`, iOS `navigator.standalone`) | Registrierung bei jedem Seitenaufruf (idempotent). |
| Desktop: Tab wird nach „Installieren“ ins App-Fenster verschoben | Registrierung über das `change`-Event, ohne Reload. |
| Dev-Modus oder Kill-Switch | Nie registrieren, vorhandenen Worker abmelden. |

Warum: Der Worker legt beim Install Offline-Seite und Logo im Cache Storage
ab. Das ist ein Endgerätezugriff nach § 25 TDDDG. Ohne Einwilligung zulässig
ist er nur, wenn er für einen ausdrücklich gewünschten Dienst unbedingt
erforderlich ist (§ 25 Abs. 2 Nr. 2). Beim normalen Website-Besuch ist er das
nicht, in der vom Nutzer installierten App mit Offline-Hinweis schon. Die
Datenschutzerklärung (Abschnitt 4) nennt das in einem Satz.

`fullscreen` zählt bewusst nicht als installiert: Der Modus greift auch im
normalen Browser (F11, Fullscreen-API bei Videos oder der Karte). Falls eine
spätere TWA im Immersive-Modus (`fullscreen`) läuft, die Erkennung dort z. B.
über `document.referrer` (`android-app://…`) ergänzen.

**Installierbarkeit hängt nicht am Worker.** Der Next-PWA-Guide
(`node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`,
Abschnitt „Adding to Home Screen“) nennt als Voraussetzungen nur ein gültiges
Web-App-Manifest und HTTPS. Moderne Browser zeigen den Install-Prompt dann
automatisch. Im selben Guide (Abschnitt „Implementing Web Push
Notifications“) heißt es ausdrücklich, dass Install-Prompts ohne
Offline-Support funktionieren.

### Plattform-Eigenheiten

- **Android (Chrome, WebAPK):** Installierte App und Chrome-Browser teilen
  sich den Speicher der Origin. Ein normaler Tab mit perfectday24.de meldet
  den Worker der App deshalb ab; der nächste App-Start registriert ihn neu.
  Nur wer die App direkt danach offline startet, sieht einmal den
  Browser-Fehler statt der Offline-Seite. Das ist der bewusste Preis dafür,
  dass im Browser nie etwas liegen bleibt.
- **iOS (Home-Bildschirm-App):** Die installierte App hat einen **eigenen,
  von Safari getrennten Speicher** — Cookies, `localStorage` und Service
  Worker. Folgen:
  - Wer in Safari angemeldet ist, ist in der App zunächst abgemeldet und muss
    sich dort erneut anmelden (und umgekehrt).
  - Links aus Mails (Konto-Bestätigung, Passwort zurücksetzen) öffnen in
    Safari, nicht in der App. Die Anmeldung landet dann im Safari-Speicher.
    Im Support-Fall: in der App selbst mit Passwort anmelden.
  - Lokale Planner-Einstellungen und Entwürfe aus Safari fehlen in der App.
  - Der Worker der App ist für Safari unsichtbar; ein Safari-Besuch meldet
    ihn also nicht ab.

## Was der Worker tut — und was nie

Der Worker ist absichtlich nur ein Offline-Fallback in der installierten App
(PWA, später TWA im Play Store): Ohne Netz zeigt er eine eigene Offline-Seite
statt des Browser-Dinos.

| Request | Verhalten |
| --- | --- |
| Seiten-Navigation (GET, eigene Origin) | Netz zuerst, per Navigation Preload. Nur wenn das Netz komplett fehlt: `offline.html`. HTTP-Fehler (404/500) kommen unverändert durch. |
| Navigation unter `/api/` oder `/preview-login` | Nur Netz, kein Offline-Fallback. |
| `/icons/icon-192.png` | Netz zuerst, Cache nur ohne Verbindung (Logo der Offline-Seite). |
| Alles andere (JS, CSS, RSC, `/api/*`-Fetches, Bilder) | Kein `respondWith` — läuft am Worker vorbei ans Netz. |
| Fremde Origins (Supabase, Stripe, Bild-CDNs, Plausible) | Werden nicht angefasst. |

In den Cache kommen ausschließlich `offline.html` und das Offline-Icon, und
zwar nur beim Install. Keine HTML-Seiten, keine API- oder Supabase-Antworten,
nichts aus `/profile`, `/saved`, `/p/<token>` oder `/admin`. Der Worker darf
per eigener CSP (`default-src 'self'`) technisch keine Drittinhalte laden.

## Updates

- `sw.js` wird mit `Cache-Control: no-store` ausgeliefert und mit
  `updateViaCache: "none"` registriert. Der Browser prüft bei jeder Navigation,
  ob sich `sw.js` geändert hat.
- Ein neuer Worker aktiviert sich sofort (`skipWaiting` + `clients.claim`). Das
  ist nur deshalb unbedenklich, weil der Worker keine Seiten oder JS-Chunks
  vorhält. Wer Laufzeit-Caches für HTML/JS ergänzt, muss das neu bewerten.
- Normale Deploys brauchen keine Änderung am Worker: Seiten und Assets kommen
  ohnehin immer aus dem Netz.
- **Bei Änderungen an `offline.html` oder dem Offline-Icon** `VERSION` in
  `public/sw.js` hochzählen. Erst geänderter `sw.js`-Inhalt löst die
  Neuinstallation aus. Alte `pd24-offline-*`-Caches werden dann beim Aktivieren
  gelöscht.

## Kill-Switch: Worker notfalls abschalten

### Weg 1 — Env-Variable (Normalfall, kein Code)

1. In Vercel (Production) `NEXT_PUBLIC_DISABLE_SERVICE_WORKER=true` setzen.
2. Neu deployen. `NEXT_PUBLIC_*` wird beim Build eingebacken, nur die Variable zu
   setzen reicht nicht.
3. Jeder Besucher meldet beim nächsten Seitenaufruf den Worker ab und löscht die
   `pd24-offline-*`-Caches. Das funktioniert, weil der Worker nie HTML oder JS
   aus dem Cache liefert: Der neue Registrierungscode kommt immer frisch an.

Rückgängig: Variable entfernen und neu deployen.

### Weg 2 — Selbstauflösender Worker (wenn der Worker selbst kaputt ist)

Falls der Worker Seiten gar nicht mehr ausliefert, kommt auch der Code aus
Weg 1 nicht mehr an. Dann den Inhalt von `public/sw.js` vollständig durch
Folgendes ersetzen und deployen. Den Pfad `/sw.js` nicht ändern, sonst sehen
installierte Worker das Update nie:

```js
// Notabschaltung: kein fetch-Handler, meldet sich selbst ab und räumt die
// eigenen Caches.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith("pd24-offline-")).map((key) => caches.delete(key))
      );
      await self.registration.unregister();
    })()
  );
});
```

Browser prüfen `sw.js` bei jeder Navigation ohne HTTP-Cache. Sobald dieser
Worker aktiv ist, gehen alle Requests ohne Umweg ans Netz, weil er keinen
fetch-Handler hat. Danach meldet er sich ab. Bewusst ohne erzwungenes Neuladen
der offenen Tabs: Weil die installierte App `/sw.js` bei jedem Aufruf
registriert, entstünde sonst eine Reload-Schleife.

Im selben Deploy auch Weg 1 setzen. Sonst registriert die installierte App den
Notfall-Worker bei jedem Aufruf neu. Das schadet nicht, kostet aber unnötig
Requests.

### Einzelnes Gerät (Support-Fall)

- Chrome/Edge: DevTools → Application → Service Workers → *Unregister*, dann
  Storage → *Clear site data*.
- Android-App (installiert): App-Info → Speicher → *Speicher leeren*.
- iOS-App (Home-Bildschirm): App entfernen und neu hinzufügen. Sie hat
  eigenen Speicher, den das Löschen der Safari-Website-Daten nicht
  zuverlässig erfasst.
- Safari auf iOS registriert keinen Worker mehr; alte Reste räumt der nächste
  Seitenaufruf ab. Sonst: Einstellungen → Safari → Erweitert → Website-Daten
  → perfectday24.de löschen.

## Lokal testen

Im Dev-Modus registriert sich der Worker nie. Ein Worker aus einem früheren
lokalen `next start` wird beim nächsten `next dev`-Seitenaufruf automatisch
abgemeldet. Zum Testen: `npm run build && npm run start`, dann die Seite in
Chrome als App installieren (Adressleiste → *App installieren*; `localhost`
gilt als sicherer Kontext) und im App-Fenster in den DevTools unter Network auf
*Offline* stellen und neu laden. Im normalen Tab muss Application → Service
Workers leer bleiben.

Automatisiert per CDP: Headless-Chrome mit `--incognito --app=<url>` meldet
im App-Fenster nativ `display-mode: standalone`, ohne echte Installation.
`Emulation.setEmulatedMedia` ignoriert `display-mode` (geprüft mit Chrome 155),
und die CDP-Domain `PWA.*` fehlt im Headless-Modus.
