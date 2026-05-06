import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-pd24-atelier-display",
});

const trustSignals = [
  "Kuratierte Stadtdramaturgie",
  "Events als kultureller Anker",
  "Starke Handschrift statt Standardflow",
];

const framingItems = [
  {
    title: "Mehr Haltung",
    body: "Diese Richtung wirkt deutlich kultureller, urbaner und erinnerbarer als eine klassische Produkt-Homepage.",
  },
  {
    title: "Mehr Charakter",
    body: "Typografie, Farbakzente und Komposition erzeugen ein eigenes Gesicht statt nur ein sauberes Interface.",
  },
  {
    title: "Mehr Differenzierung",
    body: "Perfectday24 tritt hier nicht wie ein Utility-Tool auf, sondern wie eine kuratierende Stadtmarke mit Produktintelligenz.",
  },
];

const featurePanels = [
  {
    eyebrow: "City Curation",
    title: "Die Stadt wird nicht nur organisiert, sondern komponiert",
    body: "Orte, Wege und Programmpunkte erscheinen als zusammenhaengender urbaner Ablauf mit eigener Dramaturgie.",
    tone: "bg-[linear-gradient(140deg,rgba(227,111,73,0.22),rgba(248,241,230,0.96),rgba(47,90,89,0.16))]",
    large: true,
  },
  {
    eyebrow: "Cultural Mood",
    title: "Mehr Kultur, weniger Standard-Conversion-Oberflaeche",
    body: "Die Startseite fuehlt sich wie eine kuratierte Stadtplattform an, nicht wie ein austauschbares SaaS-Layout.",
    tone: "bg-[linear-gradient(180deg,rgba(47,90,89,0.14),rgba(250,245,237,0.98))]",
    large: false,
  },
  {
    eyebrow: "Brand Presence",
    title: "Mutiger, aber immer noch produktnah",
    body: "Die Richtung bleibt nutzbar und konvertierend, setzt aber deutlich staerkere Zeichen in Typografie und Flaechengewichtung.",
    tone: "bg-[linear-gradient(180deg,rgba(214,160,80,0.14),rgba(250,245,237,0.98))]",
    large: false,
  },
];

const routeMoments = [
  { time: "17:10", title: "Galerie und Aperitif", note: "ein stiller Auftakt mit Charakter statt klassischem Startscreen" },
  { time: "19:20", title: "Live-Set als Hauptmoment", note: "das Event wird als kultureller Anker des Abends gesetzt" },
  { time: "21:35", title: "Dinner mit Haltung", note: "kein beliebiger Stop, sondern konsequente Verlaengerung des Tons" },
  { time: "23:05", title: "Bar fuer den Ausklang", note: "verdichteter Abschluss mit kurzer Distanz und klarer Stimmung" },
];

const routeTeasers = [
  { title: "Late Sound & Natural Wine", city: "Berlin", meta: "Night Edition · 4 Stops · Curated" },
  { title: "Concrete, Coffee, Harbour Light", city: "Hamburg", meta: "City Walk · 5 Stops · Atelier Pick" },
];

function SectionLead({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="max-w-2xl">
      <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#e36f49]">
        {eyebrow}
      </div>
      <h2 className="mt-3 font-[family:var(--font-pd24-atelier-display)] text-4xl leading-tight tracking-tight text-[#161410] sm:text-5xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-[#5f5a52] sm:text-lg">{body}</p>
    </div>
  );
}

function PrimaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-12 items-center justify-center rounded-full bg-[#161410] px-6 text-sm font-medium text-[#faf5ed] transition hover:bg-[#2a241d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0c7b8] focus-visible:ring-offset-2"
    >
      {children}
    </Link>
  );
}

function SecondaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-12 items-center justify-center rounded-full border border-[rgba(22,20,16,0.14)] bg-[rgba(250,245,237,0.86)] px-6 text-sm font-medium text-[#161410] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0c7b8] focus-visible:ring-offset-2"
    >
      {children}
    </Link>
  );
}

