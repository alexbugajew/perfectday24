// Geocode all 704 Groß-/Mittelstädte via Nominatim (1 req/s, checkpointed, resumable).
// Input: tmp/wiki-cities.json  Output: tmp/geocoded.json (append-as-we-go checkpoint)
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const UA = "perfectday24-city-rollout/1.0 (https://perfectday24.de; ab@energieaudit365.de)";
const IN = "tmp/wiki-cities.json";
const OUT = "tmp/geocoded.json";

const cities = JSON.parse(readFileSync(IN, "utf8"));
const done = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const key = (c) => `${c.name}|${c.land}`;
const todo = cities.filter((c) => !done[key(c)]);
console.log(`total ${cities.length}, done ${cities.length - todo.length}, todo ${todo.length}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wikipedia name -> Nominatim query name (strip disambiguation parens where they
// are NOT part of the official name Nominatim knows; keep e.g. "Halle (Saale)").
function queryName(name) {
  return name.replace(/\s*\((Westf|Oldb|Rheinl|Aller|Efze|Eder)\.?\)/i, "").trim();
}

let i = 0, fails = 0;
for (const c of todo) {
  i++;
  const q = async (params) => {
    const url = "https://nominatim.openstreetmap.org/search?" + new URLSearchParams({ format: "jsonv2", limit: "6", countrycodes: "de", ...params });
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return [];
    return res.json();
  };
  try {
    // structured query first (city + state), fallback free-form
    let hits = await q({ city: queryName(c.name), state: c.land });
    await sleep(1100);
    if (!hits.length) { hits = await q({ q: `${queryName(c.name)}, ${c.land}, Deutschland` }); await sleep(1100); }
    // prefer city/town/administrative results
    const placeTypes = ["city", "town", "municipality", "administrative"];
    const ranked = [...hits].sort((a, b) => (placeTypes.includes(b.type) ? 1 : 0) - (placeTypes.includes(a.type) ? 1 : 0) || (b.importance ?? 0) - (a.importance ?? 0));
    const best = ranked[0];
    if (best) {
      done[key(c)] = { name: c.name, land: c.land, pop: c.pop, lat: parseFloat(best.lat), lng: parseFloat(best.lon), osmType: best.type, display: best.display_name };
    } else {
      fails++;
      done[key(c)] = { name: c.name, land: c.land, pop: c.pop, lat: null, lng: null, error: "no_result" };
    }
  } catch (e) {
    fails++;
    done[key(c)] = { name: c.name, land: c.land, pop: c.pop, lat: null, lng: null, error: String(e.message).slice(0, 80) };
    await sleep(2000);
  }
  if (i % 10 === 0 || i === todo.length) {
    writeFileSync(OUT, JSON.stringify(done, null, 1));
    console.log(`${i}/${todo.length} geocoded (fails so far: ${fails}) — last: ${c.name}`);
  }
}
writeFileSync(OUT, JSON.stringify(done, null, 1));
console.log(`DONE. ${Object.keys(done).length} entries, ${fails} failures this run.`);
