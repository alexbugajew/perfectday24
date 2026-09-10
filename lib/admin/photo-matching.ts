// GPS-basiertes Matching Foto → Location für den Admin-Foto-Upload.
// ============================================================================
// Handy-Fotos tragen den Aufnahmeort als EXIF-GPS. Da jede Location lat/lng
// hat, reicht ein Entfernungsranking — die Vollautomatik bleibt aber bewusst
// auf sehr sichere Fälle beschränkt (Lehre aus den 94 falsch zugeordneten
// Wikimedia-Fotos: automatische Zuordnung ohne Sichtkontrolle rächt sich).

export type PhotoMatchCandidate = {
  id: string;
  name: string;
  type: string | null;
  category: string | null;
  city_slug: string | null;
  lat: number;
  lng: number;
};

export type RankedCandidate = PhotoMatchCandidate & { distanceM: number };

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(
  latA: number,
  lngA: number,
  latB: number,
  lngB: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(latB - latA);
  const dLng = toRad(lngB - lngA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Kandidaten nach Entfernung zum Aufnahmeort sortieren. */
export function rankCandidatesByDistance(
  gps: { lat: number; lng: number },
  candidates: PhotoMatchCandidate[],
  limit = 8
): RankedCandidate[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      distanceM: Math.round(haversineMeters(gps.lat, gps.lng, candidate.lat, candidate.lng)),
    }))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}

// Schwellen für die Vorauswahl: Handy-GPS streut in Städten typisch 5–25 m;
// 40 m fängt das ab, ohne den Nachbarladen zu treffen. Der Abstand zum
// Zweitplatzierten verhindert Fehlgriffe in dichten Ladenzeilen.
const AUTO_SELECT_MAX_M = 40;
const AUTO_SELECT_MIN_GAP_M = 25;

/**
 * Liefert die Kandidaten-ID, die ohne manuellen Eingriff vorausgewählt werden
 * darf — oder null, wenn der Fall menschliche Bestätigung braucht.
 */
export function autoSelectCandidate(ranked: RankedCandidate[]): string | null {
  const [first, second] = ranked;
  if (!first) return null;
  if (first.distanceM > AUTO_SELECT_MAX_M) return null;
  if (second && second.distanceM - first.distanceM < AUTO_SELECT_MIN_GAP_M) return null;
  return first.id;
}
