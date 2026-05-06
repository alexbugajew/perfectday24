import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type MannheimFeedItem = {
  title: string;
  sourceUrl: string;
  summary: string | null;
};

type MannheimCategoryConfig = {
  id: string;
  label: string;
  category: OfficialCityEvent["category"];
  maxPages: number;
};

type MannheimListingCard = {
  ident: string;
  sourceUrl: string;
  title: string;
  dateText: string | null;
  timeText: string | null;
  venueName: string | null;
  venueAddress: string | null;
  summary: string | null;
  sourceCategory: OfficialCityEvent["category"];
  sourceCategoryLabel: string;
};

const MANNHEIM_RSS_URL = "https://www.mannheim.de/de/rss/veranstaltungen";

const MANNHEIM_CATEGORY_CONFIGS: MannheimCategoryConfig[] = [
  { id: "898", label: "Musik & Konzerte", category: "concert", maxPages: 3 },
  { id: "899", label: "Musical, Oper & Operette", category: "show", maxPages: 3 },
  { id: "906", label: "Theater & Schauspiel", category: "theater", maxPages: 3 },
  { id: "905", label: "Tanz & Ballett", category: "show", maxPages: 2 },
  { id: "893", label: "Kleinkunst & Kabarett", category: "show", maxPages: 2 },
  { id: "892", label: "Kino & Film", category: "show", maxPages: 2 },
  { id: "889", label: "Clubs & Partys", category: "festival", maxPages: 2 },
  { id: "890", label: "Feste & Festival", category: "festival", maxPages: 3 },
  { id: "895", label: "Maerkte & Flohmaerkte", category: "market", maxPages: 3 },
  { id: "896", label: "Messen & Kongresse", category: "fair", maxPages: 2 },
  { id: "897", label: "Museen & Ausstellungen", category: "fair", maxPages: 3 },
  { id: "891", label: "Freizeitaktivitaeten", category: "community", maxPages: 2 },
  { id: "908", label: "Vortraege & Fuehrungen", category: "community", maxPages: 2 },
];

const CATEGORY_PRIORITY: Record<OfficialCityEvent["category"], number> = {
  concert: 90,
  theater: 88,
  show: 86,
  market: 84,
  festival: 82,
  fair: 76,
  food_event: 78,
  community: 68,
  seasonal: 64,
  other: 10,
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

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml,application/rss+xml,application/xml",
    },
  });

  if (!response.ok) {
    throw new Error(`[mannheim_tourism] HTTP ${response.status} fuer ${url}`);
  }

  return response.text();
}

function parseFeedItems(xml: string) {
  const items: MannheimFeedItem[] = [];
  const matches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi));

  for (const match of matches) {
    const block = match[1];
    const title = stripTags(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1]);
    const sourceUrl = normalizeText(decodeHtml(block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? ""));
    const summary = stripTags(block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "") || null;

    if (!title || !sourceUrl) continue;
    items.push({ title, sourceUrl, summary });
  }

  return items;
}

function summaryLookupFromFeed(items: MannheimFeedItem[]) {
  return new Map(items.map((item) => [item.sourceUrl, item.summary] satisfies [string, string | null]));
}

function buildCategoryPageUrl(baseUrl: string, category: MannheimCategoryConfig, pageIndex: number) {
  const url = new URL(baseUrl);
  url.searchParams.set("f[0]", `category:${category.id}`);
  if (pageIndex > 0) {
    url.searchParams.set("page", String(pageIndex));
  }
  return url.toString();
}

