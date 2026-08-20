import type { Metadata } from "next";
import { listOccasionParams, loadOccasionPageData } from "./data";
import { occasionHeadline } from "@/lib/cities/occasions";

export const revalidate = 3600;

/**
 * Hinweis zu unbekannten Kombinationen ("/explore/koeln/wandertag"):
 *
 * Sie landen in `notFound()`, werden aber mit **Status 200** ausgeliefert —
 * Next legt das gerenderte Not-Found-Ergebnis im ISR-Cache ab und spielt es
 * anschließend wie eine normale Seite aus (`x-nextjs-cache: HIT`). Dasselbe
 * gilt seit jeher fuer /explore/<stadt> und /routes/<slug>; es ist also kein
 * Verhalten, das diese Seiten neu einfuehren.
 *
 * Der naheliegende Ausweg `dynamicParams = false` wurde geprueft und wieder
 * verworfen: Er liefert zwar fuer unbekannte Anlaesse einen echten 404, laesst
 * den Server aber mit `NoFallbackError` abstuerzen, sobald die **Stadt** im
 * Pfad unbekannt ist (/explore/gibtesnicht/date-abend) — weil das
 * uebergeordnete [city]-Segment weiterhin dynamisch ist. Ein Absturz durch
 * eine geratene URL waere deutlich teurer als ein Soft-404.
 *
 * Eine saubere Loesung muesste am [city]-Segment ansetzen und gilt fuer alle
 * drei Seitentypen gemeinsam.
 */

/**
 * Nur Kombinationen vorrendern, für die es Routen gibt — `listOccasionParams`
 * fragt das direkt in der Datenbank ab. Alles andere läuft in `notFound()`.
 */
export async function generateStaticParams() {
  return listOccasionParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; occasion: string }>;
}): Promise<Metadata> {
  const { city, occasion } = await params;
  const data = await loadOccasionPageData(city, occasion);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.perfectday24.de";

  if (!data) return { title: "Tagesrouten | PerfectDay24" };

  const headline = occasionHeadline(data.occasion, data.city.label);
  const stopCount = data.routes.reduce((sum, route) => sum + route.stops.length, 0);

  // Der Titel nimmt die Suchanfrage wörtlich auf; die Description beantwortet
  // sie in einem Satz und nennt konkrete Zahlen statt Werbefloskeln.
  const title = `${headline} — fertige Routen | PerfectDay24`;
  const description =
    stopCount > 0
      ? `${data.occasion.question(data.city.label)} ${data.routes.length} ${
          data.routes.length === 1 ? "durchgeplante Route" : "durchgeplante Routen"
        } mit ${stopCount} Stopps in Reihenfolge — mit Wegen und realistischen Zeitfenstern.`
      : data.occasion.question(data.city.label);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${siteUrl}/explore/${city}/${occasion}`,
      type: "website",
      locale: "de_DE",
      ...(data.routes[0]?.cover_image_url
        ? { images: [{ url: data.routes[0].cover_image_url }] }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: `${siteUrl}/explore/${city}/${occasion}`,
    },
  };
}

export default function CityOccasionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
