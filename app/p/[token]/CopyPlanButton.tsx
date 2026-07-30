"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { trackMonetizationEvent } from "@/lib/monetization/client";

type CopyablePlan = {
  title: string | null;
  filters: any;
  radius_km: number;
  effective_radius_km: number | null;
  sort_mode: string;
  active_level: string | null;
  slots: any;
  ai_description?: string | null;
};

export default function CopyPlanButton({
  plan,
  sourcePlanId,
  citySlug,
}: {
  plan: CopyablePlan;
  sourcePlanId?: string | null;
  citySlug?: string | null;
}) {
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Stabiler Titel
  const copyTitle = useMemo(() => {
    const base = (plan.title ?? "").trim();
    return base ? `${base} (Kopie)` : "Plan (Kopie)";
  }, [plan.title]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        if (!active) return;

        // Falls kein Login existiert -> anonymous session erzeugen (damit Copy in "plans" möglich ist)
        if (!s?.session) {
          const { data: a, error: aErr } = await supabase.auth.signInAnonymously();
          if (aErr) {
            console.error("CopyPlanButton anonymous login failed:", aErr);
            setUserId(null);
            setAuthReady(true);
            return;
          }
          setUserId(a.user?.id ?? null);
          setAuthReady(true);
          return;
        }

        setUserId(s.session.user.id);
        setAuthReady(true);
      } catch (e) {
        console.error("CopyPlanButton getSession failed:", e);
        if (!active) return;
        setUserId(null);
        setAuthReady(true);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUserId(session?.user?.id ?? null);
      setAuthReady(true);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function copyPlan() {
    setMsg(null);

    if (!authReady) {
      setMsg("Auth wird vorbereitet…");
      return;
    }
    if (!userId) {
      setMsg("Kein User verfügbar – bitte Console prüfen.");
      return;
    }

    setCopying(true);
    try {
      // Sicherheits-normalisierung: slots muss array sein
      const slots = Array.isArray(plan.slots) ? plan.slots : [];

      const payload = {
        user_id: userId,
        title: copyTitle,
        filters: plan.filters ?? {},
        radius_km: typeof plan.radius_km === "number" ? plan.radius_km : 10,
        effective_radius_km:
          typeof plan.effective_radius_km === "number" ? plan.effective_radius_km : null,
        sort_mode: plan.sort_mode ?? "match",
        active_level: plan.active_level ?? null,
        slots,
        ai_description: plan.ai_description ?? null,
        share_token: null, // Kopie NICHT automatisch teilen
      };

      const { data, error } = await supabase
        .from("plans")
        .insert(payload as any)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("CopyPlanButton insert error:", error);
        setMsg("Kopieren fehlgeschlagen (DB/RLS).");
        return;
      }

      setMsg("Kopie erstellt ✅ Öffne sie auf der Startseite unter „Meine gespeicherten Pläne“.");
      void trackMonetizationEvent({
        eventType: "plan_save",
        userId,
        planId: data?.id ?? null,
        citySlug: citySlug ?? null,
        surface: "shared_plan_copy",
        metadata: {
          source: "shared_plan",
          sourcePlanId: sourcePlanId ?? null,
        },
      });
      return data?.id;
    } catch (e) {
      console.error("CopyPlanButton copy failed:", e);
      setMsg("Kopieren fehlgeschlagen.");
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={copyPlan}
        disabled={copying}
        className="pd24-btn pd24-btn-sm pd24-btn-primary"
        title="Erstellt eine Kopie dieses Plans in deinem Account (anon)."
      >
        {copying ? "Kopiere…" : "Plan übernehmen"}
      </button>

      {msg ? <div className="text-[11px] text-gray-500 max-w-[240px] text-right">{msg}</div> : null}
    </div>
  );
}
