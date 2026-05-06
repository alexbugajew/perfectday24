import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type DortmundJsonLdPlace = {
  "@type"?: string;
  name?: string;
  address?: {
    "@type"?: string;
    streetAddress?: string;
    postalCode?: string;
    addressLocality?: string;
    addressRegion?: string;
    addressCountry?: string;
  };
  geo?: {
    "@type"?: string;
    latitude?: string | number;
    longitude?: string | number;
  };
};

type DortmundJsonLdEvent = {
  "@context"?: string;
  "@type"?: string | string[];
  name?: string;
  description?: string;
  image?: string | string[];
  startDate?: string;
  endDate?: string;
  eventStatus?: string;
  eventAttendanceMode?: string;
  isAccessibleForFree?: boolean | null;
  location?: DortmundJsonLdPlace;
  organizer?: DortmundJsonLdPlace;
};

type DortmundDetailEvent = {
  ident: string;
  sourceUrl: string;
  title: string;
  summary: string | null;
  category: OfficialCityEvent["category"];
  kind: OfficialCityEvent["kind"];
  status: OfficialCityEvent["status"];
  venueName: string | null;
  venueAddress: string | null;
  lat: number | null;
  lng: number | null;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  isTicketed: boolean;
  familyFriendly: boolean | null;
  indoorOutdoor: OfficialCityEvent["indoor_outdoor"];
  tags: string[];
  subtypes: string[];
  audiences: string[];
  occasions: string[];
  sourcePayload: {
    jsonLd: DortmundJsonLdEvent;
  };
};

const DORTMUND_HIGHLIGHTS_URL = "https://www.dortmund.de/dortmund-erleben/events-und-highlights/";
const DORTMUND_CALENDAR_URL = "https://www.dortmund.de/dortmund-erleben/veranstaltungskalender/";
const DETAIL_CHUNK_SIZE = 6;
const DORTMUND_CITY_CENTER = {
  lat: 51.513587,
  lng: 7.465298,
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

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`[dortmund_tourism] HTTP ${response.status} fuer ${url}`);
  }

  return response.text();
}

function listingUrls(config: EventSourceConfigRow) {
  return Array.from(
    new Set(
      [config.base_url, DORTMUND_HIGHLIGHTS_URL, DORTMUND_CALENDAR_URL]
        .map((value) => normalizeAbsoluteUrl(value, DORTMUND_HIGHLIGHTS_URL))
        .filter((value): value is string => Boolean(value))
    )
  );
}

function parseTermLinks(html: string, baseUrl: string) {
  const links = new Map<string, string>();
  const matches = Array.from(
    html.matchAll(/\/dortmund-erleben\/veranstaltungskalender\/termin_\d+\.html/gi)
  );

  for (const match of matches) {
    const absolute = normalizeAbsoluteUrl(match[0], baseUrl);
    if (!absolute) continue;
    links.set(absolute, absolute);
  }

  return Array.from(links.values());
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function extractEventJsonLd(html: string) {
  const matches = Array.from(
    html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)
  );

  for (const match of matches) {
    const parsed = safeParseJson(match[1].trim());
    if (!parsed || typeof parsed !== "object") continue;
    const rawType = (parsed as Record<string, unknown>)["@type"];
    const types = Array.isArray(rawType) ? rawType.map(String) : rawType ? [String(rawType)] : [];
    if (types.some((value) => value.toLowerCase() === "event")) {
      return parsed as DortmundJsonLdEvent;
    }
  }

  return null;
}

function parseCoordinate(value: string | number | null | undefined, axis: "lat" | "lng") {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(normalizeText(value));
  if (!Number.isFinite(parsed)) return null;

  const bounds =
    axis === "lat"
      ? {
          min: 45,
          max: 56,
          reference: DORTMUND_CITY_CENTER.lat,
        }
      : {
          min: 4,
          max: 17,
          reference: DORTMUND_CITY_CENTER.lng,
        };

  const candidates = Array.from(
    new Set([parsed, parsed / 10_000_000, parsed / 1_000_000, parsed / 100_000, parsed / 10_000])
  )
    .filter((candidate) => Number.isFinite(candidate))
    .filter((candidate) => candidate >= bounds.min && candidate <= bounds.max)
    .sort((left, right) => Math.abs(left - bounds.reference) - Math.abs(right - bounds.reference));

  if (candidates.length > 0) {
    return candidates[0] ?? null;
  }

  if (axis === "lat" && parsed >= -90 && parsed <= 90) return parsed;
  if (axis === "lng" && parsed >= -180 && parsed <= 180) return parsed;
  return null;
}

