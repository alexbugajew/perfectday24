// classify-location-vibes.ts
// =============================================================================
// Klassifiziert die Top-N Locations pro Stadt mit GPT-4o-mini und vergibt
// curated Vibe-Tags, die der AI-Planner nutzt um zum Anlass passende Stops
// auszuwaehlen.
//
// Nutzung:
//   npx tsx scripts/classify-location-vibes.ts --cities=muenchen,berlin --topN=500
//   npx tsx scripts/classify-location-vibes.ts --cities=all --topN=300
//
// Notizen:
// - Liest aus locations (city_slug, is_plannable=true), sortiert nach quality_score.
// - Batched 8 Locations pro OpenAI-Call (Cost ~0.0005$ pro Call → 500/8 = 62 Calls ~ 0.03$ pro Stadt).
// - Skippt Locations mit bestehenden vibe-Tags (re-runs sind cheap).
// - Vibe-Tags werden zu locations.tags appendiert via array_cat.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { PLANNER_33_ROLLOUT } from "../lib/cities/rollout";

function loadEnvFile(path: string) {
  try {
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
  } catch {
    // optional
  }
}

const ALLOWED_VIBES = [
  // Stimmung
  "romantic",
  "intimate",
  "refined",
  "hip",
  "casual",
  "cozy",
  "lively",
  "elegant",
  "dive",
  // Zielgruppe
  "kid-friendly",
  "family-friendly",
  "date-friendly",
  "group-friendly",
  "solo-friendly",
  "tourist-classic",
  // Special
  "live-music",
  "outdoor",
  "view",
  "iconic",
  "hidden-gem",
  "instagrammable",
  // Modus
  "quick",
  "long-stay",
  "late-night",
  "breakfast-spot",
] as const;

type VibeTag = (typeof ALLOWED_VIBES)[number];

type LocRow = {
  id: string;
  name: string;
  type: string | null;
  category: string | null;
  city_slug: string;
  budget: string | null;
  tags: string[] | null;
  quality_score: number | null;
};

type Classification = {
  id: string;
  vibes: VibeTag[];
};

const VIBE_LIST = ALLOWED_VIBES.join(", ");

const SYSTEM = `Du klassifizierst deutsche Stadt-Locations (Restaurants, Bars, Museen, Parks, Clubs etc.) mit curated Vibe-Tags.

Regeln:
- Nur Tags aus dieser Whitelist verwenden: ${VIBE_LIST}
- Min 1, max 4 Tags pro Location.
- IMMER mindestens 1 Tag vergeben — leite es aus Type/Category ab wenn Name unbekannt.

OUTPUT-FORMAT (STRIKT, JSON):
{
  "classifications": [
    { "id": "<exakt die uuid aus der Eingabe>", "vibes": ["tag1","tag2"] }
  ]
}
Antworte ausschließlich mit diesem JSON-Objekt.
WICHTIG: Das Feld heisst "vibes" (nicht "tags", nicht "labels"). Nutze IMMER den Schlüssel "vibes".

Heuristik wenn Name unbekannt:
- type=restaurant → mindestens ["casual"] oder ["refined"] je nach budget (low→casual, medium/high→refined oder date-friendly)
- type=cafe → ["cozy","casual"] oder ["breakfast-spot"]
- category=culture → ["tourist-classic"] + ggf. ["refined"]
- category=nightlife (bar) → ["lively","casual"] oder ["late-night"]
- category=nightlife (club) → ["late-night","lively"]
- category=activity outdoor → ["outdoor","family-friendly"]
- category=activity indoor → ["family-friendly","group-friendly"]

Beispiel-Mapping bei bekanntem Namen:
- "Schumann's Bar" (München, Bar) → ["refined","date-friendly","iconic"]
- "Pinakothek der Moderne" → ["tourist-classic","iconic","refined"]
- "Berghain" → ["lively","late-night","iconic"]
- "Englischer Garten" → ["outdoor","family-friendly","tourist-classic"]
- "Schwabinger Wassermann" (Eckkneipe) → ["casual","dive","late-night"]`;

function buildUserMessage(rows: LocRow[]): string {
  const items = rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    category: r.category,
    city: r.city_slug,
    budget: r.budget,
  }));
  return `Klassifiziere diese Locations:\n${JSON.stringify(items, null, 2)}`;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    classifications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          vibes: {
            type: "array",
            items: { type: "string", enum: [...ALLOWED_VIBES] },
            maxItems: 4,
          },
        },
        required: ["id", "vibes"],
      },
    },
  },
  required: ["classifications"],
} as const;

