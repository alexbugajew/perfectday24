/**
 * POST /api/partner/providers
 * Create a new service_providers entry linked to the caller's partner_profile.
 *
 * DELETE /api/partner/providers  (body: { id })
 * Handled via the [id] sub-route instead.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

// Resolve the caller's active partner_profile_id.
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

export async function POST(req: NextRequest) {
  const authHeader  = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace("Bearer ", "").trim();
  if (!accessToken) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: { user }, error: authErr } = await admin.auth.getUser(accessToken);
  if (authErr || !user) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

  const partnerProfileId = await getPartnerProfileId(admin, user.id);
  if (!partnerProfileId) return NextResponse.json({ error: "no_partner_profile" }, { status: 403 });

  const body = await req.json() as {
    name: string;
    service_type: string;
    city_slug: string;
    city_slugs?: string[];
    description?: string;
    min_guests?: number | null;
    max_guests?: number | null;
  };

  const { name, service_type, city_slug } = body;
  if (!name?.trim() || !service_type?.trim() || !city_slug?.trim()) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Fetch contact info from partner_profile for pre-population
  const { data: profile } = await admin
    .from("partner_profiles")
    .select("contact_email, website_url, booking_url")
    .eq("id", partnerProfileId)
    .single();

  const baseSlug  = slugify(name.trim());
  const slug      = `${baseSlug}-${Date.now().toString(36)}`;

  const { data: provider, error: insertErr } = await admin
    .from("service_providers")
    .insert({
      partner_profile_id: partnerProfileId,
      name:               name.trim(),
      slug,
      service_type:       service_type.trim(),
      city_slug:          city_slug.trim(),
      city_slugs:         body.city_slugs?.length ? body.city_slugs : [city_slug.trim()],
      description:        body.description?.trim() || null,
      website_url:        (profile as { website_url?: string } | null)?.website_url ?? null,
      contact_email:      (profile as { contact_email?: string } | null)?.contact_email ?? null,
      min_guests:         body.min_guests ?? null,
      max_guests:         body.max_guests ?? null,
      is_verified:        false,
      status:             "draft",
      review_status:      "draft",
    })
    .select("id, name, service_type, description, is_verified, status, review_status, review_notes, review_submitted_at, review_reviewed_at, published_at")
    .single();

  if (insertErr || !provider) {
    console.error("provider insert error:", insertErr);
    return NextResponse.json({ error: insertErr?.message ?? "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ provider }, { status: 201 });
}
