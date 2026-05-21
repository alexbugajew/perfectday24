import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MainNav from "@/components/MainNav";
import FloatingChat from "@/components/ui/FloatingChat";
import MobileBottomNav from "@/components/ui/MobileBottomNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PerfectDay24 – Deinen Tag planen",
  description:
    "Plane deinen nächsten Tag in der Stadt – mit echten Orten, Events und Wegen. Kostenlos, keine Anmeldung nötig.",
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
      </body>
    </html>
  );
}
