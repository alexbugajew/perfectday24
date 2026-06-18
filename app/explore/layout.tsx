import type { Metadata } from "next";

// Explore metadata refreshes every 10 minutes so route counts and city labels stay fresh.
export const revalidate = 600;

const description =
  "Entdecke fertige Tagesrouten für Date Nights, Familienausflüge, Wochenenden und spontane freie Tage — direkt filterbar nach Stadt, Anlass und Stil.";

export const metadata: Metadata = {
  title: "Tagesrouten entdecken | PerfectDay24 — fertige Pläne für deinen freien Tag",
  description,
  openGraph: {
    title: "Tagesrouten entdecken | PerfectDay24",
    description,
    locale: "de_DE",
    type: "website",
  },
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
