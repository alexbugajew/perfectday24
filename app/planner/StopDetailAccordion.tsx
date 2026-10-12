"use client";

import { useState } from "react";
import Image from "next/image";
import ImageAttribution from "@/components/ImageAttribution";
import MonetizedExternalLink from "@/components/monetization/MonetizedExternalLink";
import type { PlannedStop } from "@/lib/planner";
import type { PublicAffiliateResolution } from "@/lib/monetization/affiliate-shared";
import { stopPhotoFallback } from "@/lib/stop-photo-fallback";
import { formatOpeningHoursDe } from "@/lib/planner/opening-hours";
import { locationAddressFromSourceRefs } from "@/lib/planner/location-address";
import {
  isSameWebTarget,
  locationPhoneFromSourceRefs,
  locationWebsiteFromSourceRefs,
  phoneHref,
} from "@/lib/planner/location-contact";
import { googleMapsPlaceUrl } from "@/lib/planner/maps-link";
import type { StopPhoto } from "@/lib/planner/stop-photo-chain";
import { hasPlannerEvent, stopFallbackPhotoParams } from "./stopDisplay";
import { useStopPhoto } from "./useStopPhoto";

type StopDetailAccordionProps = {
  stop: PlannedStop;
  affiliateResolution: PublicAffiliateResolution;
  userId: string | null;
  effectiveCitySlug: string | null;
};

const LINK_CLASS = "text-xs font-semibold text-[var(--brand-accent)] hover:underline";
const SECTION_LABEL_CLASS = "text-xs font-semibold text-[var(--text-muted)] uppercase mb-1";

// Foto-Kette (eigener Upload → freigegebene Assets → Bild mit Bildnachweis →
// Kategorie-Fallback), siehe lib/planner/stop-photo-chain.ts. Der Fallback ist
// ein Stockfoto und wird als solches beschriftet — „Echte Orte" heißt auch,
// dass niemand ein Symbolbild für das Lokal selbst hält.
function StopPhotoBlock({ stop }: { stop: PlannedStop }) {
  const { photo, loading } = useStopPhoto(stop);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);

  if (loading) {
    return <div aria-hidden className="h-40 w-full rounded-lg bg-[var(--bg-panel)] motion-safe:animate-pulse sm:h-48" />;
  }
  if (!photo) return null;

  // Ein defektes Bild (gelöschte Datei, toter Link) fällt auf das Symbolfoto
  // zurück statt eine leere Fläche zu zeigen.
  const fallback: StopPhoto = {
    url: stopPhotoFallback(stopFallbackPhotoParams(stop, 800, 450)),
    source: "category_fallback",
    attributionMeta: null,
    credit: null,
    alt: null,
  };
  const active = failedUrls.includes(photo.url) ? fallback : photo;
  if (failedUrls.includes(active.url)) return null;

  return (
    <figure className="space-y-1">
      <div className="relative h-40 w-full overflow-hidden rounded-lg bg-[var(--bg-panel)] sm:h-48">
        <Image
          src={active.url}
          alt={active.alt ?? ""}
          fill
          sizes="(min-width: 640px) 480px, 100vw"
          className="object-cover"
          unoptimized
          onError={() => setFailedUrls((urls) => [...urls, active.url])}
        />
      </div>
      <figcaption>
        {active.source === "attributed_route_photo" ? (
          <ImageAttribution meta={active.attributionMeta} />
        ) : active.source === "media_asset" && active.credit ? (
          <div className="text-[11px] leading-5 text-gray-500">Foto: {active.credit}</div>
        ) : active.source === "category_fallback" ? (
          <div className="text-[11px] leading-5 text-gray-500">Symbolfoto – zeigt nicht den Ort selbst.</div>
        ) : null}
      </figcaption>
    </figure>
  );
}

