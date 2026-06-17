// ─── Types ────────────────────────────────────────────────────────────────────

export type VendorPackage = {
  id: string;
  name: string;
  price: number;           // euros (not cents)
  price_type: string;      // 'total' | 'per_person' | 'per_hour'
  // display extras (preserved, not used in scoring)
  description?: string | null;
  min_guests?: number | null;
  max_guests?: number | null;
  includes?: string[];
};

export type VendorWithScore = {
  id: string;
  name: string;
  media_urls: string[];
  cover_image_url?: string | null;
  booking_type: string;
  visibility_tier: string;
  service_category_slugs: string[];
  packages: VendorPackage[];
  score: number;
  badge: "recommended" | "best_value" | "new" | null;
  // display extras
  description?: string | null;
  is_verified?: boolean;
  contact_email?: string | null;
  minPrice: number;
};

// ─── Scoring ─────────────────────────────────────────────────────────────────

export function scoreVendors(
  vendors: Record<string, unknown>[],
  categoryBudget: number,  // euro
  guestCount: number
): VendorWithScore[] {
  return vendors
    .map((vendor) => {
      let score = 0;

      // Faktor 1: Partner-Tier (max 30 Punkte)
      if (vendor.visibility_tier === "partner_pro") score += 30;
      else if (vendor.visibility_tier === "partner_basic") score += 15;
      // else organic → 0

      // Faktor 2: Budget-Passung (max 40 Punkte)
      const packages = (vendor.packages as VendorPackage[] | undefined) ?? [];
      const prices = packages
        .map((p) =>
          p.price_type === "per_person"
            ? p.price * Math.max(guestCount, 1)
            : p.price
        )
        .filter((p) => p > 0);

      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;

      const ratio = categoryBudget > 0 ? minPrice / categoryBudget : 0;

      if (ratio >= 0.8 && ratio <= 1.1) score += 40;
      else if (ratio >= 0.6 && ratio <= 1.3) score += 25;
      else if (ratio >= 0.4 && ratio <= 1.5) score += 10;
      // else 0

      // Faktor 3: Profil-Vollständigkeit (max 30 Punkte)
      const mediaUrls = (vendor.media_urls as string[] | undefined) ?? [];
      if (mediaUrls.length > 0) score += 10;
      if (mediaUrls.length >= 3) score += 5;
      if (vendor.booking_type === "instant" || vendor.booking_type === "direct") score += 10;
      if (vendor.contact_email) score += 5;

      return { ...(vendor as object), score, badge: null as VendorWithScore["badge"], minPrice } as VendorWithScore & { minPrice: number };
    })
    .sort((a, b) => b.score - a.score)
    .map((vendor, index, arr) => {
      let badge: VendorWithScore["badge"] = null;

      if (index === 0) {
        badge = "recommended";
      } else if (vendor.minPrice === Math.min(...arr.map((v) => v.minPrice))) {
        badge = "best_value";
      } else if (
        (vendor.packages?.length ?? 0) === 0 ||
        vendor.visibility_tier === "organic"
      ) {
        badge = "new";
      }

      return { ...vendor, badge };
    });
}

// ─── Badge labels & colours ───────────────────────────────────────────────────

export const BADGE_LABEL: Record<NonNullable<VendorWithScore["badge"]>, string> = {
  recommended: "✨ Empfohlen",
  best_value:  "💰 Bestes Preis-Leistung",
  new:         "🆕 Neu auf PerfectDay24",
};

export const BADGE_CLASS: Record<NonNullable<VendorWithScore["badge"]>, string> = {
  recommended: "bg-[var(--brand-accent)] text-white",
  best_value:  "bg-emerald-600 text-white",
  new:         "bg-[var(--bg-surface)] border border-[var(--line-subtle)] text-[var(--text-muted)]",
};
