import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.perfectday24.de";

  if (!url || !key) {
    return { title: "Roadtrip | PerfectDay24" };
  }

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data } = await supabase
      .from("roadtrip_routes")
      .select("title, description, cover_image_url, total_nights, stops")
      .eq("slug", slug)
      .eq("visibility", "public")
      .maybeSingle();

    if (!data) return { title: "Roadtrip | PerfectDay24" };

    const stops = Array.isArray(data.stops) ? data.stops : [];
    const startCity =
      stops.length > 0 && typeof stops[0] === "object" && stops[0] && "cityLabel" in stops[0]
        ? String((stops[0] as { cityLabel?: unknown }).cityLabel ?? "")
        : "";
    const endCity =
      stops.length > 1 && typeof stops[stops.length - 1] === "object" && stops[stops.length - 1] && "cityLabel" in stops[stops.length - 1]
        ? String((stops[stops.length - 1] as { cityLabel?: unknown }).cityLabel ?? "")
        : startCity;
    const routeSpan = startCity && endCity ? `${startCity} bis ${endCity}` : "fertigem Mehrtagesablauf";
    const title = `${data.title ?? "Roadtrip"} | PerfectDay24`;
    const description =
      data.description?.slice(0, 160) ??
      `Entdecke diesen Roadtrip mit ${data.total_nights ?? 0} Nächten und starte direkt von ${routeSpan}.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `${siteUrl}/roadtrip/routes/${slug}`,
        type: "article",
        locale: "de_DE",
        ...(data.cover_image_url ? { images: [{ url: data.cover_image_url }] } : {}),
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    };
  } catch {
    return { title: "Roadtrip | PerfectDay24" };
  }
}

export default function RoadtripRouteSlugLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
