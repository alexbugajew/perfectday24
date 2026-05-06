import { createClient } from "@supabase/supabase-js";
import { isInternalMonetizationAvailable } from "./debug";

export type AdminPartnerProfileRow = {
  id: string;
  display_name: string;
  slug: string;
  partner_type: string;
  status: string;
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

export function assertInternalMonetizationAdmin() {
  if (!isInternalMonetizationAvailable()) {
    throw new Error("internal monetization admin disabled");
  }
}

export async function getMonetizationAdminSnapshot() {
  assertInternalMonetizationAdmin();
  const supabase = getSupabaseAdmin();

  const [
    partnersResp,
    campaignsResp,
    slotsResp,
    assignmentsResp,
    affiliateResp,
    attributionResp,
    rewardsResp,
    productsResp,
    entitlementsResp,
    creatorsResp,
    routesResp,
  ] = await Promise.all([
    supabase
      .from("partner_profiles")
      .select(
        "id,display_name,slug,partner_type,status,billing_status,visibility_tier,primary_city_slug,is_self_service_enabled,updated_at"
      )
      .order("updated_at", { ascending: false }),
    supabase
      .from("partner_campaigns")
      .select(
        "id,partner_profile_id,product_id,name,campaign_type,status,city_slug,target_route_id,target_location_id,target_event_id,target_creator_profile_id,starts_at,ends_at,cta_label,cta_url,updated_at"
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
        "id,partner_profile_id,product_id,location_id,planner_event_id,route_id,link_scope,provider_name,destination_url,commission_model,is_active,priority,updated_at"
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
  ]);

  for (const response of [
    partnersResp,
    campaignsResp,
    slotsResp,
    assignmentsResp,
    affiliateResp,
    attributionResp,
    rewardsResp,
    productsResp,
    entitlementsResp,
    creatorsResp,
    routesResp,
  ]) {
    if (response.error) throw response.error;
  }

  return {
    partners: (partnersResp.data ?? []) as AdminPartnerProfileRow[],
    campaigns: (campaignsResp.data ?? []) as AdminCampaignRow[],
    slots: (slotsResp.data ?? []) as AdminSlotRow[],
    assignments: (assignmentsResp.data ?? []) as AdminSlotAssignmentRow[],
    affiliateLinks: (affiliateResp.data ?? []) as AdminAffiliateLinkRow[],
    attribution: (attributionResp.data ?? []) as AdminAttributionRow[],
    rewards: (rewardsResp.data ?? []) as AdminCreatorRewardRow[],
    products: (productsResp.data ?? []) as AdminProductRow[],
    entitlements: (entitlementsResp.data ?? []) as AdminEntitlementRow[],
    creators: (creatorsResp.data ?? []) as AdminCreatorProfileRow[],
    routes: (routesResp.data ?? []) as AdminRouteRow[],
  };
}
