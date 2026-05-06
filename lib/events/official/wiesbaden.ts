import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type WiesbadenHtmlFilter = {
  type?: string;
  key?: string;
  meta?: { disabled?: boolean | null } | null;
  groups?: string[] | null;
  categories?: string[] | null;
  relativeDateRange?: {
    base?: string | null;
    before?: string | null;
    after?: string | null;
    roundStart?: boolean | null;
    roundEnd?: boolean | null;
  } | null;
  absoluteDateRange?: {
    from?: string | null;
    to?: string | null;
  } | null;
};

type WiesbadenSearchPagePayload = {
  searchInput?: {
    archive?: boolean;
    spellcheck?: boolean;
    boosting?: unknown;
    context?: unknown;
    filter?: WiesbadenHtmlFilter[];
  };
};

type WiesbadenGraphqlSearchInput = {
  archive?: boolean;
  spellcheck?: boolean;
  boosting?: unknown;
  context?: unknown;
  limit?: number;
  offset?: number;
  sort?: Array<{ date?: "ASC" | "DESC" }>;
  filter?: Array<{
    key?: string;
    groups?: string[];
    categories?: string[];
    relativeDateRange?: WiesbadenHtmlFilter["relativeDateRange"];
    absoluteDateRange?: WiesbadenHtmlFilter["absoluteDateRange"];
  }>;
};

type WiesbadenScheduling = {
  start?: string | null;
  end?: string | null;
  isFullDay?: boolean | null;
  hasStartTime?: boolean | null;
  hasEndTime?: boolean | null;
};

type WiesbadenGraphqlResult = {
  id: string;
  objectType?: string | null;
  teaser?: {
    __typename?: string | null;
    headline?: string | null;
    text?: string | null;
    kicker?: string | null;
    venue?: string | null;
    iCalUrl?: string | null;
    link?: { url?: string | null } | null;
    schedulings?: WiesbadenScheduling[] | null;
  } | null;
  geo?: {
    primary?: {
      lat?: number | null;
      lng?: number | null;
    } | null;
  } | null;
};

type WiesbadenGraphqlResponse = {
  data?: {
    search?: {
      total?: number | null;
      results?: WiesbadenGraphqlResult[] | null;
    } | null;
  } | null;
};

type WiesbadenSourceCard = {
  ident: string;
  title: string;
  summary: string | null;
  kicker: string | null;
  venueName: string | null;
  sourceUrl: string | null;
  icalUrl: string | null;
  lat: number | null;
  lng: number | null;
  scheduling: WiesbadenScheduling;
};

const WIESBADEN_CALENDAR_URL =
  "https://www.wiesbaden.de/leben-in-wiesbaden/freizeit/veranstaltungskalender/veranstaltungssuche.php";
const WIESBADEN_GRAPHQL_URL = "https://www.wiesbaden.de/api/graphql/";
const PAGE_SIZE = 100;
const MAX_PAGES = 12;
const SEARCH_QUERY = `
  query Search($searchInput: SearchInput!) {
    search(input: $searchInput) {
      total
      results {
        id
        objectType
        teaser {
          __typename
          ... on EventTeaser {
            headline
            text
            kicker
            venue
            iCalUrl
            link {
              url
            }
            schedulings {
              start
              end
              isFullDay
              hasStartTime
              hasEndTime
            }
          }
        }
        geo {
          primary {
            lat
            lng
          }
        }
      }
    }
  }
`;

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

function toAbsoluteUrl(url: string | null | undefined, baseUrl: string) {
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
      accept: "text/html,application/xhtml+xml,application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`[wiesbaden_tourism] HTTP ${response.status} fuer ${url}`);
  }

  return response.text();
}

