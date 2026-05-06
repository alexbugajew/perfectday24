import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type KarlsruheSourceAddress = {
  name?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  zip?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

type KarlsruheSourceOccurrence = {
  active?: boolean | null;
  additionalInformation?: string | null;
  area?: string | null;
  bookingRequestUrl?: string | null;
  bookingUrl?: string | null;
  closed?: boolean | null;
  date?: string | null;
  displayDurationAs?: string | null;
  endAt?: string | null;
  eventLocationAddress?: KarlsruheSourceAddress | null;
  freeEntry?: boolean | null;
  id?: string | null;
  isCancelled?: boolean | null;
  joinBefore?: string | null;
  marketingPriceComment?: string | null;
  marketingPricePrefix?: string | null;
  marketingPrices?: Array<{ amount?: number | null; currency?: string | null }> | null;
  soldOut?: boolean | null;
  startAt?: string | null;
};

type KarlsruheSourceDateInterval = {
  id?: string | null;
  additionalInformation?: string | null;
  bookingRequestUrl?: string | null;
  bookingUrl?: string | null;
  canceled?: boolean | null;
  closed?: boolean | null;
  configuration?: {
    days?: number[] | null;
  } | null;
  date?: string | null;
  displayDurationAs?: string | null;
  end?: string | null;
  endAt?: string | null;
  humanReadableRepeatRule?: string | null;
  interval?: number | null;
  onDemand?: boolean | null;
  repeatRuleName?: string | null;
  soldOut?: boolean | null;
  startAt?: string | null;
  type?: string | null;
};

type KarlsruheSourceEvent = {
  accessRestrictions?: {
    ticketRequired?: boolean | null;
  } | null;
  author?: string | null;
  booking?: {
    requestUrl?: string | null;
    url?: string | null;
    voucherUrl?: string | null;
  } | null;
  bookingUrl?: string | null;
  boost?: number | null;
  canceled?: boolean | null;
  category?: {
    name?: string | null;
  } | null;
  datesCache?: KarlsruheSourceOccurrence[] | null;
  eventType?: string | null;
  geocoordinates?: {
    longitude?: number | null;
    latitude?: number | null;
  } | null;
  hasSchedule?: boolean | null;
  highlight?: boolean | null;
  id: string;
  intro?: string | null;
  invisible?: boolean | null;
  lastReviewedAt?: string | null;
  license?: string | null;
  locale?: string | null;
  location?: {
    id?: string | null;
    name?: string | null;
  } | null;
  mergeDates?: boolean | null;
  name?: string | null;
  nextDate?: KarlsruheSourceOccurrence | null;
  firstDate?: KarlsruheSourceOccurrence | null;
  lastDate?: KarlsruheSourceOccurrence | null;
  onDemand?: boolean | null;
  regionalScope?: string | null;
  type?: string | null;
  updatedAt?: string | null;
  dateIntervals?: KarlsruheSourceDateInterval[] | null;
  sourceSystemInformation?: Array<{
    name?: string | null;
    comment?: string | null;
  }> | null;
  channelContext?: {
    widgetURL_de?: string | null;
  } | null;
  tipFamous?: boolean | null;
  tipHighlight?: boolean | null;
  tipIdyllic?: boolean | null;
  tipNatural?: boolean | null;
  tipOffTheTrack?: boolean | null;
  tipOnlyHere?: boolean | null;
  tipPopular?: boolean | null;
  tipPublicTransport?: boolean | null;
  tipTypicalForRegion?: boolean | null;
  trashed?: boolean | null;
};

type KarlsruheApiResponse = {
  _links?: {
    nextPage?: string | null;
  } | null;
  payload?: KarlsruheSourceEvent[] | null;
};

type KarlsruheExpandedEvent = {
  item: KarlsruheSourceEvent;
  occurrence: KarlsruheSourceOccurrence;
};

const DEFAULT_BASE_URI = "https://mein.toubiz.de";
const DEFAULT_ROUTE = "/event";
const PAGE_SIZE = 100;
const MAX_PAGES = 32;
const LOOKAHEAD_DAYS = 210;
const DAY_MS = 24 * 60 * 60 * 1000;

const CATEGORY_PRIORITY: Record<OfficialCityEvent["category"], number> = {
  concert: 90,
  theater: 88,
  show: 86,
  market: 84,
  festival: 82,
  fair: 74,
  food_event: 78,
  community: 68,
  seasonal: 64,
  other: 54,
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

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`[karlsruhe_tourism] HTTP ${response.status} fuer ${url}`);
  }

  return response.text();
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "application/json,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`[karlsruhe_tourism] API HTTP ${response.status} fuer ${url}`);
  }

  return (await response.json()) as T;
}

