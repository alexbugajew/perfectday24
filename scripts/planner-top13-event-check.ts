import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  buildPlanningContext,
  generatePlan,
  plannerEventCategoriesForExperienceMode,
  plannerEventIsActive,
  plannerEventToLocationRow,
  sortPlannerEventsForPlanning,
} from "../lib/planner";
import { chooseEventAnchor } from "../lib/planner/route/anchor";
import {
  buildMarketFestivalIntentText,
  isEligibleMarketFestival,
} from "../lib/planner/market-festival";
import { haversineKm } from "../lib/planner/travel";
import type {
  ExperienceMode,
  LocationRow,
  OccasionKey,
  PlannerEventRow,
  PlannerRequest,
  PlannedStop,
  RouteProfile,
} from "../lib/planner/types";

type CitySlug =
  | "berlin-berlin"
  | "hamburg-hamburg"
  | "muenchen"
  | "koeln"
  | "frankfurt-am-main"
  | "stuttgart"
  | "duesseldorf"
  | "leipzig"
  | "dresden"
  | "hannover"
  | "nuernberg"
  | "bremen"
  | "dortmund";

type FlowKey = "show" | "event_visit" | "market_festival";

type FlowConfig = {
  key: FlowKey;
  title: string;
  occasion: OccasionKey;
  experienceMode: ExperienceMode;
  planMode: "midday" | "evening";
  routeProfile: RouteProfile;
  candidateLimit: number;
};

type StopSnapshot = {
  label: string;
  name: string | null;
  source: string | null;
  eventSource: string | null;
  eventCategory: string | null;
  timingLock: string | null;
  selectedFrom: string | null;
};

type AttemptSnapshot = {
  planDate: string;
  directEventAnchorTitle: string | null;
  topVisibleEvents: Array<{
    title: string;
    source: string;
    category: string;
    start: string;
  }>;
  plannedStops: StopSnapshot[];
  passed: boolean;
};

type FlowReport = {
  flow: FlowKey;
  title: string;
  citySlug: CitySlug;
  status: "passed" | "failed" | "no_candidate_date";
  attemptedDates: string[];
  selectedDate: string | null;
  directEventAnchorTitle: string | null;
  topVisibleEvents: AttemptSnapshot["topVisibleEvents"];
  plannedStops: StopSnapshot[];
  failureReason: string | null;
};

type CityReport = {
  citySlug: CitySlug;
  flows: FlowReport[];
};

type Summary = {
  totalCities: number;
  byFlow: Record<
    FlowKey,
    {
      passed: number;
      failed: number;
      noCandidateDate: number;
    }
  >;
  weakCases: Array<{
    citySlug: CitySlug;
    flow: FlowKey;
    status: FlowReport["status"];
    reason: string;
  }>;
};

const CITY_SLUGS: CitySlug[] = [
  "berlin-berlin",
  "hamburg-hamburg",
  "muenchen",
  "koeln",
  "frankfurt-am-main",
  "stuttgart",
  "duesseldorf",
  "leipzig",
  "dresden",
  "hannover",
  "nuernberg",
  "bremen",
  "dortmund",
];

