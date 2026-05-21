import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Geteilter Plan | PerfectDay24",
  description:
    "Ein konkreter Tagesplan wurde mit dir geteilt — Stops, Timing und Route auf einen Blick. Übernimm den Plan in deinen Planner und passe ihn an.",
  robots: { index: false, follow: false },
};

export default function SharedPlanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
