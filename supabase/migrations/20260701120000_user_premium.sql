-- Endnutzer-Premium Trial-Run
-- Erweitert public.profiles um Premium-Status und Stripe-Referenzen.
-- Bewusst schlank gehalten: is_premium + premium_until reichen für den
-- Trial. Stripe-Refs damit Webhook direkt am User anknüpft.

begin;

alter table public.profiles
  add column if not exists is_premium boolean not null default false,
  add column if not exists premium_until timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists premium_started_at timestamptz,
  add column if not exists premium_cancelled_at timestamptz;

-- Index für Webhook-Lookups (subscription-id → user).
create index if not exists profiles_stripe_subscription_idx
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists profiles_stripe_customer_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- View der aktiven Premium-User (für Reports).
create or replace view public.premium_users_active as
select
  user_id,
  premium_started_at,
  premium_until,
  stripe_subscription_id
from public.profiles
where is_premium = true
  and (premium_until is null or premium_until > now());

commit;
