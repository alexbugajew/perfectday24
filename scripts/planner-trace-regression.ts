import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildPlanningContext } from "../lib/planner/context";
import { buildPlanVariants } from "../lib/planner/variants";
import { retrieveCandidates } from "../lib/planner/retrieval";
import { scoreCandidatesWithRelaxation } from "../lib/planner/scoring";
import { summarizeRoute } from "../lib/planner/summary";
import { MAX_RETRIEVAL_CANDIDATES_API } from "../lib/planner/constants";
import { scoreRetrievalPriority } from "../lib/planner/retrieval/priority";
import { classify, getSubtypes } from "../lib/planner/features";
import type {
  GroupMember,
  LocationRow,
  OccasionKey,
  PlanMode,
  PlannerRequest,
  PlanVariant,
  PlannedStop,
  RouteSummaryLite,
} from "../lib/planner/types";

type RegressionCase = {
  id: string;
  title: string;
  request: PlannerRequest;
};

type RetrievalCandidateReport = {
  id: string;
  name: string;
  category: string | null;
  subtypes: string[];
  distanceKm: number | null;
  retrievalPriority: number;
  retrievalReasons: string[];
};

type StopReport = {
  index: number;
  label: string;
  hint: string;
  locationName: string | null;
  category: string | null;
  travelMinFromPrev: number | null;
  durationMin: number | null;
  reasons: string[];
};

type VariantReport = {
  variantId: string;
  label: string;
  reason: string;
  badges: string[];
  stopNames: string[];
  summary: RouteSummaryLite;
};

type CaseScore = {
  retrievalFit: number;
  occasionIntegrity: number;
  slotFlow: number;
  routeQuality: number;
  variantSeparation: number;
  total: number;
};

type GuardrailResult = {
  passed: boolean;
  failures: string[];
};

type CaseReport = {
  id: string;
  title: string;
  input: PlannerRequest;
  effectiveRadiusKm: number;
  activeLevel: string;
  topRetrievalCandidates: RetrievalCandidateReport[];
  recommendedVariantId: string | null;
  plannedStops: StopReport[];
  variants: VariantReport[];
  score: CaseScore;
  guardrails: GuardrailResult;
};

const MIN_CASE_SCORE = 8;
const MIN_REGRESSION_TOTAL_SCORE = 90;

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
    id: `member-${index + 1}`,
    name: `Member ${index + 1}`,
    interests: interestSets[index] ?? interestSets[0] ?? [],
  }));
}

