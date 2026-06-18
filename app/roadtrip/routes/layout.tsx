import type { Metadata } from "next";

const description =
  "Entdecke fertige Roadtrip-Routen durch Deutschland. Mehrere Städte, konkrete Tagespläne und Hotel-Tipps — direkt als Vorlage übernehmen.";

export const metadata: Metadata = {
  title: "Roadtrip-Routen entdecken | PerfectDay24",
  description,
  openGraph: {
    title: "Roadtrip-Routen | PerfectDay24",
    description,
    locale: "de_DE",
    type: "website",
  },
};

export default function RoadtripRoutesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
