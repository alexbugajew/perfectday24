import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type MoenchengladbachApiDoc = {
  id?: string | number | null;
  variantId?: string | number | null;
  url?: string | null;
  title?: string | null;
  teaser?: string | null;
  content?: string | null;
  startTime_doubleS?: string | number | null;
  endTime_doubleS?: string | number | null;
  days_doubleS?: string | number | null;
  latitude_doubleS?: string | number | null;
  longitude_doubleS?: string | number | null;
  locationname_stringS?: string | null;
  street_stringS?: string | null;
  zip_stringS?: string | null;
  city_stringS?: string | null;
  categorynames_stringM?: string[] | string | null;
  priority_intS?: string | number | null;
  registration_stringS?: string | null;
  organizername_stringS?: string | null;
  indexed?: string | number | null;
};

type MoenchengladbachApiResponse = {
  items?: MoenchengladbachApiDoc[] | null;
  response?: {
    numFound?: string | number | null;
    docs?: MoenchengladbachApiDoc[] | null;
  } | null;
};

const MOENCHENGLADBACH_ROOT_URL = "https://www.moenchengladbach.de";
const MOENCHENGLADBACH_EVENTS_URL =
  `${MOENCHENGLADBACH_ROOT_URL}/de/aktuell-aktiv/veranstaltungskalender`;
const LOOKAHEAD_MONTHS = 12;
const PAGE_SIZE = 1000;
const MAX_PAGES = 12;

