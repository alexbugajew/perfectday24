"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { sortUserPair, type DirectConversationRow, type DirectMessageRow } from "@/lib/social/chat";
import {
  type GroupChatMemberRow,
  type GroupChatMessageRow,
  type GroupChatRow,
} from "@/lib/social/group-chat";
import { friendshipPeerUserId, type FriendshipRow } from "@/lib/social/friends";

type ChatProfileRow = {
  id?: string;
  user_id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
};

type GroupChatPlanMetaRow = {
  plan_id: string;
  title: string | null;
  share_token: string | null;
  final_group_status_label?: string | null;
  pinned_variant_label?: string | null;
};

type GroupChatUnreadRow = {
  chat_id: string;
  unread_count: number;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  last_message_type?: string | null;
  last_sender_user_id?: string | null;
};

function formatSupabaseError(error: unknown) {
  if (!error || typeof error !== "object") return String(error);
  const maybe = error as {
    message?: string;
    details?: string | null;
    hint?: string | null;
    code?: string | null;
  };
  return JSON.stringify(
    {
      message: maybe.message ?? null,
      details: maybe.details ?? null,
      hint: maybe.hint ?? null,
      code: maybe.code ?? null,
    },
    null,
    2
  );
}

function summarizeChatError(error: unknown) {
  if (!error || typeof error !== "object") return "Unbekannter Fehler";
  const maybe = error as { message?: string; code?: string | null };
  if (maybe.message?.includes("relation") || maybe.code === "42P01") {
    return "Chat-Tabellen fehlen noch in Supabase";
  }
  if (maybe.code === "42501") {
    return "Die Chat-Policies in Supabase blockieren den Zugriff";
  }
  return maybe.message || "Unbekannter Fehler";
}

function formatTime(value: string | null | undefined) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mergeGroupMessages(
  prev: GroupChatMessageRow[],
  nextMessage: GroupChatMessageRow
) {
  if (prev.some((message) => message.id === nextMessage.id)) return prev;
  return [...prev, nextMessage].sort(
    (a, b) =>
      new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
  );
}

function isSystemGroupMessage(message: GroupChatMessageRow) {
  return message.message_type === "system";
}

function buildGroupChatShortcuts(message: GroupChatMessageRow | null) {
  const body = (message?.body ?? "").toLowerCase();
  if (!body) return [] as Array<{ label: string; text: string; tone?: "emerald" | "sky" | "amber" }>;

  if (body.includes("mehrheit erreicht")) {
    return [
      { label: "Ich stimme auch zu", text: "Ich bin auch fuer diese Variante.", tone: "emerald" },
      { label: "Andere Variante anschauen", text: "Lasst uns kurz noch eine andere Variante vergleichen.", tone: "sky" },
      { label: "Plan finalisieren", text: "Sieht gut aus. Wir koennen den Plan jetzt finalisieren.", tone: "amber" },
    ];
  }

  if (body.includes("alle haben") || body.includes("tag ist jetzt abgestimmt")) {
    return [
      { label: "Perfekt", text: "Perfekt, dann nehmen wir genau diesen Plan.", tone: "emerald" },
      { label: "Uhrzeiten abstimmen", text: "Wollen wir kurz noch Treffpunkt und Uhrzeit abstimmen?", tone: "sky" },
      { label: "Details klaeren", text: "Ich bin dabei. Lasst uns noch die letzten Details klaeren.", tone: "amber" },
    ];
  }

  if (body.includes("bestaetigt") || body.includes("bevorzugt jetzt")) {
    return [
      { label: "Ich stimme zu", text: "Passt fuer mich auch gut.", tone: "emerald" },
      { label: "Kompromiss vorschlagen", text: "Ich waere offen fuer einen kleinen Kompromiss bei den Stops.", tone: "amber" },
      { label: "Andere Idee teilen", text: "Ich haette noch eine andere Idee fuer die Gruppe.", tone: "sky" },
    ];
  }

  return [
    { label: "Klingt gut", text: "Klingt gut fuer mich.", tone: "emerald" },
    { label: "Kurz abstimmen", text: "Lasst uns das kurz gemeinsam abstimmen.", tone: "sky" },
  ];
}

