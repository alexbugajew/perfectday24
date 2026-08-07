"use client";

// Clientseitiger Premium-Status für Gating-Entscheidungen (Export-Buttons etc.).
// Gleiche Logik wie lib/premium/limits.ts serverseitig: is_premium + gültiges
// premium_until; Verbrauch = ai_plan_applied-Events im laufenden Monat.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function usePremiumStatus(userId: string | null) {
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [usedThisMonth, setUsedThisMonth] = useState(0);

  useEffect(() => {
    if (!userId) {
      // Reset bei Logout — sync im Effect beabsichtigt (Projekt-Konvention).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsPremium(null);
      setUsedThisMonth(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      const monthStart = new Date(
        Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)
      ).toISOString();
      const [{ data: profile }, { count }] = await Promise.all([
        supabase
          .from("profiles")
          .select("is_premium,premium_until")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("attribution_events")
          .select("*", { count: "exact", head: true })
          .eq("event_type", "ai_plan_applied")
          .eq("user_id", userId)
          .gte("occurred_at", monthStart),
      ]);
      if (cancelled) return;
      const untilOk = profile?.premium_until
        ? new Date(profile.premium_until as string).getTime() > Date.now()
        : true;
      setIsPremium(Boolean(profile?.is_premium) && untilOk);
      setUsedThisMonth(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { isPremium, usedThisMonth };
}
