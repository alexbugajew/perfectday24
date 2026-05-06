import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type StuttgartTourismCard = {
  ident: string;
  sourceUrl: string;
  title: string;
  categoryLabel: string | null;
  dateLabel: string | null;
  venueName: string | null;
  lat: number | null;
  lng: number | null;
  ctaLabel: string | null;
  teaserPrice: string | null;
};

type StuttgartTourismDetail = {
  summary: string | null;
  ticketUrl: string | null;
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

function stripTags(text: string | null | undefined) {
  return normalizeText(decodeHtml(String(text ?? "").replace(/<[^>]+>/g, " ")));
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

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`[stuttgart_tourism] HTTP ${response.status} fuer ${url}`);
  }

  return response.text();
}

function extractEventHighlightsSection(html: string) {
  const marker = '<h2 class="textDetail__headline">Event-Highlights</h2>';
  const start = html.indexOf(marker);
  if (start < 0) return "";
  const after = html.slice(start);
  const nextSection = after.indexOf("</section>", marker.length);
  return nextSection > 0 ? after.slice(0, nextSection) : after;
}

function parseEventCards(html: string, baseUrl: string) {
  const section = extractEventHighlightsSection(html);
  if (!section) return [] as StuttgartTourismCard[];

  const cards: StuttgartTourismCard[] = [];
  const matches = Array.from(
    section.matchAll(/<article class="teaserStandard"[\s\S]*?<\/article>/gi)
  );

  for (const match of matches) {
    const block = match[0];
    const title = stripTags(block.match(/<h3 class="teaserStandard__title">([\s\S]*?)<\/h3>/i)?.[1]);
    const href = block.match(/<a\s+href="([^"]+)"\s+class="button/i)?.[1] ?? null;
    const venueName = stripTags(
      block.match(/<p class="teaserStandard__location__city">([\s\S]*?)<\/p>/i)?.[1]
    );
    const parts = Array.from(
      block.matchAll(/<div class="teaserStandard__part">[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>[\s\S]*?<\/div>/gi)
    );
    const categoryLabel = stripTags(parts[0]?.[1] ?? "");
    const dateLabel = stripTags(parts[0]?.[2] ?? "");
    const lat = Number(block.match(/data-lat="([^"]+)"/i)?.[1] ?? "");
    const lng = Number(block.match(/data-lng="([^"]+)"/i)?.[1] ?? "");
    const ctaLabel = stripTags(block.match(/<span class="button__text button__text--after">([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const teaserPrice = stripTags(block.match(/<span class="price__number">([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const ident = normalizeText(block.match(/data-ident="([^"]+)"/i)?.[1] ?? title);

    if (!title || !href || !dateLabel) continue;

    cards.push({
      ident,
      sourceUrl: normalizeAbsoluteUrl(href, baseUrl),
      title,
      categoryLabel: categoryLabel || null,
      dateLabel: dateLabel || null,
      venueName: venueName || null,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      ctaLabel: ctaLabel || null,
      teaserPrice: teaserPrice || null,
    });
  }

  return cards;
}

async function enrichStuttgartCard(card: StuttgartTourismCard) {
  try {
    const html = await fetchHtml(card.sourceUrl);
    const summary =
      decodeHtml(
        html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1] ??
          html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)?.[1] ??
          ""
      ) || null;

    return {
      card,
      detail: {
        summary,
        ticketUrl:
          card.ctaLabel?.toLowerCase().includes("buchen") || Boolean(card.teaserPrice)
            ? card.sourceUrl
            : null,
      } satisfies StuttgartTourismDetail,
    };
  } catch {
    return {
      card,
      detail: {
        summary: null,
        ticketUrl:
          card.ctaLabel?.toLowerCase().includes("buchen") || Boolean(card.teaserPrice)
            ? card.sourceUrl
            : null,
      } satisfies StuttgartTourismDetail,
    };
  }
}

function currentBerlinDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function monthNumber(raw: string | null | undefined) {
  const normalized = normalizeText(raw).toLowerCase();
  const map: Record<string, string> = {
    jan: "01",
    januar: "01",
    feb: "02",
    februar: "02",
    mrz: "03",
    maerz: "03",
    märz: "03",
    apr: "04",
    april: "04",
    mai: "05",
    jun: "06",
    juni: "06",
    jul: "07",
    juli: "07",
    aug: "08",
    august: "08",
    sep: "09",
    september: "09",
    okt: "10",
    oktober: "10",
    nov: "11",
    november: "11",
    dez: "12",
    dezember: "12",
  };
  return map[normalized] ?? null;
}

function categoryFromText(title: string, categoryLabel: string | null): OfficialCityEvent["category"] {
  const normalized = `${title} ${categoryLabel ?? ""}`.toLowerCase();
  if (/(musical|shows|show|variete|varieté|comedy)/.test(normalized)) return "show";
  if (/(konzert|gospel|jazz|open air|philharmonie|orchester|band)/.test(normalized)) return "concert";
  if (/(theater|oper|schauspiel)/.test(normalized)) return "theater";
  if (/(feste|festival|fruehlingsfest|frühlingsfest|wasen|weindorf)/.test(normalized)) return "festival";
  if (/(markt|märkte)/.test(normalized)) return "market";
  if (/(ausstellung|museum|messe|expo)/.test(normalized)) return "fair";
  if (/(sport|tennis|grand prix)/.test(normalized)) return "community";
  return "other";
}

function kindForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") {
    return "anchored_event" as const;
  }
  return "flex_event" as const;
}

function defaultTimeForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") return "19:30";
  if (category === "community") return "18:00";
  return "12:00";
}

function parseDateLabel(dateLabel: string, category: OfficialCityEvent["category"]) {
  const normalized = decodeHtml(dateLabel);
  const timeMatch = normalized.match(/(\d{1,2}):(\d{2})\s*Uhr/i);
  const explicitTime = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : null;

  if (/heute/i.test(normalized)) {
    return {
      startAt: `${currentBerlinDate()}T${explicitTime ?? defaultTimeForCategory(category)}:00+02:00`,
      endAt: null,
      allDay: explicitTime == null && kindForCategory(category) === "flex_event",
    };
  }

  const exactDate = normalized.match(/(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)\s*(\d{4})/i);
  if (exactDate) {
    const month = monthNumber(exactDate[2]);
    if (month) {
      const datePart = `${exactDate[3]}-${month}-${exactDate[1].padStart(2, "0")}`;
      return {
        startAt: `${datePart}T${explicitTime ?? defaultTimeForCategory(category)}:00+02:00`,
        endAt: null,
        allDay: explicitTime == null && kindForCategory(category) === "flex_event",
      };
    }
  }

  return null;
}

function audiencesForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "show") return ["date", "friends", "party"];
  if (category === "theater") return ["date", "tourism"];
  if (category === "market" || category === "festival" || category === "fair") {
    return ["tourism", "friends", "family", "date"];
  }
  if (category === "community") return ["friends", "tourism"];
  return ["tourism", "friends"];
}

