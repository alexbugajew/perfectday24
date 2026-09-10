// Admin-Foto-Upload: eigene Fotos Locations zuordnen.
// ============================================================================
// GET  ?lat=&lng=[&city=]      → Kandidaten im Umkreis (Bounding-Box ~700 m)
// GET  ?q=&city=               → Namenssuche als Fallback für Fotos ohne GPS
// POST multipart (file, locationId, …) → Storage-Upload + media_assets-Zeile
//      (rights_status "owned") + photo_url-Eintrag in locations.source_refs
//      + Foto-Backfill für Routen-Stops derselben Location ohne Bild.
//
// Auth: ausschließlich die Admin-Allowlist (PD24_INTERNAL_ADMIN_EMAILS) — die
// Route schreibt mit Service-Role an RLS vorbei und bleibt deshalb zu für
// alles, was kein Admin ist.

import { NextResponse } from "next/server";
import {
  getMonetizationAdminAccessState,
  getSupabaseAdmin,
} from "@/lib/monetization/admin-server";
import { locationPhotoFromSourceRefs } from "@/lib/planner/location-photo";

export const runtime = "nodejs";

const STORAGE_BUCKET = "partner-media";
const MAX_FILE_BYTES = 4 * 1024 * 1024; // Vercel-Request-Limit ist 4,5 MB
const ALLOWED_MIME = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

type LocationRow = {
  id: string;
  name: string;
  type: string | null;
  category: string | null;
  city_slug: string | null;
  lat: number | null;
  lng: number | null;
  source_refs: unknown;
};

function candidatePayload(row: LocationRow) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    category: row.category,
    city_slug: row.city_slug,
    lat: row.lat,
    lng: row.lng,
    hasOwnPhoto: Boolean(locationPhotoFromSourceRefs(row.source_refs)),
  };
}

async function requireAdmin() {
  const access = await getMonetizationAdminAccessState();
  if (!access.allowed || !access.user) {
    return null;
  }
  return access.user;
}

export async function GET(req: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
  }

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const city = url.searchParams.get("city")?.trim() || null;
  const q = url.searchParams.get("q")?.trim() || null;

  const supabase = getSupabaseAdmin();
  const select = "id,name,type,category,city_slug,lat,lng,source_refs";

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    // ~700 m Bounding-Box; die Feinsortierung nach Distanz macht der Client
    // (lib/admin/photo-matching), damit die DB nur einen Index-Scan braucht.
    const dLat = 0.0063;
    const dLng = 0.0063 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    let query = supabase
      .from("locations")
      .select(select)
      .eq("is_plannable", true)
      .gte("lat", lat - dLat)
      .lte("lat", lat + dLat)
      .gte("lng", lng - dLng)
      .lte("lng", lng + dLng)
      .limit(60);
    if (city) query = query.eq("city_slug", city);
    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ candidates: ((data ?? []) as LocationRow[]).map(candidatePayload) });
  }

  if (q && q.length >= 2) {
    let query = supabase
      .from("locations")
      .select(select)
      .eq("is_plannable", true)
      .ilike("name", `%${q.replace(/[%_]/g, "")}%`)
      .limit(20);
    if (city) query = query.eq("city_slug", city);
    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ candidates: ((data ?? []) as LocationRow[]).map(candidatePayload) });
  }

  return NextResponse.json({ error: "lat/lng oder q angeben." }, { status: 400 });
}

type SourceRefEntry = Record<string, unknown>;

/**
 * Foto-Eintrag ins source_refs-Array mergen. Ein bestehender
 * owner_upload-Eintrag wird ersetzt (erneuter Upload = besseres Foto),
 * fremde Einträge bleiben unangetastet.
 */