function buildVenueAddress(place: DortmundJsonLdPlace | null | undefined) {
  const street = normalizeText(place?.address?.streetAddress).replace(/^null$/i, "");
  const postalCode = normalizeText(place?.address?.postalCode);
  const city = normalizeText(place?.address?.addressLocality);
  return [street, [postalCode, city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null;
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

function toBerlinIso(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return normalized;
  const local = berlinLocalParts(date);
  return `${String(local.year).padStart(4, "0")}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}T${String(local.hour).padStart(2, "0")}:${String(local.minute).padStart(2, "0")}:00${berlinOffset(date)}`;
}

function inferCategory(text: string): OfficialCityEvent["category"] {
  const normalized = text.toLowerCase();
  if (/(wochenmarkt|feierabend-markt|flohmarkt|fruehlingsmarkt|frühlingsmarkt|\bmarkt\b|basar)/.test(normalized)) {
    return "market";
  }
  if (/(festival|dortbunt|stadtfest|freimarkt|kirmes|fest|open-air|open air)/.test(normalized)) {
    return "festival";
  }
  if (/(messe|intermodellbau|expo|ausstellung)/.test(normalized)) return "fair";
  if (/(konzert|tour|band|orchester|open-air|open air|felix jaehn|michael schulte|santiano)/.test(normalized)) {
    return "concert";
  }
  if (/(theater|oper|musical|show|lord of the dance|udo juergens|udo jürgens|kabarett|comedy)/.test(normalized)) {
    return "show";
  }
  if (/(lauf|run|renntag|sport|bike|fuehrung|führung|jubilaeum|jubiläum)/.test(normalized)) {
    return "community";
  }
  if (/(weihnacht|advent|ostern|sommer|winter)/.test(normalized)) return "seasonal";
  return "other";
}

function kindForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") {
    return "anchored_event" as const;
  }
  return "flex_event" as const;
}

function normalizeStatus(value: string | null | undefined): OfficialCityEvent["status"] {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized.includes("cancel")) return "cancelled";
  if (normalized.includes("postpon")) return "postponed";
  return "scheduled";
}

function inferAudiences(category: OfficialCityEvent["category"], text: string) {
  const normalized = text.toLowerCase();
  if (/famil|kinder|jugend/.test(normalized)) return ["family", "tourism"];
  if (category === "concert" || category === "show") return ["date", "friends", "party"];
  if (category === "theater") return ["date", "tourism"];
  if (category === "market" || category === "festival" || category === "fair") {
    return ["tourism", "friends", "family", "date"];
  }
  return ["tourism", "friends"];
}

function inferOccasions(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "show") return ["date", "friends", "party"];
  if (category === "theater") return ["date", "tourism"];
  if (category === "market" || category === "festival" || category === "fair") {
    return ["tourism", "friends", "family", "date"];
  }
  return ["tourism", "friends"];
}

function inferSubtypes(category: OfficialCityEvent["category"], text: string) {
  const normalized = text.toLowerCase();
  return Array.from(
    new Set(
      [
        "concrete_event_page",
        category,
        /flohmarkt|markt/.test(normalized) ? "market_event" : null,
        /festival|fest|open-air|open air|dortbunt/.test(normalized) ? "festival_event" : null,
        /musical|show|oper/.test(normalized) ? "show_event" : null,
        /lauf|run|bike|renntag/.test(normalized) ? "sport_event" : null,
      ].filter((value): value is string => Boolean(value))
    )
  );
}

function inferIndoorOutdoor(text: string) {
  const normalized = text.toLowerCase();
  if (/(innenstadt|markt|park|friedensplatz|westfalenpark|galopprennbahn|open-air|open air)/.test(normalized)) {
    return "outdoor" as const;
  }
  if (/(theater|halle|opernhaus|d-k-h|dietrich-keuning-haus)/.test(normalized)) {
    return "indoor" as const;
  }
  return null;
}

function isAllDay(startAt: string | null, endAt: string | null) {
  if (!startAt) return false;
  return Boolean(startAt.includes("T00:00:00") && (!endAt || endAt.includes("T23:59:00")));
}

