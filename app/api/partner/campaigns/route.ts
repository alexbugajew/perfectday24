import { NextRequest, NextResponse } from "next/server";
import { getPartnerAuthContext } from "@/lib/partner/api-auth";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace("Bearer ", "").trim();
  if (!accessToken) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { admin, partnerProfileId, error } = await getPartnerAuthContext(accessToken);
  if (error === "invalid_token") return NextResponse.json({ error }, { status: 401 });
  if (error === "no_partner_profile" || !partnerProfileId) {
    return NextResponse.json({ error: "no_partner_profile" }, { status: 403 });
  }

  const body = (await req.json()) as {
    name?: string;
    campaign_type?: string;
    city_slug?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
    cta_label?: string | null;
    cta_url?: string | null;
    target_route_id?: string | null;
    target_location_id?: string | null;
    target_event_id?: string | null;
  };

  if (!body.name?.trim() || !body.campaign_type?.trim()) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const { data, error: insertErr } = await admin
    .from("partner_campaigns")
    .insert({
      partner_profile_id: partnerProfileId,
      product_id: null,
      name: body.name.trim(),
      campaign_type: body.campaign_type.trim(),
      status: "draft",
      review_status: "draft",
      city_slug: body.city_slug?.trim() || null,
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
      cta_label: body.cta_label?.trim() || null,
      cta_url: body.cta_url?.trim() || null,
      target_route_id: body.target_route_id || null,
      target_location_id: body.target_location_id || null,
      target_event_id: body.target_event_id || null,
    })
    .select("id, name, campaign_type, status, review_status, review_notes, review_submitted_at, review_reviewed_at, published_at, city_slug, starts_at, ends_at, cta_label, target_route_id, target_location_id, target_event_id")
    .single();

  if (insertErr || !data) {
    console.error("campaign insert error:", insertErr);
    return NextResponse.json({ error: insertErr?.message ?? "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ campaign: data }, { status: 201 });
}
