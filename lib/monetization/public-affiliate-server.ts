import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  emptyPublicAffiliateResolution,
  type PublicAffiliateMatch,
  type PublicAffiliateResolution,
} from "./affiliate-shared";

type ResolvePublicAffiliateInput = {
  locationIds?: string[] | null;
  plannerEventIds?: string[] | null;
  routeIds?: string[] | null;
};

type RawAffiliateRow = {
  id: string;
  partner_profile_id: string | null;
  location_id: string | null;
  planner_event_id: string | null;
  route_id: string | null;
  provider_name: string;
  destination_url: string;
  deep_link_url: string | null;
  commission_model: string;
  priority: number;
  partner?: { display_name?: string | null; slug?: string | null } | Array<{
    display_name?: string | null;
    slug?: string | null;
  }> | null;
};

const AFFILIATE_SELECT = `
  id,
  partner_profile_id,
  location_id,
  planner_event_id,
  route_id,
  provider_name,
  destination_url,
  deep_link_url,
  commission_model,
  priority,
  partner:partner_profiles(display_name, slug)
`;

function uniqueIds(values?: string[] | null) {
  return Array.from(
    new Set((values ?? []).map((value) => value?.trim()).filter((value): value is string => Boolean(value)))
  );
}

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

function normalizePartner(
  value: RawAffiliateRow["partner"]
): { displayName: string | null; slug: string | null } {
  if (Array.isArray(value)) {
    const first = value[0] ?? null;
    return {
      displayName: typeof first?.display_name === "string" ? first.display_name : null,
      slug: typeof first?.slug === "string" ? first.slug : null,
    };
  }

  if (value && typeof value === "object") {
    return {
      displayName: typeof value.display_name === "string" ? value.display_name : null,
      slug: typeof value.slug === "string" ? value.slug : null,
    };
  }

  return { displayName: null, slug: null };
}

function toPublicAffiliateMatch(row: RawAffiliateRow): PublicAffiliateMatch {
  const partner = normalizePartner(row.partner);
  return {
    id: row.id,
    partnerProfileId: row.partner_profile_id,
    partnerName: partner.displayName,
    partnerSlug: partner.slug,
    providerName: row.provider_name,
    destinationUrl: row.destination_url,
    deepLinkUrl: row.deep_link_url,
    targetUrl: row.deep_link_url || row.destination_url,
    commissionModel: row.commission_model,
    priority: row.priority,
  };
}

function assignFirst(
  target: Record<string, PublicAffiliateMatch>,
  rows: RawAffiliateRow[],
  key: "location_id" | "planner_event_id" | "route_id"
) {
  for (const row of rows) {
    const id = row[key];
    if (!id || target[id]) continue;
    target[id] = toPublicAffiliateMatch(row);
  }
}

async function fetchAffiliateRows(
  supabase: SupabaseClient<any, "public", any>,
  key: "location_id" | "planner_event_id" | "route_id",
  ids: string[]
) {
  if (ids.length === 0) return [] as RawAffiliateRow[];

  const { data, error } = await supabase
    .from("affiliate_links")
    .select(AFFILIATE_SELECT)
    .eq("is_active", true)
    .in(key, ids)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as RawAffiliateRow[];
}

export async function resolvePublicAffiliateLinks(
  input: ResolvePublicAffiliateInput
): Promise<PublicAffiliateResolution> {
  const locationIds = uniqueIds(input.locationIds);
  const plannerEventIds = uniqueIds(input.plannerEventIds);
  const routeIds = uniqueIds(input.routeIds);

  if (locationIds.length === 0 && plannerEventIds.length === 0 && routeIds.length === 0) {
    return emptyPublicAffiliateResolution();
  }

  const supabase = getSupabaseAdmin();
  const [locationRows, plannerEventRows, routeRows] = await Promise.all([
    fetchAffiliateRows(supabase, "location_id", locationIds),
    fetchAffiliateRows(supabase, "planner_event_id", plannerEventIds),
    fetchAffiliateRows(supabase, "route_id", routeIds),
  ]);

  const resolution = emptyPublicAffiliateResolution();
  assignFirst(resolution.byLocationId, locationRows, "location_id");
  assignFirst(resolution.byPlannerEventId, plannerEventRows, "planner_event_id");
  assignFirst(resolution.byRouteId, routeRows, "route_id");

  return resolution;
}
