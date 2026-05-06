"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getInterestCatalog, norm, type GroupMember } from "@/lib/planner";
import { supabase } from "@/lib/supabaseClient";
import { friendshipPeerUserId, type FriendProfileRow, type FriendshipRow } from "@/lib/social/friends";
import { queuePlannerInviteDraft, type PlannerInviteMemberDraft } from "@/lib/social/planner-group";
import {
  writePlannerGroupImport,
  type UserGroupMemberRow,
  type UserGroupRow,
} from "@/lib/social/groups";

type ProfileRow = {
  user_id: string;
  interests?: unknown;
};

type CreatorProfileRow = {
  id?: string;
  user_id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  creator_type?: "user" | "creator" | "influencer" | "brand" | "editorial";
};

type UserRouteRow = {
  id: string;
  title: string | null;
  slug: string | null;
  description: string | null;
  city_slug: string | null;
  visibility: "private" | "unlisted" | "public";
  updated_at: string;
};

type BookmarkedRouteRow = {
  id: string;
  route_id: string;
  user_id: string;
  created_at: string;
  user_routes: UserRouteRow | UserRouteRow[] | null;
};

type FriendListItem = FriendProfileRow & {
  friendshipId: string;
};

type SocialProfileItem = FriendProfileRow;

type SavedGroupWithMembers = UserGroupRow & {
  members: FriendListItem[];
};

const ANON_PROFILE_TRANSFER_KEY = "pd24_profile_transfer_user_id";
const AVATAR_BUCKET = "avatars";

function parseInterests(row: ProfileRow | null | undefined) {
  const arr = Array.isArray(row?.interests) ? row.interests : [];
  return arr.map((x) => norm(String(x))).filter(Boolean);
}

function providerLabel(provider: string) {
  if (provider === "google") return "Google";
  if (provider === "azure") return "Microsoft";
  if (provider === "email") return "E-Mail";
  if (provider === "anonymous") return "Gast";
  return provider;
}

function friendlyAuthMessage(raw: string) {
  const msg = raw.toLowerCase();
  if (msg.includes("invalid login credentials")) return "E-Mail oder Passwort sind nicht korrekt.";
  if (msg.includes("email not confirmed")) return "Bitte bestätige zuerst deine E-Mail-Adresse.";
  if (msg.includes("user already registered")) return "Für diese E-Mail gibt es bereits ein Konto.";
  if (msg.includes("password should be at least")) return "Das Passwort ist zu kurz.";
  if (msg.includes("signup is disabled")) return "Die Registrierung per E-Mail ist aktuell nicht aktiviert.";
  if (msg.includes("unable to validate email address")) return "Die E-Mail-Adresse konnte nicht geprüft werden.";
  return raw;
}

async function exportCanvasBlob(
  canvas: HTMLCanvasElement,
  type: "image/jpeg" | "image/png",
  quality?: number
) {
  return await new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(
        (value) => {
          if (!value) {
            reject(new Error("CompressionFailed"));
            return;
          }
          resolve(value);
        },
        type,
        quality
      );
    } catch (error) {
      reject(error);
    }
  });
}

function formatSupabaseError(error: unknown) {
  if (!error || typeof error !== "object") return String(error);
  const maybe = error as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
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

function summarizeSocialError(error: unknown) {
  if (!error || typeof error !== "object") return "Unbekannter Fehler";
  const maybe = error as { message?: string; code?: string | null };
  if (
    maybe.message?.includes("relation") ||
    maybe.message?.includes("schema cache") ||
    maybe.code === "42P01" ||
    maybe.code === "PGRST205"
  ) {
    return "Die Social-Tabellen fehlen noch in Supabase";
  }
  if (maybe.code === "42501") {
    return "Die Social-Policies in Supabase blockieren den Zugriff";
  }
  return maybe.message || "Unbekannter Fehler";
}

function isMissingSocialTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { message?: string; code?: string | null };
  return (
    maybe.code === "42P01" ||
    maybe.code === "PGRST205" ||
    maybe.message?.includes("relation") === true ||
    maybe.message?.includes("schema cache") === true
  );
}

function buildFallbackUsername(userId: string, preferred?: string | null) {
  const cleanPreferred = norm(preferred ?? "").replace(/[^a-z0-9._-]+/g, "");
  if (cleanPreferred.length >= 3) return cleanPreferred;
  return `user-${userId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase()}`;
}

function buildFallbackDisplayName(
  userId: string,
  preferred?: string | null,
  username?: string | null
) {
  const cleanPreferred = (preferred ?? "").trim();
  if (cleanPreferred) return cleanPreferred;
  const cleanUsername = (username ?? "").trim();
  if (cleanUsername) return cleanUsername;
  return `User ${userId.replace(/[^a-z0-9]/gi, "").slice(0, 6)}`;
}

type CreatedRouteFilter = "all" | UserRouteRow["visibility"];
type SavedRouteFilter = "all" | "with-city" | "with-description";

function formatRouteTitle(route: UserRouteRow) {
  return route.title?.trim() || "Untitled Route";
}

function formatRouteVisibilityLabel(visibility: UserRouteRow["visibility"]) {
  if (visibility === "public") return "Öffentlich";
  if (visibility === "unlisted") return "Unlisted";
  return "Privat";
}

function formatRouteCityLabel(citySlug: string | null) {
  if (!citySlug) return "Ohne Stadt";
  return citySlug
    .split("-")
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === "im") return "im";
      if (lower === "am") return "am";
      if (lower === "an") return "an";
      if (lower === "der") return "der";
      if (lower === "muenster") return "Münster";
      if (lower === "muenchen") return "München";
      if (lower === "koeln") return "Köln";
      if (lower === "duesseldorf") return "Düsseldorf";
      if (lower === "moenchengladbach") return "Mönchengladbach";
      if (lower === "luebeck") return "Lübeck";
      if (lower === "nuernberg") return "Nürnberg";
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function routeTileTone(visibility: UserRouteRow["visibility"]) {
  if (visibility === "public") return "border-emerald-200 bg-emerald-50";
  if (visibility === "unlisted") return "border-amber-200 bg-amber-50";
  return "border-[var(--line-subtle)] bg-[var(--bg-panel)]";
}

type ProfileRouteListItemProps = {
  route: UserRouteRow;
  primaryHref?: string | null;
  primaryLabel: string;
  secondaryHref?: string | null;
  secondaryLabel?: string;
};

