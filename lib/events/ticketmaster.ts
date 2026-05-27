import type { PlannerEventCategory, PlannerEventKind } from "../planner/types";

export type TicketmasterCityInput = {
  slug: string;
  name: string;
  ticketmasterName?: string | null;
  countryCode: string | null;
};

export type TicketmasterFetchOptions = {
  apiKey: string;
  city: TicketmasterCityInput;
  startDateTime?: string | null;
  endDateTime?: string | null;
  page?: number;
  size?: number;
};

type TicketmasterImage = {
  ratio?: string;
  url?: string;
  width?: number;
  height?: number;
  fallback?: boolean;
};

type TicketmasterVenue = {
  name?: string;
  address?: { line1?: string };
  city?: { name?: string };
  country?: { countryCode?: string };
  location?: { latitude?: string; longitude?: string };
};

type TicketmasterClassification = {
  segment?: { name?: string };
  genre?: { name?: string };
  subGenre?: { name?: string };
  type?: { name?: string };
  subType?: { name?: string };
  family?: boolean;
};

type TicketmasterEvent = {
  id: string;
  name?: string;
  url?: string;
  info?: string;
  pleaseNote?: string;
  images?: TicketmasterImage[];
  priceRanges?: Array<{ min?: number; max?: number; currency?: string }>;
  classifications?: TicketmasterClassification[];
  dates?: {
    start?: { dateTime?: string; localDate?: string; localTime?: string; noSpecificTime?: boolean };
    end?: { dateTime?: string };
    access?: { startDateTime?: string };
    timezone?: string;
    status?: { code?: string };
    spanMultipleDays?: boolean;
  };
  _embedded?: {
    venues?: TicketmasterVenue[];
  };
};

type TicketmasterResponse = {
  page?: {
    size?: number;
    totalElements?: number;
    totalPages?: number;
    number?: number;
  };
  _embedded?: {
    events?: TicketmasterEvent[];
  };
};

