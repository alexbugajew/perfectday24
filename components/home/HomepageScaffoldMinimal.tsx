import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";
import {
  PD24Button,
  PD24Card,
  PD24StatusBadge,
} from "@/components/ui/pd24";
import HeroIntentBar from "@/components/home/HeroIntentBar";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-pd24-display",
});

const trustSignals = [
  "Echte Events statt Trefferliste",
  "Realistische Wege und Timing",
  "Per Link teilen und loslegen",
];

const differentiationCards = [
  {
    title: "Kein Suchprozess — ein fertiger Plan",
    body: "Du bekommst nicht eine Liste von Orten, sondern einen vollständigen Ablauf: Timing, Wege, Reihenfolge — alles abgestimmt auf deinen Anlass.",
    accent: "bg-[linear-gradient(180deg,rgba(255,253,248,0.94),rgba(244,236,227,0.92))]",
  },
  {
    title: "Echte Events als Fixpunkt, nicht als Zufallsfund",
    body: "Ein Konzert, Markt oder besonderer Abend wird zum Hauptmoment des Tages geplant — der Rest passt sich sinnvoll darum an.",
    accent: "bg-[linear-gradient(180deg,rgba(251,246,239,0.96),rgba(235,244,248,0.92))]",
  },
  {
    title: "Teilen und gemeinsam loslegen",
    body: "Schick den Plan per Link. Alle sehen denselben Stand, können zustimmen oder anpassen — kein langer Chat, keine doppelte Planung.",
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
    note: "nah an der Venue, kein Takt mehr",
    tag: "Ausklang",
  },
];

const heroSignals = [
  "24 Min Gesamtweg",
  "Eventfenster sauber eingebaut",
  "Bereit zum Teilen",
];