function extractWidgetConfig(html: string, fallbackBaseUrl: string) {
  const widgetTag = html.match(/<toubiz-widget[\s\S]*?api-token="([^"]+)"[\s\S]*?base-uri="([^"]+)"[\s\S]*?route="([^"]+)"/i);
  if (widgetTag?.[1] && widgetTag?.[2]) {
    return {
      apiToken: normalizeText(widgetTag[1]),
      baseUri: normalizeText(widgetTag[2]),
      route: normalizeText(widgetTag[3]) || DEFAULT_ROUTE,
    };
  }

  const simplerTag = html.match(/<toubiz-widget[\s\S]*?route="([^"]+)"[\s\S]*?api-token="([^"]+)"[\s\S]*?base-uri="([^"]+)"/i);
  if (simplerTag?.[2] && simplerTag?.[3]) {
    return {
      apiToken: normalizeText(simplerTag[2]),
      baseUri: normalizeText(simplerTag[3]),
      route: normalizeText(simplerTag[1]) || DEFAULT_ROUTE,
    };
  }

  throw new Error(`[karlsruhe_tourism] Kein toubiz-widget mit API-Token auf ${fallbackBaseUrl} gefunden.`);
}

function berlinDateParts(date: Date) {
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
  const local = berlinDateParts(date);
  return `${String(local.year).padStart(4, "0")}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
}

function berlinOffset(date: Date) {
  const local = berlinDateParts(date);
  const utcLikeLocalMs = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  const diffMinutes = Math.round((utcLikeLocalMs - date.getTime()) / 60000);
  const sign = diffMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(diffMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

function berlinIso(year: number, month: number, day: number, hour: number, minute: number, second = 0) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}${berlinOffset(utcGuess)}`;
}

function parseDateOnly(dateText: string | null | undefined) {
  const normalized = normalizeText(dateText);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const [yearText, monthText, dayText] = normalized.split("-");
  return {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
  };
}

function parseTimeParts(text: string | null | undefined) {
  const normalized = normalizeText(text);
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(normalized)) return null;
  const [hourText, minuteText, secondText = "00"] = normalized.split(":");
  return {
    hour: Number(hourText),
    minute: Number(minuteText),
    second: Number(secondText),
  };
}

function defaultTimeForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") {
    return { hour: 19, minute: 30, second: 0 };
  }
  if (category === "market" || category === "festival" || category === "fair" || category === "food_event") {
    return { hour: 12, minute: 0, second: 0 };
  }
  return { hour: 17, minute: 0, second: 0 };
}

function withinDateRange(dateText: string, afterDate: string, beforeDate: string) {
  return dateText >= afterDate && dateText <= beforeDate;
}

function classifyKarlsruheCategory(item: KarlsruheSourceEvent): OfficialCityEvent["category"] {
  const categoryName = normalizeText(item.category?.name).toLowerCase();
  const title = normalizeText(item.name).toLowerCase();
  const intro = stripTags(item.intro).toLowerCase();
  const haystack = [categoryName, title, intro].filter(Boolean).join(" | ");

  if (/(wochenmarkt|bauernmarkt|flohmarkt|markt\b|designmarkt|street market)/.test(haystack)) return "market";
  if (/(festival|stadtfest|volksfest|fest\b|das fest|open air festival|weinfest|indien.?tag)/.test(haystack)) return "festival";
  if (/(streetfood|kulinar|weinprobe|food|men[üu]|dinner|brunch|tasting)/.test(haystack)) return "food_event";
  if (/(konzert|orchester|jazz|rock|pop|musik\b|philharmonie|kammerkonzert|chor)/.test(haystack)) return "concert";
  if (/(theater|oper|operette|schauspiel|ballett|tanztheater|grillo|aalto)/.test(haystack)) return "theater";
  if (/(musical|kabarett|comedy|show\b|lesung|film|kino|vortrag|poetry|slam|mixshow)/.test(haystack)) return "show";
  if (/(messe|kongress|expo|ausstellung|kunst|design|museum|vernissage)/.test(haystack)) return "fair";
  if (/(weihnacht|advent|winterzauber)/.test(haystack)) return "seasonal";
  if (/(führung|fuehrung|rundgang|workshop|aktionstag|familie|kinder|jugend|tour|spaziergang|kurs)/.test(haystack))
    return "community";
  return "other";
}

function kindForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") {
    return "anchored_event" as const;
  }
  return "flex_event" as const;
}

function familyFriendly(item: KarlsruheSourceEvent, category: OfficialCityEvent["category"]) {
  const text = `${normalizeText(item.name)} ${stripTags(item.intro)} ${normalizeText(item.category?.name)}`.toLowerCase();
  if (/\b(kinder|familie|jugend|baby|kids)\b/.test(text)) return true;
  if (category === "market" || category === "festival") return true;
  return null;
}

function indoorOutdoor(item: KarlsruheSourceEvent) {
  const text = `${normalizeText(item.name)} ${stripTags(item.intro)} ${normalizeText(item.location?.name)}`.toLowerCase();
  if (/(open air|park|garten|platz|see|markt|outdoor|gruga)/.test(text)) return "outdoor" as const;
  if (/(museum|theater|halle|saal|kino|zentrum|bibliothek)/.test(text)) return "indoor" as const;
  return null;
}

function tagsForEvent(item: KarlsruheSourceEvent, category: OfficialCityEvent["category"]) {
  return Array.from(
    new Set(
      [
        "karlsruhe",
        "karlsruhe_tourism",
        category,
        normalizeText(item.category?.name),
        normalizeText(item.location?.name),
        normalizeText(item.author),
      ]
        .map((entry) => normalizeText(entry).toLowerCase())
        .filter(Boolean)
    )
  );
}

function subtypesForEvent(item: KarlsruheSourceEvent, category: OfficialCityEvent["category"]) {
  const title = normalizeText(item.name).toLowerCase();
  const subtypes = new Set<string>();

  if (category === "concert") subtypes.add("live_music");
  if (category === "theater") subtypes.add("theater");
  if (category === "show") subtypes.add("show");
  if (category === "market") subtypes.add("market");
  if (category === "festival") subtypes.add("festival_event");
  if (category === "fair") subtypes.add("exhibition");
  if (category === "food_event") subtypes.add("food_event");
  if (category === "community") subtypes.add("community_event");
  if (/führung|fuehrung|tour|rundgang/.test(title)) subtypes.add("guided_tour");
  if (/lesung|vortrag/.test(title)) subtypes.add("lecture");
  if (/kino|film/.test(title)) subtypes.add("screening");
  if (/kinder|familie|jugend/.test(title)) subtypes.add("family_event");

  return Array.from(subtypes);
}

function audiencesForEvent(item: KarlsruheSourceEvent) {
  const text = `${normalizeText(item.name)} ${stripTags(item.intro)} ${normalizeText(item.category?.name)}`.toLowerCase();
  const audiences = new Set<string>();
  if (/\b(kinder|familie|jugend|kids)\b/.test(text)) audiences.add("family");
  if (/\b(studierende|student|senior)\b/.test(text)) audiences.add("adults");
  if (audiences.size === 0) audiences.add("general");
  return Array.from(audiences);
}

function occasionsForEvent(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") return ["date", "friends"];
  if (category === "market" || category === "festival" || category === "fair") return ["tourism", "friends"];
  if (category === "community" || category === "food_event") return ["tourism", "date", "friends"];
  return ["tourism"];
}

function eventAddressFromOccurrence(occurrence: KarlsruheSourceOccurrence | null | undefined) {
  const address = occurrence?.eventLocationAddress;
  if (!address) return { venueName: null, venueAddress: null };
  const venueName = normalizeText(address.name) || null;
  const streetLine = [normalizeText(address.street), normalizeText(address.streetNumber)].filter(Boolean).join(" ");
  const cityLine = [normalizeText(address.zip), normalizeText(address.city)].filter(Boolean).join(" ");
  return {
    venueName,
    venueAddress: [streetLine, cityLine].filter(Boolean).join(", ") || null,
  };
}

