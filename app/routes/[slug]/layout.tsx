import type { Metadata } from "next";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

// Revalidate route shells every hour so metadata and OG tags stay fresh
// even though the main page content is loaded client-side.
export const revalidate = 3600;

type RouteShell = {
  title: string | null;
  description: string | null;
  cover_image_url: string | null;
  city_slug: string | null;
  cityName: string;
};

function supabaseOrNull() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Lädt Titel, Beschreibung und Stadt der Route.
 *
 * `cache()` sorgt dafür, dass generateMetadata und das Layout-Rendering
 * dieselbe Abfrage teilen — sonst liefe pro Seite zweimal dieselbe Query.
 */
const loadRouteShell = cache(async (slug: string): Promise<RouteShell | null> => {
  const supabase = supabaseOrNull();
  if (!supabase) return null;

  try {
    const { data } = await supabase
      .from("user_routes")
      .select("title, description, cover_image_url, city_slug")
      .eq("slug", slug)
      .eq("visibility", "public")
      .maybeSingle();

    if (!data) return null;

    // Echten Städtenamen auflösen ("München" statt Slug "muenchen").
    let cityName = "";
    if (typeof data.city_slug === "string" && data.city_slug.trim().length > 0) {
      const { data: city } = await supabase
        .from("cities")
        .select("name")
        .eq("slug", data.city_slug)
        .maybeSingle();
      cityName = city?.name ?? "";
    }

    return { ...data, cityName };
  } catch {
    return null;
  }
});

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const supabase = supabaseOrNull();
  if (!supabase) return [];

  try {
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.perfectday24.de";
  const route = await loadRouteShell(slug);

  if (!route) return { title: "Tagesroute | PerfectDay24" };

  const citySuffix = route.cityName ? ` in ${route.cityName}` : "";
  const title = `${route.title ?? "Tagesroute"} | PerfectDay24`;
  const description =
    route.description?.slice(0, 160) ??
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
      ...(route.cover_image_url ? { images: [{ url: route.cover_image_url }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function RouteSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const route = await loadRouteShell(slug);

  // Die Stadt gehört in die Überschrift, weil danach gesucht wird. Sie wird
  // aber mit Trennzeichen angehängt, nicht mit einem zweiten "in": Viele Titel
  // nennen bereits einen Stadtteil ("Date-Abend in Neukölln"), und daraus würde
  // sonst "… in Neukölln in Berlin". Steht die Stadt schon im Titel, entfällt
  // der Zusatz ganz.
  const title = route?.title ?? "Tagesroute";
  const routeHeading =
    route?.cityName && !title.toLowerCase().includes(route.cityName.toLowerCase())
      ? `${title} · ${route.cityName}`
      : title;

  return (
    <>
      {/*
        Die Routenseite selbst lädt ihre Daten im Browser nach — im
        ausgelieferten HTML stand deshalb bisher weder eine Überschrift noch
        ein Satz Text. Crawler, die kein JavaScript ausführen (Bing teilweise,
        Social-Vorschauen, die Crawler der KI-Antwortmaschinen), sahen eine
        leere Seite.

        Dieser Kopf schließt die Lücke serverseitig. Er ist `sr-only`, weil der
        sichtbare Titel im Hero steht, sobald die Seite geladen ist — der Text
        ist identisch, es wird also nichts versteckt, was Nutzer nicht sehen.
        Der Hero-Titel ist dafür bewusst kein <h1> mehr, damit die Seite genau
        eine Hauptüberschrift hat.

        Sauberer wäre, die Routenseite serverseitig zu rendern; das ist ein
        eigener Umbau der ~2.900 Zeilen langen Client-Komponente.
      */}
      {route ? (
        <header className="sr-only">
          <h1>{routeHeading}</h1>
          {route.description ? <p>{route.description}</p> : null}
        </header>
      ) : null}
      {children}
    </>
  );
}
