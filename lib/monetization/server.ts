import { createClient } from "@supabase/supabase-js";
import type { AttributionEventType, MonetizationEntitlementKey, SponsoredSlotKey } from "./types";

export type MonetizationTrackInput = {
  eventType: AttributionEventType;
  userId?: string | null;
  anonymousId?: string | null;
  sessionId?: string | null;
  planId?: string | null;
  routeId?: string | null;
  locationId?: string | null;
  plannerEventId?: string | null;
  partnerProfileId?: string | null;
  campaignId?: string | null;
  slotKey?: SponsoredSlotKey | null;
  affiliateLinkId?: string | null;
  creatorProfileId?: string | null;
  entitlementKey?: MonetizationEntitlementKey | null;
  citySlug?: string | null;
  surface?: string | null;
  revenueCents?: number | null;
  currency?: string | null;
  metadata?: Record<string, unknown> | null;
};

function getSupabaseAdmin() {
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

async function resolveSlotId(slotKey?: SponsoredSlotKey | null) {
  if (!slotKey) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sponsored_slots")
    .select("id")
    .eq("slot_key", slotKey)
    .maybeSingle();

  if (error) {
    console.error("Resolve sponsored slot failed:", error);
    return null;
  }

  return typeof data?.id === "string" ? data.id : null;
}

async function maybeCreateCreatorReward(input: MonetizationTrackInput) {
  if (input.eventType !== "route_copy") return;
  if (!input.creatorProfileId) return;

  const supabase = getSupabaseAdmin();
  const sourceId =
    typeof input.metadata?.sourceRouteSlug === "string"
      ? input.metadata.sourceRouteSlug
      : input.routeId ?? null;

  let existingQuery = supabase
    .from("creator_reward_events")
    .select("id")
    .eq("creator_profile_id", input.creatorProfileId)
    .eq("source_type", "route_copy");

  existingQuery = input.routeId
    ? existingQuery.eq("route_id", input.routeId)
    : existingQuery.is("route_id", null);
  existingQuery = sourceId
    ? existingQuery.eq("source_id", sourceId)
    : existingQuery.is("source_id", null);

  const { data: existing, error: existingError } = await existingQuery.limit(1);

  if (existingError) {
    console.error("Creator reward duplicate check failed:", existingError);
  }

  if (Array.isArray(existing) && existing.length > 0) return;

  const { error } = await supabase.from("creator_reward_events").insert({
    creator_profile_id: input.creatorProfileId,
    route_id: input.routeId ?? null,
    partner_profile_id: input.partnerProfileId ?? null,
    campaign_id: input.campaignId ?? null,
    city_slug: input.citySlug ?? null,
    reward_type: "distribution_credit",
    source_type: "route_copy",
    source_id: sourceId,
    reward_value: 1,
    reward_unit: "credit",
    status: "pending",
    metadata: {
      ...(input.metadata ?? {}),
      sourceSurface: input.surface ?? null,
      rewardRail: "creator_distribution_tools",
    },
  });

  if (error) {
    console.error("Create creator reward failed:", error);
  }
}

export async function recordMonetizationEvent(input: MonetizationTrackInput) {
  const supabase = getSupabaseAdmin();
  const slotId = await resolveSlotId(input.slotKey ?? null);

  const { error } = await supabase.from("attribution_events").insert({
    user_id: input.userId ?? null,
    anonymous_id: input.anonymousId ?? null,
    session_id: input.sessionId ?? null,
    plan_id: input.planId ?? null,
    route_id: input.routeId ?? null,
    location_id: input.locationId ?? null,
    planner_event_id: input.plannerEventId ?? null,
    partner_profile_id: input.partnerProfileId ?? null,
    campaign_id: input.campaignId ?? null,
    slot_id: slotId,
    affiliate_link_id: input.affiliateLinkId ?? null,
    creator_profile_id: input.creatorProfileId ?? null,
    entitlement_key: input.entitlementKey ?? null,
    city_slug: input.citySlug ?? null,
    surface: input.surface ?? null,
    event_type: input.eventType,
    revenue_cents:
      typeof input.revenueCents === "number" && Number.isFinite(input.revenueCents)
        ? Math.max(0, Math.round(input.revenueCents))
        : null,
    currency: input.currency ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error("Record monetization event failed:", error);
    return { ok: false as const, error };
  }

  await maybeCreateCreatorReward(input);
  return { ok: true as const };
}
