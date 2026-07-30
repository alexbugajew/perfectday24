import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import PartnerMarketingCta from "@/components/partner/PartnerMarketingCta";
import PartnerRoiCalculator from "@/components/partner/PartnerRoiCalculator";

const partnerOg = "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&h=630&fit=crop&auto=format&q=80";

export const metadata: Metadata = {
  title: "Partner werden | PerfectDay24 — Sichtbarkeit für Hotels, Locations & Erlebnisse",
  description: "Werde Partner auf PerfectDay24 und erscheine dort, wo Nutzer aktiv planen: Tagesrouten, Roadtrips, Events und Explore. Kostenlos starten, sofort sichtbar.",
  openGraph: {
    title: "Partner werden | PerfectDay24",
    description: "Zeige dein Angebot Nutzern, die gerade aktiv einen perfekten Tag, Roadtrip oder Event planen. Alle 33 deutschen Großstädte abgedeckt.",
    type: "website",
    locale: "de_DE",
    images: [{ url: partnerOg, width: 1200, height: 630, alt: "Restaurant-Atmosphaere — PerfectDay24 Partner" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Partner werden | PerfectDay24",
    description: "Zeige dein Angebot dort, wo Nutzer aktiv planen und buchen. Kostenlos starten.",
    images: [partnerOg],
  },
};

const partnerTypes = [
  {
    emoji: "🏨",
    title: "Hotels & Unterkünfte",
    copy: "Direkt dort sichtbar sein, wo Roadtrips, Wochenenden und Städte-Trips geplant werden.",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=320&fit=crop&auto=format&q=80",
    imageAlt: "Hotelzimmer mit warmer Atmosphäre",
  },
  {
    emoji: "🍽️",
    title: "Restaurants & Bars",
    copy: "In Tagesrouten, Date-Night-Planungen und Gruppenanlässen erscheinen.",
    image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=320&fit=crop&auto=format&q=80",
    imageAlt: "Restaurant-Innenraum mit Gästen",
  },
  {
    emoji: "🏛️",
    title: "Event-Locations",
    copy: "Anfragen, Angebote und Buchungen direkt aus dem Eventflow erhalten.",
    image: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=600&h=320&fit=crop&auto=format&q=80",
    imageAlt: "Eventsaal eingedeckt für Feier",
  },
  {
    emoji: "🎯",
    title: "Erlebnisse & Touren",
    copy: "Als fester Stop in Routen, Explore und Roadtrip-Etappen positioniert werden.",
    image: "https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=600&h=320&fit=crop&auto=format&q=80",
    imageAlt: "Stadtführung mit Gruppe vor Sehenswürdigkeit",
  },
  {
    emoji: "🎵",
    title: "Dienstleister",
    copy: "Fotografie, Musik, Deko oder Transport direkt im Anfrage- und Buchungsprozess anbieten.",
    image: "https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf?w=600&h=320&fit=crop&auto=format&q=80",
    imageAlt: "DJ am Mischpult bei Event",
  },
  {
    emoji: "🏙️",
    title: "Stadtmarketing",
    copy: "Kuratierten Content, saisonale Highlights und Themenrouten sichtbar machen.",
    image: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=600&h=320&fit=crop&auto=format&q=80",
    imageAlt: "Stadtszene am Abend mit Beleuchtung",
  },
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
    cta: "Basic wählen",
    tier: "partner_basic",
    featured: true,
    features: ["Alles aus Free", "Featured-Platzierung", "Analytics-Dashboard", "Prioritäts-Matching"],
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

const partnerPortalModules = [
  {
    title: "Profil & Standorte",
    copy: "Mehrere Standorte, Kategorien, Beschreibungen, Öffnungszeiten und CTA-Links an einem Ort pflegen.",
  },
  {
    title: "Medien & Covers",
    copy: "Eigene Bilder hochladen, Covers setzen und freigegebene Community-Fotos für Sichtbarkeit nutzen.",
  },
  {
    title: "Pakete & Preise",
    copy: "Event-Pakete, Angebotsbausteine und Preislogik für Anfrage und Buchung hinterlegen.",
  },
  {
    title: "Kampagnen & Links",
    copy: "Featured-Platzierungen, Affiliate-Ziele und saisonale Kampagnen selbst steuern.",
  },
];

const statusFlow = [
  { label: "Draft", copy: "Inhalt vorbereitet, noch nicht live." },
  { label: "In Review", copy: "Qualität, Rechte und Darstellung werden geprüft." },
  { label: "Published", copy: "Im Produkt sichtbar und klickbar." },
  { label: "Featured", copy: "Zusaetzliche Distribution in kuratierten Flächen." },
];

export default function PartnerLandingPage() {
  return (
    <main className="pd24-page-standard space-y-6 pb-20 pt-6">
      <section className="overflow-hidden rounded-[var(--radius-hero)] border border-[var(--line-subtle)] bg-[linear-gradient(135deg,var(--bg-canvas-warm),#eef4f7)] px-6 py-8 shadow-[var(--shadow-large)] sm:px-8 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-center">
          <div>
            <div className="pd24-kicker-warm">Partner werden</div>
            <h1 className="mt-4 text-[2.6rem] font-semibold leading-[0.94] tracking-tight text-[var(--text-strong)] sm:text-6xl">
              Gewinne Gäste, Buchungen und Sichtbarkeit über PerfectDay24
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--text-muted-warm)]">
              Präsentiere deine Location, Erlebnisse, Hotels, Routen oder Event-Services dort, wo Nutzer bereits ihren perfekten Tag planen.
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

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { label: "Portal", href: "#portal" },
                { label: "Pakete", href: "#pakete" },
                { label: "Trust", href: "#trust" },
                { label: "FAQ", href: "#faq" },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="inline-flex min-h-10 items-center rounded-full border border-[var(--line-subtle)] bg-white/82 px-4 text-sm font-medium text-[var(--text-muted-warm)] transition hover:border-[var(--text-strong)] hover:text-[var(--text-strong)]"
                >
                  {item.label}
                </a>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap gap-2">
              {["Sichtbar in Explore", "Anfragen aus dem Event-Planer", "Affiliate-Links & Buchungswege", "Content für Routen und Roadtrips"].map((item) => (
                <span key={item} className="rounded-full border border-[var(--line-subtle)] bg-white/82 px-4 py-2 text-sm text-[var(--text-muted-warm)]">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[28px] border border-[rgba(23,23,23,0.06)] shadow-[var(--shadow-large)]">
            <div className="relative h-[420px] w-full">
              <Image
                src="https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=900&h=860&fit=crop&auto=format&q=80"
                alt="Restaurant-Atmosphäre mit Tischen, Lichtern und Gästen — wo PerfectDay24 Partner sichtbar werden"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 480px"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/85 via-[#0f172a]/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">Warum das konvertiert</div>
                <div className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                  Dein Angebot erscheint genau im Entscheidungsfenster des Nutzers.
                </div>
                <div className="mt-2 max-w-sm text-sm leading-6 text-white/82">
                  Statt nur gelistet zu sein, bist du Teil von Tagesrouten, Roadtrips und buchbaren Event-Setups.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Explore", "Eventflow", "Roadtrip", "Analytics"].map((surface) => (
                    <span
                      key={surface}
                      className="rounded-full border border-white/25 bg-white/12 px-3 py-1 text-xs font-medium text-white backdrop-blur"
                    >
                      {surface}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {partnerTypes.map((item) => (
          <article key={item.title} className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-white shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-large)]">
            <div className="relative h-40 w-full overflow-hidden">
              <Image
                src={item.image}
                alt={item.imageAlt}
                fill
                className="object-cover transition-transform duration-500 hover:scale-[1.04]"
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
              <div className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-white/30 bg-white/90 text-xl backdrop-blur">
                {item.emoji}
              </div>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <div className="text-lg font-semibold text-[var(--text-strong)]">{item.title}</div>
              <p className="mt-2 flex-1 text-sm leading-7 text-[var(--text-muted)]">{item.copy}</p>
            </div>
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
              <div key={surface} className="rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
                {surface}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
          <div className="pd24-kicker-warm">Mehr Wirkung</div>
          <div className="mt-3 space-y-4">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-white px-4 py-4">
                <div className="text-lg font-semibold text-[var(--text-strong)]">{benefit.title}</div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{benefit.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="portal" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-[28px] border border-[var(--line-subtle)] bg-white p-6 shadow-[var(--shadow-soft)]">
          <div className="pd24-kicker-warm">Self-Service-Portal</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-strong)]">
            Partner steuern ihr Angebot selbst - ohne Ticket-Pingpong
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
            Das Portal ist auf operative Selbstbedienung ausgelegt: Profil pflegen, Medien austauschen, Preise hinterlegen, Kampagnen starten und Ausspielung nachvollziehen.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {partnerPortalModules.map((item) => (
              <div key={item.title} className="rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4">
                <div className="text-base font-semibold text-[var(--text-strong)]">{item.title}</div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[rgba(196,137,79,0.24)] bg-[linear-gradient(180deg,rgba(255,249,241,0.9),#fff)] p-6 shadow-[var(--shadow-soft)]">
          <div className="pd24-kicker-warm">Statuslogik</div>
          <div className="mt-4 space-y-3">
            {statusFlow.map((item, index) => (
              <div key={item.label} className="flex items-start gap-3 rounded-[var(--radius-card-sm)] border border-[rgba(196,137,79,0.18)] bg-white px-4 py-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--text-strong)] text-xs font-semibold text-white">
                  {index + 1}
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--text-strong)]">{item.label}</div>
                  <div className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{item.copy}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-4 text-sm leading-6 text-[var(--text-muted)]">
            So bleibt Qualität kontrolliert, während Partner Inhalte, Preise und Kampagnen trotzdem schnell selbst aktualisieren können.
          </div>
        </div>
      </section>

      <PartnerRoiCalculator />

      <section id="pakete" className="rounded-[var(--radius-hero)] border border-[var(--line-subtle)] bg-white p-6 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="pd24-kicker-warm">Pakete</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-strong)]">Wähle das Modell, das zu deiner Reichweite passt</h2>
          </div>
          <Link href="/partner/onboarding" className="text-sm font-medium text-[var(--text-strong)] underline underline-offset-4">
            Direkt ins Onboarding
          </Link>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-4">
          {packageCards.map((card) => (
            <article
              key={card.name}
              className={`rounded-[var(--radius-card)] border p-5 shadow-sm ${
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
              <div key={step} className="flex items-start gap-4 rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--text-strong)] text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <div className="text-sm leading-7 text-[var(--text-muted)]">{step}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--line-subtle)] bg-[linear-gradient(180deg,var(--bg-surface-warm),#f6f1ea)] p-6 shadow-[var(--shadow-soft)]">
          <div className="pd24-kicker-warm">Medien & Vertrauen</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-strong)]">Starke Bilder verkaufen besser als reine Einträge</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
            Partner laden eigene Bilder hoch, Creator und Nutzer können später Inhalte ergänzen und freigegebene Fotos steigern Klickrate und Vertrauen entlang des gesamten Flows.
          </p>
          <div className="mt-5 space-y-3">
            {[
              "Review-Workflow und Statusanzeige für neue Assets",
              "Verifizierte Profile mit klarer Sichtbarkeitslogik",
              "Kontrollierte Cover-Auswahl statt zufälliger Bilder",
            ].map((item) => (
              <div key={item} className="rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-white px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
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

      {/* T7 — Proof & Zahlen */}
      <section className="rounded-[var(--radius-hero)] border border-[var(--line-subtle)] bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <div className="pd24-kicker-warm">Zahlen & Reichweite</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-strong)]">
          Was du konkret bekommst
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { value: "33", unit: "Städte", copy: "Alle deutschen Großstädte abgedeckt — dein Angebot erscheint stadtspezifisch." },
            { value: "5+", unit: "Planungsmodi", copy: "Tagesplanung, Roadtrip, Events, Explore und Routen — dein Profil ist in allen sichtbar." },
            { value: "100%", unit: "Kontext-Targeting", copy: "Nutzer kommen mit konkretem Anlass, Datum und Budgetrahmen — keine Streuverluste." },
            { value: "0 EUR", unit: "zum Start", copy: "Kostenlos einsteigen, Profil anlegen und erste Anfragen empfangen." },
          ].map((item) => (
            <div key={item.unit} className="rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-5">
              <div className="text-3xl font-semibold text-[var(--text-strong)]">{item.value}</div>
              <div className="text-sm font-semibold text-[var(--brand-warm)]">{item.unit}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* T8 — Trust-Layer: Einwände entkräften */}
      <section id="trust" className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[28px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-soft)]">
          <div id="faq" className="pd24-kicker-warm">Häufige Fragen</div>
          <div className="mt-4 space-y-3">
            {[
              { q: "Wie groß ist die Reichweite?", a: "PerfectDay24 deckt alle 33 deutschen Großstädte ab. Dein Profil erscheint kontextuell — dort, wo Nutzer aktiv nach Empfehlungen für deinen Standort suchen." },
              { q: "Wie viel Aufwand ist das?", a: "Profil anlegen dauert unter 15 Minuten. Danach läuft die Sichtbarkeit automatisch — du erhältst Anfragen, ohne aktiv Kampagnen schalten zu müssen." },
              { q: "Wie seriös ist die Plattform?", a: "Alle Partner durchlaufen einen Freigabeprozess. Dein Profil wird nur verifiziert und sichtbar geschaltet, wenn Qualitätsstandards erfüllt sind." },
              { q: "Wann lohnt sich ein bezahltes Paket?", a: "Sobald du Featured-Platzierungen, Analytics oder Prioritäts-Matching nutzen möchtest. Free ist dauerhaft kostenlos und kann jederzeit upgraden." },
            ].map((item) => (
              <div key={item.q} className="rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-white px-4 py-4">
                <div className="text-sm font-semibold text-[var(--text-strong)]">{item.q}</div>
                <p className="mt-1.5 text-sm leading-6 text-[var(--text-muted)]">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-[28px] border border-[rgba(196,137,79,0.24)] bg-[linear-gradient(135deg,rgba(255,249,241,0.9),#fff)] p-6 shadow-[var(--shadow-soft)]">
            <div className="pd24-kicker-warm">So sieht es im Produkt aus</div>
            <h3 className="mt-3 text-xl font-semibold text-[var(--text-strong)]">Dein Profil im Explore-Kontext</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              Partner-Profile erscheinen als kuratierte Karten in Explore, als Stop-Empfehlungen in Routen und als Angebote im Event-Buchungsflow — immer mit deinen Bildern, Preisen und Direktlinks.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {["Explore-Karte mit Cover und CTA", "Stop-Empfehlung in Routen", "Angebotsblock im Event-Flow", "Hotelbuchung in Roadtrip-Etappen"].map((item) => (
                <div key={item} className="rounded-[var(--radius-control)] border border-[rgba(196,137,79,0.2)] bg-white px-3 py-2.5 text-xs leading-5 text-[var(--text-muted)]">
                  ✓ {item}
                </div>
              ))}
            </div>
            <div className="mt-5">
              <PartnerMarketingCta
                href="/partner/dashboard"
                label="Demo-Profil öffnen →"
                variant="secondary"
                surface="partner_landing_trust"
                metadata={{ cta_type: "demo_profile" }}
              />
            </div>
          </div>

          <div className="rounded-[28px] border border-[var(--line-subtle)] bg-[linear-gradient(180deg,#0f172a,#1f2937)] p-6 text-white shadow-[var(--shadow-soft)]">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Direktkontakt</div>
            <h3 className="mt-3 text-xl font-semibold text-white">Fragen vor dem Start?</h3>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Unser Team beantwortet Fragen zu Paketen, Sichtbarkeit und Integration — per E-Mail oder Demo-Gespräch.
            </p>
            <div className="mt-5">
              <PartnerMarketingCta
                href="mailto:hello@perfectday24.de?subject=PerfectDay24%20Partner-Demo"
                label="Demo anfragen"
                surface="partner_landing_trust"
                metadata={{ cta_type: "demo_email" }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--line-subtle)] bg-white p-6 shadow-[var(--shadow-soft)]">
        <div className="pd24-kicker-warm">Portal-Nutzen</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { value: "1 Portal", copy: "Profil, Medien, Pakete und Kampagnen ohne Tool-Wechsel." },
            { value: "33 Städte", copy: "Ausspielung passend zu Stadt, Anlass und Planungsoberfläche." },
            { value: "3 Kernflächen", copy: "Explore, Route/Roadtrip und Event-Buchungsflow." },
            { value: "0 EUR Start", copy: "Mit Free beginnen und später auf Basic oder Pro erweitern." },
          ].map((item) => (
            <div key={item.value} className="rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-5">
              <div className="text-2xl font-semibold tracking-tight text-[var(--text-strong)]">{item.value}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[var(--radius-hero)] bg-[var(--text-strong)] px-6 py-10 text-[var(--bg-surface-warm)] shadow-[var(--shadow-large)] sm:px-8">
        <div className="max-w-3xl">
          <div className="pd24-kicker-warm text-white/60">Jetzt starten</div>
          <h2 className="mt-3 text-[2.4rem] font-semibold leading-[0.96] tracking-tight sm:text-5xl">
            Werde dort sichtbar, wo perfekte Tage geplant werden
          </h2>
          <p className="mt-4 text-lg leading-8 text-white/76">
            Starte kostenlos, hinterlege Bilder und Leistungen — und sei von Tag 1 in Explore, Events und Roadtrips sichtbar.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <PartnerMarketingCta href="/partner/onboarding" label="Kostenlos starten" surface="partner_landing_footer" metadata={{ cta_type: "start" }} />
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

      <div className="sticky bottom-24 z-20 sm:hidden">
        <div className="rounded-[var(--radius-card-sm)] border border-[rgba(196,137,79,0.28)] bg-white/96 p-3 shadow-[0_16px_40px_rgba(15,23,42,0.16)] backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="pd24-meta">Partner-Portal</div>
              <div className="truncate text-sm font-semibold text-[var(--text-strong)]">Profil anlegen und direkt sichtbar werden</div>
            </div>
            <PartnerMarketingCta
              href="/partner/onboarding"
              label="Starten"
              surface="partner_landing_mobile_sticky"
              metadata={{ cta_type: "sticky_mobile" }}
              className="shrink-0 px-4 py-2"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