export default function StopDetailAccordion({
  stop,
  affiliateResolution,
  userId,
  effectiveCitySlug,
}: StopDetailAccordionProps) {
  const item = stop.item;
  const isEvent = hasPlannerEvent(stop);

  // Fotos, Menü und Preise hat keine unserer Quellen (Beschluss Stufe 0: keine
  // Google-Anreicherung). Die Felder bleiben am Typ, falls eine spätere
  // Anreicherung sie füllt — dann greifen sie hier ohne Umbau.
  const photos = stop.photos ?? [];
  const menu = stop.menu ?? [];
  const hasPhotos = photos.length > 0;
  const hasMenu = menu.length > 0;
  const hasStructuredHours = Boolean(stop.openingHours && Object.keys(stop.openingHours).length > 0);
  const dbOpeningHours =
    typeof item?.opening_hours_raw === "string" && item.opening_hours_raw.trim().length > 0
      ? item.opening_hours_raw.trim()
      : null;

  const address = item ? locationAddressFromSourceRefs(item.source_refs) : null;
  const phone = item ? locationPhoneFromSourceRefs(item.source_refs) : null;
  const phoneLink = phone ? phoneHref(phone) : null;
  const website = stop.website ?? (item ? locationWebsiteFromSourceRefs(item.source_refs) : null);

  // Reservierungsweg wie am Kartenknopf (inkl. Affiliate-Auflösung). Der Ingest
  // hat die OSM-Website früher als reservation_url abgelegt — zeigen beide auf
  // dasselbe Ziel, rendern wir nur einen Link, damit nichts doppelt dasteht.
  const affiliateMatch = item && !isEvent ? affiliateResolution.byLocationId[item.id] ?? null : null;
  const reservationTarget = isEvent ? null : (affiliateMatch?.targetUrl ?? item?.reservation_url ?? null);
  const websiteIsReservation = isSameWebTarget(website, reservationTarget);
  const reservationLabel = affiliateMatch
    ? `${affiliateMatch.providerName} öffnen`
    : websiteIsReservation
      ? "Website & Reservierung"
      : "Reservieren";

  const mapsUrl =
    stop.googleMapsUrl ??
    googleMapsPlaceUrl({ name: item?.name, address, lat: item?.lat, lng: item?.lng });

  const hasInfo =
    Boolean(stop.avgPrice) ||
    hasStructuredHours ||
    Boolean(dbOpeningHours) ||
    Boolean(address) ||
    Boolean(phoneLink) ||
    Boolean(website) ||
    Boolean(reservationTarget);

  return (
    <div className="mt-4 pt-4 border-t border-[var(--line-subtle)] space-y-4">
      {/* Eigene Fotos der Plattform (stop.photos) haben Vorrang; sonst die
          Foto-Kette. Events haben kein Orts-Foto — ihr Bild sitzt an der Karte. */}
      {hasPhotos ? (
        <div className="grid grid-cols-2 gap-2">
          {photos.slice(0, 4).map((photo, idx) => (
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
                <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">📷</div>
              )}
            </div>
          ))}
        </div>
      ) : !isEvent && item ? (
        <StopPhotoBlock stop={stop} />
      ) : null}

      {hasMenu && (
        <div>
          <div className={SECTION_LABEL_CLASS}>📋 Menü</div>
          <div className="space-y-2">
            {menu.map((entry, idx) => (
              <div
                key={idx}
                className="flex justify-between items-start gap-2 py-2 border-b border-[var(--line-subtle)] last:border-0"
              >
                <div>
                  <div className="font-medium text-[var(--text-strong)] text-sm">{entry.name}</div>
                  {entry.description && (
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">{entry.description}</div>
                  )}
                </div>
                {entry.price && (
                  <div className="font-mono font-semibold text-[var(--text-strong)] whitespace-nowrap">€{entry.price}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {!hasInfo && (
          <div className="text-sm text-[var(--text-muted)]">
            Für diesen Ort liegen uns noch keine weiteren Details vor.
          </div>
        )}

        {stop.avgPrice ? (
          <div>
            <div className={SECTION_LABEL_CLASS}>💰 Durchschnittspreis</div>
            <div className="text-sm font-medium text-[var(--text-strong)]">ca. €{stop.avgPrice}</div>
          </div>
        ) : null}

        {!hasStructuredHours && dbOpeningHours && (
          <div>
            <div className={`${SECTION_LABEL_CLASS} mb-2`}>🕐 Öffnungszeiten</div>
            <ul className="space-y-1 text-sm text-[var(--text-muted)]">
              {(formatOpeningHoursDe(dbOpeningHours) ?? [dbOpeningHours]).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        {hasStructuredHours && stop.openingHours && (
          <div>
            <div className={`${SECTION_LABEL_CLASS} mb-2`}>🕐 Öffnungszeiten</div>
            <div className="space-y-1">
              {Object.entries(stop.openingHours).map(([day, hours]) => (
                <div key={day} className="flex justify-between text-sm text-[var(--text-muted)]">
                  <span className="capitalize">{day}</span>
                  <span className="font-medium">{hours}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {address ? (
          <div>
            <div className={SECTION_LABEL_CLASS}>📍 Adresse</div>
            <div className="text-sm text-[var(--text-muted)]">{address}</div>
          </div>
        ) : null}

        {/* Links */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
          {reservationTarget && item ? (
            <MonetizedExternalLink
              href={reservationTarget}
              target="_blank"
              rel="noopener noreferrer"
              userId={userId}
              locationId={item.id}
              partnerProfileId={affiliateMatch?.partnerProfileId ?? null}
              affiliateLinkId={affiliateMatch?.id ?? null}
              citySlug={effectiveCitySlug}
              surface="planner_stop"
              label={item.name}
              source={affiliateMatch ? "planner_stop_details_affiliate_cta" : "planner_stop_details_cta"}
              className={LINK_CLASS}
            >
              {websiteIsReservation ? "🌐" : "🗓️"} {reservationLabel}
            </MonetizedExternalLink>
          ) : null}
          {website && !websiteIsReservation && item ? (
            <MonetizedExternalLink
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              userId={userId}
              locationId={item.id}
              citySlug={effectiveCitySlug}
              surface="planner_stop"
              label={item.name}
              source="planner_stop_website"
              className={LINK_CLASS}
            >
              🌐 Website
            </MonetizedExternalLink>
          ) : null}
          {phone && phoneLink ? (
            <a href={phoneLink} className={LINK_CLASS}>
              📞 {phone}
            </a>
          ) : null}
          {mapsUrl ? (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
              📍 Auf Google Maps ansehen
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
