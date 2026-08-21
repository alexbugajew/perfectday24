"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { EVENT_SUPPORTED_CITY_OPTIONS } from "@/lib/cities/planner-support";
import { CitySearchInput } from "@/components/ui/CitySearchInput";

// ─── Static data (mirrors the DB seed) ────────────────────────────────────────

const OCCASIONS = [
  { slug: "geburtstag", label: "Geburtstag", hint: "Runde Geburtstage & private Feiern", emoji: "🎂" },
  { slug: "hochzeit", label: "Hochzeit", hint: "Trauung, Feier & Flitterwochen", emoji: "💍" },
  { slug: "teambuilding", label: "Teambuilding", hint: "Ausflüge & Aktivitäten für Teams", emoji: "🤝" },
  { slug: "firmenfeier", label: "Firmenfeier", hint: "Weihnachts-, Sommer- oder Jubiläumsfeier", emoji: "🥂" },
  { slug: "kindergeburtstag", label: "Kindergeburtstag", hint: "Feiern für die Kleinsten", emoji: "🎈" },
  { slug: "konferenz", label: "Konferenz", hint: "Fachveranstaltungen & Workshops", emoji: "🎤" },
  { slug: "jubilaeum", label: "Jubiläum", hint: "Runde Jahrestage & Meilensteine", emoji: "🏆" },
  { slug: "staedtereise", label: "Städtereise", hint: "Gruppenreisen mit kuratiertem Programm", emoji: "✈️" },
] as const;

type OccasionSlug = (typeof OCCASIONS)[number]["slug"];

const NEEDS_BY_OCCASION: Record<OccasionSlug, { slug: string; label: string; required: boolean }[]> = {
  geburtstag: [
    { slug: "location",   label: "Location",           required: true  },
    { slug: "catering",   label: "Catering",           required: true  },
    { slug: "torte",      label: "Geburtstagstorte",   required: false },
    { slug: "musik",      label: "Musik / DJ",         required: false },
    { slug: "deko",       label: "Dekoration",         required: false },
    { slug: "fotografie", label: "Fotografie",         required: false },
    { slug: "moderation", label: "Moderator",          required: false },
  ],
  hochzeit: [
    { slug: "location",   label: "Hochzeitslocation",  required: true  },
    { slug: "catering",   label: "Catering / Menü",    required: true  },
    { slug: "florist",    label: "Florist",            required: false },
    { slug: "fotografie", label: "Fotografie",         required: true  },
    { slug: "video",      label: "Videograf",          required: false },
    { slug: "musik",      label: "Band / DJ",          required: false },
    { slug: "torte",      label: "Hochzeitstorte",     required: false },
    { slug: "deko",       label: "Dekoration",         required: false },
    { slug: "moderation", label: "Freie/r Redner/in",  required: false },
  ],
  teambuilding: [
    { slug: "location",   label: "Veranstaltungsort",  required: true  },
    { slug: "animation",  label: "Teamaktivität",      required: true  },
    { slug: "catering",   label: "Catering",           required: false },
    { slug: "moderation", label: "Moderator",          required: false },
    { slug: "transport",  label: "Transport",          required: false },
    { slug: "technik",    label: "Technik / AV",       required: false },
  ],
  firmenfeier: [
    { slug: "location",   label: "Location",           required: true  },
    { slug: "catering",   label: "Catering / Buffet",  required: true  },
    { slug: "musik",      label: "Musik / DJ",         required: false },
    { slug: "deko",       label: "Dekoration",         required: false },
    { slug: "moderation", label: "Moderator",          required: false },
    { slug: "technik",    label: "Technik / AV",       required: false },
    { slug: "fotografie", label: "Fotografie",         required: false },
  ],
  kindergeburtstag: [
    { slug: "location",   label: "Location",           required: true  },
    { slug: "animation",  label: "Animateur",          required: true  },
    { slug: "catering",   label: "Fingerfood / Büfett",required: false },
    { slug: "torte",      label: "Geburtstagstorte",   required: false },
    { slug: "deko",       label: "Dekoration",         required: false },
  ],
  konferenz: [
    { slug: "location",   label: "Konferenzräume",     required: true  },
    { slug: "technik",    label: "Technik / AV",       required: true  },
    { slug: "catering",   label: "Catering / Coffee",  required: false },
    { slug: "moderation", label: "Moderator",          required: false },
    { slug: "fotografie", label: "Eventfotografie",    required: false },
  ],
  jubilaeum: [
    { slug: "location",   label: "Location",           required: true  },
    { slug: "catering",   label: "Catering",           required: true  },
    { slug: "deko",       label: "Dekoration",         required: false },
    { slug: "fotografie", label: "Fotografie",         required: false },
    { slug: "musik",      label: "Musik",              required: false },
    { slug: "moderation", label: "Laudator / Redner",  required: false },
  ],
  staedtereise: [
    { slug: "location",   label: "Hotel / Unterkunft", required: true  },
    { slug: "transport",  label: "Transfer",           required: false },
    { slug: "catering",   label: "Restaurantauswahl",  required: false },
    { slug: "animation",  label: "Stadtführung",       required: false },
    { slug: "fotografie", label: "Fotografie",         required: false },
  ],
};

