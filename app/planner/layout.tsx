import type { Metadata } from "next";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

const description =
  "Erstelle deinen Tagesplan – PerfectDay24 kombiniert echte Orte, aktuelle Events und sinnvolle Wege zu einem konkreten Vorschlag. Kostenlos, keine Anmeldung nötig.";

export const metadata: Metadata = {
  title: "Tag planen | PerfectDay24",
  description,
  openGraph: {
    title: "Tag planen | PerfectDay24",
    description,
    locale: "de_DE",
    type: "website",
  },
};

export default function PlannerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
