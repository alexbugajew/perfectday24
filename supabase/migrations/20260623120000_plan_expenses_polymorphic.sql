-- Expenses generisch machen: jetzt auch für Roadtrips und User-Routen,
-- nicht nur Event-Pläne. Polymorpher Foreign-Key via target_type + target_id.
--
-- Vorher: plan_expenses.plan_id FK → event_plans
-- Nachher: plan_expenses.target_type ∈ ('event_plan','roadtrip','route')
--          plan_expenses.target_id (uuid, kein FK — App-level Integrity)
--
-- RLS-Policies prüfen das Owner-Recht je Target-Type:
--   event_plan → event_plans.user_id
--   roadtrip   → roadtrip_routes.author_user_id
--   route      → user_routes.user_id

begin;

-- 1) Neue Spalten hinzufügen (mit Defaults für Backfill)
alter table public.plan_expenses
  add column if not exists target_type text not null default 'event_plan',
  add column if not exists target_id uuid;

-- 2) Backfill: bestehende plan_id → target_id
update public.plan_expenses
  set target_id = plan_id
  where target_id is null and plan_id is not null;

-- 3) plan_id darf jetzt null sein (für künftige roadtrip/route Einträge)
alter table public.plan_expenses
  alter column plan_id drop not null;

-- 4) target_id ist Pflicht
alter table public.plan_expenses
  alter column target_id set not null;

-- 5) Type-Check
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'plan_expenses_target_type_check'
  ) then
    alter table public.plan_expenses
      add constraint plan_expenses_target_type_check
      check (target_type in ('event_plan','roadtrip','route'));
  end if;
end $$;

-- 6) Index für polymorphe Lookups
create index if not exists idx_plan_expenses_target
  on public.plan_expenses (target_type, target_id);

-- 7) Alten FK auf event_plans entfernen (polymorpher FK ist nicht möglich,
--    Integrity wird App-seitig über die RLS-Policies + Inserts gesichert)
alter table public.plan_expenses
  drop constraint if exists plan_expenses_plan_id_fkey;

-- 8) RLS-Policies neu definieren — für alle 3 Target-Types
drop policy if exists plan_expenses_select on public.plan_expenses;
drop policy if exists plan_expenses_insert on public.plan_expenses;
drop policy if exists plan_expenses_update on public.plan_expenses;
drop policy if exists plan_expenses_delete on public.plan_expenses;

create policy plan_expenses_select on public.plan_expenses
  for select using (
    (target_type = 'event_plan' and exists (
      select 1 from public.event_plans p where p.id = target_id and p.user_id = auth.uid()
    )) or
    (target_type = 'roadtrip' and exists (
      select 1 from public.roadtrip_routes r where r.id = target_id and r.author_user_id = auth.uid()
    )) or
    (target_type = 'route' and exists (
      select 1 from public.user_routes r where r.id = target_id and r.user_id = auth.uid()
    ))
  );

create policy plan_expenses_insert on public.plan_expenses
  for insert with check (
    (target_type = 'event_plan' and exists (
      select 1 from public.event_plans p where p.id = target_id and p.user_id = auth.uid()
    )) or
    (target_type = 'roadtrip' and exists (
      select 1 from public.roadtrip_routes r where r.id = target_id and r.author_user_id = auth.uid()
    )) or
    (target_type = 'route' and exists (
      select 1 from public.user_routes r where r.id = target_id and r.user_id = auth.uid()
    ))
  );

create policy plan_expenses_update on public.plan_expenses
  for update using (
    (target_type = 'event_plan' and exists (
      select 1 from public.event_plans p where p.id = target_id and p.user_id = auth.uid()
    )) or
    (target_type = 'roadtrip' and exists (
      select 1 from public.roadtrip_routes r where r.id = target_id and r.author_user_id = auth.uid()
    )) or
    (target_type = 'route' and exists (
      select 1 from public.user_routes r where r.id = target_id and r.user_id = auth.uid()
    ))
  );

create policy plan_expenses_delete on public.plan_expenses
  for delete using (
    (target_type = 'event_plan' and exists (
      select 1 from public.event_plans p where p.id = target_id and p.user_id = auth.uid()
    )) or
    (target_type = 'roadtrip' and exists (
      select 1 from public.roadtrip_routes r where r.id = target_id and r.author_user_id = auth.uid()
    )) or
    (target_type = 'route' and exists (
      select 1 from public.user_routes r where r.id = target_id and r.user_id = auth.uid()
    ))
  );

commit;
