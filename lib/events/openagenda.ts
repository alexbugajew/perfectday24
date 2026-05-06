import type { PlannerEventCategory, PlannerEventKind } from "../planner/types";

export type OpenAgendaAgendaRef = {
  uid: number;
  citySlug: string;
  cityName: string;
  countryCode: string | null;
  label?: string | null;
};

export type OpenAgendaFetchOptions = {
  apiKey: string;
  agendaUid: number;
  after?: Array<string | number> | null;
  size?: number;
};

type OpenAgendaTiming = {
  begin?: string;
  end?: string;
};

type OpenAgendaLocation = {
  name?: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
};

type OpenAgendaEvent = {
  uid: number;
  slug?: string;
  title?: string | Record<string, string>;
  description?: string | Record<string, string>;
  longDescription?: string | Record<string, string>;
  keywords?: string[] | Record<string, string[]>;
  image?: {
    base?: string;
    filename?: string;
  };
  nextTiming?: OpenAgendaTiming;
  firstTiming?: OpenAgendaTiming;
  lastTiming?: OpenAgendaTiming;
  timings?: OpenAgendaTiming[];
  location?: OpenAgendaLocation;
  attendanceMode?: number;
  accessibility?: Record<string, boolean>;
  originAgenda?: { uid?: number; title?: string };
  sourceAgenda?: { uid?: number; title?: string };
  categories?: Array<number | string>;
};

type OpenAgendaResponse = {
  events?: OpenAgendaEvent[];
  after?: Array<string | number>;
};

export type NormalizedOpenAgendaEvent = {
  source: string;
  external_id: string;
  source_url: string | null;
  ticket_url: string | null;
  title: string;
  summary: string | null;
  category: PlannerEventCategory;
  kind: PlannerEventKind;
  status: "scheduled" | "cancelled" | "postponed" | "draft";
  venue_name: string | null;
  venue_address: string | null;
  city_slug: string | null;
  country_code: string | null;
  lat: number | null;
  lng: number | null;
  timezone: string | null;
  start_at: string;
  end_at: string | null;
  doors_at: string | null;
  all_day: boolean;
  is_ticketed: boolean;
  price_min: number | null;
  price_max: number | null;
  currency: string | null;
  family_friendly: boolean | null;
  indoor_outdoor: "indoor" | "outdoor" | "mixed" | null;
  local_rank: number | null;
  importance_score: number | null;
  popularity_score: number | null;
  tags: string[];
  subtypes: string[];
  audiences: string[];
  occasions: string[];
  source_payload: unknown;
  source_updated_at: string;
  last_seen_at: string;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function slugify(value: string | null | undefined) {
  return normalize(value)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function dedupe(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => normalize(value)).filter(Boolean)));
}

function pickText(value: string | Record<string, string> | undefined) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.de ?? value.en ?? value.fr ?? Object.values(value)[0] ?? null;
}

function pickKeywordList(
  value: string[] | Record<string, string[]> | undefined
) {
  if (!value) return [];
  if (Array.isArray(value)) return dedupe(value);
  return dedupe([
    ...(value.de ?? []),
    ...(value.en ?? []),
    ...(value.fr ?? []),
  ]);
}

function eventImageUrl(image: OpenAgendaEvent["image"]) {
  if (!image?.base || !image?.filename) return null;
  return `${image.base}/${image.filename}`;
}

function detectCategory(event: OpenAgendaEvent, keywords: string[]): PlannerEventCategory {
  const haystack = dedupe([
    pickText(event.title) ?? "",
    pickText(event.description) ?? "",
    pickText(event.longDescription) ?? "",
    ...keywords,
  ]);

  if (haystack.some((value) => value.includes("weihnacht") || value.includes("christmas") || value.includes("oster") || value.includes("advent"))) {
    return "seasonal";
  }
  if (haystack.some((value) => value.includes("markt") || value.includes("marche") || value.includes("market"))) {
    return "market";
  }
  if (haystack.some((value) => value.includes("festival"))) {
    return "festival";
  }
  if (haystack.some((value) => value.includes("food") || value.includes("streetfood") || value.includes("truck") || value.includes("kulinar"))) {
    return "food_event";
  }
  if (haystack.some((value) => value.includes("kirmes") || value.includes("fair") || value.includes("funfair"))) {
    return "fair";
  }
  if (haystack.some((value) => value.includes("fete") || value.includes("community") || value.includes("quartier") || value.includes("stadtfest"))) {
    return "community";
  }
  return "other";
}

