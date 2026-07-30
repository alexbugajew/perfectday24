"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

type EventPlanRow = {
  id: string;
  title: string | null;
  occasion_slug: string;
  city_slug: string | null;
  event_date: string | null;
  guest_count: number | null;
  budget_cents: number | null;
  status: string;
  created_at: string;
  share_token: string | null;
  pending_quotes: number;
  received_quotes: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const OCCASION_MAP: Record<string, { label: string; emoji: string }> = {
  geburtstag: { label: "Geburtstag", emoji: "🎂" },
  hochzeit: { label: "Hochzeit", emoji: "💍" },
  teambuilding: { label: "Teambuilding", emoji: "🤝" },
  firmenfeier: { label: "Firmenfeier", emoji: "🥂" },
  kindergeburtstag: { label: "Kindergeburtstag", emoji: "🎈" },
  konferenz: { label: "Konferenz", emoji: "🎤" },
  jubilaeum: { label: "Jubiläum", emoji: "🏆" },
  staedtereise: { label: "Städtereise", emoji: "✈️" },
};

function occasionInfo(slug: string) {
  return OCCASION_MAP[slug] ?? { label: slug, emoji: "🗓" };
}

function formatEventDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}

function formatBudget(cents: number | null) {
  if (!cents) return null;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);
}

function cityLabel(slug: string | null) {
  if (!slug) return null;
  return slug.split("-").filter(Boolean).map((p) => {
    const m: Record<string, string> = { muenchen: "München", koeln: "Köln", duesseldorf: "Düsseldorf" };
    return m[p.toLowerCase()] ?? (p.charAt(0).toUpperCase() + p.slice(1));
  }).join(" ");
}

