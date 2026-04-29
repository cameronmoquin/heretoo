-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 007: Thread approval gate (>3 hops)
-- ════════════════════════════════════════════════════════════════════════
-- Adds an approval step on direct-message threads when the two
-- participants are more than 3 family-network hops apart (i.e. they
-- aren't in each other's natural mesh). The requester can send an
-- intro, but no further messages until the recipient accepts.
--
-- Schema:
--   message_threads.status: 'open' | 'pending' | 'declined'
--     - 'open'      → both can send freely (default for in-network pairs)
--     - 'pending'   → only initiator may send their first message; the
--                     recipient sees an "Accept request" UI
--     - 'declined'  → no further messages; thread is hidden from both
--   message_threads.initiator_id → who started it (matters in 'pending')
--
-- A SECURITY DEFINER helper `viewer_is_in_network(target)` returns true
-- if the target is in the viewer's 3-hop family reach. The frontend
-- uses this to decide between "Send" and "Send request" UX, and the
-- thread INSERT policy uses it to enforce default status.
-- ════════════════════════════════════════════════════════════════════════

-- 1. New columns on message_threads.
alter table public.message_threads
  add column if not exists status text not null default 'open'
    check (status in ('open', 'pending', 'declined')),
  add column if not exists initiator_id uuid references public.profiles(id) on delete set null;

create index if not exists message_threads_status_idx
  on public.message_threads(status);

-- 2. Helper: is `target` in the viewer's 3-hop family network?
create or replace function public.viewer_is_in_network(target uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.family_network_reach(auth.uid(), 3)
    where profile_id = target
  );
$$;

grant execute on function public.viewer_is_in_network(uuid) to authenticated;

-- 3. Tighten message INSERT policy: in a 'pending' thread only the
--    initiator may send (their intro), nobody after; in 'declined'
--    nobody may send; in 'open' any participant may send.
drop policy if exists messages_send on public.messages;

create policy messages_send on public.messages
  for insert to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.message_threads t
      where t.id = messages.thread_id
        and auth.uid() in (t.participant_a, t.participant_b)
        and (
          t.status = 'open'
          or (
            -- Only the initiator may send in 'pending', and only when
            -- there isn't already a message — i.e. exactly one intro.
            t.status = 'pending'
            and t.initiator_id = auth.uid()
            and not exists (
              select 1 from public.messages m
              where m.thread_id = t.id and m.sender_id = auth.uid()
            )
          )
        )
    )
  );

-- 4. Allow recipient to update thread status (accept / decline).
drop policy if exists threads_update on public.message_threads;
create policy threads_update on public.message_threads
  for update to authenticated
  using (auth.uid() in (participant_a, participant_b))
  with check (auth.uid() in (participant_a, participant_b));

-- DONE.
