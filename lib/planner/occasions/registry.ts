import type { OccasionKey } from "../types";
import { dateOccasion } from "./date";
import { familyOccasion } from "./family";
import { friendsOccasion } from "./friends";
import { partyOccasion } from "./party";
import { tourismOccasion } from "./tourism";
import type { OccasionModule } from "./types";

const registry: Record<OccasionKey, OccasionModule> = {
  date: dateOccasion,
  family: familyOccasion,
  friends: friendsOccasion,
  tourism: tourismOccasion,
  party: partyOccasion,
};

export function getOccasionModule(key: OccasionKey): OccasionModule {
  return registry[key];
}

export function hasOccasionModule(value: string): value is OccasionKey {
  return value in registry;
}

export { registry as occasionRegistry };
