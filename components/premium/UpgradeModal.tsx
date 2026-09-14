"use client";

import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { PREMIUM_PRELAUNCH } from "@/lib/premium/prelaunch";

// Zeigt sich wenn ein Free-User das AI-Plan-Monatslimit erreicht hat.
// Startet den Stripe-User-Checkout und routet zurück auf /profile.
// Im Vorstart-Modus (PREMIUM_PRELAUNCH, s. lib/premium/prelaunch.ts) gibt es
// statt des Checkouts eine kostenlose Vormerkung — Stripe ist bis zur
// HRB-Eintragung nicht live, und der Testmodus-Checkout wirkte für echte
// Nutzer wie ein Defekt.

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
  const [vorgemerkt, setVorgemerkt] = useState(false);

  // Dialog-A11y: Escape schließt, Tab bleibt im Dialog, Fokus wird beim
  // Öffnen gesetzt und beim Schließen zurückgegeben (Muster PlannerControlsSection).
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      restoreFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setTimeout(() => dialogRef.current?.focus(), 60);
    } else {
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const container = dialogRef.current;
      if (!container) return;
      const focusables = container.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !container.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || PREMIUM_PRELAUNCH) return;
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

  async function handleVormerken() {
    trackEvent(ANALYTICS_EVENTS.premiumWaitlisted, { interval: billingInterval });
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/premium/vormerken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval: billingInterval }),
      });
      if (res.status === 401) {
        throw new Error("Bitte melde dich an, um dich vorzumerken.");
      }
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Vormerkung fehlgeschlagen. Bitte versuch es erneut.");
      }
      setVorgemerkt(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vormerkung fehlgeschlagen. Bitte versuch es erneut.");
    } finally {
      setLoading(false);
    }
  }

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
    <div
      className="fixed inset-0 z-[1500] flex items-end bg-black/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex w-full max-h-[92vh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl outline-none sm:mx-auto sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-[var(--bg-panel)]" />
        </div>

        <div className="flex items-start justify-between gap-3 border-b border-[var(--line-subtle)] px-5 pb-3 pt-4 sm:px-6">
          <div>
            <div className="pd24-kicker-warm">
              PerfectDay24 Premium
            </div>
            <h2 id="upgrade-modal-title" className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-strong)]">
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
            {PREMIUM_PRELAUNCH ? (
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--brand-warm)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                Startet in Kürze
              </div>
            ) : null}
            {PREMIUM_PRELAUNCH || config?.yearlyAvailable ? (
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
                {billingInterval === "year" && (PREMIUM_PRELAUNCH || config?.yearlyAvailable)
                  ? formatEuro(config?.yearlyAmountCents ?? 3999)
                  : formatEuro(config?.monthlyAmountCents ?? 499)}
              </span>
              <span className="text-sm text-[var(--text-muted)]">
                {billingInterval === "year" && (PREMIUM_PRELAUNCH || config?.yearlyAvailable)
                  ? "/ Jahr"
                  : "/ Monat"}
              </span>
              {billingInterval === "year" && (PREMIUM_PRELAUNCH || config?.yearlyAvailable) ? (
                <span className="rounded-full bg-[var(--brand-warm)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  −33 %
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              {PREMIUM_PRELAUNCH
                ? "Merk dich kostenlos und unverbindlich vor — wir benachrichtigen dich zum Start, inklusive 14 Tage Gratis-Test."
                : config?.trialEligible
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
            <div role="alert" className="mt-3 rounded-lg pd24-status-error px-3 py-2 text-xs">
              {error}
            </div>
          ) : null}

          {PREMIUM_PRELAUNCH ? (
            <p className="mt-4 text-[11px] leading-5 text-[var(--text-muted)]">
              Die Vormerkung ist kostenlos und unverbindlich — es entsteht kein Abo und keine
              Zahlungspflicht. Zum Start erhältst du eine E-Mail und entscheidest dann.
            </p>
          ) : (
          <p className="mt-4 text-[11px] leading-5 text-[var(--text-muted)]">
            Mit dem Kauf akzeptierst du unsere{" "}
            <a href="/agb" target="_blank" rel="noreferrer" className="underline underline-offset-2">AGB</a>{" "}
            und die{" "}
            <a href="/datenschutz" target="_blank" rel="noreferrer" className="underline underline-offset-2">Datenschutzerklärung</a>.
            Du stimmst zu, dass die Leistung sofort beginnt; dein Widerrufsrecht erlischt dadurch nicht — du kannst
            innerhalb von 14 Tagen ohne Angabe von Gründen widerrufen und jederzeit zum Laufzeitende kündigen.
          </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--line-subtle)] bg-[var(--bg-surface)] px-5 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="pd24-btn pd24-btn-sm pd24-btn-secondary"
          >
            Später
          </button>
          {PREMIUM_PRELAUNCH ? (
            <button
              type="button"
              onClick={() => void handleVormerken()}
              disabled={loading || vorgemerkt}
              className="pd24-btn pd24-btn-primary active:scale-[0.98]"
            >
              {vorgemerkt ? (
                "✓ Vorgemerkt — wir melden uns"
              ) : loading ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                  Einen Moment…
                </>
              ) : (
                "Kostenlos vormerken →"
              )}
            </button>
          ) : (
          <button
            type="button"
            onClick={() => void handleUpgrade()}
            disabled={loading}
            className="pd24-btn pd24-btn-primary active:scale-[0.98]"
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
          )}
        </div>
      </div>
    </div>
  );
}
