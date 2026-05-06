import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type KielSourceText = {
  rel?: string | null;
  type?: string | null;
  value?: string | null;
};

type KielSourceGeo = {
  main?: {
    latitude?: number | null;
    longitude?: number | null;
  } | null;
};

type KielSourceMediaObject = {
  rel?: string | null;
  url?: string | null;
  value?: string | null;
};

type KielSourceAttribute = {
  key?: string | null;
  value?: string | null;
};

type KielSourceAddress = {
  name?: string | null;
  city?: string | null;
  zip?: string | null;
  street?: string | null;
  web?: string | null;
  email?: string | null;
  rel?: string | null;
};

type KielSourceInterval = {
  start?: string | null;
  end?: string | null;
};

type KielSourceItem = {
  global_id: string;
  id?: string | null;
  title?: string | null;
  type?: string | null;
  categories?: string[] | null;
  texts?: KielSourceText[] | null;
  country?: string | null;
  city?: string | null;
  zip?: string | null;
  street?: string | null;
  phone?: string | null;
  web?: string | null;
  email?: string | null;
  geo?: KielSourceGeo | null;
  keywords?: string[] | null;
  features?: string[] | null;
  timeIntervals?: KielSourceInterval[] | null;
  name?: string | null;
  attributes?: KielSourceAttribute[] | null;
  addresses?: KielSourceAddress[] | null;
  source?: {
    url?: string | null;
    value?: string | null;
  } | null;
  company?: string | null;
  district?: string | null;
  media_objects?: KielSourceMediaObject[] | null;
};

type KielSearchResponse = {
  status?: string | null;
  count?: number | null;
  overallcount?: number | null;
  items?: KielSourceItem[] | null;
};

type KielEnhancedEventProps = {
  uriPathSegment?: string | null;
  globalId?: string | null;
  title?: string | null;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
  categories?: string[] | null;
  teaser?: string | null;
  description?: string | null;
  keywords?: string[] | null;
  features?: string[] | null;
  imageUri?: string | null;
  imageCopyright?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  priceInfo?: string | null;
  venueName?: string | null;
  venueDirections?: string | null;
  ticketSaleUrl?: string | null;
  lastImportDate?: string | null;
};

type KielEnhancedOccurrence = {
  globalId: string;
  startDate?: string | null;
  endDate?: string | null;
  eventProps?: KielEnhancedEventProps | null;
  eventUri?: string | null;
};

type KielPreparedEvent = {
  item: KielSourceItem;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  detail: KielEnhancedOccurrence | null;
};

const KIEL_SEARCH_API_URL = "https://meta.et4.de/rest.ashx/search/";
const KIEL_ENHANCE_API_URL = "https://kiel-sailing-city.de/api/events/enhance";
const DEFAULT_BASE_URL = "https://kiel-sailing-city.de/veranstaltungen";
const LOOKAHEAD_DAYS = 180;
const SEARCH_PAGE_SIZE = 100;
const MAX_PAGES = 40;
const ENHANCE_CHUNK_SIZE = 25;
const MAX_OCCURRENCES_PER_EVENT = 6;

const CATEGORY_PRIORITY: Record<OfficialCityEvent["category"], number> = {
  concert: 88,
  theater: 86,
  show: 84,
  market: 82,
  festival: 80,
  fair: 72,
  food_event: 78,
  community: 64,
  seasonal: 68,
  other: 52,
};

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

function toAbsoluteUrl(url: string | null | undefined, baseUrl: string) {
  const normalized = normalizeText(url);
  if (!normalized) return null;
  try {
    return new URL(normalized, baseUrl).toString();
  } catch {
    return normalized;
  }
}

function normalizeDateString(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  return /[+-]\d{2}$/.test(normalized) ? `${normalized}:00` : normalized;
}

