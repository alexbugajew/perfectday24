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

/**
 * Erzeugt einen Creator-Reward für einen Route-Copy.
 *
 * Gehärtet gegen Reward-Farming:
 *   - `creatorProfileId` wird **aus der Route** aufgelöst, nicht aus dem Request
 *     übernommen. Sonst kann sich jeder Rewards auf das eigene Profil buchen.
 *   - Dedup läuft über (route_id, kopierender Nutzer). Vorher war `source_id`
 *     aus `metadata.sourceRouteSlug` frei wählbar, wodurch sich beliebig viele
 *     Rewards für dieselbe Route erzeugen ließen.
 *   - Rewards zählen nur für eingeloggte Nutzer, weil `anonymousId` clientseitig
 *     frei erfindbar ist.
 *   - Selbstkopien erzeugen keinen Reward.
 */
async function maybeCreateCreatorReward(input: MonetizationTrackInput) {
  if (input.eventType !== "route_copy") return;
  if (!input.routeId) return;

  // Nur identifizierte Nutzer — userId stammt aus der Session, nicht aus dem Body.
  const actorUserId = input.userId ?? null;
  if (!actorUserId) return;

  const supabase = getSupabaseAdmin();

  const { data: route, error: routeError } = await supabase
    .from("user_routes")
    .select("id, creator_profile_id, user_id")
    .eq("id", input.routeId)
    .maybeSingle();

  if (routeError) {
    console.error("Creator reward route lookup failed:", routeError);
    return;
  }

  const creatorProfileId = route?.creator_profile_id as string | null | undefined;
  if (!route || !creatorProfileId) return;

  // Wer seine eigene Route kopiert, bekommt keinen Reward.
  if (route.user_id && route.user_id === actorUserId) return;

  const { data: existing, error: existingError } = await supabase
    .from("creator_reward_events")
    .select("id")
    .eq("creator_profile_id", creatorProfileId)
    .eq("source_type", "route_copy")
    .eq("route_id", input.routeId)
    .eq("source_id", actorUserId)
    .limit(1);

  if (existingError) {
    console.error("Creator reward duplicate check failed:", existingError);
    return;
  }

  if (Array.isArray(existing) && existing.length > 0) return;

  const { error } = await supabase.from("creator_reward_events").insert({
    creator_profile_id: creatorProfileId,
    route_id: input.routeId,
    partner_profile_id: input.partnerProfileId ?? null,
    campaign_id: input.campaignId ?? null,
    city_slug: input.citySlug ?? null,
    reward_type: "distribution_credit",
    source_type: "route_copy",
    // Ein Reward pro Route und kopierendem Nutzer.
    source_id: actorUserId,
    reward_value: 1,
    reward_unit: "credit",
    status: "pending",
    metadata: {
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
