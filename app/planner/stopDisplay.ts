import type { PlannedStop, RouteProfile } from "@/lib/planner";
import { stopPhotoFallback } from "@/lib/stop-photo-fallback";
import { locationPhotoFromSourceRefs } from "@/lib/planner/location-photo";

function stringField(source: unknown, key: string) {
  if (!source || typeof source !== "object") return null;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function firstNestedImageUrl(source: unknown) {
  if (!source || typeof source !== "object") return null;
  const payload = (source as Record<string, unknown>).source_payload;
  if (!payload || typeof payload !== "object") return null;
  const images = (payload as Record<string, unknown>).images;
  if (!Array.isArray(images)) return null;

  for (const image of images) {
    const url =
      stringField(image, "url") ??
      stringField(image, "src") ??
      stringField(image, "image_url") ??
      stringField(image, "photo_url");
    if (url) return url;
  }

  return null;
}

// Parameter für den Kategorie-Stockfoto-Fallback. Seed = id, damit derselbe
// Stop immer dasselbe Foto bekommt — Karten-Thumbnail und Aufklapper teilen
// sich diese Ableitung, sonst wechselte das Bild beim Aufklappen.
export function stopFallbackPhotoParams(stop: PlannedStop, width: number, height: number) {
  const item = stop.item;
  return {
    category: item?.category ?? null,
    type: item?.type ?? null,
    sourcePrimary: item?.source_primary ?? null,
    seed: String(item?.id ?? stop.label ?? stop.index),
    width,
    height,
  };
}

export function plannerStopImageUrl(stop: PlannedStop) {
  const item = stop.item;
  if (!item) return null;

  const own =
    stringField(item, "photo_url") ??
    stringField(item, "image_url") ??
    stringField(item, "cover_image_url") ??
    stringField(item, "thumbnail_url") ??
    stringField(item, "picture_url") ??
    // Eigene Fotos aus dem Admin-Upload liegen als photo_url-Eintrag in
    // source_refs (locations hat keine Foto-Spalte) — vor dem Stock-Fallback.
    locationPhotoFromSourceRefs((item as Record<string, unknown>).source_refs) ??
    firstNestedImageUrl(item);

  if (own) return own;

  // Stockfoto-Fallback nach Kategorie.
  // 600x320 passt zum full-width Hero (h-32/h-40) — 200x200 war sichtbar unscharf.
  return stopPhotoFallback(stopFallbackPhotoParams(stop, 600, 320));
}

type StopCategoryMeta = { icon: string; label: string };

const TYPE_META: Record<string, StopCategoryMeta> = {
  restaurant: { icon: "🍽️", label: "Restaurant" },
  restaurant_bakery: { icon: "☕", label: "Café" },
  cafe: { icon: "☕", label: "Café" },
  bar: { icon: "🍸", label: "Bar" },
  pub: { icon: "🍸", label: "Bar" },
  nightclub: { icon: "🎭", label: "Nightlife" },
  club: { icon: "🎭", label: "Nightlife" },
  museum: { icon: "🏛️", label: "Museum" },
  gallery: { icon: "🏛️", label: "Museum" },
  monument: { icon: "📍", label: "Sehenswürdigkeit" },
  landmark: { icon: "📍", label: "Sehenswürdigkeit" },
  attraction: { icon: "🎢", label: "Attraktion" },
  park: { icon: "🎨", label: "Aktivität" },
  activity: { icon: "🎨", label: "Aktivität" },
  tour: { icon: "🎨", label: "Aktivität" },
};

export function hasPlannerEvent(stop: PlannedStop) {
  return stop.item?.source_primary === "planner_event" || stop.item?.category === "event";
}

export function stopCategoryMeta(stop: PlannedStop): StopCategoryMeta {
  const item = stop.item;
  if (!item) return { icon: "📌", label: "Stop" };
  // Events zuerst: ihr type ist oft generisch („concert", „other") und würde
  // sonst als normaler Ort erscheinen — der Event-Anker muss erkennbar sein.
  if (hasPlannerEvent(stop)) return { icon: "🎟️", label: "Event" };

  const type = (item.type ?? "").toLowerCase();
  if (TYPE_META[type]) return TYPE_META[type];

  const category = item.category ?? item.manual_category ?? null;
  if (category === "restaurant" || type.includes("restaurant") || type.includes("food")) return TYPE_META.restaurant;
  if (category === "cafe" || type.includes("cafe") || type.includes("coffee")) return TYPE_META.cafe;
  if (category === "nightlife" || type.includes("bar") || type.includes("club")) return TYPE_META.bar;
  if (category === "culture" || type.includes("museum") || type.includes("gallery")) return { icon: "🏛️", label: "Kultur" };
  if (category === "activity" || type.includes("park") || type.includes("tour")) return TYPE_META.activity;

  return { icon: "📌", label: "Ort" };
}

function compactReason(reason: string) {
  return reason.replace(/\s+/g, " ").trim();
}

/**
 * Returns max 2 quality signals — focused on what's actually useful to the
 * user (warnings, event anchors, group context, transfer character).
 * Match-score chips, "Zeitfenster gesetzt" and "Guter Einstieg" were noise.
 */
export function stopQualitySignals(
  stop: PlannedStop,
  index: number,
  routeProfile: RouteProfile,
  groupEnabled: boolean
): string[] {
  const signals: string[] = [];

  if (stop.timingWarnings?.length) signals.push("Timing prüfen");
  if (hasPlannerEvent(stop)) signals.push("Event-Anker");

  if (groupEnabled && stop.groupDecision) {
    if (stop.groupDecision.compromiseLevel === "shared") signals.push("Gruppenfit");
    else if (stop.groupDecision.compromiseLevel === "balanced") signals.push("Kompromiss");
  }

  if (index > 0 && typeof stop.travelMinFromPrev === "number") {
    if (routeProfile === "foot" && stop.travelMinFromPrev <= 18) signals.push("Fußläufig");
    else if (stop.travelMinFromPrev > 30) signals.push("Längerer Transfer");
  }

  return Array.from(new Set(signals)).slice(0, 2);
}

export function visibleStopReasons(stop: PlannedStop) {
  const reasons = (stop.reasons ?? []).map(compactReason).filter(Boolean);
  if (reasons.length > 0) return Array.from(new Set(reasons)).slice(0, 2);
  return (stop.item?.retrievalReasons ?? []).map(compactReason).filter(Boolean).slice(0, 2);
}

export function travelConnectorLabel(stop: PlannedStop, routeProfile: RouteProfile): string | null {
  if (typeof stop.travelMinFromPrev !== "number" || stop.travelMinFromPrev <= 0) return null;
  const verb =
    routeProfile === "foot" ? "zu Fuß" : routeProfile === "public_transit" ? "mit ÖPNV" : "mit Auto";
  return `${stop.travelMinFromPrev} Min ${verb}`;
}

export function stopDescription(stop: PlannedStop, aiDescriptions: Record<string, string>) {
  const own = stop.item?.description;
  if (typeof own === "string" && own.trim().length > 0) return own.trim();
  return stop.item ? aiDescriptions[String(stop.item.id)] ?? null : null;
}
