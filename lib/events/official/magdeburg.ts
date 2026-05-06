import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type MagdeburgScheduling = {
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  venueSegment: string | null;
  summary: string | null;
};

type MagdeburgFeedItem = {
  guid: string;
  title: string;
  sourceUrl: string;
  description: string | null;
  scheduling: MagdeburgScheduling;
};

const MAGDEBURG_ROOT_URL = "https://www.magdeburg.de";
const MAGDEBURG_EVENTS_URL = `${MAGDEBURG_ROOT_URL}/veranstaltungen`;
const MAGDEBURG_RSS_URL = `${MAGDEBURG_ROOT_URL}/media/rss/Veranstaltungsexport.xml`;
const LOOKAHEAD_DAYS = 120;

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

function toAbsoluteUrl(url: string | null | undefined, baseUrl = MAGDEBURG_ROOT_URL) {
  const normalized = normalizeText(decodeHtml(url ?? ""));
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
      accept: "application/rss+xml,application/xml,text/xml,text/html",
    },
  });

  if (!response.ok) {
    throw new Error(`[magdeburg_city] HTTP ${response.status} fuer ${url}`);
  }

  return response.text();
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

function addDays(date: Date, amount: number) {
  return new Date(date.getTime() + amount * 24 * 60 * 60 * 1000);
}

function parseGermanDate(value: string) {
  const match = normalizeText(value).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  return {
    day: Number(match[1]),
    month: Number(match[2]),
    year: Number(match[3]),
  };
}

function parseScheduling(description: string) {
  const text = normalizeText(decodeHtml(description));
  if (!text) return null;

  const rangeWithTimes = text.match(
    /^(\d{2}\.\d{2}\.\d{4})\s+von\s+(\d{1,2}:\d{2})\s+bis\s+(\d{1,2}:\d{2})\s+Uhr(?:\s+in\s+([^:]+))?:\s*(.+)$/i
  );
  if (rangeWithTimes) {
    return {
      startDate: normalizeText(rangeWithTimes[1]),
      endDate: null,
      startTime: normalizeText(rangeWithTimes[2]) || null,
      endTime: normalizeText(rangeWithTimes[3]) || null,
      allDay: false,
      venueSegment: normalizeText(rangeWithTimes[4]) || null,
      summary: normalizeText(rangeWithTimes[5]) || null,
    };
  }

  const startOnly = text.match(
    /^(\d{2}\.\d{2}\.\d{4})\s+ab\s+(\d{1,2}:\d{2})\s+Uhr(?:\s+in\s+([^:]+))?:\s*(.+)$/i
  );
  if (startOnly) {
    return {
      startDate: normalizeText(startOnly[1]),
      endDate: null,
      startTime: normalizeText(startOnly[2]) || null,
      endTime: null,
      allDay: false,
      venueSegment: normalizeText(startOnly[3]) || null,
      summary: normalizeText(startOnly[4]) || null,
    };
  }

  const rangeAllDay = text.match(
    /^(\d{2}\.\d{2}\.\d{4})\s+bis\s+(\d{2}\.\d{2}\.\d{4})(?:\s+in\s+([^:]+))?:\s*(.+)$/i
  );
  if (rangeAllDay) {
    return {
      startDate: normalizeText(rangeAllDay[1]),
      endDate: normalizeText(rangeAllDay[2]) || null,
      startTime: null,
      endTime: null,
      allDay: true,
      venueSegment: normalizeText(rangeAllDay[3]) || null,
      summary: normalizeText(rangeAllDay[4]) || null,
    };
  }

  const singleDate = text.match(/^(\d{2}\.\d{2}\.\d{4})(?:\s+in\s+([^:]+))?:\s*(.+)$/i);
  if (singleDate) {
    return {
      startDate: normalizeText(singleDate[1]),
      endDate: null,
      startTime: null,
      endTime: null,
      allDay: true,
      venueSegment: normalizeText(singleDate[2]) || null,
      summary: normalizeText(singleDate[3]) || null,
    };
  }

  return null;
}

function parseVenueParts(value: string | null) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return {
      venueName: null,
      venueAddress: null,
    };
  }

  const addressMatch = normalized.match(/^(.*?),\s*(.*\b\d{5}\s+[A-Za-zÄÖÜäöüß\- ]+)$/);
  if (addressMatch) {
    return {
      venueName: normalizeText(addressMatch[1]) || null,
      venueAddress: normalizeText(addressMatch[2]) || null,
    };
  }

  return {
    venueName: normalized,
    venueAddress: null,
  };
}

