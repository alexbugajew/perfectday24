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
    <span className="rounded-full border border-[rgba(196,137,79,0.2)] bg-[var(--brand-warm-cloud)] px-4 py-2 text-sm text-[var(--text-muted-warm)]">
      {children}
    </span>
  );
}

export default function HomepageScaffoldMinimal() {
  return (
    <div className={`${display.variable} min-h-screen bg-[var(--bg-canvas-warm)] text-[var(--text-strong)]`}>
      <div className="pd24-page-standard pb-20 pt-6">

        <main className="mt-6 space-y-16 sm:space-y-24">

          {/* ── Hero ── */}
          <section className="relative overflow-hidden rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[linear-gradient(135deg,var(--bg-canvas-warm),var(--brand-warm-cloud))] px-5 py-6 shadow-[var(--shadow-large)] sm:px-8 sm:py-10">
            <div className="pointer-events-none absolute left-[-4rem] top-[-4rem] h-40 w-40 rounded-full bg-[rgba(196,137,79,0.12)] blur-3xl" />
            <div className="pointer-events-none absolute bottom-[-4rem] right-[-2rem] h-44 w-44 rounded-full bg-[rgba(90,118,136,0.12)] blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] lg:items-center">
              <div className="max-w-2xl">
                <div className="pd24-kicker-warm">
                  Einfach schreiben — fertig geplant.
                </div>
                <h1 className="mt-4 pd24-display text-[2.75rem] leading-[0.96] tracking-tight text-[var(--text-strong)] sm:text-6xl lg:text-7xl">
                  Dein perfekter Tag — konkret geplant, nicht nur gesucht.
                </h1>
                <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--text-muted-warm)]">
                  Schreib kurz, was du planst — PerfectDay24 baut daraus einen vollständigen Tag mit echten Events und klarem Timing.
                </p>

                <HeroIntentBar />

                <div className="mt-7 flex flex-wrap gap-3">
                  {trustSignals.map((signal) => (
                    <MetricPill key={signal}>{signal}</MetricPill>
                  ))}
                </div>
              </div>

              {/* Beispiel-Plan Mockup — auf Mobile ausgeblendet */}
              <div className="hidden pd24-card-featured p-5 sm:p-7 lg:block" style={{ background: 'rgba(255,253,248,0.94)' }}>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line-subtle)] pb-4">
                  <div>
                    <div className="pd24-meta text-[var(--text-soft-warm)]">
                      Beispiel · Date-Abend Berlin
                    </div>
                    <div className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-strong)]">
                      Berlin · Event-Plan · Heute Abend
                    </div>
                    <div className="mt-2 text-sm leading-6 text-[var(--text-muted-warm)]">
                      Fester Hauptmoment, kurze Wege, genug Luft zwischen den Stops.
                    </div>
                  </div>
                  <PD24StatusBadge tone="warning">Live-Event</PD24StatusBadge>
                </div>

                <div className="mt-5 space-y-3">
                  {heroStops.map((stop, index) => (
                    <div
                      key={stop.time}
                      className="grid grid-cols-[52px_1fr_auto] items-start gap-3 rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-white/86 px-4 py-4"
                    >
                      <div className="text-sm font-semibold text-[var(--brand-warm)]">{stop.time}</div>
                      <div>
                        <div className="text-base font-medium text-[var(--text-strong)]">{stop.title}</div>
                        <div className="mt-1 text-sm leading-6 text-[var(--text-muted-warm)]">{stop.note}</div>
                      </div>
                      <div className="flex min-h-8 min-w-8 items-center justify-center rounded-[var(--radius-control)] bg-[var(--text-strong)] px-2 text-xs font-semibold text-white">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[linear-gradient(180deg,var(--brand-warm-cloud),var(--bg-canvas-warm))] p-5">
                  <div className="flex flex-wrap gap-2">
                    {heroSignals.map((signal) => (
                      <MetricPill key={signal}>{signal}</MetricPill>
                    ))}
                  </div>
                  <div className="mt-4 text-sm leading-7 text-[var(--text-muted-warm)]">
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
              <div className="pd24-kicker-warm">
                Wähle deinen Einstieg
              </div>
              <h2 className="mt-3 pd24-display text-4xl tracking-tight text-[var(--text-strong)] sm:text-5xl">
                Was möchtest du planen?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[var(--text-muted-warm)]">
                Ein Tag in der Stadt oder ein ganzes Event — wähle deinen Einstieg.
              </p>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {/* Tagesplaner */}
              <div className="flex flex-col rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[linear-gradient(160deg,var(--bg-canvas-warm),var(--brand-warm-cloud))] p-7 shadow-[var(--shadow-soft)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[var(--text-strong)] text-xl">
                  🗓
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--text-strong)]">
                  Einen Tag genießen
                </h3>
                <p className="mt-3 flex-1 text-base leading-7 text-[var(--text-muted-warm)]">
                  Stadt, Anlass, Datum — fertig. PerfectDay24 baut daraus einen vollständigen Tagesplan mit echten Events, sinnvollen Wegen und klarem Timing.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {["Date Night", "Familientag", "Mit Freunden"].map((tag) => (
                    <span key={tag} className="rounded-full border border-[var(--line-subtle)] bg-white/80 px-3 py-1.5 text-sm text-[var(--text-soft-warm)]">
                      {tag}
                    </span>
                  ))}
                </div>
                <PD24Button href="/planner" className="mt-6 self-start">
                  Tag planen →
                </PD24Button>
              </div>

              {/* Eventplaner */}
              <div className="flex flex-col rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[linear-gradient(160deg,rgba(240,247,243,0.98),rgba(228,240,234,0.94))] p-7 shadow-[var(--shadow-soft)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#2d5a3d] text-xl">
                  🎉
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--text-strong)]">
                  Ein Event veranstalten
                </h3>
                <p className="mt-3 flex-1 text-base leading-7 text-[var(--text-muted-warm)]">
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
              <div className="pd24-kicker-warm">
                So funktioniert es
              </div>
              <h2 className="mt-3 pd24-display text-4xl tracking-tight text-[var(--text-strong)] sm:text-5xl">
                Drei Schritte zum fertigen Plan
              </h2>
            </div>
            <div className="relative mt-8 grid gap-5 sm:grid-cols-3">
              <div
                className="pointer-events-none absolute hidden h-px bg-[var(--line-subtle)] sm:block"
                style={{ top: '3.25rem', left: 'calc(33.33% + 10px)', right: 'calc(33.33% + 10px)' }}
              />
              {howItWorksSteps.map((step) => (
                <div
                  key={step.number}
                  className="relative rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] p-6"
                >
                  <div className="pd24-display text-4xl leading-none text-[var(--brand-warm)]">
                    {step.number}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-[var(--text-strong)]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted-warm)]">{step.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Weitere Einstiege ── */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[var(--text-soft-warm)]">
            <span className="font-medium text-[var(--text-muted-warm)]">Mehr entdecken:</span>
            <Link
              href="/explore"
              className="underline-offset-2 transition hover:text-[var(--text-strong)] hover:underline"
            >
              Routen entdecken
            </Link>
            <Link
              href="/saved"
              className="underline-offset-2 transition hover:text-[var(--text-strong)] hover:underline"
            >
              Meine Pläne
            </Link>
          </div>

          {/* ── Final CTA ── */}
          <section className="rounded-[var(--radius-shell)] bg-[var(--text-strong)] px-6 py-10 text-[#fffdf8] shadow-[var(--shadow-large)] sm:px-8">
            <div className="max-w-3xl">
              <h2 className="pd24-display text-[2.75rem] leading-[0.98] tracking-tight sm:text-6xl">
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

        <footer className="mt-12 rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[rgba(255,253,248,0.78)] px-6 py-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-lg font-semibold tracking-tight text-[var(--text-strong)]">PerfectDay24</div>
              <div className="mt-2 text-sm text-[var(--text-muted-warm)]">
                Einen guten Tag planen — für dich, zu zweit oder mit der Gruppe.
              </div>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--text-muted-warm)]">
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
