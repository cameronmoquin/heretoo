-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 072: email when a message arrives
-- ════════════════════════════════════════════════════════════════════════
-- A message sat unseen until the recipient happened to open the app.
-- Realtime (071) fixes that for someone already looking at the screen;
-- this covers everyone who is not.
--
-- Shaped exactly like 057's subject-post notifications: a `notified_at`
-- stamp on the row, one RPC that returns what is owed, one that marks it
-- sent, and a scheduled Netlify function in between. Nothing here pushes
-- to the client, so there is no new realtime surface and no new RLS.
--
-- WHAT IS DELIBERATELY NOT EMAILED:
--   · your own message back to you
--   · anything already read — if they saw it in the app, the email is
--     noise, and the poll runs slowly enough for that to be common
--   · anything under a minute old, so an active back-and-forth does not
--     generate a mailbox full of single lines
--   · anyone with email_enabled or email_new_message off
-- ════════════════════════════════════════════════════════════════════════


-- ── 1. The stamp ─────────────────────────────────────────────────────
alter table public.messages
  add column if not exists notified_at timestamptz;

-- Partial index: the poll only ever asks for the unnotified, which is a
-- vanishing fraction of the table once this has been running a while.
create index if not exists messages_unnotified_idx
  on public.messages(created_at)
  where notified_at is null;


-- ── 2. What is owed ──────────────────────────────────────────────────
-- SECURITY DEFINER because it reads auth.users for the fallback address
-- and crosses to the recipient's notification_prefs — neither of which
-- the caller could read themselves. That is precisely why step 4 locks
-- it to service_role and nobody else.
create or replace function public.pending_message_notifications()
returns table (
  message_id   uuid,
  thread_id    uuid,
  body         text,
  created_at   timestamptz,
  sender_name  text,
  sender_handle text,
  recipient_id uuid,
  recipient_email text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.thread_id,
    m.body,
    m.created_at,
    sp.display_name,
    sp.handle,
    r.id,
    coalesce(np.notification_email, u.email)
  from public.messages m
  join public.message_threads t on t.id = m.thread_id
  -- The recipient is whichever participant did not send it.
  join public.profiles r
    on r.id = case when t.participant_a = m.sender_id
                   then t.participant_b else t.participant_a end
  join public.profiles sp on sp.id = m.sender_id
  left join public.notification_prefs np on np.profile_id = r.id
  left join auth.users u on u.id = r.id
  where m.notified_at is null
    and m.read_at is null
    and m.created_at < now() - interval '1 minute'
    and m.sender_id <> r.id
    and coalesce(np.email_enabled, true)
    and coalesce(np.email_new_message, true)
    and coalesce(np.notification_email, u.email) is not null
  order by m.created_at
  limit 200;
$$;


-- ── 3. Marking them sent ─────────────────────────────────────────────
-- Takes the ids the sender actually succeeded on, so a Resend failure
-- leaves the row unnotified and the next run retries it rather than
-- silently dropping the only notice someone was going to get.
create or replace function public.mark_messages_notified(ids uuid[])
returns integer
language sql
volatile
security definer
set search_path = public
as $$
  with done as (
    update public.messages
       set notified_at = now()
     where id = any(ids) and notified_at is null
     returning 1
  )
  select count(*)::int from done;
$$;


-- ── 4. Grants ────────────────────────────────────────────────────────
-- Both are SECURITY DEFINER and both cross into auth.users and another
-- person's prefs. All three roles named, then granted to nobody — the
-- Netlify function calls these with the service role, which bypasses
-- grants entirely. Migration 059 exists because three functions shaped
-- like these were callable from the open internet with the publishable
-- key; pending_subject_post_notifications, the one this is modelled on,
-- was the worst of them.
revoke all on function public.pending_message_notifications()
  from public, anon, authenticated;
revoke all on function public.mark_messages_notified(uuid[])
  from public, anon, authenticated;


-- ── 5. Verify ────────────────────────────────────────────────────────
-- Locked. With the publishable anon key both must refuse:
--
--   curl -s -o /dev/null -w '%{http_code}\n' \
--     -X POST "$SUPABASE_URL/rest/v1/rpc/pending_message_notifications" \
--     -H "apikey: $ANON_KEY" -H 'Content-Type: application/json' -d '{}'
--
-- 401/404 correct. 200 means step 4 did not take.
--
-- Then, with the service role, expect rows only for unread messages
-- older than a minute whose recipient has not turned email off.

-- DONE.
