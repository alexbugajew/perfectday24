export type EventSourceConfigRow = {
  provider:
    | "visitberlin"
    | "berlin_de"
    | "hamburg_tourism"
    | "hamburg_de"
    | "hamburg_infomax"
    | "muenchen_de"
    | "koeln_tourism"
    | "frankfurt_tourism"
    | "stuttgart_tourism"
    | "duesseldorf_tourism"
    | "leipzig_travel"
    | "dresden_tourism"
    | "hannover_tourism"
    | "nuernberg_tourism"
    | "bremen_tourism"
    | "dortmund_tourism"
    | "mannheim_tourism"
    | "wiesbaden_tourism"
    | "bonn_city"
    | "visit_essen"
    | "karlsruhe_tourism"
    | "muenster_tourism"
    | "aachen_city"
    | "augsburg_city"
    | "kiel_sailing_city"
    | "bielefeld_jetzt"
    | "braunschweig_region"
    | "bochum_tourism"
    | "duisburg_live"
    | "wuppertal_live"
    | "freiburg_eventportal"
    | "luebeck_tourism"
    | "erfurt_tourism"
    | "magdeburg_city"
    | "moenchengladbach_city"
    | "gelsenkirchen_city";
  city_slug: string;
  country_code: string | null;
  base_url: string;
  parser_mode: "html" | "jsonld" | "api";
  label: string;
  notes?: string | null;
  priority?: number | null;
  is_active?: boolean | null;
};

export type OfficialCityEvent = {
  source: string;
  external_id: string;
  source_url: string | null;
  ticket_url: string | null;
  title: string;
  summary: string | null;
  category:
    | "concert"
    | "theater"
    | "show"
    | "market"
    | "festival"
    | "fair"
    | "food_event"
    | "community"
    | "seasonal"
    | "other";
  kind: "anchored_event" | "flex_event";
  status: "scheduled" | "cancelled" | "postponed" | "draft";
  venue_name: string | null;
  venue_address: string | null;
  city_slug: string;
  country_code: string | null;
  lat: number | null;
  lng: number | null;
  timezone: string | null;
  start_at: string;
  end_at: string | null;
  doors_at: string | null;
  all_day: boolean;
  is_ticketed: boolean;
  price_min: number | null;
  price_max: number | null;
  currency: string | null;
  family_friendly: boolean | null;
  indoor_outdoor: "indoor" | "outdoor" | "mixed" | null;
  local_rank: number | null;
  importance_score: number | null;
  popularity_score: number | null;
  tags: string[];
  subtypes: string[];
  audiences: string[];
  occasions: string[];
  source_payload: unknown;
  source_updated_at: string | null;
  last_seen_at: string;
};

type JsonLdThing = {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  url?: string;
  eventAttendanceMode?: string;
  isAccessibleForFree?: boolean;
  location?: {
    name?: string;
    address?: string | { streetAddress?: string; addressLocality?: string };
  };
  offers?:
    | {
        url?: string;
        price?: string | number;
        priceCurrency?: string;
      }
    | Array<{
        url?: string;
        price?: string | number;
        priceCurrency?: string;
      }>;
  keywords?: string | string[];
};

type VisitBerlinCard = {
  nid: string;
  href: string | null;
  title: string;
  categoryLabel: string | null;
  summary: string | null;
  venueName: string | null;
  venueAddress: string | null;
  startAt: string | null;
  endAt: string | null;
  ticketUrl: string | null;
};

