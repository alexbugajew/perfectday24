import { supabase } from "@/lib/supabaseClient";

export type RouteResolvedCoverRow = {
  route_id: string;
  effective_cover_url: string | null;
};

export type RoadtripResolvedCoverRow = {
  roadtrip_route_id: string;
  effective_cover_url: string | null;
};

export type ServiceProviderResolvedCoverRow = {
  provider_id: string;
  effective_cover_url: string | null;
};

export async function loadResolvedRouteCoverMap(routeIds: string[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(routeIds.filter(Boolean)));
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase
    .from("route_media_resolved")
    .select("route_id,effective_cover_url")
    .in("route_id", ids);

  if (error) {
    console.error("loadResolvedRouteCoverMap error:", error);
    return new Map();
  }

  return new Map(
    ((data ?? []) as RouteResolvedCoverRow[])
      .filter((row) => !!row.route_id && !!row.effective_cover_url)
      .map((row) => [row.route_id, row.effective_cover_url as string])
  );
}

export async function loadResolvedRoadtripCoverMap(routeIds: string[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(routeIds.filter(Boolean)));
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase
    .from("roadtrip_media_resolved")
    .select("roadtrip_route_id,effective_cover_url")
    .in("roadtrip_route_id", ids);

  if (error) {
    console.error("loadResolvedRoadtripCoverMap error:", error);
    return new Map();
  }

  return new Map(
    ((data ?? []) as RoadtripResolvedCoverRow[])
      .filter((row) => !!row.roadtrip_route_id && !!row.effective_cover_url)
      .map((row) => [row.roadtrip_route_id, row.effective_cover_url as string])
  );
}

export async function loadResolvedServiceProviderCoverMap(providerIds: string[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(providerIds.filter(Boolean)));
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase
    .from("service_provider_media_resolved")
    .select("provider_id,effective_cover_url")
    .in("provider_id", ids);

  if (error) {
    console.error("loadResolvedServiceProviderCoverMap error:", error);
    return new Map();
  }

  return new Map(
    ((data ?? []) as ServiceProviderResolvedCoverRow[])
      .filter((row) => !!row.provider_id && !!row.effective_cover_url)
      .map((row) => [row.provider_id, row.effective_cover_url as string])
  );
}
