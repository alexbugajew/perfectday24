"use client";

import { useEffect } from "react";
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

function FitToStops({ stops }: { stops: RouteMiniMapStop[] }) {
  const map = useMap();

  useEffect(() => {
    if (stops.length === 0) return;
    if (stops.length === 1) {
      map.setView([stops[0].lat, stops[0].lng], 13);
      return;
    }

    const bounds = L.latLngBounds(stops.map((s) => [s.lat, s.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [12, 12] });
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
  if (stops.length === 0) {
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
    stops.length === 1
      ? ([stops[0].lat, stops[0].lng] as [number, number])
      : ([stops.reduce((sum, s) => sum + s.lat, 0) / stops.length, stops.reduce((sum, s) => sum + s.lng, 0) / stops.length] as [
          number,
          number,
        ]);

  return (
    <div className="overflow-hidden rounded-2xl border border-black/5" style={{ height }}>
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
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitToStops stops={stops} />
        {stops.length > 1 ? (
          <Polyline
            positions={stops.map((s) => [s.lat, s.lng] as [number, number])}
            pathOptions={{ color: "#111827", weight: 3, opacity: 0.7 }}
          />
        ) : null}
        {stops.map((stop, index) => (
          <Marker key={`${stop.label}-${stop.lat}-${stop.lng}-${index}`} position={[stop.lat, stop.lng]} />
        ))}
      </MapContainer>
    </div>
  );
}
