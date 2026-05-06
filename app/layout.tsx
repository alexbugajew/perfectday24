import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MainNav from "@/components/MainNav";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PerfectDay - Curated City Planning",
  description:
    "Plane staedtische Tage mit lokaler Qualitaet, klarer Struktur und abgestimmten Gruppenentscheidungen.",
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
      <body className="bg-[var(--bg-canvas)] text-[var(--text-strong)]">
        <MainNav />
        <main className="mx-auto max-w-7xl px-5 py-6 sm:px-6 lg:px-8">{children}</main>
      </body>
    </html>
  );
}
