// source_refs-Foto-Einträge: Merge- und Ersetzungslogik für den Admin-Upload.
// ============================================================================
// Ausgelagert aus der API-Route (Next erlaubt in route.ts nur Handler-Exporte,
// und die Ersetzungslogik braucht Unit-Tests): Ein erneuter Upload ersetzt den
// eigenen Foto-Eintrag, fremde Einträge bleiben unangetastet — und der alte
// Bestand (Storage-Objekt, media_assets-Zeile, Routen-Stop-URLs) muss mit
// aufgeräumt werden, sonst bleibt ein „ersetztes" Foto öffentlich erreichbar.

export type SourceRefEntry = Record<string, unknown>;

export type OwnPhotoEntry = {
  photo_url: string;
  media_asset_id: string | null;
  storage_path: string | null;
};

function isOwnPhotoEntry(candidate: unknown): candidate is SourceRefEntry {
  return Boolean(
    candidate &&
      typeof candidate === "object" &&
      (candidate as SourceRefEntry).photo_source === "owner_upload"
  );
}

/** Bestehenden eigenen Foto-Eintrag finden (für Aufräumen beim Ersetzen). */
export function findOwnPhotoEntry(refs: unknown): OwnPhotoEntry | null {
  const entries = Array.isArray(refs) ? refs : refs && typeof refs === "object" ? [refs] : [];
  for (const entry of entries) {
    if (!isOwnPhotoEntry(entry)) continue;
    const photoUrl = (entry as { photo_url?: unknown }).photo_url;
    if (typeof photoUrl !== "string" || !photoUrl) continue;
    const assetId = (entry as { media_asset_id?: unknown }).media_asset_id;
    const storagePath = (entry as { storage_path?: unknown }).storage_path;
    return {
      photo_url: photoUrl,
      media_asset_id: typeof assetId === "string" ? assetId : null,
      storage_path: typeof storagePath === "string" ? storagePath : null,
    };
  }
  return null;
}

/**
 * Foto-Eintrag ins source_refs-Array mergen. Ein bestehender
 * owner_upload-Eintrag wird ersetzt (erneuter Upload = besseres Foto),
 * fremde Einträge (Seeds, Adressen, Event-Refs) bleiben unangetastet.
 */
export function mergePhotoEntry(refs: unknown, entry: SourceRefEntry): unknown {
  if (Array.isArray(refs)) {
    return [...refs.filter((existing) => !isOwnPhotoEntry(existing)), entry];
  }
  if (refs && typeof refs === "object") {
    return [refs, entry];
  }
  return [entry];
}

/** Storage-Pfad aus einer Public-URL des Buckets ableiten (Alt-Einträge ohne storage_path). */
export function storagePathFromPublicUrl(publicUrl: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const index = publicUrl.indexOf(marker);
  if (index < 0) return null;
  const path = publicUrl.slice(index + marker.length);
  return path.length > 0 ? decodeURIComponent(path) : null;
}
