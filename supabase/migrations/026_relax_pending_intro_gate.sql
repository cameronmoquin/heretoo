-- ════════════════════════════════════════════════════════════════════════
-- Migration 026 — relax the "one intro per pending thread" rule.
--
-- Why: alpha-stage UX. Capping the initiator at exactly one message
-- before the recipient accepts felt punitive — users hit the cap, the
-- composer disappeared on them, and they thought messaging was broken.
-- The recipient-accepts gate (status='pending' until accept) is enough
-- spam protection at this stage; we don't also need to cap the
-- initiator's intro at one message.
--
-- Effect: in a 'pending' thread the initiator can send freely, but
-- nobody else can send. On accept, status flips to 'open' and both
-- sides can talk normally. On decline, status='declined' blocks sends.
-- ════════════════════════════════════════════════════════════════════════

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
            -- removed: viewer_already_sent_in_thread cap.
          )
        )
    )
  );

-- DONE.
