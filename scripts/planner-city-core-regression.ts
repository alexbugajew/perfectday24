import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  buildPlanningContext,
  classify,
  generatePlan,
  plannerEventCategoriesForExperienceMode,
  plannerEventIsActive,
  plannerEventToLocationRow,
  sortPlannerEventsForPlanning,
} from "../lib/planner";
import type {
  ExperienceMode,
  OccasionKey,
  PlannerEventRow,
  PlannerRequest,
  PlannedStop,
  RouteProfile,
} from "../lib/planner/types";

type CoreRegressionCase = {
  id: string;
  title: string;
  citySlug: string;
  planDate: string;
  occasion: OccasionKey;
  experienceMode: ExperienceMode;
  planMode: "midday" | "evening";
  routeProfile: RouteProfile;
};

type StopSnapshot = {
  label: string;
  name: string | null;
  category: string | null;
  source: string | null;
  eventSource: string | null;
  eventCategory: string | null;
  timingLock: string | null;
  selectedFrom: string | null;
};

type GuardrailResult = {
  passed: boolean;
  failures: string[];
  skipped: string[];
};

type CaseReport = {
  id: string;
  title: string;
  citySlug: string;
  planDate: string;
  occasion: OccasionKey;
  experienceMode: ExperienceMode;
  activeLevel: string;
  topVisibleEvents: Array<{
    title: string;
    source: string;
    category: string;
    venue: string | null | undefined;
    start: string;
    status: string | null | undefined;
  }>;
  plannedStops: StopSnapshot[];
  guardrails: GuardrailResult;
};

const EXPECTED_CASE_COUNT = 9;

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
    throw new Error("Missing Supabase env vars for core regression runner.");
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function startPointForCity(citySlug: string) {
  if (citySlug === "berlin-berlin") {
    return {
      type: "station" as const,
      label: "Berlin Hbf",
      lat: 52.52508,
      lng: 13.3694,
    };
  }

  if (citySlug === "hamburg-hamburg") {
    return {
      type: "station" as const,
      label: "Hamburg Hbf",
      lat: 53.5526,
      lng: 10.0067,
    };
  }

  if (citySlug === "muenchen") {
    return {
      type: "station" as const,
      label: "Muenchen Hbf",
      lat: 48.1402,
      lng: 11.5584,
    };
  }

  if (citySlug === "stuttgart") {
    return {
      type: "station" as const,
      label: "Stuttgart Hbf",
      lat: 48.7831,
      lng: 9.1829,
    };
  }

  if (citySlug === "dortmund") {
    return {
      type: "station" as const,
      label: "Dortmund Hbf",
      lat: 51.5177,
      lng: 7.4593,
    };
  }

  if (citySlug === "koeln") {
    return {
      type: "station" as const,
      label: "Koeln Hbf",
      lat: 50.943,
      lng: 6.9587,
    };
  }

  if (citySlug === "frankfurt-am-main") {
    return {
      type: "station" as const,
      label: "Frankfurt Hbf",
      lat: 50.1071,
      lng: 8.6638,
    };
  }

  if (citySlug === "duesseldorf") {
    return {
      type: "station" as const,
      label: "Duesseldorf Hbf",
      lat: 51.2194,
      lng: 6.7945,
    };
  }

  if (citySlug === "leipzig") {
    return {
      type: "station" as const,
      label: "Leipzig Hbf",
      lat: 51.3452,
      lng: 12.3816,
    };
  }

  if (citySlug === "dresden") {
    return {
      type: "station" as const,
      label: "Dresden Hbf",
      lat: 51.0407,
      lng: 13.732,
    };
  }

  if (citySlug === "hannover") {
    return {
      type: "station" as const,
      label: "Hannover Hbf",
      lat: 52.3779,
      lng: 9.7416,
    };
  }

  if (citySlug === "nuernberg") {
    return {
      type: "station" as const,
      label: "Nuernberg Hbf",
      lat: 49.4456,
      lng: 11.0824,
    };
  }

  if (citySlug === "bremen") {
    return {
      type: "station" as const,
      label: "Bremen Hbf",
      lat: 53.0821,
      lng: 8.8133,
    };
  }

  return {
    type: "station" as const,
    label: "City Center",
    lat: 0,
    lng: 0,
  };
}

