import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function getPartnerAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function getPartnerAuthContext(accessToken: string) {
  const admin = getPartnerAdminClient();
  const { data: authData, error: authErr } = await admin.auth.getUser(accessToken);

  if (authErr || !authData.user) {
    return { admin, userId: null, partnerProfileId: null, error: "invalid_token" as const };
  }

  const { data: membership } = await admin
    .from("partner_memberships")
    .select("partner_profile_id")
    .eq("user_id", authData.user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const partnerProfileId = (membership as { partner_profile_id: string } | null)?.partner_profile_id ?? null;

  if (!partnerProfileId) {
    return { admin, userId: authData.user.id, partnerProfileId: null, error: "no_partner_profile" as const };
  }

  return { admin, userId: authData.user.id, partnerProfileId, error: null };
}
