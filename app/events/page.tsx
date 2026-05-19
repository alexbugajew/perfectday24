"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isPlannerSupportedCitySlug } from "@/lib/cities/planner-support";
import { CitySearchInput } from "@/components/ui/CitySearchInput";

// ─── Static data (mirrors the DB seed) ────────────────────────────────────────

const OCCASIONS = [
  { slug: "geburtstag",       label: "Geburtstag",        hint: "Runde Geburtstage & private Feiern" },
  { slug: "hochzeit",         label: "Hochzeit",          hint: "Trauung, Feier & Flitterwochen" },
  { slug: "teambuilding",     label: "Teambuilding",      hint: "Ausflüge & Aktivitäten für Teams" },
  { slug: "firmenfeier",      label: "Firmenfeier",       hint: "Weihnachts-, Sommer- oder Jubiläumsfeier" },
  { slug: "kindergeburtstag", label: "Kindergeburtstag",  hint: "Feiern für die Kleinsten" },
  { slug: "konferenz",        label: "Konferenz",         hint: "Fachveranstaltungen & Workshops" },
  { slug: "jubilaeum",        label: "Jubiläum",          hint: "Runde Jahrestage & Meilensteine" },
  { slug: "staedtereise",     label: "Städtereise",       hint: "Gruppenreisen mit kuratiertem Programm" },
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

// Loaded from DB — see cityOptions state in EventWizard

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
      <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#b76a43]">
        Schritt {step} von 3
      </div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171717]">{label}</h2>
    </div>
  );
}

