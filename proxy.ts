import { NextRequest, NextResponse } from "next/server";
import {
  PREVIEW_LOCK_COOKIE,
  PREVIEW_LOCK_LOGIN_PATH,
  isPreviewLockEnabled,
  verifyPreviewAccessToken,
} from "@/lib/preview-lock";

const PUBLIC_PATH_PREFIXES = [
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/preview-login",
  "/api/preview-login",
];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }

  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

export async function proxy(request: NextRequest) {
  if (!isPreviewLockEnabled() || isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(PREVIEW_LOCK_COOKIE)?.value;
  const hasAccess = await verifyPreviewAccessToken(token);

  if (hasAccess) {
    return NextResponse.next();
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
