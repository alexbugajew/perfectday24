import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type DresdenRuntimeConfig = {
  apiEntrypoint: string;
  apiKey: string;
};

type DresdenCategory = {
  id: number;
  title: string;
  short?: string | null;
};

type DresdenTag = {
  id: number;
  title: string;
};

type DresdenPrice = {
  id?: number;
  title?: string | null;
  amount?: number | null;
  show_in_overview?: boolean | null;
};

type DresdenLink = {
  id?: number;
  href?: string | null;
  title?: string | null;
  description?: string | null;
};

type DresdenLocation = {
  id: number;
  title?: string | null;
  address?: string | null;
  zip?: string | null;
  city?: string | null;
  country?: string | null;
  lat?: string | null;
  lng?: string | null;
  tags?: DresdenTag[] | null;
};

type DresdenHost = {
  id: number;
  title?: string | null;
  url?: string | null;
  location?: DresdenLocation | null;
};

type DresdenEvent = {
  id: number;
  title?: string | null;
  description?: string | null;
  categories?: number[] | null;
  is_highlight?: boolean | null;
  is_online_event?: boolean | null;
  prices?: DresdenPrice[] | null;
  host?: DresdenHost | null;
  location?: DresdenLocation | null;
  tags?: DresdenTag[] | null;
  updated_at?: string | null;
  event_links?: DresdenLink[] | null;
  ticket_link?: DresdenLink | false | null;
};

type DresdenEventDate = {
  id: number;
  start_date: string;
  end_date: string | null;
  event?: DresdenEvent | null;
  is_cancelled?: boolean | null;
  is_rescheduled?: boolean | null;
};

type DresdenEventDateResponse = {
  limit: number;
  offset: number;
  total_count: number;
  data: DresdenEventDate[];
};

type DresdenNormalizedItem = {
  eventDate: DresdenEventDate;
  event: DresdenEvent;
  categoryLookup: Map<number, DresdenCategory>;
  runtimeConfig: DresdenRuntimeConfig;
};

const DRESDEN_APP_URL = "https://veranstaltungen.dresden.de/";
const DRESDEN_TIMEZONE = "Europe/Berlin";
const MAX_PAGES = 8;
const PAGE_SIZE = 150;
const LOOKAHEAD_DAYS = 120;

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

function buildHorizonIso() {
  const next = new Date();
  next.setDate(next.getDate() + LOOKAHEAD_DAYS);
  return next.toISOString();
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml,application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`[dresden_tourism] HTTP ${response.status} fuer ${url}`);
  }

  return response.text();
}

async function resolveRuntimeConfig(config: EventSourceConfigRow): Promise<DresdenRuntimeConfig> {
  const appUrl = config.base_url.includes("veranstaltungen.dresden.de")
    ? config.base_url
    : DRESDEN_APP_URL;
  const html = await fetchText(appUrl);
  const apiEntrypoint = html.match(/API_ENTRYPOINT:'([^']+)'/i)?.[1] ?? "";
  const apiKey = html.match(/API_KEY:'([^']+)'/i)?.[1] ?? "";

  if (!apiEntrypoint || !apiKey) {
    throw new Error("[dresden_tourism] APP_CONFIG konnte nicht aus dem offiziellen Kalender gelesen werden.");
  }

  return {
    apiEntrypoint,
    apiKey,
  };
}

async function fetchJson<T>(runtimeConfig: DresdenRuntimeConfig, path: string, query?: URLSearchParams) {
  const url = new URL(path, runtimeConfig.apiEntrypoint);
  if (query) {
    url.search = query.toString();
  }

  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "application/json",
      "api-authorisation-key": runtimeConfig.apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`[dresden_tourism] API HTTP ${response.status} fuer ${url.toString()}`);
  }

  return (await response.json()) as T;
}

async function fetchCategoryLookup(runtimeConfig: DresdenRuntimeConfig) {
  const categories = await fetchJson<DresdenCategory[]>(runtimeConfig, "/api/v1/categories");
  return new Map(categories.map((category) => [category.id, category]));
}

function buildEventDateFilter() {
  return JSON.stringify({
    start_date_from: "now",
    end_date_to: buildHorizonIso(),
    parent_event: null,
  });
}