function extractSearchPayload(html: string) {
  const match = html.match(/data-sp-event-search=\"([^\"]+)\"/i);
  if (!match) {
    throw new Error("[wiesbaden_tourism] data-sp-event-search konnte nicht aus dem offiziellen Kalender gelesen werden.");
  }

  return JSON.parse(decodeHtml(match[1])) as WiesbadenSearchPagePayload;
}

function convertSearchInput(payload: WiesbadenSearchPagePayload, offset: number) {
  const input = payload.searchInput ?? {};
  const filters = (input.filter ?? [])
    .filter((filter) => filter.meta?.disabled !== true)
    .map((filter) => {
      if (filter.type === "groups" && filter.groups?.length) {
        return { key: filter.key, groups: filter.groups };
      }
      if (filter.type === "relativeDateRange" && filter.relativeDateRange) {
        return { key: filter.key, relativeDateRange: filter.relativeDateRange };
      }
      if (filter.type === "absoluteDateRange" && filter.absoluteDateRange) {
        return { key: filter.key, absoluteDateRange: filter.absoluteDateRange };
      }
      if (filter.type === "categories" && filter.categories?.length) {
        return { key: filter.key, categories: filter.categories };
      }
      return null;
    })
    .filter((filter): filter is NonNullable<typeof filter> => Boolean(filter));

  return {
    archive: input.archive ?? false,
    spellcheck: false,
    boosting: input.boosting ?? undefined,
    context: input.context ?? undefined,
    limit: PAGE_SIZE,
    offset,
    sort: [{ date: "ASC" }],
    filter: filters,
  } satisfies WiesbadenGraphqlSearchInput;
}

async function fetchSearchResults(searchInput: WiesbadenGraphqlSearchInput) {
  const response = await fetch(WIESBADEN_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "perfectday24-event-ingest/1.0",
    },
    body: JSON.stringify({
      query: SEARCH_QUERY,
      variables: { searchInput },
    }),
  });

  if (!response.ok) {
    throw new Error(`[wiesbaden_tourism] GraphQL HTTP ${response.status} fuer ${WIESBADEN_GRAPHQL_URL}`);
  }

  const json = (await response.json()) as WiesbadenGraphqlResponse & {
    errors?: Array<{ message?: string }>;
  };

  if (json.errors?.length) {
    throw new Error(
      `[wiesbaden_tourism] GraphQL-Fehler: ${json.errors.map((entry) => entry.message).filter(Boolean).join("; ")}`
    );
  }

  return {
    total: json.data?.search?.total ?? 0,
    results: json.data?.search?.results ?? [],
  };
}

function explodeResult(result: WiesbadenGraphqlResult) {
  if (result.teaser?.__typename !== "EventTeaser") return [];
  const title = normalizeText(result.teaser.headline);
  if (!title) return [];

  const schedulings = result.teaser.schedulings ?? [];
  const seen = new Set<string>();

  return schedulings
    .filter((entry) => normalizeText(entry.start))
    .filter((entry) => {
      const dedupeKey = `${normalizeText(entry.start)}|${normalizeText(entry.end)}`;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    })
    .map((scheduling) => ({
      ident: result.id,
      title,
      summary: stripTags(result.teaser?.text) || null,
      kicker: normalizeText(result.teaser?.kicker) || null,
      venueName: normalizeText(result.teaser?.venue) || null,
      sourceUrl: toAbsoluteUrl(result.teaser?.link?.url, WIESBADEN_CALENDAR_URL),
      icalUrl: toAbsoluteUrl(result.teaser?.iCalUrl, "https://www.wiesbaden.de"),
      lat:
        typeof result.geo?.primary?.lat === "number" && Number.isFinite(result.geo.primary.lat)
          ? result.geo.primary.lat
          : null,
      lng:
        typeof result.geo?.primary?.lng === "number" && Number.isFinite(result.geo.primary.lng)
          ? result.geo.primary.lng
          : null,
      scheduling,
    } satisfies WiesbadenSourceCard));
}

function categoryFromText(text: string): OfficialCityEvent["category"] {
  const normalized = text.toLowerCase();

  if (/(markt|wochenmarkt|flohmarkt|kunstmarkt|trödel|troedel)/.test(normalized)) return "market";
  if (/(festival|festspiele|volksfest|weinfest|frühlingsfest|fruehlingsfest|open air)/.test(normalized)) {
    return "festival";
  }
  if (/(wein|kulinar|brunch|dinner|tasting|food|genuss)/.test(normalized)) return "food_event";
  if (/(konzert|musik|jazz|band|orchester|philharmoni|chor)/.test(normalized)) return "concert";
  if (/(theater|schauspiel|oper|operette|bühne|buehne)/.test(normalized)) return "theater";
  if (/(kino|film|musical|show|kabarett|comedy|lesung|performance|tanz|ballett)/.test(normalized)) {
    return "show";
  }
  if (/(ausstellung|museum|messe|kongress|expo|vernissage|galerie)/.test(normalized)) return "fair";
  if (/(führung|fuehrung|workshop|sitzung|treff|rundgang|tour|vortrag|jugendparlament|kreative)/.test(normalized)) {
    return "community";
  }
  if (/(weihnacht|advent|sommer|winter|frühling|fruehling|saisonal)/.test(normalized)) {
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
  if (category === "market" || category === "festival" || category === "food_event") {
    return ["tourism", "friends", "family", "date"];
  }
  return ["tourism", "friends"];
}

function occasionsForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "show") return ["date", "friends", "party"];
  if (category === "theater") return ["date", "tourism"];
  if (category === "market" || category === "festival" || category === "food_event") {
    return ["tourism", "friends", "family", "date"];
  }
  return ["tourism", "friends"];
}

