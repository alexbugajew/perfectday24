import type { Metadata } from "next";

// Ersetzt das deprecated head.tsx-Pattern — page.tsx ist "use client" und
// kann selbst kein metadata exportieren.
const description =
  "Finde neue Roadtrip-Strecken zwischen Start und Ziel, lasse dir passende Zwischenstopps vorschlagen und überführe die Route direkt in deinen Live-Roadtrip.";

export const metadata: Metadata = {
  title: "Roadtrip entdecken | PerfectDay24 — Zwischenstopps und neue Strecken finden",
  description,
  openGraph: {
    title: "Roadtrip entdecken | PerfectDay24",
    description,
    locale: "de_DE",
    type: "website",
  },
};

export default function RoadtripDiscoverLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
