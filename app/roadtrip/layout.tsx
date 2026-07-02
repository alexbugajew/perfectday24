import type { Metadata } from "next";

const description =
  "Plane mehrtägige Roadtrips mit fertigen Stadtfolgen, konkreten Tagesabläufen, Hotels und sofort nutzbaren Vorlagen für deinen nächsten Trip.";
const ogImage = "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=1200&h=630&fit=crop&auto=format&q=80";

export const metadata: Metadata = {
  title: "Roadtrip planen | PerfectDay24 - Mehrtagesreisen mit fertigen Vorlagen",
  description,
  openGraph: {
    title: "Roadtrip planen | PerfectDay24",
    description,
    locale: "de_DE",
    type: "website",
    images: [{ url: ogImage, width: 1200, height: 630, alt: "Roadtrip durch die Landschaft" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Roadtrip planen | PerfectDay24",
    description,
    images: [ogImage],
  },
};

export default function RoadtripLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
