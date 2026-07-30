"use client";

import { openConsentBanner } from "@/lib/consent";

/**
 * „Cookie-Einstellungen“-Link, der den ConsentBanner erneut öffnet, damit
 * Nutzer ihre Einwilligung jederzeit ändern oder widerrufen können
 * (Art. 7 Abs. 3 DSGVO). Rein clientseitig, daher aus Server-Komponenten
 * (Footer, LegalPageShell) einbindbar.
 */
export default function ConsentSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => openConsentBanner()} className={className}>
      Cookie-Einstellungen
    </button>
  );
}
