// Checkpointed batch runner: OSM ingest for the wave5/wave6 expansion cities.
// Calls the compiled per-city ingest (same entrypoint as the wave4 runner).
// Usage: node scripts/_tmp_ingest_batch.mjs [--limit=N] [--stage=wave5|wave6]
// Resume-safe: done/failed cities live in tmp/ingest-checkpoint.json.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CKPT = "tmp/ingest-checkpoint.json";
const SCRIPT = ".codex-scripts-dist/scripts/ingest-city-location-seeds.js";
const PUBLISH_LIMIT = 1500;
const BATCH = `expansion_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
const DELAY_MS = 20000; // Overpass-Slots schonen (Rate-Limit-Lektion vom 14.07.)

const arg = (n) => { const p = `--${n}=`; const f = process.argv.find((a) => a.startsWith(p)); return f ? f.slice(p.length) : null; };
const LIMIT = arg("limit") ? parseInt(arg("limit"), 10) : Infinity;
const STAGE = arg("stage");

const all = JSON.parse(readFileSync("tmp/wave5-final.json", "utf8"))
  .filter((c) => !STAGE || c.stage === STAGE)
  .sort((a, b) => b._meta.pop - a._meta.pop);
const ckpt = existsSync(CKPT) ? JSON.parse(readFileSync(CKPT, "utf8")) : { done: {}, failed: {} };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PASSES = 3; // Fehlgeschlagene (z.B. Overpass-Timeouts) werden in Folgepässen erneut versucht.
for (let pass = 1; pass <= PASSES; pass++) {
  const todo = all.filter((c) => !ckpt.done[c.slug]).slice(0, LIMIT);
  if (todo.length === 0) break;
  console.log(`[batch] pass ${pass}/${PASSES}: ${all.length} cities in scope, ${Object.keys(ckpt.done).length} done, running ${todo.length} now (batch=${BATCH})`);
  if (pass > 1) await sleep(60000); // Overpass etwas Luft geben
  await runPass(todo);
}

async function runPass(todo) {
let i = 0;
const t0 = Date.now();
for (const c of todo) {
  i++;
  // Server-Slots räumen (gekillte Vorgänger-Queries blockieren sonst -> 429-Kaskade)
  try { await fetch("https://overpass-api.de/api/kill_my_queries", { signal: AbortSignal.timeout(10_000) }); } catch {}
  const start = Date.now();
  const res = spawnSync("node", [SCRIPT, `--city=${c.slug}`, `--radius=${c.radiusM}`, `--publishLimit=${PUBLISH_LIMIT}`, `--batch=${BATCH}`], {
    encoding: "utf8", timeout: 15 * 60 * 1000, killSignal: "SIGKILL",
  });
  const ms = Date.now() - start;
  const out = (res.stdout || "") + (res.stderr || "");
  const summary = (out.match(/\[locations\] .*plannable locations/) || [out.trim().split("\n").pop() || ""])[0];
  if (res.status === 0) {
    delete ckpt.failed[c.slug];
    ckpt.done[c.slug] = { ms, at: new Date().toISOString(), summary: summary.slice(0, 300) };
    const doneN = Object.keys(ckpt.done).length;
    const avg = (Date.now() - t0) / i;
    const etaH = ((todo.length - i) * (avg + DELAY_MS)) / 3600000;
    console.log(`[${i}/${todo.length}] OK ${c.slug} (${(ms / 1000).toFixed(0)}s, pop ${c._meta.pop}) — total done ${doneN}, ETA ${etaH.toFixed(1)}h\n    ${summary}`);
  } else {
    ckpt.failed[c.slug] = { status: res.status, at: new Date().toISOString(), tail: out.slice(-400) };
    console.log(`[${i}/${todo.length}] FAIL ${c.slug} (status ${res.status})\n${out.slice(-400)}`);
    await sleep(120000); // Cooldown nach Fehlschlag — Overpass nicht weiter treiben
  }
  writeFileSync(CKPT, JSON.stringify(ckpt, null, 1));
  await sleep(DELAY_MS);
}
}

console.log(`[batch] finished run: done ${Object.keys(ckpt.done).length}/${all.length}, failed ${Object.keys(ckpt.failed).length}`);
if (Object.keys(ckpt.failed).length) console.log("failed slugs:", Object.keys(ckpt.failed).join(", "));
