import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type FreiburgCategory = {
  i18nName?: string | null;
  parent?: FreiburgCategory | null;
};

type FreiburgAddress = {
  street?: string | null;
  streetNo?: string | null;
  zipcode?: string | null;
  city?: string | null;
  homepage?: string | null;
  email?: string | null;
  phone1?: string | null;
};

type FreiburgContactData = {
  address?: FreiburgAddress | null;
};

type FreiburgPoi = {
  title?: string | null;
  contact1?: FreiburgContactData | null;
};

type FreiburgCoordinates = {
  latitude?: number | null;
  longitude?: number | null;
};

type FreiburgGeoInfo = {
  city?: string | null;
  street?: string | null;
  streetNo?: string | null;
  zipcode?: string | null;
  coordinates?: FreiburgCoordinates | null;
};

type FreiburgEventDate = {
  date?: string | null;
  startTime?: string | null;
  duration?: string | number | null;
  cancelled?: boolean | null;
  soldout?: boolean | null;
  bookingLink?: string | null;
};

type FreiburgGraphqlEvent = {
  id: number;
  ident?: string | null;
  permaLink?: string | null;
  title?: string | null;
  shortDescription?: string | null;
  longDescription?: string | null;
  bookingLink?: string | null;
  cancelled?: boolean | null;
  categories?: FreiburgCategory[] | null;
  location?: FreiburgPoi | null;
  contributor?: FreiburgPoi | null;
  geoInfo?: FreiburgGeoInfo | null;
  eventDates?: FreiburgEventDate[] | null;
};

type FreiburgGraphqlResponse = {
  data?: {
    events?: {
      pagination?: {
        currentPage?: number | null;
        pageSize?: number | null;
        totalPages?: number | null;
        totalRecords?: number | null;
      } | null;
      nodes?: FreiburgGraphqlEvent[] | null;
    } | null;
  } | null;
  errors?: Array<{ message?: string | null }> | null;
};

type FreiburgPreparedEvent = {
  event: FreiburgGraphqlEvent;
  eventDate: FreiburgEventDate;
};

const FREIBURG_LIST_URL = "https://veranstaltungen.freiburg.de/freiburg/events/list";
const FREIBURG_ROOT_URL = "https://veranstaltungen.freiburg.de";
const FREIBURG_EVENTS_BASE_URL = "https://veranstaltungen.freiburg.de/freiburg/events/";
const FREIBURG_WIDGET_MARKER = 'footerLogo:"/assets/images/instances/fwtm/logo.white.svg"';
const LOOKAHEAD_DAYS = 210;
const PAGE_SIZE = 120;
const MAX_PAGES = 12;

const CATEGORY_PRIORITY: Record<OfficialCityEvent["category"], number> = {
  concert: 90,
  theater: 88,
  show: 86,
  market: 84,
  festival: 82,
  food_event: 78,
  fair: 74,
  seasonal: 72,
  community: 62,
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

function foldSearchText(value: string) {
  return decodeHtml(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00df/g, "ss")
    .toLowerCase();
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
      accept: "text/html,application/javascript,text/javascript,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`[freiburg_eventportal] HTTP ${response.status} fuer ${url}`);
  }

  return response.text();
}

function addDays(date: Date, amount: number) {
  return new Date(date.getTime() + amount * 24 * 60 * 60 * 1000);
}

