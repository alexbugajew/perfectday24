/**
 * POST /api/partner/providers/[id]/packages
 * Create a new provider_packages entry for the given service_provider.
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: providerId } = await params;

  const authHeader  = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace("Bearer ", "").trim();
  if (!accessToken) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: { user }, error: authErr } = await admin.auth.getUser(accessToken);
  if (authErr || !user) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

  const partnerProfileId = await getPartnerProfileId(admin, user.id);
  if (!partnerProfileId) return NextResponse.json({ error: "no_partner_profile" }, { status: 403 });

  // Verify ownership of the parent provider
  const { data: provider } = await admin
    .from("service_providers")
    .select("id")
    .eq("id", providerId)
    .eq("partner_profile_id", partnerProfileId)
    .single();

  if (!provider) return NextResponse.json({ error: "provider_not_found" }, { status: 404 });

  const body = await req.json() as {
    name: string;
    price_cents: number;
    price_unit: string;
    description?: string;
    min_guests?: number | null;
    max_guests?: number | null;
    includes?: string[];
    sort_order?: number;
  };

  if (!body.name?.trim() || typeof body.price_cents !== "number" || !body.price_unit?.trim()) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Get current max sort_order for this provider
  const { data: existingPkgs } = await admin
    .from("provider_packages")
    .select("sort_order")
    .eq("provider_id", providerId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const maxOrder = (existingPkgs as Array<{ sort_order: number | null }> | null)?.[0]?.sort_order ?? -1;

  const { data: pkg, error: insertErr } = await admin
    .from("provider_packages")
    .insert({
      provider_id:  providerId,
      name:         body.name.trim(),
      description:  body.description?.trim() || null,
      price_cents:  body.price_cents,
      price_unit:   body.price_unit,
      min_guests:   body.min_guests ?? null,
      max_guests:   body.max_guests ?? null,
      includes:     body.includes ?? [],
      sort_order:   body.sort_order ?? maxOrder + 1,
      status:       "active",
    })
    .select("id, name, price_cents, price_unit, status")
    .single();

  if (insertErr || !pkg) {
    console.error("package insert error:", insertErr);
    return NextResponse.json({ error: insertErr?.message ?? "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ pkg }, { status: 201 });
}
