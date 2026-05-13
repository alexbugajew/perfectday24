"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";

const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export type RouteLeg = {
  fromLabel: string;
  toLabel: string;
  distanceKm: number;
  durationMin: number;
};

export type RouteSummary = {
  profile: "foot" | "public_transit" | "car";
  totalDistanceKm: number;
  totalDurationMin: number;
  legs: RouteLeg[];
  polylineLatLng: Array<[number, number]>;
};

export type PlanMapStop = {
  label: string;
  name: string;
  lat: number;
  lng: number;
  markerVariant?: "default" | "start" | "active" | "done" | "skipped";
};

type Props = {
  stops: PlanMapStop[];
  profile?: "foot" | "public_transit" | "car";
  className?: string;
  height?: number;
  onSummary?: (summary: RouteSummary | null) => void;
  showHeader?: boolean;
};

const markerIconCache = new Map<string, L.Icon>();

function markerColors(variant: PlanMapStop["markerVariant"]) {
  if (variant === "done") return { fill: "#10b981", stroke: "#047857" };
  if (variant === "skipped") return { fill: "#e11d48", stroke: "#9f1239" };
  if (variant === "active") return { fill: "#0f172a", stroke: "#020617" };
  if (variant === "start") return { fill: "#334155", stroke: "#0f172a" };
  return { fill: "#3b82f6", stroke: "#1d4ed8" };
}

function getMarkerIcon(variant: PlanMapStop["markerVariant"]) {
  const key = variant ?? "default";
  const cached = markerIconCache.get(key);
  if (cached) return cached;

  const { fill, stroke } = markerColors(variant);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="42" viewBox="0 0 28 42">
      <path d="M14 1.5C7.1 1.5 1.5 7 1.5 13.8c0 9.2 10.4 21.4 11.4 22.6a1.5 1.5 0 0 0 2.2 0c1-1.2 11.4-13.4 11.4-22.6C26.5 7 20.9 1.5 14 1.5Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>
      <circle cx="14" cy="14" r="5.3" fill="white" fill-opacity="0.95"/>
    </svg>
  `.trim();

  const icon = L.icon({
    iconUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    iconSize: [28, 42],
    iconAnchor: [14, 42],
    popupAnchor: [0, -34],
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    shadowSize: [41, 41],
    shadowAnchor: [12, 41],
  });

  markerIconCache.set(key, icon);
  return icon;
}

function round1(x: number) {
  return Math.round(x * 10) / 10;
}

function makeStopsSignature(stops: PlanMapStop[]) {
  return stops
    .map(
      (stop) =>
        `${stop.label}|${stop.name}|${stop.lat.toFixed(5)}|${stop.lng.toFixed(5)}|${stop.markerVariant ?? "default"}`
    )
    .join("::");
}

function isValidCoordinate(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

function normalizeStops(stops: PlanMapStop[]) {
  return stops.filter((stop) => isValidCoordinate(stop.lat, stop.lng));
}

function samePolyline(left: Array<[number, number]>, right: Array<[number, number]>) {
  if (left === right) return true;
  if (left.length !== right.length) return false;

  for (let i = 0; i < left.length; i += 1) {
    const a = left[i];
    const b = right[i];
    if (!a || !b) return false;
    if (a[0] !== b[0] || a[1] !== b[1]) return false;
  }

  return true;
}

type CacheValue = {
  polylineLatLng: Array<[number, number]>;
  legs: Array<{ distance: number; duration: number }>;
};

const osrmCache = new Map<string, CacheValue>();

function makeCacheKey(
  stops: Array<{ lat: number; lng: number }>,
  profile: "foot" | "public_transit" | "car"
) {
  const coords = stops.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
  return `${profile}:${coords}`;
}

async function fetchOsrmRoute(
  stops: Array<{ lat: number; lng: number }>,
  profile: "foot" | "public_transit" | "car",
  signal: AbortSignal
) {
  const key = makeCacheKey(stops, profile);
  const cached = osrmCache.get(key);
  if (cached) return cached;

  const osrmProfile = profile === "foot" ? "walking" : "driving";
  const coords = stops.map((p) => `${p.lng},${p.lat}`).join(";");
  const url =
    `https://router.project-osrm.org/route/v1/${osrmProfile}/${coords}` +
    `?overview=full&geometries=geojson&steps=false&annotations=false`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);

  const json = await res.json();
  const route = json?.routes?.[0];
  if (!route) throw new Error("OSRM: keine Route gefunden");

  const geometry = route.geometry?.coordinates as Array<[number, number]>;
  const legs = (route.legs ?? []) as Array<{ distance: number; duration: number }>;
  const polylineLatLng = geometry.map(([lon, lat]) => [lat, lon] as [number, number]);

  const value: CacheValue = { polylineLatLng, legs };
  osrmCache.set(key, value);

  if (osrmCache.size > 80) {
    const firstKey = osrmCache.keys().next().value;
    if (firstKey) osrmCache.delete(firstKey);
  }

  return value;
}

function isMapContainerReady(map: L.Map) {
  const container = map.getContainer();
  return Boolean(container?.isConnected && container.clientWidth > 0 && container.clientHeight > 0);
}

function stopMapSafely(map: L.Map) {
  try {
    map.stop();
  } catch {
    // Leaflet can throw while React is tearing down the map in dev/StrictMode.
  }
}

function AutoFit({
  points,
  height,
}: {
  points: Array<[number, number]>;
  height: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      if (!isMapContainerReady(map)) return;

      try {
        stopMapSafely(map);
        map.invalidateSize({ animate: false, pan: false });

        if (points.length === 1) {
          map.setView(points[0], 13, { animate: false });
          return;
        }

        const bounds = L.latLngBounds(points.map((point) => L.latLng(point[0], point[1])));
        map.fitBounds(bounds, { padding: [30, 30], animate: false });
      } catch (error) {
        console.warn("PlanMap autofit skipped:", error);
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
      stopMapSafely(map);
    };
  }, [height, map, points]);

  return null;
}

