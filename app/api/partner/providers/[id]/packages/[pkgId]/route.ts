/**
 * DELETE /api/partner/providers/[id]/packages/[pkgId]
 * Deletes a single provider_packages entry.
 * Caller must own the parent service_provider via their partner_profile.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPartnerProfileId(admin: any, userId: string) {
  const { data } = await admin
    .from("partner_memberships")
    .select("partner_profile_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { partner_profile_id: string } | null)?.partner_profile_id ?? null;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pkgId: string }> }
) {
  const { id: providerId, pkgId } = await params;

  const authHeader  = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace("Bearer ", "").trim();
  if (!accessToken) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: { user }, error: authErr } = await admin.auth.getUser(accessToken);
  if (authErr || !user) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

  const partnerProfileId = await getPartnerProfileId(admin, user.id);
  if (!partnerProfileId) return NextResponse.json({ error: "no_partner_profile" }, { status: 403 });

  // Verify ownership of parent provider
  const { data: provider } = await admin
    .from("service_providers")
    .select("id")
    .eq("id", providerId)
    .eq("partner_profile_id", partnerProfileId)
    .single();

  if (!provider) return NextResponse.json({ error: "provider_not_found" }, { status: 404 });

  const { error: deleteErr } = await admin
    .from("provider_packages")
    .delete()
    .eq("id", pkgId)
    .eq("provider_id", providerId);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
