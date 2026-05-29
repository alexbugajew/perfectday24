"use client";

import type { AttributionEventType, MonetizationEntitlementKey, SponsoredSlotKey } from "./types";
import { hasTrackingConsent } from "@/lib/consent";

const ANON_STORAGE_KEY = "pd24_monetization_anonymous_id";
const SESSION_STORAGE_KEY = "pd24_monetization_session_id";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

/**
 * Returns (and lazily creates) a persistent anonymous tracking ID.
 * Returns null — and writes nothing — if the user has not consented to tracking.
 */
export function getOrCreateMonetizationAnonymousId() {
  if (typeof window === "undefined") return null;
  if (!hasTrackingConsent()) return null;
  try {
    const existing = window.localStorage.getItem(ANON_STORAGE_KEY);
    if (existing) return existing;
    const next = uid("anon");
    window.localStorage.setItem(ANON_STORAGE_KEY, next);
    return next;
  } catch {
    return null;
  }
}

/**
 * Returns (and lazily creates) a per-session tracking ID.
 * Returns null — and writes nothing — if the user has not consented to tracking.
 */
export function getOrCreateMonetizationSessionId() {
  if (typeof window === "undefined") return null;
  if (!hasTrackingConsent()) return null;
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const next = uid("session");
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    return null;
  }
}

export type ClientMonetizationTrackInput = {
  eventType: AttributionEventType;
  userId?: string | null;
  planId?: string | null;
  routeId?: string | null;
  locationId?: string | null;
  plannerEventId?: string | null;
  partnerProfileId?: string | null;
  campaignId?: string | null;
  slotKey?: SponsoredSlotKey | null;
  affiliateLinkId?: string | null;
  creatorProfileId?: string | null;
  entitlementKey?: MonetizationEntitlementKey | null;
  citySlug?: string | null;
  surface?: string | null;
  revenueCents?: number | null;
  currency?: string | null;
  metadata?: Record<string, unknown> | null;
  onceKey?: string | null;
};

export async function trackMonetizationEvent(input: ClientMonetizationTrackInput) {
  if (typeof window === "undefined") return;
  // Silently no-op when the user has not consented to tracking.
  if (!hasTrackingConsent()) return;

  if (input.onceKey) {
    try {
      const storageKey = `pd24_monetization_once:${input.onceKey}`;
      if (window.sessionStorage.getItem(storageKey)) return;
      window.sessionStorage.setItem(storageKey, "1");
    } catch {}
  }

  try {
    await fetch("/api/monetization/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...input,
        anonymousId: getOrCreateMonetizationAnonymousId(),
        sessionId: getOrCreateMonetizationSessionId(),
      }),
    });
  } catch (error) {
    console.error("trackMonetizationEvent failed:", error);
  }
}

export type MonetizationRedirectParams = {
  targetUrl: string;
  eventType?: AttributionEventType;
  userId?: string | null;
  planId?: string | null;
  routeId?: string | null;
  locationId?: string | null;
  plannerEventId?: string | null;
  partnerProfileId?: string | null;
  campaignId?: string | null;
  slotKey?: SponsoredSlotKey | null;
  affiliateLinkId?: string | null;
  creatorProfileId?: string | null;
  citySlug?: string | null;
  surface?: string | null;
  label?: string | null;
  source?: string | null;
};

export function buildMonetizationRedirectHref(params: MonetizationRedirectParams) {
  const search = new URLSearchParams();
  search.set("target", params.targetUrl);
  search.set("eventType", params.eventType ?? "click");

  const anonymousId = getOrCreateMonetizationAnonymousId();
  const sessionId = getOrCreateMonetizationSessionId();

  if (anonymousId) search.set("anonymousId", anonymousId);
  if (sessionId) search.set("sessionId", sessionId);
  if (params.userId) search.set("userId", params.userId);
  if (params.planId) search.set("planId", params.planId);
  if (params.routeId) search.set("routeId", params.routeId);
  if (params.locationId) search.set("locationId", params.locationId);
  if (params.plannerEventId) search.set("plannerEventId", params.plannerEventId);
  if (params.partnerProfileId) search.set("partnerProfileId", params.partnerProfileId);
  if (params.campaignId) search.set("campaignId", params.campaignId);
  if (params.slotKey) search.set("slotKey", params.slotKey);
  if (params.affiliateLinkId) search.set("affiliateLinkId", params.affiliateLinkId);
  if (params.creatorProfileId) search.set("creatorProfileId", params.creatorProfileId);
  if (params.citySlug) search.set("citySlug", params.citySlug);
  if (params.surface) search.set("surface", params.surface);
  if (params.label) search.set("label", params.label);
  if (params.source) search.set("source", params.source);

  return `/api/monetization/redirect?${search.toString()}`;
}
