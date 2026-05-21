import type { Metadata } from "next";

const description =
  "Hochzeiten, Geburtstage, Firmenfeiern – finde passende Locations und Dienstleister mit klarer Kalkulationsbasis.";

export const metadata: Metadata = {
  title: "Event planen | PerfectDay24",
  description,
  openGraph: {
    title: "Event planen | PerfectDay24",
    description,
    locale: "de_DE",
    type: "website",
  },
};

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
