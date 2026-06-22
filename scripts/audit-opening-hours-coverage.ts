import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PLANNER_33_ROLLOUT } from "../lib/cities/rollout";

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

async function exactCount(
  supabase: ReturnType<typeof createClient>,
  citySlug: string,
  filter?: "with_hours" | "without_hours"
) {
  let q = supabase
    .from("locations")
    .select("*", { count: "exact", head: true })
    .eq("city_slug", citySlug)
    .eq("is_plannable", true);
  if (filter === "with_hours") q = q.not("opening_hours_raw", "is", null);
  if (filter === "without_hours") q = q.is("opening_hours_raw", null);
  const { count, error } = await q;
  if (error) throw new Error(`count failed for ${citySlug}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  loadEnvFile(join(process.cwd(), ".env.local"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Coverage opening_hours_raw über 78 Städte\n`);
  console.log("| City | Total | mit hours | ohne hours | Coverage |");
  console.log("| --- | ---: | ---: | ---: | ---: |");

  let grandTotal = 0;
  let grandWith = 0;

  for (const city of PLANNER_33_ROLLOUT) {
    const [total, withHours] = await Promise.all([
      exactCount(supabase, city.slug),
      exactCount(supabase, city.slug, "with_hours"),
    ]);
    grandTotal += total;
    grandWith += withHours;
    const pct = total > 0 ? Math.round((withHours / total) * 100) : 0;
    console.log(`| ${city.label} | ${total} | ${withHours} | ${total - withHours} | ${pct}% |`);
  }

  console.log("");
  const overallPct = grandTotal > 0 ? Math.round((grandWith / grandTotal) * 100) : 0;
  console.log(`Gesamt: ${grandWith} / ${grandTotal} (${overallPct}%)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
