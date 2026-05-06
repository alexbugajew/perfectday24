import { NextRequest, NextResponse } from "next/server";
import {
  PREVIEW_LOCK_COOKIE,
  PREVIEW_LOCK_COOKIE_MAX_AGE_SECONDS,
  createPreviewAccessToken,
  isPreviewPassword,
} from "@/lib/preview-lock";

function getSafeNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const nextPath = getSafeNextPath(formData.get("next"));
  const redirectUrl = new URL(nextPath, request.url);

  if (!isPreviewPassword(formData.get("password"))) {
    redirectUrl.pathname = "/preview-login";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("error", "1");
    redirectUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  const response = NextResponse.redirect(redirectUrl, { status: 303 });
  response.cookies.set(PREVIEW_LOCK_COOKIE, await createPreviewAccessToken(), {
    httpOnly: true,
    maxAge: PREVIEW_LOCK_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
