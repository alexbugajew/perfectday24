"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { norm } from "@/lib/planner";
import { friendshipPeerUserId, type FriendProfileRow, type FriendshipRow } from "@/lib/social/friends";
import { GROUP_INVITE_STORAGE_KEY } from "@/lib/social/planner-group";
import { clearPlannerGroupImport, readPlannerGroupImport } from "@/lib/social/groups";
import type { GroupMember } from "@/lib/planner";
import { formatSupabaseError } from "./helpers";
import type {
  CreatorProfileLookupRow,
  GroupProfileSuggestion,
  PlannerFriendSuggestion,
  ProfileInterestRow,
} from "./types";

type UsePlannerPeopleParams = {
  mounted: boolean;
  authReady: boolean;
  userId: string | null;
};

function parseProfileInterests(row: ProfileInterestRow | null | undefined) {
  const values = Array.isArray(row?.interests) ? row.interests : [];
  return values.map((value) => norm(String(value))).filter(Boolean);
}

function profileDisplayName(
  row: Partial<ProfileInterestRow> | Partial<CreatorProfileLookupRow> | null | undefined,
  fallback: string
) {
  const display = typeof row?.display_name === "string" ? row.display_name.trim() : "";
  const username = typeof row?.username === "string" ? row.username.trim() : "";
  return display || (username ? `@${username}` : fallback);
}

