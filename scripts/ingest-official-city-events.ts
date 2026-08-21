import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { normalizePlannerEventTitle, refinePlannerEventCategory } from "../lib/planner/events";
import type { PlannerEventCategory } from "../lib/planner/types";

/**
 * Was tatsaechlich in die Datenbank geht: die Parser-Ausgabe, aber mit der
 * vollen Kategorien-Taxonomie statt des groben Parser-Satzes.
 */
type PreparedEvent = Omit<
  NonNullable<ReturnType<typeof normalizeVisitBerlinEvent>>,
  "category"
> & { category: PlannerEventCategory };
import {
  fetchVisitBerlinEvents,
  normalizeVisitBerlinEvent,
  type EventSourceConfigRow,
} from "../lib/events/official/visitberlin";
import {
  fetchBerlinDeEvents,
  enrichBerlinDeEvents,
  normalizeBerlinDeEvent,
} from "../lib/events/official/berlinde";
import {
  enrichHamburgTourismEvents,
  fetchHamburgTourismEvents,
  normalizeHamburgTourismEvent,
} from "../lib/events/official/hamburg";
import {
  fetchHamburgDeEvents,
  enrichHamburgDeEvents,
  normalizeHamburgDeEvent,
} from "../lib/events/official/hamburgde";
import {
  enrichHamburgInfomaxEvents,
  fetchHamburgInfomaxEvents,
  normalizeHamburgInfomaxEvent,
} from "../lib/events/official/hamburg-infomax";
import {
  fetchMuenchenDeEvents,
  normalizeMuenchenDeEvent,
} from "../lib/events/official/muenchen";
import {
  fetchFrankfurtTourismEvents,
  normalizeFrankfurtTourismEvent,
} from "../lib/events/official/frankfurt";
import {
  fetchKoelnTourismEvents,
  normalizeKoelnTourismEvent,
} from "../lib/events/official/koeln";
import {
  fetchDuesseldorfTourismEvents,
  normalizeDuesseldorfTourismEvent,
} from "../lib/events/official/duesseldorf";
import {
  fetchLeipzigTravelEvents,
  normalizeLeipzigTravelEvent,
} from "../lib/events/official/leipzig";
import {
  fetchDresdenTourismEvents,
  normalizeDresdenTourismEvent,
} from "../lib/events/official/dresden";
import {
  fetchHannoverTourismEvents,
  normalizeHannoverTourismEvent,
} from "../lib/events/official/hannover";
import {
  fetchNuernbergTourismEvents,
  normalizeNuernbergTourismEvent,
} from "../lib/events/official/nuernberg";
import {
  fetchBremenTourismEvents,
  normalizeBremenTourismEvent,
} from "../lib/events/official/bremen";
import {
  fetchStuttgartTourismEvents,
  normalizeStuttgartTourismEvent,
} from "../lib/events/official/stuttgart";
import {
  fetchDortmundTourismEvents,
  normalizeDortmundTourismEvent,
} from "../lib/events/official/dortmund";
import {
  fetchMannheimTourismEvents,
  normalizeMannheimTourismEvent,
} from "../lib/events/official/mannheim";
import {
  fetchWiesbadenTourismEvents,
  normalizeWiesbadenTourismEvent,
} from "../lib/events/official/wiesbaden";
import {
  fetchBonnCityEvents,
  normalizeBonnCityEvent,
} from "../lib/events/official/bonn";
import {
  fetchVisitEssenEvents,
  normalizeVisitEssenEvent,
} from "../lib/events/official/essen";
import {
  fetchKarlsruheTourismEvents,
  normalizeKarlsruheTourismEvent,
} from "../lib/events/official/karlsruhe";
import {
  fetchMuensterTourismEvents,
  normalizeMuensterTourismEvent,
} from "../lib/events/official/muenster";
import {
  fetchAachenCityEvents,
  normalizeAachenCityEvent,
} from "../lib/events/official/aachen";
import {
  fetchAugsburgCityEvents,
  normalizeAugsburgCityEvent,
} from "../lib/events/official/augsburg";
import {
  fetchKielSailingCityEvents,
  normalizeKielSailingCityEvent,
} from "../lib/events/official/kiel";
import {
  fetchBielefeldJetztEvents,
  normalizeBielefeldJetztEvent,
} from "../lib/events/official/bielefeld";
import {
  fetchBraunschweigRegionEvents,
  normalizeBraunschweigRegionEvent,
} from "../lib/events/official/braunschweig";
import {
  fetchBochumTourismEvents,
  normalizeBochumTourismEvent,
} from "../lib/events/official/bochum";
import {
  fetchDuisburgLiveEvents,
  normalizeDuisburgLiveEvent,
} from "../lib/events/official/duisburg";
import {
  fetchWuppertalLiveEvents,
  normalizeWuppertalLiveEvent,
} from "../lib/events/official/wuppertal";
import {
  fetchFreiburgEventportalEvents,
  normalizeFreiburgEventportalEvent,
} from "../lib/events/official/freiburg";
import {
  fetchLuebeckTourismEvents,
  normalizeLuebeckTourismEvent,
} from "../lib/events/official/luebeck";
import {
  fetchErfurtTourismEvents,
  normalizeErfurtTourismEvent,
} from "../lib/events/official/erfurt";
import {
  fetchMagdeburgCityEvents,
  normalizeMagdeburgCityEvent,
} from "../lib/events/official/magdeburg";
import {
  fetchMoenchengladbachCityEvents,
  normalizeMoenchengladbachCityEvent,
} from "../lib/events/official/moenchengladbach";
import {
  fetchGelsenkirchenCityEvents,
  normalizeGelsenkirchenCityEvent,
} from "../lib/events/official/gelsenkirchen";
import { reconcilePlannerEventQualityForCity } from "../lib/events/quality";

