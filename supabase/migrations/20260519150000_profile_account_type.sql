-- ── Profile Account Type ──────────────────────────────────────────────────────
--
-- Adds account_type + onboarding flags to the profiles table.
-- account_type drives which sections / CTAs a user sees in the app.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists account_type text not null default 'consumer'
    constraint profiles_account_type_check
      check (account_type in ('consumer', 'creator', 'partner')),
  add column if not exists is_admin boolean not null default false,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_type_selected boolean not null default false;

-- Existing rows: treat as already past onboarding so the modal doesn't re-fire.
-- We only want the modal for NEW sign-ups.
update public.profiles
  set onboarding_type_selected = true
  where onboarding_type_selected = false;
