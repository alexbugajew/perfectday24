// lib/seo/json-ld.ts
//
// Bausteine für strukturierte Daten nach schema.org.
//
// Zweck: Suchmaschinen und die Crawler der KI-Antwortmaschinen sollen die
// Fakten einer Route nicht aus dem Fließtext raten müssen — Reihenfolge der
// Stopps, Koordinaten, Stadt, Urheber und Änderungsdatum stehen hier
// maschinenlesbar.
//
// Zwei Regeln, die nie gebrochen werden dürfen:
//
//  1. Nur auszeichnen, was auf der Seite auch steht. Strukturierte Daten, die
//     über den sichtbaren Inhalt hinausgehen, gelten als Spam und können die
//     Seite aus den Ergebnissen werfen.
//  2. Keine erfundenen Felder. Lieber weglassen als raten — deshalb entfernt
//     compact() alles Leere, und Bewertungen erscheinen nur, wenn es
//     tatsächlich Bewertungen gibt.

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.perfectday24.de";

export type JsonLdObject = Record<string, unknown>;

/**
 * Entfernt rekursiv null, undefined, leere Strings, leere Arrays und leere
 * Objekte. Ohne das landen Felder wie "description": null in der Ausgabe und
 * werden von Validatoren als Fehler gewertet.
 */
export function compact<T>(value: T): T | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value.trim() === "" ? undefined : (value as T);
  if (Array.isArray(value)) {
    const items = value.map((item) => compact(item)).filter((item) => item !== undefined);
    return items.length > 0 ? (items as unknown as T) : undefined;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = compact(raw);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    // Ein Objekt, das nur noch aus @type/@context besteht, trägt keinen Inhalt.
    const meaningful = Object.keys(out).filter((key) => key !== "@type" && key !== "@context");
    return meaningful.length > 0 ? (out as T) : undefined;
  }
  return value;
}

function absoluteUrl(path: string): string {
  return path.startsWith("http") ? path : `${SITE_URL}${path}`;
}

// ─── Sitewide ────────────────────────────────────────────────────────────────

export function organizationJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "PerfectDay24",
    url: SITE_URL,
    description:
      "PerfectDay24 plant komplette Tage in deutschen Städten — mit echten Orten, aktuellen Events und den Wegen dazwischen.",
    areaServed: { "@type": "Country", name: "Deutschland" },
  };
}

export function webSiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: "PerfectDay24",
    url: SITE_URL,
    inLanguage: "de-DE",
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

// ─── Breadcrumb ──────────────────────────────────────────────────────────────

export type BreadcrumbStep = { name: string; path: string };

export function breadcrumbJsonLd(trail: BreadcrumbStep[]): JsonLdObject | undefined {
  if (trail.length === 0) return undefined;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: step.name,
      item: absoluteUrl(step.path),
    })),
  };
}

// ─── Route (TouristTrip) ─────────────────────────────────────────────────────

/**
 * Anlass → Zielgruppe. Bewusst grob gehalten: touristType ist ein freier Text,
 * und eine falsche Behauptung ist schlechter als gar keine.
 */
const TOURIST_TYPE_BY_OCCASION: Record<string, string> = {
  date: "Paare",
  family: "Familien",
  friends: "Freundesgruppen",
  tourism: "Städtereisende",
  party: "Nachtleben",
};

export type JsonLdRoute = {
  title: string;
  slug: string | null;
  description: string | null;
  cover_image_url: string | null;
  avg_rating: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
  meta?: unknown;
  tags?: unknown;
};

export type JsonLdStop = {
  title: string | null;
  note: string | null;
  lat: number | null;
  lng: number | null;
  photo_url: string | null;
  external_url: string | null;
  duration_min: number | null;
};

export type JsonLdCreator = {
  display_name: string | null;
  username: string | null;
};

function occasionOf(meta: unknown, tags: unknown): string | null {
  if (meta && typeof meta === "object") {
    const value = (meta as Record<string, unknown>).occasion;
    if (typeof value === "string" && value in TOURIST_TYPE_BY_OCCASION) return value;
  }
  // Die Redaktionsrouten tragen den Anlass nicht in meta.occasion, sondern als
  // Tag ("date", "family", ...) — und genau dieser Tag steht auch sichtbar als
  // Chip auf der Seite.
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      if (typeof tag === "string" && tag in TOURIST_TYPE_BY_OCCASION) return tag;
    }
  }
  return null;
}

