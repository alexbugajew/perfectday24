import { ImageResponse } from "next/og";
import { fetchCityName } from "@/lib/events/invite-og-data";
import { fetchSharedPlan } from "@/lib/og/shared-plan-data";
import { PD24_OG_THEME, ShareCard } from "@/lib/og/share-card";

// Dynamisches Vorschaubild für geteilte Tagespläne (/p/[token]).

export const alt = "Geteilter Tagesplan auf PerfectDay24";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const plan = await fetchSharedPlan(token);
  const cityName = plan ? await fetchCityName(plan.filters?.citySlug ?? null) : "";
  const stopCount = plan && Array.isArray(plan.slots) ? plan.slots.length : 0;

  return new ImageResponse(
    (
      <ShareCard
        kicker={cityName ? `Geteilter Tagesplan · ${cityName}` : "Geteilter Tagesplan"}
        title={plan?.title || (cityName ? `Ein Tag in ${cityName}` : "Dein Tagesplan")}
        facts={
          stopCount > 0
            ? `${stopCount} Stops · Ablauf, Timing und Route auf einen Blick`
            : "Ablauf, Timing und Route auf einen Blick"
        }
        footerNote="Plan ansehen"
        theme={PD24_OG_THEME}
        emoji="🧭"
      />
    ),
    { ...size, emoji: "twemoji" }
  );
}
