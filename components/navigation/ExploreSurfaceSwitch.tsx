"use client";

import Link from "next/link";

export type ExploreSurfaceKey = "day" | "roadtrip" | "events";

type SurfaceDefinition = {
  key: ExploreSurfaceKey;
  href: string;
  eyebrow: string;
  label: string;
  badge: string;
  description: string;
  helper: string;
};

const SURFACES: SurfaceDefinition[] = [
  {
    key: "day",
    href: "/explore#explore-all-routes",
    eyebrow: "Tagesrouten",
    label: "Tagesplanung",
    badge: "1 Tag",
    description: "Kuratierte Tagesrouten fuer heute, morgen oder den naechsten freien Tag.",
    helper: "Direkt in Stadt-Routen, Themen und Varianten einsteigen.",
  },
  {
    key: "roadtrip",
    href: "/roadtrip/routes",
    eyebrow: "Mehrtagsreisen",
    label: "Roadtrips",
    badge: "Mehrere Tage",
    description: "Fertige Mehrstadt-Routen mit Stops, Hotels und direktem Start in deinen Roadtrip.",
    helper: "Ideal, wenn du nicht pro Stadt neu planen willst.",
  },
  {
    key: "events",
    href: "/events",
    eyebrow: "Anlaesse & Gruppen",
    label: "Events",
    badge: "Buchbar",
    description: "Hochzeiten, Geburtstage und Firmenfeiern mit Anfragen, Angeboten und Buchungsflow.",
    helper: "Wenn aus Inspiration direkt eine organisierte Buchung werden soll.",
  },
];

type ExploreSurfaceSwitchProps = {
  activeKey: ExploreSurfaceKey;
  activeTitle: string;
  activeDescription: string;
  primaryCtaHref: string;
  primaryCtaLabel: string;
  secondaryCtaHref?: string;
  secondaryCtaLabel?: string;
  className?: string;
};

export default function ExploreSurfaceSwitch({
  activeKey,
  activeTitle,
  activeDescription,
  primaryCtaHref,
  primaryCtaLabel,
  secondaryCtaHref,
  secondaryCtaLabel,
  className,
}: ExploreSurfaceSwitchProps) {
  return (
    <div className={className}>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1fr)]">
        {SURFACES.map((surface) => {
          const isActive = surface.key === activeKey;
          return (
            <Link
              key={surface.key}
              href={surface.href}
              aria-current={isActive ? "page" : undefined}
              className={`group rounded-[24px] border px-4 py-4 transition sm:px-5 ${
                isActive
                  ? "border-[var(--text-strong)] bg-white shadow-[0_14px_40px_rgba(15,23,42,0.08)]"
                  : surface.key === "roadtrip"
                    ? "border-[rgba(196,137,79,0.24)] bg-[linear-gradient(135deg,rgba(196,137,79,0.06),rgba(90,118,136,0.05))] hover:border-[rgba(196,137,79,0.38)] hover:shadow-[0_12px_32px_rgba(15,23,42,0.06)]"
                    : "border-[var(--line-subtle)] bg-[rgba(255,255,255,0.72)] hover:border-[var(--line-strong)] hover:bg-white hover:shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div
                    className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
                      isActive
                        ? "text-[var(--text-muted)]"
                        : surface.key === "roadtrip"
                          ? "text-[var(--brand-warm)]"
                          : "text-[var(--text-muted)]"
                    }`}
                  >
                    {surface.eyebrow}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-[var(--text-strong)]">{surface.label}</div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    isActive
                      ? "bg-[var(--text-strong)] text-white"
                      : surface.key === "roadtrip"
                        ? "border border-[rgba(196,137,79,0.32)] bg-white text-[var(--brand-warm)]"
                        : "border border-[var(--line-subtle)] bg-white text-[var(--text-muted)]"
                  }`}
                >
                  {surface.badge}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{surface.description}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-[var(--text-muted)]">{surface.helper}</span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                    isActive
                      ? "text-[var(--text-strong)]"
                      : surface.key === "roadtrip"
                        ? "text-[var(--brand-warm)]"
                        : "text-[var(--text-strong)]"
                  }`}
                >
                  {isActive ? "Aktiv" : "Oeffnen"}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 rounded-[24px] border border-[var(--line-subtle)] bg-white/80 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Jetzt aktiv
            </div>
            <div className="mt-1 text-base font-semibold text-[var(--text-strong)]">{activeTitle}</div>
            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{activeDescription}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={primaryCtaHref}
              className="inline-flex min-h-10 items-center rounded-xl bg-[#171717] px-4 text-sm font-medium text-white transition hover:opacity-90"
            >
              {primaryCtaLabel}
            </Link>
            {secondaryCtaHref && secondaryCtaLabel ? (
              <Link
                href={secondaryCtaHref}
                className="inline-flex min-h-10 items-center rounded-xl border border-[rgba(196,137,79,0.28)] bg-white px-4 text-sm font-medium text-[var(--brand-warm)] transition hover:bg-[rgba(196,137,79,0.08)]"
              >
                {secondaryCtaLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
