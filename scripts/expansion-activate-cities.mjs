// Setzt cities.is_active = true für alle planner-sichtbaren Rollout-Städte
// (kanonische Slugs + aliasSlugs). Der Planner filtert die Stadt-Suche mit
// .eq('is_active', true) VOR dem Rollout-Check — ohne dieses Flag tauchen
// sichtbare Städte < 100k Einw. nicht im Dropdown auf.
// Schreibt zusätzlich eine Versionierungs-Migration. Usage: [--dry]
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const env = {};
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const t = l.trim(); if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("="); if (i < 0) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const DRY = process.argv.includes("--dry");

// Sichtbare Slugs + Aliase aus dem kompilierten Rollout ziehen (Quelle der Wahrheit)
execSync("npx tsc -p tsconfig.scripts.json", { stdio: "pipe" });
const { PLANNER_VISIBLE_CITY_ROLLOUT } = await import("../.codex-scripts-dist/lib/cities/rollout.js");
const slugs = new Set();
for (const c of PLANNER_VISIBLE_CITY_ROLLOUT) {
  slugs.add(c.slug);
  for (const a of c.aliasSlugs ?? []) slugs.add(a);
}
console.log(`sichtbare Rollout-Städte inkl. Aliase: ${slugs.size} Slugs`);

const list = [...slugs];
let updated = 0;
for (let i = 0; i < list.length; i += 100) {
  const chunk = list.slice(i, i + 100);
  if (DRY) continue;
  const { data, error } = await sb.from("cities").update({ is_active: true }).in("slug", chunk).eq("is_active", false).select("slug");
  if (error) { console.error("chunk error:", error.message); process.exit(1); }
  updated += data?.length ?? 0;
}
console.log(DRY ? "[dry] keine Writes" : `is_active=true gesetzt für ${updated} Zeilen (Rest war schon aktiv)`);

const q = (s) => s.replace(/'/g, "''");
const sql = `-- cities.is_active = true für alle planner-sichtbaren Rollout-Städte (inkl. Aliase).
-- Der Planner filtert die Stadt-Suche mit is_active=true VOR dem Rollout-Check;
-- ohne Flag fehlen sichtbare Städte < 100k Einw. im Dropdown. Idempotent.

begin;

update public.cities set is_active = true
where slug in (
${list.map((s) => `  '${q(s)}'`).join(",\n")}
);

commit;
`;
writeFileSync("supabase/migrations/20260716120000_activate_visible_cities.sql", sql);
console.log("Migration geschrieben: supabase/migrations/20260716120000_activate_visible_cities.sql");
