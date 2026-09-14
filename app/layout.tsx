import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import MainNav from "@/components/MainNav";
import FloatingChat from "@/components/ui/FloatingChat";
import MobileBottomNav from "@/components/ui/MobileBottomNav";
import ConsentBanner from "@/components/consent/ConsentBanner";
import Analytics from "@/components/analytics/Analytics";
import JsonLd from "@/components/seo/JsonLd";
import { organizationJsonLd, webSiteJsonLd } from "@/lib/seo/json-ld";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.perfectday24.de";
const siteDescription =
  "Plane deinen nächsten Tag in der Stadt – mit echten Orten, Events und Wegen. Kostenlos, keine Anmeldung nötig.";

// viewport-fit=cover, damit env(safe-area-inset-*) auf iOS echte Werte liefert
// (MobileBottomNav, Sticky-CTAs und Run-Bars nutzen die Insets bereits).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "PerfectDay24 – Deinen Tag planen",
  description: siteDescription,
  metadataBase: new URL(siteUrl),
  // Kein og:image hier: Das Default-Vorschaubild kommt aus
  // app/opengraph-image.tsx (Dateikonvention) — eigenes Markenbild statt
  // externer Unsplash-URL (Audit 08/2026, Abschnitt 4). Twitter/X fällt ohne
  // eigenes twitter:image automatisch auf og:image zurück.
  openGraph: {
    title: "PerfectDay24 – Deinen Tag planen",
    description: siteDescription,
    url: siteUrl,
    siteName: "PerfectDay24",
    locale: "de_DE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PerfectDay24 – Deinen Tag planen",
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="overflow-x-clip bg-[var(--bg-canvas)] text-[var(--text-strong)]">
        <MainNav />
        <div className="w-full min-w-0 overflow-x-clip px-4 py-6 pb-24 sm:pb-6 sm:px-6 lg:px-8">{children}</div>
        <FloatingChat />
        <MobileBottomNav />
        <ConsentBanner />
        {/* Sitewide-Auszeichnung: Wer betreibt die Seite, wie heißt sie.
            Seiten-spezifische Typen (TouristTrip, ItemList) haengen an den
            jeweiligen Seiten und verweisen ueber @id hierher. */}
        <JsonLd data={[organizationJsonLd(), webSiteJsonLd()]} />
        <Analytics />
      </body>
    </html>
  );
}
