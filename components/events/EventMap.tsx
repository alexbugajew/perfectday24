"use client";

// components/events/EventMap.tsx
//
// Leaflet-Karte der Event-Karte: Pins je Veranstaltung, gebündelt nach Ort und
// Zoomstufe, dazu Umkreis und Standort.
// WICHTIG: Nur per dynamic import mit ssr:false verwenden — Leaflet greift beim
// Import auf `window` zu.

import L from "leaflet";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { patchLeafletMapRemove } from "@/components/leafletSafety";
import MonetizedExternalLink from "@/components/monetization/MonetizedExternalLink";
import { distanceKm, eventMapGroup, eventMapPlanDate, type EventMapItem } from "@/lib/events/event-map";
import { buildEventPlannerHref } from "@/lib/events/planner-href";
import { eventMapGlyphSvg } from "./eventMapGlyphs";

patchLeafletMapRemove();

export type EventMapPoint = EventMapItem & { lat: number; lng: number };

export type EventMapOrigin = { lat: number; lng: number; kind: "user" | "center" };

type Props = {
  citySlug: string;
  center: { lat: number; lng: number };
  /** Radius der Stadt in km — Pins weit außerhalb bestimmen nicht den Kartenausschnitt. */
  cityRadiusKm: number;
  items: EventMapPoint[];
  origin: EventMapOrigin;
  radiusKm: number | null;
  /** Ändert sich, wenn die Karte neu ausgerichtet werden soll (Zeitraum, Ursprung, Umkreis). */
  fitKey: string;
  nowMs: number;
};

// ── Bündeln ───────────────────────────────────────────────────────────────────
//
// Eigenes Raster-Clustering statt eines Plugins: Mehr als ein paar hundert
// Pins hat keine Stadt, und die häufigste Ballung ist ohnehin eine einzige
// Spielstätte mit Dutzenden Terminen (Lübeck, Wuppertal: über 50 an einem Ort).
// Die lässt sich durch Hineinzoomen nie auflösen — sie bekommt eine Liste.

const CELL_PX = 56;
/** Ab dieser Zoomstufe werden nur noch Termine am selben Ort gebündelt. */
const CLUSTER_UNTIL_ZOOM = 16;
const INITIAL_ZOOM = 12;

type Venue = { key: string; lat: number; lng: number; items: EventMapPoint[] };
type Cluster = { key: string; lat: number; lng: number; venues: Venue[]; count: number };

function groupByVenue(items: EventMapPoint[]): Venue[] {
  const venues = new Map<string, Venue>();
  for (const item of items) {
    const key = `${item.lat.toFixed(5)},${item.lng.toFixed(5)}`;
    let venue = venues.get(key);
    if (!venue) {
      venue = { key, lat: item.lat, lng: item.lng, items: [] };
      venues.set(key, venue);
    }
    venue.items.push(item);
  }
  return [...venues.values()];
}

function clusterVenues(venues: Venue[], zoom: number): Cluster[] {
  const single = (venue: Venue): Cluster => ({
    key: venue.key,
    lat: venue.lat,
    lng: venue.lng,
    venues: [venue],
    count: venue.items.length,
  });
  if (zoom >= CLUSTER_UNTIL_ZOOM) return venues.map(single);

  const cells = new Map<string, Venue[]>();
  for (const venue of venues) {
    // Pixelraster der aktuellen Zoomstufe — unabhängig vom Ausschnitt, deshalb
    // muss beim Verschieben nichts neu berechnet werden.
    const point = L.CRS.EPSG3857.latLngToPoint(L.latLng(venue.lat, venue.lng), zoom);
    const cell = `${Math.floor(point.x / CELL_PX)}:${Math.floor(point.y / CELL_PX)}`;
    const members = cells.get(cell);
    if (members) members.push(venue);
    else cells.set(cell, [venue]);
  }

  return [...cells.entries()].map(([cell, members]) => {
    if (members.length === 1) return single(members[0]);
    return {
      key: `${zoom}:${cell}`,
      lat: members.reduce((sum, venue) => sum + venue.lat, 0) / members.length,
      lng: members.reduce((sum, venue) => sum + venue.lng, 0) / members.length,
      venues: members,
      count: members.reduce((sum, venue) => sum + venue.items.length, 0),
    };
  });
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const iconCache = new Map<string, L.DivIcon>();

function cachedIcon(key: string, build: () => L.DivIcon): L.DivIcon {
  const cached = iconCache.get(key);
  if (cached) return cached;
  const icon = build();
  iconCache.set(key, icon);
  return icon;
}

/** Pin einer Veranstaltung; mit Zähler, wenn mehrere Termine am selben Ort liegen. */
function venueIcon(item: EventMapPoint, count: number): L.DivIcon {
  const label = count > 99 ? "99+" : String(count);
  return cachedIcon(`venue:${item.group}:${label}`, () => {
    const { color } = eventMapGroup(item.group);
    const badge =
      count > 1
        ? `<span style="position:absolute;top:-8px;right:-10px;min-width:20px;height:20px;padding:0 5px;` +
          `border-radius:10px;background:var(--text-strong);color:#fff;border:2px solid #fff;box-sizing:border-box;` +
          `font-size:11px;font-weight:600;line-height:16px;text-align:center">${label}</span>`
        : "";
    const html =
      `<span style="position:relative;display:flex;align-items:center;justify-content:center;width:32px;height:32px;` +
      `border-radius:9999px;background:${color};color:#fff;border:2px solid #fff;box-sizing:border-box;` +
      `box-shadow:0 2px 8px rgba(15,23,42,0.35)">${eventMapGlyphSvg(item.group, 16)}${badge}</span>`;
    return L.divIcon({ className: "pd24-event-pin", html, iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16] });
  });
}

