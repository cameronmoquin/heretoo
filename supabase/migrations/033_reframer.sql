-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 033: Conflict Reframer (Source of Truth, M8)
-- ════════════════════════════════════════════════════════════════════════
-- The Reframer is opt-in, never automatic, and never visible to the
-- other party. When a user is composing a reply in a DM or family
-- chat that the system flags as escalating, a small eye icon appears
-- by the send button. Tapping opens a drawer with three short
-- paragraphs: reading their note, reading your draft, optional
-- alternative phrasing. The user accepts, edits, or ignores.
--
-- Privacy by construction: ONLY metadata is stored. Draft content,
-- conversation history, and the LLM's reframe never touch the
-- database. The hash field lets future de-dup work without storing
-- anything readable.
--
-- Refusal list (M8):
--   - No automatic blocking of escalating messages.
--   - No automatic edits.
--   - No reframer in the broader feed (only DMs / family chat).
--   - No surfacing of reframer use to the recipient.
--   - No selling reframer aggregate data, ever.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.reframer_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  triggered_at    timestamptz not null default now(),
  -- SHA-256 of the draft text. Hashed client-side; the actual draft
  -- never leaves the device for this row. Used to de-dup repeated
  -- triggers on the same draft (don't re-emit the eye for every
  -- keystroke on the same paragraph).
  draft_hash      text not null,
  -- Did the user open the drawer at all?
  was_opened      boolean not null default false,
  -- Did the user accept the suggested reframe verbatim?
  was_accepted    boolean not null default false,
  -- Did the user edit the draft after seeing the reframe (proxy for
  -- the reframe having had any effect, accepted-or-not)?
  was_edited      boolean not null default false,
  -- Where the trigger fired — 'dm' | 'family_chat'. No further
  -- conversation identity is stored.
  surface         text not null check (surface in ('dm', 'family_chat'))
);

create index if not exists reframer_events_user_idx
  on public.reframer_events (user_id, triggered_at desc);

alter table public.reframer_events enable row level security;

-- A user sees only their own events.
drop policy if exists reframer_events_self_read on public.reframer_events;
create policy reframer_events_self_read on public.reframer_events
  for select to authenticated
  using (auth.uid() = user_id);

-- Insert from the client when the eye fires; user_id must match.
drop policy if exists reframer_events_self_insert on public.reframer_events;
create policy reframer_events_self_insert on public.reframer_events
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Update for follow-on flags (was_opened, was_accepted, was_edited)
-- by the same user.
drop policy if exists reframer_events_self_update on public.reframer_events;
create policy reframer_events_self_update on public.reframer_events
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DONE.
