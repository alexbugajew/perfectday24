import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type BonnScheduling = {
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  label: string | null;
};

type BonnListingCard = {
  ident: string;
  sourceUrl: string;
  title: string;
  kicker: string | null;
  summary: string | null;
  icalUrl: string | null;
  mapUrl: string | null;
  listingOccurrences: BonnScheduling[];
};

type BonnDetailEnrichment = {
  venueName: string | null;
  venueAddress: string | null;
  externalUrl: string | null;
  sourceUpdatedAt: string | null;
  detailOccurrences: BonnScheduling[];
};

type BonnSourceCard = {
  ident: string;
  sourceUrl: string;
  title: string;
  kicker: string | null;
  summary: string | null;
  venueName: string | null;
  venueAddress: string | null;
  externalUrl: string | null;
  sourceUpdatedAt: string | null;
  occurrence: BonnScheduling;
};

const BONN_CALENDAR_URL =
  "https://www.bonn.de/bonn-erleben/ausgehen-und-erleben/veranstaltungskalender.php";
const PAGE_PARAM_NAME = "sp:page[search-1.form][0]";
const MAX_LISTING_PAGES = 18;
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

async function fetchText(url: string, accept = "text/html,application/xhtml+xml,application/xml") {
  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept,
    },
  });

  if (!response.ok) {
    throw new Error(`[bonn_city] HTTP ${response.status} fuer ${url}`);
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

function buildPageUrl(baseUrl: string, pageNumber: number) {
  if (pageNumber <= 1) return baseUrl;
  const url = new URL(baseUrl);
  url.searchParams.set(PAGE_PARAM_NAME, String(pageNumber));
  return url.toString();
}

function extractMaxPageCount(html: string) {
  const payload = html.match(/data-sp-pagination="([^"]+)"/i)?.[1] ?? null;
  if (payload) {
    try {
      const parsed = JSON.parse(decodeHtml(payload)) as { max?: number | string | null };
      const max = Number(parsed.max ?? 1);
      if (Number.isFinite(max) && max >= 1) return max;
    } catch {
      // fall through to regex fallback
    }
  }

  const decoded = decodeHtml(html);
  const match = decoded.match(/pageParameterName:\s*"sp:page\[search-1\.form\]\[0\]"[\s\S]*?max:\s*(\d+)/i);
  return Number(match?.[1] ?? 1);
}

function parseListingOccurrences(articleHtml: string) {
  const dateMatches = Array.from(
    articleHtml.matchAll(
      /<[^>]*class="[^"]*SP-Scheduling__date[^"]*"[^>]*>([\s\S]*?)<\/(?:time|span)>/gi
    )
  ).map((match) => stripTags(match[1]));
  const timeMatches = Array.from(
    articleHtml.matchAll(
      /<[^>]*class="[^"]*SP-Scheduling__time[^"]*"[^>]*>([\s\S]*?)<\/span>/gi
    )
  ).map((match) => stripTags(match[1]));

  const occurrences: BonnScheduling[] = [];
  for (let index = 0; index < dateMatches.length; index += 1) {
    const dateText = normalizeText(dateMatches[index]);
    const timeText = normalizeText(timeMatches[index] ?? "");
    const parsed = parseGermanDateTime(dateText, timeText);
    if (!parsed) continue;
    occurrences.push(parsed);
  }

  return dedupeOccurrences(occurrences);
}

function parseListingCards(html: string, baseUrl: string) {
  const cards: BonnListingCard[] = [];
  const matches = Array.from(
    html.matchAll(/<article class="SP-Teaser[\s\S]*?<\/article>/gi)
  );

  for (const match of matches) {
    const article = match[0];
    const href = article.match(/href="([^"]*\/veranstaltungskalender\/veranstaltungen\/[^"]+\.php[^"]*)"/i)?.[1];
    const title = stripTags(article.match(/<h1 class="SP-Teaser__headline">([\s\S]*?)<\/h1>/i)?.[1] ?? "");
    if (!href || !title) continue;

    const sourceUrl = toAbsoluteUrl(href, baseUrl);
    if (!sourceUrl) continue;

    const kicker = stripTags(
      article.match(/<span class="SP-Kicker__text">([\s\S]*?)<\/span>/i)?.[1] ?? ""
    ) || null;
    const summary = stripTags(
      article.match(/<div class="SP-Teaser__abstract">([\s\S]*?)<\/div>/i)?.[1] ?? ""
    ) || null;
    const icalUrl =
      toAbsoluteUrl(article.match(/href="([^"]+\?sp%3Aout=iCal[^"]*)"/i)?.[1] ?? null, baseUrl) ?? null;
    const mapUrl =
      toAbsoluteUrl(
        article.match(/href="(https?:\/\/stadtplan\.bonn\.de[^"]+)"/i)?.[1] ?? null,
        baseUrl
      ) ?? null;

    cards.push({
      ident: sourceUrl,
      sourceUrl,
      title,
      kicker,
      summary,
      icalUrl,
      mapUrl,
      listingOccurrences: parseListingOccurrences(article),
    });
  }

  return cards;
}

