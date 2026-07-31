import { createClient } from "@supabase/supabase-js";
import {
  PLANNER_33_ROLLOUT,
  PLANNER_VISIBLE_CITY_ROLLOUT,
} from "@/lib/cities/rollout";

// Reichweiten-Zahlen für Homepage / Partner-Seite. Bis 07/2026 waren diese
// Werte hart codiert und mussten bei jeder Ausbaustufe manuell nachgezogen
// werden. Jetzt: Städte direkt aus der Rollout-Konfiguration (immer synchron
// mit der nächsten Welle), Location-/Anbieter-Counts per Supabase-HEAD-Query
// mit In-Memory-Cache; zusätzlich cachen die Seiten selbst per ISR.
// Nur serverseitig verwenden (Service-Role-Key!).

export type ReachStats = {
  visibleCities: number;
  totalCities: number;
  plannableLocations: number;
  locationsWithOpeningHours: number;
  activeEventProviders: number;
};

// Manuell verifizierter Live-Stand 31.07.2026 — greift, wenn die DB nicht
// erreichbar ist (z. B. -noxl-CI-Build ohne Supabase-Credentials).
const FALLBACK_COUNTS = {
  plannableLocations: 226_000,
  locationsWithOpeningHours: 38_500,
  activeEventProviders: 14_700,
} as const;

const TTL_OK_MS = 24 * 60 * 60 * 1000;
// Nach einem Fehlschlag früher erneut versuchen, aber nicht pro Request.
const TTL_ERROR_MS = 10 * 60 * 1000;

let cache: { at: number; ttl: number; stats: ReachStats } | null = null;

function buildServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getReachStats(): Promise<ReachStats> {
  if (cache && Date.now() - cache.at < cache.ttl) return cache.stats;

  const stats: ReachStats = {
    visibleCities: PLANNER_VISIBLE_CITY_ROLLOUT.length,
    totalCities: PLANNER_33_ROLLOUT.length,
    plannableLocations: FALLBACK_COUNTS.plannableLocations,
    locationsWithOpeningHours: FALLBACK_COUNTS.locationsWithOpeningHours,
    activeEventProviders: FALLBACK_COUNTS.activeEventProviders,
  };

  let ok = false;
  const supabase = buildServerClient();
  if (supabase) {
    try {
      const [plannable, withHours, providers] = await Promise.all([
        supabase
          .from("locations")
          .select("id", { count: "exact", head: true })
          .eq("is_plannable", true),
        supabase
          .from("locations")
          .select("id", { count: "exact", head: true })
          .eq("is_plannable", true)
          .not("opening_hours_raw", "is", null),
        supabase
          .from("service_providers")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
      ]);
      // count === null/0 heißt Query-Problem bzw. leere Tabelle — dann lieber
      // beim (plausiblen) Fallback bleiben als "0" auf die Homepage schreiben.
      if (plannable.count) {
        stats.plannableLocations = plannable.count;
        ok = true;
      }
      if (withHours.count) stats.locationsWithOpeningHours = withHours.count;
      if (providers.count) stats.activeEventProviders = providers.count;
    } catch {
      ok = false;
    }
  }

  cache = { at: Date.now(), ttl: ok ? TTL_OK_MS : TTL_ERROR_MS, stats };
  return stats;
}

// "226.431" → "226.000+": abrunden auf einen glatten Schritt, damit die Zahl
// als Mindestwert ehrlich bleibt und nicht bei jedem Ingest flackert.
export function formatReachCount(value: number, step: number): string {
  const floored = Math.floor(value / step) * step;
  return `${floored.toLocaleString("de-DE")}+`;
}