function shouldSkipSignal(signal: string) {
  if (!signal) return true;
  if (/\b(gottesdienst|andacht|gebet|vesper)\b/.test(signal)) return true;
  if (/\b(sitzung|stadtrat|ausschuss|beirat|parlament|sprechstunde|beratung)\b/.test(signal)) {
    return true;
  }
  if (/\b(stadtfuehrung|stadtfuhrung|rundgang|fuehrung|fuhrung)\b/.test(signal)) return true;
  if (/\b(workshop|seminar|kurs|training|ruckentraining|rueckentraining|yoga)\b/.test(signal)) {
    return true;
  }
  return false;
}

function categoryFromSignal(signal: string): OfficialCityEvent["category"] {
  if (!signal) return "other";
  if (/\b(weihnacht|advent|wintermarkt)\b/.test(signal)) return "seasonal";
  if (/\b(flohmarkt|troedelmarkt|trödelmarkt|wochenmarkt|fruehlingsmarkt|frühlingsmarkt|markt|basar)\b/.test(signal)) {
    return "market";
  }
  if (/\b(festival|stadtfest|open air|rave|party|clubnacht|kultursommer)\b/.test(signal)) {
    return "festival";
  }
  if (/\b(dinner|brunch|kulinar|genuss|tasting|wein|bier|street food)\b/.test(signal)) {
    return "food_event";
  }
  if (/\b(konzert|tour\b|band|orchester|chor|philharmon|symphon|live\b|musik|recital)\b/.test(signal)) {
    return "concert";
  }
  if (/\b(theater|oper|operette|schauspiel|puppentheater|ballett|musical)\b/.test(signal)) {
    return "theater";
  }
  if (/\b(comedy|kabarett|lesung|vortrag|diskussion|film|kino|open mic|quiz|show|performance|slam|buehne|bühne)\b/.test(signal)) {
    return "show";
  }
  if (/\b(ausstellung|vernissage|museum|galerie|fotoausstellung|messe|expo)\b/.test(signal)) {
    return "fair";
  }
  if (/\b(kinder|familie|mitmach|vorlese|begegnung|treff)\b/.test(signal)) {
    return "community";
  }
  return "community";
}

function kindForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") {
    return "anchored_event" as const;
  }
  return "flex_event" as const;
}

function defaultTimeForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") return "19:30";
  if (category === "market" || category === "festival" || category === "fair" || category === "food_event") {
    return "12:00";
  }
  return "17:00";
}

function buildIsoFromGermanDate(dateText: string, timeText: string | null, category: OfficialCityEvent["category"]) {
  const parsedDate = parseGermanDate(dateText);
  if (!parsedDate) return null;
  const time = normalizeText(timeText) || defaultTimeForCategory(category);
  const timeMatch = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) return null;
  return berlinIso(
    parsedDate.year,
    parsedDate.month,
    parsedDate.day,
    Number(timeMatch[1]),
    Number(timeMatch[2])
  );
}

function indoorOutdoorForSignal(signal: string, category: OfficialCityEvent["category"]) {
  if (/\b(open air|markt|rave|fest|basar|flohmarkt)\b/.test(signal)) return "outdoor" as const;
  if (/\b(theater|oper|museum|galerie|saal|arena|halle|kino)\b/.test(signal)) return "indoor" as const;
  if (category === "market" || category === "festival") return "mixed" as const;
  return null;
}

