export function routeVariantMeta(route: { meta?: unknown } | null | undefined) {
  if (!route?.meta || typeof route.meta !== "object") return null;
  const meta = route.meta as Record<string, unknown>;
  if (!meta.personalizedVariant || typeof meta.personalizedVariant !== "object") return null;
  return meta.personalizedVariant as Record<string, unknown>;
}

export type VariantFilter = "all" | "original" | "variant";
export type VariantSort = "default" | "original-first" | "variant-first";

export function isVariantRoute(route: { meta?: unknown } | null | undefined) {
  return Boolean(routeVariantMeta(route));
}

export function matchesVariantFilter(
  route: { meta?: unknown } | null | undefined,
  filter: VariantFilter
) {
  if (filter === "all") return true;
  const isVariant = isVariantRoute(route);
  return filter === "variant" ? isVariant : !isVariant;
}

export function compareVariantOrder(
  a: { meta?: unknown } | null | undefined,
  b: { meta?: unknown } | null | undefined,
  sort: VariantSort
) {
  if (sort === "default") return 0;

  const aVariant = isVariantRoute(a) ? 1 : 0;
  const bVariant = isVariantRoute(b) ? 1 : 0;
  if (aVariant === bVariant) return 0;

  if (sort === "variant-first") return bVariant - aVariant;
  return aVariant - bVariant;
}

export function routeVariantRoleLabel(
  route: { meta?: unknown; tags?: unknown },
  currentBaseRouteId?: string | null
) {
  const variantMeta = routeVariantMeta(route);
  if (!variantMeta) return null;

  const variantName =
    typeof variantMeta.variantName === "string" && variantMeta.variantName.trim().length > 0
      ? variantMeta.variantName.trim()
      : null;
  if (variantName) return variantName;

  const groupLabel =
    typeof variantMeta.groupLabel === "string" && variantMeta.groupLabel.trim().length > 0
      ? variantMeta.groupLabel.trim()
      : null;

  const interests = Array.isArray(variantMeta.interests)
    ? variantMeta.interests.filter((value): value is string => typeof value === "string")
    : [];

  const tags = Array.isArray(route.tags)
    ? route.tags.filter((value): value is string => typeof value === "string").map((value) => value.toLowerCase())
    : [];

  const routeMeta = route.meta && typeof route.meta === "object" ? (route.meta as Record<string, unknown>) : {};
  const primaryTheme = typeof routeMeta.primaryTheme === "string" ? routeMeta.primaryTheme : null;

  if (groupLabel && groupLabel !== "Für dich") return "Für unsere Gruppe";
  if (interests.some((value) => ["vegan", "vegetarisch", "vegetarian"].includes(value.toLowerCase())) || tags.includes("vegan")) {
    return "Vegane Variante";
  }
  if (primaryTheme === "nightlife" || tags.includes("nightlife") || tags.includes("party")) {
    return "Nightlife Edition";
  }
  if (primaryTheme === "food" || tags.includes("food")) {
    return "Food Edition";
  }
  if (variantMeta.baseRouteId && variantMeta.baseRouteId === currentBaseRouteId) {
    return "Verwandte Variante";
  }
  return "Persönliche Variante";
}
