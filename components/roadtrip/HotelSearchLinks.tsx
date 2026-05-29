"use client";

/**
 * HotelSearchLinks — Hotel-Affiliate Deep-Links für einen Roadtrip-Stop.
 *
 * Zeigt Schnellzugriff-Buttons zu Booking.com, HRS und Hotels.com mit
 * vorausgefüllter Stadt und Datum. Jeder Klick wird als Affiliate-Event
 * über /api/monetization/redirect erfasst.
 *
 * ─── Affiliate-IDs ──────────────────────────────────────────────────────────
 * BOOKING_COM_AID   — Nach Registrierung bei partners.booking.com ersetzen.
 *                     Aktuell: Partner-ID "placeholder" → kein Tracking, aber
 *                     der Link funktioniert (ohne Provision).
 *
 * Für HRS/Hotels.com: Empfehlung ist AWIN. Nach AWIN-Registrierung den
 * jeweiligen Deeplink durch den AWIN-Tracking-Link ersetzen.
 *
 * ─── Provisionen (Richtwerte) ───────────────────────────────────────────────
 *  Booking.com   ~4 % des Nettoumsatzes pro Buchung (CPS)
 *  HRS           ~4–6 % (über AWIN, CPS)
 *  Hotels.com    ~4 % (Expedia Partner Network, CPS)
 *  trivago       ~0,30–0,50 € pro Klick (CPC) — kein CPS
 */

import { useState } from "react";
import { buildMonetizationRedirectHref } from "@/lib/monetization/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type HotelSearchLinksProps = {
  cityLabel: string;       // "Hamburg"
  checkin: string;         // "2025-06-15"  YYYY-MM-DD
  checkout: string;        // "2025-06-17"  YYYY-MM-DD
  nights: number;          // 2
  adults?: number;         // default 2
  citySlug?: string | null;
  userId?: string | null;
};

// ─── Affiliate IDs ────────────────────────────────────────────────────────────
// TODO: Replace with real IDs after affiliate programme approval

/** Booking.com Affiliate Partner ID (partners.booking.com) */
const BOOKING_COM_AID = "PLACEHOLDER_AID";

/** Hotels.com / Expedia Partner Network tracking tag */
const HOTELS_COM_EPC = "PLACEHOLDER_EPC";

// ─── Provider definitions ─────────────────────────────────────────────────────

type Provider = {
  id: string;
  label: string;
  badge?: string;
  badgeColor?: string;
  logo: React.ReactNode;
  buildTargetUrl: (city: string, checkin: string, checkout: string, adults: number) => string;
};

const PROVIDERS: Provider[] = [
  {
    id: "booking_com",
    label: "Booking.com",
    badge: "~4 % Provision",
    badgeColor: "emerald",
    logo: (
      // Booking.com blue wordmark-style icon
      <svg viewBox="0 0 40 20" className="h-4 w-auto" aria-hidden>
        <rect width="40" height="20" rx="3" fill="#003580" />
        <text x="4" y="14" fontFamily="Arial,sans-serif" fontWeight="bold" fontSize="9" fill="white">
          booking
        </text>
        <circle cx="35" cy="10" r="4" fill="#FEBB02" />
      </svg>
    ),
    buildTargetUrl: (city, checkin, checkout, adults) => {
      const p = new URLSearchParams({
        aid: BOOKING_COM_AID,
        ss: city,
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
    buildTargetUrl: (city, checkin, checkout, adults) => {
      // HRS direct link — after AWIN approval wrap in AWIN tracking URL:
      // https://www.awin1.com/cread.php?awinmid=XXXXX&awinaffid=YYYYY&ued=TARGET_URL
      const p = new URLSearchParams({
        destination: city,
        arrivalDate: checkin,
        departureDate: checkout,
        numRooms: "1",
        numPersons: String(adults),
        lang: "de",
      });
      // TODO: Wrap in AWIN tracking URL after AWIN + HRS programme approval
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
    buildTargetUrl: (city, checkin, checkout, adults) => {
      const p = new URLSearchParams({
        "q-destination": city,
        "q-check-in": checkin,
        "q-check-out": checkout,
        "q-rooms": "1",
        "q-room-0-adults": String(adults),
        locale: "de_DE",
      });
      // After Hotels.com affiliate approval add EPC tracking:
      // https://de.hotels.com/search.do?...&epc=${HOTELS_COM_EPC}
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
        <text x="24" y="14" fontFamily="Arial,sans-serif" fontSize="8" fill="white">
          🌍
        </text>
      </svg>
    ),
    buildTargetUrl: (city, checkin, checkout, adults) => {
      // Hostelworld affiliate via AWIN after registration
      const citySlug = city.toLowerCase().replace(/[äöüß\s]+/g, (match) => {
        const map: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss", " ": "-" };
        return map[match] ?? "-";
      });
      return `https://www.hostelworld.com/hostels/${citySlug}`;
    },
  },
];

// ─── Badge colour helper ───────────────────────────────────────────────────────

function badgeClass(color: string | undefined): string {
  switch (color) {
    case "emerald": return "bg-emerald-50 text-emerald-700";
    case "sky":     return "bg-sky-50 text-sky-700";
    case "amber":   return "bg-amber-50 text-amber-700";
    case "violet":  return "bg-violet-50 text-violet-700";
    default:        return "bg-[rgba(23,23,23,0.06)] text-[var(--text-muted)]";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HotelSearchLinks({
  cityLabel,
  checkin,
  checkout,
  nights,
  adults = 2,
  citySlug,
  userId,
}: HotelSearchLinksProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-[rgba(23,23,23,0.08)] bg-[var(--bg-surface)]">
      {/* Summary row — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-[rgba(23,23,23,0.03)]"
      >
        {/* Hotel icon */}
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(23,23,23,0.06)] text-base">
          🏨
        </span>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--text-strong)]">
            Hotels in {cityLabel}
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            {nights} {nights === 1 ? "Nacht" : "Nächte"} · {adults} Person{adults !== 1 ? "en" : ""}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-[rgba(183,106,67,0.12)] px-2 py-0.5 text-[10px] font-semibold text-[#b76a43]">
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

      {/* Provider buttons — shown when expanded */}
      {expanded && (
        <div className="border-t border-[rgba(23,23,23,0.06)] px-3 pb-3 pt-2.5">
          <p className="mb-2.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
            Klicke auf einen Anbieter. Du wirst direkt zur Hotelsuche weitergeleitet —
            wir erhalten eine Provision, wenn du buchst (kein Aufpreis für dich).
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
                  className="group flex flex-col items-center gap-2 rounded-xl border border-[rgba(23,23,23,0.08)] bg-white px-3 py-3 text-center transition hover:border-[rgba(23,23,23,0.2)] hover:shadow-sm active:scale-[0.97]"
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

          {/* Disclosure */}
          <p className="mt-2.5 text-[10px] text-[var(--text-muted)]">
            * Affiliate-Links. Wir verdienen eine kleine Provision bei einer Buchung — ohne Mehrkosten für dich.
          </p>
        </div>
      )}
    </div>
  );
}
