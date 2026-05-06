import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type MuenchenCard = {
  sourceUrl: string | null;
  ticketUrl: string | null;
  title: string;
  venueName: string | null;
  startAt: string | null;
  endAt: string | null;
  displayStart: string | null;
  displayEnd: string | null;
  rangeStartAt: string | null;
  rangeEndAt: string | null;
  allDay: boolean;
};

function looksTimed(value: string | null) {
  return typeof value === "string" && /\b\d{1,2}:\d{2}\b/.test(value);
}

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
    .replace(/&gt;/g, ">");
}

function stripTags(text: string) {
  return normalizeText(decodeHtml(text.replace(/<[^>]+>/g, " ")));
}

function pad(value: string) {
  return value.padStart(2, "0");
}

function toBerlinIso(dateText: string | null, timeText: string | null) {
  if (!dateText) return null;
  const dateMatch = normalizeText(dateText).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!dateMatch) return null;
  const [, day, month, year] = dateMatch;
  const timeMatch = normalizeText(timeText).match(/(\d{1,2}):(\d{2})/);
  const hours = timeMatch?.[1] ?? "00";
  const minutes = timeMatch?.[2] ?? "00";
  return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00+02:00`;
}

function normalizeSourceUrl(url: string | null) {
  const value = normalizeText(url);
  if (!value) return null;
  if (value.startsWith("http")) return value;
  if (value.startsWith("/")) return `https://www.muenchen.de${value}`;
  return `https://www.muenchen.de/${value.replace(/^\/+/, "")}`;
}

function extractAnchorHref(block: string) {
  const directHref =
    block.match(/<a[^>]+itemprop="url"[^>]+href="([^"]+)"/i)?.[1] ??
    block.match(/<a[^>]+href="([^"]+)"[^>]+itemprop="url"/i)?.[1] ??
    block.match(/<h3[^>]*>\s*<a[^>]+href="([^"]+)"/i)?.[1] ??
    block.match(/<a[^>]+href="([^"]+)"/i)?.[1] ??
    null;
  return normalizeSourceUrl(directHref);
}

function categoryFromText(text: string): OfficialCityEvent["category"] {
  const normalized = text.toLowerCase();
  if (/(weihnacht|christmas|christkindl|oster|advent|markt|wochenmarkt|flohmarkt)/.test(normalized)) {
    return "market";
  }
  if (/(festival|fruehlingsfest|frühlingsfest|stadtfest|volksfest|maifest|open air kino|filmfest)/.test(normalized)) {
    return "festival";
  }
  if (/(food|street food|kulinar|genuss|brunch|dinner|tasting)/.test(normalized)) return "food_event";
  if (/(konzert|concert|band|orchester|jazz|quartet|philharmonie)/.test(normalized)) return "concert";
  if (/(theater|theatre|oper|schauspiel|ballett|ballet)/.test(normalized)) return "theater";
  if (/(show|musical|comedy|kabarett|circus|cirque|performance)/.test(normalized)) return "show";
  if (/(kirmes|funfair|jahrmarkt)/.test(normalized)) return "fair";
  if (/(winter|sommer|fruehling|frühling|herbst|saisonal|seasonal)/.test(normalized)) return "seasonal";
  if (/(familie|family|community|fuehrung|führung|kino|ausstellung|workshop)/.test(normalized)) return "community";
  return "other";
}

function kindForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") {
    return "anchored_event" as const;
  }
  return "flex_event" as const;
}

