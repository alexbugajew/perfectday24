import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type User } from "@supabase/supabase-js";
import { isInternalMonetizationAvailable } from "./debug";

export type AdminPartnerProfileRow = {
  id: string;
  display_name: string;
  slug: string;
  partner_type: string;
  status: string;
  review_status: string;
  review_notes: string | null;
  review_submitted_at: string | null;
  review_reviewed_at: string | null;
  published_at: string | null;
  billing_status: string;
  visibility_tier: string;
  primary_city_slug: string | null;
  is_self_service_enabled: boolean;
  updated_at: string;
};

export type AdminCampaignRow = {
  id: string;
  partner_profile_id: string;
  product_id: string | null;
  name: string;
  campaign_type: string;
  status: string;
  review_status: string;
  review_notes: string | null;
  review_submitted_at: string | null;
  review_reviewed_at: string | null;
  published_at: string | null;
  city_slug: string | null;
  target_route_id: string | null;
  target_location_id: string | null;
  target_event_id: string | null;
  target_creator_profile_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  cta_label: string | null;
  cta_url: string | null;
  updated_at: string;
};

export type AdminProviderRow = {
  id: string;
  partner_profile_id: string | null;
  name: string;
  service_type: string;
  city_slug: string | null;
  status: string;
  review_status: string;
  review_notes: string | null;
  review_submitted_at: string | null;
  review_reviewed_at: string | null;
  published_at: string | null;
  updated_at: string;
};

export type AdminSlotRow = {
  id: string;
  slot_key: string;
  surface: string;
  slot_type: string;
  city_slug: string | null;
  max_positions: number;
  ranking_mode: string;
  disclosure_label: string;
  status: string;
  updated_at: string;
};

export type AdminSlotAssignmentRow = {
  id: string;
  campaign_id: string;
  slot_id: string;
  priority: number;
  weight: number;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  updated_at: string;
};

export type AdminAffiliateLinkRow = {
  id: string;
  partner_profile_id: string | null;
  product_id: string | null;
  location_id: string | null;
  planner_event_id: string | null;
  route_id: string | null;
  link_scope: string;
  provider_name: string;
  destination_url: string;
  commission_model: string;
  is_active: boolean;
  review_status: string;
  review_notes: string | null;
  review_submitted_at: string | null;
  review_reviewed_at: string | null;
  published_at: string | null;
  priority: number;
  updated_at: string;
};

export type AdminAttributionRow = {
  id: string;
  event_type: string;
  surface: string | null;
  city_slug: string | null;
  occurred_at: string;
  route_id: string | null;
  plan_id: string | null;
  campaign_id: string | null;
  partner_profile_id: string | null;
  creator_profile_id: string | null;
  metadata: Record<string, unknown> | null;
};

export type AdminCreatorRewardRow = {
  id: string;
  creator_profile_id: string;
  route_id: string | null;
  city_slug: string | null;
  reward_type: string;
  source_type: string;
  reward_value: number;
  reward_unit: string;
  status: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export type AdminProductRow = {
  id: string;
  product_key: string;
  display_name: string;
  revenue_layer: string;
  horizon: string;
  billing_model: string;
  target_type: string;
  status: string;
  linked_entitlement_key: string | null;
  updated_at: string;
};

export type AdminEntitlementRow = {
  entitlement_key: string;
  layer: string;
  description: string;
  default_state: string;
  updated_at: string;
};

export type AdminCreatorProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  creator_type: string | null;
};

export type AdminRouteRow = {
  id: string;
  title: string | null;
  slug: string | null;
  city_slug: string | null;
  creator_profile_id: string | null;
  updated_at: string;
};

export type AdminMediaRow = {
  id: string;
  owner_user_id: string | null;
  partner_profile_id: string | null;
  source_type: string;
  public_url: string;
  caption: string | null;
  credit_name: string | null;
  moderation_status: string;
  rights_status: string;
  created_at: string;
  updated_at: string;
};

export type AdminMediaAttachmentRow = {
  asset_id: string;
  target_id: string;
};

export type AdminRoadtripRow = {
  id: string;
  title: string | null;
  slug: string | null;
};

export type AdminEventPlanRow = {
  id: string;
  title: string | null;
};

export type AdminMediaReportRow = {
  id: string;
  asset_id: string;
  reported_by_user_id: string | null;
  reason: string;
  note: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type AdminAllowlist = {
  emails: Set<string>;
  userIds: Set<string>;
};

export type MonetizationAdminAccessState =
  | { allowed: true; reason: null; user: User }
  | { allowed: false; reason: "unauthenticated" | "forbidden" | "misconfigured"; user: User | null };

export class MonetizationAdminAccessError extends Error {
  status: 401 | 403;
  reason: MonetizationAdminAccessState["reason"];

  constructor(reason: NonNullable<MonetizationAdminAccessState["reason"]>) {
    super(reason);
    this.name = "MonetizationAdminAccessError";
    this.reason = reason;
    this.status = reason === "unauthenticated" ? 401 : 403;
  }
}

function parseCsvEnv(value?: string) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}

