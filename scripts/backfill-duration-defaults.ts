import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  buildLocationSearchText,
  classify,
  classifyActivitySubkind,
  resolveMeal,
} from "../lib/planner";
import type { LocationRow } from "../lib/planner/types";

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
  if (!url || !serviceRole) throw new Error("Missing Supabase env vars.");
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function computeDefaultDuration(loc: LocationRow): number {
  const category = classify(loc);
  const text = buildLocationSearchText(loc);
  const has = (...words: string[]) => words.some((w) => text.includes(w));

  switch (category) {
    case "cafe":
      if (has("brunch")) return 60;
      return 45;

    case "restaurant": {
      const meal = resolveMeal(loc);
      if (meal === "breakfast") return 45;
      if (meal === "dinner") return 90;
      return 60;
    }

    case "nightlife":
      // Bars and pubs: shorter stay. Clubs/discos: longer.
      if (has("bar", "rooftop", "cocktail", "pub", "kneipe", "biergarten")) return 90;
      return 150;

    case "culture": {
      if (has("museum", "ausstellung", "exhibition")) return 90;
      if (has("galerie", "gallery")) return 50;
      if (has("kino", "cinema", "film")) return 120;
      if (has("theater", "theatre", "oper", "opera")) return 120;
      if (has("aquarium", "planetarium")) return 90;
      if (has("schloss", "castle", "burg", "altstadt", "old town")) return 60;
      // Quick landmark visits
      if (has("denkmal", "monument", "memorial", "viewpoint", "aussicht", "kirche", "church")) {
        return 20;
      }
      return 60;
    }

    case "activity": {
      const subkind = classifyActivitySubkind(loc);
      switch (subkind) {
        case "museum":
          return 90;
        case "landmark":
          return 25;
        case "park":
          return 45;
        case "walk":
          return 30;
        case "wellness":
          return 120;
        case "sport":
          return 90;
        case "workshop":
          return 120;
        case "water":
          return 120;
        case "family":
          return 120;
        case "nightclub":
          return 150;
        default:
          return 60;
      }
    }

    case "event":
      return 120;

    default:
      return 60;
  }
}

async function fetchAllRows<T>(
  fetchPage: (
    from: number,
    to: number
  ) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function main() {
  loadEnvFile(join(process.cwd(), ".env.local"));
  const supabase = getSupabaseAdmin();
  const dryRun = process.argv.includes("--dry-run");

  console.log(`Mode: ${dryRun ? "DRY RUN (pass --live to write)" : "LIVE"}`);

  const locations = await fetchAllRows<LocationRow>(async (from, to) =>
    supabase
      .from("locations")
      .select("*")
      .eq("is_plannable", true)
      .is("duration_min", null)
      .range(from, to)
  );

  console.log(`Plannable locations without duration_min: ${locations.length}`);

  const updates = locations.map((loc) => ({
    id: loc.id,
    duration_min: computeDefaultDuration(loc),
  }));

  // Distribution summary
  const byDuration = new Map<number, number>();
  for (const u of updates) {
    byDuration.set(u.duration_min, (byDuration.get(u.duration_min) ?? 0) + 1);
  }
  console.log("Duration distribution to be written:");
  for (const [d, count] of [...byDuration.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${String(d).padStart(3)} min → ${count} locations`);
  }

  if (dryRun) {
    console.log("\nDry run — no changes written. Pass --live to apply.");
    return;
  }

  const BATCH = 200;
  let updated = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    const { error } = await supabase.from("locations").upsert(batch, { onConflict: "id" });
    if (error) throw new Error(`Batch at offset ${i}: ${error.message}`);
    updated += batch.length;
    process.stdout.write(`\rUpdated ${updated} / ${updates.length}`);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
