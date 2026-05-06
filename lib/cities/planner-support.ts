import { canonicalCitySlug } from "@/lib/cities/canonical";
import { getPlannerRolloutCity, PLANNER_VISIBLE_CITY_SLUGS } from "@/lib/cities/rollout";

export const PLANNER_SUPPORTED_CITY_SLUGS = new Set<string>(PLANNER_VISIBLE_CITY_SLUGS);

export function isPlannerSupportedCitySlug(slug: string | null | undefined) {
  const canonical = canonicalCitySlug(slug);
  if (!canonical) return false;
  return PLANNER_SUPPORTED_CITY_SLUGS.has(canonical);
}

export function plannerCitySupportsEventModes(slug: string | null | undefined) {
  const canonical = canonicalCitySlug(slug);
  if (!canonical) return false;
  const rolloutCity = getPlannerRolloutCity(canonical);
  return rolloutCity?.readinessTier === "full";
}
