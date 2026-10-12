"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { PlannedStop } from "@/lib/planner";
import {
  ALLOWED_RIGHTS_STATUS,
  chooseStopPhoto,
  ownUploadPhoto,
  type MediaAssetCandidate,
  type RouteStopPhotoCandidate,
  type StopPhoto,
} from "@/lib/planner/stop-photo-chain";
import { stopFallbackPhotoParams } from "./stopDisplay";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Abfrage-Ergebnisse je Location für die Sitzung merken: Zu- und Aufklappen
// soll nicht jedes Mal zwei Requests auslösen. Fehler werden nicht gemerkt —
// ein Netzwerkfehler soll beim nächsten Aufklappen neu versucht werden.
const candidateCache = new Map<string, { mediaAssets: MediaAssetCandidate[]; routeStops: RouteStopPhotoCandidate[] }>();

async function loadCandidates(locationId: string) {
  // Kein Server-Roundtrip über eine eigene API-Route: beide Tabellen sind per
  // RLS öffentlich lesbar (freigegebene Assets, öffentliche Routen), der
  // Browser-Client reicht. Beide Abfragen laufen erst beim Aufklappen, nie im
  // Plan-Erzeugungspfad.
  const [assets, stops] = await Promise.all([
    supabase
      .from("media_assets")
      .select("public_url,alt_text,credit_name,rights_status,moderation_status,visibility")
      .eq("meta->>location_id", locationId)
      .in("rights_status", [...ALLOWED_RIGHTS_STATUS])
      .in("moderation_status", ["approved", "featured"])
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("user_route_stops")
      .select("photo_url,meta,user_routes!inner(creator_type,visibility)")
      .eq("location_id", locationId)
      .not("photo_url", "is", null)
      .eq("user_routes.creator_type", "editorial")
      .eq("user_routes.visibility", "public")
      .limit(10),
  ]);

  if (assets.error || stops.error) return null;

  const routeStops: RouteStopPhotoCandidate[] = ((stops.data ?? []) as unknown as Array<{
    photo_url: string | null;
    meta: unknown;
    user_routes: { creator_type: string | null; visibility: string | null } | null;
  }>).map((row) => ({
    photo_url: row.photo_url,
    meta: row.meta,
    route_creator_type: row.user_routes?.creator_type ?? null,
    route_visibility: row.user_routes?.visibility ?? null,
  }));

  return { mediaAssets: (assets.data ?? []) as MediaAssetCandidate[], routeStops };
}

/**
 * Foto für den Aufklapper. Gibt sofort einen Wert zurück, wenn ein eigener
 * Upload vorliegt; sonst `photo: null, loading: true`, bis die Abfragen
 * durch sind — danach steht immer ein Foto (spätestens der Kategorie-Fallback).
 */
export function useStopPhoto(stop: PlannedStop) {
  const item = stop.item;
  const locationId = item ? String(item.id) : null;
  const name = item?.name ?? stop.label;
  const own = item ? ownUploadPhoto(name, item.source_refs) : null;
  const hasOwn = own !== null;
  // Behelfs-IDs („stop-1") gehören zu keiner Location; die uuid-Spalten
  // beantworten sie mit 400 — gar nicht erst fragen.
  const queryable = locationId !== null && UUID_PATTERN.test(locationId);

  const [loaded, setLoaded] = useState<{
    locationId: string;
    candidates: { mediaAssets: MediaAssetCandidate[]; routeStops: RouteStopPhotoCandidate[] } | null;
  } | null>(null);

  useEffect(() => {
    if (!locationId || !queryable || hasOwn || candidateCache.has(locationId)) return;
    let cancelled = false;
    void loadCandidates(locationId).then((candidates) => {
      if (candidates) candidateCache.set(locationId, candidates);
      if (!cancelled) setLoaded({ locationId, candidates });
    });
    return () => {
      cancelled = true;
    };
  }, [locationId, queryable, hasOwn]);

  if (!item || !locationId) return { photo: null as StopPhoto | null, loading: false };
  if (own) return { photo: own, loading: false };

  const candidates = !queryable
    ? { mediaAssets: [], routeStops: [] }
    : (candidateCache.get(locationId) ?? (loaded?.locationId === locationId ? loaded.candidates : undefined));
  // undefined = Abfrage läuft noch; null = Abfrage fehlgeschlagen → Fallback zeigen.
  if (candidates === undefined) return { photo: null as StopPhoto | null, loading: true };

  return {
    photo: chooseStopPhoto({
      name,
      sourceRefs: item.source_refs,
      mediaAssets: candidates?.mediaAssets ?? [],
      routeStops: candidates?.routeStops ?? [],
      fallback: stopFallbackPhotoParams(stop, 800, 450),
    }),
    loading: false,
  };
}