function getAdminAllowlist(): AdminAllowlist {
  return {
    emails: parseCsvEnv(process.env.PD24_INTERNAL_ADMIN_EMAILS),
    userIds: parseCsvEnv(process.env.PD24_INTERNAL_ADMIN_USER_IDS),
  };
}

function hasConfiguredAdminAllowlist(allowlist: AdminAllowlist) {
  return allowlist.emails.size > 0 || allowlist.userIds.size > 0;
}

async function getServerAuthUser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase env vars fehlen: NEXT_PUBLIC_SUPABASE_URL oder NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Read-only during some server renders; safe to ignore for access checks.
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

function isUserAllowedAdmin(user: User, allowlist: AdminAllowlist) {
  const email = user.email?.trim().toLowerCase() ?? "";
  const userId = user.id.trim().toLowerCase();

  return allowlist.userIds.has(userId) || (email.length > 0 && allowlist.emails.has(email));
}

export async function getMonetizationAdminAccessState(): Promise<MonetizationAdminAccessState> {
  const allowlist = getAdminAllowlist();
  const hasAllowlist = hasConfiguredAdminAllowlist(allowlist);

  if (!hasAllowlist) {
    if (process.env.NODE_ENV !== "production" && isInternalMonetizationAvailable()) {
      const user = await getServerAuthUser();
      if (!user) {
        return { allowed: false, reason: "unauthenticated", user: null };
      }
      return { allowed: true, reason: null, user };
    }

    return { allowed: false, reason: "misconfigured", user: null };
  }

  const user = await getServerAuthUser();
  if (!user) {
    return { allowed: false, reason: "unauthenticated", user: null };
  }

  if (!isUserAllowedAdmin(user, allowlist)) {
    return { allowed: false, reason: "forbidden", user };
  }

  return { allowed: true, reason: null, user };
}

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error(
      "Supabase env vars fehlen: NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function assertInternalMonetizationAdmin() {
  const access = await getMonetizationAdminAccessState();
  if (!access.allowed) {
    throw new MonetizationAdminAccessError(access.reason);
  }

  return access.user;
}

