// lib/roadtrip/client.ts
// Supabase-Operationen für Roadtrip-Routen (Client-seitig).

import { supabase } from "@/lib/supabaseClient";
import type { CreateRoadtripRouteInput, RoadtripRoute } from "./types";
import { slugifyTitle, totalNights, countryCodes } from "./types";

const TABLE = "roadtrip_routes";

// ─── Read ─────────────────────────────────────────────────────────────────────

/** Alle öffentlichen Routen laden (für Entdecken-Seite) */
export async function fetchPublicRoadtripRoutes(limit = 24): Promise<RoadtripRoute[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("visibility", "public")
    .order("is_featured", { ascending: false })
    .order("clone_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("fetchPublicRoadtripRoutes error:", error.message);
    return [];
  }
  return (data ?? []) as RoadtripRoute[];
}

/** Eine Route per Slug laden */
export async function fetchRoadtripRouteBySlug(slug: string): Promise<RoadtripRoute | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("fetchRoadtripRouteBySlug error:", error.message);
    return null;
  }
  return (data as RoadtripRoute) ?? null;
}

/** Eine Route per Share-Token laden */
export async function fetchRoadtripRouteByToken(shareToken: string): Promise<RoadtripRoute | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("share_token", shareToken)
    .maybeSingle();

  if (error) {
    console.error("fetchRoadtripRouteByToken error:", error.message);
    return null;
  }
  return (data as RoadtripRoute) ?? null;
}

/** Routen des eingeloggten Nutzers laden (alle Visibility-Stufen) */
export async function fetchMyRoadtripRoutes(): Promise<RoadtripRoute[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("author_user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchMyRoadtripRoutes error:", error.message);
    return [];
  }
  return (data ?? []) as RoadtripRoute[];
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Neue Roadtrip-Route erstellen.
 * Generiert einen eindeutigen Slug (slug + zufälliger Suffix bei Kollision).
 */
export async function createRoadtripRoute(
  input: CreateRoadtripRouteInput
): Promise<{ route: RoadtripRoute | null; error: string | null }> {
  const baseSlug = slugifyTitle(input.title) || "roadtrip";

  // Slug-Kollision abfangen — bis zu 5 Versuche
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await supabase
      .from(TABLE)
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!existing) break;

    // Kollision: Zufälligen Suffix anhängen
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const nights = totalNights(input.stops);
  const codes = countryCodes(input.stops);

  const row = {
    slug,
    title: input.title.trim(),
    description: input.description?.trim() ?? null,
    author_user_id: input.authorUserId ?? null,
    author_name: input.authorName?.trim() ?? null,
    visibility: input.visibility,
    tags: input.tags ?? [],
    total_nights: nights,
    country_codes: codes,
    occasion: input.occasion,
    budget: input.budget,
    stops: input.stops,
    view_count: 0,
    clone_count: 0,
  };

  const { data, error } = await supabase
    .from(TABLE)
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error("createRoadtripRoute error:", error.message);
    return { route: null, error: error.message };
  }

  return { route: data as RoadtripRoute, error: null };
}

/** Route aktualisieren (nur eigene) */
export async function updateRoadtripRoute(
  id: string,
  patch: Partial<Pick<RoadtripRoute, "title" | "description" | "visibility" | "tags" | "stops">>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq("id", id);

  if (error) return { error: error.message };
  return { error: null };
}

/** Route löschen (nur eigene) */
export async function deleteRoadtripRoute(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  return { error: null };
}

/** View-Count erhöhen (fire-and-forget) */
export function incrementRouteViews(id: string): void {
  supabase.rpc("roadtrip_routes_increment_views", { route_id: id }).then(() => {});
}

/** Clone-Count erhöhen (fire-and-forget) */
export function incrementRouteClones(id: string): void {
  supabase.rpc("roadtrip_routes_increment_clones", { route_id: id }).then(() => {});
}
