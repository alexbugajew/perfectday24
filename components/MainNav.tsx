"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import PlannerModeSwitcher from "@/components/planner/PlannerModeSwitcher";

export default function MainNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const hideOnMarketingPages =
    pathname === "/" ||
    pathname.startsWith("/homepage-concept");

  if (hideOnMarketingPages) return null;

  const isRunExperience =
    pathname === "/run" ||
    (pathname.startsWith("/routes/") && pathname.endsWith("/run"));

  const isPartnerSurface =
    pathname === "/partner" ||
    pathname.startsWith("/partner/") ||
    pathname === "/business/dashboard" ||
    pathname.startsWith("/business/");

  const showModeSwitcher =
    !isRunExperience &&
    (pathname === "/planner" || pathname.startsWith("/planner/") ||
     pathname === "/roadtrip" || pathname.startsWith("/roadtrip/") ||
     pathname === "/events" || pathname.startsWith("/events/") ||
     pathname === "/explore" || pathname.startsWith("/explore/"));

  const isActive = (path: string) => {
    if (path === "/") return pathname === path;
    // /planner is also active when on /roadtrip (same planning-mode group)
    if (path === "/planner") {
      return pathname === "/planner" || pathname.startsWith("/planner/") ||
        pathname === "/roadtrip" || pathname.startsWith("/roadtrip/");
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  };

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

        {/* Hauptnavigation — Desktop */}
        <div
          className={`pd24-scrollbar-none hidden min-w-0 w-full max-w-full gap-1 overflow-x-auto overscroll-x-contain rounded-full border border-[var(--line-subtle)] bg-[rgba(255,255,255,0.92)] px-1.5 py-1.5 sm:mx-0 sm:flex sm:w-auto sm:flex-wrap sm:gap-2 sm:rounded-[var(--radius-card)] sm:px-2 sm:py-2 ${
            isRunExperience ? "shadow-sm" : "shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
          }`}
        >
          <Link href="/planner"  className={linkClass("/planner")}>Planen</Link>
          <Link href="/explore"  className={linkClass("/explore")}>Entdecken</Link>
          <Link href="/events"   className={linkClass("/events")}>Events</Link>
          <Link href="/saved"    className={linkClass("/saved")}>Meine Pläne</Link>
        </div>

        {/* Mobile: Hamburger-Button */}
        <button
          type="button"
          aria-label={mobileOpen ? "Menü schließen" : "Menü öffnen"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-white text-[var(--text-muted)] transition hover:text-[var(--text-strong)] sm:hidden"
        >
          {mobileOpen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" className="h-5 w-5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" className="h-5 w-5">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>

        {/* Profil-Icon — Desktop */}
        <div className="hidden items-center gap-3 sm:flex">
          <Link
            href={isPartnerSurface ? "/partner/dashboard" : "/partner"}
            className={`inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-medium transition ${
              isPartnerSurface
                ? "border border-[rgba(196,137,79,0.3)] bg-[rgba(255,249,241,0.92)] text-[var(--text-strong)] hover:bg-white"
                : "border border-[rgba(196,137,79,0.24)] bg-[rgba(255,249,241,0.84)] text-[var(--brand-warm)] hover:border-[rgba(196,137,79,0.38)] hover:bg-white"
            }`}
          >
            {isPartnerSurface ? "Partner-Dashboard" : "Partner werden"}
          </Link>
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
        </div>
      </div>

      {/* Mobile-Menü Dropdown */}
      {mobileOpen && (
        <div className="border-t border-[var(--line-subtle)] bg-[rgba(248,250,252,0.98)] px-4 py-3 sm:hidden">
          <nav className="flex flex-col gap-1">
            <Link href="/planner"  onClick={() => setMobileOpen(false)} className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${isActive("/planner") ? "bg-[var(--text-strong)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-strong)]"}`}>Planen</Link>
            <Link href="/explore"  onClick={() => setMobileOpen(false)} className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${isActive("/explore") ? "bg-[var(--text-strong)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-strong)]"}`}>Entdecken</Link>
            <Link href="/events"   onClick={() => setMobileOpen(false)} className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${isActive("/events") ? "bg-[var(--text-strong)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-strong)]"}`}>Events</Link>
            <Link href="/saved"    onClick={() => setMobileOpen(false)} className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${isActive("/saved") ? "bg-[var(--text-strong)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-strong)]"}`}>Meine Pläne</Link>
            <Link href="/profile"  onClick={() => setMobileOpen(false)} className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${isActive("/profile") ? "bg-[var(--text-strong)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-strong)]"}`}>Profil</Link>
            <div className="my-1 border-t border-[var(--line-subtle)]" />
            <Link
              href={isPartnerSurface ? "/partner/dashboard" : "/partner"}
              onClick={() => setMobileOpen(false)}
              className="rounded-2xl border border-[rgba(196,137,79,0.28)] bg-[rgba(255,249,241,0.92)] px-4 py-3 text-sm font-medium text-[var(--brand-warm)] transition hover:bg-white"
            >
              {isPartnerSurface ? "Partner-Dashboard" : "Partner werden"}
            </Link>
          </nav>
        </div>
      )}

      {/* Mode-Switcher sub-nav — consistent position across Planner / Roadtrip / Events / Explore */}
      {showModeSwitcher && (
        <div className="border-t border-[var(--line-subtle)] bg-[rgba(248,250,252,0.95)] px-4 py-2 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <PlannerModeSwitcher />
          </div>
        </div>
      )}
    </nav>
  );
}
