// Debug-Skript: schaut sich die München-Familien-Aktivitäten in der DB an.
// Zeigt Top-Kandidaten pro Kategorie + Subtype-Coverage.

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
    .select("id,name,type,category,quality_score,importance_score,popularity_score,manual_boost,family_friendly,tags,opening_hours_raw")
    .eq("city_slug", "muenchen")
    .eq("is_plannable", true)
    .in("category", ["culture", "activity"])
    .order("quality_score", { ascending: false, nullsFirst: false })
    .order("manual_boost", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);

  console.log("Top-30 culture/activity in München nach quality_score:\n");
  console.log(
    "| Name | Cat | Type | QS | IS | PS | MB | family | tags |"
  );
  console.log("| --- | --- | --- | ---: | ---: | ---: | ---: | :-: | --- |");
  for (const r of data ?? []) {
    const tags = (r.tags ?? []).slice(0, 4).join(",");
    console.log(
      `| ${r.name} | ${r.category} | ${r.type} | ${r.quality_score ?? "-"} | ${r.importance_score ?? "-"} | ${r.popularity_score ?? "-"} | ${r.manual_boost ?? "-"} | ${r.family_friendly ? "✓" : ""} | ${tags} |`
    );
  }

  // Kritische Aktivitäten für Familien
  console.log("\n\nSpezifische Familien-Alternativen in München (Suchbegriffe):\n");
  const searchTerms = [
    "escape",
    "bowling",
    "schwimm",
    "kart",
    "kletter",
    "trampolin",
    "lasertag",
    "zoo",
    "minigolf",
    "wildpark",
    "aquarium",
    "planetarium",
    "kindermus",
    "spielplatz",
    "ninja",
    "jump",
  ];
  for (const term of searchTerms) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (sb as any)
      .from("locations")
      .select("*", { count: "exact", head: true })
      .eq("city_slug", "muenchen")
      .eq("is_plannable", true)
      .ilike("name", `%${term}%`);
    console.log(`  ${term}: ${count ?? 0}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
