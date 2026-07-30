-- AI-Plan-Funnel-Events im Check-Constraint nachziehen
-- ============================================================================
-- Der Client sendet seit dem Telemetrie-Ausbau die Event-Typen
-- ai_plan_open / ai_plan_generated / ai_plan_applied / ai_plan_exited
-- (lib/monetization/types.ts, ATTRIBUTION_EVENT_TYPES). Das Constraint aus
-- 20260416103000_monetization_foundation.sql kennt nur die 13 alten Typen —
-- jede AI-Planner-Nutzung schlug beim Insert mit 23514 fehl und der
-- AI-Funnel war im Reporting unsichtbar (Vercel Runtime-Errors 30.07.2026).

alter table public.attribution_events
  drop constraint if exists attribution_events_event_type_check;

alter table public.attribution_events
  add constraint attribution_events_event_type_check check (
    event_type in (
      'impression',
      'click',
      'redirect',
      'lead',
      'conversion',
      'plan_intent',
      'plan_save',
      'share_activation',
      'group_confirmation',
      'route_copy',
      'route_view',
      'route_publish',
      'creator_follow',
      'ai_plan_open',
      'ai_plan_generated',
      'ai_plan_applied',
      'ai_plan_exited'
    )
  );
