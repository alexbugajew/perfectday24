import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type BerlinDeRssItem = {
  guid: string;
  title: string;
  link: string | null;
  description: string | null;
  pubDate: string | null;
  imageUrl: string | null;
  teaserDateText?: string | null;
};

type BerlinDeDetail = {
  subtitleDate: string | null;
  beginDate: string | null;
  endDate: string | null;
  openingText: string | null;
  locationTitle: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  isFree: boolean | null;
  jsonLdStartDate: string | null;
  jsonLdEndDate: string | null;
  jsonLdStartTime: string | null;
  jsonLdEndTime: string | null;
};

function normalizeText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function normalizeLoose(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

function pad(value: string) {
  return value.padStart(2, "0");
}

function germanMonthNumber(label: string) {
  const normalized = label.toLowerCase();
  const months = new Map([
    ["januar", "01"],
    ["februar", "02"],
    ["maerz", "03"],
    ["marz", "03"],
    ["april", "04"],
    ["mai", "05"],
    ["juni", "06"],
    ["juli", "07"],
    ["august", "08"],
    ["september", "09"],
    ["oktober", "10"],
    ["november", "11"],
    ["dezember", "12"],
  ]);
  return months.get(normalized) ?? null;
}

function extractTimeParts(openingText?: string | null) {
  const timeMatch = (openingText ?? "").match(/(?:ab\s*)?(\d{1,2})(?::(\d{2}))?\s*Uhr/i);
  return {
    hours: timeMatch?.[1] ?? "00",
    minutes: timeMatch?.[2] ?? "00",
  };
}

function buildIsoDate(year: string, month: string, day: string, openingText?: string | null) {
  const { hours, minutes } = extractTimeParts(openingText);
  return `${year}-${month}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00+02:00`;
}

function buildIsoDateWithParts(year: string, month: string, day: string, hours?: string | null, minutes?: string | null) {
  return `${year}-${month}-${pad(day)}T${pad(hours ?? "00")}:${pad(minutes ?? "00")}:00+02:00`;
}

function parseIsoLikeDateRange(startDate: string | null, endDate: string | null, startTime?: string | null) {
  if (!startDate) return [];
  const start = startDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!start) return [];
  const timeMatch = (startTime ?? "").match(/(\d{1,2}):(\d{2})/);
  const hh = timeMatch?.[1] ?? "00";
  const mm = timeMatch?.[2] ?? "00";
  const startUtc = Date.UTC(Number(start[1]), Number(start[2]) - 1, Number(start[3]));

  if (!endDate) {
    return [buildIsoDateWithParts(start[1], start[2], start[3], hh, mm)];
  }

  const end = endDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!end) {
    return [buildIsoDateWithParts(start[1], start[2], start[3], hh, mm)];
  }
  const endUtc = Date.UTC(Number(end[1]), Number(end[2]) - 1, Number(end[3]));
  if (endUtc < startUtc) {
    return [buildIsoDateWithParts(start[1], start[2], start[3], hh, mm)];
  }

  const rows: string[] = [];
  for (let ts = startUtc; ts <= endUtc; ts += 24 * 60 * 60 * 1000) {
    const d = new Date(ts);
    rows.push(
      buildIsoDateWithParts(
        String(d.getUTCFullYear()),
        pad(String(d.getUTCMonth() + 1)),
        pad(String(d.getUTCDate())),
        hh,
        mm
      )
    );
  }
  return rows;
}

