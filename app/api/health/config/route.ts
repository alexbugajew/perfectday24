import { NextResponse } from "next/server";

function present(name: string) {
  return Boolean(process.env[name]);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: present("NEXT_PUBLIC_SUPABASE_URL"),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: present("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      SUPABASE_SERVICE_ROLE_KEY: present("SUPABASE_SERVICE_ROLE_KEY"),
      OPENAI_API_KEY: present("OPENAI_API_KEY"),
      SITE_LOCK_ENABLED: process.env.SITE_LOCK_ENABLED === "true" || process.env.SITE_LOCK_ENABLED === "1",
      SITE_PREVIEW_PASSWORD: present("SITE_PREVIEW_PASSWORD"),
      SITE_PREVIEW_COOKIE_SECRET: present("SITE_PREVIEW_COOKIE_SECRET"),
    },
  });
}
