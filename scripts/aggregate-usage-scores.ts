// KI-Qualitäts-Loop Stufe 2: Nutzungssignal aus Plan-Auswahlen aggregieren.
// ============================================================================
// Liest ai_plan_applied- und plan_save-Events (rollierendes Fenster, default
// 90 Tage), zählt Auswahlen pro Location und schreibt ein gedämpftes
// usage_score auf locations. Der Planner mischt es mit halbem Gewicht ins
// Quality-Scoring (lib/planner/scoring.ts).
//
// Dämpfung gegen Rauschen:
//   - Mindestschwelle: erst ab --min Auswahlen (default 5) fließt eine
//     Location ein — Pre-Launch-Testklicks bewegen nichts.
//   - Log-Skala: usage_score = min(40, round(8 * ln(1 + count)))
//     (5 Auswahlen -> 14, 10 -> 19, 50 -> 31, Cap 40).
//   - Locations, die aus dem Fenster fallen, werden auf 0 zurückgesetzt.
//
// Schema-Drift-Guard: Existiert die usage_score-Spalte noch nicht (Migration
// 20260731120000 nicht angewandt), beendet sich der Lauf sauber mit Hinweis —
// der Cron wird dadurch nicht rot.
//
// Usage: node .codex-scripts-dist/scripts/aggregate-usage-scores.js
//        [--days=90] [--min=5] [--dry-run]

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path: string) {
  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return;
  }
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

function parseArg(name: string) {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen.");
  process.exit(1);
}

const WINDOW_DAYS = parseArg("days") ? Number(parseArg("days")) : 90;
const MIN_SELECTIONS = parseArg("min") ? Number(parseArg("min")) : 5;
const DRY_RUN = process.argv.includes("--dry-run");
const SCORE_CAP = 40;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function usageScoreFor(count: number) {
  return Math.min(SCORE_CAP, Math.round(8 * Math.log(1 + count)));
}

async function fetchAllRows<T>(
  queryPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
) {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryPage(from, from + pageSize - 1);
    if (error) {
      throw error instanceof Error ? error : new Error(JSON.stringify(error));
    }
    rows.push(...(data ?? []));
    if ((data ?? []).length < pageSize) break;
  }
  return rows;
}

async function usageScoreColumnExists() {
  const { error } = await supabase.from("locations").select("id,usage_score").limit(1);
  if (!error) return true;
  const message = typeof error === "object" && error && "message" in error ? String(error.message) : "";
  if (message.includes("usage_score")) return false;
  throw new Error(`Spalten-Probe fehlgeschlagen: ${message}`);
}

async function main() {
  if (!(await usageScoreColumnExists())) {
    console.log(
      "[usage] locations.usage_score existiert noch nicht — Migration " +
        "20260731120000_locations_usage_score.sql im SQL-Editor anwenden. " +
        "Lauf endet ohne Änderungen."
    );
    return;
  }

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - WINDOW_DAYS);

  type EventRow = { metadata: unknown };
  const events = await fetchAllRows<EventRow>((from, to) =>
    supabase
      .from("attribution_events")
      .select("metadata")
      .in("event_type", ["ai_plan_applied", "plan_save"])
      .gte("occurred_at", cutoff.toISOString())
      .order("id", { ascending: true })
      .range(from, to)
  );

  const counts = new Map<string, number>();
  for (const event of events) {
    const meta = (event.metadata ?? {}) as { locationIds?: unknown };
    if (!Array.isArray(meta.locationIds)) continue;
    for (const id of meta.locationIds) {
      if (typeof id !== "string" || !id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  const targets = new Map<string, number>();
  for (const [locationId, count] of counts) {
    if (count >= MIN_SELECTIONS) targets.set(locationId, usageScoreFor(count));
  }

  // Bestehende Scores laden, um Stale-Einträge (aus dem Fenster gefallen oder
  // unter die Schwelle gerutscht) auf 0 zurückzusetzen.
  type ScoredRow = { id: string; usage_score: number | null };
  let scored: ScoredRow[];
  try {
    scored = await fetchAllRows<ScoredRow>((from, to) =>
      supabase
        .from("locations")
        .select("id,usage_score")
        .gt("usage_score", 0)
        .order("id", { ascending: true })
        .range(from, to)
    );
  } catch (error) {
    // Ohne den Teilindex (Migration 20260831120000) läuft die Abfrage über
    // 470k+ Zeilen in den Statement-Timeout — sauber enden statt Cron-Rot.
    if (error instanceof Error && error.message.includes("57014")) {
      console.log(
        "[usage] Statement-Timeout beim Lesen bestehender Scores — Migration " +
          "20260831120000_locations_usage_score_index.sql im SQL-Editor anwenden. " +
          "Lauf endet ohne Änderungen."
      );
      return;
    }
    throw error;
  }

  const updates: Array<{ id: string; usage_score: number }> = [];
  for (const [id, score] of targets) {
    const current = scored.find((row) => row.id === id)?.usage_score ?? 0;
    if (Number(current) !== score) updates.push({ id, usage_score: score });
  }
  for (const row of scored) {
    if (!targets.has(row.id)) updates.push({ id: row.id, usage_score: 0 });
  }

  console.log(
    `[usage] Fenster ${WINDOW_DAYS}d, Schwelle ${MIN_SELECTIONS}: ` +
      `${events.length} Events, ${counts.size} Locations mit Auswahlen, ` +
      `${targets.size} über Schwelle, ${updates.length} Updates${DRY_RUN ? " (dry-run)" : ""}`
  );

  if (DRY_RUN || updates.length === 0) {
    if (DRY_RUN) {
      for (const update of updates.slice(0, 20)) {
        console.log(`  ${update.id} -> ${update.usage_score}`);
      }
    }
    return;
  }

  const CHUNK_SIZE = 10;
  for (let offset = 0; offset < updates.length; offset += CHUNK_SIZE) {
    const chunk = updates.slice(offset, offset + CHUNK_SIZE);
    const results = await Promise.all(
      chunk.map((update) =>
        supabase.from("locations").update({ usage_score: update.usage_score }).eq("id", update.id)
      )
    );
    for (const result of results) {
      if (result?.error) {
        throw new Error(`usage_score-Update fehlgeschlagen: ${result.error.message}`);
      }
    }
  }
  console.log(`[usage] ${updates.length} usage_scores geschrieben.`);
}

main().catch((error) => {
  console.error("[usage] Aggregation fehlgeschlagen:", error);
  process.exit(1);
});
