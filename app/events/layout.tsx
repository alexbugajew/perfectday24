import type { Metadata } from "next";

const description =
  "Hochzeiten, Geburtstage und Firmenfeiern – finde passende Locations und Dienstleister mit klarer Kalkulationsbasis.";
const ogImage = "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=1200&h=630&fit=crop&auto=format&q=80";

export const metadata: Metadata = {
  title: "Event planen | PerfectDay24",
  description,
  openGraph: {
    title: "Event planen | PerfectDay24",
    description,
    locale: "de_DE",
    type: "website",
    images: [{ url: ogImage, width: 1200, height: 630, alt: "Event-Location eingedeckt für Feier" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Event planen | PerfectDay24",
    description,
    images: [ogImage],
  },
};

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
