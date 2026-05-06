import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type NuernbergTouristAttraction = {
  "@context"?: string;
  "@type"?: string | string[];
  name?: string;
  description?: string;
  url?: string;
  address?: {
    "@type"?: string;
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    addressCountry?: string;
  };
  geo?: {
    "@type"?: string;
    latitude?: number;
    longitude?: number;
  };
};

type NuernbergDetailOccurrence = {
  ident: string;
  sourceUrl: string;
  title: string;
  summary: string | null;
  sectionKey: string;
  venueName: string | null;
  venueAddress: string | null;
  lat: number | null;
  lng: number | null;
  ticketUrl: string | null;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  detailText: string;
  sourcePayload: {
    touristAttraction: NuernbergTouristAttraction | null;
  };
};

type NuernbergListSource = {
  sectionKey: string;
  baseUrl: string;
  maxPages: number;
};

const LIST_SOURCES: NuernbergListSource[] = [
  {
    sectionKey: "feste-maerkte",
    baseUrl: "https://tourismus.nuernberg.de/erleben/events/feste-maerkte/",
    maxPages: 4,
  },
  {
    sectionKey: "jahreshighlights",
    baseUrl: "https://tourismus.nuernberg.de/erleben/events/jahreshighlights/",
    maxPages: 4,
  },
];

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
    .replace(/&szlig;/g, "ss")
    .replace(/&ndash;/g, "-");
}

function stripTags(text: string | null | undefined) {
  return normalizeText(decodeHtml(String(text ?? "").replace(/<[^>]+>/g, " ")));
}

function normalizeAbsoluteUrl(url: string | null | undefined, baseUrl: string) {
  const normalized = normalizeText(url);
  if (!normalized) return null;
  try {
    return new URL(normalized, baseUrl).toString();
  } catch {
    return normalized;
  }
}

function normalizeGermanKey(value: string | null | undefined) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`[nuernberg_tourism] HTTP ${response.status} fuer ${url}`);
  }

  return response.text();
}

function buildListPageUrl(baseUrl: string, pageNumber: number) {
  if (pageNumber <= 1) return baseUrl;
  const url = new URL(baseUrl);
  url.searchParams.set("tx_news_pi1[currentPage]", String(pageNumber));
  return url.toString();
}

function parseDetailLinks(html: string, baseUrl: string, sectionKey: string) {
  const links = new Map<string, string>();
  const regex = new RegExp(`href="(/erleben/events/${sectionKey}/[^"?#]+/?)"`, "gi");
  const matches = Array.from(html.matchAll(regex));

  for (const match of matches) {
    const href = normalizeText(match[1]);
    if (!href || href.endsWith(`/${sectionKey}/`)) continue;
    const absolute = normalizeAbsoluteUrl(href, baseUrl);
    if (!absolute) continue;
    links.set(absolute, absolute);
  }

  return Array.from(links.values());
}

