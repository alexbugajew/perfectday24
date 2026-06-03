import type { Metadata } from "next";

// Saved content is user-specific — revalidate shell hourly.
export const revalidate = 3600;

const description =
  "Alle deine gespeicherten Tagespläne und Routen an einem Ort – fortsetzen, teilen oder neu starten.";

export const metadata: Metadata = {
  title: "Meine Pläne | PerfectDay24",
  description,
  openGraph: {
    title: "Meine Pläne | PerfectDay24",
    description,
    locale: "de_DE",
    type: "website",
  },
};

export default function SavedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
