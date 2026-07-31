"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import UpgradeModal from "./UpgradeModal";

// Zeigt für den eingeloggten User seinen Premium-Status auf /profile.
// Free → "PerfectDay24 Free · 3 AI-Pläne / Monat" + Upgrade-CTA
// Premium → "PerfectDay24 Premium bis DD.MM.YYYY" + "Abo verwalten"-Button

type ProfileRow = {
  is_premium: boolean | null;
  premium_until: string | null;
  stripe_subscription_id: string | null;
};

export default function PremiumStatusCard({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [usedThisMonth, setUsedThisMonth] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [{ data: p }, { count }] = await Promise.all([
        supabase
          .from("profiles")
          .select("is_premium,premium_until,stripe_subscription_id")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("attribution_events")
          .select("*", { count: "exact", head: true })
          .eq("event_type", "ai_plan_applied")
          .eq("user_id", userId)
          .gte(
            "occurred_at",
            new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
          ),
      ]);
      if (!cancelled) {
        setProfile((p as ProfileRow) ?? null);
        setUsedThisMonth(count ?? 0);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/customer-portal", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (json.url) {
        window.location.href = json.url;
        return;
      }
    } finally {
      setPortalLoading(false);
    }
  }

  const isPremium = Boolean(profile?.is_premium);
  const untilLabel = profile?.premium_until
    ? new Date(profile.premium_until).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <>
      <div
        className={`overflow-hidden rounded-[var(--radius-card)] border p-5 sm:p-6 ${
          isPremium
            ? "border-[rgba(24,140,80,0.28)] bg-[linear-gradient(160deg,rgba(230,246,236,0.72),rgba(255,253,248,0.86))]"
            : "border-[rgba(196,137,79,0.28)] bg-[linear-gradient(160deg,rgba(255,249,241,0.94),rgba(255,253,248,0.86))]"
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div
              className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${
                isPremium ? "text-[#188c50]" : "text-[var(--brand-warm-ink)]"
              }`}
            >
              {isPremium ? "PerfectDay24 Premium" : "Dein Plan"}
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-2xl">
              {loading
                ? "…"
                : isPremium
                  ? "Premium aktiv"
                  : "PerfectDay24 Free"}
            </h2>
            {loading ? null : isPremium ? (
              <p className="mt-1 text-sm text-[var(--text-muted-warm)]">
                Unlimited AI-Pläne · verlängert automatisch{untilLabel ? ` bis ${untilLabel}` : ""}
              </p>
            ) : (
              <p className="mt-1 text-sm text-[var(--text-muted-warm)]">
                {usedThisMonth} von 3 AI-Plänen diesen Monat verwendet. Upgrade für Unlimited & PDF-Export.
              </p>
            )}
          </div>

          {loading ? null : isPremium ? (
            <button
              type="button"
              onClick={() => void openPortal()}
              disabled={portalLoading || !profile?.stripe_subscription_id}
              className="inline-flex items-center justify-center rounded-2xl border border-[rgba(24,140,80,0.24)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text-strong)] transition hover:border-[#188c50] disabled:opacity-60"
            >
              {portalLoading ? "Weiterleitung…" : "Abo verwalten"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowUpgrade(true)}
              className="pd24-btn pd24-btn-sm pd24-btn-primary"
            >
              Premium starten
            </button>
          )}
        </div>
      </div>

      <UpgradeModal open={showUpgrade} used={usedThisMonth} limit={3} onClose={() => setShowUpgrade(false)} />
    </>
  );
}
