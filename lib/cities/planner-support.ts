import { canonicalCitySlug } from "@/lib/cities/canonical";
import {
  getPlannerRolloutCity,
  PLANNER_33_ROLLOUT,
  PLANNER_VISIBLE_CITY_SLUGS,
} from "@/lib/cities/rollout";

export const PLANNER_SUPPORTED_CITY_SLUGS = new Set<string>(PLANNER_VISIBLE_CITY_SLUGS);

export function isPlannerSupportedCitySlug(slug: string | null | undefined) {
  const canonical = canonicalCitySlug(slug);
  if (!canonical) return false;
  return PLANNER_SUPPORTED_CITY_SLUGS.has(canonical);
}

// Events- und Partner-Flows decken ALLE Rollout-Städte ab: Die OSM-Dienstleister
// wurden für alle 704 Groß- und Mittelstädte importiert — unabhängig davon, ob
// eine Stadt ihr Planner-Sichtbarkeits-Gate (Location-Basis für Tagespläne)
// schon bestanden hat. Statisch aus der Rollout-Config, keine DB-Query nötig.
export const EVENT_SUPPORTED_CITY_OPTIONS: { slug: string; name: string }[] = [
  ...PLANNER_33_ROLLOUT,
]
  .sort((a, b) => a.label.localeCompare(b.label, "de"))
  .map((city) => ({ slug: city.slug, name: city.label }));

export function isEventSupportedCitySlug(slug: string | null | undefined) {
  const canonical = canonicalCitySlug(slug);
  if (!canonical) return false;
  return getPlannerRolloutCity(canonical) != null;
}

export function plannerCitySupportsEventModes(slug: string | null | undefined) {
  const canonical = canonicalCitySlug(slug);
  if (!canonical) return false;
  const rolloutCity = getPlannerRolloutCity(canonical);
  return rolloutCity?.readinessTier === "full";
}
