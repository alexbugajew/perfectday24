# PWA: Service Worker, Updates und Kill-Switch

Stand: 12.10.2026 · Dateien: `public/sw.js`, `public/offline.html`,
`components/pwa/ServiceWorkerRegistration.tsx`, `app/manifest.ts`,
`/sw.js`-Header in `next.config.ts`.

## Was der Worker tut — und was nie

Der Worker ist absichtlich nur ein Offline-Fallback. Er macht die Seite
installierbar (PWA, später TWA im Play Store) und zeigt ohne Netz eine
eigene Offline-Seite statt des Browser-Dinos.

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
der offenen Tabs: Weil die Seite `/sw.js` bei jedem Aufruf registriert, entstünde
sonst eine Reload-Schleife.

Im selben Deploy auch Weg 1 setzen. Sonst registriert die Seite den
Notfall-Worker bei jedem Aufruf neu. Das schadet nicht, kostet aber unnötig
Requests.

### Einzelnes Gerät (Support-Fall)

- Chrome/Edge: DevTools → Application → Service Workers → *Unregister*, dann
  Storage → *Clear site data*.
- Android-App (installiert): App-Info → Speicher → *Speicher leeren*.
- iOS: Einstellungen → Safari → Erweitert → Website-Daten → perfectday24.de
  löschen.

## Lokal testen

Im Dev-Modus registriert sich der Worker nie. Ein Worker aus einem früheren
lokalen `next start` wird beim nächsten `next dev`-Seitenaufruf automatisch
abgemeldet. Zum Testen: `npm run build && npm run start`, dann in den DevTools
unter Network auf *Offline* stellen und eine Seite neu laden.
