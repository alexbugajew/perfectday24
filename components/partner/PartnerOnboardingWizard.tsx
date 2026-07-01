"use client";

import { useEffect, useState } from "react";

// Reduziert die überwältigende 7-Tab-Navigation auf einen linearen 4-Schritt-Flow,
// solange der Partner noch nicht "in Betrieb" ist (Profil unvollständig, keine
// Assets veröffentlicht, keine Review eingereicht). Sobald aktive Partner
// zurückkehren, springt der Wizard von selbst in den Erfolgs-Zustand und der
// User nutzt normal die Section-Navigation darunter.

type Props = {
  profile: {
    display_name: string;
    contact_email: string | null;
    contact_phone: string | null;
    website_url: string | null;
    booking_url: string | null;
    notes: string | null;
    media_urls: string[];
    primary_city_slug: string | null;
    review_status: string;
  };
  providersCount: number;
  onSubmitForReview: () => void;
  onDismissForever: () => void;
  isSubmitting: boolean;
  reviewReady: boolean;
};

type StepKey = "profile" | "media" | "offer" | "submit";

type Step = {
  key: StepKey;
  index: number;
  title: string;
  description: string;
  anchor: string;
  primaryCta: string;
  isDone: boolean;
};

export default function PartnerOnboardingWizard({
  profile,
  providersCount,
  onSubmitForReview,
  onDismissForever,
  isSubmitting,
  reviewReady,
}: Props) {
  const [dismissed, setDismissed] = useState(false);

  // Dismiss-State aus localStorage laden — persistiert über Reloads,
  // aber pro Browser/Gerät (kein DB-Roundtrip).
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const flag = window.localStorage.getItem("pd24-partner-wizard-dismissed");
      if (flag === "1") setDismissed(true);
    } catch {
      // localStorage nicht verfügbar (Private-Mode etc.) → einfach nichts machen.
    }
  }, []);

  const profileDone = Boolean(
    profile.display_name.trim() &&
    profile.primary_city_slug &&
    (profile.website_url || profile.booking_url) &&
    profile.contact_email &&
    profile.notes
  );
  const mediaDone = (profile.media_urls?.length ?? 0) > 0;
  const offerDone = providersCount > 0;
  const submittedOrLater = ["submitted", "in_review", "approved", "published"].includes(profile.review_status);
  const submitDone = submittedOrLater;

  const steps: Step[] = [
    {
      key: "profile",
      index: 1,
      title: "Profil-Basics",
      description: "Anzeigename, Stadt, Kontakt, Kurzbeschreibung und CTA-Link hinterlegen.",
      anchor: "#profile",
      primaryCta: "Profil bearbeiten",
      isDone: profileDone,
    },
    {
      key: "media",
      index: 2,
      title: "Titelbild hochladen",
      description: "Mindestens ein Coverbild macht deinen Eintrag klickstark.",
      anchor: "#assets",
      primaryCta: "Bilder verwalten",
      isDone: mediaDone,
    },
    {
      key: "offer",
      index: 3,
      title: "Erstes Angebot",
      description: "Location, Event-Baustein oder Route anlegen — das macht dich buchbar.",
      anchor: "#asset-studio",
      primaryCta: "Angebot anlegen",
      isDone: offerDone,
    },
    {
      key: "submit",
      index: 4,
      title: "Zur Freigabe einreichen",
      description: "Unser Team prüft Qualität und Rechte, danach gehst du live.",
      anchor: "#review",
      primaryCta: submitDone ? "Status ansehen" : "Zur Freigabe senden",
      isDone: submitDone,
    },
  ];

  const doneCount = steps.filter((s) => s.isDone).length;
  const allDone = doneCount === steps.length;
  const nextStep = steps.find((s) => !s.isDone);
  const percent = Math.round((doneCount / steps.length) * 100);

  function handleDismiss() {
    try {
      window.localStorage.setItem("pd24-partner-wizard-dismissed", "1");
    } catch {
      // ignore
    }
    setDismissed(true);
    onDismissForever();
  }

  // Wenn User dismissed hat UND schon halb-durch ist, wollen wir ihn nicht mehr nerven.
  // Falls er trotzdem in "draft" hängt und noch nicht submitted hat, blenden wir
  // trotzdem nichts ein — sein Wille zählt.
  if (dismissed) return null;

  return (
    <div className="mb-8 overflow-hidden rounded-[32px] border border-[rgba(196,137,79,0.32)] bg-[linear-gradient(160deg,rgba(255,249,241,0.94),rgba(255,253,248,0.86))] shadow-[var(--shadow-soft)]">
      {/* Header + Progress */}
      <div className="flex flex-col gap-4 border-b border-[rgba(196,137,79,0.18)] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-warm)]">
            Onboarding · {doneCount} / {steps.length} erledigt
          </div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-2xl">
            {allDone
              ? "Alle Grundschritte erledigt."
              : nextStep
                ? `Nächster Schritt: ${nextStep.title}`
                : "Willkommen im Partner Studio"}
          </h2>
          {!allDone && nextStep ? (
            <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted-warm)]">{nextStep.description}</p>
          ) : allDone ? (
            <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted-warm)]">
              {submitDone
                ? "Dein Profil ist in der Pruefung — du bekommst eine Benachrichtigung sobald es live geht."
                : "Klick auf 'Zur Freigabe senden' und wir uebernehmen die Qualitaetspruefung."}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 self-start rounded-full border border-[var(--line-subtle)] bg-white/72 px-3.5 py-1.5 text-xs font-medium text-[var(--text-muted-warm)] transition hover:border-[var(--text-strong)] hover:text-[var(--text-strong)] sm:self-center"
        >
          Zum vollen Dashboard →
        </button>
      </div>

      {/* Progress-Bar */}
      <div className="px-6 pt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(196,137,79,0.16)]">
          <div
            className="h-full rounded-full bg-[var(--brand-warm)] transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* 4 Schritte als Grid — auf Desktop nebeneinander, Mobile stapelt */}
      <div className="grid gap-3 px-6 py-5 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step) => {
          const isActive = !step.isDone && step.key === nextStep?.key;
          return (
            <div
              key={step.key}
              className={`flex flex-col overflow-hidden rounded-[24px] border p-4 transition ${
                step.isDone
                  ? "border-[rgba(24,140,80,0.28)] bg-white/78"
                  : isActive
                    ? "border-[rgba(196,137,79,0.45)] bg-white shadow-[0_10px_30px_rgba(196,137,79,0.14)]"
                    : "border-[var(--line-subtle)] bg-white/72"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                    step.isDone
                      ? "bg-[rgba(24,140,80,0.14)] text-[#188c50]"
                      : isActive
                        ? "bg-[var(--brand-warm)] text-white"
                        : "border border-[var(--line-subtle)] bg-white text-[var(--text-muted-warm)]"
                  }`}
                >
                  {step.isDone ? "✓" : step.index}
                </div>
                {step.isDone ? (
                  <span className="rounded-full bg-[rgba(24,140,80,0.12)] px-2 py-0.5 text-[10px] font-semibold text-[#188c50]">
                    Fertig
                  </span>
                ) : isActive ? (
                  <span className="rounded-full bg-[rgba(196,137,79,0.14)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-warm)]">
                    Jetzt
                  </span>
                ) : null}
              </div>
              <div className="mt-3 text-sm font-semibold text-[var(--text-strong)]">{step.title}</div>
              <div className="mt-1 flex-1 text-xs leading-5 text-[var(--text-muted-warm)]">{step.description}</div>

              {step.key === "submit" && !step.isDone ? (
                <button
                  type="button"
                  onClick={onSubmitForReview}
                  disabled={!reviewReady || isSubmitting}
                  className={`mt-3 inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    reviewReady
                      ? "bg-[var(--text-strong)] text-white hover:opacity-90"
                      : "bg-[rgba(23,23,23,0.06)] text-[var(--text-muted-warm)]"
                  } disabled:opacity-60`}
                  title={!reviewReady ? "Erst die vorherigen Schritte abschliessen." : undefined}
                >
                  {isSubmitting ? "Wird gesendet…" : step.primaryCta}
                </button>
              ) : (
                <a
                  href={step.anchor}
                  className={`mt-3 inline-flex items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    step.isDone
                      ? "border-[var(--line-subtle)] bg-white/72 text-[var(--text-muted-warm)] hover:text-[var(--text-strong)]"
                      : "border-[var(--text-strong)] bg-white text-[var(--text-strong)] hover:bg-[rgba(23,23,23,0.04)]"
                  }`}
                >
                  {step.isDone ? "Ansehen" : step.primaryCta} →
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer-Nudge nur wenn alle 4 fertig */}
      {allDone && !submitDone ? (
        <div className="flex flex-col gap-3 border-t border-[rgba(196,137,79,0.18)] bg-white/62 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-[var(--text-muted-warm)]">
            Alles vorbereitet. Ein Klick, und wir schauen drüber.
          </div>
          <button
            type="button"
            onClick={onSubmitForReview}
            disabled={!reviewReady || isSubmitting}
            className="inline-flex items-center justify-center rounded-2xl bg-[var(--text-strong)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? "Wird gesendet…" : "Zur Freigabe einreichen"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
