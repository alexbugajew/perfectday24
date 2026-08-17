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

// ── Runtime validation ───────────────────────────────────────────────────────

const VALID_PLAN_MODES = ["morning", "midday", "evening", "fullday"] as const;
const VALID_BUDGETS = ["low", "medium", "high", "free"] as const;
const VALID_OCCASIONS = ["date", "friends", "family", "party", "tourism"] as const;
const VALID_EXPERIENCE_MODES = ["classic", "show", "event_visit", "market_festival"] as const;
const VALID_START_TYPES = ["current_location", "address", "hotel", "station", "airport", "other"] as const;
const VALID_EVENT_MODES = ["auto", "locked", "disabled"] as const;
const VALID_SORT_MODES = ["match", "distance"] as const;
const VALID_ROUTE_PROFILES = ["foot", "public_transit", "car"] as const;
const VALID_EVAL_MODES = ["normal", "trace"] as const;
const VALID_STRICTNESS = ["off", "hybrid", "required"] as const;
const VALID_FAMILY_AGE_BANDS = ["0_6", "4_10", "9_14", "12_16"] as const;

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function validatePlannerRequest(raw: unknown): { ok: true; body: PlannerRequestBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Body muss ein Objekt sein." };
  }
  const r = raw as Record<string, unknown>;

  if (!isOneOf(r.planMode, VALID_PLAN_MODES))
    return { ok: false, error: `planMode ungültig: ${String(r.planMode)}` };
  if (!isOneOf(r.budget, VALID_BUDGETS))
    return { ok: false, error: `budget ungültig: ${String(r.budget)}` };
  if (!isOneOf(r.occasion, VALID_OCCASIONS))
    return { ok: false, error: `occasion ungültig: ${String(r.occasion)}` };
  if (r.familyAgeBand !== undefined && r.familyAgeBand !== null && !isOneOf(r.familyAgeBand, VALID_FAMILY_AGE_BANDS))
    return { ok: false, error: `familyAgeBand ungültig: ${String(r.familyAgeBand)}` };
  if (r.experienceMode !== undefined && !isOneOf(r.experienceMode, VALID_EXPERIENCE_MODES))
    return { ok: false, error: `experienceMode ungültig: ${String(r.experienceMode)}` };
  if (r.eventPlanningMode !== undefined && !isOneOf(r.eventPlanningMode, VALID_EVENT_MODES))
    return { ok: false, error: `eventPlanningMode ungültig.` };
  if (r.sortMode !== undefined && !isOneOf(r.sortMode, VALID_SORT_MODES))
    return { ok: false, error: `sortMode ungültig.` };
  if (r.routeProfile !== undefined && !isOneOf(r.routeProfile, VALID_ROUTE_PROFILES))
    return { ok: false, error: `routeProfile ungültig.` };
  if (r.evaluationMode !== undefined && !isOneOf(r.evaluationMode, VALID_EVAL_MODES))
    return { ok: false, error: `evaluationMode ungültig.` };
  if (r.eventStrictness !== undefined && !isOneOf(r.eventStrictness, VALID_STRICTNESS))
    return { ok: false, error: `eventStrictness ungültig.` };

  const sp = r.startPoint as Record<string, unknown> | undefined;
  if (!sp || typeof sp !== "object")
    return { ok: false, error: "startPoint fehlt." };
  if (!isOneOf(sp.type, VALID_START_TYPES))
    return { ok: false, error: `startPoint.type ungültig: ${String(sp.type)}` };

  if (typeof r.radiusKm !== "number" || r.radiusKm < 1 || r.radiusKm > 100)
    return { ok: false, error: "radiusKm muss zwischen 1 und 100 liegen." };
  if (!Array.isArray(r.interests))
    return { ok: false, error: "interests muss ein Array sein." };
  if ((r.interests as unknown[]).length > 20)
    return { ok: false, error: "interests darf maximal 20 Einträge haben." };

  const group = r.group as Record<string, unknown> | undefined;
  if (!group || typeof group !== "object")
    return { ok: false, error: "group fehlt." };
  if (typeof group.enabled !== "boolean")
    return { ok: false, error: "group.enabled muss boolean sein." };
  if (!Array.isArray(group.members))
    return { ok: false, error: "group.members muss ein Array sein." };
  if ((group.members as unknown[]).length > 10)
    return { ok: false, error: "group.members darf maximal 10 Mitglieder haben." };

  if (r.planDate !== undefined && r.planDate !== null) {
    if (typeof r.planDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.planDate))
      return { ok: false, error: "planDate muss im Format YYYY-MM-DD sein." };
  }
  if (r.dayStartMin !== undefined && r.dayStartMin !== null) {
    if (
      typeof r.dayStartMin !== "number" ||
      !Number.isFinite(r.dayStartMin) ||
      r.dayStartMin < 0 ||
      r.dayStartMin > 23 * 60 + 59
    ) {
      return { ok: false, error: "dayStartMin muss zwischen 0 und 1439 liegen." };
    }
  }
  if (r.stopsCount !== undefined && (typeof r.stopsCount !== "number" || r.stopsCount < 1 || r.stopsCount > 10))
    return { ok: false, error: "stopsCount muss zwischen 1 und 10 liegen." };

  return { ok: true, body: r as unknown as PlannerRequestBody };
}

