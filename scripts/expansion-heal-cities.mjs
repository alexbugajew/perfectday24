// Heal the cities table for the expansion cities (wave5/wave6):
//  1. insert missing rows for canonical slugs (e.g. Schweinfurt Stadt fehlt ganz)
//  2. backfill center_lat/lng where NULL, refresh population (Wikipedia 2024/25)
//  3. fix mojibake names ("GieÃŸen" -> "Gießen") on canonical + alias rows
// Also emits a versioned migration mirroring the changes. Usage: [--dry]
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

const env = {};
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const t = l.trim(); if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("="); if (i < 0) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const DRY = process.argv.includes("--dry");

const rows = JSON.parse(readFileSync("tmp/wave5-final.json", "utf8"));
const stats = { inserted: 0, coordsFixed: 0, popFixed: 0, nameFixed: 0, untouched: 0 };
const sqlOps = [];
const q = (s) => String(s).replace(/'/g, "''");

for (const c of rows) {
  const wikiName = c._meta.wikiName;
  const { data: existing } = await sb.from("cities").select("slug,name,population,center_lat,center_lng").eq("slug", c.slug).maybeSingle();

  if (!existing) {
    const row = {
      slug: c.slug, name: wikiName, country_code: "DE",
      center_lat: c.lat, center_lng: c.lng, timezone: "Europe/Berlin",
      is_active: c._meta.pop >= 100000, population: c._meta.pop,
    };
    stats.inserted++;
    sqlOps.push(`insert into public.cities (slug,name,country_code,center_lat,center_lng,timezone,is_active,population) values ('${q(row.slug)}','${q(row.name)}','DE',${row.center_lat},${row.center_lng},'Europe/Berlin',${row.is_active},${row.population}) on conflict (slug) do nothing;`);
    if (!DRY) {
      const { error } = await sb.from("cities").insert(row);
      if (error) console.log(`  ! insert ${c.slug}: ${error.message}`);
    }
    continue;
  }

  const patch = {};
  if (existing.center_lat == null || existing.center_lng == null) { patch.center_lat = c.lat; patch.center_lng = c.lng; stats.coordsFixed++; }
  if (existing.population == null || Math.abs((existing.population ?? 0) - c._meta.pop) / c._meta.pop > 0.15) { patch.population = c._meta.pop; stats.popFixed++; }
  if (existing.name && (existing.name.includes("Ã") || existing.name.includes("Â"))) { patch.name = wikiName; stats.nameFixed++; }
  if (Object.keys(patch).length === 0) { stats.untouched++; continue; }

  const sets = Object.entries(patch).map(([k, v]) => `${k} = ${typeof v === "string" ? `'${q(v)}'` : v}`).join(", ");
  sqlOps.push(`update public.cities set ${sets} where slug = '${q(c.slug)}';`);
  if (!DRY) {
    const { error } = await sb.from("cities").update(patch).eq("slug", c.slug);
    if (error) console.log(`  ! update ${c.slug}: ${error.message}`);
  }
}

console.log(`inserted ${stats.inserted}, coordsFixed ${stats.coordsFixed}, popFixed ${stats.popFixed}, nameFixed ${stats.nameFixed}, untouched ${stats.untouched}`);

const sql = `-- Heilung der cities-Tabelle für den Groß-/Mittelstadt-Rollout (wave5/wave6):
-- fehlende Stadt-Zeilen, NULL-Koordinaten (Nominatim), Population (Wikipedia 2024/25),
-- Mojibake-Namen. Idempotent; bereits per REST angewandt (Migration = Versionierung).

begin;

${sqlOps.join("\n")}

commit;
`;
writeFileSync("supabase/migrations/20260713120000_heal_cities_expansion.sql", sql);
console.log(`migration written (${sqlOps.length} ops)${DRY ? " [dry — keine DB-Writes]" : ""}`);
