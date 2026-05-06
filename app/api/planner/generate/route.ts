// app/api/planner/generate/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canonicalCitySlug } from "@/lib/cities/canonical";
import {
  buildPlanningContext,
  buildPlanVariants,
  dedupePlannerEventsForPlanning,
  MAX_RETRIEVAL_CANDIDATES_API,
  plannerEventCategoriesForExperienceMode,
  plannerEventIsActive,
  sortPlannerEventsForPlanning,
  plannerEventToLocationRow,
  retrieveCandidates,
  scoreCandidatesWithRelaxation,
  summarizeRoute,
} from "@/lib/planner";
import type { LocationRow, PlannerEventRow } from "@/lib/planner";

type PlannerRequestBody = {
  citySlug: string | null;
  planDate?: string | null;
  selectedEventId?: string | null;
  eventPlanningMode?: "auto" | "locked" | "disabled";
  startPoint: {
    type: "current_location" | "address" | "hotel" | "station" | "airport" | "other";
    label: string | null;
    lat: number | null;
    lng: number | null;
  };
  planMode: "morning" | "midday" | "evening" | "fullday";
  radiusKm: number;
  budget: "low" | "medium" | "high" | "free";
  occasion: "date" | "friends" | "family" | "party" | "tourism";
  experienceMode?: "classic" | "show" | "event_visit" | "market_festival";
  eventStrictness?: "off" | "hybrid" | "required";
  interests: string[];
  group: {
    enabled: boolean;
    members: Array<{
      id: string;
      name: string;
      interests: string[];
    }>;
  };
  fullDayActsAfterBreakfast?: number;
  fullDayActsAfterLunch?: number;
  stopsCount?: number;
  sortMode?: "match" | "distance";
  routeProfile?: "foot" | "public_transit" | "car";
  stopOffsets?: number[];
  variationSeed?: number;
  evaluationMode?: "normal" | "trace";
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

async function loadLocations(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  body: PlannerRequestBody
) {
  const queryLimit = body.citySlug ? 12000 : 5000;

  let query = supabase
    .from("locations")
    .select(`
      id,
      name,
      type,
      budget,
      occasion,
      daytime,
      category,
      meal,
      manual_category,
      manual_meal,
      lat,
      lng,
      reservation_url,
      duration_min,
      tags,
      subtypes,
      audiences,
      occasions,
      city_slug,
      source_primary,
      source_refs,
      is_plannable,
      family_friendly,
      quality_score,
      importance_score,
      popularity_score,
      manual_boost,
      data_confidence,
      enrichment_version,
      last_enriched_at,
      quality_notes,
      opening_hours_raw,
      energy_level,
      indoor_outdoor,
      rating,
      rating_count,
      breakfast_fit,
      lunch_fit,
      dinner_fit,
      nightlife_fit,
      evening_only,
      daytime_fit
    `)
    .order("manual_boost", { ascending: false, nullsFirst: false })
    .order("quality_score", { ascending: false, nullsFirst: false })
    .order("importance_score", { ascending: false, nullsFirst: false })
    .order("popularity_score", { ascending: false, nullsFirst: false })
    .order("rating", { ascending: false, nullsFirst: false })
    .order("rating_count", { ascending: false, nullsFirst: false })
    .limit(queryLimit);

  if (body.citySlug) {
    query = query.eq("city_slug", body.citySlug);
  }

  query = query.eq("is_plannable", true);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Locations konnten nicht geladen werden: ${error.message}`);
  }

  return (data ?? []) as LocationRow[];
}

function nextIsoDate(dateValue: string) {
  const base = new Date(`${dateValue}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + 1);
  return base.toISOString().slice(0, 10);
}

