// User-Premium-Checkout
// ============================================================================
// Vom Upsell-Modal / Profile-Seite gerufen. Startet Stripe-Checkout für den
// eingeloggten Endnutzer (nicht Partner). Aktueller Preis: 4,99 €/Monat.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  stripe,
  STRIPE_PLANS,
  STRIPE_AUTOMATIC_TAX_ENABLED,
  USER_PREMIUM_TRIAL_DAYS,
  USER_PREMIUM_YEARLY_AMOUNT_CENTS,
  USER_PREMIUM_YEARLY_PRICE_ID,
} from "@/lib/stripe/config";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

async function getSessionUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Liefert dem Upgrade-Modal die Checkout-Optionen: verfügbare Intervalle,
 * Preise und ob dieser Nutzer noch Anspruch auf die Testphase hat
 * (nur wer noch nie ein Abo hatte).
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("stripe_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      monthlyAmountCents: STRIPE_PLANS.user_premium.amountCents,
      yearlyAvailable: Boolean(USER_PREMIUM_YEARLY_PRICE_ID),
      yearlyAmountCents: USER_PREMIUM_YEARLY_AMOUNT_CENTS,
      trialEligible: !profile?.stripe_subscription_id,
      trialDays: USER_PREMIUM_TRIAL_DAYS,
    });
  } catch (err) {
    console.error("[user-checkout GET]", err);
    return NextResponse.json({ error: "Konfiguration nicht verfügbar" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { interval?: string };
    const interval = body.interval === "year" ? "year" : "month";

    const plan = STRIPE_PLANS.user_premium;
    const priceId = interval === "year" ? USER_PREMIUM_YEARLY_PRICE_ID : plan.priceId;
    if (!priceId) {
      return NextResponse.json(
        {
          error:
            interval === "year"
              ? "STRIPE_USER_PREMIUM_YEARLY_PRICE_ID fehlt in der Konfiguration"
              : "STRIPE_USER_PREMIUM_PRICE_ID fehlt in der Konfiguration",
        },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Bestehende Stripe-Customer-ID aus profiles ziehen (Idempotenz).
    // stripe_subscription_id entscheidet über den Trial-Anspruch.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("stripe_customer_id,stripe_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let stripeCustomerId: string | null = profile?.stripe_customer_id ?? null;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id, tier: "user_premium" },
      });
      stripeCustomerId = customer.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("profiles")
        .upsert({ user_id: user.id, stripe_customer_id: stripeCustomerId }, { onConflict: "user_id" });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // Testphase nur beim allerersten Abo — wer schon einmal Kunde war,
    // startet direkt bezahlt (verhindert Trial-Hopping).
    const trialEligible = !profile?.stripe_subscription_id;

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      // name: "auto" wird von tax_id_collection bei bestehendem Customer verlangt.
      customer_update: { address: "auto" as const, name: "auto" as const },
      ...(STRIPE_AUTOMATIC_TAX_ENABLED
        ? { automatic_tax: { enabled: true }, tax_id_collection: { enabled: true } }
        : {}),
      mode: "subscription" as const,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/profile?premium=success`,
      cancel_url: `${baseUrl}/profile?premium=cancelled`,
      subscription_data: {
        metadata: { user_id: user.id, plan_key: "user_premium" },
        ...(trialEligible ? { trial_period_days: USER_PREMIUM_TRIAL_DAYS } : {}),
      },
      metadata: { user_id: user.id, plan_key: "user_premium" },
      allow_promotion_codes: true,
      billing_address_collection: "required" as const,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[user-checkout]", err);
    return NextResponse.json({ error: "Checkout fehlgeschlagen" }, { status: 500 });
  }
}