export function usePlannerPeople({ mounted, authReady, userId }: UsePlannerPeopleParams) {
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileRequired, setProfileRequired] = useState(false);
  const [showPrefsModal, setShowPrefsModal] = useState(false);

  const [groupEnabled, setGroupEnabled] = useState(false);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [activeGroupLabel, setActiveGroupLabel] = useState<string | null>(null);
  const [memberName, setMemberName] = useState("");
  const [memberProfileQuery, setMemberProfileQuery] = useState("");
  const [memberProfileLoading, setMemberProfileLoading] = useState(false);
  const [memberProfileError, setMemberProfileError] = useState<string | null>(null);
  const [memberProfileSuggestions, setMemberProfileSuggestions] = useState<GroupProfileSuggestion[]>([]);
  const [memberProfileSearchLoading, setMemberProfileSearchLoading] = useState(false);
  const [memberInterestInput, setMemberInterestInput] = useState("");
  const [friendSuggestions, setFriendSuggestions] = useState<PlannerFriendSuggestion[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

  useEffect(() => {
    if (!authReady || !userId) return;

    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Profile load error:", error);
        setProfileRequired(true);
        setShowPrefsModal(true);
        return;
      }

      const clean = parseProfileInterests((data ?? null) as ProfileInterestRow | null);
      setInterests(clean);

      if (!clean.length) {
        setProfileRequired(true);
        setShowPrefsModal(true);
      } else {
        setProfileRequired(false);
      }
    })();
  }, [authReady, userId]);

  useEffect(() => {
    if (!authReady || !userId) {
      setFriendSuggestions([]);
      return;
    }

    let active = true;

    void (async () => {
      setFriendsLoading(true);
      try {
        const { data: friendshipRows, error: friendshipError } = await supabase
          .from("user_friendships")
          .select("id, requester_user_id, addressee_user_id, created_at")
          .or(`requester_user_id.eq.${userId},addressee_user_id.eq.${userId}`);

        if (friendshipError) {
          console.error("Planner friends load error:", friendshipError);
          if (active) setFriendSuggestions([]);
          return;
        }

        const friendships = (friendshipRows ?? []) as FriendshipRow[];
        const friendIds = Array.from(
          new Set(friendships.map((row) => friendshipPeerUserId(row, userId)).filter(Boolean))
        );

        if (friendIds.length === 0) {
          if (active) setFriendSuggestions([]);
          return;
        }

        const [{ data: profileRows, error: profileError }, { data: creatorRows, error: creatorError }] =
          await Promise.all([
            supabase.from("profiles").select("user_id, interests").in("user_id", friendIds),
            supabase
              .from("creator_profiles")
              .select("id, user_id, username, display_name, avatar_url, bio, creator_type")
              .in("user_id", friendIds),
          ]);

        if (profileError) console.error("Planner friend interests load error:", profileError);
        if (creatorError) console.error("Planner friend profile load error:", creatorError);

        const profileMap = new Map(
          ((profileRows ?? []) as ProfileInterestRow[]).map((row) => [row.user_id, parseProfileInterests(row)])
        );
        const creatorMap = new Map(
          ((creatorRows ?? []) as FriendProfileRow[]).map((row) => [row.user_id, row])
        );

        const next = friendIds
          .map((friendId) => {
            const creator = creatorMap.get(friendId);
            const friendInterests = profileMap.get(friendId) ?? [];
            return {
              user_id: friendId,
              id: creator?.id,
              username: creator?.username ?? null,
              display_name: creator?.display_name ?? null,
              avatar_url: creator?.avatar_url ?? null,
              bio: creator?.bio ?? null,
              creator_type: creator?.creator_type ?? null,
              interests: friendInterests,
            } satisfies PlannerFriendSuggestion;
          })
          .filter((friend) => friend.interests.length > 0);

        if (active) setFriendSuggestions(next);
      } finally {
        if (active) setFriendsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [authReady, userId]);

  useEffect(() => {
    if (!mounted) return;

    const pullInvitedMembers = () => {
      try {
        const importedGroup = readPlannerGroupImport();
        if (importedGroup?.members?.length) {
          setGroupEnabled(true);
          setActiveGroupLabel(importedGroup.label || null);
          setGroupMembers((prev) => {
            const seen = new Set(prev.map((member) => member.profileUserId || member.id));
            const merged = [...prev];

            for (const member of importedGroup.members) {
              const key = member.profileUserId || member.id;
              if (seen.has(key)) continue;
              merged.push(member);
              seen.add(key);
            }

            return merged;
          });
          clearPlannerGroupImport();
        }

        const raw = localStorage.getItem(GROUP_INVITE_STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as GroupMember[];
        const incoming = Array.isArray(parsed) ? parsed : [];
        if (incoming.length === 0) {
          localStorage.removeItem(GROUP_INVITE_STORAGE_KEY);
          return;
        }

        setGroupEnabled(true);
        setGroupMembers((prev) => {
          const seen = new Set(prev.map((member) => member.profileUserId || member.id));
          const merged = [...prev];

          for (const member of incoming) {
            const key = member.profileUserId || member.id;
            if (seen.has(key)) continue;
            merged.push(member);
            seen.add(key);
          }

          return merged;
        });

        localStorage.removeItem(GROUP_INVITE_STORAGE_KEY);
      } catch (error) {
        console.error("Invite storage import error:", error);
      }
    };

    pullInvitedMembers();
    window.addEventListener("focus", pullInvitedMembers);

    return () => {
      window.removeEventListener("focus", pullInvitedMembers);
    };
  }, [mounted]);

  useEffect(() => {
    if (!groupEnabled) {
      setMemberProfileSuggestions([]);
      setMemberProfileSearchLoading(false);
      return;
    }

    const query = memberProfileQuery.trim().replace(/^@+/, "");
    if (query.length < 2) {
      setMemberProfileSuggestions([]);
      setMemberProfileSearchLoading(false);
      return;
    }

    let active = true;
    const timeoutId = window.setTimeout(async () => {
      setMemberProfileSearchLoading(true);
      try {
        const { data, error } = await supabase
          .from("creator_profiles")
          .select("user_id, username, display_name, avatar_url")
          .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
          .limit(6);

        if (error) {
          console.error("Member profile search error:", error);
          if (active) setMemberProfileSuggestions([]);
          return;
        }

        if (!active) return;
        setMemberProfileSuggestions(((data ?? []) as GroupProfileSuggestion[]).filter(Boolean));
      } finally {
        if (active) setMemberProfileSearchLoading(false);
      }
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [groupEnabled, memberProfileQuery]);

  const saveProfileInterests = async (next: string[]) => {
    if (!authReady || !userId) return;
    setProfileSaving(true);
    try {
      const clean = next.map((value) => norm(value)).filter(Boolean);
      const uniq = Array.from(new Set(clean)).slice(0, 12);
      setInterests(uniq);

      const { error } = await supabase.from("profiles").upsert(
        { user_id: userId, interests: uniq },
        { onConflict: "user_id" }
      );

      if (error) console.error("Profile upsert error:", error);
      if (!error && uniq.length > 0) {
        setProfileRequired(false);
      }
    } finally {
      setProfileSaving(false);
    }
  };

  const addGroupMemberFromProfile = async () => {
    const raw = memberProfileQuery.trim();
    if (!raw) return;

    setMemberProfileLoading(true);
    setMemberProfileError(null);

    try {
      const directId = raw.startsWith("@") ? null : raw;
      let profile: ProfileInterestRow | null = null;
      let profileHandle: string | null = null;

      if (directId) {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", directId)
          .maybeSingle();

        if (error) throw error;
        profile = (data ?? null) as ProfileInterestRow | null;
      }

      if (!profile) {
        const normalizedHandle = raw.replace(/^@+/, "").trim().toLowerCase();
        if (!normalizedHandle) {
          setMemberProfileError("Bitte eine Profil-ID oder einen @Username eingeben.");
          return;
        }

        const { data: creatorData, error: creatorError } = await supabase
          .from("creator_profiles")
          .select("user_id, username, display_name")
          .eq("username", normalizedHandle)
          .maybeSingle();

        if (creatorError) throw creatorError;

        const creatorProfile = (creatorData ?? null) as CreatorProfileLookupRow | null;
        if (!creatorProfile?.user_id) {
          setMemberProfileError("Kein passendes Profil gefunden.");
          return;
        }

        profileHandle = creatorProfile.username ?? normalizedHandle;

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", creatorProfile.user_id)
          .maybeSingle();

        if (profileError) throw profileError;

        profile = (profileData ?? null) as ProfileInterestRow | null;
        if (!profile) {
          setMemberProfileError("Das Profil hat noch keine Planer-Daten.");
          return;
        }

        if (!profile.username && creatorProfile.username) {
          profile.username = creatorProfile.username;
          profile.display_name = profile.display_name ?? creatorProfile.display_name;
        }
      }

      const loadedInterests = parseProfileInterests(profile);
      if (loadedInterests.length === 0) {
        setMemberProfileError("Dieses Profil hat noch keine gespeicherten Interessen.");
        return;
      }

      const fallbackName = memberName.trim() || `Gast ${groupMembers.length + 1}`;
      const resolvedHandle =
        profileHandle ??
        (typeof profile?.username === "string" && profile.username.trim().length
          ? profile.username.trim()
          : null);

      setGroupMembers((prev) => [
        ...prev,
        {
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}_${Math.random()}`,
          name: profileDisplayName(profile, fallbackName),
          interests: loadedInterests.slice(0, 12),
          profileUserId: profile?.user_id ?? null,
          profileHandle: resolvedHandle,
        },
      ]);

      setMemberName("");
      setMemberProfileQuery("");
      setMemberProfileSuggestions([]);
      setMemberInterestInput("");
    } catch (error) {
      console.error("Group profile lookup error:", error);
      setMemberProfileError(`Profil konnte nicht geladen werden: ${formatSupabaseError(error)}`);
    } finally {
      setMemberProfileLoading(false);
    }
  };

  const addFriendSuggestionToGroup = (friend: PlannerFriendSuggestion) => {
    if (friend.interests.length === 0) return;
    setGroupEnabled(true);
    setGroupMembers((prev) => {
      const key = friend.user_id;
      if (prev.some((member) => (member.profileUserId || member.id) === key)) return prev;
      return [
        ...prev,
        {
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}_${Math.random()}`,
          name: profileDisplayName(
            friend,
            friend.username ? `@${friend.username}` : `Freund ${prev.length + 1}`
          ),
          interests: friend.interests.slice(0, 12),
          profileUserId: friend.user_id,
          profileHandle: friend.username ?? null,
        },
      ];
    });
  };

  const addInterestFromInput = () => {
    const value = norm(interestInput);
    if (!value) return;
    const next = Array.from(new Set([...interests, value]));
    setInterestInput("");
    void saveProfileInterests(next);
  };

  const toggleInterest = (tag: string) => {
    const normalizedTag = norm(tag);
    const has = interests.includes(normalizedTag);
    const next = has ? interests.filter((value) => value !== normalizedTag) : [...interests, normalizedTag];
    void saveProfileInterests(next);
  };

  const addManualGroupMember = () => {
    const name = memberName.trim();
    const list = memberInterestInput
      .split(",")
      .map((value) => norm(value))
      .filter(Boolean)
      .slice(0, 10);

    if (list.length === 0) return;

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random()}`;

    setGroupMembers((prev) => [
      ...prev,
      { id: String(id), name: name || `Gast ${prev.length + 1}`, interests: list },
    ]);
    setMemberName("");
    setMemberInterestInput("");
  };

  const clearGroup = () => {
    setGroupMembers([]);
    setActiveGroupLabel(null);
  };

  const removeGroupMember = (memberId: string) => {
    setGroupMembers((prev) => prev.filter((member) => member.id !== memberId));
  };

  const selectMemberProfileSuggestion = (suggestion: GroupProfileSuggestion) => {
    setMemberProfileQuery(suggestion.username ? `@${suggestion.username}` : suggestion.user_id);
    setMemberName(
      suggestion.display_name || (suggestion.username ? `@${suggestion.username}` : "")
    );
    setMemberProfileSuggestions([]);
    setMemberProfileError(null);
  };

  return {
    interests,
    setInterests,
    interestInput,
    setInterestInput,
    profileSaving,
    profileRequired,
    setProfileRequired,
    showPrefsModal,
    setShowPrefsModal,
    groupEnabled,
    setGroupEnabled,
    groupMembers,
    setGroupMembers,
    activeGroupLabel,
    setActiveGroupLabel,
    memberName,
    setMemberName,
    memberProfileQuery,
    setMemberProfileQuery,
    memberProfileLoading,
    memberProfileError,
    setMemberProfileError,
    memberProfileSuggestions,
    memberProfileSearchLoading,
    memberInterestInput,
    setMemberInterestInput,
    friendSuggestions,
    friendsLoading,
    saveProfileInterests,
    addGroupMemberFromProfile,
    addFriendSuggestionToGroup,
    addInterestFromInput,
    toggleInterest,
    addManualGroupMember,
    clearGroup,
    removeGroupMember,
    selectMemberProfileSuggestion,
  };
}
