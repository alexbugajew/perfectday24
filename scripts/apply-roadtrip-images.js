// Wendet CC-Bildkandidaten auf Roadtrip-Galerien an:
// media_assets (approved/public, mit Attribution) + roadtrip_media (role gallery),
// Cover-Backfill nur aus cc0/pdm (Hero zeigt keine Attribution).
// Aufruf: node tmp/apply-roadtrip-images.js [--commit]
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
const CANDIDATES_FILE = process.argv.find((a) => a.startsWith("--candidates="))?.slice("--candidates=".length) ?? "data/editorial_routes/roadtrip-stage-image-candidates.json";
const IMPORT_SOURCE = "pd24_roadtrip_stage_images";
const PD_LICENSES = new Set(["cc0", "pdm"]);

function norm(v) {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function tokens(v) {
  return norm(v).split(" ").filter((t) => t.length >= 4);
}
const SCAN_MARKERS = [
  "zeitschrift", "zeitung", "jahrbuch", "broschure", "broschuere", "denkschrift", "festschrift",
  "katalog", "verlag", "verein", "archiv", "urkunde", "handschrift", "manuskript", "titelblatt",
  "buchseite", "gartenkunst", "entomolog",
];
function looksLikeScanOrJunk(candidate) {
  const t = String(candidate.title ?? "");
  if (/<[a-z][^>]*>/i.test(t)) return "html-titel";
  if (/\.(pdf|djvu|tif|tiff)\b/i.test(t)) return "dokument-datei";
  const n = norm(t);
  for (const marker of SCAN_MARKERS) if (n.includes(marker)) return `scan:${marker}`;
  if (/\b(plate|tafel|seite|page)\s+\d+/i.test(t)) return "buchseite";
  return null;
}
function isRelevant(candidate, cityLabel, stopTitle) {
  const titleNorm = ` ${norm(candidate.title)} `;
  const wanted = [...tokens(cityLabel), ...tokens(stopTitle)];
  return wanted.some((tok) => titleNorm.includes(` ${tok}`)); // Prefix-Match erlaubt (Genitive etc.)
}

(async () => {
  const file = JSON.parse(readFileSync(CANDIDATES_FILE, "utf8"));
  const { data: prof, error: profError } = await sb
    .from("creator_profiles")
    .select("user_id")
    .eq("username", "pd24-redaktion")
    .single();
  if (profError) throw profError;
  const ownerUserId = prof.user_id;

  const { data: roadtrips, error: rtError } = await sb
    .from("roadtrip_routes")
    .select("id,slug,title,cover_image_url,visibility,author_name")
    .eq("visibility", "public")
    .eq("author_name", "PD24 Redaktion");
  if (rtError) throw rtError;
  const roadtripBySlug = new Map(roadtrips.map((r) => [r.slug, r]));

  const { data: existingMedia } = await sb.from("roadtrip_media").select("roadtrip_route_id");
  const hasMedia = new Set((existingMedia ?? []).map((m) => m.roadtrip_route_id));

  // Kandidaten je Roadtrip gruppieren (routeSlug = "<roadtripSlug>::stage-<n>")
  const perRoadtrip = new Map();
  for (const seedRoute of file.routes ?? []) {
    const [rtSlug, stagePart] = String(seedRoute.routeSlug).split("::stage-");
    if (!stagePart) continue;
    const stageIndex = Number(stagePart);
    const list = perRoadtrip.get(rtSlug) ?? [];
    list.push({ stageIndex, cityLabel: seedRoute.cityLabel, stops: seedRoute.stops ?? [] });
    perRoadtrip.set(rtSlug, list);
  }

  let galleryInserts = 0, coverUpdates = 0, skippedExisting = 0, emptyStages = 0, dropped = 0;
  for (const [rtSlug, stages] of perRoadtrip) {
    const roadtrip = roadtripBySlug.get(rtSlug);
    if (!roadtrip) continue;
    if (hasMedia.has(roadtrip.id)) { skippedExisting += 1; continue; }

    stages.sort((a, b) => a.stageIndex - b.stageIndex);
    const picks = [];
    const seenUrls = new Set();
    for (const stage of stages) {
      let chosen = null;
      for (const stop of stage.stops) {
        for (const candidate of stop.candidates ?? []) {
          const junk = looksLikeScanOrJunk(candidate);
          if (junk) { dropped += 1; continue; }
          if (!isRelevant(candidate, stage.cityLabel, stop.title)) { dropped += 1; continue; }
          if (seenUrls.has(candidate.imageUrl)) continue;
          chosen = { stage, stop, candidate };
          break;
        }
        if (chosen) break;
      }
      if (!chosen) { emptyStages += 1; continue; }
      seenUrls.add(chosen.candidate.imageUrl);
      picks.push(chosen);
    }
    if (picks.length === 0) continue;

    console.log(`${COMMIT ? "apply" : "dry-run"} ${rtSlug}: ${picks.length}/${stages.length} Etappen-Bilder`);
    if (!COMMIT) { galleryInserts += picks.length; continue; }

    const appliedAt = new Date().toISOString();
    for (let i = 0; i < picks.length; i += 1) {
      const { stage, stop, candidate } = picks[i];
      const storagePath = `external/${candidate.provider}/${candidate.id}`;
      // Gleiche Bilder können in mehreren Roadtrips gewählt sein -> Asset wiederverwenden.
      const { data: existingAsset } = await sb
        .from("media_assets")
        .select("id")
        .eq("bucket_id", "external")
        .eq("storage_path", storagePath)
        .maybeSingle();
      if (existingAsset?.id) {
        const { error: mediaError } = await sb.from("roadtrip_media").insert({
          roadtrip_route_id: roadtrip.id,
          asset_id: existingAsset.id,
          role: "gallery",
          is_primary: i === 0,
          sort_order: stage.stageIndex,
        });
        if (mediaError) throw new Error(`${rtSlug} Etappe ${stage.stageIndex}: roadtrip_media (reuse) fehlgeschlagen: ${mediaError.message}`);
        galleryInserts += 1;
        continue;
      }
      const { data: asset, error: assetError } = await sb
        .from("media_assets")
        .insert({
          owner_user_id: ownerUserId,
          source_type: "creator",
          bucket_id: "external",
          storage_path: storagePath,
          public_url: candidate.imageUrl,
          mime_type: "image/jpeg",
          alt_text: `${stop.title} (${stage.cityLabel})`,
          caption: `Etappe ${stage.stageIndex}: ${stage.cityLabel}`,
          credit_name: `${candidate.creator ?? "Unbekannt"} / ${candidate.license}${candidate.licenseVersion ? " " + candidate.licenseVersion : ""}`,
          moderation_status: "approved",
          rights_status: "confirmed",
          visibility: "public",
          consent_version: "cc-import-v1",
          consent_confirmed_at: appliedAt,
          meta: {
            import_source: IMPORT_SOURCE,
            provider: candidate.provider,
            candidate_id: candidate.id,
            license: candidate.license,
            license_url: candidate.licenseUrl ?? null,
            source_url: candidate.landingUrl ?? null,
            attribution_text: candidate.attributionText ?? null,
            applied_at: appliedAt,
          },
        })
        .select("id")
        .single();
      if (assetError) throw new Error(`${rtSlug} Etappe ${stage.stageIndex}: media_assets fehlgeschlagen: ${assetError.message}`);

      const { error: mediaError } = await sb.from("roadtrip_media").insert({
        roadtrip_route_id: roadtrip.id,
        asset_id: asset.id,
        role: "gallery",
        is_primary: i === 0,
        sort_order: stage.stageIndex,
      });
      if (mediaError) throw new Error(`${rtSlug} Etappe ${stage.stageIndex}: roadtrip_media fehlgeschlagen: ${mediaError.message}`);
      galleryInserts += 1;
    }

    if (!roadtrip.cover_image_url) {
      const pdPick = picks.find((p) => PD_LICENSES.has(String(p.candidate.license).toLowerCase()));
      if (pdPick) {
        const { error: coverError } = await sb
          .from("roadtrip_routes")
          .update({ cover_image_url: pdPick.candidate.imageUrl })
          .eq("id", roadtrip.id);
        if (coverError) throw new Error(`${rtSlug}: Cover-Update fehlgeschlagen: ${coverError.message}`);
        coverUpdates += 1;
      }
    }
  }
  console.log(`${COMMIT ? "Fertig" : "Dry-Run"}: ${galleryInserts} Galerie-Bilder, ${coverUpdates} Cover, ${skippedExisting} Roadtrips mit vorhandener Galerie uebersprungen, ${emptyStages} Etappen ohne brauchbaren Kandidaten, ${dropped} Kandidaten verworfen.`);
})();