function berlinDateString(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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

function berlinIsoForDate(date: Date) {
  const local = berlinLocalParts(date);
  return berlinIso(local.year, local.month, local.day, local.hour, local.minute);
}

function parseDateOnly(value: string | null | undefined) {
  const match = normalizeText(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function parseTimeParts(value: string | null | undefined) {
  const match = normalizeText(value).match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
    second: Number(match[3] ?? 0),
  };
}

function parseDurationMinutes(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  const normalized = normalizeText(value);
  if (!normalized) return null;

  const isoMatch = normalized.match(/^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)$/i);
  if (isoMatch) {
    const hours = Number(isoMatch[1] ?? 0);
    const minutes = Number(isoMatch[2] ?? 0);
    const seconds = Number(isoMatch[3] ?? 0);
    return hours * 60 + minutes + Math.round(seconds / 60);
  }

  const clockMatch = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (clockMatch) {
    const hours = Number(clockMatch[1]);
    const minutes = Number(clockMatch[2]);
    const seconds = Number(clockMatch[3] ?? 0);
    return hours * 60 + minutes + Math.round(seconds / 60);
  }

  const numeric = Number(normalized);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.round(numeric);
  }

  return null;
}

function addMinutesToIso(isoString: string, minutes: number) {
  const parsed = new Date(isoString);
  if (!Number.isFinite(parsed.getTime()) || minutes <= 0) return null;
  return berlinIsoForDate(new Date(parsed.getTime() + minutes * 60 * 1000));
}

function defaultTimeForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") {
    return { hour: 19, minute: 30 };
  }
  if (category === "market" || category === "festival" || category === "fair" || category === "food_event") {
    return { hour: 12, minute: 0 };
  }
  return { hour: 17, minute: 0 };
}

function kindForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") {
    return "anchored_event" as const;
  }
  return "flex_event" as const;
}

function buildDetailUrl(permaLink: string | null | undefined) {
  const normalized = normalizeText(permaLink);
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith("/")) {
    return toAbsoluteUrl(normalized, FREIBURG_ROOT_URL);
  }
  return toAbsoluteUrl(`detail/${normalized}`, FREIBURG_EVENTS_BASE_URL);
}

function extractBundleUrls(html: string) {
  return Array.from(
    new Set(
      Array.from(html.matchAll(/src="([^"]*_nuxt\/[^"]+\.js)"/g), (match) =>
        toAbsoluteUrl(match[1], FREIBURG_ROOT_URL)
      ).filter((value): value is string => Boolean(value))
    )
  );
}

function extractGraphqlConfig(bundleText: string) {
  const markerIndex = bundleText.indexOf(FREIBURG_WIDGET_MARKER);
  if (markerIndex < 0) return null;

  const slice = bundleText.slice(Math.max(0, markerIndex - 400), Math.min(bundleText.length, markerIndex + 2600));
  const token = slice.match(/graphqlBearerToken:"([^"]+)"/)?.[1] ?? null;
  const endpoint = slice.match(/graphqlEndpoint:"([^"]+)"/)?.[1] ?? null;
  if (!token || !endpoint) return null;
  return { token, endpoint };
}

async function fetchGraphqlConfig() {
  const html = await fetchText(FREIBURG_LIST_URL);
  const bundleUrls = extractBundleUrls(html);

  for (const bundleUrl of bundleUrls) {
    const js = await fetchText(bundleUrl).catch(() => "");
    if (!js) continue;
    const config = extractGraphqlConfig(js);
    if (config) return config;
  }

  throw new Error("[freiburg_eventportal] Freiburg-spezifischer GraphQL-Konfigblock konnte nicht aus dem offiziellen Bundle gelesen werden.");
}

function buildEventsQuery(page: number, startDate: string, endDate: string) {
  return `
    query {
      events(
        filter: { fromDate: "${startDate}", toDate: "${endDate}", includeExpiredEvents: false }
        appearance: { deliveryChannel: 1 }
        orderBy: [{ field: FROMDATE, order: ASC }]
        pagination: { page: ${page}, pageSize: ${PAGE_SIZE} }
        language: "de"
      ) {
        pagination { currentPage pageSize totalPages totalRecords }
        nodes {
          id
          ident
          permaLink
          title
          shortDescription
          longDescription
          bookingLink
          cancelled
          categories { i18nName parent { i18nName } }
          location {
            title
            contact1 {
              address {
                street
                streetNo
                zipcode
                city
                homepage
                email
                phone1
              }
            }
          }
          contributor {
            title
            contact1 {
              address {
                street
                streetNo
                zipcode
                city
                homepage
                email
                phone1
              }
            }
          }
          geoInfo {
            coordinates { latitude longitude }
            city
            street
            streetNo
            zipcode
          }
          eventDates {
            date
            startTime
            duration
            cancelled
            soldout
            bookingLink
          }
        }
      }
    }
  `;
}

