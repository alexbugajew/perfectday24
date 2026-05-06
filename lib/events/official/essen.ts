import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type EssenSourceText = {
  rel?: string | null;
  type?: string | null;
  value?: string | null;
};

type EssenSourceGeo = {
  main?: {
    latitude?: number | null;
    longitude?: number | null;
  } | null;
};

type EssenSourceMediaObject = {
  rel?: string | null;
  url?: string | null;
  value?: string | null;
};

type EssenSourceAttribute = {
  key?: string | null;
  value?: string | null;
};

type EssenSourceAddress = {
  name?: string | null;
  city?: string | null;
  zip?: string | null;
  street?: string | null;
  web?: string | null;
  email?: string | null;
  rel?: string | null;
};

type EssenSourceInterval = {
  weekdays?: string[] | null;
  start?: string | null;
  end?: string | null;
  repeatUntil?: string | null;
  tz?: string | null;
  freq?: string | null;
  interval?: number | null;
  hideEnd?: boolean | null;
};

type EssenSourceItem = {
  global_id: string;
  id?: string | null;
  title?: string | null;
  type?: string | null;
  categories?: string[] | null;
  texts?: EssenSourceText[] | null;
  country?: string | null;
  city?: string | null;
  zip?: string | null;
  street?: string | null;
  phone?: string | null;
  fax?: string | null;
  web?: string | null;
  email?: string | null;
  author?: string | null;
  geo?: EssenSourceGeo | null;
  ratings?: Array<{ type?: string | null; value?: number | null }> | null;
  keywords?: string[] | null;
  timeIntervals?: EssenSourceInterval[] | null;
  name?: string | null;
  attributes?: EssenSourceAttribute[] | null;
  features?: string[] | null;
  addresses?: EssenSourceAddress[] | null;
  created?: string | null;
  changed?: string | null;
  source?: {
    url?: string | null;
    value?: string | null;
  } | null;
  company?: string | null;
  district?: string | null;
  media_objects?: EssenSourceMediaObject[] | null;
};

type EssenSearchResponse = {
  status?: string | null;
  count?: number | null;
  overallcount?: number | null;
  items?: EssenSourceItem[] | null;
};

type EssenOccurrence = {
  startAt: string;
  endAt: string | null;
  allDay: boolean;
};

type EssenExpandedEvent = {
  item: EssenSourceItem;
  occurrence: EssenOccurrence;
};

const VISIT_ESSEN_DEFAULT_SEARCH_URL = "https://pages.visitessen.de/de/visitessen/default/search/Event";
const VISIT_ESSEN_SEARCH_API_URL = "https://meta.et4.de/rest.ashx/search/";
const PAGE_SIZE = 100;
const MAX_PAGES = 8;
const LOOKAHEAD_DAYS = 180;
const MAX_OCCURRENCES_PER_ITEM = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const CATEGORY_SCORE: Record<OfficialCityEvent["category"], number> = {
  concert: 86,
  theater: 84,
  show: 82,
  market: 80,
  festival: 81,
  fair: 74,
  food_event: 78,
  community: 70,
  seasonal: 68,
  other: 60,
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
      accept: "text/html,application/xhtml+xml,application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`[visit_essen] HTTP ${response.status} fuer ${url}`);
  }

  return response.text();
}

function deriveDefaultSearchUrl(config: EventSourceConfigRow) {
  if (config.base_url.includes("/streaming/search/")) {
    return config.base_url.replace("/streaming/search/", "/default/search/");
  }
  return VISIT_ESSEN_DEFAULT_SEARCH_URL;
}

function extractMetaToken(html: string) {
  const match = html.match(/window\.META_TOKEN\s*=\s*"([^"]+)"/i);
  if (!match?.[1]) {
    throw new Error("[visit_essen] META_TOKEN konnte nicht aus der offiziellen Eventsuche gelesen werden.");
  }
  return normalizeText(match[1]);
}

