"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MODES = [
  {
    href: "/planner",
    discoverHref: "/explore",
    label: "Tagesplanung",
    shortLabel: "Tag",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: "/roadtrip",
    discoverHref: "/roadtrip/routes",
    label: "Roadtrip",
    shortLabel: "Roadtrip",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0"
      >
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
        <circle cx="12" cy="9" r="2.5" />
        <path d="M5 20h14" />
      </svg>
    ),
  },
  {
    href: "/feiern",
    discoverHref: "/events",
    label: "Event planen",
    shortLabel: "Event",
    // Auf den Entdecken-Flaechen fuehrt der Tab nicht ins Planungsformular,
    // sondern in die Event-Strecke — die Beschriftung muss das mittragen.
    discoverLabel: "Events entdecken",
    discoverShortLabel: "Events",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
] as const;

export default function PlannerModeSwitcher() {
  const pathname = usePathname();

  // Im Entdecken-Kontext (Explore, Roadtrip-Routen) wechseln die Tabs zwischen
  // den Entdecken-Flächen — sonst würde z. B. "Roadtrip" mitten aus der
  // Inspiration in die leere Neuplanung springen.
  const isDiscoverySurface =
    pathname === "/explore" ||
    pathname.startsWith("/explore/") ||
    pathname === "/roadtrip/routes" ||
    pathname.startsWith("/roadtrip/routes/") ||
    ((pathname === "/events" || pathname.startsWith("/events/")) &&
      !pathname.startsWith("/events/agenda/"));

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-2xl border border-[var(--line-subtle)] bg-[rgba(23,23,23,0.04)] p-1"
      role="tablist"
      aria-label="Planungsart wählen"
    >
      {MODES.map((mode) => {
        const targetHref = isDiscoverySurface ? mode.discoverHref : mode.href;
        const label =
          isDiscoverySurface && "discoverLabel" in mode ? mode.discoverLabel : mode.label;
        const shortLabel =
          isDiscoverySurface && "discoverShortLabel" in mode
            ? mode.discoverShortLabel
            : mode.shortLabel;
        const active = isActive(targetHref);
        return (
          <Link
            key={mode.href}
            href={targetHref}
            role="tab"
            aria-selected={active}
            className={[
              "inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-all",
              active
                ? "bg-[var(--text-strong)] text-white shadow-sm"
                : "text-[var(--text-muted)] hover:bg-white hover:text-[var(--text-strong)]",
            ].join(" ")}
          >
            {mode.icon}
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{shortLabel}</span>
          </Link>
        );
      })}
    </div>
  );
}