export async function fetchMuenchenDeEvents(config: EventSourceConfigRow) {
  const response = await fetch(config.base_url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`[muenchen_de] HTTP ${response.status} fuer ${config.base_url}`);
  }

  const html = await response.text();
  const blocks = Array.from(
    html.matchAll(
      /<div class="m-event-list-item" itemprop="event" itemscope="" itemtype="https:\/\/schema\.org\/Event">[\s\S]*?<\/div>\s*<\/li>/gi
    )
  );

  return blocks
    .map((match) => {
      const block = match[0];
      const title = stripTags(
        block.match(/<h3 class="m-event-list-item__headline" itemprop="name">([\s\S]*?)<\/h3>/i)?.[1] ?? ""
      );
      const sourceUrl = extractAnchorHref(block);
      const ticketUrl =
        normalizeText(block.match(/<a href="([^"]*(?:muenchenticket|ticket|tickets)[^"]+)"/i)?.[1] ?? "") || null;
      const venueName =
        stripTags(
          block.match(/<p class="m-event-list-item__detail" itemprop="location">([\s\S]*?)<\/p>/i)?.[1] ?? ""
        ) || null;
      const detailTimes = Array.from(
        block.matchAll(/<p class="m-event-list-item__detail">[\s\S]*?<time datetime="([^"]+)">([\s\S]*?)<\/time>/gi)
      );
      const rangeTimes = Array.from(
        block.matchAll(/<time class="m-date-range__item" itemprop="(startDate|endDate)"[\s\S]*?datetime="([^"]+)"/gi)
      );
      const fallbackRangeStart = normalizeText(
        rangeTimes.find((item) => item[1] === "startDate")?.[2] ?? ""
      );
      const fallbackRangeEnd = normalizeText(
        rangeTimes.find((item) => item[1] === "endDate")?.[2] ?? ""
      );
      const startAt =
        toBerlinIso(detailTimes[0]?.[1] ?? null, detailTimes[0]?.[2] ?? null) ??
        (fallbackRangeStart || null);
      const endAt =
        toBerlinIso(detailTimes[1]?.[1] ?? null, detailTimes[1]?.[2] ?? null) ??
        (fallbackRangeEnd || null);

      return {
        sourceUrl,
        ticketUrl,
        title,
        venueName,
        startAt,
        endAt,
        displayStart: normalizeText(detailTimes[0]?.[2] ?? "") || null,
        displayEnd: normalizeText(detailTimes[1]?.[2] ?? "") || null,
        rangeStartAt:
          normalizeText(rangeTimes.find((item) => item[1] === "startDate")?.[2] ?? "") || null,
        rangeEndAt:
          normalizeText(rangeTimes.find((item) => item[1] === "endDate")?.[2] ?? "") || null,
        allDay:
          !looksTimed(normalizeText(detailTimes[0]?.[2] ?? "")) &&
          !looksTimed(normalizeText(detailTimes[1]?.[2] ?? "")) &&
          !/\bT\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z)\b/i.test(startAt ?? ""),
      } satisfies MuenchenCard;
    })
    .filter((item) => item.title && item.startAt);
}

export function normalizeMuenchenDeEvent(
  card: MuenchenCard,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  if (!card.title || !card.startAt) return null;

  const textForCategory = [
    card.title,
    card.venueName ?? "",
    card.displayStart ?? "",
    card.displayEnd ?? "",
  ].join(" ");
  const category = categoryFromText(textForCategory);
  const kind = kindForCategory(category);
  const sourceUrl = card.sourceUrl ?? card.ticketUrl ?? config.base_url;
  const familyFriendly = /(familie|family|kids|kinder)/i.test(textForCategory) ? true : null;
  const isConcreteEventPage = Boolean(card.ticketUrl || (card.venueName && card.startAt));

  return {
    source: "muenchen_de",
    external_id: `muenchen_de:${sourceUrl ?? normalizeText(card.title)}:${card.startAt}`,
    source_url: sourceUrl,
    ticket_url: card.ticketUrl,
    title: card.title,
    summary: null,
    category,
    kind,
    status: "scheduled",
    venue_name: card.venueName,
    venue_address: null,
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: null,
    lng: null,
    timezone: "Europe/Berlin",
    start_at: card.startAt,
    end_at: card.endAt,
    doors_at: null,
    all_day: card.allDay,
    is_ticketed: Boolean(card.ticketUrl),
    price_min: null,
    price_max: null,
    currency: null,
    family_friendly: familyFriendly,
    indoor_outdoor:
      /(open air|park|markt|volksfest|theresienwiese|garten)/i.test(textForCategory)
        ? "outdoor"
        : /(theater|oper|philharmonie|halle|museum|lustspielhaus)/i.test(textForCategory)
          ? "indoor"
          : null,
    local_rank: null,
    importance_score: 57,
    popularity_score: 37,
    tags: Array.from(
      new Set(
        [category, card.venueName, card.displayStart, card.displayEnd]
          .filter((item): item is string => typeof item === "string" && item.length > 0)
          .map((item) => item.toLowerCase())
      )
    ),
    subtypes: Array.from(
      new Set(
        [category, kind, isConcreteEventPage ? "concrete_event_page" : null].filter(
          (value): value is string => Boolean(value)
        )
      )
    ),
    audiences: familyFriendly ? ["family"] : [],
    occasions:
      category === "concert" || category === "show"
        ? ["date", "friends", "party"]
        : category === "market" || category === "festival" || category === "food_event"
          ? ["friends", "family", "tourism"]
          : ["tourism", "friends"],
    source_payload: card,
    source_updated_at: null,
    last_seen_at: new Date().toISOString(),
  };
}
