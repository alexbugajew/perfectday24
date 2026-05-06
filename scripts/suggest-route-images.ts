import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PLANNER_33_ROLLOUT } from "../lib/cities/rollout";

type SeedStop = {
  order: number;
  title: string;
  type?: string;
  address?: string;
  sourceUrls?: string[];
};

type SeedRoute = {
  citySlug: string;
  slug: string;
  title: string;
  description?: string;
  tags?: string[];
  sourceUrls?: string[];
  stops: SeedStop[];
};

type SeedFile = {
  version: number;
  routes: SeedRoute[];
};

type Provider = "openverse" | "wikimedia";
type TargetScope = "routes" | "stops" | "all";

type Options = {
  filePath: string;
  outPath: string;
  gapReportPath: string | null;
  cityFilter: Set<string> | null;
  routeFilter: Set<string> | null;
  limit: number | null;
  perTarget: number;
  queryLimit: number;
  providers: Provider[];
  targetScope: TargetScope;
  delayMs: number;
};

type OpenverseImage = {
  id?: string;
  title?: string | null;
  creator?: string | null;
  creator_url?: string | null;
  url?: string | null;
  thumbnail?: string | null;
  foreign_landing_url?: string | null;
  license?: string | null;
  license_version?: string | null;
  license_url?: string | null;
  provider?: string | null;
  source?: string | null;
  width?: number | null;
  height?: number | null;
};

type OpenverseResponse = {
  results?: OpenverseImage[];
};

type CommonsImageInfo = {
  url?: string;
  thumburl?: string;
  width?: number;
  height?: number;
  extmetadata?: Record<string, { value?: string | null }>;
};

type CommonsPage = {
  title?: string;
  fullurl?: string;
  imageinfo?: CommonsImageInfo[];
};

type CommonsResponse = {
  query?: {
    pages?: Record<string, CommonsPage>;
  };
};

type ImageCandidate = {
  id: string;
  provider: Provider;
  providerSource: string | null;
  query: string;
  title: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  landingUrl: string | null;
  width: number | null;
  height: number | null;
  license: string | null;
  licenseVersion: string | null;
  licenseUrl: string | null;
  creator: string | null;
  creatorUrl: string | null;
  attributionText: string;
  score: number;
  reviewRequired: true;
  usageNotes: string[];
};

type GapReport = {
  missingStopPhotos?: Array<{
    routeSlug?: string | null;
    stopOrder?: number | null;
  }>;
};

const DEFAULT_SEED_FILE = "data/editorial_routes/pilot_top5_influencer_routes.json";
const DEFAULT_OUT_FILE = "data/editorial_routes/pilot_top5_image_candidates.json";
const OPENVERSE_LICENSES = "cc0,pdm,by,by-sa";

let lastRequestAt = 0;

