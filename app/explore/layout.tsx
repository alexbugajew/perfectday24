import type { Metadata } from "next";

// Explore metadata refreshes every 10 minutes — keeps route counts + city list fresh.
export const revalidate = 600;

const description =
  "Stöbere durch kuratierte Routen in Berlin, Hamburg, München und mehr. Finde Inspiration für deinen nächsten Tag.";

export const metadata: Metadata = {
  title: "Stadtrouten entdecken | PerfectDay24",
  description,
  openGraph: {
    title: "Stadtrouten entdecken | PerfectDay24",
    description,
    locale: "de_DE",
    type: "website",
  },
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