function mergePhotoEntry(refs: unknown, entry: SourceRefEntry): unknown {
  const isOwnPhotoEntry = (candidate: unknown) =>
    Boolean(
      candidate &&
        typeof candidate === "object" &&
        (candidate as SourceRefEntry).photo_source === "owner_upload"
    );
  if (Array.isArray(refs)) {
    return [...refs.filter((existing) => !isOwnPhotoEntry(existing)), entry];
  }
  if (refs && typeof refs === "object") {
    return [refs, entry];
  }
  return [entry];
}

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ungültiger Upload." }, { status: 400 });
  }

  const file = formData.get("file");
  const locationId = String(formData.get("locationId") ?? "").trim();
  const altText = String(formData.get("altText") ?? "").trim() || null;
  const matchedBy = String(formData.get("matchedBy") ?? "manual");
  const gpsLat = Number(formData.get("gpsLat"));
  const gpsLng = Number(formData.get("gpsLng"));

  if (!(file instanceof File) || !locationId) {
    return NextResponse.json({ error: "file und locationId sind Pflicht." }, { status: 400 });
  }
  const extension = ALLOWED_MIME.get(file.type);
  if (!extension) {
    return NextResponse.json(
      { error: `Nicht unterstützter Bildtyp: ${file.type || "unbekannt"} (JPEG/PNG/WebP).` },
      { status: 415 }
    );
  }
  if (file.size === 0 || file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Datei leer oder größer als 4 MB." }, { status: 413 });
  }

  const supabase = getSupabaseAdmin();

  const { data: locationRow, error: locationError } = await supabase
    .from("locations")
    .select("id,name,city_slug,source_refs")
    .eq("id", locationId)
    .maybeSingle();
  if (locationError || !locationRow) {
    return NextResponse.json({ error: "Location nicht gefunden." }, { status: 404 });
  }
  const location = locationRow as Pick<LocationRow, "id" | "name" | "city_slug" | "source_refs">;

  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = `location-photos/${location.id}/${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });
  if (uploadError) {
    return NextResponse.json(
      { error: `Upload fehlgeschlagen: ${uploadError.message}` },
      { status: 500 }
    );
  }
  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  const publicUrl = urlData.publicUrl;

  // Constraints der media_assets-Tabelle (Migration 20260616110000):
  // source_type erlaubt kein "owner", rights_status kein "owned" — "editorial"
  // + "confirmed" sind die passenden Werte; die Eigentümerschaft steht in meta.
  const { data: assetRow, error: assetError } = await supabase
    .from("media_assets")
    .insert({
      owner_user_id: user.id,
      source_type: "editorial",
      bucket_id: STORAGE_BUCKET,
      storage_path: storagePath,
      public_url: publicUrl,
      mime_type: file.type,
      file_size_bytes: buffer.byteLength,
      alt_text: altText ?? location.name,
      rights_status: "confirmed",
      moderation_status: "approved",
      visibility: "public",
      meta: {
        location_id: location.id,
        city_slug: location.city_slug,
        rights: "owned",
        uploaded_via: "admin-fotos",
        matched_by: matchedBy === "gps" ? "gps" : "manual",
        ...(Number.isFinite(gpsLat) && Number.isFinite(gpsLng)
          ? { photo_gps: { lat: gpsLat, lng: gpsLng } }
          : {}),
      },
    })
    .select("id")
    .maybeSingle();
  if (assetError) {
    return NextResponse.json(
      { error: `media_assets-Eintrag fehlgeschlagen: ${assetError.message}` },
      { status: 500 }
    );
  }

  const photoEntry: SourceRefEntry = {
    photo_url: publicUrl,
    photo_source: "owner_upload",
    media_asset_id: (assetRow as { id: string } | null)?.id ?? null,
  };
  const { error: refsError } = await supabase
    .from("locations")
    .update({ source_refs: mergePhotoEntry(location.source_refs, photoEntry) })
    .eq("id", location.id);
  if (refsError) {
    return NextResponse.json(
      { error: `source_refs-Update fehlgeschlagen: ${refsError.message}` },
      { status: 500 }
    );
  }

  // Routen-Stops derselben Location ohne Foto bekommen es direkt — bestehende
  // Bilder werden bewusst nicht überschrieben (Kuration bleibt Handarbeit).
  const { data: stopRows, error: stopsError } = await supabase
    .from("user_route_stops")
    .update({ photo_url: publicUrl })
    .eq("location_id", location.id)
    .is("photo_url", null)
    .select("id");

  return NextResponse.json({
    ok: true,
    photoUrl: publicUrl,
    location: { id: location.id, name: location.name, citySlug: location.city_slug },
    routeStopsFilled: stopsError ? 0 : (stopRows ?? []).length,
  });
}
