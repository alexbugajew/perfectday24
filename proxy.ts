import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  PREVIEW_LOCK_COOKIE,
  PREVIEW_LOCK_LOGIN_PATH,
  isPreviewLockEnabled,
  verifyPreviewAccessToken,
} from "@/lib/preview-lock";
import {
  checkRateLimit,
  clientKeyFromRequest,
  RATE_RULES,
} from "@/lib/security/rate-limit";

const PUBLIC_PATH_PREFIXES = [
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/preview-login",
  "/api/preview-login",
];

/**
 * Statische Assets, die auch bei aktivem Preview-Lock ausgeliefert werden.
 *
 * Vorher galt jeder Pfad mit einem Punkt im letzten Segment als öffentlich
 * (`/\.[a-zA-Z0-9]+$/`). Damit umging z. B. `/routes/x.html` oder
 * `/explore/berlin.json` den Lock komplett. Jetzt zählt nur eine explizite
 * Endungs-Allowlist — und nur für Pfade, die nach Asset aussehen.
 */
const PUBLIC_ASSET_EXTENSIONS = new Set([
  "css", "js", "mjs", "map",
  "png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "ico", "bmp",
  "woff", "woff2", "ttf", "otf", "eot",
  "mp4", "webm", "ogg", "mp3", "wav",
  "pdf", "txt", "xml", "webmanifest",
]);

function hasPublicAssetExtension(pathname: string) {
  const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  const dotIndex = lastSegment.lastIndexOf(".");
  if (dotIndex <= 0) return false;
  const extension = lastSegment.slice(dotIndex + 1).toLowerCase();
  return PUBLIC_ASSET_EXTENSIONS.has(extension);
}

function isPublicPath(pathname: string) {
  if (PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }

  return hasPublicAssetExtension(pathname);
}

async function refreshSupabaseSession(
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  await supabase.auth.getUser();
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Grundschutz für alle API-Routen. Einzelne Endpunkte setzen zusätzlich
  // engere Limits (siehe RATE_RULES). Bewusst vor dem Preview-Lock, damit
  // auch Login-Versuche erfasst werden.
  if (pathname.startsWith("/api/")) {
    const scope = pathname.startsWith("/api/preview-login") ? "preview-login" : "api";
    const rule = scope === "preview-login" ? RATE_RULES.login : RATE_RULES.apiDefault;
    const result = checkRateLimit(`${scope}:${clientKeyFromRequest(request)}`, rule);
    if (!result.allowed) {
      return NextResponse.json(
        { error: "rate_limited", retryAfter: result.retryAfterSeconds },
        {
          status: 429,
          headers: {
            "Retry-After": String(result.retryAfterSeconds),
            "X-RateLimit-Limit": String(result.limit),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }
  }

  if (!isPreviewLockEnabled() || isPublicPath(pathname)) {
    const response = NextResponse.next();
    return refreshSupabaseSession(request, response);
  }

  const token = request.cookies.get(PREVIEW_LOCK_COOKIE)?.value;
  const hasAccess = await verifyPreviewAccessToken(token);

  if (hasAccess) {
    const response = NextResponse.next();
    return refreshSupabaseSession(request, response);
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Preview access required" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = PREVIEW_LOCK_LOGIN_PATH;
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
