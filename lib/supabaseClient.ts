import { createBrowserClient } from "@supabase/ssr";

// Fall back to placeholder values when env vars are absent (e.g. the -noxl
// Vercel CI project that runs a build without Supabase credentials). The
// client is usable at construction time with any non-empty strings; actual
// DB/auth calls will simply fail at runtime in that environment, which is
// expected. This avoids a module-level throw during Next.js build-time
// prerendering.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

// createBrowserClient stores the session in cookies instead of localStorage,
// so server-side routes (createServerClient) can read the session without a
// Bearer token.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
