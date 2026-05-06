import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type BielefeldScheduling = {
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  label: string | null;
};

type BielefeldListingCard = {
  ident: string;
  sourceUrl: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  locationText: string | null;
  listingOccurrences: BielefeldScheduling[];
};

type BielefeldDetailEnrichment = {
  summary: string | null;
  venueName: string | null;
  venueAddress: string | null;
  externalUrl: string | null;
  organizer: string | null;
  categories: string[];
  lat: number | null;
  lng: number | null;
  sourceUpdatedAt: string | null;
  detailOccurrences: BielefeldScheduling[];
};

type BielefeldSourceCard = {
  ident: string;
  sourceUrl: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  venueName: string | null;
  venueAddress: string | null;
  externalUrl: string | null;
  organizer: string | null;
  categories: string[];
  lat: number | null;
  lng: number | null;
  sourceUpdatedAt: string | null;
  occurrence: BielefeldScheduling;
};

const LOOKAHEAD_DAYS = 45;
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

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml,application/xml",
    },
  });

  if (!response.ok) {
    throw new Error(`[bielefeld_jetzt] HTTP ${response.status} fuer ${url}`);
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

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function buildDayUrl(baseUrl: string, dateString: string) {
  return `${baseUrl.replace(/\/+$/, "")}/datum/${dateString}`;
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

  const range = normalized.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (range) {
    return {
      startTime: `${range[1]}:${range[2]}`,
      endTime: `${range[3]}:${range[4]}`,
      allDay: false,
    };
  }

  const single = normalized.match(/(\d{1,2}):(\d{2})/);
  if (single) {
    return {
      startTime: `${single[1]}:${single[2]}`,
      endTime: null,
      allDay: false,
    };
  }

  return {
    startTime: null,
    endTime: null,
    allDay: true,
  };
}

function parseListingOccurrence(dateString: string, timeText: string | null) {
  const dateMatch = normalizeText(dateString).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const range = parseTimeRange(timeText);
  const startTime = range.startTime ? range.startTime.split(":").map(Number) : [12, 0];
  const endTime = range.endTime ? range.endTime.split(":").map(Number) : null;

  return {
    startAt: berlinIso(year, month, day, startTime[0], startTime[1]),
    endAt: endTime ? berlinIso(year, month, day, endTime[0], endTime[1]) : null,
    allDay: range.allDay,
    label: [dateString, normalizeText(timeText)].filter(Boolean).join(" ").trim() || null,
  } satisfies BielefeldScheduling;
}

function parseDetailOccurrence(label: string) {
  const normalized = normalizeText(label);
  const dateMatch = normalized.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!dateMatch) return null;

  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  const range = parseTimeRange(normalized);
  const startTime = range.startTime ? range.startTime.split(":").map(Number) : [12, 0];
  const endTime = range.endTime ? range.endTime.split(":").map(Number) : null;

  return {
    startAt: berlinIso(year, month, day, startTime[0], startTime[1]),
    endAt: endTime ? berlinIso(year, month, day, endTime[0], endTime[1]) : null,
    allDay: range.allDay,
    label: normalized || null,
  } satisfies BielefeldScheduling;
}

function dedupeOccurrences(occurrences: BielefeldScheduling[]) {
  const byStart = new Map<string, BielefeldScheduling>();
  for (const occurrence of occurrences) {
    byStart.set(occurrence.startAt, occurrence);
  }
  return Array.from(byStart.values()).sort((left, right) => left.startAt.localeCompare(right.startAt));
}

function parseListingCards(html: string, baseUrl: string, dateString: string) {
  const cards: BielefeldListingCard[] = [];
  const parts = html.split('<div class="masonry-item').slice(1);

  for (const part of parts) {
    const block = part.slice(0, 9000);
    const nodeId = normalizeText(block.match(/data-node-id="([^"]+)"/i)?.[1] ?? "");
    const href = block.match(/<a class="box-item" href="([^"]+)"/i)?.[1] ?? null;
    const title = stripTags(block.match(/<h3 class="mb-3">([\s\S]*?)<\/h3>/i)?.[1] ?? "");
    const subtitle =
      stripTags(block.match(/<p class="mb-3">([\s\S]*?)<\/p>/i)?.[1] ?? "") || null;
    const timeText =
      stripTags(block.match(/<p class="mb-2">[\s\S]*?<\/i>\s*([\s\S]*?)<\/p>/i)?.[1] ?? "") || null;
    const locationText =
      stripTags(
        block.match(/<p class="mb-1 d-inline">[\s\S]*?<\/i>\s*([\s\S]*?)<\/p>/i)?.[1] ?? ""
      ) || null;

    if (!href || !title) continue;
    const sourceUrl = toAbsoluteUrl(href, baseUrl);
    if (!sourceUrl) continue;

    const occurrence = parseListingOccurrence(dateString, timeText);
    if (!occurrence) continue;

    cards.push({
      ident: nodeId || sourceUrl,
      sourceUrl,
      title,
      subtitle,
      summary: subtitle,
      locationText,
      listingOccurrences: [occurrence],
    });
  }

  return cards;
}

