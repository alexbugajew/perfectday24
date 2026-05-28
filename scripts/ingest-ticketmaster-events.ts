import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  fetchTicketmasterEvents,
  normalizeTicketmasterEvent,
  type TicketmasterCityInput,
} from "../lib/events/ticketmaster";
import { reconcilePlannerEventQualityForCity } from "../lib/events/quality";

type CityRow = {
  slug: string;
  name: string;
  country_code: string | null;
  is_active: boolean | null;
};

const TICKETMASTER_CITY_QUERY_NAMES: Record<string, string> = {
  "berlin-berlin": "Berlin",
  duesseldorf: "Dusseldorf",
  "frankfurt-am-main": "Frankfurt",
  "freiburg-im-breisgau": "Freiburg",
  koeln: "Cologne",
  luebeck: "Lubeck",
  moenchengladbach: "Monchengladbach",
  muenchen: "Munich",
  muenster: "Munster",
};

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

function toIsoWindowStart(date: string) {
  return `${date}T00:00:00Z`;
}

function toIsoWindowEnd(date: string) {
  return `${date}T23:59:59Z`;
}

function nextDate(date: Date, days: number) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString().slice(0, 10);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ticketmasterCityName(city: Pick<CityRow, "slug" | "name">) {
  return TICKETMASTER_CITY_QUERY_NAMES[city.slug] ?? city.name;
}

/** Retry a fallible async operation up to `maxRetries` additional attempts with
 *  linear back-off.  Logs a warning on each transient failure so the CI log
 *  makes it clear that a retry happened. */
async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  maxRetries = 2,
  backoffMs = 2_000
): Promise<T> {
  let lastErr: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const wait = backoffMs * (attempt + 1);
        console.warn(
          `[retry] ${label}: Versuch ${attempt + 1}/${maxRetries + 1} fehlgeschlagen` +
          ` (${lastErr.name}: ${lastErr.message}), warte ${wait}ms …`
        );
        await sleep(wait);
      }
    }
  }
  throw lastErr ?? new Error(`${label}: Alle Versuche fehlgeschlagen`);
}

/** Custom fetch for the Supabase client: enforces a 30 s timeout using
 *  AbortController + clearTimeout so the timer is always removed when the
 *  request completes — avoiding the Node.js 24 / undici issue where
 *  AbortSignal.timeout() leaves a live timer that can abort unrelated requests
 *  in the same connection pool. */
function supabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  const signal = init?.signal
    ? (() => {
        // If the caller already passed a signal, chain both: abort when either fires.
        init.signal.addEventListener("abort", () => controller.abort(), { once: true });
        return controller.signal;
      })()
    : controller.signal;

  return fetch(input, { ...init, signal }).finally(() => clearTimeout(timeoutId));
}

