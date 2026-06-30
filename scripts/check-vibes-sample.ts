import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

async function main() {
  loadEnvFile(join(process.cwd(), ".env.local"));
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("locations")
    .select("name,type,category,tags,quality_score")
    .eq("city_slug", "muenchen")
    .eq("is_plannable", true)
    .not("tags", "is", null)
    .order("quality_score", { ascending: false, nullsFirst: false })
    .limit(20);
  if (error) throw new Error(error.message);
  console.log("Top 20 München-Locations + Vibe-Tags:\n");
  for (const row of data ?? []) {
    console.log(
      `  ${row.name} [${row.category ?? row.type}] · qs=${row.quality_score ?? "?"} → ${(row.tags ?? []).join(", ")}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
