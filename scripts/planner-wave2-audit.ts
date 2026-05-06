import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { createClient } from "@supabase/supabase-js";
import {
  buildPlanningContext,
  generatePlan,
  plannerEventCategoriesForExperienceMode,
  plannerEventIsActive,
  plannerEventToLocationRow,
  sortPlannerEventsForPlanning,
} from "../lib/planner";
import {
  buildMarketFestivalIntentText,
  isEligibleMarketFestival,
  marketFestivalSpecificityScore,
} from "../lib/planner/market-festival";
import { PLANNER_33_ROLLOUT } from "../lib/cities/rollout";
import { chooseEventAnchor } from "../lib/planner/route/anchor";
import type {
  ExperienceMode,
  PlannerEventRow,
  PlannerRequest,
  RouteProfile,
} from "../lib/planner/types";

type Wave2CitySlug =
  | "duisburg"
  | "bochum"
  | "wuppertal"
  | "bielefeld"
  | "augsburg"
  | "braunschweig"
  | "kiel";

type AuditCaseId = "show" | "event_visit" | "market_festival";

type CaseSpec = {
  id: AuditCaseId;
  experienceMode: ExperienceMode;
  occasion: PlannerRequest["occasion"];
  planMode: PlannerRequest["planMode"];
  routeProfile: RouteProfile;
};

type TimingMetrics = {
  candidateQueryMs: number;
  cityLocationsMs: number;
  dayEventsQueryMs: number;
  generateMs: number;
  totalMs: number;
};

type CaseAudit = {
  caseId: AuditCaseId;
  planDate: string | null;
  eventCandidateTitle: string | null;
  topVisibleEventTitle: string | null;
  eventStopTitle: string | null;
  activeLevel: string | null;
  visibleEventCount: number;
  plannedStopCount: number;
  usedEventStop: boolean;
  passed: boolean;
  failureReason: string | null;
  timings: TimingMetrics;
};

type CityAudit = {
  citySlug: Wave2CitySlug;
  label: string;
  locationCount: number;
  averageTotalMs: number;
  maxTotalMs: number;
  performanceBand: "healthy" | "observe" | "slow";
  cases: CaseAudit[];
};

const CASES: CaseSpec[] = [
  {
    id: "show",
    experienceMode: "show",
    occasion: "date",
    planMode: "evening",
    routeProfile: "public_transit",
  },
  {
    id: "event_visit",
    experienceMode: "event_visit",
    occasion: "friends",
    planMode: "evening",
    routeProfile: "public_transit",
  },
  {
    id: "market_festival",
    experienceMode: "market_festival",
    occasion: "tourism",
    planMode: "midday",
    routeProfile: "public_transit",
  },
];

const AUDIT_START_DATE = "2026-04-23";
const CANDIDATE_LOOKAHEAD_DAYS = 90;
const CANDIDATE_QUERY_LIMIT = 320;