type PlannerRequestBody = {
  citySlug: string | null;
  planDate?: string | null;
  dayStartMin?: number | null;
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
  familyAgeBand?: "0_6" | "4_10" | "9_14" | "12_16" | null;
  experienceMode?: "classic" | "show" | "event_visit" | "market_festival";
  eventStrictness?: "off" | "hybrid" | "required";
  interests: string[];
  group: {
    enabled: boolean;
    members: Array<{ id: string; name: string; interests: string[] }>;
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

const LOCATION_BASE_COLUMNS = [
  "id",
  "name",
  "type",
  "description",
  "budget",
  "occasion",
  "daytime",
  "category",
  "meal",
  "manual_category",
  "manual_meal",
  "lat",
  "lng",
  "reservation_url",
  "duration_min",
  "tags",
  "subtypes",
  "audiences",
  "occasions",
  "city_slug",
  "source_primary",
  "source_refs",
  "is_plannable",
  "family_friendly",
  "quality_score",
  "importance_score",
  "popularity_score",
  "manual_boost",
  "data_confidence",
  "enrichment_version",
  "last_enriched_at",
  "quality_notes",
  "opening_hours_raw",
  "energy_level",
  "indoor_outdoor",
  "rating",
  "rating_count",
  "breakfast_fit",
  "lunch_fit",
  "dinner_fit",
  "nightlife_fit",
  "evening_only",
  "daytime_fit",
];

async function loadLocations(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  body: PlannerRequestBody
) {
  const queryLimit = body.citySlug ? 12000 : 5000;

  const runQuery = async (includeUsageScore: boolean) => {
    const columns = includeUsageScore
      ? [...LOCATION_BASE_COLUMNS, "usage_score"]
      : LOCATION_BASE_COLUMNS;

    let query = supabase
      .from("locations")
      .select(columns.join(","))
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

    return query;
  };

  // Drift-Guard: usage_score kommt aus Migration 20260731120000 — solange sie
  // in der Live-DB fehlt, läuft der Planner ohne das Nutzungssignal weiter.
  let { data, error } = await runQuery(true);
  if (error && String(error.message ?? "").includes("usage_score")) {
    ({ data, error } = await runQuery(false));
  }

  if (error) {
    throw new Error(`Locations konnten nicht geladen werden: ${error.message}`);
  }

  return (data ?? []) as unknown as LocationRow[];
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
    const raw = await req.json().catch(() => null);
    if (raw === null) {
      return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
    }

    const validation = validatePlannerRequest(raw);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const body: PlannerRequestBody = {
      ...validation.body,
      citySlug: canonicalCitySlug(validation.body.citySlug ?? null),
    };

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
      dayStartMin: body.dayStartMin ?? null,
      selectedEventId: body.selectedEventId ?? null,
      eventPlanningMode: body.eventPlanningMode ?? "auto",
      startPoint: body.startPoint,
      planMode: body.planMode,
      radiusKm: body.radiusKm,
      budget: body.budget,
      occasion: body.occasion,
      familyAgeBand: body.familyAgeBand ?? null,
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
