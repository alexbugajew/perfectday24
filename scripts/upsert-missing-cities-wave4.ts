import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

type CityRow = {
  slug: string;
  name: string;
  country_code: "DE";
  center_lat: number;
  center_lng: number;
  population: number;
  is_active: boolean;
};

const MISSING: CityRow[] = [
  {
    slug: "saarbruecken",
    name: "Saarbrücken",
    country_code: "DE",
    center_lat: 49.2402,
    center_lng: 6.9969,
    population: 182859,
    is_active: true,
  },
  {
    slug: "regensburg",
    name: "Regensburg",
    country_code: "DE",
    center_lat: 49.0134,
    center_lng: 12.1016,
    population: 151517,
    is_active: true,
  },
  {
    slug: "reutlingen",
    name: "Reutlingen",
    country_code: "DE",
    center_lat: 48.4914,
    center_lng: 9.2043,
    population: 118852,
    is_active: true,
  },
];

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

  const { data, error } = await supabase.from("cities").upsert(MISSING, { onConflict: "slug" }).select();

  if (error) {
    console.error("Upsert failed:", error.message);
    process.exitCode = 1;
    return;
  }
  console.log(`Upserted ${data?.length ?? 0} cities:`);
  for (const row of data ?? []) console.log(`  ${row.slug} | ${row.name}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
