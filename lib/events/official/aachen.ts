import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type AachenFeedCategory = {
  id?: string | number | null;
  name?: string | null;
};

type AachenFeedTag = {
  id?: string | number | null;
  name?: string | null;
};

type AachenFeedLocationRef = {
  name?: string | null;
  description?: string | null;
  href?: string | null;
};

type AachenFeedEvent = {
  id: string;
  start?: string | null;
  end?: string | null;
  allDay?: boolean | null;
  title?: string | null;
  website?: string | null;
  imageSrc?: string | null;
  category?: AachenFeedCategory | null;
  tags?: AachenFeedTag[] | null;
  location?: AachenFeedLocationRef | null;
};

type AachenPlace = {
  id?: string | number | null;
  href?: string | null;
  name?: string | null;
  description?: string | null;
  roomNumber?: string | null;
  geo?: {
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  postalAddress?: {
    addressCountry?: string | null;
    addressRegion?: string | null;
    postalCode?: string | null;
    addressLocality?: string | null;
    streetAddress?: string | null;
  } | null;
};

type AachenExpandedEvent = {
  event: AachenFeedEvent;
  websiteUrl: string | null;
  place: AachenPlace | null;
  placeUrl: string | null;
};

const AACHEN_ROOT_URL = "https://www.aachen.de";
const AACHEN_EVENTS_URL =
  "https://www.aachen.de/kalender/veranstaltungskalender-alle-termine/events.json?weekends=false&tagMode=ALL";
const PLACE_BATCH_SIZE = 10;
const LOOKAHEAD_DAYS = 420;

const CATEGORY_PRIORITY: Record<OfficialCityEvent["category"], number> = {
  concert: 90,
  theater: 88,
  show: 86,
  market: 84,
  festival: 82,
  food_event: 80,
  fair: 76,
  seasonal: 70,
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
    .replace(/&uuml;/g, "ue")
    .replace(/&ouml;/g, "oe")
    .replace(/&auml;/g, "ae")
    .replace(/&Uuml;/g, "Ue")
    .replace(/&Ouml;/g, "Oe")
    .replace(/&Auml;/g, "Ae")
    .replace(/&szlig;/g, "ss");
}

function toAbsoluteUrl(url: string | null | undefined, baseUrl = AACHEN_ROOT_URL) {
  const normalized = normalizeText(url);
  if (!normalized || normalized === "nullplaces.json") return null;
  try {
    return new URL(normalized, baseUrl).toString();
  } catch {
    return normalized;
  }
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "application/json,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`[aachen_city] HTTP ${response.status} fuer ${url}`);
  }

  return (await response.json()) as T;
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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

function parseLocalDateTime(value: string | null | undefined) {
  const normalized = normalizeText(value);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  return berlinIso(
    Number(yearText),
    Number(monthText),
    Number(dayText),
    Number(hourText),
    Number(minuteText)
  );
}

function addDays(date: Date, amount: number) {
  return new Date(date.getTime() + amount * 24 * 60 * 60 * 1000);
}

function isWithinPlanningWindow(startAt: string | null) {
  if (!startAt) return false;
  const eventDate = new Date(startAt);
  const minDate = addDays(new Date(), -1);
  const maxDate = addDays(new Date(), LOOKAHEAD_DAYS);
  return eventDate >= minDate && eventDate <= maxDate;
}

function fetchPlaceUrl(location: AachenFeedLocationRef | null | undefined) {
  const href = toAbsoluteUrl(location?.href ?? null);
  if (!href || /nullplaces\.json/i.test(href)) return null;
  return href;
}

async function fetchPlaceMap(events: AachenFeedEvent[]) {
  const hrefs = Array.from(
    new Set(events.map((event) => fetchPlaceUrl(event.location)).filter((value): value is string => Boolean(value)))
  );
  const map = new Map<string, AachenPlace>();

  for (const chunk of chunkItems(hrefs, PLACE_BATCH_SIZE)) {
    const settled = await Promise.allSettled(
      chunk.map(async (href) => {
        const places = await fetchJson<AachenPlace[]>(href);
        return { href, place: Array.isArray(places) && places.length > 0 ? places[0] : null };
      })
    );

    for (const result of settled) {
      if (result.status !== "fulfilled" || !result.value.place) continue;
      map.set(result.value.href, result.value.place);
    }
  }

  return map;
}

function categoryFromEvent(event: AachenFeedEvent): OfficialCityEvent["category"] {
  const categoryLabel = normalizeText(event.category?.name).toLowerCase();
  const tags = (event.tags ?? []).map((tag) => normalizeText(tag.name).toLowerCase()).filter(Boolean);
  const titleText = normalizeText(event.title).toLowerCase();
  const signalText = [
    titleText,
    categoryLabel,
    tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  const contextText = [signalText, normalizeText(event.location?.name), normalizeText(event.website)]
    .join(" ")
    .toLowerCase();

  if (/(weihnacht|advent|winterzauber|nikolaus)/.test(signalText)) return "seasonal";
  if (/(street\s*food|kulinar|wein|brunch|tasting|men[üu]|essen\s*&\s*trinken|dinner|fr[üu]hst[üu]ck|meet and eat)/.test(titleText)) {
    return "food_event";
  }
  if (/(flohmarkt|wochenmarkt|after-work-markt|basar|tr[öo]del|decken-flohmarkt|\bmarkt\b)/.test(titleText)) {
    return "market";
  }
  if (/(festival|open[\s-]?air|party|fest(?!stellung)|kirmes|lothringair|campus festival|late night)/.test(titleText)) {
    return "festival";
  }
  if (/(theater|schauspiel|oratorium|oper|b[üu]hne|performance)/.test(signalText)) {
    return "theater";
  }
  if (/(kino|film|bilderbuchkino|kabarett|comedy|slam|lesung|musical|show)/.test(signalText)) {
    return "show";
  }
  if (
    /(konzert|musik|musizieren|chor|orchester|band|jazz|gesang|klassenvorspiel|klassenabend|podium|big band|popchor|tastenpodium|zupferpodium)/.test(
      signalText
    )
  ) {
    return "concert";
  }
  if (/(ausstellung|museum|vernissage|messe|expo|kunst)/.test(signalText)) {
    return "fair";
  }
  if (
    /(stadtf[üu]hrung|f[üu]hrung|rundgang|workshop|sprechstunde|dialog|beratung|vorlesestunde|yoga|gymnastik|treff|fr[üu]hst[üu]ck|cafe|caf[eé]|kurs)/.test(
      signalText
    )
  ) {
    return "community";
  }

  if (/(bildung|gesellschaft|familie|sozial|b[üu]rger|politik|wissenschaft|wohnen|schule|information|mobilit[aä]t|verkehr)/.test(categoryLabel)) {
    return "community";
  }
  if (/(sport|freizeit)/.test(categoryLabel)) return "community";
  if (categoryLabel === "kultur" && tags.some((tag) => /(theater|kino|film)/.test(tag))) return "show";
  if (categoryLabel === "kultur" && tags.some((tag) => /(konzert|musik|festival)/.test(tag))) return "concert";
  if (categoryLabel === "kultur" && tags.some((tag) => /(ausstellung|museum)/.test(tag))) return "fair";
  if (categoryLabel === "europa" && /ausstellung|museum|kunst/.test(contextText)) return "fair";
  if (categoryLabel === "europa" && /theater|kino|film|lesung/.test(contextText)) return "show";

  return "other";
}

function kindForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") {
    return "anchored_event" as const;
  }
  return "flex_event" as const;
}

