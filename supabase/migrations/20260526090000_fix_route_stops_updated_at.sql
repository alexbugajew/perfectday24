-- ============================================================
-- Fix: user_route_stops table is missing updated_at column
-- which the set_updated_at trigger references.
-- ============================================================

alter table public.user_route_stops
  add column if not exists updated_at timestamptz not null default now();
