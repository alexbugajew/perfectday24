// KI-Cover für öffentliche PD24-Redaktions-Roadtrips ohne cover_image_url.
// Gleiches Muster wie die Einladungs-Bildgenerierung (gpt-image-1, 1536x1024,
// Upload nach partner-media, kein Text im Bild). Dry-Run zeigt nur die Prompts.
// Aufruf: node scripts/generate-roadtrip-covers.js [--commit] [--limit=N]
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
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.slice(8) ?? "0") || null;
const STORAGE_BUCKET = "partner-media";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const OCCASION_MOTIF = {
  jga: "ausgelassene, stilvolle Feier-Stimmung unter Freunden, goldene Abendsonne",
  family: "entspannte Familien-Reisestimmung, weiches Tageslicht",
  romantic: "romantische Zweisamkeit im Abendlicht",
  date: "romantische Zweisamkeit im Abendlicht",
};

function buildPrompt(rt) {
  const stages = Array.isArray(rt.stops) ? rt.stops : [];
  const cities = stages.map((s) => s.cityLabel).filter(Boolean).slice(0, 3);
  const landmarks = stages
    .flatMap((s) => (Array.isArray(s.plannedStops) ? s.plannedStops.slice(0, 1) : []))
    .map((p) => p.itemName || p.label)
    .filter(Boolean)
    .slice(0, 3);
  const occasionKey = String(rt.occasion ?? "").toLowerCase();
  const mood = OCCASION_MOTIF[occasionKey] ?? "stimmungsvolle Reiselust, weiche natürliche Farben";
  const route = cities.length > 1 ? `Roadtrip über ${cities.join(", ")}` : `Reise nach ${cities[0] ?? rt.title}`;
  const motifs = landmarks.length ? ` Erkennbare Motive dürfen anklingen: ${landmarks.join(", ")}.` : "";
  return (
    `Elegantes Reise-Titelbild: ${route}.${motifs} ${mood}. ` +
    `Hochwertiger editorialer Reisefotografie-Stil, ruhige Komposition mit Tiefe, leichte Weite (Straße, Küste oder Skyline). ` +
    `WICHTIG: kein Text, keine Buchstaben, keine Zahlen, keine Logos, keine Wasserzeichen im Bild.`
  );
}

(async () => {
  const { data: roadtrips, error } = await sb
    .from("roadtrip_routes")
    .select("id,slug,title,occasion,cover_image_url,stops")
    .eq("visibility", "public")
    .eq("author_name", "PD24 Redaktion")
    .is("cover_image_url", null);
  if (error) throw error;

  const targets = LIMIT ? roadtrips.slice(0, LIMIT) : roadtrips;
  console.log(`${targets.length} Roadtrips ohne Cover${LIMIT ? ` (Limit ${LIMIT})` : ""}.`);

  const openai = COMMIT ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
  let done = 0;
  for (const rt of targets) {
    const prompt = buildPrompt(rt);
    if (!COMMIT) {
      console.log(`dry-run ${rt.slug}:\n  ${prompt}\n`);
      continue;
    }
    try {
      const image = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        size: "1536x1024",
        quality: "medium",
      });
      const b64 = image.data?.[0]?.b64_json;
      if (!b64) throw new Error("kein Bild zurückgegeben");
      const buffer = Buffer.from(b64, "base64");
      const path = `roadtrip-covers/${rt.id}/ai-${Date.now()}.png`;
      const { error: uploadError } = await sb.storage
        .from(STORAGE_BUCKET)
        .upload(path, buffer, { contentType: "image/png", upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      const { error: updateError } = await sb
        .from("roadtrip_routes")
        .update({ cover_image_url: urlData.publicUrl })
        .eq("id", rt.id);
      if (updateError) throw updateError;
      done += 1;
      console.log(`ok ${rt.slug} -> ${path}`);
    } catch (genError) {
      console.error(`FEHLER ${rt.slug}: ${genError instanceof Error ? genError.message : genError}`);
    }
  }
  console.log(`${COMMIT ? "Fertig" : "Dry-Run"}: ${COMMIT ? done : targets.length} Cover${COMMIT ? " generiert" : "-Prompts"}.`);
})();
