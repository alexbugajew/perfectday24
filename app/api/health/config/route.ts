import { NextResponse } from "next/server";
import { getMonetizationAdminAccessState } from "@/lib/monetization/admin-server";

function present(name: string) {
  return Boolean(process.env[name]);
}

/**
 * Konfigurations-Health-Check.
 *
 * Die Detailauskunft ist nur für Admins sichtbar. Öffentlich verriet die Route
 * vorher, welche Secrets gesetzt sind und ob der Preview-Lock aktiv ist — damit
 * ließen sich Fehlkonfigurationen (fehlendes Postback-Secret, Lock ohne
 * Cookie-Secret) bequem von außen ausspähen.
 */
export async function GET() {
  let isAdmin = false;
  try {
    const access = await getMonetizationAdminAccessState();
    isAdmin = access.allowed;
  } catch {
    isAdmin = false;
  }

  if (!isAdmin) {
    // Für Uptime-Checks weiterhin nutzbar, aber ohne Innenansicht.
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({
    ok: true,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: present("NEXT_PUBLIC_SUPABASE_URL"),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: present("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      SUPABASE_SERVICE_ROLE_KEY: present("SUPABASE_SERVICE_ROLE_KEY"),
      OPENAI_API_KEY: present("OPENAI_API_KEY"),
      AFFILIATE_POSTBACK_SECRET: present("AFFILIATE_POSTBACK_SECRET"),
      SITE_LOCK_ENABLED:
        process.env.SITE_LOCK_ENABLED === "true" || process.env.SITE_LOCK_ENABLED === "1",
      SITE_PREVIEW_PASSWORD: present("SITE_PREVIEW_PASSWORD"),
      SITE_PREVIEW_COOKIE_SECRET: present("SITE_PREVIEW_COOKIE_SECRET"),
    },
  });
}
