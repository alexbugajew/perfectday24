import Image from "next/image";
import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";
import type { ReactNode } from "react";
import { PD24Button } from "@/components/ui/pd24";
import ConsentSettingsLink from "@/components/consent/ConsentSettingsLink";
import HeroIntentBar from "@/components/home/HeroIntentBar";
import HeroLiveDemo from "@/components/home/HeroLiveDemo";
import EditorialRoutesShowcase from "@/components/home/EditorialRoutesShowcase";
import FeatureShowcase from "@/components/home/FeatureShowcase";
import AiExploreTeaser from "@/components/home/AiExploreTeaser";
import { formatReachCount, getReachStats } from "@/lib/reach-stats";

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
    visual: "prompt",
  },
  {
    number: "02",
    title: "Plan bekommen",
    body: "PerfectDay24 baut daraus einen Ablauf mit Events, Wegen und plausiblen Zeitfenstern.",
    visual: "plan",
  },
  {
    number: "03",
    title: "Teilen und losgehen",
    body: "Schick den Plan per Link, passe ihn gemeinsam an und starte direkt los.",
    visual: "share",
  },
] as const;

// Produktnahe Mini-Mockups statt generischer Stock-Fotos: zeigen den echten
// Flow (Prompt → Ablauf → Teilen) in der Bildsprache der Hero-Live-Demo und
// laden ohne externe Requests.
function HowItWorksVisual({ visual }: { visual: "prompt" | "plan" | "share" }) {
  if (visual === "prompt") {
    return (
      <div className="flex h-full flex-col justify-center gap-2 px-5" aria-hidden>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft-warm)]">
          Was möchtest du planen?
        </div>
        <div className="flex items-center gap-2">
          <div className="flex min-h-9 flex-1 items-center truncate rounded-xl border border-[var(--line-strong)] bg-white px-3 text-[13px] text-[var(--text-strong)] shadow-inner">
            Date-Abend in München mit Live-Konzert
          </div>
          <span className="inline-flex h-9 shrink-0 items-center rounded-xl bg-[var(--text-strong)] px-3 text-[11px] font-semibold text-white">
            ✨ Autopilot
          </span>
        </div>
      </div>
    );
  }
  if (visual === "plan") {
    return (
      <div className="flex h-full flex-col justify-center gap-1.5 px-5" aria-hidden>
        {[
          { time: "19:10", label: "Dinner · Katz Orange" },
          { time: "20:30", label: "Hauptmoment · Konzerthaus" },
          { time: "22:40", label: "Ausklang · Bar nahe Venue" },
        ].map((row, i) => (
          <div
            key={row.time}
            className="flex items-center gap-2.5 rounded-xl border border-[var(--line-subtle)] bg-white/85 px-3 py-1.5"
          >
            <span className="text-[11px] font-semibold text-[var(--brand-warm-ink)]">{row.time}</span>
            <span className="truncate text-[12px] font-medium text-[var(--text-strong)]">{row.label}</span>
            <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--text-strong)] text-[10px] font-semibold text-white">
              {i + 1}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 px-5" aria-hidden>
      <div className="flex min-h-9 items-center justify-between gap-2 rounded-xl border border-[var(--line-strong)] bg-white px-3">
        <span className="truncate text-[12px] font-medium text-[var(--text-muted-warm)]">
          perfectday24.de/p/date-muc
        </span>
        <span className="shrink-0 text-[11px] font-semibold text-[var(--brand-warm-ink)]">Link kopiert ✓</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {["A", "L", "+1"].map((initial) => (
            <span
              key={initial}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--bg-surface-warm)] bg-[var(--brand-warm-cloud)] text-[10px] font-semibold text-[var(--brand-warm-ink)]"
            >
              {initial}
            </span>
          ))}
        </div>
        <span className="text-[12px] text-[var(--text-muted-warm)]">planen mit — alle sehen denselben Stand</span>
      </div>
    </div>
  );
}

