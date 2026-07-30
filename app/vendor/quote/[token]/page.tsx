"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

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

/** Fallback für unbekannte Slugs: "jga-party" → "Jga Party" statt roher Techn-Slug. */
function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type QuoteData = {
  id: string;
  token: string;
  status: string;
  need_slug: string | null;
  price_cents: number | null;
  price_unit: string;
  availability_confirmed: boolean | null;
  vendor_message: string | null;
  expires_at: string;
  occasion_slug: string | null;
  city_slug: string | null;
  event_date: string | null;
  guest_count: number | null;
  budget_cents: number | null;
  customer_message: string | null;
  provider_name: string;
  provider_service_type: string;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

export default function VendorQuotePage() {
  const { token } = useParams<{ token: string }>();

  const [quote, setQuote]       = useState<QuoteData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Form state
  const [priceEur, setPriceEur]     = useState("");
  const [priceUnit, setPriceUnit]   = useState("total");
  const [available, setAvailable]   = useState<boolean | null>(null);
  const [message, setMessage]       = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  useEffect(() => {
    if (!token) return;

    supabase
      .rpc("get_vendor_quote_by_token", { p_token: token })
      .then(({ data, error }) => {
        if (error || !data || (Array.isArray(data) && data.length === 0)) {
          setNotFound(true);
        } else {
          const row = Array.isArray(data) ? data[0] : data;
          setQuote(row as QuoteData);
          if (row.price_unit) setPriceUnit(row.price_unit);
          if (row.price_cents) setPriceEur(String(row.price_cents / 100));
          if (row.vendor_message) setMessage(row.vendor_message);
          if (row.availability_confirmed !== null) setAvailable(row.availability_confirmed);
        }
        setLoading(false);
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (available === null) return;
    setSubmitState("submitting");

    const priceCents = priceEur
      ? Math.round(parseFloat(priceEur.replace(",", ".")) * 100)
      : null;

    const { data, error } = await supabase.rpc("submit_vendor_quote", {
      p_token:        token,
      p_price_cents:  priceCents,
      p_price_unit:   priceUnit,
      p_availability: available,
      p_message:      message.trim() || null,
    });

    if (error || String(data).startsWith("error:")) {
      setSubmitState("error");
    } else {
      setSubmitState("success");
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f4ee]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#171717] border-t-transparent" />
      </div>
    );
  }

  // ── Not found / expired ───────────────────────────────────────────────────────
  if (notFound || !quote) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f4ee] px-4">
        <div className="max-w-sm text-center">
          <div className="mb-4 text-4xl">🔗</div>
          <h1 className="mb-2 text-xl font-semibold text-[#171717]">Link nicht gefunden</h1>
          <p className="text-sm text-[#8b7767]">
            Der Link ist möglicherweise abgelaufen oder ungültig.
            Bitte kontaktieren Sie uns unter{" "}
            <a href="mailto:partner@perfectday24.de" className="text-[#b76a43] underline">
              partner@perfectday24.de
            </a>
          </p>
        </div>
      </div>
    );
  }

  // ── Already submitted ─────────────────────────────────────────────────────────
  const alreadySubmitted = quote.status === "quoted" || quote.status === "accepted";

  const dateFormatted = quote.event_date
    ? new Date(quote.event_date).toLocaleDateString("de-DE", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : null;

  const occasionLabel = OCCASION_LABELS[quote.occasion_slug ?? ""]
    ?? (quote.occasion_slug ? humanizeSlug(quote.occasion_slug) : "");
  const needLabel     = NEED_LABEL[quote.need_slug ?? ""]
    ?? (quote.need_slug ? humanizeSlug(quote.need_slug) : "Ihre Leistung");

  // ── Success ───────────────────────────────────────────────────────────────────
  if (submitState === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f4ee] px-4">
        <div className="max-w-sm text-center">
          <div className="mb-4 text-5xl">✅</div>
          <h1 className="mb-2 text-xl font-semibold text-[#171717]">Angebot gesendet!</h1>
          <p className="text-sm text-[#665d55]">
            Der Interessent wird umgehend benachrichtigt. Bei Rückfragen:{" "}
            <a href="mailto:partner@perfectday24.de" className="text-[#b76a43] underline">
              partner@perfectday24.de
            </a>
          </p>
          <div className="mt-6 rounded-[16px] border border-[rgba(23,23,23,0.08)] bg-white p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8b7767]">Ihr Angebot</p>
            <p className="mt-1 text-lg font-semibold text-[#171717]">
              {priceEur ? `${parseFloat(priceEur.replace(",", ".")).toLocaleString("de-DE")} €` : "Auf Anfrage"}
              {priceUnit === "per_person" && " / Person"}
              {priceUnit === "per_hour" && " / Stunde"}
            </p>
            <p className="mt-0.5 text-sm text-[#665d55]">
              {available ? "Verfügbar ✓" : "Leider nicht verfügbar"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f7f4ee] pb-16">
      {/* Header */}
      <div className="border-b border-[rgba(23,23,23,0.08)] bg-[#fffdf8] px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-lg">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#b76a43]">
            PerfectDay24 · Preisanfrage
          </div>
          <h1 className="text-2xl font-semibold text-[#171717]">
            Angebot für {needLabel}
          </h1>
          <p className="mt-1 text-sm text-[#665d55]">
            Angefordert für: <strong>{quote.provider_name}</strong>
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">

        {/* Event summary card */}
        <div className="mb-8 rounded-[20px] border border-[rgba(23,23,23,0.08)] bg-white p-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#8b7767]">
            Eventdetails
          </p>
          <dl className="space-y-2 text-sm">
            {occasionLabel && (
              <div className="flex justify-between">
                <dt className="text-[#8b7767]">Anlass</dt>
                <dd className="font-medium text-[#171717]">{occasionLabel}</dd>
              </div>
            )}
            {dateFormatted && (
              <div className="flex justify-between">
                <dt className="text-[#8b7767]">Datum</dt>
                <dd className="font-medium text-[#171717]">{dateFormatted}</dd>
              </div>
            )}
            {quote.city_slug && (
              <div className="flex justify-between">
                <dt className="text-[#8b7767]">Ort</dt>
                <dd className="font-medium text-[#171717]">{quote.city_slug.split("-")[0]}</dd>
              </div>
            )}
            {quote.guest_count && (
              <div className="flex justify-between">
                <dt className="text-[#8b7767]">Gäste</dt>
                <dd className="font-medium text-[#171717]">{quote.guest_count} Personen</dd>
              </div>
            )}
            {quote.budget_cents && (
              <div className="flex justify-between">
                <dt className="text-[#8b7767]">Budget gesamt</dt>
                <dd className="font-medium text-[#171717]">
                  ca. {(quote.budget_cents / 100).toLocaleString("de-DE")} €
                </dd>
              </div>
            )}
          </dl>
          {quote.customer_message && (
            <div className="mt-4 rounded-[12px] bg-[#f7f4ee] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8b7767]">
                Nachricht des Interessenten
              </p>
              <p className="mt-1 text-sm text-[#171717]">{quote.customer_message}</p>
            </div>
          )}
        </div>

        {alreadySubmitted ? (
          <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-6 text-center">
            <p className="font-semibold text-emerald-800">Angebot bereits abgegeben ✓</p>
            <p className="mt-1 text-sm text-emerald-700">
              Sie haben dieses Angebot bereits eingereicht. Bei Rückfragen:{" "}
              <a href="mailto:partner@perfectday24.de" className="underline">
                partner@perfectday24.de
              </a>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Availability */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#171717]">
                Sind Sie zum genannten Termin verfügbar?{" "}
                <span className="text-[#b76a43]">*</span>
              </label>
              <div className="flex gap-3">
                {[
                  { value: true,  label: "Ja, verfügbar" },
                  { value: false, label: "Leider nicht" },
                ].map(({ value, label }) => (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() => setAvailable(value)}
                    className={[
                      "flex-1 rounded-xl border py-3 text-sm font-medium transition",
                      available === value
                        ? value
                          ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                          : "border-red-400 bg-red-50 text-red-700"
                        : "border-[rgba(23,23,23,0.12)] bg-white text-[#665d55] hover:border-[#171717]",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Price */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#171717]">
                Ihr Preis (optional — lassen Sie es frei für &quot;Auf Anfrage&quot;)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={priceEur}
                    onChange={(e) => setPriceEur(e.target.value)}
                    placeholder="z.B. 1200"
                    className="w-full rounded-xl border border-[rgba(23,23,23,0.12)] bg-white px-4 py-3 pr-8 text-sm text-[#171717] outline-none focus:border-[#171717]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#8b7767]">€</span>
                </div>
                <select
                  value={priceUnit}
                  onChange={(e) => setPriceUnit(e.target.value)}
                  className="rounded-xl border border-[rgba(23,23,23,0.12)] bg-white px-3 py-3 text-sm text-[#171717] outline-none focus:border-[#171717]"
                >
                  <option value="total">Gesamt</option>
                  <option value="per_person">Pro Person</option>
                  <option value="per_hour">Pro Stunde</option>
                  <option value="on_request">Auf Anfrage</option>
                </select>
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#171717]">
                Nachricht an den Interessenten (optional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Was ist im Preis enthalten? Gibt es Besonderheiten zu beachten?"
                className="w-full rounded-xl border border-[rgba(23,23,23,0.12)] bg-white px-4 py-3 text-sm text-[#171717] outline-none focus:border-[#171717] resize-none"
              />
            </div>

            {submitState === "error" && (
              <p className="text-sm text-red-600">
                Fehler beim Speichern. Bitte versuchen Sie es erneut oder schreiben Sie uns:{" "}
                <a href="mailto:partner@perfectday24.de" className="underline">
                  partner@perfectday24.de
                </a>
              </p>
            )}

            <button
              type="submit"
              disabled={available === null || submitState === "submitting"}
              className="w-full rounded-xl bg-[#171717] py-3.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40 hover:opacity-90"
            >
              {submitState === "submitting" ? "Wird gesendet …" : "Angebot abgeben"}
            </button>

            <p className="text-center text-xs text-[#8b7767]">
              Kein Konto erforderlich. Ihr Angebot wird direkt an den Interessenten weitergeleitet.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
