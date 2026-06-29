"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type EditorialRoute = {
  id: string;
  title: string;
  slug: string | null;
  city_slug: string | null;
  cover_image_url: string | null;
  avg_rating: number | null;
  bookmark_count: number | null;
  stop_count: number | null;
};

const CITY_LABELS: Record<string, string> = {
  "berlin-berlin": "Berlin",
  "hamburg-hamburg": "Hamburg",
  muenchen: "München",
  koeln: "Köln",
  "frankfurt-am-main": "Frankfurt",
  stuttgart: "Stuttgart",
  duesseldorf: "Düsseldorf",
  leipzig: "Leipzig",
  dresden: "Dresden",
  hannover: "Hannover",
  bielefeld: "Bielefeld",
  kiel: "Kiel",
  "freiburg-im-breisgau": "Freiburg",
};

function cityLabel(slug: string | null): string {
  if (!slug) return "";
  return CITY_LABELS[slug] ?? slug.split("-")[0].charAt(0).toUpperCase() + slug.split("-")[0].slice(1);
}

export default function EditorialRoutesShowcase() {
  const [routes, setRoutes] = useState<EditorialRoute[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("user_routes")
        .select("id,title,slug,city_slug,cover_image_url,avg_rating,bookmark_count,stop_count")
        .eq("visibility", "public")
        .eq("creator_type", "editorial")
        .not("cover_image_url", "is", null)
        .order("bookmark_count", { ascending: false })
        .limit(8);
      if (!active) return;
      if (error) {
        console.error("Editorial routes load:", error.message);
        setRoutes([]);
        return;
      }
      setRoutes((data ?? []) as EditorialRoute[]);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (routes === null) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-white/60 shadow-[var(--shadow-soft)]"
          >
            <div className="h-44 w-full rounded-t-[var(--radius-card)] bg-[rgba(68,57,46,0.06)]" />
            <div className="space-y-2 p-4">
              <div className="h-3 w-1/3 rounded-full bg-[rgba(68,57,46,0.08)]" />
              <div className="h-4 w-3/4 rounded-full bg-[rgba(68,57,46,0.12)]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (routes.length === 0) {
    return null; // gracefully hide if no editorial content
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {routes.map((route) => {
        const href = route.slug ? `/routes/${route.slug}` : `/routes`;
        const city = cityLabel(route.city_slug);
        return (
          <Link
            key={route.id}
            href={href}
            className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--line-subtle)] bg-[rgba(255,253,248,0.94)] shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-large)]"
          >
            <div className="relative h-44 w-full overflow-hidden">
              {route.cover_image_url ? (
                <Image
                  src={route.cover_image_url}
                  alt={route.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  unoptimized
                />
              ) : (
                <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--brand-warm-cloud),var(--bg-canvas-warm))]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
              {city ? (
                <span className="absolute left-3 top-3 rounded-full border border-white/30 bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-strong)] backdrop-blur-sm">
                  {city}
                </span>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 p-4">
                <div className="text-base font-semibold leading-tight text-white drop-shadow sm:text-lg">
                  {route.title}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 p-4 text-xs text-[var(--text-muted-warm)]">
              <span>
                {route.stop_count ?? "?"} Stops
                {typeof route.avg_rating === "number" && route.avg_rating > 0
                  ? ` · ★ ${route.avg_rating.toFixed(1)}`
                  : ""}
              </span>
              <span className="text-[var(--brand-warm)] transition group-hover:translate-x-0.5">
                Ansehen →
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
