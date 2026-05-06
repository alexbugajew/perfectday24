import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type AugsburgCountry = {
  code?: string | null;
};

type AugsburgCoordinates = {
  latitude?: number | null;
  longitude?: number | null;
};

type AugsburgLocation = {
  id?: number | null;
  street?: string | null;
  number?: string | null;
  city?: string | null;
  zip?: string | null;
  country?: AugsburgCountry | null;
  coordinates?: AugsburgCoordinates | null;
};

type AugsburgTag = {
  id?: number | null;
  name?: string | null;
};

type AugsburgCollection = {
  id?: number | null;
  title?: string | null;
  slug?: string | null;
  description?: string | null;
};

type AugsburgImage = {
  id?: number | null;
  image?: string | null;
  source?: string | null;
};

type AugsburgEvent = {
  id: number;
  title?: string | null;
  organizer?: string | null;
  short_description?: string | null;
  description?: string | null;
  location_addition?: string | null;
  ticket_price?: string | null;
  priority?: number | null;
  is_recurring?: boolean | null;
  collection?: AugsburgCollection | null;
  image?: AugsburgImage | null;
  location?: AugsburgLocation | null;
  tags?: AugsburgTag[] | null;
};

type AugsburgOccurrence = {
  id: number;
  event: AugsburgEvent;
  key: string;
  start_date?: string | null;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
};

type AugsburgApiResponse = {
  pagination?: {
    page?: number | null;
    paginate_by?: number | null;
    total_count?: number | null;
    num_pages?: number | null;
  } | null;
  data?: AugsburgOccurrence[] | null;
};

const AUGSBURG_EVENTS_API_URL = "https://api.augsburg-api.de/api/v2/calendar/event_occurrences/";
const LOOKAHEAD_DAYS = 420;
const PAGE_SIZE = 250;
const MAX_PAGES = 24;

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

function foldSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00df/g, "ss");
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

function toAbsoluteUrl(url: string | null | undefined, baseUrl: string) {
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
    throw new Error(`[augsburg_city] HTTP ${response.status} fuer ${url}`);
  }

  return (await response.json()) as T;
}

function berlinLocalParts(date: Date) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

