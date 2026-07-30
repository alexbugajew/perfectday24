import { supabase } from "@/lib/supabaseClient";
import { renderableImageUrl } from "@/lib/renderable-image-url";

export type MediaGalleryItem = {
  id: string;
  url: string;
  alt: string | null;
  caption: string | null;
  creditName: string | null;
  sourceLabel: string | null;
  badge: string | null;
  stopId?: string | null;
  stopOrder?: number | null;
};

type MediaAssetRow = {
  id: string;
  public_url: string | null;
  caption: string | null;
  credit_name: string | null;
  moderation_status?: string | null;
  visibility?: string | null;
};

/** Nur freigegebene, oeffentliche Assets dürfen in Galerien erscheinen. */
const PUBLISHABLE_MODERATION_STATES = new Set(["approved", "featured"]);

function isPublishableAsset(asset: MediaAssetRow | null | undefined): boolean {
  if (!asset) return false;
  // Ältere Aufrufe ohne diese Felder werden nicht blockiert — dort greift
  // weiterhin allein die RLS-Policy.
  if (asset.moderation_status === undefined && asset.visibility === undefined) return true;
  return (
    PUBLISHABLE_MODERATION_STATES.has(asset.moderation_status ?? "") &&
    asset.visibility === "public"
  );
}

function toGalleryItem(
  asset: MediaAssetRow | null | undefined,
  input: {
    fallbackId: string;
    alt?: string | null;
    sourceLabel?: string | null;
    badge?: string | null;
    stopId?: string | null;
    stopOrder?: number | null;
  }
): MediaGalleryItem | null {
  const url = renderableImageUrl(asset?.public_url ?? null);
  if (!asset?.id || !url) return null;
  // Defense in depth: zusätzlich zur RLS-Policy auch hier filtern.
  if (!isPublishableAsset(asset)) return null;
  return {
    id: asset.id || input.fallbackId,
    url,
    alt: input.alt ?? null,
    caption: asset.caption ?? null,
    creditName: asset.credit_name ?? null,
    sourceLabel: input.sourceLabel ?? null,
    badge: input.badge ?? null,
    stopId: input.stopId ?? null,
    stopOrder: input.stopOrder ?? null,
  };
}

export async function loadRouteMediaBundle(routeId: string, stopFallbacks: Array<{ id: string; title: string | null; photoUrl: string | null }> = []) {
  const routeMediaPromise = supabase
    .from("route_media")
    .select("id,role,sort_order,is_primary,media_assets(id,public_url,caption,credit_name,moderation_status,visibility)")
    .eq("route_id", routeId)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true });
  const stopIds = stopFallbacks.map((stop) => stop.id).filter(Boolean);
  const stopMediaPromise =
    stopIds.length > 0
      ? supabase
          .from("route_stop_media")
          .select("id,role,sort_order,is_primary,route_stop_id,user_route_stops(stop_order,title),media_assets(id,public_url,caption,credit_name,moderation_status,visibility)")
          .in("route_stop_id", stopIds)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [], error: null });

  const [routeMediaResult, stopMediaResult] = await Promise.all([routeMediaPromise, stopMediaPromise]);

  if (routeMediaResult.error) {
    console.error("loadRouteMediaBundle route media error:", routeMediaResult.error);
  }
  if (stopMediaResult.error) {
    console.error("loadRouteMediaBundle stop media error:", stopMediaResult.error);
  }

  const routeItems = ((routeMediaResult.data ?? []) as Array<Record<string, unknown>>)
    .map((row, index) =>
      toGalleryItem(row.media_assets as MediaAssetRow, {
        fallbackId: `route-${index}`,
        sourceLabel: row.role === "cover" ? "Route-Cover" : "Route-Galerie",
        badge: row.role === "cover" ? "Cover" : "Route",
      })
    )
    .filter((item): item is MediaGalleryItem => Boolean(item));

  const stopItems = ((stopMediaResult.data ?? []) as Array<Record<string, unknown>>)
    .map((row, index) => {
      const stopRef = row.user_route_stops as { stop_order?: number; title?: string | null } | null;
      return toGalleryItem(row.media_assets as MediaAssetRow, {
        fallbackId: `route-stop-${index}`,
        alt: stopRef?.title ?? null,
        sourceLabel: stopRef?.title ? `Stop ${stopRef.stop_order}: ${stopRef.title}` : "Stop-Foto",
        badge: row.role === "primary" ? "Stop" : "Community",
        stopId: (row.route_stop_id as string | null) ?? null,
        stopOrder: stopRef?.stop_order ?? null,
      });
    })
    .filter((item): item is MediaGalleryItem => Boolean(item));

  const seenUrls = new Set<string>([...routeItems, ...stopItems].map((item) => item.url));
  const legacyStopItems = stopFallbacks
    .map((stop, index) => {
      const url = renderableImageUrl(stop.photoUrl ?? null);
      if (!url || seenUrls.has(url)) return null;
      return {
        id: `legacy-stop-${stop.id}-${index}`,
        url,
        alt: stop.title ?? null,
        caption: stop.title ?? null,
        creditName: null,
        sourceLabel: stop.title ? `Stop-Fallback · ${stop.title}` : "Stop-Fallback",
        badge: "Fallback",
        stopId: stop.id,
        stopOrder: index + 1,
      } satisfies MediaGalleryItem;
    })
    .filter(Boolean) as MediaGalleryItem[];

  return {
    routeItems,
    stopItems,
    galleryItems: [...routeItems, ...stopItems, ...legacyStopItems].filter(Boolean) as MediaGalleryItem[],
    stopPrimaryMap: new Map(
      stopItems
        .filter((item) => item.stopId)
        .sort((a, b) => (a.badge === "Stop" ? -1 : 1) - (b.badge === "Stop" ? -1 : 1))
        .map((item) => [item.stopId as string, item.url])
    ),
  };
}

