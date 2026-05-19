"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

type Package = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  price_unit: string;
  min_guests: number | null;
  max_guests: number | null;
  includes: string[];
  sort_order?: number | null;
};

type Provider = {
  id: string;
  name: string;
  service_type: string;
  description: string | null;
  is_verified: boolean;
  packages: Package[];
};

type Selection = {
  needSlug: string;
  provider: Provider;
  pkg: Package;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CITY_SLUG_MAP: Record<string, string> = {
  "Berlin":      "berlin-berlin",
  "Hamburg":     "hamburg",
  "München":     "muenchen",
  "Wien":        "wien",
  "Zürich":      "zuerich",
  "Köln":        "koeln",
  "Frankfurt":   "frankfurt-am-main",
  "Stuttgart":   "stuttgart",
  "Düsseldorf":  "duesseldorf",
  "Leipzig":     "leipzig",
};

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
  geburtstag: "Geburtstag", hochzeit: "Hochzeit", teambuilding: "Teambuilding",
  firmenfeier: "Firmenfeier", kindergeburtstag: "Kindergeburtstag",
  konferenz: "Konferenz", jubilaeum: "Jubiläum", staedtereise: "Städtereise",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(cents: number, unit: string, guests: number) {
  const base = cents / 100;
  if (unit === "per_person") {
    const total = base * guests;
    return `${base.toLocaleString("de-DE")} €/P. · ca. ${total.toLocaleString("de-DE")} €`;
  }
  return `${base.toLocaleString("de-DE")} €`;
}

function priceTotal(pkg: Package, guests: number): number {
  if (pkg.price_unit === "per_person") return (pkg.price_cents / 100) * Math.max(guests, 1);
  return pkg.price_cents / 100;
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// ─── Inner page (uses useSearchParams) ────────────────────────────────────────

function PlanNewInner() {
  const router = useRouter();
  const params = useSearchParams();

  const occasion = params.get("occasion") ?? "";
  const city     = params.get("city") ?? "";
  const date     = params.get("date") ?? "";
  const guests   = parseInt(params.get("guests") ?? "0", 10) || 0;
  const budget   = parseInt(params.get("budget") ?? "0", 10) || 0;
  const needs    = (params.get("needs") ?? "").split(",").filter(Boolean);

  const [providersByNeed, setProvidersByNeed] = useState<Record<string, Provider[]>>({});
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [saving, setSaving] = useState(false);
  const [expandedIncludes, setExpandedIncludes] = useState<Record<string, boolean>>({});

  const citySlug = CITY_SLUG_MAP[city] ?? city.toLowerCase();

  useEffect(() => {
    if (!needs.length || !citySlug) { setLoading(false); return; }

    const serviceTypes = [...new Set(needs.flatMap((n) => NEED_SERVICE_TYPES[n] ?? []))];
    if (!serviceTypes.length) { setLoading(false); return; }

    (async () => {
      const { data: rows, error } = await supabase
        .from("service_providers")
        .select(`
          id, name, service_type, description, is_verified,
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
        console.error("service_providers query failed:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        setLoading(false);
        return;
      }

      const byNeed: Record<string, Provider[]> = {};
      for (const need of needs) {
        const types = NEED_SERVICE_TYPES[need] ?? [];
        byNeed[need] = (rows ?? [])
          .filter((p) => types.includes(p.service_type))
          .map((p) => ({
            ...p,
            packages: ((p.provider_packages ?? []) as Package[])
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
          }));
      }
      setProvidersByNeed(byNeed);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citySlug, needs.join(",")]);

  function togglePackage(needSlug: string, provider: Provider, pkg: Package) {
    setSelections((prev) => {
      const existing = prev[needSlug];
      if (existing?.pkg.id === pkg.id) {
        const next = { ...prev };
        delete next[needSlug];
        return next;
      }
      return { ...prev, [needSlug]: { needSlug, provider, pkg } };
    });
  }

  function toggleIncludes(pkgId: string) {
    setExpandedIncludes((prev) => ({ ...prev, [pkgId]: !prev[pkgId] }));
  }

  const totalEur = Object.values(selections).reduce(
    (sum, s) => sum + priceTotal(s.pkg, guests),
    0
  );
  const overBudget = budget > 0 && totalEur > budget;

  async function handleSave() {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      const returnUrl = encodeURIComponent(window.location.href);
      router.push(`/login?return=${returnUrl}`);
      return;
    }

    const planData = {
      user_id:        session.user.id,
      occasion_slug:  occasion,
      city_slug:      citySlug,
      event_date:     date || null,
      guest_count:    guests || null,
      budget_cents:   budget ? budget * 100 : null,
      selected_needs: needs,
      status:         "planning",
    };

    const { data: plan, error: planErr } = await supabase
      .from("event_plans")
      .insert(planData)
      .select("id")
      .single();

    if (planErr || !plan) {
      setSaving(false);
      return;
    }

    const bookings = Object.values(selections).map((s) => ({
      event_plan_id:       plan.id,
      service_provider_id: s.provider.id,
      provider_package_id: s.pkg.id,
      need_slug:           s.needSlug,
      price_cents_agreed:  s.pkg.price_unit === "per_person"
        ? s.pkg.price_cents * Math.max(guests, 1)
        : s.pkg.price_cents,
      status: "interested",
    }));

    if (bookings.length) {
      await supabase.from("event_bookings").insert(bookings);
    }

    router.push(`/events/plan/${plan.id}`);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f7f4ee] pb-32">

      {/* Header */}
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
            {city && <Chip>{city}</Chip>}
            {guests > 0 && <Chip>{guests} Gäste</Chip>}
            {date && (
              <Chip>
                {new Date(date).toLocaleDateString("de-DE", {
                  day: "2-digit", month: "2-digit", year: "numeric",
                })}
              </Chip>
            )}
            {budget > 0 && <Chip>Budget {budget.toLocaleString("de-DE")} €</Chip>}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="space-y-4">
            {needs.map((n) => (
              <div key={n} className="h-32 animate-pulse rounded-[24px] bg-[rgba(23,23,23,0.06)]" />
            ))}
          </div>
        ) : needs.length === 0 ? (
          <div className="rounded-[24px] border border-[rgba(23,23,23,0.08)] bg-white p-8 text-center text-[#665d55]">
            Kein Bedarf ausgewählt.{" "}
            <Link href="/events" className="underline">
              Zurück zum Wizard
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {needs.map((needSlug) => {
              const providers = providersByNeed[needSlug] ?? [];
              const selected = selections[needSlug];

              return (
                <section key={needSlug}>
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-[#171717]">
                      {NEED_LABEL[needSlug] ?? needSlug}
                    </h2>
                    {selected && (
                      <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
                        ausgewählt
                      </span>
                    )}
                  </div>

                  {providers.length === 0 ? (
                    <div className="rounded-[20px] border border-[rgba(23,23,23,0.08)] bg-white px-5 py-4 text-sm text-[#8b7767]">
                      Für {city} noch keine Dienstleister eingetragen — kommt bald.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {providers.map((provider) => (
                        <div
                          key={provider.id}
                          className={cx(
                            "rounded-[24px] border bg-white p-5 transition",
                            selected?.provider.id === provider.id
                              ? "border-[#171717] shadow-[0_4px_16px_rgba(23,23,23,0.1)]"
                              : "border-[rgba(23,23,23,0.08)]"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-[#171717]">{provider.name}</span>
                                {provider.is_verified && (
                                  <span className="rounded-full bg-[rgba(23,23,23,0.07)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#665d55]">
                                    Verifiziert
                                  </span>
                                )}
                              </div>
                              {provider.description && (
                                <p className="mt-1 text-sm leading-6 text-[#665d55]">
                                  {provider.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Packages */}
                          <div className="mt-4 space-y-2">
                            {provider.packages.map((pkg) => {
                              const isSelected =
                                selected?.provider.id === provider.id &&
                                selected?.pkg.id === pkg.id;
                              const showIncludes = expandedIncludes[pkg.id];

                              return (
                                <div
                                  key={pkg.id}
                                  className={cx(
                                    "rounded-[18px] border p-4 transition",
                                    isSelected
                                      ? "border-[#171717] bg-[#171717]"
                                      : "border-[rgba(23,23,23,0.1)] bg-[#fafaf8] hover:border-[rgba(23,23,23,0.2)]"
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div
                                        className={cx(
                                          "font-medium",
                                          isSelected ? "text-white" : "text-[#171717]"
                                        )}
                                      >
                                        {pkg.name}
                                      </div>
                                      {pkg.description && (
                                        <div
                                          className={cx(
                                            "mt-0.5 text-xs",
                                            isSelected ? "text-white/70" : "text-[#8b7767]"
                                          )}
                                        >
                                          {pkg.description}
                                        </div>
                                      )}
                                      <div
                                        className={cx(
                                          "mt-1 text-sm font-semibold",
                                          isSelected ? "text-white" : "text-[#171717]"
                                        )}
                                      >
                                        {formatPrice(pkg.price_cents, pkg.price_unit, guests)}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => togglePackage(needSlug, provider, pkg)}
                                      className={cx(
                                        "shrink-0 rounded-xl border px-3 py-1.5 text-xs font-medium transition",
                                        isSelected
                                          ? "border-white/30 bg-white/15 text-white hover:bg-white/25"
                                          : "border-[rgba(23,23,23,0.15)] bg-white text-[#171717] hover:border-[#171717]"
                                      )}
                                    >
                                      {isSelected ? "Abwählen" : "Wählen"}
                                    </button>
                                  </div>

                                  {/* Includes toggle */}
                                  {pkg.includes && pkg.includes.length > 0 && (
                                    <div className="mt-3">
                                      <button
                                        type="button"
                                        onClick={() => toggleIncludes(pkg.id)}
                                        className={cx(
                                          "text-xs underline-offset-2 hover:underline",
                                          isSelected ? "text-white/60" : "text-[#8b7767]"
                                        )}
                                      >
                                        {showIncludes ? "Weniger" : `Enthält ${pkg.includes.length} Leistungen`}
                                      </button>
                                      {showIncludes && (
                                        <ul className="mt-2 space-y-1">
                                          {pkg.includes.map((item) => (
                                            <li
                                              key={item}
                                              className={cx(
                                                "text-xs",
                                                isSelected ? "text-white/75" : "text-[#665d55]"
                                              )}
                                            >
                                              — {item}
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky bottom bar */}
      {!loading && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[rgba(23,23,23,0.08)] bg-[rgba(255,253,248,0.96)] px-4 py-4 backdrop-blur-xl sm:px-6">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8b7767]">
                {Object.keys(selections).length} von {needs.length} Leistungen gewählt
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-[#171717]">
                  {totalEur.toLocaleString("de-DE")} €
                </span>
                <span className="text-xs text-[#8b7767]">Gesamt</span>
                {overBudget && (
                  <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                    über Budget
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || Object.keys(selections).length === 0}
              className="inline-flex min-h-11 items-center rounded-xl bg-[#171717] px-6 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40 hover:opacity-95"
            >
              {saving ? "Speichern …" : "Plan speichern"}
            </button>
          </div>
        </div>
      )}
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

export default function PlanNewPage() {
  return (
    <Suspense>
      <PlanNewInner />
    </Suspense>
  );
}
