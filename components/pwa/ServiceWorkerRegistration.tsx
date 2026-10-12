"use client";

import { useEffect } from "react";

const SW_URL = "/sw.js";
const SW_CACHE_PREFIX = "pd24-offline-";

// Kill-Switch ohne Code-Änderung: NEXT_PUBLIC_DISABLE_SERVICE_WORKER=true in
// Vercel setzen und neu deployen. Weil der Worker nie HTML oder JS aus dem
// Cache liefert, lädt jeder Besucher beim nächsten Aufruf diesen Code frisch
// und meldet den alten Worker ab. Notfallweg bei kaputtem Worker:
// docs/pwa-service-worker.md.
const SW_DISABLED = process.env.NEXT_PUBLIC_DISABLE_SERVICE_WORKER === "true";

async function removeOwnServiceWorker() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      // Nur den eigenen Worker abmelden: Auf localhost:3000 können Worker
      // anderer lokaler Projekte registriert sein.
      .filter((registration) =>
        [registration.active, registration.waiting, registration.installing].some(
          (worker) => worker && new URL(worker.scriptURL).pathname === SW_URL
        )
      )
      .map((registration) => registration.unregister())
  );
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key.startsWith(SW_CACHE_PREFIX)).map((key) => caches.delete(key))
    );
  }
}

// Registriert den Service Worker (public/sw.js) nach dem ersten Render.
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Im Dev-Modus nie registrieren, und einen Worker aus einem früheren
    // lokalen `next start` aktiv entfernen: Sonst zeigt er bei gestopptem
    // Dev-Server die Offline-Seite statt des echten Fehlers.
    if (process.env.NODE_ENV !== "production" || SW_DISABLED) {
      removeOwnServiceWorker().catch(() => {});
      return;
    }

    // updateViaCache "none": Update-Checks von sw.js gehen nie über den
    // HTTP-Cache, ein neuer Deploy kommt also beim nächsten Seitenaufruf an.
    navigator.serviceWorker
      .register(SW_URL, { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Progressive Enhancement: Ohne Worker funktioniert die Seite normal,
        // ein Registrierungsfehler soll den Nutzer nie erreichen.
      });
  }, []);

  return null;
}
