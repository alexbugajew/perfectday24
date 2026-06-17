import Link from "next/link";
import PartnerMarketingCta from "@/components/partner/PartnerMarketingCta";

const partnerTypes = [
  { title: "Hotels & Unterkuenfte", copy: "Direkt dort sichtbar sein, wo Roadtrips, Wochenenden und Staedte-Trips geplant werden." },
  { title: "Restaurants & Bars", copy: "In Tagesrouten, Date-Night-Planungen und Gruppenanlaessen erscheinen." },
  { title: "Event-Locations", copy: "Anfragen, Angebote und Buchungen direkt aus dem Eventflow erhalten." },
  { title: "Erlebnisse & Touren", copy: "Als fester Stop in Routen, Explore und Roadtrip-Etappen positioniert werden." },
  { title: "Dienstleister", copy: "Fotografie, Musik, Deko oder Transport direkt im Anfrage- und Buchungsprozess anbieten." },
  { title: "Stadtmarketing", copy: "Kuratierten Content, saisonale Highlights und Themenrouten sichtbar machen." },
];

const packageCards = [
  {
    name: "Free",
    price: "0 EUR / Monat",
    cta: "Kostenlos starten",
    tier: "organic",
    features: ["1 Standort", "Basisprofil", "Anfragen empfangen", "Einfache Galerie"],
  },
  {
    name: "Partner Basic",
    price: "49 EUR / Monat",
    cta: "Basic waehlen",
    tier: "partner_basic",
    featured: true,
    features: ["Alles aus Free", "Featured-Platzierung", "Analytics-Dashboard", "Prioritaets-Matching"],
  },
  {
    name: "Partner Pro",
    price: "149 EUR / Monat",
    cta: "Pro anfragen",
    tier: "partner_pro",
    features: ["Alles aus Basic", "Mehrere Standorte", "Kampagnen & Affiliate-Links", "Bevorzugter Review / Support"],
  },
  {
    name: "Enterprise",
    price: "Auf Anfrage",
    cta: "Sales kontaktieren",
    tier: "enterprise",
    features: ["Stadtmarketing & Multi-Location", "Sonderplatzierungen", "Kooperationen", "Individuelle Integration"],
  },
];

const productSurfaces = [
  "Explore-Karten und kuratierte Listen",
  "Route-Details und Stop-Empfehlungen",
  "Roadtrip-Etappen mit Hotels und Highlights",
  "Event-Anfragen, Angebotsvergleich und Buchung",
  "Partnerprofil mit Galerie, Leistungen und Links",
];

const benefits = [
  {
    title: "Mehr Sichtbarkeit",
    copy: "Nicht irgendwo im Verzeichnis, sondern genau dann, wenn Nutzer aktiv planen, filtern und vergleichen.",
  },
  {
    title: "Mehr qualifizierte Anfragen",
    copy: "Nutzer kommen mit konkretem Anlass, Datum, Gruppe und oft schon mit Budgetrahmen.",
  },
  {
    title: "Mehr Umsatzoptionen",
    copy: "Direktanfragen, Pakete, Affiliate-Links, Featured-Platzierungen und Kampagnen an einem Ort.",
  },
];

const workflowSteps = [
  "Profil anlegen",
  "Bilder, Leistungen und Pakete hinterlegen",
  "Freigabe erhalten",
  "In Explore, Events und Roadtrips sichtbar werden",
];

