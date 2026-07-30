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
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { deleteRoadtripRoute, fetchMyRoadtripRoutes } from "@/lib/roadtrip/client";
import type { RoadtripRoute } from "@/lib/roadtrip/types";
import { stopSequenceLabel, occasionLabel, budgetLabel } from "@/lib/roadtrip/types";

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

function DeleteConfirmRow({
  label,
  onConfirm,
  onCancel,
  deleting,
}: {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50/60 px-4 py-3">
      <p className="text-xs font-medium text-red-700">{label}</p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={deleting}
          className="rounded-xl border border-[var(--line-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:border-[var(--line-strong)] disabled:opacity-50"
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={deleting}
          className="rounded-xl bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
        >
          {deleting ? "…" : "Ja, löschen"}
        </button>
      </div>
    </div>
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
  const primaryClass =
    "inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--text-strong)] px-5 text-sm font-medium text-white transition hover:opacity-95";

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
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--line-subtle)] px-5 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)]"
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
    <div className="animate-pulse rounded-[24px] border border-[var(--line-subtle)] bg-white p-5">
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

function QuickCard({ item }: { item: QuickItem }) {
  return (
    <Link
      href={item.href}
      className="flex min-h-[136px] min-w-[220px] flex-col justify-between rounded-[24px] border border-[var(--line-subtle)] bg-white p-4 shadow-sm transition hover:border-[var(--line-strong)] hover:shadow-md"
    >
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {item.kind === "plan" ? "Zuletzt genutzter Plan" : "Zuletzt genutzte Route"}
        </div>
        <div className="mt-3 line-clamp-2 text-base font-semibold text-[var(--text-strong)]">
          {item.title}
        </div>
        <div className="mt-2 text-sm text-[var(--text-muted)]">{item.meta}</div>
      </div>
      <div className="mt-4 text-xs text-[var(--text-muted)]">{formatRelativeDate(item.timestamp)}</div>
    </Link>
  );
}

