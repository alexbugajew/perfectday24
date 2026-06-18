import type { Metadata } from "next";

// Explore metadata refreshes every 10 minutes — keeps route counts + city list fresh.
export const revalidate = 600;

const description =
  "Entdecke kuratierte Tagesrouten in Berlin, Hamburg, München und allen deutschen Großstädten — für Date Nights, Familientage, Ausflüge und mehr.";

export const metadata: Metadata = {
  title: "Routen entdecken | PerfectDay24 — Tagesrouten für alle Städte",
  description,
  openGraph: {
    title: "Routen entdecken | PerfectDay24",
    description,
    locale: "de_DE",
    type: "website",
  },
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
