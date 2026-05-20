"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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

type EventPlan = {
  id: string;
  title: string;
  occasion_slug: string;
  city_slug: string;
  event_date: string | null;
  guest_count: number | null;
  budget_cents: number | null;
  status: string;
  selected_needs: string[];
  share_token: string | null;
  created_at: string;
  event_bookings: EventBooking[];
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
  "berlin-berlin":    "Berlin",
  "hamburg":          "Hamburg",
  "muenchen":         "München",
  "wien":             "Wien",
  "zuerich":          "Zürich",
  "koeln":            "Köln",
  "frankfurt-am-main":"Frankfurt",
  "stuttgart":        "Stuttgart",
  "duesseldorf":      "Düsseldorf",
  "leipzig":          "Leipzig",
};

const SERVICE_TYPE_LABEL: Record<string, string> = {
  location:      "Location",
  catering:      "Catering",
  dj:            "DJ",
  band:          "Band",
  entertainment: "Entertainment",
  decoration:    "Dekoration",
  florist:       "Florist",
  photography:   "Fotografie",
  video:         "Video",
  moderator:     "Moderation",
  animation:     "Animation",
  cake:          "Torte",
  technology:    "Technik / AV",
  transport:     "Transport",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// price_cents_agreed is stored as the total (per_person already multiplied by guests at save time).
// pkgPriceCents is the original per-person price from provider_packages, used only for display.
function formatPrice(totalCents: number, pkgPriceCents: number, unit: string): string {
  const total = totalCents / 100;
  if (unit === "per_person") {
    const perPerson = pkgPriceCents / 100;
    return `${perPerson.toLocaleString("de-DE")} €/Person · ${total.toLocaleString("de-DE")} € gesamt`;
  }
  return `${total.toLocaleString("de-DE")} €`;
}

function effectiveTotal(cents: number): number {
  return cents / 100;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EventPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [plan, setPlan] = useState<EventPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [expandedBookings, setExpandedBookings] = useState<Record<string, boolean>>({});

  const loadPlan = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    if (!userId) {
      router.replace(`/login?return=/events/plan/${id}`);
      return;
    }

    const { data, error } = await supabase
      .from("event_plans")
      .select(`
        id, title, occasion_slug, city_slug, event_date, guest_count,
        budget_cents, status, selected_needs, share_token, created_at,
        event_bookings (
          id, need_slug, service_provider_id, provider_package_id,
          price_cents_agreed,
          service_providers ( id, name, service_type, is_verified ),
          provider_packages ( id, name, description, price_cents, price_unit, includes )
        )
      `)
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setPlan(data as unknown as EventPlan);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { void loadPlan(); }, [loadPlan]);

  async function handleShare() {
    if (!plan) return;
    setShareLoading(true);

    if (plan.share_token) {
      const url = `${window.location.origin}/events/agenda/${plan.share_token}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url).catch(() => {});
      setShareCopied(true);
      setShareLoading(false);
      return;
    }

    const token = crypto.randomUUID().replace(/-/g, "").substring(0, 24);
    const { error } = await supabase
      .from("event_plans")
      .update({ share_token: token })
      .eq("id", plan.id);

    if (error) {
      setShareLoading(false);
      return;
    }

    const url = `${window.location.origin}/events/agenda/${token}`;
    setShareUrl(url);
    await navigator.clipboard.writeText(url).catch(() => {});
    setShareCopied(true);
    setPlan((prev) => prev ? { ...prev, share_token: token } : prev);
    setShareLoading(false);
  }

  function toggleBooking(bookingId: string) {
    setExpandedBookings((prev) => ({ ...prev, [bookingId]: !prev[bookingId] }));
  }

  // ─── Return URL (persisted via sessionStorage across the events flow) ─────────

  const [returnUrl, setReturnUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem("pd24_event_return");
    if (stored) {
      setReturnUrl(stored);
      sessionStorage.removeItem("pd24_event_return"); // consume once
    }
  }, []);

  // ─── Derived ────────────────────────────────────────────────────────────────

  const guests = plan?.guest_count ?? 1;
  const bookings = plan?.event_bookings ?? [];
  const runningTotal = bookings.reduce(
    (sum, b) => sum + effectiveTotal(b.price_cents_agreed),
    0
  );
  const budget = plan ? (plan.budget_cents ?? 0) / 100 : 0;
  const overBudget = budget > 0 && runningTotal > budget;

  const editParams = plan
    ? new URLSearchParams({
        occasion: plan.occasion_slug,
        city: plan.city_slug,
        ...(plan.event_date ? { date: plan.event_date } : {}),
        ...(plan.guest_count ? { guests: String(plan.guest_count) } : {}),
        ...(plan.budget_cents ? { budget: String(Math.round(plan.budget_cents / 100)) } : {}),
        needs: (plan.selected_needs ?? []).join(","),
      }).toString()
    : "";

  // ─── Render states ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-[var(--bg-surface)]" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--bg-surface)]" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound || !plan) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <p className="text-lg font-medium text-[var(--text-strong)]">Plan nicht gefunden</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Der Plan existiert nicht oder gehört einem anderen Account.</p>
        <Link
          href="/events"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--text-strong)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
        >
          ← Neuen Plan starten
        </Link>
      </div>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────────────


  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="mb-8">
        <Link
          href="/events"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition hover:text-[var(--text-strong)]"
        >
          ← Zurück zu Events
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-3xl">
              {plan.title}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
                {OCCASION_LABEL[plan.occasion_slug] ?? plan.occasion_slug}
              </span>
              <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
                {CITY_LABEL[plan.city_slug] ?? plan.city_slug}
              </span>
              {plan.event_date && (
                <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
                  {formatDate(plan.event_date)}
                </span>
              )}
              {plan.guest_count && (
                <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
                  {plan.guest_count} Gäste
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Link
              href={`/events/plan/new?${editParams}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-subtle)] bg-white px-4 py-2 text-sm font-medium text-[var(--text-strong)] shadow-sm transition hover:bg-[var(--bg-surface)]"
            >
              Bearbeiten
            </Link>
            <button
              onClick={() => void handleShare()}
              disabled={shareLoading}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--text-strong)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
            >
              {shareLoading ? "…" : shareCopied ? "Link kopiert ✓" : "Agenda teilen"}
            </button>
          </div>
        </div>

        {shareUrl && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--text-muted)]">{shareUrl}</span>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(shareUrl).catch(() => {});
                setShareCopied(true);
              }}
              className="shrink-0 rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1 text-xs font-medium text-[var(--text-strong)] transition hover:bg-[var(--text-strong)] hover:text-white"
            >
              Kopieren
            </button>
          </div>
        )}
      </div>

      {/* Return CTA — e.g. coming from business dashboard */}
      {returnUrl && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
          <p className="text-sm text-blue-900">
            Event angelegt — jetzt Teilnehmer einladen und RSVP tracken.
          </p>
          <Link
            href={`${returnUrl}?event=${plan.id}`}
            className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Weiter zur Teilnehmerverwaltung →
          </Link>
        </div>
      )}

      {/* Budget summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--line-subtle)] bg-white p-4 shadow-sm">
          <p className="text-xs text-[var(--text-muted)]">Gebuchte Leistungen</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-strong)]">{bookings.length}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line-subtle)] bg-white p-4 shadow-sm">
          <p className="text-xs text-[var(--text-muted)]">Gesamtkosten</p>
          <p className={`mt-1 text-2xl font-semibold ${overBudget ? "text-red-600" : "text-[var(--text-strong)]"}`}>
            {runningTotal.toLocaleString("de-DE")} €
          </p>
        </div>
        {budget > 0 && (
          <div className="rounded-2xl border border-[var(--line-subtle)] bg-white p-4 shadow-sm">
            <p className="text-xs text-[var(--text-muted)]">Budget</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-strong)]">
              {budget.toLocaleString("de-DE")} €
            </p>
            {overBudget && (
              <p className="mt-0.5 text-xs font-medium text-red-600">
                +{(runningTotal - budget).toLocaleString("de-DE")} € über Budget
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bookings / Agenda */}
      <div>
        <h2 className="mb-4 text-base font-semibold text-[var(--text-strong)]">Agenda</h2>

        {bookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--line-subtle)] px-6 py-12 text-center">
            <p className="text-sm text-[var(--text-muted)]">Noch keine Leistungen gebucht.</p>
            <Link
              href={`/events/plan/new?${editParams}`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--text-strong)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
            >
              Anbieter auswählen
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {(plan.selected_needs ?? []).map((need) => {
              const booking = bookings.find((b) => b.need_slug === need);
              if (!booking) return null;

              const provider = booking.service_providers;
              const pkg = booking.provider_packages;
              const expanded = expandedBookings[booking.id] ?? false;
              const priceUnit = booking.provider_packages?.price_unit ?? "flat";
              const itemTotal = effectiveTotal(booking.price_cents_agreed);

              return (
                <div
                  key={booking.id}
                  className="overflow-hidden rounded-2xl border border-[var(--line-subtle)] bg-white shadow-sm"
                >
                  <button
                    onClick={() => toggleBooking(booking.id)}
                    className="flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-[var(--bg-surface)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                          {NEED_LABEL[need] ?? need}
                        </span>
                        {provider?.is_verified && (
                          <span className="rounded-full bg-[var(--brand-accent)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            ✓
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-medium text-[var(--text-strong)]">
                        {provider?.name ?? "—"}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">
                        {pkg?.name ?? "—"}
                        {provider?.service_type && (
                          <span className="ml-2 text-xs">
                            · {SERVICE_TYPE_LABEL[provider.service_type] ?? provider.service_type}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-[var(--text-strong)]">
                        {itemTotal.toLocaleString("de-DE")} €
                      </p>
                      {priceUnit === "per_person" && pkg && (
                        <p className="text-xs text-[var(--text-muted)]">
                          {(pkg.price_cents / 100).toLocaleString("de-DE")} €/Person
                        </p>
                      )}
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{expanded ? "▲" : "▼"}</p>
                    </div>
                  </button>

                  {expanded && pkg && (
                    <div className="border-t border-[var(--line-subtle)] px-5 py-4">
                      {pkg.description && (
                        <p className="mb-3 text-sm text-[var(--text-muted)]">{pkg.description}</p>
                      )}
                      {pkg.includes && pkg.includes.length > 0 && (
                        <ul className="space-y-1.5">
                          {pkg.includes.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
                              <span className="mt-0.5 shrink-0 text-[var(--brand-accent)]">✓</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-3 text-xs text-[var(--text-muted)]">
                        Preis:{" "}
                        {pkg ? formatPrice(booking.price_cents_agreed, pkg.price_cents, priceUnit) : "—"}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Needs without bookings */}
      {plan.selected_needs && plan.selected_needs.some((n) => !bookings.find((b) => b.need_slug === n)) && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-medium text-[var(--text-muted)]">Noch nicht vergeben</h3>
          <div className="flex flex-wrap gap-2">
            {plan.selected_needs
              .filter((n) => !bookings.find((b) => b.need_slug === n))
              .map((n) => (
                <span
                  key={n}
                  className="rounded-full border border-dashed border-[var(--line-subtle)] px-3 py-1 text-xs text-[var(--text-muted)]"
                >
                  {NEED_LABEL[n] ?? n}
                </span>
              ))}
          </div>
          <Link
            href={`/events/plan/new?${editParams}`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--line-subtle)] bg-white px-4 py-2 text-sm font-medium text-[var(--text-strong)] shadow-sm transition hover:bg-[var(--bg-surface)]"
          >
            Anbieter ergänzen →
          </Link>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 border-t border-[var(--line-subtle)] pt-6 text-center">
        <p className="text-xs text-[var(--text-muted)]">
          Erstellt am {formatDate(plan.created_at)} · Plan-ID: {plan.id.substring(0, 8)}
        </p>
      </div>

    </div>
  );
}
