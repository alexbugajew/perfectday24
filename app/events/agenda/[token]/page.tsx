"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProviderPackage = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  price_unit: string;
  includes: string[];
};

type ServiceProvider = {
  id: string;
  name: string;
  service_type: string;
  is_verified: boolean;
};

type EventBooking = {
  id: string;
  need_slug: string;
  service_provider_id: string;
  provider_package_id: string | null;
  price_cents_agreed: number;
  service_providers: ServiceProvider | null;
  provider_packages: ProviderPackage | null;
};

type SharedPlan = {
  id: string;
  title: string;
  occasion_slug: string;
  city_slug: string;
  event_date: string | null;
  guest_count: number | null;
  budget_cents: number | null;
  status: string;
  selected_needs: string[];
  notes: string | null;
  share_token: string;
  created_at: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const NEED_LABEL: Record<string, string> = {
  location:   "Location",
  catering:   "Catering",
  musik:      "Musik / DJ",
  deko:       "Dekoration",
  florist:    "Florist",
  fotografie: "Fotografie",
  video:      "Videografie",
  moderation: "Moderation",
  animation:  "Animation / Aktivität",
  torte:      "Torte",
  technik:    "Technik / AV",
  transport:  "Transport",
};

const OCCASION_LABEL: Record<string, string> = {
  geburtstag:       "Geburtstag",
  hochzeit:         "Hochzeit",
  teambuilding:     "Teambuilding",
  firmenfeier:      "Firmenfeier",
  kindergeburtstag: "Kindergeburtstag",
  konferenz:        "Konferenz",
  jubilaeum:        "Jubiläum",
  staedtereise:     "Städtereise",
};

const CITY_LABEL: Record<string, string> = {
  "berlin-berlin":     "Berlin",
  "hamburg":           "Hamburg",
  "muenchen":          "München",
  "wien":              "Wien",
  "zuerich":           "Zürich",
  "koeln":             "Köln",
  "frankfurt-am-main": "Frankfurt",
  "stuttgart":         "Stuttgart",
  "duesseldorf":       "Düsseldorf",
  "leipzig":           "Leipzig",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

// price_cents_agreed is stored as the total (per_person already multiplied at save time).
function formatPrice(totalCents: number, pkgPriceCents: number, unit: string): string {
  const total = totalCents / 100;
  if (unit === "per_person") {
    const perPerson = pkgPriceCents / 100;
    return `${perPerson.toLocaleString("de-DE")} €/Person · ${total.toLocaleString("de-DE")} € gesamt`;
  }
  return `${total.toLocaleString("de-DE")} €`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgendaSharePage() {
  const { token } = useParams<{ token: string }>();

  const [plan, setPlan] = useState<SharedPlan | null>(null);
  const [bookings, setBookings] = useState<EventBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!token) return;

    (async () => {
      // Use security-definer RPC — no auth required.
      const { data: rows, error } = await supabase.rpc("public_event_plan_by_token", {
        p_token: token,
      });

      if (error || !rows || (rows as SharedPlan[]).length === 0) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const planRow = (rows as SharedPlan[])[0];
      setPlan(planRow);

      // Bookings are readable for anon when the plan has a share_token (migration policy).
      const { data: bkgs } = await supabase
        .from("event_bookings")
        .select(`
          id, need_slug, service_provider_id, provider_package_id, price_cents_agreed,
          service_providers ( id, name, service_type, is_verified ),
          provider_packages ( id, name, description, price_cents, price_unit, includes )
        `)
        .eq("event_plan_id", planRow.id);

      setBookings((bkgs ?? []) as unknown as EventBooking[]);
      setLoading(false);
    })();
  }, [token]);

  const guests = plan?.guest_count ?? 1;
  const runningTotal = bookings.reduce((sum, b) => sum + b.price_cents_agreed / 100, 0);

  // ─── Render states ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-6 h-8 w-56 animate-pulse rounded-lg bg-[var(--bg-surface)]" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-[var(--bg-surface)]" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound || !plan) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <p className="text-lg font-medium text-[var(--text-strong)]">Agenda nicht gefunden</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Dieser Link ist abgelaufen oder existiert nicht mehr.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--text-strong)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
        >
          Zur Startseite
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f4ee]">
      {/* Header */}
      <div className="border-b border-[rgba(23,23,23,0.08)] bg-[#fffdf8] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#b76a43]">
            Event Agenda
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#171717] sm:text-3xl">
            {plan.title}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip>{OCCASION_LABEL[plan.occasion_slug] ?? plan.occasion_slug}</Chip>
            <Chip>{CITY_LABEL[plan.city_slug] ?? plan.city_slug}</Chip>
            {plan.event_date && <Chip>{formatDate(plan.event_date)}</Chip>}
            {guests > 1 && <Chip>{guests} Gäste</Chip>}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">

        {/* Summary tiles */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[rgba(23,23,23,0.08)] bg-white p-4 shadow-sm">
            <p className="text-xs text-[#8b7767]">Leistungen</p>
            <p className="mt-1 text-2xl font-semibold text-[#171717]">{bookings.length}</p>
          </div>
          <div className="rounded-2xl border border-[rgba(23,23,23,0.08)] bg-white p-4 shadow-sm">
            <p className="text-xs text-[#8b7767]">Gesamtkosten</p>
            <p className="mt-1 text-2xl font-semibold text-[#171717]">
              {runningTotal.toLocaleString("de-DE")} €
            </p>
          </div>
          {plan.budget_cents && (
            <div className="rounded-2xl border border-[rgba(23,23,23,0.08)] bg-white p-4 shadow-sm">
              <p className="text-xs text-[#8b7767]">Budget</p>
              <p className="mt-1 text-2xl font-semibold text-[#171717]">
                {(plan.budget_cents / 100).toLocaleString("de-DE")} €
              </p>
            </div>
          )}
        </div>

        {/* Bookings list */}
        <h2 className="mb-4 text-base font-semibold text-[#171717]">Gebuchte Leistungen</h2>

        {bookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[rgba(23,23,23,0.12)] px-6 py-10 text-center text-sm text-[#8b7767]">
            Noch keine Leistungen in dieser Agenda.
          </div>
        ) : (
          <div className="space-y-3">
            {(plan.selected_needs ?? []).map((need) => {
              const booking = bookings.find((b) => b.need_slug === need);
              if (!booking) return null;

              const provider = booking.service_providers;
              const pkg = booking.provider_packages;
              const priceUnit = pkg?.price_unit ?? "flat";
              const isExpanded = expanded[booking.id] ?? false;

              return (
                <div
                  key={booking.id}
                  className="overflow-hidden rounded-2xl border border-[rgba(23,23,23,0.08)] bg-white shadow-sm"
                >
                  <button
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [booking.id]: !prev[booking.id] }))
                    }
                    className="flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-[#fafaf8]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8b7767]">
                          {NEED_LABEL[need] ?? need}
                        </span>
                        {provider?.is_verified && (
                          <span className="rounded-full bg-[#b76a43] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            ✓
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-medium text-[#171717]">{provider?.name ?? "—"}</p>
                      <p className="text-sm text-[#665d55]">{pkg?.name ?? "—"}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-[#171717]">
                        {(booking.price_cents_agreed / 100).toLocaleString("de-DE")} €
                      </p>
                      {priceUnit === "per_person" && pkg && (
                        <p className="text-xs text-[#8b7767]">
                          {(pkg.price_cents / 100).toLocaleString("de-DE")} €/Person
                        </p>
                      )}
                      <p className="mt-1 text-xs text-[#8b7767]">{isExpanded ? "▲" : "▼"}</p>
                    </div>
                  </button>

                  {isExpanded && pkg && (
                    <div className="border-t border-[rgba(23,23,23,0.08)] px-5 py-4">
                      {pkg.description && (
                        <p className="mb-3 text-sm text-[#665d55]">{pkg.description}</p>
                      )}
                      {pkg.includes && pkg.includes.length > 0 && (
                        <ul className="space-y-1.5">
                          {pkg.includes.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-[#665d55]">
                              <span className="mt-0.5 shrink-0 text-[#b76a43]">✓</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-3 text-xs text-[#8b7767]">
                        Preis: {formatPrice(booking.price_cents_agreed, pkg.price_cents, priceUnit)}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Unbooked needs */}
        {plan.selected_needs?.some((n) => !bookings.find((b) => b.need_slug === n)) && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-medium text-[#8b7767]">Noch nicht vergeben</h3>
            <div className="flex flex-wrap gap-2">
              {plan.selected_needs
                .filter((n) => !bookings.find((b) => b.need_slug === n))
                .map((n) => (
                  <span
                    key={n}
                    className="rounded-full border border-dashed border-[rgba(23,23,23,0.12)] px-3 py-1 text-xs text-[#8b7767]"
                  >
                    {NEED_LABEL[n] ?? n}
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {plan.notes && (
          <div className="mt-8 rounded-2xl border border-[rgba(23,23,23,0.08)] bg-white p-5">
            <h3 className="mb-2 text-sm font-semibold text-[#171717]">Notizen</h3>
            <p className="whitespace-pre-wrap text-sm text-[#665d55]">{plan.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 border-t border-[rgba(23,23,23,0.08)] pt-6 text-center">
          <p className="text-xs text-[#8b7767]">
            Erstellt am {formatDate(plan.created_at)} · Geteilt via PerfectDay24
          </p>
          <Link
            href="/"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#b76a43] transition hover:underline"
          >
            Eigenen Event planen →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[rgba(23,23,23,0.10)] bg-white px-3 py-1 text-xs text-[#665d55]">
      {children}
    </span>
  );
}
