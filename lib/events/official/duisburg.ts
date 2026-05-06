import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type DuisburgCategory = {
  id?: number | null;
  title?: string | null;
  parent_uid?: number | null;
  link?: string | null;
};

type DuisburgLocation = {
  id?: number | null;
  name?: string | null;
  link?: string | null;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  longitude?: number | null;
  latitude?: number | null;
};

type DuisburgImage = {
  alt?: string | null;
  title?: string | null;
  copyright?: string | null;
  preview?: string | null;
  small?: string | null;
  large?: string | null;
};

type DuisburgDatePart = {
  year?: string | null;
  month?: string | null;
  day?: string | null;
};

type DuisburgApiEvent = {
  uid: number;
  parent_uid?: number | null;
  title?: string | null;
  teaser?: string | null;
  allday?: number | boolean | null;
  fee?: string | null;
  admission_free?: number | boolean | null;
  ticket_url?: string | null;
  categories?: DuisburgCategory[] | null;
  organizer_id?: number | null;
  tip?: boolean | null;
  advertising_options?: number | null;
  link?: string | null;
  start_date?: DuisburgDatePart | null;
  end_date?: DuisburgDatePart | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: DuisburgLocation | null;
  image?: DuisburgImage | null;
  image_license?: string | null;
};

const DUISBURG_API_URL = "https://www.duisburglive.de/api/events/";
const DUISBURG_ROOT_URL = "https://www.duisburglive.de";
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
    .replace(/&nbsp;/g, " ")
    .replace(/&uuml;/g, "ue")
    .replace(/&ouml;/g, "oe")
    .replace(/&auml;/g, "ae")
    .replace(/&Uuml;/g, "Ue")
    .replace(/&Ouml;/g, "Oe")
    .replace(/&Auml;/g, "Ae")
    .replace(/&szlig;/g, "ss");
}

function toAbsoluteUrl(url: string | null | undefined, baseUrl = DUISBURG_ROOT_URL) {
  const normalized = normalizeText(url);
  if (!normalized) return null;
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
    throw new Error(`[duisburg_live] HTTP ${response.status} fuer ${url}`);
  }

  return (await response.json()) as T;
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

function parseDateParts(value: DuisburgDatePart | null | undefined) {
  const year = Number(value?.year ?? "");
  const month = Number(value?.month ?? "");
  const day = Number(value?.day ?? "");
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) || year < 2000) {
    return null;
  }
  return { year, month, day };
}

function parseTimeParts(value: string | null | undefined) {
  const match = normalizeText(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  };
}

function defaultTimeForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "show" || category === "theater") {
    return { hour: 19, minute: 30 };
  }
  if (category === "market" || category === "festival" || category === "fair" || category === "food_event") {
    return { hour: 12, minute: 0 };
  }
  return { hour: 17, minute: 0 };
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