const FLOWS: FlowConfig[] = [
  {
    key: "show",
    title: "Show",
    occasion: "date",
    experienceMode: "show",
    planMode: "evening",
    routeProfile: "public_transit",
    candidateLimit: 6,
  },
  {
    key: "event_visit",
    title: "Event Visit",
    occasion: "friends",
    experienceMode: "event_visit",
    planMode: "evening",
    routeProfile: "public_transit",
    candidateLimit: 6,
  },
  {
    key: "market_festival",
    title: "Market / Festival",
    occasion: "tourism",
    experienceMode: "market_festival",
    planMode: "midday",
    routeProfile: "public_transit",
    candidateLimit: 8,
  },
];

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
    throw new Error("Missing Supabase env vars for top-13 event check.");
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function startPointForCity(citySlug: CitySlug) {
  if (citySlug === "berlin-berlin") {
    return { type: "station" as const, label: "Berlin Hbf", lat: 52.52508, lng: 13.3694 };
  }
  if (citySlug === "hamburg-hamburg") {
    return { type: "station" as const, label: "Hamburg Hbf", lat: 53.5526, lng: 10.0067 };
  }
  if (citySlug === "muenchen") {
    return { type: "station" as const, label: "Muenchen Hbf", lat: 48.1402, lng: 11.5584 };
  }
  if (citySlug === "koeln") {
    return { type: "station" as const, label: "Koeln Hbf", lat: 50.943, lng: 6.9587 };
  }
  if (citySlug === "frankfurt-am-main") {
    return { type: "station" as const, label: "Frankfurt Hbf", lat: 50.1071, lng: 8.6638 };
  }
  if (citySlug === "stuttgart") {
    return { type: "station" as const, label: "Stuttgart Hbf", lat: 48.7831, lng: 9.1829 };
  }
  if (citySlug === "duesseldorf") {
    return { type: "station" as const, label: "Duesseldorf Hbf", lat: 51.2194, lng: 6.7945 };
  }
  if (citySlug === "leipzig") {
    return { type: "station" as const, label: "Leipzig Hbf", lat: 51.3452, lng: 12.3816 };
  }
  if (citySlug === "dresden") {
    return { type: "station" as const, label: "Dresden Hbf", lat: 51.0407, lng: 13.732 };
  }
  if (citySlug === "hannover") {
    return { type: "station" as const, label: "Hannover Hbf", lat: 52.3779, lng: 9.7416 };
  }
  if (citySlug === "nuernberg") {
    return { type: "station" as const, label: "Nuernberg Hbf", lat: 49.4456, lng: 11.0824 };
  }
  if (citySlug === "bremen") {
    return { type: "station" as const, label: "Bremen Hbf", lat: 53.0821, lng: 8.8133 };
  }
  return { type: "station" as const, label: "Dortmund Hbf", lat: 51.5177, lng: 7.4593 };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function eventDate(event: PlannerEventRow) {
  return typeof event.start_at === "string" ? event.start_at.slice(0, 10) : null;
}

function localEventDate(event: PlannerEventRow) {
  if (!event.start_at) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: event.timezone || "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(event.start_at));
  } catch {
    return eventDate(event);
  }
}

function isMarketFestivalCandidate(event: PlannerEventRow) {
  return isEligibleMarketFestival({
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
  });
}

function stopSnapshot(stop: PlannedStop): StopSnapshot {
  const sourceRefs =
    stop.item?.source_refs && typeof stop.item.source_refs === "object"
      ? (stop.item.source_refs as Record<string, unknown>)
      : null;
  return {
    label: stop.label,
    name: stop.item?.name ?? null,
    source: stop.item?.source_primary ?? null,
    eventSource: typeof sourceRefs?.source === "string" ? sourceRefs.source : null,
    eventCategory: typeof sourceRefs?.eventCategory === "string" ? sourceRefs.eventCategory : null,
    timingLock: stop.timingLock ?? null,
    selectedFrom: stop.debug?.selectedFrom ?? null,
  };
}

function attemptPassed(flow: FlowConfig, attempt: AttemptSnapshot) {
  const eventStops = attempt.plannedStops.filter((stop) => stop.source === "planner_event");
  if (flow.key === "market_festival") {
    return eventStops.some((stop) =>
      stop.eventCategory === "market" ||
      stop.eventCategory === "festival" ||
      stop.eventCategory === "fair" ||
      stop.eventCategory === "seasonal" ||
      stop.eventCategory === "food_event"
    );
  }
  return eventStops.length > 0;
}

