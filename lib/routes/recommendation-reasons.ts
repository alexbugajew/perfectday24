import { inferPublicRouteBadges } from "@/lib/routes/public-route-badges";

export type RecommendableRoute = {
  title: string | null;
  description: string | null;
  city_slug?: string | null;
  tags?: unknown;
  meta?: unknown;
  avg_rating?: number | null;
};

export function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
    .filter(Boolean);
}

export function routeSearchText(route: RecommendableRoute) {
  const meta = route.meta && typeof route.meta === "object" ? (route.meta as Record<string, unknown>) : {};
  const parts = [
    route.title,
    route.description,
    route.city_slug,
    typeof meta.primaryTheme === "string" ? meta.primaryTheme : "",
    typeof meta.occasion === "string" ? meta.occasion : "",
    typeof meta.routeProfile === "string" ? meta.routeProfile : "",
    ...normalizeStringList(route.tags),
    ...normalizeStringList(meta.routeTags),
    ...inferPublicRouteBadges(route).map((badge) => badge.label.toLowerCase()),
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function scoreRouteAgainstInterests(route: RecommendableRoute, interests: string[]) {
  if (!interests.length) return 0;

  const haystack = routeSearchText(route);
  const tags = new Set(normalizeStringList(route.tags));
  const meta = route.meta && typeof route.meta === "object" ? (route.meta as Record<string, unknown>) : {};
  const routeTags = new Set(normalizeStringList(meta.routeTags));
  const badges = new Set(inferPublicRouteBadges(route).map((badge) => badge.label.toLowerCase()));

  let score = 0;

  for (const interest of interests) {
    if (haystack.includes(interest)) score += 5;
    if (tags.has(interest)) score += 4;
    if (routeTags.has(interest)) score += 4;

    if (
      (interest.includes("museum") && badges.has("kultur")) ||
      (interest.includes("park") && badges.has("outdoor")) ||
      (interest.includes("walk") && badges.has("zu fuß")) ||
      (interest.includes("bar") && badges.has("party")) ||
      (interest.includes("wine") && badges.has("date")) ||
      (interest.includes("cocktail") && badges.has("party")) ||
      (interest.includes("family") && badges.has("familie")) ||
      (interest.includes("date") && badges.has("date"))
    ) {
      score += 3;
    }
  }

  score += Math.min(2, Math.round((route.avg_rating ?? 0) / 2));
  return score;
}

export function explainInterestMatch(route: RecommendableRoute, interests: string[], opts?: { terse?: boolean }) {
  if (!interests.length) return null;

  const haystack = routeSearchText(route);
  const matches: string[] = [];

  for (const interest of interests) {
    if (haystack.includes(interest)) matches.push(interest);
    if (matches.length >= (opts?.terse ? 2 : 3)) break;
  }

  if (matches.length === 0) {
    return opts?.terse ? null : "Passt zu deinem Profil und ähnlichen Routenthemen.";
  }

  return opts?.terse
    ? `Passt zu dir wegen ${matches.join(" + ")}.`
    : `Passt wegen ${matches.join(" + ")}.`;
}

export function buildInterestReasonBadges(route: RecommendableRoute, interests: string[]) {
  if (!interests.length) return [] as string[];

  const haystack = routeSearchText(route);
  const out: string[] = [];
  const matchedInterests: string[] = [];

  for (const interest of interests) {
    if (haystack.includes(interest)) matchedInterests.push(interest);
    if (matchedInterests.length >= 2) break;
  }

  for (const interest of matchedInterests) {
    out.push(`wegen ${interest}`);
  }

  const routeBadges = new Set(inferPublicRouteBadges(route).map((badge) => badge.label.toLowerCase()));
  if (routeBadges.has("kultur")) out.push("Kultur");
  else if (routeBadges.has("outdoor")) out.push("Outdoor");
  else if (routeBadges.has("food")) out.push("Food");
  else if (routeBadges.has("party")) out.push("Nightlife");

  return out.slice(0, 3);
}
