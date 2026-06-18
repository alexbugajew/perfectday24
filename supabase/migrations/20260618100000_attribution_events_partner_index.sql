begin;

-- Index für schnelle Partner-Dashboard-Queries auf attribution_events
-- Ersetzt die ungenutzten partner_impressions / partner_clicks Tabellen als Query-Ziel

create index if not exists idx_attribution_events_partner_type_occurred
  on public.attribution_events (partner_profile_id, event_type, occurred_at desc)
  where partner_profile_id is not null;

create index if not exists idx_attribution_events_affiliate_link_occurred
  on public.attribution_events (affiliate_link_id, event_type, occurred_at desc)
  where affiliate_link_id is not null;

commit;
