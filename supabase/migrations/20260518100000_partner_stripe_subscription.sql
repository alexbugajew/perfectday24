begin;

-- Add Stripe subscription fields to partner_profiles.
-- billing_status already exists with an old constraint — drop and recreate it to include 'free'.

alter table public.partner_profiles
  add column if not exists stripe_customer_id      text unique,
  add column if not exists stripe_subscription_id  text,
  add column if not exists current_tier            text not null default 'organic',
  add column if not exists subscription_period_end timestamptz;

-- Widen billing_status to include 'free' (the default state before any Stripe subscription).
alter table public.partner_profiles
  alter column billing_status set default 'free';

alter table public.partner_profiles
  drop constraint if exists partner_profiles_billing_status_check;

alter table public.partner_profiles
  add constraint partner_profiles_billing_status_check check (
    billing_status in (
      'free',
      'inactive',
      'manual',
      'trial',
      'active',
      'past_due',
      'cancelled'
    )
  );

-- current_tier: which Stripe plan the partner is on.
alter table public.partner_profiles
  add constraint partner_profiles_current_tier_check check (
    current_tier in (
      'organic',
      'partner_basic',
      'partner_pro',
      'city_pro_plus',
      'strategic'
    )
  );

-- Fast lookup for webhook events (customer.id → partner_profile).
create index if not exists partner_profiles_stripe_customer_idx
  on public.partner_profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists partner_profiles_stripe_sub_idx
  on public.partner_profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

commit;
