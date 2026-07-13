// Merge wiki list + Nominatim geocoding + DB matches into the final wave5/wave6 city set.
// Inputs: tmp/wiki-cities.json, tmp/geocoded.json, tmp/wave5-candidates.json
// Output: tmp/wave5-final.json + console report
import { readFileSync, writeFileSync } from "node:fs";

const translit = (s: string) =>
  s.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue").replace(/ß/g, "ss");
const slugify = (s: string) =>
  translit(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");

const haversineKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const R = 6371, dLat = ((bLat - aLat) * Math.PI) / 180, dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
};

const radiusFor = (pop: number) => (pop >= 500000 ? 15000 : pop >= 200000 ? 13000 : pop >= 100000 ? 11000 : pop >= 50000 ? 9000 : 7000);

type Cand = { name: string; pop: number; land: string; status: string; slug?: string; lat?: number; lng?: number; aliases?: string[]; dbName?: string };

const wiki: Array<{ name: string; pop: number; land: string }> = JSON.parse(readFileSync("tmp/wiki-cities.json", "utf8"));
const geo: Record<string, any> = JSON.parse(readFileSync("tmp/geocoded.json", "utf8"));
const cands: Cand[] = JSON.parse(readFileSync("tmp/wave5-candidates.json", "utf8"));
const candByKey = new Map(cands.map((c) => [`${c.name}|${c.land}`, c]));

const out: any[] = [];
const report = { total: wiki.length, existing: 0, ok: 0, geoFallbackDb: 0, noCoords: [] as string[], coordMismatch: [] as string[], newCityRow: [] as string[], slugCollisions: [] as string[] };
const seenSlugs = new Map<string, string>();

for (const w of wiki) {
  const k = `${w.name}|${w.land}`;
  const cand = candByKey.get(k);
  if (cand?.status === "existing_rollout") { report.existing++; continue; }

  const g = geo[k];
  let lat: number | null = g?.lat ?? null;
  let lng: number | null = g?.lng ?? null;
  let coordSource = "nominatim";
  if ((lat == null || lng == null) && cand?.lat != null) { lat = cand.lat!; lng = cand.lng!; coordSource = "db"; report.geoFallbackDb++; }
  if (lat == null || lng == null) { report.noCoords.push(`${w.name} (${w.land})`); continue; }

  // plausibility: nominatim vs db
  if (g?.lat != null && cand?.lat != null) {
    const d = haversineKm(g.lat, g.lng, cand.lat!, cand.lng!);
    if (d > 25) report.coordMismatch.push(`${w.name}: db ${d.toFixed(0)}km off (using nominatim)`);
  }

  let slug = slugify(w.name);
  if (seenSlugs.has(slug)) { const s2 = `${slug}-${slugify(w.land)}`; report.slugCollisions.push(`${slug} -> ${s2} (${w.name} vs ${seenSlugs.get(slug)})`); slug = s2; }
  seenSlugs.set(slug, w.name);

  const aliasSet = new Set<string>();
  if (cand?.slug && cand.slug !== slug) aliasSet.add(cand.slug);
  for (const a of cand?.aliases ?? []) if (a !== slug) aliasSet.add(a);
  const dbHasCanonical = cand?.slug === slug || (cand?.aliases ?? []).includes(slug);
  if (!cand?.slug) report.newCityRow.push(`${w.name} (${w.land}) -> ${slug}`); // no DB row matched at all

  report.ok++;
  out.push({
    slug, label: translit(w.name), countryCode: "DE",
    lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6,
    radiusM: radiusFor(w.pop),
    stage: w.pop >= 50000 ? "wave5" : "wave6",
    readinessTier: "prepared", plannerVisibility: "hidden",
    aliasSlugs: [...aliasSet],
    _meta: { wikiName: w.name, land: w.land, pop: w.pop, coordSource, dbHasCanonicalSlug: !!dbHasCanonical, matchedDbSlug: cand?.slug ?? null },
  });
}

writeFileSync("tmp/wave5-final.json", JSON.stringify(out, null, 1));
console.log(`total ${report.total} | existing_rollout ${report.existing} | final ${report.ok} (wave5 ${out.filter(o=>o.stage==="wave5").length}, wave6 ${out.filter(o=>o.stage==="wave6").length})`);
console.log(`coords from db-fallback: ${report.geoFallbackDb} | NO coords (skipped): ${report.noCoords.length} ${report.noCoords.join("; ")}`);
console.log(`coord mismatches >25km (nominatim wins): ${report.coordMismatch.length}`);
report.coordMismatch.slice(0, 15).forEach((m) => console.log("  ~ " + m));
console.log(`cities without any DB row (need insert): ${report.newCityRow.length}`);
report.newCityRow.slice(0, 20).forEach((m) => console.log("  + " + m));
console.log(`slug collisions: ${report.slugCollisions.length} ${report.slugCollisions.join("; ")}`);
console.log("saved tmp/wave5-final.json");
