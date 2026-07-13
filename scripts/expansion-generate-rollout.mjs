// Generate lib/cities/rollout-expansion.generated.ts from tmp/wave5-final.json
import { readFileSync, writeFileSync } from "node:fs";

const rows = JSON.parse(readFileSync("tmp/wave5-final.json", "utf8"));
rows.sort((a, b) => b._meta.pop - a._meta.pop);

const entry = (c) => `  {
    slug: ${JSON.stringify(c.slug)},
    label: ${JSON.stringify(c.label)},
    countryCode: "DE",
    lat: ${c.lat},
    lng: ${c.lng},
    radiusM: ${c.radiusM},
    stage: ${JSON.stringify(c.stage)},
    readinessTier: "prepared",
    plannerVisibility: "hidden",${c.aliasSlugs.length ? `\n    aliasSlugs: ${JSON.stringify(c.aliasSlugs)},` : ""}
  }, // ${c._meta.wikiName} (${c._meta.land}), ${c._meta.pop.toLocaleString("de-DE")} Einw.`;

const file = `// GENERATED FILE — nicht von Hand editieren.
// Quelle: Wikipedia "Liste der Groß- und Mittelstädte in Deutschland" (Stand 2024/25),
// Koordinaten via Nominatim, Slugs kanonisiert gegen die cities-Tabelle.
// Regenerieren: node scripts/_tmp_generate_rollout.mjs (nach _tmp_match_cities + _tmp_geocode + _tmp_canonicalize)
// wave5 = Städte >= 50.000 Einw., wave6 = 20.000-50.000 Einw.
// Alle Einträge starten prepared/hidden — sichtbar erst nach OSM-Ingest + Gates-Check.
import type { PlannerRolloutCity } from "./rollout";

export const PLANNER_EXPANSION_ROLLOUT: PlannerRolloutCity[] = [
${rows.map(entry).join("\n")}
];
`;
writeFileSync("lib/cities/rollout-expansion.generated.ts", file);
console.log(`generated lib/cities/rollout-expansion.generated.ts: ${rows.length} entries (wave5 ${rows.filter((r) => r.stage === "wave5").length}, wave6 ${rows.filter((r) => r.stage === "wave6").length})`);
