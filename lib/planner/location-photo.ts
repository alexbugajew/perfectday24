// Eigenes Location-Foto aus source_refs lesen.
// ============================================================================
// Gleicher Mechanismus wie bei den Adressen (location-address.ts): locations
// hat keine Foto-Spalte, und DDL läuft nur über Alex. Der Admin-Foto-Upload
// (/admin/fotos) legt deshalb einen {photo_url: …}-Eintrag im
// source_refs-Array ab — source_refs steht bereits in der Planner-SELECT-Liste
// und fließt damit ohne Query-Änderung bis in Stop-Karten und Exporte.

function photoFromEntry(entry: unknown): string | null {
  if (!entry || typeof entry !== "object") return null;
  const value = (entry as { photo_url?: unknown }).photo_url;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function locationPhotoFromSourceRefs(refs: unknown): string | null {
  if (!refs || typeof refs !== "object") return null;
  if (Array.isArray(refs)) {
    for (const entry of refs) {
      const photo = photoFromEntry(entry);
      if (photo) return photo;
    }
    return null;
  }
  return photoFromEntry(refs);
}
