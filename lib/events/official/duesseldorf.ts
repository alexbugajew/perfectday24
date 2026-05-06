import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type DuesseldorfTourismCard = {
  ident: string;
  sourceUrl: string;
  title: string;
  categoryLabel: string | null;
  dateText: string | null;
  timeText: string | null;
  locationText: string | null;
  venueText: string | null;
};

type DuesseldorfTourismDetail = {
  summary: string | null;
  ticketUrl: string | null;
  websiteUrl: string | null;
  venueName: string | null;
  venueAddress: string | null;
  lat: number | null;
  lng: number | null;
  keywords: string[];
  firstDate: string | null;
  firstStartTime: string | null;
  firstEndTime: string | null;
  matchingDate: {
    date: string | null;
    startTime: string | null;
    endTime: string | null;
  } | null;
};

type DuesseldorfTourismEventPayload = {
  name?: string;
  description?: string;
  bookingUrl?: string;
  booking?: { url?: string | null } | null;
  category?: {
    name?: string;
    rootlineNames?: string[];
  } | null;
  geocoordinates?: {
    latitude?: number;
    longitude?: number;
  } | null;
  location?: {
    name?: string;
    geocoordinates?: {
      latitude?: number;
      longitude?: number;
    } | null;
    address?: {
      street?: string;
      streetNumber?: string;
      zip?: string;
      city?: string;
    } | null;
    primaryCategory?: {
      name?: string;
      rootlineNames?: string[];
    } | null;
  } | null;
  contactInformation?: {
    website?: string;
  } | null;
  webMediaLinks?: Array<{ url?: string }>;
  datesCache?: Array<{
    date?: string;
    startAt?: string;
    endAt?: string;
    bookingUrl?: string;
  }>;
};

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
  if (!normalized) return null;
  try {
    return new URL(normalized, baseUrl).toString();
  } catch {
    return normalized;
  }
}

function buildListUrls(baseUrl: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const urls = [normalizedBase];

  if (!/\/calendar-of-events$/i.test(normalizedBase)) {
    urls.push(`${normalizedBase}/calendar-of-events`);
  }

  return Array.from(new Set(urls));
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`[duesseldorf_tourism] HTTP ${response.status} fuer ${url}`);
  }

  return response.text();
}

