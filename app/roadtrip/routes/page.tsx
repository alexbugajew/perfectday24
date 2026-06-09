"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchPublicRoadtripRoutes, fetchMyRoadtripRoutes, fetchActiveRoadtrip } from "@/lib/roadtrip/client";
import {
  type RoadtripRoute,
  occasionLabel,
  budgetLabel,
  ROADTRIP_TAGS,
} from "@/lib/roadtrip/types";
import { getRoadtripCoverArt } from "@/lib/roadtrip/cover-art";

// ─── Route Card ───────────────────────────────────────────────────────────────

function RouteCard({ route }: { route: RoadtripRoute }) {
  const sequence = route.stops.map((s) => s.cityLabel).join(" -> ");
  const tagDefs = ROADTRIP_TAGS.filter((t) => route.tags.includes(t.value)).slice(0, 3);
  const totalNights = route.stops.reduce((s, st) => s + st.nights, 0);
  const coverArt = getRoadtripCoverArt(route);
  const firstStop = route.stops[0]?.cityLabel ?? "Start";
  const lastStop = route.stops[route.stops.length - 1]?.cityLabel ?? "Ziel";

  return (
    <Link
      href={`/roadtrip/routes/${route.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--line-subtle)] bg-white transition hover:shadow-[0_4px_20px_rgba(15,23,42,0.1)] hover:border-[rgba(23,23,23,0.2)]"
    >
      {/* Cover placeholder — gradient with city count badge */}
      <div className="relative h-40 overflow-hidden border-b border-white/10" style={{ backgroundImage: coverArt.backgroundImage }}>
        <div className="absolute inset-0 opacity-80" style={{ backgroundImage: coverArt.orbImage }} />
        <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),transparent)]" />
        <div className="absolute -right-10 top-4 h-24 w-24 rounded-full bg-white/10 blur-2xl transition-transform duration-500 group-hover:scale-125" />
        <div className="absolute -left-6 bottom-3 h-20 w-20 rounded-full bg-black/10 blur-2xl transition-transform duration-500 group-hover:scale-110" />
        <div className="absolute inset-0 flex flex-col justify-between p-3.5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="inline-flex rounded-full border border-white/20 bg-white/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] backdrop-blur-sm">
              {coverArt.eyebrow}
            </div>
            {route.is_featured && (
              <div className="rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
                Featured
              </div>
            )}
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/72">
                {firstStop} {"->"} {lastStop}
              </div>
              <div className="mt-1 max-w-[16rem] text-sm font-medium leading-5 text-white/92">
                {coverArt.scene}
              </div>
            </div>
            <div
              className="shrink-0 rounded-2xl border border-white/18 bg-black/14 px-3 py-2 text-right shadow-[0_12px_30px_rgba(15,23,42,0.18)] backdrop-blur-sm"
              style={{ boxShadow: `0 12px 30px ${coverArt.accent}33` }}
            >
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/65">Vibe</div>
              <div className="mt-0.5 text-lg font-semibold leading-none text-white">{coverArt.icon}</div>
            </div>
          </div>
        </div>

        {/* Stop count badge */}
        <div className="absolute bottom-2 left-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-3 w-3">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          {route.stops.length} Staedte / {totalNights} Naechte
        </div>

      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h3 className="font-semibold text-[var(--text-strong)] leading-snug group-hover:text-[#b76a43] transition-colors">
            {route.title}
          </h3>
          <p className="mt-1 min-h-[2rem] text-[11px] leading-4 text-[var(--text-muted)] line-clamp-2">
            {sequence}
          </p>
        </div>

        {route.description && (
          <p className="text-xs leading-relaxed text-[var(--text-muted)] line-clamp-2">
            {route.description}
          </p>
        )}

        {/* Tags */}
        {tagDefs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tagDefs.map((tag) => (
              <span
                key={tag.value}
                className="rounded-full border border-[rgba(23,23,23,0.08)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]"
              >
                {tag.emoji} {tag.label}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between pt-1 text-[11px] text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <span>{occasionLabel(route.occasion)}</span>
            <span>/</span>
            <span>{budgetLabel(route.budget)}</span>
          </div>
          {route.clone_count > 0 && (
            <span className="flex items-center gap-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-3 w-3">
                <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                <path d="M9 18H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
              </svg>
              {route.clone_count}×
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RoadtripRoutesPage() {
  const [publicRoutes, setPublicRoutes] = useState<RoadtripRoute[]>([]);
  const [myRoutes, setMyRoutes] = useState<RoadtripRoute[]>([]);
  const [activeRoadtrip, setActiveRoadtrip] = useState<RoadtripRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [pub, mine, active] = await Promise.all([
        fetchPublicRoadtripRoutes(48),
        fetchMyRoadtripRoutes(),
        fetchActiveRoadtrip(),
      ]);
      setPublicRoutes(pub);
      setMyRoutes(mine);
      setActiveRoadtrip(active);
      setLoading(false);
    })();
  }, []);

  // Filter
  const filteredPublic = publicRoutes.filter((r) => {
    if (tagFilter !== "all" && !r.tags.includes(tagFilter)) return false;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.stops.some((s) => s.cityLabel.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const myRoutesFiltered = myRoutes.filter((r) => {
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        r.stops.some((s) => s.cityLabel.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const activeStops = activeRoadtrip?.stops ?? [];
  const activeTotal = activeStops.reduce((s, st) => s + st.nights, 0);

  return (
    <main className="pd24-page-wide space-y-6">

      {/* ── Aktiver Roadtrip Banner ───────────────────────────────────────── */}
      {activeRoadtrip && (
        <section className="relative overflow-hidden rounded-2xl border border-[rgba(183,106,67,0.3)] bg-[linear-gradient(135deg,rgba(183,106,67,0.09),rgba(90,118,136,0.07))] px-4 py-4 shadow-[0_2px_16px_rgba(183,106,67,0.12)]">
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[rgba(183,106,67,0.12)] blur-2xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#b76a43] text-xl text-white shadow-sm">
                🚀
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#b76a43]">
                    Aktiver Roadtrip
                  </span>
                  <span className="animate-pulse h-2 w-2 rounded-full bg-[#b76a43]" />
                </div>
                <p className="mt-0.5 font-semibold text-[var(--text-strong)]">
                  {activeRoadtrip.title}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {activeStops.map((s) => s.cityLabel).join(" -> ")}
                  {activeTotal > 0 && ` / ${activeTotal} Naechte`}
                </p>
              </div>
            </div>
            <Link
              href={`/roadtrip?fromRouteSlug=${activeRoadtrip.slug}`}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#b76a43] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#9d5a38] active:scale-[0.97]"
            >
              Fortsetzen →
            </Link>
          </div>
        </section>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft)]">
        <div className="bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(229,234,238,0.92))] p-4 sm:p-5 lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-subtle)] bg-white px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
                <Link href="/explore" className="hover:text-[var(--text-strong)] transition">Entdecken</Link>
                <span>/</span>
                <span>Roadtrip-Routen</span>
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text-strong)] sm:text-4xl">
                Roadtrip-Routen
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                Entdecke Mehrtagsrouten von echten Reisenden. Übernimm eine Route als Vorlage
                und plane deinen Roadtrip mit einem Klick — inklusive Hotels pro Stadt.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/roadtrip/discover"
                className="inline-flex items-center gap-2 rounded-full border border-amber-400 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
              >
                🗺️ Route entdecken
              </Link>
              <Link
                href="/roadtrip"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--text-strong)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f2937]"
              >
                + Eigene Route erstellen
              </Link>
            </div>
          </div>

          {/* Search + Tag filter */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Titel, Stadt oder Beschreibung suchen…"
              className="h-10 w-full min-w-0 rounded-xl border border-black/10 bg-white px-3 text-sm text-[var(--text-strong)] outline-none shadow-sm transition focus:border-[var(--text-strong)] sm:max-w-sm"
            />
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setTagFilter("all")}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${tagFilter === "all" ? "border-black bg-black text-white" : "border-black/10 bg-white text-gray-700 hover:border-black/25"}`}
              >
                Alle
              </button>
              {ROADTRIP_TAGS.map((tag) => (
                <button
                  key={tag.value}
                  type="button"
                  onClick={() => setTagFilter(tag.value === tagFilter ? "all" : tag.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${tagFilter === tag.value ? "border-black bg-black text-white" : "border-black/10 bg-white text-gray-700 hover:border-black/25"}`}
                >
                  {tag.emoji} {tag.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Meine Routen ───────────────────────────────────────────────────── */}
      {myRoutesFiltered.length > 0 && (
        <section className="space-y-3">
          <h2 className="px-1 text-sm font-semibold text-[var(--text-strong)]">Meine Routen</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {myRoutesFiltered.map((r) => (
              <RouteCard key={r.id} route={r} />
            ))}
          </div>
        </section>
      )}

      {/* ── Public routes ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        {myRoutesFiltered.length > 0 && (
          <h2 className="px-1 text-sm font-semibold text-[var(--text-strong)]">
            Öffentliche Routen
            {filteredPublic.length > 0 && (
              <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
                {filteredPublic.length} Treffer
              </span>
            )}
          </h2>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-[rgba(23,23,23,0.06)]" />
            ))}
          </div>
        ) : filteredPublic.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredPublic.map((r) => (
              <RouteCard key={r.id} route={r} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[rgba(23,23,23,0.15)] bg-[var(--bg-surface)] px-6 py-10 text-center">
            <div className="text-3xl mb-2">🗺️</div>
            <div className="font-semibold text-[var(--text-strong)]">
              {searchText || tagFilter !== "all"
                ? "Keine passenden Routen gefunden"
                : "Noch keine öffentlichen Routen"}
            </div>
            <p className="mt-1.5 mx-auto max-w-xs text-sm text-[var(--text-muted)]">
              {searchText || tagFilter !== "all"
                ? "Ändere die Suchkriterien oder erstelle deine eigene Route."
                : "Sei der Erste — erstelle eine Route und teile sie mit der Community."}
            </p>
            <Link
              href="/roadtrip"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--text-strong)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1f2937]"
            >
              Route erstellen →
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
