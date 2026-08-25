// lib/cities/city-directory.ts
//
// Liefert die Städte, die tatsächlich öffentliche Routen haben.
//
// Hintergrund: Von den 552 sichtbaren Rollout-Städten haben nur die wenigsten
// Inhalt. Eine Städte-Übersicht, die alle 552 auflistet, würde die Nutzer
// überwiegend auf leere Seiten schicken — deshalb entscheidet hier der
// Datenbestand, nicht die Rollout-Konfiguration.
//
// Zweck der Übersicht ist ein Einstieg, den es bisher nicht gab: Die
// Stadtseiten unter /explore/<stadt> waren aus dem Produkt heraus über keinen
// einzigen Link erreichbar — weder für Nutzer noch für Crawler, für die
// verwaiste Seiten deutlich weniger zählen.

import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { PLANNER_33_ROLLOUT } from "./rollout";

export type CityDirectoryEntry = {
  slug: string;
  label: string;
  routeCount: number;
  coverUrl: string | null;
  /**
   * Nur bei kuratierten Stadt-Covern gesetzt. Die stammen aus Wikimedia
   * Commons und stehen unter CC BY oder CC BY-SA — die Namensnennung muss
   * also mit dem Bild mitreisen, nicht nur auf der Zielseite stehen.
   */
  coverCredit: string | null;
  coverSource: string | null;
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
 * Städte mit mindestens einer öffentlichen Route, absteigend nach Routenzahl.
 *
 * `cache()` teilt das Ergebnis innerhalb eines Renderdurchlaufs — Startseite
 * und Explore-Seite fragen dieselben Daten ab.
 */
export const listCitiesWithRoutes = cache(async (): Promise<CityDirectoryEntry[]> => {
  const supabase = supabaseOrNull();
  if (!supabase) return [];

  const labelBySlug = new Map(
    PLANNER_33_ROLLOUT.filter((city) => city.plannerVisibility === "visible").map(
      (city) => [city.slug, city.label] as const
    )
  );

  try {
    const { data, error } = await supabase
      .from("user_routes")
      .select("city_slug, cover_image_url")
      .eq("visibility", "public")
      .not("city_slug", "is", null)
      .order("ranking_score", { ascending: false })
      .limit(5000);

    if (error) {
      console.error("[city-directory] Routen konnten nicht geladen werden:", error.message);
      return [];
    }

    const counts = new Map<string, number>();
    const routeCoverBySlug = new Map<string, string>();
    for (const row of (data ?? []) as { city_slug: string; cover_image_url: string | null }[]) {
      if (!labelBySlug.has(row.city_slug)) continue;
      counts.set(row.city_slug, (counts.get(row.city_slug) ?? 0) + 1);
      // Erstes Cover je Stadt gewinnt — die Liste ist nach ranking_score
      // sortiert, das ist also das stärkste Bild der Stadt.
      if (row.cover_image_url && !routeCoverBySlug.has(row.city_slug)) {
        routeCoverBySlug.set(row.city_slug, row.cover_image_url);
      }
    }

    if (counts.size === 0) return [];

    const slugs = Array.from(counts.keys());
    const { data: cityRows } = await supabase
      .from("cities")
      .select("slug, editorial_cover_url, editorial_cover_credit, editorial_cover_source")
      .in("slug", slugs);

    type CityCoverRow = {
      slug: string;
      editorial_cover_url: string | null;
      editorial_cover_credit: string | null;
      editorial_cover_source: string | null;
    };
    const editorialCoverBySlug = new Map(
      ((cityRows ?? []) as CityCoverRow[])
        .filter((row) => Boolean(row.editorial_cover_url))
        .map((row) => [row.slug, row] as const)
    );

    return slugs
      .map((slug) => ({
        slug,
        label: labelBySlug.get(slug) ?? slug,
        routeCount: counts.get(slug) ?? 0,
        // Gleiche Rangfolge wie auf der Stadtseite selbst: Editorial-Cover vor
        // Routen-Cover, damit das Bild in der Übersicht dem entspricht, was der
        // Nutzer nach dem Klick sieht.
        coverUrl:
          editorialCoverBySlug.get(slug)?.editorial_cover_url ??
          routeCoverBySlug.get(slug) ??
          null,
        // Routen-Cover tragen keine Angabe zum Urheber — dort bleibt es leer.
        coverCredit: editorialCoverBySlug.get(slug)?.editorial_cover_credit ?? null,
        coverSource: editorialCoverBySlug.get(slug)?.editorial_cover_source ?? null,
      }))
      .sort((a, b) => b.routeCount - a.routeCount || a.label.localeCompare(b.label, "de"));
  } catch (error) {
    console.error("[city-directory] Laden fehlgeschlagen:", error);
    return [];
  }
});
