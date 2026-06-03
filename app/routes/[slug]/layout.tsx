import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";

// Revalidate route shells every hour — ensures metadata + OG tags stay fresh
// even though the page content is loaded client-side.
export const revalidate = 3600;

// Pre-build the 50 most popular public routes at build time.
// Falls back gracefully if DB is unavailable during build.
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data } = await supabase
      .from("user_routes")
      .select("slug")
      .eq("visibility", "public")
      .not("slug", "is", null)
      .order("ranking_score", { ascending: false })
      .limit(50);

    return (data ?? [])
      .map((row: { slug: string | null }) => row.slug)
      .filter((slug): slug is string => Boolean(slug))
      .map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

// Dynamic OG metadata per route
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
    return { title: "Route | PerfectDay24" };
  }

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data } = await supabase
      .from("user_routes")
      .select("title, description, cover_image_url, city_slug")
      .eq("slug", slug)
      .eq("visibility", "public")
      .maybeSingle();

    if (!data) return { title: "Route | PerfectDay24" };

    const title = `${data.title ?? "Route"} | PerfectDay24`;
    const description = data.description?.slice(0, 160) ?? "Entdecke diese kuratierte Tagesroute auf PerfectDay24.";

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `${siteUrl}/routes/${slug}`,
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
    return { title: "Route | PerfectDay24" };
  }
}

export default function RouteSlugLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