async function fetchGraphqlPage(endpoint: string, token: string, query: string) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "perfectday24-event-ingest/1.0",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`[freiburg_eventportal] GraphQL HTTP ${response.status} fuer ${endpoint}`);
  }

  const json = (await response.json()) as FreiburgGraphqlResponse;
  if (json.errors?.length) {
    throw new Error(
      `[freiburg_eventportal] GraphQL-Fehler: ${json.errors.map((entry) => normalizeText(entry.message)).filter(Boolean).join("; ")}`
    );
  }

  return json;
}

function collectCategoryLabels(event: FreiburgGraphqlEvent) {
  return (event.categories ?? [])
    .flatMap((entry) => [normalizeText(entry.i18nName), normalizeText(entry.parent?.i18nName)])
    .filter(Boolean);
}

function categoryFromEvent(event: FreiburgGraphqlEvent, occurrence: FreiburgEventDate): OfficialCityEvent["category"] {
  const categoryLabels = collectCategoryLabels(event);
  const text = [
    normalizeText(event.title),
    stripTags(event.shortDescription),
    stripTags(event.longDescription),
    normalizeText(event.location?.title),
    normalizeText(event.contributor?.title),
    categoryLabels.join(" "),
  ]
    .filter(Boolean)
    .join(" ");
  const signal = foldSearchText(text);
  const categorySignal = foldSearchText(categoryLabels.join(" "));

  if (/(weihnacht|advent|christkind|wintermarkt|ostermarkt|nikolaus|silvester)/.test(signal)) {
    return "seasonal";
  }
  if (/(markt|wochenmarkt|flohmarkt|tr(o|oe)del|jahrmarkt|bauernmarkt|muenstermarkt|basar)/.test(signal)) {
    return "market";
  }
  if (/(street food|kulinar|wein|bier|cocktail|tasting|menue|dinner|brunch|genuss)/.test(signal)) {
    return "food_event";
  }
  if (/(festival|feste|stadtfest|open air|rave|fasnet|party|nacht der museen)/.test(signal) || /\bfeste\b/.test(categorySignal)) {
    return "festival";
  }
  if (
    /(konzert|jazz|klassik|rock|pop|orchester|chor|livemusik|live musik|singer|songwriter)/.test(signal) ||
    /(konzert|jazz|klassik|musik)/.test(categorySignal)
  ) {
    return "concert";
  }
  if (
    /(buehne|theater|oper|schauspiel|ballett|tanztheater|puppentheater|musical)/.test(signal) ||
    /(theater|buehne|oper|musical|ballett|variete|zirkus)/.test(categorySignal)
  ) {
    return "theater";
  }
  if (
    /(film|kino|lesung|vortrag|gespraech|talk|comedy|kabarett|show|poetry slam|quiz|impro)/.test(signal) ||
    /(film|vortrag|lesung|comedy|show)/.test(categorySignal)
  ) {
    return "show";
  }
  if (
    /(fuehrung|rundgang|kurs|workshop|seminar|sport|bewegung|yoga|kinder|jugend|nachbarschaft|treff|singen|begegnung|beratung)/.test(
      signal
    ) ||
    /(sport|bewegung|kinder|jugend|workshop)/.test(categorySignal)
  ) {
    return "community";
  }
  if (
    /(ausstellung|vernissage|messe|museum|galerie|installation|\bkunst\b)/.test(signal) ||
    /(ausstellung|messe)/.test(categorySignal)
  ) {
    return "fair";
  }
  if (occurrence.startTime) {
    return "show";
  }
  return "other";
}

