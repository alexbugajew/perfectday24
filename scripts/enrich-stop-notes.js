// Reichert die Stop-Beschreibungen der Redaktions-Routen per gpt-5.2 an:
// je Stop 2–3 einladende Sätze, warum dieser Ort sehenswert ist. Die bisherige
// Notiz fließt als Faktenbasis ein und wird in meta.original_note gesichert.
// Idempotent über meta.note_enriched_at. Nur Routen von pd24-redaktion.
// Aufruf: node scripts/enrich-stop-notes.js [--commit] [--route=<slug>] [--limit=N]
const { readFileSync } = require("fs");
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const eq = line.indexOf("=");
  if (eq > 0 && !line.trim().startsWith("#")) {
    const k = line.slice(0, eq).trim();
    if (!(k in process.env)) process.env[k] = line.slice(eq + 1).trim();
  }
}
const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");

const COMMIT = process.argv.includes("--commit");
const ROUTE_FILTER = process.argv.find((a) => a.startsWith("--route="))?.slice(8) ?? null;
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.slice(8) ?? "0") || null;
const CONCURRENCY = 4;

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const INSTRUCTIONS = `Du bist Reiseredakteur für PerfectDay24 und schreibst deutsche Stop-Beschreibungen
für kuratierte Tagesrouten. Für jeden Stop bekommst du Titel, bisherige Kurznotiz und den Routen-Kontext.

Regeln:
- Je Stop 2 bis 3 Sätze (ca. 35–60 Wörter): Was macht diesen Ort besonders, was erlebt man dort,
  warum passt er an diese Stelle der Route? Einladend und konkret, aber ohne Werbefloskeln.
- Alle Fakten aus der bisherigen Notiz übernehmen und ausbauen. NICHTS Spezifisches erfinden:
  keine Preise, Öffnungszeiten, Gerichte-Namen, Jahreszahlen oder Superlative, die nicht in der
  Notiz stehen oder Allgemeinwissen zu bekannten Sehenswürdigkeiten sind.
- Ton: warm, bildhaft, auf Augenhöhe (du-Form vermeiden, lieber beschreibend). Keine Emojis,
  keine Anführungszeichen, keine Ausrufe-Inflation.
- Antworte NUR mit einem JSON-Array: [{"order": <stop_order>, "note": "<Text>"}, ...] für ALLE Stops.`;

function buildInput(route, stops) {
  return JSON.stringify({
    route: {
      titel: route.title,
      stadt: route.city_slug,
      beschreibung: route.description,
      tags: route.tags,
    },
    stops: stops.map((s) => ({
      order: s.stop_order,
      titel: s.title,
      bisherige_notiz: s.note ?? "",
    })),
  });
}

function parseNotes(text) {
  const cleaned = text.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "").trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error("Antwort ist kein Array");
  return parsed;
}

async function enrichRoute(route, stops) {
  const pending = stops.filter((s) => !(s.meta && s.meta.note_enriched_at));
  if (pending.length === 0) return { slug: route.slug, updated: 0, skipped: stops.length };

  const resp = await openai.responses.create({
    model: "gpt-5.2",
    instructions: INSTRUCTIONS,
    input: buildInput(route, pending),
  });
  const notes = parseNotes(resp.output_text ?? "");
  const byOrder = new Map(notes.map((n) => [Number(n.order), String(n.note ?? "").trim()]));

  let updated = 0;
  for (const stop of pending) {
    const nextNote = byOrder.get(stop.stop_order);
    if (!nextNote || nextNote.length < 40) {
      console.warn(`  warn ${route.slug} #${stop.stop_order}: keine brauchbare Beschreibung erhalten`);
      continue;
    }
    if (!COMMIT) {
      console.log(`  dry ${route.slug} #${stop.stop_order} ${stop.title}:\n      ${nextNote}`);
      updated += 1;
      continue;
    }
    const meta = {
      ...(stop.meta && typeof stop.meta === "object" ? stop.meta : {}),
      ...(stop.meta?.original_note === undefined ? { original_note: stop.note ?? null } : {}),
      note_enriched_at: new Date().toISOString(),
    };
    const { error } = await sb
      .from("user_route_stops")
      .update({ note: nextNote, meta })
      .eq("id", stop.id);
    if (error) throw new Error(`${route.slug} #${stop.stop_order}: ${error.message}`);
    updated += 1;
  }
  return { slug: route.slug, updated, skipped: stops.length - pending.length };
}

(async () => {
  const { data: prof, error: profError } = await sb
    .from("creator_profiles")
    .select("user_id")
    .eq("username", "pd24-redaktion")
    .single();
  if (profError) throw profError;

  let routeQuery = sb
    .from("user_routes")
    .select("id,slug,title,city_slug,description,tags")
    .eq("user_id", prof.user_id)
    .order("slug");
  if (ROUTE_FILTER) routeQuery = routeQuery.eq("slug", ROUTE_FILTER);
  const { data: routes, error: routesError } = await routeQuery;
  if (routesError) throw routesError;

  const targets = LIMIT ? routes.slice(0, LIMIT) : routes;
  console.log(`${targets.length} Redaktions-Routen${COMMIT ? "" : " (Dry-Run)"}.`);

  let totalUpdated = 0, totalSkipped = 0, failed = 0, index = 0;
  async function worker() {
    while (index < targets.length) {
      const route = targets[index++];
      try {
        const { data: stops, error } = await sb
          .from("user_route_stops")
          .select("id,stop_order,title,note,meta")
          .eq("route_id", route.id)
          .order("stop_order");
        if (error) throw error;
        const result = await enrichRoute(route, stops ?? []);
        totalUpdated += result.updated;
        totalSkipped += result.skipped;
        if (result.updated > 0 && COMMIT) console.log(`ok   ${route.slug}: ${result.updated} Stops`);
      } catch (err) {
        failed += 1;
        console.error(`FEHLER ${route.slug}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`${COMMIT ? "Fertig" : "Dry-Run"}: ${totalUpdated} Beschreibungen, ${totalSkipped} bereits angereichert, ${failed} Routen fehlgeschlagen.`);
})();
