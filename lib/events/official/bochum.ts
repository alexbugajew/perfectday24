import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type BochumScheduling = {
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  label: string | null;
};

type BochumListingCard = {
  ident: string;
  sourceUrl: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  locationText: string | null;
  categories: string[];
  listingOccurrences: BochumScheduling[];
};

type BochumDetailEnrichment = {
  summary: string | null;
  venueName: string | null;
  venueAddress: string | null;
  externalUrl: string | null;
  ticketUrl: string | null;
  notes: string | null;
  categories: string[];
  lat: number | null;
  lng: number | null;
  sourceUpdatedAt: string | null;
  detailOccurrences: BochumScheduling[];
};

type BochumSourceCard = {
  ident: string;
  sourceUrl: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  venueName: string | null;
  venueAddress: string | null;
  externalUrl: string | null;
  ticketUrl: string | null;
  notes: string | null;
  categories: string[];
  lat: number | null;
  lng: number | null;
  sourceUpdatedAt: string | null;
  occurrence: BochumScheduling;
};

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
    .replace(/&nbsp;/g, " ");
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

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml,application/xml",
    },
  });

  if (!response.ok) {
    throw new Error(`[bochum_tourism] HTTP ${response.status} fuer ${url}`);
  }

  return response.text();
}

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
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

function berlinIsoFromEpochSeconds(value: string | null | undefined) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const date = new Date(seconds * 1000);
  const local = berlinLocalParts(date);
  return berlinIso(local.year, local.month, local.day, local.hour, local.minute);
}

function parseLocalDateTime(value: string | null | undefined) {
  const match = normalizeText(value).match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;
  return berlinIso(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5])
  );
}

function dedupeOccurrences(occurrences: BochumScheduling[]) {
  const byStart = new Map<string, BochumScheduling>();
  for (const occurrence of occurrences) {
    byStart.set(occurrence.startAt, occurrence);
  }
  return Array.from(byStart.values()).sort((left, right) => left.startAt.localeCompare(right.startAt));
}

function parseLocationText(block: string) {
  const raw =
    block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? block.match(/<header[^>]*>([\s\S]*?)<\/header>/i)?.[1] ?? "";
  const paragraph = stripTags(raw.replace(/<br\s*\/?>/gi, ", "));
  return paragraph || null;
}

function parseTitle(block: string) {
  return stripTags(block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? "");
}

function parseDateText(block: string) {
  return stripTags(block.match(/<strong[^>]*class="[^"]*poi-list-item-date[^"]*"[^>]*>([\s\S]*?)<\/strong>/i)?.[1] ?? "");
}

function parseListingOccurrence(block: string) {
  const startAt = berlinIsoFromEpochSeconds(
    block.match(/data-filter-start-date="([^"]+)"/i)?.[1] ?? null
  );
  if (!startAt) return null;

  const endAt = berlinIsoFromEpochSeconds(block.match(/data-filter-end-date="([^"]+)"/i)?.[1] ?? null);

  return {
    startAt,
    endAt,
    allDay: false,
    label: parseDateText(block) || null,
  } satisfies BochumScheduling;
}

function parseCategories(block: string) {
  const raw = decodeHtml(block.match(/data-filter-category="([^"]+)"/i)?.[1] ?? "");
  return Array.from(
    new Set(
      raw
        .split(/[|,/]+/)
        .map((value) => normalizeText(value))
        .filter(Boolean)
    )
  );
}

