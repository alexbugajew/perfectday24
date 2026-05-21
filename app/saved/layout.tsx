import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Meine Pläne | PerfectDay24",
  description:
    "Alle deine gespeicherten Tagespläne und Routen an einem Ort – fortsetzen, teilen oder neu starten.",
};

export default function SavedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
