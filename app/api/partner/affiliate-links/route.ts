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
    provider_name?: string;
    destination_url?: string;
    commission_model?: string;
    link_scope?: string;
    route_id?: string | null;
    location_id?: string | null;
    planner_event_id?: string | null;
  };

  if (!body.provider_name?.trim() || !body.destination_url?.trim() || !body.commission_model?.trim() || !body.link_scope?.trim()) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const { data, error: insertErr } = await admin
    .from("affiliate_links")
    .insert({
      partner_profile_id: partnerProfileId,
      provider_name: body.provider_name.trim(),
      destination_url: body.destination_url.trim(),
      commission_model: body.commission_model.trim(),
      link_scope: body.link_scope.trim(),
      route_id: body.route_id ?? null,
      location_id: body.location_id ?? null,
      planner_event_id: body.planner_event_id ?? null,
      is_active: false,
      priority: 50,
      review_status: "draft",
    })
    .select("id, link_scope, provider_name, commission_model, destination_url, is_active, review_status, review_notes, review_submitted_at, review_reviewed_at, published_at, route_id, location_id, planner_event_id")
    .single();

  if (insertErr || !data) {
    console.error("affiliate link insert error:", insertErr);
    return NextResponse.json({ error: insertErr?.message ?? "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ affiliateLink: data }, { status: 201 });
}
