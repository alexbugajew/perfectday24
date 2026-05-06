import { PLANNER_33_ROLLOUT } from "./rollout";

const STATIC_CITY_SLUG_ALIASES: Record<string, string> = {};

const ROLLOUT_CITY_SLUG_ALIASES = Object.fromEntries(
  PLANNER_33_ROLLOUT.flatMap((city) =>
    (city.aliasSlugs ?? []).map((alias) => [alias, city.slug] satisfies [string, string])
  )
);

export const CITY_SLUG_ALIASES: Record<string, string> = {
  ...ROLLOUT_CITY_SLUG_ALIASES,
  ...STATIC_CITY_SLUG_ALIASES,
};

export function canonicalCitySlug(slug: string | null | undefined) {
  if (!slug) return null;
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  return CITY_SLUG_ALIASES[normalized] ?? normalized;
}

type CityLike = {
  slug: string;
  center_lat?: number | null;
  center_lng?: number | null;
  population?: number | null;
};

function hasPlausibleCoordinates(city: CityLike) {
  return (
    typeof city.center_lat === "number" &&
    typeof city.center_lng === "number" &&
    Number.isFinite(city.center_lat) &&
    Number.isFinite(city.center_lng) &&
    city.center_lat >= -90 &&
    city.center_lat <= 90 &&
    city.center_lng >= -180 &&
    city.center_lng <= 180
  );
}

function cityPriority(city: CityLike, canonicalSlug: string) {
  let score = 0;
  if (city.slug === canonicalSlug) score += 100;
  if (hasPlausibleCoordinates(city)) score += 20;
  if (typeof city.population === "number") score += Math.min(city.population / 100000, 20);
  return score;
}

export function dedupeCitiesByCanonicalSlug<T extends CityLike>(rows: T[]) {
  const bySlug = new Map<
    string,
    {
      row: T;
      priority: number;
    }
  >();

  for (const row of rows) {
    const canonicalSlug = canonicalCitySlug(row.slug) ?? row.slug;
    const candidate = { ...row, slug: canonicalSlug } as T;
    const priority = cityPriority(row, canonicalSlug);
    const existing = bySlug.get(canonicalSlug);

    if (!existing || priority > existing.priority) {
      bySlug.set(canonicalSlug, { row: candidate, priority });
    }
  }

  return Array.from(bySlug.values(), (entry) => entry.row);
}