function parseGermanDateTime(dateText: string, timeText: string) {
  const dateMatch = normalizeText(dateText).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!dateMatch) return null;

  const [, dayText, monthText, yearText] = dateMatch;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const normalizedTime = normalizeText(timeText);
  const timeMatch = normalizedTime.match(/(\d{1,2}):(\d{2})/);
  const hour = timeMatch ? Number(timeMatch[1]) : 12;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;
  const allDay = !timeMatch || /^0:00(?:\s*Uhr)?$/i.test(normalizedTime);

  return {
    startAt: berlinIso(year, month, day, hour, minute),
    endAt: null,
    allDay,
    label: [dateText, timeText].filter(Boolean).join(" ").trim() || null,
  } satisfies BonnScheduling;
}

function normalizeIsoDateTime(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (/Z$/i.test(normalized) || /[+-]\d{2}:\d{2}$/.test(normalized)) return normalized;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return `${normalized}${berlinOffset(new Date(`${normalized}Z`))}`;
  }
  return normalized;
}

function extractOccurrencesFromDetailHtml(html: string) {
  const occurrences = Array.from(
    html.matchAll(
      /<time[^>]*class="[^"]*SP-Scheduling__date[^"]*"[^>]*datetime="([^"]+)"[^>]*>([\s\S]*?)<\/time>/gi
    )
  )
    .reduce<BonnScheduling[]>((bucket, match) => {
      const startAt = normalizeIsoDateTime(match[1]);
      if (!startAt) return bucket;
      const label = stripTags(match[2]) || null;
      const allDay = !/\d{1,2}:\d{2}\s*Uhr/i.test(label ?? "") || /0:00\s*Uhr/i.test(label ?? "");
      bucket.push({
        startAt,
        endAt: null,
        allDay,
        label,
      } satisfies BonnScheduling);
      return bucket;
    }, []);

  return dedupeOccurrences(occurrences);
}

function dedupeOccurrences(occurrences: BonnScheduling[]) {
  const byStart = new Map<string, BonnScheduling>();
  for (const occurrence of occurrences) {
    byStart.set(occurrence.startAt, occurrence);
  }
  return Array.from(byStart.values()).sort((left, right) => left.startAt.localeCompare(right.startAt));
}

function decodeQueryParam(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  try {
    return decodeURIComponent(normalized.replace(/\+/g, " "));
  } catch {
    return normalized;
  }
}

function extractAddressFromDestination(html: string) {
  const destination = decodeQueryParam(
    html.match(/destination=([^"&]+)(?:&|")/i)?.[1] ?? null
  );
  return destination ? normalizeText(destination.replace(/,/g, ", ")) : null;
}

function extractVenueName(html: string) {
  return (
    stripTags(
      html.match(/class="[^"]*SP-Contact__name[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ?? ""
    ) || null
  );
}

function extractVenueAddress(html: string) {
  const address =
    stripTags(html.match(/<address[^>]*>([\s\S]*?)<\/address>/i)?.[1] ?? "") || null;
  return address ?? extractAddressFromDestination(html);
}

function extractExternalUrl(html: string, detailUrl: string) {
  const detailHost = new URL(detailUrl).hostname;
  const candidates = Array.from(
    html.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>/gi)
  ).map((match) => normalizeText(decodeHtml(match[1])));

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      const host = parsed.hostname;
      if (host === detailHost || host.endsWith(".bonn.de")) continue;
      if (/google\.com|stadtplan\.bonn\.de|calendar|ical/i.test(candidate)) continue;
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

function extractSourceUpdatedAt(html: string) {
  const raw =
    html.match(/<meta[^>]*application-name[^>]*data-content="([^"]+)"[^>]*>/i)?.[1] ??
    html.match(/<meta[^>]*data-content="([^"]+)"[^>]*application-name[^>]*>/i)?.[1] ??
    null;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(decodeHtml(raw)) as { changed?: string | null };
    return normalizeText(parsed.changed) || null;
  } catch {
    return null;
  }
}

