import { ImageResponse } from "next/og";
import { OCCASION_EMOJI, OCCASION_LABEL, getInviteTheme } from "@/lib/events/occasion-theme";
import { fetchCityName, fetchInvitePlan, formatInviteDate } from "@/lib/events/invite-og-data";
import { ShareCard } from "@/lib/og/share-card";

// Dynamisches Vorschaubild für WhatsApp/Mail: Anlass-Farbwelt der
// Einladungskarte, mit Titelbild des Gastgebers falls vorhanden.

export const alt = "Einladung auf PerfectDay24";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const plan = await fetchInvitePlan(token);

  const occasionLabel = plan ? (OCCASION_LABEL[plan.occasion_slug] ?? "Event") : "Event";
  const emoji = plan ? (OCCASION_EMOJI[plan.occasion_slug] ?? "🎊") : "🎊";
  const t = getInviteTheme(plan?.occasion_slug);
  const cityName = plan ? await fetchCityName(plan.city_slug) : "";
  const when = plan ? formatInviteDate(plan.event_date) : "";

  return new ImageResponse(
    (
      <ShareCard
        kicker={`Einladung · ${occasionLabel}`}
        title={plan?.title || occasionLabel}
        facts={[when, cityName].filter(Boolean).join("  ·  ")}
        footerNote="Jetzt zusagen"
        theme={{ from: t.heroFrom, mid: t.heroMid, to: t.heroTo, accent: t.accent, glow: t.glow }}
        coverUrl={plan?.cover_image_url ?? null}
        emoji={emoji}
      />
    ),
    { ...size, emoji: "twemoji" }
  );
}
