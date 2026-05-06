import { buildLocationSearchText, classify, classifyActivitySubkind, getSubtypes } from "../features";
import { haversineKm } from "../travel";
import type { CandidateLocation, LocationRow, PlanningContext } from "../types";
import { buildRetrievalReasons } from "./priority";

export function hasValidCoordinates(loc: LocationRow) {
  return typeof loc.lat === "number" && typeof loc.lng === "number";
}

function canUseWithoutCoordinates(loc: LocationRow, context: PlanningContext) {
  if (classify(loc) !== "event") return false;

  const refs =
    loc.source_refs && typeof loc.source_refs === "object"
      ? (loc.source_refs as Record<string, unknown>)
      : null;

  const eventKind = typeof refs?.eventKind === "string" ? refs.eventKind : null;
  const eventCategory = typeof refs?.eventCategory === "string" ? refs.eventCategory : null;
  const venueName = typeof refs?.venueName === "string" ? refs.venueName.trim() : "";
  const startsAt = typeof refs?.startsAt === "string" ? refs.startsAt : null;
  const isConcreteEventPage = refs?.isConcreteEventPage === true;

  if (context.experienceMode === "show") {
    return (
      eventKind === "anchored_event" &&
      ["concert", "theater", "show"].includes(eventCategory ?? "") &&
      Boolean(startsAt) &&
      Boolean(venueName) &&
      isConcreteEventPage
    );
  }

  if (context.experienceMode === "event_visit") {
    const anchoredStageEvent =
      eventKind === "anchored_event" &&
      ["concert", "theater", "show"].includes(eventCategory ?? "") &&
      Boolean(startsAt) &&
      Boolean(venueName) &&
      isConcreteEventPage;

    if (anchoredStageEvent) {
      return true;
    }
  }

  if (context.experienceMode !== "market_festival" && context.experienceMode !== "event_visit") {
    return false;
  }

  return (
    eventKind === "flex_event" &&
    ["market", "festival", "fair", "food_event", "seasonal", "community"].includes(
      eventCategory ?? ""
    )
  );
}

export function isLikelyUsefulLocation(loc: LocationRow) {
  const category = classify(loc);
  const subkind = classifyActivitySubkind(loc);
  const subtypes = getSubtypes(loc);
  const type = (loc.type ?? "").toLowerCase().trim();
  const name = (loc.name ?? "").toLowerCase().trim();
  const searchText = buildLocationSearchText(loc);

  if (loc.is_plannable === false) return false;

  const blockedTypes = new Set([
    "school",
    "police",
    "fire_station",
    "public_bookcase",
    "grave_yard",
    "graveyard",
    "bureau_de_change",
    "post_box",
    "toilets",
    "bench",
    "waste_basket",
    "recycling",
    "parking",
    "parking_entrance",
    "bicycle_parking",
    "car_wash",
    "charging_station",
    "vending_machine",
    "atm",
    "bank",
    "doctors",
    "hospital",
    "clinic",
    "pharmacy",
    "courthouse",
    "townhall",
    "college",
    "university",
    "kindergarten",
  ]);

  if (blockedTypes.has(type)) return false;
  if (!name && category === "other") return false;

  if (category === "other" && (subkind === null || subkind === "generic") && subtypes.length === 0) {
    return false;
  }

  if (!searchText && category === "other") return false;
  return true;
}

export function enrichCandidate(
  loc: LocationRow,
  context: PlanningContext
): CandidateLocation | null {
  const validCoordinates = hasValidCoordinates(loc);
  if (!validCoordinates && !canUseWithoutCoordinates(loc, context)) return null;
  if (!isLikelyUsefulLocation(loc)) return null;

  let distanceFromOriginKm: number | null = null;

  if (
    validCoordinates &&
    context.origin.lat != null &&
    context.origin.lng != null &&
    loc.lat != null &&
    loc.lng != null
  ) {
    distanceFromOriginKm = haversineKm(
      context.origin.lat,
      context.origin.lng,
      loc.lat,
      loc.lng
    );
  }

  return {
    ...loc,
    distanceFromOriginKm,
    retrievalReasons: buildRetrievalReasons(loc, distanceFromOriginKm, context),
  };
}
