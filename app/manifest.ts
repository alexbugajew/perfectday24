import type { MetadataRoute } from "next";

// Web-App-Manifest über die Next-Dateikonvention (→ /manifest.webmanifest,
// wird automatisch im <head> verlinkt). Grundlage für "Zum Home-Bildschirm
// hinzufügen" und einen späteren Play-Store-Eintrag per Trusted Web Activity
// (siehe docs/app-readiness-plan.md — App-Readiness vor App-Bau).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PerfectDay24 – Deinen Tag planen",
    short_name: "PerfectDay24",
    description:
      "Plane deinen nächsten Tag in der Stadt – mit echten Orten, Events und Wegen.",
    id: "/",
    start_url: "/",
    scope: "/",
    // Keine orientation: Planner und Karten profitieren auf Tablets und im
    // Querformat von der Breite; eine feste Ausrichtung sperrt das ohne Not.
    display: "standalone",
    // Farben aus dem Marken-Kanon (globals.css): warmer Canvas als
    // Splash-Hintergrund, Akzentblau für Splash und Titelleiste beim App-Start.
    // Sobald die Seite geladen ist, gilt deren theme-color aus app/layout.tsx
    // (helle Navigation); der Wechsel ist der gewollte Übergang Splash → App.
    background_color: "#f7f4ee",
    theme_color: "#4d6678",
    lang: "de",
    categories: ["travel", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        // Maskable-Variante: Sonne bei ~66 % auf vollflächigem Canvas, damit
        // Androids runde Maske nichts vom Logo abschneidet (Safe-Zone 80 %).
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
