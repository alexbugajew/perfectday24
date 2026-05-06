import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type MuensterScheduling = {
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  label: string | null;
};

type MuensterListingCard = {
  ident: string;
  detailUrl: string;
  title: string;
  subtitle: string | null;
  categoryLabel: string | null;
  venueName: string | null;
  topTip: boolean;
  occurrence: MuensterScheduling;
};

type MuensterDetailEnrichment = {
  summary: string | null;
  venueAddress: string | null;
  externalUrl: string | null;
  sourceUpdatedAt: string | null;
};

type MuensterSourceCard = {
  ident: string;
  detailUrl: string;
  title: string;
  subtitle: string | null;
  categoryLabel: string | null;
  venueName: string | null;
  venueAddress: string | null;
  externalUrl: string | null;
  sourceUpdatedAt: string | null;
  summary: string | null;
  topTip: boolean;
  occurrence: MuensterScheduling;
};

const SEARCH_ACTION_URL =
  "https://www.muenster.de/veranstaltungskalender/scripts/frontend/tourismus/sucheVerarbeiten.php?guestID=101";
const RESULT_FALLBACK_URL =
  "https://www.muenster.de/veranstaltungskalender/scripts/frontend/tourismus/suchergebnis.php?guestID=101";
const LOOKAHEAD_DAYS = 210;
const WINDOW_DAYS = 35;
const DETAIL_BATCH_SIZE = 8;
const CATEGORY_PRIORITY: Record<OfficialCityEvent["category"], number> = {
  concert: 90,
  theater: 88,
  show: 86,
  market: 84,
  festival: 82,
  fair: 74,
  food_event: 78,
  community: 66,
  seasonal: 64,
  other: 50,
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

function toAbsoluteUrl(url: string | null | undefined, baseUrl: string) {
  const normalized = normalizeText(url);
  if (!normalized) return null;
  try {
    return new URL(normalized, baseUrl).toString();
  } catch {
    return normalized;
  }
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

function berlinDateString(date: Date) {
  const parts = berlinLocalParts(date);
  return `${String(parts.day).padStart(2, "0")}.${String(parts.month).padStart(2, "0")}.${parts.year}`;
}

function responseCookieHeader(response: Response) {
  const headersWithGetSetCookie = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  const values =
    typeof headersWithGetSetCookie.getSetCookie === "function"
      ? headersWithGetSetCookie.getSetCookie()
      : [response.headers.get("set-cookie") ?? ""].filter(Boolean);

  return values
    .map((value) => normalizeText(value.split(";")[0]))
    .filter(Boolean)
    .join("; ");
}

async function fetchText(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`[muenster_tourism] HTTP ${response.status} fuer ${url}`);
  }

  return response.text();
}

