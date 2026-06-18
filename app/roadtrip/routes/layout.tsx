import type { Metadata } from "next";

const description =
  "Entdecke fertige Roadtrip-Routen mit mehreren Städten, konkreten Tagesplänen, Hotels und direktem Live-Start für Deutschland und Europa.";

export const metadata: Metadata = {
  title: "Roadtrip-Routen entdecken | PerfectDay24 - fertige Mehrtagesreisen",
  description,
  openGraph: {
    title: "Roadtrip-Routen entdecken | PerfectDay24",
    description,
    locale: "de_DE",
    type: "website",
  },
};

export default function RoadtripRoutesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
