import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type HannoverCategoryCard = {
  categoryKey: string;
  categoryLabel: string;
  sourceUrl: string;
};

type HannoverJsonLdEvent = {
  "@context"?: string;
  "@type"?: string | string[];
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  url?: string;
  eventStatus?: string;
  eventSchedule?: {
    "@type"?: string;
    byDay?: string | string[];
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    repeatFrequency?: string;
    scheduleTimeZone?: string;
  };
  location?: {
    "@type"?: string;
    name?: string;
    address?: {
      "@type"?: string;
      streetAddress?: string;
      postalCode?: string;
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
};

type HannoverDetailOccurrence = {
  ident: string;
  sourceUrl: string;
  title: string;
  summary: string | null;
  categoryKey: string;
  categoryLabel: string;
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
    jsonLd: HannoverJsonLdEvent | null;
    detailPairs: Record<string, string>;
  };
};

const HANNOVER_CATEGORY_KEYS = new Set([
  "maerkte",
  "feste-festivals",
  "konzerte",
  "klassik",
  "buehnen",
  "nightlife",
  "kino-events",
  "lesungen-vortraege",
]);

const DETAIL_CHUNK_SIZE = 6;
const OCCURRENCE_LOOKAHEAD_DAYS = 180;

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
      accept: "text/html,application/xhtml+xml,application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`[hannover_tourism] HTTP ${response.status} fuer ${url}`);
  }

  return response.text();
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`[hannover_tourism] JSON HTTP ${response.status} fuer ${url}`);
  }

  return (await response.json()) as T;
}

