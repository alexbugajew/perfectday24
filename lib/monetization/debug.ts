import { MONETIZATION_PRODUCTS, SPONSORED_SLOT_CATALOG } from "./catalog";
import type { MonetizationProductKey, SponsoredSlotKey } from "./types";

export function isInternalMonetizationAvailable() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_PD24_INTERNAL_MONETIZATION_DEBUG === "1"
  );
}

export function isMonetizationDebugRequested(value?: string | null) {
  if (!value) return false;
  return value === "debug" || value === "1" || value === "true";
}

export function shouldShowInternalMonetization(value?: string | null) {
  return isInternalMonetizationAvailable() && isMonetizationDebugRequested(value);
}

export function getSponsoredSlotDefinition(slotKey: SponsoredSlotKey) {
  return SPONSORED_SLOT_CATALOG.find((slot) => slot.key === slotKey) ?? null;
}

export function getMonetizationProducts(productKeys: MonetizationProductKey[]) {
  return MONETIZATION_PRODUCTS.filter((product) => productKeys.includes(product.key));
}
