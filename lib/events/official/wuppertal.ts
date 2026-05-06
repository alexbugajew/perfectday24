import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type WuppertalScheduling = {
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  label: string | null;
};

type WuppertalListingCard = {
  ident: string;
  sourceUrl: string;
  title: string;
  subtitle: string | null;
  pretitle: string | null;
  rubrik: string | null;
  genre: string | null;
  locationText: string | null;
  hasTickets: boolean;
  listingOccurrences: WuppertalScheduling[];
};

type WuppertalDetailEnrichment = {
  summary: string | null;
  venueName: string | null;
  venueAddress: string | null;
  venueWebsite: string | null;
  priceMin: number | null;
  priceMax: number | null;
  ticketNotes: string | null;
  lat: number | null;
  lng: number | null;
  sourceUpdatedAt: string | null;
};

type WuppertalSourceCard = WuppertalListingCard &
  WuppertalDetailEnrichment & {
    occurrence: WuppertalScheduling;
  };

const WUPPERTAL_ROOT_URL = "https://www.wuppertal-live.de";
const WUPPERTAL_INTRO_URL = `${WUPPERTAL_ROOT_URL}/intro/disp=1;titel=1;cal=wuppertal`;
const LOOKAHEAD_DAYS = 120;
const LISTING_BATCH_SIZE = 4;
const DETAIL_BATCH_SIZE = 6;

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
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-");
}

function stripTags(text: string | null | undefined) {
  return normalizeText(decodeHtml(String(text ?? "").replace(/<[^>]+>/g, " ")));
}

function toAbsoluteUrl(url: string | null | undefined, baseUrl = WUPPERTAL_ROOT_URL) {
  const normalized = normalizeText(decodeHtml(url ?? ""));
  if (!normalized) return null;
  try {
    return new URL(normalized, baseUrl).toString();
  } catch {
    return normalized;
  }
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml,application/xml",
    },
  });

  if (!response.ok) {
    throw new Error(`[wuppertal_live] HTTP ${response.status} fuer ${url}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const buffer = await response.arrayBuffer();
  const decoder = /charset=(iso-8859-1|latin1)/i.test(contentType)
    ? new TextDecoder("latin1")
    : new TextDecoder("utf-8");
  return decoder.decode(buffer);
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function parsePortalDate(dateValue: string) {
  const match = normalizeText(dateValue).match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function portalDateToIsoDay(dateValue: string) {
  const parsed = parsePortalDate(dateValue);
  if (!parsed) return null;
  return `${String(parsed.year).padStart(4, "0")}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;
}

function isWithinPlanningWindow(dateValue: string) {
  const parsed = parsePortalDate(dateValue);
  if (!parsed) return false;
  const eventDate = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0));
  const minDate = addDays(new Date(), -1);
  const maxDate = addDays(new Date(), LOOKAHEAD_DAYS);
  return eventDate >= minDate && eventDate <= maxDate;
}

function buildListingUrl(dateValue: string) {
  return `${WUPPERTAL_ROOT_URL}/events/mode=utf8;client=;what=date;show=${dateValue};shop=0;cal=wuppertal`;
}

function buildDetailUrl(ident: string) {
  return `${WUPPERTAL_ROOT_URL}/events/client=;mode=utf8;what=detail;show=${ident}`;
}

function parseAvailableDates(html: string) {
  const seen = new Set<string>();
  const dates: string[] = [];
  const matches = Array.from(html.matchAll(/<option value="(\d{4}\.\d{2}\.\d{2})">/g));
  for (const match of matches) {
    const value = match[1];
    if (seen.has(value) || !isWithinPlanningWindow(value)) continue;
    seen.add(value);
    dates.push(value);
  }
  return dates;
}

function parseTimeRange(beginText: string | null, endText: string | null) {
  const beginMatch = normalizeText(beginText).match(/(\d{1,2}):(\d{2})/);
  const endMatch = normalizeText(endText).match(/(\d{1,2}):(\d{2})/);

  return {
    startHour: beginMatch ? Number(beginMatch[1]) : 12,
    startMinute: beginMatch ? Number(beginMatch[2]) : 0,
    endHour: endMatch ? Number(endMatch[1]) : null,
    endMinute: endMatch ? Number(endMatch[2]) : null,
    allDay: !beginMatch,
  };
}

