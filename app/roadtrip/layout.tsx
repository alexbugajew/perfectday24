import type { Metadata } from "next";

const description =
  "Plane deinen nächsten Roadtrip mit mehreren Städten, fertigen Vorlagen und konkreten Tagesabläufen. Für jedes Budget und jeden Stil.";

export const metadata: Metadata = {
  title: "Roadtrip planen | PerfectDay24 — Mehrstädtereisen mit fertigen Vorlagen",
  description,
  openGraph: {
    title: "Roadtrip planen | PerfectDay24",
    description,
    locale: "de_DE",
    type: "website",
  },
};

export default function RoadtripLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
