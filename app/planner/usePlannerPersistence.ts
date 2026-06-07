"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { trackMonetizationEvent } from "@/lib/monetization/client";
import type {
  ExperienceMode,
  FamilyAgeBand,
  GroupMember,
  PlannedStop,
  PlanMode,
  RouteProfile,
} from "@/lib/planner";
import {
  buildFinalPlanSavedSystemMessage,
  buildPlanGroupChatSystemMessage,
  formatSupabaseError,
  generateShareToken,
} from "./helpers";
import type {
  LeadingVariantSummary,
  PlanEditSuggestionSummary,
  PlannerSaveMode,
  PlanVariant,
  SavedPlanRow,
  SharedPlanChoiceReactionSummary,
  StartPoint,
} from "./types";

type PostPlannerGroupChatSystemMessageParams = {
  chatId: string;
  body: string;
  userId: string | null;
};

export async function postPlannerGroupChatSystemMessage({
  chatId,
  body,
  userId,
}: PostPlannerGroupChatSystemMessageParams) {
  const trimmed = body.trim();
  if (!trimmed || !userId) return;

  const insertResp = await supabase
    .from("user_plan_group_chat_messages")
    .insert({
      chat_id: chatId,
      sender_user_id: userId,
      message_type: "system",
      body: trimmed,
    })
    .select("created_at")
    .maybeSingle();

  if (insertResp.error) {
    console.error("Plan group chat system post error:", {
      raw: insertResp.error,
      formatted: formatSupabaseError(insertResp.error),
    });
    return;
  }

  if (insertResp.data?.created_at) {
    await supabase
      .from("user_plan_group_chats")
      .update({
        last_message_at: insertResp.data.created_at,
        updated_at: insertResp.data.created_at,
      })
      .eq("id", chatId);
  }
}

type UsePlannerPersistenceParams = {
  authReady: boolean;
  userId: string | null;
  requestedPlanId: string | null;
  effectiveCitySlug: string | null;
  budget: string;
  occasion: string;
  familyAgeBand: FamilyAgeBand;
  planMode: PlanMode;
  stopsCount: number;
  interests: string[];
  groupEnabled: boolean;
  groupMembers: GroupMember[];
  fullDayActsAfterBreakfast: number;
  fullDayActsAfterLunch: number;
  effectiveStartPoint: StartPoint;
  activeVariant: PlanVariant | null;
  pinnedVariant: PlanVariant | null;
  finalChoice: PlanVariant | null;
  leadingVariant: LeadingVariantSummary | null;
  variantVotes: Record<string, string[]>;
  radiusKm: number;
  effectiveRadiusKm: number;
  sortMode: "match" | "distance";
  activeLevel: string;
  aiText: string | null;
  experienceMode: ExperienceMode;
  routeProfile: RouteProfile;
  plannedStops: PlannedStop[];
  getCurrentFinalStatusLabel: () => string;
  showToast: (message: string) => void;
  defaultEditedPlanTitle: (saveMode: PlannerSaveMode, finalizeGroupPlan: boolean) => string | null;
  buildChoiceSummaryText: (
    choicePlan?: {
      filters?: {
        groupChoiceLabel?: string | null;
        pinnedVariantLabel?: string | null;
        leadingVariantLabel?: string | null;
        leadingVariantVotes?: number | null;
      } | null;
    } | null
  ) => string;
  onSetActivePlanGroupChatId: (chatId: string | null) => void;
};