async function fetchDortmundDetail(sourceUrl: string): Promise<DortmundDetailEvent | null> {
  const html = await fetchHtml(sourceUrl);
  const jsonLd = extractEventJsonLd(html);
  if (!jsonLd?.name || !jsonLd.startDate) return null;

  const title = normalizeText(jsonLd.name);
  const summary = stripTags(jsonLd.description) || null;
  const sourceText = [title, summary, normalizeText(jsonLd.location?.name)].filter(Boolean).join(" ");
  const category = inferCategory(sourceText);
  if (category === "other") return null;

  const startAt = toBerlinIso(jsonLd.startDate);
  if (!startAt) return null;
  const endAt = toBerlinIso(jsonLd.endDate);
  const venueName = normalizeText(jsonLd.location?.name) || null;
  const venueAddress = buildVenueAddress(jsonLd.location);
  const lat = parseCoordinate(jsonLd.location?.geo?.latitude, "lat");
  const lng = parseCoordinate(jsonLd.location?.geo?.longitude, "lng");
  const audiences = inferAudiences(category, sourceText);
  const occasions = inferOccasions(category);
  const ident = sourceUrl.match(/termin_(\d+)\.html/i)?.[1] ?? title;

  return {
    ident: `termin_${ident}:${startAt}`,
    sourceUrl,
    title,
    summary,
    category,
    kind: kindForCategory(category),
    status: normalizeStatus(jsonLd.eventStatus),
    venueName,
    venueAddress,
    lat,
    lng,
    startAt,
    endAt,
    allDay: isAllDay(startAt, endAt),
    isTicketed: jsonLd.isAccessibleForFree === false,
    familyFriendly: /famil|kinder|jugend/i.test(sourceText) ? true : null,
    indoorOutdoor: inferIndoorOutdoor(sourceText),
    tags: Array.from(
      new Set(["dortmund_tourism", venueName ?? "", category].filter(Boolean))
    ),
    subtypes: inferSubtypes(category, sourceText),
    audiences,
    occasions,
    sourcePayload: {
      jsonLd,
    },
  } satisfies DortmundDetailEvent;
}

export async function fetchDortmundTourismEvents(config: EventSourceConfigRow) {
  const detailUrls = new Map<string, string>();

  for (const url of listingUrls(config)) {
    try {
      const html = await fetchHtml(url);
      for (const detailUrl of parseTermLinks(html, url)) {
        detailUrls.set(detailUrl, detailUrl);
      }
    } catch {
      // Ignore individual listing failures and keep the remaining official paths.
    }
  }

  const results: DortmundDetailEvent[] = [];
  const entries = Array.from(detailUrls.values());
  for (let index = 0; index < entries.length; index += DETAIL_CHUNK_SIZE) {
    const chunk = entries.slice(index, index + DETAIL_CHUNK_SIZE);
    const details = await Promise.all(
      chunk.map(async (sourceUrl) => {
        try {
          return await fetchDortmundDetail(sourceUrl);
        } catch {
          return null;
        }
      })
    );
    results.push(...details.filter((item): item is DortmundDetailEvent => Boolean(item)));
  }

  return results;
}

export function normalizeDortmundTourismEvent(
  item: DortmundDetailEvent,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  return {
    source: config.provider,
    external_id: `dortmund_tourism:${item.ident}`,
    source_url: item.sourceUrl,
    ticket_url: item.isTicketed ? item.sourceUrl : null,
    title: item.title,
    summary: item.summary,
    category: item.category,
    kind: item.kind,
    status: item.status,
    venue_name: item.venueName,
    venue_address: item.venueAddress,
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: item.lat,
    lng: item.lng,
    timezone: "Europe/Berlin",
    start_at: item.startAt,
    end_at: item.endAt,
    doors_at: null,
    all_day: item.allDay,
    is_ticketed: item.isTicketed,
    price_min: null,
    price_max: null,
    currency: null,
    family_friendly: item.familyFriendly,
    indoor_outdoor: item.indoorOutdoor,
    local_rank: 82,
    importance_score: 80,
    popularity_score: 76,
    tags: item.tags,
    subtypes: item.subtypes,
    audiences: item.audiences,
    occasions: item.occasions,
    source_payload: item.sourcePayload,
    source_updated_at: null,
    last_seen_at: new Date().toISOString(),
  };
}
