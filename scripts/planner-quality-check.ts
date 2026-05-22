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
  minCulture: number;
  minScheduledEvents: number;
  minAnchoredEvents: number;
  minFlexEvents: number;
  maxLocationDuplicateGroups: number;
  maxEditorialRatio: number;
  maxFoodRatio: number;
};

type CityMetrics = {
  citySlug: CitySlug;
  locations: {
    plannable: number;
    food: number;
    culture: number;
    nightlife: number;
    duplicateGroups: number;
    foodRatio: number;
    missingDuration: number;
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
  qualityScore: number;
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
    minCulture: 80,
    minScheduledEvents: 80,
    minAnchoredEvents: 10,
    minFlexEvents: 10,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 0.4,
    maxFoodRatio: 0.72,
  },
  "hamburg-hamburg": {
    minLocations: 550,
    minFood: 180,
    minCulture: 80,
    minScheduledEvents: 120,
    minAnchoredEvents: 20,
    minFlexEvents: 10,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 0.4,
    maxFoodRatio: 0.72,
  },
  muenchen: {
    minLocations: 500,
    minFood: 150,
    minCulture: 60,
    minScheduledEvents: 40,
    minAnchoredEvents: 5,
    minFlexEvents: 1,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 0.4,
    maxFoodRatio: 0.72,
  },
  koeln: {
    minLocations: 450,
    minFood: 150,
    minCulture: 50,
    minScheduledEvents: 0,
    minAnchoredEvents: 0,
    minFlexEvents: 0,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 1,
    maxFoodRatio: 0.75,
  },
  "frankfurt-am-main": {
    minLocations: 450,
    minFood: 150,
    minCulture: 50,
    minScheduledEvents: 0,
    minAnchoredEvents: 0,
    minFlexEvents: 0,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 1,
    maxFoodRatio: 0.75,
  },
  stuttgart: {
    minLocations: 450,
    minFood: 150,
    minCulture: 50,
    minScheduledEvents: 0,
    minAnchoredEvents: 0,
    minFlexEvents: 0,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 1,
    maxFoodRatio: 0.75,
  },
  duesseldorf: {
    minLocations: 450,
    minFood: 150,
    minCulture: 25,
    minScheduledEvents: 0,
    minAnchoredEvents: 0,
    minFlexEvents: 0,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 1,
    maxFoodRatio: 0.75,
  },
  leipzig: {
    minLocations: 450,
    minFood: 150,
    minCulture: 35,
    minScheduledEvents: 0,
    minAnchoredEvents: 0,
    minFlexEvents: 0,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 1,
    maxFoodRatio: 0.75,
  },
  dresden: {
    minLocations: 450,
    minFood: 150,
    minCulture: 40,
    minScheduledEvents: 0,
    minAnchoredEvents: 0,
    minFlexEvents: 0,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 1,
    maxFoodRatio: 0.75,
  },
  hannover: {
    minLocations: 350,
    minFood: 120,
    minCulture: 30,
    minScheduledEvents: 0,
    minAnchoredEvents: 0,
    minFlexEvents: 0,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 1,
    maxFoodRatio: 0.75,
  },
  nuernberg: {
    minLocations: 400,
    minFood: 120,
    minCulture: 35,
    minScheduledEvents: 0,
    minAnchoredEvents: 0,
    minFlexEvents: 0,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 1,
    maxFoodRatio: 0.75,
  },
  bremen: {
    minLocations: 450,
    minFood: 120,
    minCulture: 30,
    minScheduledEvents: 0,
    minAnchoredEvents: 0,
    minFlexEvents: 0,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 1,
    maxFoodRatio: 0.75,
  },
  dortmund: {
    minLocations: 450,
    minFood: 120,
    minCulture: 30,
    minScheduledEvents: 0,
    minAnchoredEvents: 0,
    minFlexEvents: 0,
    maxLocationDuplicateGroups: 10,
    maxEditorialRatio: 1,
    maxFoodRatio: 0.75,
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
    // Skip locations without coordinates — they can't be spatial duplicates
    // and would falsely cluster under "na|na" causing thousands of phantom groups.
    if (typeof loc.lat !== "number" || typeof loc.lng !== "number") continue;
    const category = classify(loc) ?? "other";
    const key = [
      norm(loc.name),
      category,
      loc.lat.toFixed(5),
      loc.lng.toFixed(5),
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildQualityScore(
  metrics: Omit<CityMetrics, "checks" | "qualityScore">
): number {
  const t = THRESHOLDS[metrics.citySlug];
  const { locations, events } = metrics;

  // Each component contributes up to its weight (total: 100).
  // minScheduledEvents of 0 means events are not required for this city tier.
  const locationScore = clamp(locations.plannable / t.minLocations, 0, 1) * 25;
  const foodScore = clamp(locations.food / t.minFood, 0, 1) * 15;
  const cultureScore = clamp(locations.culture / t.minCulture, 0, 1) * 10;
  const eventScore =
    t.minScheduledEvents > 0
      ? clamp(events.scheduled / t.minScheduledEvents, 0, 1) * 10
      : 10; // full points when not required
  const anchorScore =
    t.minAnchoredEvents > 0
      ? clamp(events.anchored / t.minAnchoredEvents, 0, 1) * 5
      : 5;
  const flexScore =
    t.minFlexEvents > 0 ? clamp(events.flex / t.minFlexEvents, 0, 1) * 5 : 5;
  const editorialScore =
    t.maxEditorialRatio < 1
      ? clamp(1 - events.editorialRatio / t.maxEditorialRatio, 0, 1) * 10
      : 10;
  const dedupScore =
    clamp(1 - locations.duplicateGroups / t.maxLocationDuplicateGroups, 0, 1) * 10;
  const diversityScore = locations.foodRatio <= t.maxFoodRatio ? 10 : 5;

  const raw =
    locationScore +
    foodScore +
    cultureScore +
    eventScore +
    anchorScore +
    flexScore +
    editorialScore +
    dedupScore +
    diversityScore;

  return Math.round(raw);
}

function buildChecks(
  metrics: Omit<CityMetrics, "checks" | "qualityScore">
): CityMetrics["checks"] {
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
      label: "Culture coverage",
      passed: metrics.locations.culture >= thresholds.minCulture,
      detail: `${metrics.locations.culture} >= ${thresholds.minCulture}`,
    },
    {
      label: "Food diversity (ratio)",
      passed: metrics.locations.foodRatio <= thresholds.maxFoodRatio,
      detail: `${(metrics.locations.foodRatio * 100).toFixed(1)}% <= ${(thresholds.maxFoodRatio * 100).toFixed(0)}%`,
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

function scoreEmoji(score: number) {
  if (score >= 85) return "🟢";
  if (score >= 65) return "🟡";
  return "🔴";
}

function buildMarkdownReport(metrics: CityMetrics[]) {
  const lines: string[] = [];
  const allChecks = metrics.flatMap((city) => city.checks);
  const passed = allChecks.filter((check) => check.passed).length;
  const avgScore = Math.round(
    metrics.reduce((sum, city) => sum + city.qualityScore, 0) / metrics.length
  );

  lines.push("# Planner Quality Check");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Checks passed: ${passed} / ${allChecks.length}`);
  lines.push(`Average quality score: ${avgScore}/100`);
  lines.push("");

  // Summary table
  lines.push("| City | Score | Locations | Food | Culture | Events | Missing Duration |");
  lines.push("|------|-------|-----------|------|---------|--------|-----------------|");
  for (const city of metrics) {
    lines.push(
      `| ${city.citySlug} | ${scoreEmoji(city.qualityScore)} ${city.qualityScore}/100 | ${city.locations.plannable} | ${city.locations.food} (${(city.locations.foodRatio * 100).toFixed(0)}%) | ${city.locations.culture} | ${city.events.scheduled} | ${city.locations.missingDuration} |`
    );
  }
  lines.push("");

  for (const city of metrics) {
    lines.push(`## ${scoreEmoji(city.qualityScore)} ${city.citySlug} — ${city.qualityScore}/100`);
    lines.push(
      `Locations: ${city.locations.plannable} plannable, ${city.locations.food} food (${(city.locations.foodRatio * 100).toFixed(0)}%), ${city.locations.culture} culture, ${city.locations.nightlife} nightlife — ${city.locations.missingDuration} missing duration_min`
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

    const foodCount = cityLocations.filter((row) => {
      const category = classify(row);
      return category === "restaurant" || category === "cafe";
    }).length;

    const baseMetrics = {
      citySlug,
      locations: {
        plannable: cityLocations.length,
        food: foodCount,
        culture: cityLocations.filter((row) => classify(row) === "culture").length,
        nightlife: cityLocations.filter((row) => classify(row) === "nightlife").length,
        duplicateGroups: locationDuplicateGroups(cityLocations),
        foodRatio: cityLocations.length > 0 ? foodCount / cityLocations.length : 0,
        missingDuration: cityLocations.filter((row) => row.duration_min == null).length,
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

    const qualityScore = buildQualityScore(baseMetrics);

    metrics.push({
      ...baseMetrics,
      qualityScore,
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

  const avgScore = Math.round(
    metrics.reduce((sum, city) => sum + city.qualityScore, 0) / metrics.length
  );
  const allChecks = metrics.flatMap((city) => city.checks);

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(
    `Quality checks passed: ${allChecks.filter((c) => c.passed).length} / ${allChecks.length}`
  );
  console.log(`Average quality score: ${avgScore}/100`);
  console.log("");
  for (const city of metrics) {
    const emoji = city.qualityScore >= 85 ? "🟢" : city.qualityScore >= 65 ? "🟡" : "🔴";
    const cityFails = city.checks.filter((c) => !c.passed).length;
    console.log(
      `  ${emoji} ${city.citySlug.padEnd(22)} ${String(city.qualityScore).padStart(3)}/100  missing-duration=${city.locations.missingDuration}  fails=${cityFails}`
    );
  }

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
