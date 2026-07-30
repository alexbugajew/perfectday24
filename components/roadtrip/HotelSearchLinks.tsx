"use client";

/**
 * HotelSearchLinks - Hotel-Affiliate Deep-Links fuer einen Roadtrip-Stop.
 *
 * Zeigt eine direkte PD24-Empfehlung fuer die passende Unterkunftslage und
 * darunter die bekannten Suchanbieter mit vorausgefuellten Daten.
 */

import { useState } from "react";
import { buildMonetizationRedirectHref } from "@/lib/monetization/client";
import { getRoadtripHotelStayPick } from "@/lib/roadtrip/hotel-stays";

export type HotelSearchLinksProps = {
  cityLabel: string;
  checkin: string;
  checkout: string;
  nights: number;
  adults?: number;
  citySlug?: string | null;
  userId?: string | null;
  occasion?: string | null;
  budget?: string | null;
  planSummary?: string | null;
  anchorLabel?: string | null;
};

const BOOKING_COM_AID = "PLACEHOLDER_AID";

type Provider = {
  id: string;
  label: string;
  badge?: string;
  badgeColor?: string;
  logo: React.ReactNode;
  buildTargetUrl: (query: string, checkin: string, checkout: string, adults: number) => string;
};

const PROVIDERS: Provider[] = [
  {
    id: "booking_com",
    label: "Booking.com",
    badge: "~4 % Provision",
    badgeColor: "emerald",
    logo: (
      <svg viewBox="0 0 40 20" className="h-4 w-auto" aria-hidden>
        <rect width="40" height="20" rx="3" fill="#003580" />
        <text x="4" y="14" fontFamily="Arial,sans-serif" fontWeight="bold" fontSize="9" fill="white">
          booking
        </text>
        <circle cx="35" cy="10" r="4" fill="#FEBB02" />
      </svg>
    ),
    buildTargetUrl: (query, checkin, checkout, adults) => {
      const p = new URLSearchParams({
        aid: BOOKING_COM_AID,
        ss: query,
        checkin,
        checkout,
        no_rooms: "1",
        group_adults: String(adults),
        group_children: "0",
        lang: "de",
        sb: "1",
        src: "searchresults",
      });
      return `https://www.booking.com/searchresults.de.html?${p}`;
    },
  },
  {
    id: "hrs",
    label: "HRS",
    badge: "via AWIN",
    badgeColor: "sky",
    logo: (
      <svg viewBox="0 0 40 20" className="h-4 w-auto" aria-hidden>
        <rect width="40" height="20" rx="3" fill="#e30613" />
        <text x="10" y="14" fontFamily="Arial,sans-serif" fontWeight="bold" fontSize="11" fill="white">
          HRS
        </text>
      </svg>
    ),
    buildTargetUrl: (query, checkin, checkout, adults) => {
      const p = new URLSearchParams({
        destination: query,
        arrivalDate: checkin,
        departureDate: checkout,
        numRooms: "1",
        numPersons: String(adults),
        lang: "de",
      });
      return `https://www.hrs.de/hotel/list?${p}`;
    },
  },
  {
    id: "hotels_com",
    label: "Hotels.com",
    badge: "~4 % Provision",
    badgeColor: "amber",
    logo: (
      <svg viewBox="0 0 40 20" className="h-4 w-auto" aria-hidden>
        <rect width="40" height="20" rx="3" fill="#D32F2F" />
        <text x="3" y="13" fontFamily="Arial,sans-serif" fontWeight="bold" fontSize="7.5" fill="white">
          Hotels
        </text>
        <text x="3" y="18" fontFamily="Arial,sans-serif" fontSize="5.5" fill="white">
          .com
        </text>
      </svg>
    ),
    buildTargetUrl: (query, checkin, checkout, adults) => {
      const p = new URLSearchParams({
        "q-destination": query,
        "q-check-in": checkin,
        "q-check-out": checkout,
        "q-rooms": "1",
        "q-room-0-adults": String(adults),
        locale: "de_DE",
      });
      return `https://de.hotels.com/search.do?${p}`;
    },
  },
  {
    id: "hostelworld",
    label: "Hostelworld",
    badge: "Budget",
    badgeColor: "violet",
    logo: (
      <svg viewBox="0 0 40 20" className="h-4 w-auto" aria-hidden>
        <rect width="40" height="20" rx="3" fill="#FF6600" />
        <text x="4" y="14" fontFamily="Arial,sans-serif" fontWeight="bold" fontSize="8" fill="white">
          hostel
        </text>
      </svg>
    ),
    buildTargetUrl: (query) => {
      return `https://www.hostelworld.com/st/hostels/europe/germany/${encodeURIComponent(query.toLowerCase())}/`;
    },
  },
];

