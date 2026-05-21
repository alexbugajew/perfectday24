import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stadtrouten entdecken | PerfectDay24",
  description:
    "Stöbere durch kuratierte Routen in Berlin, Hamburg, München und mehr. Finde Inspiration für deinen nächsten Tag.",
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
