/* Service Worker: Offline-Fallback für Seiten-Navigationen — sonst nichts.

   Warum so schmal: Pläne, Events, Profile, geteilte Pläne (/p/<token>) und
   Auth-Zustand dürfen nie veraltet oder personenbezogen aus einem Cache
   kommen. Der Worker existiert für die Installierbarkeit (PWA, später TWA im
   Play Store) und eine saubere Offline-Seite statt des Browser-Dinos.

   Harte Regeln (vor jeder Erweiterung lesen):
   - In den Cache kommt ausschließlich OFFLINE_ASSETS, und zwar nur beim
     Install. Kein cache.put() zur Laufzeit — keine HTML-Seiten, keine
     /api/-Antworten, keine Supabase-Antworten, keine Bilder.
   - Seiten nur network-first; der Cache ist nur der Rückfall, wenn das Netz
     komplett fehlt (fetch wirft), nicht bei 4xx/5xx.
   - Nur eigene Origin. Fremde Requests (Supabase, Stripe, Bild-CDNs,
     Plausible-Upstream) laufen ungesehen vorbei; der Worker lädt selbst
     keine Drittinhalte (zusätzlich per CSP in next.config.ts abgesichert).

   Notabschaltung (Kill-Switch) und Update-Verhalten: docs/pwa-service-worker.md */

// Bei jeder Änderung an offline.html oder dem Offline-Icon hochzählen. Erst ein
// geänderter sw.js-Inhalt löst beim Browser eine Neuinstallation aus; ohne
// neue Version bliebe die alte Offline-Seite im Cache stehen.
const VERSION = "2026-10-12";
const CACHE_PREFIX = "pd24-offline-";
const CACHE = `${CACHE_PREFIX}${VERSION}`;
const OFFLINE_URL = "/offline.html";
const OFFLINE_ASSETS = [OFFLINE_URL, "/icons/icon-192.png"];

// Navigationen ohne Offline-Fallback: Direkt aufgerufene API-Routen (Downloads,
// Exporte) und der Preview-Login sollen sich exakt wie ohne Worker verhalten,
// inklusive des normalen Netzwerkfehlers des Browsers. OAuth- und Stripe-
// Rückkehr landen dagegen auf /profile und bekommen die Offline-Seite: Sie
// steht unter der Original-URL, "Erneut versuchen" behält also ?code= bzw.
// ?payment= und setzt den Fluss fort, sobald das Netz zurück ist.
const NO_FALLBACK_PREFIXES = ["/api/", "/preview-login"];

async function precacheOfflineAssets() {
  const cache = await caches.open(CACHE);
  await Promise.all(
    OFFLINE_ASSETS.map(async (path) => {
      // cache: "reload" umgeht den HTTP-Cache, damit eine neue Worker-Version
      // nicht die Offline-Seite des Vorgänger-Deploys einlagert.
      const response = await fetch(new Request(path, { cache: "reload" }));
      // Kein umgeleiteter oder fehlerhafter Inhalt in den Cache (z. B. die
      // Preview-Login-Seite bei aktivem Lock). Lieber scheitert der Install —
      // die Seite funktioniert dann einfach ohne Worker, der Browser versucht
      // es bei der nächsten Navigation erneut.
      if (!response.ok || response.redirected) {
        throw new Error(`Offline-Asset nicht cachebar: ${path} (${response.status})`);
      }
      await cache.put(path, response);
    })
  );
}

self.addEventListener("install", (event) => {
  // skipWaiting ist hier bewusst unbedenklich: Der Worker hält keine Seiten
  // oder JS-Chunks vor, ein sofort aktiver neuer Worker kann also keine
  // alten und neuen Deploy-Stände mischen. Dafür greifen Fixes und der
  // Kill-Switch sofort statt erst nach dem Schließen aller Tabs.
  // Wer je Laufzeit-Caches für HTML/JS ergänzt, muss das neu bewerten.
  event.waitUntil(precacheOfflineAssets().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Nur eigene Alt-Caches löschen; andere Cache-Storage-Nutzer derselben
      // Origin (z. B. künftige Bibliotheken) bleiben unberührt.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key))
      );
      // Navigation Preload: Der Request startet parallel zum Hochfahren des
      // Workers. Ohne das hängt jede Navigation zusätzlich an der Startzeit
      // des Workers (auf schwachen Android-Geräten spürbar).
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })()
  );
});

async function offlineResponse(path) {
  const cache = await caches.open(CACHE);
  return (await cache.match(path)) ?? Response.error();
}

async function fromNetwork(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
  } catch {
    // Preload abgebrochen oder ohne Netz — regulärer fetch entscheidet.
  }
  return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // Auch Navigationen ohne Fallback gehen über respondWith: Bei aktivem
    // Navigation Preload würde ein Durchwinken ohne respondWith den Request
    // ein zweites Mal ans Netz schicken (doppelte GET-Aufrufe z. B. auf
    // Callback-Routen).
    const network = fromNetwork(event);
    const noFallback = NO_FALLBACK_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
    event.respondWith(noFallback ? network : network.catch(() => offlineResponse(OFFLINE_URL)));
    return;
  }

  // Das Logo der Offline-Seite: auch hier zuerst das Netz, der Cache nur ohne
  // Verbindung — sonst wäre die Offline-Seite ohne Bild.
  if (OFFLINE_ASSETS.includes(url.pathname) && url.pathname !== OFFLINE_URL) {
    event.respondWith(fetch(request).catch(() => offlineResponse(url.pathname)));
  }
  // Alles andere (JS, CSS, Bilder, API, RSC-Payloads) läuft ohne respondWith
  // direkt ans Netz, als gäbe es keinen Worker.
});