function extractJsonLdScripts(html: string) {
  const scripts = Array.from(
    html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  );
  return scripts.map((match) => match[1]).filter(Boolean);
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function collectThings(input: unknown, bucket: JsonLdThing[]) {
  if (!input) return;
  if (Array.isArray(input)) {
    input.forEach((item) => collectThings(item, bucket));
    return;
  }
  if (typeof input !== "object") return;

  const obj = input as Record<string, unknown>;
  if (obj["@graph"]) collectThings(obj["@graph"], bucket);

  const rawType = obj["@type"];
  const types = Array.isArray(rawType) ? rawType.map(String) : rawType ? [String(rawType)] : [];
  if (types.some((type) => type.toLowerCase().includes("event"))) {
    bucket.push(obj as JsonLdThing);
  }
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

function categoryForVisitBerlin(thing: JsonLdThing) {
  const text = [
    normalizeText(thing.name),
    normalizeText(thing.description),
    Array.isArray(thing.keywords) ? thing.keywords.join(" ") : normalizeText(thing.keywords),
  ]
    .join(" ")
    .toLowerCase();

  if (/(weihnacht|wintermarkt|ostermarkt|adventsmarkt|markt)/.test(text)) return "market";
  if (/(festival|street festival|stadtfest)/.test(text)) return "festival";
  if (/(food|street food|kulinar|brunch|tasting)/.test(text)) return "food_event";
  if (/(konzert|concert|live music|orchestra|band)/.test(text)) return "concert";
  if (/(theater|opera|schauspiel|play)/.test(text)) return "theater";
  if (/(show|musical|comedy|performance)/.test(text)) return "show";
  if (/(fair|funfair|kirmes)/.test(text)) return "fair";
  if (/(season|seasonal|christmas|new year)/.test(text)) return "seasonal";
  if (/(community|family|neighbourhood|open air)/.test(text)) return "community";
  return "other";
}

function categoryFromText(text: string): OfficialCityEvent["category"] {
  const normalized = text.toLowerCase();
  if (/(market|weihnacht|wintermarkt|ostermarkt|adventsmarkt)/.test(normalized)) return "market";
  if (/(festival|street festival|stadtfest)/.test(normalized)) return "festival";
  if (/(food|street food|kulinar|brunch|tasting)/.test(normalized)) return "food_event";
  if (/(concert|live music|band|orchestra)/.test(normalized)) return "concert";
  if (/(theatre|theater|opera|play|schauspiel)/.test(normalized)) return "theater";
  if (/(show|musical|comedy|performance)/.test(normalized)) return "show";
  if (/(fair|funfair|kirmes)/.test(normalized)) return "fair";
  if (/(season|seasonal|christmas|winter)/.test(normalized)) return "seasonal";
  if (/(family|community|open air)/.test(normalized)) return "community";
  return "other";
}

function kindForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") {
    return "anchored_event" as const;
  }
  return "flex_event" as const;
}

function tagsForThing(thing: JsonLdThing, category: OfficialCityEvent["category"]) {
  const keywords = Array.isArray(thing.keywords)
    ? thing.keywords.map(normalizeText)
    : normalizeText(thing.keywords)
      ? normalizeText(thing.keywords).split(",").map((item) => normalizeText(item))
      : [];

  return Array.from(
    new Set(
      [category, ...keywords, normalizeText(thing.location?.name)]
        .filter(Boolean)
        .map((item) => item.toLowerCase())
    )
  );
}

