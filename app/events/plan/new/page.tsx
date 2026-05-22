"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { scoreVendors, BADGE_LABEL, BADGE_CLASS } from "@/lib/events/vendor-scoring";
import type { VendorWithScore, VendorPackage } from "@/lib/events/vendor-scoring";

// ─── Types ────────────────────────────────────────────────────────────────────

type RawPartnerMeta = {
  id: string;
  display_name: string;
  media_urls: string[] | null;
  booking_type: string | null;
  visibility_tier: string | null;
  service_category_slugs: string[] | null;
  contact_email: string | null;
  billing_status: string | null;
};

type RawPackage = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  price_unit: string;
  min_guests: number | null;
  max_guests: number | null;
  includes: string[];
  sort_order: number | null;
};

type RawProvider = {
  id: string;
  name: string;
  service_type: string;
  description: string | null;
  is_verified: boolean;
  base_price_cents: number | null;
  contact_email: string | null;
  partner_profiles: RawPartnerMeta | null;
  provider_packages: RawPackage[];
};

type Selection = {
  needSlug: string;
  provider: VendorWithScore;
  pkg: VendorPackage;
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

const NEED_ICON: Record<string, string> = {
  location:   "🏛️",
  catering:   "🍽️",
  musik:      "🎧",
  deko:       "💐",
  florist:    "🌸",
  fotografie: "📷",
  video:      "🎬",
  moderation: "🎤",
  animation:  "🎪",
  torte:      "🎂",
  technik:    "🔊",
  transport:  "🚐",
};

const NEED_SERVICE_TYPES: Record<string, string[]> = {
  location:   ["location"],
  catering:   ["catering"],
  musik:      ["dj", "band", "entertainment"],
  deko:       ["decoration"],
  florist:    ["florist"],
  fotografie: ["photography"],
  video:      ["video"],
  moderation: ["moderator"],
  animation:  ["animation"],
  torte:      ["cake"],
  technik:    ["technology"],
  transport:  ["transport"],
};

const OCCASION_LABELS: Record<string, string> = {
  geburtstag:       "Geburtstag",
  hochzeit:         "Hochzeit",
  teambuilding:     "Teambuilding",
  firmenfeier:      "Firmenfeier",
  kindergeburtstag: "Kindergeburtstag",
  konferenz:        "Konferenz",
  jubilaeum:        "Jubiläum",
  staedtereise:     "Städtereise",
};

const VENDORS_VISIBLE_DEFAULT = 3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pkgTotal(pkg: VendorPackage, guests: number): number {
  if (pkg.price_type === "per_person") return pkg.price * Math.max(guests, 1);
  return pkg.price;
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function normalizeProvider(sp: RawProvider): Record<string, unknown> {
  const pp = sp.partner_profiles;
  return {
    id:                     sp.id,
    name:                   sp.name,
    description:            sp.description,
    is_verified:            sp.is_verified,
    contact_email:          pp?.contact_email ?? sp.contact_email,
    media_urls:             pp?.media_urls ?? [],
    booking_type:           pp?.booking_type ?? "request",
    visibility_tier:        pp?.visibility_tier ?? "organic",
    service_category_slugs: pp?.service_category_slugs ?? [],
    packages: [...(sp.provider_packages ?? [])]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((pkg) => ({
        id:          pkg.id,
        name:        pkg.name,
        price:       pkg.price_cents / 100,
        price_type:  pkg.price_unit,
        description: pkg.description,
        min_guests:  pkg.min_guests,
        max_guests:  pkg.max_guests,
        includes:    pkg.includes ?? [],
      })),
  };
}

// ─── Inner page ───────────────────────────────────────────────────────────────

function PlanNewInner() {
  const router = useRouter();
  const params = useSearchParams();

  const occasion = params.get("occasion") ?? "";
  const city     = params.get("city") ?? "";
  const date     = params.get("date") ?? "";
  const guests   = parseInt(params.get("guests") ?? "0", 10) || 0;
  const budget   = parseInt(params.get("budget") ?? "0", 10) || 0;
  const needs    = (params.get("needs") ?? "").split(",").filter(Boolean);

  const citySlug = city;

  // ── State ────────────────────────────────────────────────────────────────

  const [eventTitle, setEventTitle]             = useState("");
  const [customerMessage, setCustomerMessage]   = useState("");
  const [showMessageBox, setShowMessageBox]     = useState(false);
  const [cityName, setCityName]                 = useState<string>("");
  const [vendorsByNeed, setVendorsByNeed]       = useState<Record<string, VendorWithScore[]>>({});
  const [allVendorsByNeed, setAllVendorsByNeed] = useState<Record<string, VendorWithScore[]>>({});
  const [loading, setLoading]                   = useState(true);
  const [selections, setSelections]             = useState<Record<string, Selection>>({});
  const [quoteRequests, setQuoteRequests]       = useState<Record<string, VendorWithScore>>({});
  const [modalState, setModalState]             = useState<{ vendor: VendorWithScore; needSlug: string } | null>(null);
  const [expandedNeeds, setExpandedNeeds]       = useState<Set<string>>(new Set());
  const [saving, setSaving]                     = useState(false);

  // ── Load city name ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!citySlug) return;
    supabase
      .from("cities")
      .select("name")
      .eq("slug", citySlug)
      .single()
      .then(({ data }) => { if (data) setCityName(data.name); });
  }, [citySlug]);

  // ── Load vendors ──────────────────────────────────────────────────────────

  const loadVendors = useCallback(async () => {
    if (!needs.length || !citySlug) { setLoading(false); return; }

    const serviceTypes = [...new Set(needs.flatMap((n) => NEED_SERVICE_TYPES[n] ?? []))];
    if (!serviceTypes.length) { setLoading(false); return; }

    const { data: rows, error } = await supabase
      .from("service_providers")
      .select(`
        id, name, service_type, description, is_verified,
        base_price_cents, contact_email,
        partner_profiles (
          id, display_name, media_urls, booking_type,
          visibility_tier, service_category_slugs,
          contact_email, billing_status
        ),
        provider_packages (
          id, name, description, price_cents, price_unit,
          min_guests, max_guests, includes, sort_order
        )
      `)
      .eq("city_slug", citySlug)
      .eq("status", "active")
      .in("service_type", serviceTypes)
      .order("is_verified", { ascending: false });

    if (error) {
      console.error("vendor query failed:", error.message);
      setLoading(false);
      return;
    }

    const categoryBudget = budget > 0 && needs.length > 0
      ? budget / needs.length
      : 0;

    const allByNeed: Record<string, VendorWithScore[]> = {};
    const visibleByNeed: Record<string, VendorWithScore[]> = {};

    for (const need of needs) {
      const types = NEED_SERVICE_TYPES[need] ?? [];
      const matching = (rows ?? [])
        .filter((sp) => types.includes(sp.service_type))
        .map((sp) => normalizeProvider(sp as unknown as RawProvider));

      const scored = scoreVendors(matching, categoryBudget, guests);
      allByNeed[need] = scored;
      visibleByNeed[need] = scored.slice(0, VENDORS_VISIBLE_DEFAULT);
    }

    setAllVendorsByNeed(allByNeed);
    setVendorsByNeed(visibleByNeed);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citySlug, needs.join(","), budget, guests]);

  useEffect(() => { void loadVendors(); }, [loadVendors]);

  // ── Interactions ─────────────────────────────────────────────────────────

  function openModal(needSlug: string, vendor: VendorWithScore) {
    setModalState({ vendor, needSlug });
  }

  function closeModal() {
    setModalState(null);
  }

  function selectPackage(needSlug: string, vendor: VendorWithScore, pkg: VendorPackage) {
    setSelections((prev) => {
      const existing = prev[needSlug];
      if (existing?.pkg.id === pkg.id) {
        const next = { ...prev };
        delete next[needSlug];
        return next;
      }
      return { ...prev, [needSlug]: { needSlug, provider: vendor, pkg } };
    });
    setQuoteRequests((prev) => {
      const next = { ...prev };
      delete next[needSlug];
      return next;
    });
    closeModal();
  }

  function toggleQuoteRequest(needSlug: string, vendor: VendorWithScore) {
    setQuoteRequests((prev) => {
      const next = { ...prev };
      if (next[needSlug]?.id === vendor.id) {
        delete next[needSlug];
      } else {
        next[needSlug] = vendor;
      }
      return next;
    });
    setSelections((prev) => {
      const next = { ...prev };
      delete next[needSlug];
      return next;
    });
    closeModal();
  }

  function toggleExpand(needSlug: string) {
    setExpandedNeeds((prev) => {
      const next = new Set(prev);
      if (next.has(needSlug)) {
        next.delete(needSlug);
        setVendorsByNeed((v) => ({
          ...v,
          [needSlug]: (allVendorsByNeed[needSlug] ?? []).slice(0, VENDORS_VISIBLE_DEFAULT),
        }));
      } else {
        next.add(needSlug);
        setVendorsByNeed((v) => ({
          ...v,
          [needSlug]: allVendorsByNeed[needSlug] ?? [],
        }));
      }
      return next;
    });
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      const returnUrl = encodeURIComponent(window.location.href);
      router.push(`/profile?return=${returnUrl}`);
      return;
    }

    const { data: plan, error: planErr } = await supabase
      .from("event_plans")
      .insert({
        user_id:        session.user.id,
        title:          eventTitle.trim() || null,
        occasion_slug:  occasion,
        city_slug:      citySlug,
        event_date:     date || null,
        guest_count:    guests || null,
        budget_cents:   budget ? budget * 100 : null,
        selected_needs: needs,
        status:         "planning",
      })
      .select("id")
      .single();

    if (planErr || !plan) { setSaving(false); return; }

    // Bookings for vendors with selected packages
    const bookings = Object.values(selections).map((s) => ({
      event_plan_id:       plan.id,
      service_provider_id: s.provider.id,
      provider_package_id: s.pkg.id,
      need_slug:           s.needSlug,
      price_cents_agreed:  s.pkg.price_type === "per_person"
        ? Math.round(s.pkg.price * 100) * Math.max(guests, 1)
        : Math.round(s.pkg.price * 100),
      status: "interested",
    }));

    if (bookings.length) {
      await supabase.from("event_bookings").insert(bookings);
    }

    // Inquiries for vendors without prices
    const quoteEntries = Object.entries(quoteRequests);
    if (quoteEntries.length > 0) {
      await fetch("/api/events/inquiries", {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          planId: plan.id,
          providers: quoteEntries.map(([needSlug, vendor]) => ({
            id:      vendor.id,
            needSlug,
            email:   vendor.contact_email ?? null,
            name:    vendor.name,
          })),
          eventData: {
            date,
            city:            citySlug,
            cityName,
            guests,
            budget,
            occasion,
            planTitle:       eventTitle.trim() || (OCCASION_LABELS[occasion] ?? occasion),
            customerMessage: customerMessage.trim() || undefined,
          },
        }),
      }).catch((e) => console.error("inquiry request failed:", e));
    }

    router.push(`/events/plan/${plan.id}`);
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalEur = Object.values(selections).reduce(
    (sum, s) => sum + pkgTotal(s.pkg, guests),
    0
  );
  const selectionCount   = Object.keys(selections).length;
  const quoteCount       = Object.keys(quoteRequests).length;
  const totalActionCount = selectionCount + quoteCount;
  const overBudget       = budget > 0 && totalEur > budget;
  const cityDisplay      = cityName || citySlug;

  const saveLabel = (() => {
    if (saving) return "Wird gespeichert …";
    if (quoteCount > 0 && selectionCount > 0)
      return `Plan speichern & ${quoteCount} Anfrage${quoteCount > 1 ? "n" : ""} senden`;
    if (quoteCount > 0)
      return `${quoteCount} Anfrage${quoteCount > 1 ? "n" : ""} senden & Plan speichern`;
    return "Plan speichern";
  })();

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f7f4ee] pb-36">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="border-b border-[rgba(23,23,23,0.08)] bg-[#fffdf8] px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Link href="/events" className="mb-4 inline-flex text-sm text-[#8b7767] hover:text-[#171717]">
            ← Zurück
          </Link>
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#b76a43]">
            Event Planner
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#171717]">
            Dienstleister für deinen {OCCASION_LABELS[occasion] ?? occasion}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            {cityDisplay && <Chip>{cityDisplay}</Chip>}
            {guests > 0  && <Chip>{guests} Gäste</Chip>}
            {date        && (
              <Chip>
                {new Date(date).toLocaleDateString("de-DE", {
                  day: "2-digit", month: "2-digit", year: "numeric",
                })}
              </Chip>
            )}
            {budget > 0  && <Chip>Budget {budget.toLocaleString("de-DE")} €</Chip>}
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">

        {/* Event-Name */}
        <div className="mb-8">
          <label className="mb-1.5 block text-sm font-medium text-[#171717]">
            Event-Name <span className="text-[#b76a43]">*</span>
          </label>
          <input
            type="text"
            value={eventTitle}
            onChange={(e) => setEventTitle(e.target.value)}
            placeholder="z.B. Weihnachtsfeier 2026, Teambuilding Marketing"
            className="w-full rounded-2xl border border-[rgba(23,23,23,0.12)] bg-white px-4 py-3 text-sm text-[#171717] placeholder-[#8b7767] outline-none focus:border-[#171717] focus:ring-2 focus:ring-[rgba(23,23,23,0.08)]"
          />
        </div>

        {needs.length === 0 ? (
          <div className="rounded-[24px] border border-[rgba(23,23,23,0.08)] bg-white p-8 text-center text-[#665d55]">
            Kein Bedarf ausgewählt.{" "}
            <Link href="/events" className="underline">Zurück zum Wizard</Link>
          </div>
        ) : (
          <div className="space-y-10">
            {needs.map((needSlug) => {
              const vendors     = vendorsByNeed[needSlug] ?? [];
              const allVendors  = allVendorsByNeed[needSlug] ?? [];
              const expanded    = expandedNeeds.has(needSlug);
              const selection   = selections[needSlug] ?? null;
              const quoteVendor = quoteRequests[needSlug] ?? null;

              return (
                <section key={needSlug}>
                  {/* Need header */}
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl leading-none">
                        {NEED_ICON[needSlug] ?? "✨"}
                      </span>
                      <h2 className="text-lg font-semibold text-[#171717]">
                        {NEED_LABEL[needSlug] ?? needSlug}
                      </h2>
                      {selection && (
                        <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
                          ausgewählt
                        </span>
                      )}
                      {quoteVendor && !selection && (
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
                          Anfrage vorgemerkt
                        </span>
                      )}
                    </div>
                    {budget > 0 && needs.length > 0 && (
                      <span className="text-xs text-[#8b7767]">
                        ca. {Math.round(budget / needs.length).toLocaleString("de-DE")} € Budget
                      </span>
                    )}
                  </div>

                  {/* Loading skeleton */}
                  {loading ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-52 animate-pulse rounded-[20px] bg-[rgba(23,23,23,0.06)]" />
                      ))}
                    </div>
                  ) : vendors.length === 0 ? (

                    /* Empty state */
                    <div className="rounded-[20px] border border-[rgba(23,23,23,0.08)] bg-white px-5 py-6 text-center">
                      <p className="text-sm text-[#8b7767]">
                        Noch kein Partner in {cityDisplay || "deiner Stadt"} für diese Kategorie registriert.
                      </p>
                      <a
                        href={`mailto:partner@perfectday24.com?subject=Anbieter-Empfehlung: ${NEED_LABEL[needSlug] ?? needSlug} in ${cityDisplay}&body=Ich suche einen Anbieter für ${NEED_LABEL[needSlug] ?? needSlug} in ${cityDisplay}.`}
                        className="mt-3 inline-flex items-center gap-1 text-xs text-[#b76a43] underline-offset-2 hover:underline"
                      >
                        Anbieter empfehlen →
                      </a>
                    </div>
                  ) : (

                    /* Vendor cards grid */
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                        {vendors.map((vendor) => (
                          <VendorCard
                            key={vendor.id}
                            vendor={vendor}
                            isSelected={selection?.provider.id === vendor.id}
                            isQuoteRequested={quoteVendor?.id === vendor.id}
                            onOpen={() => openModal(needSlug, vendor)}
                          />
                        ))}
                      </div>

                      {/* "Alle anzeigen" toggle */}
                      {allVendors.length > VENDORS_VISIBLE_DEFAULT && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(needSlug)}
                          className="text-xs text-[#8b7767] underline-offset-2 hover:underline"
                        >
                          {expanded
                            ? "Weniger anzeigen"
                            : `Alle ${allVendors.length} Anbieter anzeigen`}
                        </button>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {/* ── Optional customer message (shows when there are quote requests) ── */}
        {quoteCount > 0 && (
          <div className="mt-10 rounded-[20px] border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <span className="text-xl">💬</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900">
                  {quoteCount} Preisanfrage{quoteCount > 1 ? "n" : ""} vorgemerkt
                </p>
                <p className="mt-0.5 text-xs text-amber-800">
                  Die Anbieter erhalten Ihre Eventdetails und melden sich mit einem Angebot.
                </p>
                {!showMessageBox ? (
                  <button
                    type="button"
                    onClick={() => setShowMessageBox(true)}
                    className="mt-2 text-xs text-amber-700 underline underline-offset-2"
                  >
                    + Persönliche Nachricht hinzufügen
                  </button>
                ) : (
                  <textarea
                    value={customerMessage}
                    onChange={(e) => setCustomerMessage(e.target.value)}
                    rows={3}
                    placeholder="z.B. besondere Anforderungen, Stil-Wünsche, Fragen …"
                    className="mt-2 w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-[#171717] outline-none focus:border-[#b76a43] resize-none"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Vendor detail modal ─────────────────────────────────────────── */}
      {modalState && (
        <VendorModal
          vendor={modalState.vendor}
          needSlug={modalState.needSlug}
          selectedPkgId={selections[modalState.needSlug]?.provider.id === modalState.vendor.id
            ? selections[modalState.needSlug].pkg.id
            : null}
          isQuoteRequested={quoteRequests[modalState.needSlug]?.id === modalState.vendor.id}
          guests={guests}
          onSelectPackage={selectPackage}
          onQuoteRequest={toggleQuoteRequest}
          onClose={closeModal}
        />
      )}

      {/* ── Sticky bottom bar ───────────────────────────────────────────── */}
      {!loading && (
        <div
        className="fixed bottom-0 left-0 right-0 z-[1200] border-t border-[rgba(23,23,23,0.08)] bg-[rgba(255,253,248,0.96)] px-4 pt-4 backdrop-blur-xl sm:px-6"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
      >
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8b7767]">
                {selectionCount > 0 && `${selectionCount} ausgewählt`}
                {selectionCount > 0 && quoteCount > 0 && " · "}
                {quoteCount > 0 && `${quoteCount} Anfrage${quoteCount > 1 ? "n" : ""}`}
                {totalActionCount === 0 && `0 von ${needs.length} Leistungen`}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                {selectionCount > 0 ? (
                  <>
                    <span className="text-2xl font-semibold text-[#171717]">
                      {totalEur.toLocaleString("de-DE")} €
                    </span>
                    <span className="text-xs text-[#8b7767]">Gesamt</span>
                    {overBudget && (
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                        über Budget
                      </span>
                    )}
                  </>
                ) : quoteCount > 0 ? (
                  <span className="text-sm text-[#665d55]">Preise werden angefragt</span>
                ) : (
                  <span className="text-sm text-[#8b7767]">Noch keine Auswahl</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || totalActionCount === 0}
              className="inline-flex min-h-11 items-center rounded-xl bg-[#171717] px-6 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40 hover:opacity-95"
            >
              {saveLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── VendorCard ───────────────────────────────────────────────────────────────

function VendorCard({
  vendor,
  isSelected,
  isQuoteRequested,
  onOpen,
}: {
  vendor: VendorWithScore;
  isSelected: boolean;
  isQuoteRequested: boolean;
  onOpen: () => void;
}) {
  const photo = vendor.media_urls?.[0] ?? null;
  const hasPackages = vendor.packages.length > 0;
  const bullets = vendor.packages[0]?.includes?.slice(0, 3) ?? [];

  const isHighlighted = isSelected || isQuoteRequested;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx(
        "flex w-full flex-col overflow-hidden rounded-[20px] border bg-white text-left transition active:scale-[0.98]",
        isHighlighted
          ? isQuoteRequested && !isSelected
            ? "border-amber-400 shadow-[0_4px_16px_rgba(183,106,67,0.12)]"
            : "border-[#171717] shadow-[0_4px_16px_rgba(23,23,23,0.10)]"
          : "border-[rgba(23,23,23,0.08)] hover:border-[rgba(23,23,23,0.18)] hover:shadow-[0_2px_8px_rgba(23,23,23,0.06)]"
      )}
    >
      {/* Hero image */}
      <div className="relative h-36 w-full shrink-0 overflow-hidden bg-[#f0ede7]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={vendor.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl opacity-30">
            🏢
          </div>
        )}
        {/* Badge */}
        {vendor.badge && (
          <span
            className={cx(
              "absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              BADGE_CLASS[vendor.badge]
            )}
          >
            {BADGE_LABEL[vendor.badge]}
          </span>
        )}
        {/* Verified checkmark */}
        {vendor.is_verified && (
          <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#171717] text-[9px] font-bold text-white">
            ✓
          </span>
        )}
        {/* Selected / quote overlay ribbon */}
        {(isSelected || isQuoteRequested) && (
          <div className={cx(
            "absolute inset-x-0 bottom-0 px-3 py-1.5 text-[11px] font-semibold",
            isSelected
              ? "bg-[#171717]/80 text-white"
              : "bg-amber-400/90 text-amber-900"
          )}>
            {isSelected ? "Ausgewählt ✓" : "Anfrage vorgemerkt ✓"}
          </div>
        )}
      </div>

      {/* Info body */}
      <div className="flex flex-1 flex-col p-3.5">
        {/* Name */}
        <p className="line-clamp-1 text-sm font-semibold leading-snug text-[#171717]">
          {vendor.name}
        </p>

        {/* Slogan / description */}
        {vendor.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#665d55]">
            {vendor.description}
          </p>
        )}

        {/* Bullet points from first package */}
        {bullets.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-1.5 text-[11px] text-[#665d55]">
                <span className="mt-px shrink-0 text-emerald-600">✓</span>
                <span className="line-clamp-1">{b}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Price row */}
        <div className="mt-auto flex items-center justify-between pt-3">
          <p className="text-xs font-medium text-[#8b7767]">
            {hasPackages && vendor.minPrice > 0
              ? `ab ${vendor.minPrice.toLocaleString("de-DE")} €`
              : "Preis auf Anfrage"}
          </p>
          <span className="text-xs font-medium text-[#b76a43]">
            Details →
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── VendorModal ──────────────────────────────────────────────────────────────

function VendorModal({
  vendor,
  needSlug,
  selectedPkgId,
  isQuoteRequested,
  guests,
  onSelectPackage,
  onQuoteRequest,
  onClose,
}: {
  vendor: VendorWithScore;
  needSlug: string;
  selectedPkgId: string | null;
  isQuoteRequested: boolean;
  guests: number;
  onSelectPackage: (needSlug: string, vendor: VendorWithScore, pkg: VendorPackage) => void;
  onQuoteRequest: (needSlug: string, vendor: VendorWithScore) => void;
  onClose: () => void;
}) {
  const photo = vendor.media_urls?.[0] ?? null;
  const hasPackages = vendor.packages.length > 0;

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    // Lock body scroll
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[1500] flex items-end justify-center sm:items-center sm:p-4"
      onClick={onClose}
    >
      {/* Scrim */}
      <div className="absolute inset-0 bg-[#171717]/40 backdrop-blur-[2px]" />

      {/* Sheet */}
      <div
        className="relative z-10 flex max-h-[90dvh] w-full flex-col overflow-hidden bg-white sm:max-w-lg sm:rounded-[28px] rounded-t-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-[rgba(23,23,23,0.15)]" />
        </div>

        {/* Hero image */}
        <div className="relative h-48 w-full shrink-0 overflow-hidden bg-[#f0ede7] sm:h-56">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={vendor.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-5xl opacity-25">🏢</div>
          )}
          {vendor.badge && (
            <span
              className={cx(
                "absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                BADGE_CLASS[vendor.badge]
              )}
            >
              {BADGE_LABEL[vendor.badge]}
            </span>
          )}
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#171717]/60 text-white transition hover:bg-[#171717]/80"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-8 pt-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold leading-tight text-[#171717]">{vendor.name}</h2>
              {vendor.is_verified && (
                <p className="mt-0.5 text-xs font-medium text-emerald-600">Verifizierter Anbieter ✓</p>
              )}
            </div>
            {vendor.minPrice > 0 && (
              <p className="shrink-0 text-sm font-semibold text-[#171717]">
                ab {vendor.minPrice.toLocaleString("de-DE")} €
              </p>
            )}
          </div>

          {/* Description */}
          {vendor.description && (
            <p className="mt-3 text-sm leading-relaxed text-[#665d55]">{vendor.description}</p>
          )}

          {/* Packages or quote-request */}
          {hasPackages ? (
            <div className="mt-5">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-[#8b7767]">Pakete</p>
              <div className="space-y-2.5">
                {vendor.packages.map((pkg) => {
                  const isSelected = selectedPkgId === pkg.id;
                  const total = guests > 0 && pkg.price_type === "per_person"
                    ? pkg.price * guests
                    : pkg.price;
                  const priceLabel = pkg.price_type === "per_person" && guests > 0
                    ? `${pkg.price.toLocaleString("de-DE")} €/P. · ${total.toLocaleString("de-DE")} € gesamt`
                    : `${total.toLocaleString("de-DE")} €`;

                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => onSelectPackage(needSlug, vendor, pkg)}
                      className={cx(
                        "w-full rounded-[18px] border p-4 text-left transition",
                        isSelected
                          ? "border-[#171717] bg-[#171717]"
                          : "border-[rgba(23,23,23,0.10)] bg-[#fafaf8] hover:border-[rgba(23,23,23,0.22)]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className={cx("font-semibold text-sm", isSelected ? "text-white" : "text-[#171717]")}>
                            {pkg.name}
                          </p>
                          {pkg.description && (
                            <p className={cx("mt-0.5 text-xs leading-relaxed", isSelected ? "text-white/70" : "text-[#8b7767]")}>
                              {pkg.description}
                            </p>
                          )}
                          {pkg.includes && pkg.includes.length > 0 && (
                            <ul className="mt-2 space-y-0.5">
                              {pkg.includes.map((inc) => (
                                <li key={inc} className={cx("flex items-start gap-1.5 text-[11px]", isSelected ? "text-white/70" : "text-[#665d55]")}>
                                  <span className={cx("mt-px shrink-0", isSelected ? "text-white/60" : "text-emerald-600")}>✓</span>
                                  <span>{inc}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={cx("text-sm font-bold", isSelected ? "text-white" : "text-[#171717]")}>
                            {priceLabel}
                          </p>
                          {isSelected && (
                            <p className="mt-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">
                              Ausgewählt ✓
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* No packages → quote request */
            <div className="mt-5">
              <button
                type="button"
                onClick={() => onQuoteRequest(needSlug, vendor)}
                className={cx(
                  "w-full rounded-[18px] border px-4 py-3.5 text-sm font-semibold transition",
                  isQuoteRequested
                    ? "border-amber-400 bg-amber-50 text-amber-800"
                    : "border-[rgba(183,106,67,0.4)] bg-white text-[#b76a43] hover:border-[#b76a43] hover:bg-[rgba(183,106,67,0.05)]"
                )}
              >
                {isQuoteRequested ? "Anfrage vorgemerkt ✓" : "Preise anfragen"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[rgba(23,23,23,0.10)] bg-white px-3 py-1 text-xs text-[#665d55]">
      {children}
    </span>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function PlanNewPage() {
  return (
    <Suspense>
      <PlanNewInner />
    </Suspense>
  );
}
