import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type KoelnTourismCard = {
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

type KoelnTourismDetail = {
  summary: string | null;
  websiteUrl: string | null;
  venueName: string | null;
  venueAddress: string | null;
  lat: number | null;
  lng: number | null;
  keywords: string[];
};

const MAX_PAGES = 10;
const PAGE_SIZE = 20;

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
  return `${base}/All/offset:${pageIndex * PAGE_SIZE}/`;
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`[koeln_tourism] HTTP ${response.status} fuer ${url}`);
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
  const cards: KoelnTourismCard[] = [];
  const parts = html.split('<div class="teaser-card result-item" data-globalid="').slice(1);

  for (const part of parts) {
    const ident = normalizeText(part.match(/^([^"]+)"/)?.[1] ?? "");
    const block = part.slice(0, 8000);
    if (!ident || !block) continue;

    const href =
      block.match(/<a href="([^"]+)" title="[^"]+" class="teaser-card__link">/i)?.[1] ?? null;
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
    const locationText =
      lineTexts.find((value) => /k[oö]ln|koeln/i.test(value)) ?? lineTexts[2] ?? null;
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

function pad(value: string | number) {
  return String(value).padStart(2, "0");
}

function toBerlinIso(dateText: string | null, timeText: string | null) {
  const normalizedDate = normalizeText(dateText);
  if (!normalizedDate) return null;
  const dateMatch = normalizedDate.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!dateMatch) return null;
  const [, day, month, year] = dateMatch;
  const timeMatch = normalizeText(timeText).match(/(\d{1,2}):(\d{2})/);
  const hours = timeMatch?.[1] ?? "00";
  const minutes = timeMatch?.[2] ?? "00";
  return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00+02:00`;
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

function categoryFromText(text: string): OfficialCityEvent["category"] | "other" {
  const normalized = text.toLowerCase();
  if (/(timeride|time ride|nachtw[aä]chtertour|nachtwaechtertour)/.test(normalized)) {
    return "community";
  }
  if (/(konzert|concert|live music|jazz|orchester|band)/.test(normalized)) {
    return "concert";
  }
  if (/(theater|theatre|oper|schauspiel|b[üu]hne)/.test(normalized)) {
    return "theater";
  }
  if (/(show|musical|comedy|kabarett|performance|circus|circus)/.test(normalized)) {
    return "show";
  }
  if (/(ausstellung|messe|expo|museum)/.test(normalized)) {
    return "fair";
  }
  if (/\b(?:wochenmarkt|flohmarkt|ökomarkt|oekomarkt|weihnachtsmarkt|trödelmarkt|troedelmarkt|antikmarkt|street food market|market|markt)\b/.test(normalized)) {
    return "market";
  }
  if (/(festival|fest|kirmes|open air|karneval|street festival)/.test(normalized)) {
    return "festival";
  }
  if (/(food|kulinarik|wein|tasting|dinner|brunch)/.test(normalized)) {
    return "food_event";
  }
  if (/(schifffahrt|panoramafahrt|rundfahrt|fr[uü]hling|advent|winter|sommer)/.test(normalized)) {
    return "seasonal";
  }
  if (/(tour|mindwalk|f[üu]hrung|workshop|community|talk|lesung)/.test(normalized)) {
    return "community";
  }
  return "other";
}

function kindForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") {
    return "anchored_event" as const;
  }
  return "flex_event" as const;
}

function subtypesForCard(card: KoelnTourismCard, category: OfficialCityEvent["category"]) {
  const text = `${card.title} ${card.infoLabel ?? ""} ${card.locationText ?? ""}`.toLowerCase();
  const subtypes = [
    "concrete_event_page",
    category,
    /wochenmarkt/.test(text) ? "weekly_market" : null,
    /flohmarkt|tr[öo]del/.test(text) ? "market_event" : null,
    /festival|fest|kirmes/.test(text) ? "festival_event" : null,
    /tour|mindwalk|f[üu]hrung/.test(text) ? "guided_tour" : null,
    /ausstellung|museum/.test(text) ? "exhibition" : null,
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(subtypes));
}

function audiencesForCategory(category: OfficialCityEvent["category"], text: string) {
  const lower = text.toLowerCase();
  if (/familie|kinder|kids|family/.test(lower)) return ["family", "tourism"];
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

function cleanVenueName(value: string | null | undefined, title: string) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (normalized.toLowerCase() === normalizeText(title).toLowerCase()) return null;
  return normalized;
}

function parseMetaContent(html: string, name: string) {
  return (
    decodeHtml(
      html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ??
        ""
    ) || null
  );
}

function parseKeywords(html: string) {
  const keywords = parseMetaContent(html, "keywords");
  return keywords ? keywords.split(",").map((value) => normalizeText(value)).filter(Boolean) : [];
}

function parseMapCoordinates(html: string) {
  const match = html.match(/"coordinates":\[(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)\]/i);
  if (!match) return { lat: null, lng: null };
  const lng = Number(match[1]);
  const lat = Number(match[2]);
  return {
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

async function fetchKoelnTourismDetail(sourceUrl: string): Promise<KoelnTourismDetail> {
  const html = await fetchHtml(sourceUrl);
  const summary = parseMetaContent(html, "description");
  const keywords = parseKeywords(html);
  const websiteUrl =
    normalizeAbsoluteUrl(
      html.match(/<div class="address__paragraph"><a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<strong>Website<\/strong>/i)?.[1] ??
        null,
      sourceUrl
    ) || null;
  const venueName = cleanVenueName(
    stripTags(html.match(/<strong class="fn">([\s\S]*?)<\/strong>/i)?.[1] ?? ""),
    ""
  );
  const street = stripTags(html.match(/<span class="street-address">([\s\S]*?)<\/span>/i)?.[1] ?? "");
  const postalCode = stripTags(html.match(/<span class="postal-code">([\s\S]*?)<\/span>/i)?.[1] ?? "");
  const locality = stripTags(html.match(/<span class="locality">([\s\S]*?)<\/span>/i)?.[1] ?? "");
  const district =
    stripTags(
      html.match(/<span class="locality">[\s\S]*?<\/span><span>\s*-\s*([\s\S]*?)<\/span>/i)?.[1] ?? ""
    ) || null;
  const venueAddress = [street, [postalCode, locality].filter(Boolean).join(" "), district]
    .filter(Boolean)
    .join(", ");
  const geo = parseMapCoordinates(html);

  return {
    summary,
    websiteUrl,
    venueName,
    venueAddress: venueAddress || null,
    lat: geo.lat,
    lng: geo.lng,
    keywords,
  };
}

async function enrichKoelnTourismCards(cards: KoelnTourismCard[]) {
  const enriched: Array<{ card: KoelnTourismCard; detail: KoelnTourismDetail }> = [];

  for (let index = 0; index < cards.length; index += 6) {
    const chunk = cards.slice(index, index + 6);
    const details = await Promise.all(
      chunk.map(async (card) => ({
        card,
        detail: await fetchKoelnTourismDetail(card.sourceUrl),
      }))
    );
    enriched.push(...details);
  }

  return enriched;
}

export async function fetchKoelnTourismEvents(config: EventSourceConfigRow) {
  const seenIds = new Set<string>();
  const cards: KoelnTourismCard[] = [];

  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
    const url = buildPageUrl(config.base_url, pageIndex);
    const html = await fetchHtml(url);
    const pageCards = parseCardBlocks(html, config.base_url).filter((card) => !seenIds.has(card.ident));

    if (pageCards.length === 0) break;

    for (const card of pageCards) {
      seenIds.add(card.ident);
      cards.push(card);
    }
  }

  return enrichKoelnTourismCards(cards);
}

export function normalizeKoelnTourismEvent(
  card: KoelnTourismCard,
  detail: KoelnTourismDetail,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const timeRange = parseTimeRange(card.timeText);
  const startAt = toBerlinIso(card.dateText, timeRange.startTime);
  if (!startAt) return null;

  const endAt = timeRange.endTime ? toBerlinIso(card.dateText, timeRange.endTime) : null;
  const categoryText = [card.title, card.infoLabel, detail.summary, detail.keywords.join(" ")]
    .filter(Boolean)
    .join(" ");
  const combinedText = [categoryText, card.locationText].filter(Boolean).join(" ");
  const venueName = cleanVenueName(detail.venueName, card.title);
  const rawCategory = categoryFromText(categoryText);
  if (rawCategory === "other") return null;
  const routeLikeExperience =
    (rawCategory === "market" || rawCategory === "seasonal") &&
    /(timeride|time ride|nachtw[aä]chtertour|nachtwaechtertour)/.test(
      [card.title, detail.summary, venueName].filter(Boolean).join(" ").toLowerCase()
    );
  const scenicTourLikeExperience =
    rawCategory === "seasonal" &&
    /(schifffahrt|panoramafahrt|rundfahrt|skyline tour)/.test(
      [card.title, detail.summary, venueName].filter(Boolean).join(" ").toLowerCase()
    );
  const exhibitionLikeSeasonal =
    rawCategory === "seasonal" &&
    /(ausstellung|museum|kunst|gallery|installation|messe|expo)/.test(
      [card.title, card.infoLabel, detail.summary, detail.keywords.join(" "), venueName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
    );
  const category =
    routeLikeExperience || scenicTourLikeExperience
      ? "community"
      : exhibitionLikeSeasonal
        ? "fair"
        : rawCategory;
  const venueAddress = detail.venueAddress ?? (normalizeText(card.locationText) || null);
  const audiences = audiencesForCategory(category, combinedText);
  const occasions = occasionsForCategory(category);

  return {
    source: config.provider,
    external_id: card.ident,
    source_url: card.sourceUrl,
    ticket_url: detail.websiteUrl,
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
    all_day: timeRange.allDay,
    is_ticketed: Boolean(detail.websiteUrl),
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
        [card.infoLabel, ...detail.keywords, venueAddress, "koeln_tourism"].filter(
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