const CATEGORY_PRIORITY: Record<OfficialCityEvent["category"], number> = {
  concert: 90,
  theater: 88,
  show: 86,
  market: 84,
  festival: 82,
  food_event: 80,
  fair: 76,
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

function toAbsoluteUrl(url: string | null | undefined, baseUrl = MOENCHENGLADBACH_ROOT_URL) {
  const normalized = normalizeText(decodeHtml(url ?? ""));
  if (!normalized) return null;
  try {
    return new URL(normalized, baseUrl).toString();
  } catch {
    return normalized;
  }
}

function looksLikeUrl(value: string | null | undefined) {
  return /^(https?:|mailto:|\/)/i.test(normalizeText(value));
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "application/json,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`[moenchengladbach_city] HTTP ${response.status} fuer ${url}`);
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

function berlinIso(year: number, month: number, day: number, hour: number, minute: number, second = 0) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}${berlinOffset(utcGuess)}`;
}

function berlinIsoFromUnixSeconds(unixSeconds: number) {
  const date = new Date(unixSeconds * 1000);
  const local = berlinLocalParts(date);
  return berlinIso(local.year, local.month, local.day, local.hour, local.minute, local.second);
}

function berlinStartOfDayUnix(date: Date) {
  const local = berlinLocalParts(date);
  const localMidday = new Date(Date.UTC(local.year, local.month - 1, local.day, 12, 0, 0));
  const middayParts = berlinLocalParts(localMidday);
  const secondsSinceMidnight =
    middayParts.hour * 60 * 60 + middayParts.minute * 60 + middayParts.second;
  return Math.round(localMidday.getTime() / 1000) - secondsSinceMidnight;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function categoryNamesForDoc(doc: MoenchengladbachApiDoc) {
  const raw = doc.categorynames_stringM;
  const values = Array.isArray(raw) ? raw : normalizeText(raw) ? [String(raw)] : [];
  return Array.from(new Set(values.map((item) => stripTags(item)).filter(Boolean)));
}

function buildSignal(doc: MoenchengladbachApiDoc) {
  return foldSearchText(
    [
      normalizeText(doc.title),
      stripTags(doc.teaser),
      stripTags(doc.content),
      normalizeText(doc.locationname_stringS),
      normalizeText(doc.organizername_stringS),
      ...categoryNamesForDoc(doc),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function buildSummary(doc: MoenchengladbachApiDoc) {
  const teaser = stripTags(doc.teaser);
  if (teaser) return teaser;
  const content = stripTags(doc.content);
  return content || null;
}

function buildVenueAddress(doc: MoenchengladbachApiDoc) {
  const parts = [
    normalizeText(doc.street_stringS),
    [normalizeText(doc.zip_stringS), normalizeText(doc.city_stringS)].filter(Boolean).join(" "),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function categoryFromDoc(doc: MoenchengladbachApiDoc): OfficialCityEvent["category"] {
  const signal = buildSignal(doc);

  if (/(weihnacht|advent|nikolaus|winterzauber|ostern|halloween|karneval)/.test(signal)) {
    return "seasonal";
  }
  if (/(gottesdienst|andacht|vesper|liturgie)/.test(signal)) {
    return "community";
  }
  if (/(wochenmarkt|flohmarkt|tr[oö]del|trodel|markt\b|verkaufsmarkt|feierabendmarkt|kunsthandwerkermarkt)/.test(signal)) {
    return "market";
  }
  if (/(junioruni|experiment|chemie|physik|mathe|schule|bildung|lernwerkstatt)/.test(signal)) {
    return "community";
  }
  if (/(street[\s-]?food|kulinar|genuss|wein|bier|brunch|dinner|tasting|menue|menu|food\b)/.test(signal)) {
    return "food_event";
  }
  if (/(festival|stadtfest|open[\s-]?air|rave|party\b|fest\b|kirmes|nacht der)/.test(signal)) {
    return "festival";
  }
  if (/(konzert|live\b|band\b|orchester|chor\b|jazz|rock|pop|musik\b|singer|songwriter|philharm)/.test(signal)) {
    return "concert";
  }
  if (/(theater|oper\b|operette|schauspiel|ballett|figurentheater|puppentheater|tanztheater)/.test(signal)) {
    return "theater";
  }
  if (/(comedy|kabarett|kino|film\b|lesung|vortrag|diskussion|talk\b|quiz|show\b|musical|performance|poetry|buehne|buhne)/.test(signal)) {
    return "show";
  }
  if (/(ausstellung|museum|messe|kongress|tagung|expo|vernissage|finissage|fotografie|kunst\b|installation)/.test(signal)) {
    return "fair";
  }
  if (/(workshop|kurs\b|seminar|treff\b|begegnung|sport\b|bewegung|yoga|pilates|fuehrung|fuhrung|rundgang|exkursion|beratung|sprechstunde|bildung|jugend|familie|kinder|senior|buerger|burger|forum|kirche|gottesdienst)/.test(signal)) {
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

function audiencesForDoc(category: OfficialCityEvent["category"], signal: string) {
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
  if (category === "market" || category === "festival" || category === "food_event" || category === "fair") {
    return ["tourism", "friends", "family", "date"];
  }
  return ["tourism", "friends"];
}

function subtypesForDoc(doc: MoenchengladbachApiDoc, category: OfficialCityEvent["category"]) {
  const signal = buildSignal(doc);
  return Array.from(
    new Set(
      [
        "concrete_event_page",
        category,
        category === "market" ? "market_event" : null,
        category === "festival" ? "festival_event" : null,
        /wochenmarkt/.test(signal) ? "weekly_market" : null,
        /flohmarkt|tr[oö]del|trodel/.test(signal) ? "flea_market" : null,
        /open[\s-]?air/.test(signal) ? "open_air" : null,
        /kino|film\b/.test(signal) ? "screening" : null,
        /lesung/.test(signal) ? "reading" : null,
        /vortrag|diskussion|talk\b|gesprach|gespraech/.test(signal) ? "talk" : null,
        /workshop|kurs\b|seminar/.test(signal) ? "workshop" : null,
        /fuehrung|fuhrung|rundgang/.test(signal) ? "guided_tour" : null,
        /ausstellung|museum|vernissage/.test(signal) ? "exhibition" : null,
      ].filter((value): value is string => Boolean(value))
    )
  );
}

function indoorOutdoorForDoc(category: OfficialCityEvent["category"], signal: string) {
  if (/(open[\s-]?air|markt|park|platz|arena|freiluft|innenstadt|flohmarkt)/.test(signal)) {
    return "outdoor" as const;
  }
  if (/(theater|kino|museum|halle|club|saal|kirche|forum|oper)/.test(signal)) {
    return "indoor" as const;
  }
  if (category === "festival" || category === "fair") return "mixed" as const;
  return null;
}

function familyFriendlyForDoc(category: OfficialCityEvent["category"], signal: string) {
  if (/(18\+|nightlife|party\b|rave)/.test(signal)) return false;
  if (/(famil|kinder|jugend|schule)/.test(signal)) return true;
  if (category === "market" || category === "festival") return true;
  return null;
}

function scoresForDoc(category: OfficialCityEvent["category"], priority: number | null) {
  const base = CATEGORY_PRIORITY[category] ?? 60;
  const priorityBoost = priority === null ? 0 : Math.max(-4, Math.min(10, Math.round(priority / 12)));
  return {
    localRank: base + priorityBoost,
    importance: base - 4 + priorityBoost,
    popularity: base - 8 + priorityBoost,
  };
}

function parseSourceUpdatedAt(doc: MoenchengladbachApiDoc) {
  const numeric = toNumber(doc.indexed);
  if (numeric !== null) {
    const millis = numeric > 10_000_000_000 ? numeric : numeric * 1000;
    const parsed = new Date(millis);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }

  const raw = normalizeText(doc.indexed);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function buildStartAndEnd(doc: MoenchengladbachApiDoc, category: OfficialCityEvent["category"]) {
  const startUnix = toNumber(doc.startTime_doubleS);
  if (startUnix === null) return null;

  const endUnix = toNumber(doc.endTime_doubleS);
  const days = Math.max(1, Math.round(toNumber(doc.days_doubleS) ?? 1));
  const startAt = berlinIsoFromUnixSeconds(startUnix);
  const startDate = new Date(startUnix * 1000);
  const startLocal = berlinLocalParts(startDate);
  let endAt = endUnix !== null ? berlinIsoFromUnixSeconds(endUnix) : null;

  if (!endAt && days > 1) {
    const endDate = addDays(startDate, days - 1);
    const endLocal = berlinLocalParts(endDate);
    const fallbackHour =
      category === "market" || category === "festival" || category === "fair" || category === "food_event"
        ? 18
        : 23;
    endAt = berlinIso(endLocal.year, endLocal.month, endLocal.day, fallbackHour, 0);
  }

  const endLocal = endUnix !== null ? berlinLocalParts(new Date(endUnix * 1000)) : null;
  const allDay =
    startLocal.hour === 0 &&
    startLocal.minute === 0 &&
    (endLocal === null || (endLocal.hour === 0 && endLocal.minute === 0) || days > 1);

  return {
    startAt,
    endAt,
    allDay,
  };
}

function buildSearchUrl(baseUrl: string, page: number, startUnix: number) {
  const url = new URL(baseUrl || MOENCHENGLADBACH_EVENTS_URL);
  url.searchParams.set("type", "420");
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("page", String(page));
  url.searchParams.set("mode", `next_months,${LOOKAHEAD_MONTHS}`);
  url.searchParams.set("start", String(startUnix));
  url.searchParams.set("end", "*");
  url.searchParams.set("sort", "startTime_doubleS asc,sortTitle asc");
  return url.toString();
}

function extractItems(payload: MoenchengladbachApiResponse) {
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.response?.docs)) return payload.response.docs;
  return [];
}

function buildExternalId(doc: MoenchengladbachApiDoc, startAt: string) {
  const variantId = normalizeText(doc.variantId?.toString());
  const id = normalizeText(doc.id?.toString());
  const base =
    variantId ||
    id ||
    normalizeText(doc.url) ||
    [normalizeText(doc.title), normalizeText(doc.startTime_doubleS?.toString())].filter(Boolean).join(":");
  return `moenchengladbach_city:${base}:${startAt}`;
}

export async function fetchMoenchengladbachCityEvents(config: EventSourceConfigRow) {
  const startUnix = berlinStartOfDayUnix(new Date());
  const baseUrl = normalizeText(config.base_url) || MOENCHENGLADBACH_EVENTS_URL;
  const byKey = new Map<string, MoenchengladbachApiDoc>();

  let page = 1;
  let totalFound = Number.POSITIVE_INFINITY;

  while (page <= MAX_PAGES && (page - 1) * PAGE_SIZE < totalFound) {
    const response = await fetchJson<MoenchengladbachApiResponse>(buildSearchUrl(baseUrl, page, startUnix));
    const items = extractItems(response);
    totalFound = Number(response.response?.numFound ?? items.length);

    if (items.length === 0) break;

    for (const item of items) {
      const key =
        normalizeText(item.variantId?.toString()) ||
        normalizeText(item.id?.toString()) ||
        normalizeText(item.url) ||
        [normalizeText(item.title), normalizeText(item.startTime_doubleS?.toString())].filter(Boolean).join(":");
      if (!key) continue;
      byKey.set(key, item);
    }

    page += 1;
  }

  return Array.from(byKey.values()).sort((left, right) => {
    const leftStart = toNumber(left.startTime_doubleS) ?? 0;
    const rightStart = toNumber(right.startTime_doubleS) ?? 0;
    return leftStart - rightStart;
  });
}

export function normalizeMoenchengladbachCityEvent(
  doc: MoenchengladbachApiDoc,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const title = stripTags(doc.title);
  if (!title) return null;

  const category = categoryFromDoc(doc);
  const timing = buildStartAndEnd(doc, category);
  if (!timing) return null;

  const summary = buildSummary(doc);
  const sourceUrl = toAbsoluteUrl(doc.url, config.base_url || MOENCHENGLADBACH_EVENTS_URL);
  const ticketUrl = looksLikeUrl(doc.registration_stringS)
    ? toAbsoluteUrl(doc.registration_stringS, config.base_url || MOENCHENGLADBACH_EVENTS_URL)
    : null;
  const venueName = normalizeText(doc.locationname_stringS) || normalizeText(doc.organizername_stringS) || null;
  const venueAddress = buildVenueAddress(doc);
  const lat = toNumber(doc.latitude_doubleS);
  const lng = toNumber(doc.longitude_doubleS);
  const signal = buildSignal(doc);
  const scores = scoresForDoc(category, toNumber(doc.priority_intS));

  return {
    source: config.provider,
    external_id: buildExternalId(doc, timing.startAt),
    source_url: sourceUrl,
    ticket_url: ticketUrl,
    title,
    summary,
    category,
    kind: kindForCategory(category),
    status: "scheduled",
    venue_name: venueName,
    venue_address: venueAddress,
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat,
    lng,
    timezone: "Europe/Berlin",
    start_at: timing.startAt,
    end_at: timing.endAt,
    doors_at: null,
    all_day: timing.allDay,
    is_ticketed: Boolean(
      ticketUrl ||
        (/\b(ticket|karten|anmeldung)\b/.test(signal) && !/\b(kostenlos|eintritt frei)\b/.test(signal))
    ),
    price_min: null,
    price_max: null,
    currency: null,
    family_friendly: familyFriendlyForDoc(category, signal),
    indoor_outdoor: indoorOutdoorForDoc(category, signal),
    local_rank: scores.localRank,
    importance_score: scores.importance,
    popularity_score: scores.popularity,
    tags: Array.from(
      new Set(
        [
          category,
          ...categoryNamesForDoc(doc).map((item) => foldSearchText(item)),
          normalizeText(venueName).toLowerCase(),
        ].filter(Boolean)
      )
    ),
    subtypes: subtypesForDoc(doc, category),
    audiences: audiencesForDoc(category, signal),
    occasions: occasionsForCategory(category),
    source_payload: doc,
    source_updated_at: parseSourceUpdatedAt(doc),
    last_seen_at: new Date().toISOString(),
  };
}
