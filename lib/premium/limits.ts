// Endnutzer-Premium: Free-Tier-Limits + Premium-Status-Check
// ============================================================================
// Serverseitig. Wird von /api/generate-plan-ai vor dem OpenAI-Call gerufen.

import type { SupabaseClient } from "@supabase/supabase-js";

export const FREE_AI_PLANS_PER_MONTH = 3;

export type PremiumStatus = {
  isPremium: boolean;
  premiumUntil: string | null;
  aiPlansUsedThisMonth: number;
  aiPlansRemaining: number; // -1 = unlimited (premium)
  limitReached: boolean;
};

function firstOfCurrentMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readProfile(sb: SupabaseClient, userId: string): Promise<{ is_premium: boolean; premium_until: string | null } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("profiles")
    .select("is_premium,premium_until")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[premium/limits] readProfile:", error.message);
    return null;
  }
  return data;
}

async function countAiPlansThisMonth(sb: SupabaseClient, userId: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (sb as any)
    .from("attribution_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "ai_plan_applied")
    .eq("user_id", userId)
    .gte("occurred_at", firstOfCurrentMonthIso());
  if (error) {
    console.warn("[premium/limits] countAiPlansThisMonth:", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getUserPremiumStatus(
  sb: SupabaseClient,
  userId: string
): Promise<PremiumStatus> {
  const [profile, used] = await Promise.all([
    readProfile(sb, userId),
    countAiPlansThisMonth(sb, userId),
  ]);

  const now = Date.now();
  const untilOk = profile?.premium_until ? new Date(profile.premium_until).getTime() > now : true;
  const isPremium = Boolean(profile?.is_premium) && untilOk;

  if (isPremium) {
    return {
      isPremium: true,
      premiumUntil: profile?.premium_until ?? null,
      aiPlansUsedThisMonth: used,
      aiPlansRemaining: -1,
      limitReached: false,
    };
  }

  const remaining = Math.max(0, FREE_AI_PLANS_PER_MONTH - used);
  return {
    isPremium: false,
    premiumUntil: null,
    aiPlansUsedThisMonth: used,
    aiPlansRemaining: remaining,
    limitReached: remaining === 0,
  };
}