async function fetchUpcomingEventDates(runtimeConfig: DresdenRuntimeConfig) {
  const items: DresdenEventDate[] = [];
  const seenIds = new Set<number>();

  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
    const query = new URLSearchParams({
      include_event: "true",
      limit: String(PAGE_SIZE),
      offset: String(pageIndex * PAGE_SIZE),
      filter: buildEventDateFilter(),
    });

    const response = await fetchJson<DresdenEventDateResponse>(
      runtimeConfig,
      "/api/v1/eventdates",
      query
    );

    const page = (response.data ?? []).filter((item) => {
      if (!item?.event?.id) return false;
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });

    if (page.length === 0) break;
    items.push(...page);

    if (page.length < PAGE_SIZE) break;
  }

  return items;
}

function eventCategoryTitles(event: DresdenEvent, categoryLookup: Map<number, DresdenCategory>) {
  return (event.categories ?? [])
    .map((id) => categoryLookup.get(id))
    .filter((item): item is DresdenCategory => Boolean(item))
    .map((item) => normalizeText(item.title))
    .filter(Boolean);
}

function tagTitles(tags: DresdenTag[] | null | undefined) {
  return (tags ?? []).map((tag) => normalizeText(tag.title)).filter(Boolean);
}

function inferCategory(
  event: DresdenEvent,
  categoryLookup: Map<number, DresdenCategory>
): OfficialCityEvent["category"] {
  const categoryTitles = eventCategoryTitles(event, categoryLookup);
  const text = [
    normalizeText(event.title),
    stripTags(event.description),
    tagTitles(event.tags).join(" "),
    categoryTitles.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  const explicitMarketIntent = /\b(?:wochenmarkt|flohmarkt|markt)\b/.test(text);
  const explicitFestivalIntent = /\b(?:fest|festival)\b/.test(text);
  const guidedTourLike =
    /(fuehrung|führung|guided tour|tour|walk|rundfahrt|city tour|nightwatchman|nachtwächter|nachtwaechter)/.test(
      text
    );
  const stagePerformanceLike =
    /(impro|improtheater|jazzsession|session|musical|show|kabarett|comedy|film|kino|performance|buehne|bühne|stage)/.test(
      text
    );
  const exhibitionLike =
    /(museum|galerie|ausstellung|exhibition|installation|vernissage|sammlung)/.test(text);
  if (guidedTourLike && !explicitMarketIntent && !explicitFestivalIntent) return "community";
  if (/(theater|oper|opera|schauspiel|puppentheater|stage play)/.test(text)) return "theater";
  if (/(konzert|concert|live music|band|orchester|orchestra|musik)/.test(text)) {
    return "concert";
  }
  if (stagePerformanceLike && !explicitFestivalIntent && !explicitMarketIntent) return "show";
  if (exhibitionLike && !explicitMarketIntent && !explicitFestivalIntent) return "fair";
  if (explicitMarketIntent) return "market";
  if (explicitFestivalIntent && !stagePerformanceLike) return "festival";

  if (/(wochenmarkt|flohmarkt|handmademarkt|farmers market|market breakfast|\bmarkt\b)/.test(text)) {
    return "market";
  }
  if (/(stadtfest|festival|fruehlingsfest|street food festival|weinfest|japan day|fest)/.test(text)) {
    return "festival";
  }
  if (/(kirmes|funfair|mess|messe|expo|kongress)/.test(text)) return "fair";
  if (/(essen|trinken|wine|tasting|brunch|dinner|culinary|kulinar)/.test(text)) {
    return "food_event";
  }
  if (/(museum|galerie|ausstellung|exhibition|installation)/.test(text)) return "fair";
  if (stagePerformanceLike || /(musical|show|kabarett|comedy|circus|party|tanz|dance|film|kino)/.test(text)) {
    return "show";
  }
  if (/(fruehling|sommer|winter|weihnacht|advent|ostern|seasonal)/.test(text)) {
    return "seasonal";
  }
  if (event.categories?.includes(12)) return "concert";
  if (event.categories?.includes(13)) return "fair";
  if (event.categories?.includes(14) || event.categories?.includes(15)) return "show";
  if (event.categories?.includes(16)) return "festival";
  if (event.categories?.includes(18) || event.categories?.includes(20)) return "community";
  if (event.categories?.includes(19)) return "fair";
  if (event.categories?.includes(23)) return "food_event";
  return "other";
}

function kindForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") {
    return "anchored_event" as const;
  }
  return "flex_event" as const;
}

