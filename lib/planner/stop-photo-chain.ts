// Foto-Kette für den „Mehr Info"-Aufklapper.
// ============================================================================
// Reihenfolge (Beschluss Stufe 0, 11.10.2026 — ausschließlich eigene Daten,
// keine Google-Inhalte):
//   1. eigener Upload (source_refs → photo_url, Admin-Foto-Upload)
//   2. media_assets zur Location, nur mit geprüften Rechten (confirmed/licensed)
//   3. Foto eines redaktionellen Routen-Stops mit Bildnachweis (Wikimedia
//      Commons, Flickr — CC-Lizenzen mit Namensnennungspflicht)
//   4. Kategorie-Fallback (Stockfoto, als „Symbolfoto" gekennzeichnet)
//
// Die Auswahl ist bewusst rein (keine DB-Zugriffe): Die Kandidaten laden
// app/planner/useStopPhoto.ts erst beim Aufklappen. Hier sitzen nur die
// Qualitäts- und Rechte-Filter, damit sie testbar bleiben.

import { stopPhotoFallback } from "../stop-photo-fallback";
import { locationPhotoFromSourceRefs } from "./location-photo";

/** Rechte-Stati aus media_assets, mit denen ein Bild öffentlich erscheinen darf. */
export const ALLOWED_RIGHTS_STATUS = ["confirmed", "licensed"] as const;
const PUBLIC_MODERATION_STATUS = ["approved", "featured"] as const;

export type StopPhotoSource = "own_upload" | "media_asset" | "attributed_route_photo" | "category_fallback";

export type StopPhoto = {
  url: string;
  source: StopPhotoSource;
  /** meta-Objekt mit image_attribution, direkt für <ImageAttribution meta=…> (Quelle 3). */
  attributionMeta: unknown | null;
  /** Freitext-Urheber aus media_assets.credit_name (Quelle 2). */
  credit: string | null;
  alt: string | null;
};

export type MediaAssetCandidate = {
  public_url: string | null;
  alt_text: string | null;
  credit_name: string | null;
  rights_status: string | null;
  moderation_status: string | null;
  visibility: string | null;
};

export type RouteStopPhotoCandidate = {
  photo_url: string | null;
  meta: unknown;
  route_creator_type: string | null;
  route_visibility: string | null;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isHttpsUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && /^https:\/\//i.test(value.trim());
}

// Der Foto-Abgleich vom 31.08. fand Buchscans und Dokumente (PDF/DjVu/TIFF)
// als „Stop-Fotos" — die sind kein Bild und würden als kaputte Grafik rendern.
function looksLikeRasterImage(url: string): boolean {
  const path = url.split(/[?#]/)[0] ?? "";
  return !/\.(pdf|djvu?|tiff?)$/i.test(path);
}

export function pickMediaAssetPhoto(rows: MediaAssetCandidate[]): MediaAssetCandidate | null {
  for (const row of rows) {
    if (!isHttpsUrl(row.public_url) || !looksLikeRasterImage(row.public_url)) continue;
    // RLS gibt Admins auch unfreigegebene Zeilen — die Prüfung gehört deshalb
    // zusätzlich hierher und nicht nur in die Policy.
    if (!(ALLOWED_RIGHTS_STATUS as readonly string[]).includes(row.rights_status ?? "")) continue;
    if (!(PUBLIC_MODERATION_STATUS as readonly string[]).includes(row.moderation_status ?? "")) continue;
    if (row.visibility !== "public") continue;
    return row;
  }
  return null;
}

export function hasImageAttribution(meta: unknown): boolean {
  return Object.keys(asObject(asObject(meta).image_attribution)).length > 0;
}

export function pickAttributedRouteStopPhoto(rows: RouteStopPhotoCandidate[]): RouteStopPhotoCandidate | null {
  for (const row of rows) {
    // Nutzer-Routen tragen beliebige URLs und frei wählbare meta — in fremden
    // Plänen erscheinen darf nur kuratierter, öffentlicher Redaktions-Bestand.
    if (row.route_creator_type !== "editorial" || row.route_visibility !== "public") continue;
    if (!isHttpsUrl(row.photo_url) || !looksLikeRasterImage(row.photo_url)) continue;
    if (!hasImageAttribution(row.meta)) continue;

    const meta = asObject(row.meta);
    // Kontext-Fallbacks übernehmen das Foto eines Nachbar-Stops derselben Route
    // — richtiges Thema, falscher Ort. Hier zeigen wir nur geprüfte Treffer.
    if (meta.image_match_level === "route_context") continue;
    if (typeof meta.image_review_status === "string" && meta.image_review_status !== "approved") continue;
    return row;
  }
  return null;
}

export type StopPhotoInput = {
  name: string;
  sourceRefs: unknown;
  mediaAssets: MediaAssetCandidate[];
  routeStops: RouteStopPhotoCandidate[];
  fallback: Parameters<typeof stopPhotoFallback>[0];
};

/** Own-Upload-Stufe allein — synchron verfügbar, ohne dass eine Abfrage nötig ist. */
export function ownUploadPhoto(name: string, sourceRefs: unknown): StopPhoto | null {
  const url = locationPhotoFromSourceRefs(sourceRefs);
  // Der Admin-Upload legt Asset (rights_status „confirmed") und source_refs-
  // Eintrag im selben Schritt an — eine zweite Rechte-Abfrage wäre redundant.
  if (!isHttpsUrl(url) || !looksLikeRasterImage(url)) return null;
  return { url, source: "own_upload", attributionMeta: null, credit: null, alt: `Foto von ${name}` };
}

export function chooseStopPhoto(input: StopPhotoInput): StopPhoto {
  const own = ownUploadPhoto(input.name, input.sourceRefs);
  if (own) return own;

  const asset = pickMediaAssetPhoto(input.mediaAssets);
  if (asset?.public_url) {
    return {
      url: asset.public_url.trim(),
      source: "media_asset",
      attributionMeta: null,
      credit: asset.credit_name?.trim() || null,
      alt: asset.alt_text?.trim() || `Foto von ${input.name}`,
    };
  }

  const routeStop = pickAttributedRouteStopPhoto(input.routeStops);
  if (routeStop?.photo_url) {
    return {
      url: routeStop.photo_url.trim(),
      source: "attributed_route_photo",
      attributionMeta: routeStop.meta,
      credit: null,
      alt: `Foto von ${input.name}`,
    };
  }

  return {
    url: stopPhotoFallback(input.fallback),
    source: "category_fallback",
    attributionMeta: null,
    credit: null,
    alt: null,
  };
}