function buildVenueAddress(event: FreiburgGraphqlEvent) {
  const locationAddress = event.location?.contact1?.address;
  const geoInfo = event.geoInfo;
  const parts = [
    normalizeText(locationAddress?.street || geoInfo?.street),
    normalizeText(locationAddress?.streetNo || geoInfo?.streetNo),
    normalizeText(locationAddress?.zipcode || geoInfo?.zipcode),
    normalizeText(locationAddress?.city || geoInfo?.city),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function venueNameForEvent(event: FreiburgGraphqlEvent) {
  return normalizeText(event.location?.title) || normalizeText(event.contributor?.title) || null;
}

function tagsForEvent(event: FreiburgGraphqlEvent, category: OfficialCityEvent["category"]) {
  return Array.from(
    new Set(
      [
        category,
        ...collectCategoryLabels(event).map((entry) => foldSearchText(entry)),
        foldSearchText(normalizeText(event.location?.title)),
      ].filter(Boolean)
    )
  );
}

function subtypesForEvent(
  event: FreiburgGraphqlEvent,
  occurrence: FreiburgEventDate,
  category: OfficialCityEvent["category"]
) {
  const signal = foldSearchText(
    [
      normalizeText(event.title),
      stripTags(event.shortDescription),
      stripTags(event.longDescription),
      collectCategoryLabels(event).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
  );

  return Array.from(
    new Set(
      [
        "concrete_event_page",
        category,
        /wochenmarkt|muenstermarkt/.test(signal) ? "weekly_market" : null,
        /markt|flohmarkt|basar|tr(o|oe)del/.test(signal) ? "market_event" : null,
        /festival|stadtfest|open air|rave/.test(signal) ? "festival_event" : null,
        /fuehrung|rundgang/.test(signal) ? "guided_tour" : null,
        /workshop|kurs|seminar/.test(signal) ? "workshop" : null,
        /vortrag|gespraech|talk|lesung/.test(signal) ? "talk" : null,
        /film|kino/.test(signal) ? "screening" : null,
        /konzert|jazz|klassik|rock|pop|chor/.test(signal) ? "live_music" : null,
        /theater|oper|schauspiel|ballett|musical|variete|zirkus/.test(signal) ? "performing_arts" : null,
        /ausstellung|museum|vernissage/.test(signal) ? "exhibition" : null,
        /kinder|jugend|familie/.test(signal) ? "family_program" : null,
        occurrence.soldout ? "sold_out" : null,
      ].filter((entry): entry is string => Boolean(entry))
    )
  );
}

function audienceForEvent(category: OfficialCityEvent["category"], signal: string) {
  const audiences = new Set<string>();
  if (/(famil|kinder|jugend)/.test(signal)) audiences.add("family");
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
  if (category === "market" || category === "festival" || category === "fair" || category === "food_event") {
    return ["tourism", "friends", "family", "date"];
  }
  return ["tourism", "friends"];
}

function indoorOutdoorForEvent(signal: string, category: OfficialCityEvent["category"]) {
  if (/(open air|draussen|outdoor|freiluft)/.test(signal)) return "outdoor" as const;
  if (/(halle|theater|kino|museum|galerie|innen)/.test(signal)) return "indoor" as const;
  if (category === "market" || category === "festival") return "mixed" as const;
  return null;
}

function buildExternalId(event: FreiburgGraphqlEvent, occurrence: FreiburgEventDate) {
  const ident = normalizeText(event.ident) || normalizeText(event.permaLink) || String(event.id);
  const date = normalizeText(occurrence.date) || "unknown-date";
  const time = normalizeText(occurrence.startTime) || "allday";
  return `freiburg_eventportal:${ident}:${date}:${time}`;
}

export async function fetchFreiburgEventportalEvents(_config: EventSourceConfigRow) {
  const { endpoint, token } = await fetchGraphqlConfig();
  const startDate = berlinDateString(new Date());
  const endDate = berlinDateString(addDays(new Date(), LOOKAHEAD_DAYS));
  const prepared: FreiburgPreparedEvent[] = [];

  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= MAX_PAGES) {
    const response = await fetchGraphqlPage(endpoint, token, buildEventsQuery(page, startDate, endDate));
    const eventResult = response.data?.events;
    const nodes = eventResult?.nodes ?? [];
    totalPages = Number(eventResult?.pagination?.totalPages ?? 1);

    for (const event of nodes) {
      for (const eventDate of event.eventDates ?? []) {
        if (!normalizeText(eventDate.date)) continue;
        prepared.push({ event, eventDate });
      }
    }

    if (nodes.length === 0) break;
    page += 1;
  }

  return prepared;
}

export function normalizeFreiburgEventportalEvent(
  prepared: FreiburgPreparedEvent,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const event = prepared.event;
  const occurrence = prepared.eventDate;
  const title = normalizeText(event.title);
  const dateParts = parseDateOnly(occurrence.date);
  if (!title || !dateParts) return null;

  const category = categoryFromEvent(event, occurrence);
  if (category === "other") return null;

  const timeParts = parseTimeParts(occurrence.startTime) ?? defaultTimeForCategory(category);
  const startAt = berlinIso(dateParts.year, dateParts.month, dateParts.day, timeParts.hour, timeParts.minute);
  const durationMinutes = parseDurationMinutes(occurrence.duration);
  const endAt = durationMinutes ? addMinutesToIso(startAt, durationMinutes) : null;
  const sourceUrl = buildDetailUrl(event.permaLink);
  const ticketUrl = toAbsoluteUrl(occurrence.bookingLink || event.bookingLink, FREIBURG_ROOT_URL);
  const signal = foldSearchText(
    [
      title,
      stripTags(event.shortDescription),
      stripTags(event.longDescription),
      venueNameForEvent(event),
      collectCategoryLabels(event).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
  );
  const audiences = audienceForEvent(category, signal);
  const geo = event.geoInfo?.coordinates;
  const hasGeo = typeof geo?.latitude === "number" && typeof geo?.longitude === "number";
  const importanceScore = CATEGORY_PRIORITY[category] + (ticketUrl ? 4 : 0) + (hasGeo ? 4 : 0);

  return {
    source: config.provider,
    external_id: buildExternalId(event, occurrence),
    source_url: sourceUrl,
    ticket_url: ticketUrl,
    title,
    summary: stripTags(event.shortDescription) || stripTags(event.longDescription) || null,
    category,
    kind: kindForCategory(category),
    status: event.cancelled || occurrence.cancelled ? "cancelled" : "scheduled",
    venue_name: venueNameForEvent(event),
    venue_address: buildVenueAddress(event),
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: hasGeo ? geo?.latitude ?? null : null,
    lng: hasGeo ? geo?.longitude ?? null : null,
    timezone: "Europe/Berlin",
    start_at: startAt,
    end_at: endAt,
    doors_at: null,
    all_day: !normalizeText(occurrence.startTime),
    is_ticketed: Boolean(ticketUrl) || occurrence.soldout === true,
    price_min: null,
    price_max: null,
    currency: "EUR",
    family_friendly: audiences.includes("family"),
    indoor_outdoor: indoorOutdoorForEvent(signal, category),
    local_rank: importanceScore,
    importance_score: importanceScore,
    popularity_score: importanceScore - 4 + (occurrence.soldout ? 2 : 0),
    tags: tagsForEvent(event, category),
    subtypes: subtypesForEvent(event, occurrence, category),
    audiences,
    occasions: occasionsForCategory(category),
    source_payload: {
      event,
      eventDate: occurrence,
    },
    source_updated_at: null,
    last_seen_at: new Date().toISOString(),
  };
}
