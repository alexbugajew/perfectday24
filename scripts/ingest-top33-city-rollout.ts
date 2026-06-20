import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { getPlannerRolloutCitiesByStage, type PlannerRolloutStage } from "../lib/cities/rollout";

type RolloutCity = {
  slug: string;
  radius: number;
};

function parseArg(name: string) {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function dateStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveRolloutCities(scope: string | null): RolloutCity[] {
  const normalized = (scope ?? "all").trim().toLowerCase();
  const stages: PlannerRolloutStage[] =
    normalized === "wave1"
      ? ["wave1"]
      : normalized === "wave2"
        ? ["wave2"]
        : normalized === "wave3"
          ? ["wave3"]
          : normalized === "wave4"
            ? ["wave4"]
            : normalized === "prepared"
              ? ["wave1", "wave2", "wave3", "wave4"]
              : ["core", "top10", "wave1", "wave2", "wave3", "wave4"];

  return stages.flatMap((stage) =>
    getPlannerRolloutCitiesByStage(stage).map((city) => ({
      slug: city.slug,
      radius: city.radiusM,
    }))
  );
}

async function main() {
  const publishLimit = Math.max(0, Number(parseArg("publishLimit") ?? "10"));
  const scope = parseArg("scope");
  const rolloutCities = resolveRolloutCities(scope);
  const compiledScript = resolve(process.cwd(), ".codex-scripts-dist/scripts/ingest-city-location-seeds.js");
  const failures: string[] = [];

  for (const city of rolloutCities) {
    const batchPrefix = scope ? `top33_${scope}` : "top33_all";
    const batch = `${batchPrefix}_${city.slug}_${dateStamp()}`;
    console.log(`\n=== Import ${city.slug} startet ===`);

    const result = spawnSync(
      process.execPath,
      [
        compiledScript,
        `--city=${city.slug}`,
        `--radius=${city.radius}`,
        `--publishLimit=${publishLimit}`,
        `--batch=${batch}`,
      ],
      {
        cwd: process.cwd(),
        stdio: "inherit",
      }
    );

    if (result.status !== 0) {
      failures.push(city.slug);
      console.error(`Import fehlgeschlagen fuer ${city.slug}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Top-33-Rollout unvollstaendig. Fehlgeschlagen: ${failures.join(", ")}`);
  }

  console.log("\nTop-33-Staedte-Rollout erfolgreich abgeschlossen.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
