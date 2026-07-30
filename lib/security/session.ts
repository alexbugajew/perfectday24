// lib/security/session.ts
// Session-Ermittlung für Route-Handler. Liest die Supabase-Session aus den
// Cookies (Standardfall) oder aus einem Bearer-Token (Clients, die den Token
// explizit mitschicken).
//
// Wichtig: Nutzer-IDs dürfen niemals aus dem Request-Body übernommen werden —
// nur diese Helper sind die vertrauenswürdige Quelle.

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

function requireSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase env vars fehlen: NEXT_PUBLIC_SUPABASE_URL oder NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  return { url, anonKey };
}

/**
 * Liest den eingeloggten Nutzer aus den Request-Cookies.
 * Gibt null zurück, wenn keine gültige Session existiert (kein Fehler — viele
 * Routen erlauben anonyme Nutzung, wollen die ID aber nicht gefälscht bekommen).
 */
export async function getSessionUserId(): Promise<string | null> {
  try {
    const { url, anonKey } = requireSupabaseEnv();
    const cookieStore = await cookies();
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Read-only während mancher Server-Renders — für Lesezugriffe ok.
          }
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Liest den Nutzer aus einem `Authorization: Bearer <token>`-Header.
 * Fällt auf die Cookie-Session zurück, wenn kein Header gesetzt ist.
 */
export async function getRequestUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) return getSessionUserId();

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return null;

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
    } = await admin.auth.getUser(token);
    return user?.id ?? null;
  } catch {
    return null;
  }
}
