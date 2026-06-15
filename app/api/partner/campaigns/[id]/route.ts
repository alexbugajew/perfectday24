import { NextRequest, NextResponse } from "next/server";
import { getPartnerAuthContext } from "@/lib/partner/api-auth";

const ALLOWED_STATUSES = ["draft", "scheduled", "active", "paused", "completed", "archived"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace("Bearer ", "").trim();
  if (!accessToken) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { admin, partnerProfileId, error } = await getPartnerAuthContext(accessToken);
  if (error === "invalid_token") return NextResponse.json({ error }, { status: 401 });
  if (error === "no_partner_profile" || !partnerProfileId) {
    return NextResponse.json({ error: "no_partner_profile" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await req.json()) as { status?: string };
  if (!body.status || !ALLOWED_STATUSES.includes(body.status as (typeof ALLOWED_STATUSES)[number])) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const { data: existing } = await admin
    .from("partner_campaigns")
    .select("id, review_status")
    .eq("id", id)
    .eq("partner_profile_id", partnerProfileId)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const nextStatus = body.status as (typeof ALLOWED_STATUSES)[number];
  const reviewStatus = (existing as { review_status?: string | null }).review_status ?? "draft";
  const requiresPublishedReview = nextStatus === "scheduled" || nextStatus === "active";
  if (requiresPublishedReview && !["approved", "published"].includes(reviewStatus)) {
    return NextResponse.json({ error: "review_not_published" }, { status: 400 });
  }

  const { error: updateErr } = await admin
    .from("partner_campaigns")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateErr) {
    console.error("campaign patch error:", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace("Bearer ", "").trim();
  if (!accessToken) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { admin, partnerProfileId, error } = await getPartnerAuthContext(accessToken);
  if (error === "invalid_token") return NextResponse.json({ error }, { status: 401 });
  if (error === "no_partner_profile" || !partnerProfileId) {
    return NextResponse.json({ error: "no_partner_profile" }, { status: 403 });
  }

  const { id } = await params;
  const { data: existing } = await admin
    .from("partner_campaigns")
    .select("id")
    .eq("id", id)
    .eq("partner_profile_id", partnerProfileId)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { error: deleteErr } = await admin.from("partner_campaigns").delete().eq("id", id);
  if (deleteErr) {
    console.error("campaign delete error:", deleteErr);
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
