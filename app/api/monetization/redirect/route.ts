import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { recordMonetizationEvent } from "@/lib/monetization/server";
import {
  ATTRIBUTION_EVENT_TYPES,
  type AttributionEventType,
  type SponsoredSlotKey,
} from "@/lib/monetization/types";
import { checkRedirectTarget } from "@/lib/security/safe-url";
import { getSessionUserId } from "@/lib/security/session";
import { enforceRateLimit, RATE_RULES } from "@/lib/security/rate-limit";

// Netzwerk-spezifische Klick-Parameter fuer Postback-Reconciliation.
const NETWORK_CLICK_PARAM: Record<string, string> = {
  awin: "awc",         // Awin Master-Tag + S2S: ?awc=<subid>
  tradedoubler: "epi", // Tradedoubler: ?epi=<subid>
  booking: "label",    // Booking.com: ?label=<subid>
  other: "pd24_click", // Fallback fuer Direktpartner
};

function detectNetwork(target: string): "awin" | "tradedoubler" | "booking" | "other" {
  const lower = target.toLowerCase();
  if (lower.includes("awin1.com") || lower.includes("awin.com")) return "awin";
  if (lower.includes("tradedoubler.co")) return "tradedoubler";
  if (lower.includes("booking.com")) return "booking";
  return "other";
}

function injectClickId(target: string, network: string, clickId: string): string {
  try {
    const url = new URL(target);
    const paramName = NETWORK_CLICK_PARAM[network] ?? "pd24_click";
    // Wenn das Netzwerk-Param bereits gesetzt ist, respektieren wir das (Kampagnen-Override).
    if (!url.searchParams.has(paramName)) {
      url.searchParams.set(paramName, clickId);
    }
    // pd24_click als Backup fuer eigene Reconciliation bei allen Netzwerken.
    if (!url.searchParams.has("pd24_click")) {
      url.searchParams.set("pd24_click", clickId);
    }
    return url.toString();
  } catch {
    return target;
  }
}

function newClickId(): string {
  return randomBytes(9).toString("base64url"); // 12-char slug
}

function readParam(url: URL, key: string) {
  const value = url.searchParams.get(key);
  return value && value.trim() ? value.trim() : null;
}

/**
 * Prüft das Redirect-Ziel. Interne Pfade sind unkritisch; externe Ziele müssen
 * gegen die Host-Allowlist in lib/security/safe-url.ts passen, damit die Route
 * nicht als Open Redirect für Phishing missbraucht werden kann.
 */
function safeTarget(target: string | null, requestUrl: URL) {
  if (!target) return null;

  if (target.startsWith("/") && !target.startsWith("//")) {
    try {
      return new URL(target, requestUrl).toString();
    } catch {
      return null;
    }
  }

  const check = checkRedirectTarget(target);
  if (!check.ok) {
    if (check.reason === "host_not_allowed") {
      console.warn("Monetization redirect blocked for host:", check.host);
    }
    return null;
  }
  return check.url;
}

export async function GET(req: Request) {
  const limited = enforceRateLimit(req, "monetization:redirect", RATE_RULES.write);
  if (limited) return limited;

  const requestUrl = new URL(req.url);
  const target = safeTarget(readParam(requestUrl, "target"), requestUrl);

  if (!target) {
    return NextResponse.redirect(new URL("/", requestUrl));
  }

  const requestedEventType = readParam(requestUrl, "eventType") ?? "click";
  const eventType = (
    ATTRIBUTION_EVENT_TYPES.includes(requestedEventType as AttributionEventType)
      ? requestedEventType
      : "click"
  ) as AttributionEventType;
  const affiliateLinkId = readParam(requestUrl, "affiliateLinkId");

  // Klick-ID nur fuer Affiliate-Klicks generieren. Andere Klick-Events
  // (Featured-Slot, Editorial-Route etc.) brauchen keine Postback-ID.
  const network = detectNetwork(target);
  const trackAsAffiliate = eventType === "click" && (affiliateLinkId || network !== "other");
  const clickId = trackAsAffiliate ? newClickId() : null;
  const finalTarget = clickId ? injectClickId(target, network, clickId) : target;

  // Identität serverseitig bestimmen — der userId-Query-Parameter wird bewusst
  // ignoriert, sonst lassen sich Klicks fremden Nutzern zuschreiben.
  const sessionUserId = await getSessionUserId();

  try {
    await recordMonetizationEvent({
      eventType,
      userId: sessionUserId,
      anonymousId: readParam(requestUrl, "anonymousId"),
      sessionId: readParam(requestUrl, "sessionId"),
      planId: readParam(requestUrl, "planId"),
      routeId: readParam(requestUrl, "routeId"),
      locationId: readParam(requestUrl, "locationId"),
      plannerEventId: readParam(requestUrl, "plannerEventId"),
      partnerProfileId: readParam(requestUrl, "partnerProfileId"),
      campaignId: readParam(requestUrl, "campaignId"),
      slotKey: readParam(requestUrl, "slotKey") as SponsoredSlotKey | null,
      affiliateLinkId,
      creatorProfileId: readParam(requestUrl, "creatorProfileId"),
      citySlug: readParam(requestUrl, "citySlug"),
      surface: readParam(requestUrl, "surface"),
      metadata: {
        label: readParam(requestUrl, "label"),
        source: readParam(requestUrl, "source"),
        ...(clickId ? { click_id: clickId, network } : {}),
      },
    });
  } catch (error) {
    console.error("Monetization redirect tracking failed:", error);
  }

  return NextResponse.redirect(finalTarget);
}
