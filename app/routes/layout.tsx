import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Routenstudio | PerfectDay24",
  description:
    "Erstelle, verfeinere und veröffentliche Routen für PerfectDay24. Das Routenstudio bündelt Builder, Varianten und öffentliche Sichtbarkeit an einem Ort.",
};

export default function RoutesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
