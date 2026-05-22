/**
 * dedup-plannable-locations.ts
 *
 * Identifies plannable locations that are exact duplicates
 * (same name + category + lat/lng rounded to 5 decimal places ≈ 1 m).
 *
 * For each duplicate group the "best" record is kept (highest quality_score,
 * then highest rating_count, then lexicographically smallest id).
 * All others are marked is_plannable = false — no rows are deleted.
 *
 * Usage:
 *   npm run locations:dedup               # dry run (default)
 *   npm run locations:dedup -- --live     # write to DB
 *   npm run locations:dedup -- --city=berlin-berlin --live
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { classify, norm } from "../lib/planner";
import type { LocationRow } from "../lib/planner/types";

// ─── env / client ────────────────────────────────────────────────────────────

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

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error("Missing Supabase env vars.");
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─── pagination helper ────────────────────────────────────────────────────────

async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const PAGE = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

// ─── duplicate detection ──────────────────────────────────────────────────────

type ScoredRow = LocationRow & { _groupKey: string };

function groupKey(loc: LocationRow): string | null {
  if (typeof loc.lat !== "number" || typeof loc.lng !== "number") return null;
  const category = classify(loc) ?? "other";
  return [norm(loc.name), category, loc.lat.toFixed(5), loc.lng.toFixed(5)].join("|");
}

/** Pick the record to keep within a duplicate group. */
function pickWinner(group: LocationRow[]): string {
  return group.slice().sort((a, b) => {
    // 1. Higher quality_score wins
    const qA = a.quality_score ?? 0;
    const qB = b.quality_score ?? 0;
    if (qB !== qA) return qB - qA;
    // 2. Higher rating_count wins
    const rA = a.rating_count ?? 0;
    const rB = b.rating_count ?? 0;
    if (rB !== rA) return rB - rA;
    // 3. Lexicographically smaller id (first ingested) wins
    return a.id < b.id ? -1 : 1;
  })[0].id;
}

function findDuplicates(locations: LocationRow[]): Map<string, LocationRow[]> {
  const byKey = new Map<string, LocationRow[]>();
  for (const loc of locations) {
    const key = groupKey(loc);
    if (!key) continue;
    const existing = byKey.get(key);
    if (existing) existing.push(loc);
    else byKey.set(key, [loc]);
  }
  // Only return groups with more than one entry
  const dupes = new Map<string, LocationRow[]>();
  for (const [key, group] of byKey) {
    if (group.length > 1) dupes.set(key, group);
  }
  return dupes;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  loadEnvFile(join(process.cwd(), ".env.local"));
  const supabase = getSupabaseAdmin();

  const args = process.argv.slice(2);
  const live = args.includes("--live");
  const cityArg = args.find((a) => a.startsWith("--city="))?.replace("--city=", "");

  console.log(`Mode: ${live ? "LIVE — changes will be written" : "DRY RUN (pass --live to write)"}`);
  if (cityArg) console.log(`Scope: city_slug = ${cityArg}`);
  else console.log("Scope: all plannable locations");
  console.log("");

  // Fetch
  const locations = await fetchAllRows<LocationRow>(async (from, to) => {
    let q = supabase
      .from("locations")
      .select("*")
      .eq("is_plannable", true)
      .range(from, to);
    if (cityArg) q = q.eq("city_slug", cityArg);
    return q;
  });

  console.log(`Fetched ${locations.length} plannable locations`);

  // Group by city for reporting
  const byCitySlug = new Map<string, LocationRow[]>();
  for (const loc of locations) {
    const slug = loc.city_slug ?? "__unknown__";
    const list = byCitySlug.get(slug);
    if (list) list.push(loc);
    else byCitySlug.set(slug, [loc]);
  }

  const toDeactivate: string[] = [];

  for (const [citySlug, cityLocs] of [...byCitySlug.entries()].sort()) {
    const dupes = findDuplicates(cityLocs);
    let cityDeactivate = 0;
    for (const group of dupes.values()) {
      const winnerId = pickWinner(group);
      for (const loc of group) {
        if (loc.id !== winnerId) {
          toDeactivate.push(loc.id);
          cityDeactivate++;
        }
      }
    }
    if (dupes.size > 0) {
      console.log(
        `  ${citySlug}: ${dupes.size} duplicate groups → ${cityDeactivate} records to deactivate`
      );
    }
  }

  console.log("");
  console.log(`Total to deactivate: ${toDeactivate.length} locations`);

  if (!live) {
    console.log("\nDry run — no changes written. Pass --live to apply.");
    return;
  }

  if (toDeactivate.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  // Batch update: set is_plannable = false for all duplicates
  const BATCH = 200;
  let done = 0;
  for (let i = 0; i < toDeactivate.length; i += BATCH) {
    const batch = toDeactivate.slice(i, i + BATCH);
    const { error } = await supabase
      .from("locations")
      .update({ is_plannable: false })
      .in("id", batch);
    if (error) throw new Error(`Batch at offset ${i}: ${error.message}`);
    done += batch.length;
    process.stdout.write(`\rDeactivated ${done} / ${toDeactivate.length}`);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