async function fetchSearchResultsHtml(fromDate: string, toDate: string) {
  const body = new URLSearchParams({
    zeitraum: "zeitraum",
    datum_von: fromDate,
    datum_bis: toDate,
    zielgruppe: "alle",
    suchstring: "",
    "volltextsuche-verknuepfung": "und",
  });

  const submitResponse = await fetch(SEARCH_ACTION_URL, {
    method: "POST",
    redirect: "manual",
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (![200, 302, 303].includes(submitResponse.status)) {
    throw new Error(
      `[muenster_tourism] Such-POST HTTP ${submitResponse.status} fuer ${fromDate} - ${toDate}`
    );
  }

  const cookieHeader = responseCookieHeader(submitResponse);
  const location = submitResponse.headers.get("location");
  const resultUrl = location ? new URL(location, SEARCH_ACTION_URL).toString() : RESULT_FALLBACK_URL;

  return fetchText(resultUrl, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
}

function parseDateHeading(dateText: string) {
  const match = normalizeText(dateText).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!match) return null;
  return {
    day: Number(match[1]),
    month: Number(match[2]),
    year: Number(match[3]),
  };
}

function parseOccurrence(dateText: string | null, timeText: string | null) {
  const date = dateText ? parseDateHeading(dateText) : null;
  if (!date) return null;

  const normalizedTime = normalizeText(timeText);
  const rangeMatch = normalizedTime.match(/(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})/);
  if (rangeMatch) {
    return {
      startAt: berlinIso(date.year, date.month, date.day, Number(rangeMatch[1]), Number(rangeMatch[2])),
      endAt: berlinIso(date.year, date.month, date.day, Number(rangeMatch[3]), Number(rangeMatch[4])),
      allDay: false,
      label: [dateText, timeText].filter(Boolean).join(" ").trim() || null,
    } satisfies MuensterScheduling;
  }

  const singleMatch = normalizedTime.match(/(\d{1,2})[.:](\d{2})/);
  if (singleMatch) {
    return {
      startAt: berlinIso(date.year, date.month, date.day, Number(singleMatch[1]), Number(singleMatch[2])),
      endAt: null,
      allDay: false,
      label: [dateText, timeText].filter(Boolean).join(" ").trim() || null,
    } satisfies MuensterScheduling;
  }

  return {
    startAt: berlinIso(date.year, date.month, date.day, 12, 0),
    endAt: null,
    allDay: true,
    label: dateText,
  } satisfies MuensterScheduling;
}

function parseSearchResultCards(html: string, baseUrl: string) {
  const block = html.match(/<div class="ergebnisliste">([\s\S]*?)<\/div>\s*<!-- ENDE ergebnisliste -->/i)?.[1] ?? html;
  const tokenPattern =
    /<div class="datum">\s*([\s\S]*?)\s*<\/div>|<div class="kategorie">\s*([\s\S]*?)\s*<\/div>|<div id="pos[^"]+" class="eintrag[^"]*">([\s\S]*?)<!-- ENDE eintrag[^>]*-->/gi;

  const cards: MuensterListingCard[] = [];
  let currentDate: string | null = null;
  let currentCategory: string | null = null;

  for (const match of block.matchAll(tokenPattern)) {
    if (match[1]) {
      currentDate = stripTags(match[1]);
      continue;
    }

    if (match[2]) {
      currentCategory = stripTags(match[2]);
      continue;
    }

    const entry = match[3];
    if (!entry || !currentDate) continue;

    const detailHref =
      entry.match(/href="([^"]*\/veranstaltung\.php\?id=\d+[^"]*)"/i)?.[1] ??
      entry.match(/href="([^"]*\/top-veranstaltung\.php\?id=\d+[^"]*)"/i)?.[1] ??
      null;
    const detailUrl = toAbsoluteUrl(detailHref, baseUrl);
    const ident = normalizeText(detailUrl?.match(/[?&]id=(\d+)/i)?.[1] ?? "");
    const title = stripTags(entry.match(/<div class="titel">\s*([\s\S]*?)\s*<\/div>/i)?.[1] ?? "");
    if (!detailUrl || !ident || !title) continue;

    const subtitle = stripTags(entry.match(/<div class="untertitel">\s*([\s\S]*?)\s*<\/div>/i)?.[1] ?? "") || null;
    const venueName =
      stripTags(entry.match(/<div class="location">\s*([\s\S]*?)\s*<span>/i)?.[1] ?? "") || null;
    const topTip = /tv-marker/i.test(entry);
    const timeHtml = entry.match(/<div class="uhrzeit-beginn">\s*([\s\S]*?)<\/div>/i)?.[1] ?? "";
    const cleanTimeHtml = timeHtml.replace(/<div class="tv-marker"[\s\S]*?<\/div>/i, "");
    const occurrence = parseOccurrence(currentDate, stripTags(cleanTimeHtml));
    if (!occurrence) continue;

    cards.push({
      ident,
      detailUrl,
      title,
      subtitle,
      categoryLabel: currentCategory,
      venueName,
      topTip,
      occurrence,
    });
  }

  return cards;
}

function parseDetailEnrichment(html: string, detailUrl: string): MuensterDetailEnrichment {
  const summary =
    stripTags(html.match(/<div class="detailbeschreibung">\s*([\s\S]*?)\s*<\/div>/i)?.[1] ?? "") || null;
  const venueAddress =
    stripTags(html.match(/<div class="location-adresse">\s*([\s\S]*?)\s*<\/div>/i)?.[1] ?? "") || null;
  const externalHref = html.match(/<div class="detail-link">[\s\S]*?<a[^>]+href="([^"]+)"/i)?.[1] ?? null;

  return {
    summary,
    venueAddress,
    externalUrl: toAbsoluteUrl(externalHref, detailUrl),
    sourceUpdatedAt: null,
  };
}

