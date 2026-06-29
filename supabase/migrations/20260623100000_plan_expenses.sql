-- plan_expenses: Pro Plan + Stop können Gruppenmitglieder Kosten eintragen
-- und das System berechnet Summen + Splits.
--
-- Minimal-Schema. Erweiterungen für später:
-- - currency
-- - paid_by (welcher Teilnehmer hat ausgelegt)
-- - splits per teilnehmer (statt equal_split flag)
-- - receipt_url für Belege

begin;

create table if not exists public.plan_expenses (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.event_plans(id) on delete cascade,
  stop_index integer,
  label text not null,
  amount_cents integer not null check (amount_cents >= 0),
  paid_by_label text,
  equal_split boolean not null default true,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_plan_expenses_plan_id
  on public.plan_expenses (plan_id);

create index if not exists idx_plan_expenses_plan_stop
  on public.plan_expenses (plan_id, stop_index);

alter table public.plan_expenses enable row level security;

-- Owner des Plans + alle die im Group-Chat sind dürfen lesen.
create policy "plan_expenses_select" on public.plan_expenses
  for select using (
    exists (
      select 1 from public.event_plans p
      where p.id = plan_id
        and (p.user_id = auth.uid())
    )
  );

-- Owner + Gruppenteilnehmer dürfen einfügen (vereinfacht — nur Owner für jetzt)
create policy "plan_expenses_insert" on public.plan_expenses
  for insert with check (
    exists (
      select 1 from public.event_plans p
      where p.id = plan_id
        and p.user_id = auth.uid()
    )
  );

create policy "plan_expenses_update" on public.plan_expenses
  for update using (
    exists (
      select 1 from public.event_plans p
      where p.id = plan_id
        and p.user_id = auth.uid()
    )
  );

create policy "plan_expenses_delete" on public.plan_expenses
  for delete using (
    exists (
      select 1 from public.event_plans p
      where p.id = plan_id
        and p.user_id = auth.uid()
    )
  );

commit;
