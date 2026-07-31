import { ImageResponse } from "next/og";
import { fetchCityName } from "@/lib/events/invite-og-data";
import { PD24_OG_THEME, ShareCard } from "@/lib/og/share-card";

// Dynamisches Vorschaubild für geteilte Tagesrouten: Cover-Foto mit
// Marken-Overlay, sonst warme PD24-Karte mit Titel und Stadt.

export const alt = "Tagesroute auf PerfectDay24";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type RouteRow = {
  title: string | null;
  cover_image_url: string | null;
  city_slug: string | null;
  stop_count?: number | null;
  duration_label?: string | null;
};

async function fetchRoute(slug: string): Promise<RouteRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/user_routes?slug=eq.${encodeURIComponent(slug)}&visibility=eq.public&select=title,cover_image_url,city_slug&limit=1`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as RouteRow[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const route = await fetchRoute(slug);
  const cityName = route ? await fetchCityName(route.city_slug) : "";

  return new ImageResponse(
    (
      <ShareCard
        kicker={cityName ? `Tagesroute · ${cityName}` : "Tagesroute"}
        title={route?.title || "Ein perfekter Tag"}
        facts="Fertiger Ablauf mit Stops, Wegen und Timing"
        footerNote="Route ansehen"
        theme={PD24_OG_THEME}
        coverUrl={route?.cover_image_url ?? null}
        emoji="🗺️"
      />
    ),
    { ...size, emoji: "twemoji" }
  );
}
