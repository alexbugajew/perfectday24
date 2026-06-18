import type { Metadata } from "next";

const description =
  "Plane mehrtägige Roadtrips mit fertigen Stadtfolgen, konkreten Tagesabläufen, Hotels und sofort nutzbaren Vorlagen für deinen nächsten Trip.";

export const metadata: Metadata = {
  title: "Roadtrip planen | PerfectDay24 - Mehrtagesreisen mit fertigen Vorlagen",
  description,
  openGraph: {
    title: "Roadtrip planen | PerfectDay24",
    description,
    locale: "de_DE",
    type: "website",
  },
};

export default function RoadtripLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
