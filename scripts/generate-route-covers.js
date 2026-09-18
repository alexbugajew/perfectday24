// KI-Cover fuer redaktionelle Entdeckungspfade ohne CC-Foto-Cover.
// Gleiches Muster wie generate-roadtrip-covers.js (gpt-image-1, Upload nach
// partner-media, kein Text im Bild). Setzt zusaetzlich meta.image_attribution
// ("KI-generiert · PerfectDay24"), damit die Attribution vollstaendig ist und
// die ImageAttribution-Leiste einen sauberen Credit zeigt.
// Aufruf: node scripts/generate-route-covers.js [--commit] [--slug=a,b] [--limit=N]
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
const SLUG_FILTER = process.argv.find((a) => a.startsWith("--slug="))?.slice(7).split(",").map((s) => s.trim()).filter(Boolean) ?? null;
const STORAGE_BUCKET = "partner-media";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Motiv-Kern je Route: bekanntes Wahrzeichen + Themen-Stimmung. Bewusst
// eigenformuliert, editorialer Reisefoto-Stil, garantiert ohne Text im Bild.
const SCENES = {
  "marburg-grimm-dich-pfad": "Die malerische Fachwerk-Oberstadt von Marburg mit dem Landgrafenschloss hoch ueber verwinkelten Gassen, warmes goldenes Nachmittagslicht, leicht maerchenhafte Stimmung",
  "berlin-mauerweg-geschichtsmeile": "Erhaltene bemalte Reste der Berliner Mauer an der East Side Gallery entlang der Spree, im Hintergrund die Berliner Skyline, klares Tageslicht, ruhige zeitgeschichtliche Stimmung",
  "trier-roemerbauten": "Die roemische Porta Nigra in Trier, monumentales antikes Stadttor aus dunklem Sandstein, klarer Himmel, wuerdevolle Morgenstimmung",
  "augsburg-welterbe-wasser": "Die Augsburger Altstadt mit Rathaus und Perlachturm, im Vordergrund ein historischer Prachtbrunnen mit Wasserspiel, warmes Licht",
  "moers-geschichtsstationen": "Das weisse Schloss Moers mit Schlosspark und angrenzenden Altstadtgassen, freundliche ruhige Stadtstimmung, weiches Tageslicht",
  "potsdam-geheimdienststadt": "Ein herbstliches Potsdamer Villenviertel mit historischen Backsteinvillen und altem Baumbestand, ruhige, leicht melancholische Stimmung",
  "heidelberg-us-amerikaner-spuren": "Das Heidelberger Schloss ueber der Altstadt und der Alten Bruecke am Neckar, warmes Abendlicht, klassische Panoramastimmung",
  "fuerth-lauschtour": "Die Fuerther Altstadt mit praechtigen Gruenderzeit-Fassaden und historischem Rathausturm, lebendige Strassenszene, warmes Licht",
  "offenbach-industriekultur": "Historische Backstein-Fabrikarchitektur der Offenbacher Lederindustrie nahe dem Mainufer, industriekulturelle Stimmung, weiches Nachmittagslicht",
  "salzgitter-skulpturenweg": "Eine moderne abstrakte Stahlskulptur in weiter gruener Parklandschaft am Rand von Salzgitter-Bad, ruhige Kunst-im-Gruenen-Stimmung, weiches Tageslicht",
  "goettingen-wissenschaftspfad": "Der Gaenseliesel-Brunnen vor dem historischen Rathaus in der Goettinger Altstadt, lebendige Universitaetsstadt-Stimmung, klares Tageslicht",
  "osnabrueck-remarque-spuren": "Das historische Rathaus des Westfaelischen Friedens und die Marienkirche am Markt von Osnabrueck, warme, friedliche Altstadtstimmung",
};

function buildPrompt(scene) {
  return (
    `Elegantes, hochwertiges Reise-Titelbild im editorialen Reisefotografie-Stil: ${scene}. ` +
    `Ruhige Komposition mit Tiefe und Weite, natuerliche Farben, kein Mensch im Vordergrund erkennbar. ` +
    `WICHTIG: kein Text, keine Buchstaben, keine Zahlen, keine Logos, keine Wasserzeichen im Bild.`
  );
}

(async () => {
  const slugs = SLUG_FILTER ?? Object.keys(SCENES);
  const { data: rows, error } = await sb
    .from("user_routes")
    .select("id,slug,title,cover_image_url,meta")
    .in("slug", slugs);
  if (error) throw error;

  let targets = (rows ?? []).filter((r) => !r.cover_image_url && SCENES[r.slug]);
  if (LIMIT) targets = targets.slice(0, LIMIT);
  console.log(`${targets.length} Routen ohne Cover mit Motiv${LIMIT ? ` (Limit ${LIMIT})` : ""}.`);

  const openai = COMMIT ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
  let done = 0;
  for (const r of targets) {
    const prompt = buildPrompt(SCENES[r.slug]);
    if (!COMMIT) {
      console.log(`dry-run ${r.slug}:\n  ${prompt}\n`);
      continue;
    }
    try {
      const image = await openai.images.generate({ model: "gpt-image-1", prompt, size: "1536x1024", quality: "medium" });
      const b64 = image.data?.[0]?.b64_json;
      if (!b64) throw new Error("kein Bild zurueckgegeben");
      const buffer = Buffer.from(b64, "base64");
      const path = `route-covers/${r.id}/ai-${Date.now()}.png`;
      const { error: upErr } = await sb.storage.from(STORAGE_BUCKET).upload(path, buffer, { contentType: "image/png", upsert: false });
      if (upErr) throw upErr;
      const publicUrl = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
      const now = new Date().toISOString();
      const meta = { ...(r.meta && typeof r.meta === "object" ? r.meta : {}) };
      meta.image_attribution = {
        provider: "openai:gpt-image-1",
        title: "KI-generiertes Titelbild",
        license: "Eigenes Werk",
        creator: "PerfectDay24",
        attribution_text: "KI-generiert · PerfectDay24",
        apply_source: "ai-cover-generator",
        approved_at: now,
        review_required: false,
      };
      meta.image_review_status = "approved";
      meta.image_applied_at = now;
      meta.image_apply_source = "ai-cover-generator";
      const { error: updErr } = await sb.from("user_routes").update({ cover_image_url: publicUrl, meta }).eq("id", r.id);
      if (updErr) throw updErr;
      done += 1;
      console.log(`ok ${r.slug} -> ${path}`);
    } catch (e) {
      console.error(`FEHLER ${r.slug}: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`${COMMIT ? "Fertig" : "Dry-Run"}: ${COMMIT ? done : targets.length} Cover${COMMIT ? " generiert" : "-Prompts"}.`);
})();