function plannerRequestFor(citySlug: CitySlug, planDate: string, flow: FlowConfig): PlannerRequest {
  return {
    citySlug,
    planDate,
    selectedEventId: null,
    eventPlanningMode: "auto",
    startPoint: startPointForCity(citySlug),
    planMode: flow.planMode,
    radiusKm: 12,
    budget: "medium",
    occasion: flow.occasion,
    experienceMode: flow.experienceMode,
    eventStrictness: flow.experienceMode === "show" ? "required" : "hybrid",
    interests: ["live music", "theater", "musical", "culture"],
    group: { enabled: false, members: [] },
    stopsCount: 3,
    sortMode: "match",
    routeProfile: flow.routeProfile,
    evaluationMode: "trace",
  };
}

async function loadCityData(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  citySlug: CitySlug,
  minDate: string
) {
  const [locationsResult, eventsResult] = await Promise.all([
    supabase
      .from("locations")
      .select("*")
      .eq("city_slug", citySlug)
      .eq("is_plannable", true)
      .limit(12000),
    supabase
      .from("planner_events")
      .select("*")
      .eq("city_slug", citySlug)
      .in("status", ["scheduled", "draft"])
      .gte("start_at", `${minDate}T00:00:00+00:00`)
      .limit(5000),
  ]);

  if (locationsResult.error) {
    throw new Error(`Locations konnten nicht geladen werden fuer ${citySlug}: ${locationsResult.error.message}`);
  }
  if (eventsResult.error) {
    throw new Error(`Events konnten nicht geladen werden fuer ${citySlug}: ${eventsResult.error.message}`);
  }

  return {
    locations: filterLocationsForAudit(citySlug, locationsResult.data ?? []),
    events: (eventsResult.data ?? []) as PlannerEventRow[],
  };
}

function filterLocationsForAudit(citySlug: CitySlug, locations: LocationRow[]) {
  const origin = startPointForCity(citySlug);
  const withDistance = locations.map((location) => {
    const distanceKm =
      location.lat != null && location.lng != null
        ? haversineKm(origin.lat, origin.lng, location.lat, location.lng)
        : null;
    return { location, distanceKm };
  });

  const nearby = withDistance
    .filter(({ distanceKm }) => distanceKm == null || distanceKm <= 18)
    .sort((a, b) => {
      const aDistance = a.distanceKm ?? 999;
      const bDistance = b.distanceKm ?? 999;
      return aDistance - bDistance;
    })
    .slice(0, 3500)
    .map(({ location }) => location);

  return nearby.length > 0 ? nearby : locations.slice(0, 3500);
}

function candidateDatesForFlow(events: PlannerEventRow[], flow: FlowConfig, minDate: string) {
  const categories = new Set(plannerEventCategoriesForExperienceMode(flow.experienceMode));
  const dates = new Set<string>();
  for (const event of events) {
    if (!categories.has(event.category)) continue;
    if (flow.key === "market_festival" && !isMarketFestivalCandidate(event)) continue;
    const date = localEventDate(event);
    if (!date || date < minDate) continue;
    dates.add(date);
  }
  return Array.from(dates).sort().slice(0, flow.candidateLimit);
}

function buildAttempt(
  citySlug: CitySlug,
  flow: FlowConfig,
  planDate: string,
  locations: Awaited<ReturnType<typeof loadCityData>>["locations"],
  cityEvents: PlannerEventRow[]
): AttemptSnapshot | null {
  const categories = new Set(plannerEventCategoriesForExperienceMode(flow.experienceMode));
  const activeRows = cityEvents
    .filter((event) => categories.has(event.category))
    .filter((event) => localEventDate(event) === planDate)
    .filter((event) => plannerEventIsActive(event, planDate));

  if (activeRows.length === 0) {
    return null;
  }

  const sortedRows = sortPlannerEventsForPlanning(activeRows, {
    experienceMode: flow.experienceMode,
    planDate,
  });
  const visibleRows = sortedRows.filter((row) => row.status === "scheduled");
  const request = plannerRequestFor(citySlug, planDate, flow);
  const result = generatePlan({
    request,
    locations: [...locations, ...visibleRows.map(plannerEventToLocationRow)],
  });
  const context = buildPlanningContext(request);
  const directEventAnchor = chooseEventAnchor({
    context,
    candidates: result.results,
    variationSeed: 0,
  });

  const attempt: AttemptSnapshot = {
    planDate,
    directEventAnchorTitle: directEventAnchor?.candidate.name ?? null,
    topVisibleEvents: visibleRows.slice(0, 5).map((event) => ({
      title: event.title,
      source: event.source,
      category: event.category,
      start: event.start_at,
    })),
    plannedStops: result.plannedStops.map(stopSnapshot),
    passed: false,
  };

  attempt.passed = attemptPassed(flow, attempt);
  return attempt;
}

