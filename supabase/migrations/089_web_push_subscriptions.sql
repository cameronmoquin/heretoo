-- Web push subscriptions.
--
-- push_tokens (073) holds Expo tokens for the native apps. This is the
-- browser equivalent: a PushSubscription from the Push API, which is a URL
-- plus two keys and is not interchangeable with an Expo token, so it needs
-- its own table rather than another column on that one.
--
-- Why this exists at all: the only HereToo on an iPhone is the web app, and
-- registerPushToken() bails on web. Without this there is no way to alert a
-- parent that their kid wrote to them except a polled email, which lands one
-- to three minutes later.
--
-- iOS only delivers web push to a PWA the user has added to their home
-- screen. A subscription obtained from a Safari tab will never fire.

create table if not exists public.web_push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  -- The endpoint is the identity of a subscription. Browsers reissue it on
  -- their own schedule, so the same person accumulates rows unless this is
  -- unique and upserted against.
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists web_push_subscriptions_profile_idx
  on public.web_push_subscriptions(profile_id);

alter table public.web_push_subscriptions enable row level security;

-- Own-row only. The sender never reads the recipient's subscription; the
-- push-send function does that with the service role.
drop policy if exists "own subscriptions" on public.web_push_subscriptions;
create policy "own subscriptions"
  on public.web_push_subscriptions
  for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ── Targets ──────────────────────────────────────────────────────────
-- The web-push twin of push_targets_for_message (073). Same recipient
-- resolution and the same notification_prefs check; it differs only in
-- joining web_push_subscriptions instead of push_tokens.
--
-- It has to be a separate function rather than a column on that one: the
-- original INNER JOINs push_tokens, so anyone without an Expo token —
-- which is everyone using HereToo in a browser — never appears in its
-- results at all.
--
-- `auth` is spelled auth_key in the return type. Postgres would take the
-- bare name, but `auth` is also the schema Supabase keeps its user tables
-- in, and a column of that name inside a SECURITY DEFINER function with
-- search_path = public is a trap for whoever edits this next.
create or replace function public.web_push_targets_for_message(message_id_in uuid)
returns table (
  sender_id    uuid,
  sender_name  text,
  recipient_id uuid,
  endpoint     text,
  p256dh       text,
  auth_key     text
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
    s.endpoint,
    s.p256dh,
    s.auth
  from public.messages m
  join public.message_threads t on t.id = m.thread_id
  join public.profiles r
    on r.id = case when t.participant_a = m.sender_id
                   then t.participant_b else t.participant_a end
  join public.profiles sp on sp.id = m.sender_id
  join public.web_push_subscriptions s on s.profile_id = r.id
  left join public.notification_prefs np on np.profile_id = r.id
  where m.id = message_id_in
    and m.sender_id <> r.id
    and coalesce(np.email_new_message, true);
$$;

-- Reachable only with the service role, same as 073's. A SECURITY DEFINER
-- function that reads another person's subscription must never be callable
-- with the publishable key.
revoke all on function public.web_push_targets_for_message(uuid)
  from anon, authenticated, public;
