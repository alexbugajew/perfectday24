/* Service Worker: minimaler Offline-Fallback für Navigationen.
   Bewusst keine Laufzeit-Caches für Seiten oder APIs — Pläne, Events und
   Auth-Zustand dürfen nie veraltet aus einem Cache kommen. Der Worker
   existiert für die Installierbarkeit (PWA, später TWA im Play Store)
   und eine saubere Offline-Seite statt des Browser-Dinos. */

const CACHE = "pd24-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Alte Cache-Versionen räumen, damit ein Deploy mit neuem CACHE-Namen
  // keine verwaisten Einträge zurücklässt.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Nur Seiten-Navigationen abfangen; Assets, API- und Auth-Requests
  // laufen unverändert am Worker vorbei.
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_URL).then((cached) => cached ?? Response.error())
    )
  );
});