function audiencesForCategory(category: OfficialCityEvent["category"], text: string) {
  const lower = text.toLowerCase();
  if (/famil(y|ien)|kinder|children/.test(lower)) return ["family", "tourism"];
  if (category === "concert" || category === "show") return ["date", "friends", "party"];
  if (category === "theater") return ["date", "tourism"];
  if (category === "market" || category === "festival" || category === "food_event") {
    return ["tourism", "friends", "family", "date"];
  }
  return ["tourism", "friends"];
}

function occasionsForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "show") return ["date", "friends", "party"];
  if (category === "theater") return ["date", "tourism"];
  if (category === "market" || category === "festival" || category === "food_event") {
    return ["tourism", "friends", "family", "date"];
  }
  return ["tourism", "friends"];
}

function parseCoordinate(value: string | null | undefined) {
  const parsed = Number.parseFloat(normalizeText(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function buildVenueAddress(location: DresdenLocation | null | undefined) {
  const address = normalizeText(location?.address);
  const zip = normalizeText(location?.zip);
  const city = normalizeText(location?.city);
  return [address, [zip, city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null;
}

function normalizeStatus(eventDate: DresdenEventDate): OfficialCityEvent["status"] {
  if (eventDate.is_cancelled) return "cancelled";
  if (eventDate.is_rescheduled) return "postponed";
  return "scheduled";
}

function isAllDay(eventDate: DresdenEventDate) {
  const start = normalizeText(eventDate.start_date);
  const end = normalizeText(eventDate.end_date);
  if (!start) return false;
  if (/T00:00:00/.test(start) && (/T23:59:00/.test(end) || /T00:00:00/.test(end))) return true;
  return false;
}

function ticketUrlForEvent(event: DresdenEvent, runtimeConfig: DresdenRuntimeConfig) {
  const ticketLink = event.ticket_link && typeof event.ticket_link === "object" ? event.ticket_link : null;
  const eventLinks = (event.event_links ?? []).map((link) => toAbsoluteUrl(link.href, runtimeConfig.apiEntrypoint)).filter(Boolean);
  return (
    toAbsoluteUrl(ticketLink?.href, runtimeConfig.apiEntrypoint) ??
    eventLinks[0] ??
    null
  );
}

function tagsForEvent(event: DresdenEvent, categoryLookup: Map<number, DresdenCategory>) {
  return Array.from(
    new Set(
      [
        ...eventCategoryTitles(event, categoryLookup),
        ...tagTitles(event.tags),
        ...tagTitles(event.location?.tags),
        normalizeText(event.location?.title),
        "dresden_tourism",
      ]
        .map((item) => normalizeText(item))
        .filter(Boolean)
    )
  );
}

function subtypesForEvent(event: DresdenEvent, category: OfficialCityEvent["category"]) {
  const text = [
    normalizeText(event.title),
    stripTags(event.description),
    tagTitles(event.tags).join(" "),
  ]
    .join(" ")
    .toLowerCase();
  const explicitMarketIntent = /\b(?:wochenmarkt|flohmarkt|markt)\b/.test(text);
  const explicitFestivalIntent = /\b(?:fest|festival)\b/.test(text);
  const guidedTourLike = /(fuehrung|fÃ¼hrung|guided tour|tour|walk|rundfahrt)/.test(text);
  const stagePerformanceLike =
    /(impro|improtheater|jazzsession|session|musical|show|kabarett|comedy|film|kino|performance|buehne|bühne|stage)/.test(
      text
    );
  const exhibitionLike =
    /(museum|galerie|ausstellung|exhibition|installation|vernissage|sammlung)/.test(text);

  return Array.from(
    new Set(
      [
        "concrete_event_page",
        category,
        /wochenmarkt/.test(text) ? "weekly_market" : null,
        explicitMarketIntent ? "market_event" : null,
        /fuehrung|führung|guided tour|tour/.test(text) ? "guided_tour" : null,
        exhibitionLike ? "exhibition" : null,
        explicitFestivalIntent && !exhibitionLike && !guidedTourLike && !stagePerformanceLike
          ? "festival_event"
          : null,
        /kinder|famil/.test(text) ? "family_event" : null,
      ].filter((value): value is string => Boolean(value))
    )
  );
}

function priceBounds(prices: DresdenPrice[] | null | undefined) {
  const values = (prices ?? [])
    .map((price) => (typeof price.amount === "number" ? price.amount : null))
    .filter((value): value is number => value != null);

  if (values.length === 0) {
    return { min: null, max: null };
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export async function fetchDresdenTourismEvents(config: EventSourceConfigRow) {
  const runtimeConfig = await resolveRuntimeConfig(config);
  const [categoryLookup, eventDates] = await Promise.all([
    fetchCategoryLookup(runtimeConfig),
    fetchUpcomingEventDates(runtimeConfig),
  ]);

  return eventDates
    .filter((eventDate) => eventDate.event && !eventDate.event.is_online_event)
    .map((eventDate) => ({
      eventDate,
      event: eventDate.event as DresdenEvent,
      categoryLookup,
      runtimeConfig,
    }));
}

export function normalizeDresdenTourismEvent(
  item: DresdenNormalizedItem,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const { eventDate, event, categoryLookup, runtimeConfig } = item;
  const title = normalizeText(event.title);
  const startAt = normalizeText(eventDate.start_date);
  if (!title || !startAt) return null;

  const category = inferCategory(event, categoryLookup);
  if (category === "other") return null;

  const combinedText = [
    title,
    stripTags(event.description),
    eventCategoryTitles(event, categoryLookup).join(" "),
    tagTitles(event.tags).join(" "),
    normalizeText(event.location?.title),
  ].join(" ");
  const location = event.location ?? event.host?.location ?? null;
  const venueName = normalizeText(location?.title) || normalizeText(event.host?.title) || null;
  const venueAddress = buildVenueAddress(location);
  const coordinates = {
    lat: parseCoordinate(location?.lat),
    lng: parseCoordinate(location?.lng),
  };
  const prices = priceBounds(event.prices);
  const ticketUrl = ticketUrlForEvent(event, runtimeConfig);
  const audiences = audiencesForCategory(category, combinedText);
  const occasions = occasionsForCategory(category);

  return {
    source: config.provider,
    external_id: `dresden_tourism:${event.id}:${eventDate.id}`,
    source_url: `${runtimeConfig.apiEntrypoint.replace(/\/+$/, "")}/api/v1/events/${event.id}`,
    ticket_url: ticketUrl,
    title,
    summary: stripTags(event.description) || null,
    category,
    kind: kindForCategory(category),
    status: normalizeStatus(eventDate),
    venue_name: venueName,
    venue_address: venueAddress,
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: coordinates.lat,
    lng: coordinates.lng,
    timezone: DRESDEN_TIMEZONE,
    start_at: startAt,
    end_at: normalizeText(eventDate.end_date) || null,
    doors_at: null,
    all_day: isAllDay(eventDate),
    is_ticketed: Boolean(ticketUrl) || (prices.min ?? 0) > 0,
    price_min: prices.min,
    price_max: prices.max,
    currency: prices.min != null || prices.max != null ? "EUR" : null,
    family_friendly: audiences.includes("family"),
    indoor_outdoor: /open air|markt|park|garten|festival|fest/i.test(combinedText)
      ? "outdoor"
      : null,
    local_rank: event.is_highlight ? 80 : null,
    importance_score: event.is_highlight ? 75 : null,
    popularity_score: event.is_highlight ? 60 : null,
    tags: tagsForEvent(event, categoryLookup),
    subtypes: subtypesForEvent(event, category),
    audiences,
    occasions,
    source_payload: {
      eventDate,
      event,
    },
    source_updated_at: normalizeText(event.updated_at) || null,
    last_seen_at: new Date().toISOString(),
  };
}