function parseCategoryCards(html: string, baseUrl: string) {
  const cards: HannoverCategoryCard[] = [];
  const blocks = Array.from(
    html.matchAll(
      /<article class="article-single[\s\S]*?<a\s+href="([^"]+)"[\s\S]*?<h2 class="article-single__title">\s*([\s\S]*?)<\/h2>/gi
    )
  );

  for (const block of blocks) {
    const href = normalizeText(block[1]);
    const label = stripTags(block[2]);
    if (!href || !label || !href.startsWith("/Veranstaltungskalender/")) continue;

    const categoryKey = normalizeGermanKey(href.split("/").filter(Boolean).pop());
    if (!HANNOVER_CATEGORY_KEYS.has(categoryKey)) continue;

    cards.push({
      categoryKey,
      categoryLabel: label,
      sourceUrl: normalizeAbsoluteUrl(href, baseUrl) ?? href,
    });
  }

  return cards;
}

function parseDetailLinks(html: string, baseUrl: string) {
  const links = new Map<string, string>();
  const matches = Array.from(html.matchAll(/href="([^"]+)"/gi));

  for (const match of matches) {
    const href = normalizeText(match[1]);
    if (!href.startsWith("/Veranstaltungskalender/")) continue;
    const segments = href.split("/").filter(Boolean);
    if (segments.length < 3) continue;
    const absolute = normalizeAbsoluteUrl(href, baseUrl);
    if (!absolute) continue;
    links.set(absolute, absolute);
  }

  return Array.from(links.values());
}

function parseJsonLdUrl(html: string, sourceUrl: string) {
  const href =
    html.match(/<link[^>]+href="([^"]+\/api\/v1\/jsonld\/[^"]+)"[^>]+type="application\/ld\+json"/i)?.[1] ??
    html.match(/<link[^>]+type="application\/ld\+json"[^>]+href="([^"]+\/api\/v1\/jsonld\/[^"]+)"/i)?.[1] ??
    null;
  return normalizeAbsoluteUrl(href, sourceUrl);
}

function parseTitle(html: string) {
  const h1 = stripTags(
    html.match(/<h1 class="content-detail__title">\s*([\s\S]*?)<\/h1>/i)?.[1] ??
      html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ??
      ""
  );
  return h1.replace(/\|\s*Visit Hannover.*$/i, "").trim();
}

function parseSummary(html: string) {
  return (
    stripTags(html.match(/<meta name="description" content="([^"]*)"/i)?.[1] ?? "") ||
    stripTags(
      html.match(
        /<div class="content-detail__body[\s\S]*?<p>([\s\S]*?)<\/p>/i
      )?.[1] ?? ""
    ) ||
    null
  );
}

function parseDetailPairs(html: string) {
  const pairs: Record<string, string> = {};
  const rows = Array.from(
    html.matchAll(
      /<div class="detail-cell">\s*<p>\s*([\s\S]*?)\s*<\/p>\s*<\/div>\s*<div class="detail-cell">\s*([\s\S]*?)\s*<\/div>/gi
    )
  );

  for (const row of rows) {
    const label = normalizeGermanKey(stripTags(row[1]));
    const value = stripTags(row[2]);
    if (!label || !value) continue;
    pairs[label] = value;
  }

  return pairs;
}

function parseJsonLdEvent(input: unknown): HannoverJsonLdEvent | null {
  if (!input || typeof input !== "object") return null;
  const rawType = (input as Record<string, unknown>)["@type"];
  const types = Array.isArray(rawType) ? rawType.map(String) : rawType ? [String(rawType)] : [];
  if (types.some((type) => type.toLowerCase().includes("event"))) {
    return input as HannoverJsonLdEvent;
  }
  return null;
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function addressText(location: HannoverJsonLdEvent["location"]) {
  const street = normalizeText(location?.address?.streetAddress);
  const postal = normalizeText(location?.address?.postalCode);
  const city = normalizeText(location?.address?.addressLocality);
  return [street, [postal, city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null;
}

function parseDatePartsFromIso(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const datePart = normalized.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  const timePart = normalized.match(/T(\d{2}:\d{2})(?::\d{2})?/)?.[1] ?? null;
  const offset = normalized.match(/([+-]\d{2}:\d{2}|Z)$/)?.[1] ?? "+02:00";
  if (!datePart) return null;
  return { datePart, timePart, offset };
}

function buildIso(datePart: string, timePart: string | null, offset: string | null) {
  const time = timePart ?? "00:00";
  const tz = offset ?? "+02:00";
  return `${datePart}T${time}:00${tz}`;
}

function addDays(datePart: string, amount: number) {
  const base = new Date(`${datePart}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + amount);
  return base.toISOString().slice(0, 10);
}

function weekdayToIndex(value: string | null | undefined) {
  const normalized = normalizeGermanKey(value);
  const map: Record<string, number> = {
    mo: 1,
    mon: 1,
    monday: 1,
    di: 2,
    tue: 2,
    tuesday: 2,
    mi: 3,
    wed: 3,
    wednesday: 3,
    do: 4,
    thu: 4,
    thursday: 4,
    fr: 5,
    fri: 5,
    friday: 5,
    sa: 6,
    sat: 6,
    saturday: 6,
    so: 0,
    sun: 0,
    sunday: 0,
    montags: 1,
    dienstags: 2,
    mittwochs: 3,
    donnerstags: 4,
    freitags: 5,
    samstags: 6,
    sonntags: 0,
  };

  if (normalized in map) return map[normalized];
  return null;
}

function weekdayFromText(text: string) {
  const normalized = normalizeGermanKey(text);
  const candidates = [
    "montags",
    "dienstags",
    "mittwochs",
    "donnerstags",
    "freitags",
    "samstags",
    "sonntags",
  ];
  for (const candidate of candidates) {
    const index = weekdayToIndex(candidate);
    if (index != null && normalized.includes(candidate)) {
      return index;
    }
  }
  return null;
}

function collectWeeklyOccurrences(
  startDate: string,
  endDate: string,
  weekday: number,
  startTime: string | null,
  endTime: string | null,
  offset: string | null
) {
  const results: Array<{ startAt: string; endAt: string | null; allDay: boolean }> = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const limit = new Date(`${endDate}T23:59:59Z`);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + OCCURRENCE_LOOKAHEAD_DAYS);

  while (cursor <= limit && cursor <= horizon) {
    if (cursor.getUTCDay() === weekday) {
      const datePart = cursor.toISOString().slice(0, 10);
      results.push({
        startAt: buildIso(datePart, startTime, offset),
        endAt: endTime ? buildIso(datePart, endTime, offset) : null,
        allDay: !startTime,
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return results;
}

function parseTimeRange(text: string) {
  const normalized = normalizeText(text);
  if (!normalized) return { startTime: null, endTime: null, allDay: true };
  const range =
    normalized.match(/(\d{1,2}[:.]\d{2})\s*(?:bis|-)\s*(\d{1,2}[:.]\d{2})\s*uhr/i) ??
    normalized.match(/ab\s*(\d{1,2}[:.]\d{2})\s*bis\s*(\d{1,2}[:.]\d{2})\s*uhr/i);
  if (range) {
    return {
      startTime: range[1].replace(".", ":"),
      endTime: range[2].replace(".", ":"),
      allDay: false,
    };
  }

  const single = normalized.match(/ab\s*(\d{1,2}[:.]\d{2})\s*uhr/i);
  return {
    startTime: single?.[1]?.replace(".", ":") ?? null,
    endTime: null,
    allDay: !single,
  };
}

function parseTermsFallback(text: string) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const rangeWithWeekday = normalized.match(
    /(\d{1,2}\.\d{1,2}\.\d{4})\s+bis\s+(\d{1,2}\.\d{1,2}\.\d{4}).*?(montags|dienstags|mittwochs|donnerstags|freitags|samstags|sonntags)/i
  );
  const { startTime, endTime, allDay } = parseTimeRange(normalized);
  if (rangeWithWeekday) {
    const startDate = rangeWithWeekday[1].split(".").reverse().join("-");
    const endDate = rangeWithWeekday[2].split(".").reverse().join("-");
    const weekday = weekdayToIndex(rangeWithWeekday[3]);
    if (weekday != null) {
      return collectWeeklyOccurrences(startDate, endDate, weekday, startTime, endTime, "+02:00");
    }
  }

  const range = normalized.match(/(\d{1,2}\.\d{1,2}\.\d{4})\s+bis\s+(\d{1,2}\.\d{1,2}\.\d{4})/i);
  if (range) {
    const startDate = range[1].split(".").reverse().join("-");
    const endDate = range[2].split(".").reverse().join("-");
    return [
      {
        startAt: buildIso(startDate, startTime, "+02:00"),
        endAt: buildIso(endDate, endTime, "+02:00"),
        allDay,
      },
    ];
  }

  const singleDate = normalized.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
  if (singleDate) {
    const datePart = singleDate[1].split(".").reverse().join("-");
    return [
      {
        startAt: buildIso(datePart, startTime, "+02:00"),
        endAt: endTime ? buildIso(datePart, endTime, "+02:00") : null,
        allDay,
      },
    ];
  }

  return [];
}

function occurrencesFromJsonLd(event: HannoverJsonLdEvent) {
  const schedule = event.eventSchedule;
  if (schedule) {
    const startParts = parseDatePartsFromIso(schedule.startDate);
    const endParts = parseDatePartsFromIso(schedule.endDate);
    const byDays = Array.isArray(schedule.byDay) ? schedule.byDay : schedule.byDay ? [schedule.byDay] : [];
    const repeatFrequency = normalizeText(schedule.repeatFrequency);
    if (startParts && endParts && byDays.length > 0 && repeatFrequency === "P1W") {
      const weekday = weekdayToIndex(byDays[0]);
      if (weekday != null) {
        return collectWeeklyOccurrences(
          startParts.datePart,
          endParts.datePart,
          weekday,
          normalizeText(schedule.startTime) || startParts.timePart,
          normalizeText(schedule.endTime) || endParts.timePart,
          startParts.offset
        );
      }
    }

    if (startParts) {
      return [
        {
          startAt: buildIso(
            startParts.datePart,
            normalizeText(schedule.startTime) || startParts.timePart,
            startParts.offset
          ),
          endAt: endParts
            ? buildIso(endParts.datePart, normalizeText(schedule.endTime) || endParts.timePart, endParts.offset)
            : null,
          allDay: !(normalizeText(schedule.startTime) || startParts.timePart),
        },
      ];
    }
  }

  const startParts = parseDatePartsFromIso(event.startDate);
  const endParts = parseDatePartsFromIso(event.endDate);
  if (startParts) {
    return [
      {
        startAt: buildIso(startParts.datePart, startParts.timePart, startParts.offset),
        endAt: endParts ? buildIso(endParts.datePart, endParts.timePart, endParts.offset) : null,
        allDay: !startParts.timePart,
      },
    ];
  }

  return [];
}

function categoryFromText(categoryKey: string, text: string): OfficialCityEvent["category"] {
  const normalizedCategory = normalizeGermanKey(categoryKey);
  const normalized = normalizeGermanKey(text);

  if (normalizedCategory === "maerkte") return "market";
  if (normalizedCategory === "feste-festivals") return "festival";
  if (normalizedCategory === "konzerte" || normalizedCategory === "klassik") return "concert";
  if (normalizedCategory === "buehnen" && /(theater|oper|schauspiel|puppentheater|buehne)/.test(normalized)) {
    return "theater";
  }
  if (normalizedCategory === "nightlife" || normalizedCategory === "kino-events") return "show";
  if (normalizedCategory === "lesungen-vortraege") return "community";

  if (/(wochenmarkt|flohmarkt|\bmarkt\b|basar)/.test(normalized)) return "market";
  if (/(festival|fest|open air|maschseefest)/.test(normalized)) return "festival";
  if (/(konzert|concert|band|orchester|klassik|musik)/.test(normalized)) return "concert";
  if (/(theater|oper|schauspiel|puppentheater|buehne)/.test(normalized)) return "theater";
  if (/(show|musical|kabarett|comedy|nightlife|kino|film)/.test(normalized)) return "show";
  if (/(messe|kongress|ausstellung|expo|museum)/.test(normalized)) return "fair";
  if (/(wein|food|kulinar|tasting|brunch)/.test(normalized)) return "food_event";
  if (/(fuehrung|tour|lesung|vortrag|community|workshop)/.test(normalized)) return "community";
  if (/(weihnacht|ostern|silvester|neujahr|sommer|winter)/.test(normalized)) return "seasonal";
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
  if (/famil|kinder|jugend/.test(normalized)) return ["family", "tourism"];
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
        /flohmarkt|basar/.test(normalized) ? "market_event" : null,
        /festival|fest|open air/.test(normalized) ? "festival_event" : null,
        /fuehrung|tour|lesung|vortrag/.test(normalized) ? "guided_tour" : null,
        /kino|film/.test(normalized) ? "film_event" : null,
      ].filter((value): value is string => Boolean(value))
    )
  );
}

function normalizeStatus(status: string | null | undefined) {
  const normalized = normalizeText(status).toLowerCase();
  if (normalized.includes("cancelled")) return "cancelled" as const;
  if (normalized.includes("postponed")) return "postponed" as const;
  return "scheduled" as const;
}

async function fetchHannoverDetailOccurrences(
  sourceUrl: string,
  categoryKey: string,
  categoryLabel: string
) {
  const html = await fetchHtml(sourceUrl);
  const title = parseTitle(html);
  const summary = parseSummary(html);
  const detailPairs = parseDetailPairs(html);
  const detailText = Object.values(detailPairs).join(" ");
  const jsonLdUrl = parseJsonLdUrl(html, sourceUrl);
  const jsonLd = jsonLdUrl ? parseJsonLdEvent(await fetchJson<unknown>(jsonLdUrl)) : null;
  const occurrences =
    (jsonLd ? occurrencesFromJsonLd(jsonLd) : []).length > 0
      ? occurrencesFromJsonLd(jsonLd as HannoverJsonLdEvent)
      : parseTermsFallback(detailPairs.termine ?? detailPairs.termin ?? detailText);

  if (!title || occurrences.length === 0) return [];

  const venueName =
    normalizeText(jsonLd?.location?.name) ||
    detailPairs.ort ||
    detailPairs.veranstaltungsort ||
    null;
  const venueAddress =
    addressText(jsonLd?.location) ||
    detailPairs.adresse ||
    detailPairs.ort ||
    null;
  const lat =
    typeof jsonLd?.location?.geo?.latitude === "number" ? jsonLd.location.geo.latitude : null;
  const lng =
    typeof jsonLd?.location?.geo?.longitude === "number" ? jsonLd.location.geo.longitude : null;
  const ticketUrl = normalizeAbsoluteUrl(jsonLd?.url, sourceUrl);
  const identBase = sourceUrl.split("/").filter(Boolean).pop() ?? title;

  return occurrences.map((occurrence, index) => ({
    ident: `${identBase}:${occurrence.startAt}:${index}`,
    sourceUrl,
    title,
    summary,
    categoryKey,
    categoryLabel,
    venueName,
    venueAddress,
    lat,
    lng,
    ticketUrl,
    startAt: occurrence.startAt,
    endAt: occurrence.endAt,
    allDay: occurrence.allDay,
    detailText,
    sourcePayload: {
      jsonLd,
      detailPairs,
    },
  }));
}

export async function fetchHannoverTourismEvents(config: EventSourceConfigRow) {
  const rootHtml = await fetchHtml(config.base_url);
  const categories = parseCategoryCards(rootHtml, config.base_url);
  const detailUrls = new Map<string, { categoryKey: string; categoryLabel: string }>();

  for (const category of categories) {
    const html = await fetchHtml(category.sourceUrl);
    const links = parseDetailLinks(html, config.base_url);
    for (const link of links) {
      if (!detailUrls.has(link)) {
        detailUrls.set(link, {
          categoryKey: category.categoryKey,
          categoryLabel: category.categoryLabel,
        });
      }
    }
  }

  const results: HannoverDetailOccurrence[] = [];
  const detailEntries = Array.from(detailUrls.entries());
  for (let index = 0; index < detailEntries.length; index += DETAIL_CHUNK_SIZE) {
    const chunk = detailEntries.slice(index, index + DETAIL_CHUNK_SIZE);
    const details = await Promise.all(
      chunk.map(async ([sourceUrl, category]) => {
        try {
          return await fetchHannoverDetailOccurrences(sourceUrl, category.categoryKey, category.categoryLabel);
        } catch {
          return [];
        }
      })
    );
    results.push(...details.flat());
  }

  return results;
}

export function normalizeHannoverTourismEvent(
  item: HannoverDetailOccurrence,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const combinedText = [
    item.title,
    item.summary,
    item.categoryLabel,
    item.venueName,
    item.venueAddress,
    item.detailText,
  ]
    .filter(Boolean)
    .join(" ");
  const category = categoryFromText(item.categoryKey, combinedText);
  if (category === "other") return null;

  const audiences = audiencesForCategory(category, combinedText);
  const occasions = occasionsForCategory(category);

  return {
    source: config.provider,
    external_id: `hannover_tourism:${item.ident}`,
    source_url: item.sourceUrl,
    ticket_url: item.ticketUrl,
    title: item.title,
    summary: item.summary,
    category,
    kind: kindForCategory(category),
    status: normalizeStatus(
      typeof item.sourcePayload.jsonLd?.eventStatus === "string" ? item.sourcePayload.jsonLd.eventStatus : null
    ),
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
        [item.categoryLabel, item.venueName, item.venueAddress, "hannover_tourism"].filter(
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