/**
 * Koordinaten, die innerhalb einer Route mehrfach vorkommen, sind nicht
 * stopp-genau: Beim Import ist dort offenkundig ein Viertel-Mittelpunkt statt
 * der echten Adresse gelandet. Drei verschiedene Lokale auf denselben
 * Koordinaten wären gegenüber einer Maschine eine falsche Tatsachenbehauptung,
 * deshalb entfällt `geo` für solche Stopps. Sichtbar auf der Seite bleibt der
 * Kartenpunkt — das ist eine Frage der Datenqualität, nicht der Auszeichnung.
 */
function stopSpecificCoordinates(stops: JsonLdStop[]): Set<string> {
  const seen = new Map<string, number>();
  for (const stop of stops) {
    if (typeof stop.lat !== "number" || typeof stop.lng !== "number") continue;
    const key = `${stop.lat},${stop.lng}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return new Set(Array.from(seen.entries()).filter(([, count]) => count === 1).map(([key]) => key));
}

/**
 * Minuten in eine ISO-8601-Dauer ("PT90M"). schema.org akzeptiert nichts
 * anderes — eine blanke Zahl wäre ungültig.
 */
function isoDuration(minutes: number): string | undefined {
  if (!minutes || minutes <= 0) return undefined;
  return `PT${Math.round(minutes)}M`;
}

export function routeJsonLd(input: {
  route: JsonLdRoute;
  stops: JsonLdStop[];
  creator: JsonLdCreator | null;
  cityLabel: string | null;
}): JsonLdObject | undefined {
  const { route, stops, creator, cityLabel } = input;
  if (!route.slug) return undefined;

  const routeUrl = `${SITE_URL}/routes/${route.slug}`;
  const occasion = occasionOf(route.meta, route.tags);
  const trustworthyGeo = stopSpecificCoordinates(stops);

  const itineraryItems = stops
    .filter((stop) => Boolean(stop.title))
    .map((stop, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: compact({
        // Bewusst der allgemeine Typ Place: Ob ein Stopp eine Bar, ein Museum
        // oder ein Park ist, steht nicht verlässlich in den Daten, und ein
        // falscher Untertyp ist schlechter als der richtige Oberbegriff.
        "@type": "Place",
        name: stop.title,
        description: stop.note,
        image: stop.photo_url,
        url: stop.external_url,
        // Ohne Straßenangabe in der Datenbank bleibt es bei Ort und Land.
        address: cityLabel
          ? { "@type": "PostalAddress", addressLocality: cityLabel, addressCountry: "DE" }
          : undefined,
        geo:
          typeof stop.lat === "number" &&
          typeof stop.lng === "number" &&
          trustworthyGeo.has(`${stop.lat},${stop.lng}`)
            ? { "@type": "GeoCoordinates", latitude: stop.lat, longitude: stop.lng }
            : undefined,
      }),
    }))
    .filter((entry) => entry.item !== undefined);

  const totalMinutes = stops.reduce((sum, stop) => sum + (stop.duration_min ?? 0), 0);

  return compact({
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    "@id": `${routeUrl}#trip`,
    name: route.title,
    description: route.description,
    url: routeUrl,
    image: route.cover_image_url,
    inLanguage: "de-DE",
    touristType: occasion ? TOURIST_TYPE_BY_OCCASION[occasion] : undefined,
    estimatedDuration: isoDuration(totalMinutes),
    datePublished: route.created_at,
    dateModified: route.updated_at,
    provider: { "@id": `${SITE_URL}/#organization` },
    author: creator?.display_name
      ? compact({
          "@type": "Organization",
          name: creator.display_name,
          url: creator.username ? `${SITE_URL}/creator/${creator.username}` : undefined,
        })
      : undefined,
    itinerary:
      itineraryItems.length > 0
        ? {
            "@type": "ItemList",
            numberOfItems: itineraryItems.length,
            itemListElement: itineraryItems,
          }
        : undefined,
    // Nur echte Bewertungen auszeichnen. Eine aggregateRating ohne zugrunde
    // liegende Bewertungen ist ein Richtlinienverstoß, kein Kavaliersdelikt.
    aggregateRating:
      route.rating_count > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: Number(route.avg_rating.toFixed(2)),
            ratingCount: route.rating_count,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
  });
}