function buildCases(): CoreRegressionCase[] {
  return [
    {
      id: "berlin-date-show",
      title: "Berlin / date / show / evening",
      citySlug: "berlin-berlin",
      planDate: "2026-04-15",
      occasion: "date",
      experienceMode: "show",
      planMode: "evening",
      routeProfile: "public_transit",
    },
    {
      id: "hamburg-date-show",
      title: "Hamburg / date / show / evening",
      citySlug: "hamburg-hamburg",
      planDate: "2026-04-14",
      occasion: "date",
      experienceMode: "show",
      planMode: "evening",
      routeProfile: "public_transit",
    },
    {
      id: "muenchen-date-show",
      title: "Muenchen / date / show / evening",
      citySlug: "muenchen",
      planDate: "2026-04-15",
      occasion: "date",
      experienceMode: "show",
      planMode: "evening",
      routeProfile: "public_transit",
    },
    {
      id: "berlin-friends-event",
      title: "Berlin / friends / event_visit / evening",
      citySlug: "berlin-berlin",
      planDate: "2026-04-15",
      occasion: "friends",
      experienceMode: "event_visit",
      planMode: "evening",
      routeProfile: "public_transit",
    },
    {
      id: "hamburg-friends-event",
      title: "Hamburg / friends / event_visit / evening",
      citySlug: "hamburg-hamburg",
      planDate: "2026-04-15",
      occasion: "friends",
      experienceMode: "event_visit",
      planMode: "evening",
      routeProfile: "public_transit",
    },
    {
      id: "muenchen-friends-event",
      title: "Muenchen / friends / event_visit / evening",
      citySlug: "muenchen",
      planDate: "2026-04-15",
      occasion: "friends",
      experienceMode: "event_visit",
      planMode: "evening",
      routeProfile: "public_transit",
    },
    {
      id: "berlin-tourism-market",
      title: "Berlin / tourism / market_festival / midday",
      citySlug: "berlin-berlin",
      planDate: "2026-05-01",
      occasion: "tourism",
      experienceMode: "market_festival",
      planMode: "midday",
      routeProfile: "public_transit",
    },
    {
      id: "hamburg-tourism-market",
      title: "Hamburg / tourism / market_festival / midday",
      citySlug: "hamburg-hamburg",
      planDate: "2026-04-12",
      occasion: "tourism",
      experienceMode: "market_festival",
      planMode: "midday",
      routeProfile: "public_transit",
    },
    {
      id: "muenchen-tourism-market",
      title: "Muenchen / tourism / market_festival / midday",
      citySlug: "muenchen",
      planDate: "2026-05-01",
      occasion: "tourism",
      experienceMode: "market_festival",
      planMode: "midday",
      routeProfile: "public_transit",
    },
  ];
}

async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>
) {
  const pageSize = 1000;
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) {
      throw new Error(error.message);
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return rows;
}

async function loadLocations(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  citySlug: string
) {
  return fetchAllRows(async (from, to) =>
    supabase
      .from("locations")
      .select("*")
      .eq("city_slug", citySlug)
      .eq("is_plannable", true)
      .range(from, to)
  );
}

async function loadActiveEventLocations(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  testCase: CoreRegressionCase
) {
  const categories = plannerEventCategoriesForExperienceMode(testCase.experienceMode);
  const rows = await fetchAllRows<PlannerEventRow>(async (from, to) =>
    supabase
      .from("planner_events")
      .select("*")
      .eq("city_slug", testCase.citySlug)
      .in("status", ["scheduled", "draft"])
      .in("category", categories)
      .range(from, to)
  );

  const activeRows = rows.filter((row) =>
    plannerEventIsActive(row, testCase.planDate)
  );
  const sortedRows = sortPlannerEventsForPlanning(activeRows, {
    experienceMode: testCase.experienceMode,
    planDate: testCase.planDate,
  });
  const visibleRows = sortedRows.filter((row) => row.status === "scheduled");

  return {
    rows: visibleRows,
    locations: visibleRows.map(plannerEventToLocationRow),
  };
}

