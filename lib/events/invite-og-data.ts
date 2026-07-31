// Serverseitige Daten-Helper für die Link-Vorschau (Metadata + OG-Bild) der
// Event-Einladung. Bewusst über REST-fetch statt supabase-js, damit sie in
// jeder Runtime (nodejs/edge) der OG-Image-Route laufen.

export type InvitePlanRow = {
  title: string | null;
  occasion_slug: string;
  city_slug: string | null;
  event_date: string | null;
  host_display_name: string | null;
  cover_image_url?: string | null;
};

export async function fetchInvitePlan(token: string): Promise<InvitePlanRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/public_event_plan_by_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ p_token: token }),
      // Einladungsdaten ändern sich selten — 5 Min Cache reicht für Crawler.
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as InvitePlanRow[] | InvitePlanRow | null;
    return Array.isArray(rows) ? (rows[0] ?? null) : rows;
  } catch {
    return null;
  }
}

export async function fetchCityName(citySlug: string | null): Promise<string> {
  if (!citySlug) return "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return "";
  try {
    const res = await fetch(
      `${url}/rest/v1/cities?slug=eq.${encodeURIComponent(citySlug)}&select=name&limit=1`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return "";
    const rows = (await res.json()) as Array<{ name: string }>;
    return rows[0]?.name ?? "";
  } catch {
    return "";
  }
}

export function formatInviteDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("de-DE", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return "";
  }
}
