import type { PlannerEventRow } from "../planner/types";

const OFFICIAL_CITY_SOURCES = new Set([
  "visitberlin",
  "berlin_de",
  "hamburg_tourism",
  "hamburg_de",
  "hamburg_infomax",
  "muenchen_de",
  "koeln_tourism",
  "frankfurt_tourism",
  "stuttgart_tourism",
  "duesseldorf_tourism",
  "leipzig_travel",
  "dresden_tourism",
  "hannover_tourism",
  "nuernberg_tourism",
  "bremen_tourism",
  "dortmund_tourism",
]);
const ANCHORED_CATEGORIES = new Set(["concert", "theater", "show"]);
const FLEX_CATEGORIES = new Set(["market", "festival", "fair", "food_event", "community", "seasonal"]);
const TITLE_STOP_WORDS = new Set([
  "der",
  "die",
  "das",
  "den",
  "dem",
  "des",
  "ein",
  "eine",
  "einen",
  "und",
  "oder",
  "mit",
  "von",
  "vom",
  "am",
  "im",
  "in",
  "an",
  "zu",
  "zur",
  "zum",
  "for",
  "the",
  "of",
  "at",
  "berlin",
  "hamburg",
  "muenchen",
  "munich",
]);

type EventStatus = "scheduled" | "draft";

export type PlannerEventQualityUpdate = {
  id: string;
  status: EventStatus;
  subtypes: string[];
};

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => any;
    update: (values: Record<string, unknown>) => any;
  };
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .trim();
}

function normalizeSubtypes(value: unknown) {
  return Array.from(
    new Set(
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : []
    )
  ).sort();
}

function addSubtype(subtypes: string[], subtype: string) {
  return Array.from(new Set([...subtypes.filter((item) => item !== "dedupe_primary" && item !== "dedupe_shadow"), subtype])).sort();
}

function stripDedupeSubtypes(subtypes: string[]) {
  return subtypes.filter((item) => item !== "dedupe_primary" && item !== "dedupe_shadow").sort();
}

function titleTokens(title: string | null | undefined) {
  return normalizeText(title)
    .split(" ")
    .filter((token) => token.length > 1 && !TITLE_STOP_WORDS.has(token));
}

function tokenSimilarity(a: string[], b: string[]) {
  if (a.length === 0 || b.length === 0) return 0;
  const bSet = new Set(b);
  const shared = a.filter((token) => bSet.has(token)).length;
  return shared / Math.max(a.length, b.length);
}

function compatibleCategory(a: PlannerEventRow, b: PlannerEventRow) {
  if (a.category === b.category) return true;
  if (ANCHORED_CATEGORIES.has(a.category) && ANCHORED_CATEGORIES.has(b.category)) return true;
  if (FLEX_CATEGORIES.has(a.category) && FLEX_CATEGORIES.has(b.category)) return true;
  return false;
}

function localDateKey(event: PlannerEventRow) {
  const timezone = event.timezone || "UTC";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(event.start_at));
  } catch {
    return event.start_at.slice(0, 10);
  }
}

function minutesFromIso(value: string | null | undefined) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? Math.round(time / 60000) : null;
}

