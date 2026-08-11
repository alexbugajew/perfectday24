import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  stripe,
  STRIPE_PLANS,
  PARTNER_TRIAL_DAYS,
  STRIPE_AUTOMATIC_TAX_ENABLED,
  type StripePlanKey,
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
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const body = (await req.json()) as { tier?: string; partner_entity_id?: string };
    const { tier, partner_entity_id } = body;

    if (!tier) {
      return NextResponse.json({ error: "tier ist erforderlich (partner_basic | partner_pro)" }, { status: 400 });
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

    // If a partner profile is given, verify membership and reuse its Stripe customer.
    let stripeCustomerId: string | null = null;

    if (partner_entity_id) {
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

      const { data: partner, error: partnerError } = await supabase
        .from("partner_profiles")
        .select("id, display_name, stripe_customer_id")
        .eq("id", partner_entity_id)
        .single();

      if (partnerError || !partner) {
        return NextResponse.json({ error: "Partner-Profil nicht gefunden" }, { status: 404 });
      }

      stripeCustomerId = partner.stripe_customer_id as string | null;

      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: partner.display_name,
          metadata: { partner_profile_id: partner_entity_id, user_id: user.id },
        });
        stripeCustomerId = customer.id;
        await supabase
          .from("partner_profiles")
          .update({ stripe_customer_id: stripeCustomerId })
          .eq("id", partner_entity_id);
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const checkoutParams = {
      ...(stripeCustomerId
        ? {
            customer: stripeCustomerId,
            // name: "auto" wird von tax_id_collection bei bestehendem Customer verlangt.
            customer_update: { address: "auto" as const, name: "auto" as const },
          }
        : { customer_email: user.email }),
      // USt-IdNr.-Erfassung ist für B2B-Partner besonders relevant (steht
      // damit automatisch auf der Stripe-Rechnung).
      ...(STRIPE_AUTOMATIC_TAX_ENABLED
        ? { automatic_tax: { enabled: true }, tax_id_collection: { enabled: true } }
        : {}),
      mode: "subscription" as const,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${baseUrl}/profile?payment=success`,
      cancel_url: `${baseUrl}/profile?payment=cancelled`,
      subscription_data: {
        metadata: {
          ...(partner_entity_id ? { partner_profile_id: partner_entity_id } : {}),
          plan_key: planKey,
          user_id: user.id,
        },
        // B2B-Einstieg: Partner testen 3 Monate kostenlos — Sichtbarkeits-
        // Effekte in KI-Plänen brauchen Zeit, danach überzeugt der ROI-Rechner
        // mit eigenen Zahlen.
        ...(planKey === "partner_basic" || planKey === "partner_pro"
          ? { trial_period_days: PARTNER_TRIAL_DAYS }
          : {}),
      },
      metadata: {
        ...(partner_entity_id ? { partner_profile_id: partner_entity_id } : {}),
        plan_key: planKey,
        user_id: user.id,
      },
      allow_promotion_codes: true,
      billing_address_collection: "required" as const,
    };

    // Kein Voll-Payload im Log — der enthielt User-ID und E-Mail.
    console.log("create-checkout:", { planKey, mode: checkoutParams.mode });

    let session;
    try {
      session = await stripe.checkout.sessions.create(checkoutParams);
    } catch (err) {
      console.error("Stripe Error:", err instanceof Error ? err.message : err);
      // Interne Fehlerdetails bleiben serverseitig.
      return NextResponse.json(
        { error: "Checkout konnte nicht erstellt werden" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("create-checkout failed:", error);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