function statusBadge(status: string) {
  if (status === "active")    return { label: "Aktiv",         cls: "bg-emerald-100 text-emerald-700" };
  if (status === "completed") return { label: "Abgeschlossen", cls: "bg-sky-100 text-sky-700" };
  if (status === "cancelled") return { label: "Abgesagt",      cls: "bg-red-100 text-red-600" };
  return { label: "Entwurf", cls: "bg-amber-100 text-amber-700" };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded-full bg-[var(--bg-panel)]" />
          <div className="h-5 w-48 rounded-full bg-[var(--bg-panel)]" />
        </div>
        <div className="h-6 w-20 rounded-full bg-[var(--bg-panel)]" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-6 w-28 rounded-full bg-[var(--bg-panel)]" />
        <div className="h-6 w-20 rounded-full bg-[var(--bg-panel)]" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-9 w-28 rounded-full bg-[var(--bg-panel)]" />
        <div className="h-9 w-24 rounded-full bg-[var(--bg-panel)]" />
      </div>
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({
  plan,
  onDelete,
}: {
  plan: EventPlanRow;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const info = occasionInfo(plan.occasion_slug);
  const badge = statusBadge(plan.status);
  const dateStr = formatEventDate(plan.event_date);
  const budget = formatBudget(plan.budget_cents);
  const city = cityLabel(plan.city_slug);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(false);
    const ok = await onDelete(plan.id);
    setDeleting(false);
    if (ok) {
      setConfirming(false);
    } else {
      setDeleteError(true);
    }
  }

  return (
    <div className={`rounded-[var(--radius-card)] border bg-[var(--bg-panel-strong)] p-5 shadow-sm transition hover:shadow-md ${
      confirming ? "border-red-200" : "border-[var(--line-subtle)]"
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 text-2xl leading-none">{info.emoji}</span>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              {info.label}
            </div>
            <h3 className="mt-0.5 line-clamp-1 text-base font-semibold text-[var(--text-strong)]">
              {plan.title?.trim() || info.label}
            </h3>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${badge.cls}`}>
            {badge.label}
          </span>
          {!confirming && (
            <button
              type="button"
              aria-label="Event löschen"
              onClick={() => setConfirming(true)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-soft)] transition hover:bg-red-50 hover:text-red-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Meta chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {dateStr && (
          <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
            📅 {dateStr}
          </span>
        )}
        {plan.guest_count && (
          <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
            👥 {plan.guest_count} Gäste
          </span>
        )}
        {city && (
          <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
            📍 {city}
          </span>
        )}
        {budget && (
          <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
            💶 {budget}
          </span>
        )}
      </div>

      {/* Quote status */}
      {(plan.pending_quotes > 0 || plan.received_quotes > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {plan.received_quotes > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {plan.received_quotes} Angebot{plan.received_quotes > 1 ? "e" : ""} erhalten
            </div>
          )}
          {plan.pending_quotes > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              {plan.pending_quotes} ausstehend
            </div>
          )}
        </div>
      )}

      {/* Actions / Confirm delete */}
      {confirming ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50/60 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-red-700">Event dauerhaft löschen?</p>
            <p role="status" className="text-xs text-red-600">
              {deleteError ? "Event konnte nicht gelöscht werden. Bitte versuche es erneut." : ""}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => setConfirming(false)} disabled={deleting}
              className="rounded-xl border border-[var(--line-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:border-[var(--line-strong)] disabled:opacity-50">
              Abbrechen
            </button>
            <button type="button" onClick={handleDelete} disabled={deleting}
              className="rounded-xl bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-600 disabled:opacity-50">
              {deleting ? "…" : "Ja, löschen"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/events/plan/${plan.id}`}
            className="inline-flex min-h-9 items-center rounded-full bg-[var(--text-strong)] px-4 text-sm font-medium text-white transition hover:opacity-90"
          >
            Event öffnen
          </Link>
          {(plan.pending_quotes > 0 || plan.received_quotes > 0) && (
            <Link
              href={`/events/plan/${plan.id}?tab=offers`}
              className="inline-flex min-h-9 items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
            >
              Angebote prüfen
            </Link>
          )}
          {plan.share_token && (
            <Link
              href={`/events/agenda/${plan.share_token}`}
              className="inline-flex min-h-9 items-center rounded-full border border-[var(--line-subtle)] px-4 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)]"
            >
              Agenda ansehen
            </Link>
          )}
          <Link
            href={`/events?occasion=${plan.occasion_slug}`}
            className="inline-flex min-h-9 items-center rounded-full border border-[var(--line-subtle)] px-4 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)]"
          >
            Neu planen
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "active" | "draft" | "completed";

function EventsDashboardContent() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [plans, setPlans] = useState<EventPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUserId(data.session?.user?.id ?? null);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
      setAuthReady(true);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const loadPlans = useCallback(async () => {
    if (!userId) { setPlans([]); setLoading(false); return; }
    setLoading(true);
    setHasError(false);
    try {
      const { data, error } = await supabase
        .from("event_plans")
        .select(`
          id, title, occasion_slug, city_slug, event_date,
          guest_count, budget_cents, status, created_at, share_token,
          event_inquiries ( vendor_quotes ( status ) )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) { console.error("Events dashboard load error:", error); setHasError(true); return; }

      const mapped: EventPlanRow[] = ((data ?? []) as Array<{
        id: string; title: string | null; occasion_slug: string; city_slug: string | null;
        event_date: string | null; guest_count: number | null; budget_cents: number | null;
        status: string; created_at: string; share_token: string | null;
        event_inquiries: Array<{ vendor_quotes: Array<{ status: string }> }>;
      }>).map((p) => {
        const allQuotes = p.event_inquiries.flatMap((i) => i.vendor_quotes);
        return {
          id: p.id,
          title: p.title,
          occasion_slug: p.occasion_slug,
          city_slug: p.city_slug,
          event_date: p.event_date,
          guest_count: p.guest_count,
          budget_cents: p.budget_cents,
          status: p.status,
          created_at: p.created_at,
          share_token: p.share_token,
          pending_quotes:  allQuotes.filter((q) => q.status === "pending" || q.status === "viewed").length,
          received_quotes: allQuotes.filter((q) => q.status === "quoted"  || q.status === "accepted").length,
        };
      });
      setPlans(mapped);
    } catch (err) {
      console.error("Events dashboard load error:", err);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (authReady) void loadPlans();
  }, [authReady, loadPlans]);

  async function deletePlan(id: string): Promise<boolean> {
    const { error } = await supabase.from("event_plans").delete().eq("id", id);
    if (error) {
      console.error("Event delete error:", error);
      return false;
    }
    setPlans((prev) => prev.filter((p) => p.id !== id));
    return true;
  }

  // ── Not logged in ──
  if (authReady && !userId) {
    return (
      <div className="pd24-page-narrow py-16 text-center">
        <div className="rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-8 shadow-[var(--shadow-soft)]">
          <div className="pd24-kicker mb-3">Events</div>
          <h1 className="text-xl font-semibold text-[var(--text-strong)]">Bitte anmelden</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Melde dich an, um deine Event-Planungen zu sehen und zu verwalten.
          </p>
          <Link href="/profile?return=/events/dashboard"
            className="mt-5 inline-flex min-h-10 items-center rounded-2xl bg-[var(--text-strong)] px-5 text-sm font-medium text-white transition hover:opacity-90">
            Zum Login
          </Link>
        </div>
      </div>
    );
  }

  const filtered = plans.filter((p) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "draft") return p.status === "draft" || p.status === "new";
    return p.status === statusFilter;
  });

  const counts = {
    all:       plans.length,
    active:    plans.filter((p) => p.status === "active").length,
    draft:     plans.filter((p) => p.status === "draft" || p.status === "new").length,
    completed: plans.filter((p) => p.status === "completed").length,
  };

  // Stats for header
  const totalQuotes = plans.reduce((s, p) => s + p.received_quotes, 0);
  const pendingTotal = plans.reduce((s, p) => s + p.pending_quotes, 0);

  return (
    <div className="pd24-page-wide space-y-6">

      {/* ── Header ── */}
      <section className="pd24-shell p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="pd24-kicker">Event-Dashboard</div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-3xl">
              Meine Events
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              Alle deine Veranstaltungen – Geburtstage, Feiern, Teamevents und mehr.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/events"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--text-strong)] px-5 text-sm font-medium text-white transition hover:opacity-95">
              Neues Event planen
            </Link>
            <Link href="/saved"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--line-subtle)] px-5 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)]">
              Alle Pläne
            </Link>
          </div>
        </div>

        {/* Summary stats */}
        {!loading && plans.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Events gesamt",    value: plans.length,   icon: "🗓" },
              { label: "Aktive Events",    value: counts.active,  icon: "⚡" },
              { label: "Angebote erhalten", value: totalQuotes,   icon: "📬" },
              { label: "Ausstehend",        value: pendingTotal,  icon: "⏳" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] px-4 py-3">
                <div className="text-xl">{stat.icon}</div>
                <div className="mt-1 text-2xl font-semibold text-[var(--text-strong)]">{stat.value}</div>
                <div className="mt-0.5 text-xs text-[var(--text-muted)]">{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Filters ── */}
      {!loading && plans.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(["all", "active", "draft", "completed"] as StatusFilter[]).map((key) => {
            const labels: Record<StatusFilter, string> = {
              all: "Alle", active: "Aktive", draft: "Entwürfe", completed: "Abgeschlossen",
            };
            const active = statusFilter === key;
            return (
              <button key={key} type="button" onClick={() => setStatusFilter(key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                    : "border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] text-[var(--text-muted)] hover:bg-[var(--bg-surface)]"
                }`}>
                {labels[key]}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  active ? "bg-white/20 text-white" : "bg-[var(--bg-surface)] text-[var(--text-muted)]"
                }`}>{counts[key]}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : hasError ? (
        <div className="rounded-[var(--radius-shell)] border border-red-200 bg-red-50/60 px-6 py-12 text-center">
          <div className="text-3xl">⚠️</div>
          <h2 className="mt-3 text-lg font-semibold text-[var(--text-strong)]">Events konnten nicht geladen werden</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Bitte prüfe deine Internetverbindung und versuche es erneut.
          </p>
          <button
            type="button"
            onClick={() => void loadPlans()}
            className="mt-5 inline-flex min-h-10 items-center rounded-2xl bg-[var(--text-strong)] px-5 text-sm font-medium text-white transition hover:opacity-90"
          >
            Erneut laden
          </button>
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-[var(--radius-shell)] border border-dashed border-[var(--line-subtle)] bg-[var(--bg-surface)] px-6 py-12 text-center">
          <div className="text-3xl">🗓</div>
          <h2 className="mt-3 text-lg font-semibold text-[var(--text-strong)]">Noch keine Events geplant</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Plane deinen ersten Geburtstag, JGA, Teamtag oder eine Firmenfeier.
          </p>
          <Link href="/events"
            className="mt-5 inline-flex min-h-10 items-center rounded-2xl bg-[var(--text-strong)] px-5 text-sm font-medium text-white transition hover:opacity-90">
            Event anlegen →
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--line-subtle)] bg-[var(--bg-surface)] px-6 py-8 text-center text-sm text-[var(--text-muted)]">
          Keine Events für diesen Filter.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((plan) => (
            <EventCard key={plan.id} plan={plan} onDelete={deletePlan} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function EventsDashboardPage() {
  return (
    <Suspense fallback={
      <div className="pd24-page-wide animate-pulse space-y-6">
        <div className="rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-8">
          <div className="h-6 w-32 rounded-full bg-[var(--bg-panel)]" />
          <div className="mt-3 h-8 w-56 rounded-full bg-[var(--bg-panel)]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-surface)]" />
          ))}
        </div>
      </div>
    }>
      <EventsDashboardContent />
    </Suspense>
  );
}
