import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  fetchOpenAgendaEvents,
  normalizeOpenAgendaEvent,
  parseOpenAgendaMapping,
} from "../lib/events/openagenda";
import { reconcilePlannerEventQualityForCity } from "../lib/events/quality";

function loadEnvFile(path: string) {
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function parseArg(name: string) {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

async function main() {
  const envPath = resolve(process.cwd(), ".env.local");
  loadEnvFile(envPath);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.OPENAGENDA_API_KEY;
  const mappingRaw = process.env.OPENAGENDA_AGENDAS;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen.");
  }
  if (!apiKey) {
    throw new Error("OPENAGENDA_API_KEY fehlt.");
  }

  const mapping = parseOpenAgendaMapping(mappingRaw);
  if (mapping.length === 0) {
    throw new Error(
      "OPENAGENDA_AGENDAS fehlt oder ist leer. Format: citySlug|agendaUid|City Name|DE|Label;..."
    );
  }

  const cityArg = parseArg("city");
  const pageLimit = Math.max(1, Number(parseArg("pages") ?? "3"));
  const selectedAgendas = cityArg
    ? mapping.filter((entry) => entry.citySlug === cityArg)
    : mapping;

  if (selectedAgendas.length === 0) {
    throw new Error("Keine passende OpenAgenda-Konfiguration fuer den Import gefunden.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let totalFetched = 0;
  let totalNormalized = 0;

  for (const agenda of selectedAgendas) {
    let after: Array<string | number> | null = null;
    const normalizedBatch = [];

    for (let page = 0; page < pageLimit; page++) {
      const json = await fetchOpenAgendaEvents({
        apiKey,
        agendaUid: agenda.uid,
        after,
        size: 100,
      });

      const events = json.events ?? [];
      totalFetched += events.length;

      for (const event of events) {
        const normalized = normalizeOpenAgendaEvent(event, agenda);
        if (normalized) {
          normalizedBatch.push(normalized);
          totalNormalized += 1;
        }
      }

      if (!json.after || events.length === 0) break;
      after = json.after;
    }

    if (normalizedBatch.length === 0) {
      console.log(`[openagenda] ${agenda.citySlug}/${agenda.uid}: keine normalisierten Events`);
      continue;
    }

    const { error: upsertError } = await supabase
      .from("planner_events")
      .upsert(normalizedBatch, {
        onConflict: "source,external_id",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      throw new Error(
        `[openagenda] ${agenda.citySlug}/${agenda.uid}: Upsert fehlgeschlagen: ${upsertError.message}`
      );
    }

    console.log(
      `[openagenda] ${agenda.citySlug}/${agenda.uid}: ${normalizedBatch.length} Events gespeichert`
    );

    const quality = await reconcilePlannerEventQualityForCity(supabase, agenda.citySlug);
    console.log(
      `[quality] ${agenda.citySlug}: ${quality.changed} Event-Status/Qualitätsflags nachgezogen`
    );
  }

  console.log(
    `[openagenda] fertig: ${selectedAgendas.length} Agenden, ${totalFetched} raw events, ${totalNormalized} normalisiert`
  );
}

main().catch((error) => {
  console.error("[openagenda] ingest failed:", error);
  process.exitCode = 1;
});