function buildCases(): RegressionCase[] {
  const berlinCenter = { label: "Berlin Mitte", lat: 52.5208, lng: 13.4095 };
  const berlinHbf = { label: "Berlin Hauptbahnhof", lat: 52.5251, lng: 13.3694 };
  const berlinZoo = { label: "Berlin Zoologischer Garten", lat: 52.5072, lng: 13.3373 };

  return [
    {
      id: "case-01",
      title: "Date / Evening / Urban / Walkable",
      request: {
        citySlug: "berlin-berlin",
        startPoint: { type: "address", ...berlinCenter },
        planMode: "evening",
        radiusKm: 6,
        budget: "medium",
        occasion: "date",
        interests: ["wine", "rooftop", "sushi", "walk"],
        group: { enabled: false, members: [] },
        sortMode: "match",
        routeProfile: "foot",
        evaluationMode: "trace",
      },
    },
    {
      id: "case-02",
      title: "Date / Full Day / Mixed City Day",
      request: {
        citySlug: "berlin-berlin",
        startPoint: { type: "address", ...berlinCenter },
        planMode: "fullday",
        radiusKm: 8,
        budget: "medium",
        occasion: "date",
        interests: ["museum", "coffee", "park", "italien"],
        group: { enabled: false, members: [] },
        sortMode: "match",
        routeProfile: "foot",
        evaluationMode: "trace",
      },
    },
    {
      id: "case-03",
      title: "Friends / Midday / Aktiv & Social",
      request: {
        citySlug: "berlin-berlin",
        startPoint: { type: "address", ...berlinCenter },
        planMode: "midday",
        radiusKm: 8,
        budget: "medium",
        occasion: "friends",
        interests: ["bowling", "streetfood", "park", "cocktails"],
        group: {
          enabled: true,
          members: makeMembers(4, [
            ["bowling", "cocktails"],
            ["streetfood", "park"],
          ]),
        },
        sortMode: "match",
        routeProfile: "foot",
        evaluationMode: "trace",
      },
    },
    {
      id: "case-04",
      title: "Friends / Evening / Social, aber nicht Party",
      request: {
        citySlug: "berlin-berlin",
        startPoint: { type: "address", ...berlinCenter },
        planMode: "evening",
        radiusKm: 7,
        budget: "medium",
        occasion: "friends",
        interests: ["burger", "arcade", "bar", "view"],
        group: {
          enabled: true,
          members: makeMembers(5, [
            ["burger", "bar"],
            ["view", "arcade"],
          ]),
        },
        sortMode: "match",
        routeProfile: "foot",
        evaluationMode: "trace",
      },
    },
    {
      id: "case-05",
      title: "Family / Full Day / Urban Family Day",
      request: {
        citySlug: "berlin-berlin",
        startPoint: { type: "hotel", ...berlinZoo },
        planMode: "fullday",
        radiusKm: 15,
        budget: "medium",
        occasion: "family",
        interests: ["zoo", "park", "ice cream", "museum"],
        group: {
          enabled: true,
          members: makeMembers(4, [
            ["zoo", "park"],
            ["ice cream", "museum"],
          ]),
        },
        sortMode: "match",
        routeProfile: "car",
        evaluationMode: "trace",
      },
    },
    {
      id: "case-06",
      title: "Family / Midday / Wetterunabhaengig",
      request: {
        citySlug: "berlin-berlin",
        startPoint: { type: "hotel", ...berlinCenter },
        planMode: "midday",
        radiusKm: 12,
        budget: "medium",
        occasion: "family",
        interests: ["aquarium", "science", "cafe"],
        group: {
          enabled: true,
          members: makeMembers(4, [
            ["aquarium", "science"],
            ["cafe"],
          ]),
        },
        sortMode: "match",
        routeProfile: "car",
        evaluationMode: "trace",
      },
    },
    {
      id: "case-07",
      title: "Tourism / Full Day / Sightseeing Core",
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
      id: "case-08",
      title: "Tourism / Evening / Scenic + Dinner",
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
      id: "case-09",
      title: "Party / Evening / Bar to Club to After",
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
          members: makeMembers(6, [
            ["cocktails", "techno"],
            ["club", "late food"],
          ]),
        },
        sortMode: "match",
        routeProfile: "foot",
        evaluationMode: "trace",
      },
    },
    {
      id: "case-10",
      title: "Party / Full Day / JGA-artiger Verlauf",
      request: {
        citySlug: "berlin-berlin",
        startPoint: { type: "address", ...berlinCenter },
        planMode: "fullday",
        radiusKm: 20,
        budget: "medium",
        occasion: "party",
        interests: ["activity", "beer", "bar", "club", "late food"],
        group: {
          enabled: true,
          members: makeMembers(8, [
            ["activity", "beer"],
            ["bar", "club"],
            ["late food"],
          ]),
        },
        sortMode: "match",
        routeProfile: "car",
        evaluationMode: "trace",
      },
    },
  ];
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("Missing Supabase env vars for regression runner.");
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

function scoreRetrievalFit(topCandidates: RetrievalCandidateReport[]) {
  if (topCandidates.length === 0) return 0;
  const top10 = topCandidates.slice(0, 10);
  const dominant = top10.filter(
    (candidate) => candidate.category !== "other" && candidate.retrievalPriority > 0
  ).length;
  if (dominant >= 8) return 2;
  if (dominant >= 5) return 1;
  return 0;
}

function scoreOccasionIntegrity(request: PlannerRequest, plannedStops: StopReport[]) {
  const filled = plannedStops.filter((stop) => stop.locationName);
  if (filled.length === 0) return 0;

  const categories = filled.map((stop) => stop.category);
  const nightlifeCount = categories.filter((category) => category === "nightlife").length;
  const foodCount = categories.filter(
    (category) => category === "restaurant" || category === "cafe"
  ).length;
  const activityishCount = categories.filter(
    (category) => category === "activity" || category === "culture" || category === "event"
  ).length;

  if (request.occasion === "family" && nightlifeCount > 0) return 0;
  if (request.occasion === "tourism" && activityishCount < 2) return 0;
  if (request.occasion === "party" && nightlifeCount < 2) return 0;
  if (request.occasion === "date" && foodCount < 1) return 1;

  if (request.occasion === "friends" && nightlifeCount >= 3) return 1;
  return 2;
}

