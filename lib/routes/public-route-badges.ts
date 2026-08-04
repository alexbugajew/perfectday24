export type PublicRouteBadge = {
  label: string;
  tone?: "neutral" | "dark" | "soft";
};

type BadgeInput = {
  title?: string | null;
  description?: string | null;
  start_type?: string | null;
  start_label?: string | null;
  tags?: unknown;
  meta?: unknown;
};

function textOf(route: BadgeInput) {
  return `${route.title ?? ""} ${route.description ?? ""} ${route.start_type ?? ""} ${route.start_label ?? ""}`.toLowerCase();
}

function hasAny(text: string, parts: string[]) {
  return parts.some((part) => text.includes(part));
}

function routeTags(route: BadgeInput) {
  if (Array.isArray(route.tags)) {
    return route.tags
      .map((value) => (typeof value === "string" ? value.toLowerCase().trim() : ""))
      .filter(Boolean);
  }
  return [];
}

function routeMeta(route: BadgeInput) {
  return route.meta && typeof route.meta === "object" ? (route.meta as Record<string, unknown>) : {};
}

export function inferPublicRouteBadges(route: BadgeInput): PublicRouteBadge[] {
  const text = textOf(route);
  const tags = routeTags(route);
  const meta = routeMeta(route);
  const badges: PublicRouteBadge[] = [];
  const explicitOccasion = typeof meta.occasion === "string" ? meta.occasion.toLowerCase() : "";
  const explicitProfile = typeof meta.routeProfile === "string" ? meta.routeProfile.toLowerCase() : "";
  const explicitTheme = typeof meta.primaryTheme === "string" ? meta.primaryTheme.toLowerCase() : "";

  if (explicitOccasion === "date" || tags.includes("date")) {
    badges.push({ label: "Date", tone: "dark" });
  } else if (explicitOccasion === "family" || tags.includes("family")) {
    badges.push({ label: "Familie", tone: "soft" });
  } else if (explicitOccasion === "tourism" || tags.includes("tourism")) {
    badges.push({ label: "Sightseeing", tone: "neutral" });
  } else if (explicitOccasion === "party" || tags.includes("party")) {
    badges.push({ label: "Party", tone: "dark" });
  } else if (explicitOccasion === "friends" || tags.includes("friends")) {
    badges.push({ label: "Freunde", tone: "neutral" });
  }

  if (
    badges.length === 0 &&
    hasAny(text, ["date", "romantik", "wine", "rooftop", "sunset", "couple"])
  ) {
    badges.push({ label: "Date", tone: "dark" });
  } else if (hasAny(text, ["family", "kinder", "zoo", "aquarium", "science center", "spiel", "kids"])) {
    badges.push({ label: "Familie", tone: "soft" });
  } else if (hasAny(text, ["tourism", "museum", "landmark", "altstadt", "old town", "sightseeing", "viewpoint"])) {
    badges.push({ label: "Sightseeing", tone: "neutral" });
  } else if (hasAny(text, ["party", "club", "bar", "techno", "nightlife", "late food", "afterhour"])) {
    badges.push({ label: "Party", tone: "dark" });
  } else if (hasAny(text, ["friends", "arcade", "bowling", "social", "group", "burger"])) {
    badges.push({ label: "Freunde", tone: "neutral" });
  }

  if (explicitProfile === "foot" || tags.includes("foot")) {
    badges.push({ label: "Zu Fuß", tone: "soft" });
  } else if (explicitProfile === "car" || tags.includes("car")) {
    badges.push({ label: "Mit Auto", tone: "soft" });
  } else if (hasAny(text, ["walk", "spazier", "zu fu", "foot", "promenade", "park"])) {
    badges.push({ label: "Zu Fuß", tone: "soft" });
  } else if (hasAny(text, ["roadtrip", "auto", "car", "drive", "outskirts", "umland"])) {
    badges.push({ label: "Mit Auto", tone: "soft" });
  }

  if (explicitTheme === "food" || tags.includes("food")) {
    badges.push({ label: "Food", tone: "neutral" });
  } else if (explicitTheme === "culture" || tags.includes("culture")) {
    badges.push({ label: "Kultur", tone: "neutral" });
  } else if (explicitTheme === "outdoor" || tags.includes("outdoor")) {
    badges.push({ label: "Outdoor", tone: "soft" });
  } else if (hasAny(text, ["food", "dinner", "restaurant", "cafe", "coffee", "brunch", "sushi", "vegan", "italien"])) {
    badges.push({ label: "Food", tone: "neutral" });
  } else if (hasAny(text, ["museum", "gallery", "theater", "culture", "history"])) {
    badges.push({ label: "Kultur", tone: "neutral" });
  } else if (hasAny(text, ["park", "outdoor", "nature", "river", "view", "walk"])) {
    badges.push({ label: "Outdoor", tone: "soft" });
  }

  const uniqueBadges = badges.filter(
    (badge, index, allBadges) =>
      index === allBadges.findIndex((candidate) => candidate.label === badge.label),
  );

  return uniqueBadges.slice(0, 3);
}