function NeedToggle({
  label,
  required,
  selected,
  onToggle,
}: {
  label: string;
  required: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={required ? undefined : onToggle}
      disabled={required}
      aria-pressed={selected}
      className={cx(
        "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition",
        selected
          ? "border-[#171717] bg-[#171717] text-white"
          : "border-[rgba(23,23,23,0.12)] bg-white text-[#171717] hover:border-[#171717]",
        required && "cursor-default opacity-80"
      )}
    >
      <span className="font-medium">{label}</span>
      {required && (
        <span
          className={cx(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            selected ? "bg-white/20 text-white" : "bg-[rgba(23,23,23,0.08)] text-[#665d55]"
          )}
        >
          Pflicht
        </span>
      )}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EventsPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [cityOptions, setCityOptions] = useState<{ slug: string; name: string }[]>([]);
  const [form, setForm] = useState<FormState>({
    occasionSlug: "",
    city: "",
    date: "",
    guests: "",
    budgetCents: "",
    selectedNeeds: [],
  });

  useEffect(() => {
    supabase
      .from("cities")
      .select("slug, name")
      .eq("is_active", true)
      .order("population", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        const rows = (data ?? []) as { slug: string; name: string }[];
        setCityOptions(rows.filter((c) => isPlannerSupportedCitySlug(c.slug)));
      });
  }, []);

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
    router.push(`/events/plan/new?${params.toString()}`);
  }

  const needs =
    form.occasionSlug !== "" ? NEEDS_BY_OCCASION[form.occasionSlug] : [];

  return (
    <div className="min-h-screen bg-[#f7f4ee] px-4 pb-20 pt-8">
      <div className="mx-auto max-w-2xl">

        {/* Page header */}
        <div className="mb-10">
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#b76a43]">
            Event Planner
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#171717]">
            Plan deinen Event.
          </h1>
          <p className="mt-3 text-base leading-7 text-[#665d55]">
            Wähle Anlass, Eckdaten und Bedarf. PerfectDay24 zeigt dir passende
            Dienstleister — mit Festpreisen, damit du direkt kalkulieren kannst.
          </p>
        </div>

        {/* Wizard card */}
        <div className="overflow-hidden rounded-[32px] border border-[rgba(23,23,23,0.08)] bg-[#fffdf8] shadow-[0_24px_64px_rgba(49,39,27,0.12)]">

          {/* Progress bar */}
          <div className="h-1 w-full bg-[rgba(23,23,23,0.06)]">
            <div
              className="h-1 rounded-full bg-[#171717] transition-all duration-300"
              style={{ width: progressWidth(step) }}
            />
          </div>

          <div className="px-7 py-8 sm:px-8">

            {/* ── Step 1: Anlass ── */}
            {step === 1 && (
              <div>
                <StepHeader step={1} label="Was planst du?" />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {OCCASIONS.map((occ) => (
                    <button
                      key={occ.slug}
                      type="button"
                      onClick={() => selectOccasion(occ.slug)}
                      className={cx(
                        "rounded-2xl border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717] focus-visible:ring-offset-1",
                        form.occasionSlug === occ.slug
                          ? "border-[#171717] bg-[#171717] text-white"
                          : "border-[rgba(23,23,23,0.12)] bg-white text-[#171717] hover:border-[#171717]"
                      )}
                    >
                      <div className="text-sm font-semibold">{occ.label}</div>
                      <div
                        className={cx(
                          "mt-1 text-xs leading-5",
                          form.occasionSlug === occ.slug
                            ? "text-white/70"
                            : "text-[#8b7767]"
                        )}
                      >
                        {occ.hint}
                      </div>
                    </button>
                  ))}
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
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#8b7767]">
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
                        className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#8b7767]"
                      >
                        Datum (optional)
                      </label>
                      <input
                        id="event-date"
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                        className="w-full rounded-2xl border border-[rgba(23,23,23,0.12)] bg-white px-4 py-3 text-sm text-[#171717] focus:border-[#171717] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="event-guests"
                        className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#8b7767]"
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
                        className="w-full rounded-2xl border border-[rgba(23,23,23,0.12)] bg-white px-4 py-3 text-sm text-[#171717] focus:border-[#171717] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Budget */}
                  <div>
                    <label
                      htmlFor="event-budget"
                      className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#8b7767]"
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
                      className="w-full rounded-2xl border border-[rgba(23,23,23,0.12)] bg-white px-4 py-3 text-sm text-[#171717] focus:border-[#171717] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Bedarfsliste ── */}
            {step === 3 && (
              <div>
                <StepHeader step={3} label="Was braucht dein Event?" />
                <p className="mb-5 text-sm leading-6 text-[#665d55]">
                  Pflichtpositionen sind bereits aktiv. Wähle zusätzlich, was du brauchst.
                </p>
                <div className="space-y-2">
                  {needs.map((need) => (
                    <NeedToggle
                      key={need.slug}
                      label={need.label}
                      required={need.required}
                      selected={form.selectedNeeds.includes(need.slug)}
                      onToggle={() => toggleNeed(need.slug)}
                    />
                  ))}
                </div>

                {/* Summary strip */}
                <div className="mt-6 rounded-[24px] border border-[rgba(23,23,23,0.08)] bg-[rgba(249,243,235,0.7)] px-5 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8b7767]">
                    Dein Event auf einen Blick
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full border border-[rgba(23,23,23,0.10)] bg-white px-3 py-1 text-xs text-[#665d55]">
                      {OCCASIONS.find((o) => o.slug === form.occasionSlug)?.label}
                    </span>
                    <span className="rounded-full border border-[rgba(23,23,23,0.10)] bg-white px-3 py-1 text-xs text-[#665d55]">
                      {cityOptions.find((c) => c.slug === form.city)?.name ?? form.city}
                    </span>
                    {form.guests && (
                      <span className="rounded-full border border-[rgba(23,23,23,0.10)] bg-white px-3 py-1 text-xs text-[#665d55]">
                        {form.guests} Gäste
                      </span>
                    )}
                    {form.date && (
                      <span className="rounded-full border border-[rgba(23,23,23,0.10)] bg-white px-3 py-1 text-xs text-[#665d55]">
                        {new Date(form.date).toLocaleDateString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </span>
                    )}
                    <span className="rounded-full border border-[rgba(23,23,23,0.10)] bg-white px-3 py-1 text-xs text-[#665d55]">
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
                  className="inline-flex min-h-11 items-center rounded-xl border border-[rgba(23,23,23,0.12)] bg-white px-5 text-sm font-medium text-[#171717] transition hover:border-[#171717] focus-visible:outline-none"
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
                  className="inline-flex min-h-11 items-center rounded-xl bg-[#171717] px-6 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717] focus-visible:ring-offset-2"
                >
                  Weiter
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinish}
                  className="inline-flex min-h-11 items-center rounded-xl bg-[#171717] px-6 text-sm font-medium text-white transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717] focus-visible:ring-offset-2"
                >
                  Dienstleister anzeigen
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <p className="mt-6 text-center text-xs text-[#8b7767]">
          Kein Account nötig für die Planung. Speichern und Teilen erfordert eine kostenlose Anmeldung.
        </p>
      </div>
    </div>
  );
}
