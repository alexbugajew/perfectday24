import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";
import {
  PD24Button,
  PD24Card,
  PD24SectionIntro,
  PD24SiteHeader,
  PD24StatusBadge,
} from "@/components/ui/pd24";
import HomepageLiveDiscoverySection from "@/components/home/HomepageLiveDiscoverySection";
import HomepagePlannerEntry from "@/components/home/HomepagePlannerEntry";
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-pd24-display",
});

const trustSignals = [
  "Echte Events statt Trefferliste",
  "Realistische Wege und Timing",
  "Gemeinsam schneller entscheiden",
];

const differentiationCards = [
  {
    title: "Aus Empfehlungen wird ein Ablauf",
    body: "PerfectDay24 ordnet Stops, Wege und Timing so, dass der Tag wie aus einem Guss wirkt statt wie eine Trefferliste.",
    accent: "bg-[linear-gradient(180deg,rgba(255,253,248,0.94),rgba(244,236,227,0.92))]",
  },
  {
    title: "Echte Events werden sinnvoll eingebettet",
    body: "Ein Konzert, Markt oder Ausstellungsbesuch wird als Hauptmoment geplant und nicht nur zufällig dazwischen geschoben.",
    accent: "bg-[linear-gradient(180deg,rgba(251,246,239,0.96),rgba(235,244,248,0.92))]",
  },
  {
    title: "Gruppen kommen schneller zu einer Wahl",
    body: "Varianten, Priorisierung und Bestätigung sind als echte Produktlogik gedacht, nicht als improvisierter Chat-Umweg.",
    accent: "bg-[linear-gradient(180deg,rgba(251,247,241,0.96),rgba(237,243,235,0.92))]",
  },
];

const heroStops = [
  {
    time: "17:45",
    title: "Aperitif in Charlottenburg",
    note: "ruhiger Start mit kurzer Anfahrt",
    tag: "Warm-up",
  },
  {
    time: "19:10",
    title: "Dinner vor dem Hauptmoment",
    note: "genug Luft vor der festen Uhrzeit",
    tag: "Dinner",
  },
  {
    time: "20:30",
    title: "Live-Event als Peak",
    note: "echter Anlass statt zufälliger Zusatz",
    tag: "Event",
  },
  {
    time: "22:35",
    title: "Bar für den Ausklang",
    note: "nah an der Venue und nicht mehr getaktet",
    tag: "Ausklang",
  },
];

const heroSignals = [
  "24 Min Gesamtweg",
  "2 Personen abgestimmt",
  "1 Eventfenster sauber integriert",
];

const liveProofCards = [
  {
    value: "3+ Stops",
    title: "Geprüfte Routen aus Explore",
    body: "Auf der Homepage landen nur öffentliche Routen, die genug Struktur für einen vertrauenswürdigen Einstieg mitbringen.",
  },
  {
    value: "Startlogik",
    title: "Planner mit echter Startlogik",
    body: "Stadt, Anlass, Fokus und Datum gehen nicht verloren, sondern werden als konkrete Startkonfiguration übernommen.",
  },
  {
    value: "2 Wege",
    title: "Gruppenwahl ohne Chat-Chaos",
    body: "Varianten, Stimmen und Bestätigung bleiben lesbar, damit ein gemeinsamer Tag nicht an der Abstimmung scheitert.",
  },
];

const decisionSteps = [
  {
    number: "01",
    title: "Rahmen setzen",
    body: "Anlass, Stadt und Stimmung legen fest, wie sich der Tag anfühlen soll.",
  },
  {
    number: "02",
    title: "Varianten vergleichen",
    body: "Nicht jeder Vorschlag ist gleich gut. Die stärkeren Routen werden sichtbar priorisiert.",
  },
  {
    number: "03",
    title: "Gemeinsam bestätigen",
    body: "Sobald eine Hauptvariante feststeht, kann die Gruppe direkt mit derselben Version weiterarbeiten.",
  },
];

function MetricPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[rgba(23,23,23,0.1)] bg-white/82 px-4 py-2 text-sm text-[#665d55]">
      {children}
    </span>
  );
}

