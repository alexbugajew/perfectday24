import type { Metadata } from "next";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 3600;

type CreatorMeta = {
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  creator_type: string | null;
  is_verified: boolean;
  route_count: number | null;
  home_city_slug: string | null;
};

function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Profil-Grunddaten. `cache()` teilt die Abfrage zwischen generateMetadata und
 * dem Layout-Rendering, sonst liefe sie pro Seitenaufruf doppelt.
 */
const loadCreator = cache(async (username: string): Promise<CreatorMeta | null> => {
  const supabase = makeClient();
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from("creator_profiles")
      .select("username, display_name, bio, avatar_url, cover_image_url, creator_type, is_verified, route_count, home_city_slug")
      .eq("username", username)
      .maybeSingle();
    return (data as CreatorMeta | null) ?? null;
  } catch {
    return null;
  }
});

export async function generateStaticParams(): Promise<{ username: string }[]> {
  const supabase = makeClient();
  if (!supabase) return [];

  try {
    const { data } = await supabase
      .from("creator_profiles")
      .select("username")
      .not("username", "is", null)
      .order("route_count", { ascending: false })
      .limit(200);

    return (data ?? [])
      .map((r: { username: string | null }) => r.username)
      .filter((u): u is string => Boolean(u))
      .map((u) => ({ username: u }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.perfectday24.de";
  const creator = await loadCreator(username);

  if (!creator) {
    return {
      title: `@${username} | PerfectDay24`,
      description: "Creator-Profil auf PerfectDay24.",
    };
  }

  const typeLabel =
    creator.creator_type === "influencer" ? "Influencer" :
    creator.creator_type === "brand" ? "Brand" :
    creator.creator_type === "editorial" ? "Editorial" :
    creator.creator_type === "creator" ? "Creator" : "Creator";

  const routeLabel = creator.route_count && creator.route_count > 0
    ? `${creator.route_count} Routen`
    : null;

  const verifiedLabel = creator.is_verified ? " · Verifiziert" : "";

  const title = `${creator.display_name} (@${username}) — ${typeLabel}${verifiedLabel} | PerfectDay24`;
  const description = creator.bio?.trim()
    ? `${creator.bio.trim().slice(0, 200)}${creator.bio.length > 200 ? "…" : ""}`
    : routeLabel
      ? `${creator.display_name} ist ${typeLabel} auf PerfectDay24 mit ${routeLabel} — entdecke kuratierte Tageserlebnisse.`
      : `${creator.display_name} ist ${typeLabel} auf PerfectDay24 — entdecke kuratierte Tagesrouten und Erlebnisse.`;

  const ogImage = creator.cover_image_url ?? creator.avatar_url ?? null;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${siteUrl}/creator/${username}`,
      type: "profile",
      locale: "de_DE",
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    alternates: {
      canonical: `${siteUrl}/creator/${username}`,
    },
  };
}

export default async function CreatorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const creator = await loadCreator(username);

  return (
    <>
      {/*
        Wie bei den Routenseiten: Die Profilseite holt ihre Daten erst im
        Browser, im ausgelieferten HTML stand deshalb keine Überschrift.
        Dieser serverseitige Kopf ist `sr-only`, weil derselbe Name sichtbar
        im Hero steht, sobald die Seite geladen ist.
      */}
      {creator ? (
        <header className="sr-only">
          <h1>{creator.display_name} (@{creator.username})</h1>
          {creator.bio ? <p>{creator.bio}</p> : null}
        </header>
      ) : null}
      {children}
    </>
  );
}