function parseGermanDateOccurrences(dateText: string | null, openingText?: string | null) {
  if (!dateText) return [];
  const normalized = decodeHtml(dateText).replace(/\u00a0/g, " ");

  const rangeSameMonth = normalized.match(
    /(\d{1,2})\.\s*(?:bis|-)\s*(\d{1,2})\.\s*([A-Za-z]+)\s*(\d{4})/i
  );
  if (rangeSameMonth) {
    const [, startDay, endDay, monthLabel, year] = rangeSameMonth;
    const month = germanMonthNumber(monthLabel);
    if (!month) return [];
    const start = Number(startDay);
    const end = Number(endDay);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
    return Array.from({ length: end - start + 1 }, (_, index) =>
      buildIsoDate(year, month, String(start + index), openingText)
    );
  }

  const single = normalized.match(/(\d{1,2})\.\s*([A-Za-z]+)\s*(\d{4})/i);
  if (!single) return [];
  const [, day, monthLabel, year] = single;
  const month = germanMonthNumber(monthLabel);
  if (!month) return [];
  return [buildIsoDate(year, month, day, openingText)];
}

function categoryFromText(text: string): OfficialCityEvent["category"] {
  const normalized = text.toLowerCase();
  if (/(weihnacht|oster|advent|markt|staudenmarkt|flohmarkt)/.test(normalized)) return "market";
  if (/(festival|open-air|open air|fest|karneval|kunsthandwerk)/.test(normalized)) return "festival";
  if (/(food|kulinar|genuss|street food)/.test(normalized)) return "food_event";
  if (/(konzert|concert|band|orchester|jazz|live)/.test(normalized)) return "concert";
  if (/(theater|theatre|oper|schauspiel|ballett)/.test(normalized)) return "theater";
  if (/(show|musical|comedy|kabarett|performance)/.test(normalized)) return "show";
  if (/(kirmes|jahrmarkt|rummel)/.test(normalized)) return "fair";
  if (/(winter|fruehling|sommer|herbst|saisonal)/.test(normalized)) return "seasonal";
  if (/(familie|kinder|garten|community|tag|nacht)/.test(normalized)) return "community";
  return "other";
}

function kindForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") {
    return "anchored_event" as const;
  }
  return "flex_event" as const;
}

