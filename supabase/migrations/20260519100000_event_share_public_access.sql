-- Allow anonymous users to read event_bookings for plans that have a share_token set.
-- The plan itself is already accessible via the public_event_plan_by_token() RPC (security definer).
-- This policy lets the agenda share page load booking details without auth.

drop policy if exists "event_bookings_select_by_share_token" on public.event_bookings;
create policy "event_bookings_select_by_share_token"
  on public.event_bookings for select to anon, authenticated
  using (
    exists (
      select 1 from public.event_plans ep
      where ep.id = event_bookings.event_plan_id
        and ep.share_token is not null
    )
  );