function parseDate(value: string | null | undefined) {
  const normalized = normalizeDateString(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : null;
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function berlinLocalParts(date: Date) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

function berlinDateString(date: Date) {
  const local = berlinLocalParts(date);
  return `${String(local.year).padStart(4, "0")}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
}

function berlinOffset(date: Date) {
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

  const utcLikeLocalMs = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  const diffMinutes = Math.round((utcLikeLocalMs - date.getTime()) / 60000);
  const sign = diffMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(diffMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

function buildDateMode(startDate: string, endDate: string) {
  const start = `${startDate}T00:00:00${berlinOffset(new Date(`${startDate}T00:00:00Z`))}`;
  const end = `${endDate}T00:00:00${berlinOffset(new Date(`${endDate}T00:00:00Z`))}`;
  return `date,${start},${end}`;
}

function buildSearchQuery(searchTerm = "", categories: string[] = [], venueName?: string | null) {
  let query = normalizeText(searchTerm);
  const normalizedCategories = categories.map(normalizeText).filter(Boolean);

  if (normalizedCategories.length > 0) {
    const categoryQuery = `category:${normalizedCategories.join(" OR ")}`;
    query = query ? `${query} AND (${categoryQuery})` : categoryQuery;
  }

  const normalizedVenue = normalizeText(venueName);
  if (normalizedVenue) {
    const venueQuery = `name:"${normalizedVenue}"`;
    query = query ? `${query} AND (${venueQuery})` : venueQuery;
  }

  return query;
}

function buildSearchUrl(offset: number, startDate: string, endDate: string) {
  const url = new URL(KIEL_SEARCH_API_URL);
  url.searchParams.set("type", "Event");
  url.searchParams.set("experience", "kiel-sailing-city");
  url.searchParams.set("mkt", "de");
  url.searchParams.set("maxresponsetime", "0");
  url.searchParams.set("q", buildSearchQuery());
  url.searchParams.set("mode", buildDateMode(startDate, endDate));
  url.searchParams.set("sort", "start asc");
  url.searchParams.set("unrollintervals", "true");
  url.searchParams.set("limit", String(SEARCH_PAGE_SIZE));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("template", "ET2014A_LIGHT.json");
  return url.toString();
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "application/json,text/plain,*/*",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`[kiel_sailing_city] HTTP ${response.status} fuer ${url}`);
  }

  return (await response.json()) as T;
}

async function fetchSearchPage(offset: number, startDate: string, endDate: string) {
  return fetchJson<KielSearchResponse>(buildSearchUrl(offset, startDate, endDate));
}

function attributeValue(item: KielSourceItem, key: string) {
  return (
    (item.attributes ?? [])
      .find((entry) => normalizeText(entry.key).toLowerCase() === key.toLowerCase())
      ?.value?.trim() ?? null
  );
}

function parseOccurrence(item: KielSourceItem) {
  const startAt = normalizeDateString(attributeValue(item, "interval_start")) || normalizeDateString(item.timeIntervals?.[0]?.start);
  if (!startAt) return null;

  const endAt = normalizeDateString(attributeValue(item, "interval_end")) || normalizeDateString(item.timeIntervals?.[0]?.end) || null;
  const startDate = parseDate(startAt);
  const endDate = parseDate(endAt);
  const durationMs =
    startDate && endDate ? Math.max(0, endDate.getTime() - startDate.getTime()) : null;

  const allDay = Boolean(
    startDate &&
      ((startDate.getHours() === 0 && startDate.getMinutes() === 0 && !endDate) ||
        (durationMs !== null && durationMs >= 20 * 60 * 60 * 1000))
  );

  return {
    startAt,
    endAt,
    allDay,
  };
}

function deriveAllDay(startAt: string, endAt: string | null) {
  const startDate = parseDate(startAt);
  const endDate = parseDate(endAt);
  const durationMs =
    startDate && endDate ? Math.max(0, endDate.getTime() - startDate.getTime()) : null;

  return Boolean(
    startDate &&
      ((startDate.getHours() === 0 && startDate.getMinutes() === 0 && !endDate) ||
        (durationMs !== null && durationMs >= 20 * 60 * 60 * 1000))
  );
}

function detailKey(globalId: string, startAt: string | null | undefined) {
  const date = parseDate(startAt);
  if (!date) return null;
  return `${globalId}:${date.getTime()}`;
}

function limitOccurrences(items: KielSourceItem[]) {
  const grouped = new Map<string, Array<{ item: KielSourceItem; startAt: string; endAt: string | null; allDay: boolean }>>();

  for (const item of items) {
    if (!item.global_id) continue;
    const occurrence = parseOccurrence(item);
    if (!occurrence) continue;
    const bucket = grouped.get(item.global_id) ?? [];
    bucket.push({ item, ...occurrence });
    grouped.set(item.global_id, bucket);
  }

  const limited: Array<{ item: KielSourceItem; startAt: string; endAt: string | null; allDay: boolean }> = [];
  for (const bucket of grouped.values()) {
    bucket.sort((left, right) => left.startAt.localeCompare(right.startAt));
    limited.push(...bucket.slice(0, MAX_OCCURRENCES_PER_EVENT));
  }

  return limited.sort((left, right) => left.startAt.localeCompare(right.startAt));
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function fetchEnhancementChunk(globalIds: string[], startDate: string, endDate: string) {
  const response = await fetch(KIEL_ENHANCE_API_URL, {
    method: "POST",
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "application/json,text/plain,*/*",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      eventIds: globalIds,
      startDate,
      endDate,
      limit: Math.max(120, globalIds.length * MAX_OCCURRENCES_PER_EVENT * 4),
      offset: 0,
    }),
  });

  if (!response.ok) {
    throw new Error(`[kiel_sailing_city] Enhance HTTP ${response.status} fuer ${globalIds.length} IDs`);
  }

  const text = normalizeText(await response.text());
  if (!text) return [] as KielEnhancedOccurrence[];
  return JSON.parse(text) as KielEnhancedOccurrence[];
}

async function fetchEnhancementMaps(globalIds: string[], startDate: string, endDate: string) {
  const byKey = new Map<string, KielEnhancedOccurrence>();
  const byId = new Map<string, KielEnhancedOccurrence>();

  for (const ids of chunk(globalIds, ENHANCE_CHUNK_SIZE)) {
    const enhanced = await fetchEnhancementChunk(ids, startDate, endDate);
    for (const occurrence of enhanced) {
      if (!occurrence.globalId) continue;
      const key = detailKey(occurrence.globalId, occurrence.startDate);
      if (key && !byKey.has(key)) {
        byKey.set(key, occurrence);
      }
      if (!byId.has(occurrence.globalId)) {
        byId.set(occurrence.globalId, occurrence);
      }
    }
  }

  return { byKey, byId };
}

function mergedCategories(event: KielPreparedEvent) {
  const raw = event.item.categories ?? [];
  const detail = event.detail?.eventProps?.categories ?? [];
  return Array.from(
    new Set([...raw, ...detail].map((entry) => normalizeText(entry)).filter(Boolean))
  );
}

function collectText(event: KielPreparedEvent) {
  const raw = event.item;
  const detail = event.detail?.eventProps ?? null;

  const rawTexts = (raw.texts ?? []).map((entry) => stripTags(entry.value)).filter(Boolean);
  const detailTexts = [detail?.teaser, detail?.description].map(stripTags).filter(Boolean);

  return [
    normalizeText(raw.title),
    normalizeText(detail?.title),
    normalizeText(raw.name),
    normalizeText(detail?.venueName),
    ...mergedCategories(event),
    ...(raw.keywords ?? []).map(normalizeText),
    ...(detail?.keywords ?? []).map(normalizeText),
    ...(raw.features ?? []).map(normalizeText),
    ...(detail?.features ?? []).map(normalizeText),
    ...rawTexts,
    ...detailTexts,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function categoryFromEvent(event: KielPreparedEvent): OfficialCityEvent["category"] {
  const title = [
    normalizeText(event.detail?.eventProps?.title),
    normalizeText(event.item.title),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const categories = mergedCategories(event).join(" ").toLowerCase();
  const text = collectText(event);
  const combined = `${title} ${categories} ${text}`.trim();

  if (/(wochenmarkt|flohmarkt|markt\b|bauernmarkt|kunstmarkt|tr[oö]del|street food market|zwischenfest|markttag|hafenmarkt|regiomarkt)/.test(combined)) {
    return "market";
  }
  if (/(kulinar|gastro|genuss|street food|food festival|weinfest|bierfest|tasting|brunch)/.test(combined)) {
    return "food_event";
  }
  if (/(f[üu]hrung|besichtigung|stadtrallye|rallye|tour\b|rundgang|workshop|kurs|seminar|forum|treff|kirche|sport|freizeit)/.test(combined)) {
    return "community";
  }
  if (/(ausstellung|dauerausstellung|museum|messe\b|expo|kongress|tagung|symposium|wissenschaft)/.test(combined)) {
    return "fair";
  }
  if (/(festival|open air|stadtfest|festspiele|future week|science comes to town|kultur[- ]?wochen)/.test(combined)) {
    return "festival";
  }
  if (/(theater|schauspiel|oper\b|operette|ballett|tanztheater|puppen|figurentheater|klexs|tristan und isolde)/.test(combined)) {
    return "theater";
  }
  if (/(comedy|kabarett|karaoke|film|kino|lesung|performance|nachtleben|party|poetry slam|slam|show\b|quiz|impro|zauber|magie|premierenwerkstatt|talk\b)/.test(combined)) {
    return "show";
  }
  if (/(konzert|orchester|chor|jazz|rock|pop|live[- ]?musik|philharm|singer|songwriter|bass\b|dj set)/.test(combined)) {
    return "concert";
  }
  if (/(weihnacht|advent|oster|fruehling|frühling|sommerfest|herbst|winter)/.test(combined)) {
    return "seasonal";
  }
  return "other";
}

function kindForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") {
    return "anchored_event" as const;
  }
  return "flex_event" as const;
}

function audienceForEvent(category: OfficialCityEvent["category"], text: string) {
  const audiences = new Set<string>();
  if (/(kinder|familie|family|jugend|schul)/.test(text)) audiences.add("family");
  if (/(markt|festival|museum|tour|f[üu]hrung|ausstellung|science|stadtfest)/.test(text)) audiences.add("tourism");
  if (/(konzert|theater|show|karaoke|party|kino|festival|comedy)/.test(text)) audiences.add("friends");
  if (/(jazz|konzert|theater|show|wein|dinner|romantik|comedy)/.test(text)) audiences.add("date");
  if (audiences.size === 0) audiences.add(category === "community" ? "tourism" : "friends");
  return Array.from(audiences);
}

function occasionsForCategory(category: OfficialCityEvent["category"]) {
  switch (category) {
    case "concert":
    case "show":
    case "theater":
      return ["date", "friends", "tourism"];
    case "market":
    case "festival":
    case "food_event":
      return ["friends", "family", "tourism"];
    case "fair":
    case "community":
      return ["tourism", "family"];
    default:
      return ["tourism"];
  }
}

function indoorOutdoorForEvent(text: string) {
  if (/(open air|markt|hafen|ufer|platz|park|freiluft|drau[ßs]en|outdoor|stadion)/.test(text)) {
    return "outdoor" as const;
  }
  if (/(theater|museum|kino|halle|oper|pub|bar|zentrum|saal|kirche)/.test(text)) {
    return "indoor" as const;
  }
  return null;
}

function venueNameForEvent(event: KielPreparedEvent) {
  return (
    normalizeText(event.detail?.eventProps?.venueName) ||
    normalizeText(event.item.name) ||
    normalizeText(event.item.company) ||
    null
  );
}

function venueAddressForEvent(event: KielPreparedEvent) {
  const detail = event.detail?.eventProps ?? null;
  const detailAddress = [
    normalizeText(detail?.street),
    [normalizeText(detail?.zip), normalizeText(detail?.city)].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  if (detailAddress) return detailAddress;

  return [
    normalizeText(event.item.street),
    [normalizeText(event.item.zip), normalizeText(event.item.city)].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ") || null;
}

function sourceUrlForEvent(event: KielPreparedEvent, config: EventSourceConfigRow) {
  const baseUrl = normalizeText(config.base_url) || DEFAULT_BASE_URL;
  const eventUri = normalizeText(event.detail?.eventUri);
  if (eventUri) return toAbsoluteUrl(eventUri, baseUrl);

  const uriPathSegment = normalizeText(event.detail?.eventProps?.uriPathSegment);
  if (uriPathSegment) return toAbsoluteUrl(`/e/${uriPathSegment}`, baseUrl);

  const web = normalizeText(event.detail?.eventProps?.website) || normalizeText(event.item.web);
  if (web) return toAbsoluteUrl(web, baseUrl);

  return baseUrl;
}

function ticketUrlForEvent(event: KielPreparedEvent, config: EventSourceConfigRow) {
  const baseUrl = normalizeText(config.base_url) || DEFAULT_BASE_URL;
  const ticketUrl = normalizeText(event.detail?.eventProps?.ticketSaleUrl);
  if (ticketUrl) return toAbsoluteUrl(ticketUrl, baseUrl);
  return null;
}

function sourceUpdatedAtForEvent(event: KielPreparedEvent) {
  const updated = parseDate(event.detail?.eventProps?.lastImportDate);
  return updated ? updated.toISOString() : new Date().toISOString();
}

function tagsForEvent(event: KielPreparedEvent) {
  return Array.from(
    new Set(
      [
        ...mergedCategories(event),
        ...(event.detail?.eventProps?.keywords ?? []),
        ...(event.item.keywords ?? []),
        ...(event.detail?.eventProps?.features ?? []),
        ...(event.item.features ?? []),
      ]
        .map((entry) => normalizeText(entry))
        .filter(Boolean)
    )
  );
}

function subtypesForEvent(category: OfficialCityEvent["category"], text: string) {
  const subtypes = new Set<string>();
  if (category === "concert") subtypes.add("live_music");
  if (category === "theater") subtypes.add("stage_event");
  if (category === "show") subtypes.add("evening_event");
  if (category === "market") subtypes.add("market_event");
  if (category === "festival") subtypes.add("festival_event");
  if (category === "fair") subtypes.add("exhibition_event");
  if (category === "food_event") subtypes.add("food_event");
  if (category === "community") subtypes.add("community_event");
  if (category === "seasonal") subtypes.add("seasonal_event");
  if (/(ticket|karten|eintritt|reservierung)/.test(text)) subtypes.add("ticketed_event");
  if (/(f[üu]hrung|stadtrallye|rundgang|tour\b)/.test(text)) subtypes.add("guided_tour");
  if (/(nachtleben|party|karaoke|pub)/.test(text)) subtypes.add("nightlife");
  if (/(kinder|familie|family|jugend)/.test(text)) subtypes.add("family_event");
  return Array.from(subtypes);
}

function effectiveLat(event: KielPreparedEvent) {
  const detailLat = event.detail?.eventProps?.latitude;
  if (typeof detailLat === "number" && Number.isFinite(detailLat)) return detailLat;
  const rawLat = event.item.geo?.main?.latitude;
  return typeof rawLat === "number" && Number.isFinite(rawLat) ? rawLat : null;
}

function effectiveLng(event: KielPreparedEvent) {
  const detailLng = event.detail?.eventProps?.longitude;
  if (typeof detailLng === "number" && Number.isFinite(detailLng)) return detailLng;
  const rawLng = event.item.geo?.main?.longitude;
  return typeof rawLng === "number" && Number.isFinite(rawLng) ? rawLng : null;
}

export async function fetchKielSailingCityEvents(config: EventSourceConfigRow) {
  const today = new Date();
  const startDate = berlinDateString(today);
  const endDate = berlinDateString(addDays(today, LOOKAHEAD_DAYS));
  const horizonStart = parseDate(`${startDate}T00:00:00+02:00`);

  const rawItems: KielSourceItem[] = [];
  let offset = 0;
  let overallCount = 0;
  let page = 0;

  while (page < MAX_PAGES) {
    const response = await fetchSearchPage(offset, startDate, endDate);
    const items = response.items ?? [];
    if (items.length === 0) break;

    rawItems.push(...items);
    overallCount = Number(response.overallcount ?? items.length);
    offset += items.length;
    page += 1;
    if (offset >= overallCount) break;
  }

  const limited = limitOccurrences(rawItems);
  const globalIds = Array.from(new Set(limited.map((entry) => entry.item.global_id).filter(Boolean)));
  const enhancementMaps = await fetchEnhancementMaps(globalIds, startDate, endDate);

  return limited.flatMap((entry) => {
    const key = detailKey(entry.item.global_id, entry.startAt);
    const detail =
      (key ? enhancementMaps.byKey.get(key) : null) ??
      enhancementMaps.byId.get(entry.item.global_id) ??
      null;
    const startAt = normalizeDateString(detail?.startDate) || entry.startAt;
    const endAt = normalizeDateString(detail?.endDate) || entry.endAt;
    const startDateValue = parseDate(startAt);

    if (!detail && startDateValue && horizonStart && startDateValue.getTime() < horizonStart.getTime()) {
      return [];
    }

    return [
      {
        ...entry,
        startAt,
        endAt,
        allDay: deriveAllDay(startAt, endAt),
        detail,
      } satisfies KielPreparedEvent,
    ];
  });
}

export function normalizeKielSailingCityEvent(
  event: KielPreparedEvent,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const title =
    normalizeText(event.detail?.eventProps?.title) ||
    normalizeText(event.item.title) ||
    null;
  if (!title || !event.startAt) return null;

  const text = collectText(event);
  const category = categoryFromEvent(event);
  if (category === "other") return null;
  const audiences = audienceForEvent(category, text);
  const ticketUrl = ticketUrlForEvent(event, config);

  return {
    source: config.provider,
    external_id: `kiel_sailing_city:${event.item.global_id}:${event.startAt}`,
    source_url: sourceUrlForEvent(event, config),
    ticket_url: ticketUrl,
    title,
    summary:
      stripTags(event.detail?.eventProps?.teaser) ||
      stripTags(event.detail?.eventProps?.description) ||
      stripTags((event.item.texts ?? []).find((entry) => normalizeText(entry.rel).toLowerCase() === "teaser")?.value) ||
      null,
    category,
    kind: kindForCategory(category),
    status: "scheduled",
    venue_name: venueNameForEvent(event),
    venue_address: venueAddressForEvent(event),
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: effectiveLat(event),
    lng: effectiveLng(event),
    timezone: "Europe/Berlin",
    start_at: event.startAt,
    end_at: event.endAt,
    doors_at: null,
    all_day: event.allDay,
    is_ticketed: Boolean(ticketUrl) || /(ticket|karten|preis|eintritt)/.test(text),
    price_min: null,
    price_max: null,
    currency: null,
    family_friendly: audiences.includes("family"),
    indoor_outdoor: indoorOutdoorForEvent(text),
    local_rank: CATEGORY_PRIORITY[category] + (ticketUrl ? 4 : 0),
    importance_score: CATEGORY_PRIORITY[category],
    popularity_score: CATEGORY_PRIORITY[category] - 4 + ((event.detail?.eventProps?.imageUri || event.item.media_objects?.length) ? 3 : 0),
    tags: tagsForEvent(event),
    subtypes: subtypesForEvent(category, text),
    audiences,
    occasions: occasionsForCategory(category),
    source_payload: {
      item: event.item,
      detail: event.detail,
    },
    source_updated_at: sourceUpdatedAtForEvent(event),
    last_seen_at: new Date().toISOString(),
  };
}
