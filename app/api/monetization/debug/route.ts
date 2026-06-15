import { NextRequest, NextResponse } from "next/server";
import {
  assertInternalMonetizationAdmin,
  getMonetizationAdminSnapshot,
  MonetizationAdminAccessError,
} from "@/lib/monetization/admin-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    await assertInternalMonetizationAdmin();

    const params = req.nextUrl.searchParams;
    const surface = params.get("surface");
    const routeId = params.get("routeId");
    const creatorProfileId = params.get("creatorProfileId");
    const citySlug = params.get("citySlug");

    const snapshot = await getMonetizationAdminSnapshot();

    const partnerById = new Map(snapshot.partners.map((partner) => [partner.id, partner]));
    const campaignById = new Map(snapshot.campaigns.map((campaign) => [campaign.id, campaign]));
    const creatorById = new Map(snapshot.creators.map((creator) => [creator.id, creator]));

    const filteredAttribution = snapshot.attribution.filter((row) => {
      if (surface && row.surface !== surface) return false;
      if (routeId && row.route_id !== routeId) return false;
      if (creatorProfileId && row.creator_profile_id !== creatorProfileId) return false;
      if (citySlug && row.city_slug !== citySlug) return false;
      return true;
    });

    const attributionSummary = Object.entries(
      filteredAttribution.reduce<Record<string, number>>((acc, row) => {
        acc[row.event_type] = (acc[row.event_type] ?? 0) + 1;
        return acc;
      }, {})
    )
      .map(([eventType, count]) => ({ eventType, count }))
      .sort((a, b) => b.count - a.count);

    const filteredRewards = snapshot.rewards.filter((row) => {
      if (routeId && row.route_id !== routeId) return false;
      if (creatorProfileId && row.creator_profile_id !== creatorProfileId) return false;
      if (citySlug && row.city_slug !== citySlug) return false;
      return true;
    });

    const filteredSlots = snapshot.slots.filter((slot) => (!surface ? true : slot.surface === surface));

    const slotStatuses = filteredSlots.map((slot) => {
      const assignments = snapshot.assignments
        .filter((assignment) => assignment.slot_id === slot.id)
        .map((assignment) => {
          const campaign = campaignById.get(assignment.campaign_id) ?? null;
          const partner = campaign?.partner_profile_id
            ? partnerById.get(campaign.partner_profile_id) ?? null
            : null;

          return {
            id: assignment.id,
            campaignId: campaign?.id ?? null,
            status: assignment.status,
            priority: assignment.priority,
            startsAt: assignment.starts_at,
            endsAt: assignment.ends_at,
            campaignName: campaign?.name ?? "Unbekannte Kampagne",
            campaignStatus: campaign?.status ?? null,
            ctaLabel: campaign?.cta_label ?? null,
            ctaUrl: campaign?.cta_url ?? null,
            partnerName: partner?.display_name ?? null,
            partnerSlug: partner?.slug ?? null,
            partnerProfileId: partner?.id ?? null,
            citySlug: campaign?.city_slug ?? null,
            targetRouteId: campaign?.target_route_id ?? null,
            targetLocationId: campaign?.target_location_id ?? null,
            targetEventId: campaign?.target_event_id ?? null,
            targetCreatorProfileId: campaign?.target_creator_profile_id ?? null,
          };
        })
        .filter((assignment) => {
          if (!citySlug) return true;
          return assignment.citySlug === citySlug || slot.city_slug === citySlug;
        })
        .filter((assignment) => {
          if (routeId && assignment.targetRouteId !== routeId) return false;
          if (creatorProfileId && assignment.targetCreatorProfileId !== creatorProfileId) return false;
          return true;
        });

      return {
        slotKey: slot.slot_key,
        surface: slot.surface,
        status: slot.status,
        disclosureLabel: slot.disclosure_label,
        assignmentCount: assignments.length,
        activeAssignmentCount: assignments.filter(
          (assignment) => assignment.status === "active" && assignment.campaignStatus === "active"
        ).length,
        assignments,
      };
    });

    return NextResponse.json({
      attributionSummary,
      recentAttribution: filteredAttribution.slice(0, 30).map((row) => ({
        id: row.id,
        eventType: row.event_type,
        surface: row.surface,
        citySlug: row.city_slug,
        occurredAt: row.occurred_at,
        routeId: row.route_id,
        planId: row.plan_id,
        partnerName: row.partner_profile_id ? partnerById.get(row.partner_profile_id)?.display_name ?? null : null,
        creatorName: row.creator_profile_id
          ? creatorById.get(row.creator_profile_id)?.display_name ??
            creatorById.get(row.creator_profile_id)?.username ??
            null
          : null,
        metadata: row.metadata,
      })),
      recentRewards: filteredRewards.slice(0, 20).map((row) => {
        const creator = creatorById.get(row.creator_profile_id) ?? null;
        return {
          id: row.id,
          rewardType: row.reward_type,
          sourceType: row.source_type,
          status: row.status,
          rewardValue: row.reward_value,
          rewardUnit: row.reward_unit,
          citySlug: row.city_slug,
          routeId: row.route_id,
          creatorName: creator?.display_name ?? creator?.username ?? null,
          createdAt: row.created_at,
        };
      }),
      slotStatuses,
    });
  } catch (error) {
    console.error("monetization debug load failed:", error);
    if (error instanceof MonetizationAdminAccessError) {
      const message =
        error.reason === "unauthenticated"
          ? "authentication_required"
          : error.reason === "misconfigured"
            ? "admin_allowlist_not_configured"
            : "admin_forbidden";

      return NextResponse.json({ error: message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "debug load failed";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
