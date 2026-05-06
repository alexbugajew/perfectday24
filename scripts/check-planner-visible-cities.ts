import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  PLANNER_VISIBLE_CITY_ROLLOUT,
  PLANNER_VISIBLE_CITY_SLUGS,
  PLANNER_VISIBILITY_GATES,
} from "../lib/cities/rollout";
import {
  OFFICIAL_SOURCE_ROADMAP,
  type OfficialSourceRoadmapEntry,
} from "../lib/events/official/source-roadmap";

type VisibleCityAuditRow = {
  citySlug: string;
  label: string;
  locations: number;
  foodLocations: number;
  scheduledEvents: number;
  activeOfficialProviders: string[];
  roadmapProvider: string | null;
  roadmapStatus: OfficialSourceRoadmapEntry["rolloutStatus"] | "missing";
  roadmapPriority: number | null;
  passesVisibilityGate: boolean;
  gateSummary: string;
};

type PriorityCandidate = VisibleCityAuditRow & {
  reason: string;
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
    throw new Error("Missing Supabase env vars for visible city audit.");
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function exactCount(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: "locations" | "planner_events",
  citySlug: string,
  options?: { foodOnly?: boolean }
) {
  let query = supabase.from(table).select("*", { count: "exact", head: true }).eq("city_slug", citySlug);
  if (table === "locations") {
    query = query.eq("is_plannable", true);
    if (options?.foodOnly) {
      query = query.in("type", ["restaurant", "cafe"]);
    }
  }
  if (table === "planner_events") {
    query = query.eq("status", "scheduled");
  }
  const { count, error } = await query;
  if (error) {
    throw new Error(`${table} count failed for ${citySlug}: ${error.message}`);
  }
  return count ?? 0;
}

function buildMarkdown(rows: VisibleCityAuditRow[], priorities: PriorityCandidate[]) {
  const lines: string[] = [];
  lines.push("# Planner Visible City Audit");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Visible Planner Cities");
  lines.push("");
  lines.push("| City | Locations | Food | Scheduled events | Active official providers | Gate | Roadmap status |");
  lines.push("| --- | ---: | ---: | ---: | --- | --- | --- |");
  for (const row of rows) {
    lines.push(
      `| ${row.label} (\`${row.citySlug}\`) | ${row.locations} | ${row.foodLocations} | ${row.scheduledEvents} | ${
        row.activeOfficialProviders.join(", ") || "-"
      } | ${row.gateSummary} | ${row.roadmapStatus} |`
    );
  }
  lines.push("");
  lines.push("## Sichtbarkeits-Gates");
  lines.push("");
  lines.push(`- mindestens ${PLANNER_VISIBILITY_GATES.minimumPlannableLocations} plannable Locations`);
  lines.push(`- mindestens ${PLANNER_VISIBILITY_GATES.minimumFoodLocations} Food-Locations (Restaurant/Cafe)`);
  lines.push(`- mindestens ${PLANNER_VISIBILITY_GATES.minimumScheduledEvents} geplante Events`);
  lines.push(
    `- ${PLANNER_VISIBILITY_GATES.requiresActiveOfficialEventSource ? "aktive offizielle Eventquelle erforderlich" : "offizielle Eventquelle empfohlen"}`
  );
  lines.push("");
  lines.push("## Prioritized Event Gaps");
  lines.push("");
  if (priorities.length === 0) {
    lines.push("No visible planner cities without events.");
  } else {
    lines.push("| Priority | City | Roadmap provider | Status | Reason |");
    lines.push("| ---: | --- | --- | --- | --- |");
    priorities.forEach((row, index) => {
      lines.push(
        `| ${index + 1} | ${row.citySlug} | ${row.roadmapProvider ?? "-"} | ${row.roadmapStatus} | ${row.reason} |`
      );
    });
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  loadEnvFile(join(process.cwd(), ".env.local"));
  const supabase = getSupabaseAdmin();
  const visibleCities = [...PLANNER_VISIBLE_CITY_ROLLOUT];

  const { data: sourceConfigs, error: sourceConfigError } = await supabase
    .from("event_source_configs")
    .select("provider, city_slug, is_active");

  if (sourceConfigError) {
    throw new Error(`event_source_configs failed: ${sourceConfigError.message}`);
  }

  const activeProvidersByCity = new Map<string, string[]>();
  for (const row of sourceConfigs ?? []) {
    if (!row?.city_slug || !row?.provider || row?.is_active !== true) continue;
    const bucket = activeProvidersByCity.get(row.city_slug) ?? [];
    bucket.push(row.provider);
    activeProvidersByCity.set(row.city_slug, bucket);
  }

  const roadmapByCity = new Map(
    OFFICIAL_SOURCE_ROADMAP.map((entry) => [entry.citySlug, entry] satisfies [string, OfficialSourceRoadmapEntry])
  );

  const rows: VisibleCityAuditRow[] = [];

  for (const city of visibleCities) {
    const [locations, foodLocations, scheduledEvents] = await Promise.all([
      exactCount(supabase, "locations", city.slug),
      exactCount(supabase, "locations", city.slug, { foodOnly: true }),
      exactCount(supabase, "planner_events", city.slug),
    ]);

    const roadmap = roadmapByCity.get(city.slug);
    const activeOfficialProviders = activeProvidersByCity.get(city.slug) ?? [];
    const passesVisibilityGate =
      locations >= PLANNER_VISIBILITY_GATES.minimumPlannableLocations &&
      foodLocations >= PLANNER_VISIBILITY_GATES.minimumFoodLocations &&
      scheduledEvents >= PLANNER_VISIBILITY_GATES.minimumScheduledEvents &&
      (!PLANNER_VISIBILITY_GATES.requiresActiveOfficialEventSource || activeOfficialProviders.length > 0);
    const gateSummary = passesVisibilityGate
      ? "passed"
      : [
          locations < PLANNER_VISIBILITY_GATES.minimumPlannableLocations ? "locations" : null,
          foodLocations < PLANNER_VISIBILITY_GATES.minimumFoodLocations ? "food" : null,
          scheduledEvents < PLANNER_VISIBILITY_GATES.minimumScheduledEvents ? "events" : null,
          PLANNER_VISIBILITY_GATES.requiresActiveOfficialEventSource && activeOfficialProviders.length === 0
            ? "official-source"
            : null,
        ]
          .filter(Boolean)
          .join(", ");
    rows.push({
      citySlug: city.slug,
      label: city.label,
      locations,
      foodLocations,
      scheduledEvents,
      activeOfficialProviders,
      roadmapProvider: roadmap?.provider ?? null,
      roadmapStatus: roadmap?.rolloutStatus ?? "missing",
      roadmapPriority: roadmap?.priority ?? null,
      passesVisibilityGate,
      gateSummary,
    });
  }

  const priorities = rows
    .filter((row) => row.scheduledEvents === 0)
    .map((row) => ({
      ...row,
      reason:
        row.roadmapStatus === "verified_candidate"
          ? "sichtbar, aber ohne Eventdaten; offizieller Einstieg ist bereits parserfreundlich verifiziert"
          : row.roadmapStatus === "domain_verified"
            ? "sichtbar, aber ohne Eventdaten; offizielle Domain ist klar, Listing-Pfad braucht noch Parser-Finalisierung"
            : row.roadmapStatus === "research_pending"
              ? "sichtbar, aber ohne Eventdaten; offizieller Kalenderpfad muss noch verifiziert werden"
              : "sichtbar, aber ohne Eventdaten; noch kein Roadmap-Eintrag vorhanden",
    }))
    .sort((a, b) => {
      const order = (value: PriorityCandidate["roadmapStatus"]) =>
        value === "verified_candidate" ? 0 : value === "domain_verified" ? 1 : value === "research_pending" ? 2 : 3;
      return order(a.roadmapStatus) - order(b.roadmapStatus) || (a.roadmapPriority ?? 999) - (b.roadmapPriority ?? 999);
    });

  const outDir = join(process.cwd(), "reports");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = join(outDir, `planner-visible-city-audit-${stamp}.json`);
  const mdPath = join(outDir, `planner-visible-city-audit-${stamp}.md`);

  writeFileSync(
    jsonPath,
    JSON.stringify({ rows, priorities }, null, 2),
    "utf8"
  );
  writeFileSync(mdPath, buildMarkdown(rows, priorities), "utf8");

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Visible planner cities: ${PLANNER_VISIBLE_CITY_SLUGS.length}`);
  console.log(`Cities without event data: ${priorities.length}`);
  for (const priority of priorities) {
    console.log(`- ${priority.citySlug}: ${priority.roadmapStatus} (${priority.roadmapProvider ?? "no-provider"})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