let DEBUG_FIRST_BATCH = true;

async function classifyBatch(
  client: OpenAI,
  rows: LocRow[]
): Promise<Classification[]> {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 1000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: buildUserMessage(rows) },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  if (DEBUG_FIRST_BATCH) {
    DEBUG_FIRST_BATCH = false;
    console.log("\n  DEBUG first batch raw response (truncated 400 chars):");
    console.log("  " + raw.slice(0, 400).replace(/\n/g, "\n  "));
    console.log();
  }
  try {
    const parsed = JSON.parse(raw) as {
      classifications: Array<{ id?: string; vibes?: string[]; tags?: string[] }>;
    };
    if (!Array.isArray(parsed.classifications)) return [];
    const result: Classification[] = [];
    for (const c of parsed.classifications) {
      if (typeof c.id !== "string") continue;
      const list = Array.isArray(c.vibes) ? c.vibes : Array.isArray(c.tags) ? c.tags : [];
      const filtered = list.filter((t): t is VibeTag =>
        (ALLOWED_VIBES as readonly string[]).includes(t)
      );
      result.push({ id: c.id, vibes: filtered });
    }
    return result;
  } catch {
    return [];
  }
}

function chunked<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function parseArgs() {
  const args: Record<string, string> = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.+)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

async function main() {
  loadEnvFile(join(process.cwd(), ".env.local"));

  const args = parseArgs();
  const citiesArg = args.cities ?? "muenchen,berlin";
  const topN = parseInt(args.topN ?? "500", 10);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing in .env.local");
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let citySlugs: string[];
  if (citiesArg === "all") {
    // Quelle: rollout.ts (statisch, kein Risiko mit Supabase REST-Pagination).
    citySlugs = PLANNER_33_ROLLOUT.map((c) => c.slug).sort();
  } else {
    citySlugs = citiesArg.split(",").map((s) => s.trim()).filter(Boolean);
  }

  console.log(`Cities: ${citySlugs.join(", ")} | topN per city: ${topN}`);

  const VIBE_PREFIX_SET = new Set<string>(ALLOWED_VIBES);

  for (const citySlug of citySlugs) {
    console.log(`\n=== ${citySlug} ===`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("locations")
      .select("id,name,type,category,city_slug,budget,tags,quality_score")
      .eq("city_slug", citySlug)
      .eq("is_plannable", true)
      .order("quality_score", { ascending: false, nullsFirst: false })
      // Deterministischer Tiebreaker: bei flachen Scores (Manual-Seed = alle 85)
      // liefert Postgres sonst pro Query eine ANDERE Top-300-Teilmenge —
      // Classify und Coverage-Audit sahen dadurch verschiedene Locations.
      .order("id", { ascending: true })
      .limit(topN);
    if (error) {
      console.error(`fetch failed for ${citySlug}:`, error.message);
      continue;
    }
    const rows = (data ?? []) as LocRow[];
    // Skip Locations die bereits irgendeinen Vibe-Tag aus der Whitelist haben
    const todo = rows.filter((r) => {
      const existing = r.tags ?? [];
      return !existing.some((t) => VIBE_PREFIX_SET.has(t));
    });
    console.log(`  Found ${rows.length} top locations, ${todo.length} need classification`);

    const batches = chunked(todo, 8);
    let updated = 0;
    let i = 0;
    for (const batch of batches) {
      i += 1;
      try {
        const classifications = await classifyBatch(openai, batch);
        for (const cls of classifications) {
          if (cls.vibes.length === 0) continue;
          const target = batch.find((r) => r.id === cls.id);
          if (!target) continue;
          const existing = (target.tags ?? []).filter(
            (t) => !VIBE_PREFIX_SET.has(t)
          );
          const merged = [...new Set([...existing, ...cls.vibes])];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: upErr } = await (supabase as any)
            .from("locations")
            .update({ tags: merged })
            .eq("id", target.id);
          if (upErr) {
            console.error(`    update failed for ${target.id}:`, upErr.message);
          } else {
            updated += 1;
          }
        }
        if (i % 10 === 0) {
          console.log(`  Batch ${i}/${batches.length} done. Updated so far: ${updated}`);
        }
      } catch (err) {
        console.error(`  Batch ${i} failed:`, err instanceof Error ? err.message : err);
      }
    }
    console.log(`  Done ${citySlug}: ${updated} locations tagged`);
  }
  console.log("\nAll done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