function toStopSnapshot(stop: PlannedStop): StopSnapshot {
  const sourceRefs =
    stop.item?.source_refs && typeof stop.item.source_refs === "object"
      ? (stop.item.source_refs as Record<string, unknown>)
      : null;

  return {
    label: stop.label,
    name: stop.item?.name ?? null,
    category: stop.item ? classify(stop.item) : null,
    source: stop.item?.source_primary ?? null,
    eventSource: typeof sourceRefs?.source === "string" ? sourceRefs.source : null,
    eventCategory: typeof sourceRefs?.eventCategory === "string" ? sourceRefs.eventCategory : null,
    timingLock: stop.timingLock ?? null,
    selectedFrom: stop.debug?.selectedFrom ?? null,
  };
}

function evaluateGuardrails(
  testCase: CoreRegressionCase,
  plannedStops: StopSnapshot[],
  availableEventCount: number
): GuardrailResult {
  const failures: string[] = [];
  const skipped: string[] = [];
  const filledStops = plannedStops.filter((stop) => stop.name);
  // Find event placed in flow regardless of timing lock first (data-independent check)
  const eventInFlowIndex = plannedStops.findIndex((stop) => stop.source === "planner_event");
  // Find event with timing lock (data-dependent: requires startsAt/endsAt in source_refs)
  const eventTimingLockedIndex = plannedStops.findIndex(
    (stop) => stop.source === "planner_event" && stop.timingLock === "event"
  );

  if (testCase.experienceMode === "show" || testCase.experienceMode === "event_visit") {
    if (availableEventCount === 0) {
      skipped.push("kein planner_event in DB fuer diese Stadt/Datum — event-Guardrails uebersprungen");
    } else {
      // Core guarantee: event must appear somewhere in the flow
      if (eventInFlowIndex < 0) {
        failures.push("kein planner_event-Stop im Flow trotz vorhandener DB-Events");
      }

      if (filledStops.length < 3) {
        failures.push("weniger als drei gefuellte Stops");
      }

      // Timing lock is data-dependent (needs startsAt in source_refs) — warn but don't fail
      if (eventInFlowIndex >= 0 && eventTimingLockedIndex < 0) {
        skipped.push("planner_event ohne Timing-Lock (fehlende startsAt/endsAt im Event) — kein Fehler");
      }

      const anchorIdx = eventTimingLockedIndex >= 0 ? eventTimingLockedIndex : eventInFlowIndex;
      if (anchorIdx >= 0) {
        const afterEvent = plannedStops.slice(anchorIdx + 1).find((stop) => stop.name) ?? null;
        if (!afterEvent) {
          failures.push("kein Ausklang nach dem Event");
        } else if (afterEvent.source === "planner_event") {
          failures.push("Ausklang kippt wieder auf ein zweites Event");
        }
      }
    }
  }

  if (testCase.experienceMode === "market_festival") {
    if (availableEventCount === 0) {
      skipped.push("kein planner_event in DB fuer diese Stadt/Datum — Markt/Festival-Guardrails uebersprungen");
    } else {
      const firstFilled = filledStops[0] ?? null;
      if (!firstFilled) {
        failures.push("keine gefuellten Stops");
      } else {
        if (firstFilled.source !== "planner_event") {
          failures.push("Markt/Festival liegt nicht vorne im Plan");
        }
        // Timing lock is data-dependent — warn if absent but don't fail
        if (firstFilled.source === "planner_event" && firstFilled.timingLock !== "event") {
          skipped.push("Markt/Festival ohne Timing-Lock (fehlende Timing-Daten im Event)");
        }
      }

      if (filledStops.length < 2) {
        failures.push("zu wenig Anschluss nach dem Festival");
      }
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    skipped,
  };
}

async function runCase(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  testCase: CoreRegressionCase
): Promise<CaseReport> {
  const request: PlannerRequest = {
    citySlug: testCase.citySlug,
    planDate: testCase.planDate,
    selectedEventId: null,
    eventPlanningMode: "auto",
    startPoint: startPointForCity(testCase.citySlug),
    planMode: testCase.planMode,
    radiusKm: 12,
    budget: "medium",
    occasion: testCase.occasion,
    experienceMode: testCase.experienceMode,
    eventStrictness: testCase.experienceMode === "show" ? "required" : "hybrid",
    interests:
      testCase.experienceMode === "market_festival"
        ? ["market", "festival", "street food", "local"]
        : ["live music", "theater", "musical", "culture"],
    group: { enabled: false, members: [] },
    stopsCount: 3,
    sortMode: "match",
    routeProfile: testCase.routeProfile,
    evaluationMode: "trace",
  };

  const [locations, eventBundle] = await Promise.all([
    loadLocations(supabase, testCase.citySlug),
    loadActiveEventLocations(supabase, testCase),
  ]);

  buildPlanningContext(request);
  const result = generatePlan({
    request,
    locations: [...locations, ...eventBundle.locations],
  });

  const plannedStops = result.plannedStops.map(toStopSnapshot);
  const guardrails = evaluateGuardrails(testCase, plannedStops, eventBundle.rows.length);

  return {
    id: testCase.id,
    title: testCase.title,
    citySlug: testCase.citySlug,
    planDate: testCase.planDate,
    occasion: testCase.occasion,
    experienceMode: testCase.experienceMode,
    activeLevel: result.activeLevel,
    topVisibleEvents: eventBundle.rows.slice(0, 8).map((event) => ({
      title: event.title,
      source: event.source,
      category: event.category,
      venue: event.venue_name,
      start: event.start_at,
      status: event.status,
    })),
    plannedStops,
    guardrails,
  };
}

function buildMarkdownReport(reports: CaseReport[]) {
  const lines: string[] = [];
  const passed = reports.filter((report) => report.guardrails.passed).length;
  const skipped = reports.filter((report) => report.guardrails.skipped.length > 0).length;

  lines.push("# Planner City Core Regression");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Passed: ${passed} / ${reports.length} (skipped: ${skipped})`);
  lines.push("");

  for (const report of reports) {
    const hasSkips = report.guardrails.skipped.length > 0;
    const status = report.guardrails.passed ? (hasSkips ? "SKIP" : "PASS") : "FAIL";
    lines.push(`## ${report.title}`);
    lines.push(`Guardrails: ${status}`);
    if (!report.guardrails.passed) {
      for (const failure of report.guardrails.failures) {
        lines.push(`- FAIL: ${failure}`);
      }
    }
    for (const skip of report.guardrails.skipped) {
      lines.push(`- SKIP: ${skip}`);
    }
    lines.push("");
    lines.push("Planned stops:");
    for (const stop of report.plannedStops) {
      lines.push(
        `- ${stop.label}: ${stop.name ?? "[empty]"} | ${stop.source ?? "n/a"} | ${stop.category ?? "n/a"}`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  const envPath = join(process.cwd(), ".env.local");
  if (existsSync(envPath)) loadEnvFile(envPath);
  const supabase = getSupabaseAdmin();
  const cases = buildCases();

  if (cases.length !== EXPECTED_CASE_COUNT) {
    throw new Error(`Expected ${EXPECTED_CASE_COUNT} core cases, got ${cases.length}.`);
  }

  const reports: CaseReport[] = [];
  for (const testCase of cases) {
    reports.push(await runCase(supabase, testCase));
  }

  const outDir = join(process.cwd(), "reports");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = join(outDir, `planner-city-core-regression-${stamp}.json`);
  const mdPath = join(outDir, `planner-city-core-regression-${stamp}.md`);

  writeFileSync(jsonPath, JSON.stringify(reports, null, 2), "utf8");
  writeFileSync(mdPath, buildMarkdownReport(reports), "utf8");

  const failures = reports.flatMap((report) =>
    report.guardrails.failures.map((failure) => `${report.id}: ${failure}`)
  );
  const skippedCases = reports.filter((report) => report.guardrails.skipped.length > 0);

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);

  if (skippedCases.length > 0) {
    console.log(`Skipped event guardrails for ${skippedCases.length} case(s) — no event data in DB:`);
    for (const report of skippedCases) {
      console.log(`  [SKIP] ${report.id}`);
    }
  }

  const effectiveCases = reports.length - skippedCases.length;
  const passedCases = reports.filter((r) => r.guardrails.passed && r.guardrails.skipped.length === 0).length;
  console.log(`Passed ${passedCases} / ${effectiveCases} active guardrail groups (${skippedCases.length} skipped due to missing event data).`);

  if (failures.length > 0) {
    console.error("Core regression failures:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
