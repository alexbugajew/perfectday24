"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isPlannerSupportedCitySlug } from "@/lib/cities/planner-support";
import { CitySearchInput } from "@/components/ui/CitySearchInput";
import { PhotoUpload } from "@/components/ui/PhotoUpload";

// ─── Types ────────────────────────────────────────────────────────────────────

type PartnerTypeSlug =
  | "gastronomy"
  | "venue"
  | "experience"
  | "accommodation"
  | "event_vendor"
  | "city_tourism"
  | "corporate"
  | "other";

type Step1Data = { partner_type_slug: PartnerTypeSlug };

type Step2Data = {
  display_name: string;
  slug: string;
  primary_city_slug: string;
  website_url: string;
  booking_url: string;
  contact_email: string;
  contact_phone: string;
  notes: string;
  booking_type: "request" | "direct" | "external" | "none";
};

type Step3Data = {
  service_category_slugs: string[];
  operating_cities: string[];
  type_data: Record<string, string>;
};

type Step4Data = { media_urls: string[] };

type Step5Data = { tier: "organic" | "partner_basic" | "partner_pro" };

// ─── Constants ────────────────────────────────────────────────────────────────

const PARTNER_TYPES: {
  slug: PartnerTypeSlug;
  label: string;
  desc: string;
  icon: string;
  partnerType: string;
}[] = [
  { slug: "gastronomy",   label: "Gastronomie",       desc: "Restaurant, Café, Bar, Catering",          icon: "🍽",  partnerType: "restaurant" },
  { slug: "venue",        label: "Venue / Location",  desc: "Eventlocation, Saal, Außenbereich",         icon: "🏛",  partnerType: "venue" },
  { slug: "experience",   label: "Erlebnis",           desc: "Aktivität, Führung, Workshop",              icon: "🎯",  partnerType: "experience" },
  { slug: "accommodation",label: "Unterkunft",         desc: "Hotel, Pension, Ferienwohnung",             icon: "🛏",  partnerType: "venue" },
  { slug: "event_vendor", label: "Event-Dienstleister",desc: "DJ, Fotograf, Dekoration, Transport",       icon: "🎪",  partnerType: "organizer" },
  { slug: "city_tourism", label: "Stadtmarketing",     desc: "Tourismusverband, Stadtführung, Attraction", icon: "🗺",  partnerType: "tourism" },
];

// Loaded from DB in the component — same pattern as planner/page.tsx
type CityOption = { slug: string; name: string };

const CATEGORY_OPTIONS: Record<PartnerTypeSlug, { slug: string; label: string }[]> = {
  gastronomy: [
    { slug: "italian",      label: "Italienisch" },
    { slug: "german",       label: "Deutsch" },
    { slug: "asian",        label: "Asiatisch" },
    { slug: "mediterranean",label: "Mediterran" },
    { slug: "vegan",        label: "Vegan / Vegetarisch" },
    { slug: "cocktails",    label: "Cocktailbar" },
    { slug: "outdoor",      label: "Außenbereich" },
    { slug: "private_room", label: "Separater Raum" },
  ],
  venue: [
    { slug: "historic",     label: "Historisch" },
    { slug: "modern",       label: "Modern / Industrial" },
    { slug: "outdoor",      label: "Open Air" },
    { slug: "rooftop",      label: "Rooftop" },
    { slug: "garden",       label: "Garten" },
    { slug: "wedding",      label: "Hochzeit" },
    { slug: "corporate",    label: "Corporate Events" },
    { slug: "party",        label: "Feiern / Partys" },
  ],
  experience: [
    { slug: "city_tour",    label: "Stadtführung" },
    { slug: "cooking",      label: "Kochkurs" },
    { slug: "wine",         label: "Weinprobe" },
    { slug: "outdoor",      label: "Outdoor / Abenteuer" },
    { slug: "cultural",     label: "Kultur / Kunst" },
    { slug: "sports",       label: "Sport" },
    { slug: "team_building",label: "Teambuilding" },
  ],
  accommodation: [
    { slug: "hotel",        label: "Hotel" },
    { slug: "boutique",     label: "Boutique Hotel" },
    { slug: "hostel",       label: "Hostel" },
    { slug: "apartment",    label: "Ferienwohnung" },
    { slug: "wellness",     label: "Wellness / Spa" },
    { slug: "pet_friendly", label: "Haustierfreundlich" },
  ],
  event_vendor: [
    { slug: "dj_music",     label: "DJ / Musik" },
    { slug: "photography",  label: "Fotografie" },
    { slug: "video",        label: "Video" },
    { slug: "decoration",   label: "Dekoration" },
    { slug: "catering",     label: "Catering" },
    { slug: "transport",    label: "Transport" },
    { slug: "florist",      label: "Florist" },
    { slug: "moderation",   label: "Moderation" },
  ],
  city_tourism: [
    { slug: "sightseeing",  label: "Sehenswürdigkeiten" },
    { slug: "guided_tours", label: "Führungen" },
    { slug: "museums",      label: "Museen" },
    { slug: "events",       label: "Veranstaltungen" },
    { slug: "gastronomy",   label: "Gastronomie-Tipps" },
  ],
  corporate: [
    { slug: "consulting",   label: "Beratung" },
    { slug: "branding",     label: "Branding" },
  ],
  other: [],
};

