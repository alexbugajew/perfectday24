// Exportiert öffentliche PD24-Redaktions-Roadtrips als Pseudo-Seed für suggest-route-images.
// Eine Seed-"Route" pro Etappe: citySlug = slugifiziertes Städte-Label (damit cityLabel()-Fallback
// den echten Stadtnamen liefert), Stops = die ersten beiden plannedStops der Etappe.
const { readFileSync, writeFileSync } = require("fs");
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

function slugifyLabel(label) {
  return String(label ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "stadt";
}

(async () => {
  const { data: routes, error } = await sb
    .from("roadtrip_routes")
    .select("id,slug,title,visibility,author_name,cover_image_url,stops")
    .eq("visibility", "public")
    .eq("author_name", "PD24 Redaktion");
  if (error) throw error;

  const seedRoutes = [];
  let stageCount = 0;
  for (const rt of routes) {
    const stages = Array.isArray(rt.stops) ? rt.stops : [];
    stages.forEach((stage, idx) => {
      const cityLabel = stage.cityLabel || stage.citySlug || "";
      if (!cityLabel) return;
      const planned = Array.isArray(stage.plannedStops) ? stage.plannedStops : [];
      const picks = planned.slice(0, 2);
      const stops = picks.map((p, i) => ({
        order: i + 1,
        title: p.itemName || p.label || cityLabel,
        type: "landmark",
        address: cityLabel,
      }));
      if (stops.length === 0) stops.push({ order: 1, title: cityLabel, type: "landmark", address: cityLabel });
      stageCount += 1;
      seedRoutes.push({
        slug: `${rt.slug}::stage-${idx + 1}`,
        citySlug: slugifyLabel(cityLabel),
        title: `${cityLabel} – ${rt.title}`,
        theme: "roadtrip",
        tags: ["roadtrip"],
        sourceUrls: [],
        stops,
      });
    });
  }
  const out = { version: 1, createdAt: null, routes: seedRoutes };
  writeFileSync("tmp/roadtrip-stage-seed.json", JSON.stringify(out, null, 2));
  console.log(`Seed: ${routes.length} Roadtrips, ${stageCount} Etappen, ${seedRoutes.reduce((n, r) => n + r.stops.length, 0)} Stop-Ziele -> tmp/roadtrip-stage-seed.json`);
})();