function scoreSlotFlow(plannedStops: StopReport[]) {
  const filled = plannedStops.filter((stop) => stop.locationName);
  if (filled.length <= 1) return 0;
  if (filled.length < Math.max(2, plannedStops.length - 1)) return 1;
  return 2;
}

function scoreRouteQuality(summary: RouteSummaryLite, plannedStops: StopReport[]) {
  const filled = plannedStops.filter((stop) => stop.locationName);
  if (filled.length === 0) return 0;
  const travelPerStop = summary.travelMin / Math.max(1, filled.length);
  if (travelPerStop <= 18) return 2;
  if (travelPerStop <= 30) return 1;
  return 0;
}

function scoreVariantSeparation(variants: VariantReport[]) {
  if (variants.length < 2) return 0;
  const ids = variants.map((variant) => variant.stopNames.join("|"));
  const unique = new Set(ids).size;
  if (unique >= Math.min(variants.length, 3)) return 2;
  if (unique >= 2) return 1;
  return 0;
}

function stopByLabel(plannedStops: StopReport[], label: string) {
  return plannedStops.find((stop) => stop.label === label) ?? null;
}

function evaluateGuardrails(testCase: RegressionCase, plannedStops: StopReport[], total: number) {
  const failures: string[] = [];

  if (total < MIN_CASE_SCORE) {
    failures.push(`score below minimum threshold (${total} < ${MIN_CASE_SCORE})`);
  }

  if (testCase.id === "case-08") {
    const highlight = stopByLabel(plannedStops, "Abend-Highlight");
    const optional = stopByLabel(plannedStops, "Optionaler Abschluss");

    if (!highlight?.locationName) {
      failures.push("tourism evening highlight is empty");
    } else if (
      highlight.category === "nightlife" ||
      highlight.category === "restaurant" ||
      highlight.category === "cafe"
    ) {
      failures.push("tourism evening highlight drifted into nightlife/food");
    }

    if (optional?.locationName && optional.category === "nightlife") {
      failures.push("tourism evening optional close drifted into nightlife");
    }
  }

  if (testCase.id === "case-09") {
    const peak = stopByLabel(plannedStops, "Peak");
    const after = stopByLabel(plannedStops, "Afterparty");

    if (!peak?.locationName) {
      failures.push("party evening peak is empty");
    }

    if (!after?.locationName) {
      failures.push("party evening afterparty is empty");
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  } satisfies GuardrailResult;
}

function toStopReport(stop: PlannedStop): StopReport {
  return {
    index: stop.index,
    label: stop.label,
    hint: stop.hint,
    locationName: stop.item?.name ?? null,
    category: stop.item ? classify(stop.item) : null,
    travelMinFromPrev: stop.travelMinFromPrev,
    durationMin: stop.durationMin,
    reasons: stop.reasons,
  };
}

function toVariantReport(variant: PlanVariant): VariantReport {
  return {
    variantId: variant.variantId,
    label: variant.label,
    reason: variant.reason,
    badges: variant.badges,
    stopNames: variant.plannedStops
      .map((stop) => stop.item?.name ?? null)
      .filter((value): value is string => Boolean(value)),
    summary: variant.fallbackSummary,
  };
}

async function runCase(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  testCase: RegressionCase
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
  const primaryVariant = variants[0] ?? null;
  const plannedStops = primaryVariant?.plannedStops ?? [];
  const summary =
    primaryVariant?.fallbackSummary ??
    summarizeRoute({
      stops: plannedStops,
      origin: { lat: context.origin.lat, lng: context.origin.lng },
    });

  const topRetrievalCandidates = retrieval.candidates.slice(0, 20).map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    category: classify(candidate),
    subtypes: getSubtypes(candidate),
    distanceKm: candidate.distanceFromOriginKm,
    retrievalPriority: scoreRetrievalPriority(candidate, context),
    retrievalReasons: candidate.retrievalReasons,
  }));

  const plannedStopReports = plannedStops.map(toStopReport);
  const variantReports = variants.map(toVariantReport);

  const retrievalFit = scoreRetrievalFit(topRetrievalCandidates);
  const occasionIntegrity = scoreOccasionIntegrity(testCase.request, plannedStopReports);
  const slotFlow = scoreSlotFlow(plannedStopReports);
  const routeQuality = scoreRouteQuality(summary, plannedStopReports);
  const variantSeparation = scoreVariantSeparation(variantReports);
  const total =
    retrievalFit +
    occasionIntegrity +
    slotFlow +
    routeQuality +
    variantSeparation;
  const guardrails = evaluateGuardrails(testCase, plannedStopReports, total);

  return {
    id: testCase.id,
    title: testCase.title,
    input: testCase.request,
    effectiveRadiusKm: retrieval.effectiveRadiusKm,
    activeLevel: scoring.activeLevel,
    topRetrievalCandidates,
    recommendedVariantId: primaryVariant?.variantId ?? null,
    plannedStops: plannedStopReports,
    variants: variantReports,
    guardrails,
    score: {
      retrievalFit,
      occasionIntegrity,
      slotFlow,
      routeQuality,
      variantSeparation,
      total,
    },
  };
}

