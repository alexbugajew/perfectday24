import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type JsonLdPostalAddress = {
  streetAddress?: string | null;
  postalCode?: string | null;
  addressLocality?: string | null;
  addressRegion?: string | null;
  addressCountry?: string | null;
};

type JsonLdGeo = {
  latitude?: number | string | null;
  longitude?: number | string | null;
};

type JsonLdPlace = {
  "@type"?: string | string[] | null;
  name?: string | null;
  address?: string | JsonLdPostalAddress | null;
  geo?: JsonLdGeo | null;
};

type JsonLdOrganization = {
  name?: string | null;
  url?: string | null;
};

type JsonLdOffer = {
  url?: string | null;
  price?: string | number | null;
  priceCurrency?: string | null;
  availability?: string | null;
};

type JsonLdEvent = {
  "@type"?: string | string[] | null;
  name?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  url?: string | null;
  location?: JsonLdPlace | JsonLdPlace[] | null;
  organizer?: JsonLdOrganization | JsonLdOrganization[] | null;
  offers?: JsonLdOffer | JsonLdOffer[] | null;
  keywords?: string | string[] | null;
  eventAttendanceMode?: string | null;
  isAccessibleForFree?: boolean | null;
};

type ErfurtListingEntry = {
  slug: string;
  sourceUrl: string;
  slugSignal: string;
  occurrenceDate: string;
  fallbackStartAt: string;
};

type ErfurtPreparedEvent = {
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
  isTicketed: boolean;
  priceMin: number | null;
  priceMax: number | null;
  currency: string | null;
  sourcePayload: {
    listing: ErfurtListingEntry;
    detailEvent: JsonLdEvent;
  };
};

const ERFURT_ROOT_URL = "https://www.erfurt-tourismus.de";
const ERFURT_EVENTS_URL = `${ERFURT_ROOT_URL}/veranstaltungskalender`;
const LOOKAHEAD_DAYS = 21;
const MAX_PAGES = 160;
const DETAIL_BATCH_SIZE = 10;

const CATEGORY_PRIORITY: Record<OfficialCityEvent["category"], number> = {
  concert: 90,
  theater: 88,
  show: 86,
  market: 84,
  festival: 82,
  food_event: 78,
  fair: 74,
  seasonal: 72,
  community: 62,
  other: 10,
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

function foldSearchText(value: string) {
  return decodeHtml(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00df/g, "ss")
    .toLowerCase();
}

function toAbsoluteUrl(url: string | null | undefined, baseUrl = ERFURT_ROOT_URL) {
  const normalized = normalizeText(decodeHtml(url ?? ""));
  if (!normalized) return null;
  try {
    return new URL(normalized, baseUrl).toString();
  } catch {
    return normalized;
  }
}

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        "user-agent": "perfectday24-event-ingest/1.0",
        accept: "text/html,application/xhtml+xml,application/xml",
      },
    });

    if (response.ok) {
      return response.text();
    }

    if (![500, 502, 503, 504].includes(response.status) || attempt === 2) {
      throw new Error(`[erfurt_tourism] HTTP ${response.status} fuer ${url}`);
    }

    await sleep(500 * (attempt + 1));
  }

  throw new Error(`[erfurt_tourism] HTTP 504 fuer ${url}`);
}