function timeDistanceMinutes(a: PlannerEventRow, b: PlannerEventRow) {
  const minuteA = minutesFromIso(a.start_at);
  const minuteB = minutesFromIso(b.start_at);
  if (minuteA == null || minuteB == null) return Number.POSITIVE_INFINITY;
  return Math.abs(minuteA - minuteB);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

function isSummaryLikeTitle(title: string) {
  return /(highlights|tipps|fruhling in|fruehling in|sommer in|herbst in|winter in|ostern in|events im|event highlights|biergarten|biergaerten|street food markets|freiluftkinos)/i.test(
    title
  );
}

function sourcePriority(event: PlannerEventRow) {
  if (ANCHORED_CATEGORIES.has(event.category)) {
    if (event.source === "ticketmaster") return 40;
    if (OFFICIAL_CITY_SOURCES.has(event.source)) return 25;
    if (event.source === "openagenda") return 18;
    return 12;
  }

  if (FLEX_CATEGORIES.has(event.category)) {
    if (OFFICIAL_CITY_SOURCES.has(event.source)) return 36;
    if (event.source === "openagenda") return 22;
    if (event.source === "ticketmaster") return 8;
    return 12;
  }

  if (OFFICIAL_CITY_SOURCES.has(event.source)) return 20;
  if (event.source === "ticketmaster") return 18;
  if (event.source === "openagenda") return 15;
  return 10;
}

function subtypeBonus(event: PlannerEventRow) {
  const subtypes = normalizeSubtypes(event.subtypes);
  if (subtypes.includes("editorial_summary_page")) return -90;
  let score = 0;
  if (subtypes.includes("concrete_event_page")) score += 18;
  if (subtypes.includes("festival_event") || subtypes.includes("market_event")) score += 8;
  return score;
}

function dataCompletenessScore(event: PlannerEventRow) {
  let score = 0;
  if (normalizeText(event.venue_name).length > 0) score += 8;
  if (normalizeText(event.venue_address).length > 0) score += 5;
  if (typeof event.lat === "number" && typeof event.lng === "number") score += 8;
  if (event.end_at) score += 5;
  if (event.doors_at && ANCHORED_CATEGORIES.has(event.category)) score += 4;
  if (event.ticket_url && ANCHORED_CATEGORIES.has(event.category)) score += 5;
  if (event.family_friendly === true) score += 2;
  return score;
}

function numericQualityScore(event: PlannerEventRow) {
  const localRank = typeof event.local_rank === "number" ? event.local_rank : 0;
  const importance = typeof event.importance_score === "number" ? event.importance_score : 0;
  const popularity = typeof event.popularity_score === "number" ? event.popularity_score : 0;
  return Math.round(localRank * 1.2 + importance * 0.8 + popularity * 0.5);
}

function totalQualityScore(event: PlannerEventRow) {
  let score = sourcePriority(event) + subtypeBonus(event) + dataCompletenessScore(event) + numericQualityScore(event);
  if (isSummaryLikeTitle(event.title)) score -= 40;
  if (event.status === "draft") score -= 6;
  return score;
}

function arePotentialDuplicateEvents(a: PlannerEventRow, b: PlannerEventRow) {
  if (!a.id || !b.id || a.id === b.id) return false;
  if (!a.city_slug || !b.city_slug || a.city_slug !== b.city_slug) return false;
  if (localDateKey(a) !== localDateKey(b)) return false;
  if (!compatibleCategory(a, b)) return false;

  const urlA = normalizeUrl(a.source_url);
  const urlB = normalizeUrl(b.source_url);
  if (urlA && urlB && urlA === urlB) return true;

  const titleA = titleTokens(a.title);
  const titleB = titleTokens(b.title);
  const titleScore = tokenSimilarity(titleA, titleB);
  if (titleScore < 0.5) return false;

  const venueA = normalizeText(a.venue_name);
  const venueB = normalizeText(b.venue_name);
  const venueScore = tokenSimilarity(titleTokens(venueA), titleTokens(venueB));
  const closeVenue =
    (venueA.length > 0 && venueB.length > 0 && (venueA.includes(venueB) || venueB.includes(venueA))) ||
    venueScore >= 0.6;

  const closeCoordinates =
    typeof a.lat === "number" &&
    typeof a.lng === "number" &&
    typeof b.lat === "number" &&
    typeof b.lng === "number" &&
    haversineKm(a.lat, a.lng, b.lat, b.lng) <= 0.4;

  const closeTime = timeDistanceMinutes(a, b) <= 150;

  if (titleScore >= 0.82 && closeTime) return true;
  if (titleScore >= 0.6 && closeVenue) return true;
  if (titleScore >= 0.55 && closeCoordinates) return true;

  return false;
}

function clusterDuplicateEvents(events: PlannerEventRow[]) {
  const clusters: PlannerEventRow[][] = [];
  const visited = new Set<string>();

  for (const event of events) {
    if (!event.id || visited.has(event.id)) continue;

    const cluster: PlannerEventRow[] = [];
    const queue = [event];
    visited.add(event.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      cluster.push(current);

      for (const candidate of events) {
        if (!candidate.id || visited.has(candidate.id)) continue;
        if (!arePotentialDuplicateEvents(current, candidate)) continue;
        visited.add(candidate.id);
        queue.push(candidate);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

export function buildPlannerEventQualityUpdates(events: PlannerEventRow[]) {
  const relevant = events.filter(
    (event): event is PlannerEventRow & { id: string; city_slug: string } =>
      typeof event.id === "string" &&
      event.id.length > 0 &&
      typeof event.city_slug === "string" &&
      event.city_slug.length > 0 &&
      (event.status === "scheduled" || event.status === "draft")
  );

  const updates: PlannerEventQualityUpdate[] = [];
  const clusters = clusterDuplicateEvents(relevant);

  for (const cluster of clusters) {
    if (cluster.length === 1) {
      const event = cluster[0];
      updates.push({
        id: event.id,
        status: "scheduled",
        subtypes: stripDedupeSubtypes(normalizeSubtypes(event.subtypes)),
      });
      continue;
    }

    const ranked = [...cluster].sort((a, b) => {
      const diff = totalQualityScore(b) - totalQualityScore(a);
      if (diff !== 0) return diff;
      const timeDiff = timeDistanceMinutes(a, b);
      if (Number.isFinite(timeDiff) && timeDiff !== 0) return timeDiff;
      return a.title.localeCompare(b.title, "de");
    });

    const winner = ranked[0];
    updates.push({
      id: winner.id,
      status: "scheduled",
      subtypes: addSubtype(normalizeSubtypes(winner.subtypes), "dedupe_primary"),
    });

    for (const duplicate of ranked.slice(1)) {
      updates.push({
        id: duplicate.id,
        status: "draft",
        subtypes: addSubtype(normalizeSubtypes(duplicate.subtypes), "dedupe_shadow"),
      });
    }
  }

  return updates;
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export async function reconcilePlannerEventQualityForCity(
  supabase: SupabaseLike,
  citySlug: string
) {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 14);

  // Select only the columns consumed by buildPlannerEventQualityUpdates.
  // Omitting source_payload (large Ticketmaster JSON) and other unused columns
  // keeps the HTTP response small — a critical optimisation for high-volume cities
  // like Berlin where the full-column payload can exceed several MB.
  const futureCutoff = new Date();
  futureCutoff.setUTCDate(futureCutoff.getUTCDate() + 45);

  const { data, error } = await supabase
    .from("planner_events")
    .select(
      [
        "id",
        "source",
        "source_url",
        "ticket_url",
        "title",
        "category",
        "status",
        "venue_name",
        "venue_address",
        "city_slug",
        "lat",
        "lng",
        "timezone",
        "start_at",
        "end_at",
        "doors_at",
        "family_friendly",
        "local_rank",
        "importance_score",
        "popularity_score",
        "subtypes",
      ].join(",")
    )
    .eq("city_slug", citySlug)
    .in("status", ["scheduled", "draft"])
    .gte("start_at", cutoff.toISOString())
    .lte("start_at", futureCutoff.toISOString());

  if (error) {
    throw new Error(`Event-Qualität für ${citySlug} konnte nicht geladen werden: ${error.message}`);
  }

  const rows = (data ?? []) as PlannerEventRow[];
  const updates = buildPlannerEventQualityUpdates(rows);
  const currentById = new Map(rows.map((row) => [row.id, row]));

  // Only upsert rows that actually need a change (status or subtypes differ).
  const dirty = updates.filter((update) => {
    const current = currentById.get(update.id);
    if (!current) return false;
    const currentSubtypes = normalizeSubtypes(current.subtypes);
    return current.status !== update.status || !arraysEqual(currentSubtypes, update.subtypes);
  });

  if (dirty.length > 0) {
    // Kein Batch-Upsert: PostgREST-Upsert ist INSERT..ON CONFLICT und baut erst
    // die Insert-Zeile — Teilzeilen ohne source/external_id (NOT NULL, kein
    // Default) scheitern damit selbst dann, wenn die Zeile existiert und nur
    // geupdatet würde. Stattdessen Einzel-Updates in parallelen Wellen, um die
    // Round-Trips unter CI-Bedingungen trotzdem klein zu halten.
    const CHUNK_SIZE = 10;
    for (let offset = 0; offset < dirty.length; offset += CHUNK_SIZE) {
      const chunk = dirty.slice(offset, offset + CHUNK_SIZE);
      const results = await Promise.all(
        chunk.map((update) =>
          supabase
            .from("planner_events")
            .update({ status: update.status, subtypes: update.subtypes })
            .eq("id", update.id)
        )
      );
      for (const result of results) {
        if (result?.error) {
          throw new Error(
            `Event-Qualität für ${citySlug} konnte nicht gespeichert werden: ${result.error.message}`
          );
        }
      }
    }
  }

  return {
    total: rows.length,
    changed: dirty.length,
  };
}
