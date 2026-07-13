// Match the Wikipedia Groß-/Mittelstädte list against cities table + existing rollout.
// Output: tmp/wave5-candidates.json
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { PLANNER_33_ROLLOUT } from "../lib/cities/rollout";

function loadEnvFile(path: string) {
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    if (!(line.slice(0, eq).trim() in process.env)) process.env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
}
loadEnvFile(".env.local");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const norm = (s: string) =>
  s.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/\s*\(([^)]*)\)/g, " $1") // "halle (saale)" -> "halle saale"
    .replace(/\ba\.\s?d\.\s?/g, "an der ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const bare = (s: string) => norm(s).split(" ")[0]; // first token, e.g. "halle"

type DbCity = { slug: string; name: string; population: number | null; center_lat: number | null; center_lng: number | null };

async function main() {
  const wiki: Array<{ name: string; pop: number; land: string }> = JSON.parse(readFileSync("tmp/wiki-cities.json", "utf8"));

  // load all DE cities (paginate)
  const db: DbCity[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("cities").select("slug,name,population,center_lat,center_lng").range(from, from + 999);
    if (error) throw error;
    db.push(...(data as DbCity[]));
    if (!data || data.length < 1000) break;
  }
  console.log("db cities:", db.length);

  // index DB by normalized name
  const byNorm = new Map<string, DbCity[]>();
  for (const c of db) {
    const k = norm(c.name || "");
    if (!k) continue;
    if (!byNorm.has(k)) byNorm.set(k, []);
    byNorm.get(k)!.push(c);
  }

  // existing rollout coverage (slug, aliases, normalized label)
  const covered = new Set<string>();
  for (const r of PLANNER_33_ROLLOUT) {
    covered.add(norm(r.label));
    covered.add(r.slug);
    for (const a of r.aliasSlugs ?? []) covered.add(a);
  }

  const out: any[] = [];
  let already = 0, matched = 0, unmatched = 0;
  for (const w of wiki) {
    const wn = norm(w.name);
    if (covered.has(wn)) { already++; out.push({ ...w, status: "existing_rollout" }); continue; }

    // candidate DB rows: exact normalized name; fallback bare-name + population proximity
    let cands = byNorm.get(wn) ?? [];
    if (cands.length === 0) {
      const b = bare(w.name);
      cands = db.filter((c) => bare(c.name || "") === b && c.population != null && Math.abs((c.population as number) - w.pop) / w.pop < 0.35);
    }
    // rank: has coords, population closest to wiki, shortest slug
    cands = cands
      .filter((c) => c.center_lat != null && c.center_lng != null)
      .sort((a, b2) => {
        const dp = Math.abs((a.population ?? 0) - w.pop) - Math.abs((b2.population ?? 0) - w.pop);
        if (dp !== 0) return dp;
        return a.slug.length - b2.slug.length;
      });
    if (cands.length === 0) { unmatched++; out.push({ ...w, status: "unmatched" }); continue; }
    const best = cands[0];
    const aliases = cands.slice(1).map((c) => c.slug).filter((s) => s !== best.slug);
    matched++;
    out.push({ ...w, status: "matched", slug: best.slug, dbName: best.name, dbPop: best.population, lat: best.center_lat, lng: best.center_lng, aliases });
  }

  console.log(`already in rollout: ${already} | matched: ${matched} | unmatched: ${unmatched}`);
  console.log("unmatched:", out.filter((o) => o.status === "unmatched").map((o) => `${o.name} (${o.land}, ${o.pop})`).join("; ") || "-");
  writeFileSync("tmp/wave5-candidates.json", JSON.stringify(out, null, 1));
  console.log("saved tmp/wave5-candidates.json");
}
main().catch((e) => { console.error(e); process.exit(1); });
