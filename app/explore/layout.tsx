import type { Metadata } from "next";
import CityCarousel from "@/components/cities/CityCarousel";
import { listCitiesWithRoutes } from "@/lib/cities/city-directory";

// Explore metadata refreshes every 10 minutes so route counts and city labels stay fresh.
export const revalidate = 600;

const description =
  "Entdecke fertige Tagesrouten für Date Nights, Familienausflüge, Wochenenden und spontane freie Tage — direkt filterbar nach Stadt, Anlass und Stil.";

const ogImage = "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=1200&h=630&fit=crop&auto=format&q=80";

export const metadata: Metadata = {
  title: "Tagesrouten entdecken | PerfectDay24 — fertige Pläne für deinen freien Tag",
  description,
  openGraph: {
    title: "Tagesrouten entdecken | PerfectDay24",
    description,
    locale: "de_DE",
    type: "website",
    images: [{ url: ogImage, width: 1200, height: 630, alt: "Stadt am Abend — Tagesrouten entdecken" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tagesrouten entdecken | PerfectDay24",
    description,
    images: [ogImage],
  },
};

export default async function ExploreLayout({ children }: { children: React.ReactNode }) {
  const cities = await listCitiesWithRoutes();

  return (
    <>
      {children}

      {/*
        Die Städte-Übersicht steht bewusst im Layout und nicht in der Seite
        selbst: /explore nutzt useSearchParams für seine Filter und wird deshalb
        nicht vorgerendert. Alles, was in der Client-Komponente steht, fehlt im
        ausgelieferten HTML — und genau dort sollen diese Links stehen, weil die
        Stadtseiten sonst verwaist bleiben.

        Preis dieser Entscheidung: Der Abschnitt sitzt unter der Routenliste
        statt darüber. Weiter oben wäre er sichtbarer, aber für Crawler
        unsichtbar — und das ist der Hauptgrund, warum es ihn gibt.
      */}
      <div className="pd24-page-wide px-1 pb-16 sm:px-2 lg:px-4">
        <CityCarousel
          cities={cities}
          kicker="Nach Stadt stöbern"
          title="Alle Städte mit fertigen Routen"
          subtitle="Jede Stadt mit eigener Übersicht, aktuellen Events und Plänen für jeden Anlass."
        />
      </div>
    </>
  );
}
