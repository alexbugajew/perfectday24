import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { PLANNER_33_ROLLOUT } from "@/lib/cities/rollout";

export const revalidate = 3600;

const CITY_MAP = new Map(PLANNER_33_ROLLOUT.map((c) => [c.slug, c]));

export async function generateStaticParams(): Promise<{ city: string }[]> {
  return PLANNER_33_ROLLOUT.filter((c) => c.plannerVisibility === "visible").map((c) => ({
    city: c.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const cityConfig = CITY_MAP.get(city);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.perfectday24.de";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let routeCount = 0;
  let coverImageUrl: string | null = null;

  if (url && key) {
    try {
      const supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const [{ count }, { data: cover }] = await Promise.all([
        supabase
          .from("user_routes")
          .select("id", { count: "exact", head: true })
          .eq("city_slug", city)
          .eq("visibility", "public"),
        supabase
          .from("user_routes")
          .select("cover_image_url")
          .eq("city_slug", city)
          .eq("visibility", "public")
          .eq("is_featured", true)
          .not("cover_image_url", "is", null)
          .order("ranking_score", { ascending: false })
          .limit(1),
      ]);
      routeCount = count ?? 0;
      coverImageUrl = (cover?.[0] as { cover_image_url: string | null } | undefined)?.cover_image_url ?? null;
    } catch { /* ignore */ }
  }

  const cityLabel = cityConfig?.label ?? city;
  const title = `${cityLabel} entdecken — Tagesrouten & Tipps | PerfectDay24`;
  const description = routeCount > 0
    ? `${routeCount} kuratierte Tagesrouten in ${cityLabel}. Entdecke Orte, Aktivitäten und perfekte Tage — geplant von Creators und der Community.`
    : `Entdecke kuratierte Tagesrouten in ${cityLabel} auf PerfectDay24.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${siteUrl}/explore/${city}`,
      type: "website",
      locale: "de_DE",
      ...(coverImageUrl ? { images: [{ url: coverImageUrl, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: `${siteUrl}/explore/${city}`,
    },
  };
}

export default function CityExploreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