function selectBestAttempt(flow: FlowConfig, attempts: AttemptSnapshot[]) {
  const passed = attempts.find((attempt) => attempt.passed);
  if (passed) return passed;
  return attempts[0] ?? null;
}

async function evaluateCityFlow(
  citySlug: CitySlug,
  flow: FlowConfig,
  cityData: Awaited<ReturnType<typeof loadCityData>>,
  minDate: string
): Promise<FlowReport> {
  const dates = candidateDatesForFlow(cityData.events, flow, minDate);
  if (dates.length === 0) {
    return {
      flow: flow.key,
      title: flow.title,
      citySlug,
      status: "no_candidate_date",
      attemptedDates: [],
      selectedDate: null,
      directEventAnchorTitle: null,
      topVisibleEvents: [],
      plannedStops: [],
      failureReason: "kein passender offizieller Eventtag im aktuellen Datenfenster",
    };
  }

  const attempts = dates
    .map((planDate) => buildAttempt(citySlug, flow, planDate, cityData.locations, cityData.events))
    .filter((attempt): attempt is AttemptSnapshot => attempt !== null);

  if (attempts.length === 0) {
    return {
      flow: flow.key,
      title: flow.title,
      citySlug,
      status: "no_candidate_date",
      attemptedDates: dates,
      selectedDate: null,
      directEventAnchorTitle: null,
      topVisibleEvents: [],
      plannedStops: [],
      failureReason: "Events vorhanden, aber auf den geprueften Tagen nicht aktiv planbar",
    };
  }

  const selected = selectBestAttempt(flow, attempts);
  if (!selected) {
    return {
      flow: flow.key,
      title: flow.title,
      citySlug,
      status: "failed",
      attemptedDates: dates,
      selectedDate: null,
      directEventAnchorTitle: null,
      topVisibleEvents: [],
      plannedStops: [],
      failureReason: "kein verwertbarer Planner-Lauf",
    };
  }

  return {
    flow: flow.key,
    title: flow.title,
    citySlug,
    status: selected.passed ? "passed" : "failed",
    attemptedDates: attempts.map((attempt) => attempt.planDate),
    selectedDate: selected.planDate,
    directEventAnchorTitle: selected.directEventAnchorTitle,
    topVisibleEvents: selected.topVisibleEvents,
    plannedStops: selected.plannedStops,
    failureReason: selected.passed
      ? null
      : "kein planner_event im finalen Flow verankert",
  };
}

function buildSummary(cityReports: CityReport[]): Summary {
  const initial = {
    show: { passed: 0, failed: 0, noCandidateDate: 0 },
    event_visit: { passed: 0, failed: 0, noCandidateDate: 0 },
    market_festival: { passed: 0, failed: 0, noCandidateDate: 0 },
  };

  const summary: Summary = {
    totalCities: cityReports.length,
    byFlow: initial,
    weakCases: [],
  };

  for (const city of cityReports) {
    for (const flow of city.flows) {
      if (flow.status === "passed") {
        summary.byFlow[flow.flow].passed += 1;
        continue;
      }
      if (flow.status === "no_candidate_date") {
        summary.byFlow[flow.flow].noCandidateDate += 1;
      } else {
        summary.byFlow[flow.flow].failed += 1;
      }
      summary.weakCases.push({
        citySlug: city.citySlug,
        flow: flow.flow,
        status: flow.status,
        reason: flow.failureReason ?? "ohne weiteren Fehlertext",
      });
    }
  }

  return summary;
}