export default function HomepageScaffoldMinimal() {
  return (
    <div className={`${display.variable} min-h-screen bg-[#f7f4ee] text-[#171717]`}>
      <div className="mx-auto max-w-[1200px] pb-20 pt-6">
        <PD24SiteHeader
          title="PerfectDay24"
          subtitle="Curated City Planning"
          navItems={[
            { href: "/planner", label: "Planen" },
            { href: "/explore", label: "Entdecken" },
            { href: "/events", label: "Events" },
            { href: "/saved", label: "Gespeichert" },
            { href: "/profile", label: "Profil" },
          ]}
          ctaHref="/planner"
          ctaLabel="Tag planen"
          className="border-[rgba(23,23,23,0.08)] bg-[rgba(255,253,248,0.78)]"
        />

        <main className="mt-6 space-y-16 sm:space-y-24">
          <section className="relative overflow-hidden rounded-[32px] border border-[rgba(23,23,23,0.08)] bg-[linear-gradient(135deg,rgba(255,253,248,0.98),rgba(244,236,227,0.95))] px-5 py-6 shadow-[0_28px_80px_rgba(49,39,27,0.1)] sm:px-8 sm:py-10">
            <div className="pointer-events-none absolute left-[-4rem] top-[-4rem] h-40 w-40 rounded-full bg-[rgba(183,106,67,0.12)] blur-3xl" />
            <div className="pointer-events-none absolute bottom-[-4rem] right-[-2rem] h-44 w-44 rounded-full bg-[rgba(122,141,114,0.14)] blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] lg:items-center">
              <div className="max-w-2xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#b76a43]">
                  Stadt. Anlass. Route. Ein stimmiger Tag.
                </div>
                <h1 className="mt-4 font-[family:var(--font-pd24-display)] text-[2.75rem] leading-[0.96] tracking-tight text-[#171717] sm:text-6xl lg:text-7xl">
                  Plane einen Tag, der zu euch und zur Stadt passt.
                </h1>
                <p className="mt-5 max-w-xl text-lg leading-8 text-[#665d55]">
                  Wähle Stadt, Anlass und Stimmung. PerfectDay24 macht daraus einen Ablauf mit
                  echten Events, passenden Orten, realistischen Wegen und einer klaren gemeinsamen
                  Wahl.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <PD24Button href="/planner" className="w-full sm:w-auto">
                    Tag planen
                  </PD24Button>
                  <PD24Button href="/explore" variant="secondary" className="hidden sm:inline-flex">
                    Entdecken
                  </PD24Button>
                </div>

                <div className="mt-7 flex flex-wrap gap-3">
                  {trustSignals.map((signal) => (
                    <MetricPill key={signal}>{signal}</MetricPill>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-[rgba(23,23,23,0.08)] bg-[rgba(255,253,248,0.94)] p-5 shadow-[0_24px_64px_rgba(49,39,27,0.12)] sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(23,23,23,0.08)] pb-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b7767]">
                      Beispiel für einen Date-Abend
                    </div>
                    <div className="mt-2 text-2xl font-semibold tracking-tight text-[#171717]">
                      Berlin | Event-Plan | Heute Abend
                    </div>
                    <div className="mt-2 text-sm leading-6 text-[#665d55]">
                      Ein fester Hauptmoment, kurze Wege und genug Luft zwischen den Stops.
                    </div>
                  </div>
                  <PD24StatusBadge tone="warning">Live-Event als Peak</PD24StatusBadge>
                </div>

                <div className="mt-5 space-y-3">
                  {heroStops.map((stop, index) => (
                    <div
                      key={stop.time}
                      className="grid grid-cols-[52px_1fr_auto] items-start gap-3 rounded-[22px] border border-[rgba(23,23,23,0.08)] bg-white/86 px-4 py-4"
                    >
                      <div className="text-sm font-semibold text-[#b76a43]">{stop.time}</div>
                      <div>
                        <div className="text-base font-medium text-[#171717]">{stop.title}</div>
                        <div className="mt-1 text-sm leading-6 text-[#665d55]">{stop.note}</div>
                      </div>
                      <div className="flex min-h-8 min-w-8 items-center justify-center rounded-[16px] bg-[#171717] px-2 text-xs font-semibold text-white">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[24px] border border-[rgba(23,23,23,0.08)] bg-[linear-gradient(180deg,rgba(249,243,235,0.95),rgba(255,253,248,0.96))] p-5">
                  <div className="flex flex-wrap gap-2">
                    {heroSignals.map((signal) => (
                      <MetricPill key={signal}>{signal}</MetricPill>
                    ))}
                  </div>
                  <div className="mt-4 text-sm leading-7 text-[#665d55]">
                    Genau diese Art von Vorschau bekommst du, bevor du in den Planner springst:
                    nicht nur Orte, sondern eine plausible Dramaturgie für den Abend.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-3">
            {differentiationCards.map((card) => (
              <PD24Card
                key={card.title}
                className={`border-[rgba(23,23,23,0.08)] ${card.accent} pd24-card-interactive h-full`}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#b76a43]">
                  Warum PerfectDay24
                </div>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[#171717]">
                  {card.title}
                </h3>
                <p className="mt-3 text-base leading-7 text-[#665d55]">{card.body}</p>
              </PD24Card>
            ))}
          </section>

          {/* Weitere Möglichkeiten — nachgeordnete Einstiege als kleine Textlinks */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[#8b7767]">
            <span className="font-medium text-[#665d55]">Weitere Einstiege:</span>
            <Link
              href="/routes"
              className="underline-offset-2 transition hover:text-[#171717] hover:underline"
            >
              Route als Vorlage nutzen
            </Link>
            <Link
              href="/events"
              className="underline-offset-2 transition hover:text-[#171717] hover:underline"
            >
              Event-Plan erstellen
            </Link>
          </div>

          <HomepagePlannerEntry />

          <HomepageLiveDiscoverySection />

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
            <PD24Card padding="lg" className="border-[rgba(23,23,23,0.08)] bg-[rgba(255,253,248,0.9)]">
              <PD24SectionIntro
                eyebrow="Live Proof"
                title="Jeder Einstieg soll wie ein Produkt wirken, nicht wie ein Datenauszug."
                body="Homepage, Planner, Explore und Creator-Routen greifen als ein gemeinsamer Flow ineinander. Das schafft Vertrauen und reduziert Reibung vor dem ersten Klick."
              />

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {liveProofCards.map((card) => (
                  <div
                    key={card.title}
                    className="rounded-[24px] border border-[rgba(23,23,23,0.08)] bg-white/90 p-5"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b76a43]">
                      {card.value}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-[#171717]">{card.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-[#665d55]">{card.body}</p>
                  </div>
                ))}
              </div>
            </PD24Card>

            <PD24Card tone="dark" padding="lg" className="border-[rgba(23,23,23,0.08)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#d0b7a8]">
                Was Nutzer sofort verstehen sollen
              </div>
              <h3 className="mt-3 font-[family:var(--font-pd24-display)] text-4xl leading-tight">
                Hier wird nicht nur gesucht. Hier wird ein Tag zusammengesetzt.
              </h3>
              <div className="mt-6 space-y-3">
                {[
                  "Ein fester Hauptmoment kann den ganzen Tag strukturieren.",
                  "Gute Orte sind nur dann stark, wenn Wege und Timing mitgedacht sind.",
                  "Gruppen brauchen klare Vorschläge und eine echte gemeinsame Wahl.",
                ].map((point) => (
                  <div
                    key={point}
                    className="rounded-[20px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-4 py-3 text-sm leading-6 text-[rgba(255,255,255,0.78)]"
                  >
                    {point}
                  </div>
                ))}
              </div>
            </PD24Card>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <PD24Card padding="lg" className="border-[rgba(23,23,23,0.08)] bg-[rgba(255,253,248,0.9)]">
              <PD24SectionIntro
                eyebrow="Gemeinsam entscheiden"
                title="Wenn mehrere mitreden, bleibt der Tag trotzdem stimmig."
                body="PerfectDay24 hilft nicht nur beim Planen, sondern auch beim gemeinsamen Festlegen. Das spart Chat-Chaos und macht die beste Variante sichtbar."
              />

              <div className="mt-8 space-y-4">
                {decisionSteps.map((step) => (
                  <div
                    key={step.number}
                    className="grid grid-cols-[52px_1fr] gap-4 rounded-[22px] border border-[rgba(23,23,23,0.08)] bg-white/88 px-4 py-4"
                  >
                    <div className="font-[family:var(--font-pd24-display)] text-3xl leading-none text-[#b76a43]">
                      {step.number}
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-[#171717]">{step.title}</div>
                      <div className="mt-2 text-sm leading-6 text-[#665d55]">{step.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </PD24Card>

            <PD24Card padding="lg" className="border-[rgba(23,23,23,0.08)] bg-[rgba(255,253,248,0.96)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b7767]">
                    Wahlmoment
                  </div>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#171717]">
                    Zwei Varianten, eine klare gemeinsame Wahl
                  </h3>
                </div>
                <PD24StatusBadge tone="success">Bestätigt</PD24StatusBadge>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-[24px] border border-[rgba(122,141,114,0.28)] bg-[rgba(122,141,114,0.12)] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-[#171717]">Unsere Wahl</div>
                      <div className="mt-1 text-sm text-[#5e6d59]">2 von 2 stimmen zu</div>
                    </div>
                    <PD24StatusBadge tone="success">Bestätigt</PD24StatusBadge>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#5e6d59]">
                    Kompakte Wege, ein klarer Event-Peak und genug Luft für einen ruhigen
                    Ausklang. Passt für beide am besten.
                  </p>
                </div>

                <div className="rounded-[24px] border border-[rgba(23,23,23,0.08)] bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-[#171717]">Noch offen</div>
                      <div className="mt-1 text-sm text-[#665d55]">mehr Dynamik, aber dichter getaktet</div>
                    </div>
                    <PD24StatusBadge tone="warning">Alternative</PD24StatusBadge>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#665d55]">
                    Mehr Stops und mehr Tempo, aber auch mehr Reibung im Ablauf und weniger Ruhe
                    nach dem Hauptmoment.
                  </p>
                </div>
              </div>
            </PD24Card>
          </section>

          <section className="rounded-[32px] bg-[#171717] px-6 py-10 text-[#fffdf8] shadow-[0_28px_80px_rgba(49,39,27,0.18)] sm:px-8">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d0b7a8]">
                Final CTA
              </div>
              <h2 className="mt-4 font-[family:var(--font-pd24-display)] text-[2.75rem] leading-[0.98] tracking-tight sm:text-6xl">
                Starte mit einem klaren Rahmen. Der Plan folgt.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[rgba(255,253,248,0.78)]">
                Starte mit Stadt, Anlass und Stimmung. PerfectDay24 macht daraus einen Tag mit
                Richtung.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <PD24Button href="/planner">Tag planen</PD24Button>
                <PD24Button
                  href="/routes"
                  variant="secondary"
                  className="border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.06)] text-white hover:bg-[rgba(255,255,255,0.12)] hover:text-white"
                >
                  Route als Vorlage nutzen
                </PD24Button>
              </div>
            </div>
          </section>
        </main>

        <footer className="mt-12 rounded-[28px] border border-[rgba(23,23,23,0.08)] bg-[rgba(255,253,248,0.78)] px-6 py-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-lg font-semibold tracking-tight text-[#171717]">PerfectDay24</div>
              <div className="mt-2 text-sm text-[#665d55]">
                Curated city planning for better dates, better visits and better shared days.
              </div>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#665d55]">
              <Link href="/planner">Planen</Link>
              <Link href="/explore">Entdecken</Link>
              <Link href="/events">Events</Link>
              <Link href="/saved">Gespeichert</Link>
              <Link href="/impressum">Impressum</Link>
              <Link href="/datenschutz">Datenschutz</Link>
              <Link href="/agb">AGB</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
