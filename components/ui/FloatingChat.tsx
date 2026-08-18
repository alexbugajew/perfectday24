"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function FloatingChat() {
  const pathname  = usePathname();
  const router    = useRouter();
  const [userId,      setUserId]      = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function refresh() {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id ?? null;
      if (!active) return;
      setUserId(uid);
      if (!uid) { setUnreadCount(0); return; }

      const { data: rows, error } = await supabase.rpc("group_chat_unread_overview", {
        p_user_id: uid,
      });
      if (error || !active) return;
      const total = ((rows ?? []) as Array<{ unread_count?: number | null }>).reduce(
        (sum, row) => sum + Math.max(0, row.unread_count ?? 0),
        0
      );
      if (active) setUnreadCount(total);
    }

    void refresh();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => void refresh());

    const channel = supabase
      .channel("floating-chat-unread")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "user_plan_group_chat_messages",
      }, () => void refresh())
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "user_plan_group_chat_members",
      }, () => void refresh())
      .subscribe();

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, []);

  // Nicht auf der Chat-Seite selbst anzeigen, und nur für eingeloggte Nutzer
  if (!userId || pathname === "/chat") return null;

  // Seiten mit eigener fixer Bottom-Bar (Planner-CTA, Run-Aktionsleisten):
  // FAB höher setzen, damit er die Leiste nicht überdeckt.
  const hasOwnBottomBar =
    pathname === "/planner" ||
    pathname === "/run" ||
    ((pathname.startsWith("/routes/") || pathname.startsWith("/roadtrip/routes/")) &&
      pathname.endsWith("/run"));

  // Die Event-Planungs-Seiten haben eine fixe Speichern-Leiste, die — anders als
  // die Run-Leisten — auch ab sm sichtbar ist: FAB dort auf allen Viewports höher
  // setzen, damit er den "Plan speichern"-Button nicht überdeckt.
  const hasEventPlanBottomBar = pathname.startsWith("/events/plan/");

  return (
    <button
      onClick={() => router.push("/chat")}
      aria-label="Chat öffnen"
      className={`fixed ${hasOwnBottomBar || hasEventPlanBottomBar ? "bottom-40" : "bottom-24"} right-4 z-[1200] flex h-13 w-13 items-center justify-center rounded-full bg-[var(--text-strong)] text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition hover:scale-105 hover:shadow-[0_12px_32px_rgba(0,0,0,0.36)] active:scale-95 ${hasEventPlanBottomBar ? "sm:bottom-28" : "sm:bottom-6"} sm:right-6 sm:h-14 sm:w-14`}
    >
      {/* Chat-Bubble Icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M4.804 21.644A6.707 6.707 0 0 0 6 21.75a6.721 6.721 0 0 0 3.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 0 1-.814 1.686.75.75 0 0 0 .44 1.223Z"
          clipRule="evenodd"
        />
      </svg>

      {/* Unread-Badge */}
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
