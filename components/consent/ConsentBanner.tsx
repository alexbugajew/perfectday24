"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CONSENT_OPEN_EVENT, getConsentState, setConsent } from "@/lib/consent";

/**
 * DSGVO-konformer Tracking-Consent-Banner.
 *
 * Erscheint beim ersten Besuch, wenn noch keine Entscheidung gespeichert ist,
 * und erneut, wenn irgendwo `openConsentBanner()` aufgerufen wird
 * („Cookie-Einstellungen“-Links) — so lässt sich eine Einwilligung jederzeit
 * ändern oder widerrufen. Slides von unten herein und verschwindet nach
 * Auswahl ohne Seitenreload.
 *
 * Auf Mobilgeräten sitzt der Banner oberhalb der Bottom-Navigation, auf
 * größeren Screens kompakter als schwebende Karte rechts unten.
 */
export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);

  const show = useCallback(() => {
    setVisible(true);
    // Trigger the slide-in transition on the next paint.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
  }, []);

  useEffect(() => {
    // Small delay so the banner doesn't flash during hydration; skip if a
    // decision is already stored.
    const showTimer = setTimeout(() => {
      if (getConsentState() === null) show();
    }, 600);

    // "Cookie-Einstellungen" links re-open the banner to change/withdraw.
    const onOpen = () => show();
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen);

    return () => {
      clearTimeout(showTimer);
      window.removeEventListener(CONSENT_OPEN_EVENT, onOpen);
    };
  }, [show]);

  function dismiss(decision: "accepted" | "declined") {
    // Close first — ein Fehler beim Speichern (blockierter Storage o.Ä.) darf
    // den Banner nie sichtbar hängen lassen.
    setEntered(false);
    // Remove from DOM after transition completes.
    setTimeout(() => setVisible(false), 320);
    try {
      setConsent(decision);
    } catch {
      // Speichern fehlgeschlagen — Banner ist trotzdem geschlossen; beim
      // nächsten Besuch wird erneut gefragt.
    }
  }

  if (!visible) return null;

  return (
    <div
      className={[
        // z-[1400]: über Seiten-CTAs/Run-Bars (z-[1200]), unter Modals (z-[1500]).
        "fixed bottom-0 left-0 right-0 z-[1400] px-3 pb-[5.4rem] pt-2 sm:bottom-5 sm:left-auto sm:right-4 sm:w-[22rem] sm:max-w-[calc(100vw-2rem)] sm:px-0 sm:pb-0 sm:pt-0",
        "transition-all duration-300 ease-out",
        entered ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
      ].join(" ")}
      role="dialog"
      aria-label="Cookie- und Tracking-Einstellungen"
      aria-modal="false"
    >
      <div className="mx-auto max-w-3xl overflow-hidden rounded-[20px] border border-[rgba(23,23,23,0.1)] bg-[#fffdf8] shadow-[0_8px_32px_rgba(23,23,23,0.14)] sm:max-w-none">
        <div className="flex max-h-[40vh] flex-col gap-3 overflow-y-auto px-4 py-3.5 sm:max-h-none sm:overflow-visible">

          {/* Text — mobil gekürzt, Langfassung ab sm */}
          <p className="text-[13px] leading-5 text-[#665d55]">
            <span className="font-semibold text-[#171717]">Wir nutzen Tracking </span>
            <span className="sm:hidden">
              für bessere Empfehlungen und faire Partner-Vergütung – anonymisiert,
              jederzeit änderbar.{" "}
            </span>
            <span className="hidden sm:inline">
              um Empfehlungen zu verbessern und Partnern eine faire Vergütung zu ermöglichen.
              Dabei werden anonymisierte IDs lokal gespeichert – keine personenbezogenen Daten
              weitergegeben. Deine Auswahl kannst du jederzeit über „Cookie-Einstellungen“
              im Footer oder in der Datenschutzerklärung ändern.{" "}
            </span>
            <Link
              href="/datenschutz"
              className="font-medium text-[#171717] underline underline-offset-2 transition hover:text-[#b76a43]"
            >
              <span className="sm:hidden">Mehr erfahren</span>
              <span className="hidden sm:inline">Datenschutzerklärung</span>
            </Link>
          </p>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => dismiss("declined")}
              className="min-h-10 flex-1 rounded-xl border border-[rgba(23,23,23,0.15)] bg-transparent px-3 py-2 text-sm font-medium text-[#665d55] transition hover:border-[rgba(23,23,23,0.3)] hover:bg-[rgba(23,23,23,0.04)] active:scale-[0.97]"
            >
              Nur Notwendige
            </button>
            <button
              type="button"
              onClick={() => dismiss("accepted")}
              className="min-h-10 flex-1 rounded-xl bg-[#171717] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1f2937] active:scale-[0.97]"
            >
              Akzeptieren
            </button>
          </div>

        </div>

        {/* Thin accent line at top */}
        <div className="h-[3px] w-full bg-[linear-gradient(90deg,rgba(183,106,67,0.6),rgba(122,141,114,0.4))]" />
      </div>
    </div>
  );
}