async function enrichListingCard(card: BonnListingCard): Promise<BonnDetailEnrichment> {
  try {
    const html = await fetchText(card.sourceUrl);
    return {
      venueName: extractVenueName(html),
      venueAddress: extractVenueAddress(html),
      externalUrl: extractExternalUrl(html, card.sourceUrl),
      sourceUpdatedAt: extractSourceUpdatedAt(html),
      detailOccurrences: extractOccurrencesFromDetailHtml(html),
    };
  } catch {
    return {
      venueName: null,
      venueAddress: extractAddressFromDestination(card.mapUrl ?? ""),
      externalUrl: null,
      sourceUpdatedAt: null,
      detailOccurrences: [],
    };
  }
}

async function enrichCards(cards: BonnListingCard[]) {
  const enriched: Array<BonnListingCard & BonnDetailEnrichment> = [];

  for (let index = 0; index < cards.length; index += DETAIL_BATCH_SIZE) {
    const batch = cards.slice(index, index + DETAIL_BATCH_SIZE);
    const results = await Promise.all(batch.map((card) => enrichListingCard(card)));
    for (let offset = 0; offset < batch.length; offset += 1) {
      enriched.push({
        ...batch[offset],
        ...results[offset],
      });
    }
  }

  return enriched;
}

function explodeCards(cards: Array<BonnListingCard & BonnDetailEnrichment>) {
  const exploded: BonnSourceCard[] = [];
  for (const card of cards) {
    const occurrences =
      card.detailOccurrences.length > 0 ? card.detailOccurrences : card.listingOccurrences;
    if (occurrences.length === 0) continue;

    for (const occurrence of occurrences) {
      exploded.push({
        ident: card.ident,
        sourceUrl: card.sourceUrl,
        title: card.title,
        kicker: card.kicker,
        summary: card.summary,
        venueName: card.venueName,
        venueAddress: card.venueAddress,
        externalUrl: card.externalUrl,
        sourceUpdatedAt: card.sourceUpdatedAt,
        occurrence,
      });
    }
  }

  return exploded;
}

function categoryFromText(text: string): OfficialCityEvent["category"] {
  const normalized = text.toLowerCase();

  if (/(unterricht|workshop|kurs|seminar|sitzung|jugendparlament|fuehrung|fuhrung|rundgang|tour|vortrag|fortbildung|sprechstunde|beratung|coaching|gruppe|qualifizierung|probetraining|sport|training|gymnastik|yoga|treff|aktiv|hilfe|spaziergang|schiffstour|raetseltour|raetsel|stadtfahrt)/.test(normalized)) {
    return "community";
  }
  if (/(wochenmarkt|flohmarkt|markt|markt\/messe|tr[ooe]del|kunsthandwerkmarkt|maimarkt)/.test(normalized)) {
    return "market";
  }
  if (/(festival|fest|kirmes|open air|karneval|feierabendmarkt)/.test(normalized)) {
    return "festival";
  }
  if (/(wein|kulinar|brunch|dinner|tasting|street food|genuss)/.test(normalized)) {
    return "food_event";
  }
  if (/(musik|konzert|orchester|jazz|band|chor|klassik)/.test(normalized)) {
    return "concert";
  }
  if (/(theater|oper|operette|schauspiel|buehne|buhne)/.test(normalized)) {
    return "theater";
  }
  if (/(show|musical|kino|film|kabarett|comedy|performance|lesung|tanz|ballett)/.test(normalized)) {
    return "show";
  }
  if (/(messe|kongress|ausstellung|museum|galerie|expo)/.test(normalized)) {
    return "fair";
  }
  if (/(weihnacht|advent|sommer|winter|fruehling|herbst)/.test(normalized)) {
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

function audiencesForCategory(category: OfficialCityEvent["category"], text: string) {
  const lower = text.toLowerCase();
  if (/famil|kinder|jugend/.test(lower)) return ["family", "tourism"];
  if (category === "concert" || category === "show") return ["date", "friends", "party"];
  if (category === "theater") return ["date", "tourism"];
  if (category === "market" || category === "festival" || category === "food_event" || category === "fair") {
    return ["tourism", "friends", "family", "date"];
  }
  return ["tourism", "friends"];
}

function occasionsForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "show") return ["date", "friends", "party"];
  if (category === "theater") return ["date", "tourism"];
  if (category === "market" || category === "festival" || category === "food_event" || category === "fair") {
    return ["tourism", "friends", "family", "date"];
  }
  return ["tourism", "friends"];
}

