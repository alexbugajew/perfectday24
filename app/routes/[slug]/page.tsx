import { createClient } from "@supabase/supabase-js";
import RouteDetailClient from "./RouteDetailClient";
import type {
  CreatorProfileRow,
  RouteDetailInitialData,
  RouteStopRow,
  UserRouteRow,
} from "./RouteDetailClient";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, routeJsonLd } from "@/lib/seo/json-ld";

/**
 * Routendetailseite.
 *
 * Bis 08/2026 war das eine reine Client-Komponente: Titel, Stops und
 * Beschreibungen entstanden erst im Browser. Im ausgelieferten HTML stand
 * dadurch kein einziger Stopp — für Suchmaschinen, Link-Vorschauen und die
 * Crawler der KI-Antwortmaschinen (die kein JavaScript ausführen) war die
 * teuerste Inhaltsfläche des Projekts schlicht leer.
 *
 * Jetzt lädt diese Server-Komponente Route, Stops und Creator-Profil vorab
 * und übergibt sie an die Client-Komponente, die daraus ihren Anfangszustand
 * bildet. Das Markup entsteht damit schon auf dem Server; interaktiv bleibt
 * alles wie zuvor. Dieselben Daten speisen die strukturierte Auszeichnung.
 *
 * Serverseitig werden bewusst nur **öffentliche** Routen geladen. Eigene,
 * nicht veröffentlichte Routen sieht ihr Besitzer weiterhin — dann greift der
 * bisherige Client-Fetch mit seiner Nutzersitzung und den RLS-Regeln.
 */
export const revalidate = 3600;

type RouteDetailPageData = {
  initial: RouteDetailInitialData;
  cityLabel: string | null;
};

const EMPTY: RouteDetailPageData = {
  initial: { route: null, stops: null, creator: null },
  cityLabel: null,
};

function supabaseOrNull() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loadRouteDetailData(slug: string): Promise<RouteDetailPageData> {
  const supabase = supabaseOrNull();
  if (!supabase) return EMPTY;

  try {
    const { data: routeData, error } = await supabase
      .from("user_routes")
      .select("*")
      .eq("slug", slug)
      .eq("visibility", "public")
      .maybeSingle();

    if (error || !routeData) return EMPTY;
    const route = routeData as UserRouteRow;

    // Alles Weitere hängt nur an der Route und kann parallel laufen.
    const [stopsResult, creatorResult, coverResult, cityResult] = await Promise.all([
      supabase
        .from("user_route_stops")
        .select("*")
        .eq("route_id", route.id)
        .order("stop_order", { ascending: true }),
      route.user_id
        ? supabase
            .from("creator_profiles")
            .select("id, user_id, username, display_name, bio, avatar_url, creator_type")
            .eq("user_id", route.user_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      // Dasselbe Cover, das der Client bisher nachgeladen hat — sonst würde
      // beim Hydrieren kurz ein anderes Bild erscheinen.
      supabase
        .from("route_media_resolved")
        .select("route_id,effective_cover_url")
        .eq("route_id", route.id)
        .maybeSingle(),
      route.city_slug
        ? supabase.from("cities").select("name").eq("slug", route.city_slug).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const resolvedCover = (coverResult?.data as { effective_cover_url?: string | null } | null)
      ?.effective_cover_url;

    return {
      initial: {
        route: resolvedCover ? { ...route, cover_image_url: resolvedCover } : route,
        stops: (stopsResult.data as RouteStopRow[] | null) ?? [],
        creator: (creatorResult.data as CreatorProfileRow | null) ?? null,
      },
      cityLabel: (cityResult?.data as { name?: string | null } | null)?.name ?? null,
    };
  } catch (error) {
    // Ein Ausfall darf die Seite nicht zerstören: Ohne Vorabdaten rendert die
    // Client-Komponente wie bisher und lädt selbst nach.
    console.error("Routendetail: serverseitiges Laden fehlgeschlagen:", error);
    return EMPTY;
  }
}

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { initial, cityLabel } = await loadRouteDetailData(slug);
  const route = initial.route;

  return (
    <>
      {route ? (
        <JsonLd
          data={[
            routeJsonLd({
              route,
              stops: initial.stops ?? [],
              creator: initial.creator,
              cityLabel,
            }),
            breadcrumbJsonLd([
              { name: "Start", path: "/" },
              { name: "Entdecken", path: "/explore" },
              ...(route.city_slug && cityLabel
                ? [{ name: cityLabel, path: `/explore/${route.city_slug}` }]
                : []),
              { name: route.title, path: `/routes/${route.slug}` },
            ]),
          ]}
        />
      ) : null}
      <RouteDetailClient initial={initial} />
    </>
  );
}
