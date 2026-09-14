import { ImageResponse } from "next/og";
import { PD24_OG_THEME, ShareCard } from "@/lib/og/share-card";

// Site-weites Default-Vorschaubild (Next-Dateikonvention): greift überall,
// wo eine Seite kein eigenes og:image setzt — vorher zeigte das Root-Layout
// auf eine externe Unsplash-URL (Audit 08/2026, Abschnitt 4: fremde
// Abhängigkeit, fremdes Motiv). Eigenes Markenbild ohne Fotos, dadurch klein.

export const runtime = "edge";
export const alt = "PerfectDay24 — Dein perfekter Tag, geplant in Minuten";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <ShareCard
        kicker="Refined City Planning"
        title="Dein perfekter Tag, geplant in Minuten."
        facts="Echte Orte · Events · Routen in über 500 Städten"
        footerNote="perfectday24.de"
        theme={PD24_OG_THEME}
        emoji="🗺️"
      />
    ),
    size
  );
}
