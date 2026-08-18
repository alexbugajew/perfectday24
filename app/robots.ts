import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.perfectday24.de";

/**
 * Pfade, die kein Crawler indexieren soll: Admin, API, eingeloggte Bereiche
 * und das Planner-Ergebnis (nutzerindividuell, kein Suchergebnis-Wert).
 */
const DISALLOWED_PATHS = [
  "/admin/",
  "/api/",
  "/partner/dashboard/",
  "/partner/onboarding/",
  "/profile/",
  "/saved/",
  "/planner/result/",
];

/**
 * Crawler, die Seiten zur Beantwortung einer konkreten Nutzerfrage abrufen und
 * dabei verlinken. Sie bringen Sichtbarkeit und sollen ausdrücklich rein —
 * ohne Eintrag hier gelten zwar ohnehin die `*`-Regeln, aber eine explizite
 * Nennung schützt davor, dass eine spätere Verschärfung der `*`-Regel sie
 * versehentlich mit aussperrt.
 */
const ANSWER_ENGINE_AGENTS = [
  "OAI-SearchBot", // ChatGPT Search — Index für Antworten mit Quellenangabe
  "ChatGPT-User", // ChatGPT ruft die Seite im Auftrag eines Nutzers ab
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "Applebot", // Siri/Spotlight — klassischer Index, nicht das Training
  "GPTBot", // siehe Kommentar unten
];

/**
 * Crawler, die Inhalte einsammeln, ohne etwas zurückzugeben.
 *
 * `Bytespider` (ByteDance) ist der klarste Fall: kein Produkt, das auf
 * PerfectDay24 verlinkt, aber hohe Last.
 *
 * `Google-Extended` steuert die Nutzung durch Gemini — **nicht** die normale
 * Google-Suche und nicht die AI Overviews; die Indexierung bleibt davon
 * unberührt. Die Sperre schützt den Datenbestand, kostet aber Sichtbarkeit in
 * Gemini-Antworten. Wenn Auffindbarkeit in KI-Antworten wichtiger wird als der
 * Schutz der Routendaten, ist dieser eine Eintrag die Stellschraube.
 *
 * `GPTBot` (Training für OpenAI-Modelle) steht bewusst NICHT hier: Er ist der
 * Weg, auf dem PerfectDay24 überhaupt als Marke in den Modellen auftaucht.
 */
const BULK_TRAINING_AGENTS = [
  "Bytespider",
  "Google-Extended",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOWED_PATHS,
      },
      {
        userAgent: ANSWER_ENGINE_AGENTS,
        allow: "/",
        disallow: DISALLOWED_PATHS,
      },
      {
        userAgent: BULK_TRAINING_AGENTS,
        disallow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
