import { NextRequest, NextResponse } from "next/server";
import {
  assertInternalMonetizationAdmin,
  getSupabaseAdmin,
  MonetizationAdminAccessError,
} from "@/lib/monetization/admin-server";

type UpdateEntity = "slot" | "campaign" | "affiliate" | "product" | "assignment" | "partner" | "provider";
const REVIEW_STATUSES = ["draft", "submitted", "in_review", "changes_requested", "approved", "published"] as const;

function isReviewStatus(value: unknown): value is (typeof REVIEW_STATUSES)[number] {
  return typeof value === "string" && REVIEW_STATUSES.includes(value as (typeof REVIEW_STATUSES)[number]);
}

export async function PATCH(req: NextRequest) {
  try {
    await assertInternalMonetizationAdmin();
    const body = (await req.json()) as {
      entity?: UpdateEntity;
      id?: string;
      patch?: Record<string, unknown>;
    };

    if (!body.entity || !body.id || !body.patch || typeof body.patch !== "object") {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (body.entity === "partner" || body.entity === "provider") {
      const reviewStatus = body.patch.review_status;
      if (!isReviewStatus(reviewStatus)) {
        return NextResponse.json({ error: "invalid review status" }, { status: 400 });
      }

      const now = new Date().toISOString();
      const reviewNotes =
        typeof body.patch.review_notes === "string" ? body.patch.review_notes : body.patch.review_notes === null ? null : undefined;
      const table = body.entity === "partner" ? "partner_profiles" : "service_providers";
      const updatePatch: Record<string, unknown> = {
        review_status: reviewStatus,
        updated_at: now,
      };

      if (reviewNotes !== undefined) updatePatch.review_notes = reviewNotes;
      if (["submitted", "approved", "published"].includes(reviewStatus)) updatePatch.review_notes = null;
      if (reviewStatus === "submitted") updatePatch.review_submitted_at = now;
      if (["changes_requested", "approved", "published"].includes(reviewStatus)) updatePatch.review_reviewed_at = now;
      if (reviewStatus === "published") {
        updatePatch.published_at = now;
        updatePatch.status = "active";
      }

      const { error } = await supabase.from(table).update(updatePatch).eq("id", body.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.entity === "slot") {
      const status = typeof body.patch.status === "string" ? body.patch.status : null;
      if (!status || !["draft", "inactive", "active", "archived"].includes(status)) {
        return NextResponse.json({ error: "invalid slot status" }, { status: 400 });
      }

      const { error } = await supabase
        .from("sponsored_slots")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", body.id);

      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.entity === "campaign") {
      const reviewStatus = body.patch.review_status;
      if (isReviewStatus(reviewStatus)) {
        const now = new Date().toISOString();
        const { data: existing, error: existingError } = await supabase
          .from("partner_campaigns")
          .select("id, status, starts_at")
          .eq("id", body.id)
          .maybeSingle();

        if (existingError || !existing) throw existingError ?? new Error("campaign not found");

        const reviewNotes =
          typeof body.patch.review_notes === "string" ? body.patch.review_notes : body.patch.review_notes === null ? null : undefined;
        const updatePatch: Record<string, unknown> = {
          review_status: reviewStatus,
          updated_at: now,
        };

        if (reviewNotes !== undefined) updatePatch.review_notes = reviewNotes;
        if (["submitted", "approved", "published"].includes(reviewStatus)) updatePatch.review_notes = null;
        if (reviewStatus === "submitted") updatePatch.review_submitted_at = now;
        if (["changes_requested", "approved", "published"].includes(reviewStatus)) updatePatch.review_reviewed_at = now;
        if (reviewStatus === "published") {
          updatePatch.published_at = now;
          const startAt = existing.starts_at ? new Date(existing.starts_at) : null;
          updatePatch.status =
            existing.status === "active" || existing.status === "paused" || existing.status === "completed"
              ? existing.status
              : startAt && startAt.getTime() > Date.now()
                ? "scheduled"
                : "active";
        }

        const { error } = await supabase.from("partner_campaigns").update(updatePatch).eq("id", body.id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      const status = typeof body.patch.status === "string" ? body.patch.status : null;
      if (!status || !["draft", "scheduled", "active", "paused", "completed", "archived"].includes(status)) {
        return NextResponse.json({ error: "invalid campaign status" }, { status: 400 });
      }

      const { error } = await supabase
        .from("partner_campaigns")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", body.id);

      if (error) throw error;

      const assignmentStatus =
        status === "active"
          ? "active"
          : status === "paused"
            ? "paused"
            : status === "scheduled"
              ? "scheduled"
              : status === "completed"
                ? "completed"
                : status === "archived"
                  ? "archived"
                  : "draft";

      const { error: assignmentError } = await supabase
        .from("partner_slot_assignments")
        .update({ status: assignmentStatus, updated_at: new Date().toISOString() })
        .eq("campaign_id", body.id);

      if (assignmentError) throw assignmentError;
      return NextResponse.json({ ok: true });
    }

    if (body.entity === "assignment") {
      const status = typeof body.patch.status === "string" ? body.patch.status : null;
      if (!status || !["draft", "scheduled", "active", "paused", "completed", "archived"].includes(status)) {
        return NextResponse.json({ error: "invalid assignment status" }, { status: 400 });
      }

      const { error } = await supabase
        .from("partner_slot_assignments")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", body.id);

      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.entity === "affiliate") {
      const reviewStatus = body.patch.review_status;
      if (isReviewStatus(reviewStatus)) {
        const now = new Date().toISOString();
        const reviewNotes =
          typeof body.patch.review_notes === "string" ? body.patch.review_notes : body.patch.review_notes === null ? null : undefined;
        const updatePatch: Record<string, unknown> = {
          review_status: reviewStatus,
          updated_at: now,
        };

        if (reviewNotes !== undefined) updatePatch.review_notes = reviewNotes;
        if (["submitted", "approved", "published"].includes(reviewStatus)) updatePatch.review_notes = null;
        if (reviewStatus === "submitted") updatePatch.review_submitted_at = now;
        if (["changes_requested", "approved", "published"].includes(reviewStatus)) updatePatch.review_reviewed_at = now;
        if (reviewStatus === "published") {
          updatePatch.published_at = now;
          updatePatch.is_active = true;
        }

        const { error } = await supabase.from("affiliate_links").update(updatePatch).eq("id", body.id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      const isActive = typeof body.patch.is_active === "boolean" ? body.patch.is_active : null;
      if (isActive == null) {
        return NextResponse.json({ error: "invalid affiliate state" }, { status: 400 });
      }

      const { error } = await supabase
        .from("affiliate_links")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", body.id);

      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.entity === "product") {
      const status = typeof body.patch.status === "string" ? body.patch.status : null;
      if (!status || !["draft", "active", "retired"].includes(status)) {
        return NextResponse.json({ error: "invalid product status" }, { status: 400 });
      }

      const { error } = await supabase
        .from("partner_products")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", body.id);

      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "unsupported entity" }, { status: 400 });
  } catch (error) {
    console.error("monetization admin patch failed:", error);
    if (error instanceof MonetizationAdminAccessError) {
      const message =
        error.reason === "unauthenticated"
          ? "authentication_required"
          : error.reason === "misconfigured"
            ? "admin_allowlist_not_configured"
            : "admin_forbidden";

      return NextResponse.json({ error: message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "admin patch failed";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
