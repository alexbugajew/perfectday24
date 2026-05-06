import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

type Candidate = {
  id: string;
  provider: string;
  providerSource: string | null;
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
  usageNotes: string[];
};

type CandidateStop = {
  order: number;
  title: string;
  type: string | null;
  recommendedCandidateId: string | null;
  candidates: Candidate[];
};

type CandidateRoute = {
  citySlug: string;
  cityLabel: string;
  routeSlug: string;
  routeTitle: string;
  recommendedCoverCandidateId: string | null;
  coverCandidates: Candidate[];
  stops: CandidateStop[];
};

type CandidateFile = {
  version: number;
  generatedAt: string;
  routes: CandidateRoute[];
};

type ReviewTarget = {
  approved: boolean;
  selectedCandidateId: string | null;
  notes: string;
  candidates: Candidate[];
};

type ReviewStop = {
  order: number;
  title: string;
  type: string | null;
  approved: boolean;
  selectedCandidateId: string | null;
  notes: string;
  candidates: Candidate[];
};

type ReviewRoute = {
  citySlug: string;
  cityLabel: string;
  routeSlug: string;
  routeTitle: string;
  cover: ReviewTarget;
  stops: ReviewStop[];
};

type ReviewFile = {
  version: number;
  generatedAt: string;
  candidatesFile: string;
  candidatesGeneratedAt: string | null;
  instructions: string[];
  routes: ReviewRoute[];
};

type Options = {
  candidatesPath: string;
  outPath: string;
  autoApprove: boolean;
  fresh: boolean;
  routeFilter: Set<string> | null;
  cityFilter: Set<string> | null;
};

const DEFAULT_CANDIDATES_FILE = "data/editorial_routes/pilot_top5_image_candidates.json";
const DEFAULT_REVIEW_FILE = "data/editorial_routes/pilot_top5_image_review.json";

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

  return {
    candidatesPath: resolve(process.cwd(), valueFor("candidates") ?? DEFAULT_CANDIDATES_FILE),
    outPath: resolve(process.cwd(), valueFor("out") ?? DEFAULT_REVIEW_FILE),
    autoApprove: process.argv.includes("--auto-approve"),
    fresh: process.argv.includes("--fresh"),
    routeFilter: splitSet(valueFor("route")),
    cityFilter: splitSet(valueFor("city")),
  };
}

function readJson<T>(path: string): T {
  if (!existsSync(path)) throw new Error(`Datei nicht gefunden: ${path}`);
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function compactCandidate(candidate: Candidate): Candidate {
  return {
    id: candidate.id,
    provider: candidate.provider,
    providerSource: candidate.providerSource ?? null,
    title: candidate.title ?? null,
    imageUrl: candidate.imageUrl ?? null,
    thumbnailUrl: candidate.thumbnailUrl ?? null,
    landingUrl: candidate.landingUrl ?? null,
    width: candidate.width ?? null,
    height: candidate.height ?? null,
    license: candidate.license ?? null,
    licenseVersion: candidate.licenseVersion ?? null,
    licenseUrl: candidate.licenseUrl ?? null,
    creator: candidate.creator ?? null,
    creatorUrl: candidate.creatorUrl ?? null,
    attributionText: candidate.attributionText,
    score: candidate.score,
    usageNotes: candidate.usageNotes ?? [],
  };
}

function stringifyJsonAscii(value: unknown) {
  return JSON.stringify(value, null, 2).replace(/[^\x00-\x7f]/g, (char) => {
    return `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
}

function previousRoute(review: ReviewFile | null, routeSlug: string) {
  return review?.routes.find((route) => route.routeSlug === routeSlug) ?? null;
}

function previousStop(route: ReviewRoute | null, order: number) {
  return route?.stops.find((stop) => stop.order === order) ?? null;
}

function mergeTarget(
  candidates: Candidate[],
  recommendedCandidateId: string | null,
  previous: { approved?: boolean; selectedCandidateId?: string | null; notes?: string } | null,
  autoApprove: boolean
): ReviewTarget {
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const previousSelection = previous?.selectedCandidateId ?? null;
  const selectedCandidateId =
    previousSelection && candidateIds.has(previousSelection) ? previousSelection : recommendedCandidateId;

  return {
    approved: Boolean(previous?.approved ?? (autoApprove && selectedCandidateId)),
    selectedCandidateId,
    notes: normalizeText(previous?.notes) || "",
    candidates: candidates.map(compactCandidate),
  };
}

function filterRoutes(routes: CandidateRoute[], options: Options) {
  return routes.filter((route) => {
    if (options.cityFilter && !options.cityFilter.has(route.citySlug)) return false;
    if (options.routeFilter && !options.routeFilter.has(route.routeSlug)) return false;
    return true;
  });
}

function buildReview(candidates: CandidateFile, previous: ReviewFile | null, options: Options): ReviewFile {
  const routes = filterRoutes(candidates.routes, options).map((route) => {
    const existingRoute = previousRoute(previous, route.routeSlug);
    return {
      citySlug: route.citySlug,
      cityLabel: route.cityLabel,
      routeSlug: route.routeSlug,
      routeTitle: route.routeTitle,
      cover: mergeTarget(
        route.coverCandidates ?? [],
        route.recommendedCoverCandidateId ?? null,
        existingRoute?.cover ?? null,
        options.autoApprove
      ),
      stops: (route.stops ?? []).map((stop) => {
        const existingStop = previousStop(existingRoute, stop.order);
        const merged = mergeTarget(
          stop.candidates ?? [],
          stop.recommendedCandidateId ?? null,
          existingStop ?? null,
          options.autoApprove
        );
        return {
          order: stop.order,
          title: stop.title,
          type: stop.type ?? null,
          approved: merged.approved,
          selectedCandidateId: merged.selectedCandidateId,
          notes: merged.notes,
          candidates: merged.candidates,
        };
      }),
    };
  });

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    candidatesFile: options.candidatesPath,
    candidatesGeneratedAt: candidates.generatedAt ?? null,
    instructions: [
      "Setze approved=true fuer jedes Bild, das live verwendet werden darf.",
      "selectedCandidateId kann auf einen anderen Kandidaten aus candidates gesetzt werden.",
      "approved=false oder selectedCandidateId=null bedeutet: beim Apply ueberspringen.",
      "Vor Freigabe bitte Motiv, Landingpage, Lizenz und Attribution pruefen.",
    ],
    routes,
  };
}

async function main() {
  const options = parseArgs();
  const candidates = readJson<CandidateFile>(options.candidatesPath);
  const previous = !options.fresh && existsSync(options.outPath) ? readJson<ReviewFile>(options.outPath) : null;
  const review = buildReview(candidates, previous, options);

  mkdirSync(dirname(options.outPath), { recursive: true });
  writeFileSync(options.outPath, `${stringifyJsonAscii(review)}\n`, "utf8");

  const routeTargets = review.routes.length;
  const coverCandidates = review.routes.filter((route) => route.cover.candidates.length > 0).length;
  const stopTargets = review.routes.flatMap((route) => route.stops);
  const stopsWithCandidates = stopTargets.filter((stop) => stop.candidates.length > 0).length;
  console.log(
    `Review-Datei geschrieben: ${routeTargets} Routen, ${coverCandidates} Cover-Ziele, ${stopsWithCandidates}/${stopTargets.length} Stop-Ziele mit Kandidaten -> ${options.outPath}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
