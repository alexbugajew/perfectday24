import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type BraunschweigScheduling = {
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  label: string | null;
};

type BraunschweigListingCard = {
  ident: string;
  sourceUrl: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  locationText: string | null;
  listingOccurrences: BraunschweigScheduling[];
};

type BraunschweigDetailEnrichment = {
  summary: string | null;
  venueName: string | null;
  venueAddress: string | null;
  externalUrl: string | null;
  ticketUrl: string | null;
  organizer: string | null;
  categories: string[];
  lat: number | null;
  lng: number | null;
  sourceUpdatedAt: string | null;
  detailOccurrences: BraunschweigScheduling[];
  priceText: string | null;
};

type BraunschweigSourceCard = {
  ident: string;
  sourceUrl: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  venueName: string | null;
  venueAddress: string | null;
  externalUrl: string | null;
  ticketUrl: string | null;
  organizer: string | null;
  categories: string[];
  lat: number | null;
  lng: number | null;
  sourceUpdatedAt: string | null;
  priceText: string | null;
  occurrence: BraunschweigScheduling;
};

type BraunschweigPartialEntry = {
  id?: number | null;
  title?: string | null;
  teaser?: string | null;
  subtitle?: string | null;
  city?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  dateString?: string | null;
  imagePath?: string | null;
  imageTitle?: string | null;
  imageCopyright?: string | null;
  uri?: string | null;
};

type BraunschweigPartialPayload = {
  count?: number | null;
  moreUri?: string | null;
  [key: string]: unknown;
};

const LOOKAHEAD_DAYS = 35;
const DETAIL_BATCH_SIZE = 6;
const MAX_MORE_REQUESTS = 12;

const GERMAN_MONTHS: Record<string, number> = {
  januar: 1,
  februar: 2,
  maerz: 3,
  märz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

const CATEGORY_PRIORITY: Record<OfficialCityEvent["category"], number> = {
  concert: 88,
  theater: 86,
  show: 84,
  market: 82,
  festival: 80,
  fair: 72,
  food_event: 78,
  community: 64,
  seasonal: 68,
  other: 52,
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
  const normalized = normalizeText(decodeHtml(url ?? ""));
  if (!normalized) return null;
  try {
    return new URL(normalized, baseUrl).toString();
  } catch {
    return normalized;
  }
}

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(
  url: string,
  accept = "text/html,application/xhtml+xml,application/xml,text/plain,*/*"
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        "user-agent": "perfectday24-event-ingest/1.0",
        accept,
      },
    });

    if (response.ok) {
      return response.text();
    }

    if (![502, 503, 504].includes(response.status) || attempt === 2) {
      throw new Error(`[braunschweig_region] HTTP ${response.status} fuer ${url}`);
    }

    await sleep(500 * (attempt + 1));
  }
  throw new Error(`[braunschweig_region] HTTP 504 fuer ${url}`);
}

