// lib/events/around-event.ts
//
// Lädt eine Veranstaltung und schlägt vor, was davor und danach passt.
//
// Das ist der Kern der Event-Strecke: Eine Liste von Veranstaltungen hätte
// gegenüber Eventim, Rausgegangen oder den Stadtportalen keine
// Daseinsberechtigung. Der Unterschied entsteht erst im zweiten Schritt — das
// Event als Hauptmoment nehmen und den Abend darum herum bauen.
//
// Die Vorschläge hier sind bewusst einfach gehalten: nächstgelegene passende
// Orte mit realistischen Zeiten. Sie sind der Appetitanreger, der eigentliche
// Plan entsteht im Planner, der das Event über `?eventId=` als Anker übernimmt.

import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { classify, localDateKey } from "@/lib/planner";
import { haversineKm } from "@/lib/planner/travel";
import type {
  LocationCategory,
  LocationRow,
  PlannerEventCategory,
  PlannerEventRow,
} from "@/lib/planner/types";

/** Wie weit ein Vorschlag höchstens vom Veranstaltungsort entfernt sein darf. */
const MAX_DISTANCE_KM = 1.8;

/** Gehgeschwindigkeit für die Fußweg-Schätzung (km/h). */
const WALKING_SPEED_KMH = 4.8;

/** Aufenthaltsdauer, mit der wir für den Vorschlag davor rechnen. */
const STAY_MINUTES: Record<string, number> = {
  restaurant: 75,
  cafe: 45,
  nightlife: 60,
  culture: 60,
  activity: 60,
};

const DEFAULT_EVENT_MINUTES = 120;

export type AroundEventSuggestion = {
  id: string;
  name: string;
  category: LocationCategory;
  description: string | null;
  distanceKm: number;
  walkMinutes: number;
  /** Uhrzeit, zu der man dort sein sollte bzw. ankäme — bereits lokal formatiert. */
  timeLabel: string;
};

export type EventDetail = {
  event: PlannerEventRow;
  cityLabel: string;
  citySlug: string;
  startLabel: string;
  dateLabel: string;
  endLabel: string | null;
  /** ISO-Datum für den Planner-Link. */
  planDate: string;
  before: AroundEventSuggestion[];
  after: AroundEventSuggestion[];
  /** Warum es keine Vorschläge gibt — für eine ehrliche Anzeige statt leerer Fläche. */
  suggestionsUnavailable: string | null;
};

function supabaseOrNull() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function timeFormatter(timezone: string | null | undefined) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: timezone || "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateFormatter(timezone: string | null | undefined) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: timezone || "Europe/Berlin",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Lokale Stunde in der Zeitzone der Veranstaltung — entscheidet Abend vs. Tag. */
function localHour(iso: string, timezone: string | null | undefined): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone || "Europe/Berlin",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const hour = parts.find((part) => part.type === "hour")?.value;
  return hour ? Number(hour) : 12;
}

function walkMinutes(distanceKm: number): number {
  return Math.max(1, Math.round((distanceKm / WALKING_SPEED_KMH) * 60));
}

/**
 * Grobes Rechteck um den Veranstaltungsort. Spart es, alle Orte einer Stadt zu
 * laden — Berlin allein hat über 13.000 planbare Einträge.
 */