function parseTitle(html: string) {
  const title = stripTags(
    html.match(/<h1[^>]*itemprop="headline"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ??
      html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ??
      ""
  );
  return title.replace(/\s*-\s*Tourismus N.uernberg$/i, "").trim();
}

function parseSummary(html: string) {
  return (
    stripTags(html.match(/<meta name="description" content="([^"]*)"/i)?.[1] ?? "") ||
    stripTags(html.match(/<div class="teaser-text"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "") ||
    null
  );
}

function parseTouristAttraction(html: string) {
  const scripts = Array.from(
    html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
  );

  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script[1]) as unknown;
      if (!parsed || typeof parsed !== "object") continue;
      const rawType = (parsed as Record<string, unknown>)["@type"];
      const types = Array.isArray(rawType) ? rawType.map(String) : rawType ? [String(rawType)] : [];
      if (types.some((type) => type.toLowerCase().includes("touristattraction"))) {
        return parsed as NuernbergTouristAttraction;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function addressText(attraction: NuernbergTouristAttraction | null) {
  const street = normalizeText(attraction?.address?.streetAddress);
  const city = normalizeText(attraction?.address?.addressLocality);
  const region = normalizeText(attraction?.address?.addressRegion);
  return [street, [city, region].filter(Boolean).join(", ")].filter(Boolean).join(" | ") || null;
}

function extractDetailText(html: string) {
  const sections = [
    stripTags(html.match(/<div class="teaser-text"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? ""),
    stripTags(html.match(/<div class="news-text-wrap"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? ""),
    stripTags(html.match(/<div class="col-md-8 info-openinghours">([\s\S]*?)<\/div>/i)?.[1] ?? ""),
  ].filter(Boolean);

  return sections.join(" ");
}

function parseTimeInfo(text: string) {
  const matches = Array.from(
    text.matchAll(/(\d{1,2}[.:]\d{2})\s*bis\s*(\d{1,2}[.:]\d{2})\s*uhr/gi)
  );
  if (matches.length !== 1) {
    return {
      startTime: null,
      endTime: null,
      allDay: true,
    };
  }

  return {
    startTime: matches[0][1].replace(".", ":"),
    endTime: matches[0][2].replace(".", ":"),
    allDay: false,
  };
}

function monthNumber(raw: string | null | undefined) {
  const normalized = normalizeGermanKey(raw);
  const map: Record<string, string> = {
    januar: "01",
    jan: "01",
    februar: "02",
    feb: "02",
    maerz: "03",
    märz: "03",
    marz: "03",
    mrz: "03",
    april: "04",
    apr: "04",
    mai: "05",
    juni: "06",
    jun: "06",
    juli: "07",
    jul: "07",
    august: "08",
    aug: "08",
    september: "09",
    sep: "09",
    oktober: "10",
    okt: "10",
    november: "11",
    nov: "11",
    dezember: "12",
    dez: "12",
  };
  return map[normalized] ?? null;
}

function buildIso(datePart: string, timePart: string | null) {
  const time = timePart ?? "12:00";
  return `${datePart}T${time}:00+02:00`;
}

function collectDateRanges(text: string) {
  const normalized = decodeHtml(text);
  const results = new Map<string, { startDate: string; endDate: string | null }>();

  const sameMonthPair = Array.from(
    normalized.matchAll(/(\d{1,2})\.\s*und\s*(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)\s*(\d{4})/gi)
  );
  for (const match of sameMonthPair) {
    const month = monthNumber(match[3]);
    if (!month) continue;
    const year = match[4];
    const first = `${year}-${month}-${String(match[1]).padStart(2, "0")}`;
    const second = `${year}-${month}-${String(match[2]).padStart(2, "0")}`;
    results.set(`${first}|`, { startDate: first, endDate: null });
    results.set(`${second}|`, { startDate: second, endDate: null });
  }

  const crossMonthRange = Array.from(
    normalized.matchAll(
      /(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)\s*bis\s*(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)\s*(\d{4})/gi
    )
  );
  for (const match of crossMonthRange) {
    const startMonth = monthNumber(match[2]);
    const endMonth = monthNumber(match[4]);
    if (!startMonth || !endMonth) continue;
    const year = match[5];
    const startDate = `${year}-${startMonth}-${String(match[1]).padStart(2, "0")}`;
    const endDate = `${year}-${endMonth}-${String(match[3]).padStart(2, "0")}`;
    results.set(`${startDate}|${endDate}`, { startDate, endDate });
  }

  const sameMonthRange = Array.from(
    normalized.matchAll(/(\d{1,2})\.\s*bis\s*(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)\s*(\d{4})/gi)
  );
  for (const match of sameMonthRange) {
    const month = monthNumber(match[3]);
    if (!month) continue;
    const year = match[4];
    const startDate = `${year}-${month}-${String(match[1]).padStart(2, "0")}`;
    const endDate = `${year}-${month}-${String(match[2]).padStart(2, "0")}`;
    results.set(`${startDate}|${endDate}`, { startDate, endDate });
  }

  const singleDates = Array.from(
    normalized.matchAll(/(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)\s*(\d{4})/gi)
  );
  for (const match of singleDates) {
    const month = monthNumber(match[2]);
    if (!month) continue;
    const date = `${match[3]}-${month}-${String(match[1]).padStart(2, "0")}`;
    results.set(`${date}|`, { startDate: date, endDate: null });
  }

  return Array.from(results.values());
}

function categoryFromText(sectionKey: string, text: string): OfficialCityEvent["category"] {
  const normalized = normalizeGermanKey(text);
  if (sectionKey === "feste-maerkte") {
    if (/(flohmarkt|wochenmarkt|ostermarkt|herbstmarkt|markt)/.test(normalized)) return "market";
    if (/(festival|fest|bierfest|kirchweih|christkindlesmarkt)/.test(normalized)) return "festival";
  }
  if (/(konzert|musik|open air|orchester|bardentreffen|musikfest)/.test(normalized)) return "concert";
  if (/(theater|kabarett|comedy|film|kino|show|musical)/.test(normalized)) return "show";
  if (/(flohmarkt|wochenmarkt|ostermarkt|herbstmarkt|markt)/.test(normalized)) return "market";
  if (/(festival|fest|bierfest|kirchweih|challenge)/.test(normalized)) return "festival";
  if (/(essen|wein|kulinar|food|bier)/.test(normalized)) return "food_event";
  if (/(ausstellung|museum|messe|expo)/.test(normalized)) return "fair";
  if (/(fuehrung|tour|community|vortrag|workshop)/.test(normalized)) return "community";
  if (/(weihnacht|ostern|sommer|winter)/.test(normalized)) return "seasonal";
  return "other";
}

function kindForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") {
    return "anchored_event" as const;
  }
  return "flex_event" as const;
}

function audiencesForCategory(category: OfficialCityEvent["category"], text: string) {
  const normalized = normalizeGermanKey(text);
  if (/famil|kinder/.test(normalized)) return ["family", "tourism"];
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

function subtypesForCategory(category: OfficialCityEvent["category"], text: string) {
  const normalized = normalizeGermanKey(text);
  return Array.from(
    new Set(
      [
        "concrete_event_page",
        category,
        /wochenmarkt/.test(normalized) ? "weekly_market" : null,
        /flohmarkt|markt/.test(normalized) ? "market_event" : null,
        /festival|fest|open air/.test(normalized) ? "festival_event" : null,
        /film|kino/.test(normalized) ? "film_event" : null,
      ].filter((value): value is string => Boolean(value))
    )
  );
}

async function fetchNuernbergDetailOccurrences(sourceUrl: string, sectionKey: string) {
  const html = await fetchHtml(sourceUrl);
  const title = parseTitle(html);
  const summary = parseSummary(html);
  const touristAttraction = parseTouristAttraction(html);
  const detailText = extractDetailText(html);
  const dateRanges = collectDateRanges(`${summary ?? ""} ${detailText}`);
  const timeInfo = parseTimeInfo(detailText);

  if (!title || dateRanges.length === 0) return [];

  const venueName =
    normalizeText(touristAttraction?.name) ||
    stripTags(html.match(/<h3 class="h4[^"]*">Veranstaltungsort<\/h3>[\s\S]*?<p>([\s\S]*?)<\/p>/i)?.[1] ?? "") ||
    null;
  const venueAddress = addressText(touristAttraction);
  const lat =
    typeof touristAttraction?.geo?.latitude === "number" ? touristAttraction.geo.latitude : null;
  const lng =
    typeof touristAttraction?.geo?.longitude === "number" ? touristAttraction.geo.longitude : null;
  const ticketUrl = normalizeAbsoluteUrl(touristAttraction?.url, sourceUrl);
  const identBase = sourceUrl.split("/").filter(Boolean).pop() ?? title;

  return dateRanges.map((range, index) => ({
    ident: `${identBase}:${range.startDate}:${range.endDate ?? ""}:${index}`,
    sourceUrl,
    title,
    summary,
    sectionKey,
    venueName,
    venueAddress,
    lat,
    lng,
    ticketUrl,
    startAt: buildIso(range.startDate, timeInfo.startTime),
    endAt: range.endDate
      ? buildIso(range.endDate, timeInfo.endTime ?? timeInfo.startTime)
      : timeInfo.endTime
        ? buildIso(range.startDate, timeInfo.endTime)
        : null,
    allDay: timeInfo.allDay,
    detailText,
    sourcePayload: {
      touristAttraction,
    },
  }));
}

export async function fetchNuernbergTourismEvents(config: EventSourceConfigRow) {
  const detailUrls = new Map<string, string>();

  for (const listSource of LIST_SOURCES) {
    for (let pageNumber = 1; pageNumber <= listSource.maxPages; pageNumber += 1) {
      const url = buildListPageUrl(listSource.baseUrl, pageNumber);
      const html = await fetchHtml(url);
      const pageLinks = parseDetailLinks(html, listSource.baseUrl, listSource.sectionKey);
      if (pageLinks.length === 0) break;
      for (const link of pageLinks) {
        if (!detailUrls.has(link)) {
          detailUrls.set(link, listSource.sectionKey);
        }
      }
    }
  }

  const results: NuernbergDetailOccurrence[] = [];
  const entries = Array.from(detailUrls.entries());
  for (let index = 0; index < entries.length; index += DETAIL_CHUNK_SIZE) {
    const chunk = entries.slice(index, index + DETAIL_CHUNK_SIZE);
    const details = await Promise.all(
      chunk.map(async ([sourceUrl, sectionKey]) => {
        try {
          return await fetchNuernbergDetailOccurrences(sourceUrl, sectionKey);
        } catch {
          return [];
        }
      })
    );
    results.push(...details.flat());
  }

  return results;
}

export function normalizeNuernbergTourismEvent(
  item: NuernbergDetailOccurrence,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const combinedText = [
    item.title,
    item.summary,
    item.venueName,
    item.venueAddress,
    item.detailText,
  ]
    .filter(Boolean)
    .join(" ");
  const category = categoryFromText(item.sectionKey, combinedText);
  if (category === "other") return null;

  const audiences = audiencesForCategory(category, combinedText);
  const occasions = occasionsForCategory(category);

  return {
    source: config.provider,
    external_id: `nuernberg_tourism:${item.ident}`,
    source_url: item.sourceUrl,
    ticket_url: item.ticketUrl,
    title: item.title,
    summary: item.summary,
    category,
    kind: kindForCategory(category),
    status: "scheduled",
    venue_name: item.venueName,
    venue_address: item.venueAddress,
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: item.lat,
    lng: item.lng,
    timezone: "Europe/Berlin",
    start_at: item.startAt,
    end_at: item.endAt,
    doors_at: null,
    all_day: item.allDay,
    is_ticketed: Boolean(item.ticketUrl),
    price_min: null,
    price_max: null,
    currency: null,
    family_friendly: audiences.includes("family"),
    indoor_outdoor: /open air|markt|flohmarkt|fest/i.test(combinedText) ? "outdoor" : null,
    local_rank: null,
    importance_score: null,
    popularity_score: null,
    tags: Array.from(
      new Set(
        [item.venueName, item.venueAddress, item.sectionKey, "nuernberg_tourism"].filter(
          (value): value is string => Boolean(normalizeText(value))
        )
      )
    ),
    subtypes: subtypesForCategory(category, combinedText),
    audiences,
    occasions,
    source_payload: item.sourcePayload,
    source_updated_at: null,
    last_seen_at: new Date().toISOString(),
  };
}
