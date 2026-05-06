import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type LeipzigTravelCard = {
  ident: string;
  sourceUrl: string;
  title: string;
  dateText: string | null;
  timeText: string | null;
  infoLabel: string | null;
  locationText: string | null;
  lat: number | null;
  lng: number | null;
};

type LeipzigTravelDetail = {
  summary: string | null;
  ticketUrl: string | null;
  venueName: string | null;
  venueAddress: string | null;
  lat: number | null;
  lng: number | null;
  keywords: string[];
  matchedInterval: {
    date: string | null;
    startTime: string | null;
    endTime: string | null;
  } | null;
};

type LeipzigJsonLdEvent = {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  url?: string;
  keywords?: string | string[];
  eventAttendanceMode?: string;
  isAccessibleForFree?: boolean;
  offers?:
    | {
        url?: string;
      }
    | Array<{
        url?: string;
      }>;
  location?:
    | {
        name?: string;
        address?:
          | string
          | {
              streetAddress?: string;
              postalCode?: string;
              addressLocality?: string;
            };
        geo?: {
          latitude?: number;
          longitude?: number;
        };
      }
    | Array<{
        name?: string;
        address?:
          | string
          | {
              streetAddress?: string;
              postalCode?: string;
              addressLocality?: string;
            };
        geo?: {
          latitude?: number;
          longitude?: number;
        };
      }>;
};

type LeipzigTimeIntervalPayload = {
  id?: string;
  identifier?: string;
  globalId?: string;
  globalid?: string;
  objectId?: string;
  objectID?: string;
  url?: string;
  timeIntervals?: Array<Record<string, unknown>>;
};

const MAX_PAGES = 8;
const PAGE_SIZE = 24;
const DETAIL_CHUNK_SIZE = 6;

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

function stripTags(text: string) {
  return normalizeText(decodeHtml(text.replace(/<[^>]+>/g, " ")));
}

function normalizeAbsoluteUrl(url: string | null | undefined, baseUrl: string) {
  const normalized = normalizeText(url);
  if (!normalized) return baseUrl;
  try {
    return new URL(normalized, baseUrl).toString();
  } catch {
    return normalized;
  }
}

