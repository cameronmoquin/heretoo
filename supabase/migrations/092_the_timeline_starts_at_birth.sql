-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 092: the timeline starts at birth
-- ════════════════════════════════════════════════════════════════════════
-- The spine had no first vertebra: the kind list ran school → custom,
-- so there was nowhere to record being born, and the rail anchored on
-- whatever happened to be the earliest dated event — first grade,
-- usually. 'birth' becomes a first-class kind. The client offers it
-- once (a life gets one), anchors the rail on it, and the interview's
-- own first question — when and where were you born — finally has a
-- place on the ruler its answer describes.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

begin;

alter table public.memoir_timeline_events
  drop constraint if exists memoir_timeline_events_kind_check;

alter table public.memoir_timeline_events
  add constraint memoir_timeline_events_kind_check
  check (kind in ('birth','school','job','residence','milestone',
                  'relationship','travel','baby','custom'));

commit;

-- ── Verify ───────────────────────────────────────────────────────────
--   insert a kind='birth' row → accepted; kind='nonsense' → refused
-- DONE.
