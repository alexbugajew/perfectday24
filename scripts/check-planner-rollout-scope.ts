import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  PLANNER_33_ROLLOUT,
  PLANNER_VISIBLE_CITY_ROLLOUT,
  PLANNER_VISIBILITY_GATES,
  getVisibilityGatesForStage,
  type PlannerRolloutCity,
  type PlannerRolloutStage,
} from "../lib/cities/rollout";
import {
  OFFICIAL_SOURCE_ROADMAP,
  type OfficialSourceRoadmapEntry,
} from "../lib/events/official/source-roadmap";

type RolloutScope = PlannerRolloutStage | "visible" | "prepared" | "all";

type RolloutAuditRow = {
  citySlug: string;
  label: string;
  stage: PlannerRolloutCity["stage"];
  readinessTier: PlannerRolloutCity["readinessTier"];
  plannerVisibility: PlannerRolloutCity["plannerVisibility"];
  locations: number;
  foodLocations: number;
  scheduledEvents: number;
  activeOfficialProviders: string[];
  roadmapProvider: string | null;
  roadmapStatus: OfficialSourceRoadmapEntry["rolloutStatus"] | "missing";
  passesVisibilityGate: boolean;
  gateSummary: string;
  nextStep: string;
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

function parseArg(name: string) {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("Missing Supabase env vars for rollout scope audit.");
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

function resolveScope(scope: RolloutScope) {
  if (scope === "visible") return [...PLANNER_VISIBLE_CITY_ROLLOUT];
  if (scope === "prepared") return PLANNER_33_ROLLOUT.filter((city) => city.plannerVisibility === "hidden");
  if (scope === "all") return [...PLANNER_33_ROLLOUT];
  return PLANNER_33_ROLLOUT.filter((city) => city.stage === scope);
}

function normalizeScope(value: string | null): RolloutScope {
  const normalized = (value ?? "visible").trim().toLowerCase();
  if (
    normalized === "core" ||
    normalized === "top10" ||
    normalized === "wave1" ||
    normalized === "wave2" ||
    normalized === "wave3" ||
    normalized === "wave4" ||
    normalized === "wave5" ||
    normalized === "wave6" ||
    normalized === "prepared" ||
    normalized === "all"
  ) {
    return normalized;
  }
  return "visible";
}

function nextStepForRow(row: Omit<RolloutAuditRow, "nextStep">) {
  if (row.passesVisibilityGate) {
    return row.plannerVisibility === "visible" ? "sichtbar halten" : "für Sichtbarkeit prüfen";
  }
  if (row.locations < PLANNER_VISIBILITY_GATES.minimumPlannableLocations) {
    return "Location-Basis ausbauen";
  }
  if (row.foodLocations < PLANNER_VISIBILITY_GATES.minimumFoodLocations) {
    return "Food-Backfill";
  }
  if (row.scheduledEvents < PLANNER_VISIBILITY_GATES.minimumScheduledEvents) {
    return "offizielle Eventquelle aufbauen";
  }
  if (row.activeOfficialProviders.length === 0) {
    return "offizielle Quelle aktivieren";
  }
  return "Planner-Livecheck und Qualitätsprüfung";
}

function buildMarkdown(scope: RolloutScope, rows: RolloutAuditRow[]) {
  const lines: string[] = [];
  lines.push(`# Planner Rollout Scope Audit: ${scope}`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("| City | Stage | Visibility | Locations | Food | Events | Providers | Roadmap | Gate | Next step |");
  lines.push("| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |");
  for (const row of rows) {
    lines.push(
      `| ${row.label} (\`${row.citySlug}\`) | ${row.stage} | ${row.plannerVisibility} | ${row.locations} | ${row.foodLocations} | ${row.scheduledEvents} | ${
        row.activeOfficialProviders.join(", ") || "-"
      } | ${row.roadmapProvider ? `\`${row.roadmapProvider}\` / ${row.roadmapStatus}` : row.roadmapStatus} | ${row.gateSummary} | ${row.nextStep} |`
    );
  }
  lines.push("");
  lines.push("## Sichtbarkeits-Gates");
  lines.push("");
  lines.push(`- mindestens ${PLANNER_VISIBILITY_GATES.minimumPlannableLocations} plannable Locations`);
  lines.push(`- mindestens ${PLANNER_VISIBILITY_GATES.minimumFoodLocations} Food-Locations`);
  lines.push(`- mindestens ${PLANNER_VISIBILITY_GATES.minimumScheduledEvents} geplante Events`);
  lines.push(
    `- ${PLANNER_VISIBILITY_GATES.requiresActiveOfficialEventSource ? "aktive offizielle Eventquelle erforderlich" : "offizielle Eventquelle empfohlen"}`
  );
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const scope = normalizeScope(parseArg("scope"));
  loadEnvFile(join(process.cwd(), ".env.local"));
  const supabase = getSupabaseAdmin();
  const rolloutCities = resolveScope(scope);

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

  const rows: RolloutAuditRow[] = [];

  for (const city of rolloutCities) {
    const [locations, foodLocations, scheduledEvents] = await Promise.all([
      exactCount(supabase, "locations", city.slug),
      exactCount(supabase, "locations", city.slug, { foodOnly: true }),
      exactCount(supabase, "planner_events", city.slug),
    ]);
    const roadmap = roadmapByCity.get(city.slug);
    const activeOfficialProviders = activeProvidersByCity.get(city.slug) ?? [];
    const roadmapStatus: RolloutAuditRow["roadmapStatus"] = roadmap?.rolloutStatus ?? "missing";
    // Stage-abhängige Gates: wave5/wave6 werden über die Location-Basis
    // sichtbar (Event-Gate entfällt), Kernwellen behalten die vollen Gates.
    const gates = getVisibilityGatesForStage(city.stage);
    const passesVisibilityGate =
      locations >= gates.minimumPlannableLocations &&
      foodLocations >= gates.minimumFoodLocations &&
      scheduledEvents >= gates.minimumScheduledEvents &&
      (!gates.requiresActiveOfficialEventSource || activeOfficialProviders.length > 0);
    const gateSummary = passesVisibilityGate
      ? "passed"
      : [
          locations < gates.minimumPlannableLocations ? "locations" : null,
          foodLocations < gates.minimumFoodLocations ? "food" : null,
          scheduledEvents < gates.minimumScheduledEvents ? "events" : null,
          gates.requiresActiveOfficialEventSource && activeOfficialProviders.length === 0
            ? "official-source"
            : null,
        ]
          .filter(Boolean)
          .join(", ");

    const baseRow = {
      citySlug: city.slug,
      label: city.label,
      stage: city.stage,
      readinessTier: city.readinessTier,
      plannerVisibility: city.plannerVisibility,
      locations,
      foodLocations,
      scheduledEvents,
      activeOfficialProviders,
      roadmapProvider: roadmap?.provider ?? null,
      roadmapStatus,
      passesVisibilityGate,
      gateSummary,
    };

    rows.push({
      ...baseRow,
      nextStep: nextStepForRow(baseRow),
    });
  }

  const outDir = join(process.cwd(), "reports");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = join(outDir, `planner-rollout-${scope}-audit-${stamp}.json`);
  const mdPath = join(outDir, `planner-rollout-${scope}-audit-${stamp}.md`);

  writeFileSync(jsonPath, JSON.stringify({ scope, rows }, null, 2), "utf8");
  writeFileSync(mdPath, buildMarkdown(scope, rows), "utf8");

  const passed = rows.filter((row) => row.passesVisibilityGate).length;
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Scope ${scope}: ${rows.length} cities`);
  console.log(`Visibility-ready: ${passed}/${rows.length}`);
  for (const row of rows.filter((entry) => !entry.passesVisibilityGate)) {
    console.log(`- ${row.citySlug}: ${row.gateSummary} -> ${row.nextStep}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