function parseOccurrence(dateValue: string, beginText: string | null, endText: string | null) {
  const parsedDate = parsePortalDate(dateValue);
  if (!parsedDate) return null;

  const range = parseTimeRange(beginText, endText);
  const startAt = berlinIso(
    parsedDate.year,
    parsedDate.month,
    parsedDate.day,
    range.startHour,
    range.startMinute
  );
  const endAt =
    range.endHour !== null && range.endMinute !== null
      ? berlinIso(parsedDate.year, parsedDate.month, parsedDate.day, range.endHour, range.endMinute)
      : null;

  return {
    startAt,
    endAt,
    allDay: range.allDay,
    label: [normalizeText(beginText), normalizeText(endText)].filter(Boolean).join(" - ") || null,
  } satisfies WuppertalScheduling;
}

function parseTitleParts(html: string) {
  const raw = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? "";
  const parts = raw
    .split(/<br\s*\/?>/i)
    .map((part) => stripTags(part))
    .filter(Boolean);
  return {
    title: parts[0] ?? "",
    subtitle: parts.length > 1 ? parts.slice(1).join(" - ") : null,
  };
}

function dedupeOccurrences(occurrences: WuppertalScheduling[]) {
  const byStart = new Map<string, WuppertalScheduling>();
  for (const occurrence of occurrences) {
    byStart.set(occurrence.startAt, occurrence);
  }
  return Array.from(byStart.values()).sort((left, right) => left.startAt.localeCompare(right.startAt));
}

function mergeListingCards(cards: WuppertalListingCard[]) {
  const byId = new Map<string, WuppertalListingCard>();
  for (const card of cards) {
    const existing = byId.get(card.ident);
    if (!existing) {
      byId.set(card.ident, card);
      continue;
    }

    byId.set(card.ident, {
      ...existing,
      pretitle: existing.pretitle ?? card.pretitle,
      rubrik: existing.rubrik ?? card.rubrik,
      genre: existing.genre ?? card.genre,
      locationText: existing.locationText ?? card.locationText,
      hasTickets: existing.hasTickets || card.hasTickets,
      listingOccurrences: dedupeOccurrences([...existing.listingOccurrences, ...card.listingOccurrences]),
    });
  }
  return Array.from(byId.values());
}

