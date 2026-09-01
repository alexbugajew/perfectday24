// Straßenadresse aus source_refs lesen.
// ============================================================================
// locations hat keine eigene Adressspalte (Schema-Drift-Konvention: kein DDL
// aus dem Code heraus). Der Adress-Backfill (scripts/backfill-location-addresses)
// legt die Adresse deshalb in source_refs ab. Das Feld hat zwei gewachsene
// Formen: ein Array aus Ref-Objekten (osm_seed-Locations) oder ein einzelnes
// Objekt (planner_event-Pseudo-Locations) — beide werden hier abgedeckt.

function addressFromEntry(entry: unknown): string | null {
  if (!entry || typeof entry !== "object") return null;
  const value = (entry as { address?: unknown }).address;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function locationAddressFromSourceRefs(refs: unknown): string | null {
  if (!refs || typeof refs !== "object") return null;
  if (Array.isArray(refs)) {
    for (const entry of refs) {
      const address = addressFromEntry(entry);
      if (address) return address;
    }
    return null;
  }
  return addressFromEntry(refs);
}
