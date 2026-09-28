"use client";

import { useEffect } from "react";

// Registriert den Service Worker (public/sw.js) nach dem ersten Render.
// Nur in Produktion: im Dev-Modus würde ein Worker HMR stören und
// Altstände ausliefern.
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Progressive Enhancement: Ohne Worker funktioniert die Seite normal,
      // ein Registrierungsfehler soll den Nutzer nie erreichen.
    });
  }, []);

  return null;
}
