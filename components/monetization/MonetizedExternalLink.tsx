"use client";

import { useMemo, type AnchorHTMLAttributes } from "react";
import { buildMonetizationRedirectHref, type MonetizationRedirectParams } from "@/lib/monetization/client";

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
  ...anchorProps
}: Props) {
  const resolvedHref = useMemo(
    () =>
      buildMonetizationRedirectHref({
        targetUrl: targetUrl ?? href,
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
    [
      affiliateLinkId,
      campaignId,
      citySlug,
      creatorProfileId,
      eventType,
      href,
      label,
      locationId,
      partnerProfileId,
      planId,
      plannerEventId,
      routeId,
      slotKey,
      source,
      surface,
      targetUrl,
      userId,
    ]
  );

  return (
    <a href={resolvedHref} {...anchorProps}>
      {children}
    </a>
  );
}