const TYPE_SPECIFIC_FIELDS: Record<PartnerTypeSlug, { key: string; label: string; placeholder: string }[]> = {
  gastronomy: [
    { key: "seating_capacity", label: "Sitzplätze (innen)", placeholder: "z.B. 80" },
    { key: "private_room_capacity", label: "Privatraum (max. Personen)", placeholder: "z.B. 30" },
  ],
  venue: [
    { key: "max_capacity", label: "Max. Kapazität (Personen)", placeholder: "z.B. 200" },
    { key: "min_hire_hours", label: "Mindestmietdauer (Stunden)", placeholder: "z.B. 4" },
  ],
  experience: [
    { key: "duration_minutes", label: "Dauer (Minuten)", placeholder: "z.B. 90" },
    { key: "min_group_size",   label: "Mindestgruppengröße", placeholder: "z.B. 5" },
    { key: "max_group_size",   label: "Max. Gruppengröße", placeholder: "z.B. 20" },
  ],
  accommodation: [
    { key: "room_count",  label: "Anzahl Zimmer", placeholder: "z.B. 25" },
    { key: "check_in",    label: "Check-in ab", placeholder: "z.B. 15:00" },
    { key: "check_out",   label: "Check-out bis", placeholder: "z.B. 11:00" },
  ],
  event_vendor: [
    { key: "coverage_radius_km", label: "Einsatzradius (km)", placeholder: "z.B. 50" },
    { key: "min_booking_hours",  label: "Mindestbuchungsdauer (Stunden)", placeholder: "z.B. 3" },
  ],
  city_tourism: [
    { key: "annual_visitors", label: "Besucher/Jahr (ca.)", placeholder: "z.B. 50000" },
  ],
  corporate: [],
  other: [],
};

