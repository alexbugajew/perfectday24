"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function MainNav() {
  const pathname = usePathname();
  const [groupUnreadCount, setGroupUnreadCount] = useState(0);

  const hideOnMarketingPages =
    pathname === "/" ||
    pathname.startsWith("/homepage-concept");

  useEffect(() => {
    if (hideOnMarketingPages) {
      return;
    }

    let active = true;

    async function refreshUnreadCount() {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id ?? null;
      if (!userId || !active) {
        if (active) setGroupUnreadCount(0);
        return;
      }

      const { data: unreadRows, error } = await supabase.rpc("group_chat_unread_overview", {
        p_user_id: userId,
      });

      if (error || !active) return;
      const total = ((unreadRows ?? []) as Array<{ unread_count?: number | null }>).reduce(
        (sum, row) => sum + Math.max(0, row.unread_count ?? 0),
        0
      );
      setGroupUnreadCount(total);
    }

    void refreshUnreadCount();

    const channel = supabase
      .channel("main-nav-group-unread")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_plan_group_chat_messages",
        },
        async () => {
          await refreshUnreadCount();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_plan_group_chat_members",
        },
        async () => {
          await refreshUnreadCount();
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [hideOnMarketingPages]);

  if (hideOnMarketingPages) {
    return null;
  }

  const isActive = (path: string) =>
    path === "/"
      ? pathname === path
      : pathname === path || pathname.startsWith(`${path}/`);
  const isRunExperience = pathname === "/run" || (pathname.startsWith("/routes/") && pathname.endsWith("/run"));

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
      className="sticky top-0 z-[1200] border-b border-[var(--line-subtle)] bg-[rgba(248,250,252,0.9)] backdrop-blur-xl"
    >
      <div
        className={`mx-auto flex max-w-7xl flex-col px-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6 sm:py-4 lg:px-8 ${
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
            <span className="block truncate font-semibold tracking-tight text-[var(--text-strong)]">PerfectDay24</span>
            <span className="block truncate text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] sm:text-[11px] sm:tracking-[0.24em]">
              Refined City Planning
            </span>
          </span>
        </Link>

        {/* Navigation */}
        <div
          className={`pd24-scrollbar-none -mx-1 flex w-full max-w-full gap-1 overflow-x-auto overscroll-x-contain rounded-full border border-[var(--line-subtle)] bg-[rgba(255,255,255,0.92)] px-1.5 py-1.5 sm:mx-0 sm:w-auto sm:flex-wrap sm:gap-2 sm:rounded-[24px] sm:px-2 sm:py-2 ${
            isRunExperience ? "shadow-sm" : "shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
          }`}
        >

          <Link href="/planner" className={linkClass("/planner")}>
            Planner
          </Link>

          <Link href="/explore" className={linkClass("/explore")}>
            Explore
          </Link>

          <Link href="/routes" className={linkClass("/routes")}>
            <span className="sm:hidden">Route</span>
            <span className="hidden sm:inline">Create Route</span>
          </Link>

          <Link href="/profile" className={linkClass("/profile")}>
            Profil
          </Link>

          <Link href="/chat" className={`${linkClass("/chat")} relative`}>
            Chat
            {groupUnreadCount > 0 ? (
              <span className="ml-2 rounded-full bg-[var(--brand-accent)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {groupUnreadCount}
              </span>
            ) : null}
          </Link>

          <Link href="/invite" className={linkClass("/invite")}>
            Gruppe
          </Link>

        </div>

        <div className="hidden flex-wrap items-center gap-3 text-xs text-[var(--text-muted)] sm:flex">
          <Link
            href="/impressum"
            className="transition hover:text-[var(--text-strong)]"
          >
            Impressum
          </Link>
          <Link
            href="/datenschutz"
            className="transition hover:text-[var(--text-strong)]"
          >
            Datenschutz
          </Link>
          <Link
            href="/agb"
            className="transition hover:text-[var(--text-strong)]"
          >
            AGB
          </Link>
        </div>
      </div>
    </nav>
  );
}
