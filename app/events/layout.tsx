import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Event planen | PerfectDay24",
  description:
    "Hochzeiten, Geburtstage, Firmenfeiern – finde passende Locations und Dienstleister mit klarer Kalkulationsbasis.",
};

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
