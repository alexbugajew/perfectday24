"use client";

// lib/analytics/client.ts
//
// Dünne, anbieterunabhängige Schicht über der Web-Analytics.
//
// Aktuell angebunden: Plausible (cookielos, keine Speicherung auf dem Gerät,
// keine geräteübergreifende Wiedererkennung). Deshalb ist die Messung nach
// § 25 Abs. 2 TTDSG nicht einwilligungspflichtig und läuft standardmäßig auch
// ohne Consent — sonst würde der weit überwiegende Teil des Launch-Traffics
// unsichtbar bleiben. Wer strenger fahren will, setzt
// NEXT_PUBLIC_ANALYTICS_REQUIRE_CONSENT=true; dann gilt dieselbe Zustimmung
// wie für das Monetization-Tracking.
//
// Ein Anbieter, der Daten auf dem Gerät ablegt (GA4, Meta-Pixel), darf NICHT
// hier eingehängt werden, ohne dass er hinter `hasTrackingConsent()` liegt.

import { hasTrackingConsent } from "@/lib/consent";
import type { AnalyticsEventName, AnalyticsEventProps } from "./events";

type PlausibleProps = Record<string, string | number | boolean>;

type PlausibleFn = {
  (event: string, options?: { props?: PlausibleProps; callback?: () => void }): void;
  q?: unknown[][];
};

declare global {
  interface Window {
    plausible?: PlausibleFn;
  }
}

/** Ohne konfigurierte Domain ist die Analytics komplett inaktiv (No-Op). */
export const ANALYTICS_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ?? "";

const REQUIRE_CONSENT = process.env.NEXT_PUBLIC_ANALYTICS_REQUIRE_CONSENT === "true";
const DEBUG = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true";

/** Plausible-Grenzwerte: max. 30 Properties, Werte max. 2000 Zeichen. */
const MAX_PROPS = 30;
const MAX_VALUE_LENGTH = 300;

export function isAnalyticsEnabled(): boolean {
  if (!ANALYTICS_DOMAIN) return false;
  if (REQUIRE_CONSENT && !hasTrackingConsent()) return false;
  return true;
}

/**
 * Wirft leere Werte weg und kürzt zu lange Strings. `null`/`undefined` dürfen
 * nicht durchgereicht werden — Plausible legt sonst eine eigene Property-
 * Ausprägung "null" an, die jede Auswertung verwässert.
 */
function sanitizeProps(props: Record<string, unknown> | undefined): PlausibleProps | undefined {
  if (!props) return undefined;
  const out: PlausibleProps = {};
  let count = 0;
  for (const [key, value] of Object.entries(props)) {
    if (count >= MAX_PROPS) break;
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) continue;
      out[key] = value;
    } else if (typeof value === "boolean") {
      out[key] = value;
    } else if (typeof value === "string") {
      out[key] = value.slice(0, MAX_VALUE_LENGTH);
    } else {
      continue;
    }
    count += 1;
  }
  return count > 0 ? out : undefined;
}

/**
 * Liefert die Plausible-Funktion und legt bei Bedarf die Warteschlange an,
 * damit Ereignisse aus der ersten halben Sekunde nicht verloren gehen: Das
 * nachgeladene Skript arbeitet `plausible.q` beim Start ab.
 */
function plausible(): PlausibleFn | null {
  if (typeof window === "undefined") return null;
  if (!window.plausible) {
    const queued: PlausibleFn = function (...args: unknown[]) {
      (queued.q = queued.q || []).push(args);
    } as unknown as PlausibleFn;
    window.plausible = queued;
  }
  return window.plausible;
}

/**
 * Meldet ein Funnel-Ereignis. Schlägt nie fehl und blockiert nie — Analytics
 * darf einen Nutzerflow unter keinen Umständen kaputt machen.
 */
export function trackEvent<E extends AnalyticsEventName>(
  event: E,
  props?: AnalyticsEventProps[E]
): void {
  try {
    if (DEBUG) console.info("[analytics]", event, props ?? {});
    if (!isAnalyticsEnabled()) return;
    const fn = plausible();
    if (!fn) return;
    const clean = sanitizeProps(props as Record<string, unknown> | undefined);
    fn(event, clean ? { props: clean } : undefined);
  } catch (error) {
    if (DEBUG) console.error("[analytics] trackEvent failed:", error);
  }
}
