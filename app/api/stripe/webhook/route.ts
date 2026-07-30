import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import {
  stripe,
  getTierForPriceId,
  getBillingStatusForStripeStatus,
} from "@/lib/stripe/config";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function isUserPremiumSub(subscription: Stripe.Subscription): boolean {
  return subscription.metadata?.plan_key === "user_premium";
}

/**
 * Prüft, dass `metadata.user_id` wirklich zum Stripe-Customer des Abos gehört.
 *
 * Die Metadata wird zwar nur serverseitig gesetzt, aber wer sie auf anderem Weg
 * beeinflussen kann (zweite Integration, Dashboard-Zugriff), könnte sonst
 * `is_premium` auf ein fremdes Konto schreiben. Deshalb hier der Gegencheck über
 * `profiles.stripe_customer_id`.
 */
async function userIdMatchesCustomer(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  customerId: string | null
): Promise<boolean> {
  if (!customerId) return true; // ohne Customer nichts zu vergleichen

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("webhook: customer/user check failed", error);
    return false;
  }

  const storedCustomer = (data?.stripe_customer_id as string | null) ?? null;
  // Erstabschluss: noch kein Customer gespeichert — dann ist die Zuordnung neu
  // und wird durch diesen Webhook erst hergestellt.
  if (!storedCustomer) return true;
  return storedCustomer === customerId;
}

async function updateUserPremiumFromSubscription(
  subscription: Stripe.Subscription,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  const userId = subscription.metadata?.user_id ?? null;
  if (!userId) {
    console.warn("webhook: user_premium sub missing user_id", subscription.id);
    return;
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

  if (!(await userIdMatchesCustomer(supabase, userId, customerId))) {
    console.error(
      "webhook: user_id passt nicht zum Stripe-Customer — Update verworfen",
      subscription.id
    );
    return;
  }

  const firstItem = subscription.items.data[0];
  const rawPeriodEnd = firstItem?.current_period_end ?? null;
  const periodEnd = rawPeriodEnd ? new Date(rawPeriodEnd * 1000).toISOString() : null;

  const active = ["active", "trialing"].includes(subscription.status);

  const patch: Record<string, unknown> = {
    is_premium: active,
    premium_until: periodEnd,
    stripe_subscription_id: subscription.id,
    updated_at: new Date().toISOString(),
  };
  if (active) patch.premium_started_at = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("profiles")
    .update(patch)
    .eq("user_id", userId);
  if (error) console.error("webhook: updateUserPremiumFromSubscription failed", error);
}

async function updatePartnerFromSubscription(
  subscription: Stripe.Subscription,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  if (isUserPremiumSub(subscription)) {
    await updateUserPremiumFromSubscription(subscription, supabase);
    return;
  }

  const partnerProfileId =
    subscription.metadata?.partner_profile_id ??
    (subscription as any).subscription_data?.metadata?.partner_profile_id ??
    null;

  if (!partnerProfileId) {
    console.warn("webhook: subscription missing partner_profile_id metadata", subscription.id);
    return;
  }

  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price?.id ?? null;
  const tier = priceId ? getTierForPriceId(priceId) : "organic";
  const billingStatus = getBillingStatusForStripeStatus(subscription.status);
  // current_period_end moved to SubscriptionItem in newer Stripe API versions.
  const rawPeriodEnd = firstItem?.current_period_end ?? null;
  const periodEnd = rawPeriodEnd ? new Date(rawPeriodEnd * 1000).toISOString() : null;

  const visibilityTier =
    tier === "partner_pro"
      ? "partner_pro"
      : tier === "partner_basic"
        ? "partner_basic"
        : undefined;

  const patch: Record<string, unknown> = {
    stripe_subscription_id: subscription.id,
    billing_status: billingStatus,
    current_tier: tier,
    subscription_period_end: periodEnd,
    updated_at: new Date().toISOString(),
  };

  if (visibilityTier) {
    patch.visibility_tier = visibilityTier;
  }

  const { error } = await supabase
    .from("partner_profiles")
    .update(patch)
    .eq("id", partnerProfileId);

  if (error) {
    console.error("webhook: updatePartnerFromSubscription failed", error);
  }
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  const planKey = session.metadata?.plan_key ?? null;
  const isUserPremium = planKey === "user_premium";
  const partnerProfileId = session.metadata?.partner_profile_id ?? null;

  if (!partnerProfileId && !isUserPremium) {
    console.warn("webhook: checkout.session.completed missing routing metadata", session.id);
    return;
  }

  if (partnerProfileId && session.customer) {
    // Persist the Stripe customer id if the partner doesn't have one yet.
    await supabase
      .from("partner_profiles")
      .update({
        stripe_customer_id: session.customer as string,
        updated_at: new Date().toISOString(),
      })
      .eq("id", partnerProfileId)
      .is("stripe_customer_id", null);
  }

  // Retrieve the subscription to get the full state.
  if (session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    );
    await updatePartnerFromSubscription(subscription, supabase);
  }
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  if (isUserPremiumSub(subscription)) {
    const userId = subscription.metadata?.user_id ?? null;
    if (!userId) {
      console.warn("webhook: user_premium sub.deleted missing user_id", subscription.id);
      return;
    }

    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id ?? null;

    if (!(await userIdMatchesCustomer(supabase, userId, customerId))) {
      console.error(
        "webhook: user_id passt nicht zum Stripe-Customer — Delete verworfen",
        subscription.id
      );
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("profiles")
      .update({
        is_premium: false,
        stripe_subscription_id: null,
        premium_cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (error) console.error("webhook: user_premium delete failed", error);
    return;
  }

  const partnerProfileId = subscription.metadata?.partner_profile_id ?? null;

  if (!partnerProfileId) {
    console.warn("webhook: subscription.deleted missing partner_profile_id", subscription.id);
    return;
  }

  const { error } = await supabase
    .from("partner_profiles")
    .update({
      billing_status: "cancelled",
      current_tier: "organic",
      visibility_tier: "organic",
      stripe_subscription_id: null,
      subscription_period_end: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", partnerProfileId);

  if (error) {
    console.error("webhook: handleSubscriptionDeleted failed", error);
  }
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "stripe-signature Header fehlt" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("webhook: STRIPE_WEBHOOK_SECRET fehlt");
    return NextResponse.json({ error: "Webhook nicht konfiguriert" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("webhook: signature verification failed:", message);
    return NextResponse.json({ error: `Webhook-Signatur ungültig: ${message}` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
          supabase
        );
        break;
      }

      case "customer.subscription.updated": {
        await updatePartnerFromSubscription(
          event.data.object as Stripe.Subscription,
          supabase
        );
        break;
      }

      case "customer.subscription.deleted": {
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
          supabase
        );
        break;
      }

      default:
        // Unhandled events are fine — return 200 so Stripe doesn't retry.
        break;
    }
  } catch (error) {
    console.error(`webhook: handler failed for ${event.type}:`, error);
    return NextResponse.json({ error: "Webhook-Verarbeitung fehlgeschlagen" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