function parseCardBlocks(html: string, baseUrl: string) {
  const cards: DuesseldorfTourismCard[] = [];
  const parts = html.split('<a class="tb-teaser tb-teaser--stacked" href="').slice(1);

  for (const part of parts) {
    const hrefPath = normalizeText(part.match(/^([^"]+)"/)?.[1] ?? "");
    const block = part.split("</a>")[0] ?? "";
    if (!hrefPath || !/\/en\/calendar-of-events\//i.test(hrefPath) || !block) continue;

    const ident =
      normalizeText(block.match(/data-clipboard-identifier="event:([^"]+)"/i)?.[1] ?? "") ||
      hrefPath.split("/").filter(Boolean).pop() ||
      hrefPath;
    const title = stripTags(block.match(/<h3 class="tb-teaser__title"[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? "");
    const categoryLabel =
      stripTags(block.match(/<span class="tb-teaser__topline-category">([\s\S]*?)<\/span>/i)?.[1] ?? "") ||
      null;
    const dayMonth = stripTags(block.match(/<span class="tb-teaser-date__month[^"]*">([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const year = stripTags(block.match(/<span class="tb-teaser-date__year">([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const dateText = dayMonth && year ? `${dayMonth}${year}` : null;
    const locationParts = Array.from(
      block.matchAll(/<span class="tb-teaser__location">([\s\S]*?)<\/span>/gi)
    )
      .map((match) => stripTags(match[1]))
      .filter(Boolean);
    const locationText =
      locationParts.length > 0 ? locationParts.join(" • ") : null;
    const venueText = locationParts.length > 1 ? locationParts[locationParts.length - 1] : null;
    const timeText =
      stripTags(block.match(/<div class="mt-2\s*">([\s\S]*?)<\/div>/i)?.[1] ?? "") || null;

    if (!ident || !title) continue;

    cards.push({
      ident,
      sourceUrl: normalizeAbsoluteUrl(hrefPath, baseUrl) ?? hrefPath,
      title,
      categoryLabel,
      dateText,
      timeText,
      locationText,
      venueText,
    });
  }

  return cards;
}

function parseMetaContent(html: string, name: string) {
  return (
    decodeHtml(
      html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ??
        ""
    ) || null
  );
}

function parseEventPayload(html: string) {
  const encoded = html.match(/<tb-w-event-detail :event="([^"]+)"/i)?.[1] ?? "";
  if (!encoded) return null;

  try {
    return JSON.parse(decodeHtml(encoded)) as DuesseldorfTourismEventPayload;
  } catch {
    return null;
  }
}

function parseDateFromText(dateText: string | null) {
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
  const normalizedTime = normalizeText(timeValue) || "00:00:00";
  const time = normalizedTime.length === 5 ? `${normalizedTime}:00` : normalizedTime;
  return `${normalizedDate}T${time}+02:00`;
}

function categoryFromText(text: string): OfficialCityEvent["category"] {
  const normalized = text.toLowerCase();
  if (/\b(?:weekly market|flea market|market|wochenmarkt|flohmarkt|bazaar|street food market)\b/.test(normalized)) {
    return "market";
  }
  if (/\b(?:music festival|festival|festivals|japan day|funfair|fest)\b/.test(normalized)) {
    return "festival";
  }
  if (/(painting exhibition|art exhibition|exhibition|fair|expo|museum)/.test(normalized)) {
    return "fair";
  }
  if (/(food|culinary|wine|tasting|brunch|dinner)/.test(normalized)) {
    return "food_event";
  }
  if (/\b(?:hip hop concert|metal concert|classical concert|rock ?& ?pop concert|concerts|concert|live music|orchestra|philharmonic|jazz)\b/.test(normalized)) {
    return "concert";
  }
  if (/\b(?:theater|theatre|opera|schauspiel|buehne|stage play)\b/.test(normalized)) {
    return "theater";
  }
  if (/\b(?:circus|show|musical|comedy|performance|kabarett|cabaret)\b/.test(normalized)) {
    return "show";
  }
  if (/(christmas|advent|easter|spring|summer|winter|seasonal)/.test(normalized)) {
    return "seasonal";
  }
  if (/(sport|sports|guided tour|tour|walk|workshop|community|talk|lecture|meetup)/.test(normalized)) {
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
  return normalized;
}

function subtypesForCard(
  card: DuesseldorfTourismCard,
  detail: DuesseldorfTourismDetail,
  category: OfficialCityEvent["category"]
) {
  const text = `${card.title} ${card.categoryLabel ?? ""} ${card.locationText ?? ""} ${detail.keywords.join(" ")}`.toLowerCase();
  const subtypes = [
    "concrete_event_page",
    category,
    /weekly market/.test(text) ? "weekly_market" : null,
    /flea market/.test(text) ? "market_event" : null,
    /festival|music festival|japan day/.test(text) ? "festival_event" : null,
    /exhibition|museum/.test(text) ? "exhibition" : null,
    /sport|sports/.test(text) ? "sports_event" : null,
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(subtypes));
}

async function fetchDuesseldorfTourismDetail(
  card: DuesseldorfTourismCard
): Promise<DuesseldorfTourismDetail> {
  const html = await fetchHtml(card.sourceUrl);
  const payload = parseEventPayload(html);
  const summary =
    stripTags(String(payload?.description ?? "")) || stripTags(parseMetaContent(html, "description") ?? "") || null;
  const bookingUrl =
    normalizeAbsoluteUrl(
      payload?.bookingUrl ??
        payload?.booking?.url ??
        payload?.datesCache?.find((entry) => normalizeText(entry.bookingUrl))?.bookingUrl ??
        null,
      card.sourceUrl
    ) ?? null;
  const websiteUrl =
    normalizeAbsoluteUrl(
      payload?.contactInformation?.website ??
        payload?.webMediaLinks?.find((entry) => normalizeText(entry.url))?.url ??
        null,
      card.sourceUrl
    ) ?? null;
  const location = payload?.location ?? null;
  const address = location?.address ?? null;
  const venueName = cleanVenueName(location?.name ?? card.venueText, card.title);
  const street = [normalizeText(address?.street), normalizeText(address?.streetNumber)]
    .filter(Boolean)
    .join(" ");
  const venueAddress = [
    street,
    [normalizeText(address?.zip), normalizeText(address?.city)].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const lat =
    typeof location?.geocoordinates?.latitude === "number"
      ? location.geocoordinates.latitude
      : typeof payload?.geocoordinates?.latitude === "number"
        ? payload.geocoordinates.latitude
        : null;
  const lng =
    typeof location?.geocoordinates?.longitude === "number"
      ? location.geocoordinates.longitude
      : typeof payload?.geocoordinates?.longitude === "number"
        ? payload.geocoordinates.longitude
        : null;

  const teaserDate = parseDateFromText(card.dateText);
  const matchingDateEntry =
    payload?.datesCache?.find((entry) => normalizeText(entry.date) === teaserDate) ?? null;
  const firstDateEntry = payload?.datesCache?.[0] ?? null;
  const keywords = Array.from(
    new Set(
      [
        payload?.category?.name,
        ...(payload?.category?.rootlineNames ?? []),
        location?.primaryCategory?.name,
        ...(location?.primaryCategory?.rootlineNames ?? []),
      ]
        .map((value) => normalizeText(value))
        .filter(Boolean)
    )
  );

  return {
    summary,
    ticketUrl: bookingUrl,
    websiteUrl,
    venueName,
    venueAddress: venueAddress || null,
    lat,
    lng,
    keywords,
    firstDate: normalizeText(firstDateEntry?.date) || null,
    firstStartTime: normalizeText(firstDateEntry?.startAt) || null,
    firstEndTime: normalizeText(firstDateEntry?.endAt) || null,
    matchingDate: matchingDateEntry
      ? {
          date: normalizeText(matchingDateEntry.date) || null,
          startTime: normalizeText(matchingDateEntry.startAt) || null,
          endTime: normalizeText(matchingDateEntry.endAt) || null,
        }
      : null,
  };
}

async function enrichDuesseldorfTourismCards(cards: DuesseldorfTourismCard[]) {
  const enriched: Array<{ card: DuesseldorfTourismCard; detail: DuesseldorfTourismDetail }> = [];

  for (let index = 0; index < cards.length; index += DETAIL_CHUNK_SIZE) {
    const chunk = cards.slice(index, index + DETAIL_CHUNK_SIZE);
    const details = await Promise.all(
      chunk.map(async (card) => ({
        card,
        detail: await fetchDuesseldorfTourismDetail(card),
      }))
    );
    enriched.push(...details);
  }

  return enriched;
}

export async function fetchDuesseldorfTourismEvents(config: EventSourceConfigRow) {
  const seenIds = new Set<string>();
  const cards: DuesseldorfTourismCard[] = [];

  for (const url of buildListUrls(config.base_url)) {
    const html = await fetchHtml(url);
    const pageCards = parseCardBlocks(html, config.base_url).filter((card) => !seenIds.has(card.ident));

    for (const card of pageCards) {
      seenIds.add(card.ident);
      cards.push(card);
    }
  }

  return enrichDuesseldorfTourismCards(cards);
}

export function normalizeDuesseldorfTourismEvent(
  card: DuesseldorfTourismCard,
  detail: DuesseldorfTourismDetail,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const timeRange = parseTimeRange(card.timeText);
  const fallbackDate = detail.matchingDate?.date ?? parseDateFromText(card.dateText) ?? detail.firstDate;
  const startTime = timeRange.startTime ?? detail.matchingDate?.startTime ?? detail.firstStartTime;
  const endTime = timeRange.endTime ?? detail.matchingDate?.endTime ?? detail.firstEndTime;
  const startAt = toBerlinIso(fallbackDate, startTime);
  if (!startAt) return null;

  const endAt = endTime ? toBerlinIso(fallbackDate, endTime) : null;
  const combinedText = [
    card.title,
    card.categoryLabel,
    card.locationText,
    detail.summary,
    detail.keywords.join(" "),
  ]
    .filter(Boolean)
    .join(" ");
  const category = categoryFromText(combinedText);
  if (category === "other") return null;

  const audiences = audiencesForCategory(category, combinedText);
  const occasions = occasionsForCategory(category);
  const venueName = cleanVenueName(detail.venueName ?? card.venueText, card.title);
  const venueAddress = detail.venueAddress ?? (normalizeText(card.locationText) || null);
  const ticketUrl = detail.ticketUrl ?? detail.websiteUrl;

  return {
    source: config.provider,
    external_id: card.ident,
    source_url: card.sourceUrl,
    ticket_url: ticketUrl,
    title: card.title,
    summary: detail.summary,
    category,
    kind: kindForCategory(category),
    status: "scheduled",
    venue_name: venueName,
    venue_address: venueAddress,
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: detail.lat,
    lng: detail.lng,
    timezone: "Europe/Berlin",
    start_at: startAt,
    end_at: endAt,
    doors_at: null,
    all_day: timeRange.allDay && !startTime,
    is_ticketed: Boolean(ticketUrl),
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
        [card.categoryLabel, card.locationText, venueName, venueAddress, ...detail.keywords, "duesseldorf_tourism"]
          .filter((value): value is string => Boolean(normalizeText(value)))
      )
    ),
    subtypes: subtypesForCard(card, detail, category),
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
