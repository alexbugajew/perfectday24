import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildPlanningContext } from "../lib/planner/context";
import { MAX_RETRIEVAL_CANDIDATES_API } from "../lib/planner/constants";
import { buildLocationSearchText, classify, getSubtypes, norm } from "../lib/planner/features";
import { buildInterestKeywords, preferenceBoost } from "../lib/planner/interest";
import { retrieveCandidates } from "../lib/planner/retrieval";
import { scoreRetrievalPriority } from "../lib/planner/retrieval/priority";
import { scoreCandidatesWithRelaxation } from "../lib/planner/scoring";
import { summarizeRoute } from "../lib/planner/summary";
import { buildPlanVariants } from "../lib/planner/variants";
import type {
  GroupMember,
  LocationRow,
  PlannerRequest,
  PlannedStop,
  RouteSummaryLite,
  ScoredLocation,
} from "../lib/planner/types";

type PreferenceFocus = "food" | "activity" | "sightseeing" | "nightlife" | "mixed";

type PreferenceCase = {
  id: string;
  title: string;
  focus: PreferenceFocus;
  targetInterests: string[];
  anchorLabels: string[];
  request: PlannerRequest;
};

type RetrievalCandidateReport = {
  id: string;
  name: string;
  category: string | null;
  subtypes: string[];
  retrievalPriority: number;
  preferenceScore: number;
  matchedInterests: string[];
};

type StopPreferenceReport = {
  index: number;
  label: string;
  locationName: string | null;
  category: string | null;
  matchedInterests: string[];
  preferenceScore: number;
  reasons: string[];
};

type CaseScore = {
  retrievalFit: number;
  stopDelivery: number;
  interestCoverage: number;
  anchorDelivery: number;
  total: number;
};

type CaseReport = {
  id: string;
  title: string;
  focus: PreferenceFocus;
  targetInterests: string[];
  recommendedVariantId: string | null;
  activeLevel: string;
  effectiveRadiusKm: number;
  topRetrievalCandidates: RetrievalCandidateReport[];
  plannedStops: StopPreferenceReport[];
  score: CaseScore;
  coverage: {
    deliveredInterests: string[];
    missingInterests: string[];
  };
  summary: RouteSummaryLite;
};

const MIN_CASE_SCORE = 5;
const MIN_TOTAL_SCORE = 60;

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

function makeMembers(count: number, interestSets: string[][]): GroupMember[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `pref-member-${index + 1}`,
    name: `Preference Member ${index + 1}`,
    interests: interestSets[index] ?? interestSets[0] ?? [],
  }));
}