async function fetchDetailMap(cards: MuensterListingCard[]) {
  const uniqueCards = Array.from(
    new Map(cards.map((card) => [card.ident, card])).values()
  );
  const detailMap = new Map<string, MuensterDetailEnrichment>();

  for (let index = 0; index < uniqueCards.length; index += DETAIL_BATCH_SIZE) {
    const slice = uniqueCards.slice(index, index + DETAIL_BATCH_SIZE);
    const results = await Promise.all(
      slice.map(async (card) => {
        try {
          const html = await fetchText(card.detailUrl);
          return [card.ident, parseDetailEnrichment(html, card.detailUrl)] as const;
        } catch {
          return [card.ident, { summary: null, venueAddress: null, externalUrl: null, sourceUpdatedAt: null }] as const;
        }
      })
    );

    for (const [ident, enrichment] of results) {
      detailMap.set(ident, enrichment);
    }
  }

  return detailMap;
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function categoryFromListing(card: MuensterSourceCard): OfficialCityEvent["category"] {
  const rubric = normalizeText(card.categoryLabel).toLowerCase();
  const text = [card.title, card.subtitle, card.summary, card.venueName, card.venueAddress]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const hasExplicitMarketIntent =
    /(wochenmarkt|flohmarkt|markt|tr[Ã¶o]del|basar|send\b|hansemahl|promenade|pyramidenmarkt)/.test(text);
  const hasStageIntent =
    /(theater|oper|schauspiel|ballett|tanz|performance|kabarett|comedy|lesung|slam|film|kino|poetry|gespr[aÃ¤]ch|talk|show|vortrag|konzert|concert|musik|band|orchester|chor|jazz|live\b)/.test(
      text
    );
  const hasCommunityIntent =
    /(f[Ã¼u]hrung|rundgang|workshop|kurs|seminar|spaziergang|tour|diskussion|tagung|treff|bildung|jugend|kinder|sport|beteiligung|fahrt)/.test(
      text
    );
  const hasExhibitionIntent = /(ausstellung|museum|messe|kongress|expo|vernissage|kunst)/.test(text);

  if (/^\s*info[:\s]|geschlossen|bleibt .* geschlossen|hinweis/.test(text)) {
    return "community";
  }
  if (/(street ?food|kulinar|wein|wine|bier|beer|brunch|dinner|menue|menü|tasting)/.test(text)) {
    return "food_event";
  }
  if (/(wochenmarkt|flohmarkt|markt|tr[öo]del|basar|send\b|hansemahl|promenade|pyramidenmarkt)/.test(text)) {
    return "market";
  }
  if (/(festival|fest|open air|nacht|party|hafenfest|britnic|giro|schauraum|feier)/.test(text)) {
    return "festival";
  }
  if (/(theater|oper|schauspiel|ballett|tanz|performance)/.test(text)) {
    return "theater";
  }
  if (/(kabarett|comedy|lesung|slam|film|kino|poetry|gespr[aä]ch|talk|show|vortrag)/.test(text)) {
    return "show";
  }
  if (/(f[üu]hrung|rundgang|workshop|kurs|seminar|spaziergang|tour|diskussion|tagung|treff|bildung|jugend|kinder|sport|beteiligung|fahrt)/.test(text)) {
    return "community";
  }
  if (/(konzert|concert|musik|band|orchester|chor|jazz|live\b)/.test(text)) {
    return "concert";
  }
  if (/(ausstellung|museum|messe|kongress|expo|vernissage|kunst)/.test(text)) {
    return "fair";
  }
  if (/(weihnacht|advent|winterzauber)/.test(text)) {
    return "seasonal";
  }

  if (/konzerte/.test(rubric)) return "concert";
  if (/theater|tanz/.test(rubric)) return "theater";
  if (/kabarett|comedy|lesungen/.test(rubric)) return "show";
  if (/ausstellungen/.test(rubric)) return "fair";
  if (/f[üu]hrungen/.test(rubric)) return "community";
  if (/messen|m[aä]rkte/.test(rubric)) return "fair";
  if (/party|feste/.test(rubric)) return "festival";
  if (/bildung|information|diskussion|politik|sport|stadt-mix/.test(rubric)) return "community";

  return "other";
}

function kindForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") {
    return "anchored_event" as const;
  }
  return "flex_event" as const;
}

