import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const authHeader = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace("Bearer ", "").trim();

  if (!accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const authClient = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !user) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const body = await req.json() as {
    planId?: string;
    quoteId?: string;
  };

  if (!body.planId || !body.quoteId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: quote, error: quoteError } = await admin
    .from("vendor_quotes")
    .select(`
      id,
      inquiry_id,
      provider_id,
      need_slug,
      price_cents,
      status,
      event_inquiries!inner (
        event_plan_id,
        customer_id
      )
    `)
    .eq("id", body.quoteId)
    .eq("event_inquiries.event_plan_id", body.planId)
    .eq("event_inquiries.customer_id", user.id)
    .single();

  if (quoteError || !quote) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  const eventInquiry = Array.isArray(quote.event_inquiries)
    ? quote.event_inquiries[0]
    : quote.event_inquiries;

  if (!eventInquiry || eventInquiry.event_plan_id !== body.planId || eventInquiry.customer_id !== user.id) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  const { data: existingBooking } = await admin
    .from("event_bookings")
    .select("id")
    .eq("event_plan_id", body.planId)
    .eq("service_provider_id", quote.provider_id)
    .eq("need_slug", quote.need_slug)
    .maybeSingle();

  if (!existingBooking) {
    const { error: bookingError } = await admin.from("event_bookings").insert({
      event_plan_id: body.planId,
      service_provider_id: quote.provider_id,
      need_slug: quote.need_slug,
      price_cents_agreed: quote.price_cents,
      status: "confirmed",
    });

    if (bookingError) {
      return NextResponse.json({ error: "booking_create_failed" }, { status: 500 });
    }
  }

  const { error: updateError } = await admin
    .from("vendor_quotes")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", body.quoteId);

  if (updateError) {
    return NextResponse.json({ error: "quote_update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