export default function PartnerLandingPage() {
  return (
    <main className="pd24-page-standard space-y-6 pb-20 pt-6">
      <section className="overflow-hidden rounded-[32px] border border-[var(--line-subtle)] bg-[linear-gradient(135deg,var(--bg-canvas-warm),#eef4f7)] px-6 py-8 shadow-[var(--shadow-large)] sm:px-8 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-center">
          <div>
            <div className="pd24-kicker-warm">Partner werden</div>
            <h1 className="mt-4 text-[2.6rem] font-semibold leading-[0.94] tracking-tight text-[var(--text-strong)] sm:text-6xl">
              Gewinne Gaeste, Buchungen und Sichtbarkeit ueber PerfectDay24
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--text-muted-warm)]">
              Praesentiere deine Location, Erlebnisse, Hotels, Routen oder Event-Services dort, wo Nutzer bereits ihren perfekten Tag planen.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <PartnerMarketingCta
                href="/partner/onboarding"
                label="Partner werden"
                surface="partner_landing_hero"
                metadata={{ cta_type: "start" }}
              />
              <PartnerMarketingCta
                href="#pakete"
                label="Pakete vergleichen"
                variant="secondary"
                surface="partner_landing_hero"
                metadata={{ cta_type: "pricing" }}
              />
              <PartnerMarketingCta
                href="mailto:hello@perfectday24.de?subject=PerfectDay24%20Partner-Demo"
                label="Demo anfragen"
                variant="secondary"
                surface="partner_landing_hero"
                metadata={{ cta_type: "demo" }}
              />
            </div>

            <div className="mt-7 flex flex-wrap gap-2">
              {["Sichtbar in Explore", "Anfragen aus dem Event-Planer", "Affiliate-Links & Buchungswege", "Content fuer Routen und Roadtrips"].map((item) => (
                <span key={item} className="rounded-full border border-[var(--line-subtle)] bg-white/82 px-4 py-2 text-sm text-[var(--text-muted-warm)]">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-[rgba(23,23,23,0.06)] bg-white/88 p-5 shadow-[var(--shadow-soft)]">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Explore</div>
                <div className="mt-2 text-base font-semibold text-[var(--text-strong)]">Karten, Covers und Empfehlungslisten</div>
              </div>
              <div className="rounded-[22px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Eventflow</div>
                <div className="mt-2 text-base font-semibold text-[var(--text-strong)]">Anfragen, Preise und Direktbuchung</div>
              </div>
              <div className="rounded-[22px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Roadtrip</div>
                <div className="mt-2 text-base font-semibold text-[var(--text-strong)]">Etappen, Hotels und Stop-Empfehlungen</div>
              </div>
              <div className="rounded-[22px] border border-[rgba(196,137,79,0.22)] bg-[rgba(255,249,241,0.88)] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Analytics</div>
                <div className="mt-2 text-base font-semibold text-[var(--text-strong)]">Klicks, Paketinteresse und Lead-Tracking</div>
              </div>
            </div>
            <div className="mt-4 rounded-[22px] border border-[var(--line-subtle)] bg-[linear-gradient(135deg,#0f172a,#1f2937)] p-4 text-white">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">Warum das konvertiert</div>
              <div className="mt-2 text-lg font-semibold">Dein Angebot erscheint genau im Entscheidungsfenster des Nutzers.</div>
              <div className="mt-2 text-sm leading-7 text-white/72">
                Statt nur gelistet zu sein, bist du Teil von Tagesrouten, Roadtrips und buchbaren Event-Setups.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {partnerTypes.map((item) => (
          <article key={item.title} className="rounded-[26px] border border-[var(--line-subtle)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <div className="text-lg font-semibold text-[var(--text-strong)]">{item.title}</div>
            <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{item.copy}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]">
        <div className="rounded-[28px] border border-[var(--line-subtle)] bg-white p-6 shadow-[var(--shadow-soft)]">
          <div className="pd24-kicker-warm">Wo erscheinst du im Produkt?</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-strong)]">Dein Angebot ist Teil echter Entscheidungen</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
            Nicht isoliert in einem Profil, sondern genau dort, wo Nutzer Orte vergleichen, Leistungen anfragen und passende Buchungswege suchen.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {productSurfaces.map((surface) => (
              <div key={surface} className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
                {surface}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
          <div className="pd24-kicker-warm">Mehr Wirkung</div>
          <div className="mt-3 space-y-4">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="rounded-[20px] border border-[var(--line-subtle)] bg-white px-4 py-4">
                <div className="text-lg font-semibold text-[var(--text-strong)]">{benefit.title}</div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{benefit.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pakete" className="rounded-[32px] border border-[var(--line-subtle)] bg-white p-6 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="pd24-kicker-warm">Pakete</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-strong)]">Waehle das Modell, das zu deiner Reichweite passt</h2>
          </div>
          <Link href="/partner/onboarding" className="text-sm font-medium text-[var(--text-strong)] underline underline-offset-4">
            Direkt ins Onboarding
          </Link>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-4">
          {packageCards.map((card) => (
            <article
              key={card.name}
              className={`rounded-[26px] border p-5 shadow-sm ${
                card.featured
                  ? "border-[rgba(196,137,79,0.32)] bg-[rgba(255,249,241,0.88)]"
                  : "border-[var(--line-subtle)] bg-[var(--bg-surface)]"
              }`}
            >
              {card.featured ? (
                <div className="inline-flex rounded-full border border-[rgba(196,137,79,0.28)] bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-strong)]">
                  Empfohlen
                </div>
              ) : null}
              <div className="mt-3 text-2xl font-semibold text-[var(--text-strong)]">{card.name}</div>
              <div className="mt-2 text-sm text-[var(--text-muted)]">{card.price}</div>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-[var(--text-muted)]">
                {card.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
              <PartnerMarketingCta
                href={card.tier === "enterprise" ? "mailto:hello@perfectday24.de?subject=PerfectDay24%20Enterprise" : `/partner/onboarding?tier=${card.tier}`}
                label={card.cta}
                surface="partner_landing_pricing"
                metadata={{ package_interest: card.tier }}
                className="mt-5 w-full"
              />
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
        <div className="rounded-[28px] border border-[var(--line-subtle)] bg-white p-6 shadow-[var(--shadow-soft)]">
          <div className="pd24-kicker-warm">So funktioniert es</div>
          <div className="mt-4 space-y-3">
            {workflowSteps.map((step, index) => (
              <div key={step} className="flex items-start gap-4 rounded-[20px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--text-strong)] text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <div className="text-sm leading-7 text-[var(--text-muted)]">{step}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line-subtle)] bg-[linear-gradient(180deg,#fffdf8,#f6f1ea)] p-6 shadow-[var(--shadow-soft)]">
          <div className="pd24-kicker-warm">Medien & Vertrauen</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-strong)]">Starke Bilder verkaufen besser als reine Eintraege</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
            Partner laden eigene Bilder hoch, Creator und Nutzer koennen spaeter Inhalte ergaenzen und freigegebene Fotos steigern Klickrate und Vertrauen entlang des gesamten Flows.
          </p>
          <div className="mt-5 space-y-3">
            {[
              "Review-Workflow und Statusanzeige fuer neue Assets",
              "Verifizierte Profile mit klarer Sichtbarkeitslogik",
              "Kontrollierte Cover-Auswahl statt zufaelliger Bilder",
            ].map((item) => (
              <div key={item} className="rounded-[20px] border border-[var(--line-subtle)] bg-white px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <PartnerMarketingCta
              href="/partner/dashboard"
              label="Beispielprofil ansehen"
              variant="secondary"
              surface="partner_landing_media"
              metadata={{ cta_type: "example_profile" }}
            />
            <PartnerMarketingCta
              href="/partner/onboarding"
              label="Partner werden"
              surface="partner_landing_media"
              metadata={{ cta_type: "start" }}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[32px] bg-[var(--text-strong)] px-6 py-10 text-[#fffdf8] shadow-[var(--shadow-large)] sm:px-8">
        <div className="max-w-3xl">
          <div className="pd24-kicker-warm text-white/60">Footer CTA</div>
          <h2 className="mt-3 text-[2.4rem] font-semibold leading-[0.96] tracking-tight sm:text-5xl">
            Werde dort sichtbar, wo perfekte Tage geplant werden
          </h2>
          <p className="mt-4 text-lg leading-8 text-white/76">
            Starte mit einem Profil, hinterlege Medien und Leistungen und nutze PerfectDay24 als Kanal fuer Sichtbarkeit, Leads und Buchungen.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <PartnerMarketingCta href="/partner/onboarding" label="Partner werden" surface="partner_landing_footer" metadata={{ cta_type: "start" }} />
            <PartnerMarketingCta
              href="mailto:hello@perfectday24.de?subject=PerfectDay24%20Sales"
              label="Sales kontaktieren"
              surface="partner_landing_footer"
              variant="secondary"
              metadata={{ cta_type: "sales" }}
              className="border-white/16 bg-white/6 text-white hover:bg-white/12"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