function isBerlinDeEventDetailUrl(url: string | null) {
  if (!url) return false;
  return /\.html?(?:[?#]|$)/i.test(url) && /\/\d{5,}[-/]/.test(url);
}

function isBerlinDeEditorialUrl(url: string | null) {
  if (!url) return false;
  if (isBerlinDeEventDetailUrl(url)) return false;
  return (
    /\/jahresuebersicht\//i.test(url) ||
    /\/kultur-und-tickets\/tipps\/[^/]+\/?$/i.test(url) ||
    /\/kino\/freiluftkinos\/?$/i.test(url) ||
    /\/restaurants\/street-food-markets\/?$/i.test(url) ||
    /\/events\/?$/i.test(url) ||
    /\/$/.test(url)
  );
}

function isBerlinDeSummaryLikeTitle(item: BerlinDeRssItem) {
  const title = normalizeLoose(item.title);
  return (
    /^event highlights\b/.test(title) ||
    /^fruhling in berlin\b/.test(title) ||
    /^ostern in berlin\b/.test(title) ||
    /^kirschbluten in berlin\b/.test(title) ||
    /^freiluftkinos in berlin\b/.test(title) ||
    /^veranstaltungen zum weltfrauentag\b/.test(title) ||
    /^der 1 mai in berlin\b/.test(title) ||
    /^street food markets\b/.test(title) ||
    /^biergarten\b/.test(title) ||
    /^biergaerten\b/.test(title) ||
    /^sommerbad\b/.test(title)
  );
}

function hasBerlinDeSpecificSchedule(item: BerlinDeRssItem, detail: BerlinDeDetail | null) {
  return (
    parseGermanDateOccurrences(detail?.beginDate ?? detail?.subtitleDate ?? null, detail?.openingText).length > 0 ||
    parseIsoLikeDateRange(
      detail?.jsonLdStartDate ?? null,
      detail?.jsonLdEndDate ?? null,
      detail?.jsonLdStartTime ?? detail?.openingText ?? null
    ).length > 0 ||
    parseGermanDateOccurrences(item.teaserDateText ?? null, detail?.openingText).length > 0
  );
}

function hasBerlinDeSpecificVenue(detail: BerlinDeDetail | null) {
  const hasCoordinates =
    typeof detail?.lat === "number" &&
    typeof detail?.lng === "number" &&
    Number.isFinite(detail.lat) &&
    Number.isFinite(detail.lng) &&
    !(detail.lat === 0 && detail.lng === 0);

  return Boolean(detail?.locationTitle || detail?.address || hasCoordinates);
}

function isBerlinDeConcreteEvent(item: BerlinDeRssItem, detail: BerlinDeDetail | null) {
  if (!item.link) return false;
  if (isBerlinDeSummaryLikeTitle(item) || isBerlinDeEditorialUrl(item.link)) return false;

  const hasSchedule = hasBerlinDeSpecificSchedule(item, detail);
  const hasVenue = hasBerlinDeSpecificVenue(detail);

  if (isBerlinDeEventDetailUrl(item.link)) {
    return hasSchedule || hasVenue;
  }

  return hasSchedule && hasVenue;
}

function isBerlinDeEditorialSummary(item: BerlinDeRssItem, detail: BerlinDeDetail | null) {
  if (isBerlinDeConcreteEvent(item, detail)) return false;
  return isBerlinDeSummaryLikeTitle(item) || isBerlinDeEditorialUrl(item.link);
}

export async function fetchBerlinDeEvents(config: EventSourceConfigRow) {
  const response = await fetch(config.base_url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "application/rss+xml,application/xml,text/xml,text/plain",
    },
  });

  if (!response.ok) {
    throw new Error(`[berlin_de] HTTP ${response.status} fuer ${config.base_url}`);
  }

  const body = await response.text();

  if (/<rss[\s>]/i.test(body) || /<channel>/i.test(body)) {
    const itemMatches = Array.from(body.matchAll(/<item>([\s\S]*?)<\/item>/gi));

    return itemMatches
      .map((match) => {
        const block = match[1];
        const link = normalizeText(block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "") || null;
        const guid =
          normalizeText(block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1] ?? "") ||
          normalizeText(link ?? "");
        const title = stripTags(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
        const description = stripTags(block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "") || null;
        const pubDate = normalizeText(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "") || null;
        const imageUrl = normalizeText(block.match(/<media:content[^>]*url="([^"]+)"/i)?.[1] ?? "") || null;

        return {
          guid,
          title,
          link,
          description,
          pubDate,
          imageUrl,
          teaserDateText: null,
        } satisfies BerlinDeRssItem;
      })
      .filter((item) => item.guid && item.title && item.link);
  }

  const articleMatches = Array.from(body.matchAll(/<article[^>]*class="[^"]*modul-teaser[^"]*"[\s\S]*?<\/article>/gi));
  return articleMatches
    .map((match) => {
      const block = match[0];
      const href = normalizeText(block.match(/<h3 class="title"><a href="([^"]+)"/i)?.[1] ?? "") || null;
      const title = stripTags(block.match(/<h3 class="title">[\s\S]*?<a [^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "");
      const description = stripTags(block.match(/<div class="inner"><p class="text">([\s\S]*?)<a /i)?.[1] ?? "") || null;
      const teaserDateText = stripTags(block.match(/<p class="teaser__meta[^"]*">([\s\S]*?)<\/p>/i)?.[1] ?? "") || null;
      const imageUrl = normalizeText(block.match(/<img src="([^"]+)"/i)?.[1] ?? "") || null;
      const absoluteLink =
        href && href.startsWith("http") ? href : href ? `https://www.berlin.de${href}` : null;
      const guid = absoluteLink ?? `${config.base_url}:${title}`;

      return {
        guid,
        title,
        link: absoluteLink,
        description,
        pubDate: null,
        imageUrl,
        teaserDateText,
      } satisfies BerlinDeRssItem;
    })
    .filter((item) => item.guid && item.title && item.link);
}

async function fetchBerlinDeEventDetail(url: string): Promise<BerlinDeDetail> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`[berlin_de] HTTP ${response.status} fuer ${url}`);
  }

  const html = await response.text();
  const subtitleDate =
    stripTags(html.match(/<p class="article__meta[^"]*article__subtitle">([\s\S]*?)<\/p>/i)?.[1] ?? "") || null;
  const locationTitle =
    stripTags(html.match(/<div class="detailpage-map[\s\S]*?<h3 class="title">([\s\S]*?)<\/h3>/i)?.[1] ?? "") || null;
  const latValue = Number(
    html.match(/data-marker-lat="([^"]+)"/i)?.[1] ??
      html.match(/meta name="ICBM" content="([^,]+),/i)?.[1] ??
      ""
  );
  const lngValue = Number(
    html.match(/data-marker-long="([^"]+)"/i)?.[1] ??
      html.match(/meta name="ICBM" content="[^,]+,\s*([^"]+)"/i)?.[1] ??
      ""
  );
  const addressStreet = stripTags(html.match(/<div class="street-address">([\s\S]*?)<\/div>/i)?.[1] ?? "");
  const postalCode = stripTags(html.match(/<span class="postal-code">([\s\S]*?)<\/span>/i)?.[1] ?? "");
  const locality = stripTags(html.match(/<span class="locality">([\s\S]*?)<\/span>/i)?.[1] ?? "");
  const infoPairs = Array.from(html.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/gi)).map((match) => ({
    key: stripTags(match[1]).toLowerCase(),
    value: stripTags(match[2]),
  }));
  const beginDate = infoPairs.find((entry) => /beginn/.test(entry.key))?.value ?? null;
  const endDate = infoPairs.find((entry) => /ende/.test(entry.key))?.value ?? null;
  const openingText = infoPairs.find((entry) => /oeffnungszeiten|offnungszeiten/.test(entry.key))?.value ?? null;
  const priceText = infoPairs.find((entry) => /eintritt/.test(entry.key))?.value ?? null;
  const jsonLdBlock = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i)?.[1] ?? null;
  let jsonLdStartDate: string | null = null;
  let jsonLdEndDate: string | null = null;
  let jsonLdStartTime: string | null = null;
  let jsonLdEndTime: string | null = null;
  if (jsonLdBlock) {
    const startDate = jsonLdBlock.match(/"startDate":"([^"]+)"/i)?.[1] ?? null;
    const endDateValue = jsonLdBlock.match(/"endDate":"([^"]+)"/i)?.[1] ?? null;
    const startTime = jsonLdBlock.match(/"startTime":"([^"]+)"/i)?.[1] ?? null;
    const endTime = jsonLdBlock.match(/"endTime":"([^"]+)"/i)?.[1] ?? null;
    jsonLdStartDate = startDate;
    jsonLdEndDate = endDateValue;
    jsonLdStartTime = startTime;
    jsonLdEndTime = endTime;
  }

  const normalizedLat = Number.isFinite(latValue) && !(latValue === 0 && lngValue === 0) ? latValue : null;
  const normalizedLng = Number.isFinite(lngValue) && !(latValue === 0 && lngValue === 0) ? lngValue : null;

  return {
    subtitleDate,
    beginDate,
    endDate,
    openingText,
    locationTitle,
    address: [addressStreet, postalCode, locality].filter(Boolean).join(", ") || null,
    lat: normalizedLat,
    lng: normalizedLng,
    isFree: priceText ? /kostenlos|frei/i.test(priceText) : null,
    jsonLdStartDate,
    jsonLdEndDate,
    jsonLdStartTime,
    jsonLdEndTime,
  };
}

