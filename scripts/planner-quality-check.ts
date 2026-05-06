import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { classify, norm } from "../lib/planner";
import type { LocationRow, PlannerEventRow } from "../lib/planner/types";

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

type CityThresholds = {
  minLocations: number;
  minFood: number;
  minScheduledEvents: number;
  minAnchoredEvents: number;
  minFlexEvents: number;
  maxLocationDuplicateGroups: number;
  maxEditorialRatio: number;
};

type CityMetrics = {
  citySlug: CitySlug;
  locations: {
    plannable: number;
    food: number;
    nightlife: number;
    duplicateGroups: number;
  };
  events: {
    scheduled: number;
    draft: number;
    anchored: number;
    flex: number;
    editorialScheduled: number;
    editorialRatio: number;
    missingVenueScheduled: number;
    missingCoordinatesScheduled: number;
    dedupeShadowScheduled: number;
  };
  checks: Array<{
    label: string;
    passed: boolean;
    detail: string;
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
const FLEX_CATEGORIES = new Set([
  "market",
  "festival",
  "fair",
  "food_event",
  "community",
  "seasonal",
]);
const ANCHORED_CATEGORIES = new Set(["concert", "theater", "show"]);

const THRESHOLDS: Record<CitySlug, CityThresholds> = {
  "berlin-berlin": {
    minLocations: 550,
    minFood: 150,
    minScheduledEvents: 80,
    minAnchoredEvents: 10,
    minFlexEvents: 10,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 0.4,
  },
  "hamburg-hamburg": {
    minLocations: 550,
    minFood: 180,
    minScheduledEvents: 120,
    minAnchoredEvents: 20,
    minFlexEvents: 10,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 0.4,
  },
  muenchen: {
    minLocations: 500,
    minFood: 150,
    minScheduledEvents: 40,
    minAnchoredEvents: 5,
    minFlexEvents: 1,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 0.4,
  },
  koeln: {
    minLocations: 450,
    minFood: 150,
    minScheduledEvents: 0,
    minAnchoredEvents: 0,
    minFlexEvents: 0,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 1,
  },
  "frankfurt-am-main": {
    minLocations: 450,
    minFood: 150,
    minScheduledEvents: 0,
    minAnchoredEvents: 0,
    minFlexEvents: 0,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 1,
  },
  stuttgart: {
    minLocations: 450,
    minFood: 150,
    minScheduledEvents: 0,
    minAnchoredEvents: 0,
    minFlexEvents: 0,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 1,
  },
  duesseldorf: {
    minLocations: 450,
    minFood: 150,
    minScheduledEvents: 0,
    minAnchoredEvents: 0,
    minFlexEvents: 0,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 1,
  },
  leipzig: {
    minLocations: 450,
    minFood: 150,
    minScheduledEvents: 0,
    minAnchoredEvents: 0,
    minFlexEvents: 0,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 1,
  },
  dresden: {
    minLocations: 450,
    minFood: 150,
    minScheduledEvents: 0,
    minAnchoredEvents: 0,
    minFlexEvents: 0,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 1,
  },
  hannover: {
    minLocations: 350,
    minFood: 150,
    minScheduledEvents: 0,
    minAnchoredEvents: 0,
    minFlexEvents: 0,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 1,
  },
  nuernberg: {
    minLocations: 400,
    minFood: 150,
    minScheduledEvents: 0,
    minAnchoredEvents: 0,
    minFlexEvents: 0,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 1,
  },
  bremen: {
    minLocations: 450,
    minFood: 150,
    minScheduledEvents: 0,
    minAnchoredEvents: 0,
    minFlexEvents: 0,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 1,
  },
  dortmund: {
    minLocations: 450,
    minFood: 150,
    minScheduledEvents: 0,
    minAnchoredEvents: 0,
    minFlexEvents: 0,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 1,
  },
};

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
    throw new Error("Missing Supabase env vars for planner quality check.");
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function roundedCoordinate(value: number | null | undefined) {
  return typeof value === "number" ? value.toFixed(3) : "na";
}

function normalizeVenue(value: string | null | undefined) {
  return norm(value);
}

function locationDuplicateGroups(locations: LocationRow[]) {
  const groups = new Map<string, number>();
  for (const loc of locations) {
    const category = classify(loc) ?? "other";
    const key = [
      norm(loc.name),
      category,
      roundedCoordinate(loc.lat),
      roundedCoordinate(loc.lng),
    ].join("|");
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return Array.from(groups.values()).filter((count) => count > 1).length;
}

function hasMissingCoordinates(event: PlannerEventRow) {
  return typeof event.lat !== "number" || typeof event.lng !== "number";
}

function eventSubtypes(event: PlannerEventRow) {
  return Array.isArray(event.subtypes)
    ? event.subtypes.filter((value): value is string => typeof value === "string").map(norm)
    : [];
}

function hasEditorialSubtype(event: PlannerEventRow) {
  return eventSubtypes(event).includes("editorial_summary_page");
}

function hasDedupeShadow(event: PlannerEventRow) {
  return eventSubtypes(event).includes("dedupe_shadow");
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

function buildChecks(metrics: Omit<CityMetrics, "checks">): CityMetrics["checks"] {
  const thresholds = THRESHOLDS[metrics.citySlug];

  return [
    {
      label: "Plannable locations",
      passed: metrics.locations.plannable >= thresholds.minLocations,
      detail: `${metrics.locations.plannable} >= ${thresholds.minLocations}`,
    },
    {
      label: "Food coverage",
      passed: metrics.locations.food >= thresholds.minFood,
      detail: `${metrics.locations.food} >= ${thresholds.minFood}`,
    },
    {
      label: "Location duplicate groups",
      passed: metrics.locations.duplicateGroups <= thresholds.maxLocationDuplicateGroups,
      detail: `${metrics.locations.duplicateGroups} <= ${thresholds.maxLocationDuplicateGroups}`,
    },
    {
      label: "Scheduled events",
      passed: metrics.events.scheduled >= thresholds.minScheduledEvents,
      detail: `${metrics.events.scheduled} >= ${thresholds.minScheduledEvents}`,
    },
    {
      label: "Anchored event coverage",
      passed: metrics.events.anchored >= thresholds.minAnchoredEvents,
      detail: `${metrics.events.anchored} >= ${thresholds.minAnchoredEvents}`,
    },
    {
      label: "Market/Festival coverage",
      passed: metrics.events.flex >= thresholds.minFlexEvents,
      detail: `${metrics.events.flex} >= ${thresholds.minFlexEvents}`,
    },
    {
      label: "Editorial summary ratio",
      passed: metrics.events.editorialRatio <= thresholds.maxEditorialRatio,
      detail: `${metrics.events.editorialRatio.toFixed(2)} <= ${thresholds.maxEditorialRatio.toFixed(2)}`,
    },
  ];
}

function buildMarkdownReport(metrics: CityMetrics[]) {
  const lines: string[] = [];
  const allChecks = metrics.flatMap((city) => city.checks);
  const passed = allChecks.filter((check) => check.passed).length;

  lines.push("# Planner Quality Check");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Checks passed: ${passed} / ${allChecks.length}`);
  lines.push("");

  for (const city of metrics) {
    lines.push(`## ${city.citySlug}`);
    lines.push(
      `Locations: ${city.locations.plannable} plannable, ${city.locations.food} food, ${city.locations.duplicateGroups} duplicate groups`
    );
    lines.push(
      `Events: ${city.events.scheduled} scheduled, ${city.events.flex} flex, ${city.events.anchored} anchored, editorial ratio ${city.events.editorialRatio.toFixed(2)}`
    );
    lines.push("");
    for (const check of city.checks) {
      lines.push(`- [${check.passed ? "x" : " "}] ${check.label}: ${check.detail}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  loadEnvFile(join(process.cwd(), ".env.local"));
  const supabase = getSupabaseAdmin();

  const metrics: CityMetrics[] = [];

  for (let index = 0; index < CITY_SLUGS.length; index += 1) {
    const citySlug = CITY_SLUGS[index];
    const [cityLocations, cityEvents] = await Promise.all([
      fetchAllRows<LocationRow>(async (from, to) =>
        supabase
          .from("locations")
          .select("*")
          .eq("city_slug", citySlug)
          .eq("is_plannable", true)
          .range(from, to)
      ),
      fetchAllRows<PlannerEventRow>(async (from, to) =>
        supabase
          .from("planner_events")
          .select("*")
          .eq("city_slug", citySlug)
          .in("status", ["scheduled", "draft"])
          .range(from, to)
      ),
    ]);

    const scheduledEvents = cityEvents.filter((row) => row.status === "scheduled");

    const baseMetrics = {
      citySlug,
      locations: {
        plannable: cityLocations.length,
        food: cityLocations.filter((row) => {
          const category = classify(row);
          return category === "restaurant" || category === "cafe";
        }).length,
        nightlife: cityLocations.filter((row) => classify(row) === "nightlife").length,
        duplicateGroups: locationDuplicateGroups(cityLocations),
      },
      events: {
        scheduled: scheduledEvents.length,
        draft: cityEvents.filter((row) => row.status === "draft").length,
        anchored: scheduledEvents.filter((row) => ANCHORED_CATEGORIES.has(row.category)).length,
        flex: scheduledEvents.filter((row) => FLEX_CATEGORIES.has(row.category)).length,
        editorialScheduled: scheduledEvents.filter(hasEditorialSubtype).length,
        editorialRatio:
          scheduledEvents.length > 0
            ? scheduledEvents.filter(hasEditorialSubtype).length / scheduledEvents.length
            : 0,
        missingVenueScheduled: scheduledEvents.filter(
          (row) => normalizeVenue(row.venue_name).length === 0
        ).length,
        missingCoordinatesScheduled: scheduledEvents.filter(hasMissingCoordinates).length,
        dedupeShadowScheduled: scheduledEvents.filter(hasDedupeShadow).length,
      },
    };

    metrics.push({
      ...baseMetrics,
      checks: buildChecks(baseMetrics),
    });
  }

  const outDir = join(process.cwd(), "reports");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = join(outDir, `planner-quality-check-${stamp}.json`);
  const mdPath = join(outDir, `planner-quality-check-${stamp}.md`);

  writeFileSync(jsonPath, JSON.stringify(metrics, null, 2), "utf8");
  writeFileSync(mdPath, buildMarkdownReport(metrics), "utf8");

  const failures = metrics.flatMap((city) =>
    city.checks
      .filter((check) => !check.passed)
      .map((check) => `${city.citySlug}: ${check.label} (${check.detail})`)
  );

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(
    `Quality checks passed: ${
      metrics.flatMap((city) => city.checks).filter((check) => check.passed).length
    } / ${metrics.flatMap((city) => city.checks).length}`
  );

  if (failures.length > 0) {
    console.error("Planner quality check failures:");
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
