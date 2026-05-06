export function toRad(v: number) {
  return (v * Math.PI) / 180;
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(aLat)) *
      Math.cos(toRad(bLat)) *
      (Math.sin(dLng / 2) * Math.sin(dLng / 2));
  const c = 2 * Math.atan2(Math.sqrt(s1), Math.sqrt(1 - s1));
  return R * c;
}

export function estimateTravelMinFromKm(distanceKm: number | null) {
  if (distanceKm == null) return null;
  const min = Math.max(5, Math.round(distanceKm * 10));
  return Math.min(90, min);
}

export function estimateTravelMinFromKmForProfile(
  distanceKm: number | null,
  profile: "foot" | "public_transit" | "car"
) {
  if (distanceKm == null) return null;

  if (profile === "foot") {
    return estimateTravelMinFromKm(distanceKm);
  }

  if (profile === "public_transit") {
    const min = Math.max(8, Math.round(distanceKm * 4.2 + 6));
    return Math.min(95, min);
  }

  const min = Math.max(6, Math.round(distanceKm * 2.6 + 4));
  return Math.min(80, min);
}