// Städte kommen statisch aus der Rollout-Config (EVENT_SUPPORTED_CITY_OPTIONS).

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

type FormState = {
  occasionSlug: OccasionSlug | "";
  city: string;
  date: string;
  guests: string;
  budgetCents: string;
  selectedNeeds: string[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function progressWidth(step: Step) {
  return `${(step / 3) * 100}%`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepHeader({ step, label }: { step: Step; label: string }) {
  return (
    <div className="mb-6">
      <div className="pd24-kicker-warm">
        Schritt {step} von 3
      </div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-strong)]">{label}</h2>
    </div>
  );
}

const NEED_ICONS: Record<string, string> = {
  location: "📍",
  catering: "🍽️",
  musik: "🎵",
  deko: "🎨",
  moderation: "🎤",
  transport: "🚐",
  fotografie: "📸",
  video: "🎥",
  florist: "🌷",
  torte: "🎂",
  animation: "🎪",
  technik: "🎛️",
};

function NeedToggle({
  slug,
  label,
  required,
  selected,
  onToggle,
}: {
  slug: string;
  label: string;
  required: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const icon = NEED_ICONS[slug] ?? "✨";
  return (
    <button
      type="button"
      onClick={required ? undefined : onToggle}
      disabled={required}
      aria-pressed={selected}
      className={cx(
        "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition",
        selected
          ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
          : "border-[var(--line-strong)] bg-white text-[var(--text-strong)] hover:border-[var(--text-strong)]",
        required && "cursor-default opacity-80"
      )}
    >
      <span
        aria-hidden
        className={cx(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg",
          selected ? "bg-white/15" : "bg-[rgba(23,23,23,0.05)]"
        )}
      >
        {icon}
      </span>
      <span className="flex-1 font-medium">{label}</span>
      {required && (
        <span
          className={cx(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            selected ? "bg-white/20 text-white" : "bg-[rgba(23,23,23,0.08)] text-[var(--text-muted-warm)]"
          )}
        >
          Pflicht
        </span>
      )}
    </button>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SavedPlan = {
  id: string;
  title: string | null;
  occasion_slug: string;
  city_slug: string;
  event_date: string | null;
  guest_count: number | null;
  status: string;
  created_at: string;
  pending_quotes: number;
  received_quotes: number;
};

// ─── SavedPlanCard ────────────────────────────────────────────────────────────

function SavedPlanCard({
  plan,
  onDelete,
}: {
  plan: SavedPlan;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  const dateFormatted = plan.event_date
    ? new Date(plan.event_date).toLocaleDateString("de-DE", {
        day: "2-digit", month: "short", year: "numeric",
      })
    : null;

  const createdFormatted = new Date(plan.created_at).toLocaleDateString("de-DE", {
    day: "2-digit", month: "short",
  });

  const occasionLabel = OCCASIONS.find((o) => o.slug === plan.occasion_slug)?.label
    ?? plan.occasion_slug;

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(false);
    const ok = await onDelete(plan.id);
    setDeleting(false);
    if (!ok) setDeleteError(true);
  }

  return (
    <div
      className={cx(
        "flex flex-col gap-2 rounded-[var(--radius-card-sm)] border p-4 shadow-sm transition",
        confirming
          ? "border-[rgba(161,75,69,0.24)] bg-[rgba(161,75,69,0.04)]"
          : "border-[var(--line-subtle)] bg-white hover:border-[rgba(23,23,23,0.2)] hover:shadow-md"
      )}
    >
      {/* Main clickable area */}
      <div className="flex items-start justify-between gap-2">
        <a
          href={`/feiern/plan/${plan.id}`}
          className="group min-w-0 flex-1"
        >
          <p className="truncate font-semibold text-[var(--text-strong)] text-sm leading-snug group-hover:underline underline-offset-2">
            {plan.title ?? occasionLabel}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-soft-warm)]">
            {occasionLabel}
            {dateFormatted && ` · ${dateFormatted}`}
          </p>
        </a>

        {/* Delete trigger */}
        {!confirming && (
          <button
            type="button"
            aria-label="Plan löschen"
            onClick={() => setConfirming(true)}
            className="-my-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--text-soft-warm)] transition hover:bg-[rgba(161,75,69,0.08)] hover:text-[var(--state-error)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={1.75} strokeLinecap="round"
              strokeLinejoin="round" className="h-3.5 w-3.5"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {plan.guest_count && (
          <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] px-2 py-0.5 text-[10px] text-[var(--text-muted-warm)]">
            {plan.guest_count} Gäste
          </span>
        )}
        {plan.received_quotes > 0 && (
          <span className="pd24-status-success rounded-full px-2 py-0.5 text-[10px] font-medium">
            {plan.received_quotes} Angebot{plan.received_quotes > 1 ? "e" : ""} eingegangen
          </span>
        )}
        {plan.pending_quotes > 0 && (
          <span className="pd24-status-warning rounded-full px-2 py-0.5 text-[10px] font-medium">
            {plan.pending_quotes} Anfrage{plan.pending_quotes > 1 ? "n" : ""} ausstehend
          </span>
        )}
      </div>

      <p className="text-[10px] text-[var(--text-soft-warm)]">Erstellt {createdFormatted}</p>

      {(plan.pending_quotes > 0 || plan.received_quotes > 0) && (
        <a
          href={`/feiern/plan/${plan.id}?tab=offers`}
          className="pd24-status-success inline-flex min-h-9 items-center justify-center rounded-full px-3 text-xs font-medium transition hover:opacity-90"
        >
          Anfragen & Angebote prüfen
        </a>
      )}

      {/* Inline confirmation */}
      {confirming && (
        <div className="mt-1 flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[rgba(161,75,69,0.24)] bg-white px-3 py-2.5">
          <p className="text-xs text-[var(--state-error)] font-medium">
            {deleteError
              ? "Löschen fehlgeschlagen — bitte erneut versuchen."
              : "Plan wirklich löschen?"}
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="rounded-lg border border-[var(--line-strong)] bg-white px-3 py-1 text-xs font-medium text-[var(--text-muted-warm)] transition hover:border-[rgba(23,23,23,0.25)] disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-[var(--state-error)] px-3 py-1 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {deleting ? "…" : "Löschen"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EventsPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  // Alle Rollout-Städte (704) — Dienstleister sind überall importiert, das
  // Planner-Sichtbarkeits-Gate gilt hier bewusst nicht (Marburg & Co. haben
  // Vendors, auch wenn der Tagesplaner dort noch versteckt ist).
  const cityOptions = EVENT_SUPPORTED_CITY_OPTIONS;
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [form, setForm] = useState<FormState>({
    occasionSlug: "",
    city: "",
    date: "",
    guests: "",
    budgetCents: "",
    selectedNeeds: [],
  });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setPlansLoading(false); return; }

      const { data: plans } = await supabase
        .from("event_plans")
        .select(`
          id, title, occasion_slug, city_slug, event_date,
          guest_count, status, created_at,
          event_inquiries (
            vendor_quotes ( status )
          )
        `)
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (plans) {
        const mapped: SavedPlan[] = (plans as unknown as Array<{
          id: string;
          title: string | null;
          occasion_slug: string;
          city_slug: string;
          event_date: string | null;
          guest_count: number | null;
          status: string;
          created_at: string;
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
            status: p.status,
            created_at: p.created_at,
            pending_quotes:  allQuotes.filter((q) => q.status === "pending" || q.status === "viewed").length,
            received_quotes: allQuotes.filter((q) => q.status === "quoted" || q.status === "accepted").length,
          };
        });
        setSavedPlans(mapped);
      }
      setPlansLoading(false);
    });
  }, []);

  async function deletePlan(id: string): Promise<boolean> {
    const { error } = await supabase.from("event_plans").delete().eq("id", id);
    if (error) {
      console.error("Event-Plan löschen fehlgeschlagen:", error.message);
      return false;
    }
    setSavedPlans((prev) => prev.filter((p) => p.id !== id));
    return true;
  }

  // Whenever the occasion changes, pre-select all required needs.
  function selectOccasion(slug: OccasionSlug) {
    const needs = NEEDS_BY_OCCASION[slug];
    setForm((prev) => ({
      ...prev,
      occasionSlug: slug,
      selectedNeeds: needs.filter((n) => n.required).map((n) => n.slug),
    }));
  }

  function toggleNeed(slug: string) {
    setForm((prev) => ({
      ...prev,
      selectedNeeds: prev.selectedNeeds.includes(slug)
        ? prev.selectedNeeds.filter((s) => s !== slug)
        : [...prev.selectedNeeds, slug],
    }));
  }

  function canAdvance() {
    if (step === 1) return form.occasionSlug !== "";
    if (step === 2) return form.city !== "" && form.guests !== "";
    return true;
  }

  function handleFinish() {
    const params = new URLSearchParams();
    params.set("occasion", form.occasionSlug);
    params.set("city", form.city);
    if (form.date) params.set("date", form.date);
    if (form.guests) params.set("guests", form.guests);
    if (form.budgetCents) params.set("budget", form.budgetCents);
    if (form.selectedNeeds.length) params.set("needs", form.selectedNeeds.join(","));
    router.push(`/feiern/plan/new?${params.toString()}`);
  }

  const needs =
    form.occasionSlug !== "" ? NEEDS_BY_OCCASION[form.occasionSlug] : [];

  return (
    <div className="min-h-screen bg-[var(--bg-canvas-warm)] pb-20 pt-8">
      <div className="pd24-page-narrow">

        {/* Back-Link + Dashboard-Link */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/explore"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--line-subtle)] bg-white px-3.5 text-xs font-medium text-[var(--text-muted-warm)] transition hover:text-[var(--text-strong)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Entdecken
          </Link>
          <Link
            href="/feiern/dashboard"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--line-subtle)] bg-white px-3.5 text-xs font-medium text-[var(--text-muted-warm)] transition hover:text-[var(--text-strong)]"
          >
            Meine Events →
          </Link>
        </div>

        {/* Page header */}
        <div className="mb-10">
          <div className="pd24-kicker-warm">
            Event-Planer
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--text-strong)]">
            Plane einen größeren Anlass.
          </h1>
          <p className="mt-3 text-base leading-7 text-[var(--text-muted-warm)]">
            Für Gäste, Teams und besondere Anlässe.
          </p>

        </div>

        {/* Wizard card */}
        <div className="overflow-hidden rounded-[var(--radius-hero)] border border-[var(--line-subtle)] bg-[var(--bg-surface-warm)] shadow-[0_24px_64px_rgba(49,39,27,0.12)]">

          {/* Progress bar */}
          <div className="h-1 w-full bg-[rgba(23,23,23,0.06)]">
            <div
              className="h-1 rounded-full bg-[var(--text-strong)] transition-all duration-300"
              style={{ width: progressWidth(step) }}
            />
          </div>

          <div className="px-7 py-8 sm:px-8">

            {/* ── Step 1: Anlass ── */}
            {step === 1 && (
              <div>
                <StepHeader step={1} label="Was planst du?" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {OCCASIONS.map((occ) => {
                    const selected = form.occasionSlug === occ.slug;
                    return (
                      <button
                        key={occ.slug}
                        type="button"
                        onClick={() => selectOccasion(occ.slug)}
                        className={cx(
                          "group relative overflow-hidden rounded-2xl text-left transition focus-visible:outline-none active:scale-[0.97]",
                          selected
                            ? "ring-2 ring-[var(--brand-warm-deep)] ring-offset-2 shadow-lg"
                            : "shadow-sm hover:shadow-md"
                        )}
                        style={{ height: 160 }}
                      >
                        {/* Foto */}
                        <Image
                          src={`/feiern/occasion-${occ.slug}.png`}
                          alt={occ.label}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                        />
                        {/* Gradient-Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

                        {/* Ausgewählt-Badge */}
                        {selected && (
                          <div className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-warm-deep)] shadow">
                            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="h-3 w-3">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </div>
                        )}

                        {/* Text */}
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{occ.emoji}</span>
                            <span className="text-sm font-bold text-white drop-shadow leading-tight">
                              {occ.label}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[10px] leading-3.5 text-white/75 line-clamp-2">
                            {occ.hint}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Step 2: Eckdaten ── */}
            {step === 2 && (
              <div>
                <StepHeader step={2} label="Eckdaten festlegen" />
                <div className="space-y-4">

                  {/* Stadt */}
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--text-soft-warm)]">
                      Stadt *
                    </label>
                    <CitySearchInput
                      cities={cityOptions}
                      value={form.city}
                      onChange={(v) => setForm((f) => ({ ...f, city: v }))}
                      placeholder="Stadt suchen …"
                    />
                  </div>

                  {/* Datum & Gäste nebeneinander */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="event-date"
                        className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--text-soft-warm)]"
                      >
                        Datum (optional)
                      </label>
                      <input
                        id="event-date"
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                        className="w-full rounded-2xl border border-[var(--line-strong)] bg-white px-4 py-3 text-sm text-[var(--text-strong)] focus:border-[var(--text-strong)] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="event-guests"
                        className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--text-soft-warm)]"
                      >
                        Gäste *
                      </label>
                      <input
                        id="event-guests"
                        type="number"
                        min="1"
                        placeholder="z.B. 50"
                        value={form.guests}
                        onChange={(e) => setForm((f) => ({ ...f, guests: e.target.value }))}
                        className="w-full rounded-2xl border border-[var(--line-strong)] bg-white px-4 py-3 text-sm text-[var(--text-strong)] focus:border-[var(--text-strong)] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Budget */}
                  <div>
                    <label
                      htmlFor="event-budget"
                      className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--text-soft-warm)]"
                    >
                      Budget in € (optional)
                    </label>
                    <input
                      id="event-budget"
                      type="number"
                      min="0"
                      step="100"
                      placeholder="z.B. 5000"
                      value={form.budgetCents}
                      onChange={(e) => setForm((f) => ({ ...f, budgetCents: e.target.value }))}
                      className="w-full rounded-2xl border border-[var(--line-strong)] bg-white px-4 py-3 text-sm text-[var(--text-strong)] focus:border-[var(--text-strong)] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Bedarfsliste ── */}
            {step === 3 && (
              <div>
                <StepHeader step={3} label="Was braucht dein Event?" />
                <p className="mb-5 text-sm leading-6 text-[var(--text-muted-warm)]">
                  Pflichtpositionen sind bereits aktiv. Wähle zusätzlich, was du brauchst.
                </p>
                <div className="space-y-2">
                  {needs.map((need) => (
                    <NeedToggle
                      key={need.slug}
                      slug={need.slug}
                      label={need.label}
                      required={need.required}
                      selected={form.selectedNeeds.includes(need.slug)}
                      onToggle={() => toggleNeed(need.slug)}
                    />
                  ))}
                </div>

                {/* Summary strip */}
                <div className="mt-6 rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[rgba(249,243,235,0.7)] px-5 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-soft-warm)]">
                    Dein Event auf einen Blick
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1 text-xs text-[var(--text-muted-warm)]">
                      {OCCASIONS.find((o) => o.slug === form.occasionSlug)?.label}
                    </span>
                    <span className="rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1 text-xs text-[var(--text-muted-warm)]">
                      {cityOptions.find((c) => c.slug === form.city)?.name ?? form.city}
                    </span>
                    {form.guests && (
                      <span className="rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1 text-xs text-[var(--text-muted-warm)]">
                        {form.guests} Gäste
                      </span>
                    )}
                    {form.date && (
                      <span className="rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1 text-xs text-[var(--text-muted-warm)]">
                        {new Date(form.date).toLocaleDateString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </span>
                    )}
                    <span className="rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1 text-xs text-[var(--text-muted-warm)]">
                      {form.selectedNeeds.length} Leistungen
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-8 flex items-center justify-between gap-3">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s - 1) as Step)}
                  className="pd24-btn pd24-btn-secondary"
                >
                  Zurück
                </button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s + 1) as Step)}
                  disabled={!canAdvance()}
                  className="pd24-btn pd24-btn-primary"
                >
                  Weiter
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinish}
                  className="pd24-btn pd24-btn-primary"
                >
                  Dienstleister anzeigen
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <p className="mt-6 text-center text-xs text-[var(--text-soft-warm)]">
          Kein Account nötig für die Planung. Speichern und Teilen erfordert eine kostenlose Anmeldung.
        </p>

        {/* Saved plans */}
        {(plansLoading || savedPlans.length > 0) && (
          <div className="mt-10">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--text-strong)]">Meine gespeicherten Pläne</h2>
              {savedPlans.length > 0 && (
                <a
                  href="/feiern/dashboard"
                  className="text-xs font-medium text-[var(--text-soft-warm)] underline-offset-2 hover:underline"
                >
                  Alle ansehen →
                </a>
              )}
            </div>

            {plansLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-white p-4"
                  >
                    <div className="h-4 w-1/2 rounded-full bg-[rgba(23,23,23,0.07)]" />
                    <div className="mt-2 h-3 w-1/3 rounded-full bg-[rgba(23,23,23,0.05)]" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {savedPlans.slice(0, 3).map((plan) => (
                  <SavedPlanCard key={plan.id} plan={plan} onDelete={deletePlan} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
