"use client";

import Image from "next/image";
import Link from "next/link";

const NEXT_IMAGE_SAFE_HOSTS = new Set([
  "nxrkhlokadhwwtuoglxa.supabase.co",
  "images.unsplash.com", "plus.unsplash.com",
  "upload.wikimedia.org", "commons.wikimedia.org",
  "lh3.googleusercontent.com", "graph.microsoft.com",
  "res.cloudinary.com", "i.imgur.com", "cdn.pixabay.com", "images.pexels.com",
]);

function isSafeImageHost(url: string | null): boolean {
  if (!url) return false;
  try { return NEXT_IMAGE_SAFE_HOSTS.has(new URL(url).hostname); } catch { return false; }
}
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { deleteRoadtripRoute, fetchMyRoadtripRoutesWithError } from "@/lib/roadtrip/client";
import type { RoadtripRoute } from "@/lib/roadtrip/types";
import { stopSequenceLabel } from "@/lib/roadtrip/types";
import { FREE_SAVED_PLANS_VISIBLE } from "@/lib/premium/limits";
import { usePremiumStatus } from "@/components/premium/usePremiumStatus";
import UpgradeModal from "@/components/premium/UpgradeModal";

type SavedPlanRow = {
  id: string;
  title: string | null;
  created_at: string;
  filters: unknown;
  slots: unknown;
  share_token?: string | null;
  ai_description?: string | null;
};

type UserRouteRow = {
  id: string;
  city_slug: string | null;
  title: string | null;
  slug: string | null;
  description: string | null;
  cover_image_url: string | null;
  visibility: "private" | "unlisted" | "public";
  avg_rating: number | null;
  bookmark_count: number | null;
  updated_at: string;
};

type BookmarkedRouteRow = {
  route_id: string;
  created_at: string;
  user_routes: UserRouteRow | UserRouteRow[] | null;
};

type SavedRouteItem = UserRouteRow & {
  saved_at: string;
};

type Segment = "all" | "tagesplanung" | "roadtrip" | "events";

type ToastKind = "success" | "error" | "info";
type ToastState = { message: string; kind: ToastKind } | null;

type EventPlanRow = {
  id: string;
  title: string | null;
  occasion_slug: string | null;
  city_slug: string | null;
  event_date: string | null;
  guests: number | null;
  status: string | null;
  created_at: string;
  updated_at: string;
};

type QuickItem = {
  kind: "plan" | "route";
  id: string;
  href: string;
  title: string;
  meta: string;
  timestamp: string;
  imageUrl?: string | null;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unbekannt";
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Zuletzt unbekannt";

  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (diffDays === 0) return "Heute genutzt";
  if (diffDays === 1) return "Gestern genutzt";
  if (diffDays < 7) return `Vor ${diffDays} Tagen genutzt`;
  return `Zuletzt ${formatDate(value)}`;
}