function buildVenueAddress(location: DuisburgLocation | null | undefined) {
  const parts = [
    normalizeText(location?.street),
    normalizeText(location?.zip),
    normalizeText(location?.city),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function categoryFromEvent(event: DuisburgApiEvent): OfficialCityEvent["category"] {
  const categories = (event.categories ?? [])
    .map((category) => normalizeText(decodeHtml(category.title ?? "")).toLowerCase())
    .filter(Boolean);
  const title = normalizeText(decodeHtml(event.title ?? "")).toLowerCase();
  const teaser = normalizeText(decodeHtml(event.teaser ?? "")).toLowerCase();
  const locationName = normalizeText(decodeHtml(event.location?.name ?? "")).toLowerCase();
  const signal = [title, teaser, locationName, categories.join(" ")].join(" ");

  if (/(weihnachtsmarkt|winter|advent|ostern|fruehling|frühling|sommerfest im winterkontext)/.test(signal)) {
    return "seasonal";
  }
  if (/(tr[oö]delmarkt|wochenm[aä]rkte|wochenmarkt|\bm[aä]rkte\b|\bmarkt\b)/.test(signal)) {
    return "market";
  }
  if (/(festival|feste|stadtfest|kirmes|volksfest|brauchtum|party|open air)/.test(signal)) {
    return "festival";
  }
  if (/(konzert|klassische konzerte|philharm|orchester|jazz|rock|pop)/.test(signal)) {
    return "concert";
  }
  if (/(theater|oper|ballett|schauspiel|kleinkunst)/.test(signal)) {
    return "theater";
  }
  if (/(musical|comedy|kabarett|kino|lesung|vortrag|performance|film|quiz|show)/.test(signal)) {
    return "show";
  }
  if (/(kulinarisches|wein|bier|food|dinner|brunch|restaurant|kneipe|kneipenquiz)/.test(signal)) {
    return "food_event";
  }
  if (/(ausstellung|museum|messe|kongress|tagung|beruf)/.test(signal)) {
    return "fair";
  }
  if (/(gef[üu]hrte tour|rundfahrt|familie und kinder|jugendliche|bildung|diskussion|geschichte|gesellschaft|gesundheit|politik|sprachen|umwelt|verbraucher|workshop|yoga|sport|natur|wassersport|senioren|jugend|familie|schach)/.test(signal)) {
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

function audiencesForEvent(category: OfficialCityEvent["category"], signal: string) {
  const audiences = new Set<string>();
  if (/(familie|kinder|jugend)/.test(signal)) audiences.add("family");
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
  if (category === "market" || category === "festival" || category === "food_event" || category === "fair") {
    return ["tourism", "friends", "family", "date"];
  }
  return ["tourism", "friends"];
}

function subtypesForEvent(event: DuisburgApiEvent, category: OfficialCityEvent["category"]) {
  const signal = [
    normalizeText(decodeHtml(event.title ?? "")),
    normalizeText(decodeHtml(event.teaser ?? "")),
    ...(event.categories ?? []).map((entry) => normalizeText(decodeHtml(entry.title ?? ""))),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return Array.from(
    new Set(
      [
        "concrete_event_page",
        category,
        /wochenmarkt/.test(signal) ? "weekly_market" : null,
        /tr[oö]delmarkt|markt/.test(signal) ? "market_event" : null,
        /festival|stadtfest|kirmes|volksfest/.test(signal) ? "festival_event" : null,
        /gef[üu]hrte tour|rundfahrt/.test(signal) ? "guided_tour" : null,
        /ausstellung|museum/.test(signal) ? "exhibition" : null,
        /kino|film/.test(signal) ? "screening" : null,
        /workshop|yoga/.test(signal) ? "workshop" : null,
      ].filter((value): value is string => Boolean(value))
    )
  );
}

function scoresForEvent(category: OfficialCityEvent["category"], event: DuisburgApiEvent) {
  const base = CATEGORY_PRIORITY[category] ?? 60;
  const highlightBoost = event.tip ? 6 : 0;
  const adBoost = Number(event.advertising_options ?? 0) > 0 ? 4 : 0;
  return {
    localRank: base + highlightBoost + adBoost,
    importance: base - 4 + highlightBoost + adBoost,
    popularity: base - 8 + highlightBoost + adBoost,
  };
}

function buildStartAndEnd(event: DuisburgApiEvent, category: OfficialCityEvent["category"]) {
  const startDate = parseDateParts(event.start_date);
  if (!startDate) return null;
  const startTime = parseTimeParts(event.start_time) ?? defaultTimeForCategory(category);
  const endDate = parseDateParts(event.end_date) ?? startDate;
  const endTime = parseTimeParts(event.end_time);
  const allDay = Boolean(event.allday) || !parseTimeParts(event.start_time);

  const startAt = berlinIso(
    startDate.year,
    startDate.month,
    startDate.day,
    startTime.hour,
    startTime.minute
  );
  const endAt = endTime
    ? berlinIso(endDate.year, endDate.month, endDate.day, endTime.hour, endTime.minute)
    : allDay
      ? berlinIso(endDate.year, endDate.month, endDate.day, 23, 0)
      : null;

  return { startAt, endAt, allDay };
}

export async function fetchDuisburgLiveEvents(_config: EventSourceConfigRow) {
  const events = await fetchJson<DuisburgApiEvent[]>(DUISBURG_API_URL);
  return Array.isArray(events) ? events : [];
}

export function normalizeDuisburgLiveEvent(
  event: DuisburgApiEvent,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const category = categoryFromEvent(event);
  if (category === "other") return null;

  const timing = buildStartAndEnd(event, category);
  if (!timing || !isWithinPlanningWindow(timing.startAt)) return null;

  const title = normalizeText(decodeHtml(event.title ?? ""));
  if (!title) return null;

  const teaser = normalizeText(decodeHtml(event.teaser ?? "")) || null;
  const sourceUrl = toAbsoluteUrl(event.link, DUISBURG_ROOT_URL);
  const ticketUrl = toAbsoluteUrl(event.ticket_url, DUISBURG_ROOT_URL);
  const venueName = normalizeText(decodeHtml(event.location?.name ?? "")) || null;
  const venueAddress = buildVenueAddress(event.location);
  const signal = [
    title,
    teaser ?? "",
    venueName ?? "",
    venueAddress ?? "",
    ...(event.categories ?? []).map((entry) => normalizeText(decodeHtml(entry.title ?? ""))),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const audiences = audiencesForEvent(category, signal);
  const scores = scoresForEvent(category, event);
  const isFree = Boolean(event.admission_free) || /kostenlos|eintritt frei/.test(normalizeText(event.fee).toLowerCase());

  return {
    source: config.provider,
    external_id: `duisburg_live:${event.uid}:${timing.startAt}`,
    source_url: sourceUrl,
    ticket_url: ticketUrl,
    title,
    summary: teaser,
    category,
    kind: kindForCategory(category),
    status: "scheduled",
    venue_name: venueName,
    venue_address: venueAddress,
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: typeof event.location?.latitude === "number" ? event.location.latitude : null,
    lng: typeof event.location?.longitude === "number" ? event.location.longitude : null,
    timezone: "Europe/Berlin",
    start_at: timing.startAt,
    end_at: timing.endAt,
    doors_at: null,
    all_day: timing.allDay,
    is_ticketed: !isFree && Boolean(ticketUrl || normalizeText(event.fee)),
    price_min: null,
    price_max: null,
    currency: normalizeText(event.fee).includes("€") ? "EUR" : null,
    family_friendly: audiences.includes("family"),
    indoor_outdoor:
      /(park|platz|stadion|landschaftspark|markt|ufer|outdoor|open air)/.test(signal)
        ? "outdoor"
        : /(theater|halle|museum|kino|bibliothek|haus|zentrum|forum)/.test(signal)
          ? "indoor"
          : null,
    local_rank: scores.localRank,
    importance_score: scores.importance,
    popularity_score: scores.popularity,
    tags: Array.from(
      new Set(
        [
          "duisburg_live",
          category,
          venueName ?? "",
          ...(event.categories ?? []).map((entry) => normalizeText(decodeHtml(entry.title ?? ""))),
        ]
          .map((value) => normalizeText(value).toLowerCase())
          .filter(Boolean)
      )
    ),
    subtypes: subtypesForEvent(event, category),
    audiences,
    occasions: occasionsForCategory(category),
    source_payload: event,
    source_updated_at: null,
    last_seen_at: new Date().toISOString(),
  };
}