function clusterIcon(count: number): L.DivIcon {
  const size = count < 10 ? 36 : count < 50 ? 42 : 48;
  return cachedIcon(`cluster:${size}:${count}`, () =>
    L.divIcon({
      className: "pd24-event-cluster",
      html:
        `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;` +
        `border-radius:9999px;background:var(--text-strong);color:#fff;border:3px solid rgba(255,255,255,0.9);` +
        `box-sizing:border-box;box-shadow:0 2px 10px rgba(15,23,42,0.35);font-size:13px;font-weight:600">${count}</span>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    })
  );
}

function originIcon(kind: EventMapOrigin["kind"]): L.DivIcon {
  return cachedIcon(`origin:${kind}`, () =>
    L.divIcon({
      className: "pd24-event-origin",
      html:
        kind === "user"
          ? `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:var(--state-info);` +
            `border:3px solid #fff;box-sizing:border-box;box-shadow:0 0 0 6px rgba(77,109,134,0.25)"></span>`
          : `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#fff;` +
            `border:3px solid var(--text-strong);box-sizing:border-box"></span>`,
      iconSize: kind === "user" ? [18, 18] : [14, 14],
      iconAnchor: kind === "user" ? [9, 9] : [7, 7],
    })
  );
}

// ── Kartensteuerung ───────────────────────────────────────────────────────────

function ZoomTracker({ onZoom }: { onZoom: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
  });
  return null;
}

/**
 * Richtet die Karte aus — aber nur, wenn sich Zeitraum, Ursprung oder Umkreis
 * ändern. Beim Ein- und Ausschalten einer Kategorie bleibt der Ausschnitt, wo er
 * ist: Sonst springt die Karte bei jedem Antippen eines Chips.
 */
function FitController({
  fitKey,
  items,
  origin,
  radiusKm,
  center,
  cityRadiusKm,
}: {
  fitKey: string;
  items: EventMapPoint[];
  origin: EventMapOrigin;
  radiusKm: number | null;
  center: { lat: number; lng: number };
  cityRadiusKm: number;
}) {
  const map = useMap();
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const container = map.getContainer();
      if (!container?.isConnected || container.clientWidth === 0) return;
      try {
        map.invalidateSize({ animate: false, pan: false });
        if (radiusKm != null) {
          map.fitBounds(L.latLng(origin.lat, origin.lng).toBounds(radiusKm * 2000), {
            padding: [12, 12],
            animate: false,
          });
          return;
        }
        // Einzelne Ausreißer (falsch geokodierte Orte weit außerhalb) sollen
        // die Karte nicht auf halb Deutschland aufziehen.
        const nearby = itemsRef.current.filter(
          (item) => distanceKm({ lat: center.lat, lng: center.lng }, item) <= cityRadiusKm * 1.5
        );
        if (nearby.length === 0) {
          map.setView([origin.lat, origin.lng], INITIAL_ZOOM, { animate: false });
        } else if (nearby.length === 1) {
          map.setView([nearby[0].lat, nearby[0].lng], 15, { animate: false });
        } else {
          map.fitBounds(L.latLngBounds(nearby.map((item) => L.latLng(item.lat, item.lng))), {
            padding: [32, 32],
            maxZoom: 15,
            animate: false,
          });
        }
      } catch (error) {
        console.warn("EventMap: Ausrichten übersprungen:", error);
      }
    });
    return () => window.cancelAnimationFrame(frame);
    // fitKey bündelt Zeitraum, Ursprung und Umkreis; die Pins selbst lösen bewusst nichts aus.
  }, [fitKey, map, origin.lat, origin.lng, radiusKm, center.lat, center.lng, cityRadiusKm]);

  return null;
}

