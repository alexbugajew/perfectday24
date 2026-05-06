import { NextResponse } from "next/server";
import { recordMonetizationEvent } from "@/lib/monetization/server";
import type { AttributionEventType, SponsoredSlotKey } from "@/lib/monetization/types";

function readParam(url: URL, key: string) {
  const value = url.searchParams.get(key);
  return value && value.trim() ? value.trim() : null;
}

function safeTarget(target: string | null, requestUrl: URL) {
  if (!target) return null;
  if (target.startsWith("/") && !target.startsWith("//")) {
    try {
      return new URL(target, requestUrl).toString();
    } catch {
      return null;
    }
  }
  try {
    const parsed = new URL(target);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const target = safeTarget(readParam(requestUrl, "target"), requestUrl);

  if (!target) {
    return NextResponse.redirect(new URL("/", requestUrl));
  }

  const eventType = (readParam(requestUrl, "eventType") ?? "click") as AttributionEventType;

  try {
    await recordMonetizationEvent({
      eventType,
      userId: readParam(requestUrl, "userId"),
      anonymousId: readParam(requestUrl, "anonymousId"),
      sessionId: readParam(requestUrl, "sessionId"),
      planId: readParam(requestUrl, "planId"),
      routeId: readParam(requestUrl, "routeId"),
      locationId: readParam(requestUrl, "locationId"),
      plannerEventId: readParam(requestUrl, "plannerEventId"),
      partnerProfileId: readParam(requestUrl, "partnerProfileId"),
      campaignId: readParam(requestUrl, "campaignId"),
      slotKey: readParam(requestUrl, "slotKey") as SponsoredSlotKey | null,
      affiliateLinkId: readParam(requestUrl, "affiliateLinkId"),
      creatorProfileId: readParam(requestUrl, "creatorProfileId"),
      citySlug: readParam(requestUrl, "citySlug"),
      surface: readParam(requestUrl, "surface"),
      metadata: {
        label: readParam(requestUrl, "label"),
        source: readParam(requestUrl, "source"),
      },
    });
  } catch (error) {
    console.error("Monetization redirect tracking failed:", error);
  }

  return NextResponse.redirect(target);
}
