import type { Metadata } from "next";
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
const defaultOgImage = "https://images.unsplash.com/photo-1560969184-10fe8719e047?w=1200&h=630&fit=crop&auto=format&q=80";

export const metadata: Metadata = {
  title: "PerfectDay24 – Deinen Tag planen",
  description: siteDescription,
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "PerfectDay24 – Deinen Tag planen",
    description: siteDescription,
    url: siteUrl,
    siteName: "PerfectDay24",
    locale: "de_DE",
    type: "website",
    images: [
      { url: defaultOgImage, width: 1200, height: 630, alt: "PerfectDay24 — Deinen Tag planen" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PerfectDay24 – Deinen Tag planen",
    description: siteDescription,
    images: [defaultOgImage],
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