export async function fetchVisitBerlinEvents(config: EventSourceConfigRow) {
  const response = await fetch(config.base_url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`[visitberlin] HTTP ${response.status} fuer ${config.base_url}`);
  }

  const html = await response.text();
  const articleMatches = Array.from(
    html.matchAll(/<article[^>]*data-nid="([^"]+)"[^>]*class="[^"]*teaser-search--event[^"]*"[\s\S]*?<\/article>/gi)
  );

  return articleMatches.map((match) => {
    const block = match[0];
    const nid = match[1];
    const href = block.match(/<a class="teaser-search__mainlink" href="([^"]+)"/i)?.[1] ?? null;
    const title = stripTags(
      block.match(/<h2 class="teaser-search__heading[\s\S]*?<span class="heading-highlight__inner">([\s\S]*?)<\/span>/i)?.[1] ?? ""
    );
    const categoryLabel = stripTags(
      block.match(/<a class="category-label"[\s\S]*?>([\s\S]*?)<\/a>/i)?.[1] ?? ""
    ) || null;
    const summary = stripTags(
      block.match(/<div class="teaser-search__text">([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] ?? ""
    ) || null;
    const venueName = stripTags(
      block.match(/<p class="teaser-search__location[\s\S]*?<span class="nopr">([\s\S]*?)<\/span>/i)?.[1] ?? ""
    ) || null;
    const venueAddress = stripTags(
      block.match(/<span class="teaser-search__print-address[\s\S]*?">([\s\S]*?)<\/span>/i)?.[1] ?? ""
    ) || null;
    const times = Array.from(block.matchAll(/<time datetime="([^"]+)"/gi)).map((entry) => entry[1]);
    const ticketUrl =
      block.match(/<a href="([^"]+)" class="button button--booking"/i)?.[1] ??
      block.match(/<p class="teaser-search__print-link[\s\S]*?>([\s\S]*?)<\/p>/i)?.[1]?.trim() ??
      null;

    return {
      nid,
      href,
      title,
      categoryLabel,
      summary,
      venueName,
      venueAddress,
      startAt: times[0] ?? null,
      endAt: times.length > 1 ? times[times.length - 1] : null,
      ticketUrl,
    } satisfies VisitBerlinCard;
  }).filter((item) => item.title && item.startAt);
}

export function normalizeVisitBerlinEvent(
  thing: JsonLdThing | VisitBerlinCard,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const isCard = "nid" in thing;
  const title = isCard ? normalizeText(thing.title) : normalizeText(thing.name);
  const startAt = isCard ? normalizeText(thing.startAt) : normalizeText(thing.startDate);
  if (!title || !startAt) return null;

  const category = isCard
    ? categoryFromText(`${thing.categoryLabel ?? ""} ${title} ${thing.summary ?? ""}`)
    : categoryForVisitBerlin(thing);
  const offers = !isCard ? (Array.isArray(thing.offers) ? thing.offers[0] : thing.offers) : null;
  const venueAddress = isCard
    ? normalizeText(thing.venueAddress) || null
    : typeof thing.location?.address === "string"
      ? normalizeText(thing.location.address)
      : [thing.location?.address?.streetAddress, thing.location?.address?.addressLocality]
          .map(normalizeText)
          .filter(Boolean)
          .join(", ");

  const externalId = isCard
    ? `visitberlin:${thing.nid}`
    : thing.url
      ? `visitberlin:${thing.url}`
      : `visitberlin:${config.city_slug}:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${startAt}`;

  return {
    source: "visitberlin",
    external_id: externalId,
    source_url: isCard
      ? (thing.href ? `https://www.visitberlin.de${thing.href}` : config.base_url)
      : normalizeText(thing.url) || config.base_url,
    ticket_url: isCard ? normalizeText(thing.ticketUrl) || null : normalizeText(offers?.url) || null,
    title,
    summary: isCard ? normalizeText(thing.summary) || null : normalizeText(thing.description) || null,
    category,
    kind: kindForCategory(category),
    status: "scheduled",
    venue_name: isCard ? normalizeText(thing.venueName) || null : normalizeText(thing.location?.name) || null,
    venue_address: venueAddress || null,
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: null,
    lng: null,
    timezone: "Europe/Berlin",
    start_at: startAt,
    end_at: isCard ? normalizeText(thing.endAt) || null : normalizeText(thing.endDate) || null,
    doors_at: null,
    all_day: false,
    is_ticketed: isCard ? Boolean(thing.ticketUrl) : thing.isAccessibleForFree === true ? false : Boolean(offers?.url),
    price_min:
      !isCard && offers?.price != null && Number.isFinite(Number(offers.price)) ? Number(offers.price) : null,
    price_max: null,
    currency: !isCard ? normalizeText(offers?.priceCurrency) || null : null,
    family_friendly:
      /(family|kinder|kids)/i.test(
        isCard
          ? `${title} ${normalizeText(thing.summary)} ${normalizeText(thing.categoryLabel)}`
          : `${normalizeText(thing.name)} ${normalizeText(thing.description)} ${Array.isArray(thing.keywords) ? thing.keywords.join(" ") : normalizeText(thing.keywords)}`
      )
        ? true
        : null,
    indoor_outdoor:
      /open air|outdoor|park|markt/i.test(
        isCard ? `${title} ${normalizeText(thing.summary)}` : `${normalizeText(thing.name)} ${normalizeText(thing.description)}`
      )
        ? "outdoor"
        : null,
    local_rank: null,
    importance_score: 60,
    popularity_score: 40,
    tags: isCard
      ? Array.from(
          new Set(
            [category, normalizeText(thing.categoryLabel), normalizeText(thing.venueName)]
              .filter(Boolean)
              .map((item) => item.toLowerCase())
          )
        )
      : tagsForThing(thing, category),
    subtypes: [category, kindForCategory(category)],
    audiences:
      /(family|kinder|kids)/i.test(
        isCard
          ? `${title} ${normalizeText(thing.summary)} ${normalizeText(thing.categoryLabel)}`
          : `${normalizeText(thing.name)} ${normalizeText(thing.description)}`
      )
        ? ["family"]
        : [],
    occasions:
      category === "concert" || category === "show"
        ? ["date", "friends", "party"]
        : category === "market" || category === "festival" || category === "food_event"
          ? ["friends", "family", "tourism"]
          : ["tourism", "friends"],
    source_payload: thing,
    source_updated_at: null,
    last_seen_at: new Date().toISOString(),
  };
}