function audiencesForCard(card: MuensterSourceCard, category: OfficialCityEvent["category"]) {
  const text = [card.title, card.subtitle, card.summary].filter(Boolean).join(" ").toLowerCase();
  if (/famil|kinder|jugend/.test(text)) return ["family", "tourism"];
  if (category === "concert" || category === "show") return ["date", "friends", "party"];
  if (category === "theater") return ["date", "tourism"];
  if (category === "market" || category === "festival" || category === "food_event" || category === "fair") {
    return ["tourism", "friends", "family", "date"];
  }
  return ["tourism", "friends"];
}

function occasionsForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "show") return ["date", "friends", "party"];
  if (category === "theater") return ["date", "tourism"];
  if (category === "market" || category === "festival" || category === "food_event" || category === "fair") {
    return ["tourism", "friends", "family", "date"];
  }
  return ["tourism", "friends"];
}

function subtypesForCard(card: MuensterSourceCard, category: OfficialCityEvent["category"]) {
  const text = [card.title, card.subtitle, card.summary, card.categoryLabel].filter(Boolean).join(" ").toLowerCase();
  return Array.from(
    new Set(
      [
        "concrete_event_page",
        category,
        /markt|wochenmarkt|flohmarkt/.test(text) ? "market_event" : null,
        /festival|fest|open air|party/.test(text) ? "festival_event" : null,
        /f[üu]hrung|rundgang|tour|fahrt/.test(text) ? "guided_tour" : null,
        /messe|ausstellung|museum|kunst/.test(text) ? "exhibition" : null,
        /film|kino/.test(text) ? "screening" : null,
        card.topTip ? "top_tip" : null,
      ].filter((value): value is string => Boolean(value))
    )
  );
}

export async function fetchMuensterTourismEvents(config: EventSourceConfigRow) {
  const cards: MuensterListingCard[] = [];
  const start = new Date();

  for (let offset = 0; offset <= LOOKAHEAD_DAYS; offset += WINDOW_DAYS) {
    const windowStart = addDays(start, offset);
    const windowEnd = addDays(start, Math.min(offset + WINDOW_DAYS - 1, LOOKAHEAD_DAYS));
    const html = await fetchSearchResultsHtml(berlinDateString(windowStart), berlinDateString(windowEnd));
    cards.push(...parseSearchResultCards(html, config.base_url));
  }

  const detailMap = await fetchDetailMap(cards);

  return cards.map((card) => {
    const enrichment = detailMap.get(card.ident) ?? {
      summary: null,
      venueAddress: null,
      externalUrl: null,
      sourceUpdatedAt: null,
    };

    return {
      ident: card.ident,
      detailUrl: card.detailUrl,
      title: card.title,
      subtitle: card.subtitle,
      categoryLabel: card.categoryLabel,
      venueName: card.venueName,
      venueAddress: enrichment.venueAddress,
      externalUrl: enrichment.externalUrl,
      sourceUpdatedAt: enrichment.sourceUpdatedAt,
      summary: enrichment.summary,
      topTip: card.topTip,
      occurrence: card.occurrence,
    } satisfies MuensterSourceCard;
  });
}

