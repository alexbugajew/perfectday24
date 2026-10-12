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

// Anzeigemodi, in denen PerfectDay24 als installierte App läuft. Das Manifest
// fordert "standalone"; "minimal-ui" ist dessen Rückfallstufe in Browsern ohne
// Standalone-Fenster. "fullscreen" fehlt bewusst: Er greift auch im normalen
// Browser (F11, Vollbild-Video oder -Karte) und würde sonst bei ganz normalen
// Besuchern einen Worker registrieren.
const INSTALLED_DISPLAY_MODES = ["standalone", "minimal-ui"];

function installedModeQueries() {
  return INSTALLED_DISPLAY_MODES.map((mode) => window.matchMedia(`(display-mode: ${mode})`));
}

function isInstalledApp(queries: MediaQueryList[]) {
  // iOS-Safari meldet die Home-Bildschirm-App zusätzlich über das nicht
  // standardisierte navigator.standalone. Das deckt iOS-Versionen ab, die dort
  // kein display-mode melden.
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || queries.some((query) => query.matches);
}

function registerServiceWorker() {
  // updateViaCache "none": Update-Checks von sw.js gehen nie über den
  // HTTP-Cache, ein neuer Deploy kommt also beim nächsten Seitenaufruf an.
  navigator.serviceWorker
    .register(SW_URL, { scope: "/", updateViaCache: "none" })
    .catch(() => {
      // Progressive Enhancement: Ohne Worker funktioniert die App normal,
      // ein Registrierungsfehler soll den Nutzer nie erreichen.
    });
}

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
  // Auch ohne Registrierung aufräumen: Ein abgebrochener Install kann einen
  // halb gefüllten pd24-Cache hinterlassen haben.
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key.startsWith(SW_CACHE_PREFIX)).map((key) => caches.delete(key))
    );
  }
}

// Registriert den Service Worker (public/sw.js) nur in der installierten App.
//
// Warum nicht für jeden Besucher: Der Worker legt beim Install Offline-Seite
// und Logo im Cache Storage des Geräts ab. Das ist ein Endgerätezugriff nach
// § 25 TDDDG. Unbedingt erforderlich ist er nur für einen ausdrücklich
// gewünschten Dienst, und das ist erst die installierte App mit Offline-
// Hinweis, nicht der normale Website-Besuch. Die Installierbarkeit selbst
// hängt nicht am Worker, sondern an Manifest und HTTPS (Next-PWA-Guide,
// docs/pwa-service-worker.md).
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

    const queries = installedModeQueries();
    if (isInstalledApp(queries)) {
      registerServiceWorker();
      return;
    }

    // Normaler Browser-Tab: nichts registrieren und Reste früherer
    // Registrierungen (Previews, lokale Tests) samt pd24-Caches entfernen.
    removeOwnServiceWorker().catch(() => {});

    // Desktop-Chrome/Edge verschieben den Tab nach "Installieren" ohne Reload
    // ins App-Fenster; der Wechsel kommt nur als change-Event an. Umgekehrt
    // wird bewusst nicht abgemeldet: Ein Vollbild-Video in der App wechselt
    // kurz auf "fullscreen" und würde den Worker sonst grundlos entfernen.
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) registerServiceWorker();
    };
    queries.forEach((query) => query.addEventListener("change", onChange));
    return () => queries.forEach((query) => query.removeEventListener("change", onChange));
  }, []);

  return null;
}
