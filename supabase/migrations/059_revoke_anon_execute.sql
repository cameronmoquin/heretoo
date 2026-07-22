-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 059: close anon EXECUTE on three definer functions
-- ════════════════════════════════════════════════════════════════════════
-- Three migrations locked their maintenance functions with
--
--   revoke all on function ... from public, authenticated;
--
-- and that is not enough on Supabase. PostgREST reaches the database as
-- `anon` for an unauthenticated request, and Supabase grants EXECUTE to
-- `anon` directly rather than only through PUBLIC. Revoking PUBLIC and
-- `authenticated` leaves the direct grant to `anon` standing, so all
-- three stayed callable from the open internet with nothing but the
-- publishable anon key.
--
-- Verified against production before writing this. Each one returned 200
-- to an anon POST on /rest/v1/rpc/<name>. They looked harmless only
-- because the tables behind them are currently empty.
--
--   pending_subject_post_notifications(interval, int)  [057]
--     The real leak. security definer, so it bypasses RLS by design for
--     the notifier worker. Returns notification_email, display_name,
--     handle, and post body for every follower of every Subject across
--     every crew. Empty today because subjects and post_subjects have
--     zero rows. The first Subject anyone creates turns this into an
--     unauthenticated dump of member emails and private post text.
--
--   purge_expired_loft_posts()                         [036]
--   cleanup_stale_video_calls()                        [041]
--     Bounded damage: both only remove rows that are already expired or
--     stale, which is what their scheduled callers do anyway. Still, an
--     anonymous caller should not be able to drive cleanup on demand, and
--     hammering either one is free load on the database.
--
-- Fix: revoke from anon as well, explicitly, and re-run the original
-- revokes so this file is complete on its own. Idempotent, safe to
-- re-run. Nothing about the function bodies changes, so the service-role
-- worker and the scheduled jobs keep working exactly as they do now.
--
-- Pattern to carry forward: any new security-definer function meant for
-- service-role use only needs all three roles named.
--     revoke all on function public.<fn>(<args>) from public, anon, authenticated;
-- ════════════════════════════════════════════════════════════════════════

-- 057: the notifier query. This is the one that leaks.
revoke all on function public.pending_subject_post_notifications(interval, int)
  from public, anon, authenticated;

-- 036: loft expiry sweep.
revoke all on function public.purge_expired_loft_posts()
  from public, anon, authenticated;

-- 041: stale video-call sweep.
revoke all on function public.cleanup_stale_video_calls()
  from public, anon, authenticated;

-- DONE.
