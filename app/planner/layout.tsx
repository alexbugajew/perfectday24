import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

export const metadata: Metadata = {
  title: "Tag planen | PerfectDay24",
  description:
    "Erstelle deinen Tagesplan – PerfectDay24 kombiniert echte Orte, aktuelle Events und sinnvolle Wege zu einem konkreten Vorschlag. Kostenlos, keine Anmeldung nötig.",
};

export default function PlannerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
