import type { EventSourceConfigRow, OfficialCityEvent } from "./visitberlin";

type BremenBootstrapEventSeed = {
  externalId: string;
  title: string;
  sourceUrl: string;
  ticketUrl?: string | null;
  summary: string;
  category: OfficialCityEvent["category"];
  kind: OfficialCityEvent["kind"];
  venueName: string;
  venueAddress: string;
  lat: number;
  lng: number;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  familyFriendly?: boolean | null;
  indoorOutdoor?: OfficialCityEvent["indoor_outdoor"];
  tags: string[];
  subtypes: string[];
  audiences: string[];
  occasions: string[];
  localRank: number;
  importanceScore: number;
  popularityScore: number;
};

const OFFICIAL_CAPTURED_AT = "2026-04-18T12:00:00+02:00";

const BREMEN_BOOTSTRAP_EVENTS: BremenBootstrapEventSeed[] = [
  {
    externalId: "bremen:jazzahead-2026",
    title: "jazzahead! 2026",
    sourceUrl: "https://www.bremen.de/veranstaltung/jazzahead",
    summary:
      "Offizielles Bremen-Highlight rund um Jazz, Showcase-Konzerte und internationale Clubnight in Messe Bremen und der Innenstadt.",
    category: "concert",
    kind: "anchored_event",
    venueName: "Messe Bremen",
    venueAddress: "Findorffstraße 101, 28215 Bremen",
    lat: 53.0878,
    lng: 8.8148,
    startAt: "2026-04-22T10:00:00+02:00",
    endAt: "2026-04-25T23:00:00+02:00",
    allDay: false,
    familyFriendly: null,
    indoorOutdoor: "mixed",
    tags: ["bremen_tourism", "official_bootstrap", "jazz", "messe bremen"],
    subtypes: ["concrete_event_page", "concert", "festival_event", "official_bootstrap"],
    audiences: ["date", "friends", "party", "tourism"],
    occasions: ["date", "friends", "party", "tourism"],
    localRank: 92,
    importanceScore: 92,
    popularityScore: 88,
  },
  {
    externalId: "bremen:deutscher-jazzpreis-2026",
    title: "Deutscher Jazzpreis 2026",
    sourceUrl: "https://www.bremen.de/veranstaltung/jazzahead#deutscher-jazzpreis-2026",
    ticketUrl: "https://www.bremen.de/veranstaltung/jazzahead#deutscher-jazzpreis-2026",
    summary:
      "Offizielle Abendgala im Rahmen von jazzahead! mit Konzert- und Preisverleihungscharakter im Congress Centrum Bremen.",
    category: "show",
    kind: "anchored_event",
    venueName: "Congress Centrum Bremen",
    venueAddress: "Findorffstraße 101, 28215 Bremen",
    lat: 53.0884,
    lng: 8.8144,
    startAt: "2026-04-25T19:30:00+02:00",
    endAt: "2026-04-25T22:30:00+02:00",
    allDay: false,
    familyFriendly: false,
    indoorOutdoor: "indoor",
    tags: ["bremen_tourism", "official_bootstrap", "jazz", "award show"],
    subtypes: ["concrete_event_page", "show", "concert", "sub_event", "official_bootstrap"],
    audiences: ["date", "friends", "party"],
    occasions: ["date", "friends", "party"],
    localRank: 94,
    importanceScore: 95,
    popularityScore: 90,
  },
  {
    externalId: "bremen:breminale-2026",
    title: "Breminale 2026",
    sourceUrl: "https://www.bremen.de/veranstaltung/breminale",
    summary:
      "Offizielles Open-Air-Festival an der Weser mit Musik, Kulturprogramm und gastronomischen Staenden rund um den Osterdeich.",
    category: "festival",
    kind: "flex_event",
    venueName: "Osterdeich",
    venueAddress: "Osterdeich, 28203 Bremen",
    lat: 53.0693,
    lng: 8.8234,
    startAt: "2026-07-01T16:00:00+02:00",
    endAt: "2026-07-05T23:00:00+02:00",
    allDay: false,
    familyFriendly: true,
    indoorOutdoor: "outdoor",
    tags: ["bremen_tourism", "official_bootstrap", "weser", "open air"],
    subtypes: ["concrete_event_page", "festival", "festival_event", "official_bootstrap"],
    audiences: ["tourism", "friends", "date", "family"],
    occasions: ["tourism", "friends", "date", "family"],
    localRank: 93,
    importanceScore: 93,
    popularityScore: 89,
  },
  {
    externalId: "bremen:tag-der-deutschen-einheit-2026",
    title: "Tag der Deutschen Einheit 2026 in Bremen",
    sourceUrl: "https://www.rathaus.bremen.de/tag-der-deutschen-einheit-2026-in-bremen-141789",
    summary:
      "Offizielles Stadtprogramm zum Tag der Deutschen Einheit 2026 mit Buergerfest und Kulturprogramm in der Bremer Innenstadt.",
    category: "festival",
    kind: "flex_event",
    venueName: "Bremer Innenstadt",
    venueAddress: "Marktplatz, 28195 Bremen",
    lat: 53.0758,
    lng: 8.8072,
    startAt: "2026-10-02T10:00:00+02:00",
    endAt: "2026-10-04T22:00:00+02:00",
    allDay: false,
    familyFriendly: true,
    indoorOutdoor: "mixed",
    tags: ["bremen_tourism", "official_bootstrap", "buergerfest", "stadtfest"],
    subtypes: ["concrete_event_page", "festival", "community", "official_bootstrap"],
    audiences: ["tourism", "friends", "family", "date"],
    occasions: ["tourism", "friends", "family", "date"],
    localRank: 91,
    importanceScore: 94,
    popularityScore: 86,
  },
  {
    externalId: "bremen:freimarkt-2026",
    title: "Freimarkt Bremen 2026",
    sourceUrl: "https://www.bremen.de/veranstaltung/freimarkt",
    summary:
      "Offizieller Bremer Freimarkt auf der Buergerweide mit Volksfestcharakter, Fahrgeschaeften und Marktstimmung.",
    category: "festival",
    kind: "flex_event",
    venueName: "Bürgerweide",
    venueAddress: "Bürgerweide, 28209 Bremen",
    lat: 53.0848,
    lng: 8.8141,
    startAt: "2026-10-16T11:00:00+02:00",
    endAt: "2026-11-01T23:00:00+01:00",
    allDay: false,
    familyFriendly: true,
    indoorOutdoor: "outdoor",
    tags: ["bremen_tourism", "official_bootstrap", "volksfest", "freimarkt"],
    subtypes: ["concrete_event_page", "festival", "market_event", "official_bootstrap"],
    audiences: ["tourism", "friends", "family", "date"],
    occasions: ["tourism", "friends", "family", "date"],
    localRank: 95,
    importanceScore: 96,
    popularityScore: 92,
  },
  {
    externalId: "bremen:weihnachtsmarkt-2026",
    title: "Weihnachtsmarkt Bremen 2026",
    sourceUrl: "https://www.bremen.de/weihnachtsmarkt-in-bremen",
    summary:
      "Offizieller Weihnachtsmarkt auf dem Bremer Marktplatz mit Buden, Lichtern und saisonalem Stadtprogramm.",
    category: "market",
    kind: "flex_event",
    venueName: "Bremer Marktplatz",
    venueAddress: "Marktplatz, 28195 Bremen",
    lat: 53.0758,
    lng: 8.8072,
    startAt: "2026-11-23T11:00:00+01:00",
    endAt: "2026-12-23T20:30:00+01:00",
    allDay: false,
    familyFriendly: true,
    indoorOutdoor: "outdoor",
    tags: ["bremen_tourism", "official_bootstrap", "weihnachtsmarkt", "marktplatz"],
    subtypes: ["concrete_event_page", "market", "seasonal_market", "official_bootstrap"],
    audiences: ["tourism", "friends", "family", "date"],
    occasions: ["tourism", "friends", "family", "date"],
    localRank: 94,
    importanceScore: 95,
    popularityScore: 90,
  },
  {
    externalId: "bremen:schlachte-zauber-2026",
    title: "Schlachte-Zauber 2026",
    sourceUrl: "https://www.bremen.de/weihnachtsmarkt-in-bremen",
    summary:
      "Offizielles Winter-Highlight an der Schlachte mit maritimer Weihnachtsatmosphaere und saisonalen Ständen.",
    category: "market",
    kind: "flex_event",
    venueName: "Schlachte",
    venueAddress: "Schlachte, 28195 Bremen",
    lat: 53.0765,
    lng: 8.8019,
    startAt: "2026-11-23T11:00:00+01:00",
    endAt: "2026-12-23T21:30:00+01:00",
    allDay: false,
    familyFriendly: true,
    indoorOutdoor: "outdoor",
    tags: ["bremen_tourism", "official_bootstrap", "schlachte", "wintermarkt"],
    subtypes: ["concrete_event_page", "market", "seasonal_market", "official_bootstrap"],
    audiences: ["tourism", "friends", "family", "date"],
    occasions: ["tourism", "friends", "family", "date"],
    localRank: 92,
    importanceScore: 93,
    popularityScore: 87,
  },
];

