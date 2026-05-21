"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MainNav() {
  const pathname = usePathname();

  const hideOnMarketingPages =
    pathname === "/" ||
    pathname.startsWith("/homepage-concept");

  if (hideOnMarketingPages) return null;

  const isRunExperience =
    pathname === "/run" ||
    (pathname.startsWith("/routes/") && pathname.endsWith("/run"));

  const isActive = (path: string) =>
    path === "/" ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);

  const linkClass = (path: string) =>
    `inline-flex shrink-0 items-center justify-center rounded-full font-medium transition ${
      isRunExperience ? "min-h-10 px-3 py-1.5 text-sm" : "min-h-11 px-3 py-2 text-sm sm:min-h-10"
    } ${
      isActive(path)
        ? "bg-[var(--text-strong)] text-white shadow-sm"
        : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-strong)]"
    }`;

  return (
    <nav
      aria-label="Hauptnavigation"
      className="sticky top-0 z-[1200] w-full max-w-full overflow-x-clip border-b border-[var(--line-subtle)] bg-[rgba(248,250,252,0.9)] backdrop-blur-xl"
    >
      <div
        className={`mx-auto flex min-w-0 max-w-7xl flex-col px-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6 sm:py-4 lg:px-8 ${
          isRunExperience ? "gap-2 py-2" : "gap-3 py-3"
        }`}
      >
        {/* Logo */}
        <Link
          href="/"
          className={`${isRunExperience ? "hidden sm:flex" : "flex"} min-h-11 min-w-0 items-center gap-3`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--text-strong)] text-sm font-semibold text-white shadow-sm sm:h-10 sm:w-10">
            PD
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold tracking-tight text-[var(--text-strong)]">
              PerfectDay24
            </span>
            <span className="block truncate text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] sm:text-[11px] sm:tracking-[0.24em]">
              Refined City Planning
            </span>
          </span>
        </Link>

        {/* Hauptnavigation */}
        <div
          className={`pd24-scrollbar-none hidden min-w-0 w-full max-w-full gap-1 overflow-x-auto overscroll-x-contain rounded-full border border-[var(--line-subtle)] bg-[rgba(255,255,255,0.92)] px-1.5 py-1.5 sm:mx-0 sm:flex sm:w-auto sm:flex-wrap sm:gap-2 sm:rounded-[24px] sm:px-2 sm:py-2 ${
            isRunExperience ? "shadow-sm" : "shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
          }`}
        >
          <Link href="/planner"  className={linkClass("/planner")}>Planen</Link>
          <Link href="/explore"  className={linkClass("/explore")}>Entdecken</Link>
          <Link href="/saved"    className={linkClass("/saved")}>Meine Pläne</Link>
        </div>

        {/* Profil-Icon + Rechtliches */}
        <div className="hidden items-center gap-3 sm:flex">
          <Link
            href="/profile"
            aria-label="Profil"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${
              isActive("/profile")
                ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white shadow-sm"
                : "border-[var(--line-subtle)] bg-white text-[var(--text-muted)] hover:border-[rgba(23,23,23,0.25)] hover:text-[var(--text-strong)]"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </Link>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
            <Link href="/impressum"   className="transition hover:text-[var(--text-strong)]">Impressum</Link>
            <Link href="/datenschutz" className="transition hover:text-[var(--text-strong)]">Datenschutz</Link>
            <Link href="/agb"         className="transition hover:text-[var(--text-strong)]">AGB</Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
