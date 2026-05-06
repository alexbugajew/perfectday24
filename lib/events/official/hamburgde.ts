import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type HamburgDeItem = {
  sourceUrl: string;
  title: string;
  summary: string | null;
  dateText: string | null;
  timeText: string | null;
  venueName: string | null;
  sourceKind: "teaser" | "table";
};

type HamburgDeDetail = {
  subtitleDate: string | null;
  beginDate: string | null;
  endDate: string | null;
  openingText: string | null;
  locationTitle: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  isFree: boolean | null;
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

function stripTags(text: string) {
  return normalizeText(decodeHtml(text.replace(/<[^>]+>/g, " ")));
}

function pad(value: string | number) {
  return String(value).padStart(2, "0");
}

function normalizeSourceUrl(url: string, config: EventSourceConfigRow) {
  const value = normalizeText(url);
  if (!value) return config.base_url;
  if (value.startsWith("http")) return value;
  if (value.startsWith("/")) return `https://www.hamburg.de${value}`;
  return `https://www.hamburg.de/${value.replace(/^\/+/, "")}`;
}

function extractHamburgDateTextFromText(value: string | null) {
  const text = normalizeText(value);
  if (!text) return null;

  const patterns = [
    /(\d{1,2})\.\s*(?:bis|-)\s*(\d{1,2})\.\s*([A-Za-zÃ¤Ã¶Ã¼Ã„Ã–Ãœ]+)\s*(\d{4})/i,
    /(\d{1,2})\.\s*und\s*(\d{1,2})\.\s*([A-Za-zÃ¤Ã¶Ã¼Ã„Ã–Ãœ]+)\s*(\d{4})/i,
    /(\d{1,2})\.\s*([A-Za-zÃ¤Ã¶Ã¼Ã„Ã–Ãœ]+)\s*(?:bis|-)\s*(\d{1,2})\.\s*([A-Za-zÃ¤Ã¶Ã¼Ã„Ã–Ãœ]+)\s*(\d{4})/i,
    /(\d{1,2})\.\s*([A-Za-zÃ¤Ã¶Ã¼Ã„Ã–Ãœ]+)\s*(\d{4})/i,
    /(\d{1,2})\.(\d{1,2})\.(\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return normalizeText(match[0]);
  }

  return null;
}

function extractHamburgTimeTextFromText(value: string | null) {
  const text = normalizeText(value);
  if (!text) return null;
  return normalizeText(text.match(/(\d{1,2}:\d{2}(?:\s*-\s*\d{1,2}:\d{2})?\s*Uhr?)/i)?.[1] ?? "") || null;
}

function germanMonthNumber(label: string) {
  const normalized = normalizeText(label)
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue");
  const months = new Map([
    ["januar", "01"],
    ["februar", "02"],
    ["maerz", "03"],
    ["marz", "03"],
    ["april", "04"],
    ["mai", "05"],
    ["juni", "06"],
    ["juli", "07"],
    ["august", "08"],
    ["september", "09"],
    ["oktober", "10"],
    ["november", "11"],
    ["dezember", "12"],
  ]);
  return months.get(normalized) ?? null;
}

function extractTimeParts(timeText?: string | null) {
  const match = normalizeText(timeText).match(/(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?/i);
  return {
    hours: pad(match?.[1] ?? "00"),
    minutes: pad(match?.[2] ?? "00"),
  };
}

function buildIsoDate(year: string, month: string, day: string | number, timeText?: string | null) {
  const { hours, minutes } = extractTimeParts(timeText);
  return `${year}-${month}-${pad(day)}T${hours}:${minutes}:00+02:00`;
}

function expandDateRange(startUtc: number, endUtc: number, timeText?: string | null) {
  const dates: string[] = [];
  for (let ts = startUtc; ts <= endUtc; ts += 24 * 60 * 60 * 1000) {
    const value = new Date(ts);
    dates.push(
      buildIsoDate(
        String(value.getUTCFullYear()),
        pad(value.getUTCMonth() + 1),
        value.getUTCDate(),
        timeText
      )
    );
  }
  return dates;
}

function parseHamburgDateOccurrences(dateText: string | null, timeText?: string | null) {
  const normalized = normalizeText(dateText);
  if (!normalized) return [];

  const sameMonthRange = normalized.match(/(\d{1,2})\.\s*(?:bis|-)\s*(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s*(\d{4})/i);
  if (sameMonthRange) {
    const [, startDay, endDay, monthLabel, year] = sameMonthRange;
    const month = germanMonthNumber(monthLabel);
    if (!month) return [];
    const start = Number(startDay);
    const end = Number(endDay);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
    const startUtc = Date.UTC(Number(year), Number(month) - 1, start);
    const endUtc = Date.UTC(Number(year), Number(month) - 1, end);
    return expandDateRange(startUtc, endUtc, timeText);
  }

  const sameMonthAnd = normalized.match(/(\d{1,2})\.\s*und\s*(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s*(\d{4})/i);
  if (sameMonthAnd) {
    const [, firstDay, secondDay, monthLabel, year] = sameMonthAnd;
    const month = germanMonthNumber(monthLabel);
    if (!month) return [];
    return [buildIsoDate(year, month, firstDay, timeText), buildIsoDate(year, month, secondDay, timeText)];
  }

  const crossMonthRange = normalized.match(
    /(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s*(?:bis|-)\s*(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s*(\d{4})/i
  );
  if (crossMonthRange) {
    const [, startDay, startMonthLabel, endDay, endMonthLabel, year] = crossMonthRange;
    const startMonth = germanMonthNumber(startMonthLabel);
    const endMonth = germanMonthNumber(endMonthLabel);
    if (!startMonth || !endMonth) return [];
    const startUtc = Date.UTC(Number(year), Number(startMonth) - 1, Number(startDay));
    const endUtc = Date.UTC(Number(year), Number(endMonth) - 1, Number(endDay));
    if (endUtc < startUtc) return [];
    return expandDateRange(startUtc, endUtc, timeText);
  }

  const single = normalized.match(/(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s*(\d{4})/i);
  if (single) {
    const [, day, monthLabel, year] = single;
    const month = germanMonthNumber(monthLabel);
    if (!month) return [];
    return [buildIsoDate(year, month, day, timeText)];
  }

  const numeric = normalized.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (numeric) {
    const [, day, month, year] = numeric;
    return [buildIsoDate(year, pad(month), day, timeText)];
  }

  const monthOnly = normalized.match(/([A-Za-zäöüÄÖÜ]+)\s*(\d{4})/i);
  if (monthOnly) {
    const [, monthLabel, year] = monthOnly;
    const month = germanMonthNumber(monthLabel);
    if (!month) return [];
    return [buildIsoDate(year, month, "01", timeText)];
  }

  return [];
}

function categoryFromText(text: string): OfficialCityEvent["category"] {
  const normalized = text.toLowerCase();
  if (/(weihnacht|oster|advent|markt|flohmarkt|wochenmarkt|foodmarkt|weinfest)/.test(normalized)) return "market";
  if (/(festival|strassenfest|straßenfest|hafengeburtstag|dom|fruehlingsfest|frühlingsfest|kirschbluetenfest|kirschblütenfest)/.test(normalized)) {
    return "festival";
  }
  if (/(food|kulinar|genuss|wein|street food|vegan)/.test(normalized)) return "food_event";
  if (/(konzert|musikfest|open air|jazz|live)/.test(normalized)) return "concert";
  if (/(theater|theaternacht|oper|musical|schauspiel|premiere|premieren|erstauffuehrung|erstaufführung|buehne|bühne|buehnen|bühnen)/.test(normalized)) return "theater";
  if (/(show|comedy|performance|wasserlichtkonzert|kabarett|variete|varieté|immersiv|immersive)/.test(normalized)) return "show";
  if (/(kirmes|jahrmarkt|dom)/.test(normalized)) return "fair";
  if (/(fruehling|frühling|sommer|winter|herbst)/.test(normalized)) return "seasonal";
  if (/(familie|kinder|natur|sport|literatur|museum|ausstellung|vernissage|immersiv)/.test(normalized)) return "community";
  return "other";
}

function kindForCategory(category: OfficialCityEvent["category"]) {
  if (category === "concert" || category === "theater" || category === "show") {
    return "anchored_event" as const;
  }
  return "flex_event" as const;
}

function isConcreteHamburgDeUrl(url: string) {
  return /-\d{5,}(?:$|[?#/])/i.test(url);
}

function isEditorialHamburgDeUrl(url: string) {
  return !isConcreteHamburgDeUrl(url);
}

function cleanVenueName(value: string | null, itemTitle: string) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (normalized.toLowerCase() === normalizeText(itemTitle).toLowerCase()) return null;
  return normalized;
}

function parseVcardCoordinates(text: string) {
  const geo = text.match(/(?:^|\n)GEO:([0-9.+-]+);([0-9.+-]+)/i);
  const lat = Number(geo?.[1] ?? "");
  const lng = Number(geo?.[2] ?? "");
  return {
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

async function fetchHamburgDeEventDetail(url: string): Promise<HamburgDeDetail> {
  if (!/https:\/\/www\.hamburg\.de\//i.test(url)) {
    return {
      subtitleDate: null,
      beginDate: null,
      endDate: null,
      openingText: null,
      locationTitle: null,
      address: null,
      lat: null,
      lng: null,
      isFree: null,
    };
  }

  const response = await fetch(url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`[hamburg_de] HTTP ${response.status} fuer ${url}`);
  }

  const html = await response.text();
  const subtitleDate =
    stripTags(html.match(/<p class="teaser__meta[^"]*">([\s\S]*?)<\/p>/i)?.[1] ?? "") || null;
  const infoPairs = Array.from(html.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/gi)).map((match) => ({
    key: stripTags(match[1]).toLowerCase(),
    value: stripTags(match[2]),
  }));
  const beginDate = infoPairs.find((entry) => /beginn/.test(entry.key))?.value ?? null;
  const endDate = infoPairs.find((entry) => /ende/.test(entry.key))?.value ?? null;
  const openingText =
    infoPairs.find((entry) => /oeffnungszeiten|offnungszeiten|uhrzeit|zeit/.test(entry.key))?.value ?? null;
  const priceText = infoPairs.find((entry) => /eintritt|preis|kosten/.test(entry.key))?.value ?? null;

  const locationTitle =
    stripTags(html.match(/<p class="km1-paragraph km1-info-list__intro-text">([\s\S]*?)<\/p>/i)?.[1] ?? "") || null;
  const addressLabel =
    stripTags(
      html.match(
        /<a href="#" [^>]*data-evt-action="MAP"[^>]*class="[^"]*k-map-link[^"]*"[\s\S]*?<span class="km1-label km1-link__text">([\s\S]*?)<\/span>/i
      )?.[1] ?? ""
    ) || null;
  const geofoxDestination =
    normalizeText(
      decodeURIComponent(
        html.match(/https:\/\/geofox\.hvv\.de\/web\/de\/connections\?[^"]*destination=([^"&]+)/i)?.[1] ?? ""
      )
    ) || null;
  const vcardUrl =
    normalizeText(
      html.match(/href="(https:\/\/iason\.hamburg\.de\/iason\/vcard\/\d+\/)"/i)?.[1] ?? ""
    ) || null;

  let vcardCoords = { lat: null as number | null, lng: null as number | null };
  if (vcardUrl) {
    try {
      const vcardResponse = await fetch(vcardUrl, {
        headers: {
          "user-agent": "perfectday24-event-ingest/1.0",
          accept: "text/vcard,text/plain,*/*",
        },
      });
      if (vcardResponse.ok) {
        vcardCoords = parseVcardCoordinates(await vcardResponse.text());
      }
    } catch {
      // Best effort only.
    }
  }

  const address = addressLabel ?? geofoxDestination ?? null;

  return {
    subtitleDate,
    beginDate,
    endDate,
    openingText,
    locationTitle,
    address,
    lat: vcardCoords.lat,
    lng: vcardCoords.lng,
    isFree: priceText ? /kostenlos|frei/i.test(priceText) : null,
  };
}

export async function fetchHamburgDeEvents(config: EventSourceConfigRow) {
  const response = await fetch(config.base_url, {
    headers: {
      "user-agent": "perfectday24-event-ingest/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`[hamburg_de] HTTP ${response.status} fuer ${config.base_url}`);
  }

  const html = await response.text();
  const items: HamburgDeItem[] = [];

  const teaserBlocks = [
    ...Array.from(
      html.matchAll(/<div class="km1-teaser km1-teaser-list__teaser"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi)
    ),
    ...Array.from(
      html.matchAll(/<div class="km1-teaser km1-teaser-slider__item-teaser"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi)
    ),
  ];
  for (const match of teaserBlocks) {
    const block = match[0];
    const href = normalizeText(block.match(/<a href="([^"]+)" class="km1-teaser__heading-link">/i)?.[1] ?? "");
    const title = stripTags(block.match(/<h3 class="km1-heading km1-heading--3 km1-teaser__heading"[\s\S]*?>([\s\S]*?)<\/h3>/i)?.[1] ?? "");
    const summary = stripTags(block.match(/<p class="km1-paragraph km1-teaser__paragraph"[\s\S]*?>([\s\S]*?)<\/p>/i)?.[1] ?? "") || null;
    const topLine = stripTags(block.match(/<span class="km1-topline km1-teaser__topline"[\s\S]*?>([\s\S]*?)<\/span>/i)?.[1] ?? "") || null;
    const dateText = extractHamburgDateTextFromText(topLine) ?? extractHamburgDateTextFromText(summary);
    const timeText = extractHamburgTimeTextFromText(topLine) ?? extractHamburgTimeTextFromText(summary);
    if (!href || !title || !dateText) continue;
    items.push({
      sourceUrl: normalizeSourceUrl(href, config),
      title,
      summary,
      dateText,
      timeText,
      venueName: null,
      sourceKind: "teaser",
    });
  }

  const teaserContents = Array.from(
    html.matchAll(
      /<span class="km1-topline km1-teaser__topline"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<a href="([^"]+)" class="km1-teaser__heading-link">[\s\S]*?<h[23] class="km1-heading [^"]*km1-teaser__heading"[^>]*>([\s\S]*?)<\/h[23]>[\s\S]*?<\/a>[\s\S]*?<p class="km1-paragraph km1-teaser__paragraph"[^>]*>([\s\S]*?)<\/p>/gi
    )
  );
  for (const match of teaserContents) {
    const topLine = stripTags(match[1]) || null;
    const href = normalizeText(match[2] ?? "");
    const title = stripTags(match[3] ?? "");
    const summary = stripTags(match[4] ?? "") || null;
    const dateText = extractHamburgDateTextFromText(topLine) ?? extractHamburgDateTextFromText(summary);
    const timeText = extractHamburgTimeTextFromText(topLine) ?? extractHamburgTimeTextFromText(summary);
    if (!href || !title || !dateText) continue;
    items.push({
      sourceUrl: normalizeSourceUrl(href, config),
      title,
      summary,
      dateText,
      timeText,
      venueName: null,
      sourceKind: "teaser",
    });
  }

  if (/\/kultur\/veranstaltungen\/[a-z]+$/i.test(config.base_url)) {
    const teaserContentBlocks = Array.from(
      html.matchAll(/<div class="km1-teaser__content">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi)
    );
    for (const match of teaserContentBlocks) {
      const content = match[1];
      const topLine =
        stripTags(content.match(/<span class="km1-topline km1-teaser__topline"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "") ||
        null;
      const href = normalizeText(content.match(/<a href="([^"]+)" class="km1-teaser__heading-link">/i)?.[1] ?? "");
      const title =
        stripTags(content.match(/<h[23] class="km1-heading [^"]*km1-teaser__heading"[^>]*>([\s\S]*?)<\/h[23]>/i)?.[1] ?? "") ||
        "";
      const summary =
        stripTags(content.match(/<p class="km1-paragraph km1-teaser__paragraph"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "") ||
        null;
      const dateText = extractHamburgDateTextFromText(topLine) ?? extractHamburgDateTextFromText(summary);
      const timeText = extractHamburgTimeTextFromText(topLine) ?? extractHamburgTimeTextFromText(summary);
      if (!href || !title || !dateText) continue;
      items.push({
        sourceUrl: normalizeSourceUrl(href, config),
        title,
        summary,
        dateText,
        timeText,
        venueName: null,
        sourceKind: "teaser",
      });
    }
  }

  const rowBlocks = Array.from(html.matchAll(/<tr>([\s\S]*?)<\/tr>/gi));
  for (const match of rowBlocks) {
    const row = match[1];
    const cells = Array.from(row.matchAll(/<td>([\s\S]*?)<\/td>/gi)).map((cell) => cell[1]);
    if (cells.length < 3) continue;
    const dateText = stripTags(cells[0]);
    const href = normalizeText(cells[1].match(/<a href="([^"]+)"/i)?.[1] ?? "");
    const title = stripTags(cells[1].match(/<a [^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "");
    const infoText = stripTags(cells[2]);
    if (!dateText || !href || !title) continue;
    const timeText = normalizeText(infoText.match(/(\d{1,2}:\d{2}(?:\s*-\s*\d{1,2}:\d{2})?\s*Uhr?)/i)?.[1] ?? "") || null;
    const venueName = normalizeText(infoText.split(",").slice(1).join(", ")) || null;
    items.push({
      sourceUrl: normalizeSourceUrl(href, config),
      title,
      summary: null,
      dateText,
      timeText,
      venueName,
      sourceKind: "table",
    });
  }

  const deduped = new Map<string, HamburgDeItem>();
  for (const item of items) {
    deduped.set(`${item.sourceUrl}|${item.title}|${item.dateText}|${item.timeText ?? ""}`, item);
  }

  return Array.from(deduped.values());
}

export function normalizeHamburgDeEvent(
  item: HamburgDeItem,
  detail: HamburgDeDetail | null,
  config: EventSourceConfigRow
): OfficialCityEvent[] {
  const starts = parseHamburgDateOccurrences(
    detail?.beginDate ?? detail?.subtitleDate ?? item.dateText,
    detail?.openingText ?? item.timeText
  );
  if (!item.title || starts.length === 0) return [];

  const textForCategory = [
    item.title,
    item.summary ?? "",
    item.venueName ?? "",
    detail?.locationTitle ?? "",
    detail?.address ?? "",
    item.sourceUrl,
  ].join(" ");
  const category = categoryFromText(textForCategory);
  const kind = kindForCategory(category);
  const familyFriendly = /(familie|kinder|kids)/i.test(textForCategory) ? true : null;
  const isConcrete = isConcreteHamburgDeUrl(item.sourceUrl);
  const isEditorial = isEditorialHamburgDeUrl(item.sourceUrl);
  const addressFirstPart = detail?.address ? detail.address.split(",")[0] ?? null : null;
  const resolvedVenueName =
    cleanVenueName(detail?.locationTitle ?? null, item.title) ??
    cleanVenueName(addressFirstPart, item.title) ??
    cleanVenueName(item.venueName, item.title);
  const resolvedAddress = normalizeText(detail?.address) || normalizeText(item.venueName) || null;
  const importanceScore =
    (item.sourceKind === "table" ? 68 : isConcrete ? 60 : 28) +
    (resolvedAddress ? 10 : 0) +
    (detail?.lat != null && detail?.lng != null ? 14 : 0);
  const popularityScore =
    (item.sourceKind === "table" ? 42 : isConcrete ? 36 : 18) +
    (resolvedVenueName ? 6 : 0);

  return starts.map((startAt, index) => ({
    source: "hamburg_de",
    external_id: `hamburg_de:${item.sourceUrl}:${startAt}:${index}`,
    source_url: item.sourceUrl,
    ticket_url: item.sourceUrl,
    title: item.title,
    summary: item.summary,
    category,
    kind,
    status: "scheduled",
    venue_name: resolvedVenueName,
    venue_address: resolvedAddress,
    city_slug: config.city_slug,
    country_code: config.country_code,
    lat: detail?.lat ?? null,
    lng: detail?.lng ?? null,
    timezone: "Europe/Berlin",
    start_at: startAt,
    end_at: null,
    doors_at: null,
    all_day: !(detail?.openingText ?? item.timeText),
    is_ticketed: /(ticket|tickets|konzert|musical|show|theater)/i.test(textForCategory),
    price_min: null,
    price_max: null,
    currency: null,
    family_friendly: familyFriendly,
    indoor_outdoor:
      /(open air|markt|fest|dom|park)/i.test(textForCategory)
        ? "outdoor"
        : /(theater|musical|show|oper|museum)/i.test(textForCategory)
          ? "indoor"
          : null,
    local_rank: null,
    importance_score: importanceScore,
    popularity_score: popularityScore,
    tags: Array.from(
      new Set(
        [
          category,
          "hamburg.de",
          item.sourceKind,
          resolvedVenueName,
          isConcrete ? "concrete_event_page" : "",
          isEditorial ? "editorial_summary_page" : "",
        ]
          .filter((tag): tag is string => typeof tag === "string" && tag.length > 0)
          .map((tag) => tag.toLowerCase())
      )
    ),
    subtypes: [
      category,
      kind,
      ...(isConcrete ? ["concrete_event_page"] : []),
      ...(isEditorial ? ["editorial_summary_page"] : []),
      ...(item.sourceKind === "table" ? ["table_schedule_page"] : []),
    ],
    audiences: familyFriendly ? ["family"] : [],
    occasions:
      category === "concert" || category === "show"
        ? ["date", "friends", "party"]
        : category === "market" || category === "festival" || category === "food_event"
          ? ["friends", "family", "tourism"]
          : ["tourism", "friends"],
    source_payload: { item, detail },
    source_updated_at: null,
    last_seen_at: new Date().toISOString(),
  }));
}

export async function enrichHamburgDeEvents(items: HamburgDeItem[]) {
  return Promise.all(
    items.map(async (item) => {
      try {
        return { item, detail: await fetchHamburgDeEventDetail(item.sourceUrl) };
      } catch {
        return { item, detail: null };
      }
    })
  );
}
