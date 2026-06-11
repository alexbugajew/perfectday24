"use client";

// components/roadtrip/DiscoverMap.tsx
// Leaflet-Karte für den "Route entdecken"-Feature.
// Zeigt Start, Ziel, KI-Zwischenstopps und verbindende Linie.
// WICHTIG: Nur per dynamic import mit ssr:false verwenden.

import L from "leaflet";
import { useEffect, useRef } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { patchLeafletMapRemove } from "@/components/leafletSafety";
import type { SuggestedStop } from "@/lib/roadtrip/suggest-types";

patchLeafletMapRemove();

// ── Icon-Helpers ──────────────────────────────────────────────────────────────

const iconCache = new Map<string, L.Icon>();

function makeIcon(svgContent: string, size: [number, number], anchor: [number, number]): L.Icon {
  const key = svgContent + size.join("x");
  const cached = iconCache.get(key);
  if (cached) return cached;

  const icon = L.icon({
    iconUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgContent)}`,
    iconSize: size,
    iconAnchor: anchor,
    popupAnchor: [0, -anchor[1]],
  });
  iconCache.set(key, icon);
  return icon;
}

function startIcon(): L.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
    <circle cx="18" cy="18" r="16" fill="#10b981" stroke="white" stroke-width="3"/>
    <text x="18" y="23" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="white">A</text>
  </svg>`;
  return makeIcon(svg, [36, 36], [18, 18]);
}

function endIcon(): L.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
    <circle cx="18" cy="18" r="16" fill="#ef4444" stroke="white" stroke-width="3"/>
    <text x="18" y="23" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="white">B</text>
  </svg>`;
  return makeIcon(svg, [36, 36], [18, 18]);
}

function stopIcon(number: number, selected: boolean, active: boolean): L.Icon {
  const fill = active ? "#f59e0b" : selected ? "#10b981" : "#f59e0b";
  const stroke = active ? "#b45309" : selected ? "#047857" : "#b45309";
  const opacity = selected ? "1" : "0.9";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="14" fill="${fill}" stroke="${stroke}" stroke-width="2.5" opacity="${opacity}"/>
    <text x="16" y="21" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="white">${number}</text>
  </svg>`;
  return makeIcon(svg, [32, 32], [16, 16]);
}

// ── Karte auto-fit ────────────────────────────────────────────────────────────

type FitBoundsProps = {
  points: Array<[number, number]>;
};

function FitBounds({ points }: FitBoundsProps) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (points.length === 0) return;
    if (fitted.current) return;
    fitted.current = true;

    const bounds = L.latLngBounds(points.map(([lat, lng]) => L.latLng(lat, lng)));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);

  return null;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export type DiscoverMapProps = {
  fromLabel: string;
  fromLat: number;
  fromLng: number;
  toLabel: string;
  toLat: number;
  toLng: number;
  stops: SuggestedStop[];
  selectedIds: Set<string>;
  activeStopId: string | null;
  onStopClick?: (id: string) => void;
  className?: string;
};

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function DiscoverMap({
  fromLabel,
  fromLat,
  fromLng,
  toLabel,
  toLat,
  toLng,
  stops,
  selectedIds,
  activeStopId,
  onStopClick,
  className = "h-full w-full",
}: DiscoverMapProps) {
  // Alle Koordinaten für fitBounds
  const allPoints: Array<[number, number]> = [
    [fromLat, fromLng],
    ...stops.map((s) => [s.lat, s.lng] as [number, number]),
    [toLat, toLng],
  ];

  // Polylinie: Start → Stopps in Reihenfolge → Ziel
  const polylinePoints: Array<[number, number]> = allPoints;

  return (
    <MapContainer
      center={[fromLat, fromLng]}
      zoom={7}
      className={className}
      zoomControl
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />

      <FitBounds points={allPoints} />

      {/* Verbindungslinie */}
      <Polyline
        positions={polylinePoints}
        pathOptions={{
          color: "#f59e0b",
          weight: 3,
          opacity: 0.7,
          dashArray: "8 6",
        }}
      />

      {/* Start-Marker */}
      <Marker position={[fromLat, fromLng]} icon={startIcon()}>
        <Popup>
          <div className="text-sm font-semibold">🚀 Start: {fromLabel}</div>
        </Popup>
      </Marker>

      {/* Ziel-Marker */}
      <Marker position={[toLat, toLng]} icon={endIcon()}>
        <Popup>
          <div className="text-sm font-semibold">🏁 Ziel: {toLabel}</div>
        </Popup>
      </Marker>

      {/* Zwischenstopp-Marker */}
      {stops.map((stop, idx) => (
        <Marker
          key={stop.id}
          position={[stop.lat, stop.lng]}
          icon={stopIcon(idx + 1, selectedIds.has(stop.id), stop.id === activeStopId)}
          eventHandlers={{
            click: () => onStopClick?.(stop.id),
          }}
        >
          <Popup>
            <div style={{ minWidth: 160 }}>
              <div className="font-semibold text-sm">{stop.emoji} {stop.name}</div>
              <div className="text-xs text-gray-500 mt-1">{stop.why_visit}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