function detectKind(category: PlannerEventCategory): PlannerEventKind {
  return category === "market" ||
    category === "festival" ||
    category === "fair" ||
    category === "food_event" ||
    category === "community" ||
    category === "seasonal"
    ? "flex_event"
    : "anchored_event";
}

function deriveOccasions(category: PlannerEventCategory, familyFriendly: boolean | null) {
  if (familyFriendly) return ["family", "friends", "tourism"];
  if (category === "festival" || category === "food_event") return ["friends", "tourism", "party"];
  if (category === "market" || category === "seasonal" || category === "fair") {
    return ["tourism", "family", "friends", "date"];
  }
  return ["friends", "tourism"];
}

export async function fetchOpenAgendaEvents(options: OpenAgendaFetchOptions) {
  const url = new URL(`https://api.openagenda.com/v2/agendas/${options.agendaUid}/events`);
  url.searchParams.set("size", String(options.size ?? 100));
  url.searchParams.set("detailed", "1");
  if (options.after) {
    for (const item of options.after) {
      url.searchParams.append("after[]", String(item));
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      key: options.apiKey,
      Accept: "application/json",
      lang: "de",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAgenda API Fehler (${response.status}): ${text}`);
  }

  return (await response.json()) as OpenAgendaResponse;
}

export function normalizeOpenAgendaEvent(
  event: OpenAgendaEvent,
  agenda: OpenAgendaAgendaRef
): NormalizedOpenAgendaEvent | null {
  const title = pickText(event.title);
  if (!event.uid || !title) return null;

  const timings = Array.isArray(event.timings) && event.timings.length > 0
    ? event.timings
    : [event.nextTiming, event.firstTiming].filter(Boolean) as OpenAgendaTiming[];

  const timing = timings[0];
  if (!timing?.begin) return null;

  const keywords = pickKeywordList(event.keywords);
  const category = detectCategory(event, keywords);
  const kind = detectKind(category);
  const familyFriendly =
    keywords.some((value) => value.includes("famille") || value.includes("family") || value.includes("kinder")) ||
    false;
  const imageUrl = eventImageUrl(event.image);

  return {
    source: "openagenda",
    external_id: String(event.uid),
    source_url: event.slug ? `https://openagenda.com/${event.slug}` : null,
    ticket_url: null,
    title,
    summary: pickText(event.description) ?? pickText(event.longDescription),
    category,
    kind,
    status: "scheduled",
    venue_name: event.location?.name ?? agenda.label ?? null,
    venue_address: event.location?.address ?? null,
    city_slug: agenda.citySlug,
    country_code: agenda.countryCode?.toUpperCase() ?? null,
    lat: typeof event.location?.latitude === "number" ? event.location.latitude : null,
    lng: typeof event.location?.longitude === "number" ? event.location.longitude : null,
    timezone: null,
    start_at: timing.begin,
    end_at: timing.end ?? null,
    doors_at: null,
    all_day: false,
    is_ticketed: false,
    price_min: null,
    price_max: null,
    currency: null,
    family_friendly: familyFriendly,
    indoor_outdoor: null,
    local_rank: null,
    importance_score:
      category === "seasonal" ? 76 :
      category === "market" ? 72 :
      category === "festival" ? 74 :
      category === "food_event" ? 71 :
      category === "fair" ? 68 :
      60,
    popularity_score: imageUrl ? 58 : 44,
    tags: dedupe([
      ...keywords,
      agenda.cityName,
      event.location?.city,
      imageUrl ? "has_image" : undefined,
    ]),
    subtypes: dedupe([
      category,
      kind,
      ...keywords.map((value) => slugify(value)),
    ]),
    audiences: familyFriendly ? ["family"] : ["friends", "tourism"],
    occasions: deriveOccasions(category, familyFriendly),
    source_payload: {
      provider: "openagenda",
      rawEvent: event,
      imageUrl,
      agendaUid: agenda.uid,
      agendaLabel: agenda.label ?? null,
    },
    source_updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  };
}

export function parseOpenAgendaMapping(raw: string | undefined) {
  if (!raw) return [] as OpenAgendaAgendaRef[];

  return raw
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const [citySlug, agendaUidRaw, cityName, countryCode, label] = entry.split("|");
      const agendaUid = Number(agendaUidRaw);
      if (!citySlug || !Number.isFinite(agendaUid)) return [];
      return [
        {
          citySlug,
          uid: agendaUid,
          cityName: cityName || citySlug,
          countryCode: countryCode || null,
          label: label || null,
        } satisfies OpenAgendaAgendaRef,
      ];
    });
}
