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
  // Netzwerk-/RPC-Fehler getrennt vom "Link ungültig"-Fall halten — sonst
  // wirkt ein gültiger Anfrage-Link bei einem kurzen Verbindungsproblem tot.
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Form state
  const [priceEur, setPriceEur]     = useState("");
  const [priceUnit, setPriceUnit]   = useState("total");
  const [available, setAvailable]   = useState<boolean | null>(null);
  const [message, setMessage]       = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setLoadError(false);

    supabase
      .rpc("get_vendor_quote_by_token", { p_token: token })
      .then(({ data, error }) => {
        if (error) {
          console.error("Vendor-Quote laden fehlgeschlagen:", error.message);
          setLoadError(true);
        } else if (!data || (Array.isArray(data) && data.length === 0)) {
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
  }, [token, reloadKey]);

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
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas-warm)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--text-strong)] border-t-transparent" />
      </div>
    );
  }

  // ── Lade-/Netzwerkfehler: Link ist evtl. gültig, nur gerade nicht erreichbar ──
  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas-warm)] px-4">
        <div className="max-w-sm text-center">
          <div className="mb-4 text-4xl">📡</div>
          <h1 className="mb-2 text-xl font-semibold text-[var(--text-strong)]">Gerade nicht erreichbar</h1>
          <p className="mb-4 text-sm text-[var(--text-soft-warm)]">
            Die Anfrage konnte nicht geladen werden. Bitte prüfen Sie Ihre Verbindung
            und versuchen Sie es erneut — der Link bleibt gültig.
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="pd24-btn pd24-btn-sm pd24-btn-primary"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  // ── Not found / expired ───────────────────────────────────────────────────────
  if (notFound || !quote) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas-warm)] px-4">
        <div className="max-w-sm text-center">
          <div className="mb-4 text-4xl">🔗</div>
          <h1 className="mb-2 text-xl font-semibold text-[var(--text-strong)]">Link nicht gefunden</h1>
          <p className="text-sm text-[var(--text-soft-warm)]">
            Der Link ist möglicherweise abgelaufen oder ungültig.
            Bitte kontaktieren Sie uns unter{" "}
            <a href="mailto:partner@perfectday24.de" className="text-[var(--brand-warm-deep)] underline">
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
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas-warm)] px-4">
        <div className="max-w-sm text-center">
          <div className="mb-4 text-5xl">✅</div>
          <h1 className="mb-2 text-xl font-semibold text-[var(--text-strong)]">Angebot gesendet!</h1>
          <p className="text-sm text-[var(--text-muted-warm)]">
            Der Interessent wird umgehend benachrichtigt. Bei Rückfragen:{" "}
            <a href="mailto:partner@perfectday24.de" className="text-[var(--brand-warm-deep)] underline">
              partner@perfectday24.de
            </a>
          </p>
          <div className="mt-6 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-white p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-soft-warm)]">Ihr Angebot</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-strong)]">
              {priceEur ? `${parseFloat(priceEur.replace(",", ".")).toLocaleString("de-DE")} €` : "Auf Anfrage"}
              {priceUnit === "per_person" && " / Person"}
              {priceUnit === "per_hour" && " / Stunde"}
            </p>
            <p className="mt-0.5 text-sm text-[var(--text-muted-warm)]">
              {available ? "Verfügbar ✓" : "Leider nicht verfügbar"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--bg-canvas-warm)] pb-16">
      {/* Header */}
      <div className="border-b border-[var(--line-subtle)] bg-[var(--bg-surface-warm)] px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-lg">
          <div className="pd24-kicker-warm mb-1">
            PerfectDay24 · Preisanfrage
          </div>
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">
            Angebot für {needLabel}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted-warm)]">
            Angefordert für: <strong>{quote.provider_name}</strong>
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">

        {/* Event summary card */}
        <div className="mb-8 rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-white p-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-soft-warm)]">
            Eventdetails
          </p>
          <dl className="space-y-2 text-sm">
            {occasionLabel && (
              <div className="flex justify-between">
                <dt className="text-[var(--text-soft-warm)]">Anlass</dt>
                <dd className="font-medium text-[var(--text-strong)]">{occasionLabel}</dd>
              </div>
            )}
            {dateFormatted && (
              <div className="flex justify-between">
                <dt className="text-[var(--text-soft-warm)]">Datum</dt>
                <dd className="font-medium text-[var(--text-strong)]">{dateFormatted}</dd>
              </div>
            )}
            {quote.city_slug && (
              <div className="flex justify-between">
                <dt className="text-[var(--text-soft-warm)]">Ort</dt>
                <dd className="font-medium text-[var(--text-strong)]">{quote.city_slug.split("-")[0]}</dd>
              </div>
            )}
            {quote.guest_count && (
              <div className="flex justify-between">
                <dt className="text-[var(--text-soft-warm)]">Gäste</dt>
                <dd className="font-medium text-[var(--text-strong)]">{quote.guest_count} Personen</dd>
              </div>
            )}
            {quote.budget_cents && (
              <div className="flex justify-between">
                <dt className="text-[var(--text-soft-warm)]">Budget gesamt</dt>
                <dd className="font-medium text-[var(--text-strong)]">
                  ca. {(quote.budget_cents / 100).toLocaleString("de-DE")} €
                </dd>
              </div>
            )}
          </dl>
          {quote.customer_message && (
            <div className="mt-4 rounded-[12px] bg-[var(--bg-canvas-warm)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-soft-warm)]">
                Nachricht des Interessenten
              </p>
              <p className="mt-1 text-sm text-[var(--text-strong)]">{quote.customer_message}</p>
            </div>
          )}
        </div>

        {alreadySubmitted ? (
          <div className="pd24-status-success rounded-[var(--radius-card-sm)] p-6 text-center">
            <p className="font-semibold">Angebot bereits abgegeben ✓</p>
            <p className="mt-1 text-sm">
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
              <label className="mb-2 block text-sm font-medium text-[var(--text-strong)]">
                Sind Sie zum genannten Termin verfügbar?{" "}
                <span className="text-[var(--brand-warm-deep)]">*</span>
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
                          ? "border-[var(--state-success)] bg-[rgba(79,107,91,0.08)] text-[var(--state-success)]"
                          : "border-[var(--state-error)] bg-[rgba(161,75,69,0.08)] text-[var(--state-error)]"
                        : "border-[var(--line-strong)] bg-white text-[var(--text-muted-warm)] hover:border-[var(--text-strong)]",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Price */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-strong)]">
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
                    className="w-full rounded-xl border border-[var(--line-strong)] bg-white px-4 py-3 pr-8 text-sm text-[var(--text-strong)] outline-none focus:border-[var(--text-strong)]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-soft-warm)]">€</span>
                </div>
                <select
                  value={priceUnit}
                  onChange={(e) => setPriceUnit(e.target.value)}
                  className="rounded-xl border border-[var(--line-strong)] bg-white px-3 py-3 text-sm text-[var(--text-strong)] outline-none focus:border-[var(--text-strong)]"
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
              <label className="mb-2 block text-sm font-medium text-[var(--text-strong)]">
                Nachricht an den Interessenten (optional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Was ist im Preis enthalten? Gibt es Besonderheiten zu beachten?"
                className="w-full rounded-xl border border-[var(--line-strong)] bg-white px-4 py-3 text-sm text-[var(--text-strong)] outline-none focus:border-[var(--text-strong)] resize-none"
              />
            </div>

            {submitState === "error" && (
              <p className="text-sm text-[var(--state-error)]">
                Fehler beim Speichern. Bitte versuchen Sie es erneut oder schreiben Sie uns:{" "}
                <a href="mailto:partner@perfectday24.de" className="underline">
                  partner@perfectday24.de
                </a>
              </p>
            )}

            <button
              type="submit"
              disabled={available === null || submitState === "submitting"}
              className="pd24-btn pd24-btn-primary w-full"
            >
              {submitState === "submitting" ? "Wird gesendet …" : "Angebot abgeben"}
            </button>

            <p className="text-center text-xs text-[var(--text-soft-warm)]">
              Kein Konto erforderlich. Ihr Angebot wird direkt an den Interessenten weitergeleitet.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