function audiencesForEvent(category: OfficialCityEvent["category"], text: string) {
  const audiences = new Set<string>();
  if (/(famil|kinder|jugend)/.test(text)) audiences.add("family");
  if (/(markt|festival|flohmarkt|museum|ausstellung|stadtf[üu]hrung|f[üu]hrung|open air)/.test(text)) {
    audiences.add("tourism");
  }
  if (category === "concert" || category === "show" || category === "festival") {
    audiences.add("friends");
    audiences.add("date");
  }
  if (category === "theater") {
    audiences.add("date");
    audiences.add("tourism");
  }
  if (category === "food_event") audiences.add("date");
  if (audiences.size === 0) {
    audiences.add("friends");
    audiences.add("tourism");
  }
  return Array.from(audiences);
}

function occasionsForCategory(category: OfficialCityEvent["category"]) {
  switch (category) {
    case "concert":
    case "show":
      return ["date", "friends", "party"];
    case "theater":
      return ["date", "tourism"];
    case "market":
    case "festival":
    case "food_event":
    case "fair":
      return ["tourism", "friends", "family", "date"];
    default:
      return ["tourism", "friends"];
  }
}

function subtypesForEvent(event: AachenExpandedEvent, category: OfficialCityEvent["category"]) {
  const tags = (event.event.tags ?? []).map((tag) => normalizeText(tag.name).toLowerCase());
  const text = [
    normalizeText(event.event.title),
    normalizeText(event.event.category?.name),
    normalizeText(event.place?.description),
    tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return Array.from(
    new Set(
      [
        category,
        "official_calendar_feed",
        /:\d+$/.test(event.event.id) ? "recurring_series" : null,
        /markt|flohmarkt|basar/.test(text) ? "market_event" : null,
        /festival|fest|open[\s-]?air|party/.test(text) ? "festival_event" : null,
        /f[üu]hrung|rundgang|stadtf[üu]hrung/.test(text) ? "guided_tour" : null,
        /ausstellung|museum|vernissage|kunst/.test(text) ? "exhibition" : null,
        /kino|film|bilderbuchkino/.test(text) ? "screening" : null,
        tags.includes("startseite") ? "homepage_highlight" : null,
      ].filter((value): value is string => Boolean(value))
    )
  );
}

function ticketUrlForWebsite(url: string | null) {
  if (!url) return null;
  const normalized = url.toLowerCase();
  if (
    /(eventbrite|ticket|tickets|ticketree|reservix|pretix|3rides|aachen-tourismus|theaterk|karlspreis|asta\.rwth)/.test(
      normalized
    )
  ) {
    return url;
  }
  return null;
}

function venueAddress(place: AachenPlace | null) {
  const street = normalizeText(place?.postalAddress?.streetAddress);
  const postalCode = normalizeText(place?.postalAddress?.postalCode);
  const locality = normalizeText(place?.postalAddress?.addressLocality);
  const room = normalizeText(place?.roomNumber);
  return [street, [postalCode, locality].filter(Boolean).join(" "), room].filter(Boolean).join(", ") || null;
}

export async function fetchAachenCityEvents(config: EventSourceConfigRow) {
  const events = await fetchJson<AachenFeedEvent[]>(AACHEN_EVENTS_URL);
  const filtered = (events ?? []).filter((event) => isWithinPlanningWindow(parseLocalDateTime(event.start)));
  const placeMap = await fetchPlaceMap(filtered);

  return filtered.map((event) => {
    const websiteUrl = toAbsoluteUrl(event.website ?? null);
    const placeUrl = fetchPlaceUrl(event.location);
    return {
      event,
      websiteUrl,
      place: placeUrl ? placeMap.get(placeUrl) ?? null : null,
      placeUrl,
    } satisfies AachenExpandedEvent;
  });
}

export function normalizeAachenCityEvent(
  expanded: AachenExpandedEvent,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const startAt = parseLocalDateTime(expanded.event.start);
  if (!startAt) return null;

  const category = categoryFromEvent(expanded.event);
  if (category === "other") return null;

  const endAt = parseLocalDateTime(expanded.event.end);
  const text = [
    normalizeText(expanded.event.title),
    normalizeText(expanded.event.category?.name),
    normalizeText(expanded.place?.name),
    normalizeText(expanded.place?.description),
    (expanded.event.tags ?? []).map((tag) => normalizeText(tag.name)).join(" "),
  ]
    .join(" ")
    .toLowerCase();

  const tags = Array.from(
    new Set(
      [
        "aachen_city",
        normalizeText(expanded.event.category?.name).toLowerCase(),
        ...(expanded.event.tags ?? []).map((tag) => normalizeText(tag.name).toLowerCase()),
      ].filter(Boolean)
    )
  );
  const sourceUrl = expanded.websiteUrl ?? `${config.base_url}#event-${encodeURIComponent(expanded.event.id)}`;
  const ticketUrl = ticketUrlForWebsite(expanded.websiteUrl);
  const importanceScore =
    CATEGORY_PRIORITY[category] +
    (tags.includes("startseite") ? 8 : 0) +
    (ticketUrl ? 4 : 0) +
    (expanded.place ? 2 : 0);

  return {
    source: config.provider,
    external_id: `aachen_city:${expanded.event.id}:${startAt}`,
    source_url: sourceUrl,
    ticket_url: ticketUrl,
    title: normalizeText(decodeHtml(expanded.event.title ?? "")),
    summary: expanded.place?.description ? normalizeText(decodeHtml(expanded.place.description)) : null,
    category,
    kind: kindForCategory(category),
    status: /abgesagt|entf[aä]llt|cancelled/i.test(normalizeText(expanded.event.title)) ? "cancelled" : "scheduled",
    venue_name: normalizeText(expanded.place?.name) || normalizeText(expanded.event.location?.name) || null,
    venue_address: venueAddress(expanded.place),
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: expanded.place?.geo?.latitude ?? null,
    lng: expanded.place?.geo?.longitude ?? null,
    timezone: "Europe/Berlin",
    start_at: startAt,
    end_at: endAt,
    doors_at: null,
    all_day: Boolean(expanded.event.allDay),
    is_ticketed: Boolean(ticketUrl),
    price_min: null,
    price_max: null,
    currency: "EUR",
    family_friendly: /(famil|kinder|jugend)/.test(text) ? true : null,
    indoor_outdoor: /(open[\s-]?air|markt|platz|park|hof|innenstadt)/.test(text) ? "outdoor" : null,
    local_rank: importanceScore,
    importance_score: importanceScore,
    popularity_score: importanceScore - 6 + (tags.includes("startseite") ? 6 : 0),
    tags,
    subtypes: subtypesForEvent(expanded, category),
    audiences: audiencesForEvent(category, text),
    occasions: occasionsForCategory(category),
    source_payload: expanded,
    source_updated_at: null,
    last_seen_at: new Date().toISOString(),
  };
}
