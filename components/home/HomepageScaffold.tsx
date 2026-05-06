import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-pd24-display",
});

const trustSignals = [
  "Echte lokale Empfehlungen",
  "Events sinnvoll integriert",
  "Ideal fuer Dates, Freunde und Besuch",
];

const trustItems = [
  {
    title: "Nicht nur Orte",
    body: "Aus Empfehlungen wird ein Ablauf mit Rhythmus, Uebergaengen und einer klaren Tageslogik.",
  },
  {
    title: "Nicht nur Suche",
    body: "Events, Anlass und Wegezeiten werden gemeinsam betrachtet statt isoliert gefiltert.",
  },
  {
    title: "Nicht nur solo",
    body: "Auch Gruppen koennen Varianten vergleichen und schneller zu einer gemeinsamen Wahl kommen.",
  },
];

const valueCards = [
  {
    eyebrow: "Local Quality",
    title: "Lokale Qualitaet statt generischer Treffer",
    body: "Perfectday24 priorisiert Orte und Erlebnisse, die fuer den Anlass wirklich Sinn ergeben und sich in der Stadt gut anfuehlen.",
    accent: "from-[rgba(184,92,56,0.16)] to-[rgba(255,253,248,0.86)]",
  },
  {
    eyebrow: "Mood-first Planning",
    title: "Ein Plan, der zur Stimmung passt",
    body: "Ob Date, Freunde oder Familie: der Tag wird passend zur Situation aufgebaut, nicht neutral zusammengeklickt.",
    accent: "from-[rgba(114,134,116,0.18)] to-[rgba(255,253,248,0.88)]",
  },
  {
    eyebrow: "Group Flow",
    title: "Gemeinsam entscheiden ohne Planungschaos",
    body: "Varianten vergleichen, die beste markieren und als Gruppe schneller zu einer stimmigen Wahl kommen.",
    accent: "from-[rgba(160,106,44,0.16)] to-[rgba(255,253,248,0.88)]",
  },
];

const plannerStops = [
  { time: "17:30", title: "Aperitif in Charlottenburg", note: "ruhiger Einstieg mit kurzer Anfahrt" },
  { time: "19:00", title: "Konzert als Hauptmoment", note: "lokales Event mit festem Zeitfenster" },
  { time: "21:15", title: "Late Dinner", note: "passend zum Musik- und Abendrhythmus" },
  { time: "22:45", title: "Bar fuer den Ausklang", note: "wenige Minuten vom letzten Stop entfernt" },
];

const teaserRoutes = [
  {
    title: "Wine Bars & Late Jazz",
    city: "Berlin",
    meta: "Date · 4 Stops · Abend",
  },
  {
    title: "Architektur, Kaffee, Spaziergang",
    city: "Hamburg",
    meta: "Wochenende · 5 Stops · Halbtag",
  },
];

function SectionIntro({
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
      <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#b85c38]">
        {eyebrow}
      </div>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#1f1c17] sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-[#6e6256] sm:text-lg">{body}</p>
    </div>
  );
}

function PrimaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#1f1c17] px-5 text-sm font-medium text-[#fffdf8] shadow-[0_18px_44px_rgba(49,39,27,0.12)] transition hover:bg-[#2c2822] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e7c2af] focus-visible:ring-offset-2"
    >
      {children}
    </Link>
  );
}

function SecondaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-12 items-center justify-center rounded-2xl border border-[rgba(31,28,23,0.1)] bg-[rgba(255,253,248,0.9)] px-5 text-sm font-medium text-[#1f1c17] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e7c2af] focus-visible:ring-offset-2"
    >
      {children}
    </Link>
  );
}

