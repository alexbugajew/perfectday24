import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type LuebeckClassification = {
  "skos:prefLabel"?: string | null;
};

type LuebeckGeo = {
  latitude?: number | null;
  longitude?: number | null;
};

type LuebeckPostalAddress = {
  streetAddress?: string | null;
  postalCode?: string | null;
  addressLocality?: string | null;
};

type LuebeckLocation = {
  name?: string | null;
  address?: LuebeckPostalAddress | null;
  geo?: LuebeckGeo | null;
  "dc:slug"?: string | null;
  "dc:classification"?: LuebeckClassification[] | null;
};

type LuebeckSchedule = {
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  duration?: string | number | null;
  scheduleTimezone?: string | null;
};

type LuebeckListEvent = {
  "@id"?: string | null;
  name?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  url?: string | null;
  "dc:slug"?: string | null;
};

type LuebeckDetailEvent = {
  "@id"?: string | null;
  "@type"?: string | string[] | null;
  name?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  url?: string | null;
  location?: LuebeckLocation | LuebeckLocation[] | null;
  eventSchedule?: LuebeckSchedule | LuebeckSchedule[] | null;
  potentialAction?: unknown;
  "dc:slug"?: string | null;
  "dct:modified"?: string | null;
  "dc:classification"?: LuebeckClassification[] | null;
  identifier?: string | string[] | null;
};

type LuebeckEndpointResponse = {
  "@graph"?: LuebeckListEvent[] | null;
  meta?: {
    total?: number | null;
    pages?: number | null;
  } | null;
};

type LuebeckPreparedEvent = {
  slug: string;
  sourceUrl: string;
  ticketUrl: string | null;
  title: string;
  summary: string | null;
  category: OfficialCityEvent["category"];
  venueName: string | null;
  venueAddress: string | null;
  lat: number | null;
  lng: number | null;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  familyFriendly: boolean | null;
  indoorOutdoor: OfficialCityEvent["indoor_outdoor"];
  tags: string[];
  subtypes: string[];
  audiences: string[];
  occasions: string[];
  sourceUpdatedAt: string | null;
  sourcePayload: {
    listEvent: LuebeckListEvent;
    detailEvent: LuebeckDetailEvent;
    occurrence: LuebeckSchedule;
  };
};

const LUEBECK_ROOT_URL = "https://www.luebeck-tourismus.de";
const LUEBECK_EVENTS_URL = `${LUEBECK_ROOT_URL}/veranstaltungen`;
const LUEBECK_API_ENDPOINT =
  "https://www.luebeck-tourismus.de/api/endpoints/96eb304d-ece8-4b30-b571-773b0ed9cc39";
const LOOKAHEAD_DAYS = 120;
const PAGE_SIZE = 100;
const MAX_PAGES = 6;
const DETAIL_BATCH_SIZE = 8;

const CATEGORY_PRIORITY: Record<OfficialCityEvent["category"], number> = {
  concert: 90,
  theater: 88,
  show: 86,
  market: 84,
  festival: 82,
  food_event: 80,
  fair: 74,
  seasonal: 72,
  community: 62,
  other: 10,
};

function asArray<T>(value: T | T[] | null | undefined) {
  if (!value) return [] as T[];
  return Array.isArray(value) ? value : [value];
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtml(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&uuml;/g, "ue")
    .replace(/&ouml;/g, "oe")
    .replace(/&auml;/g, "ae")
    .replace(/&Uuml;/g, "Ue")
    .replace(/&Ouml;/g, "Oe")
    .replace(/&Auml;/g, "Ae")
    .replace(/&szlig;/g, "ss");
}

function stripTags(text: string | null | undefined) {
  return normalizeText(decodeHtml(String(text ?? "").replace(/<[^>]+>/g, " ")));
}

function foldSearchText(value: string) {
  return decodeHtml(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00df/g, "ss")
    .toLowerCase();
}

function toAbsoluteUrl(url: string | null | undefined, baseUrl = LUEBECK_ROOT_URL) {
  const normalized = normalizeText(url);
  if (!normalized) return null;
  try {
    return new URL(normalized, baseUrl).toString();
  } catch {
    return normalized;
  }
}

async function fetchText(url: string, headers?: Record<string, string>) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml,application/xml",
      ...headers,
    },
  });

  if (!response.ok) {
    throw new Error(`[luebeck_tourism] HTTP ${response.status} fuer ${url}`);
  }

  return response.text();
}

