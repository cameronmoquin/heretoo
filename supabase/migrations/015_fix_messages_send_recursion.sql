-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 015: Fix infinite recursion in messages_send
-- ════════════════════════════════════════════════════════════════════════
-- Bug: posting a chat message threw "infinite recursion detected in
--      policy for relation messages".
--
-- Cause: migration 007 introduced a `messages_send` policy whose
--        WITH CHECK references the `messages` table itself
--        ("for a 'pending' thread, the initiator may send ONE
--        intro message"). PostgreSQL's policy evaluation can't tell
--        that the inner SELECT shouldn't re-trigger the same
--        policy, so it bails with the recursion error.
--
-- Fix: move the "have I already sent in this thread?" check into a
--      SECURITY DEFINER helper. The function bypasses RLS on its
--      internal SELECT, breaking the recursion. The policy then
--      calls the helper instead of doing the SELECT inline.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.viewer_already_sent_in_thread(
  thread_id_in uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.messages m
    where m.thread_id = thread_id_in
      and m.sender_id = auth.uid()
  );
$$;

grant execute on function public.viewer_already_sent_in_thread(uuid) to authenticated;

-- Replace the recursive policy.
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
            t.status = 'pending'
            and t.initiator_id = auth.uid()
            and not public.viewer_already_sent_in_thread(t.id)
          )
        )
    )
  );

-- DONE.
