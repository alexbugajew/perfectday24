import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";
import type { ReactNode } from "react";
import { PD24Button, PD24StatusBadge } from "@/components/ui/pd24";
import HeroIntentBar from "@/components/home/HeroIntentBar";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-pd24-display",
});

const trustSignals = [
  "Echte Events statt Trefferlisten",
  "Sinnvolle Wege und Timing",
  "Per Link direkt teilbar",
];

const heroStops = [
  {
    time: "17:45",
    title: "Aperitif in Charlottenburg",
    note: "ruhiger Start mit kurzer Anfahrt",
  },
  {
    time: "19:10",
    title: "Dinner vor dem Hauptmoment",
    note: "genug Luft vor der festen Uhrzeit",
  },
  {
    time: "20:30",
    title: "Live-Event als Peak",
    note: "echter Anlass statt zufälliger Zusatz",
  },
  {
    time: "22:35",
    title: "Bar für den Ausklang",
    note: "nah an der Venue, kein Takt mehr",
  },
];

const heroSignals = [
  "24 Min Gesamtweg",
  "Eventfenster sauber eingebaut",
  "Bereit zum Teilen",
];

const proofCards = [
  {
    title: "Echter Anlass",
    body: "Nicht nur Orte nebeneinander, sondern ein Hauptmoment mit klarer Dramaturgie.",
  },
  {
    title: "Realistische Wege",
    body: "Wegzeiten und Reihenfolge passen zum Tag, nicht nur zur Wunschliste.",
  },
  {
    title: "Gemeinsam nutzbar",
    body: "Ein Plan, den du sofort teilen, abstimmen und unterwegs nutzen kannst.",
  },
];

const trustTiles = [
  "Echte Events statt generischer Vorschläge",
  "Ein Ablauf statt 7 offener Tabs",
  "Sinnvolle Wege statt Zufallsreihenfolge",
  "Direkt mit anderen teilbar",
];

const compareWithout = [
  "Viele Tabs und Trefferlisten",
  "Keine klare Reihenfolge",
  "Eventzeiten passen nicht zusammen",
  "Niemand hat denselben Stand",
];

const compareWith = [
  "Ein fertiger Ablauf",
  "Ein klarer Hauptmoment",
  "Wege und Timing passen zusammen",
  "Per Link direkt teilbar",
];

const howItWorksSteps = [
  {
    number: "01",
    title: "Beschreiben",
    body: "Schreib in einem Satz, was du vorhast und in welcher Stadt du planst.",
  },
  {
    number: "02",
    title: "Plan bekommen",
    body: "PerfectDay24 baut daraus einen Ablauf mit Events, Wegen und plausiblen Zeitfenstern.",
  },
  {
    number: "03",
    title: "Teilen und losgehen",
    body: "Schick den Plan per Link, passe ihn gemeinsam an und starte direkt los.",
  },
];

const useCases = [
  {
    title: "Date-Abend mit Live-Event",
    body: "Ein Abend mit Hauptmoment, Dinner und Ausklang statt lose gesammelter Ideen.",
    cta: "Date planen",
    href: "/planner?occasion=date",
  },
  {
    title: "Familientag ohne Leerlauf",
    body: "Weniger Sucherei, mehr passende Stops für alle Altersgruppen und echte Pausen dazwischen.",
    cta: "Familientag planen",
    href: "/planner?occasion=family",
  },
  {
    title: "Freunde-Wochenende mit klarer Route",
    body: "Ein gemeinsamer Ablauf statt endloser Abstimmung in mehreren Chats.",
    cta: "Mit Freunden planen",
    href: "/planner?occasion=friends",
  },
  {
    title: "Geburtstag mit Anbieteranfragen",
    body: "Anbieter anfragen, Preise vergleichen und Einladungen von einem Ort aus steuern.",
    cta: "Event planen",
    href: "/events",
  },
];

const partnerHighlights = [
  "Standort, Angebot oder Event-Baustein anlegen",
  "Anfragen, Sichtbarkeit und Affiliate-Links an einem Ort steuern",
  "In Explore, Planner und Event-Flows praesent werden",
];

function MetricPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-[rgba(196,137,79,0.22)] bg-[rgba(255,253,248,0.86)] px-4 py-2 text-sm text-[var(--text-muted-warm)]">
      {children}
    </span>
  );
}

function SectionIntro({
  eyebrow,
  title,
  body,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  body?: string;
  align?: "left" | "center";
}) {
  const alignment = align === "left" ? "text-left" : "mx-auto max-w-3xl text-center";
  return (
    <div className={alignment}>
      <div className="pd24-kicker-warm">{eyebrow}</div>
      <h2 className="mt-3 pd24-display text-[2.35rem] leading-[0.98] tracking-tight text-[var(--text-strong)] sm:text-5xl">
        {title}
      </h2>
      {body ? (
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--text-muted-warm)] sm:text-lg">
          {body}
        </p>
      ) : null}
    </div>
  );
}

function ListBlock({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "soft" | "strong";
}) {
  const wrapperClass =
    tone === "strong"
      ? "border-[rgba(23,23,23,0.06)] bg-[var(--text-strong)] text-white"
      : "border-[var(--line-subtle)] bg-[rgba(255,253,248,0.84)]";
  const itemClass =
    tone === "strong"
      ? "border-white/10 text-white/80"
      : "border-[rgba(23,23,23,0.06)] text-[var(--text-muted-warm)]";

  return (
    <div className={`rounded-[var(--radius-shell)] border p-6 shadow-[var(--shadow-soft)] ${wrapperClass}`}>
      <h3 className={`text-2xl font-semibold tracking-tight ${tone === "strong" ? "text-white" : "text-[var(--text-strong)]"}`}>
        {title}
      </h3>
      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div key={item} className={`rounded-[var(--radius-card-sm)] border px-4 py-3 text-sm leading-6 ${itemClass}`}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomepageScaffoldMinimal() {
  return (
    <div className={`${display.variable} min-h-screen bg-[var(--bg-canvas-warm)] text-[var(--text-strong)]`}>
      <div className="pd24-page-standard pb-20 pt-6">
        <header className="rounded-[28px] border border-[var(--line-subtle)] bg-[rgba(255,253,248,0.78)] px-4 py-3 shadow-[var(--shadow-soft)] sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight text-[var(--text-strong)]">PerfectDay24</div>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted-warm)]">
                Refined City Planning
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/planner"
                className="inline-flex items-center justify-center rounded-full border border-[var(--line-subtle)] bg-white/82 px-4 py-2 text-sm font-medium text-[var(--text-muted-warm)] transition hover:border-[var(--text-strong)] hover:text-[var(--text-strong)]"
              >
                Planen
              </Link>
              <Link
                href="/events"
                className="inline-flex items-center justify-center rounded-full border border-[var(--line-subtle)] bg-white/82 px-4 py-2 text-sm font-medium text-[var(--text-muted-warm)] transition hover:border-[var(--text-strong)] hover:text-[var(--text-strong)]"
              >
                Events
              </Link>
              <Link
                href="/partner"
                className="inline-flex items-center justify-center rounded-full border border-[rgba(196,137,79,0.28)] bg-[rgba(255,249,241,0.92)] px-4 py-2 text-sm font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)] hover:bg-white"
              >
                Fuer Anbieter
              </Link>
            </div>
          </div>
        </header>

        <main className="mt-6 space-y-16 sm:space-y-24">
          <section className="relative overflow-hidden rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[linear-gradient(135deg,var(--bg-canvas-warm),var(--brand-warm-cloud))] px-5 py-6 shadow-[var(--shadow-large)] sm:px-8 sm:py-10">
            <div className="pointer-events-none absolute left-[-4rem] top-[-4rem] h-40 w-40 rounded-full bg-[rgba(196,137,79,0.12)] blur-3xl" />
            <div className="pointer-events-none absolute bottom-[-4rem] right-[-2rem] h-44 w-44 rounded-full bg-[rgba(90,118,136,0.12)] blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(340px,0.98fr)] lg:items-center">
              <div className="min-w-0">
                <div className="max-w-2xl">
                  <div className="pd24-kicker-warm">Einfach schreiben. Direkt geplant.</div>
                  <h1 className="mt-4 pd24-display text-[2.7rem] leading-[0.94] tracking-tight text-[var(--text-strong)] sm:text-6xl lg:text-7xl">
                    Nicht nur Ideen. Sondern ein fertiger Tag, der wirklich funktioniert.
                  </h1>
                  <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--text-muted-warm)]">
                    Du beschreibst kurz, was du vorhast. PerfectDay24 baut daraus einen realistischen Tagesplan mit echten Events, passenden Wegen und klarem Timing.
                  </p>
                </div>

                <HeroIntentBar />

                <div className="mt-6 flex flex-wrap gap-3">
                  <PD24Button href="/planner" className="min-w-[12rem]">
                    Tag jetzt planen
                  </PD24Button>
                  <PD24Button href="#hero-proof" variant="secondary" className="min-w-[11rem]">
                    Beispiel ansehen
                  </PD24Button>
                </div>

                <div className="mt-7 flex flex-wrap gap-3">
                  {trustSignals.map((signal) => (
                    <MetricPill key={signal}>{signal}</MetricPill>
                  ))}
                </div>
              </div>

              <div id="hero-proof" className="pd24-card-featured p-5 sm:p-7" style={{ background: "rgba(255,253,248,0.94)" }}>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line-subtle)] pb-4">
                  <div>
                    <div className="pd24-meta text-[var(--text-soft-warm)]">Beispiel · Date-Abend Berlin</div>
                    <div className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-strong)]">
                      Berlin · Event-Plan · Heute Abend
                    </div>
                    <div className="mt-2 text-sm leading-6 text-[var(--text-muted-warm)]">
                      Fester Hauptmoment, kurze Wege und genug Luft zwischen den Stops.
                    </div>
                  </div>
                  <PD24StatusBadge tone="warning">Live-Event</PD24StatusBadge>
                </div>

                <div className="mt-5 space-y-3">
                  {heroStops.map((stop, index) => (
                    <div
                      key={stop.time}
                      className="grid grid-cols-[54px_1fr_auto] items-start gap-3 rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-white/88 px-4 py-4"
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
                    Nicht nur Orte nebeneinander, sondern ein Ablauf mit Hauptmoment, Timing und einer Plausibilität, die sich direkt gut anfühlt.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-8">
            <SectionIntro
              eyebrow="So sieht ein guter Plan aus"
              title="Nicht nur Treffer. Sondern ein nutzbarer Ablauf."
              body="PerfectDay24 baut aus einer Idee einen Tag mit echtem Anlass, realistischen Wegen und einer Dramaturgie, die man direkt teilen und benutzen kann."
            />

            <div className="grid gap-5 sm:grid-cols-3">
              {proofCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[rgba(255,253,248,0.82)] p-6 shadow-[var(--shadow-soft)]"
                >
                  <div className="pd24-kicker-warm">Proof</div>
                  <h3 className="mt-3 text-xl font-semibold tracking-tight text-[var(--text-strong)]">{card.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-muted-warm)]">{card.body}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-center">
              <PD24Button href="/planner">Diesen Stil planen</PD24Button>
            </div>
          </section>

          <section className="space-y-8">
            <SectionIntro
              eyebrow="Warum das besser ist"
              title="Warum Nutzer nicht mehr manuell zusammensetzen wollen"
              body="Listen zeigen Möglichkeiten. PerfectDay24 baut daraus einen Plan, der in sich stimmig ist und direkt funktioniert."
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {trustTiles.map((tile) => (
                <div
                  key={tile}
                  className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[rgba(255,253,248,0.82)] px-5 py-5 text-sm leading-7 text-[var(--text-muted-warm)] shadow-[var(--shadow-soft)]"
                >
                  {tile}
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionIntro
              eyebrow="Wähle deinen Einstieg"
              title="Was möchtest du planen?"
              body="Wähle den Modus, der zu deinem Anlass passt: ein Tag in der Stadt oder ein Event mit mehreren Beteiligten."
            />

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[linear-gradient(160deg,var(--bg-canvas-warm),var(--brand-warm-cloud))] p-7 shadow-[var(--shadow-soft)]">
                <div className="pd24-kicker-warm">City Planning</div>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--text-strong)]">
                  Einen Tag genießen
                </h3>
                <p className="mt-3 flex-1 text-base leading-7 text-[var(--text-muted-warm)]">
                  Für Date Night, Familienzeit, Freunde oder Städtereise. Du bekommst einen vollständigen Tagesplan mit echten Events, sinnvollen Wegen und klarem Timing.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {["Date Night", "Familientag", "Mit Freunden", "Als Tourist"].map((tag) => (
                    <span key={tag} className="rounded-full border border-[var(--line-subtle)] bg-white/80 px-3 py-1.5 text-sm text-[var(--text-soft-warm)]">
                      {tag}
                    </span>
                  ))}
                </div>
                <PD24Button href="/planner" className="mt-6 self-start">
                  Tag planen
                </PD24Button>
              </div>

              <div className="flex flex-col rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[linear-gradient(160deg,rgba(240,247,243,0.98),rgba(228,240,234,0.94))] p-7 shadow-[var(--shadow-soft)]">
                <div className="pd24-kicker-warm text-[#2d5a3d]">Event Flow</div>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--text-strong)]">
                  Ein Event veranstalten
                </h3>
                <p className="mt-3 flex-1 text-base leading-7 text-[var(--text-muted-warm)]">
                  Für Geburtstag, JGA, Teamday oder Dinner. Stelle Anbieter zusammen, frage Preise an und verschicke digitale Einladungen - alles an einem Ort.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {["Geburtstag", "JGA", "Teamday", "Dinner"].map((tag) => (
                    <span key={tag} className="rounded-full border border-[rgba(45,90,61,0.15)] bg-white/80 px-3 py-1.5 text-sm text-[#2d5a3d]">
                      {tag}
                    </span>
                  ))}
                </div>
                <PD24Button href="/events" variant="secondary" className="mt-6 self-start">
                  Event planen
                </PD24Button>
              </div>
            </div>
          </section>

          <section className="rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[linear-gradient(160deg,rgba(248,250,252,0.96),rgba(238,244,248,0.92))] p-6 shadow-[var(--shadow-soft)] sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="max-w-3xl">
                <div className="pd24-kicker-warm text-[var(--text-soft-warm)]">Fuer Anbieter</div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-4xl">
                  Eigene Location, Route oder Event-Bausteine direkt in PerfectDay24 vermarkten
                </h2>
                <p className="mt-4 text-base leading-7 text-[var(--text-muted-warm)]">
                  Lege dein Profil an, pflege Standorte und Angebote und werde dort sichtbar, wo Nutzer bereits planen, vergleichen und buchen wollen.
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {partnerHighlights.map((item) => (
                    <div
                      key={item}
                      className="rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-white/84 px-4 py-4 text-sm leading-6 text-[var(--text-muted-warm)]"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col items-start gap-3 lg:items-end">
                <PD24Button href="/partner" variant="secondary" className="min-w-[12rem]">
                  Partner werden
                </PD24Button>
                <Link
                  href="/partner/dashboard"
                  className="text-sm font-medium text-[var(--text-strong)] underline-offset-2 transition hover:underline"
                >
                  Partner-Portal ansehen -&gt;
                </Link>
              </div>
            </div>
          </section>

          <section className="space-y-8">
            <SectionIntro
              eyebrow="Differenzierung"
              title="Warum PerfectDay24 besser ist als nur suchen"
              body="Listen zeigen Möglichkeiten. PerfectDay24 baut daraus einen Ablauf, den du direkt nutzen, teilen und weiterentwickeln kannst."
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <ListBlock title="Ohne PerfectDay24" items={compareWithout} tone="soft" />
              <ListBlock title="Mit PerfectDay24" items={compareWith} tone="strong" />
            </div>

            <div className="flex justify-center">
              <PD24Button href="/planner">Plan statt Trefferliste ausprobieren</PD24Button>
            </div>
          </section>

          <section>
            <SectionIntro
              eyebrow="So funktioniert es"
              title="In drei Schritten zum fertigen Plan"
              body="Der Flow bleibt bewusst einfach: kurz beschreiben, den Plan ansehen und dann direkt gemeinsam nutzen."
            />

            <div className="relative mt-8 grid gap-5 sm:grid-cols-3">
              <div
                className="pointer-events-none absolute hidden h-px bg-[var(--line-subtle)] sm:block"
                style={{ top: "3.25rem", left: "calc(33.33% + 10px)", right: "calc(33.33% + 10px)" }}
              />
              {howItWorksSteps.map((step) => (
                <div
                  key={step.number}
                  className="relative rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[rgba(255,253,248,0.82)] p-6 shadow-[var(--shadow-soft)]"
                >
                  <div className="pd24-display text-4xl leading-none text-[var(--brand-warm)]">{step.number}</div>
                  <h3 className="mt-4 text-lg font-semibold text-[var(--text-strong)]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted-warm)]">{step.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-8">
            <SectionIntro
              eyebrow="Konkrete Outcomes"
              title="Was du konkret damit planen kannst"
              body="Nicht nur Features, sondern echte Anlässe mit einem klaren Ergebnis für den Nutzer."
            />

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {useCases.map((card) => (
                <div
                  key={card.title}
                  className="flex flex-col rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[rgba(255,253,248,0.82)] p-6 shadow-[var(--shadow-soft)]"
                >
                  <h3 className="text-xl font-semibold tracking-tight text-[var(--text-strong)]">{card.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-7 text-[var(--text-muted-warm)]">{card.body}</p>
                  <Link
                    href={card.href}
                    className="mt-5 text-sm font-medium text-[var(--text-strong)] underline-offset-2 transition hover:underline"
                  >
                    {card.cta} →
                  </Link>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[var(--radius-shell)] bg-[var(--text-strong)] px-6 py-10 text-[#fffdf8] shadow-[var(--shadow-large)] sm:px-8">
            <div className="max-w-3xl">
              <div className="pd24-kicker-warm text-[rgba(255,253,248,0.64)]">Abschluss</div>
              <h2 className="mt-3 pd24-display text-[2.75rem] leading-[0.98] tracking-tight sm:text-6xl">
                Schreib deinen Plan in einem Satz. Den Rest baut PerfectDay24.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[rgba(255,253,248,0.78)]">
                Für Date Night, Tagesausflug, Freunde oder Events mit mehreren Beteiligten. Du bekommst einen Ablauf, den du direkt nutzen, teilen und weiterentwickeln kannst.
              </p>
              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row">
                <PD24Button href="/planner">Jetzt starten</PD24Button>
                <PD24Button href="#hero-proof" variant="secondary" className="border-white/18 bg-white/8 text-white hover:bg-white/12">
                  Erst Beispiele ansehen
                </PD24Button>
              </div>
            </div>
          </section>
        </main>

        <footer className="mt-12 rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[rgba(255,253,248,0.78)] px-6 py-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-lg font-semibold tracking-tight text-[var(--text-strong)]">PerfectDay24</div>
              <div className="mt-2 text-sm text-[var(--text-muted-warm)]">
                Einen guten Tag planen - für dich, zu zweit oder mit der Gruppe.
              </div>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--text-muted-warm)]">
              <Link href="/planner">Planen</Link>
              <Link href="/explore">Entdecken</Link>
              <Link href="/events">Events</Link>
              <Link href="/saved">Meine Pläne</Link>
              <Link href="/impressum">Impressum</Link>
              <Link href="/datenschutz">Datenschutz</Link>
              <Link href="/partner">Fuer Anbieter</Link>
              <Link href="/agb">AGB</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
