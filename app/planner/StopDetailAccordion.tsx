"use client";

import { useState } from "react";
import type { PlannedStop } from "@/lib/planner";
import Image from "next/image";
import { formatOpeningHoursDe } from "@/lib/planner/opening-hours";

type StopDetailAccordionProps = {
  stop: PlannedStop;
};

type BusinessData = {
  photos?: Array<{
    url: string;
    attribution?: string;
  }>;
  menu?: Array<{
    name: string;
    price?: number;
    description?: string;
  }>;
  openingHours?: Record<string, string>;
  avgPrice?: number;
  website?: string;
  googleMapsUrl?: string;
};

export default function StopDetailAccordion({ stop }: StopDetailAccordionProps) {
  const [activeTab, setActiveTab] = useState<"photos" | "menu" | "info">(
    stop.photos && stop.photos.length > 0 ? "photos" : "info"
  );
  // Fotos, Menü und Preise füllt später eine externe Anreicherung (Google
  // Places ist im Backlog neu zu planen); bis dahin zeigt der Aufklapper,
  // was die eigene DB hergibt.
  const businessData: BusinessData = {
    photos: stop.photos ?? [],
    menu: stop.menu ?? [],
    openingHours: stop.openingHours,
    avgPrice: stop.avgPrice,
    website: stop.website,
  };

  const hasPhotos = businessData.photos && businessData.photos.length > 0;
  const hasMenu = businessData.menu && businessData.menu.length > 0;
  const hasStructuredHours = Boolean(businessData.openingHours && Object.keys(businessData.openingHours).length > 0);
  const dbOpeningHours =
    typeof stop.item?.opening_hours_raw === "string" && stop.item.opening_hours_raw.trim().length > 0
      ? stop.item.opening_hours_raw.trim()
      : null;
  const hasInfo =
    Boolean(businessData.avgPrice) ||
    hasStructuredHours ||
    Boolean(dbOpeningHours) ||
    Boolean(businessData.website) ||
    Boolean(stop.googleMapsUrl);

  return (
    <div className="mt-4 pt-4 border-t border-[var(--line-subtle)] space-y-3">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-[var(--line-subtle)]">
        {hasPhotos && (
          <button
            onClick={() => setActiveTab("photos")}
            className={`py-2 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "photos"
                ? "border-[var(--text-strong)] text-[var(--text-strong)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            }`}
          >
            📸 Fotos ({businessData.photos?.length || 0})
          </button>
        )}

        {hasMenu && (
          <button
            onClick={() => setActiveTab("menu")}
            className={`py-2 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "menu"
                ? "border-[var(--text-strong)] text-[var(--text-strong)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            }`}
          >
            📋 Menü
          </button>
        )}

        <button
          onClick={() => setActiveTab("info")}
          className={`py-2 px-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "info"
              ? "border-[var(--text-strong)] text-[var(--text-strong)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-strong)]"
          }`}
        >
          ℹ️ Info
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-3">
        {/* Photos Tab */}
        {activeTab === "photos" && hasPhotos && (
          <div className="grid grid-cols-2 gap-2">
            {businessData.photos?.slice(0, 4).map((photo, idx) => (
              <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-[var(--bg-panel)]">
                {photo.url.startsWith("http") ? (
                  <Image
                    src={photo.url}
                    alt={`Foto ${idx + 1}`}
                    fill
                    sizes="(min-width: 640px) 200px, 50vw"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
                    📷
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Menu Tab */}
        {activeTab === "menu" && hasMenu && (
          <div className="space-y-2">
            {businessData.menu?.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start gap-2 py-2 border-b border-[var(--line-subtle)] last:border-0">
                <div>
                  <div className="font-medium text-[var(--text-strong)] text-sm">
                    {item.name}
                  </div>
                  {item.description && (
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">
                      {item.description}
                    </div>
                  )}
                </div>
                {item.price && (
                  <div className="font-mono font-semibold text-[var(--text-strong)] whitespace-nowrap">
                    €{item.price}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Info Tab */}
        {activeTab === "info" && (
          <div className="space-y-3">
            {/* Loading State */}
            {!hasInfo && (
              <div className="text-sm text-[var(--text-muted)]">
                Für diesen Ort liegen uns noch keine weiteren Details vor.
              </div>
            )}
            {/* Average Price */}
            {businessData.avgPrice && (
              <div>
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-1">
                  💰 Durchschnittspreis
                </div>
                <div className="text-sm font-medium text-[var(--text-strong)]">
                  ca. €{businessData.avgPrice}
                </div>
              </div>
            )}

            {/* Opening Hours */}
            {!hasStructuredHours && dbOpeningHours && (
              <div>
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">
                  🕐 Öffnungszeiten
                </div>
                <ul className="space-y-1 text-sm text-[var(--text-muted)]">
                  {(formatOpeningHoursDe(dbOpeningHours) ?? [dbOpeningHours]).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
            {hasStructuredHours && businessData.openingHours && (
              <div>
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">
                  🕐 Öffnungszeiten
                </div>
                <div className="space-y-1">
                  {Object.entries(businessData.openingHours).map(([day, hours]) => (
                    <div key={day} className="flex justify-between text-sm text-[var(--text-muted)]">
                      <span className="capitalize">{day}</span>
                      <span className="font-medium">{hours}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            <div className="flex flex-wrap gap-2 pt-2">
              {businessData.website && (
                <a
                  href={businessData.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[var(--brand-accent)] hover:underline"
                >
                  🌐 Website
                </a>
              )}
              {stop.googleMapsUrl && (
                <a
                  href={stop.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[var(--brand-accent)] hover:underline"
                >
                  📍 Google Maps
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
