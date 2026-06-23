import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PLANNER_33_ROLLOUT, PLANNER_VISIBILITY_GATES } from "../lib/cities/rollout";

function loadEnvFile(path: string) {
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function exactCount(
  supabase: any,
  table: "locations" | "location_manual_seeds",
  citySlug: string,
  options?: { foodOnly?: boolean; draftOnly?: boolean }
) {
  let query = supabase.from(table).select("*", { count: "exact", head: true }).eq("city_slug", citySlug);
  if (table === "locations") {
    query = query.eq("is_plannable", true);
    if (options?.foodOnly) query = query.in("type", ["restaurant", "cafe"]);
  }
  if (table === "location_manual_seeds") {
    query = query.eq("is_active", true);
    if (options?.draftOnly) query = query.eq("publish_status", "draft");
  }
  const { count, error } = await query;
  if (error) throw new Error(`${table} count failed for ${citySlug}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  loadEnvFile(join(process.cwd(), ".env.local"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const wave4 = PLANNER_33_ROLLOUT.filter((c) => c.stage === "wave4");

  console.log(`Wave 4 Status (${wave4.length} Städte)\n`);
  console.log("| City | Plannable | Food | Drafts | Gate |");
  console.log("| --- | ---: | ---: | ---: | --- |");

  let totalPlannable = 0;
  let totalFood = 0;
  let totalDrafts = 0;
  let pass = 0;
  let fail = 0;

  for (const city of wave4) {
    const [plannable, food, drafts] = await Promise.all([
      exactCount(supabase, "locations", city.slug),
      exactCount(supabase, "locations", city.slug, { foodOnly: true }),
      exactCount(supabase, "location_manual_seeds", city.slug, { draftOnly: true }),
    ]);

    totalPlannable += plannable;
    totalFood += food;
    totalDrafts += drafts;

    const passes =
      plannable >= PLANNER_VISIBILITY_GATES.minimumPlannableLocations &&
      food >= PLANNER_VISIBILITY_GATES.minimumFoodLocations;
    const gate = passes ? "PASS" : "FAIL";
    if (passes) pass++;
    else fail++;

    console.log(`| ${city.label} (${city.slug}) | ${plannable} | ${food} | ${drafts} | ${gate} |`);
  }

  console.log("");
  console.log(`Summe Plannable: ${totalPlannable}`);
  console.log(`Summe Food: ${totalFood}`);
  console.log(`Summe Drafts (offen): ${totalDrafts}`);
  console.log(`Gate-Status: ${pass} pass, ${fail} fail (mind ${PLANNER_VISIBILITY_GATES.minimumPlannableLocations} Locations + ${PLANNER_VISIBILITY_GATES.minimumFoodLocations} Food)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
