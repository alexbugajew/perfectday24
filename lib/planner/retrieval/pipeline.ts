import type { CandidateLocation } from "../types";
import { buildBalancedCandidateList, dedupeCandidates } from "./buckets";
import { enrichCandidate } from "./enrich";
import { sortForRetrieval } from "./priority";
import { isStrongOccasionCandidate } from "./strength";
import type { RetrieveCandidatesParams, RetrievalWithBuckets } from "./types";
import { classify } from "../features";

function canUseWithoutDistance(loc: CandidateLocation, experienceMode: string) {
  if (classify(loc) !== "event") return false;

  // Events from the planner_events table are curated and trusted — always include
  // them even when they lack coordinates, as long as the experienceMode matches.
  if (loc.source_primary === "planner_event") {
    const refs =
      loc.source_refs && typeof loc.source_refs === "object"
        ? (loc.source_refs as Record<string, unknown>)
        : null;
    if (experienceMode === "show") {
      const cat = String(refs?.eventCategory ?? "");
      return ["concert", "theater", "show"].includes(cat) || typeof refs?.startsAt === "string";
    }
    if (experienceMode === "event_visit") return true;
    if (experienceMode === "market_festival") return true;
    return false;
  }

  const refs =
    loc.source_refs && typeof loc.source_refs === "object"
      ? (loc.source_refs as Record<string, unknown>)
      : null;

  if (experienceMode === "show") {
    return (
      refs?.eventKind === "anchored_event" &&
      refs?.missingCoordinates === true &&
      refs?.isConcreteEventPage === true &&
      typeof refs?.venueName === "string" &&
      refs.venueName.trim().length > 0 &&
      typeof refs?.startsAt === "string" &&
      refs.startsAt.trim().length > 0
    );
  }

  if (experienceMode === "event_visit") {
    const isAnchoredStageEvent =
      refs?.eventKind === "anchored_event" &&
      refs?.missingCoordinates === true &&
      refs?.isConcreteEventPage === true &&
      typeof refs?.venueName === "string" &&
      refs.venueName.trim().length > 0 &&
      typeof refs?.startsAt === "string" &&
      refs.startsAt.trim().length > 0 &&
      ["concert", "theater", "show"].includes(String(refs?.eventCategory ?? ""));

    if (isAnchoredStageEvent) return true;
  }

  if (experienceMode !== "market_festival" && experienceMode !== "event_visit") return false;

  return refs?.eventKind === "flex_event" && refs?.missingCoordinates === true;
}

export function retrieveCandidates(params: RetrieveCandidatesParams): RetrievalWithBuckets {
  const {
    locations,
    context,
    maxCandidates = 300,
    radiusExpansionSteps,
  } = params;

  const citySlug = context.citySlug;
  const baseRadius = context.filters.radiusKm;

  const radiusSteps =
    radiusExpansionSteps && radiusExpansionSteps.length > 0
      ? radiusExpansionSteps
      : context.origin.lat != null && context.origin.lng != null
      ? context.filters.routeProfile === "foot"
        ? [baseRadius]
        : context.filters.routeProfile === "public_transit"
          ? Array.from(new Set([baseRadius, 15, 25, 40])).sort((a, b) => a - b)
          : Array.from(new Set([baseRadius, 20, 35, 50])).sort((a, b) => a - b)
      : [baseRadius];

  let rows = [...locations];
  if (citySlug) {
    rows = rows.filter((row) => row.city_slug === citySlug);
  }

  const enriched = rows
    .map((loc) => enrichCandidate(loc, context))
    .filter((candidate): candidate is CandidateLocation => candidate !== null);

  const retrievalBase = enriched.filter((loc) =>
    isStrongOccasionCandidate(context.filters.occasion, loc)
  );

  const minOccasionBase =
    context.filters.occasion === "family"
      ? 12
      : context.filters.occasion === "date" || context.filters.occasion === "friends"
      ? 18
      : 30;

  const enrichedSorted = sortForRetrieval(enriched, context);
  const supportPool = dedupeCandidates([
    ...enrichedSorted.slice(0, Math.min(enrichedSorted.length, Math.max(240, maxCandidates))),
    ...enrichedSorted
      .filter((loc) => {
        const category = classify(loc);
        return category === "restaurant" || category === "cafe";
      })
      .slice(0, Math.max(160, Math.floor(maxCandidates * 0.25))),
    ...enrichedSorted
      .filter((loc) => {
        const category = classify(loc);
        return category === "activity" || category === "culture" || category === "event";
      })
      .slice(0, Math.max(160, Math.floor(maxCandidates * 0.25))),
  ]);

  const retrievalRows =
    retrievalBase.length >= minOccasionBase
      ? dedupeCandidates([...retrievalBase, ...supportPool])
      : supportPool;

  for (const stepRadius of radiusSteps) {
    const inRadius = retrievalRows.filter((loc) => {
      if (context.origin.lat == null || context.origin.lng == null) return true;
      if (loc.distanceFromOriginKm == null) {
        return canUseWithoutDistance(loc, context.experienceMode);
      }
      return loc.distanceFromOriginKm <= stepRadius;
    });

    if (inRadius.length === 0) continue;

    const balanced = buildBalancedCandidateList(inRadius, context, maxCandidates);
    return {
      candidates: balanced.candidates,
      effectiveRadiusKm: stepRadius,
      buckets: balanced.buckets,
    };
  }

  const fallbackBalanced = buildBalancedCandidateList(
    retrievalRows,
    context,
    maxCandidates
  );

  return {
    candidates: fallbackBalanced.candidates,
    effectiveRadiusKm: baseRadius,
    buckets: fallbackBalanced.buckets,
  };
}