function badgeClass(color: string | undefined): string {
  switch (color) {
    case "emerald":
      return "bg-emerald-50 text-emerald-700";
    case "sky":
      return "bg-sky-50 text-sky-700";
    case "amber":
      return "bg-amber-50 text-amber-700";
    case "violet":
      return "bg-violet-50 text-violet-700";
    default:
      return "bg-[rgba(23,23,23,0.06)] text-[var(--text-muted)]";
  }
}

export default function HotelSearchLinks({
  cityLabel,
  checkin,
  checkout,
  nights,
  adults = 2,
  citySlug,
  userId,
  occasion,
  budget,
  planSummary,
  anchorLabel,
}: HotelSearchLinksProps) {
  const [expanded, setExpanded] = useState(false);
  const stayPick = getRoadtripHotelStayPick({
    cityLabel,
    citySlug,
    occasion,
    budget,
    planSummary,
    anchorLabel,
  });

  const recommendationHref = buildMonetizationRedirectHref({
    targetUrl: PROVIDERS[0].buildTargetUrl(stayPick.searchQuery, checkin, checkout, adults),
    eventType: "redirect",
    slotKey: "roadtrip_hotel_search",
    citySlug: citySlug ?? null,
    surface: "roadtrip",
    userId,
    source: "pd24_stay_pick_booking",
    label: `hotel_recommended_${cityLabel}`,
  });

  return (
    <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-[rgba(23,23,23,0.03)]"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(23,23,23,0.06)] text-base">
          Hotel
        </span>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--text-strong)]">
            Hotels in {cityLabel}
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            {nights} {nights === 1 ? "Nacht" : "Naechte"} / {adults} Person{adults !== 1 ? "en" : ""}
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-muted)]">
            Empfohlen: {stayPick.style} in {stayPick.area}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-[rgba(183,106,67,0.12)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-warm-deep)]">
            Affiliate
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            className={`h-4 w-4 text-[var(--text-muted)] transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[rgba(23,23,23,0.06)] px-3 pb-3 pt-2.5">
          <div className="mb-3 rounded-xl border border-[rgba(183,106,67,0.18)] bg-white p-3 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="pd24-kicker-warm">
                  PD24 Stay Pick
                </div>
                <div className="mt-1 text-sm font-semibold text-[var(--text-strong)]">
                  {stayPick.style}
                </div>
                <div className="mt-0.5 text-xs font-medium text-[var(--text-muted)]">
                  {stayPick.area}
                </div>
              </div>
              <span className="rounded-full bg-[rgba(183,106,67,0.12)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-warm-deep)]">
                {stayPick.badge}
              </span>
            </div>

            <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
              {stayPick.reason}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                {stayPick.fitLabel}
              </span>
              <a
                href={recommendationHref}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="pd24-btn pd24-btn-sm pd24-btn-primary active:scale-[0.97]"
              >
                Empfehlung auf Booking.com oeffnen
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>

          <p className="mb-2.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
            Klicke auf einen Anbieter. Du wirst direkt zur Hotelsuche weitergeleitet -
            wir erhalten eine Provision, wenn du buchst (kein Aufpreis fuer dich).
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PROVIDERS.map((provider) => {
              const targetUrl = provider.buildTargetUrl(cityLabel, checkin, checkout, adults);
              const href = buildMonetizationRedirectHref({
                targetUrl,
                eventType: "redirect",
                slotKey: "roadtrip_hotel_search",
                citySlug: citySlug ?? null,
                surface: "roadtrip",
                userId,
                source: provider.id,
                label: `hotel_${provider.id}_${cityLabel}`,
              });

              return (
                <a
                  key={provider.id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="group flex flex-col items-center gap-2 rounded-xl border border-[var(--line-subtle)] bg-white px-3 py-3 text-center transition hover:border-[rgba(23,23,23,0.2)] hover:shadow-sm active:scale-[0.97]"
                >
                  {provider.logo}
                  <span className="text-[11px] font-semibold text-[var(--text-strong)]">
                    {provider.label}
                  </span>
                  {provider.badge && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${badgeClass(provider.badgeColor)}`}
                    >
                      {provider.badge}
                    </span>
                  )}
                </a>
              );
            })}
          </div>

          <p className="mt-2.5 text-[10px] text-[var(--text-muted)]">
            * Affiliate-Links. Wir verdienen eine kleine Provision bei einer Buchung - ohne Mehrkosten fuer dich.
          </p>
        </div>
      )}
    </div>
  );
}