function buildPageUrl(baseUrl: string, pageIndex: number) {
  if (pageIndex <= 0) return baseUrl;
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/All/offset%3A${pageIndex * PAGE_SIZE}/`;
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`[leipzig_travel] HTTP ${response.status} fuer ${url}`);
  }

  return response.text();
}

function parseGeoLookup(html: string) {
  const encoded = html.match(/data-json-map-geojson="([^"]*)"/i)?.[1] ?? "";
  if (!encoded) return new Map<string, { lat: number | null; lng: number | null }>();

  const decoded = decodeHtml(encoded);
  let parsed: {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: { id?: string };
    }>;
  } | null = null;

  try {
    parsed = JSON.parse(decoded) as {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: { id?: string };
      }>;
    };
  } catch {
    return new Map();
  }

  const lookup = new Map<string, { lat: number | null; lng: number | null }>();
  for (const feature of parsed.features ?? []) {
    const ident = normalizeText(feature.properties?.id);
    const coords = feature.geometry?.coordinates;
    const lng = typeof coords?.[0] === "number" ? coords[0] : null;
    const lat = typeof coords?.[1] === "number" ? coords[1] : null;
    if (!ident) continue;
    lookup.set(ident, { lat, lng });
  }

  return lookup;
}

function parseCardBlocks(html: string, baseUrl: string) {
  const geoLookup = parseGeoLookup(html);
  const cards: LeipzigTravelCard[] = [];
  const parts = html.split('<div class="teaser-card result-item" data-globalid="').slice(1);

  for (const part of parts) {
    const ident = normalizeText(part.match(/^([^"]+)"/)?.[1] ?? "");
    const block = part.slice(0, 10000);
    if (!ident || !block) continue;

    const href =
      block.match(/<a href="([^"]+)" title="[^"]*" class="teaser-card__link">/i)?.[1] ?? null;
    const title =
      decodeHtml(block.match(/<a href="[^"]+" title="([^"]+)" class="teaser-card__link">/i)?.[1] ?? "") ||
      stripTags(block.match(/<span class="teaser-card__header">([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const dateText =
      stripTags(block.match(/<span class="teaser-card__subheader">([\s\S]*?)<\/span>/i)?.[1] ?? "") ||
      null;
    const lineTexts = Array.from(
      block.matchAll(/<div class="teaser-line__text">([\s\S]*?)<\/div>/gi)
    ).map((line) => stripTags(line[1]));
    const timeText = lineTexts[0] ?? null;
    const infoLabel = lineTexts[1] ?? null;
    const locationText = lineTexts[lineTexts.length - 1] ?? null;
    const geo = geoLookup.get(ident) ?? { lat: null, lng: null };

    if (!title || !href || !dateText) continue;

    cards.push({
      ident,
      sourceUrl: normalizeAbsoluteUrl(href, baseUrl),
      title,
      dateText,
      timeText,
      infoLabel,
      locationText,
      lat: geo.lat,
      lng: geo.lng,
    });
  }

  return cards;
}

function parseDateText(dateText: string | null) {
  const normalized = normalizeText(dateText);
  if (!normalized) return null;
  const match = normalized.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseTimeRange(timeText: string | null) {
  const normalized = normalizeText(timeText);
  if (!normalized) {
    return {
      startTime: null,
      endTime: null,
      allDay: true,
    };
  }

  const range = normalized.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  const single = normalized.match(/(\d{1,2}:\d{2})/);
  return {
    startTime: range?.[1] ?? single?.[1] ?? null,
    endTime: range?.[2] ?? null,
    allDay: !range && !single,
  };
}

function toBerlinIso(dateValue: string | null, timeValue: string | null) {
  const normalizedDate = normalizeText(dateValue);
  if (!normalizedDate) return null;
  const normalizedTime = normalizeText(timeValue) || "00:00";
  return `${normalizedDate}T${normalizedTime}:00+02:00`;
}

function parseJsonLdEvent(html: string) {
  const scripts = Array.from(
    html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  ).map((match) => match[1]);

  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script) as unknown;
      const bucket: LeipzigJsonLdEvent[] = [];
      collectJsonLdEvents(parsed, bucket);
      if (bucket.length > 0) {
        return bucket[0] ?? null;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function collectJsonLdEvents(input: unknown, bucket: LeipzigJsonLdEvent[]) {
  if (!input) return;
  if (Array.isArray(input)) {
    for (const item of input) collectJsonLdEvents(item, bucket);
    return;
  }
  if (typeof input !== "object") return;

  const obj = input as Record<string, unknown>;
  if (obj["@graph"]) {
    collectJsonLdEvents(obj["@graph"], bucket);
  }

  const rawType = obj["@type"];
  const types = Array.isArray(rawType) ? rawType.map(String) : rawType ? [String(rawType)] : [];
  if (types.some((type) => type.toLowerCase().includes("event"))) {
    bucket.push(obj as LeipzigJsonLdEvent);
  }
}

function parseKeywords(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeText(entry)).filter(Boolean);
  }
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return normalized.split(",").map((entry) => normalizeText(entry)).filter(Boolean);
}

function cleanVenueName(value: string | null | undefined, title: string) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (normalized.toLowerCase() === normalizeText(title).toLowerCase()) return null;
  return normalized;
}

function locationFromJsonLd(event: LeipzigJsonLdEvent) {
  const locations = Array.isArray(event.location)
    ? event.location
    : event.location
      ? [event.location]
      : [];
  return locations[0] ?? null;
}

function addressTextFromJsonLd(location: NonNullable<ReturnType<typeof locationFromJsonLd>>) {
  if (typeof location.address === "string") {
    return normalizeText(location.address) || null;
  }

  const street = normalizeText(location.address?.streetAddress);
  const postal = normalizeText(location.address?.postalCode);
  const locality = normalizeText(location.address?.addressLocality);
  return [street, [postal, locality].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null;
}

function collectTimeIntervalPayloads(input: unknown, bucket: LeipzigTimeIntervalPayload[]) {
  if (!input) return;
  if (Array.isArray(input)) {
    for (const item of input) collectTimeIntervalPayloads(item, bucket);
    return;
  }
  if (typeof input !== "object") return;

  const obj = input as Record<string, unknown>;
  if (Array.isArray(obj.timeIntervals)) {
    bucket.push(obj as LeipzigTimeIntervalPayload);
  }

  for (const value of Object.values(obj)) {
    collectTimeIntervalPayloads(value, bucket);
  }
}

function parseJsonScript(text: string) {
  try {
    return JSON.parse(decodeHtml(text)) as unknown;
  } catch {
    return null;
  }
}

function identifierMatches(payload: LeipzigTimeIntervalPayload, ident: string, sourceUrl: string) {
  const candidates = [
    payload.id,
    payload.identifier,
    payload.globalId,
    payload.globalid,
    payload.objectId,
    payload.objectID,
    payload.url,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  return candidates.some((value) => value.includes(ident) || value.includes(sourceUrl));
}

function extractDatePart(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const isoDate = normalized.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoDate) return isoDate[1];
  const dotted = normalized.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!dotted) return null;
  const [, day, month, year] = dotted;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractTimePart(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const match = normalized.match(/(\d{2}:\d{2})/);
  return match?.[1] ?? null;
}

function parseTimeIntervals(html: string, ident: string, sourceUrl: string, listingDate: string | null) {
  const matches = Array.from(
    html.matchAll(/<script[^>]*class=["'][^"']*js-ti-tag[^"']*["'][^>]*>([\s\S]*?)<\/script>/gi)
  );

  const payloads: LeipzigTimeIntervalPayload[] = [];
  for (const match of matches) {
    const parsed = parseJsonScript(match[1]);
    if (parsed) {
      collectTimeIntervalPayloads(parsed, payloads);
    }
  }

  if (payloads.length === 0) return null;

  const matched =
    payloads.find((payload) => identifierMatches(payload, ident, sourceUrl)) ??
    (payloads.length === 1 ? payloads[0] : null);

  if (!matched?.timeIntervals?.length) return null;

  const intervals = matched.timeIntervals
    .map((interval) => ({
      date:
        extractDatePart(interval.date) ??
        extractDatePart(interval.startDate) ??
        extractDatePart(interval.startAt) ??
        extractDatePart(interval.start),
      startTime:
        extractTimePart(interval.startTime) ??
        extractTimePart(interval.startDate) ??
        extractTimePart(interval.startAt) ??
        extractTimePart(interval.start),
      endTime:
        extractTimePart(interval.endTime) ??
        extractTimePart(interval.endDate) ??
        extractTimePart(interval.endAt) ??
        extractTimePart(interval.end),
    }))
    .filter((interval) => interval.date || interval.startTime || interval.endTime);

  if (intervals.length === 0) return null;
  return intervals.find((interval) => interval.date === listingDate) ?? intervals[0] ?? null;
}

function categoryFromText(text: string): OfficialCityEvent["category"] {
  const normalized = text.toLowerCase();
  const filmScreeningLike =
    /\b(?:film|kino|screening|movie|cinema|cinematheque|documentary)\b/.test(normalized);
  const stagedShowLike =
    /\b(?:show|musical|comedy|cabaret|kabarett|performance|circus)\b/.test(normalized);
  const guidedTourLike =
    /\b(?:museum tour|guided tour|tour|walk|city walk|city tour|story tour|fuehrung|führung|visit)\b/.test(
      normalized
    );
  const explicitMarketIntent =
    /\b(?:weekly market|wochenmarkt|flea market|flohmarkt|street food market|farmers market|night market|bazaar|trempelmarkt)\b/.test(
      normalized
    );
  const explicitFestivalIntent =
    /\b(?:festival|city festival|street festival|fest|fairground|funfair)\b/.test(normalized);

  if (/(course|workshop|class|seminar|training|barista course)/.test(normalized)) {
    return "community";
  }
  if (guidedTourLike && !explicitMarketIntent && !explicitFestivalIntent) {
    return "community";
  }
  if (explicitMarketIntent) {
    return "market";
  }
  if (filmScreeningLike || stagedShowLike) {
    return "show";
  }
  if (/\b(?:concert|live music|jazz|band|orchestra|choir)\b/.test(normalized)) {
    return "concert";
  }
  if (/\b(?:theater|theatre|opera|play|schauspiel|puppet theatre)\b/.test(normalized)) {
    return "theater";
  }
  if (explicitFestivalIntent) {
    return "festival";
  }
  if (/(food|culinary|dinner|breakfast|brunch|wine|tasting|coffee)/.test(normalized)) {
    return "food_event";
  }
  if (/(exhibition|museum|gallery|fair|expo|installation)/.test(normalized)) {
    return "fair";
  }
  if (/(boat trip|cruise|guided tour|tour|walk|hike|mindwalk|workshop|community|talk|reading)/.test(normalized)) {
    return "community";
  }
  if (/(advent|christmas|easter|spring|summer|winter|seasonal)/.test(normalized)) {
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

function audiencesForCategory(category: OfficialCityEvent["category"], text: string) {
  const lower = text.toLowerCase();
  if (/family|kids|children/.test(lower)) return ["family", "tourism"];
  if (category === "concert" || category === "show") return ["date", "friends", "party"];
  if (category === "theater") return ["date", "tourism"];
  if (category === "market" || category === "festival" || category === "food_event") {
    return ["tourism", "friends", "date"];
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

function subtypesForCard(card: LeipzigTravelCard, category: OfficialCityEvent["category"]) {
  const text = `${card.title} ${card.infoLabel ?? ""} ${card.locationText ?? ""}`.toLowerCase();
  const explicitMarketIntent =
    /\b(?:wochenmarkt|weekly market|flohmarkt|flea market|street food market|farmers market|night market|bazaar|trempelmarkt)\b/.test(
      text
    );
  const subtypes = [
    "concrete_event_page",
    category,
    /wochenmarkt|weekly market/.test(text) ? "weekly_market" : null,
    explicitMarketIntent ? "market_event" : null,
    category === "festival" && /\b(?:festival|fest)\b/.test(text) ? "festival_event" : null,
    /\b(?:boat trip|cruise|guided tour|tour|walk|museum tour|story tour|fuehrung|führung)\b/.test(text)
      ? "guided_tour"
      : null,
    /exhibition|museum|gallery/.test(text) ? "exhibition" : null,
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(subtypes));
}

async function fetchLeipzigTravelDetail(card: LeipzigTravelCard): Promise<LeipzigTravelDetail> {
  const html = await fetchHtml(card.sourceUrl);
  const jsonLdEvent = parseJsonLdEvent(html);
  const listingDate = parseDateText(card.dateText);
  const interval = parseTimeIntervals(html, card.ident, card.sourceUrl, listingDate);
  const location = jsonLdEvent ? locationFromJsonLd(jsonLdEvent) : null;
  const offers = jsonLdEvent
    ? Array.isArray(jsonLdEvent.offers)
      ? jsonLdEvent.offers
      : jsonLdEvent.offers
        ? [jsonLdEvent.offers]
        : []
    : [];

  return {
    summary: jsonLdEvent ? stripTags(jsonLdEvent.description ?? "") || null : null,
    ticketUrl: normalizeAbsoluteUrl(offers[0]?.url ?? null, card.sourceUrl) || null,
    venueName: cleanVenueName(location?.name ?? null, card.title),
    venueAddress: location ? addressTextFromJsonLd(location) : null,
    lat: typeof location?.geo?.latitude === "number" ? location.geo.latitude : null,
    lng: typeof location?.geo?.longitude === "number" ? location.geo.longitude : null,
    keywords: jsonLdEvent ? parseKeywords(jsonLdEvent.keywords) : [],
    matchedInterval: interval,
  };
}

async function enrichLeipzigTravelCards(cards: LeipzigTravelCard[]) {
  const enriched: Array<{ card: LeipzigTravelCard; detail: LeipzigTravelDetail }> = [];

  for (let index = 0; index < cards.length; index += DETAIL_CHUNK_SIZE) {
    const chunk = cards.slice(index, index + DETAIL_CHUNK_SIZE);
    const details = await Promise.all(
      chunk.map(async (card) => {
        try {
          return {
            card,
            detail: await fetchLeipzigTravelDetail(card),
          };
        } catch {
          return {
            card,
            detail: {
              summary: null,
              ticketUrl: null,
              venueName: null,
              venueAddress: null,
              lat: card.lat,
              lng: card.lng,
              keywords: [],
              matchedInterval: null,
            },
          };
        }
      })
    );
    enriched.push(...details);
  }

  return enriched;
}

export async function fetchLeipzigTravelEvents(config: EventSourceConfigRow) {
  const seenIds = new Set<string>();
  const cards: LeipzigTravelCard[] = [];

  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
    const url = buildPageUrl(config.base_url, pageIndex);
    let html = "";
    try {
      html = await fetchHtml(url);
    } catch (error) {
      if (pageIndex > 0) break;
      throw error;
    }
    const pageCards = parseCardBlocks(html, config.base_url).filter((card) => !seenIds.has(card.ident));

    if (pageCards.length === 0) break;

    for (const card of pageCards) {
      seenIds.add(card.ident);
      cards.push(card);
    }
  }

  return enrichLeipzigTravelCards(cards);
}

export function normalizeLeipzigTravelEvent(
  card: LeipzigTravelCard,
  detail: LeipzigTravelDetail,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const timeRange = parseTimeRange(card.timeText);
  const startDate = detail.matchedInterval?.date ?? parseDateText(card.dateText);
  const startTime = detail.matchedInterval?.startTime ?? timeRange.startTime;
  const endTime = detail.matchedInterval?.endTime ?? timeRange.endTime;
  const startAt = toBerlinIso(startDate, startTime);
  if (!startAt) return null;

  const endAt = endTime ? toBerlinIso(startDate, endTime) : null;
  const combinedText = [
    card.title,
    card.infoLabel,
    card.locationText,
    detail.summary,
    detail.keywords.join(" "),
  ]
    .filter(Boolean)
    .join(" ");
  const rawCategory = categoryFromText(combinedText);
  if (rawCategory === "other") return null;

  const combinedLower = combinedText.toLowerCase();
  const filmScreeningLike =
    /\b(?:film|kino|screening|movie|cinema|cinematheque|documentary)\b/.test(combinedLower);
  const routeLikeExperience =
    rawCategory === "seasonal" &&
    /(boat trip|cruise|guided tour|tour|walk|hike)/.test(combinedLower);
  const exhibitionLikeSeasonal =
    rawCategory === "seasonal" &&
    /(exhibition|museum|gallery|fair|expo)/.test(combinedLower);
  const filmMisclassifiedAsFestival = rawCategory === "festival" && filmScreeningLike;
  const category = filmMisclassifiedAsFestival
    ? "show"
    : routeLikeExperience
      ? "community"
      : exhibitionLikeSeasonal
        ? "fair"
        : rawCategory;
  const audiences = audiencesForCategory(category, combinedText);
  const occasions = occasionsForCategory(category);
  const venueName = cleanVenueName(detail.venueName, card.title);
  const venueAddress = detail.venueAddress ?? (normalizeText(card.locationText) || null);

  return {
    source: config.provider,
    external_id: card.ident,
    source_url: card.sourceUrl,
    ticket_url: detail.ticketUrl,
    title: card.title,
    summary: detail.summary,
    category,
    kind: kindForCategory(category),
    status: "scheduled",
    venue_name: venueName,
    venue_address: venueAddress,
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: detail.lat ?? card.lat,
    lng: detail.lng ?? card.lng,
    timezone: "Europe/Berlin",
    start_at: startAt,
    end_at: endAt,
    doors_at: null,
    all_day: timeRange.allDay && !startTime,
    is_ticketed: Boolean(detail.ticketUrl),
    price_min: null,
    price_max: null,
    currency: null,
    family_friendly: audiences.includes("family"),
    indoor_outdoor: null,
    local_rank: null,
    importance_score: null,
    popularity_score: null,
    tags: Array.from(
      new Set(
        [card.infoLabel, venueName, venueAddress, ...detail.keywords, "leipzig_travel"].filter(
          (value): value is string => Boolean(normalizeText(value))
        )
      )
    ),
    subtypes: subtypesForCard(card, category),
    audiences,
    occasions,
    source_payload: {
      card,
      detail,
    },
    source_updated_at: null,
    last_seen_at: new Date().toISOString(),
  };
}
