"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type Feature = {
  key: string;
  label: string;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  cta: { href: string; label: string };
  image: string;
  imageAlt: string;
};

const FEATURES: Feature[] = [
  {
    key: "day",
    label: "Tag planen",
    eyebrow: "Date · Familie · Freunde · Touristen",
    title: "Ein Satz beschreibt deinen Tag. Der Autopilot baut ihn.",
    body: "Schreib was du vorhast — PerfectDay24 macht daraus Stops, Wege und Timing. Du musst nicht mehr zwischen Maps, Eventkalendern und Restaurants hin- und herspringen.",
    bullets: [
      "Echte Events als Hauptmoment",
      "Realistische Wege & Timing",
      "Stops verschieben + Zeiten cascaden",
      "Per Link direkt teilbar",
    ],
    cta: { href: "/planner", label: "Tag planen" },
    image: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=900&h=600&fit=crop&auto=format&q=80",
    imageAlt: "Stadt am Abend mit Lichtern",
  },
  {
    key: "roadtrip",
    label: "Roadtrip",
    eyebrow: "Mehrtägige Routen",
    title: "Mehrstadt-Roadtrips mit fertigen Stop-Vorschlägen.",
    body: "Verbinde mehrere Städte zu einem Trip. PerfectDay24 plant pro Etappe Hotels, Sehenswürdigkeiten und Tagesabläufe — und behält die Reihenfolge im Blick.",
    bullets: [
      "Stadt-zu-Stadt Routenplanung",
      "Hotels pro Etappe vorgeschlagen",
      "Pro Tag ein eigener Plan",
      "Kuratierte Vorlagen verfügbar",
    ],
    cta: { href: "/roadtrip", label: "Roadtrip starten" },
    image: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=900&h=600&fit=crop&auto=format&q=80",
    imageAlt: "Auto auf Landstraße",
  },
  {
    key: "event",
    label: "Event",
    eyebrow: "Für Anlässe mit Gästen",
    title: "Geburtstag, JGA, Teamday — mit Anbieter-Anfragen direkt drin.",
    body: "Statt 8 Tabs für 8 Anbieter: ein Wizard, der Anlass + Anzahl + Bedarfsliste durchgeht und passende Anbieter aus deiner Stadt vorschlägt. Anfrage per Klick.",
    bullets: [
      "Pro Anlass passende Bedarfsliste",
      "Anbieter direkt anfragen",
      "Preise im Vergleich",
      "Buchungswege & Einladungen",
    ],
    cta: { href: "/feiern", label: "Event planen" },
    image: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=900&h=600&fit=crop&auto=format&q=80",
    imageAlt: "Geburtstagsfeier mit Lichterkette",
  },
  {
    key: "explore",
    label: "Entdecken",
    eyebrow: "Inspiration vor der Planung",
    title: "Kuratierte Tagesrouten von der Redaktion und Community.",
    body: "Wenn du noch nicht weißt was du planen willst — durchstöbere fertige Routen. Ein Klick übernimmt sie in den Planner, wo du sie nach Lust anpasst.",
    bullets: [
      "Editorial-Routen mit Hauptmoment",
      "Filter nach Stadt + Anlass",
      "Direkt in den Planner übernehmen",
      "Tipp-Karten je nach Saison",
    ],
    cta: { href: "/explore", label: "Routen entdecken" },
    image: "https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=900&h=600&fit=crop&auto=format&q=80",
    imageAlt: "Freunde in der Stadt",
  },
];

export default function FeatureShowcase() {
  const [active, setActive] = useState<string>(FEATURES[0].key);
  const feature = FEATURES.find((f) => f.key === active) ?? FEATURES[0];

  return (
    <div>
      {/* Tab-Bar */}
      <div className="flex flex-wrap gap-2 sm:gap-3">
        {FEATURES.map((f) => {
          const isActive = f.key === active;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setActive(f.key)}
              className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition ${
                isActive
                  ? "bg-[var(--text-strong)] text-white shadow-sm"
                  : "border border-[var(--line-subtle)] bg-white/82 text-[var(--text-muted-warm)] hover:border-[var(--text-strong)] hover:text-[var(--text-strong)]"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="mt-6 grid gap-6 overflow-hidden rounded-[var(--radius-shell)] border border-[var(--line-subtle)] bg-[rgba(255,253,248,0.94)] shadow-[var(--shadow-soft)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="p-6 sm:p-8">
          <div className="pd24-kicker-warm">{feature.eyebrow}</div>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-3xl">
            {feature.title}
          </h3>
          <p className="mt-4 text-base leading-7 text-[var(--text-muted-warm)]">{feature.body}</p>
          <ul className="mt-5 space-y-2">
            {feature.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2 text-sm leading-6 text-[var(--text-muted-warm)]">
                <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-warm)]" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
          <Link
            href={feature.cta.href}
            className="pd24-btn pd24-btn-sm pd24-btn-primary mt-6"
          >
            {feature.cta.label} →
          </Link>
        </div>
        <div className="relative min-h-[280px] lg:min-h-[420px]">
          <Image
            src={feature.image}
            alt={feature.imageAlt}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-black/15 to-transparent" />
        </div>
      </div>
    </div>
  );
}