function addDays(date: Date, amount: number) {
  return new Date(date.getTime() + amount * 24 * 60 * 60 * 1000);
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

function berlinDateString(date: Date) {
  const local = berlinLocalParts(date);
  return `${String(local.year).padStart(4, "0")}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
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

function addMinutesToIso(iso: string, minutes: number) {
  const parsed = new Date(iso);
  if (!Number.isFinite(parsed.getTime())) return null;
  return new Date(parsed.getTime() + minutes * 60_000).toISOString();
}

function extractJsonLdScripts(html: string) {
  return Array.from(
    html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  )
    .map((match) => match[1])
    .filter(Boolean);
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function collectEventThings(input: unknown, bucket: JsonLdEvent[]) {
  if (!input) return;
  if (Array.isArray(input)) {
    input.forEach((item) => collectEventThings(item, bucket));
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
    bucket.push(obj as JsonLdEvent);
  }
}

function firstEventFromHtml(html: string) {
  const bucket: JsonLdEvent[] = [];
  for (const script of extractJsonLdScripts(html)) {
    const parsed = safeJsonParse(script);
    if (parsed) collectEventThings(parsed, bucket);
  }
  return bucket[0] ?? null;
}

function parseModifiedTime(html: string) {
  const match = html.match(
    /<meta[^>]+(?:property|name)=["'](?:article:modified_time|last-modified|dateModified)["'][^>]+content=["']([^"']+)["']/i
  );
  return normalizeText(match?.[1]) || null;
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const parsed = Number(normalized.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateFromUrl(url: string) {
  const match = url.match(/-(\d{4})-(\d{2})-(\d{2})t(\d{2})-(\d{2})-(\d{2})\/?$/i);
  if (!match) return null;
  const utcDate = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6])
    )
  );
  if (!Number.isFinite(utcDate.getTime())) return null;
  return {
    startAt: berlinIsoForDate(utcDate),
    occurrenceDate: berlinDateString(utcDate),
  };
}

function parseDateTime(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  const direct = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (direct) {
    const year = Number(direct[1]);
    const month = Number(direct[2]);
    const day = Number(direct[3]);
    const hasTime = Boolean(direct[4] && direct[5]);
    return {
      startAt: berlinIso(year, month, day, hasTime ? Number(direct[4]) : 12, hasTime ? Number(direct[5]) : 0),
      allDay: !hasTime,
    };
  }

  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) return null;
  return {
    startAt: berlinIsoForDate(parsed),
    allDay: !/t\d{2}:\d{2}/i.test(normalized),
  };
}

function parseSlugSignal(slug: string) {
  const stem = slug.replace(/-\d{4}-\d{2}-\d{2}t\d{2}-\d{2}-\d{2}$/i, "");
  return foldSearchText(stem.replace(/-/g, " "));
}

function shouldSkipSignal(signal: string) {
  if (!signal) return true;
  if (/\b(gottesdienst|andacht|vesper|bibelstunde)\b/.test(signal)) return true;
  if (/(altstadtfuhrung|stadtfuhrung|stadtfuehrung|altstadtfuehrung|stadtrundfahrt|stadtrundgang|rundgang|fuehrung|fuhrung)\b/.test(signal)) {
    return true;
  }
  return false;
}

function pageNumberFromUrl(url: string) {
  const match = normalizeText(url).match(/\/seite-(\d+)\//i);
  return match ? Number(match[1]) : 1;
}

function extractNextPageUrls(html: string, currentPage: number, baseUrl: string) {
  const urlsByPage = new Map<number, string>();
  const pattern = /href=["']([^"']*\/veranstaltungskalender\/seite-\d+\/\?cHash=[^"']+)["']/gi;

  for (const match of html.matchAll(pattern)) {
    const absoluteUrl = toAbsoluteUrl(decodeHtml(match[1]), baseUrl);
    if (!absoluteUrl) continue;
    const pageNumber = pageNumberFromUrl(absoluteUrl);
    if (!Number.isFinite(pageNumber) || pageNumber <= currentPage) continue;
    if (!urlsByPage.has(pageNumber)) {
      urlsByPage.set(pageNumber, absoluteUrl);
    }
  }

  return Array.from(urlsByPage.entries())
    .sort((left, right) => left[0] - right[0])
    .map((entry) => entry[1]);
}

function extractListingEntries(html: string, baseUrl: string) {
  const entries: ErfurtListingEntry[] = [];
  const seen = new Set<string>();
  const pattern = /\/veranstaltungskalender\/details\/([^"'?#\s<]+-\d{4}-\d{2}-\d{2}t\d{2}-\d{2}-\d{2})\/?/gi;

  for (const match of html.matchAll(pattern)) {
    const slug = decodeURIComponent(match[1]);
    const sourceUrl = toAbsoluteUrl(`/veranstaltungskalender/details/${slug}/`, baseUrl);
    if (!sourceUrl || seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);

    const occurrence = parseDateFromUrl(sourceUrl);
    if (!occurrence) continue;

    const slugSignal = parseSlugSignal(slug);
    if (shouldSkipSignal(slugSignal)) continue;
    const preCategory = categoryFromSignal(slugSignal);
    if (preCategory === "other" || preCategory === "community") continue;

    entries.push({
      slug,
      sourceUrl,
      slugSignal,
      occurrenceDate: occurrence.occurrenceDate,
      fallbackStartAt: occurrence.startAt,
    });
  }

  return entries.sort((left, right) => left.occurrenceDate.localeCompare(right.occurrenceDate));
}

function withinWindow(dateString: string, minDate: string, maxDate: string) {
  return dateString >= minDate && dateString <= maxDate;
}

function asArray<T>(value: T | T[] | null | undefined) {
  if (!value) return [] as T[];
  return Array.isArray(value) ? value : [value];
}

function buildVenueAddress(location: JsonLdPlace | null | undefined) {
  if (!location?.address) return null;
  if (typeof location.address === "string") return stripTags(location.address);

  const parts = [
    normalizeText(location.address.streetAddress),
    [normalizeText(location.address.postalCode), normalizeText(location.address.addressLocality)]
      .filter(Boolean)
      .join(" "),
    normalizeText(location.address.addressRegion),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

function locationGeo(location: JsonLdPlace | null | undefined) {
  const lat = parseNumber(location?.geo?.latitude);
  const lng = parseNumber(location?.geo?.longitude);
  return {
    lat,
    lng,
  };
}

function extractTicketUrl(event: JsonLdEvent, sourceUrl: string) {
  const offerUrls = asArray(event.offers)
    .map((offer) => toAbsoluteUrl(offer.url, ERFURT_ROOT_URL))
    .filter((value): value is string => Boolean(value))
    .filter((value) => value !== sourceUrl);
  return offerUrls[0] ?? null;
}

function extractOfferSummary(event: JsonLdEvent) {
  const offers = asArray(event.offers);
  const prices = offers
    .map((offer) => parseNumber(offer.price))
    .filter((value): value is number => typeof value === "number");
  const currency = normalizeText(offers.find((offer) => normalizeText(offer.priceCurrency))?.priceCurrency) || "EUR";
  return {
    priceMin: prices.length > 0 ? Math.min(...prices) : null,
    priceMax: prices.length > 0 ? Math.max(...prices) : null,
    currency: prices.length > 0 ? currency : null,
    isTicketed: offers.some((offer) => Boolean(normalizeText(offer.url))) || prices.length > 0,
  };
}

function categoryFromSignal(signal: string): OfficialCityEvent["category"] {
  if (!signal) return "other";
  if (shouldSkipSignal(signal)) return "other";
  if (/\b(hartwarenmarkt|frischwarenmarkt|stadtteilmarkt|wochenmarkt|flohmarkt|troedelmarkt|trdelmarkt|buechermarkt|antikmarkt|basar|markt)\b/.test(signal)) {
    return "market";
  }
  if (/\b(ausstellung|vernissage|museum|galerie|messe|expo)\b/.test(signal)) {
    return "fair";
  }
  if (/\b(festival|stadtfest|volksfest|kulturfest|kulturnacht|open air|domstufen|fest)\b/.test(signal)) {
    return "festival";
  }
  if (/\b(street food|kulinar|weinprobe|bierprobe|tasting|brunch|dinner|menue|genuss)\b/.test(signal)) {
    return "food_event";
  }
  if (/\b(konzert|orchester|band|chor|jazz|philharmon|symphon|musik|liederabend|recital)\b/.test(signal)) {
    return "concert";
  }
  if (/\b(theater|operette|oper|schauspiel|ballett|figurentheater|puppentheater|musical)\b/.test(signal)) {
    return "theater";
  }
  if (/\b(film|kino|lesung|vortrag|diskussion|poetry|slam|comedy|kabarett|performance|talk|show)\b/.test(signal)) {
    return "show";
  }
  if (/\b(workshop|seminar|kurs|sprechstunde|beratung|treff|begegnung|stammtisch|yoga|training)\b/.test(signal)) {
    return "community";
  }
  if (/\b(advent|weihnacht|winter)\b/.test(signal)) {
    return "seasonal";
  }
  return "community";
}

function kindForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") {
    return "anchored_event" as const;
  }
  return "flex_event" as const;
}

function audiencesForCategory(category: OfficialCityEvent["category"], signal: string) {
  const audiences = new Set<string>();
  if (/\b(kinder|familie|family|jugend)\b/.test(signal)) audiences.add("family");
  if (category === "concert" || category === "show" || category === "festival") audiences.add("friends");
  if (category === "theater" || category === "concert" || category === "show") audiences.add("date");
  if (category === "market" || category === "festival" || category === "fair" || category === "food_event") {
    audiences.add("tourism");
    audiences.add("friends");
  }
  if (category === "community") audiences.add("friends");
  if (audiences.size === 0) audiences.add("tourism");
  return Array.from(audiences);
}

function occasionsForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "show") return ["date", "friends", "party"];
  if (category === "theater") return ["date", "tourism"];
  if (category === "market" || category === "festival" || category === "fair" || category === "food_event") {
    return ["tourism", "friends", "family", "date"];
  }
  return ["tourism", "friends"];
}

function indoorOutdoorForSignal(signal: string, category: OfficialCityEvent["category"]) {
  if (/\b(open air|freiluft|draussen|outdoor|platz|markt)\b/.test(signal)) return "outdoor" as const;
  if (/\b(theater|kino|museum|galerie|oper|saal|halle|haus)\b/.test(signal)) return "indoor" as const;
  if (category === "market" || category === "festival") return "mixed" as const;
  return null;
}

function tagsForEvent(event: JsonLdEvent, category: OfficialCityEvent["category"], venueName: string | null) {
  const keywordTags = Array.isArray(event.keywords)
    ? event.keywords.map(normalizeText)
    : normalizeText(event.keywords)
      ? normalizeText(event.keywords).split(",").map((item) => normalizeText(item))
      : [];

  return Array.from(
    new Set(
      [category, venueName, ...keywordTags]
        .filter(Boolean)
        .map((item) => foldSearchText(String(item)).replace(/\s+/g, "_"))
        .filter(Boolean)
    )
  );
}

function subtypesForEvent(signal: string, category: OfficialCityEvent["category"]) {
  const subtypes = new Set<string>();
  subtypes.add("concrete_event_page");
  subtypes.add(category);

  if (category === "market") {
    if (/flohmarkt|troedelmarkt|buechermarkt/.test(signal)) subtypes.add("flea_market");
    if (/wochenmarkt|frischwarenmarkt|hartwarenmarkt|stadtteilmarkt/.test(signal)) subtypes.add("weekly_market");
    if (/markt|flohmarkt|troedelmarkt|buechermarkt|basar/.test(signal)) subtypes.add("market_event");
  }
  if (category === "festival") {
    if (/open air/.test(signal)) subtypes.add("open_air");
    if (/stadtfest|volksfest/.test(signal)) subtypes.add("city_festival");
    subtypes.add("festival_event");
  }
  if (category === "concert") {
    subtypes.add("live_music");
    if (/jazz/.test(signal)) subtypes.add("jazz");
  }
  if (category === "theater") {
    subtypes.add("performing_arts");
    if (/oper/.test(signal)) subtypes.add("opera");
  }
  if (category === "show") {
    if (/vortrag|diskussion|talk/.test(signal)) subtypes.add("talk");
    if (/film|kino/.test(signal)) subtypes.add("screening");
    if (/lesung/.test(signal)) subtypes.add("reading");
    if (/comedy|kabarett|slam|performance/.test(signal)) subtypes.add("stage_program");
  }
  if (/famil|kinder|jugend/.test(signal)) subtypes.add("family_program");
  if (subtypes.size === 0) subtypes.add(category);
  return Array.from(subtypes);
}

function buildSignal(event: JsonLdEvent, venueName: string | null) {
  const locationNames = asArray(event.location)
    .map((location) => normalizeText(location?.name))
    .filter(Boolean)
    .join(" ");
  const organizerNames = asArray(event.organizer)
    .map((organizer) => normalizeText(organizer?.name))
    .filter(Boolean)
    .join(" ");
  const keywords = Array.isArray(event.keywords) ? event.keywords.join(" ") : normalizeText(event.keywords);
  return foldSearchText(
    [
      normalizeText(event.name),
      stripTags(event.description),
      keywords,
      venueName,
      locationNames,
      organizerNames,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function normalizePreparedEvent(
  listing: ErfurtListingEntry,
  event: JsonLdEvent,
  sourceUpdatedAt: string | null,
  minDate: string,
  maxDate: string
) {
  const title = normalizeText(event.name);
  if (!title) return null;

  const location = asArray(event.location)[0] ?? null;
  const venueName = normalizeText(location?.name) || null;
  const signal = buildSignal(event, venueName);
  const category = categoryFromSignal(signal);
  if (category === "other") return null;

  const startDate = parseDateTime(event.startDate) ?? {
    startAt: listing.fallbackStartAt,
    allDay: false,
  };
  const endDate = parseDateTime(event.endDate);
  if (!withinWindow(startDate.startAt.slice(0, 10), minDate, maxDate)) {
    return null;
  }

  const geo = locationGeo(location);
  const sourceUrl = toAbsoluteUrl(event.url, ERFURT_ROOT_URL) ?? listing.sourceUrl;
  const ticketUrl = extractTicketUrl(event, sourceUrl);
  const offerSummary = extractOfferSummary(event);
  const audiences = audiencesForCategory(category, signal);

  return {
    slug: listing.slug,
    sourceUrl,
    ticketUrl,
    title,
    summary: stripTags(event.description) || null,
    category,
    venueName,
    venueAddress: buildVenueAddress(location),
    lat: geo.lat,
    lng: geo.lng,
    startAt: startDate.startAt,
    endAt: endDate?.startAt ?? null,
    allDay: startDate.allDay,
    familyFriendly: audiences.includes("family"),
    indoorOutdoor: indoorOutdoorForSignal(signal, category),
    tags: tagsForEvent(event, category, venueName),
    subtypes: subtypesForEvent(signal, category),
    audiences,
    occasions: occasionsForCategory(category),
    sourceUpdatedAt,
    isTicketed: offerSummary.isTicketed || event.isAccessibleForFree === false,
    priceMin: offerSummary.priceMin,
    priceMax: offerSummary.priceMax,
    currency: offerSummary.currency,
    sourcePayload: {
      listing,
      detailEvent: event,
    },
  } satisfies ErfurtPreparedEvent;
}

async function enrichListingEntry(listing: ErfurtListingEntry, minDate: string, maxDate: string) {
  const html = await fetchText(listing.sourceUrl);
  const event = firstEventFromHtml(html);
  if (!event) return null;
  return normalizePreparedEvent(listing, event, parseModifiedTime(html), minDate, maxDate);
}

function dedupePreparedEvents(events: ErfurtPreparedEvent[]) {
  const byKey = new Map<string, ErfurtPreparedEvent>();
  for (const event of events) {
    byKey.set(`${event.slug}:${event.startAt}`, event);
  }
  return Array.from(byKey.values()).sort((left, right) => left.startAt.localeCompare(right.startAt));
}

export async function fetchErfurtTourismEvents(config: EventSourceConfigRow) {
  const baseUrl = normalizeText(config.base_url) || ERFURT_EVENTS_URL;
  const minDate = berlinDateString(new Date());
  const maxDate = berlinDateString(addDays(new Date(), LOOKAHEAD_DAYS));
  const listingByUrl = new Map<string, ErfurtListingEntry>();

  const pageQueue: string[] = [baseUrl];
  const visitedPages = new Set<string>();

  while (pageQueue.length > 0 && visitedPages.size < MAX_PAGES) {
    const currentPageUrl = pageQueue.shift() ?? null;
    if (!currentPageUrl) break;
    if (visitedPages.has(currentPageUrl)) continue;
    visitedPages.add(currentPageUrl);

    const currentPage = pageNumberFromUrl(currentPageUrl);
    let html: string;
    try {
      html = await fetchText(currentPageUrl);
    } catch (error) {
      console.warn(
        `[erfurt_tourism] Seite uebersprungen (${currentPageUrl}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      continue;
    }

    const pageEntries = extractListingEntries(html, baseUrl);
    if (pageEntries.length === 0) break;

    for (const nextPageUrl of extractNextPageUrls(html, currentPage, baseUrl)) {
      if (!visitedPages.has(nextPageUrl) && !pageQueue.includes(nextPageUrl)) {
        pageQueue.push(nextPageUrl);
      }
    }
    pageQueue.sort((left, right) => pageNumberFromUrl(left) - pageNumberFromUrl(right));

    const allAfterWindow = pageEntries.every((entry) => entry.occurrenceDate > maxDate);
    for (const entry of pageEntries) {
      if (!withinWindow(entry.occurrenceDate, minDate, maxDate)) continue;
      listingByUrl.set(entry.sourceUrl, entry);
    }

    if (allAfterWindow) break;
  }

  const prepared: ErfurtPreparedEvent[] = [];
  const batches = chunk(Array.from(listingByUrl.values()), DETAIL_BATCH_SIZE);

  for (const batch of batches) {
    const results = await Promise.allSettled(batch.map((entry) => enrichListingEntry(entry, minDate, maxDate)));
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        prepared.push(result.value);
      }
    }
  }

  return dedupePreparedEvents(prepared);
}

export function normalizeErfurtTourismEvent(
  prepared: ErfurtPreparedEvent,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const title = normalizeText(prepared.title);
  if (!title || !prepared.startAt) return null;

  const hasGeo = typeof prepared.lat === "number" && typeof prepared.lng === "number";
  const importanceScore =
    CATEGORY_PRIORITY[prepared.category] +
    (prepared.isTicketed ? 4 : 0) +
    (hasGeo ? 4 : 0);

  return {
    source: config.provider,
    external_id: `erfurt_tourism:${prepared.slug}:${prepared.startAt}`,
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
    is_ticketed: prepared.isTicketed,
    price_min: prepared.priceMin,
    price_max: prepared.priceMax,
    currency: prepared.currency,
    family_friendly: prepared.familyFriendly,
    indoor_outdoor: prepared.indoorOutdoor,
    local_rank: importanceScore,
    importance_score: importanceScore,
    popularity_score: importanceScore - 4,
    tags: prepared.tags,
    subtypes: prepared.subtypes,
    audiences: prepared.audiences,
    occasions: prepared.occasions,
    source_payload: prepared.sourcePayload,
    source_updated_at: prepared.sourceUpdatedAt,
    last_seen_at: new Date().toISOString(),
  };
}