function parseListingCards(html: string, dateValue: string) {
  const cards: WuppertalListingCard[] = [];
  const matches = Array.from(
    html.matchAll(
      /<div id="event(\d+)" class="(?:odd|even)">[\s\S]*?<div id="detail\1" style="display: none"><\/div>\s*<\/div>/gi
    )
  );

  let lastRubrik: string | null = null;
  for (const match of matches) {
    const ident = match[1];
    const block = match[0];
    const parsedRubrik =
      stripTags(block.match(/<div class="rubrik"[^>]*>[\s\S]*?<span><nobr>([\s\S]*?)<\/nobr><\/span>/i)?.[1]) ||
      null;
    const rubrik: string | null = parsedRubrik || lastRubrik;
    if (rubrik) lastRubrik = rubrik;

    const titleParts = parseTitleParts(block);
    const occurrence = parseOccurrence(
      dateValue,
      block.match(/<div class="beginn">\s*([\s\S]*?)\s*<\/div>/i)?.[1] ?? null,
      block.match(/<div class="ende">\s*([\s\S]*?)\s*<\/div>/i)?.[1] ?? null
    );

    if (!ident || !titleParts.title || !occurrence) continue;

    cards.push({
      ident,
      sourceUrl: `${WUPPERTAL_ROOT_URL}/${ident}`,
      title: titleParts.title,
      subtitle: titleParts.subtitle,
      pretitle: stripTags(
        block.match(/<span[^>]+class="pretitel"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? null
      ) || null,
      rubrik,
      genre: stripTags(block.match(/<div class="genre">\s*([\s\S]*?)\s*<\/div>/i)?.[1] ?? null) || null,
      locationText:
        stripTags(block.match(/<span class="location">\s*([\s\S]*?)\s*<\/span>/i)?.[1] ?? null) || null,
      hasTickets: /class="ticketkaufen"|ticketstatus-kaufbar/i.test(block),
      listingOccurrences: [occurrence],
    });
  }

  return cards;
}

function parseVenue(html: string) {
  const block = html.match(/<div class="location">([\s\S]*?)<div class="anfahrt">/i)?.[1] ?? "";
  const rawParagraph = block.match(/<p>\s*([\s\S]*?)\s*<\/p>/i)?.[1] ?? "";
  const parts = rawParagraph
    .split(/<br\s*\/?>/i)
    .map((part) => stripTags(part))
    .filter(Boolean);

  return {
    venueName: parts[0] ?? null,
    venueAddress: parts.length > 1 ? parts.slice(1).join(", ") : null,
    venueWebsite:
      toAbsoluteUrl(block.match(/<a[^>]+href="([^"]+)"/i)?.[1] ?? null, WUPPERTAL_ROOT_URL) ?? null,
  };
}

function parsePriceValues(html: string) {
  const prices = Array.from(html.matchAll(/EUR\s*([0-9]+(?:,[0-9]{2})?)/gi))
    .map((match) => Number(match[1].replace(",", ".")))
    .filter((value) => Number.isFinite(value));

  return {
    priceMin: prices.length > 0 ? Math.min(...prices) : null,
    priceMax: prices.length > 0 ? Math.max(...prices) : null,
  };
}

function parseLatLng(html: string) {
  const encoded = html.match(/~~(-?\d+(?:\.\d+)?)~~(-?\d+(?:\.\d+)?)/);
  if (!encoded) return { lat: null, lng: null };

  const lat = Number(encoded[1]);
  const lng = Number(encoded[2]);
  return {
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

async function enrichCard(card: WuppertalListingCard): Promise<WuppertalDetailEnrichment> {
  try {
    const html = await fetchHtml(buildDetailUrl(card.ident));
    const venue = parseVenue(html);
    const prices = parsePriceValues(html);
    const coords = parseLatLng(html);
    const ticketBlock = html.match(/<div class="tickets">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="lang-ende">/i)?.[1] ?? "";

    return {
      summary:
        stripTags(html.match(/<div class=['"]bText['"][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? null) || null,
      venueName: venue.venueName,
      venueAddress: venue.venueAddress,
      venueWebsite: venue.venueWebsite,
      priceMin: prices.priceMin,
      priceMax: prices.priceMax,
      ticketNotes: stripTags(ticketBlock) || null,
      lat: coords.lat,
      lng: coords.lng,
      sourceUpdatedAt: null,
    };
  } catch (error) {
    console.warn(
      `[wuppertal_live] Detail fuer ${card.ident} konnte nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      summary: null,
      venueName: null,
      venueAddress: null,
      venueWebsite: null,
      priceMin: null,
      priceMax: null,
      ticketNotes: null,
      lat: null,
      lng: null,
      sourceUpdatedAt: null,
    };
  }
}

async function enrichCards(cards: WuppertalListingCard[]) {
  const enriched: Array<WuppertalListingCard & WuppertalDetailEnrichment> = [];
  for (const batch of chunk(cards, DETAIL_BATCH_SIZE)) {
    const details = await Promise.all(batch.map((card) => enrichCard(card)));
    batch.forEach((card, index) => {
      enriched.push({
        ...card,
        ...details[index],
      });
    });
  }
  return enriched;
}

function explodeCards(cards: Array<WuppertalListingCard & WuppertalDetailEnrichment>) {
  const exploded: WuppertalSourceCard[] = [];
  for (const card of cards) {
    for (const occurrence of card.listingOccurrences) {
      exploded.push({
        ...card,
        occurrence,
      });
    }
  }
  return exploded;
}

function categoryFromText(text: string) {
  const normalized = text.toLowerCase();
  const explicitMarketIntent =
    /(wochenmarkt|flohmarkt|tr[oÃ¶]del|basar|jahrmarkt|boerse\b|buechermarkt|kunstmarkt|designmarkt|kreativmarkt|schallplattenmarkt)/.test(
      normalized
    );
  const communityIntent =
    /(workshop|kurs|seminar|treff|dialog|fuehrung|fuhrung|diskussion|gespraech|sprechstunde|community|bildung|austausch)/.test(
      normalized
    );
  const strongMarketIntent =
    /(wochenmarkt|flohmarkt|troedel|tr(o|oe)del|basar|jahrmarkt|boerse\b|buechermarkt|kunstmarkt|designmarkt|kreativmarkt|schallplattenmarkt)/.test(
      normalized
    );

  if (/(weihnacht|advent|winterzauber|fruehling|fruhling|sommerzauber)/.test(normalized)) {
    return "seasonal";
  }
  if (communityIntent && !strongMarketIntent && !/(festival|open air|stadtfest|kulturnacht|kirmes|fest\b)/.test(normalized)) {
    return "community";
  }
  if (/(markt\b|wochenmarkt|flohmarkt|tr[oö]del|basar|jahrmarkt|boerse\b)/.test(normalized)) {
    return "market";
  }
  if (/(festival|open air|stadtfest|kulturnacht|kirmes|fest\b)/.test(normalized)) {
    return "festival";
  }
  if (/(konzerte|konzert|chor|musik|jazz|rock|pop|soul|r&b|gospel|orchester|klassik|alternative)/.test(normalized)) {
    return "concert";
  }
  if (/(theater|schauspiel|oper|operette|puppentheater|ballett|tanztheater|kabarettbuehne)/.test(normalized)) {
    return "theater";
  }
  if (/(show|film|kino|comedy|kabarett|lesung|vortrag|performance|poetry|quiz|musical)/.test(normalized)) {
    return "show";
  }
  if (/(kulinar|wein|bier|brunch|dinner|tasting|food|menue)/.test(normalized)) {
    return "food_event";
  }
  if (/(ausstellung|museum|galerie|messe|expo)/.test(normalized)) {
    return "fair";
  }
  if (/(workshop|kurs|seminar|treff|dialog|fuehrung|fuhrung|diskussion|gespraech|community|bildung)/.test(normalized)) {
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
  const audiences = new Set<string>();
  if (/(famil|kinder|jugend)/.test(text)) audiences.add("family");
  if (category === "concert" || category === "show" || category === "festival") {
    audiences.add("friends");
    audiences.add("date");
  }
  if (category === "theater") {
    audiences.add("date");
    audiences.add("tourism");
  }
  if (category === "market" || category === "fair" || category === "food_event") {
    audiences.add("friends");
    audiences.add("tourism");
  }
  if (category === "community") {
    audiences.add("friends");
    audiences.add("tourism");
  }
  if (audiences.size === 0) audiences.add("friends");
  return Array.from(audiences);
}

function occasionsForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "show") return ["date", "friends", "party"];
  if (category === "theater") return ["date", "tourism"];
  if (category === "market" || category === "festival" || category === "food_event" || category === "fair") {
    return ["tourism", "friends", "family", "date"];
  }
  return ["tourism", "friends"];
}

function subtypesForCard(card: WuppertalSourceCard, category: OfficialCityEvent["category"]) {
  const text = [
    card.title,
    card.subtitle,
    card.pretitle,
    card.rubrik,
    card.genre,
    card.summary,
    card.venueName,
    card.venueAddress,
    card.ticketNotes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return Array.from(
    new Set(
      [
        "concrete_event_page",
        category,
        /wochenmarkt/.test(text) ? "weekly_market" : null,
        /flohmarkt|tr[oö]del|jahrmarkt|basar/.test(text) ? "market_event" : null,
        /festival|kulturnacht|stadtfest|kirmes|open air|fest\b/.test(text) ? "festival_event" : null,
        /ausstellung|museum|galerie/.test(text) ? "exhibition" : null,
        /kino|film/.test(text) ? "screening" : null,
        /vortrag|lesung|gespraech|diskussion/.test(text) ? "talk" : null,
        /workshop|kurs|seminar/.test(text) ? "workshop" : null,
        /fuehrung|fuhrung|tour\b/.test(text) ? "guided_tour" : null,
      ].filter((value): value is string => Boolean(value))
    )
  );
}

function scoresForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert") return { localRank: 80, importance: 76, popularity: 72 };
  if (category === "theater") return { localRank: 78, importance: 74, popularity: 70 };
  if (category === "show") return { localRank: 76, importance: 72, popularity: 69 };
  if (category === "market" || category === "festival") {
    return { localRank: 74, importance: 70, popularity: 66 };
  }
  if (category === "fair" || category === "food_event") {
    return { localRank: 70, importance: 66, popularity: 62 };
  }
  return { localRank: 64, importance: 60, popularity: 56 };
}

export async function fetchWuppertalLiveEvents(config: EventSourceConfigRow) {
  const introHtml = await fetchHtml(config.base_url || WUPPERTAL_INTRO_URL);
  const availableDates = parseAvailableDates(introHtml);
  const listingCards: WuppertalListingCard[] = [];

  for (const batch of chunk(availableDates, LISTING_BATCH_SIZE)) {
    const results = await Promise.all(
      batch.map(async (dateValue) => {
        try {
          const html = await fetchHtml(buildListingUrl(dateValue));
          return parseListingCards(html, dateValue);
        } catch (error) {
          console.warn(
            `[wuppertal_live] Tagesliste ${dateValue} konnte nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`
          );
          return [] as WuppertalListingCard[];
        }
      })
    );

    for (const cards of results) {
      listingCards.push(...cards);
    }
  }

  const merged = mergeListingCards(listingCards);
  return explodeCards(await enrichCards(merged));
}

export function normalizeWuppertalLiveEvent(
  card: WuppertalSourceCard,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const startAt = normalizeText(card.occurrence.startAt);
  if (!startAt) return null;

  const categorizationText = [
    card.title,
    card.subtitle,
    card.pretitle,
    card.rubrik,
    card.genre,
    card.summary,
    card.venueName,
    card.ticketNotes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const text = [
    categorizationText,
    card.locationText,
    card.venueAddress,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const category = categoryFromText(categorizationText);
  if (category === "other") return null;

  const audiences = audiencesForCategory(category, text);
  const scores = scoresForCategory(category);

  return {
    source: config.provider,
    external_id: `wuppertal_live:${card.ident}:${startAt}`,
    source_url: card.sourceUrl,
    ticket_url: card.hasTickets ? card.sourceUrl : null,
    title: card.title,
    summary: card.summary ?? card.subtitle ?? card.pretitle,
    category,
    kind: kindForCategory(category),
    status: "scheduled",
    venue_name: card.venueName ?? card.locationText,
    venue_address: card.venueAddress,
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: card.lat,
    lng: card.lng,
    timezone: "Europe/Berlin",
    start_at: startAt,
    end_at: card.occurrence.endAt,
    doors_at: null,
    all_day: card.occurrence.allDay,
    is_ticketed: card.hasTickets || card.priceMin !== null || card.priceMax !== null,
    price_min: card.priceMin,
    price_max: card.priceMax,
    currency: card.priceMin !== null || card.priceMax !== null ? "EUR" : null,
    family_friendly: audiences.includes("family"),
    indoor_outdoor:
      /(markt|open air|platz|park|ufer|outdoor|fest\b|kirmes)/.test(text)
        ? "outdoor"
        : /(theater|halle|saal|museum|kino|bibliothek|zentrum|kirche)/.test(text)
          ? "indoor"
          : null,
    local_rank: scores.localRank,
    importance_score: scores.importance,
    popularity_score: scores.popularity,
    tags: Array.from(
      new Set(
        [
          "wuppertal_live",
          category,
          card.rubrik ?? "",
          card.genre ?? "",
          card.venueName ?? "",
          card.pretitle ?? "",
        ]
          .map((value) => normalizeText(value).toLowerCase())
          .filter(Boolean)
      )
    ),
    subtypes: subtypesForCard(card, category),
    audiences,
    occasions: occasionsForCategory(category),
    source_payload: card,
    source_updated_at: card.sourceUpdatedAt,
    last_seen_at: new Date().toISOString(),
  };
}
