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
import {
  findOwnPhotoEntry,
  mergePhotoEntry,
  storagePathFromPublicUrl,
  type SourceRefEntry,
} from "@/lib/admin/photo-refs";

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
    // ~300 m Bounding-Box; die Feinsortierung nach Distanz macht der Client
    // (lib/admin/photo-matching), damit die DB nur einen Index-Scan braucht.
    // Limit hoch + truncated-Flag: ohne serverseitige Distanz-Sortierung darf
    // ein abgeschnittenes Ergebnis nie unbemerkt bleiben — sonst kann die
    // tatsächlich nächste Location fehlen und die Vorauswahl greift daneben.
    const LIMIT = 300;
    const dLat = 0.0027;
    const dLng = 0.0027 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    let query = supabase
      .from("locations")
      .select(select)
      .eq("is_plannable", true)
      .gte("lat", lat - dLat)
      .lte("lat", lat + dLat)
      .gte("lng", lng - dLng)
      .lte("lng", lng + dLng)
      .limit(LIMIT);
    if (city) query = query.eq("city_slug", city);
    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = (data ?? []) as LocationRow[];
    return NextResponse.json({
      candidates: rows.map(candidatePayload),
      truncated: rows.length >= LIMIT,
    });
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

  // source_refs FRISCH lesen — der Storage-Upload dauert Sekunden, und ein
  // parallel laufender Adress-Backfill könnte den Stand von oben inzwischen
  // verändert haben (Read-Modify-Write-Fenster so klein wie möglich halten).
  const { data: freshRow } = await supabase
    .from("locations")
    .select("source_refs")
    .eq("id", location.id)
    .maybeSingle();
  const currentRefs = (freshRow as { source_refs: unknown } | null)?.source_refs ?? location.source_refs;
  const previousPhoto = findOwnPhotoEntry(currentRefs);

  const photoEntry: SourceRefEntry = {
    photo_url: publicUrl,
    photo_source: "owner_upload",
    media_asset_id: (assetRow as { id: string } | null)?.id ?? null,
    storage_path: storagePath,
  };
  const { error: refsError } = await supabase
    .from("locations")
    .update({ source_refs: mergePhotoEntry(currentRefs, photoEntry) })
    .eq("id", location.id);
  if (refsError) {
    return NextResponse.json(
      { error: `source_refs-Update fehlgeschlagen: ${refsError.message}` },
      { status: 500 }
    );
  }

  // Routen-Stops derselben Location: leere Felder füllen, und beim Ersetzen
  // die alte URL auf die neue umziehen — sonst zeigen Stops das „ersetzte"
  // Foto weiter. Fremde Fotos bleiben unangetastet (Kuration ist Handarbeit).
  const { data: stopRows, error: stopsError } = await supabase
    .from("user_route_stops")
    .update({ photo_url: publicUrl })
    .eq("location_id", location.id)
    .is("photo_url", null)
    .select("id");
  let stopsMigrated = 0;
  if (previousPhoto && previousPhoto.photo_url !== publicUrl) {
    const { data: migratedRows } = await supabase
      .from("user_route_stops")
      .update({ photo_url: publicUrl })
      .eq("location_id", location.id)
      .eq("photo_url", previousPhoto.photo_url)
      .select("id");
    stopsMigrated = (migratedRows ?? []).length;
  }

  // Alt-Bestand des ersetzten Fotos aufräumen: Der Bucket ist public — ohne
  // Löschung bliebe ein „ersetztes" (z. B. falsch zugeordnetes) Foto dauerhaft
  // öffentlich erreichbar und als freigegebenes Asset im media_assets-Bestand.
  if (previousPhoto && previousPhoto.photo_url !== publicUrl) {
    const oldPath =
      previousPhoto.storage_path ??
      storagePathFromPublicUrl(previousPhoto.photo_url, STORAGE_BUCKET);
    if (oldPath && oldPath !== storagePath) {
      await supabase.storage.from(STORAGE_BUCKET).remove([oldPath]);
    }
    if (previousPhoto.media_asset_id) {
      await supabase.from("media_assets").delete().eq("id", previousPhoto.media_asset_id);
    }
  }

  return NextResponse.json({
    ok: true,
    photoUrl: publicUrl,
    location: { id: location.id, name: location.name, citySlug: location.city_slug },
    routeStopsFilled: (stopsError ? 0 : (stopRows ?? []).length) + stopsMigrated,
    replacedPrevious: Boolean(previousPhoto && previousPhoto.photo_url !== publicUrl),
  });
}
