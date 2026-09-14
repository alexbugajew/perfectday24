import { ImageResponse } from "next/og";
import { fetchCityName } from "@/lib/events/invite-og-data";
import { PD24_OG_THEME, ShareCard } from "@/lib/og/share-card";

// Fallback-Vorschaubild für Tagesrouten OHNE eigenes Cover: warme PD24-Karte
// mit Titel und Stadt.
//
// Bewusst ein Route-Handler statt der opengraph-image-Dateikonvention: Die
// Konventionsdatei hat Vorrang vor config-basierten `openGraph.images` und
// schleuste deshalb auch Cover-Fotos durch ImageResponse — re-encodiert als
// ~1,6-MB-PNG (Audit 08/2026, Abschnitt 4). Routen MIT Cover referenzieren
// ihr Original-JPEG jetzt direkt im Routen-Layout (generateMetadata); nur
// Routen ohne Cover zeigen auf diesen Handler.

type RouteRow = {
  title: string | null;
  city_slug: string | null;
};

async function fetchRoute(slug: string): Promise<RouteRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/user_routes?slug=eq.${encodeURIComponent(slug)}&visibility=eq.public&select=title,city_slug&limit=1`,
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
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
        coverUrl={null}
        emoji="🗺️"
      />
    ),
    { width: 1200, height: 630, emoji: "twemoji" }
  );
}
