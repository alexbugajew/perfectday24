import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type InfomaxPortalConfig = {
  uri: string;
  permalink: string;
  token: string;
  language: string;
};

type HamburgInfomaxCard = {
  ident: string;
  eventDateId: string;
  sourceUrl: string | null;
  title: string;
  subline: string | null;
  summary: string | null;
  infoLine: string | null;
  venueName: string | null;
  startAt: string | null;
  endAt: string | null;
  allDay: boolean;
  category: OfficialCityEvent["category"];
};

type HamburgInfomaxDetail = {
  venueName: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

type HamburgInfomaxResolvedSource = {
  widgetUrl: string;
  portal: InfomaxPortalConfig;
  ids: string[];
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
    .replace(/&gt;/g, ">");
}

function stripTags(text: string) {
  return normalizeText(decodeHtml(text.replace(/<[^>]+>/g, " ")));
}

function pad(value: string) {
  return value.padStart(2, "0");
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

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`[hamburg_infomax] HTTP ${response.status} fuer ${url}`);
  }

  return response.text();
}

function parsePortalConfig(html: string): InfomaxPortalConfig | null {
  const match = html.match(
    /var portal = \{[\s\S]*?uri: '([^']+)'[\s\S]*?permalink: '([^']+)'[\s\S]*?token: '([^']+)'[\s\S]*?language: '([^']+)'/i
  );
  if (!match) return null;

  return {
    uri: normalizeText(match[1]),
    permalink: normalizeText(match[2]),
    token: normalizeText(match[3]),
    language: normalizeText(match[4]),
  };
}

function collectIdentList(html: string) {
  return Array.from(
    new Set(
      Array.from(html.matchAll(/data-idents="([^"]+)"/gi))
        .flatMap((match) => match[1].split(","))
        .map((value) => normalizeText(value))
        .filter((value) => value.startsWith("eventdate_"))
    )
  );
}

function chunk<T>(items: T[], size: number) {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

function buildItemsUrl(portal: InfomaxPortalConfig, ids: string[]) {
  const base = `${portal.uri.replace(/\/+$/, "")}/${portal.permalink}/${portal.language}/action/items`;
  const url = new URL(base);
  url.searchParams.set("widgetToken", portal.token);
  url.searchParams.set("outputType", "itemsPage");
  ids.forEach((id) => url.searchParams.append("object[]", id));
  url.searchParams.set("layout", "listitem");
  url.searchParams.set("showDate", "1");
  return url.toString();
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

function categoryFromText(text: string): OfficialCityEvent["category"] {
  const normalized = text.toLowerCase();
  if (/(konzert|concert|live musik|live music|band|orchester|jazz|singer|songwriter|ensemble)/.test(normalized)) {
    return "concert";
  }
  if (/(theater|theatre|oper|schauspiel|ballett|ballet|lesung|drama|premiere)/.test(normalized)) {
    return "theater";
  }
  if (/(show|musical|comedy|kabarett|performance|immersiv|immersive|variete|zauber|revue)/.test(normalized)) {
    return "show";
  }
  if (/(markt|flohmarkt|wochenmarkt)/.test(normalized)) return "market";
  if (/(festival|fest|open air kino|filmfest)/.test(normalized)) return "festival";
  if (/(food|street food|kulinar|genuss)/.test(normalized)) return "food_event";
  if (/(kirmes|jahrmarkt|dom)/.test(normalized)) return "fair";
  if (/(weihnacht|ostern|advent|fruehling|frühling|sommer|winter|herbst)/.test(normalized)) return "seasonal";
  if (/(ausstellung|museum|fuehrung|führung|workshop|community|familie|familien)/.test(normalized)) return "community";
  return "other";
}

function parseInfoLine(infoLine: string | null) {
  const normalized = normalizeText(infoLine);
  if (!normalized) {
    return {
      venueName: null,
      startAt: null,
      endAt: null,
      allDay: false,
    };
  }

  const parts = normalized.split("/").map((part) => normalizeText(part));
  const dateText = parts[0] ?? null;
  const timeText = parts[1] ?? null;
  const venueText = parts.slice(2).join(" / ");

  const rangeMatch = normalizeText(timeText).match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  const singleMatch = normalizeText(timeText).match(/(\d{1,2}:\d{2})/);
  const allDay = /ganztag|ganztägig|00:00 uhr/i.test(normalized) || (!rangeMatch && !singleMatch);

  return {
    venueName: normalizeText((venueText || "").split(",")[0] ?? "") || null,
    startAt: toBerlinIso(dateText, rangeMatch?.[1] ?? singleMatch?.[1] ?? null),
    endAt: rangeMatch ? toBerlinIso(dateText, rangeMatch[2]) : null,
    allDay,
  };
}

function parseListCards(html: string, widgetUrl: string) {
  const blocks = Array.from(
    html.matchAll(/<article class="-IMXEVNT-listElement[\s\S]*?<\/article>/gi)
  );

  return blocks
    .map((match) => {
      const block = match[0];
      const ident = normalizeText(block.match(/data-ident="([^"]+)"/i)?.[1] ?? "");
      const href =
        block.match(/<h2><a[^>]*href="([^"]+)"/i)?.[1] ??
        block.match(/<a[^>]*href="([^"]+)"/i)?.[1] ??
        null;
      const sourceUrl = normalizeAbsoluteUrl(href, widgetUrl);
      const eventDateId =
        normalizeText(sourceUrl?.match(/[?&]eventDateId=(\d+)/i)?.[1] ?? "") ||
        normalizeText(ident.replace(/^eventdate_/, ""));
      const title =
        stripTags(block.match(/<span class="-IMXEVNT-seoTitle">([\s\S]*?)<\/span>/i)?.[1] ?? "") ||
        stripTags(block.match(/<span class="-IMXEVNT-title">([\s\S]*?)<\/span>/i)?.[1] ?? "");
      const subline =
        stripTags(block.match(/<p class="-IMXEVNT-listElement__text__subline">([\s\S]*?)<\/p>/i)?.[1] ?? "") || null;
      const infoLine =
        stripTags(block.match(/<p class="-IMXEVNT-listElement__text__info">([\s\S]*?)<\/p>/i)?.[1] ?? "") || null;
      const summary =
        stripTags(
          block.match(
            /<div class="-IMXEVNT-listElement__text__extended">[\s\S]*?<p>([\s\S]*?)<\/p>/i
          )?.[1] ?? ""
        ) || null;

      const parsedInfo = parseInfoLine(infoLine);
      const category = categoryFromText([title, subline ?? "", summary ?? "", infoLine ?? ""].join(" "));

      return {
        ident,
        eventDateId,
        sourceUrl,
        title,
        subline,
        summary,
        infoLine,
        venueName: parsedInfo.venueName,
        startAt: parsedInfo.startAt,
        endAt: parsedInfo.endAt,
        allDay: parsedInfo.allDay,
        category,
      } satisfies HamburgInfomaxCard;
    })
    .filter((item) => item.eventDateId && item.title && item.startAt);
}

async function resolveInfomaxSource(config: EventSourceConfigRow): Promise<HamburgInfomaxResolvedSource> {
  const baseHtml = await fetchHtml(config.base_url);
  const widgetUrl =
    config.base_url.includes("infomaxnet.de")
      ? config.base_url
      : normalizeAbsoluteUrl(baseHtml.match(/https?:\/\/[^"' ]*infomaxnet\.de[^"' ]*/i)?.[0] ?? null, config.base_url);

  if (!widgetUrl) {
    throw new Error(`[hamburg_infomax] Keine Infomax-Widget-URL auf ${config.base_url} gefunden.`);
  }

  const widgetHtml = config.base_url.includes("infomaxnet.de") ? baseHtml : await fetchHtml(widgetUrl);
  const portal = parsePortalConfig(widgetHtml);
  if (!portal) {
    throw new Error(`[hamburg_infomax] Portal-Konfiguration konnte fuer ${widgetUrl} nicht gelesen werden.`);
  }

  const ids = collectIdentList(widgetHtml);
  return { widgetUrl, portal, ids };
}

export async function fetchHamburgInfomaxEvents(config: EventSourceConfigRow) {
  const { widgetUrl, portal, ids } = await resolveInfomaxSource(config);
  const batches = chunk(ids, 100);
  const cards: HamburgInfomaxCard[] = [];

  for (const batch of batches) {
    const html = await fetchHtml(buildItemsUrl(portal, batch));
    cards.push(...parseListCards(html, widgetUrl));
  }

  return cards.filter((card) => card.category === "concert" || card.category === "theater" || card.category === "show");
}

async function fetchHamburgInfomaxDetail(sourceUrl: string): Promise<HamburgInfomaxDetail> {
  const html = await fetchHtml(sourceUrl);
  const block =
    html.match(
      /<div class="-IMXEVNT-articleContext -IMXEVNT-articleContext--dark -IMXEVNT-articleMap__location">[\s\S]*?<p>([\s\S]*?)<\/p>/i
    )?.[1] ?? "";

  const blockText = block
    ? stripTags(block)
        .replace(/^Veranstaltungsort\s*/i, "")
        .trim()
    : "";
  const lines = blockText
    .split(/\s{2,}|\n+/)
    .map((line) => normalizeText(line))
    .filter(Boolean);
  const venueName = normalizeText(block.match(/<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "") || null;
  const address =
    normalizeText(lines.slice(venueName ? 1 : 0).join(", ")) ||
    normalizeText(lines.join(", ")) ||
    null;

  const geoMatch = html.match(/<meta name="geo\.position" content="([^";]+);([^"]+)"/i);
  const latRaw = (geoMatch?.[1] ?? "").replace(",", ".");
  const lngRaw = (geoMatch?.[2] ?? "").replace(",", ".");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);

  return {
    venueName,
    address,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

export async function enrichHamburgInfomaxEvents(cards: HamburgInfomaxCard[]) {
  return Promise.all(
    cards.map(async (card) => {
      if (!card.sourceUrl) return { card, detail: null };
      try {
        return { card, detail: await fetchHamburgInfomaxDetail(card.sourceUrl) };
      } catch {
        return { card, detail: null };
      }
    })
  );
}

export function normalizeHamburgInfomaxEvent(
  card: HamburgInfomaxCard,
  detail: HamburgInfomaxDetail | null,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  if (!card.eventDateId || !card.title || !card.startAt) return null;
  if (!(card.category === "concert" || card.category === "theater" || card.category === "show")) {
    return null;
  }

  const venueName = normalizeText(detail?.venueName) || normalizeText(card.venueName) || null;
  const venueAddress = normalizeText(detail?.address) || null;
  const familyFriendly = /(familie|familien|kinder|kids)/i.test(
    [card.title, card.subline ?? "", card.summary ?? ""].join(" ")
  )
    ? true
    : null;

  return {
    source: "hamburg_infomax",
    external_id: `hamburg_infomax:${card.eventDateId}`,
    source_url: card.sourceUrl,
    ticket_url: null,
    title: card.title,
    summary: card.summary,
    category: card.category,
    kind: "anchored_event",
    status: "scheduled",
    venue_name: venueName,
    venue_address: venueAddress,
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: detail?.lat ?? null,
    lng: detail?.lng ?? null,
    timezone: "Europe/Berlin",
    start_at: card.startAt,
    end_at: card.endAt,
    doors_at: null,
    all_day: card.allDay,
    is_ticketed: false,
    price_min: null,
    price_max: null,
    currency: null,
    family_friendly: familyFriendly,
    indoor_outdoor:
      /(open air|park|markt|dom)/i.test([card.title, card.subline ?? "", venueName ?? ""].join(" "))
        ? "outdoor"
        : /(theater|halle|haus|oper|museum|buehne|bühne|club)/i.test(
              [card.title, card.subline ?? "", venueName ?? "", venueAddress ?? ""].join(" ")
            )
          ? "indoor"
          : null,
    local_rank: null,
    importance_score: 63,
    popularity_score: 39,
    tags: Array.from(
      new Set(
        [
          card.category,
          card.subline,
          venueName,
          venueAddress,
          "infomax",
        ]
          .filter((item): item is string => typeof item === "string" && item.length > 0)
          .map((item) => item.toLowerCase())
      )
    ),
    subtypes: Array.from(new Set([card.category, "anchored_event", "concrete_event_page", "infomax_widget"])),
    audiences: familyFriendly ? ["family"] : [],
    occasions:
      card.category === "concert" || card.category === "show"
        ? ["date", "friends", "party"]
        : ["date", "tourism", "friends"],
    source_payload: {
      ...card,
      detail,
    },
    source_updated_at: null,
    last_seen_at: new Date().toISOString(),
  };
}