export default function PlanMap({
  stops,
  profile = "foot",
  className,
  height = 360,
  onSummary,
  showHeader = true,
}: Props) {
  const [polyline, setPolyline] = useState<Array<[number, number]>>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSummaryRef = useRef<Props["onSummary"]>(onSummary);
  const lastSummarySignalRef = useRef<string | null>(null);
  const safeStops = useMemo(() => normalizeStops(stops), [stops]);

  useEffect(() => {
    onSummaryRef.current = onSummary;
  }, [onSummary]);

  const stopsSignature = useMemo(() => makeStopsSignature(safeStops), [safeStops]);
  const routeSignal = `${profile}:${stopsSignature}`;

  const center = useMemo<[number, number]>(() => {
    if (!safeStops.length) return [52.52, 13.405];
    const avgLat = safeStops.reduce((sum, stop) => sum + stop.lat, 0) / safeStops.length;
    const avgLng = safeStops.reduce((sum, stop) => sum + stop.lng, 0) / safeStops.length;
    return [avgLat, avgLng];
  }, [safeStops]);

  const zoom = useMemo(() => (safeStops.length <= 1 ? 13 : 12), [safeStops.length]);

  const markerPoints = useMemo(
    () => safeStops.map((stop) => [stop.lat, stop.lng] as [number, number]),
    [safeStops]
  );

  useEffect(() => {
    const ac = new AbortController();
    let alive = true;
    const routeStops = safeStops.map((stop) => ({
      label: stop.label,
      name: stop.name,
      lat: stop.lat,
      lng: stop.lng,
    }));

    async function run() {
      setErr((prev) => (prev === null ? prev : null));

      if (routeStops.length < 2) {
        setPolyline((prev) => (prev.length ? [] : prev));
        setLoading(false);
        if (lastSummarySignalRef.current !== "no-route") {
          lastSummarySignalRef.current = "no-route";
          onSummaryRef.current?.(null);
        }
        return;
      }

      setLoading(true);

      try {
        const { polylineLatLng, legs } = await fetchOsrmRoute(
          routeStops.map((stop) => ({ lat: stop.lat, lng: stop.lng })),
          profile,
          ac.signal
        );

        if (!alive) return;

        setPolyline((prev) => (samePolyline(prev, polylineLatLng) ? prev : polylineLatLng));

        const legSummaries: RouteLeg[] = legs.map((leg, index) => {
          const from = routeStops[index];
          const to = routeStops[index + 1];
          return {
            fromLabel: from?.label ?? `Stop ${index + 1}`,
            toLabel: to?.label ?? `Stop ${index + 2}`,
            distanceKm: round1((leg.distance ?? 0) / 1000),
            durationMin: Math.max(1, Math.round((leg.duration ?? 0) / 60)),
          };
        });

        const totalDistanceKm = round1(
          legSummaries.reduce((sum, leg) => sum + leg.distanceKm, 0)
        );
        const totalDurationMin = legSummaries.reduce((sum, leg) => sum + leg.durationMin, 0);
        const summarySignal = JSON.stringify({
          routeSignal,
          totalDistanceKm,
          totalDurationMin,
          legs: legSummaries,
        });

        if (lastSummarySignalRef.current !== summarySignal) {
          lastSummarySignalRef.current = summarySignal;
          onSummaryRef.current?.({
            profile,
            totalDistanceKm,
            totalDurationMin,
            legs: legSummaries,
            polylineLatLng,
          });
        }
      } catch (error: unknown) {
        if (!alive) return;
        if (error instanceof Error && error.name === "AbortError") return;

        const nextError = error instanceof Error && error.message ? error.message : "Routing fehlgeschlagen.";
        setPolyline((prev) => (prev.length ? [] : prev));
        setErr((prev) => (prev === nextError ? prev : nextError));

        if (lastSummarySignalRef.current !== "route-error") {
          lastSummarySignalRef.current = "route-error";
          onSummaryRef.current?.(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();

    return () => {
      alive = false;
      ac.abort();
    };
  }, [profile, routeSignal, safeStops]);

  return (
    <div className={className}>
      {showHeader ? (
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="font-semibold">Map + Route</div>
          <div className="text-xs text-gray-600">
            {safeStops.length < 2
              ? "Mind. 2 Stops für Route"
              : loading
                ? "Route wird berechnet..."
                : err
                  ? "Route nicht verfuegbar"
                  : "OSRM aktiv"}
          </div>
        </div>
      ) : null}

      <div className="pd24-map-shell relative z-0 isolate overflow-hidden rounded-lg border" style={{ height }}>
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
          fadeAnimation={false}
          markerZoomAnimation={false}
          zoomAnimation={false}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <AutoFit points={markerPoints} height={height} />

          {safeStops.map((stop, index) => (
            <Marker
              key={`${stop.label}_${stop.lat}_${stop.lng}_${stop.markerVariant ?? "default"}_${index}`}
              position={[stop.lat, stop.lng]}
              icon={getMarkerIcon(stop.markerVariant)}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold">{stop.label}</div>
                  <div>{stop.name}</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {polyline.length > 1 ? <Polyline positions={polyline} /> : null}
        </MapContainer>
      </div>

      {err ? (
        <div className="mt-2 text-xs text-red-600">
          {err} (Fallback bleibt: du kannst trotzdem Route öffnen nutzen)
        </div>
      ) : null}
    </div>
  );
}
