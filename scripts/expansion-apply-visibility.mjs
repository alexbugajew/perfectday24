// Baut tmp/visibility-overrides.json aus den letzten Gates-Audits (wave5+wave6)
// und regeneriert rollout-expansion.generated.ts: Städte mit bestandenem
// stage-Gate werden visible/planner_ready geschaltet.
// Ablauf: node .codex-scripts-dist/scripts/check-planner-rollout-scope.js --scope=wave5
//         node .codex-scripts-dist/scripts/check-planner-rollout-scope.js --scope=wave6
//         node scripts/expansion-apply-visibility.mjs
//         npx tsc --noEmit && npx tsc -p tsconfig.scripts.json  (dann committen)
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

function latestReport(scope) {
  const files = readdirSync("reports")
    .filter((f) => f.startsWith(`planner-rollout-${scope}-audit`) && f.endsWith(".json"))
    .sort();
  if (!files.length) throw new Error(`kein Audit-Report für ${scope} — erst check-planner-rollout-scope --scope=${scope} laufen lassen`);
  return JSON.parse(readFileSync(`reports/${files[files.length - 1]}`, "utf8"));
}

const overrides = {};
let pass = 0, total = 0;
for (const scope of ["wave5", "wave6"]) {
  const rep = latestReport(scope);
  const rows = rep.rows ?? rep;
  for (const r of rows) {
    total++;
    if (r.passesVisibilityGate) {
      pass++;
      overrides[r.citySlug] = { plannerVisibility: "visible", readinessTier: "planner_ready" };
    }
  }
}
writeFileSync("tmp/visibility-overrides.json", JSON.stringify(overrides, null, 1));
console.log(`overrides: ${pass}/${total} Städte bestehen ihr stage-Gate -> visible/planner_ready`);

const { execSync } = await import("node:child_process");
execSync("node scripts/expansion-generate-rollout.mjs", { stdio: "inherit" });