function routeCityLabel(citySlug: string | null) {
  if (!citySlug) return "Ohne Stadt";
  return citySlug
    .split("-")
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
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

function planContext(plan: SavedPlanRow) {
  const filters = (plan.filters && typeof plan.filters === "object"
    ? (plan.filters as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const citySlug =
    (typeof filters.citySlug === "string" && filters.citySlug) ||
    (typeof filters.city === "string" && filters.city) ||
    null;
  const occasion =
    (typeof filters.occasion === "string" && filters.occasion) ||
    (typeof filters.planMode === "string" && filters.planMode) ||
    null;
  const groupEnabled = Boolean(filters.groupEnabled);

  return {
    cityLabel: routeCityLabel(citySlug),
    occasionLabel: occasion ? occasion.charAt(0).toUpperCase() + occasion.slice(1) : "Persönlicher Plan",
    groupEnabled,
  };
}

function planStatus(plan: SavedPlanRow) {
  const hasSlots = Array.isArray(plan.slots) && plan.slots.length > 0;

  if (plan.share_token) {
    return {
      label: "Geteilt",
      tone: "pd24-status-info",
      helper: "Kann direkt wieder geöffnet oder weitergeteilt werden.",
    };
  }

  if (hasSlots) {
    return {
      label: "Abgeschlossen",
      tone: "pd24-status-success",
      helper: "Ein vollständiger Vorschlag liegt bereits vor.",
    };
  }

  return {
    label: "In Bearbeitung",
    tone: "pd24-status-warning",
    helper: "Rahmen gesetzt, noch nicht final abgeschlossen.",
  };
}

function isDraft(plan: SavedPlanRow) {
  const hasSlots = Array.isArray(plan.slots) && plan.slots.length > 0;
  return !hasSlots && !plan.share_token;
}

function draftProgress(plan: SavedPlanRow) {
  const filters = (plan.filters && typeof plan.filters === "object"
    ? (plan.filters as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const checkpoints = [
    typeof filters.citySlug === "string" || typeof filters.city === "string",
    typeof filters.occasion === "string",
    Array.isArray(plan.slots) && plan.slots.length > 0,
    Boolean(filters.groupEnabled) || Boolean(plan.share_token),
  ];

  const done = checkpoints.filter(Boolean).length;
  return Math.max(15, Math.round((done / checkpoints.length) * 85));
}

function statusPillClass(tone: string) {
  return `inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${tone}`;
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
      className="h-4 w-4"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function SectionHeader({
  title,
  count,
  description,
}: {
  title: string;
  count?: number;
  description?: string;
}) {
  return (
    <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-strong)] sm:text-xl">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p> : null}
      </div>
      {typeof count === "number" ? (
        <span className="rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1 text-xs text-[var(--text-muted)]">
          {count}
        </span>
      ) : null}
    </div>
  );
}

function EmptyState({
  title,
  description,
  primaryHref,
  primaryLabel,
  onPrimaryClick,
  secondaryHref,
  secondaryLabel,
}: {
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel: string;
  onPrimaryClick?: () => void;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  const primaryClass = "pd24-btn pd24-btn-primary";

  return (
    <div className="rounded-[28px] border border-dashed border-[var(--line-subtle)] bg-white px-6 py-8 text-center">
      <div className="mx-auto max-w-xl">
        <h3 className="text-lg font-semibold text-[var(--text-strong)]">{title}</h3>
        <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">{description}</p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          {onPrimaryClick ? (
            <button type="button" onClick={onPrimaryClick} className={primaryClass}>
              {primaryLabel}
            </button>
          ) : primaryHref ? (
            <Link href={primaryHref} className={primaryClass}>
              {primaryLabel}
            </Link>
          ) : null}
          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="pd24-btn pd24-btn-secondary"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-white p-5">
      <div className="h-3 w-24 rounded bg-[var(--bg-panel)]" />
      <div className="mt-4 h-5 w-2/3 rounded bg-[var(--bg-panel)]" />
      <div className="mt-3 h-3 w-1/2 rounded bg-[var(--bg-panel)]" />
      <div className="mt-6 flex gap-2">
        <div className="h-9 w-28 rounded-full bg-[var(--bg-panel)]" />
        <div className="h-9 w-24 rounded-full bg-[var(--bg-panel)]" />
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex animate-pulse items-center gap-3 px-3 py-3 sm:px-4">
      <div className="h-11 w-11 shrink-0 rounded-[var(--radius-control)] bg-[var(--bg-panel)]" />
      <div className="min-w-0 flex-1">
        <div className="h-4 w-1/3 rounded bg-[var(--bg-panel)]" />
        <div className="mt-2 h-3 w-1/2 rounded bg-[var(--bg-panel)]" />
      </div>
      <div className="h-6 w-20 rounded-full bg-[var(--bg-panel)]" />
    </div>
  );
}

// Ab 7 Einträgen scrollt die Liste intern (max-Höhe ≈ 6,5 Zeilen, damit die
// angeschnittene nächste Zeile als Scroll-Hinweis sichtbar bleibt).
const LIST_SCROLL_THRESHOLD = 6;

function ListContainer({ children }: { children: React.ReactNode }) {
  const count = React.Children.count(children);
  return (
    <div
      className={cx(
        "divide-y divide-[var(--line-subtle)] rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-white shadow-sm",
        count > LIST_SCROLL_THRESHOLD ? "max-h-[26rem] overflow-y-auto" : "overflow-hidden"
      )}
    >
      {children}
    </div>
  );
}

// Kompakte Listenzeile für gespeicherte Inhalte: Thumbnail/Emoji, Titel +
// eine Meta-Zeile, Status-Pill, Löschen mit Inline-Bestätigung. Die Zeile
// selbst ist der Link — Aktions-Buttons pro Eintrag entfallen.
function SavedListRow({
  href,
  imageUrl,
  emoji,
  title,
  meta,
  pill,
  pillDot,
  deleteLabel,
  onDelete,
}: {
  href: string;
  imageUrl?: string | null;
  emoji: string;
  title: string;
  meta: string;
  pill?: { label: string; tone: string } | null;
  pillDot?: boolean;
  deleteLabel?: string;
  onDelete?: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    await onDelete();
    setDeleting(false);
    setConfirming(false);
  }

  return (
    <div
      className={cx(
        "flex min-h-14 items-center gap-3 px-3 transition sm:px-4",
        confirming ? "bg-[var(--state-error)]/5" : "hover:bg-[var(--bg-surface)]"
      )}
    >
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 py-2.5">
        {imageUrl ? (
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-[var(--bg-surface)]">
            <Image
              src={imageUrl}
              alt=""
              fill
              unoptimized={!isSafeImageHost(imageUrl)}
              sizes="44px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--bg-surface)] text-lg">
            {emoji}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[var(--text-strong)]">{title}</div>
          <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{meta}</div>
        </div>
      </Link>

      {confirming ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-[var(--text-muted)] sm:inline">{deleteLabel ?? "Löschen?"}</span>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="rounded-full bg-[var(--state-error)] px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {deleting ? "…" : "Löschen"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="rounded-full border border-[var(--line-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)]"
          >
            Abbrechen
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1.5">
          {pill ? (
            <span className={cx(statusPillClass(pill.tone), "hidden sm:inline-flex")}>
              {pillDot ? (
                <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--state-success)]" />
              ) : null}
              {pill.label}
            </span>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              aria-label={deleteLabel ?? "Eintrag löschen"}
              onClick={() => setConfirming(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-soft)] transition hover:bg-[var(--state-error)]/10 hover:text-[var(--state-error)]"
            >
              <TrashIcon />
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

// Horizontale Scroll-Reihe mit Pfeil-Buttons: der Scrollbalken ist ausgeblendet,
// ohne Buttons wäre die Reihe mit der Maus nicht bewegbar (nur Touch/Trackpad).
function QuickScroller({ children }: { children: React.ReactNode }) {
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const childCount = React.Children.count(children);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows, childCount]);

  function scrollByStep(direction: 1 | -1) {
    scrollerRef.current?.scrollBy({ left: direction * 480, behavior: "smooth" });
  }

  const arrowClass =
    "absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-white text-[var(--text-strong)] shadow-md transition hover:bg-[var(--bg-surface)] sm:flex";

  return (
    <div className="relative">
      <div ref={scrollerRef} className="pd24-scrollbar-none flex snap-x gap-3 overflow-x-auto overscroll-x-contain pb-1">
        {children}
      </div>
      {canScrollLeft ? (
        <button type="button" aria-label="Zurück scrollen" onClick={() => scrollByStep(-1)} className={cx(arrowClass, "-left-3")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
      ) : null}
      {canScrollRight ? (
        <button type="button" aria-label="Weiter scrollen" onClick={() => scrollByStep(1)} className={cx(arrowClass, "-right-3")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      ) : null}
    </div>
  );
}

function QuickCard({ item }: { item: QuickItem }) {
  return (
    <Link
      href={item.href}
      className="min-w-[220px] max-w-[240px] shrink-0 snap-start overflow-hidden rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-white shadow-sm transition hover:border-[var(--line-strong)] hover:shadow-md"
    >
      <div className="relative h-20 bg-[var(--bg-surface)]">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt=""
            fill
            unoptimized={!isSafeImageHost(item.imageUrl)}
            sizes="240px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl">
            {item.kind === "plan" ? "🗓️" : "📍"}
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="line-clamp-1 text-sm font-semibold text-[var(--text-strong)]">
          {item.title}
        </div>
        <div className="mt-1 truncate text-xs text-[var(--text-muted)]">
          {item.meta} · {formatRelativeDate(item.timestamp)}
        </div>
      </div>
    </Link>
  );
}

function roadtripStatusBadge(status: string) {
  if (status === "active")
    return { label: "Aktiv", tone: "pd24-status-success", dot: true };
  if (status === "completed")
    return { label: "Abgeschlossen", tone: "pd24-status-info", dot: false };
  return { label: "Entwurf", tone: "pd24-status-warning", dot: false };
}

function eventOccasionLabel(slug: string | null) {
  if (!slug) return "Besonderer Anlass";
  const map: Record<string, string> = {
    geburtstag: "Geburtstag", hochzeit: "Hochzeit", jubilaeum: "Jubiläum",
    ausflug: "Gruppenausflug", weihnachten: "Weihnachten", silvester: "Silvester",
    valentinstag: "Valentinstag", jga: "JGA", firmenevent: "Firmenevent",
  };
  return map[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

export default function SavedPage() {
  const [mounted, setMounted] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [plans, setPlans] = useState<SavedPlanRow[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<SavedRouteItem[]>([]);
  const [roadtripRoutes, setRoadtripRoutes] = useState<RoadtripRoute[]>([]);
  const [eventPlans, setEventPlans] = useState<EventPlanRow[]>([]);
  const [segment, setSegment] = useState<Segment>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  function showToast(message: string, kind: ToastKind = "info") {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 2600);
  }

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    let active = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setUserId(data.session?.user?.id ?? null);
      setAuthReady(true);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setAuthReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [mounted]);

  const loadSavedContent = useCallback(async () => {
    if (!authReady) return;
    if (!userId) {
      setPlans([]);
      setSavedRoutes([]);
      setRoadtripRoutes([]);
      setEventPlans([]);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    setIsLoading(true);
    setHasError(false);

    try {
      const [plansResp, bookmarksResp, myRoadtripsResp, eventPlansResp] = await Promise.all([
        supabase
          .from("plans")
          .select("id, title, created_at, filters, slots, share_token, ai_description")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("user_route_bookmarks")
          .select(
            "route_id, created_at, user_routes(id, city_slug, title, slug, description, cover_image_url, visibility, avg_rating, bookmark_count, updated_at)"
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
        fetchMyRoadtripRoutesWithError(),
        supabase
          .from("event_plans")
          .select("id, title, occasion_slug, city_slug, event_date, guests, status, created_at, updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(50),
      ]);

      const loadError =
        plansResp.error || bookmarksResp.error || eventPlansResp.error || myRoadtripsResp.error;
      if (loadError) {
        console.error("Saved content load failed:", loadError);
        setHasError(true);
        return;
      }

      const nextPlans = (plansResp.data as SavedPlanRow[] | null) ?? [];
      const nextRoutes = ((bookmarksResp.data as BookmarkedRouteRow[] | null) ?? [])
        .map((row) => {
          const nested = Array.isArray(row.user_routes) ? row.user_routes[0] : row.user_routes;
          if (!nested) return null;
          return {
            ...nested,
            saved_at: row.created_at,
          } satisfies SavedRouteItem;
        })
        .filter((value): value is SavedRouteItem => Boolean(value));

      setPlans(nextPlans);
      setSavedRoutes(nextRoutes);
      setRoadtripRoutes(myRoadtripsResp.routes);
      setEventPlans((eventPlansResp.data as EventPlanRow[] | null) ?? []);
    } catch (error) {
      console.error("Saved content unexpected load error:", error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [authReady, userId]);

  useEffect(() => {
    void loadSavedContent();
  }, [loadSavedContent]);

  const { isPremium, usedThisMonth } = usePremiumStatus(userId);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Free sieht die neuesten Pläne — ältere bleiben gespeichert und werden
  // mit Premium wieder sichtbar. Solange der Status lädt (null), nichts kappen.
  const visiblePlans = useMemo(
    () => (isPremium === false ? plans.slice(0, FREE_SAVED_PLANS_VISIBLE) : plans),
    [plans, isPremium]
  );
  const hiddenPlanCount = plans.length - visiblePlans.length;

  const drafts = useMemo(() => visiblePlans.filter(isDraft), [visiblePlans]);
  const finishedPlans = useMemo(() => visiblePlans.filter((plan) => !isDraft(plan)), [visiblePlans]);

  async function deletePlan(id: string) {
    const { error } = await supabase.from("plans").delete().eq("id", id);
    if (error) {
      console.error("Delete plan error:", error);
      showToast("Der Plan konnte nicht gelöscht werden — bitte versuche es erneut.", "error");
      return;
    }
    setPlans((prev) => prev.filter((p) => p.id !== id));
    showToast("Plan gelöscht.", "success");
  }

  async function removeBookmark(routeId: string) {
    if (!userId) return;
    const { error } = await supabase
      .from("user_route_bookmarks")
      .delete()
      .eq("route_id", routeId)
      .eq("user_id", userId);
    if (error) {
      console.error("Remove bookmark error:", error);
      showToast("Die Route konnte nicht entfernt werden — bitte versuche es erneut.", "error");
      return;
    }
    setSavedRoutes((prev) => prev.filter((r) => r.id !== routeId));
    showToast("Route entfernt.", "success");
  }

  async function deleteRoadtrip(id: string) {
    const { error } = await deleteRoadtripRoute(id);
    if (error) {
      console.error("Delete roadtrip error:", error);
      showToast("Der Roadtrip konnte nicht gelöscht werden — bitte versuche es erneut.", "error");
      return;
    }
    setRoadtripRoutes((prev) => prev.filter((r) => r.id !== id));
    showToast("Roadtrip gelöscht.", "success");
  }

  const quickItems = useMemo<QuickItem[]>(() => {
    const planItems = visiblePlans.map((plan) => {
      const context = planContext(plan);
      return {
        kind: "plan" as const,
        id: plan.id,
        href: `/planner?planId=${plan.id}&resume=1`,
        title: plan.title?.trim() || context.occasionLabel,
        meta: `${context.cityLabel} · ${context.groupEnabled ? "Gruppe" : "Solo"}`,
        timestamp: plan.created_at,
      };
    });

    const routeItems = savedRoutes.map((route) => ({
      kind: "route" as const,
      id: route.id,
      href: route.slug ? `/routes/${route.slug}` : `/routes?routeId=${route.id}`,
      title: route.title?.trim() || "Unbenannte Route",
      meta: routeCityLabel(route.city_slug),
      timestamp: route.saved_at,
      imageUrl: route.cover_image_url,
    }));

    const roadtripItems = roadtripRoutes.map((rt) => ({
      kind: "route" as const,
      id: rt.id,
      href: `/roadtrip/routes/${rt.slug}`,
      title: rt.title,
      meta: `Roadtrip · ${rt.stops.length} Städte`,
      timestamp: rt.updated_at,
      imageUrl: rt.cover_image_url,
    }));

    return [...planItems, ...routeItems, ...roadtripItems]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);
  }, [visiblePlans, savedRoutes, roadtripRoutes]);

  const activeRoadtrip = useMemo(
    () => roadtripRoutes.find((r) => r.status === "active") ?? null,
    [roadtripRoutes]
  );

  const segments = useMemo(
    () => [
      { key: "all" as const, label: "Alle", count: visiblePlans.length + savedRoutes.length + roadtripRoutes.length + eventPlans.length },
      { key: "tagesplanung" as const, label: "Tagesplanung", count: visiblePlans.length + savedRoutes.length },
      { key: "roadtrip" as const, label: "Roadtrip", count: roadtripRoutes.length },
      { key: "events" as const, label: "Events", count: eventPlans.length },
    ],
    [visiblePlans.length, savedRoutes.length, roadtripRoutes.length, eventPlans.length]
  );

  const isEmpty = !isLoading && !hasError && plans.length === 0 && savedRoutes.length === 0 && roadtripRoutes.length === 0 && eventPlans.length === 0;

  if (!mounted) return null;

  if (authReady && !userId) {
    return (
      <div className="pd24-page-narrow py-16">
        <EmptyState
          title="Bitte melde dich an, um deine gespeicherten Inhalte zu sehen."
          description="Hier erscheinen deine Pläne, Routen und Entwürfe, sobald du sie in deinem Konto speicherst."
          primaryHref="/profile"
          primaryLabel="Zum Profil"
          secondaryHref="/planner"
          secondaryLabel="Erst einmal planen"
        />
      </div>
    );
  }

  if (hasError && !isLoading) {
    return (
      <div className="pd24-page-narrow py-16">
        <EmptyState
          title="Gespeicherte Inhalte konnten gerade nicht geladen werden."
          description="Bitte versuche es erneut. Wenn das Problem bleibt, prüfe zuerst deine Anmeldung und lade die Seite neu."
          primaryLabel="Erneut versuchen"
          onPrimaryClick={() => void loadSavedContent()}
          secondaryHref="/planner"
          secondaryLabel="Zum Planner"
        />
      </div>
    );
  }

  return (
    <div className="pd24-page-wide space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-3xl">
          Meine Pläne
        </h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/planner" className="pd24-btn pd24-btn-sm pd24-btn-primary">
            Neuen Plan starten
          </Link>
          <Link href="/explore" className="pd24-btn pd24-btn-sm pd24-btn-secondary">
            Entdecken
          </Link>
        </div>
      </section>

      {/* ── Aktiver Roadtrip Banner ──────────────────────────────────────── */}
      {!isLoading && activeRoadtrip && (
        <section className="pd24-status-success flex items-center gap-4 rounded-2xl px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--state-success)] text-white text-sm">
            🗺️
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--state-success)]" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                Aktiver Roadtrip
              </span>
            </div>
            <div className="mt-0.5 font-semibold text-[var(--text-strong)] truncate">{activeRoadtrip.title}</div>
            <div className="text-xs text-[var(--text-muted)] truncate">{stopSequenceLabel(activeRoadtrip.stops)}</div>
          </div>
          <Link
            href={`/roadtrip/routes/${activeRoadtrip.slug}`}
            className="pd24-btn pd24-btn-sm shrink-0 bg-[var(--state-success)] text-white"
          >
            Fortsetzen →
          </Link>
        </section>
      )}

      {(isLoading || quickItems.length > 0) && (
        <section>
          <SectionHeader title="Zuletzt genutzt" />
          <QuickScroller>
            {isLoading
              ? Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={`quick-skeleton-${index}`} />)
              : quickItems.map((item) => <QuickCard key={`${item.kind}-${item.id}`} item={item} />)}
          </QuickScroller>
        </section>
      )}

      <div className="pd24-scrollbar-none flex gap-1.5 overflow-x-auto overscroll-x-contain pb-1">
        {segments.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSegment(item.key)}
            className={cx(
              "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
              segment === item.key
                ? "bg-[var(--text-strong)] text-white shadow-sm"
                : "border border-[var(--line-subtle)] bg-white text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-strong)]"
            )}
          >
            {item.label}
            {!isLoading ? (
              <span
                className={cx(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  segment === item.key ? "bg-white/20 text-white" : "bg-[var(--bg-surface)] text-[var(--text-muted)]"
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {isEmpty ? (
        <EmptyState
          title="Noch nichts gespeichert"
          description="Hier landen Pläne, Routen und Entwürfe, die du später wieder aufgreifen möchtest."
          primaryHref="/planner"
          primaryLabel="Tag planen"
          secondaryHref="/explore"
          secondaryLabel="Routen entdecken"
        />
      ) : null}

      {(segment === "tagesplanung" || (segment === "all" && (isLoading || finishedPlans.length > 0))) && !isEmpty ? (
        <section>
          <SectionHeader title="Gespeicherte Pläne" count={finishedPlans.length} />

          {hiddenPlanCount > 0 ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-card-sm)] border border-[rgba(196,137,79,0.28)] bg-[rgba(255,249,241,0.7)] px-4 py-2.5">
              <span className="text-xs text-[var(--brand-warm-ink)]">
                {hiddenPlanCount} ältere Pl{hiddenPlanCount === 1 ? "an ist" : "äne sind"} archiviert — Free zeigt die letzten {FREE_SAVED_PLANS_VISIBLE}.
              </span>
              <button
                type="button"
                onClick={() => setShowUpgrade(true)}
                className="text-xs font-semibold text-[var(--brand-warm-ink)] underline underline-offset-2 hover:opacity-80"
              >
                Mit Premium freischalten
              </button>
            </div>
          ) : null}

          {isLoading ? (
            <ListContainer>
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonRow key={`plan-skeleton-${index}`} />
              ))}
            </ListContainer>
          ) : finishedPlans.length === 0 ? (
            <EmptyState
              title="Noch keine Pläne gespeichert."
              description="Starte deinen ersten Tag."
              primaryHref="/planner"
              primaryLabel="Tag planen"
            />
          ) : (
            <ListContainer>
              {finishedPlans.map((plan) => {
                const context = planContext(plan);
                const status = planStatus(plan);
                return (
                  <SavedListRow
                    key={plan.id}
                    href={`/planner?planId=${plan.id}&resume=1`}
                    emoji="🗓️"
                    title={plan.title?.trim() || context.occasionLabel}
                    meta={`${context.cityLabel} · ${context.occasionLabel} · ${context.groupEnabled ? "Gruppe" : "Solo"} · Erstellt ${formatDate(plan.created_at)}`}
                    pill={{ label: status.label, tone: status.tone }}
                    deleteLabel="Plan löschen?"
                    onDelete={() => deletePlan(plan.id)}
                  />
                );
              })}
            </ListContainer>
          )}
        </section>
      ) : null}

      {(segment === "tagesplanung" || (segment === "all" && (isLoading || savedRoutes.length > 0))) && !isEmpty ? (
        <section>
          <SectionHeader title="Gespeicherte Routen" count={savedRoutes.length} />

          {isLoading ? (
            <ListContainer>
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonRow key={`route-skeleton-${index}`} />
              ))}
            </ListContainer>
          ) : savedRoutes.length === 0 ? (
            <EmptyState
              title="Noch keine Routen gespeichert."
              description="Entdecke Routen in deiner Stadt."
              primaryHref="/explore"
              primaryLabel="Entdecken"
            />
          ) : (
            <ListContainer>
              {savedRoutes.map((route) => (
                <SavedListRow
                  key={`${route.id}-${route.saved_at}`}
                  href={route.slug ? `/routes/${route.slug}` : `/routes?routeId=${route.id}`}
                  imageUrl={route.cover_image_url}
                  emoji="📍"
                  title={route.title?.trim() || "Unbenannte Route"}
                  meta={`${routeCityLabel(route.city_slug)} · Gespeichert ${formatDate(route.saved_at)}`}
                  deleteLabel="Lesezeichen entfernen?"
                  onDelete={() => removeBookmark(route.id)}
                />
              ))}
            </ListContainer>
          )}
        </section>
      ) : null}

      {(segment === "roadtrip" || (segment === "all" && (isLoading || roadtripRoutes.length > 0))) && !isEmpty ? (
        <section>
          <SectionHeader title="Meine Roadtrips" count={roadtripRoutes.length} />

          {isLoading ? (
            <ListContainer>
              {Array.from({ length: 2 }).map((_, index) => (
                <SkeletonRow key={`roadtrip-skeleton-${index}`} />
              ))}
            </ListContainer>
          ) : roadtripRoutes.length === 0 ? (
            <EmptyState
              title="Noch kein Roadtrip geplant."
              description="Plane deinen ersten Mehrstädte-Roadtrip."
              primaryHref="/roadtrip"
              primaryLabel="Roadtrip planen"
              secondaryHref="/roadtrip/routes"
              secondaryLabel="Vorlagen entdecken"
            />
          ) : (
            <ListContainer>
              {roadtripRoutes.map((rt) => {
                const badge = roadtripStatusBadge(rt.status);
                return (
                  <SavedListRow
                    key={rt.id}
                    href={`/roadtrip/routes/${rt.slug}`}
                    imageUrl={rt.cover_image_url}
                    emoji="🗺️"
                    title={rt.title}
                    meta={`${rt.stops.length} Städte · ${rt.total_nights} Nächte · ${stopSequenceLabel(rt.stops)}`}
                    pill={{ label: badge.label, tone: badge.tone }}
                    pillDot={badge.dot}
                    deleteLabel="Roadtrip löschen?"
                    onDelete={() => deleteRoadtrip(rt.id)}
                  />
                );
              })}
            </ListContainer>
          )}
        </section>
      ) : null}

      {(segment === "tagesplanung" || (segment === "all" && (isLoading || drafts.length > 0))) && !isEmpty ? (
        <section>
          <SectionHeader title="Offene Entwürfe" count={drafts.length} />

          {isLoading ? (
            <ListContainer>
              {Array.from({ length: 2 }).map((_, index) => (
                <SkeletonRow key={`draft-skeleton-${index}`} />
              ))}
            </ListContainer>
          ) : drafts.length === 0 ? (
            <EmptyState
              title="Keine offenen Entwürfe."
              description="Alle Pläne sind abgeschlossen."
              primaryHref="/planner"
              primaryLabel="Tag planen"
            />
          ) : (
            <ListContainer>
              {drafts.map((plan) => {
                const context = planContext(plan);
                return (
                  <SavedListRow
                    key={plan.id}
                    href={`/planner?planId=${plan.id}&resume=1`}
                    emoji="✏️"
                    title={plan.title?.trim() || context.occasionLabel}
                    meta={`${context.cityLabel} · ${draftProgress(plan)}% vorbereitet`}
                    pill={{ label: "In Bearbeitung", tone: "pd24-status-warning" }}
                    deleteLabel="Entwurf löschen?"
                    onDelete={() => deletePlan(plan.id)}
                  />
                );
              })}
            </ListContainer>
          )}
        </section>
      ) : null}

      {(segment === "events" || (segment === "all" && (isLoading || eventPlans.length > 0))) && !isEmpty ? (
        <section>
          <SectionHeader title="Meine Event-Pläne" count={eventPlans.length} />

          {isLoading ? (
            <ListContainer>
              {Array.from({ length: 2 }).map((_, index) => (
                <SkeletonRow key={`event-skeleton-${index}`} />
              ))}
            </ListContainer>
          ) : eventPlans.length === 0 ? (
            <EmptyState
              title="Noch kein Event geplant."
              description="Plane einen besonderen Anlass für Geburtstage, Jubiläen oder Gruppenausflüge."
              primaryHref="/feiern"
              primaryLabel="Event planen"
            />
          ) : (
            <ListContainer>
              {eventPlans.map((ep) => {
                const statusTone =
                  ep.status === "complete" ? "pd24-status-success"
                  : ep.status === "active" ? "pd24-status-info"
                  : "pd24-status-warning";
                const statusLabel =
                  ep.status === "complete" ? "Abgeschlossen"
                  : ep.status === "active" ? "In Planung"
                  : "Entwurf";
                const metaParts = [
                  eventOccasionLabel(ep.occasion_slug),
                  ep.city_slug ? routeCityLabel(ep.city_slug) : null,
                  ep.event_date ? formatDate(ep.event_date) : null,
                  typeof ep.guests === "number" && ep.guests > 0 ? `${ep.guests} Personen` : null,
                ].filter(Boolean);
                return (
                  <SavedListRow
                    key={ep.id}
                    href={`/feiern/plan/${ep.id}`}
                    emoji="🎉"
                    title={ep.title?.trim() || eventOccasionLabel(ep.occasion_slug)}
                    meta={metaParts.join(" · ")}
                    pill={{ label: statusLabel, tone: statusTone }}
                  />
                );
              })}
            </ListContainer>
          )}
        </section>
      ) : null}

      <UpgradeModal open={showUpgrade} used={usedThisMonth} limit={3} onClose={() => setShowUpgrade(false)} />

      {toast ? (
        <div
          className={`fixed bottom-24 sm:bottom-4 left-1/2 z-[1400] -translate-x-1/2 rounded-xl px-4 py-2 text-sm shadow-lg ${
            toast.kind === "error" ? "bg-[var(--state-error)] text-white" : "bg-[var(--text-strong)] text-white"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
