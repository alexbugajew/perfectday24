import { NextRequest, NextResponse } from "next/server";
import { getPartnerAuthContext } from "@/lib/partner/api-auth";

type ReviewEntity = "profile" | "provider" | "campaign" | "affiliate";
type ReviewAction = "submit" | "withdraw";

const REVIEW_SELECT =
  "id, review_status, review_notes, review_submitted_at, review_reviewed_at, published_at";

async function loadOwnedEntity(
  admin: Awaited<ReturnType<typeof getPartnerAuthContext>>["admin"],
  partnerProfileId: string,
  entity: ReviewEntity,
  targetId?: string | null
) {
  if (entity === "profile") {
    return admin
      .from("partner_profiles")
      .select(REVIEW_SELECT)
      .eq("id", partnerProfileId)
      .maybeSingle();
  }

  if (!targetId) {
    return { data: null, error: { message: "missing_target_id" } };
  }

  if (entity === "provider") {
    return admin
      .from("service_providers")
      .select(REVIEW_SELECT)
      .eq("id", targetId)
      .eq("partner_profile_id", partnerProfileId)
      .maybeSingle();
  }

  if (entity === "campaign") {
    return admin
      .from("partner_campaigns")
      .select(REVIEW_SELECT)
      .eq("id", targetId)
      .eq("partner_profile_id", partnerProfileId)
      .maybeSingle();
  }

  return admin
    .from("affiliate_links")
    .select(REVIEW_SELECT)
    .eq("id", targetId)
    .eq("partner_profile_id", partnerProfileId)
    .maybeSingle();
}

function buildReviewUpdate(action: ReviewAction) {
  const now = new Date().toISOString();

  if (action === "submit") {
    return {
      review_status: "submitted",
      review_notes: null,
      review_submitted_at: now,
      review_reviewed_at: null,
      updated_at: now,
    };
  }

  return {
    review_status: "draft",
    review_notes: null,
    review_submitted_at: null,
    review_reviewed_at: null,
    updated_at: now,
  };
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace("Bearer ", "").trim();
  if (!accessToken) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { admin, partnerProfileId, error } = await getPartnerAuthContext(accessToken, { requireWrite: true });
  if (error === "invalid_token") return NextResponse.json({ error }, { status: 401 });
  if (error === "insufficient_role") {
    return NextResponse.json({ error: "insufficient_role" }, { status: 403 });
  }
  if (error === "no_partner_profile" || !partnerProfileId) {
    return NextResponse.json({ error: "no_partner_profile" }, { status: 403 });
  }

  const body = (await req.json()) as {
    entity?: ReviewEntity;
    targetId?: string | null;
    action?: ReviewAction;
  };

  if (!body.entity || !body.action || !["submit", "withdraw"].includes(body.action)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const existingResp = await loadOwnedEntity(admin, partnerProfileId, body.entity, body.targetId);
  if (existingResp.error) {
    return NextResponse.json({ error: existingResp.error.message }, { status: 400 });
  }

  if (!existingResp.data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const patch = buildReviewUpdate(body.action);

  const table =
    body.entity === "profile"
      ? "partner_profiles"
      : body.entity === "provider"
        ? "service_providers"
        : body.entity === "campaign"
          ? "partner_campaigns"
          : "affiliate_links";

  const targetId = body.entity === "profile" ? partnerProfileId : body.targetId;

  const { data, error: updateErr } = await admin
    .from(table)
    .update(patch)
    .eq("id", targetId)
    .select(REVIEW_SELECT)
    .single();

  if (updateErr || !data) {
    console.error("partner review update failed:", updateErr);
    return NextResponse.json({ error: updateErr?.message ?? "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ review: data });
}