async function fetchPartialPayload(url: string) {
  const text = await fetchText(url, "application/json,text/plain,*/*");
  try {
    return JSON.parse(text) as BraunschweigPartialPayload;
  } catch (error) {
    throw new Error(
      `[braunschweig_region] Konnte Partial-Payload nicht parsen fuer ${url}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
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

function parseTimeParts(value: string | null | undefined) {
  const match = normalizeText(value).match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  };
}

function parseGermanMonthDate(
  value: string | null | undefined,
  fallbackYear: number,
  fallbackMonth?: number,
  fallbackDay?: number
) {
  const normalized = normalizeText(value)
    .replace(/\s+/g, " ")
    .replace(/\s*\.\s*/g, ".")
    .replace(/\.$/, "");
  if (!normalized) {
    return fallbackMonth && fallbackDay
      ? { year: fallbackYear, month: fallbackMonth, day: fallbackDay }
      : null;
  }

  const match = normalized.match(/(\d{1,2})\.?\s*([A-Za-zÄÖÜäöü]+)(?:\s+(\d{4}))?/);
  if (!match) {
    return fallbackMonth && fallbackDay
      ? { year: fallbackYear, month: fallbackMonth, day: fallbackDay }
      : null;
  }

  const monthKey = match[2].toLowerCase();
  const month = GERMAN_MONTHS[monthKey];
  if (!month) {
    return fallbackMonth && fallbackDay
      ? { year: fallbackYear, month: fallbackMonth, day: fallbackDay }
      : null;
  }

  return {
    day: Number(match[1]),
    month,
    year: Number(match[3] ?? fallbackYear),
  };
}

function parseTimeRange(text: string | null | undefined) {
  const normalized = normalizeText(text);
  const rangeMatch = normalized.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (rangeMatch) {
    return {
      start: { hour: Number(rangeMatch[1]), minute: Number(rangeMatch[2]) },
      end: { hour: Number(rangeMatch[3]), minute: Number(rangeMatch[4]) },
      allDay: false,
    };
  }

  const singleMatch = normalized.match(/(\d{1,2}):(\d{2})/);
  if (singleMatch) {
    return {
      start: { hour: Number(singleMatch[1]), minute: Number(singleMatch[2]) },
      end: null,
      allDay: false,
    };
  }

  return {
    start: null,
    end: null,
    allDay: true,
  };
}

function parseListingOccurrence(entry: BraunschweigPartialEntry, fallbackYear: number) {
  const startTime = parseTimeParts(entry.startTime) ?? parseTimeRange(entry.dateString).start;
  const endTime = parseTimeParts(entry.endTime) ?? parseTimeRange(entry.dateString).end;
  const startDate = parseGermanMonthDate(entry.startDate, fallbackYear);
  if (!startDate) return null;
  const endDate =
    parseGermanMonthDate(entry.endDate, startDate.year, startDate.month, startDate.day) ?? startDate;
  const allDay = !startTime;

  return {
    startAt: berlinIso(
      startDate.year,
      startDate.month,
      startDate.day,
      startTime?.hour ?? 12,
      startTime?.minute ?? 0
    ),
    endAt: endTime
      ? berlinIso(endDate.year, endDate.month, endDate.day, endTime.hour, endTime.minute)
      : null,
    allDay,
    label: [normalizeText(entry.startDate), normalizeText(entry.dateString)]
      .filter(Boolean)
      .join(" ")
      .trim() || null,
  } satisfies BraunschweigScheduling;
}

function parseDetailOccurrence(label: string) {
  const normalized = normalizeText(label);
  const dateMatch = normalized.match(/(\d{1,2})\.?\s*([A-Za-zÄÖÜäöü]+)\s+(\d{4})/);
  if (!dateMatch) return null;

  const month = GERMAN_MONTHS[dateMatch[2].toLowerCase()];
  if (!month) return null;

  const timing = parseTimeRange(normalized);
  return {
    startAt: berlinIso(
      Number(dateMatch[3]),
      month,
      Number(dateMatch[1]),
      timing.start?.hour ?? 12,
      timing.start?.minute ?? 0
    ),
    endAt: timing.end
      ? berlinIso(
          Number(dateMatch[3]),
          month,
          Number(dateMatch[1]),
          timing.end.hour,
          timing.end.minute
        )
      : null,
    allDay: timing.allDay,
    label: normalized || null,
  } satisfies BraunschweigScheduling;
}

function dedupeOccurrences(occurrences: BraunschweigScheduling[]) {
  const byStart = new Map<string, BraunschweigScheduling>();
  for (const occurrence of occurrences) {
    byStart.set(occurrence.startAt, occurrence);
  }
  return Array.from(byStart.values()).sort((left, right) => left.startAt.localeCompare(right.startAt));
}

function extractListingActionUrl(html: string, baseUrl: string) {
  const action = html.match(/<form[^>]*id="filter-form"[^>]*action="([^"]+)"/i)?.[1] ?? null;
  const absolute = toAbsoluteUrl(action, baseUrl);
  if (!absolute) {
    throw new Error("[braunschweig_region] Konnte Listing-Aktionspfad nicht aus der Suchseite lesen.");
  }
  return absolute;
}

function extractLoadMoreUrl(html: string, baseUrl: string) {
  return toAbsoluteUrl(
    html.match(/<a[^>]*id="event-loadmore"[^>]*href="([^"]+)"/i)?.[1] ?? null,
    baseUrl
  );
}

function parseListingCardsFromHtml(html: string, baseUrl: string, fallbackYear: number) {
  const cards: BraunschweigListingCard[] = [];
  const parts = html.split('<div class="event-list__item').slice(1);

  for (const part of parts) {
    const block = part.slice(0, 9000);
    const href = block.match(/<a href="([^"]*\/veranstaltungen-detailseite\/event\/[^"]+)"/i)?.[1] ?? null;
    const title = stripTags(block.match(/<h2 class="event-list__headline">([\s\S]*?)<\/h2>/i)?.[1] ?? "");
    if (!href || !title) continue;

    const sourceUrl = toAbsoluteUrl(href, baseUrl);
    if (!sourceUrl) continue;

    const infoMatches = Array.from(
      block.matchAll(/<span class="event-list__info-item">([\s\S]*?)<\/span>/gi)
    ).map((match) => match[1]);

    let locationText: string | null = null;
    let timeText: string | null = null;
    for (const info of infoMatches) {
      if (/LocationMarker/i.test(info)) {
        locationText = stripTags(info) || null;
      } else if (/#Clock|Clock/i.test(info)) {
        timeText = stripTags(info) || null;
      }
    }

    const dateText = stripTags(block.match(/<p class="event-list__date[^"]*">([\s\S]*?)<\/p>/i)?.[1] ?? "");
    const occurrence = parseListingOccurrence(
      {
        startDate: dateText,
        endDate: dateText,
        dateString: timeText,
        startTime: timeText,
        endTime: timeText,
      },
      fallbackYear
    );
    if (!occurrence) continue;

    cards.push({
      ident: normalizeText(block.match(/id="([^"]+)"/i)?.[1] ?? "") || sourceUrl,
      sourceUrl,
      title,
      subtitle: null,
      summary: null,
      locationText,
      listingOccurrences: [occurrence],
    });
  }

  return cards;
}

function parsePartialCards(payload: BraunschweigPartialPayload, baseUrl: string, fallbackYear: number) {
  const cards: BraunschweigListingCard[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (!/^\d+$/.test(key) || !value || typeof value !== "object") continue;
    const entry = value as BraunschweigPartialEntry;
    const title = normalizeText(entry.title);
    const sourceUrl = toAbsoluteUrl(entry.uri, baseUrl);
    const occurrence = parseListingOccurrence(entry, fallbackYear);
    if (!title || !sourceUrl || !occurrence) continue;

    cards.push({
      ident: String(entry.id ?? sourceUrl),
      sourceUrl,
      title,
      subtitle: normalizeText(entry.subtitle) || null,
      summary: stripTags(entry.teaser) || null,
      locationText: normalizeText(entry.city) || null,
      listingOccurrences: [occurrence],
    });
  }

  return cards;
}

function mergeListingCards(cards: BraunschweigListingCard[]) {
  const bySource = new Map<string, BraunschweigListingCard>();

  for (const card of cards) {
    const existing = bySource.get(card.sourceUrl);
    if (!existing) {
      bySource.set(card.sourceUrl, {
        ...card,
        listingOccurrences: [...card.listingOccurrences],
      });
      continue;
    }

    existing.listingOccurrences = dedupeOccurrences([
      ...existing.listingOccurrences,
      ...card.listingOccurrences,
    ]);
    if (!existing.subtitle && card.subtitle) existing.subtitle = card.subtitle;
    if (!existing.summary && card.summary) existing.summary = card.summary;
    if (!existing.locationText && card.locationText) existing.locationText = card.locationText;
  }

  return Array.from(bySource.values());
}

function buildRangeListingUrl(actionUrl: string, startDate: string, endDate: string) {
  const url = new URL(actionUrl);
  url.hash = "";
  url.searchParams.set("tx_gcevents_eventlisting[startdate]", startDate);
  url.searchParams.set("tx_gcevents_eventlisting[enddate]", endDate);
  return url.toString();
}

async function fetchRangeCards(listingUrl: string, baseUrl: string, fallbackYear: number) {
  const html = await fetchText(listingUrl);
  const cards = parseListingCardsFromHtml(html, baseUrl, fallbackYear);
  let moreUrl = extractLoadMoreUrl(html, baseUrl);
  let moreCount = 0;

  while (moreUrl && moreCount < MAX_MORE_REQUESTS) {
    const payload = await fetchPartialPayload(moreUrl);
    cards.push(...parsePartialCards(payload, baseUrl, fallbackYear));
    moreUrl = toAbsoluteUrl(payload.moreUri, baseUrl);
    moreCount += 1;
  }

  return cards;
}

function extractSection(html: string, startMarker: string, endMarkers: string[]) {
  const start = html.indexOf(startMarker);
  if (start < 0) return "";
  let end = html.length;
  for (const marker of endMarkers) {
    const candidate = html.indexOf(marker, start + startMarker.length);
    if (candidate >= 0 && candidate < end) {
      end = candidate;
    }
  }
  return html.slice(start, end);
}

function parseDetailOccurrences(html: string) {
  const occurrences = Array.from(
    html.matchAll(/<li class="event-schedule__item[^"]*">([\s\S]*?)<\/li>/gi)
  )
    .map((match) => parseDetailOccurrence(stripTags(match[1])))
    .filter((item): item is BraunschweigScheduling => Boolean(item));

  return dedupeOccurrences(occurrences);
}

function parseAddressBlock(html: string, label: string) {
  return (
    html.match(
      new RegExp(
        `<address>[\\s\\S]*?<strong>${label}<\\/strong>[\\s\\S]*?<\\/address>`,
        "i"
      )
    )?.[0] ?? ""
  );
}

function parseAddressText(block: string) {
  if (!block) return null;
  const address = stripTags(block);
  return address || null;
}

function parseVenueName(block: string) {
  if (!block) return null;
  return stripTags(block.match(/<b>([\s\S]*?)<\/b>/i)?.[1] ?? "") || null;
}

function parseCategoryLabels(html: string) {
  return Array.from(
    html.matchAll(/<use xlink:href="#Label"><\/use>[\s\S]*?<p><b>([\s\S]*?)<\/b><\/p>/gi)
  )
    .map((match) => stripTags(match[1]))
    .filter(Boolean);
}

function parseCoordinates(html: string) {
  const match = html.match(/data-lat="([0-9.\-]+)"\s+data-long="([0-9.\-]+)"/i);
  if (!match) {
    return { lat: null, lng: null };
  }

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return {
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

function parsePriceText(html: string) {
  return (
    stripTags(html.match(/<p><b>Preis<\/b><br>\s*([\s\S]*?)<\/p>/i)?.[1] ?? "") || null
  );
}

function parseDetailEnrichment(html: string, sourceUrl: string, fallbackLocationText: string | null) {
  const summarySection = extractSection(html, '<section class="children">', ["</section>"]);
  const venueBlock = parseAddressBlock(html, "Veranstaltungsort");
  const organizerBlock = parseAddressBlock(html, "Veranstalter");
  const websiteUrl = toAbsoluteUrl(
    html.match(/<a[^>]+href="([^"]+)"[^>]*>\s*Website der Veranstaltung\s*<\/a>/i)?.[1] ?? null,
    sourceUrl
  );
  const ticketUrl = toAbsoluteUrl(
    html.match(/<a[^>]+href="([^"]+)"[^>]*>\s*Tickets kaufen\s*<\/a>/i)?.[1] ?? null,
    sourceUrl
  );

  return {
    summary: stripTags(summarySection) || null,
    venueName: parseVenueName(venueBlock),
    venueAddress: parseAddressText(venueBlock) ?? fallbackLocationText,
    externalUrl: websiteUrl,
    ticketUrl,
    organizer: parseAddressText(organizerBlock),
    categories: parseCategoryLabels(html),
    ...parseCoordinates(html),
    sourceUpdatedAt: null,
    detailOccurrences: parseDetailOccurrences(html),
    priceText: parsePriceText(html),
  } satisfies BraunschweigDetailEnrichment;
}

async function enrichCard(card: BraunschweigListingCard) {
  try {
    const html = await fetchText(card.sourceUrl);
    return {
      ...card,
      ...parseDetailEnrichment(html, card.sourceUrl, card.locationText),
    };
  } catch {
    return {
      ...card,
      summary: card.summary,
      venueName: null,
      venueAddress: card.locationText,
      externalUrl: null,
      ticketUrl: null,
      organizer: null,
      categories: [],
      lat: null,
      lng: null,
      sourceUpdatedAt: null,
      detailOccurrences: [],
      priceText: null,
    };
  }
}

async function enrichCards(cards: BraunschweigListingCard[]) {
  const enriched: Array<BraunschweigListingCard & BraunschweigDetailEnrichment> = [];

  for (const batch of chunk(cards, DETAIL_BATCH_SIZE)) {
    enriched.push(...(await Promise.all(batch.map((card) => enrichCard(card)))));
  }

  const exploded: BraunschweigSourceCard[] = [];
  for (const card of enriched) {
    const occurrences =
      card.detailOccurrences.length > 0 ? card.detailOccurrences : card.listingOccurrences;
    if (occurrences.length === 0) continue;

    for (const occurrence of occurrences) {
      exploded.push({
        ident: card.ident,
        sourceUrl: card.sourceUrl,
        title: card.title,
        subtitle: card.subtitle,
        summary: card.summary,
        venueName: card.venueName,
        venueAddress: card.venueAddress,
        externalUrl: card.externalUrl,
        ticketUrl: card.ticketUrl,
        organizer: card.organizer,
        categories: card.categories,
        lat: card.lat,
        lng: card.lng,
        sourceUpdatedAt: card.sourceUpdatedAt,
        priceText: card.priceText,
        occurrence,
      });
    }
  }

  return exploded;
}

function categoryFromText(text: string): OfficialCityEvent["category"] {
  const normalized = text.toLowerCase();
  const communityMovementIntent =
    /(capoeira|sport\b|training|bewegung|mitmach|yoga|kurs|workshop|gruppe|beratung|sprechstunde|treff|infostand|fuehrung|rundgang|tour\b|dialog|vortrag|seminar|elterngruppe)/.test(
      normalized
    );
  const strongFestivalIntent =
    /(festival|stadtfest|kultursommer|festspiele|zwischenfest|future week|sommerfest|fruehlingsfest|herbstfest|winterfest)/.test(
      normalized
    );

  if (/(wochenmarkt|flohmarkt|jahrmarkt|markt\b|basar|kunsthandwerkmarkt|tr[öo]del|schallplattenflohmarkt|fahrradflohmarkt)/.test(normalized)) {
    return "market";
  }
  if (communityMovementIntent && !strongFestivalIntent) {
    return "community";
  }
  if (/(festival|fest\b|stadtfest|open air|kultursommer|festspiele|zwischenfest|future week)/.test(normalized)) {
    return "festival";
  }
  if (/(ausstellung|museum|vernissage|messe|expo|kongress|science|galerie)/.test(normalized)) {
    return "fair";
  }
  if (/(theater|oper\b|operette|schauspiel|bühne|buehne|puppentheater|kabaretttheater)/.test(normalized)) {
    return "theater";
  }
  if (/(musical|comedy|kabarett|kino|film|lesung|poetry slam|slam\b|show\b|performance|zauber|karaoke|tanz|ballett)/.test(normalized)) {
    return "show";
  }
  if (/(konzert|band\b|orchester|chor\b|jazz|livemusik|live musik|philharm|bass\b|dj\b)/.test(normalized)) {
    return "concert";
  }
  if (/(kulinar|food|genuss|wein|bier|brunch|dinner|tasting|street food)/.test(normalized)) {
    return "food_event";
  }
  if (/(weihnacht|advent|oster|fruehling|frühling|sommer|herbst|winter)/.test(normalized)) {
    return "seasonal";
  }
  if (/(workshop|yoga|kurs|gruppe|beratung|sprechstunde|treff|infostand|führung|fuehrung|rundgang|tour\b|sport\b|elterngruppe|dialog|vortrag|seminar)/.test(normalized)) {
    return "community";
  }
  return "other";
}

function categoryFromCard(card: BraunschweigSourceCard) {
  const coreText = [card.title, card.subtitle, ...card.categories]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const contextText = [card.summary, card.organizer, card.venueName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const fallbackText = [coreText, contextText, card.venueAddress]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const directCategory = categoryFromText(coreText);
  if (directCategory !== "other") return directCategory;

  const contextCategory = categoryFromText([coreText, contextText].join(" ").trim());
  if (contextCategory !== "other") return contextCategory;

  return categoryFromText(fallbackText);
}

function kindForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") {
    return "anchored_event" as const;
  }
  return "flex_event" as const;
}

function parseEuroValues(value: string | null | undefined) {
  const normalized = normalizeText(value)
    .replace(/,/g, ".")
    .replace(/\s+/g, " ");
  const numbers = Array.from(normalized.matchAll(/(\d+(?:\.\d{1,2})?)/g))
    .map((match) => Number(match[1]))
    .filter((item) => Number.isFinite(item));

  if (numbers.length === 0) return { min: null, max: null };
  return { min: Math.min(...numbers), max: Math.max(...numbers) };
}

function sanitizePriceValue(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  if (value < 0 || value > 10000) return null;
  return Number(value.toFixed(2));
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
    audiences.add("tourism");
    audiences.add("friends");
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

function subtypesForCard(card: BraunschweigSourceCard, category: OfficialCityEvent["category"]) {
  const text = [
    card.title,
    card.subtitle,
    card.summary,
    card.organizer,
    ...card.categories,
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
        /flohmarkt|tr[öo]del|jahrmarkt/.test(text) ? "market_event" : null,
        /festival|fest\b|open air/.test(text) ? "festival_event" : null,
        /führung|fuehrung|rundgang|tour\b/.test(text) ? "guided_tour" : null,
        /ausstellung|museum|galerie/.test(text) ? "exhibition" : null,
        /kino|film/.test(text) ? "screening" : null,
        /workshop|kurs|yoga/.test(text) ? "workshop" : null,
        /vortrag|lesung|gespraech|gespräch|talk/.test(text) ? "lecture" : null,
      ].filter((value): value is string => Boolean(value))
    )
  );
}

export async function fetchBraunschweigRegionEvents(config: EventSourceConfigRow) {
  const landingHtml = await fetchText(config.base_url);
  const listingActionUrl = extractListingActionUrl(landingHtml, config.base_url);

  const today = new Date();
  const startDate = berlinDateString(today);
  const endDate = berlinDateString(addDays(today, LOOKAHEAD_DAYS));
  const listingCards = await fetchRangeCards(
    buildRangeListingUrl(listingActionUrl, startDate, endDate),
    config.base_url,
    berlinLocalParts(today).year
  );

  return enrichCards(mergeListingCards(listingCards));
}

export function normalizeBraunschweigRegionEvent(
  card: BraunschweigSourceCard,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const startAt = normalizeText(card.occurrence.startAt);
  if (!startAt) return null;

  const text = [
    card.title,
    card.subtitle,
    card.summary,
    card.venueName,
    card.venueAddress,
    card.organizer,
    ...card.categories,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const category = categoryFromCard(card);
  if (category === "other") return null;

  const audiences = audiencesForCategory(category, text);
  const priceRange = parseEuroValues(card.priceText);
  const importanceScore = CATEGORY_PRIORITY[category] + (card.ticketUrl ? 4 : 0) + (card.lat ? 4 : 0);
  const popularityScore = importanceScore - 8;

  return {
    source: config.provider,
    external_id: `braunschweig_region:${card.ident}:${startAt}`,
    source_url: card.sourceUrl,
    ticket_url:
      card.ticketUrl ??
      (/(ticket|karten|eventbrite|pretix|booking|reservierung)/.test(card.externalUrl ?? "")
        ? card.externalUrl
        : null),
    title: card.title,
    summary: card.summary,
    category,
    kind: kindForCategory(category),
    status: "scheduled",
    venue_name: card.venueName,
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
    is_ticketed:
      Boolean(card.ticketUrl) ||
      Boolean(card.priceText) ||
      /(ticket|karten|reservierung|anmeldung|buchbar|eventbrite|pretix)/.test(text),
    price_min: sanitizePriceValue(priceRange.min),
    price_max: sanitizePriceValue(priceRange.max),
    currency:
      sanitizePriceValue(priceRange.min) !== null || sanitizePriceValue(priceRange.max) !== null
        ? "EUR"
        : null,
    family_friendly: audiences.includes("family"),
    indoor_outdoor:
      /(markt|open air|platz|park|ufer|outdoor|freiluft)/.test(text)
        ? "outdoor"
        : /(theater|kino|museum|zentrum|halle|saal|bibliothek)/.test(text)
          ? "indoor"
          : null,
    local_rank: importanceScore,
    importance_score: importanceScore,
    popularity_score: popularityScore,
    tags: Array.from(
      new Set(
        ["braunschweig_region", category, card.organizer ?? "", card.venueName ?? "", ...card.categories]
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
