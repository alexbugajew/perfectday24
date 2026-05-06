import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type GelsenkirchenListingCard = {
  slug: string;
  sourceUrl: string;
};

type GelsenkirchenIcsEvent = {
  summary: string | null;
  description: string | null;
  location: string | null;
  startAt: string | null;
  endAt: string | null;
  allDay: boolean;
};

type GelsenkirchenDetailEvent = {
  slug: string;
  sourceUrl: string;
  title: string;
  summary: string | null;
  categoryLabel: string | null;
  schedulingLabel: string | null;
  venueName: string | null;
  venueAddress: string | null;
  lat: number | null;
  lng: number | null;
  costLabel: string | null;
  doorsAt: string | null;
  ticketUrl: string | null;
  icsUrl: string | null;
  sourceUpdatedAt: string | null;
  ics: GelsenkirchenIcsEvent | null;
};

const GELSENKIRCHEN_ROOT_URL = "https://www.gelsenkirchen.de";
const GELSENKIRCHEN_EVENTS_URL = `${GELSENKIRCHEN_ROOT_URL}/de/_meta/veranstaltungskalender/`;
const MAX_LISTING_PAGES = 10;
const LOOKAHEAD_DAYS = 120;
const DETAIL_BATCH_SIZE = 6;

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

const GERMAN_MONTHS: Record<string, number> = {
  januar: 1,
  februar: 2,
  maerz: 3,
  march: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
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

function toAbsoluteUrl(url: string | null | undefined, baseUrl = GELSENKIRCHEN_ROOT_URL) {
  const normalized = normalizeText(decodeHtml(url ?? ""));
  if (!normalized) return null;
  try {
    return new URL(normalized, baseUrl).toString();
  } catch {
    return normalized;
  }
}

async function fetchText(url: string, accept = "text/html,application/xhtml+xml,application/xml") {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "perfectday24-event-ingest/1.0",
          accept,
        },
      });

      if (!response.ok) {
        throw new Error(`[gelsenkirchen_city] HTTP ${response.status} fuer ${url}`);
      }

      return response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 250));
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`[gelsenkirchen_city] Fetch fehlgeschlagen fuer ${url}`);
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

function berlinDateString(date: Date) {
  const local = berlinLocalParts(date);
  return `${String(local.year).padStart(4, "0")}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
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

function addDays(date: Date, amount: number) {
  return new Date(date.getTime() + amount * 24 * 60 * 60 * 1000);
}

function buildPageUrl(baseUrl: string, pageNumber: number) {
  if (pageNumber <= 1) return baseUrl;
  return new URL(`seite/${pageNumber}`, baseUrl).toString();
}

function chunkItems<T>(items: T[], size: number) {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function parseListingCards(html: string, baseUrl: string) {
  const bySlug = new Map<string, GelsenkirchenListingCard>();

  for (const match of html.matchAll(
    /href="([^"]*\/de\/_meta\/veranstaltungskalender\/(?!seite\/|download\/)(\d+-[^"?#/]+))"/gi
  )) {
    const href = match[1];
    const slug = normalizeText(match[2]);
    const sourceUrl = toAbsoluteUrl(href, baseUrl);
    if (!slug || !sourceUrl) continue;
    bySlug.set(slug, {
      slug,
      sourceUrl,
    });
  }

  return Array.from(bySlug.values());
}

function hasNextPage(html: string, currentPage: number) {
  if (/rel=["']next["']/i.test(html)) return true;
  const nextPath = `/de/_meta/veranstaltungskalender/seite/${currentPage + 1}`;
  return html.includes(nextPath);
}

function parseMonthName(value: string) {
  const normalized = foldSearchText(value).replace(/\./g, "");
  return GERMAN_MONTHS[normalized] ?? null;
}

function parseGermanLongDate(value: string) {
  const match = normalizeText(value).match(/^(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)\s+(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = parseMonthName(match[2]);
  const year = Number(match[3]);
  if (!month || !year) return null;

  return {
    day,
    month,
    year,
  };
}

function parseTimeFragment(value: string | null | undefined) {
  const match = normalizeText(value).match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (!match) return null;
  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  };
}

function defaultTimeForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") return "19:30";
  if (category === "market" || category === "festival" || category === "fair" || category === "food_event") {
    return "12:00";
  }
  return "17:00";
}

function buildIsoFromLongGermanDate(
  dateText: string,
  timeText: string | null,
  category: OfficialCityEvent["category"]
) {
  const parsedDate = parseGermanLongDate(dateText);
  if (!parsedDate) return null;
  const time = parseTimeFragment(timeText ?? defaultTimeForCategory(category));
  if (!time) return null;
  return berlinIso(parsedDate.year, parsedDate.month, parsedDate.day, time.hour, time.minute);
}

function extractMetaContent(html: string, id: string) {
  return (
    normalizeText(
      html.match(new RegExp(`<meta[^>]*id=["']${id}["'][^>]*content=["']([\\s\\S]*?)["']`, "i"))?.[1]
    ) || null
  );
}

