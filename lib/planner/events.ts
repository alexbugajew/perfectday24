import type {
  ExperienceMode,
  LocationRow,
  OccasionKey,
  PlanMode,
  PlannerEventCategory,
  PlannerEventKind,
  PlannerEventRow,
  SlotDefinition,
} from "./types";
import { buildMarketFestivalIntentText, marketFestivalSpecificityScore } from "./market-festival";

const OFFICIAL_CITY_EVENT_SOURCES = new Set([
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

/**
 * Kalendertag eines Zeitstempels in der Zeitzone des Events ("2026-08-20").
 * Exportiert, damit Skripte, die Testdaten aus der Datenbank ziehen, exakt
 * dieselbe Tagesgrenze verwenden wie plannerEventIsActive.
 */
export function localDateKey(value: string, timezone: string | null | undefined) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return value.slice(0, 10);
  }
}

function localDateRange(value: string, timezone: string | null | undefined) {
  const key = localDateKey(value, timezone);
  const date = new Date(`${key}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function eventSourceQuality(row: PlannerEventRow) {
  let score = 0;
  if (row.source === "ticketmaster") score += 24;
  if (OFFICIAL_CITY_EVENT_SOURCES.has(row.source)) {
    score += 22;
  }
  if (row.source === "openagenda") score += 14;
  if (row.venue_name) score += 10;
  if (row.venue_address) score += 6;
  if (typeof row.lat === "number" && typeof row.lng === "number") score += 12;
  if (row.end_at) score += 6;
  if (row.doors_at) score += 4;
  if (row.ticket_url) score += 4;
  if (Array.isArray(row.subtypes) && row.subtypes.includes("concrete_event_page")) score += 24;
  if (Array.isArray(row.subtypes) && row.subtypes.includes("editorial_summary_page")) score -= 140;
  if (Array.isArray(row.subtypes) && row.subtypes.includes("dedupe_primary")) score += 10;
  if (Array.isArray(row.subtypes) && row.subtypes.includes("dedupe_shadow")) score -= 50;
  if (
    !row.venue_name &&
    row.lat == null &&
    row.lng == null &&
    (row.category === "market" || row.category === "festival" || row.category === "seasonal")
  ) {
    score -= 20;
  }
  if (typeof row.local_rank === "number") score += Math.round(row.local_rank * 1.1);
  if (typeof row.importance_score === "number") score += Math.round(row.importance_score * 0.8);
  if (typeof row.popularity_score === "number") score += Math.round(row.popularity_score * 0.6);
  return score;
}

function normalizeEventDedupeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function eventDedupeKey(row: PlannerEventRow) {
  const title = normalizeEventDedupeText(row.title);
  const venue = normalizeEventDedupeText(row.venue_name);
  const sourceUrl = normalizeEventDedupeText(row.source_url);
  const endDate = row.end_at?.slice(0, 10) ?? "";
  const startKey = row.end_at ? "" : row.start_at.slice(0, 16);
  return [row.source, row.category, title, venue, sourceUrl, endDate, startKey].join("|");
}

export function dedupePlannerEventsForPlanning(rows: PlannerEventRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = eventDedupeKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function inferPlannerEventKind(category: PlannerEventCategory): PlannerEventKind {
  // Comedy hat wie Konzert und Theater eine feste Anfangszeit, zu der man da
  // sein muss. Ausstellungen laufen ueber Wochen und sind deshalb flexibel.
  if (
    category === "concert" ||
    category === "theater" ||
    category === "show" ||
    category === "comedy"
  ) {
    return "anchored_event";
  }
  return "flex_event";
}

export function plannerEventCategoriesForExperienceMode(mode: string) {
  if (mode === "show") {
    return ["concert", "theater", "show", "comedy"] as PlannerEventCategory[];
  }

  if (mode === "market_festival") {
    return ["market", "festival", "fair", "food_event", "seasonal"] as PlannerEventCategory[];
  }

  if (mode === "event_visit") {
    return [
      "concert",
      "theater",
      "show",
      "comedy",
      "exhibition",
      "market",
      "festival",
      "fair",
      "food_event",
      "community",
      "seasonal",
    ] as PlannerEventCategory[];
  }

  return [] as PlannerEventCategory[];
}

export function plannerEventLabel(category: PlannerEventCategory) {
  if (category === "concert") return "Konzert";
  if (category === "theater") return "Theater";
  if (category === "show") return "Show";
  if (category === "comedy") return "Comedy";
  if (category === "exhibition") return "Ausstellung";
  if (category === "market") return "Markt";
  if (category === "festival") return "Festival";
  if (category === "fair") return "Kirmes";
  if (category === "food_event") return "Food-Event";
  if (category === "community") return "Community-Event";
  if (category === "seasonal") return "Saison-Event";
  return "Event";
}

export function plannerEventIsActive(row: PlannerEventRow, isoDate: string | null) {
  if (!isoDate) return true;
  if (!row.start_at) return false;

  const startDate = localDateRange(row.start_at, row.timezone);
  const targetDate = new Date(`${isoDate}T00:00:00.000Z`);
  if (!startDate || !Number.isFinite(targetDate.getTime())) {
    return localDateKey(row.start_at, row.timezone) === isoDate;
  }

  const endDate = row.end_at ? localDateRange(row.end_at, row.timezone) : null;
  if (!endDate) {
    return startDate.getTime() === targetDate.getTime();
  }

  return targetDate.getTime() >= startDate.getTime() && targetDate.getTime() <= endDate.getTime();
}

function defaultDurationMin(row: PlannerEventRow) {
  if (row.start_at && row.end_at) {
    const start = Date.parse(row.start_at);
    const end = Date.parse(row.end_at);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      const diffMin = Math.round((end - start) / 60000);

      if (row.kind === "flex_event") {
        if (diffMin >= 24 * 60) {
          return row.category === "festival" || row.category === "fair" ? 90 : 75;
        }
        return Math.min(diffMin, row.category === "festival" || row.category === "fair" ? 105 : 90);
      }

      return Math.min(diffMin, 240);
    }
  }

  if (row.category === "concert" || row.category === "theater" || row.category === "show") {
    return 120;
  }

  if (
    row.category === "market" ||
    row.category === "festival" ||
    row.category === "fair" ||
    row.category === "food_event" ||
    row.category === "seasonal"
  ) {
    return 90;
  }

  return 75;
}

function inferDaytime(startAt: string | null | undefined, timezone?: string | null) {
  if (!startAt) return "evening";
  let hour = Number.NaN;
  try {
    const formatted = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone || "UTC",
      hour: "2-digit",
      hour12: false,
    }).format(new Date(startAt));
    hour = Number(formatted);
  } catch {
    hour = Number(startAt.slice(11, 13));
  }
  if (!Number.isFinite(hour)) return "evening";
  if (hour < 11) return "morning";
  if (hour < 17) return "midday";
  if (hour < 22) return "evening";
  return "night";
}

function inferEventDaytime(row: PlannerEventRow) {
  if (row.all_day) return "midday";
  if (
    row.kind === "flex_event" &&
    (row.category === "market" ||
      row.category === "festival" ||
      row.category === "fair" ||
      row.category === "food_event" ||
      row.category === "seasonal" ||
      row.category === "community")
  ) {
    return "midday";
  }

  return inferDaytime(row.start_at, row.timezone);
}

function defaultOccasionsForEvent(row: PlannerEventRow) {
  if (row.family_friendly) return ["family", "friends", "tourism"];
  if (row.category === "concert" || row.category === "show") return ["date", "friends", "party"];
  if (row.category === "comedy") return ["date", "friends"];
  if (row.category === "theater" || row.category === "exhibition") return ["date", "tourism"];
  if (row.category === "market" || row.category === "seasonal") return ["tourism", "family", "friends", "date"];
  if (row.category === "festival" || row.category === "food_event") return ["friends", "party", "tourism"];
  return ["friends", "tourism"];
}

const GERMAN_MONTH =
  "(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)";

/**
 * Datumsspanne, die manche Quellseiten dem Veranstaltungsnamen voranstellen:
 * "14. und 15. August 2026 MS Dockville", "24. September bis 3. Oktober 2026
 * FilmFest Hamburg".
 *
 * Der Monatsname ist Pflicht — und zwar aus einem konkreten Grund: Ohne ihn
 * würde das Muster auch Ordnungszahlen im Namen abschneiden und aus
 * "4. Schlosskonzert" ein "Schlosskonzert" machen oder aus
 * "60. Kunstausstellung im Sozialgericht" die 60. Ausgabe tilgen. Mit
 * Monatspflicht bleiben solche Titel unangetastet.
 */
// Das Muster kommt bewusst ohne Backslashes aus: `[0-9]` statt `d`-Klasse,
// `[ ]` statt Leerzeichen-Klasse, `[.]` statt maskiertem Punkt. In einem
// Template-Literal muesste jeder Backslash verdoppelt werden, und genau daran
// ist der erste Entwurf gescheitert - das Muster passte lautlos auf nichts.
const EVENT_TITLE_DATE_PREFIX = new RegExp(
  `^[ ]*[0-9]{1,2}[.](?:[ ]*(?:und|bis|[-]|[/]|,|–)[ ]*[0-9]{1,2}[.]?)?[ ]*${GERMAN_MONTH}` +
    `(?:[ ]*(?:bis|[-]|[/]|–)[ ]*[0-9]{1,2}[.][ ]*${GERMAN_MONTH})?[ ]*(?:20[0-9]{2})?[ ]*`,
  "i"
);

/**
 * Entfernt eine vorangestellte Datumsspanne aus dem Veranstaltungstitel.
 *
 * Hintergrund: Mehrtägige Feste werden von einzelnen Quellen als eine Zeile
 * pro Tag geliefert, während der Titel die komplette Spanne nennt. In einem
 * Tagesplan für den 21. August stand dann "14. und 15. August 2026 MS
 * Dockville" — für den Nutzer sichtbar das falsche Datum. Der Zeitstempel
 * der Zeile selbst ist korrekt, nur der Name trägt den Ballast der Quellseite.
 *
 * Bleibt nach dem Abschneiden kein sinnvoller Name übrig, wird der Originaltitel
 * beibehalten — lieber ein umständlicher als ein leerer Name.
 */
export function normalizePlannerEventTitle(title: string): string {
  if (!title) return title;
  const stripped = title.replace(EVENT_TITLE_DATE_PREFIX, "").trim();
  if (stripped.length < 3 || !/[A-Za-zÄÖÜäöü]/.test(stripped)) return title;
  return stripped;
}

/**
 * Kategorien, aus denen heraus nachklassifiziert werden darf.
 *
 * Alles andere bleibt unangetastet: Ein Konzert bleibt ein Konzert, auch wenn
 * im Beschreibungstext das Wort "Comedy" vorkommt. Nachklassifiziert wird nur
 * aus den Sammel-Eimern, in denen die Parser mangels passender Kategorie
 * abgelegt haben.
 */
const REFINABLE_CATEGORIES: ReadonlySet<string> = new Set([
  "fair",
  "show",
  "other",
  "community",
]);

// Bewusst schlichte Teilstring-Suche statt regulaerer Ausdruecke: Im Deutschen
// sind genau die Komposita der Treffer, den wir wollen — "Sonderausstellung",
// "Kunstausstellung", "Stand-up-Comedy".
const EXHIBITION_MARKERS = [
  "ausstellung",
  "vernissage",
  "galerie",
  "museum",
  "exhibition",
  "retrospektive",
];

const COMEDY_MARKERS = [
  "comedy",
  "kabarett",
  "stand-up",
  "standup",
  "comedian",
  "improtheater",
];

/**
 * Ordnet Veranstaltungen einer treffenderen Kategorie zu, als der jeweilige
 * Stadt-Parser vergeben konnte.
 *
 * Hintergrund: Bis 08/2026 kannte die Taxonomie weder Ausstellung noch Comedy.
 * Rund 30 Stadt-Parser mappen Ausstellungen deshalb auf "fair" (siehe etwa
 * lib/events/official/aachen.ts) — mit dem Ergebnis, dass die groesste
 * Kategorie ueberwiegend Malerei und Museumsprogramm enthielt. Fuer den Planner
 * war der grobe Eimer ausreichend; sobald Kategorien zur Navigation werden,
 * fuehrt er Nutzer in die Irre.
 *
 * Statt in 30 Parsern nachzubessern greift die Regel zentral — an derselben
 * Stelle wie die Titelbereinigung, damit es eine Regel gibt und nicht dreissig.
 */
export function refinePlannerEventCategory(input: {
  category: string;
  title?: string | null;
}): PlannerEventCategory {
  const current = input.category as PlannerEventCategory;
  if (!REFINABLE_CATEGORIES.has(input.category)) return current;

  // Bewusst nur der Titel, nicht die Beschreibung. Ein erster Entwurf las auch
  // `summary` — und machte aus "boat 2027" (Bootsmesse) eine Comedy, weil im
  // Text ein Rahmenprogramm erwaehnt war, und aus einem Weinfest im
  // Weinbaumuseum eine Ausstellung. Der Titel benennt die Veranstaltung, der
  // Beschreibungstext erwaehnt nur, was darin vorkommt.
  const haystack = (input.title ?? "").toLowerCase();
  if (!haystack.trim()) return current;

  // Ausstellung zuerst: Das Signal ist eindeutiger, und ein Kabarett im Museum
  // soll nicht wegen des Wortes "Museum" zur Ausstellung werden.
  if (COMEDY_MARKERS.some((marker) => haystack.includes(marker))) return "comedy";
  if (EXHIBITION_MARKERS.some((marker) => haystack.includes(marker))) return "exhibition";

  return current;
}

export function plannerEventToLocationRow(row: PlannerEventRow): LocationRow {
  const daytime = inferEventDaytime(row);
  const rowSubtypes = Array.isArray(row.subtypes) ? row.subtypes : [];
  const baseSubtypes = [
    row.category,
    row.kind,
    row.is_ticketed ? "ticketed_event" : "free_entry_event",
    row.category === "concert" ? "live_music" : null,
    row.category === "theater" ? "performing_arts" : null,
    row.category === "show" ? "show_event" : null,
    row.category === "market" ? "market_event" : null,
    row.category === "festival" ? "festival_event" : null,
    row.category === "food_event" ? "street_food" : null,
    row.category === "fair" ? "fairground" : null,
    row.category === "seasonal" ? "seasonal_event" : null,
  ].filter((value): value is string => Boolean(value));

  return {
    id: row.id,
    name: normalizePlannerEventTitle(row.title),
    type: "event",
    occasion: defaultOccasionsForEvent(row)[0] ?? "friends",
    daytime,
    category: "event",
    manual_category: "event",
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    reservation_url: row.ticket_url ?? row.source_url ?? null,
    duration_min: defaultDurationMin(row),
    tags: Array.from(
      new Set([
        ...(Array.isArray(row.tags) ? (row.tags as string[]) : []),
        row.venue_name ?? "",
        row.city_slug ?? "",
      ].filter(Boolean))
    ),
    subtypes: Array.from(
      new Set([
        ...baseSubtypes,
        ...(Array.isArray(row.subtypes) ? (row.subtypes as string[]) : []),
      ])
    ),
    audiences: Array.isArray(row.audiences) ? row.audiences : [],
    occasions: Array.from(
      new Set([
        ...defaultOccasionsForEvent(row),
        ...(Array.isArray(row.occasions) ? (row.occasions as string[]) : []),
      ])
    ),
    city_slug: row.city_slug ?? null,
    source_primary: "planner_event",
    source_refs: {
      source: row.source,
      externalId: row.external_id,
      ticketUrl: row.ticket_url ?? null,
      sourceUrl: row.source_url ?? null,
      startsAt: row.start_at,
      endsAt: row.end_at ?? null,
      doorsAt: row.doors_at ?? null,
      venueName: row.venue_name ?? null,
      eventKind: row.kind,
      eventCategory: row.category,
      missingCoordinates: row.lat == null || row.lng == null,
      isEditorialSummary:
        Array.isArray(row.subtypes) && row.subtypes.includes("editorial_summary_page"),
      isConcreteEventPage:
        Array.isArray(row.subtypes) && row.subtypes.includes("concrete_event_page"),
    },
    is_plannable: row.status === "scheduled",
    family_friendly: row.family_friendly ?? null,
    quality_score: row.local_rank ?? row.importance_score ?? null,
    importance_score: row.importance_score ?? row.local_rank ?? null,
    popularity_score: row.popularity_score ?? row.local_rank ?? null,
    manual_boost:
      row.kind === "anchored_event"
        ? 12
        : rowSubtypes.includes("dedupe_primary")
          ? 14
          : rowSubtypes.includes("dedupe_shadow")
            ? -40
            : rowSubtypes.includes("concrete_event_page")
              ? 10
              : rowSubtypes.includes("editorial_summary_page")
                ? -6
            : 6,
    data_confidence: 0.9,
    quality_notes: row.summary ?? null,
    opening_hours_raw: null,
    energy_level:
      row.category === "concert" || row.category === "festival" || row.category === "show"
        ? "high"
        : row.category === "market" || row.category === "seasonal"
          ? "medium"
          : "low",
    indoor_outdoor: row.indoor_outdoor ?? null,
    breakfast_fit: daytime === "morning",
    lunch_fit: daytime === "midday",
    dinner_fit: daytime === "evening",
    nightlife_fit: daytime === "night" || row.category === "concert" || row.category === "show",
    evening_only: daytime === "evening" || daytime === "night",
    daytime_fit: [daytime],
  };
}

export function sortPlannerEventsForPlanning(
  rows: PlannerEventRow[],
  params: { experienceMode: ExperienceMode; planDate: string | null }
) {
  const { experienceMode, planDate } = params;
  return [...rows].sort((a, b) => {
    const activeDiff =
      Number(plannerEventIsActive(b, planDate)) - Number(plannerEventIsActive(a, planDate));
    if (activeDiff !== 0) return activeDiff;

    const marketFestivalSpecificity = (row: PlannerEventRow) =>
      experienceMode === "market_festival"
        ? marketFestivalSpecificityScore({
            text: buildMarketFestivalIntentText({
              title: row.title,
              summary: row.summary,
              venue_name: row.venue_name,
              venue_address: row.venue_address,
              tags: row.tags,
            }),
            subtypes: Array.isArray(row.subtypes)
              ? row.subtypes.filter((value): value is string => typeof value === "string")
              : [],
            category: row.category,
          })
        : 0;

    const specificityDiff = marketFestivalSpecificity(b) - marketFestivalSpecificity(a);
    if (specificityDiff !== 0) return specificityDiff;

    const qualityDiff = eventSourceQuality(b) - eventSourceQuality(a);
    if (qualityDiff !== 0) return qualityDiff;

    const exactCategoryBoost = (row: PlannerEventRow) => {
      if (experienceMode === "show") {
        return row.category === "concert" || row.category === "theater" || row.category === "show" ? 1 : 0;
      }
      if (experienceMode === "market_festival") {
        if (row.category === "market" || row.category === "festival") return 3;
        if (row.category === "food_event" || row.category === "seasonal") return 2;
        if (row.category === "fair") {
          return marketFestivalSpecificity(row) >= 40 ? 1 : -4;
        }
        return 0;
      }
      return 0;
    };

    const categoryDiff = exactCategoryBoost(b) - exactCategoryBoost(a);
    if (categoryDiff !== 0) return categoryDiff;

    return a.start_at.localeCompare(b.start_at);
  });
}

export function applyExperienceModeToSlotTemplate(params: {
  slotTemplate: SlotDefinition[];
  experienceMode: ExperienceMode;
  occasion: OccasionKey;
  planMode: PlanMode;
}) {
  const { slotTemplate, experienceMode, occasion, planMode } = params;

  if (experienceMode === "classic") return slotTemplate;

  const next = slotTemplate.map((slot) => ({ ...slot }));
  const targetIndex = next.findIndex((slot) => {
    if (slot.kind === "breakfast" || slot.kind === "lunch" || slot.kind === "dinner") {
      return false;
    }
    return slot.kind !== "nightlife";
  });

  if (targetIndex < 0) return next;

  const target = next[targetIndex];

  if (experienceMode === "show") {
    next[targetIndex] = {
      ...target,
      kind: "activity",
      label: occasion === "date" ? "Show-Moment" : "Show / Event",
      hint:
        planMode === "evening"
          ? "Konzert, Theater oder Show als fester Hauptmoment"
          : "Show, Aufführung oder Konzert als zentrales Erlebnis",
      phaseGoal: target.phaseGoal ?? "Ein zeitlich gesetztes Event als Highlight einbauen",
    };
    return next;
  }

  if (experienceMode === "event_visit") {
    next[targetIndex] = {
      ...target,
      kind: "activity",
      label: occasion === "family" ? "Erlebnis" : "Event-Highlight",
      hint: "Passendes Event als mögliches Highlight der Route",
      phaseGoal: target.phaseGoal ?? "Eventbesuch bevorzugen, aber nicht erzwingen",
    };
    return next;
  }

  next[targetIndex] = {
    ...target,
    kind: target.kind === "walk" ? "sightseeing" : "activity",
    label: "Markt / Festival",
    hint: "Markt, Food-Event oder Festival als flexibler Highlight-Stop",
    phaseGoal: target.phaseGoal ?? "Flexible Eventstimmung mit lokalem Charakter ergänzen",
  };
  return next;
}
