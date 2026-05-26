/**
 * apply-editorial-routes.ts
 *
 * Applies the editorial routes seed for all 33 German cities via
 * Supabase Admin + REST API (no direct DB connection needed).
 *
 * Run:  npx ts-node --project tsconfig.scripts.json scripts/apply-editorial-routes.ts
 */

import { createClient } from "@supabase/supabase-js";

// ── Env ──────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const p = resolve(__dirname, "../.env.local");
  for (const line of readFileSync(p, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

const env = loadEnv();

const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"]!;
const SERVICE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"]!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── Constants ─────────────────────────────────────────────────────────────────
const EDITORIAL_USER_ID = "00000000-0000-0000-0000-000000000099";
const EDITORIAL_EMAIL = "editorial@perfectday24.de";
const EDITORIAL_USERNAME = "pd24-redaktion";

// ── Types ─────────────────────────────────────────────────────────────────────
type Stop = {
  stop_order: number;
  title: string;
  note: string;
  lat: number;
  lng: number;
  duration_min: number;
  is_required: boolean;
};

type Route = {
  city_slug: string;
  title: string;
  slug: string;
  description: string;
  start_label: string;
  start_lat: number;
  start_lng: number;
  tags: string[];
  stops: Stop[];
};

// ── Setup editorial user ───────────────────────────────────────────────────────
async function ensureEditorialUser(): Promise<string> {
  // Try to get existing user first via admin API
  const { data: existingList } = await supabase.auth.admin.listUsers();
  const existing = existingList?.users?.find((u) => u.id === EDITORIAL_USER_ID);
  if (existing) {
    console.log("Editorial user already exists:", EDITORIAL_USER_ID);
    return EDITORIAL_USER_ID;
  }

  // Create new user
  const { data, error } = await supabase.auth.admin.createUser({
    user_metadata: { username: EDITORIAL_USERNAME, display_name: "PD24 Redaktion" },
    email: EDITORIAL_EMAIL,
    password: crypto.randomUUID(),
    email_confirm: true,
  });

  if (error) throw new Error(`Create user failed: ${error.message}`);
  const userId = data.user.id;
  console.log("Created editorial user:", userId);
  return userId;
}

// ── Setup creator profile ─────────────────────────────────────────────────────
async function ensureCreatorProfile(userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("creator_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.id) {
    console.log("Creator profile already exists:", existing.id);
    return existing.id;
  }

  const { data, error } = await supabase
    .from("creator_profiles")
    .insert({
      user_id: userId,
      username: EDITORIAL_USERNAME,
      display_name: "PD24 Redaktion",
      bio: "Kuratierte Routen vom PerfectDay24-Redaktionsteam.",
      is_verified: true,
      creator_tier: "editorial",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Create creator profile failed: ${error.message}`);
  console.log("Created creator profile:", data.id);
  return data.id;
}

// ── Insert a single route with stops ─────────────────────────────────────────
async function insertRoute(
  route: Route,
  userId: string,
  creatorProfileId: string
): Promise<void> {
  // Skip if slug already exists
  const { data: exists } = await supabase
    .from("user_routes")
    .select("id")
    .eq("slug", route.slug)
    .maybeSingle();

  if (exists?.id) {
    process.stdout.write(".");
    return;
  }

  const { data: routeRow, error: routeErr } = await supabase
    .from("user_routes")
    .insert({
      user_id: userId,
      creator_profile_id: creatorProfileId,
      city_slug: route.city_slug,
      title: route.title,
      slug: route.slug,
      description: route.description,
      start_label: route.start_label,
      start_lat: route.start_lat,
      start_lng: route.start_lng,
      visibility: "public",
      creator_type: "editorial",
      tags: route.tags,
    })
    .select("id")
    .single();

  if (routeErr) {
    console.error(`\nFailed to insert route ${route.slug}: ${routeErr.message}`);
    return;
  }

  const routeId = routeRow.id;

  const stopRows = route.stops.map((s) => ({
    route_id: routeId,
    stop_order: s.stop_order,
    title: s.title,
    note: s.note,
    lat: s.lat,
    lng: s.lng,
    duration_min: s.duration_min,
    is_required: s.is_required,
  }));

  const { error: stopsErr } = await supabase.from("user_route_stops").insert(stopRows);

  if (stopsErr) {
    console.error(`\nFailed to insert stops for ${route.slug}: ${stopsErr.message}`);
    return;
  }

  process.stdout.write("+");
}

// ── Route data ─────────────────────────────────────────────────────────────────
// (Data is embedded here to avoid re-parsing the SQL migration files)
// Generated from: supabase/migrations/20260522160000_seed_editorial_routes_part1.sql
//                 supabase/migrations/20260522161000_seed_editorial_routes_part2.sql
//                 supabase/migrations/20260522162000_seed_editorial_routes_part3.sql
//                 supabase/migrations/20260522163000_seed_editorial_routes_part4.sql

import { EDITORIAL_ROUTES } from "./editorial-routes-data";

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== PD24 Editorial Routes Migration ===\n");
  console.log(`Target: ${SUPABASE_URL}\n`);

  const userId = await ensureEditorialUser();
  const creatorProfileId = await ensureCreatorProfile(userId);

  console.log(`\nInserting ${EDITORIAL_ROUTES.length} routes:`);
  console.log("  (+) = inserted, (.) = already exists\n");

  let batch = 0;
  for (const route of EDITORIAL_ROUTES) {
    await insertRoute(route, userId, creatorProfileId);
    batch++;
    if (batch % 20 === 0) {
      console.log(` [${batch}/${EDITORIAL_ROUTES.length}]`);
    }
  }

  console.log(`\n\nDone! Processed ${EDITORIAL_ROUTES.length} routes.`);

  // Final count
  const { count } = await supabase
    .from("user_routes")
    .select("*", { count: "exact", head: true })
    .eq("creator_type", "editorial");

  console.log(`Editorial routes in DB: ${count}`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
