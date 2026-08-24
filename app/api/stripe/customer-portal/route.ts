// Öffnet das Stripe Customer Portal für den eingeloggten User.
// Aktuell nur für user_premium-Abos. Falls kein Customer existiert → 400.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { stripe } from "@/lib/stripe/config";

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

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (admin as any)
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const customerId = profile?.stripe_customer_id as string | null;
    if (!customerId) {
      return NextResponse.json({ error: "Kein Stripe-Kunde vorhanden" }, { status: 400 });
    }

    // Fallback auf den Request-Origin statt localhost (s. user-checkout).
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/profile`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (err) {
    console.error("[customer-portal]", err);
    return NextResponse.json({ error: "Portal konnte nicht geöffnet werden" }, { status: 500 });
  }
}