function ProfileRouteListItem({
  route,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: ProfileRouteListItemProps) {
  const title = formatRouteTitle(route);
  const cityLabel = formatRouteCityLabel(route.city_slug);
  const summary = route.description?.trim() || "Noch keine Beschreibung hinterlegt.";

  return (
    <div className="grid gap-4 rounded-[24px] border border-[var(--line-subtle)] bg-white p-4 shadow-sm sm:grid-cols-[112px,1fr]">
      <div className={`flex min-h-[118px] flex-col justify-between rounded-[20px] border p-3 ${routeTileTone(route.visibility)}`}>
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
          {formatRouteVisibilityLabel(route.visibility)}
        </div>
        <div>
          <div className="text-3xl font-semibold leading-none text-[var(--text-strong)]">
            {title.slice(0, 1).toUpperCase()}
          </div>
          <div className="mt-2 text-xs text-[var(--text-muted)]">{cityLabel}</div>
        </div>
        <div className="text-[11px] text-[var(--text-muted)]">
          {new Date(route.updated_at).toLocaleDateString("de-DE")}
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
            {formatRouteVisibilityLabel(route.visibility)}
          </span>
          {route.city_slug ? (
            <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
              {cityLabel}
            </span>
          ) : null}
        </div>

        <div className="mt-3">
          {primaryHref ? (
            <Link href={primaryHref} className="text-lg font-semibold text-[var(--text-strong)] transition hover:opacity-80">
              {title}
            </Link>
          ) : (
            <div className="text-lg font-semibold text-[var(--text-strong)]">{title}</div>
          )}
        </div>

        <div className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--text-muted)]">{summary}</div>
        <div className="mt-2 text-xs text-[var(--text-muted)]">
          Zuletzt aktualisiert: {new Date(route.updated_at).toLocaleDateString("de-DE")}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {primaryHref ? (
            <Link href={primaryHref} className="rounded-xl bg-[var(--text-strong)] px-3.5 py-2 text-sm text-white transition hover:opacity-95">
              {primaryLabel}
            </Link>
          ) : null}
          {secondaryHref && secondaryLabel ? (
            <Link href={secondaryHref} className="rounded-xl border border-[var(--line-subtle)] px-3.5 py-2 text-sm text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)]">
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
export default function ProfilePage() {
  const [mounted, setMounted] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [authEmailInput, setAuthEmailInput] = useState("");
  const [authPasswordInput, setAuthPasswordInput] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfileRow | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [selectedAvatarPreview, setSelectedAvatarPreview] = useState<string | null>(null);
  const [cropScale, setCropScale] = useState(1);
  const [cropOffsetX, setCropOffsetX] = useState(0);
  const [cropOffsetY, setCropOffsetY] = useState(0);
  const [initialUsername, setInitialUsername] = useState("");
  const [userRoutes, setUserRoutes] = useState<UserRouteRow[]>([]);
  const [bookmarkedRoutes, setBookmarkedRoutes] = useState<UserRouteRow[]>([]);
  const [createdRouteQuery, setCreatedRouteQuery] = useState("");
  const [createdRouteFilter, setCreatedRouteFilter] = useState<CreatedRouteFilter>("all");
  const [savedRouteQuery, setSavedRouteQuery] = useState("");
  const [savedRouteFilter, setSavedRouteFilter] = useState<SavedRouteFilter>("all");
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendActionBusyId, setFriendActionBusyId] = useState<string | null>(null);
  const [followingProfiles, setFollowingProfiles] = useState<SocialProfileItem[]>([]);
  const [followerProfiles, setFollowerProfiles] = useState<SocialProfileItem[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialActionBusyId, setSocialActionBusyId] = useState<string | null>(null);
  const [savedGroups, setSavedGroups] = useState<SavedGroupWithMembers[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [groupDescriptionInput, setGroupDescriptionInput] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [groupActionBusyId, setGroupActionBusyId] = useState<string | null>(null);
  const [groupsFeatureAvailable, setGroupsFeatureAvailable] = useState(true);

  const interestCatalog = useMemo(
    () =>
      Object.entries(getInterestCatalog()).reduce<Record<string, string[]>>((acc, [interest, spec]) => {
        if (!acc[spec.group]) acc[spec.group] = [];
        acc[spec.group].push(interest);
        return acc;
      }, {}),
    []
  );

  const interestGroupLabels: Record<string, string> = {
    food: "Küche & Food",
    activity: "Aktivität",
    sightseeing: "Sightseeing & Kultur",
    nightlife: "Nightlife & Drinks",
    ambience: "Ambiente & Outdoor",
  };

  const interestPreview = useMemo(() => interests.slice(0, 4), [interests]);

  const filteredUserRoutes = useMemo(() => {
    const query = norm(createdRouteQuery);
    return userRoutes.filter((route) => {
      if (createdRouteFilter !== "all" && route.visibility !== createdRouteFilter) return false;
      if (!query) return true;
      const haystack = norm(
        [route.title, route.description, route.city_slug, formatRouteCityLabel(route.city_slug)].filter(Boolean).join(" ")
      );
      return haystack.includes(query);
    });
  }, [createdRouteFilter, createdRouteQuery, userRoutes]);

  const filteredBookmarkedRoutes = useMemo(() => {
    const query = norm(savedRouteQuery);
    return bookmarkedRoutes.filter((route) => {
      if (savedRouteFilter === "with-city" && !route.city_slug) return false;
      if (savedRouteFilter === "with-description" && !route.description?.trim()) return false;
      if (!query) return true;
      const haystack = norm(
        [route.title, route.description, route.city_slug, formatRouteCityLabel(route.city_slug)].filter(Boolean).join(" ")
      );
      return haystack.includes(query);
    });
  }, [bookmarkedRoutes, savedRouteFilter, savedRouteQuery]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    let active = true;
    const applySession = (session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) => {
      if (!active) return;
      const user = session?.user ?? null;
      setUserId(user?.id ?? null);
      setIsAnonymous(Boolean((user as { is_anonymous?: boolean } | null)?.is_anonymous));
      setEmail(user?.email ?? null);
      setProvider(user?.app_metadata?.provider ?? (user ? "email" : null));
      setAuthReady(true);
    };

    void (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.error("Profile session load error:", error);
        applySession(data.session ?? null);
      } catch (error) {
        console.error("Profile auth init failed:", error);
        applySession(null);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => applySession(session));
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [mounted]);

  useEffect(() => {
    if (!authReady || !userId) return;
    void (async () => {
      setLoadingProfile(true);
      try {
        const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
        if (error) {
          console.error("Profile load error:", error);
          return;
        }
        setInterests(parseInterests((data ?? null) as ProfileRow | null));

        const authUser = (await supabase.auth.getUser()).data.user ?? null;
        const metadata = (authUser?.user_metadata ?? {}) as Record<string, unknown>;
        const defaultName = typeof metadata.full_name === "string" ? metadata.full_name : typeof metadata.name === "string" ? metadata.name : "";
        const defaultAvatar = typeof metadata.avatar_url === "string" ? metadata.avatar_url : "";

        const { data: creatorData, error: creatorError } = await supabase.from("creator_profiles").select("*").eq("user_id", userId).maybeSingle();
        if (creatorError) {
          console.error("Creator profile load error:", creatorError);
          setCreatorProfile(null);
          setDisplayName(defaultName);
          setAvatarUrl(defaultAvatar);
        } else {
          const creator = (creatorData ?? null) as CreatorProfileRow | null;
          setCreatorProfile(creator);
          setDisplayName(creator?.display_name ?? defaultName);
          setUsername(creator?.username ?? "");
          setInitialUsername(creator?.username ?? "");
          setAvatarUrl(creator?.avatar_url ?? defaultAvatar);
          setBio(creator?.bio ?? "");
        }

        const { data: routeData, error: routeError } = await supabase
          .from("user_routes")
          .select("id, title, slug, description, city_slug, visibility, updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(12);

        if (routeError) {
          console.error("User routes load error:", routeError);
          setUserRoutes([]);
        } else {
          setUserRoutes((routeData ?? []) as UserRouteRow[]);
        }

        const { data: bookmarkData, error: bookmarkError } = await supabase
          .from("user_route_bookmarks")
          .select(`
            id,
            route_id,
            user_id,
            created_at,
            user_routes (
              id,
              title,
              slug,
              description,
              city_slug,
              visibility,
              updated_at
            )
          `)
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (bookmarkError) {
          console.error("Bookmarked routes load error:", bookmarkError);
          setBookmarkedRoutes([]);
        } else {
          const routes = ((bookmarkData ?? []) as BookmarkedRouteRow[])
            .map((row) => {
              const nested = row.user_routes;
              return Array.isArray(nested) ? nested[0] ?? null : nested ?? null;
            })
            .filter((route): route is UserRouteRow => Boolean(route));
          setBookmarkedRoutes(routes);
        }
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [authReady, userId]);

  useEffect(() => {
    if (!authReady || !userId) {
      setFriends([]);
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
          console.error(`Friends load error: ${formatSupabaseError(friendshipError)}`);
          if (active) setStatus(`Freunde konnten nicht geladen werden (${summarizeSocialError(friendshipError)}).`);
          if (active) setFriends([]);
          return;
        }

        const friendships = (friendshipRows ?? []) as FriendshipRow[];
        const friendIds = Array.from(
          new Set(friendships.map((row) => friendshipPeerUserId(row, userId)).filter(Boolean))
        );

        if (friendIds.length === 0) {
          if (active) setFriends([]);
          return;
        }

        const { data: creatorRows, error: creatorError } = await supabase
          .from("creator_profiles")
          .select("id, user_id, username, display_name, avatar_url, bio, creator_type")
          .in("user_id", friendIds);

        if (creatorError) {
          console.error(`Friend profile load error: ${formatSupabaseError(creatorError)}`);
          if (active) setStatus(`Freundesprofile konnten nicht geladen werden (${summarizeSocialError(creatorError)}).`);
          if (active) setFriends([]);
          return;
        }

        const creatorMap = new Map(
          ((creatorRows ?? []) as FriendProfileRow[]).map((row) => [row.user_id, row])
        );

        const next = friendships
          .map((friendship) => {
            const peerId = friendshipPeerUserId(friendship, userId);
            const creator = creatorMap.get(peerId);
            return {
              friendshipId: friendship.id,
              user_id: peerId,
              id: creator?.id,
              username: creator?.username ?? null,
              display_name: creator?.display_name ?? null,
              avatar_url: creator?.avatar_url ?? null,
              bio: creator?.bio ?? null,
              creator_type: creator?.creator_type ?? null,
            } satisfies FriendListItem;
          })
          .sort((a, b) =>
            (a.display_name || a.username || a.user_id).localeCompare(
              b.display_name || b.username || b.user_id,
              "de-DE"
            )
          );

        if (active) setFriends(next);
      } finally {
        if (active) setFriendsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [authReady, userId]);

  useEffect(() => {
    if (!authReady || !userId) {
      setFollowingProfiles([]);
      setFollowerProfiles([]);
      return;
    }

    let active = true;
    void (async () => {
      setSocialLoading(true);
      try {
        const currentCreatorId =
          creatorProfile?.id ??
          (
            (
              await supabase
                .from("creator_profiles")
                .select("id")
                .eq("user_id", userId)
                .maybeSingle()
            ).data as { id?: string } | null
          )?.id ??
          null;

        const followingQuery = supabase
          .from("creator_follows")
          .select("creator_profile_id")
          .eq("follower_user_id", userId);

        const followersQuery = currentCreatorId
          ? supabase
              .from("creator_follows")
              .select("follower_user_id")
              .eq("creator_profile_id", currentCreatorId)
          : Promise.resolve({ data: [], error: null });

        const [{ data: followingRows, error: followingError }, { data: followerRows, error: followerError }] =
          await Promise.all([followingQuery, followersQuery]);

        if (followingError) {
          console.error(`Following profiles load error: ${formatSupabaseError(followingError)}`);
          if (active) setStatus(`Gefolgte Profile konnten nicht geladen werden (${summarizeSocialError(followingError)}).`);
        }
        if (followerError) {
          console.error(`Follower profiles load error: ${formatSupabaseError(followerError)}`);
          if (active) setStatus(`Follower konnten nicht geladen werden (${summarizeSocialError(followerError)}).`);
        }

        const followingIds = Array.from(
          new Set(
            ((followingRows ?? []) as Array<{ creator_profile_id: string | null }>)
              .map((row) => row.creator_profile_id)
              .filter((value): value is string => Boolean(value))
          )
        );
        const followerUserIds = Array.from(
          new Set(
            ((followerRows ?? []) as Array<{ follower_user_id: string | null }>)
              .map((row) => row.follower_user_id)
              .filter((value): value is string => Boolean(value))
          )
        );

        const [followingProfilesResult, followerProfilesResult] = await Promise.all([
          followingIds.length > 0
            ? supabase
                .from("creator_profiles")
                .select("id, user_id, username, display_name, avatar_url, bio, creator_type")
                .in("id", followingIds)
            : Promise.resolve({ data: [], error: null }),
          followerUserIds.length > 0
            ? supabase
                .from("creator_profiles")
                .select("id, user_id, username, display_name, avatar_url, bio, creator_type")
                .in("user_id", followerUserIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (followingProfilesResult.error) {
          console.error(`Following profile details load error: ${formatSupabaseError(followingProfilesResult.error)}`);
        }
        if (followerProfilesResult.error) {
          console.error(`Follower profile details load error: ${formatSupabaseError(followerProfilesResult.error)}`);
        }

        if (!active) return;
        setFollowingProfiles((followingProfilesResult.data ?? []) as SocialProfileItem[]);
        setFollowerProfiles((followerProfilesResult.data ?? []) as SocialProfileItem[]);
      } finally {
        if (active) setSocialLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [authReady, userId, creatorProfile?.id]);

  useEffect(() => {
    if (!authReady || !userId) {
      setSavedGroups([]);
      return;
    }

    let active = true;
    void (async () => {
      setGroupsLoading(true);
      try {
        const { data: groupRows, error: groupError } = await supabase
          .from("user_groups")
          .select("id, owner_user_id, name, description, created_at, updated_at")
          .eq("owner_user_id", userId)
          .order("updated_at", { ascending: false });

        if (groupError) {
          if (isMissingSocialTableError(groupError)) {
            if (active) {
              setGroupsFeatureAvailable(false);
              setSavedGroups([]);
            }
            return;
          }
          console.error(`User groups load error: ${formatSupabaseError(groupError)}`);
          if (active) setStatus(`Gruppen konnten nicht geladen werden (${summarizeSocialError(groupError)}).`);
          if (active) setSavedGroups([]);
          return;
        }

        const groups = (groupRows ?? []) as UserGroupRow[];
        if (active) setGroupsFeatureAvailable(true);
        if (groups.length === 0) {
          if (active) setSavedGroups([]);
          return;
        }

        const { data: memberRows, error: memberError } = await supabase
          .from("user_group_members")
          .select("id, group_id, member_user_id, created_at")
          .in("group_id", groups.map((group) => group.id));

        if (memberError) {
          if (isMissingSocialTableError(memberError)) {
            if (active) {
              setGroupsFeatureAvailable(false);
              setSavedGroups(groups.map((group) => ({ ...group, members: [] })));
            }
            return;
          }
          console.error(`User group members load error: ${formatSupabaseError(memberError)}`);
          if (active) setStatus(`Gruppenmitglieder konnten nicht geladen werden (${summarizeSocialError(memberError)}).`);
          if (active) setSavedGroups(groups.map((group) => ({ ...group, members: [] })));
          return;
        }

        const friendMap = new Map(friends.map((friend) => [friend.user_id, friend]));
        const groupedMembers = new Map<string, FriendListItem[]>();

        ((memberRows ?? []) as UserGroupMemberRow[]).forEach((row) => {
          const friend = friendMap.get(row.member_user_id);
          if (!friend) return;
          const current = groupedMembers.get(row.group_id) ?? [];
          current.push(friend);
          groupedMembers.set(row.group_id, current);
        });

        if (!active) return;
        setSavedGroups(
          groups.map((group) => ({
            ...group,
            members: groupedMembers.get(group.id) ?? [],
          }))
        );
      } finally {
        if (active) setGroupsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [authReady, userId, friends]);

  useEffect(() => {
    if (!authReady || !userId || isAnonymous) return;
    const sourceId = (() => {
      try {
        return localStorage.getItem(ANON_PROFILE_TRANSFER_KEY);
      } catch {
        return null;
      }
    })();
    if (!sourceId || sourceId === userId) return;

    void (async () => {
      try {
        const { data: sourceData, error: sourceError } = await supabase.from("profiles").select("*").eq("user_id", sourceId).maybeSingle();
        if (sourceError) {
          console.error("Source profile migration error:", sourceError);
          return;
        }

        const sourceInterests = parseInterests((sourceData ?? null) as ProfileRow | null);
        if (sourceInterests.length === 0) {
          localStorage.removeItem(ANON_PROFILE_TRANSFER_KEY);
          return;
        }

        const { data: targetData, error: targetError } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
        if (targetError) {
          console.error("Target profile migration error:", targetError);
          return;
        }

        const targetInterests = parseInterests((targetData ?? null) as ProfileRow | null);
        if (targetInterests.length === 0) {
          const merged = Array.from(new Set(sourceInterests)).slice(0, 12);
          const { error: upsertError } = await supabase.from("profiles").upsert({ user_id: userId, interests: merged }, { onConflict: "user_id" });
          if (upsertError) {
            console.error("Profile migration upsert error:", upsertError);
            return;
          }
          setInterests(merged);
          setStatus("Deine Interessen wurden aus dem Gastprofil übernommen.");
        }

        localStorage.removeItem(ANON_PROFILE_TRANSFER_KEY);
      } catch (error) {
        console.error("Profile migration failed:", error);
      }
    })();
  }, [authReady, userId, isAnonymous]);

  useEffect(() => {
    return () => {
      if (selectedAvatarPreview) URL.revokeObjectURL(selectedAvatarPreview);
    };
  }, [selectedAvatarPreview]);

  useEffect(() => {
    if (!authReady || !userId) return;
    const cleanUsername = norm(username).replace(/[^a-z0-9._-]+/g, "");
    if (!cleanUsername) {
      setUsernameError(null);
      setUsernameAvailable(null);
      setUsernameChecking(false);
      return;
    }
    if (cleanUsername.length < 3) {
      setUsernameError("Der Username muss mindestens 3 Zeichen lang sein.");
      setUsernameAvailable(false);
      setUsernameChecking(false);
      return;
    }
    if (cleanUsername === initialUsername) {
      setUsernameError(null);
      setUsernameAvailable(true);
      setUsernameChecking(false);
      return;
    }

    let active = true;
    const timeoutId = window.setTimeout(async () => {
      setUsernameChecking(true);
      try {
        const { data, error } = await supabase.from("creator_profiles").select("user_id, username").eq("username", cleanUsername).maybeSingle();
        if (!active) return;
        if (error) {
          console.error("Live username validation error:", error);
          setUsernameError("Username konnte gerade nicht geprüft werden.");
          setUsernameAvailable(null);
          return;
        }
        const existingUserId = (data as { user_id?: string | null } | null)?.user_id ?? null;
        if (existingUserId && existingUserId !== userId) {
          setUsernameError("Dieser Username ist bereits vergeben.");
          setUsernameAvailable(false);
          return;
        }
        setUsernameError(null);
        setUsernameAvailable(true);
      } finally {
        if (active) setUsernameChecking(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [authReady, userId, username, initialUsername]);

  async function saveInterests(next: string[]) {
    if (!userId) return;
    setSavingProfile(true);
    setStatus(null);
    try {
      const clean = Array.from(new Set(next.map((x) => norm(x)).filter(Boolean))).slice(0, 12);
      setInterests(clean);
      const { error } = await supabase.from("profiles").upsert({ user_id: userId, interests: clean }, { onConflict: "user_id" });
      if (error) {
        console.error("Profile save error:", error);
        setStatus("Profil konnte nicht gespeichert werden.");
        return;
      }
      setStatus("Interessen gespeichert. Neue Planungen greifen diese Auswahl jetzt automatisch auf.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveCreatorProfile() {
    if (!userId) return;
    setSavingProfile(true);
    setStatus(null);
    setUsernameError(null);
    try {
      const cleanUsername = norm(username).replace(/[^a-z0-9._-]+/g, "");
      if (cleanUsername && cleanUsername.length < 3) {
        setUsernameError("Der Username muss mindestens 3 Zeichen lang sein.");
        setStatus("Bitte den Username prüfen.");
        return;
      }
      if (cleanUsername) {
        const { data: existing, error: existingError } = await supabase.from("creator_profiles").select("user_id, username").eq("username", cleanUsername).maybeSingle();
        if (existingError) {
          console.error("Username validation error:", existingError);
          setStatus("Username konnte nicht geprüft werden.");
          return;
        }
        const existingUserId = (existing as { user_id?: string | null } | null)?.user_id ?? null;
        if (existingUserId && existingUserId !== userId) {
          setUsernameError("Dieser Username ist bereits vergeben.");
          setStatus("Bitte einen anderen Username wählen.");
          return;
        }
      }

      const safeUsername = buildFallbackUsername(userId, cleanUsername || null);
      const safeDisplayName = buildFallbackDisplayName(
        userId,
        displayName.trim() || null,
        cleanUsername || safeUsername
      );
      const payload = {
        user_id: userId,
        username: safeUsername,
        display_name: safeDisplayName,
        avatar_url: avatarUrl.trim() || null,
        bio: bio.trim() || null,
        creator_type: "user" as const,
      };
      const { data: existingProfile, error: existingProfileError } = await supabase
        .from("creator_profiles")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (existingProfileError) {
        console.error("Creator profile preflight error:", formatSupabaseError(existingProfileError));
        setStatus("Öffentliches Profil konnte nicht vorbereitet werden.");
        return;
      }

      const { error } = existingProfile
        ? await supabase.from("creator_profiles").update(payload).eq("user_id", userId)
        : await supabase.from("creator_profiles").insert(payload);
      if (error) {
        console.error("Creator profile save error:", formatSupabaseError(error));
        setStatus("Öffentliches Profil konnte nicht gespeichert werden.");
        return;
      }
      setUsername(cleanUsername || safeUsername);
      setDisplayName(safeDisplayName);
      setInitialUsername(cleanUsername || safeUsername);
      setStatus("Profilinformationen gespeichert. Dein öffentliches Profil ist jetzt auf dem neuesten Stand.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadAvatar(file: Blob, extension = "jpg") {
    if (!userId) return;
    setAvatarUploading(true);
    setStatus(null);
    try {
      const safeExt = extension.replace(/[^a-z0-9]/gi, "") || "jpg";
      const version = Date.now();
      const path = `${userId}/avatar-${version}.${safeExt}`;
      const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type || "image/jpeg",
        cacheControl: "3600",
      });
      if (uploadError) {
        console.error("Avatar upload error:", uploadError);
        setStatus("Avatar konnte nicht hochgeladen werden. Prüfe bitte den Storage-Bucket 'avatars' und die Storage-Policies in Supabase.");
        return;
      }

      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?v=${version}`;
      const cleanUsername = norm(username).replace(/[^a-z0-9._-]+/g, "");
      const safeUsername = buildFallbackUsername(userId, cleanUsername || null);
      const safeDisplayName = buildFallbackDisplayName(
        userId,
        displayName.trim() || null,
        cleanUsername || safeUsername
      );
      const payload = {
        user_id: userId,
        username: safeUsername,
        display_name: safeDisplayName,
        avatar_url: publicUrl,
        bio: bio.trim() || null,
        creator_type: "user" as const,
      };
      const { data: existingProfile, error: existingProfileError } = await supabase
        .from("creator_profiles")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (existingProfileError) {
        console.error("Avatar profile preflight error:", formatSupabaseError(existingProfileError));
        setAvatarUrl(publicUrl);
        setStatus("Avatar wurde hochgeladen, aber das Profil konnte nicht vorbereitet werden.");
        return;
      }

      const { error: profileError } = existingProfile
        ? await supabase.from("creator_profiles").update(payload).eq("user_id", userId)
        : await supabase.from("creator_profiles").insert(payload);
      setAvatarUrl(publicUrl);
      if (profileError) {
        console.error("Avatar profile save error:", formatSupabaseError(profileError));
        setStatus("Avatar wurde hochgeladen, konnte aber nicht im Profil gespeichert werden.");
        return;
      }
      setDisplayName(safeDisplayName);
      setStatus("Avatar hochgeladen und direkt im Profil gespeichert.");
    } finally {
      setAvatarUploading(false);
    }
  }

  function handleAvatarFileSelection(file: File | null) {
    if (selectedAvatarPreview) URL.revokeObjectURL(selectedAvatarPreview);
    setSelectedAvatarFile(file);
    setCropScale(1);
    setCropOffsetX(0);
    setCropOffsetY(0);
    if (!file) {
      setSelectedAvatarPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setSelectedAvatarPreview(objectUrl);
  }

  async function uploadCroppedAvatar() {
    if (!selectedAvatarFile || !selectedAvatarPreview) return;
    try {
      const image = new Image();
      image.src = selectedAvatarPreview;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Avatar-Vorschau konnte nicht geladen werden."));
      });

      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setStatus("Avatar-Crop konnte nicht vorbereitet werden.");
        return;
      }

      const minSide = Math.min(image.width, image.height);
      const cropSide = Math.max(64, minSide / cropScale);
      const maxX = Math.max(0, image.width - cropSide);
      const maxY = Math.max(0, image.height - cropSide);
      const sourceX = Math.min(maxX, Math.max(0, (image.width - cropSide) / 2 + (cropOffsetX / 120) * maxX));
      const sourceY = Math.min(maxY, Math.max(0, (image.height - cropSide) / 2 + (cropOffsetY / 120) * maxY));

      ctx.clearRect(0, 0, 512, 512);
      ctx.drawImage(image, sourceX, sourceY, cropSide, cropSide, 0, 0, 512, 512);

      try {
        const jpegBlob = await exportCanvasBlob(canvas, "image/jpeg", 0.92);
        await uploadAvatar(jpegBlob, "jpg");
      } catch (jpegError) {
        console.warn("JPEG avatar compression failed, trying PNG fallback:", jpegError);
        try {
          const pngBlob = await exportCanvasBlob(canvas, "image/png");
          await uploadAvatar(pngBlob, "png");
          setStatus("Avatar hochgeladen. JPEG-Kompression war nicht möglich, daher wurde PNG verwendet.");
        } catch (pngError) {
          console.warn("PNG avatar export failed, falling back to original file:", pngError);
          await uploadAvatar(selectedAvatarFile, selectedAvatarFile.name.split(".").pop() || "jpg");
          setStatus("Avatar hochgeladen. Zuschneiden war in diesem Browser nicht möglich, daher wurde die Originaldatei verwendet.");
        }
      }

      URL.revokeObjectURL(selectedAvatarPreview);
      setSelectedAvatarFile(null);
      setSelectedAvatarPreview(null);
    } catch (error) {
      console.error("Avatar crop/upload failed:", error);
      setStatus("Avatar konnte in diesem Browser nicht verarbeitet werden. Bitte probiere ein JPG/PNG oder lade die Datei erneut hoch.");
    }
  }

  function toggleInterest(tag: string) {
    const value = norm(tag);
    const next = interests.includes(value) ? interests.filter((item) => item !== value) : [...interests, value];
    void saveInterests(next);
  }

  function addCustomInterest() {
    const value = norm(interestInput);
    if (!value) return;
    setInterestInput("");
    void saveInterests([...interests, value]);
  }

  async function removeFriend(friendshipId: string) {
    if (!authReady || !userId) return;
    setFriendActionBusyId(friendshipId);
    setStatus(null);
    try {
      const { error } = await supabase.from("user_friendships").delete().eq("id", friendshipId);
      if (error) {
        console.error("Remove friend error:", error);
        setStatus("Freund konnte nicht entfernt werden.");
        return;
      }
      setFriends((prev) => prev.filter((friend) => friend.friendshipId !== friendshipId));
      setStatus("Freund wurde entfernt.");
    } finally {
      setFriendActionBusyId(null);
    }
  }

  async function addFriendToPlanner(friend: FriendListItem) {
    setFriendActionBusyId(friend.friendshipId);
    setStatus(null);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, interests")
        .eq("user_id", friend.user_id)
        .maybeSingle();

      if (error) {
        console.error("Friend planner import error:", error);
        setStatus("Freundesinteressen konnten nicht geladen werden.");
        return;
      }

      const friendInterests = parseInterests((data ?? null) as ProfileRow | null);
      if (friendInterests.length === 0) {
        setStatus("Dieses Profil hat noch keine gespeicherten Interessen.");
        return;
      }

      const nextMember: PlannerInviteMemberDraft = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random()}`,
        name: friend.display_name || (friend.username ? `@${friend.username}` : "Freund"),
        interests: friendInterests.slice(0, 12),
        profileUserId: friend.user_id,
        profileHandle: friend.username ?? null,
      };

      queuePlannerInviteDraft(nextMember);
      setStatus("Freund für den Planner vorgemerkt. Die Interessen stehen jetzt für die Gruppenplanung bereit.");
    } finally {
      setFriendActionBusyId(null);
    }
  }

  async function toggleFollowProfile(profile: SocialProfileItem, nextShouldFollow: boolean) {
    if (!authReady || !userId || !profile.id) return;
    setSocialActionBusyId(profile.user_id);
    setStatus(null);
    try {
      if (nextShouldFollow) {
        const { error } = await supabase.from("creator_follows").insert({
          creator_profile_id: profile.id,
          follower_user_id: userId,
        });

        if (error) {
          console.error("Follow from profile overview error:", error);
          setStatus("Profil konnte nicht gefolgt werden.");
          return;
        }

        setFollowingProfiles((prev) =>
          prev.some((item) => item.user_id === profile.user_id) ? prev : [...prev, profile]
        );
      setStatus("Du folgst diesem Profil jetzt.");
      } else {
        const { error } = await supabase
          .from("creator_follows")
          .delete()
          .eq("creator_profile_id", profile.id)
          .eq("follower_user_id", userId);

        if (error) {
          console.error("Unfollow from profile overview error:", error);
          setStatus("Profil konnte nicht entfolgt werden.");
          return;
        }

        setFollowingProfiles((prev) => prev.filter((item) => item.user_id !== profile.user_id));
        setStatus("Du folgst diesem Profil nicht mehr.");
      }
    } finally {
      setSocialActionBusyId(null);
    }
  }

  function toggleFriendSelection(friendUserId: string) {
    setSelectedFriendIds((prev) =>
      prev.includes(friendUserId) ? prev.filter((id) => id !== friendUserId) : [...prev, friendUserId]
    );
  }

  async function saveFriendGroup() {
    if (!authReady || !userId) return;
    if (!groupsFeatureAvailable) return;
    const cleanName = groupNameInput.trim();
    if (!cleanName || selectedFriendIds.length === 0) {
      setStatus("Bitte gib einen Gruppennamen an und wähle mindestens einen Freund.");
      return;
    }

    setGroupActionBusyId("new");
    setStatus(null);
    try {
      const { data: groupRow, error: groupError } = await supabase
        .from("user_groups")
        .insert({
          owner_user_id: userId,
          name: cleanName,
          description: groupDescriptionInput.trim() || null,
        })
        .select("id, owner_user_id, name, description, created_at, updated_at")
        .maybeSingle();

      if (groupError) {
        if (isMissingSocialTableError(groupError)) {
          setGroupsFeatureAvailable(false);
          setSavedGroups([]);
          return;
        }
        console.error(`Save user group error: ${formatSupabaseError(groupError)}`);
        setStatus(`Gruppe konnte nicht gespeichert werden (${summarizeSocialError(groupError)}).`);
        return;
      }

      const savedGroup = (groupRow ?? null) as UserGroupRow | null;
      if (!savedGroup) return;

      const { error: membersError } = await supabase.from("user_group_members").insert(
        selectedFriendIds.map((friendUserId) => ({
          group_id: savedGroup.id,
          member_user_id: friendUserId,
        }))
      );

      if (membersError) {
        if (isMissingSocialTableError(membersError)) {
          setGroupsFeatureAvailable(false);
          setSavedGroups([]);
          return;
        }
        console.error(`Save user group members error: ${formatSupabaseError(membersError)}`);
        setStatus(`Gruppenmitglieder konnten nicht gespeichert werden (${summarizeSocialError(membersError)}).`);
        return;
      }

      const selectedFriends = friends.filter((friend) => selectedFriendIds.includes(friend.user_id));
      setSavedGroups((prev) => [{ ...savedGroup, members: selectedFriends }, ...prev]);
      setGroupNameInput("");
      setGroupDescriptionInput("");
      setSelectedFriendIds([]);
      setStatus("Gruppe gespeichert. Du kannst sie jetzt direkt im Planner öffnen.");
    } finally {
      setGroupActionBusyId(null);
    }
  }

  async function deleteFriendGroup(groupId: string) {
    if (!authReady || !userId) return;
    if (!groupsFeatureAvailable) return;
    setGroupActionBusyId(groupId);
    setStatus(null);
    try {
      const { error } = await supabase.from("user_groups").delete().eq("id", groupId).eq("owner_user_id", userId);
      if (error) {
        if (isMissingSocialTableError(error)) {
          setGroupsFeatureAvailable(false);
          setSavedGroups([]);
          return;
        }
        console.error(`Delete user group error: ${formatSupabaseError(error)}`);
        setStatus(`Gruppe konnte nicht gelöscht werden (${summarizeSocialError(error)}).`);
        return;
      }
      setSavedGroups((prev) => prev.filter((group) => group.id !== groupId));
      setStatus("Gruppe wurde gelöscht.");
    } finally {
      setGroupActionBusyId(null);
    }
  }

  async function openGroupInPlanner(group: SavedGroupWithMembers) {
    setGroupActionBusyId(group.id);
    setStatus(null);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, interests")
        .in(
          "user_id",
          group.members.map((member) => member.user_id)
        );

      if (error) {
        console.error(`Load group planner interests error: ${formatSupabaseError(error)}`);
        setStatus(`Gruppe konnte nicht für den Planner vorbereitet werden (${summarizeSocialError(error)}).`);
        return;
      }

      const profileMap = new Map(
        ((data ?? []) as ProfileRow[]).map((row) => [row.user_id, parseInterests(row)])
      );

      const members: PlannerInviteMemberDraft[] = group.members
        .map((member) => ({
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}_${Math.random()}`,
          name: member.display_name || (member.username ? `@${member.username}` : "Freund"),
          interests: (profileMap.get(member.user_id) ?? []).slice(0, 12),
          profileUserId: member.user_id,
          profileHandle: member.username ?? null,
        }))
        .filter((member) => member.interests.length > 0);

      if (members.length === 0) {
        setStatus("Diese Gruppe hat aktuell keine nutzbaren Interessenprofile.");
        return;
      }

      writePlannerGroupImport({
        label: group.name,
        members,
      });
      setStatus("Gruppe für den Planner vorbereitet. Die gemeinsamen Interessen sind jetzt übernommen.");
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    } finally {
      setGroupActionBusyId(null);
    }
  }

  async function startOAuth(nextProvider: "google" | "azure") {
    setAuthLoading(true);
    setStatus(null);
    try {
      const { data } = await supabase.auth.getSession();
      const currentUser = data.session?.user ?? null;
      if (currentUser && (currentUser as { is_anonymous?: boolean }).is_anonymous) {
        try {
          localStorage.setItem(ANON_PROFILE_TRANSFER_KEY, currentUser.id);
        } catch {}
      }
      const redirectTo = `${window.location.origin}/profile`;
      const { error } = await supabase.auth.signInWithOAuth({ provider: nextProvider, options: { redirectTo } });
      if (error) {
        console.error("OAuth start error:", error);
        setStatus(`Login mit ${providerLabel(nextProvider)} konnte nicht gestartet werden.`);
      }
    } finally {
      setAuthLoading(false);
    }
  }

  async function signOut() {
    setAuthLoading(true);
    setStatus(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Sign-out error:", error);
        setStatus("Abmeldung fehlgeschlagen.");
        return;
      }
      setStatus("Du wurdest abgemeldet.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function signUpWithEmail() {
    const nextEmail = authEmailInput.trim();
    const nextPassword = authPasswordInput;
    if (!nextEmail || !nextPassword) {
      setStatus("Bitte E-Mail und Passwort eingeben.");
      return;
    }
    if (nextPassword.length < 8) {
      setStatus("Das Passwort sollte mindestens 8 Zeichen lang sein.");
      return;
    }

    setAuthLoading(true);
    setStatus(null);
    try {
      const { data } = await supabase.auth.getSession();
      const currentUser = data.session?.user ?? null;
      if (currentUser && (currentUser as { is_anonymous?: boolean }).is_anonymous) {
        try {
          localStorage.setItem(ANON_PROFILE_TRANSFER_KEY, currentUser.id);
        } catch {}
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.error("Anonymous sign-out before sign-up failed:", signOutError);
          setStatus("Der Gastzugang konnte vor der Registrierung nicht sauber beendet werden.");
          return;
        }
      }

      const { data: signUpData, error } = await supabase.auth.signUp({
        email: nextEmail,
        password: nextPassword,
        options: { emailRedirectTo: `${window.location.origin}/profile` },
      });
      if (error) {
        console.error("Email sign-up error:", error);
        setStatus(`Registrierung fehlgeschlagen: ${friendlyAuthMessage(error.message)}`);
        return;
      }
      if (signUpData.user && Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0) {
        setStatus("Für diese E-Mail gibt es bereits ein Konto. Bitte melde dich an oder setze dein Passwort zurück.");
        return;
      }
      setStatus("Registrierung gestartet. Falls E-Mail-Bestätigung aktiv ist, prüfe bitte dein Postfach. Danach kannst du dich direkt anmelden.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function signInWithEmail() {
    const nextEmail = authEmailInput.trim();
    const nextPassword = authPasswordInput;
    if (!nextEmail || !nextPassword) {
      setStatus("Bitte E-Mail und Passwort eingeben.");
      return;
    }

    setAuthLoading(true);
    setStatus(null);
    try {
      const { data } = await supabase.auth.getSession();
      const currentUser = data.session?.user ?? null;
      if (currentUser && (currentUser as { is_anonymous?: boolean }).is_anonymous) {
        try {
          localStorage.setItem(ANON_PROFILE_TRANSFER_KEY, currentUser.id);
        } catch {}
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.error("Anonymous sign-out before sign-in failed:", signOutError);
          setStatus("Der Gastzugang konnte vor dem Login nicht sauber beendet werden.");
          return;
        }
      }

      const { error } = await supabase.auth.signInWithPassword({ email: nextEmail, password: nextPassword });
      if (error) {
        console.error("Email sign-in error:", error);
        setStatus(`Login fehlgeschlagen: ${friendlyAuthMessage(error.message)}`);
        return;
      }
      setStatus("Erfolgreich angemeldet.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function resetPassword() {
    const nextEmail = authEmailInput.trim();
    if (!nextEmail) {
      setStatus("Bitte gib zuerst deine E-Mail-Adresse ein.");
      return;
    }
    setAuthLoading(true);
    setStatus(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(nextEmail, { redirectTo: `${window.location.origin}/profile` });
      if (error) {
        console.error("Password reset error:", error);
        setStatus(`Passwort-Reset fehlgeschlagen: ${friendlyAuthMessage(error.message)}`);
        return;
      }
      setStatus("Wenn ein Konto existiert, wurde dir eine E-Mail zum Zurücksetzen des Passworts gesendet.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function continueAsGuest() {
    setAuthLoading(true);
    setStatus(null);
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error("Anonymous sign-in error:", error);
        setStatus("Gastzugang konnte nicht gestartet werden.");
        return;
      }
      setStatus("Gastzugang gestartet. Du kannst das Produkt jetzt direkt ausprobieren.");
    } finally {
      setAuthLoading(false);
    }
  }

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <section className="pd24-shell p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Konto & Zugang</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
              Verbinde hier dein Konto, sichere dein Profil dauerhaft und behalte im Blick, wie viele Routen,
              Freunde und Social-Verbindungen aktuell aktiv sind.
            </p>
          </div>

          <div className="w-full max-w-xl rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-panel)] p-4">
            <div className="text-sm font-medium">Klassische Registrierung</div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input value={authEmailInput} onChange={(e) => setAuthEmailInput(e.target.value)} placeholder="E-Mail" className="rounded-xl border border-[var(--line-subtle)] bg-white p-3" />
              <input type="password" value={authPasswordInput} onChange={(e) => setAuthPasswordInput(e.target.value)} placeholder="Passwort" className="rounded-xl border border-[var(--line-subtle)] bg-white p-3" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => void signUpWithEmail()} disabled={authLoading} className="rounded-xl bg-[var(--text-strong)] px-4 py-2 text-sm text-white transition hover:opacity-95 disabled:opacity-50">Registrieren</button>
              <button onClick={() => void signInWithEmail()} disabled={authLoading} className="rounded-xl border border-[var(--line-subtle)] px-4 py-2 text-sm hover:bg-white disabled:opacity-50">Mit E-Mail anmelden</button>
              <button onClick={() => void resetPassword()} disabled={authLoading} className="rounded-xl border border-[var(--line-subtle)] px-4 py-2 text-sm hover:bg-white disabled:opacity-50">Passwort zuruecksetzen</button>
            </div>
            <div className="mt-4 text-sm font-medium">Oder per OAuth</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => void startOAuth("google")} disabled={authLoading} className="rounded-xl border border-[var(--line-subtle)] px-4 py-2 text-sm hover:bg-white disabled:opacity-50">Mit Google anmelden</button>
              <button onClick={() => void startOAuth("azure")} disabled={authLoading} className="rounded-xl border border-[var(--line-subtle)] px-4 py-2 text-sm hover:bg-white disabled:opacity-50">Mit Microsoft anmelden</button>
              <button onClick={() => void signOut()} disabled={authLoading || !authReady || !userId} className="rounded-xl border border-[var(--line-subtle)] px-4 py-2 text-sm hover:bg-white disabled:opacity-50">Abmelden</button>
              <button onClick={() => void continueAsGuest()} disabled={authLoading} className="rounded-xl border border-[var(--line-subtle)] px-4 py-2 text-sm hover:bg-white disabled:opacity-50">Als Gast fortfahren</button>
            </div>
            <div className="mt-3 text-xs text-[var(--text-muted)]">Der Gastzugang ist optional. Für ein dauerhaftes Profil empfehlen wir E-Mail, Google oder Microsoft.</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl bg-[var(--bg-panel)] p-4">
            <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Konto</div>
            <div className="mt-1 text-sm font-medium">{authReady ? (isAnonymous ? "Gastprofil" : "Verbundenes Profil") : "Wird geladen..."}</div>
            <div className="mt-2 text-xs text-[var(--text-muted)]">Provider: {provider ? providerLabel(provider) : "-"}</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">E-Mail: {email ?? "Keine E-Mail verfügbar"}</div>
            {isAnonymous ? <div className="mt-2 text-xs text-[var(--state-warning)]">Du bist aktuell anonym unterwegs. Mit E-Mail, Google oder Microsoft kannst du dein Profil dauerhaft sichern.</div> : null}
          </div>

          <div className="rounded-xl bg-[var(--bg-panel)] p-4">
            <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Routen</div>
            <div className="mt-1 text-sm font-medium">
              {loadingProfile ? "Profil wird geladen..." : `${userRoutes.length} erstellt · ${bookmarkedRoutes.length} gespeichert`}
            </div>
            <div className="mt-2 text-xs text-[var(--text-muted)]">Beide Listen kannst du weiter unten direkt durchsuchen und öffnen.</div>
          </div>

          <div className="rounded-xl bg-[var(--bg-panel)] p-4">
            <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Freunde</div>
            <div className="mt-1 text-sm font-medium">{friendsLoading ? "Lädt..." : friends.length}</div>
            <div className="mt-2 text-xs text-[var(--text-muted)]">Direkt für Gruppenplanungen nutzbar.</div>
          </div>

          <div className="rounded-xl bg-[var(--bg-panel)] p-4">
            <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Social</div>
            <div className="mt-1 text-sm font-medium">
              {socialLoading ? "Lädt..." : `${followingProfiles.length} folgst du · ${followerProfiles.length} Follower`}
            </div>
            <div className="mt-2 text-xs text-[var(--text-muted)]">Creator- und Nutzerbeziehungen auf einen Blick.</div>
          </div>
        </div>

        {status ? <div className="mt-4 rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-3 py-2 text-sm text-[var(--text-muted)]">{status}</div> : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.88fr,1.12fr]">
        <div className="space-y-6">
          <section className="pd24-shell p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Dein Profil</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Dein internes Profil bündelt Konto, Interessen und die Signale, die wir für bessere Planungen
                  heranziehen.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-[170px,1fr]">
              <div className="rounded-[24px] border border-[var(--line-subtle)] bg-[var(--bg-panel)] p-4">
                <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Interessen</div>
                <div className="mt-1 text-3xl font-semibold text-[var(--text-strong)]">{interests.length}</div>
                <div className="mt-2 text-xs text-[var(--text-muted)]">Aktive Vorlieben für neue Vorschläge.</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {interestPreview.length > 0 ? (
                    <>
                      {interestPreview.map((interest) => (
                        <span
                          key={`interest-preview-${interest}`}
                          className="rounded-full border border-[var(--line-subtle)] bg-white px-2.5 py-1 text-[11px] text-[var(--text-muted)]"
                        >
                          {interest}
                        </span>
                      ))}
                      {interests.length > interestPreview.length ? (
                        <span className="rounded-full border border-[var(--line-subtle)] bg-white px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
                          +{interests.length - interestPreview.length}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <div className="text-xs text-[var(--text-muted)]">Noch keine Vorlieben gespeichert.</div>
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-5">
                <div className="flex items-start gap-4">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName || username || "Avatar"}
                      className="h-16 w-16 rounded-2xl border border-[var(--line-subtle)] bg-white object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-panel)] text-xl font-semibold text-[var(--text-muted)]">
                      {(displayName || username || "P").slice(0, 1).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-semibold text-[var(--text-strong)]">
                      {displayName || "Dein Name"}
                    </div>
                    <div className="mt-1 text-sm text-[var(--text-muted)]">
                      {username ? `@${username}` : "Noch kein Username"}
                    </div>
                    <div className="mt-2 text-sm text-[var(--text-muted)]">
                      {email ?? "Keine E-Mail verfügbar"}
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      Provider: {provider ? providerLabel(provider) : "-"}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-[var(--bg-panel)] p-3">
                    <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Konto</div>
                    <div className="mt-1 text-sm font-medium">
                      {authReady ? (isAnonymous ? "Gastprofil" : "Verbundenes Profil") : "Wird geladen..."}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-[var(--bg-panel)] p-3">
                    <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Freunde</div>
                    <div className="mt-1 text-sm font-medium">{friendsLoading ? "Lädt..." : friends.length}</div>
                  </div>
                  <div className="rounded-2xl bg-[var(--bg-panel)] p-3">
                    <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Social</div>
                    <div className="mt-1 text-sm font-medium">
                      {socialLoading ? "Lädt..." : `${followingProfiles.length} · ${followerProfiles.length}`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="pd24-shell p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Interessen</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Diese Auswahl wird für neue Planungen und Gruppenkonstellationen direkt mitgenommen.
                </p>
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                {savingProfile ? "Speichert..." : `Max. 12 · aktuell ${interests.length}`}
              </div>
            </div>

            <div className="mt-5 rounded-[24px] border border-[var(--line-subtle)] bg-[var(--bg-panel)] p-4">
              <div className="max-h-[25rem] space-y-5 overflow-y-auto pr-1">
                {Object.entries(interestCatalog).map(([group, tags]) => (
                  <div key={group}>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      {interestGroupLabels[group] ?? group}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => {
                        const active = interests.includes(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => toggleInterest(tag)}
                            className={`rounded-full border px-3 py-2 text-sm ${
                              active
                                ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                                : "bg-white hover:bg-[var(--bg-panel)]"
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <input
                  value={interestInput}
                  onChange={(e) => setInterestInput(e.target.value)}
                  placeholder="Eigene Vorliebe hinzufügen"
                  className="flex-1 rounded-xl border border-[var(--line-subtle)] bg-white p-3"
                />
                <button
                  onClick={addCustomInterest}
                  className="rounded-xl bg-[var(--text-strong)] px-4 py-3 text-sm text-white transition hover:opacity-95"
                >
                  Hinzufügen
                </button>
              </div>

              <div className="mt-3 text-sm text-[var(--text-muted)]">
                Aktiv:{" "}
                {interests.length
                  ? interests.join(", ")
                  : "Noch keine Interessen gespeichert. Wähle ein paar klare Vorlieben als Grundlage für bessere Vorschläge."}
              </div>
            </div>
          </section>
        </div>

        <section className="pd24-shell p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Öffentliches Profil</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Diese Daten sehen andere Nutzer in deinem öffentlichen Profil, in Creator-Links und bei Einladungen.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {username ? (
                <Link
                  href={`/u/${username}`}
                  className="rounded-xl border border-[var(--line-subtle)] px-3 py-2 text-sm hover:bg-white"
                >
                  Öffentliches Profil ansehen
                </Link>
              ) : null}
              <button
                onClick={() => void saveCreatorProfile()}
                disabled={savingProfile || !authReady || !userId}
                className="rounded-xl bg-[var(--text-strong)] px-4 py-2 text-sm text-white transition hover:opacity-95 disabled:opacity-50"
              >
                Profil speichern
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-6 md:grid-cols-[220px,1fr]">
            <div className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-panel)] p-4">
              <div className="flex flex-col items-center text-center">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName || username || "Avatar"}
                    className="h-28 w-28 rounded-full border bg-white object-cover"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-full border bg-white text-3xl font-semibold text-[var(--text-muted)]">
                    {(displayName || username || "P").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="mt-3 text-base font-semibold">{displayName || "Dein Name"}</div>
                <div className="mt-1 text-sm text-[var(--text-muted)]">
                  {username ? `@${username}` : "Noch kein Username"}
                </div>
                <div className="mt-3 min-h-5 text-xs">
                  {usernameChecking ? (
                    <span className="text-[var(--text-muted)]">Username wird geprüft...</span>
                  ) : usernameError ? (
                    <span className="text-red-600">{usernameError}</span>
                  ) : username && usernameAvailable ? (
                    <span className="text-[var(--state-success)]">Username ist verfügbar.</span>
                  ) : (
                    <span className="text-[var(--text-muted)]">
                      Nur Buchstaben, Zahlen, Punkt, Unterstrich und Bindestrich.
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Anzeigename</span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="z. B. Alex Bugajew"
                    className="rounded-xl border border-[var(--line-subtle)] p-3"
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Username</span>
                  <input
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setUsernameError(null);
                    }}
                    placeholder="z. B. alex"
                    className="rounded-xl border border-[var(--line-subtle)] p-3"
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm">
                <span className="font-medium">Avatar-URL</span>
                <input
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                  className="rounded-xl border border-[var(--line-subtle)] p-3"
                />
              </label>

              <div className="grid gap-2 text-sm">
                <span className="font-medium">Avatar hochladen</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleAvatarFileSelection(e.target.files?.[0] ?? null)}
                  className="rounded-xl border border-[var(--line-subtle)] p-3"
                />
                <span className="text-xs text-[var(--text-muted)]">
                  Lädt das Bild in den Supabase-Bucket <span className="font-mono">{AVATAR_BUCKET}</span>.
                  {avatarUploading ? " Upload läuft..." : ""}
                </span>
              </div>

              {selectedAvatarPreview ? (
                <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-panel)] p-4">
                  <div className="text-sm font-medium">Avatar-Vorschau</div>
                  <div className="mt-3 flex flex-col gap-4 md:flex-row">
                    <div className="relative h-56 w-56 overflow-hidden rounded-2xl border bg-white">
                      <img
                        src={selectedAvatarPreview}
                        alt="Avatar Vorschau"
                        className="absolute left-1/2 top-1/2 h-full w-full object-cover"
                        style={{
                          transform: `translate(calc(-50% + ${cropOffsetX}px), calc(-50% + ${cropOffsetY}px)) scale(${cropScale})`,
                          transformOrigin: "center center",
                        }}
                      />
                    </div>
                    <div className="flex-1 space-y-4">
                      <label className="grid gap-2 text-sm">
                        <span>Zoom</span>
                        <input
                          type="range"
                          min={1}
                          max={2.4}
                          step={0.05}
                          value={cropScale}
                          onChange={(e) => setCropScale(Number(e.target.value))}
                        />
                      </label>
                      <label className="grid gap-2 text-sm">
                        <span>Horizontal verschieben</span>
                        <input
                          type="range"
                          min={-120}
                          max={120}
                          step={1}
                          value={cropOffsetX}
                          onChange={(e) => setCropOffsetX(Number(e.target.value))}
                        />
                      </label>
                      <label className="grid gap-2 text-sm">
                        <span>Vertikal verschieben</span>
                        <input
                          type="range"
                          min={-120}
                          max={120}
                          step={1}
                          value={cropOffsetY}
                          onChange={(e) => setCropOffsetY(Number(e.target.value))}
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void uploadCroppedAvatar()}
                          disabled={avatarUploading}
                          className="rounded-xl bg-[var(--text-strong)] px-4 py-2 text-sm text-white transition hover:opacity-95 disabled:opacity-50"
                        >
                          Gecroppt hochladen
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAvatarFileSelection(null)}
                          className="rounded-xl border border-[var(--line-subtle)] px-4 py-2 text-sm hover:bg-white"
                        >
                          Verwerfen
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <label className="grid gap-2 text-sm">
                <span className="font-medium">Kurz-Bio</span>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Ein kurzer Satz über dich"
                  rows={4}
                  className="rounded-xl border border-[var(--line-subtle)] p-3"
                />
              </label>
            </div>
          </div>
        </section>
      </div>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="pd24-shell p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Deine erstellten Routen</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Kompakte Übersicht deiner eigenen Routen aus dem Route Builder, inklusive schneller Links und Filter.
              </p>
            </div>
            <Link href="/routes" className="rounded-xl border border-[var(--line-subtle)] px-4 py-2 text-sm hover:bg-[var(--bg-panel)]">
              Create Route öffnen
            </Link>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row">
            <input
              value={createdRouteQuery}
              onChange={(e) => setCreatedRouteQuery(e.target.value)}
              placeholder="Routen durchsuchen"
              className="flex-1 rounded-xl border border-[var(--line-subtle)] p-3 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {(["all", "public", "unlisted", "private"] as CreatedRouteFilter[]).map((filter) => {
                const label =
                  filter === "all" ? "Alle" : formatRouteVisibilityLabel(filter as UserRouteRow["visibility"]);
                const active = createdRouteFilter === filter;
                return (
                  <button
                    key={`created-filter-${filter}`}
                    type="button"
                    onClick={() => setCreatedRouteFilter(filter)}
                    className={`rounded-full border px-3 py-2 text-sm transition ${
                      active
                        ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                        : "border-[var(--line-subtle)] bg-white text-[var(--text-strong)] hover:bg-[var(--bg-panel)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {userRoutes.length > 0 ? (
            <div className="mt-5 rounded-[24px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-3">
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <div className="text-sm font-medium">Gefundene Routen</div>
                <div className="text-xs text-[var(--text-muted)]">{filteredUserRoutes.length} sichtbar</div>
              </div>
              <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
                {filteredUserRoutes.length > 0 ? (
                  filteredUserRoutes.map((route) => (
                    <ProfileRouteListItem
                      key={route.id}
                      route={route}
                      primaryHref={`/routes?routeId=${route.id}`}
                      primaryLabel="Im Builder öffnen"
                      secondaryHref={route.slug ? `/routes/${route.slug}` : null}
                      secondaryLabel={route.slug ? "Öffentlich ansehen" : undefined}
                    />
                  ))
                ) : (
                  <div className="rounded-[20px] border border-dashed border-[var(--line-subtle)] bg-white px-4 py-8 text-sm text-[var(--text-muted)]">
                    Für diesen Filter gibt es gerade keine passende erstellte Route.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-5 text-sm text-[var(--text-muted)]">
              Noch keine eigenen Routen gespeichert. Erstelle im Builder deinen ersten wiederverwendbaren Ablauf.
            </div>
          )}
        </div>

        <div className="pd24-shell p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Deine gespeicherten Routen</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Gespeicherte Vorlagen aus Explore und geteilten Links, ebenfalls in einer kompakten Scrollliste.
              </p>
            </div>
            <Link href="/explore" className="rounded-xl border border-[var(--line-subtle)] px-4 py-2 text-sm hover:bg-[var(--bg-panel)]">
              Routen entdecken
            </Link>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row">
            <input
              value={savedRouteQuery}
              onChange={(e) => setSavedRouteQuery(e.target.value)}
              placeholder="Gespeicherte Routen durchsuchen"
              className="flex-1 rounded-xl border border-[var(--line-subtle)] p-3 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {([
                ["all", "Alle"],
                ["with-city", "Mit Stadt"],
                ["with-description", "Mit Text"],
              ] as const).map(([filter, label]) => {
                const active = savedRouteFilter === filter;
                return (
                  <button
                    key={`saved-filter-${filter}`}
                    type="button"
                    onClick={() => setSavedRouteFilter(filter)}
                    className={`rounded-full border px-3 py-2 text-sm transition ${
                      active
                        ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                        : "border-[var(--line-subtle)] bg-white text-[var(--text-strong)] hover:bg-[var(--bg-panel)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {bookmarkedRoutes.length > 0 ? (
            <div className="mt-5 rounded-[24px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-3">
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <div className="text-sm font-medium">Gespeicherte Vorlagen</div>
                <div className="text-xs text-[var(--text-muted)]">{filteredBookmarkedRoutes.length} sichtbar</div>
              </div>
              <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
                {filteredBookmarkedRoutes.length > 0 ? (
                  filteredBookmarkedRoutes.map((route) => (
                    <ProfileRouteListItem
                      key={route.id}
                      route={route}
                      primaryHref={route.slug ? `/routes/${route.slug}` : null}
                      primaryLabel="Route öffnen"
                    />
                  ))
                ) : (
                  <div className="rounded-[20px] border border-dashed border-[var(--line-subtle)] bg-white px-4 py-8 text-sm text-[var(--text-muted)]">
                    Für diesen Filter gibt es gerade keine passende gespeicherte Route.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-5 text-sm text-[var(--text-muted)]">
              Noch keine geteilten Routen gespeichert. Merke dir in Explore interessante Vorlagen für später.
            </div>
          )}
        </div>
      </section>

      <section className="pd24-shell p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Deine Freunde</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Verwalte deine Freunde und übernimm sie schneller in Gruppenplanungen.
            </p>
          </div>
          <Link
            href="/invite"
            className="rounded-xl border border-[var(--line-subtle)] px-4 py-2 text-sm text-[var(--text-strong)] transition hover:bg-white"
          >
            Profile entdecken
          </Link>
        </div>

        {friendsLoading ? (
          <div className="mt-4 text-sm text-[var(--text-muted)]">Freunde werden geladen...</div>
        ) : friends.length > 0 ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {friends.map((friend) => (
              <div key={friend.friendshipId} className="pd24-card p-4">
                <div className="flex items-start gap-3">
                  {friend.avatar_url ? (
                    <img
                      src={friend.avatar_url}
                      alt={friend.display_name || friend.username || "Freund"}
                      className="h-14 w-14 rounded-full border border-[var(--line-subtle)] object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] text-lg font-semibold text-[var(--text-muted)]">
                      {(friend.display_name || friend.username || "F").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                      {friend.display_name || friend.username || "Freund"}
                    </div>
                    <div className="text-sm text-[var(--text-muted)]">
                      {friend.username ? `@${friend.username}` : friend.user_id}
                    </div>
                    {friend.bio ? (
                      <div className="mt-2 line-clamp-2 text-sm text-[var(--text-muted)]">{friend.bio}</div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/chat?user=${friend.user_id}`}
                    className="rounded-xl border border-[var(--line-subtle)] px-3 py-2 text-sm text-[var(--text-strong)] transition hover:bg-white"
                  >
                    Chat öffnen
                  </Link>
                  <button
                    type="button"
                    onClick={() => void addFriendToPlanner(friend)}
                    disabled={friendActionBusyId === friend.friendshipId}
                    className="rounded-xl border border-[var(--line-subtle)] px-3 py-2 text-sm text-[var(--text-strong)] transition hover:bg-white disabled:opacity-50"
                  >
                    In Planner übernehmen
                  </button>
                  {friend.username ? (
                    <Link
                      href={`/u/${friend.username}`}
                      className="rounded-xl border border-[var(--line-subtle)] px-3 py-2 text-sm text-[var(--text-strong)] transition hover:bg-white"
                    >
                      Profil ansehen
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void removeFriend(friend.friendshipId)}
                    disabled={friendActionBusyId === friend.friendshipId}
                    className="rounded-xl border border-[var(--line-subtle)] px-3 py-2 text-sm text-[var(--text-strong)] transition hover:bg-white disabled:opacity-50"
                  >
                    Entfernen
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 text-sm text-[var(--text-muted)]">
            Noch keine Freunde hinterlegt. Ergänze Kontakte, damit Gruppenplanung und Direktchat schneller starten.
          </div>
        )}
      </section>

      {groupsFeatureAvailable ? (
        <section className="pd24-shell p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Deine Gruppen</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Speichere wiederverwendbare Freundesgruppen und öffne sie direkt im Planner.
              </p>
            </div>
            <Link
              href="/planner"
              className="rounded-xl border border-[var(--line-subtle)] px-4 py-2 text-sm text-[var(--text-strong)] transition hover:bg-white"
            >
              Planner öffnen
            </Link>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-4 rounded-[24px] border border-[var(--line-subtle)] bg-[var(--bg-panel)] p-4">
              <div className="text-sm font-medium">Neue Gruppe speichern</div>
              <input
                value={groupNameInput}
                onChange={(e) => setGroupNameInput(e.target.value)}
                placeholder="z. B. Berlin Crew"
                className="w-full rounded-xl border border-[var(--line-subtle)] bg-white p-3 text-[var(--text-strong)] outline-none transition focus:border-[var(--line-strong)]"
              />
              <textarea
                value={groupDescriptionInput}
                onChange={(e) => setGroupDescriptionInput(e.target.value)}
                placeholder="Kurze Beschreibung oder Anlass"
                rows={3}
                className="w-full rounded-xl border border-[var(--line-subtle)] bg-white p-3 text-[var(--text-strong)] outline-none transition focus:border-[var(--line-strong)]"
              />

              <div>
                <div className="mb-2 text-sm font-medium">Freunde auswählen</div>
                <div className="flex flex-wrap gap-2">
                  {friends.length > 0 ? (
                    friends.map((friend) => {
                      const active = selectedFriendIds.includes(friend.user_id);
                      return (
                        <button
                          key={`friend-select-${friend.user_id}`}
                          type="button"
                          onClick={() => toggleFriendSelection(friend.user_id)}
                          className={`rounded-full border px-3 py-2 text-sm transition ${
                            active
                              ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                              : "border-[var(--line-subtle)] bg-white text-[var(--text-strong)] hover:bg-[var(--bg-surface)]"
                          }`}
                        >
                          {friend.display_name || (friend.username ? `@${friend.username}` : "Freund")}
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-sm text-[var(--text-muted)]">Füge zuerst Freunde hinzu, um Gruppen zu speichern.</div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void saveFriendGroup()}
                disabled={groupActionBusyId === "new" || selectedFriendIds.length === 0 || groupNameInput.trim().length === 0}
                className="rounded-xl bg-[var(--text-strong)] px-4 py-2 text-sm text-white transition hover:opacity-95 disabled:opacity-50"
              >
                {groupActionBusyId === "new" ? "Speichert..." : "Gruppe speichern"}
              </button>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold">Gespeicherte Gruppen</h3>
                <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-3 py-1 text-xs text-[var(--text-muted)]">
                  {savedGroups.length}
                </span>
              </div>

              {groupsLoading ? (
                <div className="text-sm text-[var(--text-muted)]">Gruppen werden geladen...</div>
              ) : savedGroups.length > 0 ? (
                <div className="space-y-3">
                  {savedGroups.map((group) => (
                    <div key={group.id} className="pd24-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{group.name}</div>
                          {group.description ? (
                            <div className="mt-1 text-sm text-[var(--text-muted)]">{group.description}</div>
                          ) : null}
                          <div className="mt-2 text-xs text-[var(--text-muted)]">
                            {group.members.length} Mitglieder · zuletzt aktualisiert{" "}
                            {group.updated_at ? new Date(group.updated_at).toLocaleDateString("de-DE") : "–"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {group.members.map((member) => (
                          <span key={`${group.id}-${member.user_id}`} className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-panel)] px-3 py-1 text-xs text-[var(--text-muted)]">
                            {member.display_name || (member.username ? `@${member.username}` : "Freund")}
                          </span>
                        ))}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void openGroupInPlanner(group)}
                          disabled={groupActionBusyId === group.id}
                          className="rounded-xl border border-[var(--line-subtle)] px-3 py-2 text-sm text-[var(--text-strong)] transition hover:bg-white disabled:opacity-50"
                        >
                          Im Planner öffnen
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteFriendGroup(group.id)}
                          disabled={groupActionBusyId === group.id}
                          className="rounded-xl border border-[var(--line-subtle)] px-3 py-2 text-sm text-[var(--text-strong)] transition hover:bg-white disabled:opacity-50"
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[var(--text-muted)]">Noch keine gespeicherten Gruppen vorhanden. Lege eine wiederverwendbare Konstellation für gemeinsame Planungen an.</div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className="pd24-shell p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Social-Übersicht</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Hier siehst du, wem du folgst und welche Profile dir folgen.
            </p>
          </div>
          <Link
            href="/explore"
            className="rounded-xl border border-[var(--line-subtle)] px-4 py-2 text-sm text-[var(--text-strong)] transition hover:bg-white"
          >
            Explore öffnen
          </Link>
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Folge ich</h3>
              <span className="rounded-full border bg-[var(--bg-panel)] px-3 py-1 text-xs text-[var(--text-muted)]">
                {followingProfiles.length}
              </span>
            </div>
            {socialLoading ? (
              <div className="text-sm text-[var(--text-muted)]">Folgt-Profile werden geladen...</div>
            ) : followingProfiles.length > 0 ? (
              <div className="space-y-3">
                {followingProfiles.map((profile) => (
                  <div key={`following-${profile.user_id}`} className="rounded-xl border p-4">
                    <div className="flex items-start gap-3">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.display_name || profile.username || "Profil"}
                          className="h-12 w-12 rounded-full border object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-[var(--bg-panel)] text-sm font-semibold text-[var(--text-muted)]">
                          {(profile.display_name || profile.username || "P").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">
                          {profile.display_name || profile.username || "Profil"}
                        </div>
                        <div className="text-sm text-[var(--text-muted)]">
                          {profile.username ? `@${profile.username}` : profile.user_id}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {profile.username ? (
                        <Link href={`/u/${profile.username}`} className="rounded-lg border px-3 py-2 text-sm hover:bg-[var(--bg-panel)]">
                          Profil ansehen
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void toggleFollowProfile(profile, false)}
                        disabled={socialActionBusyId === profile.user_id}
                        className="rounded-lg border px-3 py-2 text-sm hover:bg-[var(--bg-panel)] disabled:opacity-50"
                      >
                        Entfolgen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-[var(--text-muted)]">Du folgst aktuell noch keinen Profilen. Nutze Explore, um interessante Creator oder Kontakte zu entdecken.</div>
            )}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Follower</h3>
              <span className="rounded-full border bg-[var(--bg-panel)] px-3 py-1 text-xs text-[var(--text-muted)]">
                {followerProfiles.length}
              </span>
            </div>
            {socialLoading ? (
              <div className="text-sm text-[var(--text-muted)]">Follower werden geladen...</div>
            ) : followerProfiles.length > 0 ? (
              <div className="space-y-3">
                {followerProfiles.map((profile) => (
                  <div key={`follower-${profile.user_id}`} className="rounded-xl border p-4">
                    <div className="flex items-start gap-3">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.display_name || profile.username || "Profil"}
                          className="h-12 w-12 rounded-full border object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-[var(--bg-panel)] text-sm font-semibold text-[var(--text-muted)]">
                          {(profile.display_name || profile.username || "P").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">
                          {profile.display_name || profile.username || "Profil"}
                        </div>
                        <div className="text-sm text-[var(--text-muted)]">
                          {profile.username ? `@${profile.username}` : profile.user_id}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {profile.username ? (
                        <Link href={`/u/${profile.username}`} className="rounded-lg border px-3 py-2 text-sm hover:bg-[var(--bg-panel)]">
                          Profil ansehen
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          void toggleFollowProfile(
                            profile,
                            !followingProfiles.some((item) => item.user_id === profile.user_id)
                          )
                        }
                        disabled={socialActionBusyId === profile.user_id}
                        className="rounded-lg border px-3 py-2 text-sm hover:bg-[var(--bg-panel)] disabled:opacity-50"
                      >
                        {followingProfiles.some((item) => item.user_id === profile.user_id)
                          ? "Schon gefolgt"
                          : "Zurück folgen"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-[var(--text-muted)]">Dir folgt aktuell noch niemand. Mit einem gepflegten Profil und ersten Routen wird dein Auftritt sichtbarer.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}



