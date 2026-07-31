// Serverseitiger Daten-Helper für die Link-Vorschau geteilter Tagespläne
// (/p/[token]) — genutzt von layout.tsx (Metadata) und opengraph-image.tsx.

export type SharedPlanOgRow = {
  title: string | null;
  filters: { citySlug?: string | null } | null;
  slots: unknown[] | null;
  ai_description?: string | null;
};

export async function fetchSharedPlan(token: string): Promise<SharedPlanOgRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/public_plan_by_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ p_token: token }),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as SharedPlanOgRow[] | SharedPlanOgRow | null;
    return Array.isArray(rows) ? (rows[0] ?? null) : rows;
  } catch {
    return null;
  }
}