export async function loadRoadtripMediaBundle(roadtripRouteId: string) {
  const { data, error } = await supabase
    .from("roadtrip_media")
    .select("id,role,sort_order,is_primary,media_assets(id,public_url,caption,credit_name,moderation_status,visibility)")
    .eq("roadtrip_route_id", roadtripRouteId)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("loadRoadtripMediaBundle error:", error);
    return [];
  }

  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row, index) =>
      toGalleryItem(row.media_assets as MediaAssetRow, {
        fallbackId: `roadtrip-${index}`,
        sourceLabel: row.role === "cover" ? "Roadtrip-Cover" : "Roadtrip-Galerie",
        badge: row.role === "cover" ? "Cover" : "Roadtrip",
      })
    )
    .filter((item): item is MediaGalleryItem => Boolean(item));
}

export async function loadEventPlanMediaBundle(eventPlanId: string, fallbackProviders: Array<{ id: string; name: string; coverImageUrl?: string | null }> = []) {
  const { data, error } = await supabase
    .from("event_plan_media")
    .select("id,role,sort_order,is_primary,media_assets(id,public_url,caption,credit_name,moderation_status,visibility)")
    .eq("event_plan_id", eventPlanId)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("loadEventPlanMediaBundle error:", error);
  }

  const eventItems = ((data ?? []) as Array<Record<string, unknown>>)
    .map((row, index) =>
      toGalleryItem(row.media_assets as MediaAssetRow, {
        fallbackId: `event-${index}`,
        sourceLabel: row.role === "cover" ? "Event-Cover" : "Event-Galerie",
        badge: row.role === "cover" ? "Mood" : "Event",
      })
    )
    .filter((item): item is MediaGalleryItem => Boolean(item));

  const seenUrls = new Set(eventItems.map((item) => item.url));
  const providerFallbacks = fallbackProviders
    .map((provider, index) => {
      const url = renderableImageUrl(provider.coverImageUrl ?? null);
      if (!url || seenUrls.has(url)) return null;
      return {
        id: `provider-fallback-${provider.id}-${index}`,
        url,
        alt: provider.name,
        caption: provider.name,
        creditName: null,
        sourceLabel: "Anbieterbild",
        badge: "Partner",
      } satisfies MediaGalleryItem;
    })
    .filter(Boolean) as MediaGalleryItem[];

  return [...eventItems, ...providerFallbacks].filter(Boolean) as MediaGalleryItem[];
}
