// Generate lib/cities/rollout-expansion.generated.ts from tmp/wave5-final.json.
// Optional: tmp/visibility-overrides.json ({ [slug]: { plannerVisibility, readinessTier } })
// — wird von expansion-apply-visibility.mjs aus dem Gates-Audit erzeugt und schaltet
// Städte mit ausreichender Location-Basis sichtbar.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const rows = JSON.parse(readFileSync("tmp/wave5-final.json", "utf8"));
rows.sort((a, b) => b._meta.pop - a._meta.pop);

const OV_PATH = "tmp/visibility-overrides.json";
const overrides = existsSync(OV_PATH) ? JSON.parse(readFileSync(OV_PATH, "utf8")) : {};

const entry = (c) => {
  const ov = overrides[c.slug] ?? {};
  const tier = ov.readinessTier ?? "prepared";
  const vis = ov.plannerVisibility ?? "hidden";
  return `  {
    slug: ${JSON.stringify(c.slug)},
    label: ${JSON.stringify(c.label)},
    countryCode: "DE",
    lat: ${c.lat},
    lng: ${c.lng},
    radiusM: ${c.radiusM},
    stage: ${JSON.stringify(c.stage)},
    readinessTier: ${JSON.stringify(tier)},
    plannerVisibility: ${JSON.stringify(vis)},${c.aliasSlugs.length ? `\n    aliasSlugs: ${JSON.stringify(c.aliasSlugs)},` : ""}
  }, // ${c._meta.wikiName} (${c._meta.land}), ${c._meta.pop.toLocaleString("de-DE")} Einw.`;
};

const visCount = rows.filter((r) => (overrides[r.slug]?.plannerVisibility ?? "hidden") === "visible").length;
const file = `// GENERATED FILE — nicht von Hand editieren.
// Quelle: Wikipedia "Liste der Groß- und Mittelstädte in Deutschland" (Stand 2024/25),
// Koordinaten via Nominatim, Slugs kanonisiert gegen die cities-Tabelle.
// Regenerieren: node scripts/expansion-generate-rollout.mjs
// (Pipeline: expansion-match-cities -> expansion-geocode-cities -> expansion-canonicalize;
//  Sichtbarkeit: expansion-apply-visibility nach Gates-Audit)
// wave5 = Städte >= 50.000 Einw., wave6 = 20.000-50.000 Einw.
// Sichtbarkeit folgt den stage-Gates (getVisibilityGatesForStage): Location-Basis,
// Event-Gate für Expansion ausgesetzt (Entscheidung 14.07.2026).
import type { PlannerRolloutCity } from "./rollout";

export const PLANNER_EXPANSION_ROLLOUT: PlannerRolloutCity[] = [
${rows.map(entry).join("\n")}
];
`;
writeFileSync("lib/cities/rollout-expansion.generated.ts", file);
console.log(`generated: ${rows.length} entries (wave5 ${rows.filter((r) => r.stage === "wave5").length}, wave6 ${rows.filter((r) => r.stage === "wave6").length}), visible: ${visCount}`);