function buildCases(): PreferenceCase[] {
  const berlinCenter = { label: "Berlin Mitte", lat: 52.5208, lng: 13.4095 };
  const berlinHbf = { label: "Berlin Hauptbahnhof", lat: 52.5251, lng: 13.3694 };
  const berlinZoo = { label: "Berlin Zoologischer Garten", lat: 52.5072, lng: 13.3373 };

  return [
    {
      id: "pref-01",
      title: "Date / Evening / Sushi + Rooftop + Walk",
      focus: "food",
      targetInterests: ["sushi", "rooftop", "walk"],
      anchorLabels: ["Moment zu zweit", "Highlight", "Ausklang"],
      request: {
        citySlug: "berlin-berlin",
        startPoint: { type: "address", ...berlinCenter },
        planMode: "evening",
        radiusKm: 6,
        budget: "medium",
        occasion: "date",
        interests: ["sushi", "rooftop", "walk"],
        group: { enabled: false, members: [] },
        sortMode: "match",
        routeProfile: "foot",
        evaluationMode: "trace",
      },
    },
    {
      id: "pref-02",
      title: "Date / Full Day / Italien + Museum + Park",
      focus: "mixed",
      targetInterests: ["italien", "museum", "park"],
      anchorLabels: ["Gemeinsame Aktivität", "Highlight", "Abendessen"],
      request: {
        citySlug: "berlin-berlin",
        startPoint: { type: "address", ...berlinCenter },
        planMode: "fullday",
        radiusKm: 8,
        budget: "medium",
        occasion: "date",
        interests: ["italien", "museum", "park"],
        group: { enabled: false, members: [] },
        sortMode: "match",
        routeProfile: "foot",
        evaluationMode: "trace",
      },
    },
    {
      id: "pref-03",
      title: "Friends / Midday / Bowling + Streetfood",
      focus: "activity",
      targetInterests: ["bowling", "streetfood", "park"],
      anchorLabels: ["Hauptaktivität", "Essen"],
      request: {
        citySlug: "berlin-berlin",
        startPoint: { type: "address", ...berlinCenter },
        planMode: "midday",
        radiusKm: 8,
        budget: "medium",
        occasion: "friends",
        interests: ["bowling", "streetfood", "park"],
        group: {
          enabled: true,
          members: makeMembers(4, [["bowling"], ["streetfood", "park"]]),
        },
        sortMode: "match",
        routeProfile: "foot",
        evaluationMode: "trace",
      },
    },
    {
      id: "pref-04",
      title: "Friends / Evening / Arcade + Burger + View",
      focus: "activity",
      targetInterests: ["arcade", "burger", "view"],
      anchorLabels: ["Erlebnis", "Peak"],
      request: {
        citySlug: "berlin-berlin",
        startPoint: { type: "address", ...berlinCenter },
        planMode: "evening",
        radiusKm: 7,
        budget: "medium",
        occasion: "friends",
        interests: ["arcade", "burger", "view"],
        group: {
          enabled: true,
          members: makeMembers(5, [["burger"], ["view"], ["arcade"]]),
        },
        sortMode: "match",
        routeProfile: "foot",
        evaluationMode: "trace",
      },
    },
    {
      id: "pref-05",
      title: "Family / Midday / Aquarium + Science + Cafe",
      focus: "activity",
      targetInterests: ["aquarium", "science", "cafe"],
      anchorLabels: ["Highlight", "Pause"],
      request: {
        citySlug: "berlin-berlin",
        startPoint: { type: "hotel", ...berlinZoo },
        planMode: "midday",
        radiusKm: 12,
        budget: "medium",
        occasion: "family",
        interests: ["aquarium", "science", "cafe"],
        group: {
          enabled: true,
          members: makeMembers(4, [["aquarium"], ["science"], ["cafe"]]),
        },
        sortMode: "match",
        routeProfile: "car",
        evaluationMode: "trace",
      },
    },
    {
      id: "pref-06",
      title: "Tourism / Full Day / Landmark + Museum + Viewpoint",
      focus: "sightseeing",
      targetInterests: ["landmark", "museum", "viewpoint", "local food"],
      anchorLabels: ["Highlight", "Kultur", "Abendessen"],
      request: {
        citySlug: "berlin-berlin",
        startPoint: { type: "station", ...berlinHbf },
        planMode: "fullday",
        radiusKm: 10,
        budget: "medium",
        occasion: "tourism",
        interests: ["landmark", "museum", "viewpoint", "local food"],
        group: { enabled: false, members: [] },
        sortMode: "match",
        routeProfile: "foot",
        evaluationMode: "trace",
      },
    },
    {
      id: "pref-07",
      title: "Tourism / Evening / Old Town + View + River + Dinner",
      focus: "sightseeing",
      targetInterests: ["old town", "view", "river", "dinner"],
      anchorLabels: ["Abend-Highlight", "Dinner", "Optionaler Abschluss"],
      request: {
        citySlug: "berlin-berlin",
        startPoint: { type: "address", ...berlinCenter },
        planMode: "evening",
        radiusKm: 5,
        budget: "medium",
        occasion: "tourism",
        interests: ["old town", "view", "river", "dinner"],
        group: { enabled: false, members: [] },
        sortMode: "match",
        routeProfile: "foot",
        evaluationMode: "trace",
      },
    },
    {
      id: "pref-08",
      title: "Party / Evening / Cocktails + Techno + Club + Late Food",
      focus: "nightlife",
      targetInterests: ["cocktails", "techno", "club", "late food"],
      anchorLabels: ["Pre-Drinks", "Peak", "Afterparty"],
      request: {
        citySlug: "berlin-berlin",
        startPoint: { type: "address", ...berlinCenter },
        planMode: "evening",
        radiusKm: 8,
        budget: "medium",
        occasion: "party",
        interests: ["cocktails", "techno", "club", "late food"],
        group: {
          enabled: true,
          members: makeMembers(6, [["cocktails", "techno"], ["club", "late food"]]),
        },
        sortMode: "match",
        routeProfile: "foot",
        evaluationMode: "trace",
      },
    },
    {
      id: "pref-09",
      title: "Friends / Midday / Klettern + Park + Coffee",
      focus: "activity",
      targetInterests: ["klettern", "park", "coffee"],
      anchorLabels: ["Hauptaktivität", "Essen"],
      request: {
        citySlug: "berlin-berlin",
        startPoint: { type: "address", ...berlinCenter },
        planMode: "midday",
        radiusKm: 8,
        budget: "medium",
        occasion: "friends",
        interests: ["klettern", "park", "coffee"],
        group: {
          enabled: true,
          members: makeMembers(3, [["klettern"], ["park"], ["coffee"]]),
        },
        sortMode: "match",
        routeProfile: "foot",
        evaluationMode: "trace",
      },
    },
    {
      id: "pref-10",
      title: "Date / Evening / Vegan + Wine + View",
      focus: "food",
      targetInterests: ["vegan", "wine", "view"],
      anchorLabels: ["Auftakt", "Moment zu zweit", "Ausklang"],
      request: {
        citySlug: "berlin-berlin",
        startPoint: { type: "address", ...berlinCenter },
        planMode: "evening",
        radiusKm: 6,
        budget: "medium",
        occasion: "date",
        interests: ["vegan", "wine", "view"],
        group: { enabled: false, members: [] },
        sortMode: "match",
        routeProfile: "foot",
        evaluationMode: "trace",
      },
    },
  ];
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("Missing Supabase env vars for preference regression runner.");
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loadLocations(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  request: PlannerRequest
) {
  const queryLimit = request.citySlug ? 12000 : 5000;

  let query = supabase
    .from("locations")
    .select(`
      id,
      name,
      type,
      budget,
      occasion,
      daytime,
      category,
      meal,
      manual_category,
      manual_meal,
      lat,
      lng,
      reservation_url,
      duration_min,
      tags,
      subtypes,
      audiences,
      occasions,
      city_slug,
      source_primary,
      source_refs,
      is_plannable,
      family_friendly,
      quality_score,
      importance_score,
      popularity_score,
      manual_boost,
      data_confidence,
      enrichment_version,
      last_enriched_at,
      quality_notes,
      opening_hours_raw,
      energy_level,
      indoor_outdoor,
      rating,
      rating_count,
      breakfast_fit,
      lunch_fit,
      dinner_fit,
      nightlife_fit,
      evening_only,
      daytime_fit
    `)
    .order("manual_boost", { ascending: false, nullsFirst: false })
    .order("quality_score", { ascending: false, nullsFirst: false })
    .order("importance_score", { ascending: false, nullsFirst: false })
    .order("popularity_score", { ascending: false, nullsFirst: false })
    .order("rating", { ascending: false, nullsFirst: false })
    .order("rating_count", { ascending: false, nullsFirst: false })
    .limit(queryLimit);

  if (request.citySlug) {
    query = query.eq("city_slug", request.citySlug);
  }

  query = query.eq("is_plannable", true);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Could not load locations: ${error.message}`);
  }

  return (data ?? []) as LocationRow[];
}

function directInterestMatch(loc: LocationRow, interest: string) {
  const keywords = buildInterestKeywords([interest]);
  return preferenceBoost(loc, keywords) > 0;
}

function matchedInterestsForLocation(loc: LocationRow, interests: string[]) {
  return interests.filter((interest) => directInterestMatch(loc, interest));
}

function categoryMatchesFocus(category: string | null, focus: PreferenceFocus) {
  if (focus === "food") return category === "restaurant" || category === "cafe";
  if (focus === "activity") {
    return category === "activity" || category === "culture" || category === "event";
  }
  if (focus === "sightseeing") return category === "activity" || category === "culture";
  if (focus === "nightlife") return category === "nightlife" || category === "event";
  return category !== null;
}

function scoreRetrievalFit(candidates: RetrievalCandidateReport[]) {
  const top10 = candidates.slice(0, 10);
  const hits = top10.filter((candidate) => candidate.matchedInterests.length > 0).length;
  if (hits >= 5) return 2;
  if (hits >= 3) return 1;
  return 0;
}

function scoreStopDelivery(stops: StopPreferenceReport[]) {
  const hits = stops.filter((stop) => stop.locationName && stop.matchedInterests.length > 0).length;
  if (hits >= 2) return 2;
  if (hits >= 1) return 1;
  return 0;
}

function scoreInterestCoverage(stops: StopPreferenceReport[], interests: string[]) {
  const delivered = new Set(
    stops.flatMap((stop) => stop.matchedInterests).map((interest) => norm(interest))
  );
  const covered = interests.filter((interest) => delivered.has(norm(interest))).length;
  if (covered >= Math.min(2, interests.length)) return 2;
  if (covered >= 1) return 1;
  return 0;
}

function scoreAnchorDelivery(
  testCase: PreferenceCase,
  stops: StopPreferenceReport[]
) {
  const anchors = stops.filter(
    (stop) =>
      stop.locationName &&
      testCase.anchorLabels.includes(stop.label) &&
      stop.matchedInterests.length > 0 &&
      categoryMatchesFocus(stop.category, testCase.focus)
  );

  if (anchors.length > 0) return 2;

  const fallback = stops.some(
    (stop) =>
      stop.locationName &&
      stop.matchedInterests.length > 0 &&
      categoryMatchesFocus(stop.category, testCase.focus)
  );

  return fallback ? 1 : 0;
}

function toRetrievalCandidateReport(
  candidate: ScoredLocation,
  interests: string[],
  context: ReturnType<typeof buildPlanningContext>
): RetrievalCandidateReport {
  const keywords = buildInterestKeywords(interests);

  return {
    id: candidate.id,
    name: candidate.name,
    category: classify(candidate),
    subtypes: getSubtypes(candidate),
    retrievalPriority: scoreRetrievalPriority(candidate, context),
    preferenceScore: preferenceBoost(candidate, keywords, context.interestWeights),
    matchedInterests: matchedInterestsForLocation(candidate, interests),
  };
}

function toStopPreferenceReport(stop: PlannedStop, interests: string[]): StopPreferenceReport {
  const item = stop.item;
  return {
    index: stop.index,
    label: stop.label,
    locationName: item?.name ?? null,
    category: item ? classify(item) : null,
    matchedInterests: item ? matchedInterestsForLocation(item, interests) : [],
    preferenceScore: item ? preferenceBoost(item, buildInterestKeywords(interests)) : 0,
    reasons: stop.reasons,
  };
}

async function runCase(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  testCase: PreferenceCase
): Promise<CaseReport> {
  const locations = await loadLocations(supabase, testCase.request);
  const context = buildPlanningContext(testCase.request);
  const retrieval = retrieveCandidates({
    locations,
    context,
    maxCandidates: MAX_RETRIEVAL_CANDIDATES_API,
  });
  const scoring = scoreCandidatesWithRelaxation({
    context,
    candidates: retrieval.candidates,
  });
  const variants = buildPlanVariants({
    context,
    candidates: scoring.results,
    planMode: testCase.request.planMode,
    stopOffsets: testCase.request.stopOffsets ?? [],
    variationSeed: testCase.request.variationSeed ?? 0,
  });

  const recommended = variants[0] ?? null;
  const plannedStops = (recommended?.plannedStops ?? []).map((stop) =>
    toStopPreferenceReport(stop, testCase.targetInterests)
  );
  const topRetrievalCandidates = scoring.results
    .slice(0, 20)
    .map((candidate) => toRetrievalCandidateReport(candidate, testCase.targetInterests, context));

  const retrievalFit = scoreRetrievalFit(topRetrievalCandidates);
  const stopDelivery = scoreStopDelivery(plannedStops);
  const interestCoverage = scoreInterestCoverage(plannedStops, testCase.targetInterests);
  const anchorDelivery = scoreAnchorDelivery(testCase, plannedStops);
  const total = retrievalFit + stopDelivery + interestCoverage + anchorDelivery;

  const delivered = Array.from(
    new Set(plannedStops.flatMap((stop) => stop.matchedInterests).map((interest) => norm(interest)))
  );
  const missing = testCase.targetInterests.filter(
    (interest) => !delivered.includes(norm(interest))
  );

  const summary =
    recommended?.fallbackSummary ??
    summarizeRoute({
      stops: (recommended?.plannedStops ?? []) as PlannedStop[],
      origin: { lat: context.origin.lat, lng: context.origin.lng },
    });

  return {
    id: testCase.id,
    title: testCase.title,
    focus: testCase.focus,
    targetInterests: testCase.targetInterests,
    recommendedVariantId: recommended?.variantId ?? null,
    activeLevel: scoring.activeLevel,
    effectiveRadiusKm: retrieval.effectiveRadiusKm,
    topRetrievalCandidates,
    plannedStops,
    summary,
    coverage: {
      deliveredInterests: delivered,
      missingInterests: missing,
    },
    score: {
      retrievalFit,
      stopDelivery,
      interestCoverage,
      anchorDelivery,
      total,
    },
  };
}

function buildMarkdownReport(reports: CaseReport[]) {
  const lines: string[] = [];
  const total = reports.reduce((sum, report) => sum + report.score.total, 0);

  lines.push("# Planner Preference Regression");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total score: ${total} / 80`);
  lines.push("");

  for (const report of reports) {
    lines.push(`## ${report.id} - ${report.title}`);
    lines.push(`Score: ${report.score.total} / 8`);
    lines.push(
      `Breakdown: Retrieval ${report.score.retrievalFit}, Stops ${report.score.stopDelivery}, Coverage ${report.score.interestCoverage}, Anchor ${report.score.anchorDelivery}`
    );
    lines.push(`Recommended variant: ${report.recommendedVariantId ?? "none"}`);
    lines.push(`Target interests: ${report.targetInterests.join(", ")}`);
    lines.push(`Delivered interests: ${report.coverage.deliveredInterests.join(", ") || "-"}`);
    lines.push(`Missing interests: ${report.coverage.missingInterests.join(", ") || "-"}`);
    lines.push("");
    lines.push("Planned stops:");
    for (const stop of report.plannedStops) {
      lines.push(
        `- ${stop.index}. ${stop.label}: ${stop.locationName ?? "[empty]"} (${stop.category ?? "n/a"}) | matches: ${stop.matchedInterests.join(", ") || "-"}`
      );
    }
    lines.push("");
    lines.push("Top retrieval candidates:");
    for (const candidate of report.topRetrievalCandidates.slice(0, 8)) {
      lines.push(
        `- ${candidate.name} | ${candidate.category ?? "n/a"} | pref ${candidate.preferenceScore} | matches: ${candidate.matchedInterests.join(", ") || "-"}`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  const envPath = join(process.cwd(), ".env.local");
  if (existsSync(envPath)) loadEnvFile(envPath);
  const supabase = getSupabaseAdmin();
  const cases = buildCases();
  const reports: CaseReport[] = [];

  for (const testCase of cases) {
    reports.push(await runCase(supabase, testCase));
  }

  const outDir = join(process.cwd(), "reports");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = join(outDir, `planner-preference-regression-${stamp}.json`);
  const mdPath = join(outDir, `planner-preference-regression-${stamp}.md`);

  writeFileSync(jsonPath, JSON.stringify(reports, null, 2), "utf8");
  writeFileSync(mdPath, buildMarkdownReport(reports), "utf8");

  const total = reports.reduce((sum, report) => sum + report.score.total, 0);
  const failedCases = reports.filter((report) => report.score.total < MIN_CASE_SCORE);

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Total score: ${total} / 80`);

  if (failedCases.length > 0) {
    console.error("Preference cases below threshold:");
    for (const report of failedCases) {
      console.error(`- ${report.id}: ${report.score.total} / 8`);
    }
    process.exitCode = 1;
    return;
  }

  if (total < MIN_TOTAL_SCORE) {
    console.error(`Preference total below threshold: ${total} < ${MIN_TOTAL_SCORE}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