export function normalizeBerlinDeEvent(
  item: BerlinDeRssItem,
  detail: BerlinDeDetail | null,
  config: EventSourceConfigRow
): OfficialCityEvent[] {
  if (!item.guid || !item.title || !item.link) return [];

  const textForCategory = [item.title, item.description ?? ""].join(" ");
  const category = categoryFromText(textForCategory);
  const kind = kindForCategory(category);
  const derivedStarts =
    parseGermanDateOccurrences(detail?.beginDate ?? detail?.subtitleDate ?? null, detail?.openingText) ??
    [];
  const jsonLdStarts = parseIsoLikeDateRange(
    detail?.jsonLdStartDate ?? null,
    detail?.jsonLdEndDate ?? null,
    detail?.jsonLdStartTime ?? detail?.openingText ?? null
  );
  const starts =
    derivedStarts.length > 0
      ? derivedStarts
      : jsonLdStarts.length > 0
        ? jsonLdStarts
        : parseGermanDateOccurrences(item.teaserDateText ?? null, detail?.openingText).length > 0
          ? parseGermanDateOccurrences(item.teaserDateText ?? null, detail?.openingText)
          : [item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()];
  const familyFriendly = /(familie|kinder|kids)/i.test(textForCategory) ? true : null;
  const venueName =
    normalizeText(detail?.locationTitle) || normalizeText(detail?.address) || "Berlin.de Kultur & Tickets";
  const isConcrete = isBerlinDeConcreteEvent(item, detail);
  const isEditorial = isBerlinDeEditorialSummary(item, detail);
  const importanceScore = isConcrete ? 64 : isEditorial ? 22 : 46;
  const popularityScore = isConcrete ? 42 : isEditorial ? 14 : 28;

  return starts.map((derivedStartAt, index) => ({
    source: "berlin_de",
    external_id: `berlin_de:${item.guid}:${derivedStartAt}:${index}`,
    source_url: item.link,
    ticket_url: item.link,
    title: normalizeText(item.title),
    summary: normalizeText(item.description) || null,
    category,
    kind,
    status: "scheduled",
    venue_name: venueName,
    venue_address: detail?.address ?? null,
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: detail?.lat ?? null,
    lng: detail?.lng ?? null,
    timezone: "Europe/Berlin",
    start_at: derivedStartAt,
    end_at: null,
    doors_at: null,
    all_day: !detail?.openingText,
    is_ticketed: detail?.isFree === true ? false : /(ticket|tickets|musical|show|theater|konzert)/i.test(textForCategory),
    price_min: null,
    price_max: null,
    currency: null,
    family_friendly: familyFriendly,
    indoor_outdoor:
      /(open air|garten|park|markt|festival)/i.test(textForCategory)
        ? "outdoor"
        : /(theater|show|oper|musical)/i.test(textForCategory)
          ? "indoor"
          : null,
    local_rank: null,
    importance_score: importanceScore,
    popularity_score: popularityScore,
    tags: Array.from(
      new Set(
        [
          category,
          "berlin.de",
          item.imageUrl ? "image" : "",
          venueName,
          isConcrete ? "concrete_event_page" : "",
          isEditorial ? "editorial_summary_page" : "",
        ]
          .filter((tag): tag is string => typeof tag === "string" && tag.length > 0)
          .map((tag) => tag.toLowerCase())
      )
    ),
    subtypes: [
      category,
      kind,
      ...(isConcrete ? ["concrete_event_page"] : []),
      ...(isEditorial ? ["editorial_summary_page"] : []),
    ],
    audiences: familyFriendly ? ["family"] : [],
    occasions:
      category === "concert" || category === "show"
        ? ["date", "friends", "party"]
        : category === "market" || category === "festival" || category === "food_event"
          ? ["friends", "family", "tourism"]
          : ["tourism", "friends"],
    source_payload: { item, detail },
    source_updated_at: null,
    last_seen_at: new Date().toISOString(),
  }));
}

export async function enrichBerlinDeEvents(items: BerlinDeRssItem[]) {
  const enriched = await Promise.all(
    items.map(async (item) => {
      if (!item.link) return { item, detail: null };
      try {
        const detail = await fetchBerlinDeEventDetail(item.link);
        return { item, detail };
      } catch {
        return { item, detail: null };
      }
    })
  );

  return enriched;
}
