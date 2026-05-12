"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export type RouteMiniMapStop = {
  label: string;
  name: string;
  lat: number;
  lng: number;
};

function isValidCoordinate(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

function normalizeStops(stops: RouteMiniMapStop[]) {
  return stops.filter((stop) => isValidCoordinate(stop.lat, stop.lng));
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

function FitToStops({ stops }: { stops: RouteMiniMapStop[] }) {
  const map = useMap();

  useEffect(() => {
    if (stops.length === 0) return undefined;

    const frame = window.requestAnimationFrame(() => {
      if (!isMapContainerReady(map)) return;

      try {
        stopMapSafely(map);
        map.invalidateSize({ animate: false, pan: false });

        if (stops.length === 1) {
          map.setView([stops[0].lat, stops[0].lng], 13, { animate: false });
          return;
        }

        const bounds = L.latLngBounds(stops.map((s) => [s.lat, s.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [12, 12], animate: false });
      } catch (error) {
        console.warn("RouteMiniMap autofit skipped:", error);
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
      stopMapSafely(map);
    };
  }, [map, stops]);

  return null;
}

export default function RouteMiniMap({
  stops,
  height = 120,
}: {
  stops: RouteMiniMapStop[];
  height?: number;
}) {
  const safeStops = useMemo(() => normalizeStops(stops), [stops]);

  if (safeStops.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-black/5 bg-gradient-to-br from-stone-50 to-white text-xs text-gray-500"
        style={{ height }}
      >
        Keine Kartenkoordinaten vorhanden
      </div>
    );
  }

  const center =
    safeStops.length === 1
      ? ([safeStops[0].lat, safeStops[0].lng] as [number, number])
      : ([
          safeStops.reduce((sum, s) => sum + s.lat, 0) / safeStops.length,
          safeStops.reduce((sum, s) => sum + s.lng, 0) / safeStops.length,
        ] as [number, number]);

  return (
    <div className="pd24-map-shell relative z-0 isolate overflow-hidden rounded-2xl border border-black/5" style={{ height }}>
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        zoomControl={false}
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
        fadeAnimation={false}
        markerZoomAnimation={false}
        zoomAnimation={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitToStops stops={safeStops} />
        {safeStops.length > 1 ? (
          <Polyline
            positions={safeStops.map((s) => [s.lat, s.lng] as [number, number])}
            pathOptions={{ color: "#111827", weight: 3, opacity: 0.7 }}
          />
        ) : null}
        {safeStops.map((stop, index) => (
          <Marker key={`${stop.label}-${stop.lat}-${stop.lng}-${index}`} position={[stop.lat, stop.lng]} />
        ))}
      </MapContainer>
    </div>
  );
}
