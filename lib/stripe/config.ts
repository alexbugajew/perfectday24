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

export type StripePlanKey = "partner_basic" | "partner_pro";

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