export function usePlannerPersistence({
  authReady,
  userId,
  requestedPlanId,
  effectiveCitySlug,
  budget,
  occasion,
  familyAgeBand,
  planMode,
  stopsCount,
  interests,
  groupEnabled,
  groupMembers,
  fullDayActsAfterBreakfast,
  fullDayActsAfterLunch,
  effectiveStartPoint,
  activeVariant,
  pinnedVariant,
  finalChoice,
  leadingVariant,
  variantVotes,
  radiusKm,
  effectiveRadiusKm,
  sortMode,
  activeLevel,
  aiText,
  experienceMode,
  routeProfile,
  plannedStops,
  getCurrentFinalStatusLabel,
  showToast,
  defaultEditedPlanTitle,
  buildChoiceSummaryText,
  onSetActivePlanGroupChatId,
}: UsePlannerPersistenceParams) {
  const [plans, setPlans] = useState<SavedPlanRow[]>([]);
  const [planChoiceReactions, setPlanChoiceReactions] = useState<
    Record<string, SharedPlanChoiceReactionSummary>
  >({});
  const [planEditSuggestions, setPlanEditSuggestions] = useState<
    Record<string, PlanEditSuggestionSummary[]>
  >({});
  const [saving, setSaving] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [planTitle, setPlanTitle] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<SavedPlanRow | null>(null);
  const [resumedPlanId, setResumedPlanId] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    if (!authReady) return;

    if (!userId) {
      setPlans([]);
      setPlanChoiceReactions({});
      setPlanEditSuggestions({});
      setLoadingPlans(false);
      return;
    }

    setLoadingPlans(true);
    try {
      let query = supabase
        .from("plans")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      query = query.eq("user_id", userId);

      const { data, error } = await query;
      if (error) {
        console.error("Load Plans Fehler:", {
          raw: error,
          formatted: formatSupabaseError(error),
        });
        setPlans([]);
        setPlanChoiceReactions({});
        setPlanEditSuggestions({});
        return;
      }

      const nextPlans = (data as SavedPlanRow[]) ?? [];
      setPlans(nextPlans);
      setSelectedPlan((prev) => (prev ? nextPlans.find((plan) => plan.id === prev.id) ?? prev : prev));

      const suggestionEntries = await Promise.all(
        nextPlans.map(async (plan) => {
          const { data: suggestionRows, error: suggestionError } = await supabase.rpc(
            "plan_edit_suggestions_for_owner",
            { p_plan_id: plan.id }
          );

          if (suggestionError) {
            console.error("Load plan edit suggestions Fehler:", {
              planId: plan.id,
              raw: suggestionError,
              formatted: formatSupabaseError(suggestionError),
            });
            return [plan.id, []] as const;
          }

          return [plan.id, (suggestionRows ?? []) as PlanEditSuggestionSummary[]] as const;
        })
      );

      setPlanEditSuggestions(Object.fromEntries(suggestionEntries));

      const sharedPlans = nextPlans.filter(
        (plan) => plan.share_token && plan.filters?.pinnedVariantLabel
      );

      if (!sharedPlans.length) {
        setPlanChoiceReactions({});
        return;
      }

      const reactionEntries = await Promise.all(
        sharedPlans.map(async (plan) => {
          const { data: reactionRows, error: reactionError } = await supabase.rpc(
            "public_plan_choice_reactions_by_token",
            { p_token: plan.share_token }
          );

          if (reactionError) {
            console.error("Load plan choice reactions Fehler:", {
              planId: plan.id,
              raw: reactionError,
              formatted: formatSupabaseError(reactionError),
            });
            return [plan.id, { count: 0, voters: [] }] as const;
          }

          const voters = Array.from(
            new Set(
              ((reactionRows ?? []) as Array<{ voter_label?: string | null }>)
                .map((row) => (typeof row.voter_label === "string" ? row.voter_label.trim() : ""))
                .filter(Boolean)
            )
          );

          return [plan.id, { count: voters.length, voters }] as const;
        })
      );

      setPlanChoiceReactions(Object.fromEntries(reactionEntries));
    } finally {
      setLoadingPlans(false);
    }
  }, [authReady, userId]);

  useEffect(() => {
    if (!authReady) return;
    void loadPlans();
  }, [authReady, userId, loadPlans]);

  useEffect(() => {
    if (!requestedPlanId || !plans.length) return;
    const match = plans.find((plan) => plan.id === requestedPlanId);
    if (!match) return;
    setSelectedPlan(match);
  }, [requestedPlanId, plans]);

  const ensurePlanShareUrl = useCallback(
    async (plan: SavedPlanRow) => {
      if (!authReady || !userId) return null;

      let token = plan.share_token ?? null;
      if (!token) {
        token = generateShareToken(18);

        const { error } = await supabase
          .from("plans")
          .update({ share_token: token })
          .eq("id", plan.id)
          .eq("user_id", userId);

        if (error) {
          console.error("Share Token Update Fehler:", {
            raw: error,
            formatted: formatSupabaseError(error),
          });
          return null;
        }

        await loadPlans();
      }

      return `${window.location.origin}/p/${token}`;
    },
    [authReady, userId, loadPlans]
  );

  const ensurePlanGroupChat = useCallback(
    async (plan: SavedPlanRow) => {
      if (!authReady || !userId) return null;

      const memberUserIds = Array.from(
        new Set(
          [
            userId,
            ...((plan.filters?.groupMembers ?? []) as Array<{ profileUserId?: string | null }>)
              .map((member) => member.profileUserId)
              .filter((value): value is string => typeof value === "string" && value.length > 0),
          ].filter(Boolean)
        )
      );

      if (memberUserIds.length < 2) return null;

      const { data: existingChat, error: existingChatError } = await supabase
        .from("user_plan_group_chats")
        .select("id, owner_user_id, plan_id, title, created_at, updated_at, last_message_at")
        .eq("plan_id", plan.id)
        .maybeSingle();

      if (existingChatError) {
        console.error("Plan group chat lookup error:", {
          raw: existingChatError,
          formatted: formatSupabaseError(existingChatError),
        });
        return null;
      }

      const timestamp = new Date().toISOString();
      let chatId = (existingChat as { id?: string | null } | null)?.id ?? null;

      if (!chatId) {
        const { data: createdChat, error: createChatError } = await supabase
          .from("user_plan_group_chats")
          .insert({
            owner_user_id: userId,
            plan_id: plan.id,
            title: plan.title || plan.filters?.finalVariantLabel || plan.filters?.pinnedVariantLabel || "Gruppenplan",
            last_message_at: timestamp,
            updated_at: timestamp,
          })
          .select("id")
          .maybeSingle();

        if (createChatError) {
          console.error("Plan group chat create error:", {
            raw: createChatError,
            formatted: formatSupabaseError(createChatError),
          });
          return null;
        }

        chatId = (createdChat as { id?: string | null } | null)?.id ?? null;
      }

      if (!chatId) return null;

      const { data: memberRows, error: memberLoadError } = await supabase
        .from("user_plan_group_chat_members")
        .select("member_user_id")
        .eq("chat_id", chatId);

      if (memberLoadError) {
        console.error("Plan group chat members load error:", {
          raw: memberLoadError,
          formatted: formatSupabaseError(memberLoadError),
        });
        return null;
      }

      const existingMemberIds = new Set(
        ((memberRows ?? []) as Array<{ member_user_id?: string | null }>)
          .map((row) => row.member_user_id)
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      );

      const missingMembers = memberUserIds.filter((memberId) => !existingMemberIds.has(memberId));

      if (missingMembers.length > 0) {
        const { error: insertMembersError } = await supabase
          .from("user_plan_group_chat_members")
          .insert(
            missingMembers.map((memberId) => ({
              chat_id: chatId,
              member_user_id: memberId,
            }))
          );

        if (insertMembersError) {
          console.error("Plan group chat member insert error:", {
            raw: insertMembersError,
            formatted: formatSupabaseError(insertMembersError),
          });
          return null;
        }
      }

      if (!existingChat) {
        await postPlannerGroupChatSystemMessage({
          chatId,
          body: buildPlanGroupChatSystemMessage(plan),
          userId,
        });
      }

      return chatId;
    },
    [authReady, userId]
  );

  const savePlan = useCallback(
    async (finalizeGroupPlan = false, saveMode: PlannerSaveMode = "default") => {
      setSaving(true);
      try {
        if (!authReady) {
          console.error("Auth noch nicht ready - bitte kurz warten.");
          return null;
        }
        if (!userId) {
          console.error("Kein User vorhanden - Session leer oder kein Gastzugang aktiv.");
          return null;
        }

        const stopsPayload = plannedStops.map((stop) => ({
          index: stop.index,
          label: stop.label,
          hint: stop.hint,
          durationMin: stop.durationMin ?? null,
          travelMinFromPrev: stop.travelMinFromPrev ?? null,
          scheduledStartAt: stop.scheduledStartAt ?? null,
          scheduledEndAt: stop.scheduledEndAt ?? null,
          reasons: stop.reasons ?? [],
          location: stop.item
            ? {
                id: stop.item.id,
                name: stop.item.name,
                type: stop.item.type,
                duration_min: stop.item.duration_min ?? null,
                reservation_url: stop.item.reservation_url ?? null,
                lat: stop.item.lat ?? null,
                lng: stop.item.lng ?? null,
                distanceKm: stop.item.distanceFromOriginKm ?? null,
                baseScore: stop.item.score ?? 0,
                prefBoost: stop.item.prefBoost ?? 0,
                totalScore: stop.item.totalScore ?? 0,
                matchLevel: stop.item.matchLevel ?? null,
              }
            : null,
        }));

        const payload = {
          user_id: userId,
          title: defaultEditedPlanTitle(saveMode, finalizeGroupPlan),
          filters: {
            budget,
            occasion,
            familyAgeBand: occasion === "family" ? familyAgeBand : null,
            planMode,
            stopsCount,
            interests,
            groupEnabled,
            groupMembers,
            fullDayActsAfterBreakfast,
            fullDayActsAfterLunch,
            citySlug: effectiveCitySlug,
            startPoint: effectiveStartPoint,
            variantId: activeVariant?.variantId ?? null,
            variantLabel: activeVariant?.label ?? null,
            pinnedVariantId: pinnedVariant?.variantId ?? null,
            pinnedVariantLabel: pinnedVariant?.label ?? null,
            groupChoiceLabel: pinnedVariant ? "Unsere Wahl" : null,
            variantVotes,
            leadingVariantId: leadingVariant?.variant.variantId ?? null,
            leadingVariantLabel: leadingVariant?.variant.label ?? null,
            leadingVariantVotes: leadingVariant?.votes ?? 0,
            finalGroupPlan: finalizeGroupPlan,
            finalGroupPlanLabel: finalizeGroupPlan ? "Finaler Gruppenplan" : null,
            finalGroupStatusLabel: finalizeGroupPlan ? getCurrentFinalStatusLabel() : null,
            finalVariantLabel: finalizeGroupPlan ? finalChoice?.label ?? null : null,
            finalizedAt: finalizeGroupPlan ? new Date().toISOString() : null,
            editSourcePlanId: editingPlanId ?? null,
            editSourcePlanTitle:
              editingPlanId && selectedPlan
                ? selectedPlan.title || selectedPlan.filters?.finalVariantLabel || null
                : null,
            editSaveMode: editingPlanId ? saveMode : null,
          },
          radius_km: radiusKm,
          effective_radius_km: effectiveRadiusKm ?? null,
          sort_mode: sortMode,
          active_level: activeLevel ?? null,
          slots: stopsPayload,
          ai_description: aiText ?? null,
        };

        const { data, error } = await supabase
          .from("plans")
          .insert(payload as never)
          .select("*")
          .maybeSingle();

        if (error) {
          console.error("Save Plan Fehler:", {
            raw: error,
            formatted: formatSupabaseError(error),
          });
          return null;
        }

        const savedPlan = (data as SavedPlanRow | null) ?? null;

        if (finalizeGroupPlan && savedPlan) {
          const chatId = await ensurePlanGroupChat(savedPlan);
          if (chatId) {
            onSetActivePlanGroupChatId(chatId);
            await postPlannerGroupChatSystemMessage({
              chatId,
              body: buildFinalPlanSavedSystemMessage(
                savedPlan,
                finalChoice?.label ?? null,
                leadingVariant?.votes ?? 0,
                Array.from(
                  new Set(
                    Object.values(variantVotes)
                      .flatMap((voters) => voters)
                      .map((voter) => voter.trim())
                      .filter(Boolean)
                  )
                ).length,
              ),
              userId,
            });
          }
        }

        if (savedPlan) {
          void trackMonetizationEvent({
            eventType: "plan_save",
            userId,
            planId: savedPlan.id,
            citySlug: effectiveCitySlug,
            surface: "planner",
            metadata: {
              finalizeGroupPlan,
              saveMode,
              occasion,
              experienceMode,
              routeProfile,
              pinnedVariantId: pinnedVariant?.variantId ?? null,
            },
          });
        }

        setPlanTitle("");
        await loadPlans();
        showToast(
          finalizeGroupPlan
            ? "Finaler Gruppenplan gespeichert. Die Gruppe kann jetzt auf derselben Version weiterarbeiten."
            : editingPlanId && saveMode === "new_variant"
              ? "Neue Gruppenvariante gespeichert. Sie steht jetzt als eigene Option bereit."
              : editingPlanId && saveMode === "new_version"
                ? "Neuer Stand gespeichert. Deine Änderungen findest du auch unter Gespeichert."
                : "Plan gespeichert. Du findest ihn jetzt unter Gespeichert und kannst ihn später weiterführen oder teilen."
        );
        return savedPlan;
      } finally {
        setSaving(false);
      }
    },
    [
      authReady,
      userId,
      plannedStops,
      defaultEditedPlanTitle,
      budget,
      occasion,
      familyAgeBand,
      planMode,
      stopsCount,
      interests,
      groupEnabled,
      groupMembers,
      fullDayActsAfterBreakfast,
      fullDayActsAfterLunch,
      effectiveCitySlug,
      effectiveStartPoint,
      activeVariant,
      pinnedVariant,
      variantVotes,
      leadingVariant,
      finalChoice,
      editingPlanId,
      selectedPlan,
      radiusKm,
      effectiveRadiusKm,
      sortMode,
      activeLevel,
      aiText,
      ensurePlanGroupChat,
      onSetActivePlanGroupChatId,
      loadPlans,
      showToast,
      experienceMode,
      routeProfile,
      getCurrentFinalStatusLabel,
    ]
  );

  const sharePlan = useCallback(
    async (plan: SavedPlanRow) => {
      if (!authReady) {
        console.error("Auth noch nicht ready.");
        return;
      }
      if (!userId) {
        console.error("Kein User vorhanden.");
        return;
      }

      const shareUrl = await ensurePlanShareUrl(plan);
      if (!shareUrl) return;
      const choiceText = buildChoiceSummaryText(plan);
      const shareText = choiceText ? `${choiceText}\n${shareUrl}` : shareUrl;
      void trackMonetizationEvent({
        eventType: "share_activation",
        userId,
        planId: plan.id,
        citySlug: effectiveCitySlug,
        surface: "planner_share",
        metadata: {
          target: "copy_share_link",
          hasChoiceSummary: Boolean(choiceText),
          hasShareUrl: Boolean(shareUrl),
          groupEnabled: Boolean(plan.filters?.groupEnabled),
          finalStatus: plan.filters?.finalGroupStatusLabel ?? null,
          pinnedVariantLabel: plan.filters?.pinnedVariantLabel ?? null,
        },
      });

      try {
        await navigator.clipboard.writeText(shareText);
        showToast("Share-Link kopiert. Du kannst ihn jetzt direkt mit der Gruppe teilen.");
      } catch {
        prompt("Kopiere diesen Link:", shareText);
      }
    },
    [authReady, userId, effectiveCitySlug, ensurePlanShareUrl, buildChoiceSummaryText, showToast]
  );

  const sendFinalPlanToFriends = useCallback(
    async (plan: SavedPlanRow) => {
      const shareUrl = await ensurePlanShareUrl(plan);
      if (!shareUrl) {
        showToast("Share-Link konnte nicht erzeugt werden.");
        return;
      }

      const lines = [
        plan.filters?.finalGroupStatusLabel || plan.filters?.finalGroupPlanLabel || "Finaler Gruppenplan",
        plan.title || plan.filters?.finalVariantLabel || plan.filters?.pinnedVariantLabel || "Gruppenplan",
        buildChoiceSummaryText(plan),
        shareUrl,
      ].filter(Boolean);

      void trackMonetizationEvent({
        eventType: "share_activation",
        userId,
        planId: plan.id,
        citySlug: effectiveCitySlug,
        surface: "planner_share",
        metadata: {
          target: "chat_prefill",
          hasChoiceSummary: Boolean(buildChoiceSummaryText(plan)),
          finalStatus: plan.filters?.finalGroupStatusLabel ?? null,
          pinnedVariantLabel: plan.filters?.pinnedVariantLabel ?? null,
        },
      });

      window.location.href = `/chat?prefill=${encodeURIComponent(lines.join("\n"))}`;
    },
    [ensurePlanShareUrl, showToast, buildChoiceSummaryText, userId, effectiveCitySlug]
  );

  const openPlanGroupChat = useCallback(
    async (plan: SavedPlanRow) => {
      const chatId = await ensurePlanGroupChat(plan);
      if (!chatId) return;
      onSetActivePlanGroupChatId(chatId);
      void trackMonetizationEvent({
        eventType: "group_confirmation",
        userId,
        planId: plan.id,
        citySlug: effectiveCitySlug,
        surface: "planner_group_chat",
        metadata: {
          target: "open_group_chat",
          chatId,
          finalStatus: plan.filters?.finalGroupStatusLabel ?? null,
        },
      });
      window.location.href = `/chat?group=${chatId}`;
    },
    [ensurePlanGroupChat, onSetActivePlanGroupChatId, userId, effectiveCitySlug]
  );

  const resolveEditSuggestion = useCallback(
    async (suggestionId: string) => {
      const { data, error } = await supabase.rpc("resolve_plan_edit_suggestion", {
        p_suggestion_id: suggestionId,
      });

      if (error) {
        console.error("Resolve plan edit suggestion Fehler:", {
          raw: error,
          formatted: formatSupabaseError(error),
        });
        showToast("Änderungswunsch konnte nicht übernommen werden");
        return;
      }

      if (data) {
        await loadPlans();
        showToast("Änderungswunsch aufgenommen");
      }
    },
    [loadPlans, showToast]
  );

  const openCurrentPlannerGroupChat = useCallback(async () => {
    const savedPlan = await savePlan(true);
    if (!savedPlan) return;
    await openPlanGroupChat(savedPlan);
  }, [openPlanGroupChat, savePlan]);

  return {
    plans,
    setPlans,
    planChoiceReactions,
    planEditSuggestions,
    saving,
    loadingPlans,
    planTitle,
    setPlanTitle,
    selectedPlan,
    setSelectedPlan,
    resumedPlanId,
    setResumedPlanId,
    editingPlanId,
    setEditingPlanId,
    loadPlans,
    savePlan,
    sharePlan,
    ensurePlanShareUrl,
    sendFinalPlanToFriends,
    ensurePlanGroupChat,
    openPlanGroupChat,
    resolveEditSuggestion,
    openCurrentPlannerGroupChat,
  };
}
