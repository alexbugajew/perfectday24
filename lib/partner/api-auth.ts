import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Rollen, die Inhalte anlegen, ändern oder löschen dürfen. */
export const PARTNER_WRITE_ROLES = new Set(["owner", "admin", "editor"]);

export type PartnerRole = "owner" | "admin" | "editor" | "analyst" | "viewer";

export function getPartnerAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export type PartnerAuthOptions = {
  /**
   * Wenn true, wird zusätzlich zur Mitgliedschaft die Rolle geprüft.
   * Ohne diese Prüfung durfte bisher auch eine `viewer`-Mitgliedschaft
   * Kampagnen und Affiliate-Links löschen.
   */
  requireWrite?: boolean;
};

export async function getPartnerAuthContext(
  accessToken: string,
  options: PartnerAuthOptions = {}
) {
  const admin = getPartnerAdminClient();
  const { data: authData, error: authErr } = await admin.auth.getUser(accessToken);

  if (authErr || !authData.user) {
    return {
      admin,
      userId: null,
      partnerProfileId: null,
      role: null,
      error: "invalid_token" as const,
    };
  }

  const { data: membership } = await admin
    .from("partner_memberships")
    .select("partner_profile_id, role")
    .eq("user_id", authData.user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = membership as { partner_profile_id: string; role: string | null } | null;
  const partnerProfileId = row?.partner_profile_id ?? null;
  const role = (row?.role ?? null) as PartnerRole | null;

  if (!partnerProfileId) {
    return {
      admin,
      userId: authData.user.id,
      partnerProfileId: null,
      role: null,
      error: "no_partner_profile" as const,
    };
  }

  if (options.requireWrite && !PARTNER_WRITE_ROLES.has(role ?? "")) {
    return {
      admin,
      userId: authData.user.id,
      partnerProfileId,
      role,
      error: "insufficient_role" as const,
    };
  }

  return { admin, userId: authData.user.id, partnerProfileId, role, error: null };
}