function buildMarkdownReport(reports: CaseReport[]) {
  const lines: string[] = [];
  const total = reports.reduce((sum, report) => sum + report.score.total, 0);

  lines.push("# Planner Trace Regression");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total score: ${total} / 100`);
  lines.push("");

  for (const report of reports) {
    lines.push(`## ${report.id} - ${report.title}`);
    lines.push(`Score: ${report.score.total} / 10`);
    lines.push(
      `Breakdown: Retrieval ${report.score.retrievalFit}, Occasion ${report.score.occasionIntegrity}, Flow ${report.score.slotFlow}, Route ${report.score.routeQuality}, Variants ${report.score.variantSeparation}`
    );
    lines.push(`Guardrails: ${report.guardrails.passed ? "PASS" : "FAIL"}`);
    for (const failure of report.guardrails.failures) {
      lines.push(`- Guardrail: ${failure}`);
    }
    lines.push(`Recommended variant: ${report.recommendedVariantId ?? "none"}`);
    lines.push("");
    lines.push("Planned stops:");
    for (const stop of report.plannedStops) {
      lines.push(
        `- ${stop.index}. ${stop.label}: ${stop.locationName ?? "[empty]"} (${stop.category ?? "n/a"})`
      );
    }
    lines.push("");
    lines.push("Top retrieval candidates:");
    for (const candidate of report.topRetrievalCandidates.slice(0, 8)) {
      lines.push(
        `- ${candidate.name} | ${candidate.category ?? "n/a"} | priority ${candidate.retrievalPriority}`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  loadEnvFile(join(process.cwd(), ".env.local"));
  const supabase = getSupabaseAdmin();
  const cases = buildCases();
  const reports: CaseReport[] = [];

  for (const testCase of cases) {
    reports.push(await runCase(supabase, testCase));
  }

  const outDir = join(process.cwd(), "reports");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = join(outDir, `planner-trace-regression-${stamp}.json`);
  const mdPath = join(outDir, `planner-trace-regression-${stamp}.md`);

  writeFileSync(jsonPath, JSON.stringify(reports, null, 2), "utf8");
  writeFileSync(mdPath, buildMarkdownReport(reports), "utf8");

  const total = reports.reduce((sum, report) => sum + report.score.total, 0);
  const failedGuardrails = reports.flatMap((report) =>
    report.guardrails.failures.map((failure) => `${report.id}: ${failure}`)
  );
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Total score: ${total} / 100`);

  if (failedGuardrails.length > 0) {
    console.error("Guardrail failures:");
    for (const failure of failedGuardrails) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  if (total < MIN_REGRESSION_TOTAL_SCORE) {
    console.error(
      `Regression total below threshold: ${total} < ${MIN_REGRESSION_TOTAL_SCORE}`
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
