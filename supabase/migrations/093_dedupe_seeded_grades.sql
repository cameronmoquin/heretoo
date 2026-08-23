-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 093: sweep up the double-planted school years
-- ════════════════════════════════════════════════════════════════════════
-- The seed used to insert one grade at a time, so a mid-loop failure
-- left half a school behind and every retry re-planted the grades that
-- had already landed. The client now seeds atomically and skips what
-- exists; this cleans the duplicates the old behavior created.
--
-- Keeps the EARLIEST row of each duplicate set — the one any responses
-- or photos are most likely linked to — and only deletes exact twins:
-- same project, same school, same grade, same start date. Anything
-- linked to a deleted twin is re-pointed at the survivor first, so no
-- entry or photo is orphaned.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent — a second run
-- finds nothing to do.
-- ════════════════════════════════════════════════════════════════════════

begin;

with ranked as (
  select id,
         first_value(id) over (
           partition by project_id, kind,
                        coalesce(organization, ''),
                        coalesce(role_or_grade, ''),
                        start_date
           order by created_at, id
         ) as keeper
  from public.memoir_timeline_events
  where kind = 'school'
),
twins as (
  select id, keeper from ranked where id <> keeper
)
-- Re-point anything hanging off a twin, then delete the twin.
, moved_responses as (
  update public.memoir_responses r
     set timeline_event_id = t.keeper
    from twins t
   where r.timeline_event_id = t.id
  returning r.id
)
, moved_assets as (
  update public.memoir_assets a
     set timeline_event_id = t.keeper
    from twins t
   where a.timeline_event_id = t.id
  returning a.id
)
delete from public.memoir_timeline_events e
 using twins t
 where e.id = t.id;

commit;

-- ── Verify ───────────────────────────────────────────────────────────
--   select organization, role_or_grade, count(*)
--   from memoir_timeline_events where kind='school'
--   group by 1,2 having count(*) > 1;   → no rows
-- DONE.