function ChatPageContent() {
  const searchParams = useSearchParams();
  const requestedUserId = searchParams.get("user");
  const requestedGroupId = searchParams.get("group");
  const prefillMessage = searchParams.get("prefill") ?? "";

  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<ChatProfileRow[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [conversations, setConversations] = useState<DirectConversationRow[]>([]);
  const [groupChats, setGroupChats] = useState<GroupChatRow[]>([]);
  const [groupChatMembers, setGroupChatMembers] = useState<GroupChatMemberRow[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessageRow[]>([]);
  const [groupMessages, setGroupMessages] = useState<GroupChatMessageRow[]>([]);
  const [activeGroupPlanMeta, setActiveGroupPlanMeta] = useState<GroupChatPlanMetaRow | null>(null);
  const [groupUnreadRows, setGroupUnreadRows] = useState<GroupChatUnreadRow[]>([]);
  const [activeMode, setActiveMode] = useState<"direct" | "group">("direct");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activePeerId, setActivePeerId] = useState<string | null>(null);
  const [activeGroupChatId, setActiveGroupChatId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) console.error("Chat session load error:", error);
      if (!active) return;
      setUserId(data.session?.user?.id ?? null);
      setAuthReady(true);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setAuthReady(true);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady || !userId) {
      setFriends([]);
      setConversations([]);
      setGroupChats([]);
      setGroupChatMembers([]);
      setGroupUnreadRows([]);
      return;
    }

    let active = true;
    void (async () => {
      setFriendsLoading(true);
      setStatus(null);
      try {
        const { data: friendshipRows, error: friendshipError } = await supabase
          .from("user_friendships")
          .select("id, requester_user_id, addressee_user_id, created_at")
          .or(`requester_user_id.eq.${userId},addressee_user_id.eq.${userId}`);

        if (friendshipError) {
          console.error(`Chat friendships load error: ${formatSupabaseError(friendshipError)}`);
          if (active) setStatus(`Die Freundeliste konnte gerade nicht geladen werden (${summarizeChatError(friendshipError)}).`);
          if (active) setFriends([]);
          return;
        }

        const friendships = (friendshipRows ?? []) as FriendshipRow[];
        const friendIds = Array.from(
          new Set(friendships.map((row) => friendshipPeerUserId(row, userId)).filter(Boolean))
        );

        const [
          { data: directRows, error: directError },
          { data: groupRows, error: groupError },
          { data: unreadRows, error: unreadError },
        ] = await Promise.all([
          supabase
            .from("user_direct_conversations")
            .select("id, user_a_id, user_b_id, created_by_user_id, created_at, updated_at, last_message_at")
            .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`),
          supabase
            .from("user_plan_group_chats")
            .select("id, owner_user_id, plan_id, title, created_at, updated_at, last_message_at"),
          supabase.rpc("group_chat_unread_overview", {
            p_user_id: userId,
          }),
        ]);

        if (directError) {
          console.error(`Chat conversations load error: ${formatSupabaseError(directError)}`);
          if (active) setStatus(`Die Unterhaltungen konnten gerade nicht geladen werden (${summarizeChatError(directError)}).`);
        }
        if (groupError) {
          console.error(`Group chats load error: ${formatSupabaseError(groupError)}`);
        }
        if (unreadError) {
          console.error(`Group chat unread load error: ${formatSupabaseError(unreadError)}`);
        }

        const groupChatList = (groupRows ?? []) as GroupChatRow[];
        const { data: memberRows, error: memberError } =
          groupChatList.length > 0
            ? await supabase
                .from("user_plan_group_chat_members")
                .select("id, chat_id, member_user_id, created_at, last_read_at")
                .in("chat_id", groupChatList.map((chat) => chat.id))
            : { data: [], error: null };

        if (memberError) {
          console.error(`Group chat members load error: ${formatSupabaseError(memberError)}`);
        }

        const profileIds = Array.from(
          new Set([
            ...friendIds,
            ...(((memberRows ?? []) as GroupChatMemberRow[]).map((member) => member.member_user_id)),
          ])
        );

        const { data: profileRows, error: profileError } =
          profileIds.length > 0
            ? await supabase
                .from("creator_profiles")
                .select("id, user_id, username, display_name, avatar_url, bio")
                .in("user_id", profileIds)
            : { data: [], error: null };

        if (profileError) {
          console.error(`Chat profiles load error: ${formatSupabaseError(profileError)}`);
        }

        if (!active) return;
        setFriends((profileRows ?? []) as ChatProfileRow[]);
        setConversations((directRows ?? []) as DirectConversationRow[]);
        setGroupChats(groupChatList);
        setGroupChatMembers((memberRows ?? []) as GroupChatMemberRow[]);
        setGroupUnreadRows((unreadRows ?? []) as GroupChatUnreadRow[]);
      } finally {
        if (active) setFriendsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [authReady, userId]);

  const profileMap = useMemo(
    () => new Map(friends.map((profile) => [profile.user_id, profile])),
    [friends]
  );

  async function openDirectConversation(peerUserId: string) {
    if (!userId || peerUserId === userId) return;
    setStatus(null);

    let conversation = conversations.find((item) => {
      const [a, b] = sortUserPair(item.user_a_id, item.user_b_id);
      const [x, y] = sortUserPair(userId, peerUserId);
      return a === x && b === y;
    });

    if (!conversation) {
      const [userA, userB] = sortUserPair(userId, peerUserId);
      const { data, error } = await supabase
        .from("user_direct_conversations")
        .insert({
          user_a_id: userA,
          user_b_id: userB,
          created_by_user_id: userId,
        })
        .select("id, user_a_id, user_b_id, created_by_user_id, created_at, updated_at, last_message_at")
        .maybeSingle();

      if (error) {
        console.error(`Open direct conversation error: ${formatSupabaseError(error)}`);
        setStatus(`Der Chat konnte nicht gestartet werden (${summarizeChatError(error)}).`);
        return;
      }

      conversation = (data ?? undefined) as DirectConversationRow | undefined;
      if (!conversation) return;
      setConversations((prev) => {
        const exists = prev.some((item) => item.id === conversation!.id);
        return exists ? prev : [conversation!, ...prev];
      });
    }

    setActiveMode("direct");
    setActiveConversationId(conversation.id);
    setActivePeerId(peerUserId);
    setActiveGroupChatId(null);
  }

  function openGroupConversation(chatId: string) {
    setStatus(null);
    setActiveMode("group");
    setActiveGroupChatId(chatId);
    setActiveConversationId(null);
    setActivePeerId(null);
  }

  async function markActiveGroupChatRead(chatId: string) {
    if (!userId) return;
    const timestamp = new Date().toISOString();
    const { error } = await supabase
      .from("user_plan_group_chat_members")
      .update({ last_read_at: timestamp })
      .eq("chat_id", chatId)
      .eq("member_user_id", userId);

    if (error) {
      console.error(`Mark group chat read error: ${formatSupabaseError(error)}`);
      return;
    }

    setGroupUnreadRows((prev) =>
      prev.map((row) =>
        row.chat_id === chatId
          ? {
              ...row,
              unread_count: 0,
            }
          : row
      )
    );
  }

  useEffect(() => {
    if (!requestedUserId || !userId || friends.length === 0) return;
    if (!friends.some((friend) => friend.user_id === requestedUserId)) return;
    void openDirectConversation(requestedUserId);
  }, [requestedUserId, userId, friends.length]);

  useEffect(() => {
    if (!requestedGroupId || groupChats.length === 0) return;
    if (!groupChats.some((chat) => chat.id === requestedGroupId)) return;
    openGroupConversation(requestedGroupId);
  }, [requestedGroupId, groupChats]);

  useEffect(() => {
    if (!prefillMessage) return;
    setDraft((prev) => (prev.trim().length === 0 ? prefillMessage : prev));
  }, [prefillMessage]);

  useEffect(() => {
    if (activeMode !== "direct" || !activeConversationId) {
      setDirectMessages([]);
      return;
    }

    let active = true;
    void (async () => {
      const { data, error } = await supabase
        .from("user_direct_messages")
        .select("id, conversation_id, sender_user_id, body, created_at")
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error(`Chat messages load error: ${formatSupabaseError(error)}`);
        if (active) setStatus(`Die Nachrichten konnten gerade nicht geladen werden (${summarizeChatError(error)}).`);
        if (active) setDirectMessages([]);
        return;
      }

      if (active) setDirectMessages((data ?? []) as DirectMessageRow[]);
    })();

    return () => {
      active = false;
    };
  }, [activeConversationId, activeMode]);

  useEffect(() => {
    if (activeMode !== "group" || !activeGroupChatId) {
      setGroupMessages([]);
      return;
    }

    let active = true;
    void (async () => {
      const { data, error } = await supabase
        .from("user_plan_group_chat_messages")
        .select("id, chat_id, sender_user_id, message_type, body, created_at")
        .eq("chat_id", activeGroupChatId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error(`Group chat messages load error: ${formatSupabaseError(error)}`);
        if (active) setStatus(`Die Gruppennachrichten konnten gerade nicht geladen werden (${summarizeChatError(error)}).`);
        if (active) setGroupMessages([]);
        return;
      }

      if (active) setGroupMessages((data ?? []) as GroupChatMessageRow[]);
    })();

    return () => {
      active = false;
    };
  }, [activeGroupChatId, activeMode]);

  useEffect(() => {
    if (activeMode !== "group" || !activeGroupChatId || !userId) return;
    const unread = groupUnreadRows.find((row) => row.chat_id === activeGroupChatId)?.unread_count ?? 0;
    if (unread <= 0) return;
    void markActiveGroupChatRead(activeGroupChatId);
  }, [activeGroupChatId, activeMode, groupUnreadRows, userId]);

  useEffect(() => {
    if (activeMode !== "group" || !activeGroupChatId) {
      setActiveGroupPlanMeta(null);
      return;
    }

    let active = true;
    void (async () => {
      const { data, error } = await supabase.rpc("group_chat_plan_meta", {
        p_chat_id: activeGroupChatId,
      });

      if (error) {
        console.error(`Group chat plan meta load error: ${formatSupabaseError(error)}`);
        if (active) setActiveGroupPlanMeta(null);
        return;
      }

      const row = Array.isArray(data) ? data[0] ?? null : null;
      if (active) setActiveGroupPlanMeta((row as GroupChatPlanMetaRow | null) ?? null);
    })();

    return () => {
      active = false;
    };
  }, [activeGroupChatId, activeMode]);

  useEffect(() => {
    if (activeMode !== "group" || !activeGroupChatId) return;

    const channel = supabase
      .channel(`group-chat-${activeGroupChatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_plan_group_chat_messages",
          filter: `chat_id=eq.${activeGroupChatId}`,
        },
        (payload) => {
          const nextMessage = payload.new as GroupChatMessageRow;
          setGroupMessages((prev) => mergeGroupMessages(prev, nextMessage));
          setGroupChats((prev) =>
            prev
              .map((chat) =>
                chat.id === activeGroupChatId
                  ? {
                      ...chat,
                      last_message_at: nextMessage.created_at ?? new Date().toISOString(),
                      updated_at: nextMessage.created_at ?? new Date().toISOString(),
                    }
                  : chat
              )
              .sort(
                (a, b) =>
                  new Date(b.last_message_at ?? b.updated_at ?? 0).getTime() -
                  new Date(a.last_message_at ?? a.updated_at ?? 0).getTime()
              )
          );
          setGroupUnreadRows((prev) =>
            prev.map((row) =>
              row.chat_id === activeGroupChatId
                ? {
                    ...row,
                    unread_count: nextMessage.sender_user_id === userId ? 0 : 0,
                    last_message_at: nextMessage.created_at ?? row.last_message_at ?? null,
                    last_message_preview: nextMessage.body,
                    last_message_type: nextMessage.message_type ?? null,
                    last_sender_user_id: nextMessage.sender_user_id,
                  }
                : row
            )
          );
          if (nextMessage.sender_user_id !== userId) {
            void markActiveGroupChatRead(activeGroupChatId);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_plan_group_chats",
          filter: `id=eq.${activeGroupChatId}`,
        },
        (payload) => {
          const updated = payload.new as GroupChatRow;
          setGroupChats((prev) =>
            prev
              .map((chat) => (chat.id === updated.id ? { ...chat, ...updated } : chat))
              .sort(
                (a, b) =>
                  new Date(b.last_message_at ?? b.updated_at ?? 0).getTime() -
                  new Date(a.last_message_at ?? a.updated_at ?? 0).getTime()
              )
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeGroupChatId, activeMode]);

  useEffect(() => {
    if (!userId || groupChats.length === 0) return;

    const chatIds = new Set(groupChats.map((chat) => chat.id));
    const channel = supabase
      .channel(`group-chat-unread-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_plan_group_chat_messages",
        },
        (payload) => {
          const nextMessage = payload.new as GroupChatMessageRow;
          if (!chatIds.has(nextMessage.chat_id)) return;

          setGroupChats((prev) =>
            prev
              .map((chat) =>
                chat.id === nextMessage.chat_id
                  ? {
                      ...chat,
                      last_message_at: nextMessage.created_at ?? new Date().toISOString(),
                      updated_at: nextMessage.created_at ?? new Date().toISOString(),
                    }
                  : chat
              )
              .sort(
                (a, b) =>
                  new Date(b.last_message_at ?? b.updated_at ?? 0).getTime() -
                  new Date(a.last_message_at ?? a.updated_at ?? 0).getTime()
              )
          );

          setGroupUnreadRows((prev) => {
            const isActive = activeMode === "group" && activeGroupChatId === nextMessage.chat_id;
            const nextUnread = isActive || nextMessage.sender_user_id === userId ? 0 : 1;
            const exists = prev.some((row) => row.chat_id === nextMessage.chat_id);
            if (!exists) {
              return [
                ...prev,
                {
                  chat_id: nextMessage.chat_id,
                  unread_count: nextUnread,
                  last_message_at: nextMessage.created_at ?? null,
                  last_message_preview: nextMessage.body,
                  last_message_type: nextMessage.message_type ?? null,
                  last_sender_user_id: nextMessage.sender_user_id,
                },
              ];
            }

            return prev.map((row) =>
              row.chat_id === nextMessage.chat_id
                ? {
                    ...row,
                    unread_count: isActive
                      ? 0
                      : row.unread_count + (nextMessage.sender_user_id === userId ? 0 : 1),
                    last_message_at: nextMessage.created_at ?? row.last_message_at ?? null,
                    last_message_preview: nextMessage.body,
                    last_message_type: nextMessage.message_type ?? null,
                    last_sender_user_id: nextMessage.sender_user_id,
                  }
                : row
            );
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, groupChats, activeMode, activeGroupChatId]);

  async function sendMessage() {
    if (!userId) return;
    const body = draft.trim();
    if (!body) return;

    setSending(true);
    setStatus(null);
    try {
      if (activeMode === "group" && activeGroupChatId) {
        const { data, error } = await supabase
          .from("user_plan_group_chat_messages")
          .insert({
            chat_id: activeGroupChatId,
            sender_user_id: userId,
            body,
            message_type: "user",
          })
          .select("id, chat_id, sender_user_id, message_type, body, created_at")
          .maybeSingle();

        if (error) {
          console.error(`Send group message error: ${formatSupabaseError(error)}`);
          setStatus(`Die Nachricht konnte nicht gesendet werden (${summarizeChatError(error)}).`);
          return;
        }

        await supabase
          .from("user_plan_group_chats")
          .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", activeGroupChatId);

        const nextMessage = (data ?? null) as GroupChatMessageRow | null;
        if (nextMessage) {
          setGroupMessages((prev) => mergeGroupMessages(prev, nextMessage));
          setGroupChats((prev) =>
            prev
              .map((chat) =>
                chat.id === activeGroupChatId
                  ? {
                      ...chat,
                      last_message_at: nextMessage.created_at ?? new Date().toISOString(),
                      updated_at: nextMessage.created_at ?? new Date().toISOString(),
                    }
                  : chat
              )
              .sort(
                (a, b) =>
                  new Date(b.last_message_at ?? b.updated_at ?? 0).getTime() -
                  new Date(a.last_message_at ?? a.updated_at ?? 0).getTime()
              )
          );
        }
      } else if (activeConversationId) {
        const { data, error } = await supabase
          .from("user_direct_messages")
          .insert({
            conversation_id: activeConversationId,
            sender_user_id: userId,
            body,
          })
          .select("id, conversation_id, sender_user_id, body, created_at")
          .maybeSingle();

        if (error) {
          console.error(`Send message error: ${formatSupabaseError(error)}`);
          setStatus(`Die Nachricht konnte nicht gesendet werden (${summarizeChatError(error)}).`);
          return;
        }

        await supabase
          .from("user_direct_conversations")
          .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", activeConversationId);

        const nextMessage = (data ?? null) as DirectMessageRow | null;
        if (nextMessage) {
          setDirectMessages((prev) => [...prev, nextMessage]);
          setConversations((prev) =>
            prev
              .map((conversation) =>
                conversation.id === activeConversationId
                  ? {
                      ...conversation,
                      last_message_at: nextMessage.created_at ?? new Date().toISOString(),
                      updated_at: nextMessage.created_at ?? new Date().toISOString(),
                    }
                  : conversation
              )
              .sort(
                (a, b) =>
                  new Date(b.last_message_at ?? b.updated_at ?? 0).getTime() -
                  new Date(a.last_message_at ?? a.updated_at ?? 0).getTime()
              )
          );
        }
      } else {
        return;
      }

      setDraft("");
    } finally {
      setSending(false);
    }
  }

  const conversationList = useMemo(
    () =>
      [...conversations].sort(
        (a, b) =>
          new Date(b.last_message_at ?? b.updated_at ?? 0).getTime() -
          new Date(a.last_message_at ?? a.updated_at ?? 0).getTime()
      ),
    [conversations]
  );

  const groupConversationList = useMemo(
    () =>
      [...groupChats].sort(
        (a, b) =>
          new Date(b.last_message_at ?? b.updated_at ?? 0).getTime() -
          new Date(a.last_message_at ?? a.updated_at ?? 0).getTime()
      ),
    [groupChats]
  );
  const groupUnreadMap = useMemo(
    () => new Map(groupUnreadRows.map((row) => [row.chat_id, row] as const)),
    [groupUnreadRows]
  );
  const totalGroupUnreadCount = useMemo(
    () => groupUnreadRows.reduce((sum, row) => sum + Math.max(0, row.unread_count ?? 0), 0),
    [groupUnreadRows]
  );

  const activePeer = activePeerId ? profileMap.get(activePeerId) ?? null : null;
  const activeGroupChat = activeGroupChatId
    ? groupChats.find((chat) => chat.id === activeGroupChatId) ?? null
    : null;
  const activeGroupMemberNames = useMemo(() => {
    if (!activeGroupChatId) return [] as string[];
    return groupChatMembers
      .filter((member) => member.chat_id === activeGroupChatId)
      .map(
        (member) =>
          profileMap.get(member.member_user_id)?.display_name ||
          profileMap.get(member.member_user_id)?.username ||
          "Mitglied"
      );
  }, [activeGroupChatId, groupChatMembers, profileMap]);
  const latestSystemGroupMessage = useMemo(
    () =>
      [...groupMessages]
        .reverse()
        .find((message) => isSystemGroupMessage(message)) ?? null,
    [groupMessages]
  );
  const groupChatShortcuts = useMemo(
    () => buildGroupChatShortcuts(latestSystemGroupMessage),
    [latestSystemGroupMessage]
  );

  function applyGroupShortcut(text: string) {
    setDraft((prev) => (prev.trim().length ? `${prev.trim()}\n${text}` : text));
  }

  async function copyActiveGroupShareLink() {
    if (!activeGroupPlanMeta?.share_token) {
      setStatus("Für diesen Plan gibt es noch keinen Share-Link.");
      return;
    }
    const url = `${window.location.origin}/p/${activeGroupPlanMeta.share_token}`;
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Share-Link kopiert. Du kannst ihn jetzt direkt weitergeben.");
    } catch {
      setStatus("Der Share-Link konnte nicht kopiert werden.");
    }
  }

  function openActiveGroupSharePage() {
    if (!activeGroupPlanMeta?.share_token) {
      setStatus("Für diesen Plan gibt es noch keine öffentliche Abstimmungsseite.");
      return;
    }
    window.location.href = `/p/${activeGroupPlanMeta.share_token}`;
  }

  function openActiveGroupPlannerPage() {
    if (!activeGroupPlanMeta?.plan_id) {
      setStatus("Dieser Chat ist aktuell nicht sauber mit einem Plan verknüpft.");
      return;
    }
    window.location.href = `/?planId=${encodeURIComponent(activeGroupPlanMeta.plan_id)}&resume=1`;
  }

  return (
    <main className="mx-auto max-w-7xl px-1 py-4 sm:px-2 lg:px-4">
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">Nachrichten</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Direktnachrichten und planbezogene Gruppenchats für finale Gruppenpläne.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/profile" className="rounded-xl border border-[var(--line-subtle)] px-4 py-2 text-sm hover:bg-white">
            Zum Profil
          </Link>
          <Link href="/invite" className="rounded-xl border border-[var(--line-subtle)] px-4 py-2 text-sm hover:bg-white">
            Gruppe
          </Link>
          {totalGroupUnreadCount > 0 ? (
            <div className="rounded-full bg-[var(--brand-accent-cloud)] px-3 py-2 text-xs font-medium text-[var(--state-warning)]">
              {totalGroupUnreadCount} ungelesen
            </div>
          ) : null}
        </div>
      </div>

      {!authReady || !userId ? (
        <div className="pd24-shell p-6 text-sm text-[var(--text-muted)]">
          Bitte melde dich an, um Nachrichten zu nutzen.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <aside className="space-y-6">
            <section className="pd24-shell p-5">
              <h2 className="text-lg font-semibold">Plan-Gruppenchats</h2>
              <div className="mt-4 space-y-3">
                {groupConversationList.length > 0 ? (
                  groupConversationList.map((chat) => {
                    const memberCount = groupChatMembers.filter((member) => member.chat_id === chat.id).length;
                    const unread = groupUnreadMap.get(chat.id)?.unread_count ?? 0;
                    const unreadPreview = groupUnreadMap.get(chat.id)?.last_message_preview ?? null;
                    return (
                      <button
                        key={chat.id}
                        type="button"
                        onClick={() => openGroupConversation(chat.id)}
                      className={`w-full rounded-xl border border-[var(--line-subtle)] p-3 text-left hover:bg-white ${
                          activeMode === "group" && activeGroupChatId === chat.id ? "border-[var(--text-strong)] bg-[var(--bg-panel)]" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-medium">{chat.title}</div>
                          {unread > 0 ? (
                            <div className="rounded-full bg-[var(--brand-accent-cloud)]0 px-2 py-0.5 text-[11px] font-semibold text-white">
                              {unread}
                            </div>
                          ) : null}
                        </div>
                          <div className="mt-1 text-xs text-[var(--text-muted)]">
                          {memberCount} Mitglieder · Letzte Aktivität: {formatTime(chat.last_message_at ?? chat.updated_at)}
                        </div>
                        {unreadPreview ? (
                          <div className="mt-2 line-clamp-2 text-xs text-[var(--text-muted)]">
                            {unreadPreview}
                          </div>
                        ) : null}
                      </button>
                    );
                  })
                ) : (
                  <div className="text-sm text-[var(--text-muted)]">
                    Noch keine planbezogenen Gruppenchats. Öffne im Planner einen finalen Gruppenplan, um den gemeinsamen Austausch zu starten.
                  </div>
                )}
              </div>
            </section>

            <section className="pd24-shell p-5">
              <h2 className="text-lg font-semibold">Freunde</h2>
              <div className="mt-4 space-y-3">
                {friendsLoading ? (
                  <div className="text-sm text-[var(--text-muted)]">Freunde werden geladen...</div>
                ) : friends.length > 0 ? (
                  friends.map((friend) => (
                    <button
                      key={friend.user_id}
                      type="button"
                      onClick={() => void openDirectConversation(friend.user_id)}
                      className={`flex w-full items-center gap-3 rounded-xl border border-[var(--line-subtle)] p-3 text-left hover:bg-white ${
                        activeMode === "direct" && activePeerId === friend.user_id ? "border-[var(--text-strong)] bg-[var(--bg-panel)]" : ""
                      }`}
                    >
                      {friend.avatar_url ? (
                        <img
                          src={friend.avatar_url}
                          alt={friend.display_name || friend.username || "Freund"}
                          className="h-11 w-11 rounded-full border object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] text-sm font-semibold text-[var(--text-muted)]">
                          {(friend.display_name || friend.username || "F").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{friend.display_name || friend.username || "Freund"}</div>
                        <div className="text-sm text-[var(--text-muted)]">
                          {friend.username ? `@${friend.username}` : friend.user_id}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-sm text-[var(--text-muted)]">Noch keine Freunde für den Chat vorhanden. Lege im Profil zuerst gemeinsame Kontakte an.</div>
                )}
              </div>
            </section>

            <section className="pd24-shell p-5">
              <h2 className="text-lg font-semibold">Direktchats</h2>
              <div className="mt-4 space-y-3">
                {conversationList.length > 0 ? (
                  conversationList.map((conversation) => {
                    const peerId = userId ? (conversation.user_a_id === userId ? conversation.user_b_id : conversation.user_a_id) : null;
                    const peer = peerId ? profileMap.get(peerId) : null;
                    return (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => {
                          setActiveMode("direct");
                          setActiveConversationId(conversation.id);
                          setActivePeerId(peerId);
                          setActiveGroupChatId(null);
                        }}
                        className={`w-full rounded-xl border border-[var(--line-subtle)] p-3 text-left hover:bg-white ${
                          activeMode === "direct" && activeConversationId === conversation.id ? "border-[var(--text-strong)] bg-[var(--bg-panel)]" : ""
                        }`}
                      >
                        <div className="font-medium">
                          {peer?.display_name || (peer?.username ? `@${peer.username}` : "Direktchat")}
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">
                          Letzte Aktivität: {formatTime(conversation.last_message_at ?? conversation.updated_at)}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="text-sm text-[var(--text-muted)]">Noch keine Direktgespräche gestartet. Wähle links einen Kontakt für die erste Unterhaltung.</div>
                )}
              </div>
            </section>
          </aside>

          <section className="pd24-shell p-5">
            <div className="flex items-center justify-between gap-3 border-b pb-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {activeMode === "group"
                    ? activeGroupChat?.title || "Plan-Gruppenchat"
                    : activePeer?.display_name || (activePeer?.username ? `@${activePeer.username}` : "Direktchat")}
                </h2>
                <div className="mt-1 text-sm text-[var(--text-muted)]">
                  {activeMode === "group"
                    ? activeGroupChat
                      ? `Gemeinsamer Thread zum Plan · ${activeGroupMemberNames.join(", ")}`
                      : "Wähle links einen planbezogenen Gruppenchat."
                    : activePeer
                      ? activePeer.username
                        ? `Chat mit @${activePeer.username}`
                        : "Direktnachrichten"
                      : "Wähle links einen Freund oder eine bestehende Unterhaltung."}
                </div>
                {!activePeer && activeMode !== "group" && prefillMessage ? (
                  <div className="mt-2 rounded-xl border border-[var(--line-subtle)] bg-[var(--brand-accent-soft)] px-3 py-2 text-xs text-[var(--text-strong)]">
                    Ein vorbefüllter Text aus dem Planner wurde übernommen. Wähle links einen Freund und sende ihn bei Bedarf direkt weiter.
                  </div>
                ) : null}
              </div>
              {activePeer?.username && activeMode !== "group" ? (
                <Link href={`/u/${activePeer.username}`} className="rounded-xl border border-[var(--line-subtle)] px-3 py-2 text-sm hover:bg-white">
                  Profil ansehen
                </Link>
              ) : null}
            </div>

            <div className="mt-4 min-h-[420px] space-y-3">
              {activeMode === "group" && activeGroupChatId ? (
                groupMessages.length > 0 ? (
                  groupMessages.map((message) => {
                    if (isSystemGroupMessage(message)) {
                      return (
                        <div key={message.id} className="flex justify-center">
                          <div className="max-w-[80%] rounded-full border border-[var(--line-subtle)] bg-[var(--brand-accent-soft)] px-4 py-2 text-center text-xs text-[var(--text-strong)]">
                            <div>{message.body}</div>
                            <div className="mt-1 text-[10px] text-[var(--text-muted)]">
                              {formatTime(message.created_at)}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    const own = message.sender_user_id === userId;
                    const sender =
                      profileMap.get(message.sender_user_id)?.display_name ||
                      profileMap.get(message.sender_user_id)?.username ||
                      "Mitglied";
                    return (
                      <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                            own ? "bg-[var(--text-strong)] text-white" : "border border-[var(--line-subtle)] bg-[var(--bg-panel)] text-[var(--text-strong)]"
                          }`}
                        >
                          {!own ? <div className="mb-1 text-[11px] font-semibold text-[var(--text-muted)]">{sender}</div> : null}
                          <div>{message.body}</div>
                          <div className={`mt-2 text-[11px] ${own ? "text-white/70" : "text-[var(--text-muted)]"}`}>
                            {formatTime(message.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--line-subtle)] p-6 text-sm text-[var(--text-muted)]">
                    Noch keine Gruppennachrichten. Setze den ersten Impuls, damit alle denselben Stand haben.
                  </div>
                )
              ) : activeConversationId ? (
                directMessages.length > 0 ? (
                  directMessages.map((message) => {
                    const own = message.sender_user_id === userId;
                    return (
                      <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                            own ? "bg-[var(--text-strong)] text-white" : "border border-[var(--line-subtle)] bg-[var(--bg-panel)] text-[var(--text-strong)]"
                          }`}
                        >
                          <div>{message.body}</div>
                          <div className={`mt-2 text-[11px] ${own ? "text-white/70" : "text-[var(--text-muted)]"}`}>
                            {formatTime(message.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--line-subtle)] p-6 text-sm text-[var(--text-muted)]">
                    Noch keine Nachrichten. Starte die Unterhaltung mit einer ersten klaren Nachricht.
                  </div>
                )
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--line-subtle)] p-6 text-sm text-[var(--text-muted)]">
                  {activeMode === "group"
                    ? "Wähle links einen planbezogenen Gruppenchat."
                    : "Wähle einen Freund oder Gruppenchat, um die Unterhaltung zu öffnen."}
                </div>
              )}
            </div>

            {status ? (
              <div className="mt-4 rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-3 py-2 text-sm text-[var(--text-muted)]">
                {status}
              </div>
            ) : null}

            {activeMode === "group" && activeGroupChatId && groupChatShortcuts.length ? (
              <div className="mt-4 rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-panel)] p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Schnelle Antworten
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {groupChatShortcuts.map((shortcut) => (
                    <button
                      key={`${shortcut.label}-${shortcut.text}`}
                      type="button"
                      onClick={() => applyGroupShortcut(shortcut.text)}
                      className={`rounded-full border bg-white px-3 py-2 text-xs font-medium transition hover:bg-[var(--bg-surface)] ${
                        shortcut.tone === "emerald"
                          ? "border-[var(--state-success)]/35 text-[var(--state-success)]"
                          : shortcut.tone === "amber"
                            ? "border-[var(--state-warning)]/35 text-[var(--state-warning)]"
                            : "border-[var(--brand-accent)]/35 text-[var(--brand-accent)]"
                      }`}
                    >
                      {shortcut.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {activeMode === "group" && activeGroupChatId && activeGroupPlanMeta ? (
              <div className="mt-4 rounded-xl border border-[var(--state-success)]/25 bg-[var(--brand-accent-cloud)] p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                      Plan-Aktionen
                    </div>
                    <div className="mt-1 text-sm text-[var(--text-strong)]">
                      {activeGroupPlanMeta.final_group_status_label || "Gemeinsamer Plan"}
                      {activeGroupPlanMeta.pinned_variant_label
                        ? ` · ${activeGroupPlanMeta.pinned_variant_label}`
                        : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={openActiveGroupPlannerPage}
                      className="rounded-full border border-[var(--line-subtle)] bg-white px-3 py-2 text-xs font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)]"
                    >
                      Plan im Planner öffnen
                    </button>
                    <button
                      type="button"
                      onClick={openActiveGroupSharePage}
                      className="rounded-full border border-[var(--state-success)]/30 bg-white px-3 py-2 text-xs font-medium text-[var(--state-success)] transition hover:bg-[var(--bg-surface)]"
                    >
                      Zur Abstimmungsseite
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyActiveGroupShareLink()}
                      className="rounded-full border border-[var(--brand-accent)]/30 bg-white px-3 py-2 text-xs font-medium text-[var(--brand-accent)] transition hover:bg-[var(--bg-surface)]"
                    >
                      Share-Link kopieren
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex gap-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  activeMode === "group"
                    ? activeGroupChatId
                      ? "Nachricht an die Gruppe schreiben..."
                      : "Wähle zuerst einen Gruppenchat."
                    : activeConversationId
                      ? "Nachricht schreiben..."
                      : "Wähle zuerst einen Freund."
                }
                disabled={(!activeConversationId && !activeGroupChatId) || sending}
                rows={3}
                className="flex-1 rounded-xl border border-[var(--line-subtle)] p-3 disabled:bg-[var(--bg-panel)]"
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={(!activeConversationId && !activeGroupChatId) || sending || draft.trim().length === 0}
                className="self-end rounded-xl bg-[var(--text-strong)] px-4 py-3 text-sm text-white transition hover:opacity-95 disabled:opacity-50"
              >
                {sending ? "Senden..." : "Senden"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-7xl px-1 py-4 sm:px-2 lg:px-4">
          <div className="pd24-shell p-6 text-sm text-[var(--text-muted)]">
            Nachrichten werden geladen...
          </div>
        </main>
      }
    >
      <ChatPageContent />
    </Suspense>
  );
}