// ─── Veranstaltung ───────────────────────────────────────────────────────────

export type JsonLdEvent = {
  title: string;
  summary: string | null;
  start_at: string;
  end_at: string | null;
  venue_name: string | null;
  venue_address: string | null;
  lat: number | null;
  lng: number | null;
  ticket_url: string | null;
  source_url: string | null;
  price_min: number | null;
  price_max: number | null;
  currency: string | null;
};

/**
 * schema.org/Event fuer die Detailseite einer Veranstaltung.
 *
 * Die Seite selbst bleibt auf `noindex` — Veranstaltungen verfallen, und
 * tausende tote Seiten im Index waeren der falsche Tausch. Die Auszeichnung ist
 * trotzdem sinnvoll: Antwortmaschinen crawlen zum Zeitpunkt der Frage live und
 * bekommen so saubere Fakten statt Fliesstext.
 *
 * `endDate` erscheint nur, wenn die Quelle eines liefert. Bei rund 10.700
 * geplanten Events fehlt es — eine geschaetzte Endzeit auszuzeichnen waere eine
 * Behauptung, die die Daten nicht decken.
 */
export function eventJsonLd(input: {
  event: JsonLdEvent;
  url: string;
  cityLabel: string | null;
}): JsonLdObject | undefined {
  const { event, url, cityLabel } = input;

  return compact({
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.summary,
    startDate: event.start_at,
    endDate: event.end_at,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url,
    inLanguage: "de-DE",
    location: compact({
      "@type": "Place",
      name: event.venue_name,
      address: compact({
        "@type": "PostalAddress",
        streetAddress: event.venue_address,
        addressLocality: cityLabel,
        addressCountry: "DE",
      }),
      geo:
        typeof event.lat === "number" && typeof event.lng === "number"
          ? { "@type": "GeoCoordinates", latitude: event.lat, longitude: event.lng }
          : undefined,
    }),
    offers:
      typeof event.price_min === "number"
        ? compact({
            "@type": "Offer",
            price: event.price_min,
            priceCurrency: event.currency ?? "EUR",
            url: event.ticket_url ?? event.source_url,
            availability: "https://schema.org/InStock",
          })
        : undefined,
  });
}

/**
 * Liste von Veranstaltungen als ItemList — fuer Stadt- und Kategorieseiten.
 *
 * Ausgezeichnet wird genau das, was auf der Seite steht: Name, Beginn, Ort und
 * die eigene URL je Eintrag. Mehr nicht — strukturierte Daten, die ueber den
 * sichtbaren Inhalt hinausgehen, gelten als Spam.
 */
export function eventListJsonLd(input: {
  name: string;
  pagePath: string;
  events: Array<{
    id: string;
    title: string;
    startIso: string;
    venueName: string | null;
    citySlug: string;
  }>;
  cityLabel: string;
}): JsonLdObject | undefined {
  const items = input.events.slice(0, 40).map((event, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: compact({
      "@type": "Event",
      name: event.title,
      startDate: event.startIso,
      url: `${SITE_URL}/events/${event.citySlug}/${event.id}`,
      location: compact({
        "@type": "Place",
        name: event.venueName,
        address: {
          "@type": "PostalAddress",
          addressLocality: input.cityLabel,
          addressCountry: "DE",
        },
      }),
    }),
  }));

  if (items.length === 0) return undefined;

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${SITE_URL}${input.pagePath}#events`,
    name: input.name,
    numberOfItems: items.length,
    itemListElement: items,
  };
}

// ─── Routenlisten (ItemList) ─────────────────────────────────────────────────

export function routeListJsonLd(input: {
  /** Sprechender Name der Liste, z. B. "Tagesrouten in Berlin". */
  name: string;
  /** Pfad der Seite, auf der die Liste steht — dient als stabile @id. */
  pagePath: string;
  routes: { slug: string | null; title: string | null }[];
}): JsonLdObject | undefined {
  const items = input.routes
    .filter((route) => route.slug && route.title)
    .slice(0, 30)
    .map((route, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: route.title,
      url: `${SITE_URL}/routes/${route.slug}`,
    }));

  if (items.length === 0) return undefined;

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${absoluteUrl(input.pagePath)}#routes`,
    name: input.name,
    numberOfItems: items.length,
    itemListElement: items,
  };
}
