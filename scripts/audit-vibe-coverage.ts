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

const VIBE_WHITELIST = new Set([
  "romantic","intimate","refined","hip","casual","cozy","lively","elegant","dive",
  "kid-friendly","family-friendly","date-friendly","group-friendly","solo-friendly","tourist-classic",
  "live-music","outdoor","view","iconic","hidden-gem","instagrammable",
  "quick","long-stay","late-night","breakfast-spot",
]);

async function main() {
  loadEnvFile(join(process.cwd(), ".env.local"));
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  console.log("Vibe-Coverage Top-300 Locations pro Stadt:\n");
  console.log("| City | Top-300 mit Vibe | Coverage |");
  console.log("| --- | ---: | ---: |");

  let cumulTotal = 0;
  let cumulWithVibe = 0;
  for (const city of PLANNER_33_ROLLOUT) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb as any)
      .from("locations")
      .select("id,tags")
      .eq("city_slug", city.slug)
      .eq("is_plannable", true)
      .order("quality_score", { ascending: false, nullsFirst: false })
      // Gleicher Tiebreaker wie im Classify-Script — sonst vergleichen beide
      // Scripts verschiedene Top-300-Teilmengen (flache Scores im Manual-Seed).
      .order("id", { ascending: true })
      .limit(300);
    if (error) {
      console.log(`| ${city.slug} | ERROR | — |`);
      continue;
    }
    const rows = (data ?? []) as Array<{ id: string; tags: string[] | null }>;
    const total = rows.length;
    const withVibe = rows.filter((r) =>
      (r.tags ?? []).some((t) => VIBE_WHITELIST.has(t))
    ).length;
    cumulTotal += total;
    cumulWithVibe += withVibe;
    const pct = total > 0 ? Math.round((withVibe / total) * 100) : 0;
    console.log(`| ${city.slug} | ${withVibe}/${total} | ${pct}% |`);
  }
  const grandPct = cumulTotal > 0 ? Math.round((cumulWithVibe / cumulTotal) * 100) : 0;
  console.log(`\n**Gesamt:** ${cumulWithVibe}/${cumulTotal} (${grandPct}%)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
