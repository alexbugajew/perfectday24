import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const NEW_CITIES = [
  "chemnitz",
  "krefeld",
  "halle-saale",
  "mainz",
  "oberhausen",
  "rostock",
  "kassel",
  "hagen",
  "potsdam",
  "saarbruecken",
  "hamm",
  "ludwigshafen-am-rhein",
  "oldenburg",
  "muelheim-an-der-ruhr",
  "leverkusen",
  "darmstadt",
  "osnabrueck",
  "solingen",
  "herne",
  "paderborn",
  "heidelberg",
  "neuss",
  "regensburg",
  "ingolstadt",
  "pforzheim",
  "wuerzburg",
  "offenbach-am-main",
  "heilbronn",
  "fuerth",
  "goettingen",
  "ulm",
  "wolfsburg",
  "reutlingen",
  "bremerhaven",
  "bottrop",
  "erlangen",
  "recklinghausen",
  "koblenz",
  "remscheid",
  "bergisch-gladbach",
  "jena",
  "salzgitter",
  "trier",
  "siegen",
  "moers",
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

  const { data, error } = await supabase
    .from("cities")
    .select("slug, name, is_active")
    .in("slug", NEW_CITIES);

  if (error) throw new Error(error.message);

  const existing = new Map((data ?? []).map((row) => [row.slug, row]));
  const found: string[] = [];
  const missing: string[] = [];

  for (const slug of NEW_CITIES) {
    if (existing.has(slug)) found.push(slug);
    else missing.push(slug);
  }

  console.log(`In cities table: ${found.length}/${NEW_CITIES.length}`);
  if (found.length > 0) {
    console.log("\nFound:");
    for (const slug of found) {
      const row = existing.get(slug)!;
      console.log(`  ${slug} | ${row.name} | is_active=${row.is_active}`);
    }
  }
  if (missing.length > 0) {
    console.log("\nMissing in cities table:");
    for (const slug of missing) console.log(`  ${slug}`);
  }

  // Also check if any cities exist with alternative slugs (e.g. halle, halle-an-der-saale)
  const candidates = [
    "halle",
    "halle-an-der-saale",
    "saarbrucken",
    "saarbrücken",
    "ludwigshafen",
    "mülheim-an-der-ruhr",
    "muelheim",
    "osnabrück",
    "würzburg",
    "wuerzburg-am-main",
    "fürth",
    "göttingen",
    "offenbach",
  ];
  const { data: altData } = await supabase
    .from("cities")
    .select("slug, name")
    .in("slug", candidates);
  if (altData?.length) {
    console.log("\nAlternative slugs found in cities table:");
    for (const row of altData) console.log(`  ${row.slug} | ${row.name}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