export type NormalizedProviderEvent = {
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

function mapStatus(code: string | null | undefined): "scheduled" | "cancelled" | "postponed" | "draft" {
  const normalized = normalize(code);
  if (normalized === "canceled") return "cancelled";
  if (normalized === "postponed" || normalized === "rescheduled") return "postponed";
  if (normalized === "onsale" || normalized === "offsale") return "scheduled";
  return "draft";
}

function pickCategory(classifications: TicketmasterClassification[]): PlannerEventCategory {
  const haystack = dedupe(
    classifications.flatMap((classification) => [
      classification.segment?.name,
      classification.genre?.name,
      classification.subGenre?.name,
      classification.type?.name,
      classification.subType?.name,
    ])
  );

  if (haystack.some((value) => value.includes("music"))) return "concert";
  if (haystack.some((value) => value.includes("theatre") || value.includes("theater") || value.includes("opera"))) {
    return "theater";
  }
  if (haystack.some((value) => value.includes("comedy") || value.includes("magic") || value.includes("spectacular") || value.includes("show"))) {
    return "show";
  }
  if (haystack.some((value) => value.includes("family") || value.includes("children"))) {
    return "show";
  }
  return "other";
}

function pickKind(category: PlannerEventCategory): PlannerEventKind {
  return category === "concert" || category === "theater" || category === "show"
    ? "anchored_event"
    : "flex_event";
}

function deriveOccasions(category: PlannerEventCategory, familyFriendly: boolean | null) {
  if (familyFriendly) return ["family", "friends", "tourism"];
  if (category === "concert" || category === "show") return ["date", "friends", "party"];
  if (category === "theater") return ["date", "tourism"];
  return ["friends", "tourism"];
}

function bestImageUrl(images: TicketmasterImage[] | undefined) {
  if (!Array.isArray(images) || images.length === 0) return null;
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return sorted[0]?.url ?? null;
}

function toIsoLocalDateTime(localDate: string | undefined, localTime: string | undefined) {
  if (!localDate) return null;
  if (!localTime) return `${localDate}T18:00:00`;
  return `${localDate}T${localTime}`;
}

/** Milliseconds to wait before a single Ticketmaster HTTP request times out. */
const FETCH_TIMEOUT_MS = 30_000;

/** How many times to retry a failed request (e.g. after a 429 or transient error). */
const MAX_RETRIES = 2;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function fetchTicketmasterEvents(options: TicketmasterFetchOptions) {
  const page = options.page ?? 0;
  const size = options.size ?? 200;
  const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  url.searchParams.set("apikey", options.apiKey);
  url.searchParams.set("city", options.city.ticketmasterName ?? options.city.name);
  if (options.city.countryCode) {
    url.searchParams.set("countryCode", options.city.countryCode.toUpperCase());
  }
  url.searchParams.set("classificationName", "music,arts & theatre,family,miscellaneous");
  url.searchParams.set("size", String(size));
  url.searchParams.set("page", String(page));
  if (options.startDateTime && options.endDateTime) {
    url.searchParams.set("startEndDateTime", `${options.startDateTime},${options.endDateTime}`);
  }

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Use AbortController + clearTimeout instead of AbortSignal.timeout().
    // AbortSignal.timeout() leaves the timer alive after the request completes,
    // which can abort unrelated requests in the same undici connection pool
    // (Node.js 24 / undici bug). clearTimeout() ensures the timer is removed
    // as soon as the request succeeds or fails.
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(new Error(`Ticketmaster request timed out after ${FETCH_TIMEOUT_MS}ms`)),
      FETCH_TIMEOUT_MS
    );

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId); // cancel the timer — request completed in time
    } catch (err) {
      clearTimeout(timeoutId); // always clean up
      lastError = err instanceof Error ? err : new Error(String(err));
      const isTimeout =
        lastError.name === "TimeoutError" || lastError.name === "AbortError";
      if (isTimeout && attempt < MAX_RETRIES) {
        const backoff = 2_000 * (attempt + 1);
        console.warn(
          `[ticketmaster] ${options.city.slug}: Request-Timeout (Versuch ${attempt + 1}/${MAX_RETRIES + 1}), warte ${backoff}ms …`
        );
        await sleep(backoff);
        continue;
      }
      throw lastError;
    }

    // Rate limit — Ticketmaster returns 429 when quota is exceeded.
    if (response.status === 429) {
      const retryAfterSec = Number(response.headers.get("Retry-After") ?? "5");
      const waitMs = Math.min(Math.max(retryAfterSec * 1000, 2_000), 30_000);
      if (attempt < MAX_RETRIES) {
        console.warn(
          `[ticketmaster] ${options.city.slug}: 429 Rate-Limit, warte ${waitMs}ms (Versuch ${attempt + 1}/${MAX_RETRIES + 1}) …`
        );
        await sleep(waitMs);
        continue;
      }
      const text = await response.text().catch(() => "");
      throw new Error(`Ticketmaster API 429 Rate-Limit (nach ${MAX_RETRIES} Retries): ${text}`);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Ticketmaster API Fehler (${response.status}): ${text}`);
    }

    return (await response.json()) as TicketmasterResponse;
  }

  throw lastError ?? new Error("Ticketmaster fetch fehlgeschlagen (unbekannter Fehler)");
}

export function normalizeTicketmasterEvent(
  event: TicketmasterEvent,
  city: TicketmasterCityInput
): NormalizedProviderEvent | null {
  if (!event.id || !event.name) return null;

  const classifications = event.classifications ?? [];
  const category = pickCategory(classifications);
  const kind = pickKind(category);
  const venue = event._embedded?.venues?.[0];
  const familyFriendly =
    classifications.some((classification) => classification.family === true) || null;
  const status = mapStatus(event.dates?.status?.code);
  const startAt =
    event.dates?.start?.dateTime ??
    toIsoLocalDateTime(event.dates?.start?.localDate, event.dates?.start?.localTime);

  if (!startAt) return null;

  const priceRange = event.priceRanges?.[0];
  const imageUrl = bestImageUrl(event.images);
  const classificationTags = dedupe(
    classifications.flatMap((classification) => [
      classification.segment?.name,
      classification.genre?.name,
      classification.subGenre?.name,
      classification.type?.name,
      classification.subType?.name,
    ])
  );

  const categorySubtype =
    category === "concert"
      ? ["concert", "live_music"]
      : category === "theater"
        ? ["theater", "performing_arts"]
        : category === "show"
          ? ["show"]
          : ["event"];

  const lat =
    venue?.location?.latitude != null ? Number(venue.location.latitude) : null;
  const lng =
    venue?.location?.longitude != null ? Number(venue.location.longitude) : null;

  return {
    source: "ticketmaster",
    external_id: event.id,
    source_url: event.url ?? null,
    ticket_url: event.url ?? null,
    title: event.name,
    summary: event.info ?? event.pleaseNote ?? null,
    category,
    kind,
    status,
    venue_name: venue?.name ?? null,
    venue_address: venue?.address?.line1 ?? null,
    city_slug: city.slug,
    country_code: city.countryCode?.toUpperCase() ?? venue?.country?.countryCode?.toUpperCase() ?? null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    timezone: event.dates?.timezone ?? null,
    start_at: startAt,
    end_at: event.dates?.end?.dateTime ?? null,
    doors_at: event.dates?.access?.startDateTime ?? null,
    all_day: event.dates?.start?.noSpecificTime === true,
    is_ticketed: true,
    price_min: typeof priceRange?.min === "number" ? priceRange.min : null,
    price_max: typeof priceRange?.max === "number" ? priceRange.max : null,
    currency: priceRange?.currency ?? null,
    family_friendly: familyFriendly,
    indoor_outdoor: null,
    local_rank: null,
    importance_score: category === "concert" ? 78 : category === "theater" ? 72 : 68,
    popularity_score: imageUrl ? 62 : 48,
    tags: dedupe([
      ...classificationTags,
      venue?.name,
      city.name,
      city.countryCode ?? undefined,
      imageUrl ? "has_image" : undefined,
    ]),
    subtypes: dedupe([
      ...categorySubtype,
      ...classificationTags.map((value) => slugify(value)),
    ]),
    audiences: familyFriendly ? ["family"] : ["adult", "friends"],
    occasions: deriveOccasions(category, familyFriendly),
    source_payload: {
      provider: "ticketmaster",
      rawEvent: event,
      imageUrl,
    },
    source_updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  };
}