function subtypesForCard(card: WiesbadenSourceCard, category: OfficialCityEvent["category"]) {
  const text = `${card.title} ${card.kicker ?? ""} ${card.summary ?? ""}`.toLowerCase();
  return Array.from(
    new Set(
      [
        "concrete_event_page",
        category,
        /markt|wochenmarkt|flohmarkt/.test(text) ? "market_event" : null,
        /festival|festspiele|volksfest|open air/.test(text) ? "festival_event" : null,
        /führung|fuehrung|rundgang|tour/.test(text) ? "guided_tour" : null,
        /workshop|kurs|zeichnen|skizzieren|atelier|kreative|kreativ/.test(text) ? "workshop" : null,
        /jugendparlament|ortsbeirat|ausschuss|parlament|sitzung|beirat|ratssitzung|stadtverordnetenversammlung/.test(
          text
        )
          ? "civic_session"
          : null,
        /vortrag|gespr[aÃ¤]ch|talk/.test(text) ? "lecture" : null,
        /ausstellung|museum|galerie|messe|kongress/.test(text) ? "exhibition" : null,
        /kino|film/.test(text) ? "screening" : null,
      ].filter((value): value is string => Boolean(value))
    )
  );
}

export async function fetchWiesbadenTourismEvents(_config: EventSourceConfigRow) {
  const html = await fetchText(WIESBADEN_CALENDAR_URL);
  const payload = extractSearchPayload(html);
  const cards: WiesbadenSourceCard[] = [];

  let total = 0;
  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
    const searchInput = convertSearchInput(payload, pageIndex * PAGE_SIZE);
    const page = await fetchSearchResults(searchInput);
    if (pageIndex === 0) {
      total = page.total;
    }

    const exploded = page.results.flatMap(explodeResult);
    if (exploded.length === 0) break;
    cards.push(...exploded);

    if ((pageIndex + 1) * PAGE_SIZE >= total) break;
  }

  return cards;
}

export function normalizeWiesbadenTourismEvent(
  card: WiesbadenSourceCard,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const startAt = normalizeText(card.scheduling.start);
  if (!startAt) return null;

  const text = [card.title, card.kicker, card.summary, card.venueName].filter(Boolean).join(" ");
  const normalizedText = text.toLowerCase();
  let category = categoryFromText(text);
  if (/(jugendparlament|ortsbeirat|ausschuss|parlament|sitzung|beirat|ratssitzung|stadtverordnetenversammlung)/.test(normalizedText)) {
    category = "community";
  } else if (/(workshop|kurs|zeichnen|skizzieren|atelier|kreative|kreativ|fuehrung|tour|rundgang)/.test(normalizedText)) {
    category = "community";
  }
  if (category === "other") return null;

  const audiences = audiencesForCategory(category, text);
  const occasions = occasionsForCategory(category);

  return {
    source: config.provider,
    external_id: `wiesbaden_tourism:${card.ident}:${startAt}`,
    source_url: card.sourceUrl,
    ticket_url: null,
    title: card.title,
    summary: card.summary,
    category,
    kind: kindForCategory(category),
    status: "scheduled",
    venue_name: card.venueName,
    venue_address: card.venueName,
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: card.lat,
    lng: card.lng,
    timezone: "Europe/Berlin",
    start_at: startAt,
    end_at: normalizeText(card.scheduling.end) || null,
    doors_at: null,
    all_day: card.scheduling.isFullDay === true || card.scheduling.hasStartTime === false,
    is_ticketed: false,
    price_min: null,
    price_max: null,
    currency: null,
    family_friendly: audiences.includes("family"),
    indoor_outdoor: /open air|markt|fest|park/i.test(text) ? "outdoor" : null,
    local_rank:
      /(festival|festspiele|open air|weinfest|markt|konzert)/i.test(text) ? 72 : null,
    importance_score:
      /(festival|festspiele|open air|weinfest|markt|konzert)/i.test(text) ? 68 : null,
    popularity_score:
      /(festival|festspiele|open air|weinfest|markt|konzert)/i.test(text) ? 62 : null,
    tags: Array.from(
      new Set(
        ["wiesbaden_tourism", category, card.kicker ?? "", card.venueName ?? ""]
          .map((value) => normalizeText(value))
          .filter(Boolean)
      )
    ),
    subtypes: subtypesForCard(card, category),
    audiences,
    occasions,
    source_payload: card,
    source_updated_at: null,
    last_seen_at: new Date().toISOString(),
  };
}