function audiencesForCategory(category: OfficialCityEvent["category"], signal: string) {
  const audiences = new Set<string>();
  if (/\b(kinder|familie|family)\b/.test(signal)) audiences.add("family");
  if (category === "concert" || category === "show" || category === "festival") audiences.add("friends");
  if (category === "concert" || category === "theater" || category === "show") audiences.add("date");
  if (category === "market" || category === "festival" || category === "fair" || category === "food_event") {
    audiences.add("tourism");
    audiences.add("friends");
  }
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

function tagsForEvent(
  title: string,
  summary: string | null,
  category: OfficialCityEvent["category"],
  venueName: string | null
) {
  return Array.from(
    new Set(
      [category, venueName, title, summary]
        .filter(Boolean)
        .map((value) => foldSearchText(String(value)).replace(/\s+/g, "_"))
        .filter((value) => value.length > 0)
    )
  );
}

function subtypesForEvent(signal: string, category: OfficialCityEvent["category"]) {
  const subtypes = new Set<string>();
  subtypes.add("concrete_event_page");
  subtypes.add(category);

  if (category === "market") {
    subtypes.add("market_event");
    if (/wochenmarkt|thiemmarkt/.test(signal)) subtypes.add("weekly_market");
    if (/flohmarkt|troedelmarkt|trödelmarkt/.test(signal)) subtypes.add("flea_market");
  }
  if (category === "festival") {
    subtypes.add("festival_event");
    if (/open air/.test(signal)) subtypes.add("open_air");
  }
  if (category === "concert") subtypes.add("live_music");
  if (category === "theater") subtypes.add("performing_arts");
  if (category === "show") {
    if (/vortrag|diskussion/.test(signal)) subtypes.add("talk");
    if (/film|kino/.test(signal)) subtypes.add("screening");
    if (/lesung/.test(signal)) subtypes.add("reading");
    if (/comedy|kabarett|open mic|quiz|buehne|bühne/.test(signal)) subtypes.add("stage_program");
  }
  if (/kinder|familie/.test(signal)) subtypes.add("family_program");

  return Array.from(subtypes);
}

function parseFeedItems(xml: string, baseUrl: string) {
  const items: MagdeburgFeedItem[] = [];
  const minDate = berlinDateString(new Date());
  const maxDate = berlinDateString(addDays(new Date(), LOOKAHEAD_DAYS));

  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = match[1];
    const title = stripTags(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const sourceUrl = toAbsoluteUrl(block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "", baseUrl);
    const description = stripTags(block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "") || null;
    const scheduling = description ? parseScheduling(description) : null;

    if (!title || !sourceUrl || !description || !scheduling) continue;

    const signal = foldSearchText([title, description, scheduling.venueSegment ?? ""].join(" "));
    if (shouldSkipSignal(signal)) continue;

    const category = categoryFromSignal(signal);
    if (category === "other") continue;

    const startAt = buildIsoFromGermanDate(scheduling.startDate, scheduling.startTime, category);
    if (!startAt) continue;
    if (startAt.slice(0, 10) < minDate || startAt.slice(0, 10) > maxDate) continue;

    const guid =
      normalizeText(sourceUrl.match(/[?&]FID=([^&]+)/i)?.[1] ?? "") ||
      normalizeText(sourceUrl.match(/\/([^/?#]+)\.php/i)?.[1] ?? "") ||
      sourceUrl;

    items.push({
      guid,
      title,
      sourceUrl,
      description,
      scheduling,
    });
  }

  return items;
}

export async function fetchMagdeburgCityEvents(config: EventSourceConfigRow) {
  const configuredBaseUrl = normalizeText(config.base_url);
  const rssUrl =
    configuredBaseUrl && /\/media\/rss\//i.test(configuredBaseUrl)
      ? configuredBaseUrl
      : MAGDEBURG_RSS_URL;
  const xml = await fetchText(rssUrl);
  return parseFeedItems(xml, MAGDEBURG_ROOT_URL);
}

export function normalizeMagdeburgCityEvent(
  item: MagdeburgFeedItem,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const title = normalizeText(item.title);
  if (!title) return null;

  const signal = foldSearchText(
    [title, item.description ?? "", item.scheduling.venueSegment ?? ""].join(" ")
  );
  const category = categoryFromSignal(signal);
  if (category === "other") return null;

  const startAt = buildIsoFromGermanDate(item.scheduling.startDate, item.scheduling.startTime, category);
  if (!startAt) return null;
  const endAt =
    item.scheduling.endDate
      ? buildIsoFromGermanDate(item.scheduling.endDate, item.scheduling.endTime, category)
      : item.scheduling.endTime
        ? buildIsoFromGermanDate(item.scheduling.startDate, item.scheduling.endTime, category)
        : null;

  const venueParts = parseVenueParts(item.scheduling.venueSegment);
  const summary = item.scheduling.summary ?? item.description ?? null;
  const audiences = audiencesForCategory(category, signal);
  const importanceScore = CATEGORY_PRIORITY[category] + (venueParts.venueName ? 4 : 0) + 20;

  return {
    source: config.provider,
    external_id: `magdeburg_city:${item.guid}:${startAt}`,
    source_url: item.sourceUrl,
    ticket_url: null,
    title,
    summary,
    category,
    kind: kindForCategory(category),
    status: "scheduled",
    venue_name: venueParts.venueName,
    venue_address: venueParts.venueAddress,
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: null,
    lng: null,
    timezone: "Europe/Berlin",
    start_at: startAt,
    end_at: endAt,
    doors_at: null,
    all_day: item.scheduling.allDay,
    is_ticketed: /(ticket|eintritt|tour|konzert|oper|show|theater|arena)/i.test(signal),
    price_min: null,
    price_max: null,
    currency: null,
    family_friendly: audiences.includes("family"),
    indoor_outdoor: indoorOutdoorForSignal(signal, category),
    local_rank: importanceScore,
    importance_score: importanceScore,
    popularity_score: importanceScore - 6,
    tags: tagsForEvent(title, summary, category, venueParts.venueName),
    subtypes: subtypesForEvent(signal, category),
    audiences,
    occasions: occasionsForCategory(category),
    source_payload: {
      rssItem: item,
    },
    source_updated_at: null,
    last_seen_at: new Date().toISOString(),
  };
}
