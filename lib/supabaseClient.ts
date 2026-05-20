import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL fehlt");
if (!supabaseAnonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY fehlt");

// createBrowserClient stores the session in cookies instead of localStorage,
// so server-side routes (createServerClient) can read the session without a Bearer token.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);