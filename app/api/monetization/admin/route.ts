import { NextRequest, NextResponse } from "next/server";
import {
  assertInternalMonetizationAdmin,
  getSupabaseAdmin,
} from "@/lib/monetization/admin-server";

type UpdateEntity = "slot" | "campaign" | "affiliate" | "product" | "assignment";

export async function PATCH(req: NextRequest) {
  try {
    assertInternalMonetizationAdmin();
    const body = (await req.json()) as {
      entity?: UpdateEntity;
      id?: string;
      patch?: Record<string, unknown>;
    };

    if (!body.entity || !body.id || !body.patch || typeof body.patch !== "object") {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

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
    const message =
      error instanceof Error && error.message === "internal monetization admin disabled"
        ? "internal monetization admin disabled"
        : error instanceof Error
          ? error.message
          : "admin patch failed";

    return NextResponse.json(
      { error: message },
      { status: message === "internal monetization admin disabled" ? 404 : 500 }
    );
  }
}