function extractDatePart(value: string) {
  return value.slice(0, 10);
}

function extractTimePart(value: string) {
  return value.slice(11, 16);
}

function offsetForBerlinDate(datePart: string) {
  const month = Number(datePart.slice(5, 7));
  if (month >= 11 || month <= 2) return "+01:00";
  return "+02:00";
}

function buildBerlinIso(datePart: string, timePart: string) {
  return `${datePart}T${timePart}:00${offsetForBerlinDate(datePart)}`;
}

function shiftDate(datePart: string, offsetDays: number) {
  const date = new Date(`${datePart}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function daySpan(startAt: string, endAt: string | null) {
  if (!endAt) return 1;
  const start = new Date(`${extractDatePart(startAt)}T12:00:00Z`);
  const end = new Date(`${extractDatePart(endAt)}T12:00:00Z`);
  const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000);
  return Math.max(1, diffDays + 1);
}

function expandSeed(seed: BremenBootstrapEventSeed) {
  const span = daySpan(seed.startAt, seed.endAt);
  if (span <= 1) return [seed];

  const startDate = extractDatePart(seed.startAt);
  const startTime = extractTimePart(seed.startAt);
  const endTime = extractTimePart(seed.endAt ?? seed.startAt);

  return Array.from({ length: span }, (_, index) => {
    const occurrenceDate = shiftDate(startDate, index);
    return {
      ...seed,
      externalId: `${seed.externalId}:${occurrenceDate}`,
      startAt: buildBerlinIso(occurrenceDate, startTime),
      endAt: buildBerlinIso(occurrenceDate, endTime),
      sourceUrl: seed.sourceUrl,
      subtypes: Array.from(new Set([...seed.subtypes, "daily_occurrence"])),
    };
  });
}

function cloneEvent(
  seed: BremenBootstrapEventSeed,
  config: EventSourceConfigRow
): OfficialCityEvent {
  return {
    source: config.provider,
    external_id: seed.externalId,
    source_url: seed.sourceUrl,
    ticket_url: seed.ticketUrl ?? seed.sourceUrl,
    title: seed.title,
    summary: seed.summary,
    category: seed.category,
    kind: seed.kind,
    status: "scheduled",
    venue_name: seed.venueName,
    venue_address: seed.venueAddress,
    city_slug: config.city_slug,
    country_code: config.country_code ?? "DE",
    lat: seed.lat,
    lng: seed.lng,
    timezone: "Europe/Berlin",
    start_at: seed.startAt,
    end_at: seed.endAt,
    doors_at: null,
    all_day: seed.allDay,
    is_ticketed: Boolean(seed.ticketUrl),
    price_min: null,
    price_max: null,
    currency: null,
    family_friendly: seed.familyFriendly ?? null,
    indoor_outdoor: seed.indoorOutdoor ?? null,
    local_rank: seed.localRank,
    importance_score: seed.importanceScore,
    popularity_score: seed.popularityScore,
    tags: seed.tags,
    subtypes: seed.subtypes,
    audiences: seed.audiences,
    occasions: seed.occasions,
    source_payload: {
      mode: "official_bootstrap",
      note: "Bremen.de blockiert automatisierte HTML-Fetches per Cloudflare; daher vorerst kuratierte offizielle Highlight-Events.",
      captured_at: OFFICIAL_CAPTURED_AT,
      source_url: seed.sourceUrl,
    },
    source_updated_at: OFFICIAL_CAPTURED_AT,
    last_seen_at: new Date().toISOString(),
  };
}

export async function fetchBremenTourismEvents(config: EventSourceConfigRow) {
  return BREMEN_BOOTSTRAP_EVENTS.flatMap((seed) =>
    expandSeed(seed).map((occurrence) => cloneEvent(occurrence, config))
  );
}

export function normalizeBremenTourismEvent(item: OfficialCityEvent, _config: EventSourceConfigRow) {
  return item;
}