function extractStrongParagraphs(html: string) {
  return Array.from(html.matchAll(/<p>\s*<strong>([\s\S]*?)<\/strong>\s*<\/p>/gi))
    .map((match) => stripTags(match[1]))
    .filter(Boolean);
}

function extractSectionValue(html: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(
    new RegExp(
      `<h[23][^>]*>\\s*${escaped}\\s*<\\/h[23]>[\\s\\S]*?<p[^>]*>([\\s\\S]*?)<\\/p>`,
      "i"
    )
  );
  return stripTags(match?.[1] ?? "") || null;
}

function parseGeoMarker(html: string) {
  const payload = html.match(/data-geMap-marker="([^"]+)"/i)?.[1] ?? null;
  if (!payload) {
    return {
      lat: null,
      lng: null,
      title: null,
      address: null,
    };
  }

  const decoded = decodeHtml(payload);
  const lat = Number(decoded.match(/'lat':\s*([0-9.\-]+)/i)?.[1] ?? "");
  const lng = Number(decoded.match(/'lng':\s*([0-9.\-]+)/i)?.[1] ?? "");
  const title = normalizeText(decoded.match(/'title':'([^']*)'/i)?.[1] ?? "") || null;
  const address = normalizeText(decoded.match(/'address':'([^']*)'/i)?.[1] ?? "") || null;

  return {
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    title,
    address,
  };
}