// ── Popups ────────────────────────────────────────────────────────────────────

// Leaflet färbt jeden Link im Popup über `.leaflet-container a` blau — und
// diese Regel schlägt Tailwind-Utilities. Die Linkfarben stehen deshalb inline.
const LINK_STYLE = { color: "var(--text-strong)" } as const;

function EventCard({ item, citySlug, nowMs }: { item: EventMapPoint; citySlug: string; nowMs: number }) {
  const group = eventMapGroup(item.group);
  const plannerHref = buildEventPlannerHref({
    citySlug,
    eventId: item.id,
    planDate: eventMapPlanDate(item, nowMs),
    lat: item.lat,
    lng: item.lng,
    venueName: item.venueName,
    title: item.title,
  });

  return (
    <div className="w-[216px] sm:w-[240px]">
      <div
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: group.color }}
      >
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: group.color }} />
        {item.categoryLabel}
      </div>
      <div className="mt-1 line-clamp-3 text-[15px] font-semibold leading-snug text-[var(--text-strong)]">
        {item.title}
      </div>
      <div className="mt-1.5 text-[13px] leading-5 text-[var(--text-muted)]">{item.whenLabel}</div>
      {item.venueName || item.venueAddress ? (
        <div className="text-[13px] leading-5 text-[var(--text-muted)]">
          {[item.venueName, item.venueAddress].filter(Boolean).join(" · ")}
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-2">
        <Link href={plannerHref} className="pd24-btn pd24-btn-sm pd24-btn-primary w-full" style={{ color: "#fff" }}>
          In Planner übernehmen
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-medium">
          <Link href={`/events/${citySlug}/${item.id}`} className="underline underline-offset-2" style={LINK_STYLE}>
            Details
          </Link>
          {item.ticketUrl && item.ticketLabel ? (
            <MonetizedExternalLink
              href={item.ticketUrl}
              target="_blank"
              rel={item.ticketSponsored ? "noopener noreferrer nofollow sponsored" : "noopener noreferrer nofollow"}
              plannerEventId={item.id}
              citySlug={citySlug}
              surface="event_map_popup"
              label={item.title}
              source={item.ticketSponsored ? "event_map_affiliate_ticket" : "event_map_ticket"}
              className="underline underline-offset-2"
              style={LINK_STYLE}
            >
              {item.ticketLabel}
            </MonetizedExternalLink>
          ) : null}
          {item.sourceUrl ? (
            <MonetizedExternalLink
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              plannerEventId={item.id}
              citySlug={citySlug}
              surface="event_map_popup"
              label={item.title}
              source="event_map_source"
              className="underline underline-offset-2"
              style={{ color: "var(--text-muted)" }}
            >
              Quelle
            </MonetizedExternalLink>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function VenueList({
  venue,
  citySlug,
  nowMs,
  onLayoutChange,
}: {
  venue: Venue;
  citySlug: string;
  nowMs: number;
  onLayoutChange: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = venue.items.find((item) => item.id === selectedId) ?? null;
  const venueName = venue.items.find((item) => item.venueName)?.venueName ?? "An diesem Ort";

  // Leaflet misst die Popup-Größe nur beim Öffnen; nach dem Wechsel zwischen
  // Liste und Karte muss es neu messen, sonst ragt der Inhalt heraus.
  useEffect(() => {
    onLayoutChange();
  }, [selectedId, onLayoutChange]);

  if (selected) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="mb-2 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-strong)]"
        >
          ← Alle {venue.items.length} an diesem Ort
        </button>
        <EventCard item={selected} citySlug={citySlug} nowMs={nowMs} />
      </div>
    );
  }

  return (
    <div className="w-[216px] sm:w-[240px]">
      <div className="text-[15px] font-semibold leading-snug text-[var(--text-strong)]">{venueName}</div>
      <div className="text-[12px] text-[var(--text-muted)]">{venue.items.length} Veranstaltungen an diesem Ort</div>
      <ul className="-mx-1 mt-2 max-h-60 overflow-y-auto">
        {venue.items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setSelectedId(item.id)}
              className="w-full rounded-lg px-1 py-1.5 text-left transition hover:bg-[var(--bg-panel)]"
            >
              <span className="block text-[12px] text-[var(--text-muted)]">{item.whenLabel}</span>
              <span className="line-clamp-2 block text-[13px] font-medium leading-snug text-[var(--text-strong)]">
                {item.title}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VenueMarker({ venue, citySlug, nowMs }: { venue: Venue; citySlug: string; nowMs: number }) {
  const popupRef = useRef<L.Popup | null>(null);
  const first = venue.items[0];
  const relayout = useCallback(() => {
    popupRef.current?.update();
  }, []);

  return (
    <Marker
      position={[venue.lat, venue.lng]}
      icon={venueIcon(first, venue.items.length)}
      title={venue.items.length > 1 ? `${venue.items.length} Veranstaltungen: ${first.venueName ?? first.title}` : first.title}
    >
      <Popup ref={popupRef} maxWidth={280} minWidth={216} autoPanPadding={[16, 16]}>
        {venue.items.length > 1 ? (
          <VenueList venue={venue} citySlug={citySlug} nowMs={nowMs} onLayoutChange={relayout} />
        ) : (
          <EventCard item={first} citySlug={citySlug} nowMs={nowMs} />
        )}
      </Popup>
    </Marker>
  );
}

function ClusterMarker({ cluster }: { cluster: Cluster }) {
  const map = useMap();
  return (
    <Marker
      position={[cluster.lat, cluster.lng]}
      icon={clusterIcon(cluster.count)}
      title={`${cluster.count} Veranstaltungen – zum Vergrößern antippen`}
      eventHandlers={{
        click: () => {
          const bounds = L.latLngBounds(cluster.venues.map((venue) => L.latLng(venue.lat, venue.lng)));
          const target = Math.min(map.getBoundsZoom(bounds.pad(0.2)), CLUSTER_UNTIL_ZOOM);
          if (target <= map.getZoom()) {
            map.setView(bounds.getCenter(), Math.min(map.getZoom() + 2, CLUSTER_UNTIL_ZOOM));
          } else {
            map.fitBounds(bounds, { padding: [48, 48], maxZoom: CLUSTER_UNTIL_ZOOM });
          }
        },
      }}
    />
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function EventMap({ citySlug, center, cityRadiusKm, items, origin, radiusKm, fitKey, nowMs }: Props) {
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const venues = useMemo(() => groupByVenue(items), [items]);
  const clusters = useMemo(() => clusterVenues(venues, zoom), [venues, zoom]);
  const showOrigin = origin.kind === "user" || radiusKm != null;

  return (
    <div className="pd24-map-shell h-full w-full">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={INITIAL_ZOOM}
        scrollWheelZoom={false}
        className="h-full w-full"
        style={{ fontFamily: "inherit" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />
        <ZoomTracker onZoom={setZoom} />
        <FitController
          fitKey={fitKey}
          items={items}
          origin={origin}
          radiusKm={radiusKm}
          center={center}
          cityRadiusKm={cityRadiusKm}
        />

        {radiusKm != null ? (
          <Circle
            center={[origin.lat, origin.lng]}
            radius={radiusKm * 1000}
            // SVG-Attribute verstehen keine CSS-Variablen: --brand-accent als Hexwert.
            pathOptions={{ color: "#4d6678", weight: 1.5, opacity: 0.7, fillColor: "#4d6678", fillOpacity: 0.06, dashArray: "4 6" }}
            interactive={false}
          />
        ) : null}

        {showOrigin ? (
          <Marker
            position={[origin.lat, origin.lng]}
            icon={originIcon(origin.kind)}
            title={origin.kind === "user" ? "Dein Standort" : "Stadtmitte"}
            interactive={false}
            keyboard={false}
          />
        ) : null}

        {clusters.map((cluster) =>
          cluster.venues.length === 1 ? (
            <VenueMarker key={cluster.key} venue={cluster.venues[0]} citySlug={citySlug} nowMs={nowMs} />
          ) : (
            <ClusterMarker key={cluster.key} cluster={cluster} />
          )
        )}
      </MapContainer>
    </div>
  );
}
