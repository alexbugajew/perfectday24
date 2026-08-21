import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { PLANNER_33_ROLLOUT } from "@/lib/cities/rollout";
import { listOccasionParams } from "./explore/[city]/[occasion]/data";
import { listEventSitemapEntries } from "@/lib/events/around-event";

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.perfectday24.de";

function url(path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]): MetadataRoute.Sitemap[number] {
  return { url: `${SITE_URL}${path}`, lastModified: new Date(), changeFrequency, priority };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // ─── Static pages ────────────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    url("/", 1.0, "daily"),
    url("/explore", 0.9, "daily"),
    url("/planner", 0.9, "daily"),
    url("/partner", 0.7, "monthly"),
  ];

  // ─── City explore pages ───────────────────────────────────────────────────
  const cityPages: MetadataRoute.Sitemap = PLANNER_33_ROLLOUT
    .filter((c) => c.plannerVisibility === "visible")
    .map((c) => url(`/explore/${c.slug}`, 0.85, "daily"));

  // ─── Stadt-Anlass-Landing-Pages ───────────────────────────────────────────
  // Nur Kombinationen, fuer die es tatsaechlich Routen gibt — dieselbe Quelle
  // wie generateStaticParams, damit Sitemap und gebaute Seiten nicht
  // auseinanderlaufen.
  let occasionPages: MetadataRoute.Sitemap = [];
  try {
    const combos = await listOccasionParams();
    occasionPages = combos.map((combo) =>
      url(`/explore/${combo.city}/${combo.occasion}`, 0.8, "weekly")
    );
  } catch { /* ignore — sitemap degrades gracefully */ }

  // ─── Event-Strecke ────────────────────────────────────────────────────────
  // Stadt- und Kategorieseiten sind die bestaendigen Flaechen: Die Frage "Was
  // laeuft am Wochenende in Koeln?" wird jede Woche neu gestellt, die Seite dazu
  // bleibt. Aufgenommen wird nur, was in den naechsten 30 Tagen tatsaechlich
  // Inhalt hat — eine leere Kategorieseite im Index waere genau das Muster, das
  // schon bei den inhaltslosen Stadtseiten aufgefallen ist.
  //
  // Einzelne Veranstaltungen fehlen hier bewusst: Sie verfallen und stehen auf
  // noindex.
  let eventPages: MetadataRoute.Sitemap = [];
  try {
    const entries = await listEventSitemapEntries();
    eventPages = [
      url("/events", 0.8, "daily"),
      ...entries.flatMap((entry) => [
        url(`/events/${entry.citySlug}`, 0.75, "daily"),
        ...entry.categorySlugs.map((slug) =>
          url(`/events/${entry.citySlug}/kategorie/${slug}`, 0.7, "daily")
        ),
      ]),
    ];
  } catch { /* ignore — sitemap degrades gracefully */ }

  // ─── Public routes ────────────────────────────────────────────────────────
  let routePages: MetadataRoute.Sitemap = [];
  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: routes } = await supabase
        .from("user_routes")
        .select("slug, updated_at")
        .eq("visibility", "public")
        .not("slug", "is", null)
        .order("updated_at", { ascending: false })
        .limit(500);

      routePages = (routes ?? []).map((r) => ({
        url: `${SITE_URL}/routes/${r.slug}`,
        lastModified: r.updated_at ? new Date(r.updated_at) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
    } catch { /* ignore — sitemap degrades gracefully */ }
  }

  // ─── Creator pages ────────────────────────────────────────────────────────
  let creatorPages: MetadataRoute.Sitemap = [];
  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: creators } = await supabase
        .from("creator_profiles")
        .select("username, updated_at")
        .not("username", "is", null)
        .order("updated_at", { ascending: false })
        .limit(200);

      creatorPages = (creators ?? []).map((c) => ({
        url: `${SITE_URL}/creator/${c.username}`,
        lastModified: c.updated_at ? new Date(c.updated_at) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));
    } catch { /* ignore */ }
  }

  return [...staticPages, ...cityPages, ...occasionPages, ...eventPages, ...routePages, ...creatorPages];
}
