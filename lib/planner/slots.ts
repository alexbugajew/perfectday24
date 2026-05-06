import { classify, classifyActivitySubkind, resolveMeal } from "./features";
import { getOccasionModule } from "./occasions/registry";
import type {
  LocationRow,
  OccasionKey,
  PlanMode,
  SlotDefinition,
  SlotKind,
} from "./types";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function timeBudgetForMode(mode: PlanMode) {
  if (mode === "morning") return 210;
  if (mode === "midday") return 180;
  if (mode === "evening") return 240;
  return 480;
}

export function preferredDaytimesForMode(
  mode: PlanMode
): Array<"morning" | "midday" | "evening" | "night"> {
  if (mode === "morning") return ["morning"];
  if (mode === "midday") return ["midday"];
  if (mode === "evening") return ["evening", "night"];
  return ["morning", "midday", "evening", "night"];
}

export function slotCategoryMatch(kind: SlotKind, loc: LocationRow) {
  const cat = classify(loc);
  const meal = resolveMeal(loc);
  const sub = classifyActivitySubkind(loc);

  if (kind === "breakfast") {
    if (meal) return meal === "breakfast";
    return cat === "cafe";
  }

  if (kind === "lunch") {
    if (meal) return meal === "lunch";
    return cat === "restaurant";
  }

  if (kind === "dinner") {
    if (meal) return meal === "dinner";
    return cat === "restaurant";
  }

  if (kind === "sightseeing") {
    return sub === "museum" || sub === "landmark" || sub === "event" || cat === "culture" || cat === "event";
  }

  if (kind === "activity") {
    return (
      sub === "sport" ||
      sub === "wellness" ||
      sub === "park" ||
      sub === "event" ||
      cat === "activity" ||
      cat === "event"
    );
  }

  if (kind === "walk") {
    return sub === "walk" || sub === "park";
  }

  if (kind === "tour") {
    return sub === "landmark" || sub === "museum" || sub === "event";
  }

  if (kind === "nightlife") {
    return cat === "nightlife" || (cat === "event" && sub === "event");
  }

  return true;
}

export function buildSlotTemplate(params: {
  planMode: PlanMode;
  occasion?: OccasionKey;
  stopsCount?: number;
  fullDayActsAfterBreakfast?: number;
  fullDayActsAfterLunch?: number;
}): SlotDefinition[] {
  const {
    planMode,
    occasion,
    stopsCount = 3,
    fullDayActsAfterBreakfast = 1,
    fullDayActsAfterLunch = 1,
  } = params;

  if (occasion) {
    return getOccasionModule(occasion).buildSlotTemplate(planMode);
  }

  if (planMode === "morning") {
    const morning: SlotDefinition[] = [
      {
        index: 0,
        kind: "breakfast",
        label: "Fruehstueck",
        hint: "Cafe / Breakfast",
      },
      {
        index: 1,
        kind: "sightseeing",
        label: "Sehenswuerdigkeit",
        hint: "Schloss / Museum / Landmark",
      },
      {
        index: 2,
        kind: "walk",
        label: "Spaziergang",
        hint: "Park / Route / Scenic Walk",
      },
    ];
    return morning.slice(0, clamp(stopsCount, 1, 3));
  }

  if (planMode === "midday") {
    const midday: SlotDefinition[] = [
      {
        index: 0,
        kind: "lunch",
        label: "Mittagessen",
        hint: "Restaurant / Lunch",
      },
      {
        index: 1,
        kind: "activity",
        label: "Aktivitaet",
        hint: "Klettern / Verleih / Erlebnis",
      },
      {
        index: 2,
        kind: "walk",
        label: "Spaziergang",
        hint: "Park / Promenade / Runde",
      },
    ];
    return midday.slice(0, clamp(stopsCount, 1, 3));
  }

  if (planMode === "evening") {
    const evening: SlotDefinition[] = [
      {
        index: 0,
        kind: "sightseeing",
        label: "Highlight",
        hint: "Kultureller oder visueller Auftakt",
      },
      {
        index: 1,
        kind: "dinner",
        label: "Abendessen",
        hint: "Restaurant / Dinner",
      },
      {
        index: 2,
        kind: "nightlife",
        label: "Nightlife",
        hint: "Bar / Club / Late Spot",
      },
    ];
    return evening.slice(0, clamp(stopsCount, 1, 3));
  }

  const a1 = clamp(fullDayActsAfterBreakfast, 1, 2);
  const a2 = clamp(fullDayActsAfterLunch, 1, 2);
  const out: SlotDefinition[] = [];

  out.push({
    index: out.length,
    kind: "breakfast",
    label: "Fruehstueck",
    hint: "Cafe / Breakfast",
  });

  out.push({
    index: out.length,
    kind: "sightseeing",
    label: "Sehenswuerdigkeit",
    hint: "Schloss / Museum / Landmark",
  });

  for (let i = 0; i < a1; i++) {
    out.push({
      index: out.length,
      kind: i === 0 ? "walk" : "activity",
      label: i === 0 ? "Spaziergang / Route" : "Aktivitaet",
      hint: i === 0 ? "Park / Scenic Walk / Ufer" : "Verleih / Sport / Erlebnis",
    });
  }

  out.push({
    index: out.length,
    kind: "lunch",
    label: "Mittagessen",
    hint: "Restaurant / Lunch",
  });

  out.push({
    index: out.length,
    kind: "tour",
    label: "Tour / Erlebnis",
    hint: "Hop-on-Hop-off / Route / Guided Tour",
  });

  for (let i = 0; i < a2; i++) {
    out.push({
      index: out.length,
      kind: i === 0 ? "activity" : "walk",
      label: i === 0 ? "Aktivitaet" : "Spaziergang / Abschluss",
      hint:
        i === 0
          ? "Kanu / Bouldern / Verleih / Erlebnis"
          : "Park / Promenade / Scenic Walk",
    });
  }

  out.push({
    index: out.length,
    kind: "dinner",
    label: "Abendessen",
    hint: "Restaurant / Dinner",
  });

  return out;
}