const useCases = [
  {
    title: "Date-Abend mit Live-Event",
    body: "Ein Abend mit Hauptmoment, Dinner und Ausklang statt lose gesammelter Ideen.",
    cta: "Date planen",
    href: "/planner?occasion=date",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=380&fit=crop&auto=format&q=80",
    imageAlt: "Gedeckter Tisch bei Kerzenschein für einen Date-Abend",
  },
  {
    title: "Familientag ohne Leerlauf",
    body: "Weniger Sucherei, mehr passende Stops für alle Altersgruppen und echte Pausen dazwischen.",
    cta: "Familientag planen",
    href: "/planner?occasion=family",
    image: "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=600&h=380&fit=crop&auto=format&q=80",
    imageAlt: "Familie im Park bei Sonnenuntergang",
  },
  {
    title: "Freunde-Wochenende mit klarer Route",
    body: "Ein gemeinsamer Ablauf statt endloser Abstimmung in mehreren Chats.",
    cta: "Mit Freunden planen",
    href: "/planner?occasion=friends",
    image: "https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=600&h=380&fit=crop&auto=format&q=80",
    imageAlt: "Freundesgruppe gemeinsam in der Stadt",
  },
  {
    title: "Geburtstag mit Anbieteranfragen",
    body: "Anbieter anfragen, Preise vergleichen und Einladungen von einem Ort aus steuern.",
    cta: "Event planen",
    href: "/events",
    image: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&h=380&fit=crop&auto=format&q=80",
    imageAlt: "Geburtstagsfeier mit Lichterkette",
  },
];

const partnerHighlights = [
  "Standort, Angebot oder Event-Baustein anlegen",
  "Anfragen, Sichtbarkeit und Affiliate-Links an einem Ort steuern",
  "In Explore, Planner und Event-Flows präsent werden",
];

// value für "Städte" kommt dynamisch aus lib/reach-stats (s. Komponente).
const partnerProofStatsStatic = [
  { value: "3", label: "Kernausspielungen", note: "Explore, Routen und Events" },
  { value: "1", label: "Self-Service-Portal", note: "Profil, Medien, Pakete und Links" },
];

