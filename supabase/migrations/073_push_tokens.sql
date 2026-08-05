-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 073: push tokens
-- ════════════════════════════════════════════════════════════════════════
-- Native push, so a phone buzzes when a message lands. Email (072) polls
-- every two minutes and withholds anything already read; that is right
-- for mail and useless for a notification. A push that arrives three
-- minutes late is not a notification, so this one is sent by the
-- SENDER'S client the moment the insert succeeds, not by a poll.
--
-- One row per device, not per person. A phone and a tablet are two
-- tokens and both should ring; Expo hands back a different token per
-- installation, and a token can migrate between users if a device is
-- handed over, which is why profile_id is on the row rather than the
-- token being a column on profiles.
-- ════════════════════════════════════════════════════════════════════════


-- ── 1. The table ─────────────────────────────────────────────────────
create table if not exists public.push_tokens (
  token       text primary key,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  platform    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists push_tokens_profile_idx
  on public.push_tokens(profile_id);

alter table public.push_tokens enable row level security;


-- ── 2. RLS: your own devices, nobody else's ──────────────────────────
-- A person registers and removes their own tokens. Nobody reads anyone
-- else's — the send path does not go through RLS at all, it goes
-- through the service role in a Netlify function.
drop policy if exists push_tokens_own on public.push_tokens;
create policy push_tokens_own on public.push_tokens
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());


-- ── 3. Who to ring for a given message ───────────────────────────────
-- SECURITY DEFINER: it crosses to the other participant's tokens and
-- their notification prefs, neither of which the caller can read. It
-- also returns the sender id so the endpoint can verify that whoever
-- called it is actually the person who wrote the message — the function
-- checks that before sending anything.
--
-- Deliberately NOT filtered on read_at or age. Unlike email, a push is
-- the thing that tells you to look; withholding it because you have not
-- looked yet would be circular.
create or replace function public.push_targets_for_message(message_id_in uuid)
returns table (
  sender_id    uuid,
  sender_name  text,
  recipient_id uuid,
  token        text,
  platform     text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.sender_id,
    coalesce(sp.display_name, sp.handle),
    r.id,
    pt.token,
    pt.platform
  from public.messages m
  join public.message_threads t on t.id = m.thread_id
  join public.profiles r
    on r.id = case when t.participant_a = m.sender_id
                   then t.participant_b else t.participant_a end
  join public.profiles sp on sp.id = m.sender_id
  join public.push_tokens pt on pt.profile_id = r.id
  left join public.notification_prefs np on np.profile_id = r.id
  where m.id = message_id_in
    and m.sender_id <> r.id
    and coalesce(np.email_new_message, true);
$$;


-- ── 4. Grants ────────────────────────────────────────────────────────
-- All three roles named, then granted to none. The endpoint calls this
-- with the service role, which bypasses grants. Same reasoning as 072
-- and the same incident behind it (059): a SECURITY DEFINER function
-- that reads another person's rows must never be reachable with the
-- publishable key.
revoke all on function public.push_targets_for_message(uuid)
  from public, anon, authenticated;


-- ── 5. Verify ────────────────────────────────────────────────────────
--   curl -s -o /dev/null -w '%{http_code}\n' \
--     -X POST "$SUPABASE_URL/rest/v1/rpc/push_targets_for_message" \
--     -H "apikey: $ANON_KEY" -H 'Content-Type: application/json' \
--     -d '{"message_id_in":"00000000-0000-0000-0000-000000000000"}'
--   -- 401/404 correct; 200 means step 4 did not take.

-- DONE.
