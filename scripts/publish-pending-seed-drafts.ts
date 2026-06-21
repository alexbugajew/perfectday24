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
  console.log("Scan offene Drafts ...");
  while (true) {
    const t = Date.now();
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
    console.log(`  page offset=${offset}: ${data.length} rows in ${Date.now() - t}ms`);
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
    let batchNum = 0;
    let zeroProgressStreak = 0;
    const t0 = Date.now();
    console.log(`Starte ${slug} (${expected} Drafts erwartet)`);

    while (true) {
      batchNum++;
      const tBatch = Date.now();
      let data: Array<{ publish_status?: string | null }> | null = null;
      let lastError: string | null = null;

      // Retry mit Backoff bei transient errors (fetch failed, network reset, etc).
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await supabase.rpc("pd24_publish_manual_seed_batch", {
            p_city_slug: slug,
            p_import_batch: null,
            p_limit: BATCH_SIZE,
            p_max_distance_m: MAX_DISTANCE_M,
          });
          if (res.error) {
            lastError = res.error.message;
            if (!res.error.message.includes("fetch")) break; // non-transient → abort
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
          data = res.data as Array<{ publish_status?: string | null }>;
          lastError = null;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }

      if (lastError && !data) {
        console.error(`  ${slug} Batch ${batchNum} FEHLER nach 3 Retries: ${lastError}`);
        totalErrored += 1;
        break;
      }

      const rows = data ?? [];
      if (rows.length === 0) break;
      const batchPublished = rows.filter((r) => r.publish_status === "published").length;
      const batchMerged = rows.filter((r) => r.publish_status === "merged").length;
      published += batchPublished;
      merged += batchMerged;

      // Safety: wenn 5 Batches in Folge nichts published, bricht ab.
      // Verhindert Endlos-Loop wenn die SQL-Function alle Seeds als
      // "draft" zurückgibt (z.B. NOT NULL constraint violations werden
      // vom batch-wrapper geschluckt, Seed bleibt im draft state).
      if (batchPublished + batchMerged === 0) {
        zeroProgressStreak += 1;
        if (zeroProgressStreak >= 5) {
          console.error(`  ${slug} Batch ${batchNum} ABBRUCH: 5 Batches in Folge ohne Progress (vermutlich Constraint-Violation, Seeds bleiben im draft state)`);
          break;
        }
      } else {
        zeroProgressStreak = 0;
      }

      // Heartbeat alle 10 Batches
      if (batchNum % 10 === 0) {
        console.log(`  batch ${batchNum}: ${published + merged} progress (${Date.now() - tBatch}ms last)`);
      }

      if (rows.length < BATCH_SIZE) break;
    }

    const ms = Date.now() - t0;
    totalPublished += published;
    totalMerged += merged;
    console.log(`  FERTIG ${slug}: ${published + merged} / ${expected} (${published} neu, ${merged} merged, ${ms}ms)\n`);
  }

  console.log("");
  console.log(`Summe: ${totalPublished} neu published, ${totalMerged} gemerged, ${totalErrored} Fehler`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
