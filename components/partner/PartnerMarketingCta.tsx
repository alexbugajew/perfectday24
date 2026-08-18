"use client";

import Link from "next/link";
import { trackMonetizationEvent } from "@/lib/monetization/client";
import { trackEvent } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

type PartnerMarketingCtaProps = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
  surface: string;
  metadata?: Record<string, unknown>;
  className?: string;
};

export default function PartnerMarketingCta({
  href,
  label,
  variant = "primary",
  surface,
  metadata,
  className,
}: PartnerMarketingCtaProps) {
  const baseClassName =
    variant === "primary"
      ? "inline-flex items-center justify-center rounded-full bg-[var(--text-strong)] px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
      : "inline-flex items-center justify-center rounded-full border border-[var(--line-subtle)] bg-white px-5 py-3 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)]";

  return (
    <Link
      href={href}
      onClick={() => {
        trackEvent(ANALYTICS_EVENTS.partnerLead, { surface });
        void trackMonetizationEvent({
          eventType: "click",
          surface,
          metadata: {
            cta_label: label,
            ...metadata,
          },
        });
      }}
      className={[baseClassName, className ?? ""].join(" ")}
    >
      {label}
    </Link>
  );
}