function eventUrls(item: KarlsruheSourceEvent, occurrence: KarlsruheSourceOccurrence, fallbackUrl: string) {
  const bookingUrl =
    toAbsoluteUrl(item.bookingUrl, fallbackUrl) ??
    toAbsoluteUrl(item.booking?.url, fallbackUrl) ??
    toAbsoluteUrl(occurrence.bookingUrl, fallbackUrl) ??
    null;
  const requestUrl =
    toAbsoluteUrl(item.booking?.requestUrl, fallbackUrl) ??
    toAbsoluteUrl(occurrence.bookingRequestUrl, fallbackUrl) ??
    null;

  return {
    sourceUrl: requestUrl ?? bookingUrl ?? fallbackUrl,
    ticketUrl: bookingUrl ?? null,
  };
}

function pushOccurrence(
  bucket: KarlsruheSourceOccurrence[],
  seen: Set<string>,
  occurrence: KarlsruheSourceOccurrence | null | undefined,
  afterDate: string,
  beforeDate: string
) {
  if (!occurrence?.date) return;
  const dateText = normalizeText(occurrence.date);
  if (!dateText || !withinDateRange(dateText, afterDate, beforeDate)) return;
  const key = `${dateText}:${normalizeText(occurrence.startAt)}:${normalizeText(occurrence.endAt)}`;
  if (seen.has(key)) return;
  seen.add(key);
  bucket.push(occurrence);
}

function isoWeekday(date: Date) {
  const weekday = date.getDay();
  return weekday === 0 ? 7 : weekday;
}