function previousIsoDate(dateValue: string) {
  const base = new Date(`${dateValue}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() - 1);
  return base.toISOString().slice(0, 10);
}

async function loadPlannerEvents(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  body: PlannerRequestBody
) {
  const categories = plannerEventCategoriesForExperienceMode(
    body.experienceMode ?? "classic"
  );

  if (!body.citySlug || categories.length === 0) {
    return {
      visibleRows: [] as PlannerEventRow[],
      debugRows: [] as PlannerEventRow[],
    };
  }

  let query = supabase
    .from("planner_events")
    .select(`
      id,
      source,
      external_id,
      source_url,
      ticket_url,
      title,
      summary,
      category,
      kind,
      status,
      venue_name,
      venue_address,
      city_slug,
      country_code,
      lat,
      lng,
      timezone,
      start_at,
      end_at,
      doors_at,
      all_day,
      is_ticketed,
      price_min,
      price_max,
      currency,
      family_friendly,
      indoor_outdoor,
      local_rank,
      importance_score,
      popularity_score,
      tags,
      subtypes,
      audiences,
      occasions,
      source_payload,
      source_updated_at,
      last_seen_at,
      created_at,
      updated_at
    `)
    .eq("city_slug", body.citySlug)
    .in("status", ["scheduled", "draft"])
    .in("category", categories)
    .order("status", { ascending: true })
    .order("local_rank", { ascending: false, nullsFirst: false })
    .order("importance_score", { ascending: false, nullsFirst: false })
    .order("popularity_score", { ascending: false, nullsFirst: false })
    .order("start_at", { ascending: true })
    .limit(160);

  if (body.planDate) {
    const windowStart = previousIsoDate(body.planDate);
    const windowEnd = nextIsoDate(body.planDate);
    query = query
      .or(
        [
          `and(start_at.gte.${windowStart},start_at.lt.${windowEnd})`,
          `and(start_at.lt.${windowEnd},end_at.gte.${windowStart})`,
        ].join(",")
      );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Events konnten nicht geladen werden: ${error.message}`);
  }

  const rows = (data ?? []) as PlannerEventRow[];
  const activeRows = body.planDate
    ? rows.filter((row) => plannerEventIsActive(row, body.planDate ?? null))
    : rows;
  const sortedRows = dedupePlannerEventsForPlanning(
    sortPlannerEventsForPlanning(activeRows, {
      experienceMode: body.experienceMode ?? "classic",
      planDate: body.planDate ?? null,
    })
  );

  return {
    visibleRows: sortedRows.filter((row) => row.status === "scheduled"),
    debugRows: sortedRows,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PlannerRequestBody;
    body.citySlug = canonicalCitySlug(body.citySlug);

    if (
      body.startPoint?.type !== "current_location" &&
      (body.startPoint?.lat == null || body.startPoint?.lng == null)
    ) {
      return NextResponse.json(
        {
          error:
            "Manueller Startpunkt braucht Latitude und Longitude. Ohne Koordinaten kann der Radius nicht korrekt um den gewählten Ort geplant werden.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { visibleRows: eventCandidates, debugRows: eventDebugRows } =
      await loadPlannerEvents(supabase, body);
    const locations = await loadLocations(supabase, body);
    const eventLocations =
      body.eventPlanningMode === "disabled"
        ? []
        : eventCandidates.map((event) => plannerEventToLocationRow(event));
    const combinedLocations = [...eventLocations, ...locations];

    const context = buildPlanningContext({
      citySlug: body.citySlug,
      planDate: body.planDate ?? null,
      selectedEventId: body.selectedEventId ?? null,
      eventPlanningMode: body.eventPlanningMode ?? "auto",
      startPoint: body.startPoint,
      planMode: body.planMode,
      radiusKm: body.radiusKm,
      budget: body.budget,
      occasion: body.occasion,
      experienceMode: body.experienceMode ?? "classic",
      eventStrictness: body.eventStrictness,
      interests: body.interests ?? [],
      group: body.group ?? { enabled: false, members: [] },
      fullDayActsAfterBreakfast: body.fullDayActsAfterBreakfast,
      fullDayActsAfterLunch: body.fullDayActsAfterLunch,
      stopsCount: body.stopsCount,
      sortMode: body.sortMode ?? "match",
      routeProfile: body.routeProfile ?? "foot",
      stopOffsets: body.stopOffsets ?? [],
      variationSeed: body.variationSeed ?? 0,
      evaluationMode: body.evaluationMode ?? "normal",
    });

    const retrieval = retrieveCandidates({
      locations: combinedLocations,
      context,
      maxCandidates: MAX_RETRIEVAL_CANDIDATES_API,
    });

    const scoring = scoreCandidatesWithRelaxation({
      context,
      candidates: retrieval.candidates,
    });

    const variants = buildPlanVariants({
      context,
      candidates: scoring.results,
      planMode: body.planMode,
      stopOffsets: body.stopOffsets ?? [],
      variationSeed: body.variationSeed ?? 0,
    });

    const primaryVariant = variants[0] ?? null;

    const plannedStops = primaryVariant?.plannedStops ?? [];
    const fallbackSummary =
      primaryVariant?.fallbackSummary ??
      summarizeRoute({
        stops: plannedStops,
        origin: {
          lat: context.origin.lat,
          lng: context.origin.lng,
        },
      });

    return NextResponse.json({
      context,
      results: scoring.results,
      activeLevel: scoring.activeLevel,
      effectiveRadiusKm: retrieval.effectiveRadiusKm,
          eventCandidates,
          eventDebugRows,
          plannedStops,
      fallbackSummary,
      variants,
      recommendedVariantId: primaryVariant?.variantId ?? null,
    });
  } catch (err) {
    console.error("Planner API fatal error:", err);

    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unbekannter Fehler in /api/planner/generate",
      },
      { status: 500 }
    );
  }
}
