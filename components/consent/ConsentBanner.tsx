"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getConsentState, setConsent } from "@/lib/consent";

/**
 * DSGVO-konformer Tracking-Consent-Banner.
 *
 * Erscheint beim ersten Besuch, wenn noch keine Entscheidung gespeichert ist.
 * Slides von unten herein (CSS-Transition), verschwindet nach Auswahl ohne
 * Seitenreload.
 *
 * Positionierung: bottom-0 mit bottom-padding-Ausgleich für die Mobile
 * Bottom-Nav (pb-20 sm:pb-0).  z-[200] stellt sicher, dass der Banner über
 * allen anderen Fixed-Elementen liegt.
 */
export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    // Don't show if decision already stored.
    if (getConsentState() !== null) return;

    // Small delay so the banner doesn't flash during hydration.
    const showTimer = setTimeout(() => {
      setVisible(true);
      // Trigger the slide-in transition on the next paint.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntered(true));
      });
    }, 600);

    return () => clearTimeout(showTimer);
  }, []);

  function dismiss(decision: "accepted" | "declined") {
    setConsent(decision);
    setEntered(false);
    // Remove from DOM after transition completes.
    setTimeout(() => setVisible(false), 320);
  }

  if (!visible) return null;

  return (
    <div
      className={[
        "fixed bottom-0 left-0 right-0 z-[200] px-3 pb-20 pt-3 sm:pb-4",
        "transition-all duration-300 ease-out",
        entered ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
      ].join(" ")}
      role="dialog"
      aria-label="Cookie- und Tracking-Einstellungen"
      aria-modal="false"
    >
      <div className="mx-auto max-w-3xl overflow-hidden rounded-[22px] border border-[rgba(23,23,23,0.1)] bg-[#fffdf8] shadow-[0_8px_48px_rgba(23,23,23,0.16)]">
        <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:gap-6">

          {/* Text */}
          <p className="flex-1 text-sm leading-6 text-[#665d55]">
            <span className="font-semibold text-[#171717]">Wir nutzen Tracking </span>
            um Empfehlungen zu verbessern und Partnern eine faire Vergütung zu ermöglichen.
            Dabei werden anonymisierte IDs lokal gespeichert — keine personenbezogenen Daten
            weitergegeben.{" "}
            <Link
              href="/datenschutz"
              className="font-medium text-[#171717] underline underline-offset-2 transition hover:text-[#b76a43]"
            >
              Datenschutzerklärung
            </Link>
          </p>

          {/* Buttons */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => dismiss("declined")}
              className="rounded-xl border border-[rgba(23,23,23,0.15)] bg-transparent px-4 py-2.5 text-sm font-medium text-[#665d55] transition hover:border-[rgba(23,23,23,0.3)] hover:bg-[rgba(23,23,23,0.04)] active:scale-[0.97]"
            >
              Nur Notwendige
            </button>
            <button
              type="button"
              onClick={() => dismiss("accepted")}
              className="rounded-xl bg-[#171717] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f2937] active:scale-[0.97]"
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
