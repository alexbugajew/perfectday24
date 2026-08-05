// Geocodiert die Tagesstopps (plannedStops) der Redaktions-Roadtrips via
// Nominatim und schreibt lat/lng zurück in roadtrip_routes.stops (jsonb).
// Plausibilitäts-Check: Treffer muss nahe der Etappen-Koordinate liegen,
// sonst bleibt der Stop ohne Koordinaten (Navigation fällt dann auf
// Ortsnamen-Suche zurück). Idempotent: Stops mit lat/lng werden übersprungen.
// Aufruf: node scripts/geocode-roadtrip-planned-stops.js [--commit] [--slug=<roadtrip-slug>] [--max-km=35]
const { readFileSync } = require("fs");
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const eq = line.indexOf("=");
  if (eq > 0 && !line.trim().startsWith("#")) {
    const k = line.slice(0, eq).trim();
    if (!(k in process.env)) process.env[k] = line.slice(eq + 1).trim();
  }
}
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const COMMIT = process.argv.includes("--commit");
const SLUG_FILTER = process.argv.find((a) => a.startsWith("--slug="))?.slice(7) ?? null;
const MAX_KM = Number(process.argv.find((a) => a.startsWith("--max-km="))?.slice(9) ?? "35") || 35;
const DELAY_MS = 1100; // Nominatim-Policy: max. 1 Request/Sekunde

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function haversineKm(aLat, aLng, bLat, bLng) {
  const rad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "PerfectDay24 roadtrip enrichment (kontakt@perfectday24.de)" },
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  const hit = Array.isArray(data) ? data[0] : null;
  if (!hit?.lat || !hit?.lon) return null;
  return { lat: Number(hit.lat), lng: Number(hit.lon) };
}

(async () => {
  let query = sb
    .from("roadtrip_routes")
    .select("id,slug,stops")
    .eq("visibility", "public")
    .eq("author_name", "PD24 Redaktion");
  if (SLUG_FILTER) query = query.eq("slug", SLUG_FILTER);
  const { data: roadtrips, error } = await query;
  if (error) throw error;

  let geocoded = 0, skippedExisting = 0, missed = 0, rejectedFar = 0;
  for (const rt of roadtrips) {
    const stages = Array.isArray(rt.stops) ? rt.stops : [];
    let changed = false;
    for (const stage of stages) {
      for (const planned of stage.plannedStops ?? []) {
        if (planned.lat != null && planned.lng != null) { skippedExisting += 1; continue; }
        const name = planned.itemName || planned.label;
        if (!name) continue;
        // "Paris · Trocadéro & Marais" -> "Paris" (Viertel-Suffix und Sonderzeichen
        // brechen die Nominatim-Suche).
        const cityQuery = String(stage.cityLabel ?? "").split("·")[0].replace(/&/g, " ").replace(/\s+/g, " ").trim();
        await sleep(DELAY_MS);
        let hit = await geocode(`${name}, ${cityQuery}`);
        if (!hit) {
          await sleep(DELAY_MS);
          hit = await geocode(`${name} ${cityQuery}`);
        }
        if (!hit) { missed += 1; console.log(`miss   ${rt.slug} | ${stage.cityLabel} | ${name}`); continue; }
        if (stage.lat != null && stage.lng != null) {
          const km = haversineKm(stage.lat, stage.lng, hit.lat, hit.lng);
          if (km > MAX_KM) {
            rejectedFar += 1;
            console.log(`reject ${rt.slug} | ${stage.cityLabel} | ${name} (${Math.round(km)} km entfernt)`);
            continue;
          }
        }
        planned.lat = hit.lat;
        planned.lng = hit.lng;
        changed = true;
        geocoded += 1;
        console.log(`ok     ${rt.slug} | ${stage.cityLabel} | ${name} -> ${hit.lat.toFixed(5)}, ${hit.lng.toFixed(5)}`);
      }
    }
    if (changed && COMMIT) {
      const { error: updateError } = await sb.from("roadtrip_routes").update({ stops: stages }).eq("id", rt.id);
      if (updateError) throw new Error(`${rt.slug}: Update fehlgeschlagen: ${updateError.message}`);
    }
  }
  console.log(`${COMMIT ? "Fertig" : "Dry-Run"}: ${geocoded} geocodiert, ${skippedExisting} vorhanden, ${missed} ohne Treffer, ${rejectedFar} verworfen (zu weit).`);
})();