function buildMarkdown(cityReports: CityReport[], summary: Summary) {
  const lines: string[] = [];
  lines.push("# Planner Top-13 Event Check");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Flow | Passed | Failed | No candidate date |");
  lines.push("| --- | ---: | ---: | ---: |");
  for (const flow of FLOWS) {
    const metrics = summary.byFlow[flow.key];
    lines.push(`| ${flow.title} | ${metrics.passed} | ${metrics.failed} | ${metrics.noCandidateDate} |`);
  }
  lines.push("");
  lines.push("## Weak Cases");
  lines.push("");
  if (summary.weakCases.length === 0) {
    lines.push("No weak cases.");
  } else {
    lines.push("| City | Flow | Status | Reason |");
    lines.push("| --- | --- | --- | --- |");
    for (const weakCase of summary.weakCases) {
      lines.push(`| ${weakCase.citySlug} | ${weakCase.flow} | ${weakCase.status} | ${weakCase.reason} |`);
    }
  }
  lines.push("");

  for (const city of cityReports) {
    lines.push(`## ${city.citySlug}`);
    lines.push("");
    for (const flow of city.flows) {
      lines.push(`### ${flow.title}`);
      lines.push("");
      lines.push(`- Status: ${flow.status}`);
      lines.push(`- Selected date: ${flow.selectedDate ?? "-"}`);
      lines.push(`- Tried dates: ${flow.attemptedDates.join(", ") || "-"}`);
      lines.push(`- Direct event anchor: ${flow.directEventAnchorTitle ?? "-"}`);
      if (flow.failureReason) {
        lines.push(`- Note: ${flow.failureReason}`);
      }
      lines.push("- Planned stops:");
      if (flow.plannedStops.length === 0) {
        lines.push("  - none");
      } else {
        for (const stop of flow.plannedStops) {
          lines.push(
            `  - ${stop.label}: ${stop.name ?? "-"} (${stop.source ?? "no-source"}${
              stop.eventCategory ? `, ${stop.eventCategory}` : ""
            })`
          );
        }
      }
      lines.push("- Top visible events:");
      if (flow.topVisibleEvents.length === 0) {
        lines.push("  - none");
      } else {
        for (const event of flow.topVisibleEvents) {
          lines.push(`  - ${event.title} [${event.category}] (${event.source}) @ ${event.start}`);
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

async function main() {
  loadEnvFile(join(process.cwd(), ".env.local"));
  const supabase = getSupabaseAdmin();
  const minDate = todayIso();
  const cityReports: CityReport[] = [];

  for (const citySlug of CITY_SLUGS) {
    console.log(`[top13] checking ${citySlug}`);
    const cityData = await loadCityData(supabase, citySlug, minDate);
    const flows: FlowReport[] = [];
    for (const flow of FLOWS) {
      console.log(`[top13] ${citySlug} -> ${flow.key}`);
      flows.push(await evaluateCityFlow(citySlug, flow, cityData, minDate));
    }
    cityReports.push({ citySlug, flows });
  }

  const summary = buildSummary(cityReports);
  const outDir = join(process.cwd(), "reports");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = join(outDir, `planner-top13-event-check-${stamp}.json`);
  const mdPath = join(outDir, `planner-top13-event-check-${stamp}.md`);

  writeFileSync(jsonPath, JSON.stringify({ cityReports, summary }, null, 2), "utf8");
  writeFileSync(mdPath, buildMarkdown(cityReports, summary), "utf8");

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  for (const flow of FLOWS) {
    const metrics = summary.byFlow[flow.key];
    console.log(
      `${flow.key}: ${metrics.passed} passed, ${metrics.failed} failed, ${metrics.noCandidateDate} no-candidate`
    );
  }
  for (const weakCase of summary.weakCases) {
    console.log(`WEAK ${weakCase.citySlug} ${weakCase.flow}: ${weakCase.reason}`);
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