export default function HomepageScaffold() {
  return (
    <div className={`${display.variable} min-h-screen bg-[#f5f1e8] text-[#1f1c17]`}>
      <div className="mx-auto max-w-[1200px] px-5 pb-20 pt-6 sm:px-6 lg:px-8">
        <header className="sticky top-4 z-40 rounded-[28px] border border-[rgba(31,28,23,0.08)] bg-[rgba(255,253,248,0.78)] px-5 py-4 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="min-w-0">
              <div className="text-lg font-semibold tracking-tight text-[#1f1c17]">Perfectday24</div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-[#6e6256]">
                Curated City Planning
              </div>
            </Link>

            <nav className="hidden items-center gap-2 rounded-full border border-[rgba(31,28,23,0.08)] bg-[rgba(255,253,248,0.86)] p-2 md:flex">
              <Link href="/" className="rounded-full px-4 py-2 text-sm text-[#6e6256] transition hover:bg-white hover:text-[#1f1c17]">
                Planner
              </Link>
              <Link href="/explore" className="rounded-full px-4 py-2 text-sm text-[#6e6256] transition hover:bg-white hover:text-[#1f1c17]">
                Explore
              </Link>
              <Link href="/routes" className="rounded-full px-4 py-2 text-sm text-[#6e6256] transition hover:bg-white hover:text-[#1f1c17]">
                Routes
              </Link>
              <Link href="/profile" className="rounded-full px-4 py-2 text-sm text-[#6e6256] transition hover:bg-white hover:text-[#1f1c17]">
                Profil
              </Link>
            </nav>

            <PrimaryButton href="/">Tag planen</PrimaryButton>
          </div>
        </header>

        <main className="mt-6 space-y-14 sm:space-y-20">
          <section className="relative overflow-hidden rounded-[32px] border border-[rgba(31,28,23,0.08)] bg-[linear-gradient(135deg,rgba(255,253,248,0.98),rgba(237,227,211,0.92))] px-6 py-8 shadow-[0_28px_80px_rgba(49,39,27,0.08)] sm:px-8 sm:py-10">
            <div className="pointer-events-none absolute -right-12 top-0 h-48 w-48 rounded-full bg-[rgba(184,92,56,0.14)] blur-3xl" />
            <div className="pointer-events-none absolute bottom-4 left-[14%] h-40 w-40 rounded-full bg-[rgba(114,134,116,0.12)] blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-center">
              <div className="max-w-2xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#b85c38]">
                  Kuratiert. Lokal. Gemeinsam planbar.
                </div>
                <h1 className="mt-4 font-[family:var(--font-pd24-display)] text-5xl leading-[0.94] tracking-tight text-[#1f1c17] sm:text-6xl lg:text-7xl">
                  Der stimmigere Tag in deiner Stadt.
                </h1>
                <p className="mt-5 max-w-xl text-lg leading-8 text-[#6e6256]">
                  Perfectday24 verbindet lokale Orte, echte Events und Gruppenentscheidungen zu
                  einem Plan, der sich nicht nach Suche anfuehlt, sondern nach einem richtig guten Tag.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <PrimaryButton href="/">Tag planen</PrimaryButton>
                  <SecondaryButton href="/routes">Creator Routes entdecken</SecondaryButton>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  {trustSignals.map((signal) => (
                    <span
                      key={signal}
                      className="rounded-full border border-[rgba(31,28,23,0.08)] bg-[rgba(255,253,248,0.82)] px-4 py-2 text-sm text-[#6e6256]"
                    >
                      {signal}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-[32px] border border-[rgba(31,28,23,0.08)] bg-[rgba(255,253,248,0.95)] p-6 shadow-[0_28px_80px_rgba(49,39,27,0.1)] sm:p-7">
                <div className="flex flex-wrap gap-2">
                  {["Berlin", "Date", "Show-Date"].map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-[rgba(31,28,23,0.08)] bg-white px-3 py-1.5 text-xs font-medium text-[#6e6256]"
                    >
                      {chip}
                    </span>
                  ))}
                </div>

                <h2 className="mt-5 text-2xl font-semibold tracking-tight text-[#1f1c17]">
                  Ein Abend, der leicht wirkt und trotzdem besonders ist
                </h2>

                <div className="mt-6 space-y-4">
                  {plannerStops.map((stop, index) => (
                    <div
                      key={stop.time}
                      className="grid grid-cols-[56px_1fr] gap-4 rounded-[22px] border border-[rgba(31,28,23,0.08)] bg-[rgba(255,253,248,0.92)] px-4 py-4"
                    >
                      <div className="text-sm font-semibold text-[#b85c38]">{stop.time}</div>
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-[#1f1c17] text-xs font-semibold text-[#fffdf8]">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div className="text-base font-medium text-[#1f1c17]">{stop.title}</div>
                        </div>
                        <div className="mt-2 text-sm leading-6 text-[#6e6256]">{stop.note}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-[26px] border border-[rgba(31,28,23,0.08)] bg-[linear-gradient(180deg,rgba(247,242,235,0.95),rgba(236,228,215,0.82))] p-5">
                  <div className="flex items-center justify-between text-sm text-[#6e6256]">
                    <span>Route abgestimmt</span>
                    <span>24 Min Gesamtweg</span>
                  </div>
                  <div className="mt-4 grid grid-cols-5 gap-2">
                    <div className="h-14 rounded-2xl bg-[rgba(114,134,116,0.22)]" />
                    <div className="mt-4 h-8 rounded-full bg-[rgba(31,28,23,0.16)]" />
                    <div className="h-14 rounded-2xl bg-[rgba(184,92,56,0.24)]" />
                    <div className="mt-2 h-10 rounded-full bg-[rgba(31,28,23,0.14)]" />
                    <div className="h-14 rounded-2xl bg-[rgba(114,134,116,0.18)]" />
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  {["Wegezeiten abgestimmt", "Lokales Event integriert", "2 von 2 passend"].map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-[rgba(114,134,116,0.24)] bg-[rgba(220,229,218,0.72)] px-3 py-1.5 text-xs font-medium text-[#506351]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-3">
            {trustItems.map((item) => (
              <div key={item.title} className="rounded-[26px] border border-[rgba(31,28,23,0.08)] bg-[rgba(255,253,248,0.72)] p-6">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6e6256]">
                  Warum Perfectday24
                </div>
                <h3 className="mt-3 text-xl font-semibold tracking-tight text-[#1f1c17]">{item.title}</h3>
                <p className="mt-3 text-base leading-7 text-[#6e6256]">{item.body}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="rounded-[32px] border border-[rgba(31,28,23,0.08)] bg-[rgba(255,253,248,0.94)] p-7 shadow-[0_18px_44px_rgba(49,39,27,0.08)]">
              <SectionIntro
                eyebrow="Value"
                title="Warum sich ein Tag mit Perfectday24 hochwertiger anfuehlt"
                body="Die Startseite erklaert den Nutzen nicht nur ueber Features, sondern ueber Qualitaet, Stimmung und Entscheidungslogik."
              />

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {valueCards.map((card, index) => (
                  <div
                    key={card.title}
                    className={`rounded-[28px] border border-[rgba(31,28,23,0.08)] bg-gradient-to-br ${card.accent} p-6 ${index === 0 ? "sm:col-span-2" : ""}`}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6e6256]">
                      {card.eyebrow}
                    </div>
                    <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[#1f1c17]">
                      {card.title}
                    </h3>
                    <p className="mt-3 max-w-xl text-base leading-7 text-[#6e6256]">{card.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-[rgba(31,28,23,0.08)] bg-[#1f1c17] p-7 text-[#fffdf8] shadow-[0_28px_80px_rgba(49,39,27,0.16)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#e7c2af]">
                Brand Note
              </div>
              <h3 className="mt-3 font-[family:var(--font-pd24-display)] text-4xl leading-tight">
                Weniger Suchoberflaeche. Mehr Stadtgefuehl mit Richtung.
              </h3>
              <p className="mt-4 text-base leading-7 text-[rgba(255,253,248,0.78)]">
                Die Homepage fuehrt vom Markenversprechen in einen klaren Planner-Einstieg und zeigt
                gleichzeitig Explore, Creator und Gruppenplanung als echte Differenzierungsfaktoren.
              </p>
              <div className="mt-8 space-y-3">
                {[
                  "Warmes Editorial-Layout statt generischer Tech-Optik",
                  "Hero mit Ergebnis-Preview statt Formularuebergewicht",
                  "Eigene visuelle Familie fuer Gruppen- und Wahlzustande",
                ].map((point) => (
                  <div key={point} className="rounded-[20px] border border-[rgba(255,253,248,0.12)] bg-[rgba(255,253,248,0.06)] px-4 py-3 text-sm leading-6">
                    {point}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-[rgba(31,28,23,0.08)] bg-[rgba(255,253,248,0.94)] p-6 shadow-[0_18px_44px_rgba(49,39,27,0.08)] sm:p-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.05fr)]">
              <div>
                <SectionIntro
                  eyebrow="Planner Studio"
                  title="Plane in wenigen Schritten einen Tag, der wirklich passt"
                  body="Setze Stadt, Anlass und Stil. Perfectday24 baut daraus einen stimmigen Ablauf mit lokaler Qualitaet."
                />

                <div className="mt-8 space-y-4">
                  {[
                    ["Stadt", "Berlin"],
                    ["Anlass", "Date"],
                    ["Tagesstil", "Show-Date"],
                    ["Mit wem?", "2 Personen"],
                  ].map(([label, value]) => (
                    <button
                      key={label}
                      type="button"
                      className="flex h-[76px] w-full items-center justify-between rounded-[22px] border border-[rgba(31,28,23,0.08)] bg-white px-5 text-left shadow-[0_12px_30px_rgba(49,39,27,0.04)] transition hover:border-[rgba(31,28,23,0.16)] hover:bg-[rgba(255,253,248,0.98)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e7c2af]"
                    >
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6e6256]">
                          {label}
                        </div>
                        <div className="mt-2 text-lg font-medium text-[#1f1c17]">{value}</div>
                      </div>
                      <span className="text-lg text-[#6e6256]">+</span>
                    </button>
                  ))}
                </div>

                <div className="mt-6">
                  <PrimaryButton href="/">Plan starten</PrimaryButton>
                  <p className="mt-3 text-sm leading-6 text-[#6e6256]">
                    Detaillierte Einstellungen folgen im Planner.
                  </p>
                </div>
              </div>

              <div className="rounded-[28px] border border-[rgba(31,28,23,0.08)] bg-[linear-gradient(180deg,rgba(245,241,232,0.96),rgba(255,253,248,0.96))] p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6e6256]">
                      Preview
                    </div>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#1f1c17]">
                      So koennte euer Tag aussehen
                    </h3>
                  </div>
                  <span className="rounded-full border border-[rgba(114,134,116,0.22)] bg-[rgba(220,229,218,0.7)] px-3 py-1.5 text-xs font-medium text-[#506351]">
                    Passend zur Gruppe
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  {plannerStops.slice(0, 3).map((stop) => (
                    <div key={stop.time} className="rounded-[22px] border border-[rgba(31,28,23,0.08)] bg-white px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-[#b85c38]">{stop.time}</div>
                        <div className="text-sm text-[#6e6256]">ca. 12 Min Weg</div>
                      </div>
                      <div className="mt-2 text-base font-medium text-[#1f1c17]">{stop.title}</div>
                      <div className="mt-1 text-sm leading-6 text-[#6e6256]">{stop.note}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-[24px] border border-[rgba(31,28,23,0.08)] bg-[rgba(255,253,248,0.84)] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6e6256]">
                    Warum diese Variante passt
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[#6e6256]">
                    Kompaktes Routing, ein starkes Event als Hauptmoment und genug Luft zwischen den Stops,
                    damit der Abend nicht getaktet wirkt.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-[32px] border border-[rgba(31,28,23,0.08)] bg-[rgba(255,253,248,0.94)] p-7 shadow-[0_18px_44px_rgba(49,39,27,0.08)]">
              <SectionIntro
                eyebrow="Explore"
                title="Inspiration aus der Stadt, nicht nur aus dem Algorithmus"
                body="Entdecke Creator Routes, lokale Perspektiven und kuratierte Wege durch die Stadt."
              />

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {teaserRoutes.map((route, index) => (
                  <article
                    key={route.title}
                    className="overflow-hidden rounded-[28px] border border-[rgba(31,28,23,0.08)] bg-white"
                  >
                    <div
                      className={`h-44 bg-gradient-to-br ${
                        index === 0
                          ? "from-[rgba(184,92,56,0.24)] via-[rgba(255,253,248,0.76)] to-[rgba(114,134,116,0.18)]"
                          : "from-[rgba(114,134,116,0.22)] via-[rgba(255,253,248,0.8)] to-[rgba(184,92,56,0.12)]"
                      }`}
                    />
                    <div className="p-5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6e6256]">
                        {route.city}
                      </div>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight text-[#1f1c17]">
                        {route.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[#6e6256]">{route.meta}</p>
                      <Link href="/explore" className="mt-5 inline-flex text-sm font-medium text-[#1f1c17] underline underline-offset-4">
                        Route ansehen
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="rounded-[32px] border border-[rgba(31,28,23,0.08)] bg-[#fffdf8] p-6 shadow-[0_18px_44px_rgba(49,39,27,0.08)]">
              <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(230,220,207,0.72),rgba(255,253,248,0.96))] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6e6256]">
                  Creator der Woche
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[#1f1c17] text-lg font-semibold text-[#fffdf8]">
                    AM
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-[#1f1c17]">Anna Meier</div>
                    <div className="text-sm text-[#6e6256]">Kultur, Weinbars, spaete Wege</div>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-[#6e6256]">
                  <div className="rounded-[20px] border border-[rgba(31,28,23,0.08)] bg-white px-3 py-3">
                    <div className="font-semibold text-[#1f1c17]">12</div>
                    <div>Routen</div>
                  </div>
                  <div className="rounded-[20px] border border-[rgba(31,28,23,0.08)] bg-white px-3 py-3">
                    <div className="font-semibold text-[#1f1c17]">4.9</div>
                    <div>Bewertung</div>
                  </div>
                </div>
              </div>
            </aside>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-[32px] border border-[rgba(31,28,23,0.08)] bg-[rgba(255,253,248,0.92)] p-7">
              <SectionIntro
                eyebrow="Group Planning"
                title="Wenn mehrere mitreden, bleibt es trotzdem stimmig"
                body="Perfectday24 hilft nicht nur beim Planen, sondern auch beim Entscheiden. Varianten, Wahlstatus und Bestaetigung bekommen eine klare visuelle Logik."
              />

              <div className="mt-8 space-y-4">
                {[
                  ["01", "Anlass festlegen", "Date, Freunde, Familie oder Besuch bilden den Rahmen."],
                  ["02", "Varianten vergleichen", "Mehrere gute Optionen werden nachvollziehbar gegenuebergestellt."],
                  ["03", "Gemeinsame Wahl bestaetigen", "Die Gruppe erkennt schneller, welche Variante wirklich passt."],
                ].map(([step, title, body]) => (
                  <div key={step} className="grid grid-cols-[56px_1fr] gap-4 rounded-[24px] border border-[rgba(31,28,23,0.08)] bg-white px-4 py-4">
                    <div className="font-[family:var(--font-pd24-display)] text-3xl leading-none text-[#b85c38]">
                      {step}
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-[#1f1c17]">{title}</div>
                      <div className="mt-2 text-sm leading-6 text-[#6e6256]">{body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-[rgba(31,28,23,0.08)] bg-[#fffdf8] p-7 shadow-[0_18px_44px_rgba(49,39,27,0.08)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6e6256]">
                Demo
              </div>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[#1f1c17]">
                Varianten mit klarer Entscheidungslogik
              </h3>

              <div className="mt-6 space-y-4">
                <div className="rounded-[24px] border border-[rgba(114,134,116,0.24)] bg-[rgba(220,229,218,0.7)] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-[#1f1c17]">Variante A</div>
                      <div className="mt-1 text-sm text-[#506351]">Unsere Wahl</div>
                    </div>
                    <span className="rounded-full border border-[rgba(114,134,116,0.24)] bg-white px-3 py-1 text-xs font-medium text-[#506351]">
                      2 Stimmen
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#506351]">
                    Kompakt, eventstark und mit ruhigem Ausklang. Passt am besten zu beiden Vorlieben.
                  </p>
                </div>

                <div className="rounded-[24px] border border-[rgba(31,28,23,0.08)] bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-[#1f1c17]">Variante B</div>
                      <div className="mt-1 text-sm text-[#6e6256]">Alternative</div>
                    </div>
                    <span className="rounded-full border border-[rgba(160,106,44,0.24)] bg-[rgba(160,106,44,0.08)] px-3 py-1 text-xs font-medium text-[#8a5f24]">
                      Noch 1 Stimme
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#6e6256]">
                    Mehr Stops und mehr Dynamik, aber etwas dichter getaktet und damit weniger entspannt.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-[24px] border border-[rgba(95,125,103,0.2)] bg-[rgba(95,125,103,0.08)] px-4 py-4">
                <div className="text-sm font-semibold text-[#4f6856]">Bestaetigt</div>
                <div className="mt-1 text-sm leading-6 text-[#4f6856]">
                  Die Gruppe hat eine gemeinsame Wahl erreicht und kann den Plan direkt weiterverwenden.
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] bg-[#1f1c17] px-6 py-10 text-[#fffdf8] shadow-[0_28px_80px_rgba(49,39,27,0.14)] sm:px-8">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#e7c2af]">
                Start now
              </div>
              <h2 className="mt-4 font-[family:var(--font-pd24-display)] text-5xl leading-[0.98] tracking-tight sm:text-6xl">
                Plane nicht den vollsten Tag. Plane den stimmigeren.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[rgba(255,253,248,0.78)]">
                Starte mit Stadt, Anlass und Stimmung. Perfectday24 macht daraus einen Tag mit Richtung.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <PrimaryButton href="/">Jetzt Tag planen</PrimaryButton>
                <SecondaryButton href="/explore">Explore entdecken</SecondaryButton>
              </div>
            </div>
          </section>
        </main>

        <footer className="mt-14 rounded-[28px] border border-[rgba(31,28,23,0.08)] bg-[rgba(255,253,248,0.76)] px-6 py-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-lg font-semibold tracking-tight text-[#1f1c17]">Perfectday24</div>
              <div className="mt-2 text-sm text-[#6e6256]">Curated city planning for better days.</div>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#6e6256]">
              <Link href="/">Planner</Link>
              <Link href="/explore">Explore</Link>
              <Link href="/routes">Routes</Link>
              <Link href="/profile">Profil</Link>
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