async function fetchEndpointPage(page: number, startDate: string, endDate: string) {
  const body = JSON.stringify({
    page: { number: page, size: PAGE_SIZE },
    include: ["image", "location", "eventSchedule"],
    language: ["de"],
    filter: {
      schedule: {
        in: {
          min: startDate,
          max: endDate,
        },
      },
    },
  });

  const response = await fetch(LUEBECK_API_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/plain, */*",
      origin: LUEBECK_ROOT_URL,
      referer: LUEBECK_EVENTS_URL,
      "x-dc-middleware-origin": LUEBECK_EVENTS_URL,
      "user-agent": "perfectday24-event-ingest/1.0",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`[luebeck_tourism] API HTTP ${response.status} fuer Seite ${page}`);
  }

  return (await response.json()) as LuebeckEndpointResponse;
}

function addDays(date: Date, amount: number) {
  return new Date(date.getTime() + amount * 24 * 60 * 60 * 1000);
}

function berlinDateString(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function berlinLocalParts(date: Date) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function berlinOffset(date: Date) {
  const local = berlinLocalParts(date);
  const utcLikeLocalMs = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second
  );
  const diffMinutes = Math.round((utcLikeLocalMs - date.getTime()) / 60000);
  const sign = diffMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(diffMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

function berlinIso(year: number, month: number, day: number, hour: number, minute: number) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${berlinOffset(utcGuess)}`;
}

function berlinIsoForDate(date: Date) {
  const local = berlinLocalParts(date);
  return berlinIso(local.year, local.month, local.day, local.hour, local.minute);
}

function parseDateOnly(value: string | null | undefined) {
  const match = normalizeText(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function parseTimeParts(value: string | null | undefined) {
  const match = normalizeText(value).match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
    second: Number(match[3] ?? 0),
  };
}

function parseIsoDateTime(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) return null;
  const local = berlinLocalParts(parsed);
  return {
    year: local.year,
    month: local.month,
    day: local.day,
    hour: local.hour,
    minute: local.minute,
  };
}

function parseDurationMinutes(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  const normalized = normalizeText(value);
  if (!normalized) return null;

  const isoMatch = normalized.match(/^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)$/i);
  if (isoMatch) {
    const hours = Number(isoMatch[1] ?? 0);
    const minutes = Number(isoMatch[2] ?? 0);
    const seconds = Number(isoMatch[3] ?? 0);
    return hours * 60 + minutes + Math.round(seconds / 60);
  }

  return null;
}

function addMinutesToIso(isoString: string, minutes: number) {
  const parsed = new Date(isoString);
  if (!Number.isFinite(parsed.getTime()) || minutes <= 0) return null;
  return berlinIsoForDate(new Date(parsed.getTime() + minutes * 60 * 1000));
}

function defaultTimeForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") {
    return { hour: 19, minute: 30 };
  }
  if (category === "market" || category === "festival" || category === "fair" || category === "food_event") {
    return { hour: 12, minute: 0 };
  }
  return { hour: 17, minute: 0 };
}

function extractJsonLdScripts(html: string) {
  return Array.from(
    html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  ).map((match) => match[1]);
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function collectEventThings(input: unknown, bucket: LuebeckDetailEvent[]) {
  if (!input) return;
  if (Array.isArray(input)) {
    for (const item of input) collectEventThings(item, bucket);
    return;
  }
  if (typeof input !== "object") return;

  const obj = input as Record<string, unknown>;
  if (obj["@graph"]) {
    collectEventThings(obj["@graph"], bucket);
  }

  const rawType = obj["@type"];
  const types = Array.isArray(rawType) ? rawType.map(String) : rawType ? [String(rawType)] : [];
  if (types.some((type) => type.toLowerCase().includes("event"))) {
    bucket.push(obj as LuebeckDetailEvent);
  }
}

function extractDetailEvent(html: string) {
  const things: LuebeckDetailEvent[] = [];
  for (const script of extractJsonLdScripts(html)) {
    const parsed = safeJsonParse(script);
    if (!parsed) continue;
    collectEventThings(parsed, things);
  }
  return things[0] ?? null;
}

function buildDetailUrl(slug: string) {
  return `${LUEBECK_ROOT_URL}/event/${slug}`;
}

function extractSlug(event: LuebeckListEvent | LuebeckDetailEvent) {
  return normalizeText(event["dc:slug"]);
}

function buildEventSignal(title: string, description: string) {
  return foldSearchText([title, description].filter(Boolean).join(" "));
}

function shouldSkipTourismOffer(signal: string) {
  return /\b(day spa|meerblick|norderfahre|priwall|wakenitz|wellness|stadtfuhrung|kirchenfuhrung|klassische stadtfuhrung|nachtwachterfuhrung|stadtspaziergang|stadtrundgang|sehenswurdigkeiten|kreuzfahrt|fahre|ferry|schiff|schifffahrt|rundfahrt|bootsfahrt|sail and bike|sail and walk|boat trip|stand up paddling|city tour|sightseeing)\b/.test(
    signal
  );
}

function shouldSkipListEvent(event: LuebeckListEvent) {
  const title = normalizeText(event.name);
  const description = stripTags(event.description);
  const signal = buildEventSignal(title, description);
  if (!title || !extractSlug(event)) return true;
  return shouldSkipTourismOffer(signal);
}

function classificationLabels(classifications: LuebeckClassification[] | null | undefined) {
  return asArray(classifications)
    .map((entry) => normalizeText(entry["skos:prefLabel"]))
    .filter(Boolean);
}

function primaryLocation(detail: LuebeckDetailEvent) {
  return asArray(detail.location)[0] ?? null;
}

function locationAddress(location: LuebeckLocation | null) {
  if (!location?.address) return null;
  return [
    normalizeText(location.address.streetAddress),
    normalizeText(location.address.postalCode),
    normalizeText(location.address.addressLocality),
  ]
    .filter(Boolean)
    .join(", ") || null;
}

function locationGeo(location: LuebeckLocation | null) {
  const lat = location?.geo?.latitude;
  const lng = location?.geo?.longitude;
  return {
    lat: typeof lat === "number" && Number.isFinite(lat) ? lat : null,
    lng: typeof lng === "number" && Number.isFinite(lng) ? lng : null,
  };
}

function collectClassificationSignal(detail: LuebeckDetailEvent, location: LuebeckLocation | null) {
  return [
    ...classificationLabels(detail["dc:classification"]),
    ...classificationLabels(location?.["dc:classification"]),
  ];
}

function pickExternalUrl(detail: LuebeckDetailEvent, sourceUrl: string) {
  const candidates: string[] = [];
  const directUrl = toAbsoluteUrl(detail.url, sourceUrl);
  if (directUrl) candidates.push(directUrl);

  const stack: unknown[] = [detail.potentialAction];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (typeof current === "string") {
      const url = toAbsoluteUrl(current, sourceUrl);
      if (url) candidates.push(url);
      continue;
    }
    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }
    if (typeof current === "object") {
      for (const value of Object.values(current as Record<string, unknown>)) {
        stack.push(value);
      }
    }
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate === sourceUrl) continue;
    if (candidate.startsWith(`${LUEBECK_ROOT_URL}/event/`)) continue;
    return candidate;
  }

  return null;
}

function categoryFromDetail(detail: LuebeckDetailEvent, labels: string[], venueName: string | null) {
  const signal = foldSearchText(
    [
      normalizeText(detail.name),
      stripTags(detail.description),
      venueName,
      labels.join(" "),
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (/(weihnacht|advent|oster|wintermarkt|weihnachtsmarkt|adventsmarkt)/.test(signal)) {
    return "seasonal";
  }
  if (
    /(wochenmarkt|flohmarkt|trodel|troedel|basar|markt\b|buchermarkt|buchermesse|kunsthandwerkmarkt|bauernmarkt)/.test(
      signal
    )
  ) {
    return "market";
  }
  if (/(street food|kulinar|wein|bier|tasting|brunch|dinner|genuss|food)/.test(signal)) {
    return "food_event";
  }
  if (/(festival|stadtfest|open air|hafenfest|sommerfest|kulturfest|festspiele|festtage)/.test(signal)) {
    return "festival";
  }
  if (/(konzert|live musik|livemusik|jazz|orchester|chor|band\b|symphon|rock|pop\b|gala\b)/.test(signal)) {
    return "concert";
  }
  if (/(theater|oper|schauspiel|ballett|musical|buhne|buehne|puppentheater|tanztheater)/.test(signal)) {
    return "theater";
  }
  if (/(film|kino|lesung|vortrag|comedy|kabarett|show\b|performance|poetry slam|quiz|impro)/.test(signal)) {
    return "show";
  }
  if (/(ausstellung|vernissage|museum|galerie|messe|expo)/.test(signal)) {
    return "fair";
  }
  if (
    /(workshop|kurs|seminar|sport|yoga|treff|dialog|beratung|fuhrung|fuehrung|rundgang|wanderung|tour\b|spaziergang)/.test(
      signal
    )
  ) {
    return "community";
  }
  return "other";
}

function kindForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") {
    return "anchored_event" as const;
  }
  return "flex_event" as const;
}

function audiencesForCategory(category: OfficialCityEvent["category"], signal: string) {
  const audiences = new Set<string>();
  if (/(famil|kinder|jugend)/.test(signal)) audiences.add("family");
  if (category === "concert" || category === "show" || category === "festival") {
    audiences.add("friends");
    audiences.add("date");
  }
  if (category === "theater") {
    audiences.add("date");
    audiences.add("tourism");
  }
  if (category === "market" || category === "fair" || category === "food_event") {
    audiences.add("tourism");
    audiences.add("friends");
  }
  if (category === "community") {
    audiences.add("friends");
    audiences.add("tourism");
  }
  if (audiences.size === 0) audiences.add("friends");
  return Array.from(audiences);
}

function occasionsForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "show") return ["date", "friends", "party"];
  if (category === "theater") return ["date", "tourism"];
  if (category === "market" || category === "festival" || category === "food_event" || category === "fair") {
    return ["tourism", "friends", "family", "date"];
  }
  return ["tourism", "friends"];
}

function indoorOutdoorForSignal(signal: string, category: OfficialCityEvent["category"]) {
  if (/(markt|open air|ufer|hafen|platz|outdoor|strand|hof)/.test(signal)) return "outdoor" as const;
  if (/(theater|oper|kino|museum|galerie|kirche|saal|zentrum|halle)/.test(signal)) {
    return "indoor" as const;
  }
  if (category === "market" || category === "festival") return "mixed" as const;
  return null;
}

function subtypesForSignal(signal: string, category: OfficialCityEvent["category"], allDay: boolean) {
  return Array.from(
    new Set(
      [
        "concrete_event_page",
        category,
        /wochenmarkt/.test(signal) ? "weekly_market" : null,
        /markt\b|flohmarkt|trodel|troedel|basar/.test(signal) ? "market_event" : null,
        /festival|stadtfest|open air|hafenfest/.test(signal) ? "festival_event" : null,
        /fuhrung|fuehrung|rundgang|tour\b/.test(signal) ? "guided_tour" : null,
        /workshop|kurs|seminar/.test(signal) ? "workshop" : null,
        /vortrag|lesung|gesprach|comedy|kabarett/.test(signal) ? "talk" : null,
        /film|kino/.test(signal) ? "screening" : null,
        /konzert|live musik|livemusik|jazz|orchester|chor|band\b/.test(signal) ? "live_music" : null,
        /theater|oper|schauspiel|ballett|musical|puppentheater/.test(signal) ? "performing_arts" : null,
        /ausstellung|museum|galerie|vernissage/.test(signal) ? "exhibition" : null,
        /famil|kinder|jugend/.test(signal) ? "family_program" : null,
        allDay ? "all_day" : null,
      ].filter((value): value is string => Boolean(value))
    )
  );
}

function tagsForSignal(labels: string[], venueName: string | null, category: OfficialCityEvent["category"]) {
  return Array.from(
    new Set(
      ["luebeck_tourism", category, venueName ?? "", ...labels]
        .map((value) => normalizeText(value).toLowerCase())
        .filter(Boolean)
    )
  );
}

function buildOccurrence(
  schedule: LuebeckSchedule,
  detail: LuebeckDetailEvent,
  category: OfficialCityEvent["category"]
) {
  const startDate =
    parseDateOnly(schedule.startDate) ??
    (parseIsoDateTime(detail.startDate)
      ? {
          year: parseIsoDateTime(detail.startDate)!.year,
          month: parseIsoDateTime(detail.startDate)!.month,
          day: parseIsoDateTime(detail.startDate)!.day,
        }
      : null);
  if (!startDate) return null;

  const fallbackStartTime = parseIsoDateTime(detail.startDate);
  const startTime =
    parseTimeParts(schedule.startTime) ??
    (fallbackStartTime
      ? { hour: fallbackStartTime.hour, minute: fallbackStartTime.minute, second: 0 }
      : defaultTimeForCategory(category));

  const endDateParts =
    parseDateOnly(schedule.endDate) ??
    (parseIsoDateTime(detail.endDate)
      ? {
          year: parseIsoDateTime(detail.endDate)!.year,
          month: parseIsoDateTime(detail.endDate)!.month,
          day: parseIsoDateTime(detail.endDate)!.day,
        }
      : startDate);

  const endTime =
    parseTimeParts(schedule.endTime) ??
    (parseIsoDateTime(detail.endDate)
      ? {
          hour: parseIsoDateTime(detail.endDate)!.hour,
          minute: parseIsoDateTime(detail.endDate)!.minute,
          second: 0,
        }
      : null);

  const startAt = berlinIso(startDate.year, startDate.month, startDate.day, startTime.hour, startTime.minute);
  const durationMinutes = parseDurationMinutes(schedule.duration);
  const endAt = endTime
    ? berlinIso(endDateParts.year, endDateParts.month, endDateParts.day, endTime.hour, endTime.minute)
    : durationMinutes
      ? addMinutesToIso(startAt, durationMinutes)
      : null;

  return {
    startAt,
    endAt,
    allDay: !parseTimeParts(schedule.startTime) && !fallbackStartTime,
  };
}

function withinWindow(startAt: string, minDate: string, maxDate: string) {
  const day = startAt.slice(0, 10);
  return day >= minDate && day <= maxDate;
}

function capOccurrencesForCategory(
  occurrences: Array<{ schedule: LuebeckSchedule; startAt: string; endAt: string | null; allDay: boolean }>,
  category: OfficialCityEvent["category"]
) {
  const sorted = [...occurrences].sort((left, right) => left.startAt.localeCompare(right.startAt));
  if (category === "community" || category === "fair") return sorted.slice(0, 24);
  if (category === "market") return sorted.slice(0, 36);
  return sorted.slice(0, 60);
}

function preparedSignature(event: LuebeckPreparedEvent) {
  return [
    foldSearchText(event.title),
    foldSearchText(event.venueName ?? ""),
    event.startAt,
  ].join("|");
}

function preparedScore(event: LuebeckPreparedEvent) {
  return (
    CATEGORY_PRIORITY[event.category] +
    (event.lat !== null && event.lng !== null ? 6 : 0) +
    (event.ticketUrl ? 4 : 0) +
    (event.summary ? Math.min(4, Math.floor(event.summary.length / 120)) : 0)
  );
}

function dedupePreparedEvents(events: LuebeckPreparedEvent[]) {
  const bySignature = new Map<string, LuebeckPreparedEvent>();
  for (const event of events) {
    const signature = preparedSignature(event);
    const existing = bySignature.get(signature);
    if (!existing || preparedScore(event) >= preparedScore(existing)) {
      bySignature.set(signature, event);
    }
  }
  return Array.from(bySignature.values());
}

async function enrichListEvent(listEvent: LuebeckListEvent, minDate: string, maxDate: string) {
  const slug = extractSlug(listEvent);
  if (!slug) return [] as LuebeckPreparedEvent[];

  const sourceUrl = buildDetailUrl(slug);
  const html = await fetchText(sourceUrl, {
    referer: LUEBECK_EVENTS_URL,
  });
  const detail = extractDetailEvent(html);
  if (!detail) return [] as LuebeckPreparedEvent[];

  const detailSlug = extractSlug(detail) || slug;
  const location = primaryLocation(detail);
  const labels = collectClassificationSignal(detail, location);
  const venueName = normalizeText(location?.name) || null;
  const venueAddress = locationAddress(location);
  const signal = foldSearchText(
    [
      normalizeText(detail.name),
      stripTags(detail.description),
      venueName,
      labels.join(" "),
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (shouldSkipTourismOffer(signal)) {
    return [] as LuebeckPreparedEvent[];
  }

  const category = categoryFromDetail(detail, labels, venueName);
  if (category === "other") {
    return [] as LuebeckPreparedEvent[];
  }

  const geo = locationGeo(location);
  const ticketUrl = pickExternalUrl(detail, sourceUrl);
  const summary = stripTags(detail.description) || stripTags(listEvent.description) || null;
  const audiences = audiencesForCategory(category, signal);
  const occurrences = capOccurrencesForCategory(
    asArray(detail.eventSchedule)
      .map((schedule) => {
        const occurrence = buildOccurrence(schedule, detail, category);
        if (!occurrence) return null;
        return {
          schedule,
          ...occurrence,
        };
      })
      .filter((item): item is { schedule: LuebeckSchedule; startAt: string; endAt: string | null; allDay: boolean } => Boolean(item))
      .filter((item) => withinWindow(item.startAt, minDate, maxDate)),
    category
  );

  return occurrences.map(
    (occurrence) =>
      ({
        slug: detailSlug,
        sourceUrl,
        ticketUrl,
        title: normalizeText(detail.name) || normalizeText(listEvent.name),
        summary,
        category,
        venueName,
        venueAddress,
        lat: geo.lat,
        lng: geo.lng,
        startAt: occurrence.startAt,
        endAt: occurrence.endAt,
        allDay: occurrence.allDay,
        familyFriendly: audiences.includes("family"),
        indoorOutdoor: indoorOutdoorForSignal(signal, category),
        tags: tagsForSignal(labels, venueName, category),
        subtypes: subtypesForSignal(signal, category, occurrence.allDay),
        audiences,
        occasions: occasionsForCategory(category),
        sourceUpdatedAt: normalizeText(detail["dct:modified"]) || null,
        sourcePayload: {
          listEvent,
          detailEvent: detail,
          occurrence: occurrence.schedule,
        },
      }) satisfies LuebeckPreparedEvent
  );
}

export async function fetchLuebeckTourismEvents(_config: EventSourceConfigRow) {
  const minDate = berlinDateString(new Date());
  const maxDate = berlinDateString(addDays(new Date(), LOOKAHEAD_DAYS));
  const listEventsBySlug = new Map<string, LuebeckListEvent>();

  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= MAX_PAGES) {
    const response = await fetchEndpointPage(page, minDate, maxDate);
    const items = asArray(response["@graph"]).filter((item) => !shouldSkipListEvent(item));
    totalPages = Number(response.meta?.pages ?? 1);

    for (const item of items) {
      const slug = extractSlug(item);
      if (!slug || listEventsBySlug.has(slug)) continue;
      listEventsBySlug.set(slug, item);
    }

    if (items.length === 0) break;
    page += 1;
  }

  const prepared: LuebeckPreparedEvent[] = [];
  const listEvents = Array.from(listEventsBySlug.values());

  for (let index = 0; index < listEvents.length; index += DETAIL_BATCH_SIZE) {
    const batch = listEvents.slice(index, index + DETAIL_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((item) => enrichListEvent(item, minDate, maxDate))
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        prepared.push(...result.value);
      }
    }
  }

  return dedupePreparedEvents(prepared);
}

export function normalizeLuebeckTourismEvent(
  prepared: LuebeckPreparedEvent,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const title = normalizeText(prepared.title);
  if (!title || !prepared.startAt) return null;

  const hasGeo = typeof prepared.lat === "number" && typeof prepared.lng === "number";
  const importanceScore =
    CATEGORY_PRIORITY[prepared.category] +
    (prepared.ticketUrl ? 4 : 0) +
    (hasGeo ? 6 : 0);

  return {
    source: config.provider,
    external_id: `luebeck_tourism:${prepared.slug}:${prepared.startAt}`,
    source_url: prepared.sourceUrl,
    ticket_url: prepared.ticketUrl,
    title,
    summary: prepared.summary,
    category: prepared.category,
    kind: kindForCategory(prepared.category),
    status: "scheduled",
    venue_name: prepared.venueName,
    venue_address: prepared.venueAddress,
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: prepared.lat,
    lng: prepared.lng,
    timezone: "Europe/Berlin",
    start_at: prepared.startAt,
    end_at: prepared.endAt,
    doors_at: null,
    all_day: prepared.allDay,
    is_ticketed: Boolean(prepared.ticketUrl),
    price_min: null,
    price_max: null,
    currency: "EUR",
    family_friendly: prepared.familyFriendly,
    indoor_outdoor: prepared.indoorOutdoor,
    local_rank: importanceScore,
    importance_score: importanceScore,
    popularity_score: importanceScore - 6,
    tags: prepared.tags,
    subtypes: prepared.subtypes,
    audiences: prepared.audiences,
    occasions: prepared.occasions,
    source_payload: prepared.sourcePayload,
    source_updated_at: prepared.sourceUpdatedAt,
    last_seen_at: new Date().toISOString(),
  };
}