function extractIcsUrl(html: string) {
  const path =
    html.match(/href="([^"]*\/de\/_meta\/veranstaltungskalender\/download\/\d+-[^"]+)"/i)?.[1] ??
    html.match(/(\/de\/_meta\/veranstaltungskalender\/download\/\d+-[^"'\\s<]+)/i)?.[1] ??
    null;
  return toAbsoluteUrl(path, GELSENKIRCHEN_ROOT_URL);
}

function extractTicketUrl(html: string) {
  for (const match of html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = normalizeText(match[1]);
    const label = stripTags(match[2]);
    if (!href) continue;
    if (/\/de\/_meta\/veranstaltungskalender\/download\//i.test(href)) continue;
    if (!/^https?:/i.test(href)) continue;
    if (!/(ticket|karten|buch|reservier|anmeld|zum veranstalter)/i.test(label)) continue;
    return href;
  }
  return null;
}

function parseSchedulingLine(value: string | null) {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  const parts = normalized.split(",").map((part) => normalizeText(part)).filter(Boolean);
  if (parts.length < 2) return null;

  return {
    categoryLabel: parts[0] ?? null,
    dateLabel: parts[1] ?? null,
    timeLabel: parts[2] ?? null,
    venueName: parts.length > 3 ? parts.slice(3).join(", ") : null,
  };
}

function unfoldIcs(text: string) {
  return text.replace(/\r?\n[ \t]/g, "");
}

function parseIcsDate(value: string, tzid: string | null, valueType: string | null) {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  if (valueType === "DATE" || /^\d{8}$/.test(normalized)) {
    const year = Number(normalized.slice(0, 4));
    const month = Number(normalized.slice(4, 6));
    const day = Number(normalized.slice(6, 8));
    if (!year || !month || !day) return null;
    return {
      iso: berlinIso(year, month, day, 12, 0),
      allDay: true,
    };
  }

  const dateTimeMatch = normalized.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/
  );
  if (!dateTimeMatch) return null;

  const year = Number(dateTimeMatch[1]);
  const month = Number(dateTimeMatch[2]);
  const day = Number(dateTimeMatch[3]);
  const hour = Number(dateTimeMatch[4]);
  const minute = Number(dateTimeMatch[5]);
  const second = Number(dateTimeMatch[6] ?? 0);
  const isUtc = dateTimeMatch[7] === "Z";

  if (isUtc) {
    return {
      iso: new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString(),
      allDay: false,
    };
  }

  if (tzid && !/Europe\/Berlin/i.test(tzid)) {
    return {
      iso: berlinIso(year, month, day, hour, minute, second),
      allDay: false,
    };
  }

  return {
    iso: berlinIso(year, month, day, hour, minute, second),
    allDay: false,
  };
}

function parseIcsEvent(text: string) {
  const unfolded = unfoldIcs(text);
  const eventBlockMatch = unfolded.match(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/i);
  const eventBlock = eventBlockMatch ? eventBlockMatch[1] : unfolded;
  const lines = eventBlock
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const fields = new Map<string, Array<{ params: string | null; value: string }>>();
  for (const line of lines) {
    const match = line.match(/^([A-Z]+)(?:;([^:]+))?:(.*)$/i);
    if (!match) continue;
    const key = match[1].toUpperCase();
    const params = match[2] ?? null;
    const value = match[3] ?? "";
    const bucket = fields.get(key) ?? [];
    bucket.push({ params, value });
    fields.set(key, bucket);
  }

  const startField = fields.get("DTSTART")?.[0] ?? null;
  if (!startField) return null;
  const endField = fields.get("DTEND")?.[0] ?? null;
  const startMeta = parseIcsDate(
    startField.value,
    startField.params?.match(/TZID=([^;]+)/i)?.[1] ?? null,
    startField.params?.match(/VALUE=([^;]+)/i)?.[1] ?? null
  );
  if (!startMeta) return null;
  const endMeta = endField
    ? parseIcsDate(
        endField.value,
        endField.params?.match(/TZID=([^;]+)/i)?.[1] ?? null,
        endField.params?.match(/VALUE=([^;]+)/i)?.[1] ?? null
      )
    : null;

  return {
    summary: normalizeText(fields.get("SUMMARY")?.[0]?.value ?? "") || null,
    description: normalizeText(fields.get("DESCRIPTION")?.[0]?.value ?? "") || null,
    location: normalizeText(fields.get("LOCATION")?.[0]?.value ?? "") || null,
    startAt: startMeta.iso,
    endAt: endMeta?.iso ?? null,
    allDay: startMeta.allDay,
  } satisfies GelsenkirchenIcsEvent;
}

function shouldSkipSignal(signal: string) {
  if (!signal) return true;
  if (/\b(gottesdienst|andacht|liturgie|gebet)\b/.test(signal)) return true;
  if (/\b(ausschuss|ratssitzung|rat\b|beirat|wahlausschuss|sprechstunde|buergersprechstunde|beratung)\b/.test(signal)) {
    return true;
  }
  if (/\b(verwaltung|amtliche bekanntmachung|buergerservice)\b/.test(signal)) return true;
  return false;
}

function categoryFromSignal(signal: string, categoryLabel: string | null): OfficialCityEvent["category"] {
  const combined = foldSearchText([categoryLabel ?? "", signal].filter(Boolean).join(" "));

  if (/(weihnacht|advent|nikolaus|winterzauber|ostern|halloween|karneval)/.test(combined)) {
    return "seasonal";
  }
  if (/(wochenmarkt|flohmarkt|trodel|tr[oö]del|markt\b|feierabendmarkt|basar|boerse|bo?rse|buechermarkt)/.test(combined)) {
    return "market";
  }
  if (/(street[\s-]?food|kulinar|genuss|wein|bier|brunch|dinner|tasting|menu|menue|food\b)/.test(combined)) {
    return "food_event";
  }
  if (/(festival|stadtfest|open[\s-]?air|rave|kirmes|fest\b|iga\b|nacht der)/.test(combined)) {
    return "festival";
  }
  if (/(konzert|live\b|band\b|orchester|chor\b|jazz|rock|pop|musik\b|singer|songwriter|philharm|sinfonie|symphon)/.test(combined)) {
    return "concert";
  }
  if (/(theater|oper\b|operette|schauspiel|ballett|figurentheater|puppentheater|tanztheater)/.test(combined)) {
    return "theater";
  }
  if (/(comedy|kabarett|kino|film\b|lesung|vortrag|diskussion|talk\b|quiz|show\b|musical|performance|poetry|buehne|buhne|comedy\/kabarett)/.test(combined)) {
    return "show";
  }
  if (/(ausstellung|museum|messe|kongress|tagung|expo|vernissage|finissage|kunst\b|installation)/.test(combined)) {
    return "fair";
  }
  if (/(fuehrung|fuhrung|workshop|seminar|kurs|treff|begegnung|stammtisch|jugend|schule|bildung)/.test(combined)) {
    return "community";
  }
  if (categoryLabel && /(fest|konzert|theater|kino|kabarett|comedy|markt|flohmarkt|ausstellung)/i.test(categoryLabel)) {
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

function indoorOutdoorForSignal(signal: string, category: OfficialCityEvent["category"]) {
  if (/\b(open[\s-]?air|markt|platz|park|flohmarkt|trodel|tr[oö]del|amphitheater)\b/.test(signal)) {
    return "outdoor" as const;
  }
  if (/\b(theater|kino|museum|halle|club|saal|kirche|arena|kaue)\b/.test(signal)) {
    return "indoor" as const;
  }
  if (category === "market" || category === "festival" || category === "fair") return "mixed" as const;
  return null;
}

function familyFriendlyForSignal(category: OfficialCityEvent["category"], signal: string) {
  if (/(18\+|nightlife|rave|party\b)/.test(signal)) return false;
  if (/(famil|kinder|schule|jugend)/.test(signal)) return true;
  if (category === "market" || category === "festival") return true;
  return null;
}

function audiencesForCategory(category: OfficialCityEvent["category"], signal: string) {
  const audiences = new Set<string>();
  if (/(famil|kinder|schule|jugend)/.test(signal)) audiences.add("family");
  if (category === "concert" || category === "show" || category === "festival") audiences.add("friends");
  if (category === "concert" || category === "theater" || category === "show") audiences.add("date");
  if (category === "market" || category === "festival" || category === "fair" || category === "food_event") {
    audiences.add("tourism");
    audiences.add("friends");
  }
  if (audiences.size === 0) audiences.add("tourism");
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

function subtypesForEvent(
  signal: string,
  category: OfficialCityEvent["category"],
  title: string,
  categoryLabel: string | null
) {
  const subtypes = new Set<string>();
  subtypes.add("concrete_event_page");
  subtypes.add(category);

  if (category === "market") {
    subtypes.add("market_event");
    if (/wochenmarkt/.test(signal)) subtypes.add("weekly_market");
    if (/flohmarkt|trodel|tr[oö]del|buechermarkt/.test(signal)) subtypes.add("flea_market");
  }
  if (category === "festival") {
    subtypes.add("festival_event");
    if (/open[\s-]?air/.test(signal)) subtypes.add("open_air");
  }
  if (category === "concert") subtypes.add("live_music");
  if (category === "theater") subtypes.add("performing_arts");
  if (category === "show") {
    if (/vortrag|diskussion|talk/.test(signal)) subtypes.add("talk");
    if (/film|kino/.test(signal)) subtypes.add("screening");
    if (/lesung/.test(signal)) subtypes.add("reading");
    if (/comedy|kabarett|quiz|poetry|musical|show/.test(signal)) subtypes.add("stage_program");
  }
  if (/famil|kinder/.test(signal) || /(famil|kinder)/i.test(title) || /(famil|kinder)/i.test(categoryLabel ?? "")) {
    subtypes.add("family_program");
  }

  return Array.from(subtypes);
}

function scoresForCategory(category: OfficialCityEvent["category"], hasVenue: boolean, signal: string) {
  const base = CATEGORY_PRIORITY[category] ?? 60;
  const venueBoost = hasVenue ? 4 : 0;
  const signalBoost = /\b(oper|theater|konzert|festival|markt|open air|comedy|kabarett)\b/.test(signal) ? 4 : 0;
  return {
    localRank: base + venueBoost + signalBoost,
    importance: base - 4 + venueBoost + signalBoost,
    popularity: base - 8 + venueBoost + signalBoost,
  };
}

function parseIsoFromSchedulingLabel(
  schedulingLabel: string | null,
  category: OfficialCityEvent["category"]
) {
  const parsed = parseSchedulingLine(schedulingLabel);
  if (!parsed?.dateLabel) return null;

  const startAt = buildIsoFromLongGermanDate(parsed.dateLabel, parsed.timeLabel, category);
  if (!startAt) return null;

  const rangeMatch = normalizeText(parsed.timeLabel).match(
    /(\d{1,2}:\d{2})\s*Uhr\s*-\s*(\d{1,2}:\d{2})\s*Uhr/i
  );
  const endAt = rangeMatch
    ? buildIsoFromLongGermanDate(parsed.dateLabel, rangeMatch[2], category)
    : null;
  const allDay = !parseTimeFragment(parsed.timeLabel);

  return {
    startAt,
    endAt,
    allDay,
  };
}

function parseDoorsAt(value: string | null, startAt: string | null) {
  const time = parseTimeFragment(value);
  if (!time || !startAt) return null;
  const date = startAt.slice(0, 10);
  return `${date}T${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}:00${startAt.slice(19)}`;
}

async function fetchDetailEvent(sourceUrl: string, slug: string) {
  const html = await fetchText(sourceUrl);
  const title =
    stripTags(html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? "") ||
    normalizeText(extractMetaContent(html, "metaogtitle")?.split("|")[0] ?? "");
  if (!title) return null;

  const summary =
    normalizeText(extractMetaContent(html, "metaogdescription") ?? "") ||
    extractSectionValue(html, "Beschreibung") ||
    null;
  const strongParagraphs = extractStrongParagraphs(html);
  const schedulingLabel =
    strongParagraphs.find((value) => /\d{1,2}\.\s*[A-Za-zÄÖÜäöüß]+\s+\d{4}/.test(value)) ?? null;
  const categoryLabel = parseSchedulingLine(schedulingLabel)?.categoryLabel ?? null;
  const doorsLabel =
    strongParagraphs.find((value) => /^Einlass:/i.test(value))?.replace(/^Einlass:\s*/i, "") ?? null;
  const costLabel = extractSectionValue(html, "Kosten");
  const geo = parseGeoMarker(html);
  const venueName =
    parseSchedulingLine(schedulingLabel)?.venueName ||
    geo.title ||
    extractSectionValue(html, "Veranstaltungsort") ||
    null;
  const venueAddress = geo.address || extractSectionValue(html, "Adresse") || null;
  const icsUrl = extractIcsUrl(html);
  const ticketUrl = extractTicketUrl(html);
  const sourceUpdatedAt = normalizeText(extractMetaContent(html, "metaogupdated_time") ?? "") || null;

  let ics: GelsenkirchenIcsEvent | null = null;
  if (icsUrl) {
    try {
      const icsText = await fetchText(icsUrl, "text/calendar,text/plain,*/*");
      ics = parseIcsEvent(icsText);
    } catch {
      ics = null;
    }
  }

  return {
    slug,
    sourceUrl,
    title,
    summary,
    categoryLabel,
    schedulingLabel,
    venueName,
    venueAddress,
    lat: geo.lat,
    lng: geo.lng,
    costLabel,
    doorsAt: doorsLabel,
    ticketUrl,
    icsUrl,
    sourceUpdatedAt,
    ics,
  } satisfies GelsenkirchenDetailEvent;
}

export async function fetchGelsenkirchenCityEvents(config: EventSourceConfigRow) {
  const baseUrl = normalizeText(config.base_url) || GELSENKIRCHEN_EVENTS_URL;
  const listings = new Map<string, GelsenkirchenListingCard>();

  for (let pageNumber = 1; pageNumber <= MAX_LISTING_PAGES; pageNumber += 1) {
    const pageUrl = buildPageUrl(baseUrl, pageNumber);
    const html = await fetchText(pageUrl);
    const cards = parseListingCards(html, baseUrl);
    for (const card of cards) {
      listings.set(card.slug, card);
    }
    if (!hasNextPage(html, pageNumber)) break;
  }

  const results: GelsenkirchenDetailEvent[] = [];
  for (const chunk of chunkItems(Array.from(listings.values()), DETAIL_BATCH_SIZE)) {
    const settled = await Promise.all(
      chunk.map((card) => fetchDetailEvent(card.sourceUrl, card.slug))
    );
    for (const event of settled) {
      if (event) results.push(event);
    }
  }

  return results;
}

export function normalizeGelsenkirchenCityEvent(
  item: GelsenkirchenDetailEvent,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const title = normalizeText(item.title);
  if (!title) return null;

  const signal = foldSearchText(
    [
      title,
      item.summary ?? "",
      item.categoryLabel ?? "",
      item.schedulingLabel ?? "",
      item.venueName ?? "",
      item.costLabel ?? "",
      item.ics?.summary ?? "",
      item.ics?.description ?? "",
      item.ics?.location ?? "",
    ].join(" ")
  );
  if (shouldSkipSignal(signal)) return null;

  const category = categoryFromSignal(signal, item.categoryLabel);
  if (category === "other") return null;

  const today = berlinDateString(new Date());
  const maxDate = berlinDateString(addDays(new Date(), LOOKAHEAD_DAYS));
  const scheduleFromText = parseIsoFromSchedulingLabel(item.schedulingLabel, category);
  const icsStartAt = item.ics?.startAt && item.ics.startAt.slice(0, 4) >= "2000" ? item.ics.startAt : null;
  const icsEndAt = item.ics?.endAt && item.ics.endAt.slice(0, 4) >= "2000" ? item.ics.endAt : null;
  const startAt = icsStartAt ?? scheduleFromText?.startAt ?? null;
  if (!startAt) return null;
  if (startAt.slice(0, 10) < today || startAt.slice(0, 10) > maxDate) return null;

  const endAt = icsEndAt ?? scheduleFromText?.endAt ?? null;
  const allDay = (icsStartAt ? item.ics?.allDay : null) ?? scheduleFromText?.allDay ?? false;
  const doorsAt = parseDoorsAt(item.doorsAt, startAt);
  const venueName =
    normalizeText(item.venueName) ||
    normalizeText(item.ics?.location?.split(",")[0] ?? "") ||
    null;
  const venueAddress =
    normalizeText(item.venueAddress) ||
    normalizeText(item.ics?.location ?? "") ||
    null;
  const summary = item.summary ?? item.ics?.description ?? null;
  const familyFriendly = familyFriendlyForSignal(category, signal);
  const scores = scoresForCategory(category, Boolean(venueName || venueAddress), signal);
  const subtypes = subtypesForEvent(signal, category, title, item.categoryLabel);

  return {
    source: config.provider,
    external_id: `gelsenkirchen_city:${item.slug}:${startAt}`,
    source_url: item.sourceUrl,
    ticket_url: item.ticketUrl,
    title,
    summary,
    category,
    kind: kindForCategory(category),
    status: "scheduled",
    venue_name: venueName,
    venue_address: venueAddress,
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: item.lat,
    lng: item.lng,
    timezone: "Europe/Berlin",
    start_at: startAt,
    end_at: endAt,
    doors_at: doorsAt,
    all_day: allDay,
    is_ticketed: Boolean(
      item.ticketUrl ||
        (/\b(ticket|karten|eintritt|buch|reservier)\b/.test(signal) &&
          !/\b(kostenlos|eintritt frei)\b/.test(signal))
    ),
    price_min: null,
    price_max: null,
    currency: null,
    family_friendly: familyFriendly,
    indoor_outdoor: indoorOutdoorForSignal(signal, category),
    local_rank: scores.localRank,
    importance_score: scores.importance,
    popularity_score: scores.popularity,
    tags: Array.from(
      new Set(
        [category, venueName, item.categoryLabel, title]
          .filter(Boolean)
          .map((value) => foldSearchText(String(value)).replace(/\s+/g, "_"))
      )
    ),
    subtypes,
    audiences: audiencesForCategory(category, signal),
    occasions: occasionsForCategory(category),
    source_payload: {
      detail: item,
      ics: item.ics,
    },
    source_updated_at: item.sourceUpdatedAt,
    last_seen_at: new Date().toISOString(),
  };
}
