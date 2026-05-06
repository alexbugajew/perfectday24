import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type HamburgCard = {
  vadbId: string;
  identifier: string | null;
  href: string | null;
  title: string;
  summary: string | null;
  profiling: string[];
  venueName: string | null;
  startAt: string | null;
  lat: number | null;
  lng: number | null;
  imageAlt: string | null;
};

type HamburgTourismDetail = {
  venueName: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
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

function parseGermanDateTime(dateText: string | null, timeText: string | null) {
  if (!dateText) return null;
  const dateMatch = dateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!dateMatch) return null;
  const [, day, month, year] = dateMatch;
  const timeMatch = (timeText ?? "").match(/(\d{1,2}):(\d{2})/);
  const hours = timeMatch?.[1] ?? "00";
  const minutes = timeMatch?.[2] ?? "00";
  return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${minutes}:00+02:00`;
}

function categoryFromText(text: string): OfficialCityEvent["category"] {
  const normalized = text.toLowerCase();
  if (/(weihnacht|oster|advent|markt|marktzeit|wochenmarkt|flohmarkt)/.test(normalized)) return "market";
  if (/(festival|stadtfest|hafenfest|dom|food truck|street food)/.test(normalized)) return "festival";
  if (/(kulinar|food|brunch|tasting|genuss)/.test(normalized)) return "food_event";
  if (/(konzert|live-musik|live music|band|orchester|jazz)/.test(normalized)) return "concert";
  if (/(theater|theatre|oper|schauspiel|ballett|premiere|buehne|bühne)/.test(normalized)) return "theater";
  if (/(show|musical|comedy|kabarett|performance|immersiv|immersive|variete|varieté)/.test(normalized)) {
    return "show";
  }
  if (/(kirmes|funfair|jahrmarkt)/.test(normalized)) return "fair";
  if (/(winter|sommer|fruehling|frühling|herbst|saisonal|seasonal)/.test(normalized)) return "seasonal";
  if (/(familie|community|open air|rundgaenge|führung|fuehrung|ausstellung|vernissage|museum)/.test(normalized)) {
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

export async function fetchHamburgTourismEvents(config: EventSourceConfigRow) {
  const response = await fetch(config.base_url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`[hamburg_tourism] HTTP ${response.status} fuer ${config.base_url}`);
  }

  const html = await response.text();
  const articleMatches = Array.from(
    html.matchAll(/<article[^>]*class="[^"]*listTeaser-event[^"]*"[\s\S]*?<\/article>/gi)
  );

  return articleMatches
    .map((match) => {
      const block = match[0];
      const vadbId = block.match(/data-vadb="([^"]+)"/i)?.[1] ?? "";
      const identifier = block.match(/data-js_identifier="([^"]+)"/i)?.[1] ?? null;
      const href = block.match(/<a href="([^"]+)" class="listTeaser-event__link"/i)?.[1] ?? null;
      const title = stripTags(block.match(/<h3>([\s\S]*?)<\/h3>/i)?.[1] ?? "");
      const profiling = Array.from(
        block.matchAll(/<ul class="listTeaser-event__text__profiling">[\s\S]*?<li>([\s\S]*?)<\/li>/gi)
      )
        .map((entry) => stripTags(entry[1]))
        .filter(Boolean);
      const infoItems = Array.from(
        block.matchAll(/<ul class="listTeaser-event__text__infos">[\s\S]*?<li>[\s\S]*?<\/li>/gi)
      )
        .flatMap((entry) => Array.from(entry[0].matchAll(/<li>([\s\S]*?)<\/li>/gi)).map((item) => stripTags(item[1])))
        .filter(Boolean);
      const summary = stripTags(block.match(/<p><p>([\s\S]*?)<\/p>/i)?.[1] ?? "") || null;
      const imageAlt = normalizeText(block.match(/<img [^>]*alt="([^"]*)"/i)?.[1] ?? "") || null;
      const venueName =
        infoItems.find((item) => !/\d{1,2}\.\d{1,2}\.\d{4}/.test(item) && !/\d{1,2}:\d{2}/.test(item)) ?? null;
      const dateText = infoItems.find((item) => /\d{1,2}\.\d{1,2}\.\d{4}/.test(item)) ?? null;
      const timeText = infoItems.find((item) => /\d{1,2}:\d{2}/.test(item)) ?? null;
      const startAt = parseGermanDateTime(dateText, timeText);
      const latValue = Number(block.match(/data-js_lat="([^"]+)"/i)?.[1] ?? "");
      const lngValue = Number(block.match(/data-js_lng="([^"]+)"/i)?.[1] ?? "");

      return {
        vadbId,
        identifier,
        href,
        title,
        summary,
        profiling,
        venueName,
        startAt,
        lat: Number.isFinite(latValue) ? latValue : null,
        lng: Number.isFinite(lngValue) ? lngValue : null,
        imageAlt,
      } satisfies HamburgCard;
    })
    .filter((item) => item.vadbId && item.title && item.startAt);
}

function extractAddressFromSummary(summary: string | null) {
  const normalized = normalizeText(summary);
  if (!normalized) return null;
  const match = normalized.match(/(.+?,\s*[^,]+?\d[^,]*,\s*\d{5}\s+Hamburg)/i);
  return normalizeText(match?.[1] ?? "") || null;
}

function extractVenueFromAddress(address: string | null) {
  if (!address) return null;
  return normalizeText(address.split(",")[0] ?? "") || null;
}

async function fetchHamburgTourismEventDetail(sourceUrl: string): Promise<HamburgTourismDetail> {
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`[hamburg_tourism] HTTP ${response.status} fuer ${sourceUrl}`);
  }

  const html = await response.text();
  const venueName =
    stripTags(
      html.match(/<div class="contact__address__informationBundle">[\s\S]*?<strong>([\s\S]*?)<\/strong>/i)?.[1] ?? ""
    ) || null;
  const address =
    stripTags(
      html.match(/<div class="contact__address__informationBundle">([\s\S]*?)<\/div>/i)?.[1] ?? ""
    ) || null;
  const markerMatch = html.match(/data-js_markers="\[\{&quot;latitude&quot;:([^,]+),&quot;longitude&quot;:([^,]+),/i);
  const lat = Number(markerMatch?.[1] ?? "");
  const lng = Number(markerMatch?.[2] ?? "");

  return {
    venueName,
    address,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

export async function enrichHamburgTourismEvents(cards: HamburgCard[]) {
  return Promise.all(
    cards.map(async (card) => {
      const sourceUrl = card.href
        ? card.href.startsWith("http")
          ? card.href
          : `https://www.hamburg-tourism.de${card.href}`
        : null;
      if (!sourceUrl) return { card, detail: null };
      try {
        return { card, detail: await fetchHamburgTourismEventDetail(sourceUrl) };
      } catch {
        return { card, detail: null };
      }
    })
  );
}

