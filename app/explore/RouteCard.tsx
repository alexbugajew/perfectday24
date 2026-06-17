"use client";

import Link from "next/link";

export type ExploreRouteCard = {
  id: string;
  slug: string | null;
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
  if (!route) return null;

  const href = route.slug ? `/routes/${route.slug}` : "#";
  const disabled = !route.slug;

  return (
    <Link
      href={href}
      className={`group block overflow-hidden rounded-2xl border bg-white transition ${
        disabled ? "pointer-events-none opacity-60" : "hover:shadow-lg"
      }`}
    >
      <div className="aspect-[16/10] w-full bg-gray-100 overflow-hidden">
        {route.cover_image_url ? (
          <img
            src={route.cover_image_url}
            alt={route.title}
            className="h-full w-full object-cover group-hover:scale-[1.02] transition"
          />
        ) : (
          <div className="flex h-full w-full items-end bg-[linear-gradient(135deg,#edf2f6_0%,#dbe7ef_48%,#eef3f7_100%)] p-4">
            <span className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[11px] font-medium text-gray-700 backdrop-blur">
              Route entdecken
            </span>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] px-2 py-1 rounded-full border bg-gray-50 text-gray-700">
            {creatorLabel(route.creator_type)}
          </span>

          {route.city_slug ? (
            <span className="text-xs text-gray-500 truncate max-w-[140px]">
              {route.city_slug}
            </span>
          ) : null}
        </div>

        <div>
          <h3 className="font-semibold text-lg leading-snug group-hover:text-black">
            {route.title}
          </h3>

          {route.description ? (
            <p className="mt-1 text-sm text-gray-600 line-clamp-2">
              {route.description}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-700">
            📍 {route.stops_count} Stops
          </span>

          {route.start_label ? (
            <span className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-700">
              🚩 {route.start_label}
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between text-sm text-gray-600 pt-1">
          <div className="flex items-center gap-3">
            <span>❤️ {route.likes}</span>
            <span>🔖 {route.saves}</span>
          </div>

          <span className="text-black font-medium">
            {disabled ? "Slug fehlt" : "Ansehen →"}
          </span>
        </div>
      </div>
    </Link>
  );
}