function parseListingCards(
  html: string,
  baseUrl: string,
  category: MannheimCategoryConfig,
  summaryLookup: Map<string, string | null>
) {
  const cards: MannheimListingCard[] = [];
  const matches = Array.from(
    html.matchAll(/<h3><a href="(\/de\/veranstaltung\/[^"]+)"[^>]*>([\s\S]*?)<\/a><\/h3>\s*<ul class="teaser__meta icon-list">([\s\S]*?)<\/ul>/gi)
  );

  for (const match of matches) {
    const href = match[1];
    const title = stripTags(match[2]);
    const meta = match[3];
    const sourceUrl = normalizeAbsoluteUrl(href, baseUrl);
    if (!title || !sourceUrl) continue;

    const dateText =
      stripTags(meta.match(/#icon-calendar[\s\S]*?<\/svg>\s*([\s\S]*?)<\/li>/i)?.[1] ?? "") || null;
    const timeText =
      stripTags(meta.match(/#icon-clock[\s\S]*?<\/svg>\s*([\s\S]*?)<\/li>/i)?.[1] ?? "") || null;
    const addressBlock = meta.match(/<p class="address"[\s\S]*?>([\s\S]*?)<\/p>/i)?.[1] ?? "";
    const venueName = stripTags(addressBlock.match(/<span class="organization">([\s\S]*?)<\/span>/i)?.[1] ?? "") || null;
    const street = stripTags(addressBlock.match(/<span class="address-line1">([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const postalCode = stripTags(addressBlock.match(/<span class="postal-code">([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const locality = stripTags(addressBlock.match(/<span class="locality">([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const venueAddress = [street, [postalCode, locality].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null;

    cards.push({
      ident: sourceUrl,
      sourceUrl,
      title,
      dateText,
      timeText,
      venueName,
      venueAddress,
      summary: summaryLookup.get(sourceUrl) ?? null,
      sourceCategory: category.category,
      sourceCategoryLabel: category.label,
    });
  }

  return cards;
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

function defaultTimeForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "show" || category === "theater") return "19:30";
  if (category === "festival" || category === "market" || category === "fair" || category === "food_event") {
    return "12:00";
  }
  return "17:00";
}

function parseDateTime(dateText: string | null, timeText: string | null, category: OfficialCityEvent["category"]) {
  const normalizedDate = normalizeText(dateText);
  const dateMatch = normalizedDate.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!dateMatch) return null;

  const [, dayText, monthText, yearText] = dateMatch;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const normalizedTime = normalizeText(timeText);
  const range = normalizedTime.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  const single = normalizedTime.match(/(\d{1,2}):(\d{2})/);
  const startHour = Number(range?.[1] ?? single?.[1] ?? defaultTimeForCategory(category).slice(0, 2));
  const startMinute = Number(range?.[2] ?? single?.[2] ?? defaultTimeForCategory(category).slice(3, 5));

  return {
    startAt: berlinIso(year, month, day, startHour, startMinute),
    endAt:
      range != null
        ? berlinIso(year, month, day, Number(range[3]), Number(range[4]))
        : null,
    allDay: !range && !single,
  };
}

function inferredCategoryFromText(text: string) {
  const normalized = text.toLowerCase();
  if (/(markt|flohmarkt|wochenmarkt|basar)/.test(normalized)) return "market";
  if (/(festival|fest|open air|party|kirmes)/.test(normalized)) return "festival";
  if (/(food|wein|kulinar|brunch|dinner|fruehstueck|frühstück|tasting)/.test(normalized)) return "food_event";
  if (/(konzert|band|orchester|philharmonie|chor|jazz|abo-konzert)/.test(normalized)) return "concert";
  if (/(theater|schauspiel|oper|operette)/.test(normalized)) return "theater";
  if (/(show|musical|film|kino|kabarett|comedy|ballett|tanz)/.test(normalized)) return "show";
  if (/(messe|kongress|ausstellung|museum|galerie|vernissage|leica|grafiken)/.test(normalized)) return "fair";
  if (/(fuehrung|führung|vortrag|workshop|stadt safari|segway|treff|cafe colibri)/.test(normalized)) return "community";
  if (/(weihnacht|advent|sommer|winter|fruehling|frühling)/.test(normalized)) return "seasonal";
  return "other";
}

function resolveCategory(card: MannheimListingCard) {
  const inferred = inferredCategoryFromText(`${card.title} ${card.summary ?? ""}`);
  return inferred === "other" ? card.sourceCategory : inferred;
}

function kindForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") {
    return "anchored_event" as const;
  }
  return "flex_event" as const;
}

function audiencesForCategory(category: OfficialCityEvent["category"], text: string) {
  const normalized = text.toLowerCase();
  if (/famil|kinder|jugend/.test(normalized)) return ["family", "tourism"];
  if (category === "concert" || category === "show") return ["date", "friends", "party"];
  if (category === "theater") return ["date", "tourism"];
  if (category === "market" || category === "festival" || category === "fair" || category === "food_event") {
    return ["tourism", "friends", "family", "date"];
  }
  return ["tourism", "friends"];
}

function occasionsForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "show") return ["date", "friends", "party"];
  if (category === "theater") return ["date", "tourism"];
  if (category === "market" || category === "festival" || category === "fair" || category === "food_event") {
    return ["tourism", "friends", "family", "date"];
  }
  return ["tourism", "friends"];
}

function subtypesForCategory(category: OfficialCityEvent["category"], text: string) {
  const normalized = text.toLowerCase();
  return Array.from(
    new Set(
      [
        "concrete_event_page",
        category,
        /markt|flohmarkt/.test(normalized) ? "market_event" : null,
        /festival|fest|open air/.test(normalized) ? "festival_event" : null,
        /musical|show|film|kino|kabarett|ballett/.test(normalized) ? "show_event" : null,
        /fuehrung|führung|stadt safari|segway/.test(normalized) ? "guided_tour" : null,
        /messe|kongress|ausstellung/.test(normalized) ? "exhibition" : null,
      ].filter((value): value is string => Boolean(value))
    )
  );
}

function mergeCards(cards: MannheimListingCard[]) {
  const byId = new Map<string, MannheimListingCard>();

  for (const card of cards) {
    const existing = byId.get(card.ident);
    if (!existing) {
      byId.set(card.ident, card);
      continue;
    }

    const winner =
      CATEGORY_PRIORITY[resolveCategory(card)] > CATEGORY_PRIORITY[resolveCategory(existing)] ? card : existing;
    byId.set(card.ident, {
      ...winner,
      summary: winner.summary ?? existing.summary ?? card.summary ?? null,
    });
  }

  return Array.from(byId.values());
}

export async function fetchMannheimTourismEvents(config: EventSourceConfigRow) {
  const feedItems = parseFeedItems(await fetchText(MANNHEIM_RSS_URL));
  const summaries = summaryLookupFromFeed(feedItems);
  const cards: MannheimListingCard[] = [];

  for (const category of MANNHEIM_CATEGORY_CONFIGS) {
    for (let pageIndex = 0; pageIndex < category.maxPages; pageIndex += 1) {
      const url = buildCategoryPageUrl(config.base_url, category, pageIndex);
      const html = await fetchText(url);
      const pageCards = parseListingCards(html, config.base_url, category, summaries);
      if (pageCards.length === 0) break;
      cards.push(...pageCards);
    }
  }

  return mergeCards(cards);
}

export function normalizeMannheimTourismEvent(
  card: MannheimListingCard,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const category = resolveCategory(card);
  const schedule = parseDateTime(card.dateText, card.timeText, category);
  if (!schedule) return null;

  const text = `${card.title} ${card.summary ?? ""} ${card.sourceCategoryLabel}`;
  const audiences = audiencesForCategory(category, text);

  return {
    source: config.provider,
    external_id: `mannheim_tourism:${card.ident}`,
    source_url: card.sourceUrl,
    ticket_url: null,
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
    start_at: schedule.startAt,
    end_at: schedule.endAt,
    doors_at: null,
    all_day: schedule.allDay,
    is_ticketed: false,
    price_min: null,
    price_max: null,
    currency: null,
    family_friendly: audiences.includes("family"),
    indoor_outdoor:
      /(markt|flohmarkt|open air|festival|segway|stadt safari)/i.test(text) ? "outdoor" : null,
    local_rank: 80,
    importance_score: 78,
    popularity_score: 74,
    tags: Array.from(
      new Set(
        [
          "mannheim_tourism",
          card.sourceCategoryLabel,
          category,
          card.venueName ?? "",
        ].filter(Boolean)
      )
    ),
    subtypes: subtypesForCategory(category, text),
    audiences,
    occasions: occasionsForCategory(category),
    source_payload: card,
    source_updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  };
}