function PlanCard({ plan, onDelete }: { plan: SavedPlanRow; onDelete: (id: string) => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const context = planContext(plan);
  const status = planStatus(plan);

  async function handleDelete() {
    setDeleting(true);
    await onDelete(plan.id);
    setDeleting(false);
    setConfirming(false);
  }

  return (
    <div className={cx(
      "rounded-[24px] border bg-white p-5 shadow-sm transition hover:shadow-md",
      confirming ? "border-red-200" : "border-[var(--line-subtle)]"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {context.cityLabel}
          </div>
          <h3 className="mt-2 line-clamp-2 text-lg font-semibold text-[var(--text-strong)]">
            {plan.title?.trim() || context.occasionLabel}
          </h3>
          <div className="mt-2 text-sm text-[var(--text-muted)]">
            {context.occasionLabel}
            {context.groupEnabled ? " · Gruppe" : " · Solo"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={statusPillClass(status.tone)}>{status.label}</span>
          {!confirming && (
            <button
              type="button"
              aria-label="Plan löschen"
              onClick={() => setConfirming(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-soft)] transition hover:bg-red-50 hover:text-red-500"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>

      <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">
        {plan.ai_description?.trim() || status.helper}
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
        <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1">
          Erstellt {formatDate(plan.created_at)}
        </span>
        {plan.share_token ? (
          <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1">
            Teilbar
          </span>
        ) : null}
      </div>

      {confirming ? (
        <DeleteConfirmRow
          label="Plan dauerhaft löschen?"
          onConfirm={handleDelete}
          onCancel={() => setConfirming(false)}
          deleting={deleting}
        />
      ) : (
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/planner?planId=${plan.id}`}
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--text-strong)] px-4 text-sm font-medium text-white transition hover:opacity-95"
          >
            Plan öffnen
          </Link>
          <Link
            href={`/planner?planId=${plan.id}&mode=edit`}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--line-subtle)] px-4 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)]"
          >
            Weiter planen
          </Link>
        </div>
      )}
    </div>
  );
}

function RouteCard({ route, onRemove }: { route: SavedRouteItem; onRemove: (id: string) => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const href = route.slug ? `/routes/${route.slug}` : `/routes?routeId=${route.id}`;

  async function handleRemove() {
    setDeleting(true);
    await onRemove(route.id);
    setDeleting(false);
    setConfirming(false);
  }

  return (
    <div className={cx(
      "rounded-[24px] border bg-white p-5 shadow-sm transition hover:shadow-md",
      confirming ? "border-red-200" : "border-[var(--line-subtle)]"
    )}>
      <div className="flex gap-4">
        {route.cover_image_url ? (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[18px]">
            <Image
              src={route.cover_image_url}
              alt=""
              fill
              unoptimized={!isSafeImageHost(route.cover_image_url)}
              sizes="64px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-[var(--bg-surface)] text-[var(--text-muted)]">
            <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.387 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .976.544l.062.029.018.008.006.003ZM10 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {routeCityLabel(route.city_slug)}
            </div>
            {!confirming && (
              <button
                type="button"
                aria-label="Lesezeichen entfernen"
                onClick={() => setConfirming(true)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--text-soft)] transition hover:bg-red-50 hover:text-red-500"
              >
                <TrashIcon />
              </button>
            )}
          </div>
          <h3 className="mt-2 line-clamp-2 text-lg font-semibold text-[var(--text-strong)]">
            {route.title?.trim() || "Unbenannte Route"}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm leading-7 text-[var(--text-muted)]">
            {route.description?.trim() || "Als Vorlage gespeichert, um sie später erneut zu nutzen."}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
        <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1">
          Gespeichert {formatDate(route.saved_at)}
        </span>
        {typeof route.bookmark_count === "number" && route.bookmark_count > 0 ? (
          <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1">
            {route.bookmark_count} gespeichert
          </span>
        ) : null}
        {typeof route.avg_rating === "number" && route.avg_rating > 0 ? (
          <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1">
            {route.avg_rating.toFixed(1)} Bewertung
          </span>
        ) : null}
      </div>

      {confirming ? (
        <DeleteConfirmRow
          label="Lesezeichen entfernen?"
          onConfirm={handleRemove}
          onCancel={() => setConfirming(false)}
          deleting={deleting}
        />
      ) : (
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={href}
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--text-strong)] px-4 text-sm font-medium text-white transition hover:opacity-95"
          >
            Route öffnen
          </Link>
          <Link
            href="/explore"
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--line-subtle)] px-4 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)]"
          >
            Mehr entdecken
          </Link>
        </div>
      )}
    </div>
  );
}

function DraftCard({ plan, onDelete }: { plan: SavedPlanRow; onDelete: (id: string) => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const context = planContext(plan);
  const progress = draftProgress(plan);

  async function handleDelete() {
    setDeleting(true);
    await onDelete(plan.id);
    setDeleting(false);
    setConfirming(false);
  }

  return (
    <div className={cx(
      "rounded-[24px] border bg-white p-5 shadow-sm transition hover:shadow-md",
      confirming ? "border-red-200" : "border-[var(--line-subtle)]"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Entwurf · {context.cityLabel}
          </div>
          <h3 className="mt-2 line-clamp-2 text-lg font-semibold text-[var(--text-strong)]">
            {plan.title?.trim() || context.occasionLabel}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={statusPillClass("pd24-status-warning")}>In Bearbeitung</span>
          {!confirming && (
            <button
              type="button"
              aria-label="Entwurf löschen"
              onClick={() => setConfirming(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-soft)] transition hover:bg-red-50 hover:text-red-500"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>Fortschritt</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg-panel)]">
          <div
            className="h-full rounded-full bg-[var(--text-strong)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">
        Rahmen und Richtung sind schon angelegt. Öffne den Entwurf erneut und führe ihn zu einem belastbaren Plan.
      </p>

      {confirming ? (
        <DeleteConfirmRow
          label="Entwurf dauerhaft löschen?"
          onConfirm={handleDelete}
          onCancel={() => setConfirming(false)}
          deleting={deleting}
        />
      ) : (
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/planner?planId=${plan.id}&mode=edit`}
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--text-strong)] px-4 text-sm font-medium text-white transition hover:opacity-95"
          >
            Weiter planen
          </Link>
        </div>
      )}
    </div>
  );
}

function roadtripStatusBadge(status: string) {
  if (status === "active")
    return { label: "Aktiv", tone: "pd24-status-success", dot: true };
  if (status === "completed")
    return { label: "Abgeschlossen", tone: "pd24-status-info", dot: false };
  return { label: "Entwurf", tone: "pd24-status-warning", dot: false };
}

function RoadtripCard({ route, onDelete }: { route: RoadtripRoute; onDelete: (id: string) => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const badge = roadtripStatusBadge(route.status);

  async function handleDelete() {
    setDeleting(true);
    await onDelete(route.id);
    setDeleting(false);
    setConfirming(false);
  }
  const sequence = stopSequenceLabel(route.stops);
  const detailHref = `/roadtrip/routes/${route.slug}`;
  const plannerHref = `/roadtrip?fromRouteSlug=${route.slug}`;

  return (
    <div
      className={cx(
        "rounded-[24px] border bg-white p-5 shadow-sm transition hover:shadow-md",
        confirming ? "border-red-200" : route.status === "active"
          ? "border-emerald-300 ring-2 ring-emerald-200/50"
          : "border-[var(--line-subtle)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            <span>🗺️ Roadtrip</span>
            <span>·</span>
            <span>{route.stops.length} Städte · {route.total_nights} Nächte</span>
          </div>
          <h3 className="mt-2 line-clamp-2 text-lg font-semibold text-[var(--text-strong)]">
            {route.title}
          </h3>
          <p className="mt-1 truncate text-sm text-[var(--text-muted)]">{sequence}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${badge.tone}`}
          >
            {badge.dot && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--state-success)]" />
            )}
            {badge.label}
          </span>
          {!confirming && (
            <button
              type="button"
              aria-label="Roadtrip löschen"
              onClick={() => setConfirming(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-soft)] transition hover:bg-red-50 hover:text-red-500"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>

      {route.description ? (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--text-muted)]">
          {route.description}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
        <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1">
          {occasionLabel(route.occasion)}
        </span>
        <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1">
          {budgetLabel(route.budget)}
        </span>
        <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1">
          Gespeichert {formatDate(route.created_at)}
        </span>
      </div>

      {confirming ? (
        <DeleteConfirmRow
          label="Roadtrip dauerhaft löschen?"
          onConfirm={handleDelete}
          onCancel={() => setConfirming(false)}
          deleting={deleting}
        />
      ) : (
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={detailHref}
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--text-strong)] px-4 text-sm font-medium text-white transition hover:opacity-95"
          >
            {route.status === "active" ? "Fortsetzen" : "Öffnen"}
          </Link>
          <Link
            href={plannerHref}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--line-subtle)] px-4 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)]"
          >
            Im Planner bearbeiten
          </Link>
        </div>
      )}
    </div>
  );
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

function EventPlanCard({ plan }: { plan: EventPlanRow }) {
  const href = `/events?planId=${plan.id}`;
  const statusTone =
    plan.status === "complete" ? "pd24-status-success"
    : plan.status === "active" ? "pd24-status-info"
    : "pd24-status-warning";
  const statusLabel =
    plan.status === "complete" ? "Abgeschlossen"
    : plan.status === "active" ? "In Planung"
    : "Entwurf";

  return (
    <div className="rounded-[24px] border border-[var(--line-subtle)] bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {eventOccasionLabel(plan.occasion_slug)}
            {plan.city_slug ? ` · ${routeCityLabel(plan.city_slug)}` : ""}
          </div>
          <h3 className="mt-2 line-clamp-2 text-lg font-semibold text-[var(--text-strong)]">
            {plan.title?.trim() || eventOccasionLabel(plan.occasion_slug)}
          </h3>
        </div>
        <span className={statusPillClass(statusTone)}>{statusLabel}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
        {plan.event_date ? (
          <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1">
            {formatDate(plan.event_date)}
          </span>
        ) : null}
        {typeof plan.guests === "number" && plan.guests > 0 ? (
          <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1">
            {plan.guests} Personen
          </span>
        ) : null}
        <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1">
          Bearbeitet {formatDate(plan.updated_at)}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={href}
          className="inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--text-strong)] px-4 text-sm font-medium text-white transition hover:opacity-95"
        >
          Event öffnen
        </Link>
        <Link
          href="/events"
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--line-subtle)] px-4 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)]"
        >
          Neues Event
        </Link>
      </div>
    </div>
  );
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
      const [plansResp, bookmarksResp, myRoadtrips, eventPlansResp] = await Promise.all([
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
        fetchMyRoadtripRoutes(),
        supabase
          .from("event_plans")
          .select("id, title, occasion_slug, city_slug, event_date, guests, status, created_at, updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(50),
      ]);

      if (plansResp.error || bookmarksResp.error) {
        console.error("Saved content load failed:", plansResp.error || bookmarksResp.error);
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
      setRoadtripRoutes(myRoadtrips);
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

  const drafts = useMemo(() => plans.filter(isDraft), [plans]);
  const finishedPlans = useMemo(() => plans.filter((plan) => !isDraft(plan)), [plans]);

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
    const planItems = plans.map((plan) => {
      const context = planContext(plan);
      return {
        kind: "plan" as const,
        id: plan.id,
        href: `/planner?planId=${plan.id}`,
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
    }));

    const roadtripItems = roadtripRoutes.map((rt) => ({
      kind: "route" as const,
      id: rt.id,
      href: `/roadtrip/routes/${rt.slug}`,
      title: rt.title,
      meta: `Roadtrip · ${rt.stops.length} Städte`,
      timestamp: rt.updated_at,
    }));

    return [...planItems, ...routeItems, ...roadtripItems]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);
  }, [plans, savedRoutes, roadtripRoutes]);

  const activeRoadtrip = useMemo(
    () => roadtripRoutes.find((r) => r.status === "active") ?? null,
    [roadtripRoutes]
  );

  const segments = useMemo(
    () => [
      { key: "all" as const, label: "Alle", count: plans.length + savedRoutes.length + roadtripRoutes.length + eventPlans.length },
      { key: "tagesplanung" as const, label: "Tagesplanung", count: plans.length + savedRoutes.length },
      { key: "roadtrip" as const, label: "Roadtrip", count: roadtripRoutes.length },
      { key: "events" as const, label: "Events", count: eventPlans.length },
    ],
    [plans.length, savedRoutes.length, roadtripRoutes.length, eventPlans.length]
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
    <div className="pd24-page-wide space-y-8">
      <section className="pd24-shell p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="pd24-kicker">Meine Pläne</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-4xl">
              Deine Pläne, Routen und Entwürfe an einem Ort
            </h1>
            <p className="mt-4 text-base leading-7 text-[var(--text-muted)] sm:text-lg">
              Hier findest du alles wieder, was du später fortsetzen, teilen oder erneut nutzen möchtest.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/planner"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--text-strong)] px-5 text-sm font-medium text-white transition hover:opacity-95"
            >
              Neuen Plan starten
            </Link>
            <Link
              href="/explore"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[var(--line-subtle)] px-5 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-surface)]"
            >
              Entdecken
            </Link>
          </div>
        </div>
      </section>

      {/* ── Aktiver Roadtrip Banner ──────────────────────────────────────── */}
      {!isLoading && activeRoadtrip && (
        <section className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white text-sm">
            🗺️
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Aktiver Roadtrip
              </span>
            </div>
            <div className="mt-0.5 font-semibold text-emerald-900 truncate">{activeRoadtrip.title}</div>
            <div className="text-xs text-emerald-600 truncate">{stopSequenceLabel(activeRoadtrip.stops)}</div>
          </div>
          <Link
            href={`/roadtrip/routes/${activeRoadtrip.slug}`}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Fortsetzen →
          </Link>
        </section>
      )}

      {(isLoading || quickItems.length > 0) && (
        <section>
          <SectionHeader
            title="Zuletzt genutzt"
            description="Schneller Wiedereinstieg in die zuletzt geöffneten Pläne und Routen."
          />
          <div className="pd24-scrollbar-none flex gap-3 overflow-x-auto overscroll-x-contain pb-1">
            {isLoading
              ? Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={`quick-skeleton-${index}`} />)
              : quickItems.map((item) => <QuickCard key={`${item.kind}-${item.id}`} item={item} />)}
          </div>
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

      {(segment === "all" || segment === "tagesplanung") && !isEmpty ? (
        <section>
          <SectionHeader
            title="Gespeicherte Pläne"
            count={finishedPlans.length}
            description="Persönliche und gemeinsame Planungen, die du wieder öffnen oder weiterführen kannst."
          />

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonCard key={`plan-skeleton-${index}`} />
              ))}
            </div>
          ) : finishedPlans.length === 0 ? (
            <EmptyState
              title="Noch keine Pläne gespeichert."
              description="Starte deinen ersten Tag."
              primaryHref="/planner"
              primaryLabel="Tag planen"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {finishedPlans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} onDelete={deletePlan} />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {(segment === "all" || segment === "tagesplanung") && !isEmpty ? (
        <section>
          <SectionHeader
            title="Gespeicherte Routen"
            count={savedRoutes.length}
            description="Gemerkte oder übernommene Routen aus Explore und öffentlichen Vorlagen."
          />

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonCard key={`route-skeleton-${index}`} />
              ))}
            </div>
          ) : savedRoutes.length === 0 ? (
            <EmptyState
              title="Noch keine Routen gespeichert."
              description="Entdecke Routen in deiner Stadt."
              primaryHref="/explore"
              primaryLabel="Entdecken"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {savedRoutes.map((route) => (
                <RouteCard key={`${route.id}-${route.saved_at}`} route={route} onRemove={removeBookmark} />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {(segment === "all" || segment === "roadtrip") && !isEmpty ? (
        <section>
          <SectionHeader
            title="Meine Roadtrips"
            count={roadtripRoutes.length}
            description="Mehrstädtige Reiserouten, die du geplant oder gestartet hast."
          />

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <SkeletonCard key={`roadtrip-skeleton-${index}`} />
              ))}
            </div>
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
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {roadtripRoutes.map((rt) => (
                <RoadtripCard key={rt.id} route={rt} onDelete={deleteRoadtrip} />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {(segment === "all" || segment === "tagesplanung") && !isEmpty ? (
        <section>
          <SectionHeader
            title="Offene Entwürfe"
            count={drafts.length}
            description="Noch nicht abgeschlossene Planungen, die du später fortsetzen kannst."
          />

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <SkeletonCard key={`draft-skeleton-${index}`} />
              ))}
            </div>
          ) : drafts.length === 0 ? (
            <EmptyState
              title="Keine offenen Entwürfe."
              description="Alle Pläne sind abgeschlossen."
              primaryHref="/planner"
              primaryLabel="Tag planen"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {drafts.map((plan) => (
                <DraftCard key={plan.id} plan={plan} onDelete={deletePlan} />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {(segment === "all" || segment === "events") && !isEmpty ? (
        <section>
          <SectionHeader
            title="Meine Event-Pläne"
            count={eventPlans.length}
            description="Gespeicherte Planungen für Feiern, Ausflüge und besondere Anlässe."
          />

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <SkeletonCard key={`event-skeleton-${index}`} />
              ))}
            </div>
          ) : eventPlans.length === 0 ? (
            <EmptyState
              title="Noch kein Event geplant."
              description="Plane einen besonderen Anlass für Geburtstage, Jubiläen oder Gruppenausflüge."
              primaryHref="/events"
              primaryLabel="Event planen"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {eventPlans.map((ep) => (
                <EventPlanCard key={ep.id} plan={ep} />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {toast ? (
        <div
          className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2 text-sm shadow-lg ${
            toast.kind === "error" ? "bg-red-600 text-white" : "bg-[var(--text-strong)] text-white"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