const partnerPortalModules = [
  {
    title: "Profil & Standorte",
    body: "Location, Kategorien, Öffnungszeiten und passende Buchungslinks selbst pflegen.",
  },
  {
    title: "Medien & Cover",
    body: "Eigene Bilder hochladen, Covers setzen und freigegebene UGC-Fotos uebernehmen.",
  },
  {
    title: "Pakete & Preise",
    body: "Event-Pakete, Angebotsbausteine und Preislogik direkt im Portal steuern.",
  },
  {
    title: "Kampagnen & Links",
    body: "Featured-Platzierungen, Affiliate-Ziele und CTA-Links an einer Stelle verwalten.",
  },
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

export default async function HomepageScaffoldMinimal() {
  const reach = await getReachStats();
  const partnerProofStats = [
    { value: String(reach.visibleCities), label: "Städte", note: "stadtspezifische Sichtbarkeit" },
    ...partnerProofStatsStatic,
  ];
  const reachStats = [
    {
      value: String(reach.visibleCities),
      label: "Deutsche Städte",
      note: "Groß- & Mittelstädte bundesweit",
      href: "/explore",
    },
    {
      value: formatReachCount(reach.plannableLocations, 1000),
      label: "Planbare Locations",
      note: "kuratiert + gefiltert",
      href: "/explore",
    },
    {
      value: formatReachCount(reach.locationsWithOpeningHours, 500),
      label: "mit Öffnungszeiten",
      note: "Stand heute, wächst täglich",
      href: "/planner",
    },
    {
      value: formatReachCount(reach.activeEventProviders, 100),
      label: "Event-Anbieter",
      note: "von Florist bis Location",
      href: "/events",
    },
  ];

  return (
    <div className={`${display.variable} min-h-screen bg-[var(--bg-canvas-warm)] text-[var(--text-strong)]`}>
      <div className="pd24-page-standard pb-20 pt-6">
        <header className="rounded-[28px] border border-[var(--line-subtle)] bg-[rgba(255,253,248,0.78)] px-4 py-3 shadow-[var(--shadow-soft)] sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight text-[var(--text-strong)]">PerfectDay24</div>
              <div className="pd24-meta">
                Refined City Planning
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/planner"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-white/82 px-4 py-2 text-sm font-medium text-[var(--text-muted-warm)] transition hover:border-[var(--text-strong)] hover:text-[var(--text-strong)]"
              >
                Planen
              </Link>
              <Link
                href="/explore"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-white/82 px-4 py-2 text-sm font-medium text-[var(--text-muted-warm)] transition hover:border-[var(--text-strong)] hover:text-[var(--text-strong)]"
              >
                Entdecken
              </Link>
              <Link
                href="/events"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-white/82 px-4 py-2 text-sm font-medium text-[var(--text-muted-warm)] transition hover:border-[var(--text-strong)] hover:text-[var(--text-strong)]"
              >
                Events
              </Link>
              <Link
                href="/partner"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[rgba(196,137,79,0.28)] bg-[rgba(255,249,241,0.92)] px-4 py-2 text-sm font-medium text-[var(--text-strong)] transition hover:border-[var(--text-strong)] hover:bg-white"
              >
                Partner werden
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
                  <div className="pd24-kicker-warm">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand-warm)] opacity-60" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--brand-warm)]" />
                      </span>
                      Autopilot · ein Satz reicht
                    </span>
                  </div>
                  <h1 className="mt-4 pd24-display text-[2.7rem] leading-[0.94] tracking-tight text-[var(--text-strong)] sm:text-6xl lg:text-7xl">
                    Schreib was du vorhast. Der Autopilot baut den Tag.
                  </h1>
                  <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--text-muted-warm)]">
                    Ein Satz wie &bdquo;Date-Abend in München mit Live-Konzert&ldquo; reicht. PerfectDay24 generiert einen kompletten Ablauf mit echten Events, passenden Wegen und sauberem Timing — direkt teilbar.
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

              <div id="hero-proof">
                <HeroLiveDemo />
                <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[linear-gradient(180deg,var(--brand-warm-cloud),var(--bg-canvas-warm))] p-5">
                  <div className="flex flex-wrap gap-2">
                    {heroSignals.map((signal) => (
                      <MetricPill key={signal}>{signal}</MetricPill>
                    ))}
                  </div>
                  <div className="mt-3 text-sm leading-7 text-[var(--text-muted-warm)]">
                    Nicht nur Orte nebeneinander, sondern ein Ablauf mit Hauptmoment, Timing und einer Plausibilität, die sich direkt gut anfühlt.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-white/82 px-5 py-6 shadow-[var(--shadow-soft)] sm:px-8 sm:py-7">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {reachStats.map((stat) => (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className="group block border-l border-[var(--line-subtle)] pl-4 transition first:border-l-0 first:pl-0 hover:opacity-90 sm:border-l sm:first:border-l-0"
                >
                  <div className="pd24-display text-3xl tracking-tight text-[var(--text-strong)] transition group-hover:text-[var(--brand-warm-ink)] sm:text-4xl">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[var(--brand-warm-ink)]">{stat.label}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-[var(--text-muted-warm)]">
                    {stat.note}
                    <span className="translate-x-0 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100">→</span>
                  </div>
                </Link>
              ))}
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

            <div className="grid gap-5 sm:grid-cols-2">
              <ListBlock title="Ohne PerfectDay24" items={compareWithout} tone="soft" />
              <ListBlock title="Mit PerfectDay24" items={compareWith} tone="strong" />
            </div>

            <div className="flex justify-center">
              <PD24Button href="/planner">Plan statt Trefferliste ausprobieren</PD24Button>
            </div>
          </section>

          <section className="space-y-6">
            <SectionIntro
              eyebrow="Vier Modi · ein Stack"
              title="Was möchtest du planen?"
              body="Tag, Roadtrip, Event oder einfach entdecken — alle vier sind tiefer integriert als eine reine Linkliste."
            />
            <FeatureShowcase />
          </section>

          <section>
            <SectionIntro
              eyebrow="Wähle deinen Einstieg"
              title="Direkt loslegen"
              body="Wähle den Modus, der zu deinem Anlass passt: ein Tag in der Stadt oder ein Event mit mehreren Beteiligten."
            />

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col overflow-hidden rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[linear-gradient(160deg,var(--bg-canvas-warm),var(--brand-warm-cloud))] shadow-[var(--shadow-soft)]">
                <div className="relative h-44 w-full overflow-hidden">
                  <Image
                    src="https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=900&h=420&fit=crop&auto=format&q=80"
                    alt="Stadt am Abend, Spaziergänger und Lichter"
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[rgba(196,137,79,0.35)] via-transparent to-transparent" />
                </div>
                <div className="flex flex-1 flex-col p-7">
                  <div className="pd24-kicker-warm">City Planning</div>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-strong)]">
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
              </div>

              <div className="flex flex-col overflow-hidden rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[linear-gradient(160deg,rgba(240,247,243,0.98),rgba(228,240,234,0.94))] shadow-[var(--shadow-soft)]">
                <div className="relative h-44 w-full overflow-hidden">
                  <Image
                    src="https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=900&h=420&fit=crop&auto=format&q=80"
                    alt="Eingedeckter Eventsaal mit Tischen und Atmosphäre"
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[rgba(45,90,61,0.32)] via-transparent to-transparent" />
                </div>
                <div className="flex flex-1 flex-col p-7">
                  <div className="pd24-kicker-warm text-[#2d5a3d]">Event Flow</div>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-strong)]">
                    Ein Event veranstalten
                  </h3>
                  <p className="mt-3 flex-1 text-base leading-7 text-[var(--text-muted-warm)]">
                    Für Geburtstag, JGA, Teamday oder Dinner. Stelle Anbieter zusammen, frage Preise an und verschicke digitale Einladungen — alles an einem Ort.
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
            </div>
          </section>

          <AiExploreTeaser />

          <section className="space-y-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="pd24-kicker-warm">Kuratiert von uns</div>
                <h2 className="mt-2 pd24-display text-3xl tracking-tight text-[var(--text-strong)] sm:text-4xl">
                  Fertige Routen mit Hauptmoment.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--text-muted-warm)] sm:text-base">
                  Klick einen Tag an, übernimm ihn in den Planner und passe ihn nach Lust an.
                </p>
              </div>
              <Link
                href="/explore"
                className="hidden min-h-11 items-center text-sm font-medium text-[var(--text-strong)] underline-offset-2 hover:underline sm:inline-flex"
              >
                Alle entdecken →
              </Link>
            </div>
            <EditorialRoutesShowcase />
          </section>

          <section className="rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[linear-gradient(160deg,rgba(248,250,252,0.96),rgba(238,244,248,0.92))] p-6 shadow-[var(--shadow-soft)] sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
              <div className="max-w-3xl">
                <div className="pd24-kicker-warm text-[var(--text-soft-warm)]">Für Anbieter</div>
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

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {partnerProofStats.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[var(--radius-card-sm)] border border-[rgba(196,137,79,0.18)] bg-[rgba(255,249,241,0.9)] px-4 py-4"
                    >
                      <div className="text-2xl font-semibold tracking-tight text-[var(--text-strong)]">{item.value}</div>
                      <div className="mt-1 text-sm font-medium text-[var(--brand-warm-ink)]">{item.label}</div>
                      <div className="mt-2 text-xs leading-5 text-[var(--text-muted-warm)]">{item.note}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-white/88 p-5 shadow-[var(--shadow-soft)]">
                <div className="pd24-kicker-warm">Self-Service-Portal</div>
                <div className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-strong)]">
                  Partner steuern Sichtbarkeit, Medien und Angebote selbst
                </div>
                <div className="mt-3 space-y-3">
                  {partnerPortalModules.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-4"
                    >
                      <div className="text-sm font-semibold text-[var(--text-strong)]">{item.title}</div>
                      <div className="mt-1 text-sm leading-6 text-[var(--text-muted-warm)]">{item.body}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[linear-gradient(180deg,var(--brand-warm-cloud),var(--bg-canvas-warm))] px-4 py-4">
                  <div className="pd24-meta">
                    Statuslogik
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[var(--text-muted-warm)]">
                    Draft → In Review → Published → Featured. So bleibt Partner-Content steuerbar und trotzdem qualitativ konsistent.
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <PD24Button href="/partner" variant="secondary" className="min-w-[12rem]">
                    Partner werden
                  </PD24Button>
                  <Link
                    href="/partner/dashboard"
                    className="inline-flex min-h-12 items-center text-sm font-medium text-[var(--text-strong)] underline-offset-2 transition hover:underline"
                  >
                    Partner-Portal ansehen →
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section>
            <SectionIntro
              eyebrow="So funktioniert es"
              title="In drei Schritten zum fertigen Plan"
              body="Der Flow bleibt bewusst einfach: kurz beschreiben, den Plan ansehen und dann direkt gemeinsam nutzen."
            />

            <div className="relative mt-8 grid gap-5 sm:grid-cols-3">
              {howItWorksSteps.map((step) => (
                <div
                  key={step.number}
                  className="relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[rgba(255,253,248,0.82)] shadow-[var(--shadow-soft)]"
                >
                  <div className="relative h-36 w-full overflow-hidden border-b border-[var(--line-subtle)] bg-[linear-gradient(160deg,var(--brand-warm-cloud),var(--bg-canvas-warm))]">
                    <HowItWorksVisual visual={step.visual} />
                    <div className="absolute right-3 top-2 pd24-display text-4xl leading-none text-[rgba(196,137,79,0.35)]">
                      {step.number}
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-[var(--text-strong)]">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted-warm)]">{step.body}</p>
                  </div>
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
                  className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[rgba(255,253,248,0.82)] shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-large)]"
                >
                  <div className="relative h-36 w-full overflow-hidden">
                    <Image
                      src={card.image}
                      alt={card.imageAlt}
                      fill
                      className="object-cover transition-transform duration-500 hover:scale-[1.04]"
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="text-xl font-semibold tracking-tight text-[var(--text-strong)]">{card.title}</h3>
                    <p className="mt-3 flex-1 text-sm leading-7 text-[var(--text-muted-warm)]">{card.body}</p>
                    <Link
                      href={card.href}
                      className="mt-4 inline-flex min-h-11 items-center self-start text-sm font-medium text-[var(--text-strong)] underline-offset-2 transition hover:underline"
                    >
                      {card.cta} →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[var(--radius-shell)] bg-[var(--text-strong)] px-6 py-10 text-[var(--bg-surface-warm)] shadow-[var(--shadow-large)] sm:px-8">
            <div className="max-w-3xl">
              {/* Bewusst ohne .pd24-kicker-warm: die un-gelayerte Klasse gewinnt
                  gegen Tailwind-Utilities, auf dunklem Grund braucht es helle Schrift. */}
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgba(255,253,248,0.72)]">Abschluss</div>
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
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-[var(--text-muted-warm)]">
              <Link href="/planner" className="inline-flex min-h-10 items-center hover:text-[var(--text-strong)]">Planen</Link>
              <Link href="/explore" className="inline-flex min-h-10 items-center hover:text-[var(--text-strong)]">Entdecken</Link>
              <Link href="/events" className="inline-flex min-h-10 items-center hover:text-[var(--text-strong)]">Events</Link>
              <Link href="/saved" className="inline-flex min-h-10 items-center hover:text-[var(--text-strong)]">Meine Pläne</Link>
              <Link href="/impressum" className="inline-flex min-h-10 items-center hover:text-[var(--text-strong)]">Impressum</Link>
              <Link href="/datenschutz" className="inline-flex min-h-10 items-center hover:text-[var(--text-strong)]">Datenschutz</Link>
              <ConsentSettingsLink className="inline-flex min-h-10 items-center text-left hover:text-[var(--text-strong)]" />
              <Link href="/partner" className="inline-flex min-h-10 items-center hover:text-[var(--text-strong)]">Für Anbieter</Link>
              <Link href="/agb" className="inline-flex min-h-10 items-center hover:text-[var(--text-strong)]">AGB</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
