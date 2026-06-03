import type { Metadata } from "next";

const description =
  "Hochzeiten, Geburtstage und Firmenfeiern – finde passende Locations und Dienstleister mit klarer Kalkulationsbasis.";

export const metadata: Metadata = {
  title: "Event planen | PerfectDay24",
  description,
  openGraph: {
    title: "Event planen | PerfectDay24",
    description,
    locale: "de_DE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Event planen | PerfectDay24",
    description,
  },
};

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
