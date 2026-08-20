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
      {/*
        Die Städte-Leiste steht bewusst im Layout und über der Seite, nicht in
        ihr: /explore nutzt useSearchParams für seine Filter und wird deshalb
        nicht vorgerendert. Alles in der Client-Komponente fehlt im
        ausgelieferten HTML — und genau dort sollen diese Links stehen, sonst
        bleiben die Stadtseiten verwaist.

        Ein erster Versuch platzierte die Leiste unter {children}. Sie landete
        damit am Ende einer sehr langen Seite und war praktisch unsichtbar. Als
        Kopfleiste erfüllt sie ihren Zweck: erst Stadt wählen, dann stöbern.
        Ihre Überschrift ist deshalb ein Label und kein <h2> — vor dem <h1> der
        Seite wäre das eine verdrehte Gliederung.
      */}
      <div className="pd24-page-wide px-1 pb-6 sm:px-2 lg:px-4">
        <CityCarousel
          cities={cities}
          compact
          kicker="Nach Stadt"
          title="Direkt in eine Stadt springen"
          moreHref="/planner"
          moreLabel="Eigenen Tag planen"
        />
      </div>

      {children}
    </>
  );
}