function subtypesForCard(card: BonnSourceCard, category: OfficialCityEvent["category"]) {
  const text = `${card.title} ${card.kicker ?? ""} ${card.summary ?? ""}`.toLowerCase();
  return Array.from(
    new Set(
      [
        "concrete_event_page",
        category,
        /markt|wochenmarkt|flohmarkt/.test(text) ? "market_event" : null,
        /festival|fest|kirmes|open air/.test(text) ? "festival_event" : null,
        /fuehrung|fuhrung|rundgang|tour/.test(text) ? "guided_tour" : null,
        /messe|kongress|ausstellung|museum/.test(text) ? "exhibition" : null,
        /kino|film/.test(text) ? "screening" : null,
      ].filter((value): value is string => Boolean(value))
    )
  );
}

export async function fetchBonnCityEvents(config: EventSourceConfigRow) {
  const firstHtml = await fetchText(config.base_url);
  const cards = parseListingCards(firstHtml, config.base_url);
  const totalPages = Math.min(Math.max(extractMaxPageCount(firstHtml), 1), MAX_LISTING_PAGES);

  for (let pageNumber = 2; pageNumber <= totalPages; pageNumber += 1) {
    const html = await fetchText(buildPageUrl(config.base_url, pageNumber));
    const pageCards = parseListingCards(html, config.base_url);
    if (pageCards.length === 0) break;
    cards.push(...pageCards);
  }

  const dedupedCards = Array.from(
    new Map(cards.map((card) => [card.ident, card] satisfies [string, BonnListingCard])).values()
  );

  return explodeCards(await enrichCards(dedupedCards));
}

export function normalizeBonnCityEvent(
  card: BonnSourceCard,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const startAt = normalizeText(card.occurrence.startAt);
  if (!startAt) return null;

  const text = [card.title, card.kicker, card.summary, card.venueName, card.venueAddress]
    .filter(Boolean)
    .join(" ");
  const category = categoryFromText(text);
  if (category === "other") return null;

  const audiences = audiencesForCategory(category, text);

  return {
    source: config.provider,
    external_id: `bonn_city:${card.ident}:${startAt}`,
    source_url: card.sourceUrl,
    ticket_url: card.externalUrl,
    title: card.title,
    summary: card.summary,
    category,
    kind: kindForCategory(category),
    status: "scheduled",
    venue_name: card.venueName,
    venue_address: card.venueAddress,
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: null,
    lng: null,
    timezone: "Europe/Berlin",
    start_at: startAt,
    end_at: card.occurrence.endAt,
    doors_at: null,
    all_day: card.occurrence.allDay,
    is_ticketed: Boolean(card.externalUrl),
    price_min: null,
    price_max: null,
    currency: null,
    family_friendly: audiences.includes("family"),
    indoor_outdoor:
      /(kirmes|markt|flohmarkt|open air|ufer|wiese|platz)/i.test(text) ? "outdoor" : null,
    local_rank: /(festival|fest|markt|konzert|theater|show|oper)/i.test(text) ? 72 : null,
    importance_score: /(festival|fest|markt|konzert|theater|show|oper)/i.test(text) ? 68 : null,
    popularity_score: /(festival|fest|markt|konzert|theater|show|oper)/i.test(text) ? 62 : null,
    tags: Array.from(
      new Set(
        ["bonn_city", category, card.kicker ?? "", card.venueName ?? ""]
          .map((value) => normalizeText(value))
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
