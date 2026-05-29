"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchRoadtripRouteBySlug,
  incrementRouteViews,
  incrementRouteClones,
} from "@/lib/roadtrip/client";
import {
  type RoadtripRoute,
  stopArrivalDate,
  occasionLabel,
  budgetLabel,
  ROADTRIP_TAGS,
} from "@/lib/roadtrip/types";
import HotelSearchLinks from "@/components/roadtrip/HotelSearchLinks";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateDE(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RoadtripRouteDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();

  const [route, setRoute] = useState<RoadtripRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Date customisation when using as template
  const [startDate, setStartDate] = useState(todayStr());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!params?.slug) return;

    (async () => {
      setLoading(true);
      const r = await fetchRoadtripRouteBySlug(params.slug);
      if (!r) {
        setNotFound(true);
      } else {
        setRoute(r);
        // Track view (fire-and-forget)
        incrementRouteViews(r.id);
      }
      setLoading(false);
    })();
  }, [params?.slug]);

  async function copyShareLink() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      prompt("Link kopieren:", url);
    }
  }

  function useAsTemplate() {
    if (!route) return;
    incrementRouteClones(route.id);

    // Build query params for /roadtrip with the route pre-loaded
    const params = new URLSearchParams({
      fromRouteId: route.id,
      fromRouteSlug: route.slug,
      startDate,
    });
    router.push(`/roadtrip?${params}`);
  }

  // ── Loading / Not Found ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="pd24-page-wide space-y-4">
        <div className="rounded-xl border border-[var(--line-subtle)] bg-white px-6 py-8 text-sm text-[var(--text-muted)]">
          Route wird geladen…
        </div>
      </main>
    );
  }

  if (notFound || !route) {
    return (
      <main className="pd24-page-wide space-y-4">
        <div className="rounded-xl border border-[var(--line-subtle)] bg-white px-6 py-8 text-center">
          <div className="text-2xl mb-2">🔍</div>
          <div className="font-semibold text-[var(--text-strong)]">Route nicht gefunden</div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Der Link ist ungültig oder die Route wurde gelöscht.
          </p>
          <Link
            href="/roadtrip/routes"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--text-strong)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1f2937]"
          >
            Alle Roadtrip-Routen →
          </Link>
        </div>
      </main>
    );
  }

  const totalNights = route.stops.reduce((s, st) => s + st.nights, 0);
  const tagDefs = ROADTRIP_TAGS.filter((t) => route.tags.includes(t.value));

  return (
    <main className="pd24-page-wide space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-xl border border-[var(--line-subtle)] bg-white px-5 py-5 shadow-[var(--shadow-soft)]">
        <div className="pointer-events-none absolute right-[-4rem] top-[-4rem] h-48 w-48 rounded-full bg-[rgba(183,106,67,0.1)] blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-3rem] left-[30%] h-36 w-36 rounded-full bg-[rgba(90,118,136,0.1)] blur-3xl" />

        <div className="relative">
          {/* Breadcrumb */}
          <div className="mb-3 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <Link href="/explore" className="hover:text-[var(--text-strong)] transition">Entdecken</Link>
            <span>/</span>
            <Link href="/roadtrip/routes" className="hover:text-[var(--text-strong)] transition">Roadtrip-Routen</Link>
            <span>/</span>
            <span className="text-[var(--text-strong)]">{route.title}</span>
          </div>

          {/* Chips */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="warm-chip rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
              Roadtrip
            </span>
            <span className="rounded-full border border-[var(--line-subtle)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
              {route.stops.length} Städte · {totalNights} Nächte
            </span>
            <span className="rounded-full border border-[var(--line-subtle)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
              {occasionLabel(route.occasion)}
            </span>
            <span className="rounded-full border border-[var(--line-subtle)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
              {budgetLabel(route.budget)}
            </span>
            {route.clone_count > 0 && (
              <span className="rounded-full border border-[var(--line-subtle)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                {route.clone_count}× nachgefahren
              </span>
            )}
          </div>

          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-[var(--text-strong)] sm:text-3xl">
            {route.title}
          </h1>

          {route.description && (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
              {route.description}
            </p>
          )}

          {/* Author */}
          {route.author_name && (
            <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(23,23,23,0.08)] text-[10px] font-semibold">
                {route.author_name.slice(0, 1).toUpperCase()}
              </div>
              <span>von <strong className="text-[var(--text-strong)]">{route.author_name}</strong></span>
              <span>·</span>
              <span>{new Date(route.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}</span>
            </div>
          )}

          {/* Tags */}
          {tagDefs.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tagDefs.map((tag) => (
                <span
                  key={tag.value}
                  className="rounded-full border border-[rgba(23,23,23,0.08)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]"
                >
                  {tag.emoji} {tag.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Route stops ────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold text-[var(--text-strong)]">
          Reiseroute — {route.stops.map((s) => s.cityLabel).join(" → ")}
        </h2>

        {route.stops.map((stop, idx) => {
          const arrivalDate = stopArrivalDate(startDate, route.stops, idx);
          const departureDate = addDays(arrivalDate, stop.nights);

          return (
            <div
              key={`${stop.citySlug}-${idx}`}
              className="overflow-hidden rounded-xl border border-[var(--line-subtle)] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]"
            >
              {/* Stop header */}
              <div className="flex items-start gap-3 px-4 py-3.5">
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--text-strong)] text-[10px] font-bold text-white">
                    {idx + 1}
                  </div>
                  {idx < route.stops.length - 1 && (
                    <div className="w-px bg-[rgba(23,23,23,0.12)]" style={{ height: 16 }} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[var(--text-strong)]">{stop.cityLabel}</div>
                      <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {showDatePicker
                          ? `${formatDateDE(arrivalDate)} → ${formatDateDE(departureDate)}`
                          : `${stop.nights} ${stop.nights === 1 ? "Nacht" : "Nächte"}`}
                      </div>
                    </div>
                    <span className="rounded-full bg-[rgba(23,23,23,0.06)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                      {stop.nights} {stop.nights === 1 ? "Nacht" : "Nächte"}
                    </span>
                  </div>

                  {/* Plan summary */}
                  {stop.planSummary && (
                    <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)] italic">
                      {stop.planSummary}
                    </p>
                  )}
                </div>
              </div>

              {/* Hotel links */}
              <div className="border-t border-[rgba(23,23,23,0.05)] px-4 pb-3 pt-2.5">
                <HotelSearchLinks
                  cityLabel={stop.cityLabel}
                  checkin={arrivalDate}
                  checkout={departureDate}
                  nights={stop.nights}
                  adults={2}
                  citySlug={stop.citySlug}
                />
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Use as template CTA ────────────────────────────────────────────── */}
      <section className="rounded-xl border border-[var(--line-subtle)] bg-white px-4 py-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-[var(--text-strong)]">Diese Route planen</div>
            <div className="mt-0.5 text-sm text-[var(--text-muted)]">
              Route als Vorlage in den Roadtrip-Planner übernehmen
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Date chooser toggle */}
            <button
              type="button"
              onClick={() => setShowDatePicker((v) => !v)}
              className="rounded-xl border border-[var(--line-subtle)] px-3 py-2 text-sm text-[var(--text-muted)] transition hover:bg-[var(--bg-surface)]"
            >
              {showDatePicker ? "Datum ausblenden" : "Startdatum wählen"}
            </button>

            {showDatePicker && (
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-xl border border-[var(--line-subtle)] bg-white px-3 py-2 text-sm text-[var(--text-strong)] outline-none focus:border-[rgba(23,23,23,0.4)]"
              />
            )}

            <button
              type="button"
              onClick={useAsTemplate}
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--text-strong)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1f2937] active:scale-[0.97]"
            >
              Route planen
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* ── Share section ───────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[var(--text-strong)]">Route teilen</div>
            <div className="mt-0.5 text-xs text-[var(--text-muted)]">
              Teile diesen Link mit Freunden oder deiner Reisegruppe
            </div>
          </div>
          <div className="flex items-center gap-2">
            <code className="hidden rounded-lg border border-[var(--line-subtle)] bg-white px-2.5 py-1 text-xs text-[var(--text-muted)] sm:block">
              {typeof window !== "undefined" ? window.location.href.slice(0, 60) : ""}…
            </code>
            <button
              type="button"
              onClick={copyShareLink}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition ${
                copied
                  ? "bg-emerald-600 text-white"
                  : "border border-[var(--line-subtle)] bg-white text-[var(--text-strong)] hover:bg-[var(--bg-panel)]"
              }`}
            >
              {copied ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Kopiert!
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
                    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  Link kopieren
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ── Planner CTA footer ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[rgba(23,23,23,0.03)] px-4 py-3 text-xs text-[var(--text-muted)]">
        <span>
          Willst du einen eigenen Roadtrip planen?
        </span>
        <Link
          href="/roadtrip"
          className="rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1.5 font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)]"
        >
          Neuen Roadtrip erstellen →
        </Link>
      </div>
    </main>
  );
}
