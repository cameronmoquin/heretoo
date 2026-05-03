-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 018: mark_thread_read RPC
-- ════════════════════════════════════════════════════════════════════════
-- Purpose: when the viewer opens a chat thread, flip read_at on every
--          inbound message in that thread to now(). Powers the "unread
--          count badge goes down when you actually read messages"
--          behavior in the bottom nav.
--
-- Why an RPC: the existing UPDATE policy on `messages` only lets the
--   sender modify their own rows. We deliberately don't broaden that
--   policy — non-senders shouldn't be able to edit message bodies.
--   A SECURITY DEFINER function is the right tool: it gates the update
--   to (a) the caller is a participant in the thread, (b) only flips
--   read_at on rows the caller did NOT send, (c) only when read_at is
--   currently null (idempotent).
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.mark_thread_read(
  p_thread_id uuid
)
returns integer  -- how many rows were marked (handy for telemetry)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  -- Guard: caller must actually be a participant. Otherwise anyone with
  -- a thread id could spam-flip read_at on strangers' threads.
  if not exists (
    select 1 from public.message_threads t
    where t.id = p_thread_id
      and v_uid in (t.participant_a, t.participant_b)
  ) then
    raise exception 'not a participant';
  end if;

  update public.messages
     set read_at = now()
   where thread_id = p_thread_id
     and sender_id <> v_uid
     and read_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.mark_thread_read(uuid) to authenticated;

-- DONE.