function berlinDateString(date: Date) {
  const local = berlinLocalParts(date);
  return `${String(local.year).padStart(4, "0")}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
}

function berlinOffset(date: Date) {
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

  const utcLikeLocalMs = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
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

function parseDateOnly(value: string | null | undefined) {
  const normalized = normalizeText(value);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function parseTimeParts(value: string | null | undefined) {
  const normalized = normalizeText(value);
  const match = normalized.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
    second: Number(match[3] ?? 0),
  };
}

function defaultTimeForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "show" || category === "theater") {
    return { hour: 19, minute: 30, second: 0 };
  }
  if (category === "market" || category === "festival" || category === "fair" || category === "food_event") {
    return { hour: 12, minute: 0, second: 0 };
  }
  return { hour: 17, minute: 0, second: 0 };
}

function buildSearchUrl(page: number, dateFrom: string, dateTo: string) {
  const url = new URL(AUGSBURG_EVENTS_API_URL);
  url.searchParams.set("upcoming_only", "true");
  url.searchParams.set("date_ge", dateFrom);
  url.searchParams.set("date_le", dateTo);
  url.searchParams.set("paginate_by", String(PAGE_SIZE));
  url.searchParams.set("page", String(page));
  return url.toString();
}

function buildDetailUrl(eventId: number, key: string) {
  const url = new URL("https://www.augsburg.de/detail-kalender");
  url.searchParams.set("tx_t23calendar_eventshow[action]", "show");
  url.searchParams.set("tx_t23calendar_eventshow[controller]", "Calendar");
  url.searchParams.set("tx_t23calendar_eventshow[event]", String(eventId));
  url.searchParams.set("tx_t23calendar_eventshow[key]", key);
  return url.toString();
}

function categoryFromEvent(occurrence: AugsburgOccurrence): OfficialCityEvent["category"] {
  const event = occurrence.event;
  const title = normalizeText(event.title).toLowerCase();
  const organizer = normalizeText(event.organizer).toLowerCase();
  const locationAddition = normalizeText(event.location_addition).toLowerCase();
  const collection = normalizeText(event.collection?.title).toLowerCase();
  const tags = (event.tags ?? []).map((tag) => normalizeText(tag.name).toLowerCase()).filter(Boolean);
  const description = [
    stripTags(event.short_description),
    stripTags(event.description),
    normalizeText(event.ticket_price),
  ]
    .join(" ")
    .toLowerCase();
  const descriptiveText = [title, organizer, collection, tags.join(" "), description]
    .filter(Boolean)
    .join(" ");
  const signalText = [descriptiveText, locationAddition]
    .filter(Boolean)
    .join(" ");
  const marketSignalText = [title, collection, tags.join(" ")]
    .filter(Boolean)
    .join(" ");
  const explicitMarketIntent = /(flohmarkt|wochenmarkt|marktsonntag|tr[oÃ¶]del|basar|pflanzenmarkt|\bmarkt\b)/.test(
    descriptiveText
  );
  const communityConsultationIntent =
    /(sprechstunde|beratung|experten geben auskunft|dialog|gespr[aÃ¤]ch|information|begegnung|seminar|workshop|vortrag|fuehrung|rundgang|kurs)/.test(
      signalText
    );

  const strongMarketIntent =
    /(flohmarkt|wochenmarkt|marktsonntag|troedel|tr(o|oe)del|basar|pflanzenmarkt|\bmarkt\b)/.test(
      descriptiveText
    );
  const clearConversationIntent =
    /(sprechstunde|beratung|experten geben auskunft|dialog|gespraech|information|begegnung|seminar|workshop|vortrag|fuehrung|rundgang|kurs)/.test(
      signalText
    );
  const curatedMarketIntent =
    /(flohmarkt|wochenmarkt|marktsonntag|troedel|tr(o|oe)del|basar|pflanzenmarkt|jahrmarkt|bauernmarkt|nachtmarkt|weihnachtsmarkt|adventsmarkt|ostermarkt|fruehlingsmarkt|herbstmarkt)/.test(
      marketSignalText
    );

  if (/(weihnacht|advent|christkind|winterzauber|nikolaus|silvester|oster)/.test(signalText)) {
    return "seasonal";
  }
  if (
    /(street\s*food|kulinar|brunch|dinner|wein|wine|bier|beer|tasting|men[uü]|fruehstueck|frühstück|picknick|gourmet)/.test(
      signalText
    )
  ) {
    return "food_event";
  }
  if ((communityConsultationIntent || clearConversationIntent) && !curatedMarketIntent) {
    return "community";
  }
  if (!curatedMarketIntent && /(flohmarkt|wochenmarkt|marktsonntag|tr[oÃ¶]del|basar|pflanzenmarkt|\bmarkt\b)/.test(signalText)) {
    return "community";
  }
  if (/(flohmarkt|wochenmarkt|marktsonntag|tr[oö]del|basar|pflanzenmarkt|\bmarkt\b)/.test(signalText)) {
    return "market";
  }
  if (/\b(theater|oper|operette|schauspiel|ballett|b[üu]hne|puppenspiel|puppentheater)\b/.test(signalText)) {
    return "theater";
  }
  if (/\b(konzert|concert|jazz|band|orchester|orchestra|chor|musik)\b|live-musik|solo piano/.test(signalText)) {
    return "concert";
  }
  if (/\b(kino|films?|musical|show|comedy|kabarett|lesung|slam|performance)\b|poetry slam/.test(signalText)) {
    return "show";
  }
  if (/\b(ausstellung|museum|vernissage|messe|expo|kongress|congress)\b/.test(signalText)) {
    return "fair";
  }
  if (/(festival|stadtfest|sommerfest|open[\s-]?air|future week|culture week|festwoche|nacht der)/.test(signalText)) {
    return "festival";
  }
  if (
    /(workshop|vortrag|sprechstunde|f[üu]hrung|fuehrung|rundgang|kurs|seminar|dialog|beratung|online-vortrag|gedenk|begegnung|information)/.test(
      signalText
    )
  ) {
    return "community";
  }

  return "other";
}

function classifyAugsburgCategory(occurrence: AugsburgOccurrence): OfficialCityEvent["category"] {
  const event = occurrence.event;
  const title = normalizeText(event.title).toLowerCase();
  const organizer = normalizeText(event.organizer).toLowerCase();
  const locationAddition = normalizeText(event.location_addition).toLowerCase();
  const collection = normalizeText(event.collection?.title).toLowerCase();
  const tags = (event.tags ?? []).map((tag) => normalizeText(tag.name).toLowerCase()).filter(Boolean);
  const description = [
    stripTags(event.short_description),
    stripTags(event.description),
    normalizeText(event.ticket_price),
  ]
    .join(" ")
    .toLowerCase();
  const descriptiveText = [title, organizer, collection, tags.join(" "), description]
    .filter(Boolean)
    .join(" ");
  const signalText = [descriptiveText, locationAddition]
    .filter(Boolean)
    .join(" ");
  const marketSignalText = [title, collection, tags.join(" ")]
    .filter(Boolean)
    .join(" ");
  const signalFolded = foldSearchText(signalText);
  const marketSignalFolded = foldSearchText(marketSignalText);
  const curatedMarketIntent =
    /(flohmarkt|wochenmarkt|marktsonntag|trodel|troedel|basar|pflanzenmarkt|jahrmarkt|bauernmarkt|nachtmarkt|weihnachtsmarkt|adventsmarkt|ostermarkt|fruhlingsmarkt|herbstmarkt)\b/.test(
      marketSignalFolded
    );
  const curatedFestivalIntent =
    /(future week|rocketeer festival|europafest|festival|stadtfest|sommerfest|fruhlingsfest|maifest|volksfest|festwoche|nacht der|open[\s-]?air|japanisch(?:e|es)?(?:r)?\s+[a-z\s-]*fest)/.test(
      marketSignalFolded
    );
  const clearCulinaryIntent =
    /(street\s*food|kulinar|brunch|dinner|wein|wine|bier|beer|tasting|menu|fruhstuck|picknick|gourmet|stockbrot)/.test(
      signalFolded
    );
  const communityConversationIntent =
    /(sprechstunde|beratung|experten geben auskunft|dialog|gesprach|information|begegnung|seminar|workshop|vortrag|fuhrung|rundgang|kurs)/.test(
      signalFolded
    );
  const libraryCommunityIntent =
    /(vr-brille|bucherei|next level|musikstudio|comic tag|lesekreis|smartphone leicht gemacht|digitale angebote)/.test(
      signalFolded
    );
  const storyStageIntent =
    /(marchen|geschichten|story|poetry slam|lesung|kindertheater|figurentheater|puppentheater|erzahl)/.test(
      signalFolded
    );

  if (/(weihnacht|advent|christkind|winterzauber|nikolaus|silvester|oster)/.test(signalFolded)) {
    return "seasonal";
  }
  if (curatedMarketIntent) {
    return "market";
  }
  if (curatedFestivalIntent) {
    return "festival";
  }
  if (storyStageIntent && !libraryCommunityIntent) {
    return "show";
  }
  if (libraryCommunityIntent && !clearCulinaryIntent) {
    return "community";
  }
  if (clearCulinaryIntent && !storyStageIntent && !libraryCommunityIntent) {
    return "food_event";
  }
  if (communityConversationIntent && !curatedMarketIntent) {
    return "community";
  }
  if (/(flohmarkt|wochenmarkt|marktsonntag|trodel|troedel|basar|pflanzenmarkt|\bmarkt\b)/.test(signalFolded)) {
    return "market";
  }
  if (/\b(theater|oper|operette|schauspiel|ballett|buhne|puppenspiel|puppentheater)\b/.test(signalFolded)) {
    return "theater";
  }
  if (/\b(konzert|concert|jazz|band|orchester|orchestra|chor|musik)\b|live-musik|solo piano/.test(signalFolded)) {
    return "concert";
  }
  if (/\b(kino|films?|musical|show|comedy|kabarett|lesung|slam|performance)\b|poetry slam/.test(signalFolded)) {
    return "show";
  }
  if (/\b(ausstellung|museum|vernissage|messe|expo|kongress|congress)\b/.test(signalFolded)) {
    return "fair";
  }
  if (/(festival|stadtfest|sommerfest|open[\s-]?air|future week|culture week|festwoche|nacht der)/.test(signalFolded)) {
    return "festival";
  }
  if (/(workshop|vortrag|sprechstunde|fuhrung|rundgang|kurs|seminar|dialog|beratung|online-vortrag|gedenk|begegnung|information)/.test(signalFolded)) {
    return "community";
  }

  return "other";
}

function kindForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "show" || category === "theater") {
    return "anchored_event" as const;
  }
  return "flex_event" as const;
}

function venueNameForOccurrence(occurrence: AugsburgOccurrence) {
  const addition = normalizeText(occurrence.event.location_addition);
  if (addition && !/^online$/i.test(addition)) return addition;
  return null;
}

function venueAddressForOccurrence(occurrence: AugsburgOccurrence) {
  const location = occurrence.event.location;
  if (!location) return null;

  const street = [normalizeText(location.street), normalizeText(location.number)].filter(Boolean).join(" ");
  const cityLine = [normalizeText(location.zip), normalizeText(location.city)].filter(Boolean).join(" ");
  return [street, cityLine].filter(Boolean).join(", ") || null;
}

function extractLinksWithText(html: string, baseUrl: string) {
  return Array.from(
    String(html ?? "").matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)
  ).map((match) => ({
    url: toAbsoluteUrl(decodeHtml(match[1]), baseUrl),
    label: stripTags(match[2]).toLowerCase(),
  }));
}

function ticketUrlForOccurrence(occurrence: AugsburgOccurrence) {
  const links = [
    ...extractLinksWithText(occurrence.event.description ?? "", "https://www.augsburg.de"),
    ...extractLinksWithText(occurrence.event.short_description ?? "", "https://www.augsburg.de"),
  ].filter((link) => Boolean(link.url)) as Array<{ url: string; label: string }>;

  return (
    links.find((link) =>
      /(ticket|karten|reserv|booking|anmeld|eventbrite|pretix|ticketmaster|formular-service\.augsburg\.de)/.test(
        `${link.url} ${link.label}`
      )
    )?.url ?? null
  );
}

function parseEuroValues(value: string | null | undefined) {
  const normalized = normalizeText(value)
    .replace(/,/g, ".")
    .replace(/\s+/g, " ");
  const numbers = Array.from(normalized.matchAll(/(\d+(?:\.\d{1,2})?)/g))
    .map((match) => Number(match[1]))
    .filter((item) => Number.isFinite(item));

  if (numbers.length === 0) return { min: null, max: null };
  return { min: Math.min(...numbers), max: Math.max(...numbers) };
}

function familyFriendlyForOccurrence(category: OfficialCityEvent["category"], text: string) {
  if (/(famil|kinder|jugend|ab\s*\d+)/.test(text)) return true;
  if (category === "market" || category === "festival") return null;
  return null;
}

function indoorOutdoorForOccurrence(text: string, category: OfficialCityEvent["category"]) {
  if (/\bonline\b/.test(text)) return "indoor" as const;
  if (/(open[\s-]?air|markt|platz|park|innenstadt|hof|straße|strasse)/.test(text)) {
    return "outdoor" as const;
  }
  if (category === "market" || category === "festival") return "outdoor" as const;
  return null;
}

function tagsForOccurrence(occurrence: AugsburgOccurrence, category: OfficialCityEvent["category"]) {
  return Array.from(
    new Set(
      [
        "augsburg_city",
        category,
        normalizeText(occurrence.event.collection?.title).toLowerCase(),
        normalizeText(occurrence.event.organizer).toLowerCase(),
        ...(occurrence.event.tags ?? []).map((tag) => normalizeText(tag.name).toLowerCase()),
        /^online$/i.test(normalizeText(occurrence.event.location_addition)) ? "online" : "",
      ].filter(Boolean)
    )
  );
}

function subtypesForOccurrence(occurrence: AugsburgOccurrence, category: OfficialCityEvent["category"]) {
  const text = [
    normalizeText(occurrence.event.title),
    normalizeText(occurrence.event.location_addition),
    stripTags(occurrence.event.description),
  ]
    .join(" ")
    .toLowerCase();
  const descriptiveText = [
    normalizeText(occurrence.event.title),
    stripTags(occurrence.event.description),
  ]
    .join(" ")
    .toLowerCase();

  const subtypes = new Set<string>();
  if (category === "market" && /flohmarkt|wochenmarkt/.test(descriptiveText)) subtypes.add("weekly_market");
  if (/open[\s-]?air/.test(text)) subtypes.add("open_air");
  if (/kino|film/.test(text)) subtypes.add("film_screening");
  if (/lesung/.test(text)) subtypes.add("reading");
  if (/sprechstunde|beratung|gespraech|experten geben auskunft/.test(text)) subtypes.add("talk");
  if (/sprechstunde|beratung|gespr[aÃ¤]ch|experten geben auskunft/.test(text)) subtypes.add("talk");
  if (/workshop/.test(text)) subtypes.add("workshop");
  if (/f[üu]hrung|fuehrung|rundgang/.test(text)) subtypes.add("guided_tour");
  if (category === "fair" && /ausstellung|vernissage|museum/.test(text)) subtypes.add("exhibition");
  if (/online/.test(text)) subtypes.add("online");
  return Array.from(subtypes);
}

function buildAugsburgSubtypes(occurrence: AugsburgOccurrence, category: OfficialCityEvent["category"]) {
  const text = [
    normalizeText(occurrence.event.title),
    normalizeText(occurrence.event.location_addition),
    stripTags(occurrence.event.description),
  ]
    .join(" ")
    .toLowerCase();
  const descriptiveText = [
    normalizeText(occurrence.event.title),
    stripTags(occurrence.event.description),
  ]
    .join(" ")
    .toLowerCase();
  const textFolded = foldSearchText(text);
  const descriptiveFolded = foldSearchText(descriptiveText);

  const subtypes = new Set<string>();
  if (category === "market") subtypes.add("market_event");
  if (category === "festival") subtypes.add("festival_event");
  if (category === "market" && /flohmarkt|wochenmarkt/.test(descriptiveFolded)) subtypes.add("weekly_market");
  if (/open[\s-]?air/.test(textFolded)) subtypes.add("open_air");
  if (/kino|film/.test(textFolded)) subtypes.add("film_screening");
  if (/lesung/.test(textFolded)) subtypes.add("reading");
  if (/sprechstunde|beratung|gesprach|experten geben auskunft/.test(textFolded)) subtypes.add("talk");
  if (/workshop/.test(textFolded)) subtypes.add("workshop");
  if (/fuhrung|rundgang/.test(textFolded)) subtypes.add("guided_tour");
  if (category === "fair" && /ausstellung|vernissage|museum/.test(textFolded)) subtypes.add("exhibition");
  if (/online/.test(textFolded)) subtypes.add("online");
  return Array.from(subtypes);
}

function audiencesForOccurrence(category: OfficialCityEvent["category"], text: string) {
  const audiences = new Set<string>();
  if (/(famil|kinder|jugend)/.test(text)) audiences.add("family");
  if (category === "concert" || category === "show" || category === "festival") {
    audiences.add("friends");
    audiences.add("date");
  }
  if (category === "theater") {
    audiences.add("date");
    audiences.add("tourism");
  }
  if (category === "market" || category === "fair") {
    audiences.add("tourism");
    audiences.add("friends");
  }
  if (category === "community") audiences.add("friends");
  if (audiences.size === 0) audiences.add("friends");
  return Array.from(audiences);
}

function occasionsForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "show" || category === "theater") {
    return ["date", "friends"];
  }
  if (category === "market" || category === "festival" || category === "fair") {
    return ["tourism", "friends", "date"];
  }
  if (category === "food_event") return ["date", "friends"];
  return ["friends", "tourism"];
}

export async function fetchAugsburgCityEvents(_config: EventSourceConfigRow) {
  const today = berlinDateString(new Date());
  const upperBound = berlinDateString(new Date(Date.now() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000));
  const byKey = new Map<string, AugsburgOccurrence>();

  let page = 1;
  let numPages = 1;

  while (page <= numPages && page <= MAX_PAGES) {
    const response = await fetchJson<AugsburgApiResponse>(buildSearchUrl(page, today, upperBound));
    const items = Array.isArray(response.data) ? response.data : [];
    for (const item of items) {
      if (!item?.key || !item?.event?.id) continue;
      byKey.set(item.key, item);
    }

    numPages = Number(response.pagination?.num_pages ?? 1);
    page += 1;
  }

  return Array.from(byKey.values());
}

export function normalizeAugsburgCityEvent(
  occurrence: AugsburgOccurrence,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const dateParts = parseDateOnly(occurrence.start_date);
  if (!dateParts) return null;

  const category = classifyAugsburgCategory(occurrence);
  if (category === "other") return null;

  const startTime = parseTimeParts(occurrence.start_time) ?? defaultTimeForCategory(category);
  const endDateParts = parseDateOnly(occurrence.end_date) ?? dateParts;
  const endTime = parseTimeParts(occurrence.end_time);
  const startAt = berlinIso(dateParts.year, dateParts.month, dateParts.day, startTime.hour, startTime.minute);
  const endAt = endTime
    ? berlinIso(endDateParts.year, endDateParts.month, endDateParts.day, endTime.hour, endTime.minute)
    : null;

  const detailUrl = buildDetailUrl(occurrence.event.id, occurrence.key);
  const venueName = venueNameForOccurrence(occurrence);
  const venueAddress = venueAddressForOccurrence(occurrence);
  const ticketUrl = ticketUrlForOccurrence(occurrence);
  const ticketPriceText = normalizeText(occurrence.event.ticket_price);
  const priceRange = parseEuroValues(ticketPriceText);
  const freeEntry = /(frei|kostenlos|free)/i.test(ticketPriceText);
  const text = [
    normalizeText(occurrence.event.title),
    normalizeText(occurrence.event.organizer),
    normalizeText(occurrence.event.location_addition),
    normalizeText(occurrence.event.collection?.title),
    stripTags(occurrence.event.short_description),
    stripTags(occurrence.event.description),
    ticketPriceText,
  ]
    .join(" ")
    .toLowerCase();
  const importanceScore =
    CATEGORY_PRIORITY[category] +
    Number(occurrence.event.priority ?? 0) * 4 +
    (ticketUrl ? 4 : 0) +
    (occurrence.event.location?.coordinates?.latitude ? 4 : 0);
  const popularityScore = importanceScore - 6 + Number(occurrence.event.priority ?? 0) * 2;

  return {
    source: config.provider,
    external_id: `augsburg_city:${occurrence.key}`,
    source_url: detailUrl,
    ticket_url: ticketUrl,
    title: normalizeText(decodeHtml(occurrence.event.title ?? "")),
    summary: stripTags(occurrence.event.short_description) || stripTags(occurrence.event.description) || null,
    category,
    kind: kindForCategory(category),
    status:
      /abgesagt|entf[aä]llt|verschoben/.test(text) && !/auf\s+\d{1,2}\.\d{1,2}\.\d{4}/.test(text)
        ? "cancelled"
        : "scheduled",
    venue_name: venueName,
    venue_address: venueAddress,
    city_slug: config.city_slug,
    country_code: config.country_code ?? occurrence.event.location?.country?.code ?? "DE",
    lat: occurrence.event.location?.coordinates?.latitude ?? null,
    lng: occurrence.event.location?.coordinates?.longitude ?? null,
    timezone: "Europe/Berlin",
    start_at: startAt,
    end_at: endAt,
    doors_at: null,
    all_day: !normalizeText(occurrence.start_time),
    is_ticketed: Boolean(ticketUrl) || (!!ticketPriceText && !freeEntry),
    price_min: freeEntry ? 0 : priceRange.min,
    price_max: freeEntry ? 0 : priceRange.max,
    currency: "EUR",
    family_friendly: familyFriendlyForOccurrence(category, text),
    indoor_outdoor: indoorOutdoorForOccurrence(text, category),
    local_rank: importanceScore,
    importance_score: importanceScore,
    popularity_score: popularityScore,
    tags: tagsForOccurrence(occurrence, category),
    subtypes: buildAugsburgSubtypes(occurrence, category),
    audiences: audiencesForOccurrence(category, text),
    occasions: occasionsForCategory(category),
    source_payload: occurrence,
    source_updated_at: null,
    last_seen_at: new Date().toISOString(),
  };
}
