begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- event_categories  — Anlass-Typen (Geburtstag, Hochzeit, Teambuilding, …)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.event_categories (
  id          uuid    primary key default gen_random_uuid(),
  slug        text    not null unique,
  label       text    not null,
  description text,
  icon        text,                          -- emoji or icon identifier
  sort_order  integer not null default 0,
  meta        jsonb   not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists event_categories_set_updated_at on public.event_categories;
create trigger event_categories_set_updated_at
  before update on public.event_categories
  for each row execute function public.pd24_set_updated_at();

-- Public read — everyone can browse categories.
alter table public.event_categories enable row level security;

drop policy if exists "event_categories_select_public" on public.event_categories;
create policy "event_categories_select_public"
  on public.event_categories for select to anon, authenticated using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- event_needs  — Bedarf-Templates pro Kategorie (Location, DJ, Florist, …)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.event_needs (
  id           uuid    primary key default gen_random_uuid(),
  category_id  uuid    not null references public.event_categories (id) on delete cascade,
  slug         text    not null,
  label        text    not null,
  description  text,
  service_type text    not null default 'other',   -- location | catering | entertainment | decoration | photography | other
  is_required  boolean not null default false,
  sort_order   integer not null default 0,
  meta         jsonb   not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint event_needs_category_slug_unique unique (category_id, slug)
);

drop trigger if exists event_needs_set_updated_at on public.event_needs;
create trigger event_needs_set_updated_at
  before update on public.event_needs
  for each row execute function public.pd24_set_updated_at();

create index if not exists event_needs_category_idx
  on public.event_needs (category_id, sort_order);

alter table public.event_needs enable row level security;

drop policy if exists "event_needs_select_public" on public.event_needs;
create policy "event_needs_select_public"
  on public.event_needs for select to anon, authenticated using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- event_plans  — Der eigentliche Eventplan des Nutzers
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.event_plans (
  id              uuid    primary key default gen_random_uuid(),
  user_id         uuid    not null references auth.users (id) on delete cascade,
  title           text,
  occasion_slug   text    not null references public.event_categories (slug) on delete restrict,
  city_slug       text    references public.cities (slug) on delete set null,
  event_date      date,
  guest_count     integer,
  budget_cents    integer,                          -- max budget in euro-cents
  status          text    not null default 'draft'
    constraint event_plans_status_check check (
      status in ('draft', 'planning', 'confirmed', 'completed', 'cancelled')
    ),
  selected_needs  text[]  not null default '{}',    -- slugs from event_needs the user activated
  notes           text,
  share_token     text    unique,
  meta            jsonb   not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists event_plans_set_updated_at on public.event_plans;
create trigger event_plans_set_updated_at
  before update on public.event_plans
  for each row execute function public.pd24_set_updated_at();

create index if not exists event_plans_user_created_idx
  on public.event_plans (user_id, created_at desc);

create index if not exists event_plans_share_token_idx
  on public.event_plans (share_token)
  where share_token is not null;

alter table public.event_plans enable row level security;

drop policy if exists "event_plans_select_own" on public.event_plans;
create policy "event_plans_select_own"
  on public.event_plans for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "event_plans_insert_own" on public.event_plans;
create policy "event_plans_insert_own"
  on public.event_plans for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "event_plans_update_own" on public.event_plans;
create policy "event_plans_update_own"
  on public.event_plans for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "event_plans_delete_own" on public.event_plans;
create policy "event_plans_delete_own"
  on public.event_plans for delete to authenticated
  using (auth.uid() = user_id);

-- Share-Zugriff über Token (anonym lesbar).
create or replace function public.public_event_plan_by_token(p_token text)
returns table (
  id            uuid,
  title         text,
  occasion_slug text,
  city_slug     text,
  event_date    date,
  guest_count   integer,
  selected_needs text[],
  notes         text,
  share_token   text,
  created_at    timestamptz
)
language sql security definer set search_path = public
as $pd24$
  select
    ep.id, ep.title, ep.occasion_slug, ep.city_slug,
    ep.event_date, ep.guest_count, ep.selected_needs,
    ep.notes, ep.share_token, ep.created_at
  from public.event_plans ep
  where ep.share_token = p_token
  limit 1;
$pd24$;

revoke all on function public.public_event_plan_by_token(text) from public;
grant execute on function public.public_event_plan_by_token(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- service_providers  — Dienstleister (Location, Caterer, DJ, …)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.service_providers (
  id              uuid    primary key default gen_random_uuid(),
  slug            text    not null unique,
  name            text    not null,
  service_type    text    not null default 'other'
    constraint service_providers_service_type_check check (
      service_type in (
        'location', 'catering', 'entertainment', 'dj', 'band',
        'photography', 'video', 'decoration', 'florist', 'cake',
        'moderator', 'animation', 'tent_rental', 'transport',
        'technology', 'other'
      )
    ),
  city_slug       text    references public.cities (slug) on delete set null,
  description     text,
  website_url     text,
  contact_email   text,
  contact_phone   text,
  min_guests      integer,
  max_guests      integer,
  base_price_cents integer,                        -- indicative starting price
  price_unit      text    not null default 'total'
    constraint service_providers_price_unit_check check (
      price_unit in ('total', 'per_person', 'per_hour', 'on_request')
    ),
  is_verified     boolean not null default false,
  status          text    not null default 'draft'
    constraint service_providers_status_check check (
      status in ('draft', 'active', 'inactive', 'archived')
    ),
  meta            jsonb   not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists service_providers_set_updated_at on public.service_providers;
create trigger service_providers_set_updated_at
  before update on public.service_providers
  for each row execute function public.pd24_set_updated_at();

create index if not exists service_providers_city_type_idx
  on public.service_providers (city_slug, service_type, status);

alter table public.service_providers enable row level security;

drop policy if exists "service_providers_select_active" on public.service_providers;
create policy "service_providers_select_active"
  on public.service_providers for select to anon, authenticated
  using (status = 'active');

-- ─────────────────────────────────────────────────────────────────────────────
-- provider_packages  — Konkrete Pakete mit Festpreisen
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.provider_packages (
  id              uuid    primary key default gen_random_uuid(),
  provider_id     uuid    not null references public.service_providers (id) on delete cascade,
  name            text    not null,
  description     text,
  price_cents     integer not null,
  price_unit      text    not null default 'total'
    constraint provider_packages_price_unit_check check (
      price_unit in ('total', 'per_person', 'per_hour')
    ),
  min_guests      integer,
  max_guests      integer,
  includes        jsonb   not null default '[]'::jsonb,   -- array of strings
  status          text    not null default 'active'
    constraint provider_packages_status_check check (
      status in ('active', 'draft', 'archived')
    ),
  sort_order      integer not null default 0,
  meta            jsonb   not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists provider_packages_set_updated_at on public.provider_packages;
create trigger provider_packages_set_updated_at
  before update on public.provider_packages
  for each row execute function public.pd24_set_updated_at();

create index if not exists provider_packages_provider_idx
  on public.provider_packages (provider_id, status, sort_order);

alter table public.provider_packages enable row level security;

drop policy if exists "provider_packages_select_active" on public.provider_packages;
create policy "provider_packages_select_active"
  on public.provider_packages for select to anon, authenticated
  using (status = 'active');

-- ─────────────────────────────────────────────────────────────────────────────
-- event_bookings  — Auswahl / Anfrage eines Dienstleisters für einen Plan
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.event_bookings (
  id                  uuid    primary key default gen_random_uuid(),
  event_plan_id       uuid    not null references public.event_plans (id) on delete cascade,
  service_provider_id uuid    not null references public.service_providers (id) on delete restrict,
  provider_package_id uuid    references public.provider_packages (id) on delete set null,
  need_slug           text,                        -- which need this booking covers
  status              text    not null default 'interested'
    constraint event_bookings_status_check check (
      status in ('interested', 'requested', 'confirmed', 'cancelled')
    ),
  price_cents_agreed  integer,
  notes               text,
  meta                jsonb   not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint event_bookings_plan_provider_need_unique
    unique (event_plan_id, service_provider_id, need_slug)
);

drop trigger if exists event_bookings_set_updated_at on public.event_bookings;
create trigger event_bookings_set_updated_at
  before update on public.event_bookings
  for each row execute function public.pd24_set_updated_at();

create index if not exists event_bookings_plan_idx
  on public.event_bookings (event_plan_id, status);

alter table public.event_bookings enable row level security;

drop policy if exists "event_bookings_select_own" on public.event_bookings;
create policy "event_bookings_select_own"
  on public.event_bookings for select to authenticated
  using (
    exists (
      select 1 from public.event_plans ep
      where ep.id = event_plan_id and ep.user_id = auth.uid()
    )
  );

drop policy if exists "event_bookings_insert_own" on public.event_bookings;
create policy "event_bookings_insert_own"
  on public.event_bookings for insert to authenticated
  with check (
    exists (
      select 1 from public.event_plans ep
      where ep.id = event_plan_id and ep.user_id = auth.uid()
    )
  );

drop policy if exists "event_bookings_update_own" on public.event_bookings;
create policy "event_bookings_update_own"
  on public.event_bookings for update to authenticated
  using (
    exists (
      select 1 from public.event_plans ep
      where ep.id = event_plan_id and ep.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- event_agenda_shares  — geteilte Tagesagenda für Gäste (Token-Link)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.event_agenda_shares (
  id              uuid    primary key default gen_random_uuid(),
  event_plan_id   uuid    not null references public.event_plans (id) on delete cascade,
  share_token     text    not null unique default encode(gen_random_bytes(18), 'base64url'),
  recipient_label text,                            -- "Alle Gäste", "Team Rot", …
  expires_at      timestamptz,
  view_count      integer not null default 0,
  meta            jsonb   not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists event_agenda_shares_set_updated_at on public.event_agenda_shares;
create trigger event_agenda_shares_set_updated_at
  before update on public.event_agenda_shares
  for each row execute function public.pd24_set_updated_at();

create index if not exists event_agenda_shares_plan_idx
  on public.event_agenda_shares (event_plan_id);

create index if not exists event_agenda_shares_token_idx
  on public.event_agenda_shares (share_token);

alter table public.event_agenda_shares enable row level security;

drop policy if exists "event_agenda_shares_select_own" on public.event_agenda_shares;
create policy "event_agenda_shares_select_own"
  on public.event_agenda_shares for select to authenticated
  using (
    exists (
      select 1 from public.event_plans ep
      where ep.id = event_plan_id and ep.user_id = auth.uid()
    )
  );

drop policy if exists "event_agenda_shares_insert_own" on public.event_agenda_shares;
create policy "event_agenda_shares_insert_own"
  on public.event_agenda_shares for insert to authenticated
  with check (
    exists (
      select 1 from public.event_plans ep
      where ep.id = event_plan_id and ep.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: event_categories + event_needs
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.event_categories (slug, label, description, icon, sort_order) values
  ('geburtstag',       'Geburtstag',        'Geburtstagsfeiern aller Größenordnungen',            '🎂', 10),
  ('hochzeit',         'Hochzeit',          'Trauung, Feier und Flitterwochen-Planung',            '💍', 20),
  ('teambuilding',     'Teambuilding',      'Aktivitäten und Ausflüge für Firmenteams',            '🤝', 30),
  ('firmenfeier',      'Firmenfeier',       'Weihnachts-, Sommer- oder Jubiläumsfeiern',          '🏢', 40),
  ('kindergeburtstag', 'Kindergeburtstag',  'Feiern für die Kleinsten mit Animation & Spaß',      '🎈', 50),
  ('konferenz',        'Konferenz / Summit','Fachveranstaltungen, Keynotes und Workshops',         '🎤', 60),
  ('jubilaeum',        'Jubiläum',          'Runde Geburtstage, Firmenjubiläen und Meilensteine', '🥂', 70),
  ('staedtereise',     'Städtereise',       'Mehrtägige Gruppenreisen mit kuratiertem Programm',  '✈️', 80)
on conflict (slug) do nothing;

-- Geburtstag
insert into public.event_needs (category_id, slug, label, service_type, is_required, sort_order) values
  ((select id from public.event_categories where slug = 'geburtstag'), 'location',     'Location',          'location',       true,  10),
  ((select id from public.event_categories where slug = 'geburtstag'), 'catering',     'Catering',          'catering',       true,  20),
  ((select id from public.event_categories where slug = 'geburtstag'), 'torte',        'Geburtstagstorte',  'cake',           false, 30),
  ((select id from public.event_categories where slug = 'geburtstag'), 'musik',        'Musik / DJ',        'dj',             false, 40),
  ((select id from public.event_categories where slug = 'geburtstag'), 'deko',         'Dekoration',        'decoration',     false, 50),
  ((select id from public.event_categories where slug = 'geburtstag'), 'fotografie',   'Fotografie',        'photography',    false, 60),
  ((select id from public.event_categories where slug = 'geburtstag'), 'moderation',   'Moderator',         'moderator',      false, 70)
on conflict (category_id, slug) do nothing;

-- Hochzeit
insert into public.event_needs (category_id, slug, label, service_type, is_required, sort_order) values
  ((select id from public.event_categories where slug = 'hochzeit'), 'location',     'Hochzeitslocation', 'location',       true,  10),
  ((select id from public.event_categories where slug = 'hochzeit'), 'catering',     'Catering / Menü',   'catering',       true,  20),
  ((select id from public.event_categories where slug = 'hochzeit'), 'florist',      'Florist',           'florist',        false, 30),
  ((select id from public.event_categories where slug = 'hochzeit'), 'fotografie',   'Fotografie',        'photography',    true,  40),
  ((select id from public.event_categories where slug = 'hochzeit'), 'video',        'Videograf',         'video',          false, 50),
  ((select id from public.event_categories where slug = 'hochzeit'), 'musik',        'Band / DJ',         'band',           false, 60),
  ((select id from public.event_categories where slug = 'hochzeit'), 'torte',        'Hochzeitstorte',    'cake',           false, 70),
  ((select id from public.event_categories where slug = 'hochzeit'), 'deko',         'Dekoration',        'decoration',     false, 80),
  ((select id from public.event_categories where slug = 'hochzeit'), 'moderation',   'Freie Rednerin/r',  'moderator',      false, 90)
on conflict (category_id, slug) do nothing;

-- Teambuilding
insert into public.event_needs (category_id, slug, label, service_type, is_required, sort_order) values
  ((select id from public.event_categories where slug = 'teambuilding'), 'location',    'Veranstaltungsort', 'location',      true,  10),
  ((select id from public.event_categories where slug = 'teambuilding'), 'catering',    'Catering',          'catering',      false, 20),
  ((select id from public.event_categories where slug = 'teambuilding'), 'moderation',  'Moderator',         'moderator',     false, 30),
  ((select id from public.event_categories where slug = 'teambuilding'), 'animation',   'Teamaktivität',     'animation',     true,  40),
  ((select id from public.event_categories where slug = 'teambuilding'), 'transport',   'Transport',         'transport',     false, 50),
  ((select id from public.event_categories where slug = 'teambuilding'), 'technik',     'Technik / AV',      'technology',    false, 60)
on conflict (category_id, slug) do nothing;

-- Firmenfeier
insert into public.event_needs (category_id, slug, label, service_type, is_required, sort_order) values
  ((select id from public.event_categories where slug = 'firmenfeier'), 'location',   'Location',          'location',       true,  10),
  ((select id from public.event_categories where slug = 'firmenfeier'), 'catering',   'Catering / Buffet', 'catering',       true,  20),
  ((select id from public.event_categories where slug = 'firmenfeier'), 'musik',      'Musik / DJ',        'dj',             false, 30),
  ((select id from public.event_categories where slug = 'firmenfeier'), 'deko',       'Dekoration',        'decoration',     false, 40),
  ((select id from public.event_categories where slug = 'firmenfeier'), 'moderation', 'Moderator',         'moderator',      false, 50),
  ((select id from public.event_categories where slug = 'firmenfeier'), 'technik',    'Technik / AV',      'technology',     false, 60),
  ((select id from public.event_categories where slug = 'firmenfeier'), 'fotografie', 'Fotografie',        'photography',    false, 70)
on conflict (category_id, slug) do nothing;

-- Kindergeburtstag
insert into public.event_needs (category_id, slug, label, service_type, is_required, sort_order) values
  ((select id from public.event_categories where slug = 'kindergeburtstag'), 'location',   'Location',          'location',   true,  10),
  ((select id from public.event_categories where slug = 'kindergeburtstag'), 'catering',   'Fingerfood / Büfett','catering',  false, 20),
  ((select id from public.event_categories where slug = 'kindergeburtstag'), 'animation',  'Animateur',         'animation',  true,  30),
  ((select id from public.event_categories where slug = 'kindergeburtstag'), 'torte',      'Geburtstagstorte',  'cake',       false, 40),
  ((select id from public.event_categories where slug = 'kindergeburtstag'), 'deko',       'Dekoration',        'decoration', false, 50)
on conflict (category_id, slug) do nothing;

-- Konferenz
insert into public.event_needs (category_id, slug, label, service_type, is_required, sort_order) values
  ((select id from public.event_categories where slug = 'konferenz'), 'location',   'Konferenzräume',    'location',       true,  10),
  ((select id from public.event_categories where slug = 'konferenz'), 'technik',    'Technik / AV',      'technology',     true,  20),
  ((select id from public.event_categories where slug = 'konferenz'), 'catering',   'Catering / Coffee', 'catering',       false, 30),
  ((select id from public.event_categories where slug = 'konferenz'), 'moderation', 'Moderator',         'moderator',      false, 40),
  ((select id from public.event_categories where slug = 'konferenz'), 'fotografie', 'Eventfotografie',   'photography',    false, 50)
on conflict (category_id, slug) do nothing;

-- Jubiläum
insert into public.event_needs (category_id, slug, label, service_type, is_required, sort_order) values
  ((select id from public.event_categories where slug = 'jubilaeum'), 'location',   'Location',          'location',       true,  10),
  ((select id from public.event_categories where slug = 'jubilaeum'), 'catering',   'Catering',          'catering',       true,  20),
  ((select id from public.event_categories where slug = 'jubilaeum'), 'deko',       'Dekoration',        'decoration',     false, 30),
  ((select id from public.event_categories where slug = 'jubilaeum'), 'fotografie', 'Fotografie',        'photography',    false, 40),
  ((select id from public.event_categories where slug = 'jubilaeum'), 'musik',      'Musik',             'entertainment',  false, 50),
  ((select id from public.event_categories where slug = 'jubilaeum'), 'moderation', 'Laudator / Redner', 'moderator',      false, 60)
on conflict (category_id, slug) do nothing;

-- Städtereise
insert into public.event_needs (category_id, slug, label, service_type, is_required, sort_order) values
  ((select id from public.event_categories where slug = 'staedtereise'), 'location',   'Hotel / Unterkunft','location',      true,  10),
  ((select id from public.event_categories where slug = 'staedtereise'), 'transport',  'Transfer',          'transport',     false, 20),
  ((select id from public.event_categories where slug = 'staedtereise'), 'catering',   'Restaurantauswahl', 'catering',      false, 30),
  ((select id from public.event_categories where slug = 'staedtereise'), 'animation',  'Stadtführung',      'animation',     false, 40),
  ((select id from public.event_categories where slug = 'staedtereise'), 'fotografie', 'Fotografie',        'photography',   false, 50)
on conflict (category_id, slug) do nothing;

commit;
