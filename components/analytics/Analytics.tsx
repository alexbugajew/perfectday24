"use client";

// components/analytics/Analytics.tsx
//
// Lädt das Plausible-Skript — aber über die eigene Domain (Rewrites in
// next.config.ts). Das hat zwei Gründe:
//
//  1. Die Content-Security-Policy bleibt bei `script-src 'self'`; es muss kein
//     Fremdhost freigeschaltet werden.
//  2. Werbeblocker filtern in Deutschland einen erheblichen Teil der Aufrufe
//     an plausible.io heraus. Über den eigenen Pfad ist die Messung vollständig.
//
// Seitenaufrufe zählt das Skript selbst (inklusive Client-Navigation über die
// History-API, die der Next-App-Router nutzt) — hier ist deshalb kein
// zusätzliches Pageview-Tracking nötig, das würde nur doppelt zählen.

import Script from "next/script";
import { useEffect, useState } from "react";
import { CONSENT_CHANGED_EVENT } from "@/lib/consent";
import { ANALYTICS_DOMAIN, isAnalyticsEnabled } from "@/lib/analytics/client";

const SCRIPT_SRC = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_PATH ?? "/pd/js/script.js";
const API_PATH = process.env.NEXT_PUBLIC_PLAUSIBLE_API_PATH ?? "/pd/api/event";

export default function Analytics() {
  // Bei NEXT_PUBLIC_ANALYTICS_REQUIRE_CONSENT=true hängt das Laden an der
  // Einwilligung — die kennt erst der Client, deshalb der Mount-Zustand.
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const sync = () => setAllowed(isAnalyticsEnabled());
    sync();
    window.addEventListener(CONSENT_CHANGED_EVENT, sync);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, sync);
  }, []);

  if (!ANALYTICS_DOMAIN || !allowed) return null;

  return (
    <Script
      id="pd24-analytics"
      src={SCRIPT_SRC}
      data-domain={ANALYTICS_DOMAIN}
      data-api={API_PATH}
      strategy="afterInteractive"
      defer
    />
  );
}