const TIER_OPTIONS = [
  {
    tier: "organic" as const,
    label: "Kostenlos",
    price: "0 €/Monat",
    features: ["Basis-Eintrag", "Sichtbar bei Events", "Buchungsanfragen"],
    badge: "bg-[var(--bg-surface)] border-[var(--line-subtle)] text-[var(--text-strong)]",
  },
  {
    tier: "partner_basic" as const,
    label: "Partner Basic",
    price: "49 €/Monat",
    features: ["Alles aus Kostenlos", "Featured-Platzierung", "Analytics-Dashboard", "Prioritäts-Matching"],
    badge: "bg-blue-50 border-blue-300 text-blue-900",
  },
  {
    tier: "partner_pro" as const,
    label: "Partner Pro",
    price: "149 €/Monat",
    features: ["Alles aus Basic", "Top-Platzierung in allen Städten", "Dedizierter Account Manager", "Affiliate-Links"],
    badge: "bg-amber-50 border-amber-300 text-amber-900",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

export default function PartnerOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [cityOptions, setCityOptions] = useState<CityOption[]>([]);

  const [step1, setStep1] = useState<Step1Data>({ partner_type_slug: "gastronomy" });
  const [step2, setStep2] = useState<Step2Data>({
    display_name: "", slug: "", primary_city_slug: "berlin-berlin",
    website_url: "", booking_url: "", contact_email: "", contact_phone: "",
    notes: "", booking_type: "request",
  });
  const [step3, setStep3] = useState<Step3Data>({ service_category_slugs: [], operating_cities: [], type_data: {} });
  const [step4, setStep4] = useState<Step4Data>({ media_urls: ["", "", "", "", ""] });
  const [step5, setStep5] = useState<Step5Data>({ tier: "organic" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login?return=/partner/onboarding");
        return;
      }
      setUserId(data.session.user.id);
    });
  }, [router]);

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

  // Auto-slug from display_name
  useEffect(() => {
    if (step2.display_name && (!step2.slug || step2.slug === slugify(step2.display_name.slice(0, -1)))) {
      setStep2((prev) => ({ ...prev, slug: slugify(prev.display_name) }));
    }
  }, [step2.display_name]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit() {
    if (!userId) return;
    setSubmitting(true);
    setSubmitError(null);

    const typeInfo = PARTNER_TYPES.find((t) => t.slug === step1.partner_type_slug);
    const cleanMediaUrls = step4.media_urls.filter((u) => u.trim() !== "");

    const { data: profileData, error: profileError } = await supabase
      .from("partner_profiles")
      .insert({
        owner_user_id: userId,
        display_name: step2.display_name.trim(),
        slug: step2.slug.trim(),
        partner_type: typeInfo?.partnerType ?? "other",
        partner_type_slug: step1.partner_type_slug,
        primary_city_slug: step2.primary_city_slug || null,
        website_url: step2.website_url.trim() || null,
        booking_url: step2.booking_url.trim() || null,
        contact_email: step2.contact_email.trim() || null,
        contact_phone: step2.contact_phone.trim() || null,
        notes: step2.notes.trim() || null,
        booking_type: step2.booking_type,
        service_category_slugs: step3.service_category_slugs,
        operating_cities: step3.operating_cities.length > 0 ? step3.operating_cities : [step2.primary_city_slug],
        type_data: step3.type_data,
        media_urls: cleanMediaUrls,
        is_self_service_enabled: true,
        status: "active",
        visibility_tier: "organic",
        billing_status: "inactive",
      })
      .select("id")
      .single();

    if (profileError || !profileData) {
      setSubmitError(
        profileError?.message?.includes("duplicate")
          ? "Dieser Slug ist bereits vergeben — bitte wähle einen anderen Namen."
          : (profileError?.message ?? "Profil konnte nicht angelegt werden.")
      );
      setSubmitting(false);
      return;
    }

    const partnerId = profileData.id as string;
    // Membership is created automatically by the pd24_sync_partner_owner_membership
    // trigger (AFTER INSERT on partner_profiles, security definer). No manual insert needed.

    if (step5.tier !== "organic") {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: step5.tier, partner_entity_id: partnerId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setSubmitError(data.error ?? "Stripe Checkout konnte nicht erstellt werden.");
      setSubmitting(false);
      return;
    }

    router.push("/partner/dashboard");
  }

  const canNext = step === 1
    ? true
    : step === 2
    ? step2.display_name.trim().length >= 2 && step2.slug.trim().length >= 2
    : true;

  const typeConfig = PARTNER_TYPES.find((t) => t.slug === step1.partner_type_slug)!;

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      {/* Header */}
      <div className="border-b border-[var(--line-subtle)] bg-white px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="pd24-kicker mb-1">Partner werden</div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-strong)]">
            Partner-Profil anlegen
          </h1>
          {/* Progress bar */}
          <div className="mt-5 flex items-center gap-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  i + 1 <= step ? "bg-[var(--text-strong)]" : "bg-[var(--line-subtle)]"
                }`}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">Schritt {step} von {TOTAL_STEPS}</p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">

        {/* ── Step 1: Typ ───────────────────────────────────────────────────── */}
        {step === 1 && (
          <StepShell
            title="Welche Art Partner bist du?"
            subtitle="Wähle die Kategorie, die am besten zu deinem Angebot passt."
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {PARTNER_TYPES.map((pt) => (
                <button
                  key={pt.slug}
                  type="button"
                  onClick={() => setStep1({ partner_type_slug: pt.slug })}
                  className={`flex flex-col items-start gap-2 rounded-[24px] border p-5 text-left transition ${
                    step1.partner_type_slug === pt.slug
                      ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white shadow-sm"
                      : "border-[var(--line-subtle)] bg-white text-[var(--text-strong)] hover:border-[var(--text-strong)] hover:bg-[var(--bg-surface)]"
                  }`}
                >
                  <span className="text-2xl">{pt.icon}</span>
                  <span className="text-sm font-semibold leading-tight">{pt.label}</span>
                  <span className={`text-[11px] leading-tight ${step1.partner_type_slug === pt.slug ? "text-white/70" : "text-[var(--text-muted)]"}`}>
                    {pt.desc}
                  </span>
                </button>
              ))}
            </div>
          </StepShell>
        )}

        {/* ── Step 2: Basis-Daten ───────────────────────────────────────────── */}
        {step === 2 && (
          <StepShell
            title="Basis-Informationen"
            subtitle={`Pflege die wichtigsten Daten für dein ${typeConfig.label}-Profil ein.`}
          >
            <div className="space-y-4">
              <Field label="Anzeigename *" hint="Sichtbarer Name in der App">
                <input
                  type="text"
                  value={step2.display_name}
                  onChange={(e) => setStep2((p) => ({ ...p, display_name: e.target.value }))}
                  placeholder={`z.B. ${typeConfig.label} Musterstadt`}
                  className={inputCls}
                />
              </Field>

              <Field label="Profil-URL (Slug) *" hint="Einzigartiger Bezeichner — nur a–z, 0–9, Bindestriche">
                <div className="flex items-center gap-2 rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3">
                  <span className="shrink-0 text-sm text-[var(--text-muted)]">perfectday24.com/p/</span>
                  <input
                    type="text"
                    value={step2.slug}
                    onChange={(e) => setStep2((p) => ({ ...p, slug: slugify(e.target.value) }))}
                    placeholder="mein-profil"
                    className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-strong)] focus:outline-none"
                  />
                </div>
              </Field>

              <Field label="Hauptstadt">
                <CitySearchInput
                  cities={cityOptions}
                  value={step2.primary_city_slug}
                  onChange={(v) => setStep2((p) => ({ ...p, primary_city_slug: v }))}
                  placeholder="Stadt suchen …"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Website">
                  <input
                    type="url"
                    value={step2.website_url}
                    onChange={(e) => setStep2((p) => ({ ...p, website_url: e.target.value }))}
                    placeholder="https://example.com"
                    className={inputCls}
                  />
                </Field>
                <Field label="Buchungs-URL">
                  <input
                    type="url"
                    value={step2.booking_url}
                    onChange={(e) => setStep2((p) => ({ ...p, booking_url: e.target.value }))}
                    placeholder="https://buchung.example.com"
                    className={inputCls}
                  />
                </Field>
                <Field label="E-Mail">
                  <input
                    type="email"
                    value={step2.contact_email}
                    onChange={(e) => setStep2((p) => ({ ...p, contact_email: e.target.value }))}
                    placeholder="kontakt@example.com"
                    className={inputCls}
                  />
                </Field>
                <Field label="Telefon">
                  <input
                    type="tel"
                    value={step2.contact_phone}
                    onChange={(e) => setStep2((p) => ({ ...p, contact_phone: e.target.value }))}
                    placeholder="+49 30 …"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Buchungsart">
                <select
                  value={step2.booking_type}
                  onChange={(e) => setStep2((p) => ({ ...p, booking_type: e.target.value as Step2Data["booking_type"] }))}
                  className={inputCls}
                >
                  <option value="request">Anfrage (wir melden uns)</option>
                  <option value="direct">Direkt buchbar</option>
                  <option value="external">Extern (über eigene Website)</option>
                  <option value="none">Keine Buchung</option>
                </select>
              </Field>

              <Field label="Kurzbeschreibung">
                <textarea
                  value={step2.notes}
                  onChange={(e) => setStep2((p) => ({ ...p, notes: e.target.value }))}
                  rows={3}
                  placeholder="Was macht dein Angebot besonders?"
                  className="w-full resize-none rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3 text-sm text-[var(--text-strong)] focus:border-[var(--text-strong)] focus:outline-none"
                />
              </Field>
            </div>
          </StepShell>
        )}

        {/* ── Step 3: Typ-spezifisch ────────────────────────────────────────── */}
        {step === 3 && (
          <StepShell
            title="Details zu deinem Angebot"
            subtitle="Optionale Angaben, die dein Profil vervollständigen."
          >
            <div className="space-y-6">
              {/* Type-specific numeric fields */}
              {TYPE_SPECIFIC_FIELDS[step1.partner_type_slug].length > 0 && (
                <div>
                  <FieldLabel>Kennzahlen</FieldLabel>
                  <div className="mt-2 grid gap-4 sm:grid-cols-2">
                    {TYPE_SPECIFIC_FIELDS[step1.partner_type_slug].map((f) => (
                      <Field key={f.key} label={f.label}>
                        <input
                          type="text"
                          value={step3.type_data[f.key] ?? ""}
                          onChange={(e) => setStep3((p) => ({ ...p, type_data: { ...p.type_data, [f.key]: e.target.value } }))}
                          placeholder={f.placeholder}
                          className={inputCls}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              )}

              {/* Category tags */}
              {CATEGORY_OPTIONS[step1.partner_type_slug].length > 0 && (
                <div>
                  <FieldLabel>Kategorien (mehrere möglich)</FieldLabel>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CATEGORY_OPTIONS[step1.partner_type_slug].map((cat) => {
                      const isSelected = step3.service_category_slugs.includes(cat.slug);
                      return (
                        <button
                          key={cat.slug}
                          type="button"
                          onClick={() =>
                            setStep3((p) => ({
                              ...p,
                              service_category_slugs: isSelected
                                ? p.service_category_slugs.filter((s) => s !== cat.slug)
                                : [...p.service_category_slugs, cat.slug],
                            }))
                          }
                          className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                            isSelected
                              ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                              : "border-[var(--line-subtle)] bg-white text-[var(--text-strong)] hover:border-[var(--text-strong)]"
                          }`}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Additional cities */}
              <div>
                <FieldLabel>Weitere Einsatzstädte (optional)</FieldLabel>
                <div className="mt-2">
                  <CitySearchInput
                    cities={cityOptions}
                    multi
                    value={step3.operating_cities}
                    onChange={(v) => setStep3((p) => ({ ...p, operating_cities: v }))}
                    placeholder="Stadt suchen …"
                  />
                </div>
              </div>
            </div>
          </StepShell>
        )}

        {/* ── Step 4: Medien ────────────────────────────────────────────────── */}
        {step === 4 && (
          <StepShell
            title="Fotos & Medien"
            subtitle="Lade bis zu 5 Fotos hoch. Das erste Bild wird als Titelbild verwendet."
          >
            <PhotoUpload
              folder={userId ?? "anon"}
              value={step4.media_urls.filter(Boolean)}
              onChange={(urls) => setStep4({ media_urls: urls })}
              maxPhotos={5}
            />
          </StepShell>
        )}

        {/* ── Step 5: Tier ─────────────────────────────────────────────────── */}
        {step === 5 && (
          <StepShell
            title="Dein Plan"
            subtitle="Starte kostenlos oder wähle direkt einen bezahlten Plan."
          >
            <div className="space-y-3">
              {TIER_OPTIONS.map((opt) => (
                <button
                  key={opt.tier}
                  type="button"
                  onClick={() => setStep5({ tier: opt.tier })}
                  className={`w-full rounded-[24px] border-2 p-5 text-left transition ${
                    step5.tier === opt.tier
                      ? `${opt.badge} shadow-sm`
                      : "border-[var(--line-subtle)] bg-white hover:border-[var(--text-strong)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--text-strong)]">{opt.label}</p>
                      <ul className="mt-2 space-y-1">
                        {opt.features.map((f) => (
                          <li key={f} className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                            <span className="text-[10px] text-[var(--brand-accent)]">✓</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-lg font-semibold text-[var(--text-strong)]">{opt.price}</span>
                      {opt.tier !== "organic" && (
                        <p className="text-xs text-[var(--text-muted)]">mtl. kündbar</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {submitError && (
              <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</p>
            )}
          </StepShell>
        )}

        {/* ── Navigation ───────────────────────────────────────────────────── */}
        <div className="mt-6 flex items-center justify-between gap-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex items-center rounded-2xl border border-[var(--line-subtle)] bg-white px-5 py-3 text-sm font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)]"
            >
              ← Zurück
            </button>
          ) : (
            <div />
          )}

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--text-strong)] px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-40"
            >
              Weiter →
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting || !userId}
              onClick={() => void handleSubmit()}
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--text-strong)] px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting
                ? "Wird angelegt …"
                : step5.tier === "organic"
                ? "Profil anlegen"
                : "Profil anlegen & zahlen"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[32px] border border-[var(--line-subtle)] bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
      <h2 className="text-xl font-semibold text-[var(--text-strong)]">{title}</h2>
      <p className="mt-1 mb-6 text-sm text-[var(--text-muted)]">{subtitle}</p>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{children}</p>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
        {hint && <span className="ml-1 normal-case font-normal">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-2xl border border-[var(--line-subtle)] bg-white px-4 py-3 text-sm text-[var(--text-strong)] focus:border-[var(--text-strong)] focus:outline-none";
