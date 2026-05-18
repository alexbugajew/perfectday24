import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe, STRIPE_PLANS, type StripePlanKey } from "@/lib/stripe/config";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function getSupabaseUser(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "").trim() ?? "";

    if (!token) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { data: { user }, error: authError } = await getSupabaseUser(token).auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Ungültige Session" }, { status: 401 });
    }

    const body = (await req.json()) as { tier?: string; partner_entity_id?: string };
    const { tier, partner_entity_id } = body;

    if (!tier || !partner_entity_id) {
      return NextResponse.json({ error: "tier und partner_entity_id sind erforderlich" }, { status: 400 });
    }

    const planKey = tier as StripePlanKey;
    const plan = STRIPE_PLANS[planKey];
    if (!plan) {
      return NextResponse.json({ error: `Unbekannter Plan: ${tier}` }, { status: 400 });
    }

    if (!plan.priceId) {
      return NextResponse.json(
        { error: `STRIPE_${tier.toUpperCase()}_PRICE_ID fehlt in der Konfiguration` },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Verify the user has access to this partner profile.
    const { data: membership, error: membershipError } = await supabase
      .from("partner_memberships")
      .select("role")
      .eq("partner_profile_id", partner_entity_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .in("role", ["owner", "admin"])
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "Kein Zugriff auf dieses Partner-Profil" },
        { status: 403 }
      );
    }

    // Fetch the partner profile to check for an existing Stripe customer.
    const { data: partner, error: partnerError } = await supabase
      .from("partner_profiles")
      .select("id, display_name, stripe_customer_id, billing_status")
      .eq("id", partner_entity_id)
      .single();

    if (partnerError || !partner) {
      return NextResponse.json({ error: "Partner-Profil nicht gefunden" }, { status: 404 });
    }

    // Find or create the Stripe customer, keyed to this partner profile.
    let stripeCustomerId = partner.stripe_customer_id as string | null;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: partner.display_name,
        metadata: {
          partner_profile_id: partner_entity_id,
          user_id: user.id,
        },
      });
      stripeCustomerId = customer.id;

      await supabase
        .from("partner_profiles")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", partner_entity_id);
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${baseUrl}/partner/billing?session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${baseUrl}/partner/billing?status=cancelled`,
      subscription_data: {
        metadata: {
          partner_profile_id: partner_entity_id,
          plan_key: planKey,
        },
      },
      metadata: {
        partner_profile_id: partner_entity_id,
        plan_key: planKey,
        user_id: user.id,
      },
      allow_promotion_codes: true,
      billing_address_collection: "required",
      customer_update: { address: "auto" },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("create-checkout failed:", error);
    return NextResponse.json({ error: "Checkout konnte nicht erstellt werden" }, { status: 500 });
  }
}
