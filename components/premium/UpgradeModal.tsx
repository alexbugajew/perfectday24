"use client";

import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

// Zeigt sich wenn ein Free-User das AI-Plan-Monatslimit erreicht hat.
// Startet den Stripe-User-Checkout und routet zurück auf /profile.

type Props = {
  open: boolean;
  used: number;
  limit: number;
  onClose: () => void;
};

const BENEFITS: { emoji: string; title: string; body: string }[] = [
  {
    emoji: "✨",
    title: "Unbegrenzte KI-Pläne",
    body: "Kein monatliches Limit mehr. Plane spontan, so oft du willst.",
  },
  {
    emoji: "💾",
    title: "Unbegrenzt speichern",
    body: "Behalte jeden Plan im Zugriff, nicht nur die letzten 10.",
  },
  {
    emoji: "📄",
    title: "Export als PDF & Kalender",
    body: "Plan direkt drucken oder in deinen Kalender übernehmen.",
  },
];

type CheckoutConfig = {
  monthlyAmountCents: number;
  yearlyAvailable: boolean;
  yearlyAmountCents: number;
  trialEligible: boolean;
  trialDays: number;
};

function formatEuro(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export default function UpgradeModal({ open, used, limit, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<CheckoutConfig | null>(null);
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/stripe/user-checkout");
        if (!res.ok) return;
        const json = (await res.json()) as CheckoutConfig;
        if (!cancelled) setConfig(json);
      } catch {
        // Ohne Konfiguration bleibt der einfache Monats-Checkout nutzbar.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  async function handleUpgrade() {
    trackEvent(ANALYTICS_EVENTS.checkoutStarted, { plan: "user_premium", interval: billingInterval });
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/user-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval: billingInterval }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(`Checkout fehlgeschlagen (${res.status})`, text);
        throw new Error("Der Bezahlvorgang konnte nicht gestartet werden. Bitte versuch es erneut.");
      }
      const json = (await res.json()) as { url?: string; error?: string };
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      if (json.error) console.error("Checkout ohne URL:", json.error);
      throw new Error("Der Bezahlvorgang konnte nicht gestartet werden. Bitte versuch es erneut.");
    } catch (err) {
      console.error("Checkout-Fehler:", err);
      setError("Der Bezahlvorgang konnte nicht gestartet werden. Bitte versuch es erneut.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1500] flex items-end bg-black/50 sm:items-center sm:p-4">
      <div className="flex w-full max-h-[92vh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:mx-auto sm:max-w-lg sm:rounded-2xl">
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-[var(--bg-panel)]" />
        </div>

        <div className="flex items-start justify-between gap-3 border-b border-[var(--line-subtle)] px-5 pb-3 pt-4 sm:px-6">
          <div>
            <div className="pd24-kicker-warm">
              PerfectDay24 Premium
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-strong)]">
              Dein Free-Limit ist erreicht.
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {used} von {limit} AI-Plänen diesen Monat verwendet.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="shrink-0 rounded-full border border-[var(--line-subtle)] px-2.5 py-1 text-xs text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
          >
            Schließen
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          <div className="rounded-xl border border-[rgba(196,137,79,0.32)] bg-[linear-gradient(180deg,rgba(255,249,241,0.85),rgba(255,253,248,0.85))] px-4 py-4">
            {config?.yearlyAvailable ? (
              <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-full border border-[var(--line-subtle)] bg-white p-1">
                <button
                  type="button"
                  onClick={() => setBillingInterval("month")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    billingInterval === "month"
                      ? "bg-[var(--text-strong)] text-white"
                      : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                  }`}
                >
                  Monatlich
                </button>
                <button
                  type="button"
                  onClick={() => setBillingInterval("year")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    billingInterval === "year"
                      ? "bg-[var(--text-strong)] text-white"
                      : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                  }`}
                >
                  Jährlich · 2 Monate geschenkt
                </button>
              </div>
            ) : null}
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tracking-tight text-[var(--text-strong)]">
                {billingInterval === "year" && config?.yearlyAvailable
                  ? formatEuro(config.yearlyAmountCents)
                  : formatEuro(config?.monthlyAmountCents ?? 499)}
              </span>
              <span className="text-sm text-[var(--text-muted)]">
                {billingInterval === "year" && config?.yearlyAvailable ? "/ Jahr" : "/ Monat"}
              </span>
              {billingInterval === "year" && config?.yearlyAvailable ? (
                <span className="rounded-full bg-[var(--brand-warm)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  −33 %
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              {config?.trialEligible
                ? `${config.trialDays} Tage kostenlos testen — jederzeit kündbar, erste Abbuchung erst danach.`
                : "Jederzeit kündbar."}
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="flex items-start gap-3 rounded-xl border border-[var(--line-subtle)] bg-white px-3 py-3"
              >
                <span className="text-lg leading-none">{b.emoji}</span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--text-strong)]">{b.title}</div>
                  <div className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">{b.body}</div>
                </div>
              </div>
            ))}
          </div>

          {error ? (
            <div className="mt-3 rounded-lg pd24-status-error px-3 py-2 text-xs">
              {error}
            </div>
          ) : null}

          <p className="mt-4 text-[11px] leading-5 text-[var(--text-muted)]">
            Mit dem Kauf akzeptierst du unsere{" "}
            <a href="/agb" target="_blank" rel="noreferrer" className="underline underline-offset-2">AGB</a>{" "}
            und die{" "}
            <a href="/datenschutz" target="_blank" rel="noreferrer" className="underline underline-offset-2">Datenschutzerklärung</a>.
            Du stimmst zu, dass die Leistung sofort beginnt; dein Widerrufsrecht erlischt dadurch nicht — du kannst
            innerhalb von 14 Tagen ohne Angabe von Gründen widerrufen und jederzeit zum Laufzeitende kündigen.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--line-subtle)] bg-[var(--bg-surface)] px-5 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--line-subtle)] bg-white px-4 py-2 text-sm text-[var(--text-muted)] transition hover:text-[var(--text-strong)]"
          >
            Später
          </button>
          <button
            type="button"
            onClick={() => void handleUpgrade()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--text-strong)] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                Weiterleitung…
              </>
            ) : config?.trialEligible ? (
              `${config.trialDays} Tage kostenlos testen →`
            ) : (
              "Premium starten →"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
