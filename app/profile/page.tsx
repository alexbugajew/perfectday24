"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { getInterestCatalog, norm } from "@/lib/planner";
import { supabase } from "@/lib/supabaseClient";
import { deleteRoadtripRoute, fetchMyRoadtripRoutes } from "@/lib/roadtrip/client";
import type { RoadtripRoute } from "@/lib/roadtrip/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

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

const AVATAR_BUCKET = "avatars";

// ─── Pure helpers ──────────────────────────────────────────────────────────────

function parseInterests(row: ProfileRow | null | undefined): string[] {
  const arr = Array.isArray(row?.interests) ? row.interests : [];
  return arr.map((x) => norm(String(x))).filter(Boolean);
}

function providerLabel(provider: string): string {
  if (provider === "google") return "Google";
  if (provider === "azure") return "Microsoft";
  if (provider === "email") return "E-Mail";
  if (provider === "anonymous") return "Gast";
  return provider;
}

function friendlyAuthMessage(raw: string): string {
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
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(
        (value) => {
          if (!value) { reject(new Error("CompressionFailed")); return; }
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

function buildFallbackUsername(userId: string, preferred?: string | null): string {
  const clean = norm(preferred ?? "").replace(/[^a-z0-9._-]+/g, "");
  if (clean.length >= 3) return clean;
  return `user-${userId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase()}`;
}

function buildFallbackDisplayName(
  userId: string,
  preferred?: string | null,
  username?: string | null
): string {
  const cleanPreferred = (preferred ?? "").trim();
  if (cleanPreferred) return cleanPreferred;
  const cleanUsername = (username ?? "").trim();
  if (cleanUsername) return cleanUsername;
  return `User ${userId.replace(/[^a-z0-9]/gi, "").slice(0, 6)}`;
}

type CreatedRouteFilter = "all" | UserRouteRow["visibility"];
type SavedRouteFilter = "all" | "with-city" | "with-description";
type StudioTab = "routes" | "roadtrips" | "events";

type EventPlanRow = {
  id: string;
  title: string | null;
  occasion_slug: string;
  city_slug: string | null;
  event_date: string | null;
  guest_count: number | null;
  status: string;
  created_at: string;
};

function formatRouteTitle(route: UserRouteRow): string {
  return route.title?.trim() || "Untitled Route";
}

function formatRouteVisibilityLabel(visibility: UserRouteRow["visibility"]): string {
  if (visibility === "public") return "Öffentlich";
  if (visibility === "unlisted") return "Unlisted";
  return "Privat";
}

function formatRouteCityLabel(citySlug: string | null): string {
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

function routeTileTone(visibility: UserRouteRow["visibility"]): string {
  if (visibility === "public") return "border-emerald-200 bg-emerald-50";
  if (visibility === "unlisted") return "border-amber-200 bg-amber-50";
  return "border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)]";
}

// ─── Route list item ───────────────────────────────────────────────────────────

type ProfileRouteListItemProps = {
  route: UserRouteRow;
  primaryHref?: string | null;
  primaryLabel: string;
  secondaryHref?: string | null;
  secondaryLabel?: string;
  onDelete: (id: string) => Promise<void>;
  deleteLabel?: string;
};

const TILE_TONE: Record<UserRouteRow["visibility"], string> = {
  public:   "border-emerald-200 bg-emerald-50 text-emerald-700",
  unlisted: "border-amber-200 bg-amber-50 text-amber-700",
  private:  "border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] text-[var(--text-muted-warm)]",
};

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round"
      strokeLinejoin="round" className="h-3.5 w-3.5"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function ProfileRouteListItem({
  route,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  onDelete,
  deleteLabel = "Route löschen",
}: ProfileRouteListItemProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  const title     = formatRouteTitle(route);
  const cityLabel = formatRouteCityLabel(route.city_slug);

  async function handleDelete() {
    setDeleting(true);
    await onDelete(route.id);
    setDeleting(false);
    setConfirming(false);
  }

  return (
    <div
      className={`rounded-[var(--radius-control)] border bg-[var(--bg-panel-strong)] p-3 transition ${
        confirming
          ? "border-red-200 bg-red-50/30"
          : "border-[var(--line-subtle)] hover:border-[var(--line-strong)]"
      }`}
    >
      {/* Top row: tile + title + meta */}
      <div className="flex items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border text-base font-bold ${TILE_TONE[route.visibility]}`}
        >
          {title.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text-strong)]">{title}</p>
          <p className="mt-0.5 truncate text-[11px] text-[var(--text-soft-warm)]">
            {cityLabel} · {formatRouteVisibilityLabel(route.visibility)} ·{" "}
            {new Date(route.updated_at).toLocaleDateString("de-DE")}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      {!confirming && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-14">
          {primaryHref && (
            <Link
              href={primaryHref}
              className="inline-flex min-h-8 items-center rounded-lg bg-[var(--text-strong)] px-3 text-xs font-medium text-white transition hover:opacity-90"
            >
              {primaryLabel}
            </Link>
          )}
          {secondaryHref && secondaryLabel && (
            <Link
              href={secondaryHref}
              className="inline-flex min-h-8 items-center rounded-lg border border-[rgba(23,23,23,0.1)] px-3 text-xs font-medium text-[var(--text-strong)] transition hover:bg-[var(--brand-warm-cloud)]"
            >
              {secondaryLabel}
            </Link>
          )}
          <button
            type="button"
            aria-label={deleteLabel}
            onClick={() => setConfirming(true)}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-soft-warm)] transition hover:bg-red-50 hover:text-red-500"
          >
            <TrashIcon />
          </button>
        </div>
      )}

      {/* Inline confirmation */}
      {confirming && (
        <div className="mt-2.5 flex items-center justify-between gap-3 rounded-[12px] border border-red-200 bg-white px-3 py-2">
          <p className="text-xs font-medium text-red-700">{deleteLabel}?</p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] px-3 py-1 text-xs font-medium text-[var(--text-muted-warm)] transition hover:border-[var(--line-strong)] disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-red-500 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
            >
              {deleting ? "…" : "Ja, löschen"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

function ProfilePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("return") ?? null;

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
  const [studioTab, setStudioTab] = useState<StudioTab>("routes");
  const [studioRoadtrips, setStudioRoadtrips] = useState<RoadtripRoute[]>([]);
  const [studioEvents, setStudioEvents] = useState<EventPlanRow[]>([]);
  const [loadingStudio, setLoadingStudio] = useState(false);
  const [hasPartnerProfile, setHasPartnerProfile] = useState<boolean | null>(null);
  const [hasCorporateProfile, setHasCorporateProfile] = useState<boolean | null>(null);

  // ── Interest catalog ──────────────────────────────────────────────────────

  const interestCatalog = useMemo(
    () =>
      Object.entries(getInterestCatalog()).reduce<Record<string, string[]>>(
        (acc, [interest, spec]) => {
          if (!acc[spec.group]) acc[spec.group] = [];
          acc[spec.group].push(interest);
          return acc;
        },
        {}
      ),
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

  // ── Route filters ─────────────────────────────────────────────────────────

  const filteredUserRoutes = useMemo(() => {
    const query = norm(createdRouteQuery);
    return userRoutes.filter((route) => {
      if (createdRouteFilter !== "all" && route.visibility !== createdRouteFilter) return false;
      if (!query) return true;
      const haystack = norm(
        [route.title, route.description, route.city_slug, formatRouteCityLabel(route.city_slug)]
          .filter(Boolean)
          .join(" ")
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
        [route.title, route.description, route.city_slug, formatRouteCityLabel(route.city_slug)]
          .filter(Boolean)
          .join(" ")
      );
      return haystack.includes(query);
    });
  }, [bookmarkedRoutes, savedRouteFilter, savedRouteQuery]);

  // ── Auth init ─────────────────────────────────────────────────────────────

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    let active = true;

    const applySession = (
      session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]
    ) => {
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

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      applySession(session);
      // After OAuth callback: redirect to return URL on SIGNED_IN
      if (event === "SIGNED_IN" && returnUrl) {
        router.replace(returnUrl);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [mounted]);

  // ── Partner/corporate role check ──────────────────────────────────────────

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("partner_memberships")
      .select("id, partner_profiles(partner_type_slug)")
      .eq("user_id", userId)
      .eq("status", "active")
      .then(({ data }) => {
        const rows = (data ?? []) as Array<{
          id: string;
          partner_profiles: { partner_type_slug: string } | { partner_type_slug: string }[] | null;
        }>;
        setHasPartnerProfile(rows.length > 0);
        setHasCorporateProfile(
          rows.some((r) => {
            const pp = Array.isArray(r.partner_profiles) ? r.partner_profiles[0] : r.partner_profiles;
            return pp?.partner_type_slug === "corporate";
          })
        );
      });
  }, [userId]);

  // ── Profile & routes load ─────────────────────────────────────────────────

  useEffect(() => {
    if (!authReady || !userId) return;

    void (async () => {
      setLoadingProfile(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) { console.error("Profile load error:", error); return; }
        setInterests(parseInterests((data ?? null) as ProfileRow | null));

        const authUser = (await supabase.auth.getUser()).data.user ?? null;
        const metadata = (authUser?.user_metadata ?? {}) as Record<string, unknown>;
        const defaultName =
          typeof metadata.full_name === "string"
            ? metadata.full_name
            : typeof metadata.name === "string"
            ? metadata.name
            : "";
        const defaultAvatar =
          typeof metadata.avatar_url === "string" ? metadata.avatar_url : "";

        const { data: creatorData, error: creatorError } = await supabase
          .from("creator_profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

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
              return Array.isArray(nested) ? (nested[0] ?? null) : (nested ?? null);
            })
            .filter((route): route is UserRouteRow => Boolean(route));
          setBookmarkedRoutes(routes);
        }
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [authReady, userId]);

  // ── Studio: Roadtrips + Events laden ─────────────────────────────────────

  useEffect(() => {
    if (!authReady || !userId) return;
    setLoadingStudio(true);

    Promise.all([
      fetchMyRoadtripRoutes(),
      supabase
        .from("event_plans")
        .select("id, title, occasion_slug, city_slug, event_date, guest_count, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]).then(([roadtrips, eventsResp]) => {
      setStudioRoadtrips(roadtrips);
      setStudioEvents((eventsResp.data as EventPlanRow[] | null) ?? []);
    }).catch((err) => {
      console.error("Studio load error:", err);
    }).finally(() => {
      setLoadingStudio(false);
    });
  }, [authReady, userId]);

  // ── Avatar cleanup ────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (selectedAvatarPreview) URL.revokeObjectURL(selectedAvatarPreview);
    };
  }, [selectedAvatarPreview]);

  // ── Live username check ───────────────────────────────────────────────────

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
        const { data, error } = await supabase
          .from("creator_profiles")
          .select("user_id, username")
          .eq("username", cleanUsername)
          .maybeSingle();
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

  // ── Actions ───────────────────────────────────────────────────────────────

  async function saveInterests(next: string[]) {
    if (!userId) return;
    setSavingProfile(true);
    setStatus(null);
    try {
      const clean = Array.from(new Set(next.map((x) => norm(x)).filter(Boolean))).slice(0, 12);
      setInterests(clean);
      const { error } = await supabase
        .from("profiles")
        .upsert({ user_id: userId, interests: clean }, { onConflict: "user_id" });
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
        const { data: existing, error: existingError } = await supabase
          .from("creator_profiles")
          .select("user_id, username")
          .eq("username", cleanUsername)
          .maybeSingle();
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
        console.error("Creator profile preflight error:", existingProfileError);
        setStatus("Öffentliches Profil konnte nicht vorbereitet werden.");
        return;
      }

      const { error } = existingProfile
        ? await supabase.from("creator_profiles").update(payload).eq("user_id", userId)
        : await supabase.from("creator_profiles").insert(payload);
      if (error) {
        console.error("Creator profile save error:", error);
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
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, {
          upsert: true,
          contentType: file.type || "image/jpeg",
          cacheControl: "3600",
        });
      if (uploadError) {
        console.error("Avatar upload error:", uploadError);
        setStatus("Avatar konnte nicht hochgeladen werden.");
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
        console.error("Avatar profile preflight error:", existingProfileError);
        setAvatarUrl(publicUrl);
        setStatus("Avatar wurde hochgeladen, aber das Profil konnte nicht vorbereitet werden.");
        return;
      }

      const { error: profileError } = existingProfile
        ? await supabase.from("creator_profiles").update(payload).eq("user_id", userId)
        : await supabase.from("creator_profiles").insert(payload);
      setAvatarUrl(publicUrl);
      if (profileError) {
        console.error("Avatar profile save error:", profileError);
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
    if (!file) { setSelectedAvatarPreview(null); return; }
    setSelectedAvatarPreview(URL.createObjectURL(file));
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
      if (!ctx) { setStatus("Avatar-Crop konnte nicht vorbereitet werden."); return; }

      const minSide = Math.min(image.width, image.height);
      const cropSide = Math.max(64, minSide / cropScale);
      const maxX = Math.max(0, image.width - cropSide);
      const maxY = Math.max(0, image.height - cropSide);
      const sourceX = Math.min(
        maxX,
        Math.max(0, (image.width - cropSide) / 2 + (cropOffsetX / 120) * maxX)
      );
      const sourceY = Math.min(
        maxY,
        Math.max(0, (image.height - cropSide) / 2 + (cropOffsetY / 120) * maxY)
      );

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
          await uploadAvatar(
            selectedAvatarFile,
            selectedAvatarFile.name.split(".").pop() || "jpg"
          );
          setStatus(
            "Avatar hochgeladen. Zuschneiden war in diesem Browser nicht möglich, daher wurde die Originaldatei verwendet."
          );
        }
      }

      URL.revokeObjectURL(selectedAvatarPreview);
      setSelectedAvatarFile(null);
      setSelectedAvatarPreview(null);
    } catch (error) {
      console.error("Avatar crop/upload failed:", error);
      setStatus(
        "Avatar konnte in diesem Browser nicht verarbeitet werden. Bitte probiere ein JPG/PNG oder lade die Datei erneut hoch."
      );
    }
  }

  function toggleInterest(tag: string) {
    const value = norm(tag);
    const next = interests.includes(value)
      ? interests.filter((item) => item !== value)
      : [...interests, value];
    void saveInterests(next);
  }

  function addCustomInterest() {
    const value = norm(interestInput);
    if (!value) return;
    setInterestInput("");
    void saveInterests([...interests, value]);
  }

  async function startOAuth(nextProvider: "google" | "azure") {
    setAuthLoading(true);
    setStatus(null);
    try {
      const base = `${window.location.origin}/profile`;
      const redirectTo = returnUrl ? `${base}?return=${encodeURIComponent(returnUrl)}` : base;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: nextProvider,
        options: { redirectTo },
      });
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

  async function deleteRoute(id: string) {
    const { error } = await supabase.from("user_routes").delete().eq("id", id);
    if (error) {
      console.error("Route delete error:", error);
      return;
    }
    setUserRoutes((prev) => prev.filter((r) => r.id !== id));
  }

  async function deleteStudioRoadtrip(id: string) {
    const { error } = await deleteRoadtripRoute(id);
    if (error) { console.error("Roadtrip delete error:", error); return; }
    setStudioRoadtrips((prev) => prev.filter((r) => r.id !== id));
  }

  async function deleteStudioEvent(id: string) {
    const { error } = await supabase.from("event_plans").delete().eq("id", id);
    if (error) { console.error("Event delete error:", error); return; }
    setStudioEvents((prev) => prev.filter((e) => e.id !== id));
  }

  async function removeBookmark(routeId: string) {
    if (!userId) return;
    const { error } = await supabase
      .from("user_route_bookmarks")
      .delete()
      .eq("route_id", routeId)
      .eq("user_id", userId);
    if (error) {
      console.error("Bookmark remove error:", error);
      return;
    }
    setBookmarkedRoutes((prev) => prev.filter((r) => r.id !== routeId));
  }

  async function signUpWithEmail() {
    const nextEmail = authEmailInput.trim();
    const nextPassword = authPasswordInput;
    if (!nextEmail || !nextPassword) { setStatus("Bitte E-Mail und Passwort eingeben."); return; }
    if (nextPassword.length < 8) {
      setStatus("Das Passwort sollte mindestens 8 Zeichen lang sein.");
      return;
    }
    setAuthLoading(true);
    setStatus(null);
    try {
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
      if (
        signUpData.user &&
        Array.isArray(signUpData.user.identities) &&
        signUpData.user.identities.length === 0
      ) {
        setStatus(
          "Für diese E-Mail gibt es bereits ein Konto. Bitte melde dich an oder setze dein Passwort zurück."
        );
        return;
      }
      setStatus(
        "Registrierung gestartet. Falls E-Mail-Bestätigung aktiv ist, prüfe bitte dein Postfach. Danach kannst du dich direkt anmelden."
      );
    } finally {
      setAuthLoading(false);
    }
  }

  async function signInWithEmail() {
    const nextEmail = authEmailInput.trim();
    const nextPassword = authPasswordInput;
    if (!nextEmail || !nextPassword) { setStatus("Bitte E-Mail und Passwort eingeben."); return; }
    setAuthLoading(true);
    setStatus(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: nextEmail,
        password: nextPassword,
      });
      if (error) {
        console.error("Email sign-in error:", error);
        setStatus(`Login fehlgeschlagen: ${friendlyAuthMessage(error.message)}`);
        return;
      }
      if (returnUrl) {
        router.replace(returnUrl);
        return;
      }
      setStatus("Erfolgreich angemeldet.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function resetPassword() {
    const nextEmail = authEmailInput.trim();
    if (!nextEmail) { setStatus("Bitte gib zuerst deine E-Mail-Adresse ein."); return; }
    setAuthLoading(true);
    setStatus(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(nextEmail, {
        redirectTo: `${window.location.origin}/profile`,
      });
      if (error) {
        console.error("Password reset error:", error);
        setStatus(`Passwort-Reset fehlgeschlagen: ${friendlyAuthMessage(error.message)}`);
        return;
      }
      setStatus(
        "Wenn ein Konto existiert, wurde dir eine E-Mail zum Zurücksetzen des Passworts gesendet."
      );
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

  // ─────────────────────────────────────────────────────────────────────────────

  if (!mounted) return null;

  const hasRoleBadge =
    creatorProfile?.creator_type === "creator" ||
    creatorProfile?.creator_type === "influencer" ||
    creatorProfile?.creator_type === "brand" ||
    hasPartnerProfile === true ||
    hasCorporateProfile === true;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="pd24-page-standard min-h-screen bg-[var(--bg-canvas-warm)]">
      <div className="space-y-6 px-4 py-8 sm:px-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div>
          <div className="pd24-kicker-warm">
            {authReady && userId && !isAnonymous ? "Mein Bereich" : "Konto"}
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--text-strong)] sm:text-3xl">
            {authReady && userId && !isAnonymous ? "Profil" : "Anmelden"}
          </h1>
          <p className="mt-1 text-sm leading-6 text-[var(--text-muted-warm)]">
            {authReady && userId && !isAnonymous
              ? "Interessen pflegen, Konto verwalten und öffentliches Profil einrichten."
              : "Melde dich an oder erstelle ein kostenloses Konto."}
          </p>
        </div>

        {/* ── Status banner ───────────────────────────────────────────────── */}
        {status ? (
          <div className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] px-4 py-3 text-sm text-[var(--text-muted-warm)]">
            {status}
          </div>
        ) : null}

        {/* ── Auth card ────────────────────────────────────────────────────── */}
        <div className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] p-6">

          {/* ── EINGELOGGT (echter Account) ─────────────────────────────────── */}
          {authReady && userId && !isAnonymous ? (
            <>
              <div className="pd24-kicker-warm">
                Angemeldet
              </div>
              <div className="mt-4 flex items-center gap-4">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName || username || "Avatar"}
                    className="h-12 w-12 rounded-full border border-[var(--line-subtle)] bg-white object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] text-lg font-semibold text-[var(--text-soft-warm)]">
                    {(displayName || username || email || "P").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-[var(--text-strong)]">
                    {displayName || username || email || "Dein Konto"}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-[var(--text-soft-warm)]">
                    {providerLabel(provider ?? "email")}{email ? ` · ${email}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  disabled={authLoading}
                  className="shrink-0 inline-flex min-h-9 items-center rounded-xl border border-[var(--line-subtle)] px-4 text-sm text-[var(--text-muted-warm)] transition hover:bg-[var(--brand-warm-cloud)] disabled:opacity-50"
                >
                  Abmelden
                </button>
              </div>
            </>
          ) : authReady && userId && isAnonymous ? (
            /* ── GASTPROFIL ───────────────────────────────────────────────── */
            <>
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-600">
                Gastprofil
              </div>
              <p className="mt-2 text-sm text-[var(--text-muted-warm)]">
                Du bist als Gast unterwegs. Registriere dich kostenlos, um deine Pläne dauerhaft zu speichern.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  onClick={() => void startOAuth("google")}
                  disabled={authLoading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] px-4 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--brand-warm-cloud)] disabled:opacity-50"
                >
                  <span className="text-base font-bold">G</span> Mit Google
                </button>
                <button
                  onClick={() => void startOAuth("azure")}
                  disabled={authLoading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] px-4 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--brand-warm-cloud)] disabled:opacity-50"
                >
                  <span className="inline-grid h-4 w-4 grid-cols-2 gap-[2px]">
                    <span className="rounded-[1px] bg-[#f25022]" />
                    <span className="rounded-[1px] bg-[#7fba00]" />
                    <span className="rounded-[1px] bg-[#00a4ef]" />
                    <span className="rounded-[1px] bg-[#ffb900]" />
                  </span>
                  Mit Microsoft
                </button>
              </div>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[rgba(23,23,23,0.06)]" /></div>
                <div className="relative flex justify-center"><span className="bg-white px-2 text-xs text-[var(--text-soft-warm)]">oder mit E-Mail</span></div>
              </div>
              <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); void signInWithEmail(); }}>
                <input type="email" name="email" autoComplete="email" inputMode="email" value={authEmailInput} onChange={(e) => setAuthEmailInput(e.target.value)} placeholder="E-Mail" className="h-11 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] px-3 text-sm text-[var(--text-strong)] outline-none transition focus:border-[var(--text-strong)]" />
                <input type="password" name="password" autoComplete="new-password" value={authPasswordInput} onChange={(e) => setAuthPasswordInput(e.target.value)} placeholder="Passwort wählen" className="h-11 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] px-3 text-sm text-[var(--text-strong)] outline-none transition focus:border-[var(--text-strong)]" />
                <button type="button" onClick={() => void signUpWithEmail()} disabled={authLoading} className="inline-flex h-11 w-full items-center justify-center rounded-[var(--radius-control)] bg-[var(--text-strong)] text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50">
                  Kostenloses Konto erstellen
                </button>
              </form>
              <button type="button" onClick={() => void signOut()} disabled={authLoading} className="mt-3 text-xs text-[var(--text-soft-warm)] underline-offset-2 hover:underline">
                Gastzugang beenden
              </button>
            </>
          ) : (
            /* ── NICHT EINGELOGGT ─────────────────────────────────────────── */
            <>
              <div className="pd24-kicker-warm">
                Konto
              </div>
              <p className="mt-2 text-sm text-[var(--text-muted-warm)]">Kostenlos anmelden oder registrieren.</p>

              {/* OAuth */}
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  onClick={() => void startOAuth("google")}
                  disabled={authLoading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] px-4 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--brand-warm-cloud)] disabled:opacity-50"
                >
                  <span className="text-base font-bold">G</span> Mit Google
                </button>
                <button
                  onClick={() => void startOAuth("azure")}
                  disabled={authLoading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] px-4 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--brand-warm-cloud)] disabled:opacity-50"
                >
                  <span className="inline-grid h-4 w-4 grid-cols-2 gap-[2px]">
                    <span className="rounded-[1px] bg-[#f25022]" />
                    <span className="rounded-[1px] bg-[#7fba00]" />
                    <span className="rounded-[1px] bg-[#00a4ef]" />
                    <span className="rounded-[1px] bg-[#ffb900]" />
                  </span>
                  Mit Microsoft
                </button>
              </div>

              {/* Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[rgba(23,23,23,0.06)]" /></div>
                <div className="relative flex justify-center"><span className="bg-white px-2 text-xs text-[var(--text-soft-warm)]">oder mit E-Mail</span></div>
              </div>

              {/* Email form */}
              <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); void signInWithEmail(); }}>
                <input type="email" name="email" autoComplete="email" inputMode="email" value={authEmailInput} onChange={(e) => setAuthEmailInput(e.target.value)} placeholder="E-Mail" className="h-11 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] px-3 text-sm text-[var(--text-strong)] outline-none transition focus:border-[var(--text-strong)]" />
                <input type="password" name="password" autoComplete="current-password" value={authPasswordInput} onChange={(e) => setAuthPasswordInput(e.target.value)} placeholder="Passwort" className="h-11 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] px-3 text-sm text-[var(--text-strong)] outline-none transition focus:border-[var(--text-strong)]" />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => void signUpWithEmail()} disabled={authLoading} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#171717] text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50">
                    Registrieren
                  </button>
                  <button type="submit" disabled={authLoading} className="inline-flex h-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--brand-warm-cloud)] disabled:opacity-50">
                    Einloggen
                  </button>
                </div>
              </form>

              {/* Secondary links */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                <button type="button" onClick={() => void resetPassword()} disabled={authLoading} className="text-xs text-[var(--text-soft-warm)] underline-offset-2 hover:underline">
                  Passwort vergessen?
                </button>
                <button type="button" onClick={() => void continueAsGuest()} disabled={authLoading} className="text-xs text-[var(--text-soft-warm)] underline-offset-2 hover:underline">
                  Als Gast fortfahren
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Two-column layout: interests + public profile ───────────────── */}
        {authReady && userId && !isAnonymous && (
          <section className="space-y-5">
            <div className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-5">
              <div className="pd24-kicker-warm">Persoenliche Basis</div>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">Konto, Vorlieben und sichtbares Profil</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--text-muted-warm)]">
                Pflege hier deine persoenlichen Einstellungen, Interessen und die Informationen, die andere Nutzer sehen sollen.
              </p>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">

          {/* ── Interests ──────────────────────────────────────────────────── */}
          <div className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="pd24-kicker-warm">
                  Interessen
                </div>
                <h2 className="mt-2 text-lg font-semibold text-[var(--text-strong)]">
                  Deine Vorlieben
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--text-muted-warm)]">
                  Fließen automatisch in neue Tagespläne und Empfehlungen ein.
                </p>
              </div>
              <div className="shrink-0 rounded-full border border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] px-2.5 py-1 text-xs text-[var(--text-soft-warm)]">
                {savingProfile ? "Speichert…" : `${interests.length} / 12`}
              </div>
            </div>

            {/* Interest preview chips */}
            {interestPreview.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {interestPreview.map((interest) => (
                  <span
                    key={`preview-${interest}`}
                    className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] px-2.5 py-1 text-[11px] text-[var(--text-muted-warm)]"
                  >
                    {interest}
                  </span>
                ))}
                {interests.length > interestPreview.length ? (
                  <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] px-2.5 py-1 text-[11px] text-[var(--text-soft-warm)]">
                    +{interests.length - interestPreview.length}
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* Catalog */}
            <div className="mt-5 max-h-[26rem] space-y-5 overflow-y-auto pr-1">
              {Object.entries(interestCatalog).map(([group, tags]) => (
                <div key={group}>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--text-soft-warm)]">
                    {interestGroupLabels[group] ?? group}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => {
                      const active = interests.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => toggleInterest(tag)}
                          className={`rounded-full border px-3 py-1.5 text-sm transition ${
                            active
                              ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                              : "border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] text-[var(--text-muted-warm)] hover:bg-[var(--brand-warm-cloud)] hover:border-[var(--line-strong)]"
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

            {/* Custom interest input */}
            <div className="mt-5 flex gap-2">
              <input
                value={interestInput}
                onChange={(e) => setInterestInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomInterest(); } }}
                placeholder="Eigene Vorliebe hinzufügen"
                className="h-11 flex-1 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] px-3 text-sm text-[var(--text-strong)] outline-none transition focus:border-[var(--text-strong)]"
              />
              <button
                onClick={addCustomInterest}
                className="inline-flex min-h-11 items-center rounded-xl bg-[#171717] px-4 text-sm font-medium text-white transition hover:opacity-90"
              >
                Hinzufügen
              </button>
            </div>

            {interests.length === 0 && (
              <p className="mt-3 text-xs text-[var(--text-soft-warm)]">
                Wähle ein paar Vorlieben — sie verbessern deine Planvorschläge.
              </p>
            )}
          </div>

          {/* ── Public profile ──────────────────────────────────────────────── */}
          <div className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="pd24-kicker-warm">
                  Öffentliches Profil
                </div>
                <h2 className="mt-2 text-lg font-semibold text-[var(--text-strong)]">
                  Deine Profilinformationen
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--text-muted-warm)]">
                  Sichtbar für andere Nutzer in Creator-Links und Einladungen.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {username ? (
                  <Link
                    href={`/u/${username}`}
                    className="inline-flex min-h-9 items-center rounded-xl border border-[var(--line-subtle)] px-3 text-xs text-[var(--text-muted-warm)] transition hover:bg-[var(--brand-warm-cloud)]"
                  >
                    Ansehen
                  </Link>
                ) : null}
                <button
                  onClick={() => void saveCreatorProfile()}
                  disabled={savingProfile || !authReady || !userId}
                  className="inline-flex min-h-9 items-center rounded-xl bg-[#171717] px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {savingProfile ? "Speichert…" : "Speichern"}
                </button>
              </div>
            </div>

            {/* Avatar preview + fields */}
            <div className="mt-5 grid gap-5 sm:grid-cols-[160px,1fr]">
              {/* Avatar column */}
              <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] p-4">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName || username || "Avatar"}
                    className="h-20 w-20 rounded-full border border-[var(--line-subtle)] bg-white object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-white text-2xl font-semibold text-[var(--text-soft-warm)]">
                    {(displayName || username || "P").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="text-center">
                  <div className="text-sm font-semibold text-[var(--text-strong)]">
                    {displayName || "Dein Name"}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--text-soft-warm)]">
                    {username ? `@${username}` : "Kein Username"}
                  </div>
                </div>
                <div className="min-h-4 text-center text-[11px]">
                  {usernameChecking ? (
                    <span className="text-[var(--text-soft-warm)]">Prüft…</span>
                  ) : usernameError ? (
                    <span className="text-red-600">{usernameError}</span>
                  ) : username && usernameAvailable ? (
                    <span className="text-emerald-700">Verfügbar</span>
                  ) : (
                    <span className="text-[var(--text-soft-warm)]">a–z, 0–9, . _ -</span>
                  )}
                </div>
              </div>

              {/* Fields */}
              <div className="grid gap-3">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium text-[var(--text-strong)]">Anzeigename</span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="z. B. Alex B."
                    className="h-11 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] px-3 text-sm text-[var(--text-strong)] outline-none transition focus:border-[var(--text-strong)]"
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium text-[var(--text-strong)]">Username</span>
                  <input
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setUsernameError(null); }}
                    placeholder="z. B. alex"
                    className="h-11 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] px-3 text-sm text-[var(--text-strong)] outline-none transition focus:border-[var(--text-strong)]"
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium text-[var(--text-strong)]">Kurz-Bio</span>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Ein kurzer Satz über dich"
                    rows={3}
                    className="rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] px-3 py-2.5 text-sm text-[var(--text-strong)] outline-none transition focus:border-[var(--text-strong)]"
                  />
                </label>
              </div>
            </div>

            {/* Avatar upload */}
            <div className="mt-4">
              <div className="pd24-kicker-warm">
                Profilbild
              </div>
              <label className="mt-2 grid gap-1.5 text-sm">
                <span className="text-xs text-[var(--text-muted-warm)]">
                  {avatarUploading ? "Upload läuft…" : "Bilddatei auswählen (JPG, PNG, WebP)"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleAvatarFileSelection(e.target.files?.[0] ?? null)}
                  className="rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] p-2 text-sm text-[var(--text-muted-warm)]"
                />
              </label>
            </div>

            {/* Crop preview */}
            {selectedAvatarPreview ? (
              <div className="mt-4 rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] p-4">
                <div className="text-sm font-medium text-[var(--text-strong)]">Vorschau & Zuschneiden</div>
                <div className="mt-3 flex flex-col gap-4 sm:flex-row">
                  <div className="relative h-48 w-48 shrink-0 overflow-hidden rounded-2xl border border-[var(--line-subtle)] bg-white">
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
                  <div className="flex-1 space-y-3">
                    <label className="grid gap-1.5 text-xs">
                      <span className="text-[var(--text-muted-warm)]">Zoom</span>
                      <input
                        type="range"
                        min={1}
                        max={2.4}
                        step={0.05}
                        value={cropScale}
                        onChange={(e) => setCropScale(Number(e.target.value))}
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs">
                      <span className="text-[var(--text-muted-warm)]">Horizontal verschieben</span>
                      <input
                        type="range"
                        min={-120}
                        max={120}
                        step={1}
                        value={cropOffsetX}
                        onChange={(e) => setCropOffsetX(Number(e.target.value))}
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs">
                      <span className="text-[var(--text-muted-warm)]">Vertikal verschieben</span>
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
                        className="inline-flex min-h-9 items-center rounded-xl bg-[#171717] px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                      >
                        Hochladen
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAvatarFileSelection(null)}
                        className="inline-flex min-h-9 items-center rounded-xl border border-[var(--line-subtle)] px-4 text-sm text-[var(--text-muted-warm)] transition hover:bg-white"
                      >
                        Verwerfen
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          </div>
        </section>
        )}

        {/* ── Studio ──────────────────────────────────────────────────────────── */}
        {authReady && userId && !isAnonymous && (
          <section className="space-y-5">
            <div className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-5">
              <div className="pd24-kicker-warm">Meine Inhalte</div>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">Eigene Routen, Roadtrips und gemerkte Vorlagen</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--text-muted-warm)]">
                Verwalte hier deine erstellten Inhalte und springe schnell zu dem weiter, was du spaeter erneut nutzen moechtest.
              </p>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">

          {/* Studio card with tab switcher */}
          <div className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] p-6">

            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="pd24-kicker-warm">Studio</div>
                <h2 className="mt-2 text-lg font-semibold text-[var(--text-strong)]">Meine Inhalte</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--text-muted-warm)]">
                  Routen, Roadtrips und Events, die du erstellt hast.
                </p>
              </div>
              {studioTab === "routes" && (
                <Link href="/routes" className="inline-flex min-h-9 shrink-0 items-center rounded-xl border border-[var(--line-subtle)] px-3 text-sm text-[var(--text-muted-warm)] transition hover:bg-[var(--brand-warm-cloud)]">
                  Route erstellen
                </Link>
              )}
              {studioTab === "roadtrips" && (
                <Link href="/roadtrip" className="inline-flex min-h-9 shrink-0 items-center rounded-xl border border-[var(--line-subtle)] px-3 text-sm text-[var(--text-muted-warm)] transition hover:bg-[var(--brand-warm-cloud)]">
                  Roadtrip planen
                </Link>
              )}
              {studioTab === "events" && (
                <Link href="/events" className="inline-flex min-h-9 shrink-0 items-center rounded-xl border border-[var(--line-subtle)] px-3 text-sm text-[var(--text-muted-warm)] transition hover:bg-[var(--brand-warm-cloud)]">
                  Event anlegen
                </Link>
              )}
            </div>

            {/* Tab switcher */}
            <div className="mt-5 flex gap-1.5">
              {([
                { key: "routes" as const, label: "Routen", count: userRoutes.length },
                { key: "roadtrips" as const, label: "Roadtrips", count: studioRoadtrips.length },
                { key: "events" as const, label: "Events", count: studioEvents.length },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStudioTab(tab.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                    studioTab === tab.key
                      ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                      : "border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] text-[var(--text-muted-warm)] hover:bg-[var(--brand-warm-cloud)]"
                  }`}
                >
                  {tab.label}
                  {!loadingProfile && !loadingStudio && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      studioTab === tab.key ? "bg-white/20 text-white" : "bg-[var(--bg-surface)] text-[var(--text-muted)]"
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Tab: Routen ── */}
            {studioTab === "routes" && (
              <>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={createdRouteQuery}
                    onChange={(e) => setCreatedRouteQuery(e.target.value)}
                    placeholder="Routen durchsuchen"
                    className="h-10 flex-1 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] px-3 text-sm text-[var(--text-strong)] outline-none transition focus:border-[var(--text-strong)]"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {(["all", "public", "unlisted", "private"] as CreatedRouteFilter[]).map((filter) => {
                      const label = filter === "all" ? "Alle" : formatRouteVisibilityLabel(filter as UserRouteRow["visibility"]);
                      const active = createdRouteFilter === filter;
                      return (
                        <button key={`cf-${filter}`} type="button" onClick={() => setCreatedRouteFilter(filter)}
                          className={`rounded-full border px-3 py-1.5 text-xs transition ${active
                            ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                            : "border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] text-[var(--text-muted-warm)] hover:bg-[var(--brand-warm-cloud)]"}`}
                        >{label}</button>
                      );
                    })}
                  </div>
                </div>
                {loadingProfile ? (
                  <div className="mt-4 text-sm text-[var(--text-soft-warm)]">Lädt…</div>
                ) : userRoutes.length > 0 ? (
                  <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                    {filteredUserRoutes.length > 0 ? filteredUserRoutes.map((route) => (
                      <ProfileRouteListItem
                        key={route.id} route={route}
                        primaryHref={`/routes?routeId=${route.id}`} primaryLabel="Im Builder öffnen"
                        secondaryHref={route.slug ? `/routes/${route.slug}` : null}
                        secondaryLabel={route.slug ? "Öffentlich ansehen" : undefined}
                        onDelete={deleteRoute} deleteLabel="Route löschen"
                      />
                    )) : (
                      <div className="rounded-[var(--radius-card-sm)] border border-dashed border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] px-4 py-6 text-sm text-[var(--text-soft-warm)]">
                        Keine Routen für diesen Filter.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm text-[var(--text-soft-warm)]">
                      Noch keine eigenen Routen. Erstelle im Builder deinen ersten wiederverwendbaren Ablauf.
                    </p>
                    <Link href="/routes" className="inline-flex min-h-9 items-center rounded-[var(--radius-control)] bg-[var(--text-strong)] px-4 text-sm font-medium text-white transition hover:opacity-90">
                      Route erstellen →
                    </Link>
                  </div>
                )}
              </>
            )}

            {/* ── Tab: Roadtrips ── */}
            {studioTab === "roadtrips" && (
              <>
                {loadingStudio ? (
                  <div className="mt-4 text-sm text-[var(--text-soft-warm)]">Lädt…</div>
                ) : studioRoadtrips.length > 0 ? (
                  <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                    {studioRoadtrips.map((rt) => {
                      const cityLabels = rt.stops.map((s) => s.cityLabel).join(" → ");
                      return (
                        <div key={rt.id} className="rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[var(--text-strong)]">{rt.title}</p>
                              <p className="mt-0.5 truncate text-[11px] text-[var(--text-soft-warm)]">
                                {cityLabels} · {rt.total_nights} Nächte
                              </p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              rt.status === "active" ? "bg-emerald-100 text-emerald-700"
                              : rt.status === "completed" ? "bg-sky-100 text-sky-700"
                              : "bg-amber-100 text-amber-700"
                            }`}>
                              {rt.status === "active" ? "Aktiv" : rt.status === "completed" ? "Abgeschlossen" : "Entwurf"}
                            </span>
                          </div>
                          <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-0">
                            <Link href={`/roadtrip/routes/${rt.slug}`}
                              className="inline-flex min-h-8 items-center rounded-lg bg-[var(--text-strong)] px-3 text-xs font-medium text-white transition hover:opacity-90">
                              Öffnen
                            </Link>
                            <Link href={`/roadtrip?fromRouteSlug=${rt.slug}`}
                              className="inline-flex min-h-8 items-center rounded-lg border border-[var(--line-subtle)] px-3 text-xs font-medium text-[var(--text-strong)] transition hover:bg-[var(--brand-warm-cloud)]">
                              Bearbeiten
                            </Link>
                            <button type="button" onClick={() => void deleteStudioRoadtrip(rt.id)}
                              className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-soft-warm)] transition hover:bg-red-50 hover:text-red-500"
                              aria-label="Roadtrip löschen">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm text-[var(--text-soft-warm)]">
                      Noch keine Roadtrips. Plane deinen ersten Mehrstädte-Trip und teile ihn mit anderen.
                    </p>
                    <Link href="/roadtrip" className="inline-flex min-h-9 items-center rounded-[var(--radius-control)] bg-[var(--text-strong)] px-4 text-sm font-medium text-white transition hover:opacity-90">
                      Roadtrip planen →
                    </Link>
                  </div>
                )}
              </>
            )}

            {/* ── Tab: Events ── */}
            {studioTab === "events" && (
              <>
                {loadingStudio ? (
                  <div className="mt-4 text-sm text-[var(--text-soft-warm)]">Lädt…</div>
                ) : studioEvents.length > 0 ? (
                  <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                    {studioEvents.map((ev) => {
                      const occasionMap: Record<string, string> = {
                        geburtstag: "Geburtstag", hochzeit: "Hochzeit", jga: "JGA",
                        teambuilding: "Teambuilding", firmenfeier: "Firmenfeier",
                        kindergeburtstag: "Kindergeburtstag", jubilaeum: "Jubiläum",
                        staedtereise: "Städtereise", konferenz: "Konferenz",
                      };
                      const occasionDisplay = occasionMap[ev.occasion_slug] ?? ev.occasion_slug;
                      const dateDisplay = ev.event_date
                        ? new Date(ev.event_date).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
                        : "Kein Datum";
                      return (
                        <div key={ev.id} className="rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                                {ev.title?.trim() || occasionDisplay}
                              </p>
                              <p className="mt-0.5 truncate text-[11px] text-[var(--text-soft-warm)]">
                                {occasionDisplay} · {dateDisplay}{ev.guest_count ? ` · ${ev.guest_count} Gäste` : ""}
                              </p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              ev.status === "active" ? "bg-emerald-100 text-emerald-700"
                              : ev.status === "completed" ? "bg-sky-100 text-sky-700"
                              : "bg-amber-100 text-amber-700"
                            }`}>
                              {ev.status === "active" ? "Aktiv" : ev.status === "completed" ? "Abgeschlossen" : "Entwurf"}
                            </span>
                          </div>
                          <div className="mt-2.5 flex flex-wrap items-center gap-2">
                            <Link href={`/events/plan/${ev.id}`}
                              className="inline-flex min-h-8 items-center rounded-lg bg-[var(--text-strong)] px-3 text-xs font-medium text-white transition hover:opacity-90">
                              Öffnen
                            </Link>
                            <button type="button" onClick={() => void deleteStudioEvent(ev.id)}
                              className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-soft-warm)] transition hover:bg-red-50 hover:text-red-500"
                              aria-label="Event löschen">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm text-[var(--text-soft-warm)]">
                      Noch keine Events. Plane einen Geburtstag, JGA, Teamtag oder eine Firmenfeier.
                    </p>
                    <Link href="/events" className="inline-flex min-h-9 items-center rounded-[var(--radius-control)] bg-[var(--text-strong)] px-4 text-sm font-medium text-white transition hover:opacity-90">
                      Event anlegen →
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Bookmarked routes */}
          <div className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="pd24-kicker-warm">
                  Meine Pläne
                </div>
                <h2 className="mt-2 text-lg font-semibold text-[var(--text-strong)]">Gemerkte Vorlagen</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--text-muted-warm)]">
                  Aus Explore und geteilten Links gemerkte Routen.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  href="/saved"
                  className="inline-flex min-h-9 items-center rounded-xl border border-[var(--line-subtle)] px-3 text-sm text-[var(--text-muted-warm)] transition hover:bg-[var(--brand-warm-cloud)]"
                >
                  Meine Pläne
                </Link>
                <Link
                  href="/explore"
                  className="inline-flex min-h-9 items-center rounded-xl border border-[var(--line-subtle)] px-3 text-sm text-[var(--text-muted-warm)] transition hover:bg-[var(--brand-warm-cloud)]"
                >
                  Explore
                </Link>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                value={savedRouteQuery}
                onChange={(e) => setSavedRouteQuery(e.target.value)}
                placeholder="Gespeicherte Routen durchsuchen"
                className="h-11 flex-1 rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] px-3 text-sm text-[var(--text-strong)] outline-none transition focus:border-[var(--text-strong)]"
              />
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["all", "Alle"],
                    ["with-city", "Mit Stadt"],
                    ["with-description", "Mit Text"],
                  ] as const
                ).map(([filter, label]) => {
                  const active = savedRouteFilter === filter;
                  return (
                    <button
                      key={`sf-${filter}`}
                      type="button"
                      onClick={() => setSavedRouteFilter(filter)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        active
                          ? "border-[var(--text-strong)] bg-[var(--text-strong)] text-white"
                          : "border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] text-[var(--text-muted-warm)] hover:bg-[var(--brand-warm-cloud)]"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {loadingProfile ? (
              <div className="mt-5 text-sm text-[var(--text-soft-warm)]">Lädt…</div>
            ) : bookmarkedRoutes.length > 0 ? (
              <div className="mt-5 max-h-[34rem] space-y-3 overflow-y-auto pr-1">
                {filteredBookmarkedRoutes.length > 0 ? (
                  filteredBookmarkedRoutes.map((route) => (
                    <ProfileRouteListItem
                      key={route.id}
                      route={route}
                      primaryHref={route.slug ? `/routes/${route.slug}` : null}
                      primaryLabel="Route öffnen"
                      onDelete={removeBookmark}
                      deleteLabel="Lesezeichen entfernen"
                    />
                  ))
                ) : (
                  <div className="rounded-[var(--radius-card-sm)] border border-dashed border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] px-4 py-8 text-sm text-[var(--text-soft-warm)]">
                    Keine gespeicherten Routen für diesen Filter.
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-5 text-sm text-[var(--text-soft-warm)]">
                Noch keine gemerkten Vorlagen. Merke in Explore interessante Routen für später.
              </div>
            )}
          </div>
          </div>
        </section>
        )}

        {/* ── Aktive Rollen-Schnellzugriffe ───────────────────────────────── */}
        {(authReady && userId && !isAnonymous) && (
          <div className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-5">
            <div className="pd24-kicker-warm">Rollen & Zugaenge</div>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">Spezielle Bereiche und Freischaltungen</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-muted-warm)]">
              Aktive Zugaenge stehen oben. Weitere Programme und Ausbaustufen kannst du darunter bei Bedarf aufklappen.
            </p>
          </div>
        )}

        {userId && hasRoleBadge && (
          <div className="overflow-hidden rounded-[var(--radius-card)] bg-[var(--text-strong)] p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/50">
              Deine Zugänge
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {(creatorProfile?.creator_type === "creator" ||
                creatorProfile?.creator_type === "influencer" ||
                creatorProfile?.creator_type === "brand") && (
                <Link
                  href="/creator/dashboard"
                  className="flex flex-col gap-3 rounded-xl bg-white/[0.08] p-4 text-white transition hover:bg-white/[0.13]"
                >
                  <span className="text-2xl leading-none">🎨</span>
                  <div>
                    <div className="font-semibold">Creator-Studio</div>
                    <div className="mt-1 text-xs leading-5 text-white/55">
                      Eigene Routen veröffentlichen und Community aufbauen.
                    </div>
                  </div>
                </Link>
              )}
              {hasPartnerProfile === true && !hasCorporateProfile && (
                <Link
                  href="/partner/dashboard"
                  className="flex flex-col gap-3 rounded-xl bg-white/[0.08] p-4 text-white transition hover:bg-white/[0.13]"
                >
                  <span className="text-2xl leading-none">🏢</span>
                  <div>
                    <div className="font-semibold">Partner-Dashboard</div>
                    <div className="mt-1 text-xs leading-5 text-white/55">
                      Listings, Insights und KI-Plan-Platzierungen verwalten.
                    </div>
                  </div>
                </Link>
              )}
              {hasCorporateProfile === true && (
                <Link
                  href="/business/dashboard"
                  className="flex flex-col gap-3 rounded-xl bg-white/[0.08] p-4 text-white transition hover:bg-white/[0.13]"
                >
                  <span className="text-2xl leading-none">⚡</span>
                  <div>
                    <div className="font-semibold">Business-Dashboard</div>
                    <div className="mt-1 text-xs leading-5 text-white/55">
                      Events planen, Team einladen und Teilnahmen verwalten.
                    </div>
                  </div>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ── Mitmachen / Zugänge-Upsell ──────────────────────────────────── */}
        {authReady && userId && !isAnonymous && (
          <details className="rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-panel-strong)] p-6">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
              <div>
                <div className="pd24-kicker-warm">
                  Mitmachen
                </div>
                <h2 className="mt-2 text-lg font-semibold text-[var(--text-strong)]">Weitere Rollen & Zugänge</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--text-muted-warm)]">
                  Erweiterte Bereiche für Creator, Partner und Unternehmen.
                </p>
              </div>
              <span className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-soft-warm)]">
                Oeffnen
              </span>
            </summary>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {/* Creator */}
              <div className="flex flex-col gap-4 rounded-[var(--radius-card-sm)] border border-[var(--line-subtle)] bg-[var(--bg-canvas-warm)] p-5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-2xl leading-none">🎨</span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                    Kostenlos
                  </span>
                </div>
                <div>
                  <div className="font-semibold text-[var(--text-strong)]">Creator werden</div>
                  <p className="mt-1.5 text-sm leading-6 text-[var(--text-muted-warm)]">
                    Erstelle eigene Routen, bau eine Community auf und monetarisiere deine lokalen Tipps.
                  </p>
                </div>
                <div className="mt-auto">
                  <Link
                    href="/profile#profile-public"
                    className="inline-flex w-full items-center justify-center rounded-xl border border-[var(--line-subtle)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--brand-warm-cloud)]"
                  >
                    Creator-Profil einrichten
                  </Link>
                </div>
              </div>

              {/* Partner */}
              <div className="flex flex-col gap-4 rounded-[var(--radius-card-sm)] bg-[var(--text-strong)] p-5 text-white shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-2xl leading-none">🏢</span>
                  <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
                    Ab 29€/Monat
                  </span>
                </div>
                <div>
                  <div className="font-semibold">Als Partner listen lassen</div>
                  <p className="mt-1.5 text-sm leading-6 text-white/70">
                    Restaurant, Hotel, Event-Dienstleister? Erscheine in KI-generierten Tagesplänen und werde entdeckt.
                  </p>
                </div>
                <div className="mt-auto">
                  <Link
                    href="/partner/onboarding?type=corporate"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-[var(--text-strong)] transition hover:bg-white/90"
                  >
                    Jetzt Partner werden
                  </Link>
                </div>
              </div>

              {/* Business */}
              <div className="flex flex-col gap-4 rounded-[var(--radius-card-sm)] bg-blue-600 p-5 text-white shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-2xl leading-none">⚡</span>
                  <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white/90">
                    Für Unternehmen
                  </span>
                </div>
                <div>
                  <div className="font-semibold">Business & Mitarbeiter-Events</div>
                  <p className="mt-1.5 text-sm leading-6 text-white/70">
                    Teambuilding, Betriebsausflüge, Weihnachtsfeiern — digitale Tagesagenda für jeden Teilnehmer.
                  </p>
                </div>
                <div className="mt-auto">
                  <Link
                    href="/business/dashboard"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-white/90"
                  >
                    Business-Dashboard öffnen
                  </Link>
                </div>
              </div>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfilePageInner />
    </Suspense>
  );
}
