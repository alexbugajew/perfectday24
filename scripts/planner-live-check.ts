import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  buildPlanningContext,
  classify,
  dedupePlannerEventsForPlanning,
  hasSubtype,
  generatePlan,
  plannerEventCategoriesForExperienceMode,
  plannerEventIsActive,
  plannerEventToLocationRow,
  sortPlannerEventsForPlanning,
} from "../lib/planner";
import { chooseEventAnchor } from "../lib/planner/route/anchor";

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

function parseArg(name: string) {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function shiftIsoDate(dateValue: string, days: number) {
  const base = new Date(`${dateValue}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function startPointForCity(citySlug: string) {
  if (citySlug === "berlin-berlin") {
    return {
      type: "station" as const,
      label: "Berlin Hbf",
      lat: 52.52508,
      lng: 13.3694,
    };
  }

  if (citySlug === "hamburg-hamburg") {
    return {
      type: "station" as const,
      label: "Hamburg Hbf",
      lat: 53.5526,
      lng: 10.0067,
    };
  }

  if (citySlug === "muenchen") {
    return {
      type: "station" as const,
      label: "Muenchen Hbf",
      lat: 48.1402,
      lng: 11.5584,
    };
  }

  if (citySlug === "stuttgart") {
    return {
      type: "station" as const,
      label: "Stuttgart Hbf",
      lat: 48.7831,
      lng: 9.1829,
    };
  }

  if (citySlug === "dortmund") {
    return {
      type: "station" as const,
      label: "Dortmund Hbf",
      lat: 51.5177,
      lng: 7.4593,
    };
  }

  if (citySlug === "koeln") {
    return {
      type: "station" as const,
      label: "Koeln Hbf",
      lat: 50.943,
      lng: 6.9587,
    };
  }

  if (citySlug === "frankfurt-am-main") {
    return {
      type: "station" as const,
      label: "Frankfurt Hbf",
      lat: 50.1071,
      lng: 8.6638,
    };
  }

  if (citySlug === "duesseldorf") {
    return {
      type: "station" as const,
      label: "Duesseldorf Hbf",
      lat: 51.2194,
      lng: 6.7945,
    };
  }

  if (citySlug === "leipzig") {
    return {
      type: "station" as const,
      label: "Leipzig Hbf",
      lat: 51.3452,
      lng: 12.3816,
    };
  }

  if (citySlug === "dresden") {
    return {
      type: "station" as const,
      label: "Dresden Hbf",
      lat: 51.0407,
      lng: 13.732,
    };
  }

  if (citySlug === "hannover") {
    return {
      type: "station" as const,
      label: "Hannover Hbf",
      lat: 52.3779,
      lng: 9.7416,
    };
  }

  if (citySlug === "nuernberg") {
    return {
      type: "station" as const,
      label: "Nuernberg Hbf",
      lat: 49.4456,
      lng: 11.0824,
    };
  }

  if (citySlug === "bremen") {
    return {
      type: "station" as const,
      label: "Bremen Hbf",
      lat: 53.0821,
      lng: 8.8133,
    };
  }

  if (citySlug === "mannheim") {
    return {
      type: "station" as const,
      label: "Mannheim Hbf",
      lat: 49.4796,
      lng: 8.4681,
    };
  }

  if (citySlug === "wiesbaden") {
    return {
      type: "station" as const,
      label: "Wiesbaden Hbf",
      lat: 50.0712,
      lng: 8.2436,
    };
  }

  if (citySlug === "bonn") {
    return {
      type: "station" as const,
      label: "Bonn Hbf",
      lat: 50.7322,
      lng: 7.096,
    };
  }

  if (citySlug === "essen") {
    return {
      type: "station" as const,
      label: "Essen Hbf",
      lat: 51.4514,
      lng: 7.0148,
    };
  }

  if (citySlug === "karlsruhe") {
    return {
      type: "station" as const,
      label: "Karlsruhe Hbf",
      lat: 48.9937,
      lng: 8.4012,
    };
  }

  if (citySlug === "muenster") {
    return {
      type: "station" as const,
      label: "Muenster Hbf",
      lat: 51.9561,
      lng: 7.6357,
    };
  }

  if (citySlug === "aachen") {
    return {
      type: "station" as const,
      label: "Aachen Hbf",
      lat: 50.7678,
      lng: 6.0915,
    };
  }

  if (citySlug === "augsburg") {
    return {
      type: "station" as const,
      label: "Augsburg Hbf",
      lat: 48.3652,
      lng: 10.8862,
    };
  }

  if (citySlug === "kiel") {
    return {
      type: "station" as const,
      label: "Kiel Hbf",
      lat: 54.3146,
      lng: 10.1317,
    };
  }

  if (citySlug === "bielefeld") {
    return {
      type: "station" as const,
      label: "Bielefeld Hbf",
      lat: 52.0289,
      lng: 8.5325,
    };
  }

  if (citySlug === "braunschweig") {
    return {
      type: "station" as const,
      label: "Braunschweig Hbf",
      lat: 52.2526,
      lng: 10.5408,
    };
  }

  if (citySlug === "bochum") {
    return {
      type: "station" as const,
      label: "Bochum Hbf",
      lat: 51.4787,
      lng: 7.2226,
    };
  }

  if (citySlug === "duisburg") {
    return {
      type: "station" as const,
      label: "Duisburg Hbf",
      lat: 51.4299,
      lng: 6.7768,
    };
  }

  if (citySlug === "wuppertal") {
    return {
      type: "station" as const,
      label: "Wuppertal Hbf",
      lat: 51.2562,
      lng: 7.1494,
    };
  }

  if (citySlug === "freiburg-im-breisgau") {
    return {
      type: "station" as const,
      label: "Freiburg Hbf",
      lat: 47.9984,
      lng: 7.8416,
    };
  }

  if (citySlug === "luebeck") {
    return {
      type: "station" as const,
      label: "Luebeck Hbf",
      lat: 53.8676,
      lng: 10.6689,
    };
  }

  if (citySlug === "erfurt") {
    return {
      type: "station" as const,
      label: "Erfurt Hbf",
      lat: 50.9727,
      lng: 11.037,
    };
  }

  if (citySlug === "magdeburg") {
    return {
      type: "station" as const,
      label: "Magdeburg Hbf",
      lat: 52.1288,
      lng: 11.6265,
    };
  }

  if (citySlug === "moenchengladbach") {
    return {
      type: "station" as const,
      label: "Alter Markt Moenchengladbach",
      lat: 51.1941,
      lng: 6.4376,
    };
  }

  if (citySlug === "gelsenkirchen") {
    return {
      type: "station" as const,
      label: "Gelsenkirchen Hbf",
      lat: 51.5036,
      lng: 7.102,
    };
  }

  return {
    type: "station" as const,
    label: "City Center",
    lat: 0,
    lng: 0,
  };
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen.");
  }

  const citySlug = parseArg("city") ?? "hamburg-hamburg";
  const planDate = parseArg("date") ?? "2026-04-14";
  const occasion = (parseArg("occasion") ?? "date") as
    | "date"
    | "friends"
    | "family"
    | "party"
    | "tourism";
  const experienceMode = (parseArg("experience") ?? "show") as
    | "classic"
    | "show"
    | "event_visit"
    | "market_festival";
  const planMode = (parseArg("mode") ?? "evening") as
    | "morning"
    | "midday"
    | "evening"
    | "fullday";
  const routeProfile = (parseArg("routeProfile") ?? "public_transit") as
    | "foot"
    | "public_transit"
    | "car";

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const request = {
    citySlug,
    planDate,
    selectedEventId: null,
    eventPlanningMode: "auto" as const,
    startPoint: startPointForCity(citySlug),
    planMode,
    radiusKm: 12,
    budget: "medium" as const,
    occasion,
    experienceMode,
    eventStrictness: experienceMode === "show" ? ("required" as const) : ("hybrid" as const),
    interests: ["live music", "theater", "musical", "culture"],
    group: { enabled: false, members: [] },
    stopsCount: 3,
    sortMode: "match" as const,
    routeProfile,
    evaluationMode: "trace" as const,
  };

  const { data: locations, error: locationsError } = await supabase
    .from("locations")
    .select("*")
    .eq("city_slug", citySlug)
    .eq("is_plannable", true)
    .limit(12000);

  if (locationsError) {
    throw new Error(`Locations konnten nicht geladen werden: ${locationsError.message}`);
  }

  const categories = plannerEventCategoriesForExperienceMode(experienceMode);
  const eventWindowStart = shiftIsoDate(planDate, -1);
  const eventWindowEnd = shiftIsoDate(planDate, 1);
  const { data: events, error: eventsError } = await supabase
    .from("planner_events")
    .select("*")
    .eq("city_slug", citySlug)
    .in("status", ["scheduled", "draft"])
    .in("category", categories)
    .or(
      [
        `and(start_at.gte.${eventWindowStart},start_at.lt.${eventWindowEnd})`,
        `and(start_at.lt.${eventWindowEnd},end_at.gte.${eventWindowStart})`,
      ].join(",")
    )
    .limit(300);

  if (eventsError) {
    throw new Error(`Events konnten nicht geladen werden: ${eventsError.message}`);
  }

  const activeRows = (events ?? []).filter((row) => plannerEventIsActive(row, planDate));
  const sortedRows = dedupePlannerEventsForPlanning(
    sortPlannerEventsForPlanning(activeRows, {
      experienceMode,
      planDate,
    })
  );
  const visibleRows = sortedRows.filter((row) => row.status === "scheduled");
  const eventLocations = visibleRows.map(plannerEventToLocationRow);

  const context = buildPlanningContext(request);
  const result = generatePlan({
    request,
    locations: [...(locations ?? []), ...eventLocations],
  });

  const scoredEventResults = result.results
    .filter((row) => row.source_primary === "planner_event")
    .slice(0, 20)
    .map((row) => {
      const refs =
        row.source_refs && typeof row.source_refs === "object"
          ? (row.source_refs as Record<string, unknown>)
          : null;
      return {
        title: row.name,
        totalScore: row.totalScore,
        distanceKm: row.distanceFromOriginKm,
        matchLevel: row.matchLevel,
        source: typeof refs?.source === "string" ? refs.source : null,
        eventCategory: typeof refs?.eventCategory === "string" ? refs.eventCategory : null,
        eventKind: typeof refs?.eventKind === "string" ? refs.eventKind : null,
        isConcreteEventPage: refs?.isConcreteEventPage === true,
        missingCoordinates: refs?.missingCoordinates === true,
      };
    });

  const scenicResults = result.results
    .filter((row) => {
      const category = classify(row);
      if (category === "restaurant" || category === "cafe" || category === "nightlife") {
        return false;
      }
      return (
        category === "culture" ||
        category === "activity" ||
        hasSubtype(
          row,
          "promenade",
          "viewpoint",
          "park",
          "garden",
          "waterfront",
          "historic_site",
          "monument",
          "memorial",
          "old_town"
        )
      );
    })
    .slice(0, 12)
    .map((row) => ({
      title: row.name,
      category: classify(row),
      totalScore: row.totalScore,
      distanceKm: row.distanceFromOriginKm,
      source: row.source_primary ?? null,
      hasCoordinates: typeof row.lat === "number" && typeof row.lng === "number",
    }));

  const directEventAnchor = chooseEventAnchor({
    context,
    candidates: result.results,
    variationSeed: 0,
  });

  console.log(
    JSON.stringify(
      {
        activeLevel: result.activeLevel,
        inputCounts: {
          locations: locations?.length ?? 0,
          rawEvents: events?.length ?? 0,
          activeEvents: activeRows.length,
          visibleEvents: visibleRows.length,
          generatedCandidates: result.results.length,
        },
        directEventAnchor: directEventAnchor
          ? {
              slotIndex: directEventAnchor.slotIndex,
              title: directEventAnchor.candidate.name,
            }
          : null,
        topEvents: sortedRows.slice(0, 12).map((event) => ({
          title: event.title,
          source: event.source,
          category: event.category,
          venue: event.venue_name,
          start: event.start_at,
          status: event.status,
        })),
        plannedStops: result.plannedStops.map((stop) => {
          const sourceRefs =
            stop.item?.source_refs && typeof stop.item.source_refs === "object"
              ? (stop.item.source_refs as Record<string, unknown>)
              : null;
          const stopWithWhy = stop as typeof stop & { why?: unknown };
          return {
          label: stop.label,
          name: stop.item?.name,
          source: stop.item?.source_primary,
          eventSource: typeof sourceRefs?.source === "string" ? sourceRefs.source : null,
          eventCategory:
            typeof sourceRefs?.eventCategory === "string" ? sourceRefs.eventCategory : null,
          timingLock: stop.timingLock,
          selectedFrom: stop.debug?.selectedFrom ?? null,
          why: Array.isArray(stopWithWhy.why) ? stopWithWhy.why : [],
        };
        }),
        scoredEventResults,
        scenicResults,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[planner-live-check] failed:", error);
  process.exitCode = 1;
});
