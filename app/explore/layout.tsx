import type { Metadata } from "next";

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

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
