// Reiner Google-Maps-Link zu einem Stop.
// ============================================================================
// Ausschließlich die dokumentierte Maps-URL (api=1) zum Öffnen im Browser oder
// in der Maps-App: kein API-Aufruf, kein Schlüssel, keine Places-Inhalte —
// damit außerhalb der EEA-Bedingungen (Beschluss Stufe 0, 11.10.2026). Mit
// Adresse suchen wir „Name, Adresse" (eindeutig auch bei Ketten), sonst
// pinnen wir die Koordinate wie die Exporte in plan-export.ts. Ein reiner
// Namens-Link wäre deutschlandweit mehrdeutig und entfällt deshalb.

export type MapsLinkInput = {
  name?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export function googleMapsPlaceUrl(input: MapsLinkInput): string | null {
  const name = input.name?.trim() ?? "";
  const address = input.address?.trim() ?? "";
  const hasCoords =
    typeof input.lat === "number" &&
    typeof input.lng === "number" &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng);

  let query: string | null = null;
  if (address) {
    query = name ? `${name}, ${address}` : address;
  } else if (hasCoords) {
    query = `${input.lat},${input.lng}`;
  }
  if (!query) return null;

  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", query);
  return url.toString();
}
