import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { PLANNER_33_ROLLOUT, PLANNER_33_ROLLOUT_MAP } from "@/lib/cities/rollout";
import {
  CITY_OCCASIONS,
  CITY_OCCASION_MAP,
  routeMatchesOccasion,
  type CityOccasion,
} from "@/lib/cities/occasions";

export type OccasionStop = {
  stop_order: number;
  title: string | null;
  note: string | null;
  duration_min: number | null;
};

export type OccasionRoute = {
  id: string;
  slug: string | null;
  title: string | null;
  description: string | null;
  cover_image_url: string | null;
  start_label: string | null;
  tags: unknown;
  stops: OccasionStop[];
};

export type OccasionPageData = {
  city: (typeof PLANNER_33_ROLLOUT)[number];
  occasion: CityOccasion;
  routes: OccasionRoute[];
  /** Andere Anlässe, für die es in dieser Stadt ebenfalls Routen gibt. */
  siblings: CityOccasion[];
};

function supabaseOrNull() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type RouteRow = {
  id: string;
  slug: string | null;
  title: string | null;
  description: string | null;
  cover_image_url: string | null;
  start_label: string | null;
  tags: unknown;
  ranking_score: number | null;
};

/**
 * Lädt alle öffentlichen Routen einer Stadt.
 *
 * Die Anlass-Filterung passiert bewusst hier in JavaScript und nicht in der
 * Abfrage: `tags` ist eine jsonb-Spalte, auf die PostgREST-Operatoren wie
 * `contains` mit text[]-Syntax nicht greifen. Bei maximal ein paar Dutzend
 * Routen pro Stadt ist das ohnehin unerheblich — und `cache()` sorgt dafür,
 * dass sich Layout (Metadaten) und Seite (Inhalt) die Abfrage teilen.
 */
const loadCityRoutes = cache(async (citySlug: string): Promise<RouteRow[]> => {
  const supabase = supabaseOrNull();
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("user_routes")
      .select("id, slug, title, description, cover_image_url, start_label, tags, ranking_score")
      .eq("city_slug", citySlug)
      .eq("visibility", "public")
      .order("ranking_score", { ascending: false })
      .limit(60);
    return (data ?? []) as RouteRow[];
  } catch (error) {
    console.error("Anlass-Seite: Routen konnten nicht geladen werden:", error);
    return [];
  }
});

export const loadOccasionPageData = cache(
  async (citySlug: string, occasionSlug: string): Promise<OccasionPageData | null> => {
    const city = PLANNER_33_ROLLOUT_MAP.get(citySlug);
    const occasion = CITY_OCCASION_MAP.get(occasionSlug);
    if (!city || !occasion) return null;

    const cityRoutes = await loadCityRoutes(citySlug);
    const matching = cityRoutes.filter((route) => route.slug && routeMatchesOccasion(route.tags, occasion));
    if (matching.length === 0) return null;

    // Ohne Stopps wäre die Seite ein reiner Kachel-Verweis. Erst die Stopps
    // machen sie zu einer Antwort auf die Frage, die im Titel steht.
    const supabase = supabaseOrNull();
    const stopsByRoute = new Map<string, OccasionStop[]>();
    if (supabase) {
      try {
        const { data } = await supabase
          .from("user_route_stops")
          .select("route_id, stop_order, title, note, duration_min")
          .in(
            "route_id",
            matching.map((route) => route.id)
          )
          .order("stop_order", { ascending: true });

        for (const row of (data ?? []) as (OccasionStop & { route_id: string })[]) {
          const list = stopsByRoute.get(row.route_id) ?? [];
          list.push(row);
          stopsByRoute.set(row.route_id, list);
        }
      } catch (error) {
        console.error("Anlass-Seite: Stopps konnten nicht geladen werden:", error);
      }
    }

    const siblings = CITY_OCCASIONS.filter(
      (other) =>
        other.slug !== occasion.slug &&
        cityRoutes.some((route) => route.slug && routeMatchesOccasion(route.tags, other))
    );

    return {
      city,
      occasion,
      routes: matching.map((route) => ({
        id: route.id,
        slug: route.slug,
        title: route.title,
        description: route.description,
        cover_image_url: route.cover_image_url,
        start_label: route.start_label,
        tags: route.tags,
        stops: stopsByRoute.get(route.id) ?? [],
      })),
      siblings,
    };
  }
);

/**
 * Alle Stadt-Anlass-Kombinationen, für die es tatsächlich Routen gibt.
 *
 * Kombinationen ohne Route werden nicht erzeugt: Eine Landing-Page ohne Inhalt
 * ist für Suchmaschinen schädlicher als gar keine Seite.
 */
export async function listOccasionParams(): Promise<{ city: string; occasion: string }[]> {
  const supabase = supabaseOrNull();
  if (!supabase) return [];

  const visibleCities = new Set(
    PLANNER_33_ROLLOUT.filter((city) => city.plannerVisibility === "visible").map((city) => city.slug)
  );

  try {
    const { data } = await supabase
      .from("user_routes")
      .select("city_slug, tags")
      .eq("visibility", "public")
      .not("city_slug", "is", null)
      .limit(5000);

    const combos = new Set<string>();
    for (const row of (data ?? []) as { city_slug: string; tags: unknown }[]) {
      if (!visibleCities.has(row.city_slug)) continue;
      for (const occasion of CITY_OCCASIONS) {
        if (routeMatchesOccasion(row.tags, occasion)) combos.add(`${row.city_slug}|${occasion.slug}`);
      }
    }

    return Array.from(combos).map((combo) => {
      const [city, occasion] = combo.split("|");
      return { city, occasion };
    });
  } catch (error) {
    console.error("Anlass-Seiten: Kombinationen konnten nicht ermittelt werden:", error);
    return [];
  }
}
