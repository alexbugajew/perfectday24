import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { getPlannerRolloutCitiesByStage } from "../lib/cities/rollout";

type RolloutCity = {
  slug: string;
  radius: number;
};

const TOP_10_ROLLOUT: RolloutCity[] = getPlannerRolloutCitiesByStage("top10").map((city) => ({
  slug: city.slug,
  radius: city.radiusM,
}));

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

async function main() {
  const publishLimit = Math.max(1, Number(parseArg("publishLimit") ?? "10"));
  const compiledScript = resolve(process.cwd(), ".codex-scripts-dist/scripts/ingest-city-location-seeds.js");
  const failures: string[] = [];

  for (const city of TOP_10_ROLLOUT) {
    const batch = `top10_rollout_${city.slug}_${dateStamp()}`;
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
    throw new Error(`Top-10-Rollout unvollstaendig. Fehlgeschlagen: ${failures.join(", ")}`);
  }

  console.log("\nTop-10-Staedte-Rollout erfolgreich abgeschlossen.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
