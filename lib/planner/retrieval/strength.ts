import { getOccasionModule } from "../occasions/registry";
import type { LocationRow, PlanningContext } from "../types";

export function isStrongDateCandidate(loc: LocationRow) {
  return getOccasionModule("date").isStrongCandidate(loc);
}

export function isStrongFamilyCandidate(loc: LocationRow) {
  return getOccasionModule("family").isStrongCandidate(loc);
}

export function isStrongFriendsCandidate(loc: LocationRow) {
  return getOccasionModule("friends").isStrongCandidate(loc);
}

export function isStrongTourismCandidate(loc: LocationRow) {
  return getOccasionModule("tourism").isStrongCandidate(loc);
}

export function isStrongPartyCandidate(loc: LocationRow) {
  return getOccasionModule("party").isStrongCandidate(loc);
}

export function isStrongOccasionCandidate(
  occasion: PlanningContext["filters"]["occasion"],
  loc: LocationRow
) {
  return getOccasionModule(occasion).isStrongCandidate(loc);
}