function parseListingCards(html: string, baseUrl: string) {
  const cards: BochumListingCard[] = [];
  const matches = Array.from(
    html.matchAll(
      /<article[^>]+class="[^"]*poi-list-item[^"]*event-list-item[^"]*"[\s\S]*?<\/article>/gi
    )
  );

  for (const match of matches) {
    const block = match[0];
    const href = toAbsoluteUrl(block.match(/<a[^>]+href="([^"]+)"/i)?.[1] ?? null, baseUrl);
    const title = parseTitle(block);
    const occurrence = parseListingOccurrence(block);
    if (!href || !title || !occurrence) continue;

    const ident =
      href.match(/\/veranstaltung\/([^/?#]+)\.html/i)?.[1] ??
      href.match(/\/([^/?#]+)\.html/i)?.[1] ??
      href;

    cards.push({
      ident,
      sourceUrl: href,
      title,
      subtitle: null,
      summary: null,
      locationText: parseLocationText(block),
      categories: parseCategories(block),
      listingOccurrences: [occurrence],
    });
  }

  return cards;
}

function mergeListingCards(cards: BochumListingCard[]) {
  const byId = new Map<string, BochumListingCard>();

  for (const card of cards) {
    const existing = byId.get(card.ident);
    if (!existing) {
      byId.set(card.ident, card);
      continue;
    }

    existing.categories = Array.from(new Set([...existing.categories, ...card.categories]));
    existing.listingOccurrences = dedupeOccurrences([
      ...existing.listingOccurrences,
      ...card.listingOccurrences,
    ]);
    if (!existing.locationText && card.locationText) existing.locationText = card.locationText;
  }

  return Array.from(byId.values());
}

function parseTitleBlock(html: string) {
  const match = html.match(/<h2[^>]*>([\s\S]*?)<small>([\s\S]*?)<\/small>[\s\S]*?<\/h2>/i);
  if (match) {
    return {
      title: stripTags(match[1]),
      subtitle: stripTags(match[2]) || null,
    };
  }

  const titleOnly = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  return {
    title: stripTags(titleOnly?.[1] ?? ""),
    subtitle: null,
  };
}

function parseDescription(html: string) {
  const blocks = Array.from(
    html.matchAll(/<div[^>]+class="[^"]*ce-bodytext[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)
  )
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
    .filter((text) => !/^termine$/i.test(text) && !/^anmerkungen$/i.test(text));

  return blocks.sort((left, right) => right.length - left.length)[0] ?? null;
}

function parseButtons(html: string, baseUrl: string) {
  const buttons = Array.from(
    html.matchAll(/<a[^>]+class="[^"]*btn[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)
  );

  let externalUrl: string | null = null;
  let ticketUrl: string | null = null;

  for (const button of buttons) {
    const href = toAbsoluteUrl(button[1], baseUrl);
    const label = stripTags(button[2]).toLowerCase();
    if (!href) continue;
    if (!externalUrl && /website/.test(label)) externalUrl = href;
    if (!ticketUrl && /(kartenvorverkauf|tickets?|buchung)/.test(label)) ticketUrl = href;
  }

  return { externalUrl, ticketUrl };
}

function parseNotes(html: string) {
  const block = html.match(/Anmerkungen<\/h2>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i);
  if (!block) return null;
  const items = Array.from(block[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi))
    .map((match) => stripTags(match[1]))
    .filter(Boolean);
  return items.join(" | ") || null;
}

function parseMapQuery(html: string) {
  const src = html.match(/<iframe[^>]+src="([^"]*google\.com\/maps[^"]*)"/i)?.[1];
  if (!src) return null;

  try {
    const decodedUrl = decodeHtml(src);
    const url = new URL(decodedUrl);
    const query = url.searchParams.get("q");
    return query ? normalizeText(decodeURIComponent(query.replace(/\+/g, " "))) : null;
  } catch {
    return null;
  }
}

function extractAddress(text: string | null) {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  const postalMatch = normalized.match(/\d{5}\s+Bochum/i);
  if (postalMatch?.index != null) {
    const postalIndex = postalMatch.index;
    const beforePostal = normalized.slice(0, postalIndex);
    const lastComma = beforePostal.lastIndexOf(",");
    const lastSemicolon = beforePostal.lastIndexOf(";");
    const lastDelimiter = Math.max(lastComma, lastSemicolon);
    if (lastDelimiter >= 0) {
      const previousSlice = beforePostal.slice(0, lastDelimiter);
      const previousComma = previousSlice.lastIndexOf(",");
      const previousSemicolon = previousSlice.lastIndexOf(";");
      const previousDelimiter = Math.max(previousComma, previousSemicolon);
      const addressStart = previousDelimiter >= 0 ? previousDelimiter + 1 : 0;
      const candidate = normalizeText(normalized.slice(addressStart));
      if (candidate) return candidate;
    }
  }

  const fallback = normalized.match(
    /([A-Za-zÄÖÜäöüß0-9 .()/-]*(?:straße|str\.?|platz|weg|allee|ring|ufer|gasse|damm|markt|stieg|pfad|promenade|steig)[A-Za-zÄÖÜäöüß0-9 .()/-]*\d*[A-Za-zÄÖÜäöüß0-9/-]*,?\s*\d{5}\s+Bochum)/i
  );
  return fallback ? normalizeText(fallback[1]) : null;
}

function splitVenueAndAddress(rawText: string | null) {
  const normalized = normalizeText(rawText);
  if (!normalized) {
    return { venueName: null, venueAddress: null };
  }

  const venueAddress = extractAddress(normalized);
  if (!venueAddress) {
    return {
      venueName: normalized,
      venueAddress: null,
    };
  }

  const venueName = normalizeText(
    normalized
      .replace(venueAddress, "")
      .replace(/[;,]\s*$/, "")
  );

  return {
    venueName: venueName || null,
    venueAddress,
  };
}

function parseDetailOccurrences(html: string) {
  const occurrences: BochumScheduling[] = [];
  const dayGroups = Array.from(
    html.matchAll(/<h3[^>]*>([^<]*\d{2}\.\d{2}\.\d{4}[^<]*)<\/h3>\s*<ul[^>]*>([\s\S]*?)<\/ul>/gi)
  );

  for (const dayGroup of dayGroups) {
    const dayLabel = stripTags(dayGroup[1]);
    const times = Array.from(
      dayGroup[2].matchAll(/<time[^>]*datetime="([^"]+)"[^>]*>([\s\S]*?)<\/time>/gi)
    );
    if (times.length === 0) continue;

    const startAt = parseLocalDateTime(times[0][1]);
    if (!startAt) continue;

    const endAt = times.length > 1 ? parseLocalDateTime(times[times.length - 1][1]) : null;
    const label = [dayLabel, ...times.map((time) => stripTags(time[2]))]
      .filter(Boolean)
      .join(" ")
      .trim();

    occurrences.push({
      startAt,
      endAt,
      allDay: false,
      label: label || null,
    });
  }

  return dedupeOccurrences(occurrences);
}

async function enrichCard(card: BochumListingCard) {
  try {
    const html = await fetchHtml(card.sourceUrl);
    const titleBlock = parseTitleBlock(html);
    const mapQuery = parseMapQuery(html);
    const detailVenueParts = splitVenueAndAddress(titleBlock.subtitle);
    const mapVenueParts = splitVenueAndAddress(mapQuery);
    const buttons = parseButtons(html, card.sourceUrl);

    return {
      summary: parseDescription(html) ?? card.summary,
      venueName:
        detailVenueParts.venueName ??
        mapVenueParts.venueName ??
        splitVenueAndAddress(card.locationText).venueName,
      venueAddress:
        detailVenueParts.venueAddress ??
        mapVenueParts.venueAddress ??
        splitVenueAndAddress(card.locationText).venueAddress,
      externalUrl: buttons.externalUrl,
      ticketUrl: buttons.ticketUrl,
      notes: parseNotes(html),
      categories: card.categories,
      lat: null,
      lng: null,
      sourceUpdatedAt: null,
      detailOccurrences: parseDetailOccurrences(html),
    } satisfies BochumDetailEnrichment;
  } catch (error) {
    console.warn(
      `[bochum_tourism] Detail-Enrichment fehlgeschlagen fuer ${card.sourceUrl}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return {
      summary: card.summary,
      venueName: splitVenueAndAddress(card.locationText).venueName,
      venueAddress: splitVenueAndAddress(card.locationText).venueAddress,
      externalUrl: null,
      ticketUrl: null,
      notes: null,
      categories: card.categories,
      lat: null,
      lng: null,
      sourceUpdatedAt: null,
      detailOccurrences: [],
    } satisfies BochumDetailEnrichment;
  }
}

async function enrichCards(cards: BochumListingCard[]) {
  const enriched: Array<BochumListingCard & BochumDetailEnrichment> = [];

  for (const batch of chunk(cards, DETAIL_BATCH_SIZE)) {
    const settled = await Promise.all(
      batch.map(async (card) => ({
        card,
        detail: await enrichCard(card),
      }))
    );

    for (const item of settled) {
      enriched.push({
        ...item.card,
        ...item.detail,
      });
    }
  }

  return enriched;
}

function explodeCards(cards: Array<BochumListingCard & BochumDetailEnrichment>) {
  const exploded: BochumSourceCard[] = [];

  for (const card of cards) {
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
        notes: card.notes,
        categories: card.categories,
        lat: card.lat,
        lng: card.lng,
        sourceUpdatedAt: card.sourceUpdatedAt,
        occurrence,
      });
    }
  }

  return exploded;
}

function categoryFromText(text: string, categories: string[]) {
  const normalized = text.toLowerCase();
  const categoryText = categories.join(" ").toLowerCase();

  if (
    /(markt\b|flohmarkt|tr[oö]del|basar|jahrmarkt)/.test(categoryText) ||
    /(markt\b|flohmarkt|tr[oö]del|basar|jahrmarkt)/.test(normalized)
  ) {
    return "market";
  }
  if (
    /(rock|pop|konzert|klassisches konzert|weitere konzerte|jazz|orchester|chor)/.test(
      categoryText + " " + normalized
    )
  ) {
    return "concert";
  }
  if (
    /(schauspiel|ballett|tanztheater|oper|musiktheater|theater)/.test(categoryText) ||
    /(schauspiel|theater|oper|ballett|tanztheater|musiktheater|puppentheater|inszenierung|st[üu]ck\b)/.test(
      normalized
    )
  ) {
    return "theater";
  }
  if (
    /(kabarett|kino|filmkunst|vortrag|lesung|musical|show|comedy|performance|kinderprogramm|party|nightlife)/.test(
      categoryText + " " + normalized
    )
  ) {
    return "show";
  }
  if (
    /(festival|open-air|stadtfest|kirmes|fest\/ball|fest\b)/.test(categoryText) ||
    /(festival|open air|stadtfest|kirmes|maiabendfest|fest\b)/.test(normalized)
  ) {
    return "festival";
  }
  if (/(genuss|gourmet|street food|wein|bier|kulinar|tasting)/.test(categoryText + " " + normalized)) {
    return "food_event";
  }
  if (/(ausstellung|messe|kongress|expo|galerie|museum)/.test(categoryText + " " + normalized)) {
    return "fair";
  }
  if (/(f[üu]hrung|besichtigung|workshop|kurs|seminar|treffen|dialog|spiel|community)/.test(categoryText + " " + normalized)) {
    return "community";
  }
  if (/(weihnacht|advent|oster|fruehling|frühling|sommer|herbst|winter)/.test(normalized)) {
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

function subtypesForCard(card: BochumSourceCard, category: OfficialCityEvent["category"]) {
  const text = [
    card.title,
    card.summary,
    card.venueName,
    card.venueAddress,
    card.notes,
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
        /flohmarkt|tr[oö]del|jahrmarkt/.test(text) ? "market_event" : null,
        /festival|stadtfest|kirmes|open air|maiabendfest/.test(text) ? "festival_event" : null,
        /f[üu]hrung|besichtigung|tour\b/.test(text) ? "guided_tour" : null,
        /ausstellung|museum|galerie/.test(text) ? "exhibition" : null,
        /kino|film/.test(text) ? "screening" : null,
        /vortrag|lesung/.test(text) ? "talk" : null,
        /workshop|kurs|seminar/.test(text) ? "workshop" : null,
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

export async function fetchBochumTourismEvents(config: EventSourceConfigRow) {
  const html = await fetchHtml(config.base_url);
  const listingCards = parseListingCards(html, config.base_url);
  const merged = mergeListingCards(listingCards);
  return explodeCards(await enrichCards(merged));
}

export function normalizeBochumTourismEvent(
  card: BochumSourceCard,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const startAt = normalizeText(card.occurrence.startAt);
  if (!startAt) return null;

  const text = [
    card.title,
    card.summary,
    card.venueName,
    card.venueAddress,
    card.notes,
    ...card.categories,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const category = categoryFromText(text, card.categories);
  if (category === "other") return null;

  const audiences = audiencesForCategory(category, text);
  const scores = scoresForCategory(category);
  const isFree = /eintritt frei|kostenlos/.test(text);

  return {
    source: config.provider,
    external_id: `bochum_tourism:${card.ident}:${startAt}`,
    source_url: card.sourceUrl,
    ticket_url: card.ticketUrl ?? card.externalUrl,
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
      !isFree &&
      Boolean(
        (card.ticketUrl ?? card.externalUrl) ||
          /(ticket|karten|eintritt|reservierung|anmeldung)/.test(text)
      ),
    price_min: null,
    price_max: null,
    currency: null,
    family_friendly: audiences.includes("family"),
    indoor_outdoor:
      /(markt|open air|platz|park|ufer|outdoor|freiluft|jahrmarkt|stadtfest)/.test(text)
        ? "outdoor"
        : /(theater|kino|museum|zentrum|halle|saal|bibliothek)/.test(text)
          ? "indoor"
          : null,
    local_rank: scores.localRank,
    importance_score: scores.importance,
    popularity_score: scores.popularity,
    tags: Array.from(
      new Set(
        ["bochum_tourism", category, card.venueName ?? "", ...card.categories]
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