async function main() {
  // Catch unhandled promise rejections and uncaught exceptions from background
  // tasks (e.g. Supabase internals, lingering undici timers) so they are logged
  // but do NOT crash the script mid-run.
  process.on("unhandledRejection", (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    console.error(
      `[ticketmaster] Unbehandelte Ablehnung (Hintergrund) [${err.name}]: ${err.message}`
    );
    if (err.stack) console.error(err.stack);
  });
  process.on("uncaughtException", (err) => {
    console.error(
      `[ticketmaster] Unbehandelter Fehler (Hintergrund) [${err.name}]: ${err.message}`
    );
    if (err.stack) console.error(err.stack);
  });

  const envPath = resolve(process.cwd(), ".env.local");
  loadEnvFile(envPath);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.TICKETMASTER_API_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen.");
  }
  if (!apiKey) {
    throw new Error("TICKETMASTER_API_KEY fehlt.");
  }

  const cityArg = parseArg("city");
  const fromArg = parseArg("from") ?? new Date().toISOString().slice(0, 10);
  const toArg = parseArg("to") ?? nextDate(new Date(`${fromArg}T00:00:00Z`), 30);
  const pageLimit = Math.max(1, Number(parseArg("pages") ?? "3"));
  const delayMs = Math.max(0, Number(parseArg("delay-ms") ?? "250"));
  const continueOnError = parseArg("continue-on-error") !== "false";

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: supabaseFetch as typeof fetch },
  });

  let cityQuery = supabase
    .from("cities")
    .select("slug, name, country_code, is_active")
    .eq("is_active", true)
    .order("population", { ascending: false, nullsFirst: false });

  if (cityArg) {
    const slugs = cityArg.split(",").map((value) => value.trim()).filter(Boolean);
    cityQuery = cityQuery.in("slug", slugs);
  }

  const { data: cityRows, error: cityError } = await cityQuery;
  if (cityError) {
    throw new Error(`Cities konnten nicht geladen werden: ${cityError.message}`);
  }

  const cities = ((cityRows ?? []) as CityRow[]).map((city) => ({
    slug: city.slug,
    name: city.name,
    ticketmasterName: ticketmasterCityName(city),
    countryCode: city.country_code,
  })) satisfies TicketmasterCityInput[];

  if (cities.length === 0) {
    throw new Error("Keine passenden aktiven Cities fuer den Import gefunden.");
  }

  let totalFetched = 0;
  let totalNormalized = 0;
  const failedCities: string[] = [];

  for (let cityIndex = 0; cityIndex < cities.length; cityIndex++) {
    const city = cities[cityIndex];
    if (cityIndex > 0 && delayMs > 0) {
      await sleep(delayMs);
    }

    const normalizedBatch = [];

    try {
      for (let page = 0; page < pageLimit; page++) {
        const json = await fetchTicketmasterEvents({
          apiKey,
          city,
          startDateTime: toIsoWindowStart(fromArg),
          endDateTime: toIsoWindowEnd(toArg),
          page,
          size: 200,
        });

        const events = json._embedded?.events ?? [];
        totalFetched += events.length;

        for (const event of events) {
          const normalized = normalizeTicketmasterEvent(event, city);
          if (normalized) {
            normalizedBatch.push(normalized);
            totalNormalized += 1;
          }
        }

        const totalPages = json.page?.totalPages ?? 1;
        if (page + 1 >= totalPages) break;
      }

      if (normalizedBatch.length === 0) {
        console.log(
          `[ticketmaster] ${city.slug} (${city.ticketmasterName ?? city.name}): keine normalisierten Events`
        );
        continue;
      }

      // Upsert with retry — transient Supabase / network blips shouldn't abort a run.
      const { error: upsertError } = await withRetry(
        `upsert:${city.slug}`,
        () =>
          supabase.from("planner_events").upsert(normalizedBatch, {
            onConflict: "source,external_id",
            ignoreDuplicates: false,
          })
      );

      if (upsertError) {
        throw new Error(
          `[ticketmaster] ${city.slug}: Upsert fehlgeschlagen: ${upsertError.message}`
        );
      }

      console.log(
        `[ticketmaster] ${city.slug} (${city.ticketmasterName ?? city.name}): ${normalizedBatch.length} Events bis ${toArg} gespeichert`
      );

      // Quality reconciliation with retry.
      const quality = await withRetry(
        `quality:${city.slug}`,
        () => reconcilePlannerEventQualityForCity(supabase, city.slug)
      );
      console.log(
        `[quality] ${city.slug}: ${quality.changed} Event-Status/Qualitaetsflags nachgezogen`
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      failedCities.push(`${city.slug}: ${err.message}`);
      console.error(
        `[ticketmaster] ${city.slug}: Import fehlgeschlagen [${err.name}]: ${err.message}`
      );
      // Log stack and cause for better diagnostics in CI.
      if (err.stack) console.error(err.stack);
      const cause = (err as NodeJS.ErrnoException & { cause?: unknown }).cause;
      if (cause) console.error(`[ticketmaster] ${city.slug}: Ursache:`, cause);
      if (!continueOnError) {
        throw error;
      }
    }
  }

  console.log(
    `[ticketmaster] fertig: ${cities.length} Staedte, ${totalFetched} raw events, ${totalNormalized} normalisiert`
  );

  if (failedCities.length > 0) {
    console.log(`[ticketmaster] fehlgeschlagen: ${failedCities.join(" | ")}`);
    if (failedCities.length === cities.length) {
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error("[ticketmaster] ingest failed:", error);
  process.exitCode = 1;
});