function expandIntervals(
  item: KarlsruheSourceEvent,
  afterDate: string,
  beforeDate: string
) {
  const occurrences: KarlsruheSourceOccurrence[] = [];
  const seen = new Set<string>();
  const after = new Date(`${afterDate}T00:00:00+02:00`);
  const before = new Date(`${beforeDate}T23:59:59+02:00`);

  for (const interval of item.dateIntervals ?? []) {
    const baseDate = parseDateOnly(interval.date);
    if (!baseDate) continue;
    const start = new Date(Date.UTC(baseDate.year, baseDate.month - 1, baseDate.day));
    const endDate = parseDateOnly(interval.end) ?? parseDateOnly(item.lastDate?.date) ?? {
      year: before.getUTCFullYear(),
      month: before.getUTCMonth() + 1,
      day: before.getUTCDate(),
    };
    const end = new Date(Date.UTC(endDate.year, endDate.month - 1, endDate.day));
    const repeatRule = normalizeText(interval.repeatRuleName).toLowerCase() || normalizeText(interval.type).toLowerCase();
    const configuredDays = new Set((interval.configuration?.days ?? []).filter((value): value is number => Number.isFinite(value)));

    if (repeatRule === "none" || !repeatRule) {
      const occurrence: KarlsruheSourceOccurrence = {
        active: true,
        additionalInformation: interval.additionalInformation ?? null,
        bookingRequestUrl: interval.bookingRequestUrl ?? null,
        bookingUrl: interval.bookingUrl ?? null,
        closed: interval.closed ?? null,
        date: interval.date ?? null,
        displayDurationAs: interval.displayDurationAs ?? null,
        endAt: interval.endAt ?? null,
        eventLocationAddress: item.firstDate?.eventLocationAddress ?? item.nextDate?.eventLocationAddress ?? null,
        freeEntry: item.firstDate?.freeEntry ?? item.nextDate?.freeEntry ?? null,
        id: interval.id ?? null,
        isCancelled: interval.canceled ?? null,
        marketingPriceComment: null,
        marketingPricePrefix: null,
        marketingPrices: null,
        soldOut: interval.soldOut ?? null,
        startAt: interval.startAt ?? null,
      };
      pushOccurrence(occurrences, seen, occurrence, afterDate, beforeDate);
      continue;
    }

    const cursor = new Date(Math.max(start.getTime(), after.getTime()));
    while (cursor <= end && cursor <= before) {
      const weekday = isoWeekday(cursor);
      const include =
        repeatRule === "daily" ||
        (repeatRule === "weekly" && (configuredDays.size === 0 ? weekday === isoWeekday(start) : configuredDays.has(weekday)));

      if (include) {
        const localDate = berlinDateString(cursor);
        pushOccurrence(
          occurrences,
          seen,
          {
            active: true,
            additionalInformation: interval.additionalInformation ?? null,
            bookingRequestUrl: interval.bookingRequestUrl ?? null,
            bookingUrl: interval.bookingUrl ?? null,
            closed: interval.closed ?? null,
            date: localDate,
            displayDurationAs: interval.displayDurationAs ?? null,
            endAt: interval.endAt ?? null,
            eventLocationAddress: item.firstDate?.eventLocationAddress ?? item.nextDate?.eventLocationAddress ?? null,
            freeEntry: item.firstDate?.freeEntry ?? item.nextDate?.freeEntry ?? null,
            id: interval.id ?? null,
            isCancelled: interval.canceled ?? null,
            marketingPriceComment: null,
            marketingPricePrefix: null,
            marketingPrices: null,
            soldOut: interval.soldOut ?? null,
            startAt: interval.startAt ?? null,
          },
          afterDate,
          beforeDate
        );
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return occurrences;
}

function occurrenceWindow(item: KarlsruheSourceEvent, afterDate: string, beforeDate: string) {
  const occurrences: KarlsruheSourceOccurrence[] = [];
  const seen = new Set<string>();

  for (const occurrence of item.datesCache ?? []) {
    pushOccurrence(occurrences, seen, occurrence, afterDate, beforeDate);
  }

  if (occurrences.length === 0) {
    pushOccurrence(occurrences, seen, item.nextDate, afterDate, beforeDate);
    pushOccurrence(occurrences, seen, item.firstDate, afterDate, beforeDate);
  }

  if (occurrences.length === 0) {
    for (const occurrence of expandIntervals(item, afterDate, beforeDate)) {
      pushOccurrence(occurrences, seen, occurrence, afterDate, beforeDate);
    }
  }

  return occurrences.sort((left, right) => {
    const leftKey = `${left.date ?? ""} ${left.startAt ?? ""}`;
    const rightKey = `${right.date ?? ""} ${right.startAt ?? ""}`;
    return leftKey.localeCompare(rightKey);
  });
}

function buildSearchUrl(baseUri: string, route: string, apiToken: string, afterDate: string, beforeDate: string, page: number) {
  const url = new URL(`${route.replace(/^\//, "")}`, `${baseUri.replace(/\/$/, "")}/api/v1/`);
  url.searchParams.set("api_token", apiToken);
  url.searchParams.set("language", "de");
  url.searchParams.set("unlicensed", "1");
  url.searchParams.set("invisible", "0");
  url.searchParams.set("pagination[pageSize]", String(PAGE_SIZE));
  url.searchParams.set("pagination[page]", String(page));
  url.searchParams.set("filter[excludeTag][0]", "exklusion-kaer-kalender");
  url.searchParams.set("filter[date][after]", afterDate);
  url.searchParams.set("filter[date][before]", beforeDate);
  return url.toString();
}

export async function fetchKarlsruheTourismEvents(config: EventSourceConfigRow) {
  const html = await fetchText(config.base_url);
  const widget = extractWidgetConfig(html, config.base_url);

  const afterDate = berlinDateString(new Date());
  const beforeDate = berlinDateString(new Date(Date.now() + LOOKAHEAD_DAYS * DAY_MS));
  const items = new Map<string, KarlsruheSourceEvent>();

  let nextPageUrl: string | null = buildSearchUrl(
    widget.baseUri || DEFAULT_BASE_URI,
    widget.route || DEFAULT_ROUTE,
    widget.apiToken,
    afterDate,
    beforeDate,
    1
  );
  let page = 0;

  while (nextPageUrl && page < MAX_PAGES) {
    const response: KarlsruheApiResponse = await fetchJson<KarlsruheApiResponse>(nextPageUrl);
    for (const item of response.payload ?? []) {
      if (!item?.id) continue;
      items.set(item.id, item);
    }
    nextPageUrl = normalizeText(response._links?.nextPage) || null;
    page += 1;
  }

  const expanded: KarlsruheExpandedEvent[] = [];
  for (const item of items.values()) {
    for (const occurrence of occurrenceWindow(item, afterDate, beforeDate)) {
      expanded.push({ item, occurrence });
    }
  }

  return expanded;
}

export function normalizeKarlsruheTourismEvent(
  source: KarlsruheExpandedEvent,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const item = source.item;
  const occurrence = source.occurrence;
  const dateParts = parseDateOnly(occurrence.date);
  if (!dateParts) return null;

  const category = classifyKarlsruheCategory(item);
  const defaultTime = defaultTimeForCategory(category);
  const startTime = parseTimeParts(occurrence.startAt) ?? defaultTime;
  const endTime = parseTimeParts(occurrence.endAt);
  const startAt = berlinIso(dateParts.year, dateParts.month, dateParts.day, startTime.hour, startTime.minute, startTime.second);
  const endAt = endTime
    ? berlinIso(dateParts.year, dateParts.month, dateParts.day, endTime.hour, endTime.minute, endTime.second)
    : null;

  const { venueName: occurrenceVenueName, venueAddress: occurrenceVenueAddress } = eventAddressFromOccurrence(occurrence);
  const venueName = (occurrenceVenueName ?? normalizeText(item.location?.name)) || null;
  const venueAddress = occurrenceVenueAddress || null;
  const urls = eventUrls(item, occurrence, config.base_url);
  const isTicketed = Boolean(
    item.accessRestrictions?.ticketRequired ||
      urls.ticketUrl ||
      item.booking?.voucherUrl ||
      occurrence.marketingPrices?.some((price) => Number(price.amount ?? 0) > 0)
  );
  const freeEntry = occurrence.freeEntry === true;
  const prices = (occurrence.marketingPrices ?? []).filter((price) => Number.isFinite(price.amount ?? NaN));
  const amounts = prices.map((price) => Number(price.amount ?? 0)).filter((value) => Number.isFinite(value));
  const popularityBoost =
    Number(item.boost ?? 0) +
    (item.highlight ? 18 : 0) +
    (item.tipPopular ? 12 : 0) +
    (item.tipFamous ? 8 : 0) +
    (item.tipOnlyHere ? 8 : 0) +
    (item.tipPublicTransport ? 4 : 0);
  const importanceScore = CATEGORY_PRIORITY[category] + popularityBoost;
  const popularityScore = popularityBoost > 0 ? popularityBoost : null;

  return {
    source: "karlsruhe_tourism",
    external_id: `${item.id}:${occurrence.date}:${normalizeText(occurrence.startAt) || "all-day"}`,
    source_url: urls.sourceUrl,
    ticket_url: urls.ticketUrl ?? toAbsoluteUrl(item.booking?.voucherUrl, config.base_url),
    title: normalizeText(item.name),
    summary: stripTags(item.intro) || null,
    category,
    kind: kindForCategory(category),
    status:
      item.canceled || occurrence.isCancelled
        ? "cancelled"
        : occurrence.active === false || item.trashed || item.invisible
          ? "draft"
          : "scheduled",
    venue_name: venueName,
    venue_address: venueAddress,
    city_slug: config.city_slug,
    country_code: config.country_code ?? "DE",
    lat:
      typeof item.geocoordinates?.latitude === "number" && Number.isFinite(item.geocoordinates.latitude)
        ? item.geocoordinates.latitude
        : null,
    lng:
      typeof item.geocoordinates?.longitude === "number" && Number.isFinite(item.geocoordinates.longitude)
        ? item.geocoordinates.longitude
        : null,
    timezone: "Europe/Berlin",
    start_at: startAt,
    end_at: endAt,
    doors_at: null,
    all_day: !normalizeText(occurrence.startAt),
    is_ticketed: isTicketed && !freeEntry,
    price_min: freeEntry ? 0 : amounts.length > 0 ? Math.min(...amounts) : null,
    price_max: freeEntry ? 0 : amounts.length > 0 ? Math.max(...amounts) : null,
    currency: prices.find((price) => normalizeText(price.currency))?.currency ?? "EUR",
    family_friendly: familyFriendly(item, category),
    indoor_outdoor: indoorOutdoor(item),
    local_rank: importanceScore,
    importance_score: importanceScore,
    popularity_score: popularityScore,
    tags: tagsForEvent(item, category),
    subtypes: subtypesForEvent(item, category),
    audiences: audiencesForEvent(item),
    occasions: occasionsForEvent(category),
    source_payload: source,
    source_updated_at: normalizeText(item.updatedAt) || normalizeText(item.lastReviewedAt) || null,
    last_seen_at: new Date().toISOString(),
  };
}