function subtypesForCategory(category: OfficialCityEvent["category"], text: string) {
  const normalized = text.toLowerCase();
  return Array.from(
    new Set(
      [
        "concrete_event_page",
        category,
        /musical|show/.test(normalized) ? "show_event" : null,
        /festival|fest|open air|wasen/.test(normalized) ? "festival_event" : null,
        /markt/.test(normalized) ? "market_event" : null,
      ].filter((value): value is string => Boolean(value))
    )
  );
}

export async function fetchStuttgartTourismEvents(config: EventSourceConfigRow) {
  const html = await fetchHtml(config.base_url);
  const cards = parseEventCards(html, config.base_url);
  const deduped = Array.from(new Map(cards.map((card) => [card.sourceUrl, card])).values());
  const enriched: Array<{ card: StuttgartTourismCard; detail: StuttgartTourismDetail }> = [];

  for (let i = 0; i < deduped.length; i += DETAIL_CHUNK_SIZE) {
    const chunk = deduped.slice(i, i + DETAIL_CHUNK_SIZE);
    const resolved = await Promise.all(chunk.map((card) => enrichStuttgartCard(card)));
    enriched.push(...resolved);
  }

  return enriched;
}

export function normalizeStuttgartTourismEvent(
  payload: { card: StuttgartTourismCard; detail: StuttgartTourismDetail },
  config: EventSourceConfigRow
) {
  const combinedText = `${payload.card.title} ${payload.card.categoryLabel ?? ""} ${payload.detail.summary ?? ""}`;
  const category = categoryFromText(payload.card.title, payload.card.categoryLabel);
  const parsedDate = parseDateLabel(payload.card.dateLabel ?? "", category);

  if (!parsedDate) return null;

  const audiences = audiencesForCategory(category);
  const subtypes = subtypesForCategory(category, combinedText);

  return {
    source: config.provider,
    external_id: payload.card.ident || payload.card.sourceUrl,
    source_url: payload.card.sourceUrl,
    ticket_url: payload.detail.ticketUrl,
    title: payload.card.title,
    summary: payload.detail.summary,
    category,
    kind: kindForCategory(category),
    status: "scheduled" as const,
    venue_name: payload.card.venueName,
    venue_address: payload.card.venueName,
    city_slug: config.city_slug,
    country_code: config.country_code ?? "DE",
    lat: payload.card.lat,
    lng: payload.card.lng,
    timezone: "Europe/Berlin",
    start_at: parsedDate.startAt,
    end_at: parsedDate.endAt,
    doors_at: null,
    all_day: parsedDate.allDay,
    is_ticketed: Boolean(payload.detail.ticketUrl),
    price_min: null,
    price_max: null,
    currency: "EUR",
    family_friendly: /(famil|kinder)/i.test(combinedText) ? true : null,
    indoor_outdoor: /(open air|wasen|schlossplatz|innenstadt)/i.test(combinedText) ? "outdoor" : null,
    local_rank: 84,
    importance_score: 86,
    popularity_score: 78,
    tags: Array.from(
      new Set(
        [
          "stuttgart_tourism",
          payload.card.categoryLabel ?? "",
          payload.card.venueName ?? "",
        ].filter(Boolean)
      )
    ),
    subtypes,
    audiences,
    occasions: audiences,
    source_payload: payload,
    source_updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  } satisfies OfficialCityEvent;
}
