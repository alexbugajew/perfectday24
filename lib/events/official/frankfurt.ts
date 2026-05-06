import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type FrankfurtTourismCard = {
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

type FrankfurtTourismDetail = {
  summary: string | null;
  ticketUrl: string | null;
  venueName: string | null;
  venueAddress: string | null;
  lat: number | null;
  lng: number | null;
  keywords: string[];
};

const MAX_PAGES = 10;
const PAGE_SIZE = 12;

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
    throw new Error(`[frankfurt_tourism] HTTP ${response.status} fuer ${url}`);
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
  const cards: FrankfurtTourismCard[] = [];

  const parts = html.split('<div class="teaser-card result-item" data-globalid="').slice(1);

  for (const part of parts) {
    const ident = normalizeText(part.match(/^(e_[^"]+)"/i)?.[1] ?? "");
    const block = part.slice(0, 8000);
    if (!ident || !block) continue;

    const href =
      block.match(/<a href="([^"]+)" title="[^"]+" class="teaser-card__link">/i)?.[1] ?? null;
    const title =
      decodeHtml(
        block.match(/<a href="[^"]+" title="([^"]+)" class="teaser-card__link">/i)?.[1] ?? ""
      ) ||
      stripTags(block.match(/<span class="teaser-card__header">([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const dateText = stripTags(block.match(/<span class="teaser-card__subheader">([\s\S]*?)<\/span>/i)?.[1] ?? "") || null;
    const lineTexts = Array.from(
      block.matchAll(/<div class="teaser-line__text">([\s\S]*?)<\/div>/gi)
    ).map((line) => stripTags(line[1]));

    const timeText = lineTexts[0] ?? null;
    const infoLabel = lineTexts[1] ?? null;
    const locationText = lineTexts.find((value) => value.includes("Frankfurt")) ?? lineTexts[2] ?? null;
    const geo = geoLookup.get(ident) ?? { lat: null, lng: null };

    if (!title || !href) continue;

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
  const dateMatch = normalizedDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
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
      startAt: null,
      endAt: null,
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

function categoryFromText(text: string): OfficialCityEvent["category"] {
  const normalized = text.toLowerCase();
  const guidedWalkLike =
    /\b(?:guided walk|guided walking tour|guided tour|city walk|city tour|walking tour|stadtrundgang|stadtführung|tour)\b/.test(
      normalized
    );
  const immersiveShowLike =
    /\b(?:vr|virtual reality|augmented reality|ar|immersive|timeride)\b/.test(normalized);
  const exhibitionLike =
    /\b(?:exhibition|museum|gallery|installation|vernissage)\b/.test(normalized);

  if (/\b(?:weekly market|market|flea market|wochenmarkt|flohmarkt|christmas market|markt)\b/.test(normalized)) {
    return "market";
  }
  if (/\b(?:festival|spring dippemess|dippemess|open air|street festival|fest)\b/.test(normalized)) {
    return "festival";
  }
  if (/\b(?:food|culinary|wine|tasting|brunch|dinner|breakfast|market breakfast)\b/.test(normalized)) {
    return "food_event";
  }
  if (/\b(?:concert|konzert|live music|jazz|philharmonic|orchestra|band)\b/.test(normalized)) {
    return "concert";
  }
  if (/\b(?:theater|theatre|opera|schauspiel)\b/.test(normalized)) {
    return "theater";
  }
  if (exhibitionLike) {
    return "fair";
  }
  if (guidedWalkLike && !immersiveShowLike) {
    return "community";
  }
  if (
    immersiveShowLike ||
    /\b(?:show|musical|comedy|performance|cabaret|kabarett)\b/.test(normalized)
  ) {
    return "show";
  }
  if (/\b(?:fair|funfair|jahrmarkt)\b/.test(normalized)) {
    return "fair";
  }
  if (/\b(?:spring|summer|winter|autumn|seasonal|advent|easter)\b/.test(normalized)) {
    return "seasonal";
  }
  if (/\b(?:guided walk|guided tour|tour|community|workshop)\b/.test(normalized)) {
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

function subtypesForCard(card: FrankfurtTourismCard, category: OfficialCityEvent["category"]) {
  const text = `${card.title} ${card.infoLabel ?? ""} ${card.locationText ?? ""}`.toLowerCase();
  const subtypes = [
    "concrete_event_page",
    category,
    /guided walk|guided tour|tour/.test(text) ? "guided_tour" : null,
    /exhibition|museum/.test(text) ? "exhibition" : null,
    /weekly market/.test(text) ? "weekly_market" : null,
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(subtypes));
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

function cleanVenueName(value: string | null | undefined, title: string) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (normalized.toLowerCase() === normalizeText(title).toLowerCase()) return null;
  if (normalized === "," || normalized === ".") return null;
  return normalized;
}

function parseDetailJsonLd(html: string) {
  const script = Array.from(
    html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  )
    .map((match) => match[1])
    .find((value) => value.includes('"Event"') || value.includes('"@type":["Event"'));

  if (!script) return null;

  try {
    const parsed = JSON.parse(script) as Array<Record<string, unknown>> | Record<string, unknown>;
    const items = Array.isArray(parsed) ? parsed : [parsed];
    return items.find((item) => {
      const type = item["@type"];
      return Array.isArray(type) ? type.includes("Event") : type === "Event";
    }) as Record<string, unknown> | undefined;
  } catch {
    return null;
  }
}

async function fetchFrankfurtTourismDetail(sourceUrl: string): Promise<FrankfurtTourismDetail> {
  let html = "";
  try {
    html = await fetchHtml(sourceUrl);
  } catch {
    return {
      summary: null,
      ticketUrl: null,
      venueName: null,
      venueAddress: null,
      lat: null,
      lng: null,
      keywords: [],
    };
  }

  const event = parseDetailJsonLd(html);

  if (!event) {
    return {
      summary: null,
      ticketUrl: null,
      venueName: null,
      venueAddress: null,
      lat: null,
      lng: null,
      keywords: [],
    };
  }

  const description = stripTags(String(event.description ?? "")) || null;
  const keywords =
    typeof event.keywords === "string"
      ? event.keywords.split(",").map((value) => normalizeText(value)).filter(Boolean)
      : Array.isArray(event.keywords)
        ? event.keywords.map((value) => normalizeText(String(value))).filter(Boolean)
        : [];

  const offers = Array.isArray(event.offers)
    ? event.offers
    : event.offers
      ? [event.offers]
      : [];
  const ticketUrl =
    normalizeText(String((offers[0] as { url?: string } | undefined)?.url ?? "")) || null;

  const locations = Array.isArray(event.location)
    ? event.location
    : event.location
      ? [event.location]
      : [];
  const primaryLocation = (locations[0] as
    | {
        name?: string;
        address?: {
          streetAddress?: string;
          postalCode?: string;
          addressLocality?: string;
          addressCountry?: string;
        };
        geo?: { latitude?: number; longitude?: number };
      }
    | undefined) ?? null;

  const venueAddress = primaryLocation?.address
    ? [
        normalizeText(primaryLocation.address.streetAddress),
        normalizeText(primaryLocation.address.postalCode),
        normalizeText(primaryLocation.address.addressLocality),
      ]
        .filter(Boolean)
        .join(", ") || null
    : null;

  const lat =
    typeof primaryLocation?.geo?.latitude === "number" ? primaryLocation.geo.latitude : null;
  const lng =
    typeof primaryLocation?.geo?.longitude === "number" ? primaryLocation.geo.longitude : null;

  return {
    summary: description,
    ticketUrl,
    venueName: cleanVenueName(normalizeText(primaryLocation?.name), ""),
    venueAddress,
    lat,
    lng,
    keywords,
  };
}

async function enrichFrankfurtTourismCards(cards: FrankfurtTourismCard[]) {
  const enriched: Array<{ card: FrankfurtTourismCard; detail: FrankfurtTourismDetail }> = [];

  for (let index = 0; index < cards.length; index += 6) {
    const chunk = cards.slice(index, index + 6);
    const details = await Promise.all(
      chunk.map(async (card) => ({
        card,
        detail: await fetchFrankfurtTourismDetail(card.sourceUrl),
      }))
    );
    enriched.push(...details);
  }

  return enriched;
}

export async function fetchFrankfurtTourismEvents(config: EventSourceConfigRow) {
  const seenIds = new Set<string>();
  const cards: FrankfurtTourismCard[] = [];

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

  return enrichFrankfurtTourismCards(cards);
}

export function normalizeFrankfurtTourismEvent(
  item: FrankfurtTourismCard,
  detail: FrankfurtTourismDetail,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const timeRange = parseTimeRange(item.timeText);
  const startAt = toBerlinIso(item.dateText, timeRange.startTime ?? null);
  if (!startAt) return null;

  const endAt = timeRange.endTime ? toBerlinIso(item.dateText, timeRange.endTime) : null;
  const combinedText = [
    item.title,
    item.infoLabel,
    item.locationText,
    detail.summary,
    detail.keywords.join(" "),
  ]
    .filter(Boolean)
    .join(" ");

  const category = categoryFromText(combinedText);
  if (category === "other") return null;

  const venueName = cleanVenueName(detail.venueName, item.title);
  const venueAddress = detail.venueAddress ?? (normalizeText(item.locationText) || null);
  const audiences = audiencesForCategory(category, combinedText);
  const occasions = occasionsForCategory(category);

  return {
    source: config.provider,
    external_id: item.ident,
    source_url: item.sourceUrl,
    ticket_url: detail.ticketUrl,
    title: item.title,
    summary: detail.summary,
    category,
    kind: kindForCategory(category),
    status: "scheduled",
    venue_name: venueName,
    venue_address: venueAddress,
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: detail.lat ?? item.lat,
    lng: detail.lng ?? item.lng,
    timezone: "Europe/Berlin",
    start_at: startAt,
    end_at: endAt,
    doors_at: null,
    all_day: timeRange.allDay,
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
        [item.infoLabel, ...detail.keywords, venueAddress, "frankfurt_tourism"].filter(
          (value): value is string => Boolean(normalizeText(value))
        )
      )
    ),
    subtypes: subtypesForCard(item, category),
    audiences,
    occasions,
    source_payload: {
      card: item,
      detail,
    },
    source_updated_at: null,
    last_seen_at: new Date().toISOString(),
  };
}