const howItWorksSteps = [
  {
    number: "01",
    title: "Einfach beschreiben",
    body: "Schreib kurz, was du planst — »Date-Abend in München« oder »Familientag Hamburg Samstag«. PerfectDay24 versteht dich.",
  },
  {
    number: "02",
    title: "Plan ansehen & anpassen",
    body: "Du bekommst einen vollständigen Tagesplan mit echten Events, realistischen Wegen und passendem Timing.",
  },
  {
    number: "03",
    title: "Teilen und losgehen",
    body: "Schick den Plan per Link. Alle sehen denselben Stand — und wenn etwas nicht passt, ist er schnell angepasst.",
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
      <div className="pd24-page-standard pb-20 pt-6">

        <main className="mt-6 space-y-16 sm:space-y-24">

          {/* ── Hero ── */}
          <section className="relative overflow-hidden rounded-[32px] border border-[rgba(23,23,23,0.08)] bg-[linear-gradient(135deg,rgba(255,253,248,0.98),rgba(244,236,227,0.95))] px-5 py-6 shadow-[0_28px_80px_rgba(49,39,27,0.1)] sm:px-8 sm:py-10">
            <div className="pointer-events-none absolute left-[-4rem] top-[-4rem] h-40 w-40 rounded-full bg-[rgba(183,106,67,0.12)] blur-3xl" />
            <div className="pointer-events-none absolute bottom-[-4rem] right-[-2rem] h-44 w-44 rounded-full bg-[rgba(122,141,114,0.14)] blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] lg:items-center">
              <div className="max-w-2xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#b76a43]">
                  Einfach schreiben — fertig geplant.
                </div>
                <h1 className="mt-4 font-[family:var(--font-pd24-display)] text-[2.75rem] leading-[0.96] tracking-tight text-[#171717] sm:text-6xl lg:text-7xl">
                  Dein perfekter Tag — konkret geplant, nicht nur gesucht.
                </h1>
                <p className="mt-5 max-w-xl text-lg leading-8 text-[#665d55]">
                  Schreib kurz, was du planst — PerfectDay24 baut daraus einen vollständigen Tag mit echten Events und klarem Timing.
                </p>

                <HeroIntentBar />

                <div className="mt-7 flex flex-wrap gap-3">
                  {trustSignals.map((signal) => (
                    <MetricPill key={signal}>{signal}</MetricPill>
                  ))}
                </div>
              </div>

              {/* Beispiel-Plan Mockup */}
              <div className="rounded-[28px] border border-[rgba(23,23,23,0.08)] bg-[rgba(255,253,248,0.94)] p-5 shadow-[0_24px_64px_rgba(49,39,27,0.12)] sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(23,23,23,0.08)] pb-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b7767]">
                      Beispiel · Date-Abend Berlin
                    </div>
                    <div className="mt-2 text-2xl font-semibold tracking-tight text-[#171717]">
                      Berlin · Event-Plan · Heute Abend
                    </div>
                    <div className="mt-2 text-sm leading-6 text-[#665d55]">
                      Fester Hauptmoment, kurze Wege, genug Luft zwischen den Stops.
                    </div>
                  </div>
                  <PD24StatusBadge tone="warning">Live-Event</PD24StatusBadge>
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
                    Genau das bekommst du: nicht nur Orte, sondern eine plausible Dramaturgie
                    für den ganzen Abend.
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Zwei Produkte ── */}
          <section>
            <div className="text-center">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#b76a43]">
                Wähle deinen Einstieg
              </div>
              <h2 className="mt-3 font-[family:var(--font-pd24-display)] text-4xl tracking-tight text-[#171717] sm:text-5xl">
                Was möchtest du planen?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[#665d55]">
                Ein Tag in der Stadt oder ein ganzes Event — wähle deinen Einstieg.
              </p>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {/* Tagesplaner */}
              <div className="flex flex-col rounded-[28px] border border-[rgba(23,23,23,0.08)] bg-[linear-gradient(160deg,rgba(255,253,248,0.98),rgba(244,236,227,0.94))] p-7 shadow-[0_16px_48px_rgba(49,39,27,0.09)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#171717] text-xl">
                  🗓
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight text-[#171717]">
                  Einen Tag genießen
                </h3>
                <p className="mt-3 flex-1 text-base leading-7 text-[#665d55]">
                  Stadt, Anlass, Datum — fertig. PerfectDay24 baut daraus einen vollständigen Tagesplan mit echten Events, sinnvollen Wegen und klarem Timing.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {["Date Night", "Familientag", "Mit Freunden"].map((tag) => (
                    <span key={tag} className="rounded-full border border-[rgba(23,23,23,0.1)] bg-white/80 px-3 py-1.5 text-sm text-[#8b7767]">
                      {tag}
                    </span>
                  ))}
                </div>
                <PD24Button href="/planner" className="mt-6 self-start">
                  Tag planen →
                </PD24Button>
              </div>

              {/* Eventplaner */}
              <div className="flex flex-col rounded-[28px] border border-[rgba(23,23,23,0.08)] bg-[linear-gradient(160deg,rgba(240,247,243,0.98),rgba(228,240,234,0.94))] p-7 shadow-[0_16px_48px_rgba(49,39,27,0.09)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#2d5a3d] text-xl">
                  🎉
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight text-[#171717]">
                  Ein Event veranstalten
                </h3>
                <p className="mt-3 flex-1 text-base leading-7 text-[#665d55]">
                  Geburtstag, JGA, Teamday oder Dinner-Party. Stelle Anbieter zusammen, frage Preise an und verschicke digitale Einladungen — alles an einem Ort.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {["Geburtstag", "JGA", "Teamday", "Dinner"].map((tag) => (
                    <span key={tag} className="rounded-full border border-[rgba(45,90,61,0.15)] bg-white/80 px-3 py-1.5 text-sm text-[#2d5a3d]">
                      {tag}
                    </span>
                  ))}
                </div>
                <PD24Button href="/events" variant="secondary" className="mt-6 self-start">
                  Event planen →
                </PD24Button>
              </div>
            </div>
          </section>

          {/* ── Wie es funktioniert ── */}
          <section>
            <div className="text-center">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#b76a43]">
                So funktioniert es
              </div>
              <h2 className="mt-3 font-[family:var(--font-pd24-display)] text-4xl tracking-tight text-[#171717] sm:text-5xl">
                Drei Schritte zum fertigen Plan
              </h2>
            </div>
            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              {howItWorksSteps.map((step) => (
                <div
                  key={step.number}
                  className="rounded-[24px] border border-[rgba(23,23,23,0.08)] bg-[rgba(255,253,248,0.9)] p-6"
                >
                  <div className="font-[family:var(--font-pd24-display)] text-4xl leading-none text-[#b76a43]">
                    {step.number}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-[#171717]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#665d55]">{step.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Weitere Einstiege ── */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[#8b7767]">
            <span className="font-medium text-[#665d55]">Mehr entdecken:</span>
            <Link
              href="/explore"
              className="underline-offset-2 transition hover:text-[#171717] hover:underline"
            >
              Routen entdecken
            </Link>
            <Link
              href="/saved"
              className="underline-offset-2 transition hover:text-[#171717] hover:underline"
            >
              Meine Pläne
            </Link>
          </div>

          {/* ── Final CTA ── */}
          <section className="rounded-[32px] bg-[#171717] px-6 py-10 text-[#fffdf8] shadow-[0_28px_80px_rgba(49,39,27,0.18)] sm:px-8">
            <div className="max-w-3xl">
              <h2 className="font-[family:var(--font-pd24-display)] text-[2.75rem] leading-[0.98] tracking-tight sm:text-6xl">
                Einfach beschreiben. Der Plan folgt sofort.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[rgba(255,253,248,0.78)]">
                »Date-Abend in Berlin morgen Abend« — mehr brauchst du nicht. PerfectDay24 versteht
                dich und macht daraus einen Tag, der wirklich passt.
              </p>
              <div className="mt-8 flex flex-col items-start gap-4">
                <PD24Button href="/planner">Tag planen</PD24Button>
                <Link
                  href="/explore"
                  className="text-sm text-[rgba(255,253,248,0.65)] underline-offset-2 transition hover:text-[rgba(255,253,248,0.95)] hover:underline"
                >
                  Erst Routen ansehen →
                </Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="mt-12 rounded-[28px] border border-[rgba(23,23,23,0.08)] bg-[rgba(255,253,248,0.78)] px-6 py-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-lg font-semibold tracking-tight text-[#171717]">PerfectDay24</div>
              <div className="mt-2 text-sm text-[#665d55]">
                Einen guten Tag planen — für dich, zu zweit oder mit der Gruppe.
              </div>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#665d55]">
              <Link href="/planner">Planen</Link>
              <Link href="/explore">Entdecken</Link>
              <Link href="/events">Events</Link>
              <Link href="/saved">Meine Pläne</Link>
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
