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

export type ExploreRouteCard = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  city_slug: string | null;
  cover_image_url: string | null;
  creator_type: string | null;
  start_label: string | null;
  likes: number;
  saves: number;
  stops_count: number;
};

function creatorLabel(v: string | null) {
  if (v === "influencer") return "Influencer";
  if (v === "creator") return "Creator";
  if (v === "brand") return "Brand";
  return "User";
}

export default function RouteCard({ route }: { route: ExploreRouteCard }) {
  return (
    <Link
      href={`/routes/${route.slug}`}
      className="group block overflow-hidden rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-large)]"
    >
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-[var(--bg-panel)]">
        {route.cover_image_url ? (
          <Image
            src={route.cover_image_url}
            alt={route.title}
            fill
            unoptimized={!isSafeImageHost(route.cover_image_url)}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-end bg-[linear-gradient(135deg,#edf2f6_0%,#dbe7ef_48%,#eef3f7_100%)] p-4">
            <span className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[11px] font-medium text-[var(--text-muted)] backdrop-blur">
              Route entdecken
            </span>
          </div>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
            {creatorLabel(route.creator_type)}
          </span>
          {route.city_slug ? (
            <span className="max-w-[140px] truncate text-xs text-[var(--text-soft)]">
              {route.city_slug}
            </span>
          ) : null}
        </div>

        <div>
          <h3 className="text-lg font-semibold leading-snug text-[var(--text-strong)] group-hover:opacity-80">
            {route.title}
          </h3>
          {route.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">
              {route.description}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
            {route.stops_count} Stops
          </span>
          {route.start_label ? (
            <span className="rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
              ab {route.start_label}
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--line-subtle)] pt-2.5 text-sm">
          <div className="flex items-center gap-3 text-[var(--text-soft)] text-xs">
            <span>{route.likes} Likes</span>
            <span>{route.saves} Saves</span>
          </div>
          <span className="font-medium text-[var(--text-strong)]">Ansehen →</span>
        </div>
      </div>
    </Link>
  );
}