export function normalizeHamburgTourismEvent(
  card: HamburgCard,
  detail: HamburgTourismDetail | null,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  if (!card.vadbId || !card.title || !card.startAt) return null;

  const sourceUrl = card.href
    ? card.href.startsWith("http")
      ? card.href
      : `https://www.hamburg-tourism.de${card.href}`
    : config.base_url;
  const summaryAddress = extractAddressFromSummary(card.summary);
  const venueName =
    normalizeText(detail?.venueName) ||
    normalizeText(card.venueName) ||
    extractVenueFromAddress(summaryAddress) ||
    null;
  const venueAddress = normalizeText(detail?.address) || summaryAddress || null;
  const resolvedLat = detail?.lat ?? card.lat;
  const resolvedLng = detail?.lng ?? card.lng;
  const textForCategory = [
    card.title,
    card.summary ?? "",
    card.profiling.join(" "),
    card.imageAlt ?? "",
    venueName ?? "",
    venueAddress ?? "",
  ].join(" ");
  const category = categoryFromText(textForCategory);
  const kind = kindForCategory(category);
  const familyFriendly = /(familie|kinder|kids)/i.test(textForCategory) ? true : null;

  return {
    source: "hamburg_tourism",
    external_id: `hamburg_tourism:${card.vadbId}:${card.startAt}`,
    source_url: sourceUrl,
    ticket_url: sourceUrl,
    title: normalizeText(card.title),
    summary: normalizeText(card.summary) || null,
    category,
    kind,
    status: "scheduled",
    venue_name: venueName,
    venue_address: venueAddress,
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: resolvedLat,
    lng: resolvedLng,
    timezone: "Europe/Berlin",
    start_at: card.startAt,
    end_at: null,
    doors_at: null,
    all_day: /T00:00:00\+02:00$/.test(card.startAt),
    is_ticketed: /(musical|show|theater|theatre|konzert|ticket)/i.test(textForCategory),
    price_min: null,
    price_max: null,
    currency: null,
    family_friendly: familyFriendly,
    indoor_outdoor:
      /(open air|markt|festival|dom|hafen|park)/i.test(textForCategory)
        ? "outdoor"
        : /(theater|musical|show|oper|ausstellung|museum)/i.test(textForCategory)
          ? "indoor"
          : null,
    local_rank: null,
    importance_score: 58 + (venueAddress ? 8 : 0) + (resolvedLat != null && resolvedLng != null ? 10 : 0),
    popularity_score: 38 + (venueName ? 5 : 0),
    tags: Array.from(
      new Set(
        [category, venueName, ...card.profiling]
          .filter((item): item is string => typeof item === "string" && item.length > 0)
          .map((item) => item.toLowerCase())
      )
    ),
    subtypes: Array.from(new Set([category, kind, ...card.profiling.map((item) => item.toLowerCase())])),
    audiences: familyFriendly ? ["family"] : [],
    occasions:
      category === "concert" || category === "show"
        ? ["date", "friends", "party"]
        : category === "market" || category === "festival" || category === "food_event"
          ? ["friends", "family", "tourism"]
          : ["tourism", "friends"],
    source_payload: { card, detail },
    source_updated_at: null,
    last_seen_at: new Date().toISOString(),
  };
}
