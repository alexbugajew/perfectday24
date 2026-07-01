// User-Premium-Checkout
// ============================================================================
// Vom Upsell-Modal / Profile-Seite gerufen. Startet Stripe-Checkout für den
// eingeloggten Endnutzer (nicht Partner). Aktueller Preis: 4,99 €/Monat.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { stripe, STRIPE_PLANS } from "@/lib/stripe/config";

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

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const plan = STRIPE_PLANS.user_premium;
    if (!plan.priceId) {
      return NextResponse.json(
        { error: "STRIPE_USER_PREMIUM_PRICE_ID fehlt in der Konfiguration" },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Bestehende Stripe-Customer-ID aus profiles ziehen (Idempotenz).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("stripe_customer_id")
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

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      customer_update: { address: "auto" as const },
      mode: "subscription" as const,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${baseUrl}/profile?premium=success`,
      cancel_url: `${baseUrl}/profile?premium=cancelled`,
      subscription_data: {
        metadata: { user_id: user.id, plan_key: "user_premium" },
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