export default function HomepageScaffoldAtelier() {
  return (
    <div className={`${display.variable} min-h-screen bg-[#f3ece1] text-[#161410]`}>
      <div className="mx-auto max-w-[1240px] px-5 pb-20 pt-6 sm:px-6 lg:px-8">
        <header className="sticky top-4 z-40 rounded-[30px] border border-[rgba(22,20,16,0.08)] bg-[rgba(250,245,237,0.8)] px-5 py-4 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="min-w-0">
              <div className="font-[family:var(--font-pd24-atelier-display)] text-2xl leading-none tracking-tight text-[#161410]">
                Perfectday24
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.3em] text-[#5f5a52]">
                City Atelier Planning
              </div>
            </Link>

            <nav className="hidden items-center gap-2 md:flex">
              <Link href="/" className="rounded-full bg-[#161410] px-4 py-2 text-sm font-medium text-[#faf5ed]">
                Planner
              </Link>
              <Link href="/explore" className="rounded-full px-4 py-2 text-sm text-[#5f5a52] transition hover:bg-[rgba(255,255,255,0.7)] hover:text-[#161410]">
                Explore
              </Link>
              <Link href="/routes" className="rounded-full px-4 py-2 text-sm text-[#5f5a52] transition hover:bg-[rgba(255,255,255,0.7)] hover:text-[#161410]">
                Routes
              </Link>
              <Link href="/profile" className="rounded-full px-4 py-2 text-sm text-[#5f5a52] transition hover:bg-[rgba(255,255,255,0.7)] hover:text-[#161410]">
                Profil
              </Link>
            </nav>

            <PrimaryButton href="/">Tag planen</PrimaryButton>
          </div>
        </header>

        <main className="mt-6 space-y-14 sm:space-y-20">
          <section className="relative overflow-hidden rounded-[36px] border border-[rgba(22,20,16,0.08)] bg-[linear-gradient(145deg,rgba(250,245,237,0.98),rgba(239,224,205,0.94),rgba(235,231,221,0.98))] px-6 py-8 shadow-[0_28px_80px_rgba(44,31,20,0.1)] sm:px-8 sm:py-10">
            <div className="pointer-events-none absolute left-[-2rem] top-[-1rem] h-56 w-56 rounded-full bg-[rgba(227,111,73,0.12)] blur-3xl" />
            <div className="pointer-events-none absolute bottom-[-1rem] right-[10%] h-48 w-48 rounded-full bg-[rgba(47,90,89,0.12)] blur-3xl" />

            <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(340px,0.98fr)] lg:items-center">
              <div className="max-w-2xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#e36f49]">
                  Curated. Cultural. Unmistakably urban.
                </div>
                <h1 className="mt-4 font-[family:var(--font-pd24-atelier-display)] text-5xl leading-[0.92] tracking-tight text-[#161410] sm:text-6xl lg:text-7xl">
                  Der Stadttag mit mehr Haltung, Rhythmus und Charakter.
                </h1>
                <p className="mt-5 max-w-xl text-lg leading-8 text-[#5f5a52]">
                  Perfectday24 verbindet Orte, Events und Gruppenentscheidungen zu einer urbanen
                  Komposition, die sich eher nach kuratierter Stadtkultur als nach Standardplanung anfuehlt.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <PrimaryButton href="/">Tag planen</PrimaryButton>
                  <SecondaryButton href="/routes">Creator Routes entdecken</SecondaryButton>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  {trustSignals.map((signal) => (
                    <span
                      key={signal}
                      className="rounded-full border border-[rgba(22,20,16,0.08)] bg-[rgba(255,255,255,0.6)] px-4 py-2 text-sm text-[#5f5a52]"
                    >
                      {signal}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rotate-[-1.2deg] rounded-[34px] border border-[rgba(22,20,16,0.08)] bg-[rgba(250,245,237,0.96)] p-6 shadow-[0_30px_90px_rgba(44,31,20,0.14)] sm:p-7">
                <div className="rotate-[1.2deg]">
                  <div className="flex flex-wrap gap-2">
                    {["Berlin", "Late Date", "Live Set"].map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border border-[rgba(22,20,16,0.08)] bg-white px-3 py-1.5 text-xs font-medium text-[#5f5a52]"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>

                  <h2 className="mt-5 font-[family:var(--font-pd24-atelier-display)] text-3xl leading-tight tracking-tight text-[#161410]">
                    Ein Abend, der sich wie ein kuratierter Schnitt durch die Stadt anfuehlt
                  </h2>

                  <div className="mt-6 space-y-4">
                    {routeMoments.map((moment, index) => (
                      <div
                        key={moment.time}
                        className="grid grid-cols-[60px_1fr] gap-4 rounded-[24px] border border-[rgba(22,20,16,0.08)] bg-[rgba(255,255,255,0.72)] px-4 py-4"
                      >
                        <div className="text-sm font-semibold text-[#e36f49]">{moment.time}</div>
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#161410] text-xs font-semibold text-[#faf5ed]">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <div className="text-base font-medium text-[#161410]">{moment.title}</div>
                          </div>
                          <div className="mt-2 text-sm leading-6 text-[#5f5a52]">{moment.note}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-[28px] border border-[rgba(22,20,16,0.08)] bg-[linear-gradient(180deg,rgba(244,232,214,0.8),rgba(250,245,237,0.96))] p-5">
                    <div className="flex items-center justify-between text-sm text-[#5f5a52]">
                      <span>Route score</span>
                      <span>Curated balance 92</span>
                    </div>
                    <div className="mt-4 grid grid-cols-5 gap-2">
                      <div className="h-14 rounded-[20px] bg-[rgba(47,90,89,0.2)]" />
                      <div className="mt-4 h-8 rounded-full bg-[rgba(22,20,16,0.14)]" />
                      <div className="h-14 rounded-[20px] bg-[rgba(227,111,73,0.22)]" />
                      <div className="mt-1 h-12 rounded-full bg-[rgba(214,160,80,0.18)]" />
                      <div className="h-14 rounded-[20px] bg-[rgba(47,90,89,0.18)]" />
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {["Event als Hauptmoment", "Kuratiert fuer zwei", "Stimmiger Schluss"].map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-[rgba(47,90,89,0.18)] bg-[rgba(47,90,89,0.08)] px-3 py-1.5 text-xs font-medium text-[#2f5a59]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-3">
            {framingItems.map((item) => (
              <div key={item.title} className="rounded-[28px] border border-[rgba(22,20,16,0.08)] bg-[rgba(255,255,255,0.5)] p-6">
                <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#5f5a52]">
                  Atelier Perspective
                </div>
                <h3 className="mt-3 font-[family:var(--font-pd24-atelier-display)] text-3xl leading-tight tracking-tight text-[#161410]">
                  {item.title}
                </h3>
                <p className="mt-3 text-base leading-7 text-[#5f5a52]">{item.body}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)]">
            <div className="rounded-[34px] border border-[rgba(22,20,16,0.08)] bg-[rgba(250,245,237,0.9)] p-7 shadow-[0_20px_50px_rgba(44,31,20,0.08)]">
              <SectionLead
                eyebrow="Direction"
                title="Contemporary City Atelier bringt mehr Unterscheidbarkeit in die Marke"
                body="Diese Linie nutzt starke Typografie, bewusstere Farbmomente und eine kulturellere Komposition, damit Perfectday24 nicht wie Konkurrenz wirkt."
              />

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {featurePanels.map((panel) => (
                  <div
                    key={panel.title}
                    className={`rounded-[30px] border border-[rgba(22,20,16,0.08)] ${panel.tone} p-6 ${
                      panel.large ? "sm:col-span-2" : ""
                    }`}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#5f5a52]">
                      {panel.eyebrow}
                    </div>
                    <h3 className="mt-3 font-[family:var(--font-pd24-atelier-display)] text-3xl leading-tight tracking-tight text-[#161410]">
                      {panel.title}
                    </h3>
                    <p className="mt-3 text-base leading-7 text-[#5f5a52]">{panel.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[34px] border border-[rgba(22,20,16,0.08)] bg-[#161410] p-7 text-[#faf5ed] shadow-[0_30px_90px_rgba(44,31,20,0.16)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#f0c7b8]">
                Positioning
              </div>
              <h3 className="mt-3 font-[family:var(--font-pd24-atelier-display)] text-4xl leading-tight">
                Contemporary City Atelier
              </h3>
              <p className="mt-4 text-base leading-7 text-[rgba(250,245,237,0.76)]">
                Die mutigste Richtung im Vergleich: kultureller, urbaner, typografischer und sichtbar eigenstaendiger als die beiden anderen.
              </p>
              <div className="mt-8 space-y-3">
                {[
                  "Staerkere Serif-Praesenz und bewusstere Komposition",
                  "Mehr Kontrast aus Terracotta, Petrol und dunklem Ink",
                  "Mehr Markenhaltung bei weiterhin klarer Produktfuehrung",
                ].map((point) => (
                  <div key={point} className="rounded-[20px] border border-[rgba(250,245,237,0.12)] bg-[rgba(250,245,237,0.05)] px-4 py-3 text-sm leading-6">
                    {point}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[34px] border border-[rgba(22,20,16,0.08)] bg-[rgba(255,255,255,0.5)] p-6 shadow-[0_18px_44px_rgba(44,31,20,0.06)] sm:p-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(320px,0.94fr)_minmax(0,1.06fr)]">
              <div>
                <SectionLead
                  eyebrow="Planner Entry"
                  title="Ein Einstieg, der mehr wie kuratierte Auswahl als wie Formular wirkt"
                  body="Die Controls bleiben funktional, bekommen aber mehr Haltung, groessere Flaechen und einen bewusst komponierten Produktausdruck."
                />

                <div className="mt-8 space-y-4">
                  {[
                    ["City", "Berlin"],
                    ["Occasion", "Late Date"],
                    ["Mode", "Live Set + Dinner"],
                    ["People", "2 adults"],
                  ].map(([label, value]) => (
                    <button
                      key={label}
                      type="button"
                      className="flex h-[78px] w-full items-center justify-between rounded-[26px] border border-[rgba(22,20,16,0.08)] bg-[rgba(250,245,237,0.9)] px-5 text-left shadow-[0_10px_24px_rgba(44,31,20,0.05)] transition hover:border-[rgba(22,20,16,0.16)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0c7b8]"
                    >
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#5f5a52]">
                          {label}
                        </div>
                        <div className="mt-2 text-lg font-medium text-[#161410]">{value}</div>
                      </div>
                      <span className="text-lg text-[#5f5a52]">+</span>
                    </button>
                  ))}
                </div>

                <div className="mt-6">
                  <PrimaryButton href="/">Plan starten</PrimaryButton>
                  <p className="mt-3 text-sm leading-6 text-[#5f5a52]">
                    Detaillierte Optionen und Varianten folgen im Planner.
                  </p>
                </div>
              </div>

              <div className="rounded-[30px] border border-[rgba(22,20,16,0.08)] bg-[linear-gradient(180deg,rgba(248,241,230,0.94),rgba(255,255,255,0.76))] p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#5f5a52]">
                      Scenario Preview
                    </div>
                    <h3 className="mt-2 font-[family:var(--font-pd24-atelier-display)] text-3xl leading-tight tracking-tight text-[#161410]">
                      So koennte euer Abend aussehen
                    </h3>
                  </div>
                  <span className="rounded-full border border-[rgba(47,90,89,0.18)] bg-[rgba(47,90,89,0.08)] px-3 py-1.5 text-xs font-medium text-[#2f5a59]">
                    Curated Sequence
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  {routeMoments.slice(0, 3).map((moment) => (
                    <div key={moment.time} className="rounded-[24px] border border-[rgba(22,20,16,0.08)] bg-white px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-[#e36f49]">{moment.time}</div>
                        <div className="text-sm text-[#5f5a52]">Transit 7-11 Min</div>
                      </div>
                      <div className="mt-2 text-base font-medium text-[#161410]">{moment.title}</div>
                      <div className="mt-1 text-sm leading-6 text-[#5f5a52]">{moment.note}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[24px] border border-[rgba(22,20,16,0.08)] bg-[rgba(255,255,255,0.74)] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#5f5a52]">
                    Why this works
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[#5f5a52]">
                    Ein klarer kultureller Hauptmoment, anschliessend passende Orte mit konsistenter Tonalitaet statt einer generischen Abfolge von Treffern.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-[34px] border border-[rgba(22,20,16,0.08)] bg-[rgba(255,255,255,0.52)] p-7 shadow-[0_18px_44px_rgba(44,31,20,0.06)]">
              <SectionLead
                eyebrow="Explore"
                title="Creator und Routen werden hier wie urbane Programme inszeniert"
                body="Explore wirkt in dieser Richtung am wenigsten wie ein Katalog und am staerksten wie eine kulturell kuratierte Stadtplattform."
              />

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {routeTeasers.map((route, index) => (
                  <article
                    key={route.title}
                    className="overflow-hidden rounded-[28px] border border-[rgba(22,20,16,0.08)] bg-[rgba(250,245,237,0.9)]"
                  >
                    <div
                      className={`h-44 ${
                        index === 0
                          ? "bg-[linear-gradient(145deg,rgba(227,111,73,0.34),rgba(250,245,237,0.92),rgba(47,90,89,0.2))]"
                          : "bg-[linear-gradient(145deg,rgba(47,90,89,0.22),rgba(250,245,237,0.94),rgba(214,160,80,0.18))]"
                      }`}
                    />
                    <div className="p-5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#5f5a52]">
                        {route.city}
                      </div>
                      <h3 className="mt-2 font-[family:var(--font-pd24-atelier-display)] text-3xl leading-tight tracking-tight text-[#161410]">
                        {route.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[#5f5a52]">{route.meta}</p>
                      <Link href="/explore" className="mt-5 inline-flex text-sm font-medium text-[#161410] underline underline-offset-4">
                        Route ansehen
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="rounded-[34px] border border-[rgba(22,20,16,0.08)] bg-[#161410] p-6 text-[#faf5ed] shadow-[0_28px_80px_rgba(44,31,20,0.14)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#f0c7b8]">
                Atelier Creator
              </div>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2f5a59] text-lg font-semibold text-[#faf5ed]">
                  NS
                </div>
                <div>
                  <div className="font-[family:var(--font-pd24-atelier-display)] text-3xl leading-none tracking-tight">
                    Nora Stein
                  </div>
                  <div className="mt-1 text-sm text-[rgba(250,245,237,0.74)]">
                    Sound, wine, architecture, night routes
                  </div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-[22px] bg-[rgba(250,245,237,0.06)] px-3 py-3">
                  <div className="text-lg font-semibold">14</div>
                  <div className="text-sm text-[rgba(250,245,237,0.74)]">Routes</div>
                </div>
                <div className="rounded-[22px] bg-[rgba(250,245,237,0.06)] px-3 py-3">
                  <div className="text-lg font-semibold">4.8</div>
                  <div className="text-sm text-[rgba(250,245,237,0.74)]">Rating</div>
                </div>
              </div>
            </aside>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="rounded-[34px] border border-[rgba(22,20,16,0.08)] bg-[rgba(255,255,255,0.48)] p-7">
              <SectionLead
                eyebrow="Group Flow"
                title="Die Gruppenlogik wirkt hier eher wie kuratierte Entscheidung als wie technischer Status"
                body="Wahl, Zustimmung und Bestaetigung bekommen mehr erzahlerische und visuelle Praesenz, bleiben aber klar lesbar."
              />

              <div className="mt-8 space-y-4">
                {[
                  ["01", "Rahmen kuratieren", "Anlass und Rhythmus setzen den Ton fuer die Varianten."],
                  ["02", "Versionen gegeneinander halten", "Die Gruppe sieht nicht nur Optionen, sondern unterschiedliche Abenderzaehlungen."],
                  ["03", "Eine gemeinsame Linie finden", "Die Wahl wird sichtbar und fuehlt sich wie eine bewusste Entscheidung an."],
                ].map(([step, title, body]) => (
                  <div key={step} className="grid grid-cols-[56px_1fr] gap-4 rounded-[26px] border border-[rgba(22,20,16,0.08)] bg-[rgba(250,245,237,0.9)] px-4 py-4">
                    <div className="font-[family:var(--font-pd24-atelier-display)] text-3xl leading-none text-[#e36f49]">
                      {step}
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-[#161410]">{title}</div>
                      <div className="mt-2 text-sm leading-6 text-[#5f5a52]">{body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[34px] border border-[rgba(22,20,16,0.08)] bg-[rgba(250,245,237,0.92)] p-7 shadow-[0_18px_44px_rgba(44,31,20,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#5f5a52]">
                    Choice Demo
                  </div>
                  <h3 className="mt-2 font-[family:var(--font-pd24-atelier-display)] text-3xl leading-tight tracking-tight text-[#161410]">
                    Varianten mit mehr Geste und mehr Markencharakter
                  </h3>
                </div>
                <span className="rounded-full border border-[rgba(47,90,89,0.18)] bg-[rgba(47,90,89,0.08)] px-3 py-1.5 text-xs font-medium text-[#2f5a59]">
                  Our pick
                </span>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-[26px] border border-[rgba(47,90,89,0.18)] bg-[rgba(47,90,89,0.08)] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-[#161410]">Variante A</div>
                      <div className="mt-1 text-sm text-[#2f5a59]">Unsere Wahl</div>
                    </div>
                    <span className="rounded-full border border-[rgba(47,90,89,0.18)] bg-white px-3 py-1 text-xs font-medium text-[#2f5a59]">
                      2 Zusagen
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#2f5a59]">
                    Die klarste Linie aus Sound, Dinner und Nachtort. Weniger Stops, aber die staerkere Stimmung.
                  </p>
                </div>

                <div className="rounded-[26px] border border-[rgba(22,20,16,0.08)] bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-[#161410]">Variante B</div>
                      <div className="mt-1 text-sm text-[#5f5a52]">Alternative</div>
                    </div>
                    <span className="rounded-full border border-[rgba(214,160,80,0.18)] bg-[rgba(214,160,80,0.08)] px-3 py-1 text-xs font-medium text-[#9a7436]">
                      Noch 1 Stimme
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#5f5a52]">
                    Offener und lebendiger, aber auch weniger fokussiert in Ton und Wegfuehrung.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-[24px] border border-[rgba(227,111,73,0.16)] bg-[rgba(227,111,73,0.08)] px-4 py-4">
                <div className="text-sm font-semibold text-[#a34d34]">Choice confirmed</div>
                <div className="mt-1 text-sm leading-6 text-[#a34d34]">
                  Die Entscheidung ist sichtbar markiert und fuehlt sich wie eine kuratierte gemeinsame Linie an.
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[36px] bg-[#161410] px-6 py-10 text-[#faf5ed] shadow-[0_30px_90px_rgba(44,31,20,0.16)] sm:px-8">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#f0c7b8]">
                Final CTA
              </div>
              <h2 className="mt-4 font-[family:var(--font-pd24-atelier-display)] text-5xl leading-[0.96] tracking-tight sm:text-6xl">
                Wenn Perfectday24 bewusst nicht wie Konkurrenz aussehen soll, ist das die schlagkraeftigste Richtung.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[rgba(250,245,237,0.76)]">
                Contemporary City Atelier ist die eigenstaendigste Markenwelt im Vergleich und macht aus dem Produkt eine erkennbare kulturelle Plattform.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <PrimaryButton href="/">Jetzt Tag planen</PrimaryButton>
                <SecondaryButton href="/homepage-concept">Richtung 1 vergleichen</SecondaryButton>
              </div>
            </div>
          </section>
        </main>

        <footer className="mt-12 rounded-[32px] border border-[rgba(250,245,237,0.12)] bg-[#161410] px-6 py-6 text-[#faf5ed]">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="font-[family:var(--font-pd24-atelier-display)] text-3xl tracking-tight">
                PerfectDay24
              </div>
              <div className="mt-2 text-sm text-[rgba(250,245,237,0.72)]">
                Contemporary city atelier with launch-ready legal placeholders.
              </div>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[rgba(250,245,237,0.72)]">
              <Link href="/">Planner</Link>
              <Link href="/explore">Explore</Link>
              <Link href="/routes">Routes</Link>
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