export function normalizeMuensterTourismEvent(
  card: MuensterSourceCard,
  config: EventSourceConfigRow
): OfficialCityEvent | null {
  const startAt = normalizeText(card.occurrence.startAt);
  if (!startAt) return null;

  const normalizationText = [
    card.title,
    card.subtitle,
    card.summary,
    card.venueName,
    card.venueAddress,
    card.categoryLabel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  let category = categoryFromListing(card);
  if (
    /(theater|oper|schauspiel|ballett|tanz|performance|kabarett|comedy|lesung|slam|show)/.test(
      normalizationText
    )
  ) {
    category = /(film|kino)/.test(normalizationText) ? "show" : "theater";
  } else if (/(konzert|concert|musik|band|orchester|chor|jazz|live\b)/.test(normalizationText)) {
    category = "concert";
  } else if (/(ausstellung|museum|vernissage|kunstverein|kunsthalle|galerie)/.test(normalizationText)) {
    category = "fair";
  } else if (
    /(f[Ã¼u]hrung|rundgang|workshop|kurs|seminar|spaziergang|tour|diskussion|tagung|treff|bildung|fahrt)/.test(
      normalizationText
    ) && !/(wochenmarkt|flohmarkt|basar|street ?food|festival|volksfest)/.test(normalizationText)
  ) {
    category = "community";
  }
  if (category === "other") return null;

  const audiences = audiencesForCard(card, category);
  const importanceScore = CATEGORY_PRIORITY[category] + (card.topTip ? 12 : 0);
  const popularityScore = card.topTip ? 18 : null;
  const isTicketed = Boolean(card.externalUrl);
  const subtypes = Array.from(
    new Set([
      ...subtypesForCard(card, category),
      /workshop|kurs|seminar/.test(normalizationText) ? "workshop" : null,
      /diskussion|gespr[aÃ¤]ch|vortrag|talk/.test(normalizationText) ? "lecture" : null,
      /theater|oper|schauspiel|ballett|tanz|performance|kabarett|comedy|lesung|slam|show/.test(
        normalizationText
      )
        ? "stage_program"
        : null,
      /konzert|concert|musik|band|orchester|chor|jazz|live\b/.test(normalizationText)
        ? "live_music"
        : null,
    ].filter((value): value is string => Boolean(value)))
  );
  const familyFriendly = /famil|kinder|jugend/i.test(
    [card.title, card.subtitle, card.summary].filter(Boolean).join(" ")
  )
    ? true
    : null;

  return {
    source: config.provider,
    external_id: `muenster_tourism:${card.ident}:${startAt}`,
    source_url: card.detailUrl,
    ticket_url: card.externalUrl,
    title: card.title,
    summary: card.summary ?? card.subtitle ?? null,
    category,
    kind: kindForCategory(category),
    status: /abgesagt|entf[aä]llt|cancelled/i.test(card.title) ? "cancelled" : "scheduled",
    venue_name: card.venueName,
    venue_address: card.venueAddress,
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: null,
    lng: null,
    timezone: "Europe/Berlin",
    start_at: startAt,
    end_at: card.occurrence.endAt,
    doors_at: null,
    all_day: card.occurrence.allDay,
    is_ticketed: isTicketed,
    price_min: null,
    price_max: null,
    currency: "EUR",
    family_friendly: familyFriendly,
    indoor_outdoor: null,
    local_rank: card.topTip ? 92 : 74,
    importance_score: importanceScore,
    popularity_score: popularityScore,
    tags: Array.from(
      new Set(
        ["muenster_tourism", normalizeText(card.categoryLabel), card.topTip ? "top_tip" : ""].filter(Boolean)
      )
    ),
    subtypes,
    audiences,
    occasions: occasionsForCategory(category),
    source_payload: card,
    source_updated_at: card.sourceUpdatedAt,
    last_seen_at: new Date().toISOString(),
  };
}
