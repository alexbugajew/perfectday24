import Stripe from "stripe";

// Lazy initialisation – the Stripe client is only created on first use
// (i.e. during request handling), NOT at module-evaluation time.
// This prevents build failures when STRIPE_SECRET_KEY is absent at build time.
let _stripeInstance: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!_stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY fehlt");
    }
    _stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      typescript: true,
    });
  }
  return _stripeInstance;
}

// Proxy keeps all call-sites (`stripe.customers.create(…)` etc.) unchanged.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripeClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export type StripePlanKey = "partner_basic" | "partner_pro" | "user_premium";

export const USER_PREMIUM_PLAN = {
  key: "user_premium" as const,
  label: "PerfectDay24 Premium",
  priceId: process.env.STRIPE_USER_PREMIUM_PRICE_ID ?? "",
  amountCents: 499,
  currency: "eur",
  interval: "month" as const,
};

// Jahresplan (2 Monate geschenkt gegenüber 12 × 4,99 €). Ohne gesetzte
// Env-Variable blendet das Upgrade-Modal die Jahres-Option einfach aus.
export const USER_PREMIUM_YEARLY_PRICE_ID = process.env.STRIPE_USER_PREMIUM_YEARLY_PRICE_ID ?? "";
export const USER_PREMIUM_YEARLY_AMOUNT_CENTS = 3999;

// Kostenlose Testphase für Endnutzer — nur beim allerersten Abo.
export const USER_PREMIUM_TRIAL_DAYS = 14;

// Partner (B2B) testen 3 Monate kostenlos: Sichtbarkeits-Effekte in
// KI-Plänen brauchen Zeit, der ROI-Rechner liefert danach eigene Zahlen.
export const PARTNER_TRIAL_DAYS = 90;

export type StripePlan = {
  key: StripePlanKey;
  label: string;
  priceId: string;
  amountCents: number;
  currency: string;
  interval: "month";
  tier: string;
};

export type PartnerSubscriptionTier = "organic" | "partner_basic" | "partner_pro";

export type PartnerBillingStatus =
  | "free"
  | "inactive"
  | "trial"
  | "active"
  | "past_due"
  | "cancelled"
  | "manual";

export const STRIPE_PLANS: Record<StripePlanKey, StripePlan> = {
  partner_basic: {
    key: "partner_basic",
    label: "Partner Basic",
    priceId: process.env.STRIPE_BASIC_PRICE_ID ?? "",
    amountCents: 4900,
    currency: "eur",
    interval: "month",
    tier: "partner_basic",
  },
  partner_pro: {
    key: "partner_pro",
    label: "Partner Pro",
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? "",
    amountCents: 14900,
    currency: "eur",
    interval: "month",
    tier: "partner_pro",
  },
  user_premium: {
    key: "user_premium",
    label: USER_PREMIUM_PLAN.label,
    priceId: USER_PREMIUM_PLAN.priceId,
    amountCents: USER_PREMIUM_PLAN.amountCents,
    currency: USER_PREMIUM_PLAN.currency,
    interval: USER_PREMIUM_PLAN.interval,
    tier: "user_premium",
  },
};

export function getTierForPriceId(priceId: string): PartnerSubscriptionTier {
  for (const plan of Object.values(STRIPE_PLANS)) {
    if (plan.priceId === priceId) {
      return plan.tier as PartnerSubscriptionTier;
    }
  }
  return "organic";
}

export function getBillingStatusForStripeStatus(
  stripeStatus: Stripe.Subscription.Status
): PartnerBillingStatus {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "cancelled";
    case "trialing":
      return "trial";
    case "unpaid":
      return "past_due";
    default:
      return "inactive";
  }
}