function parseArgs(): Options {
  const valueFor = (name: string) => {
    const prefix = `--${name}=`;
    const found = process.argv.find((value) => value.startsWith(prefix));
    return found ? found.slice(prefix.length) : null;
  };

  const splitSet = (value: string | null) =>
    value
      ? new Set(
          value
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
        )
      : null;

  const positiveInt = (name: string, fallback: number | null) => {
    const raw = valueFor(name);
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(`--${name} muss eine positive ganze Zahl sein.`);
    }
    return parsed;
  };

  const providersRaw = valueFor("providers") ?? "openverse,wikimedia";
  const providers = providersRaw
    .split(",")
    .map((provider) => provider.trim())
    .filter(Boolean)
    .map((provider) => {
      if (provider === "openverse" || provider === "wikimedia") return provider;
      throw new Error("--providers erlaubt nur openverse,wikimedia.");
    });

  const targetRaw = valueFor("target") ?? "all";
  if (targetRaw !== "routes" && targetRaw !== "stops" && targetRaw !== "all") {
    throw new Error("--target muss routes, stops oder all sein.");
  }

  return {
    filePath: resolve(process.cwd(), valueFor("file") ?? DEFAULT_SEED_FILE),
    outPath: resolve(process.cwd(), valueFor("out") ?? DEFAULT_OUT_FILE),
    gapReportPath: valueFor("gap-report") ? resolve(process.cwd(), valueFor("gap-report") as string) : null,
    cityFilter: splitSet(valueFor("city")),
    routeFilter: splitSet(valueFor("route")),
    limit: positiveInt("limit", null),
    perTarget: positiveInt("per-target", 3) ?? 3,
    queryLimit: positiveInt("query-limit", 1) ?? 1,
    providers,
    targetScope: targetRaw,
    delayMs: positiveInt("delay-ms", 700) ?? 700,
  };
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalizeKey(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stripHtml(value: unknown) {
  return normalizeText(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function germanSearchText(value: string) {
  return value
    .replace(/Muenchen/g, "M\u00fcnchen")
    .replace(/muenchen/g, "m\u00fcnchen")
    .replace(/Koeln/g, "K\u00f6ln")
    .replace(/koeln/g, "k\u00f6ln")
    .replace(/Duesseldorf/g, "D\u00fcsseldorf")
    .replace(/duesseldorf/g, "d\u00fcsseldorf")
    .replace(/Neukoelln/g, "Neuk\u00f6lln")
    .replace(/neukoelln/g, "neuk\u00f6lln")
    .replace(/Eimsbuettel/g, "Eimsb\u00fcttel")
    .replace(/eimsbuettel/g, "eimsb\u00fcttel")
    .replace(/Suelz/g, "S\u00fclz")
    .replace(/suelz/g, "s\u00fclz")
    .replace(/ae/g, "\u00e4")
    .replace(/oe/g, "\u00f6")
    .replace(/ue/g, "\u00fc")
    .replace(/Ae/g, "\u00c4")
    .replace(/Oe/g, "\u00d6")
    .replace(/Ue/g, "\u00dc")
    .replace(/Strasse/g, "Stra\u00dfe")
    .replace(/strasse/g, "stra\u00dfe")
    .replace(/\s+/g, " ")
    .trim();
}

function readSeed(filePath: string): SeedFile {
  if (!existsSync(filePath)) throw new Error(`Seed-Datei nicht gefunden: ${filePath}`);
  const seed = JSON.parse(readFileSync(filePath, "utf8")) as SeedFile;
  if (!Array.isArray(seed.routes)) throw new Error("Seed-Datei enthaelt keine routes.");
  return seed;
}

function readGapReport(path: string | null) {
  if (!path) return null;
  if (!existsSync(path)) throw new Error(`Gap-Report nicht gefunden: ${path}`);
  const report = JSON.parse(readFileSync(path, "utf8")) as GapReport;
  const missing = new Set<string>();
  for (const gap of report.missingStopPhotos ?? []) {
    if (!gap.routeSlug || typeof gap.stopOrder !== "number") continue;
    missing.add(`${gap.routeSlug}#${gap.stopOrder}`);
  }
  return missing;
}

function stringifyJsonAscii(value: unknown) {
  return JSON.stringify(value, null, 2).replace(/[^\x00-\x7f]/g, (char) => {
    return `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
}

function filterRoutes(routes: SeedRoute[], options: Options) {
  let out = routes.filter((route) => {
    if (options.cityFilter && !options.cityFilter.has(route.citySlug)) return false;
    if (options.routeFilter && !options.routeFilter.has(route.slug)) return false;
    return true;
  });
  if (options.limit !== null) out = out.slice(0, options.limit);
  return out;
}

function cityLabel(citySlug: string) {
  const city = PLANNER_33_ROLLOUT.find((entry) => entry.slug === citySlug || entry.aliasSlugs?.includes(citySlug));
  return city?.label ?? citySlug.replace(/-/g, " ");
}

function uniqueQueries(values: string[], limit: number) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    for (const variant of [germanSearchText(value), value]) {
      const normalized = normalizeText(variant);
      const key = normalizeKey(normalized);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(normalized);
      if (out.length >= limit) return out;
    }
  }

  return out;
}

function visualStops(route: SeedRoute) {
  const visualType = new Set(["sight", "viewpoint", "museum", "activity", "landmark"]);
  const preferred = route.stops.filter((stop) => visualType.has(normalizeKey(stop.type)));
  return (preferred.length > 0 ? preferred : route.stops).slice(0, 3);
}

function routeQueries(route: SeedRoute, queryLimit: number) {
  const city = cityLabel(route.citySlug);
  const visualTitles = visualStops(route).map((stop) => stop.title);
  return uniqueQueries([`${city} ${visualTitles.slice(0, 2).join(" ")}`, `${city} ${route.title}`, city], queryLimit);
}

function addressHints(address: string | undefined) {
  const normalized = normalizeText(address);
  if (!normalized) return [];
  const parts = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const noHouseNumber = normalized.replace(/\b\d+[a-z]?\b/gi, "").replace(/\s+/g, " ").trim();
  return [normalized, noHouseNumber, ...parts].filter(Boolean);
}

function stopTypeLabel(type: string | undefined) {
  const key = normalizeKey(type);
  if (key.includes("coffee")) return "cafe coffee";
  if (key.includes("bakery")) return "bakery patisserie cafe";
  if (key.includes("restaurant")) return "restaurant food";
  if (key.includes("bar") || key.includes("nightlife")) return "bar nightlife";
  if (key.includes("viewpoint")) return "viewpoint skyline";
  if (key.includes("sight") || key.includes("landmark")) return "landmark";
  if (key.includes("activity")) return "activity venue";
  return key;
}

function stopQueries(route: SeedRoute, stop: SeedStop, queryLimit: number) {
  const city = cityLabel(route.citySlug);
  const typeLabel = stopTypeLabel(stop.type);
  return uniqueQueries(
    [
      `${stop.title} ${city}`,
      `${stop.title} ${stop.address ?? ""}`,
      ...addressHints(stop.address),
      `${city} ${typeLabel}`,
      `${city} ${route.title}`,
      city,
    ],
    queryLimit
  );
}

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function waitForRequestSlot(delayMs: number) {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < delayMs) await sleep(delayMs - elapsed);
  lastRequestAt = Date.now();
}

function stableId(parts: Array<string | null | undefined>) {
  return createHash("sha1").update(parts.map((part) => part ?? "").join("|")).digest("hex").slice(0, 16);
}

function isOpenLicense(license: string | null) {
  const key = normalizeKey(license);
  if (!key) return false;
  if (key.includes("noncommercial") || key.includes("no derivatives") || key.includes("nc") || key.includes("nd")) {
    return false;
  }
  return (
    key === "cc0" ||
    key === "pdm" ||
    key === "by" ||
    key === "by sa" ||
    key.includes("public domain") ||
    key.includes("cc by") ||
    key.includes("creative commons attribution")
  );
}

function overlapScore(query: string, title: string | null) {
  const queryTokens = new Set(normalizeKey(query).split(" ").filter((token) => token.length >= 4));
  const titleTokens = new Set(normalizeKey(title).split(" ").filter((token) => token.length >= 4));
  if (queryTokens.size === 0 || titleTokens.size === 0) return 0;
  const hits = Array.from(queryTokens).filter((token) => titleTokens.has(token)).length;
  return Math.round((hits / queryTokens.size) * 30);
}

function scoreCandidate(candidate: Omit<ImageCandidate, "score">) {
  let score = candidate.provider === "wikimedia" ? 55 : 48;
  score += overlapScore(candidate.query, candidate.title);
  if (candidate.license && normalizeKey(candidate.license).match(/\b(cc0|pdm|public domain)\b/)) score += 12;
  else if (isOpenLicense(candidate.license)) score += 7;
  if (candidate.creator) score += 3;
  if (candidate.width && candidate.height && candidate.width >= candidate.height) score += 5;
  if (candidate.thumbnailUrl) score += 2;
  return Math.min(100, score);
}

function attributionText(candidate: {
  title: string | null;
  creator: string | null;
  license: string | null;
  licenseVersion: string | null;
  licenseUrl: string | null;
  provider: Provider;
  landingUrl: string | null;
}) {
  const title = candidate.title ? `"${candidate.title}"` : "Untitled image";
  const creator = candidate.creator ? ` by ${candidate.creator}` : "";
  const license = [candidate.license, candidate.licenseVersion].filter(Boolean).join(" ");
  const licensePart = license ? `, ${license}` : "";
  const source = candidate.provider === "wikimedia" ? "Wikimedia Commons" : "Openverse";
  const link = candidate.landingUrl ?? candidate.licenseUrl;
  return `${title}${creator}${licensePart}, via ${source}${link ? ` (${link})` : ""}.`;
}

function usageNotes(provider: Provider, license: string | null) {
  const notes = ["Vor Veroeffentlichung Bildmotiv, Lizenzseite und Attribution manuell pruefen."];
  if (provider === "openverse") {
    notes.push("Openverse aggregiert Lizenzdaten; die Originalquelle sollte vor Nutzung gegengeprueft werden.");
  }
  if (normalizeKey(license).includes("by sa")) {
    notes.push("CC BY-SA kann Share-Alike-Pflichten ausloesen; vor produktiver Nutzung bewusst freigeben.");
  }
  return notes;
}

function candidateFromOpenverse(query: string, image: OpenverseImage): ImageCandidate | null {
  const license = normalizeText(image.license) || null;
  if (!isOpenLicense(license)) return null;

  const candidateWithoutScore: Omit<ImageCandidate, "score"> = {
    id: stableId(["openverse", image.id, image.foreign_landing_url, image.url]),
    provider: "openverse",
    providerSource: normalizeText(image.source ?? image.provider) || null,
    query,
    title: normalizeText(image.title) || null,
    imageUrl: normalizeText(image.url) || null,
    thumbnailUrl: normalizeText(image.thumbnail) || null,
    landingUrl: normalizeText(image.foreign_landing_url) || null,
    width: typeof image.width === "number" ? image.width : null,
    height: typeof image.height === "number" ? image.height : null,
    license,
    licenseVersion: normalizeText(image.license_version) || null,
    licenseUrl: normalizeText(image.license_url) || null,
    creator: normalizeText(image.creator) || null,
    creatorUrl: normalizeText(image.creator_url) || null,
    attributionText: "",
    reviewRequired: true,
    usageNotes: usageNotes("openverse", license),
  };

  return {
    ...candidateWithoutScore,
    attributionText: attributionText(candidateWithoutScore),
    score: scoreCandidate(candidateWithoutScore),
  };
}

function commonsMeta(meta: Record<string, { value?: string | null }> | undefined, key: string) {
  return stripHtml(meta?.[key]?.value ?? "");
}

function candidateFromCommons(query: string, page: CommonsPage): ImageCandidate | null {
  const info = page.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata;
  const license = commonsMeta(meta, "LicenseShortName") || commonsMeta(meta, "UsageTerms") || null;
  if (!isOpenLicense(license)) return null;

  const title = commonsMeta(meta, "ObjectName") || normalizeText(page.title?.replace(/^File:/, "")) || null;
  const candidateWithoutScore: Omit<ImageCandidate, "score"> = {
    id: stableId(["wikimedia", page.title, info.url]),
    provider: "wikimedia",
    providerSource: "Wikimedia Commons",
    query,
    title,
    imageUrl: normalizeText(info.url) || null,
    thumbnailUrl: normalizeText(info.thumburl) || null,
    landingUrl: normalizeText(page.fullurl) || null,
    width: typeof info.width === "number" ? info.width : null,
    height: typeof info.height === "number" ? info.height : null,
    license,
    licenseVersion: null,
    licenseUrl: commonsMeta(meta, "LicenseUrl") || null,
    creator: commonsMeta(meta, "Artist") || commonsMeta(meta, "Credit") || null,
    creatorUrl: null,
    attributionText: "",
    reviewRequired: true,
    usageNotes: usageNotes("wikimedia", license),
  };

  return {
    ...candidateWithoutScore,
    attributionText: attributionText(candidateWithoutScore),
    score: scoreCandidate(candidateWithoutScore),
  };
}

async function searchOpenverse(query: string, limit: number, delayMs: number) {
  const url = new URL("https://api.openverse.org/v1/images/");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", String(Math.max(limit, 5)));
  url.searchParams.set("license", OPENVERSE_LICENSES);
  url.searchParams.set("mature", "false");

  await waitForRequestSlot(delayMs);
  let response = await fetch(url, { headers: { accept: "application/json" } });
  if (response.status === 429) {
    console.warn(`Openverse 429, warte und versuche erneut: ${query}`);
    await sleep(Math.max(delayMs * 4, 5000));
    response = await fetch(url, { headers: { accept: "application/json" } });
  }
  if (!response.ok) {
    console.warn(`Openverse ${response.status}: ${query}`);
    return [];
  }

  const data = (await response.json()) as OpenverseResponse;
  return (data.results ?? [])
    .map((image) => candidateFromOpenverse(query, image))
    .filter((candidate): candidate is ImageCandidate => Boolean(candidate))
    .slice(0, limit);
}

async function searchCommons(query: string, limit: number, delayMs: number) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrlimit", String(Math.max(limit, 5)));
  url.searchParams.set("prop", "imageinfo|info");
  url.searchParams.set("iiprop", "url|mime|size|extmetadata");
  url.searchParams.set("iiurlwidth", "1200");
  url.searchParams.set("inprop", "url");

  await waitForRequestSlot(delayMs);
  let response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "perfectday24-route-image-suggest/1.0",
    },
  });
  if (response.status === 429) {
    console.warn(`Wikimedia Commons 429, warte und versuche erneut: ${query}`);
    await sleep(Math.max(delayMs * 4, 5000));
    response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "perfectday24-route-image-suggest/1.0",
      },
    });
  }
  if (!response.ok) {
    console.warn(`Wikimedia Commons ${response.status}: ${query}`);
    return [];
  }

  const data = (await response.json()) as CommonsResponse;
  return Object.values(data.query?.pages ?? {})
    .map((page) => candidateFromCommons(query, page))
    .filter((candidate): candidate is ImageCandidate => Boolean(candidate))
    .slice(0, limit);
}

async function searchProvider(provider: Provider, query: string, limit: number, delayMs: number) {
  if (provider === "openverse") return searchOpenverse(query, limit, delayMs);
  return searchCommons(query, limit, delayMs);
}

function dedupeCandidates(candidates: ImageCandidate[], limit: number) {
  const seen = new Set<string>();
  return candidates
    .sort((a, b) => b.score - a.score)
    .filter((candidate) => {
      const key = normalizeKey(candidate.landingUrl ?? candidate.imageUrl ?? candidate.id);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

async function findCandidates(queries: string[], options: Options) {
  const candidates: ImageCandidate[] = [];
  for (const query of queries) {
    for (const provider of options.providers) {
      const found = await searchProvider(provider, query, options.perTarget, options.delayMs);
      candidates.push(...found);
    }
  }
  return dedupeCandidates(candidates, options.perTarget);
}

async function buildOutput(seed: SeedFile, routes: SeedRoute[], options: Options, missingStops: Set<string> | null) {
  const outputRoutes = [];
  let stopTargetCount = 0;
  let candidateCount = 0;
  const providerCounts: Record<string, number> = {};

  for (const route of routes) {
    const routeCandidates =
      options.targetScope === "routes" || options.targetScope === "all"
        ? await findCandidates(routeQueries(route, options.queryLimit), options)
        : [];
    candidateCount += routeCandidates.length;

    for (const candidate of routeCandidates) {
      providerCounts[candidate.provider] = (providerCounts[candidate.provider] ?? 0) + 1;
    }

    const stops = [];
    if (options.targetScope === "stops" || options.targetScope === "all") {
      for (const stop of route.stops.slice().sort((a, b) => a.order - b.order)) {
        if (missingStops && !missingStops.has(`${route.slug}#${stop.order}`)) continue;
        stopTargetCount += 1;
        const candidates = await findCandidates(stopQueries(route, stop, options.queryLimit), options);
        candidateCount += candidates.length;
        for (const candidate of candidates) {
          providerCounts[candidate.provider] = (providerCounts[candidate.provider] ?? 0) + 1;
        }
        stops.push({
          order: stop.order,
          title: stop.title,
          type: stop.type ?? null,
          recommendedCandidateId: candidates[0]?.id ?? null,
          candidates,
        });
        console.log(`${route.slug} stop ${stop.order}: ${candidates.length} Kandidaten`);
      }
    }

    outputRoutes.push({
      citySlug: route.citySlug,
      cityLabel: cityLabel(route.citySlug),
      routeSlug: route.slug,
      routeTitle: route.title,
      recommendedCoverCandidateId: routeCandidates[0]?.id ?? null,
      coverCandidates: routeCandidates,
      stops,
    });
    console.log(`${route.slug}: ${routeCandidates.length} Cover-Kandidaten`);
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    seedVersion: seed.version,
    seedFile: options.filePath,
    sourcePolicy: {
      autoPublished: false,
      allowedLicensesQueried: ["CC0", "Public Domain Mark", "CC BY", "CC BY-SA"],
      reviewRequired: true,
      notes: [
        "Diese Datei ist eine redaktionelle Shortlist, kein automatischer Rechte-Release.",
        "Vor Nutzung immer Landingpage, Lizenz, Autor und Motiv pruefen.",
        "CC BY-SA-Kandidaten bewusst freigeben, weil Share-Alike-Pflichten relevant sein koennen.",
      ],
    },
    summary: {
      routeTargets: routes.length,
      stopTargets: stopTargetCount,
      candidates: candidateCount,
      providers: providerCounts,
    },
    routes: outputRoutes,
  };
}

async function main() {
  const options = parseArgs();
  const seed = readSeed(options.filePath);
  const routes = filterRoutes(seed.routes, options);
  const missingStops = readGapReport(options.gapReportPath);
  if (routes.length === 0) throw new Error("Keine Routen nach Filterung uebrig.");

  const output = await buildOutput(seed, routes, options, missingStops);
  mkdirSync(dirname(options.outPath), { recursive: true });
  writeFileSync(options.outPath, `${stringifyJsonAscii(output)}\n`, "utf8");
  console.log(
    `Fertig: ${output.summary.routeTargets} Routen, ${output.summary.stopTargets} Stops, ${output.summary.candidates} Kandidaten -> ${options.outPath}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
