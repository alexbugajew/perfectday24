import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const BATCH_SIZE = 50;
const MAX_DISTANCE_M = 250;

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Sammle alle distinct city_slugs mit offenen Drafts.
  const slugCounts = new Map<string, number>();
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("location_manual_seeds")
      .select("city_slug")
      .eq("publish_status", "draft")
      .eq("is_active", true)
      .order("city_slug")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Draft scan failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) {
      const slug = (row as { city_slug: string }).city_slug;
      slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1);
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  const slugs = Array.from(slugCounts.keys()).sort();
  const totalDrafts = Array.from(slugCounts.values()).reduce((a, b) => a + b, 0);
  console.log(`${slugs.length} Städte mit offenen Drafts (${totalDrafts} total)\n`);

  let totalPublished = 0;
  let totalMerged = 0;
  let totalErrored = 0;

  for (const slug of slugs) {
    const expected = slugCounts.get(slug) ?? 0;
    let published = 0;
    let merged = 0;
    const t0 = Date.now();

    while (true) {
      const { data, error } = await supabase.rpc("pd24_publish_manual_seed_batch", {
        p_city_slug: slug,
        p_import_batch: null,
        p_limit: BATCH_SIZE,
        p_max_distance_m: MAX_DISTANCE_M,
      });
      if (error) {
        console.error(`  ${slug} FEHLER: ${error.message}`);
        totalErrored += 1;
        break;
      }
      const rows = (data ?? []) as Array<{ publish_status?: string | null }>;
      if (rows.length === 0) break;
      published += rows.filter((r) => r.publish_status === "published").length;
      merged += rows.filter((r) => r.publish_status === "merged").length;
      if (rows.length < BATCH_SIZE) break;
    }

    const ms = Date.now() - t0;
    totalPublished += published;
    totalMerged += merged;
    console.log(`  ${slug.padEnd(30)} ${published + merged} / ${expected} (${published} neu, ${merged} merged, ${ms}ms)`);
  }

  console.log("");
  console.log(`Summe: ${totalPublished} neu published, ${totalMerged} gemerged, ${totalErrored} Fehler`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
