import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profil | PerfectDay24",
  description:
    "Verwalte dein Konto, deine Interessen, deine gemerkten Inhalte und deine erweiterten Zugänge in deinem PerfectDay24-Profil.",
};

export default function ProfileLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
