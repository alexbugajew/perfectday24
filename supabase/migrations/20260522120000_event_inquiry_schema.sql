begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- event_inquiries  — Preisanfragen des Kunden an einen oder mehrere Anbieter
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.event_inquiries (
  id               uuid        primary key default gen_random_uuid(),
  event_plan_id    uuid        not null references public.event_plans (id) on delete cascade,
  customer_id      uuid        references auth.users (id) on delete set null,
  status           text        not null default 'sent'
    constraint event_inquiries_status_check check (
      status in ('draft', 'sent', 'responded', 'booked', 'cancelled')
    ),
  occasion_slug    text,
  city_slug        text,
  event_date       date,
  guest_count      integer,
  budget_cents     integer,
  customer_message text,
  sent_at          timestamptz default now(),
  meta             jsonb       not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists event_inquiries_set_updated_at on public.event_inquiries;
create trigger event_inquiries_set_updated_at
  before update on public.event_inquiries
  for each row execute function public.pd24_set_updated_at();

create index if not exists event_inquiries_plan_idx
  on public.event_inquiries (event_plan_id, status);

create index if not exists event_inquiries_customer_idx
  on public.event_inquiries (customer_id, created_at desc);

alter table public.event_inquiries enable row level security;

drop policy if exists "event_inquiries_select_own" on public.event_inquiries;
create policy "event_inquiries_select_own"
  on public.event_inquiries for select to authenticated
  using (customer_id = auth.uid());

drop policy if exists "event_inquiries_insert_own" on public.event_inquiries;
create policy "event_inquiries_insert_own"
  on public.event_inquiries for insert to authenticated
  with check (customer_id = auth.uid());

drop policy if exists "event_inquiries_update_own" on public.event_inquiries;
create policy "event_inquiries_update_own"
  on public.event_inquiries for update to authenticated
  using (customer_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- vendor_quotes  — Angebotsanfrage an einen einzelnen Anbieter (Magic Link)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.vendor_quotes (
  id                     uuid        primary key default gen_random_uuid(),
  inquiry_id             uuid        not null references public.event_inquiries (id) on delete cascade,
  provider_id            uuid        not null references public.service_providers (id) on delete restrict,
  need_slug              text,
  token                  text        not null unique
                                     default encode(gen_random_bytes(18), 'base64url'),
  status                 text        not null default 'pending'
    constraint vendor_quotes_status_check check (
      status in ('pending', 'viewed', 'quoted', 'accepted', 'rejected', 'expired')
    ),
  price_cents            integer,
  price_unit             text        not null default 'total'
    constraint vendor_quotes_price_unit_check check (
      price_unit in ('total', 'per_person', 'per_hour', 'on_request')
    ),
  availability_confirmed boolean,
  vendor_message         text,
  expires_at             timestamptz not null default (now() + interval '30 days'),
  viewed_at              timestamptz,
  responded_at           timestamptz,
  accepted_at            timestamptz,
  meta                   jsonb       not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

drop trigger if exists vendor_quotes_set_updated_at on public.vendor_quotes;
create trigger vendor_quotes_set_updated_at
  before update on public.vendor_quotes
  for each row execute function public.pd24_set_updated_at();

create index if not exists vendor_quotes_inquiry_idx
  on public.vendor_quotes (inquiry_id, status);

create index if not exists vendor_quotes_token_idx
  on public.vendor_quotes (token);

create index if not exists vendor_quotes_provider_idx
  on public.vendor_quotes (provider_id, created_at desc);

alter table public.vendor_quotes enable row level security;

-- Anbieter lesen über Token-Funktion (anonym), Kunden über inquiry_id
drop policy if exists "vendor_quotes_select_customer" on public.vendor_quotes;
create policy "vendor_quotes_select_customer"
  on public.vendor_quotes for select to authenticated
  using (
    exists (
      select 1 from public.event_inquiries ei
      where ei.id = inquiry_id and ei.customer_id = auth.uid()
    )
  );

-- Token-basierter Zugriff für Anbieter (service_role via API Route, kein direktes RLS-Lesen)
-- Die vendor-quote Seite nutzt eine security definer Funktion.

create or replace function public.get_vendor_quote_by_token(p_token text)
returns table (
  id                     uuid,
  inquiry_id             uuid,
  provider_id            uuid,
  need_slug              text,
  token                  text,
  status                 text,
  price_cents            integer,
  price_unit             text,
  availability_confirmed boolean,
  vendor_message         text,
  expires_at             timestamptz,
  -- joined inquiry fields
  occasion_slug          text,
  city_slug              text,
  event_date             date,
  guest_count            integer,
  budget_cents           integer,
  customer_message       text,
  -- joined provider fields
  provider_name          text,
  provider_service_type  text
)
language sql security definer set search_path = public
as $pd24$
  select
    vq.id, vq.inquiry_id, vq.provider_id, vq.need_slug, vq.token,
    vq.status, vq.price_cents, vq.price_unit, vq.availability_confirmed,
    vq.vendor_message, vq.expires_at,
    ei.occasion_slug, ei.city_slug, ei.event_date, ei.guest_count,
    ei.budget_cents, ei.customer_message,
    sp.name, sp.service_type
  from public.vendor_quotes vq
  join public.event_inquiries ei on ei.id = vq.inquiry_id
  join public.service_providers sp on sp.id = vq.provider_id
  where vq.token = p_token
    and vq.expires_at > now()
  limit 1;
$pd24$;

revoke all on function public.get_vendor_quote_by_token(text) from public;
grant execute on function public.get_vendor_quote_by_token(text) to anon, authenticated;

create or replace function public.submit_vendor_quote(
  p_token         text,
  p_price_cents   integer,
  p_price_unit    text,
  p_availability  boolean,
  p_message       text
)
returns text
language plpgsql security definer set search_path = public
as $pd24$
declare
  v_id uuid;
begin
  update public.vendor_quotes
  set
    price_cents            = p_price_cents,
    price_unit             = p_price_unit,
    availability_confirmed = p_availability,
    vendor_message         = p_message,
    status                 = 'quoted',
    responded_at           = now()
  where token = p_token
    and expires_at > now()
    and status in ('pending', 'viewed')
  returning id into v_id;

  if v_id is null then
    return 'error:not_found_or_expired';
  end if;

  -- Update inquiry status to 'responded' if all quotes are in
  update public.event_inquiries ei
  set status = 'responded'
  where ei.id = (select inquiry_id from public.vendor_quotes where id = v_id)
    and not exists (
      select 1 from public.vendor_quotes vq2
      where vq2.inquiry_id = ei.id and vq2.status = 'pending'
    );

  return 'ok';
end;
$pd24$;

revoke all on function public.submit_vendor_quote(text, integer, text, boolean, text) from public;
grant execute on function public.submit_vendor_quote(text, integer, text, boolean, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- inquiry_messages  — Kommunikations-Thread Kunde ↔ Anbieter
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.inquiry_messages (
  id           uuid        primary key default gen_random_uuid(),
  inquiry_id   uuid        not null references public.event_inquiries (id) on delete cascade,
  quote_id     uuid        references public.vendor_quotes (id) on delete set null,
  sender_type  text        not null default 'system'
    constraint inquiry_messages_sender_type_check check (
      sender_type in ('customer', 'vendor', 'system')
    ),
  body         text        not null,
  sent_at      timestamptz not null default now()
);

create index if not exists inquiry_messages_inquiry_idx
  on public.inquiry_messages (inquiry_id, sent_at desc);

alter table public.inquiry_messages enable row level security;

drop policy if exists "inquiry_messages_select_customer" on public.inquiry_messages;
create policy "inquiry_messages_select_customer"
  on public.inquiry_messages for select to authenticated
  using (
    exists (
      select 1 from public.event_inquiries ei
      where ei.id = inquiry_id and ei.customer_id = auth.uid()
    )
  );

commit;
