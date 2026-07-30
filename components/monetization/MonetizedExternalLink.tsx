"use client";

import { useMemo, type AnchorHTMLAttributes, type MouseEvent } from "react";
import {
  buildMonetizationRedirectHref,
  trackMonetizationEvent,
  type MonetizationRedirectParams,
} from "@/lib/monetization/client";
import { isBuiltinRedirectHost, normalizeExternalUrl } from "@/lib/security/safe-url";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> &
  Omit<MonetizationRedirectParams, "targetUrl"> & {
    href: string;
    targetUrl?: string;
  };

export default function MonetizedExternalLink({
  href,
  targetUrl,
  eventType,
  userId,
  planId,
  routeId,
  locationId,
  plannerEventId,
  partnerProfileId,
  campaignId,
  slotKey,
  affiliateLinkId,
  creatorProfileId,
  citySlug,
  surface,
  label,
  source,
  children,
  onClick,
  ...anchorProps
}: Props) {
  const rawTarget = targetUrl ?? href;

  // Interne Pfade und Allowlist-Hosts (Affiliate-Netzwerke, Buchungspartner)
  // laufen über die Redirect-Route — Server-Tracking + Click-ID-Injection.
  // Alle anderen externen Ziele — v.a. Venue-Websites aus OSM-Daten — würden
  // dort an der Open-Redirect-Allowlist scheitern und auf der Startseite
  // landen; sie verlinken direkt, das Tracking übernimmt ein onClick-Beacon.
  const resolved = useMemo(() => {
    const isInternal = rawTarget.startsWith("/") && !rawTarget.startsWith("//");
    if (isInternal || isBuiltinRedirectHost(rawTarget)) {
      return {
        href: buildMonetizationRedirectHref({
          targetUrl: rawTarget,
          eventType,
          userId,
          planId,
          routeId,
          locationId,
          plannerEventId,
          partnerProfileId,
          campaignId,
          slotKey,
          affiliateLinkId,
          creatorProfileId,
          citySlug,
          surface,
          label,
          source,
        }),
        direct: false,
      };
    }
    return { href: normalizeExternalUrl(rawTarget), direct: true };
  }, [
    affiliateLinkId,
    campaignId,
    citySlug,
    creatorProfileId,
    eventType,
    label,
    locationId,
    partnerProfileId,
    planId,
    plannerEventId,
    rawTarget,
    routeId,
    slotKey,
    source,
    surface,
    userId,
  ]);

  // Kein verwertbares Ziel (kaputte URL in den Daten): keinen toten Button rendern.
  if (!resolved.href) return null;

  if (!resolved.direct) {
    return (
      <a href={resolved.href} onClick={onClick} {...anchorProps}>
        {children}
      </a>
    );
  }

  const handleDirectClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    void trackMonetizationEvent({
      eventType: eventType ?? "click",
      userId,
      planId,
      routeId,
      locationId,
      plannerEventId,
      partnerProfileId,
      campaignId,
      slotKey,
      affiliateLinkId,
      creatorProfileId,
      citySlug,
      surface,
      metadata: { label: label ?? null, source: source ?? null, direct: true },
    });
  };

  return (
    <a href={resolved.href} onClick={handleDirectClick} {...anchorProps}>
      {children}
    </a>
  );
}
