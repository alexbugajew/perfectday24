import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";

// Revalidate route shells every hour so metadata and OG tags stay fresh
// even though the main page content is loaded client-side.
export const revalidate = 3600;

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
    return { title: "Tagesroute | PerfectDay24" };
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

    if (!data) return { title: "Tagesroute | PerfectDay24" };

    const citySuffix =
      typeof data.city_slug === "string" && data.city_slug.trim().length > 0
        ? ` in ${data.city_slug.split("-")[0]}`
        : "";
    const title = `${data.title ?? "Tagesroute"} | PerfectDay24`;
    const description =
      data.description?.slice(0, 160) ??
      `Entdecke diese kuratierte Tagesroute${citySuffix} auf PerfectDay24 und starte direkt in deinen Plan.`;

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
    return { title: "Tagesroute | PerfectDay24" };
  }
}

export default function RouteSlugLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
