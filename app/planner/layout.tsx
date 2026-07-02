import type { Metadata } from "next";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

const description =
  "Erstelle deinen Tagesplan – PerfectDay24 kombiniert echte Orte, aktuelle Events und sinnvolle Wege zu einem konkreten Vorschlag. Kostenlos, keine Anmeldung nötig.";
const ogImage = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=630&fit=crop&auto=format&q=80";

export const metadata: Metadata = {
  title: "Tag planen | PerfectDay24 — Autopilot mit echten Events",
  description,
  openGraph: {
    title: "Tag planen | PerfectDay24",
    description,
    locale: "de_DE",
    type: "website",
    images: [{ url: ogImage, width: 1200, height: 630, alt: "Kerzenlichter Dinner — Tagesplan" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tag planen | PerfectDay24",
    description,
    images: [ogImage],
  },
};

export default function PlannerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