function boundingBox(lat: number, lng: number, radiusKm: number) {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

function toSuggestion(
  location: LocationRow,
  distanceKm: number,
  timeIso: number,
  timezone: string | null | undefined
): AroundEventSuggestion {
  return {
    id: location.id,
    name: location.name,
    category: classify(location),
    description: location.description ?? null,
    distanceKm: Math.round(distanceKm * 10) / 10,
    walkMinutes: walkMinutes(distanceKm),
    timeLabel: timeFormatter(timezone).format(new Date(timeIso)),
  };
}

/**
 * Lädt Veranstaltung, Stadtnamen und die Vorschläge davor und danach.
 *
 * Gibt null zurück, wenn es die Veranstaltung nicht (mehr) gibt oder sie nicht
 * zur Stadt im Pfad gehört — die Seite antwortet dann mit 404.
 */
export const loadEventDetail = cache(
  async (citySlug: string, eventId: string): Promise<EventDetail | null> => {
    const supabase = supabaseOrNull();
    if (!supabase) return null;

    try {
      const { data: eventData, error } = await supabase
        .from("planner_events")
        .select("*")
        .eq("id", eventId)
        .eq("city_slug", citySlug)
        .eq("status", "scheduled")
        .maybeSingle();

      if (error || !eventData) return null;
      const event = eventData as PlannerEventRow;
      if (!event.start_at) return null;

      const { data: cityRow } = await supabase
        .from("cities")
        .select("name")
        .eq("slug", citySlug)
        .maybeSingle();
      const cityLabel = (cityRow as { name?: string } | null)?.name ?? citySlug;

      const timeFmt = timeFormatter(event.timezone);
      const startMs = new Date(event.start_at).getTime();
      const endMs = event.end_at
        ? new Date(event.end_at).getTime()
        : startMs + DEFAULT_EVENT_MINUTES * 60_000;

      const base = {
        event,
        cityLabel,
        citySlug,
        startLabel: timeFmt.format(new Date(startMs)),
        dateLabel: dateFormatter(event.timezone).format(new Date(startMs)),
        // Ein Ende zeigen wir nur, wenn es in den Daten steht. Bei rund 10.700
        // geplanten Events fehlt es — eine geschätzte Endzeit als Tatsache
        // auszugeben wäre eine Behauptung, die die Quelle nicht deckt.
        endLabel: event.end_at ? timeFmt.format(new Date(endMs)) : null,
        // Das lokale Datum der Veranstaltung, nicht das UTC-Datum: Ein Konzert
        // um 00:00 Ortszeit liegt in UTC noch am Vortag. Der Planner filtert
        // seine Kandidaten ueber plannerEventIsActive nach dem lokalen Tag —
        // mit dem UTC-Datum fragt er den falschen Tag ab, findet das Event
        // nicht und verwirft den uebergebenen Anker wieder.
        planDate: localDateKey(event.start_at, event.timezone),
      };

      if (typeof event.lat !== "number" || typeof event.lng !== "number") {
        return {
          ...base,
          before: [],
          after: [],
          suggestionsUnavailable:
            "Für diese Veranstaltung fehlen die Koordinaten, deshalb können wir die Umgebung nicht vorschlagen.",
        };
      }

      const box = boundingBox(event.lat, event.lng, MAX_DISTANCE_KM);
      const { data: locationRows } = await supabase
        .from("locations")
        .select("*")
        .eq("city_slug", citySlug)
        .eq("is_plannable", true)
        .gte("lat", box.minLat)
        .lte("lat", box.maxLat)
        .gte("lng", box.minLng)
        .lte("lng", box.maxLng)
        .order("quality_score", { ascending: false, nullsFirst: false })
        .limit(400);

      const nearby = ((locationRows ?? []) as LocationRow[])
        .filter((row) => typeof row.lat === "number" && typeof row.lng === "number")
        .map((row) => ({
          row,
          distanceKm: haversineKm(event.lat as number, event.lng as number, row.lat as number, row.lng as number),
        }))
        .filter((entry) => entry.distanceKm <= MAX_DISTANCE_KM)
        .sort((a, b) => a.distanceKm - b.distanceKm);

      const evening = localHour(event.start_at, event.timezone) >= 17;
      const beforeCategories: LocationCategory[] = evening ? ["restaurant", "cafe"] : ["cafe", "restaurant"];
      const afterCategories: LocationCategory[] = evening ? ["nightlife", "restaurant"] : ["cafe", "culture"];

      const pick = (categories: LocationCategory[], count: number, exclude: Set<string>) => {
        const out: { row: LocationRow; distanceKm: number }[] = [];
        for (const category of categories) {
          for (const entry of nearby) {
            if (out.length >= count) break;
            if (exclude.has(entry.row.id)) continue;
            if (classify(entry.row) !== category) continue;
            exclude.add(entry.row.id);
            out.push(entry);
          }
        }
        return out;
      };

      const used = new Set<string>();
      const beforePicks = pick(beforeCategories, 2, used);
      const afterPicks = pick(afterCategories, 2, used);

      const before = beforePicks.map(({ row, distanceKm }) => {
        const stay = STAY_MINUTES[classify(row) ?? "cafe"] ?? 60;
        const arriveMs = startMs - (stay + walkMinutes(distanceKm)) * 60_000;
        return toSuggestion(row, distanceKm, arriveMs, event.timezone);
      });

      const after = afterPicks.map(({ row, distanceKm }) => {
        const arriveMs = endMs + walkMinutes(distanceKm) * 60_000;
        return toSuggestion(row, distanceKm, arriveMs, event.timezone);
      });

      return {
        ...base,
        before,
        after,
        suggestionsUnavailable:
          before.length === 0 && after.length === 0
            ? "In Laufnähe zum Veranstaltungsort haben wir noch keine passenden Orte in unseren Daten."
            : null,
      };
    } catch (err) {
      console.error("[around-event] Laden fehlgeschlagen:", err);
      return null;
    }
  }
);

export type CityEventListItem = {
  id: string;
  title: string;
  category: string;
  startIso: string;
  dateLabel: string;
  timeLabel: string;
  venueName: string | null;
};

export type CityEventQuery = {
  /** Interne Kategorien, auf die gefiltert wird. Leer = alle. */
  categories?: PlannerEventCategory[];
  from: Date;
  to: Date;
  limit?: number;
};

/**
 * Veranstaltungen einer Stadt im gewaehlten Zeitfenster, chronologisch.
 *
 * Serverseitig gefiltert statt im Browser: Die Filter sind Teil der URL und
 * sollen auch fuer Crawler sichtbar wirken — eine Kategorieseite, die ihre
 * Auswahl erst per JavaScript trifft, waere im ausgelieferten HTML leer.
 */
export const listCityEvents = cache(
  async (citySlug: string, query: CityEventQuery): Promise<CityEventListItem[]> => {
    const supabase = supabaseOrNull();
    if (!supabase) return [];

    try {
      let request = supabase
        .from("planner_events")
        .select("id, title, category, start_at, timezone, venue_name")
        .eq("city_slug", citySlug)
        .eq("status", "scheduled")
        .gte("start_at", query.from.toISOString())
        .lte("start_at", query.to.toISOString())
        .order("start_at", { ascending: true })
        .limit(query.limit ?? 80);

      if (query.categories && query.categories.length > 0) {
        request = request.in("category", query.categories);
      }

      const { data, error } = await request;
      if (error) {
        console.error(`[around-event] Liste fuer ${citySlug} fehlgeschlagen:`, error.message);
        return [];
      }

      return ((data ?? []) as Array<{
        id: string;
        title: string;
        category: string;
        start_at: string;
        timezone: string | null;
        venue_name: string | null;
      }>).map((row) => ({
        id: row.id,
        title: row.title,
        category: row.category,
        startIso: row.start_at,
        dateLabel: dateFormatter(row.timezone).format(new Date(row.start_at)),
        timeLabel: timeFormatter(row.timezone).format(new Date(row.start_at)),
        venueName: row.venue_name,
      }));
    } catch (err) {
      console.error("[around-event] Liste fehlgeschlagen:", err);
      return [];
    }
  }
);

/**
 * Wie viele Veranstaltungen je Kategorie im Zeitfenster liegen.
 *
 * Damit zeigen die Filter-Chips echte Zahlen und fuehren nicht auf leere
 * Seiten — ein Filter, hinter dem nichts steht, ist schlimmer als keiner.
 */
export const countCityEventsByCategory = cache(
  async (citySlug: string, from: Date, to: Date): Promise<Record<string, number>> => {
    const supabase = supabaseOrNull();
    if (!supabase) return {};

    try {
      const { data, error } = await supabase
        .from("planner_events")
        .select("category")
        .eq("city_slug", citySlug)
        .eq("status", "scheduled")
        .gte("start_at", from.toISOString())
        .lte("start_at", to.toISOString())
        .limit(1000);

      if (error) return {};

      const counts: Record<string, number> = {};
      for (const row of (data ?? []) as { category: string }[]) {
        counts[row.category] = (counts[row.category] ?? 0) + 1;
      }
      return counts;
    } catch {
      return {};
    }
  }
);