function loadEnvFile(path: string) {
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("Missing Supabase env vars for wave2 planner audit.");
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isoDatePart(value: string | null | undefined) {
  return value ? value.slice(0, 10) : null;
}

function startPointForCity(citySlug: Wave2CitySlug) {
  if (citySlug === "duisburg") {
    return { type: "station" as const, label: "Duisburg Hbf", lat: 51.4299, lng: 6.7768 };
  }
  if (citySlug === "bochum") {
    return { type: "station" as const, label: "Bochum Hbf", lat: 51.4787, lng: 7.2226 };
  }
  if (citySlug === "wuppertal") {
    return { type: "station" as const, label: "Wuppertal Hbf", lat: 51.2562, lng: 7.1494 };
  }
  if (citySlug === "bielefeld") {
    return { type: "station" as const, label: "Bielefeld Hbf", lat: 52.0289, lng: 8.5325 };
  }
  if (citySlug === "augsburg") {
    return { type: "station" as const, label: "Augsburg Hbf", lat: 48.3652, lng: 10.8862 };
  }
  if (citySlug === "braunschweig") {
    return { type: "station" as const, label: "Braunschweig Hbf", lat: 52.2526, lng: 10.5408 };
  }
  return { type: "station" as const, label: "Kiel Hbf", lat: 54.3146, lng: 10.1317 };
}

function wave2Cities() {
  return PLANNER_33_ROLLOUT.filter(
    (city): city is (typeof PLANNER_33_ROLLOUT)[number] & { slug: Wave2CitySlug } =>
      city.stage === "wave2" && city.plannerVisibility === "visible"
  );
}

function scoreCandidateForCase(event: PlannerEventRow, caseId: AuditCaseId) {
  let score = 0;
  const marketFestivalSpecificity =
    caseId === "market_festival"
      ? marketFestivalSpecificityScore({
          text: buildMarketFestivalIntentText({
            title: event.title,
            summary: event.summary,
            venue_name: event.venue_name,
            venue_address: event.venue_address,
            tags: event.tags,
          }),
          subtypes: Array.isArray(event.subtypes)
            ? event.subtypes.filter((value): value is string => typeof value === "string")
            : [],
          category: event.category,
        })
      : 0;

  if (caseId === "show") {
    if (event.category === "show") score += 10;
    if (event.category === "concert") score += 9;
    if (event.category === "theater") score += 8;
  } else if (caseId === "event_visit") {
    if (event.category === "show" || event.category === "concert" || event.category === "theater") score += 10;
    if (event.category === "festival" || event.category === "fair") score += 8;
    if (event.category === "market") score += 6;
    if (event.category === "community") score += 4;
  } else {
    const exhibitionLike = Array.isArray(event.subtypes)
      ? event.subtypes.some((value): value is string => value === "exhibition")
      : false;
    if (event.category === "market") score += 12;
    if (event.category === "festival") score += 11;
    if (event.category === "fair") score += exhibitionLike ? -8 : 2;
    if (event.category === "food_event") score += 4;
    if (event.category === "community") score += 5;
    if (marketFestivalSpecificity < 40) {
      score -= 400;
    } else {
      score += Math.min(Math.floor(marketFestivalSpecificity / 20), 10);
    }
  }

  if (typeof event.lat === "number" && typeof event.lng === "number") {
    score += 2;
  }
  if (event.venue_name) {
    score += 1;
  }
  return score;
}

function performanceBand(totalMsValues: number[]): CityAudit["performanceBand"] {
  const average = totalMsValues.reduce((sum, value) => sum + value, 0) / Math.max(totalMsValues.length, 1);
  const max = totalMsValues.reduce((current, value) => Math.max(current, value), 0);

  if (average > 1800 || max > 2500) return "slow";
  if (average > 900 || max > 1400) return "observe";
  return "healthy";
}

async function fetchCityLocations(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  citySlug: Wave2CitySlug
) {
  const locationsStart = performance.now();
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("city_slug", citySlug)
    .eq("is_plannable", true)
    .limit(15000);

  if (error) {
    throw new Error(`Locations konnten nicht geladen werden fuer ${citySlug}: ${error.message}`);
  }

  return {
    rows: data ?? [],
    ms: performance.now() - locationsStart,
  };
}

async function findCandidateEvent(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  citySlug: Wave2CitySlug,
  spec: CaseSpec
) {
  const queryStart = performance.now();
  const lookaheadEnd = new Date(`${AUDIT_START_DATE}T00:00:00+02:00`);
  lookaheadEnd.setDate(lookaheadEnd.getDate() + CANDIDATE_LOOKAHEAD_DAYS);
  const lookaheadEndDate = lookaheadEnd.toISOString().slice(0, 10);
  const categories = plannerEventCategoriesForExperienceMode(spec.experienceMode);
  const { data, error } = await supabase
    .from("planner_events")
    .select("*")
    .eq("city_slug", citySlug)
    .eq("status", "scheduled")
    .in("category", categories)
    .gte("start_at", `${AUDIT_START_DATE}T00:00:00+00:00`)
    .lt("start_at", `${lookaheadEndDate}T23:59:59+00:00`)
    .order("start_at", { ascending: true })
    .limit(CANDIDATE_QUERY_LIMIT);

  if (error) {
    throw new Error(`Candidate events konnten nicht geladen werden fuer ${citySlug}/${spec.id}: ${error.message}`);
  }

  const activeRows = (data ?? []).filter((row) => {
    const date = isoDatePart(row.start_at);
    return date ? plannerEventIsActive(row, date) : false;
  });
  const candidateRows =
    spec.id === "market_festival"
      ? activeRows.filter((row) =>
          isEligibleMarketFestival({
            text: buildMarketFestivalIntentText({
              title: row.title,
              summary: row.summary,
              venue_name: row.venue_name,
              venue_address: row.venue_address,
              tags: row.tags,
            }),
            subtypes: Array.isArray(row.subtypes)
              ? row.subtypes.filter((value: unknown): value is string => typeof value === "string")
              : [],
            category: row.category,
          })
        )
      : activeRows;

  const candidate = [...(candidateRows.length > 0 ? candidateRows : activeRows)]
    .sort((left, right) => {
      const scoreDelta = scoreCandidateForCase(right, spec.id) - scoreCandidateForCase(left, spec.id);
      if (scoreDelta !== 0) return scoreDelta;
      return (left.start_at ?? "").localeCompare(right.start_at ?? "");
    })
    .at(0);

  return {
    candidate,
    ms: performance.now() - queryStart,
  };
}

async function fetchDayEvents(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  citySlug: Wave2CitySlug,
  planDate: string,
  spec: CaseSpec
) {
  const eventsStart = performance.now();
  const categories = plannerEventCategoriesForExperienceMode(spec.experienceMode);
  const { data, error } = await supabase
    .from("planner_events")
    .select("*")
    .eq("city_slug", citySlug)
    .in("status", ["scheduled", "draft"])
    .in("category", categories)
    .gte("start_at", `${planDate}T00:00:00+00:00`)
    .lt("start_at", `${planDate}T23:59:59+00:00`)
    .limit(500);

  if (error) {
    throw new Error(`Day events konnten nicht geladen werden fuer ${citySlug}/${spec.id}: ${error.message}`);
  }

  const activeRows = (data ?? []).filter((row) => plannerEventIsActive(row, planDate));
  return {
    rows: sortPlannerEventsForPlanning(activeRows, {
      experienceMode: spec.experienceMode,
      planDate,
    }),
    ms: performance.now() - eventsStart,
  };
}

function buildRequest(citySlug: Wave2CitySlug, planDate: string, spec: CaseSpec): PlannerRequest {
  return {
    citySlug,
    planDate,
    selectedEventId: null,
    eventPlanningMode: "auto",
    startPoint: startPointForCity(citySlug),
    planMode: spec.planMode,
    radiusKm: 12,
    budget: "medium",
    occasion: spec.occasion,
    experienceMode: spec.experienceMode,
    eventStrictness: spec.experienceMode === "show" ? "required" : "hybrid",
    interests: ["live music", "theater", "festival", "culture", "local food"],
    group: { enabled: false, members: [] },
    stopsCount: 3,
    sortMode: "match",
    routeProfile: spec.routeProfile,
    evaluationMode: "trace",
  };
}

function buildMarkdown(rows: CityAudit[]) {
  const lines: string[] = [];
  lines.push("# Planner Wave-2 Audit");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## City Summary");
  lines.push("");
  lines.push("| City | Locations | Avg total ms | Max total ms | Performance | Cases passed |");
  lines.push("| --- | ---: | ---: | ---: | --- | --- |");

  for (const row of rows) {
    const passed = row.cases.filter((entry) => entry.passed).length;
    lines.push(
      `| ${row.label} (\`${row.citySlug}\`) | ${row.locationCount} | ${row.averageTotalMs.toFixed(0)} | ${row.maxTotalMs.toFixed(0)} | ${row.performanceBand} | ${passed}/${row.cases.length} |`
    );
  }

  for (const row of rows) {
    lines.push("");
    lines.push(`## ${row.label}`);
    lines.push("");
    lines.push("| Flow | Date | Candidate | Final event stop | Visible events | Stops | Total ms | Result |");
    lines.push("| --- | --- | --- | --- | ---: | ---: | ---: | --- |");
    for (const entry of row.cases) {
      lines.push(
        `| ${entry.caseId} | ${entry.planDate ?? "-"} | ${entry.eventCandidateTitle ?? "-"} | ${entry.eventStopTitle ?? "-"} | ${entry.visibleEventCount} | ${entry.plannedStopCount} | ${entry.timings.totalMs.toFixed(0)} | ${
          entry.passed ? "passed" : `failed (${entry.failureReason ?? "unknown"})`
        } |`
      );
    }
  }

  return lines.join("\n");
}

async function auditCity(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  city: ReturnType<typeof wave2Cities>[number]
): Promise<CityAudit> {
  const locationLoad = await fetchCityLocations(supabase, city.slug);
  const cases: CaseAudit[] = [];

  for (const spec of CASES) {
    const timings: TimingMetrics = {
      candidateQueryMs: 0,
      cityLocationsMs: locationLoad.ms,
      dayEventsQueryMs: 0,
      generateMs: 0,
      totalMs: 0,
    };

    const caseStart = performance.now();
    const candidateSelection = await findCandidateEvent(supabase, city.slug, spec);
    timings.candidateQueryMs = candidateSelection.ms;
    const candidate = candidateSelection.candidate;

    if (!candidate) {
      timings.totalMs = performance.now() - caseStart;
      cases.push({
        caseId: spec.id,
        planDate: null,
        eventCandidateTitle: null,
        topVisibleEventTitle: null,
        eventStopTitle: null,
        activeLevel: null,
        visibleEventCount: 0,
        plannedStopCount: 0,
        usedEventStop: false,
        passed: false,
        failureReason: "no_candidate_date",
        timings,
      });
      continue;
    }

    const planDate = isoDatePart(candidate.start_at);
    if (!planDate) {
      timings.totalMs = performance.now() - caseStart;
      cases.push({
        caseId: spec.id,
        planDate: null,
        eventCandidateTitle: candidate.title,
        topVisibleEventTitle: null,
        eventStopTitle: null,
        activeLevel: null,
        visibleEventCount: 0,
        plannedStopCount: 0,
        usedEventStop: false,
        passed: false,
        failureReason: "invalid_candidate_date",
        timings,
      });
      continue;
    }

    const request = buildRequest(city.slug, planDate, spec);
    const dayEvents = await fetchDayEvents(supabase, city.slug, planDate, spec);
    timings.dayEventsQueryMs = dayEvents.ms;

    const eventLocations = dayEvents.rows
      .filter((row) => row.status === "scheduled")
      .map(plannerEventToLocationRow);
    const generateStart = performance.now();
    const result = generatePlan({
      request,
      locations: [...locationLoad.rows, ...eventLocations],
    });
    timings.generateMs = performance.now() - generateStart;
    timings.totalMs = performance.now() - caseStart;

    const context = buildPlanningContext(request);
    const directEventAnchor = chooseEventAnchor({
      context,
      candidates: result.results,
      variationSeed: 0,
    });

    const eventStop = result.plannedStops.find((stop) => {
      const refs =
        stop.item?.source_refs && typeof stop.item.source_refs === "object"
          ? (stop.item.source_refs as Record<string, unknown>)
          : null;
      return (
        stop.item?.source_primary === "planner_event" ||
        typeof refs?.eventCategory === "string" ||
        stop.debug?.selectedFrom === "forced_event"
      );
    });

    const plannedStopCount = result.plannedStops.filter((stop) => stop.item).length;
    const usedEventStop = Boolean(eventStop || directEventAnchor);
    const failureReason =
      plannedStopCount < 3 ? "too_few_stops" : !usedEventStop ? "missing_event_anchor" : null;

    cases.push({
      caseId: spec.id,
      planDate,
      eventCandidateTitle: candidate.title,
      topVisibleEventTitle: dayEvents.rows.at(0)?.title ?? null,
      eventStopTitle: eventStop?.item?.name ?? directEventAnchor?.candidate.name ?? null,
      activeLevel: result.activeLevel,
      visibleEventCount: dayEvents.rows.filter((row) => row.status === "scheduled").length,
      plannedStopCount,
      usedEventStop,
      passed: failureReason === null,
      failureReason,
      timings,
    });
  }

  const totalValues = cases.map((entry) => entry.timings.totalMs);
  const averageTotalMs = totalValues.reduce((sum, value) => sum + value, 0) / Math.max(totalValues.length, 1);
  const maxTotalMs = totalValues.reduce((current, value) => Math.max(current, value), 0);

  return {
    citySlug: city.slug,
    label: city.label,
    locationCount: locationLoad.rows.length,
    averageTotalMs,
    maxTotalMs,
    performanceBand: performanceBand(totalValues),
    cases,
  };
}

async function main() {
  loadEnvFile(join(process.cwd(), ".env.local"));
  const supabase = getSupabaseAdmin();
  const cities = wave2Cities();
  const rows: CityAudit[] = [];

  for (const city of cities) {
    rows.push(await auditCity(supabase, city));
  }

  const outDir = join(process.cwd(), "reports");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = join(outDir, `planner-wave2-audit-${stamp}.json`);
  const mdPath = join(outDir, `planner-wave2-audit-${stamp}.md`);

  writeFileSync(jsonPath, JSON.stringify({ rows }, null, 2), "utf8");
  writeFileSync(mdPath, buildMarkdown(rows), "utf8");

  const passedCities = rows.filter((row) => row.cases.every((entry) => entry.passed)).length;
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Wave2 cities audited: ${rows.length}`);
  console.log(`Cities with all flows passed: ${passedCities}/${rows.length}`);
  for (const row of rows) {
    const failures = row.cases.filter((entry) => !entry.passed);
    if (failures.length === 0) continue;
    console.log(`- ${row.citySlug}: ${failures.map((entry) => `${entry.caseId}=${entry.failureReason}`).join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