function mergeListingCards(cards: BielefeldListingCard[]) {
  const bySource = new Map<string, BielefeldListingCard>();

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

function parseMapCenter(html: string) {
  const match = html.match(/"bielefeld_karte":\{"map\d+":\{"mapData":\{"zoom":\d+,"center":\{"lat":([0-9.\-]+),"lng":([0-9.\-]+)\}/i);
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

function parseDetailOccurrences(termsHtml: string) {
  const occurrences = Array.from(
    termsHtml.matchAll(/<div\s+class="node node--type-veranstaltungstermin[\s\S]*?<strong>([\s\S]*?)<\/strong>/gi)
  )
    .map((match) => parseDetailOccurrence(stripTags(match[1])))
    .filter((item): item is BielefeldScheduling => Boolean(item));

  return dedupeOccurrences(occurrences);
}

function parseInfoItems(infoHtml: string) {
  return Array.from(infoHtml.matchAll(/<div class="info">([\s\S]*?)<\/div>/gi)).map((match) => ({
    html: match[1],
    text: stripTags(match[1]),
  }));
}

function extractExternalUrlFromInfo(infoHtml: string, sourceUrl: string) {
  const href = infoHtml.match(/<a[^>]+href="([^"]+)"/i)?.[1] ?? null;
  return toAbsoluteUrl(href, sourceUrl);
}

async function enrichListingCard(card: BielefeldListingCard): Promise<BielefeldDetailEnrichment> {
  try {
    const html = await fetchHtml(card.sourceUrl);
    const mapHtml = extractSection(html, 'id="karte"', ['id="infos"', 'id="termine"']);
    const infoHtml = extractSection(html, 'id="infos"', ['id="termine"', 'block-block-content']);
    const termsHtml = extractSection(html, 'id="termine"', ['block-block-content', "</article>"]);
    const infoItems = parseInfoItems(infoHtml);
    const mapName =
      stripTags(
        mapHtml.match(/<div class="info-veranstaltungsort[^"]*"[^>]*>[\s\S]*?<\/i>\s*([\s\S]*?)<\/div>/i)?.[1] ??
          ""
      ) || null;
    const coords = parseMapCenter(html);

    let venueAddress: string | null = null;
    let externalUrl: string | null = null;
    let organizer: string | null = null;
    const categories: string[] = [];

    for (const item of infoItems) {
      if (!item.text) continue;
      if (/^Veranstalter:/i.test(item.text)) {
        organizer = normalizeText(item.text.replace(/^Veranstalter:\s*/i, ""));
        continue;
      }
      if (/<a[^>]+href=/i.test(item.html)) {
        externalUrl = extractExternalUrlFromInfo(item.html, card.sourceUrl);
        continue;
      }
      if (/\d{5}\s+Bielefeld/i.test(item.text)) {
        venueAddress = item.text;
        continue;
      }
      categories.push(item.text);
    }

    const title = stripTags(html.match(/<h1 class="veranstaltung-title">([\s\S]*?)<\/h1>/i)?.[1] ?? "");
    const subtitle =
      stripTags(html.match(/<p class="veranstaltung-untertitel[^"]*">([\s\S]*?)<\/p>/i)?.[1] ?? "") || null;
    const body =
      stripTags(html.match(/<div class="veranstaltung-body">([\s\S]*?)<\/div>/i)?.[1] ?? "") || null;
    const occurrences = parseDetailOccurrences(termsHtml);

    return {
      summary: [subtitle, body].filter(Boolean).join(" ").trim() || title || null,
      venueName: mapName ?? card.locationText ?? null,
      venueAddress: venueAddress ?? mapName ?? card.locationText ?? null,
      externalUrl,
      organizer,
      categories,
      lat: coords.lat,
      lng: coords.lng,
      sourceUpdatedAt: null,
      detailOccurrences: occurrences,
    };
  } catch {
    return {
      summary: card.summary,
      venueName: card.locationText ?? null,
      venueAddress: card.locationText ?? null,
      externalUrl: null,
      organizer: null,
      categories: [],
      lat: null,
      lng: null,
      sourceUpdatedAt: null,
      detailOccurrences: [],
    };
  }
}

async function enrichCards(cards: BielefeldListingCard[]) {
  const enriched: Array<BielefeldListingCard & BielefeldDetailEnrichment> = [];

  for (const batch of chunk(cards, DETAIL_BATCH_SIZE)) {
    const results = await Promise.all(batch.map((card) => enrichListingCard(card)));
    for (let index = 0; index < batch.length; index += 1) {
      enriched.push({
        ...batch[index],
        ...results[index],
      });
    }
  }

  return enriched;
}

function explodeCards(cards: Array<BielefeldListingCard & BielefeldDetailEnrichment>) {
  const exploded: BielefeldSourceCard[] = [];

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
        organizer: card.organizer,
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

function categoryFromText(text: string): OfficialCityEvent["category"] {
  const normalized = text.toLowerCase();

  if (/(wochenmarkt|flohmarkt|jahrmarkt|markt\b|basar|tr[oö]del|kunsthandwerkmarkt|schallplattenflohmarkt|fahrradflohmarkt)/.test(normalized)) {
    return "market";
  }
  if (/(festival|fest\b|stadtfest|open air|kultursommer|festspiele|rausch|future week|feierabendmarkt)/.test(normalized)) {
    return "festival";
  }
  if (/(kulinar|food|brunch|dinner|genuss|wein|bier|tasting|street food)/.test(normalized)) {
    return "food_event";
  }
  if (/(konzert|band\b|orchester|chor\b|jazz|livemusik|live musik|philharm|bass\b|dj\b)/.test(normalized)) {
    return "concert";
  }
  if (/(theater|oper\b|operette|schauspiel|b[üu]hne|buehne|puppentheater|kabaretttheater)/.test(normalized)) {
    return "theater";
  }
  if (/(musical|comedy|kabarett|kino|film|lesung|poetry slam|slam\b|show\b|performance|zauber|karaoke|bilderbuchkino|talk\b)/.test(normalized)) {
    return "show";
  }
  if (/(ausstellung|museum|vernissage|messe|expo|kongress|science|galerie)/.test(normalized)) {
    return "fair";
  }
  if (/(weihnacht|advent|oster|fruehling|frühling|sommer|herbst|winter)/.test(normalized)) {
    return "seasonal";
  }
  if (/(workshop|yoga|kurs|gruppe|beratung|sprechstunde|treff|infostand|f[üu]hrung|fuehrung|rundgang|tour\b|sport\b|elterngruppe|dialog)/.test(normalized)) {
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

function subtypesForCard(card: BielefeldSourceCard, category: OfficialCityEvent["category"]) {
  const text = [card.title, card.subtitle, card.summary, ...card.categories].filter(Boolean).join(" ").toLowerCase();
  return Array.from(
    new Set(
      [
        "concrete_event_page",
        category,
        /wochenmarkt/.test(text) ? "weekly_market" : null,
        /flohmarkt|tr[oö]del|jahrmarkt/.test(text) ? "market_event" : null,
        /festival|fest\b|open air/.test(text) ? "festival_event" : null,
        /f[üu]hrung|fuehrung|rundgang|tour\b/.test(text) ? "guided_tour" : null,
        /ausstellung|museum|galerie/.test(text) ? "exhibition" : null,
        /kino|film|bilderbuchkino/.test(text) ? "screening" : null,
        /workshop|kurs|yoga/.test(text) ? "workshop" : null,
      ].filter((value): value is string => Boolean(value))
    )
  );
}

export async function fetchBielefeldJetztEvents(config: EventSourceConfigRow) {
  const today = new Date();
  const dateStrings = Array.from({ length: LOOKAHEAD_DAYS + 1 }, (_, index) =>
    berlinDateString(addDays(today, index))
  );

  const listingCards: BielefeldListingCard[] = [];
  for (const batch of chunk(dateStrings, LISTING_BATCH_SIZE)) {
    const pages = await Promise.all(
      batch.map(async (dateString) => ({
        dateString,
        html: await fetchHtml(buildDayUrl(config.base_url, dateString)),
      }))
    );

    for (const page of pages) {
      listingCards.push(...parseListingCards(page.html, config.base_url, page.dateString));
    }
  }

  const merged = mergeListingCards(listingCards);
  return explodeCards(await enrichCards(merged));
}

export function normalizeBielefeldJetztEvent(
  card: BielefeldSourceCard,
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

  const category = categoryFromText(text);
  if (category === "other") return null;

  const audiences = audiencesForCategory(category, text);

  return {
    source: config.provider,
    external_id: `bielefeld_jetzt:${card.ident}:${startAt}`,
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
    lat: card.lat,
    lng: card.lng,
    timezone: "Europe/Berlin",
    start_at: startAt,
    end_at: card.occurrence.endAt,
    doors_at: null,
    all_day: card.occurrence.allDay,
    is_ticketed: Boolean(card.externalUrl) || /(ticket|eintritt|reservierung|anmeldung|buchbar)/.test(text),
    price_min: null,
    price_max: null,
    currency: null,
    family_friendly: audiences.includes("family"),
    indoor_outdoor:
      /(markt|open air|platz|park|ufer|outdoor|freiluft)/.test(text)
        ? "outdoor"
        : /(theater|kino|museum|zentrum|halle|saal|bibliothek)/.test(text)
          ? "indoor"
          : null,
    local_rank: /(festival|markt|konzert|theater|show|oper|messe)/.test(text) ? 74 : 62,
    importance_score: /(festival|markt|konzert|theater|show|oper|messe)/.test(text) ? 70 : 60,
    popularity_score: /(festival|markt|konzert|theater|show|oper|messe)/.test(text) ? 64 : 54,
    tags: Array.from(
      new Set(
        ["bielefeld_jetzt", category, card.organizer ?? "", card.venueName ?? "", ...card.categories]
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