function loadEnvFile(path: string) {
  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return;
  }

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

function dedupeOfficialEvents<T extends { external_id: string }>(events: T[]) {
  const byId = new Map<string, T>();
  for (const event of events) {
    if (!event.external_id) continue;
    byId.set(event.external_id, event);
  }
  return Array.from(byId.values());
}

function chunkItems<T>(items: T[], size: number) {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const envPath = resolve(process.cwd(), ".env.local");
  loadEnvFile(envPath);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen.");
  }

  const providerArg = parseArg("provider") ?? "visitberlin";
  const cityArg = parseArg("city");
  const delayMs = Math.max(0, Number(parseArg("delay-ms") ?? "1000"));
  const continueOnError = parseArg("continue-on-error") !== "false";

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = supabase
    .from("event_source_configs")
    .select("provider, city_slug, country_code, base_url, parser_mode, label, notes, priority, is_active")
    .eq("is_active", true)
    .order("priority", { ascending: true });

  if (providerArg !== "all") {
    query = query.eq("provider", providerArg);
  }

  if (cityArg) {
    query = query.eq("city_slug", cityArg);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`event_source_configs konnten nicht geladen werden: ${error.message}`);
  }

  const configs = (data ?? []) as EventSourceConfigRow[];
  if (configs.length === 0) {
    throw new Error("Keine passenden aktiven offiziellen Stadtquellen gefunden.");
  }

  let totalFetched = 0;
  let totalNormalized = 0;
  // Quelle+Stadt, die in diesem Lauf geschrieben wurden — danach wird dort
  // aufgeraeumt.
  const touchedSources = new Set<string>();
  const runStartedAt = new Date().toISOString();
  const touchedCities = new Set<string>();
  const failedSources: string[] = [];

  for (let configIndex = 0; configIndex < configs.length; configIndex++) {
    const config = configs[configIndex];
    if (configIndex > 0 && delayMs > 0) {
      await sleep(delayMs);
    }

    try {
    let normalized: NonNullable<ReturnType<typeof normalizeVisitBerlinEvent>>[] = [];
    let rawCount = 0;

    if (config.provider === "visitberlin") {
      const rawEvents = await fetchVisitBerlinEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((thing) => normalizeVisitBerlinEvent(thing, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "berlin_de") {
      const rawEvents = await fetchBerlinDeEvents(config);
      rawCount = rawEvents.length;
      const enriched = await enrichBerlinDeEvents(rawEvents);
      normalized = enriched
        .flatMap(({ item, detail }) => normalizeBerlinDeEvent(item, detail, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "hamburg_tourism") {
      const rawEvents = await fetchHamburgTourismEvents(config);
      rawCount = rawEvents.length;
      const enriched = await enrichHamburgTourismEvents(rawEvents);
      normalized = enriched
        .map(({ card, detail }) => normalizeHamburgTourismEvent(card, detail, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "hamburg_de") {
      const rawEvents = await fetchHamburgDeEvents(config);
      rawCount = rawEvents.length;
      const enriched = await enrichHamburgDeEvents(rawEvents);
      normalized = enriched
        .flatMap(({ item, detail }) => normalizeHamburgDeEvent(item, detail, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "hamburg_infomax") {
      const rawEvents = await fetchHamburgInfomaxEvents(config);
      rawCount = rawEvents.length;
      const enriched = await enrichHamburgInfomaxEvents(rawEvents);
      normalized = enriched
        .map(({ card, detail }) => normalizeHamburgInfomaxEvent(card, detail, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "muenchen_de") {
      const rawEvents = await fetchMuenchenDeEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((thing) => normalizeMuenchenDeEvent(thing, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "frankfurt_tourism") {
      const rawEvents = await fetchFrankfurtTourismEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map(({ card, detail }) => normalizeFrankfurtTourismEvent(card, detail, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "koeln_tourism") {
      const rawEvents = await fetchKoelnTourismEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map(({ card, detail }) => normalizeKoelnTourismEvent(card, detail, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "duesseldorf_tourism") {
      const rawEvents = await fetchDuesseldorfTourismEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map(({ card, detail }) => normalizeDuesseldorfTourismEvent(card, detail, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "leipzig_travel") {
      const rawEvents = await fetchLeipzigTravelEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map(({ card, detail }) => normalizeLeipzigTravelEvent(card, detail, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "dresden_tourism") {
      const rawEvents = await fetchDresdenTourismEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeDresdenTourismEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "hannover_tourism") {
      const rawEvents = await fetchHannoverTourismEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeHannoverTourismEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "nuernberg_tourism") {
      const rawEvents = await fetchNuernbergTourismEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeNuernbergTourismEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "bremen_tourism") {
      const rawEvents = await fetchBremenTourismEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeBremenTourismEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "stuttgart_tourism") {
      const rawEvents = await fetchStuttgartTourismEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeStuttgartTourismEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "dortmund_tourism") {
      const rawEvents = await fetchDortmundTourismEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeDortmundTourismEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "mannheim_tourism") {
      const rawEvents = await fetchMannheimTourismEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeMannheimTourismEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "wiesbaden_tourism") {
      const rawEvents = await fetchWiesbadenTourismEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeWiesbadenTourismEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "bonn_city") {
      const rawEvents = await fetchBonnCityEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeBonnCityEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "visit_essen") {
      const rawEvents = await fetchVisitEssenEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeVisitEssenEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "karlsruhe_tourism") {
      const rawEvents = await fetchKarlsruheTourismEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeKarlsruheTourismEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "muenster_tourism") {
      const rawEvents = await fetchMuensterTourismEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeMuensterTourismEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "aachen_city") {
      const rawEvents = await fetchAachenCityEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeAachenCityEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "augsburg_city") {
      const rawEvents = await fetchAugsburgCityEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeAugsburgCityEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "kiel_sailing_city") {
      const rawEvents = await fetchKielSailingCityEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeKielSailingCityEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "bielefeld_jetzt") {
      const rawEvents = await fetchBielefeldJetztEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeBielefeldJetztEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "braunschweig_region") {
      const rawEvents = await fetchBraunschweigRegionEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeBraunschweigRegionEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "bochum_tourism") {
      const rawEvents = await fetchBochumTourismEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeBochumTourismEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "duisburg_live") {
      const rawEvents = await fetchDuisburgLiveEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeDuisburgLiveEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "wuppertal_live") {
      const rawEvents = await fetchWuppertalLiveEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeWuppertalLiveEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "freiburg_eventportal") {
      const rawEvents = await fetchFreiburgEventportalEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeFreiburgEventportalEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "luebeck_tourism") {
      const rawEvents = await fetchLuebeckTourismEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeLuebeckTourismEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "erfurt_tourism") {
      const rawEvents = await fetchErfurtTourismEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeErfurtTourismEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "magdeburg_city") {
      const rawEvents = await fetchMagdeburgCityEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeMagdeburgCityEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "moenchengladbach_city") {
      const rawEvents = await fetchMoenchengladbachCityEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeMoenchengladbachCityEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (config.provider === "gelsenkirchen_city") {
      const rawEvents = await fetchGelsenkirchenCityEvents(config);
      rawCount = rawEvents.length;
      normalized = rawEvents
        .map((item) => normalizeGelsenkirchenCityEvent(item, config))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else {
      console.log(`[official] ${config.provider}/${config.city_slug}: noch kein Parser implementiert`);
      continue;
    }

    totalFetched += rawCount;

    // Manche Stadtportale stellen dem Veranstaltungsnamen die Datumsspanne des
    // Gesamtfestivals voran ("24. September bis 3. Oktober 2026 FilmFest
    // Hamburg") und liefern dazu eine Zeile pro Tag. In einem Tagesplan stand
    // damit sichtbar ein Datum, das nicht zum Termin der Zeile passt.
    //
    // Bereinigt wird zentral fuer alle Anbieter statt in jedem Parser einzeln —
    // und mit derselben Funktion, die auch beim Anzeigen greift, damit es nur
    // eine Regel gibt. Der Rohtitel bleibt in source_payload erhalten.
    // Ausstellung und Comedy kannte die Taxonomie bis 08/2026 nicht, weshalb
    // rund 30 Stadt-Parser Ausstellungen auf "fair" und Comedy auf "show"
    // ablegen. Die Parser behalten ihren groben Satz — die Verfeinerung ist ein
    // eigener, zentraler Schritt, sonst muessten alle 30 angefasst werden.
    const prepared: PreparedEvent[] = dedupeOfficialEvents(
      normalized.map((item) => {
        const title = item.title ? normalizePlannerEventTitle(item.title) : item.title;
        return {
          ...item,
          title,
          category: refinePlannerEventCategory({ category: item.category, title }),
        };
      })
    );

    totalNormalized += prepared.length;
    touchedCities.add(config.city_slug);

    if (prepared.length === 0) {
      console.log(`[official] ${config.provider}/${config.city_slug}: keine normalisierten Events`);
      continue;
    }

    const sourceName = prepared[0]?.source;
    // Frueher wurde hier alles zu Quelle und Stadt geloescht und anschliessend
    // neu geschrieben. Das vergab bei jedem Lauf frische UUIDs — und liess damit
    // jeden geteilten Link auf /events/<stadt>/<eventId> sterben, sobald der
    // Cron lief. Ausserdem gab es ein Zeitfenster, in dem eine Stadt gar keine
    // Veranstaltungen hatte.
    //
    // Jetzt aktualisiert der Upsert ueber (source, external_id) an Ort und
    // Stelle; die IDs bleiben. Aufgeraeumt wird nach dem Lauf ueber
    // last_seen_at — siehe unten.
    if (sourceName) {
      touchedSources.add(`${sourceName}::${config.city_slug}`);
    }

    for (const batch of chunkItems(prepared, 80)) {
      const { error: upsertError } = await supabase
        .from("planner_events")
        .upsert(batch, {
          onConflict: "source,external_id",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        throw new Error(
          `[official] ${config.provider}/${config.city_slug}: Upsert fehlgeschlagen: ${upsertError.message}`
        );
      }
    }

    console.log(
      `[official] ${config.provider}/${config.city_slug}: ${normalized.length} Events gespeichert`
    );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failedSources.push(`${config.provider}/${config.city_slug}: ${message}`);
      console.error(`[official] ${config.provider}/${config.city_slug}: Import fehlgeschlagen: ${message}`);
      if (!continueOnError) {
        throw error;
      }
    }
  }

  // Aufraeumen: Was in diesem Lauf nicht mehr geliefert wurde, ist bei der
  // Quelle verschwunden und kann weg. Alles andere behaelt seine ID.
  //
  // Der Vergleich laeuft ueber last_seen_at, das jeder Upsert auf den aktuellen
  // Lauf setzt. Faellt eine Quelle einmal teilweise aus, verschwinden nur die
  // fehlenden Zeilen — vorher waeren es alle gewesen.
  for (const key of touchedSources) {
    const [sourceName, citySlug] = key.split("::");
    const { error: cleanupError, count } = await supabase
      .from("planner_events")
      .delete({ count: "exact" })
      .eq("source", sourceName)
      .eq("city_slug", citySlug)
      .lt("last_seen_at", runStartedAt);

    if (cleanupError) {
      console.error(`[official] ${sourceName}/${citySlug}: Aufraeumen fehlgeschlagen: ${cleanupError.message}`);
      continue;
    }
    if (count && count > 0) {
      console.log(`[official] ${sourceName}/${citySlug}: ${count} verschwundene Events entfernt`);
    }
  }

  for (const citySlug of touchedCities) {
    const quality = await reconcilePlannerEventQualityForCity(supabase, citySlug);
    console.log(
      `[quality] ${citySlug}: ${quality.changed} Event-Status/Qualitätsflags nachgezogen`
    );
  }

  console.log(
    `[official] fertig: ${configs.length} Quellen, ${totalFetched} raw events, ${totalNormalized} normalisiert`
  );

  if (failedSources.length > 0) {
    console.log(`[official] fehlgeschlagen: ${failedSources.join(" | ")}`);
    if (failedSources.length === configs.length) {
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error("[official] ingest failed:", error);
  process.exitCode = 1;
});