export async function getMonetizationAdminSnapshot() {
  const supabase = getSupabaseAdmin();

  const [
    partnersResp,
    campaignsResp,
    providersResp,
    slotsResp,
    assignmentsResp,
    affiliateResp,
    attributionResp,
    rewardsResp,
    productsResp,
    entitlementsResp,
    creatorsResp,
    routesResp,
    mediaResp,
    routeMediaResp,
    routeStopMediaResp,
    roadtripMediaResp,
    eventPlanMediaResp,
    partnerProfileMediaResp,
    serviceProviderMediaResp,
    roadtripsResp,
    eventPlansResp,
    mediaReportsResp,
  ] = await Promise.all([
    supabase
      .from("partner_profiles")
      .select(
        "id,display_name,slug,partner_type,status,review_status,review_notes,review_submitted_at,review_reviewed_at,published_at,billing_status,visibility_tier,primary_city_slug,is_self_service_enabled,updated_at"
      )
      .order("updated_at", { ascending: false }),
    supabase
      .from("partner_campaigns")
      .select(
        "id,partner_profile_id,product_id,name,campaign_type,status,review_status,review_notes,review_submitted_at,review_reviewed_at,published_at,city_slug,target_route_id,target_location_id,target_event_id,target_creator_profile_id,starts_at,ends_at,cta_label,cta_url,updated_at"
      )
      .order("updated_at", { ascending: false }),
    supabase
      .from("service_providers")
      .select(
        "id,partner_profile_id,name,service_type,city_slug,status,review_status,review_notes,review_submitted_at,review_reviewed_at,published_at,updated_at"
      )
      .order("updated_at", { ascending: false }),
    supabase
      .from("sponsored_slots")
      .select(
        "id,slot_key,surface,slot_type,city_slug,max_positions,ranking_mode,disclosure_label,status,updated_at"
      )
      .order("slot_key", { ascending: true }),
    supabase
      .from("partner_slot_assignments")
      .select("id,campaign_id,slot_id,priority,weight,starts_at,ends_at,status,updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("affiliate_links")
      .select(
        "id,partner_profile_id,product_id,location_id,planner_event_id,route_id,link_scope,provider_name,destination_url,commission_model,is_active,review_status,review_notes,review_submitted_at,review_reviewed_at,published_at,priority,updated_at"
      )
      .order("updated_at", { ascending: false }),
    supabase
      .from("attribution_events")
      .select(
        "id,event_type,surface,city_slug,occurred_at,route_id,plan_id,campaign_id,partner_profile_id,creator_profile_id,metadata"
      )
      .order("occurred_at", { ascending: false })
      .limit(200),
    supabase
      .from("creator_reward_events")
      .select(
        "id,creator_profile_id,route_id,city_slug,reward_type,source_type,reward_value,reward_unit,status,created_at,metadata"
      )
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("partner_products")
      .select(
        "id,product_key,display_name,revenue_layer,horizon,billing_model,target_type,status,linked_entitlement_key,updated_at"
      )
      .order("revenue_layer", { ascending: true }),
    supabase
      .from("entitlement_catalog")
      .select("entitlement_key,layer,description,default_state,updated_at")
      .order("layer", { ascending: true }),
    supabase
      .from("creator_profiles")
      .select("id,username,display_name,creator_type")
      .order("updated_at", { ascending: false }),
    supabase
      .from("user_routes")
      .select("id,title,slug,city_slug,creator_profile_id,updated_at")
      .eq("visibility", "public")
      .order("updated_at", { ascending: false })
      .limit(120),
    supabase
      .from("media_assets")
      .select("id,owner_user_id,partner_profile_id,source_type,public_url,caption,credit_name,moderation_status,rights_status,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("route_media")
      .select("asset_id,route_id"),
    supabase
      .from("route_stop_media")
      .select("asset_id,route_stop_id"),
    supabase
      .from("roadtrip_media")
      .select("asset_id,roadtrip_route_id"),
    supabase
      .from("event_plan_media")
      .select("asset_id,event_plan_id"),
    supabase
      .from("partner_profile_media")
      .select("asset_id,partner_profile_id"),
    supabase
      .from("service_provider_media")
      .select("asset_id,provider_id"),
    supabase
      .from("roadtrip_routes")
      .select("id,title,slug")
      .order("updated_at", { ascending: false })
      .limit(120),
    supabase
      .from("event_plans")
      .select("id,title")
      .order("updated_at", { ascending: false })
      .limit(120),
    supabase
      .from("media_reports")
      .select("id,asset_id,reported_by_user_id,reason,note,status,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  for (const response of [
    partnersResp,
    campaignsResp,
    providersResp,
    slotsResp,
    assignmentsResp,
    affiliateResp,
    attributionResp,
    rewardsResp,
    productsResp,
    entitlementsResp,
    creatorsResp,
    routesResp,
    mediaResp,
    routeMediaResp,
    routeStopMediaResp,
    roadtripMediaResp,
    eventPlanMediaResp,
    partnerProfileMediaResp,
    serviceProviderMediaResp,
    roadtripsResp,
    eventPlansResp,
    mediaReportsResp,
  ]) {
    if (response.error) throw response.error;
  }

  return {
    partners: (partnersResp.data ?? []) as AdminPartnerProfileRow[],
    campaigns: (campaignsResp.data ?? []) as AdminCampaignRow[],
    providers: (providersResp.data ?? []) as AdminProviderRow[],
    slots: (slotsResp.data ?? []) as AdminSlotRow[],
    assignments: (assignmentsResp.data ?? []) as AdminSlotAssignmentRow[],
    affiliateLinks: (affiliateResp.data ?? []) as AdminAffiliateLinkRow[],
    attribution: (attributionResp.data ?? []) as AdminAttributionRow[],
    rewards: (rewardsResp.data ?? []) as AdminCreatorRewardRow[],
    products: (productsResp.data ?? []) as AdminProductRow[],
    entitlements: (entitlementsResp.data ?? []) as AdminEntitlementRow[],
    creators: (creatorsResp.data ?? []) as AdminCreatorProfileRow[],
    routes: (routesResp.data ?? []) as AdminRouteRow[],
    mediaAssets: (mediaResp.data ?? []) as AdminMediaRow[],
    routeMedia: ((routeMediaResp.data ?? []) as { asset_id: string; route_id: string }[]).map((row) => ({
      asset_id: row.asset_id,
      target_id: row.route_id,
    })) as AdminMediaAttachmentRow[],
    routeStopMedia: ((routeStopMediaResp.data ?? []) as { asset_id: string; route_stop_id: string }[]).map((row) => ({
      asset_id: row.asset_id,
      target_id: row.route_stop_id,
    })) as AdminMediaAttachmentRow[],
    roadtripMedia: ((roadtripMediaResp.data ?? []) as { asset_id: string; roadtrip_route_id: string }[]).map((row) => ({
      asset_id: row.asset_id,
      target_id: row.roadtrip_route_id,
    })) as AdminMediaAttachmentRow[],
    eventPlanMedia: ((eventPlanMediaResp.data ?? []) as { asset_id: string; event_plan_id: string }[]).map((row) => ({
      asset_id: row.asset_id,
      target_id: row.event_plan_id,
    })) as AdminMediaAttachmentRow[],
    partnerProfileMedia: ((partnerProfileMediaResp.data ?? []) as { asset_id: string; partner_profile_id: string }[]).map((row) => ({
      asset_id: row.asset_id,
      target_id: row.partner_profile_id,
    })) as AdminMediaAttachmentRow[],
    serviceProviderMedia: ((serviceProviderMediaResp.data ?? []) as { asset_id: string; provider_id: string }[]).map((row) => ({
      asset_id: row.asset_id,
      target_id: row.provider_id,
    })) as AdminMediaAttachmentRow[],
    roadtrips: (roadtripsResp.data ?? []) as AdminRoadtripRow[],
    eventPlans: (eventPlansResp.data ?? []) as AdminEventPlanRow[],
    mediaReports: (mediaReportsResp.data ?? []) as AdminMediaReportRow[],
  };
}
