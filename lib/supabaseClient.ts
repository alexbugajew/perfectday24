import { createBrowserClient } from "@supabase/ssr";

// The client is created lazily on first property access so that Next.js
// build-time prerendering in envs without Supabase vars never throws at
// module evaluation (same pattern used for the OpenAI client in API routes).
let _client: ReturnType<typeof createBrowserClient> | undefined;

function getClient() {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL fehlt");
    if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY fehlt");
    // createBrowserClient stores the session in cookies instead of
    // localStorage, so server-side routes (createServerClient) can read
    // the session without a Bearer token.
    _client = createBrowserClient(url, key);
  }
  return _client;
}

export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_t, p, _r) {
    const c = getClient();
    const v = Reflect.get(c, p, c);
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(c) : v;
  },
});