function buildSearchUrl(token: string, offset: number) {
  const params = new URLSearchParams({
    experience: "visitessen",
    mkt: "de",
    type: "Event",
    licensekey: token,
    template: "ET2014A.json",
    q: "all:all -systag:has_abnormal_interval",
    sort: "chronological",
    limit: String(PAGE_SIZE),
    offset: String(offset),
    maxresponsetime: "0",
    cause: "pages.finder",
  });

  return `${VISIT_ESSEN_SEARCH_API_URL}?${params.toString()}`;
}

async function fetchSearchPage(token: string, offset: number) {
  const response = await fetch(buildSearchUrl(token, offset), {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "application/json,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`[visit_essen] Search HTTP ${response.status} fuer Offset ${offset}`);
  }

  return (await response.json()) as EssenSearchResponse;
}

function parseDate(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : null;
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function copyTime(from: Date, onto: Date) {
  return new Date(
    onto.getFullYear(),
    onto.getMonth(),
    onto.getDate(),
    from.getHours(),
    from.getMinutes(),
    from.getSeconds(),
    from.getMilliseconds()
  );
}

function isoWithTimezone(date: Date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${hours}:${minutes}`;
}

function weekdaySet(interval: EssenSourceInterval) {
  return new Set(
    (interval.weekdays ?? [])
      .map((entry) => WEEKDAY_MAP[normalizeText(entry).toLowerCase()])
      .filter((entry): entry is number => typeof entry === "number")
  );
}

function durationMsForInterval(interval: EssenSourceInterval, start: Date) {
  const end = parseDate(interval.end);
  if (!end) return null;
  const diff = end.getTime() - start.getTime();
  return diff >= 0 ? diff : null;
}

function pushOccurrence(
  bucket: EssenOccurrence[],
  seen: Set<string>,
  start: Date,
  durationMs: number | null,
  hideEnd: boolean | null | undefined
) {
  const key = start.toISOString();
  if (seen.has(key)) return;
  seen.add(key);
  const end = durationMs !== null ? new Date(start.getTime() + durationMs) : null;
  const durationHours = end ? (end.getTime() - start.getTime()) / 3600000 : 0;
  const allDay =
    Boolean(hideEnd) ||
    start.getHours() === 0 ||
    durationHours >= 20 ||
    (end ? end.getHours() === 23 && end.getMinutes() >= 55 : false);

  bucket.push({
    startAt: isoWithTimezone(start),
    endAt: end ? isoWithTimezone(end) : null,
    allDay,
  });
}

function expandInterval(
  interval: EssenSourceInterval,
  horizonStart: Date,
  horizonEnd: Date
) {
  const start = parseDate(interval.start);
  if (!start) return [];

  const repeatUntil = parseDate(interval.repeatUntil) ?? start;
  const until = repeatUntil.getTime() > horizonEnd.getTime() ? horizonEnd : repeatUntil;
  if (until.getTime() < horizonStart.getTime()) return [];

  const freq = normalizeText(interval.freq).toLowerCase();
  const step = Math.max(1, Number(interval.interval ?? 1));
  const durationMs = durationMsForInterval(interval, start);
  const weekdays = weekdaySet(interval);
  const occurrences: EssenOccurrence[] = [];
  const seen = new Set<string>();

  if (!freq) {
    if (start.getTime() >= horizonStart.getTime() && start.getTime() <= horizonEnd.getTime()) {
      pushOccurrence(occurrences, seen, start, durationMs, interval.hideEnd);
    }
    return occurrences;
  }

  if (freq === "daily") {
    let cursor = start;
    if (cursor.getTime() < horizonStart.getTime()) {
      const diffDays = Math.floor((startOfDay(horizonStart).getTime() - startOfDay(start).getTime()) / DAY_MS);
      const fastForwardSteps = Math.max(0, Math.floor(diffDays / step) - 1);
      cursor = addDays(start, fastForwardSteps * step);
      while (cursor.getTime() < horizonStart.getTime()) {
        cursor = addDays(cursor, step);
      }
    }

    while (cursor.getTime() <= until.getTime() && occurrences.length < MAX_OCCURRENCES_PER_ITEM) {
      if (weekdays.size === 0 || weekdays.has(cursor.getDay())) {
        pushOccurrence(occurrences, seen, cursor, durationMs, interval.hideEnd);
      }
      cursor = addDays(cursor, step);
    }

    return occurrences;
  }

  if (freq === "weekly" && weekdays.size > 0) {
    let cursorDay = startOfDay(start.getTime() > horizonStart.getTime() ? start : addDays(horizonStart, -7 * step));
    while (cursorDay.getTime() <= until.getTime() && occurrences.length < MAX_OCCURRENCES_PER_ITEM) {
      const candidate = copyTime(start, cursorDay);
      const weeksFromStart = Math.floor(
        (startOfDay(candidate).getTime() - startOfDay(start).getTime()) / (7 * DAY_MS)
      );
      if (
        candidate.getTime() >= start.getTime() &&
        candidate.getTime() >= horizonStart.getTime() &&
        weekdays.has(candidate.getDay()) &&
        weeksFromStart >= 0 &&
        weeksFromStart % step === 0
      ) {
        pushOccurrence(occurrences, seen, candidate, durationMs, interval.hideEnd);
      }
      cursorDay = addDays(cursorDay, 1);
    }
    return occurrences;
  }

  if (freq === "weekly") {
    let cursor = start;
    if (cursor.getTime() < horizonStart.getTime()) {
      const diffWeeks = Math.floor((startOfDay(horizonStart).getTime() - startOfDay(start).getTime()) / (7 * DAY_MS));
      const fastForwardSteps = Math.max(0, Math.floor(diffWeeks / step) - 1);
      cursor = addDays(start, fastForwardSteps * step * 7);
      while (cursor.getTime() < horizonStart.getTime()) {
        cursor = addDays(cursor, step * 7);
      }
    }

    while (cursor.getTime() <= until.getTime() && occurrences.length < MAX_OCCURRENCES_PER_ITEM) {
      pushOccurrence(occurrences, seen, cursor, durationMs, interval.hideEnd);
      cursor = addDays(cursor, step * 7);
    }
    return occurrences;
  }

  if (freq === "monthly") {
    let cursor = start;
    while (cursor.getTime() < horizonStart.getTime()) {
      cursor = addMonths(cursor, step);
    }

    while (cursor.getTime() <= until.getTime() && occurrences.length < MAX_OCCURRENCES_PER_ITEM) {
      pushOccurrence(occurrences, seen, cursor, durationMs, interval.hideEnd);
      cursor = addMonths(cursor, step);
    }
    return occurrences;
  }

  if (freq === "yearly") {
    let cursor = start;
    while (cursor.getTime() < horizonStart.getTime()) {
      cursor = addMonths(cursor, 12 * step);
    }

    while (cursor.getTime() <= until.getTime() && occurrences.length < MAX_OCCURRENCES_PER_ITEM) {
      pushOccurrence(occurrences, seen, cursor, durationMs, interval.hideEnd);
      cursor = addMonths(cursor, 12 * step);
    }
    return occurrences;
  }

  if (start.getTime() >= horizonStart.getTime() && start.getTime() <= horizonEnd.getTime()) {
    pushOccurrence(occurrences, seen, start, durationMs, interval.hideEnd);
  }
  return occurrences;
}

function expandOccurrences(item: EssenSourceItem) {
  const now = new Date();
  const horizonStart = addDays(now, -1);
  const horizonEnd = addDays(now, LOOKAHEAD_DAYS);
  const occurrences = (item.timeIntervals ?? [])
    .flatMap((interval) => expandInterval(interval, horizonStart, horizonEnd))
    .sort((left, right) => left.startAt.localeCompare(right.startAt));

  const deduped = new Map<string, EssenOccurrence>();
  for (const occurrence of occurrences) {
    deduped.set(occurrence.startAt, occurrence);
  }

  return Array.from(deduped.values()).slice(0, MAX_OCCURRENCES_PER_ITEM);
}

function collectTexts(item: EssenSourceItem) {
  const texts = (item.texts ?? []).map((entry) => stripTags(entry.value)).filter(Boolean);
  return [
    normalizeText(item.title),
    normalizeText(item.name),
    ...(item.categories ?? []).map(normalizeText),
    ...(item.keywords ?? []).map(normalizeText),
    ...(item.features ?? []).map(normalizeText),
    ...texts,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function categoryFromItem(item: EssenSourceItem): OfficialCityEvent["category"] {
  const categories = (item.categories ?? []).map((entry) => normalizeText(entry).toLowerCase());
  const categoryText = [categories.join(" "), collectTexts(item)].join(" ").toLowerCase();

  if (categories.some((entry) => /(markt|flohmarkt|wochenmarkt|weihnachtsmarkt|messe)/.test(entry))) {
    return /messe/.test(categories.join(" ")) && !/markt/.test(categories.join(" ")) ? "fair" : "market";
  }
  if (categories.some((entry) => /(genuss|gourmet)/.test(entry))) {
    return "food_event";
  }
  if (categories.some((entry) => /(rock|pop|konzert|jazz|klassisches konzert|schlager|weitere konzerte|kirche)/.test(entry))) {
    return "concert";
  }
  if (categories.some((entry) => /(theater|oper|operette|schauspiel)/.test(entry))) {
    return "theater";
  }
  if (categories.some((entry) => /(party|nightlife|vortrag|lesung|film|kino|kabarett|ballett|tanztheater|comedy)/.test(entry))) {
    return "show";
  }
  if (categories.some((entry) => /(ausstellung)/.test(entry))) {
    return "fair";
  }
  if (categories.some((entry) => /(f[üu]hrung|besichtigung|ausflug|exkursion|rundfahrt|rundflug|kurs|seminar|hobby|gesundheit|wellness|sport|freizeit|geselligkeit|treffen)/.test(entry))) {
    return "community";
  }
  if (categories.some((entry) => /(festival|open-air|brauchtum)/.test(entry))) {
    return "festival";
  }

  if (/(wochenmarkt|flohmarkt|weihnachtsmarkt|tr[oö]del|maimarkt|markt\b|feierabend-markt|feierabendmarkt)/.test(categoryText)) {
    return "market";
  }
  if (/(festival|festspiele|stadtfest|kirmes|freimarkt|lichtwochen|open air|brauchtum)/.test(categoryText)) {
    return "festival";
  }
  if (/(messe|kongress|expo|ausstellung|museum|vernissage|kunstmesse)/.test(categoryText)) {
    return "fair";
  }
  if (/(kulinar|wein|bier|food|brunch|dinner|men[üu]|tasting|genuss)/.test(categoryText)) {
    return "food_event";
  }
  if (/(konzert|musik|jazz|band|orchester|chor|philharmoni|symphonie)/.test(categoryText)) {
    return "concert";
  }
  if (/(theater|oper|schauspiel|b[üu]hne|puppentheater|kabarettb[üu]hne)/.test(categoryText)) {
    return "theater";
  }
  if (/(musical|show|comedy|kabarett|lesung|performance|film|kino|ballett|tanz|revue)/.test(categoryText)) {
    return "show";
  }
  if (/(f[üu]hrung|besichtigung|workshop|treff|rundgang|tour|vortrag|seminar|kurs|jugend|familie)/.test(categoryText)) {
    return "community";
  }
  if (/(weihnacht|advent|winter|sommerferien|oster)/.test(categoryText)) {
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

function audienceForItem(category: OfficialCityEvent["category"], text: string) {
  const audiences = new Set<string>();
  if (/(kinder|familie|family|jugend|schul)/.test(text)) audiences.add("family");
  if (/(tour|welterbe|stadtf[üu]hrung|museum|ausstellung|markt|festival|messe)/.test(text)) audiences.add("tourism");
  if (/(konzert|theater|show|comedy|kabarett|open air|party|festival)/.test(text)) audiences.add("friends");
  if (/(romantik|dinner|tasting|wein|jazz|show|theater|konzert)/.test(text)) audiences.add("date");
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

function subtypesForItem(category: OfficialCityEvent["category"], text: string) {
  const subtypes = new Set<string>();

  if (/(f[üu]hrung|rundgang|tour|besichtigung)/.test(text)) subtypes.add("guided_tour");
  if (/(wochenmarkt)/.test(text)) subtypes.add("weekly_market");
  if (/(flohmarkt|tr[oö]del|trempel)/.test(text)) subtypes.add("flea_market");
  if (/(weihnacht|advent)/.test(text)) subtypes.add("christmas_market");
  if (/(film|kino)/.test(text)) subtypes.add("cinema");
  if (/(comedy|kabarett)/.test(text)) subtypes.add("comedy");
  if (/(musical)/.test(text)) subtypes.add("musical");
  if (/(open air)/.test(text)) subtypes.add("open_air");
  if (/(messe|kongress)/.test(text)) subtypes.add("trade_fair");
  if (/(ausstellung|museum|vernissage)/.test(text)) subtypes.add("exhibition");

  if (subtypes.size === 0) {
    subtypes.add(
      category === "market"
        ? "market_event"
        : category === "festival"
          ? "festival_event"
          : category === "concert"
            ? "live_music"
            : category === "theater"
              ? "stage_event"
              : category === "show"
                ? "show_event"
                : category === "food_event"
                  ? "culinary_event"
                  : "city_event"
    );
  }

  return Array.from(subtypes);
}

function indoorOutdoorForItem(text: string) {
  if (/(open air|markt|welterbe|park|plaza|platz|freiluft|drau[ßs]en|outdoor)/.test(text)) {
    return "outdoor" as const;
  }
  if (/(theater|museum|kino|halle|oper|konzerthaus|club|zentrum)/.test(text)) {
    return "indoor" as const;
  }
  return null;
}

function mediaUrlByRel(item: EssenSourceItem, rels: string[]) {
  const lowerRels = rels.map((entry) => entry.toLowerCase());
  const match = (item.media_objects ?? []).find((media) => {
    const rel = normalizeText(media.rel).toLowerCase();
    return rel && lowerRels.includes(rel);
  });
  return match?.url ? normalizeText(match.url) : null;
}

function sourceUrlForItem(item: EssenSourceItem, config: EventSourceConfigRow) {
  return (
    toAbsoluteUrl(mediaUrlByRel(item, ["canonical"]), config.base_url) ??
    toAbsoluteUrl(item.web, config.base_url) ??
    toAbsoluteUrl(mediaUrlByRel(item, ["venuewebsite", "directions"]), config.base_url) ??
    toAbsoluteUrl(item.source?.url ?? null, config.base_url) ??
    null
  );
}

function ticketUrlForItem(item: EssenSourceItem, config: EventSourceConfigRow) {
  const direct =
    mediaUrlByRel(item, ["price_kartenlink", "booking"]) ??
    normalizeText(item.web).match(/ticket|eventim|ticketfritz/i)?.input ??
    null;
  return toAbsoluteUrl(direct, config.base_url);
}

function venueAddressForItem(item: EssenSourceItem) {
  const primary = [normalizeText(item.street), [normalizeText(item.zip), normalizeText(item.city)].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  if (primary) return primary;

  const organization = (item.addresses ?? []).find((entry) => normalizeText(entry.rel).toLowerCase() === "organisation");
  if (!organization) return null;
  return [normalizeText(organization.street), [normalizeText(organization.zip), normalizeText(organization.city)].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ") || null;
}

function venueNameForItem(item: EssenSourceItem) {
  return (
    normalizeText(item.name) ||
    normalizeText(item.company) ||
    normalizeText((item.addresses ?? []).find((entry) => normalizeText(entry.rel).toLowerCase() === "organisation")?.name) ||
    null
  );
}

function sourceUpdatedAtForItem(item: EssenSourceItem) {
  const changed = parseDate(item.changed);
  if (changed) return changed.toISOString();
  const created = parseDate(item.created);
  return created ? created.toISOString() : new Date().toISOString();
}

export async function fetchVisitEssenEvents(config: EventSourceConfigRow) {
  const defaultSearchUrl = deriveDefaultSearchUrl(config);
  const searchHtml = await fetchText(defaultSearchUrl);
  const token = extractMetaToken(searchHtml);

  const cards: EssenExpandedEvent[] = [];
  let offset = 0;
  let overallCount = 0;
  let page = 0;

  while (page < MAX_PAGES) {
    const json = await fetchSearchPage(token, offset);
    const items = json.items ?? [];
    if (items.length === 0) break;

    overallCount = Number(json.overallcount ?? items.length);
    for (const item of items) {
      for (const occurrence of expandOccurrences(item)) {
        cards.push({ item, occurrence });
      }
    }

    offset += items.length;
    page += 1;
    if (offset >= overallCount) break;
  }

  return cards;
}

export function normalizeVisitEssenEvent(
  event: EssenExpandedEvent,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const item = event.item;
  const occurrence = event.occurrence;
  const title = normalizeText(item.title);
  if (!title || !occurrence.startAt) return null;

  const text = collectTexts(item);
  const category = categoryFromItem(item);
  const audiences = audienceForItem(category, text);
  const ticketUrl = ticketUrlForItem(item, config);
  const lat =
    typeof item.geo?.main?.latitude === "number" && Number.isFinite(item.geo.main.latitude)
      ? item.geo.main.latitude
      : null;
  const lng =
    typeof item.geo?.main?.longitude === "number" && Number.isFinite(item.geo.main.longitude)
      ? item.geo.main.longitude
      : null;

  return {
    source: config.provider,
    external_id: `visit_essen:${item.global_id}:${occurrence.startAt}`,
    source_url: sourceUrlForItem(item, config),
    ticket_url: ticketUrl,
    title,
    summary:
      stripTags((item.texts ?? []).find((entry) => normalizeText(entry.rel).toLowerCase() === "teaser")?.value) ||
      stripTags((item.texts ?? []).find((entry) => normalizeText(entry.rel).toLowerCase() === "details")?.value) ||
      null,
    category,
    kind: kindForCategory(category),
    status: "scheduled",
    venue_name: venueNameForItem(item),
    venue_address: venueAddressForItem(item),
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat,
    lng,
    timezone: "Europe/Berlin",
    start_at: occurrence.startAt,
    end_at: occurrence.endAt,
    doors_at: null,
    all_day: occurrence.allDay,
    is_ticketed: Boolean(ticketUrl),
    price_min: null,
    price_max: null,
    currency: null,
    family_friendly: audiences.includes("family"),
    indoor_outdoor: indoorOutdoorForItem(text),
    local_rank: CATEGORY_SCORE[category] + (ticketUrl ? 4 : 0),
    importance_score: CATEGORY_SCORE[category],
    popularity_score: CATEGORY_SCORE[category] - 4 + ((item.media_objects ?? []).length > 3 ? 3 : 0),
    tags: Array.from(
      new Set(
        [
          "visit_essen",
          category,
          normalizeText(item.name),
          ...(item.categories ?? []).map(normalizeText),
          ...(item.keywords ?? []).map(normalizeText),
        ].filter(Boolean)
      )
    ),
    subtypes: subtypesForItem(category, text),
    audiences,
    occasions: occasionsForCategory(category),
    source_payload: event,
    source_updated_at: sourceUpdatedAtForItem(item),
    last_seen_at: new Date().toISOString(),
  };
}
