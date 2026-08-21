/**
 * Klassifiziert bestehende planner_events nach, nachdem die Taxonomie um
 * 'exhibition' und 'comedy' erweitert wurde.
 *
 * Der Ingest wendet dieselbe Regel bei jedem Import an — dieses Skript holt den
 * Bestand nach, der vor der Erweiterung entstanden ist.
 *
 *   npm run events:reclassify              # Trockenlauf, schreibt nichts
 *   npm run events:reclassify -- --live    # schreibt
 *
 * Voraussetzung: Die Migration 20260820120000_planner_events_categories.sql
 * muss angewendet sein, sonst weist die CHECK-Beschraenkung die neuen Werte ab.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { refinePlannerEventCategory } from "../lib/planner/events";

type EventRow = {
  id: string;
  title: string | null;
  category: string;
  source: string;
  city_slug: string | null;
};

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2];
  }
}

/**
 * Keyset-Paginierung: `id > zuletzt gesehene id`. Unsortiertes range() ueber
 * 34.000 Zeilen liefert an Seitengrenzen Dubletten und laeuft in den
 * statement timeout — dieselbe Korrektur wie in den Pruefskripten.
 */
async function fetchAll(
  supabase: ReturnType<typeof createClient>
): Promise<EventRow[]> {
  const pageSize = 1000;
  const rows: EventRow[] = [];
  let afterId: string | null = null;

  for (;;) {
    let query = supabase
      .from("planner_events")
      .select("id, title, category, source, city_slug")
      .order("id")
      .limit(pageSize);
    if (afterId) query = query.gt("id", afterId);

    const { data, error } = await query;
    if (error) throw new Error(`Laden fehlgeschlagen: ${error.message}`);

    const page = (data ?? []) as unknown as EventRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
    afterId = page[page.length - 1].id;
  }

  return rows;
}

async function main() {
  loadEnvFile(join(process.cwd(), ".env.local"));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen.");

  const live = process.argv.includes("--live");
  console.log(`Modus: ${live ? "LIVE — es wird geschrieben" : "TROCKENLAUF (--live schreibt)"}`);

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rows = await fetchAll(supabase);
  console.log(`Geladen: ${rows.length} Events\n`);

  const changes = rows
    .map((row) => ({ row, next: refinePlannerEventCategory(row) }))
    .filter(({ row, next }) => next !== row.category);

  if (changes.length === 0) {
    console.log("Nichts nachzuklassifizieren.");
    return;
  }

  const byMove = new Map<string, number>();
  for (const { row, next } of changes) {
    const key = `${row.category} -> ${next}`;
    byMove.set(key, (byMove.get(key) ?? 0) + 1);
  }

  console.log(`Zu aendern: ${changes.length} Zeilen`);
  for (const [move, count] of [...byMove].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${move.padEnd(26)} ${count}`);
  }
  console.log("\nStichprobe:");
  for (const { row, next } of changes.slice(0, 8)) {
    console.log(`  [${row.source}] ${(row.title ?? "").slice(0, 56)}  ->  ${next}`);
  }

  if (!live) {
    console.log("\nTrockenlauf — nichts geschrieben. Mit --live anwenden.");
    return;
  }

  // Einzeln statt im Block: Ein Upsert mit allen Spalten wuerde die uebrigen
  // Felder mitschreiben; hier soll ausschliesslich category wandern.
  let written = 0;
  let failed = 0;
  for (const { row, next } of changes) {
    const { error } = await supabase
      .from("planner_events")
      .update({ category: next })
      .eq("id", row.id);

    if (error) {
      failed += 1;
      if (failed <= 3) console.error(`  Fehler bei ${row.id}: ${error.message}`);
      continue;
    }
    written += 1;
    if (written % 500 === 0) console.log(`  ${written} / ${changes.length}`);
  }

  console.log(`\nGeschrieben: ${written}, fehlgeschlagen: ${failed}`);
  if (failed > 0) {
    console.error(
      "Fehler deuten meist darauf hin, dass die Migration " +
        "20260820120000_planner_events_categories.sql noch nicht angewendet ist."
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
